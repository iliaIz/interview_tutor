# 03. LiteLLM Proxy & Upstream Bidi Gateway

> **Location:** `docs/architecture/functional_registry/03_litellm_proxy_gateway.md`  
> **Subsystem (Level 1):** LiteLLM Proxy & Upstream Bidi Gateway  
> **Primary Files:** [`LiteLLM_Proxy/gateway/app/routers/live.py`](file:///home/djelu/LiteLLM_Proxy/gateway/app/routers/live.py), [`LiteLLM_Proxy/gateway/app/services/key_pool.py`](file:///home/djelu/LiteLLM_Proxy/gateway/app/services/key_pool.py), [`LiteLLM_Proxy/gateway/app/services/circuit_breaker.py`](file:///home/djelu/LiteLLM_Proxy/gateway/app/services/circuit_breaker.py)

---

## 1. Subsystem Scope
Centralized proxy service running in Docker container `litellm-gateway`. Manages Google API key pooling, cascade routing (`gemini-live-v3` $\rightarrow$ `gemini-3.8-live`), bidirectional WebSocket tunneling, rate limit circuit breaking, and telemetry spend logging.

---

## 2. Touch List & Function Hierarchy (Level 2)

### 2.1 `websocket_live_proxy()`
- **Location:** [`LiteLLM_Proxy/gateway/app/routers/live.py#L16-L272`](file:///home/djelu/LiteLLM_Proxy/gateway/app/routers/live.py)
- **What Was Done:**
  - Implemented bidirectional streaming bridge between backend client socket and Google Generative Language Bidi endpoint.
  - Dynamically rewrites incoming `setup.model` from virtual cascade name (`gemini-live-v3`) to physical upstream target (`models/gemini-3.8-live`).
  - Normalizes deprecated `realtimeInput.mediaChunks` payloads into canonical `realtimeInput.audio` format while preserving barge-in flags.
  - Added early failure failover: if upstream Gemini drops connection with quota error when `bytes_out == 0`, immediately attempts next available key in the execution plan.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Proxy should transparently cycle keys on early failure.
  - *Empirical Finding:* If a key drops AFTER delivering greeting audio (`bytes_out > 0`, e.g. 281KB on Turn 0), early failover cannot reconnect mid-session because the client task is cancelled. The proxy closes the socket, delegating recovery to backend Hot Reconnect.
- **Rationale & "Why":** Completely encapsulates credential management and upstream model IDs from the application layer.
- **Invariants:** Upstream Google API keys must never be exposed to clients or backend application logs.

---

### 2.2 `circuit_breaker.set_key_cooldown()`
- **Location:** [`LiteLLM_Proxy/gateway/app/services/circuit_breaker.py`](file:///home/djelu/LiteLLM_Proxy/gateway/app/services/circuit_breaker.py)
- **What Was Done:** Placed keys into temporary cooldown (default 60s) upon detecting quota errors (HTTP 429, WS close code 1011/1008 with message `"You exceeded your current quota"`).
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* In session `session_practice_1791480211936_imjem0`, all 4 Google Gemini keys in the pool (`Ca5g`, `kNHg`, `wKkA`, `_StQ`) were simultaneously exhausted due to heavy CI/CD test load (143 Live sessions run today).
  - *Intermediate Conclusion:* When the entire pool is in cooldown, upstream connections fail immediately, forcing the backend into repeated Hot Reconnect loops until the 60s timer expires.
- **Rationale & "Why":** Prevents repeated failed upstream calls that would trigger Google IP-level bans or extended throttling.
- **Invariants:** Cooldown must be key-specific and model-specific, not global, so healthy models/keys remain accessible.

---

### 2.3 `key_pool.get_model_targets_and_keys()`
- **Location:** [`LiteLLM_Proxy/gateway/app/services/key_pool.py`](file:///home/djelu/LiteLLM_Proxy/gateway/app/services/key_pool.py)
- **What Was Done:** Resolves the model cascade execution plan for a requested model (e.g. `gemini-live-v3` $\rightarrow$ `gemini-3.8-live`), querying active keys from SQLite `gateway_provider_keys`, filtering out cooled-down keys, and ordering by priority.
- **Hypotheses & Intermediate Conclusions:**
  - Round-robin / priority sorting distributes load across multiple free-tier and paid accounts.
- **Rationale & "Why":** Essential for zero-downtime key rotation without restarting containers.
- **Invariants:** When all keys are exhausted, must return an empty plan triggering graceful error response rather than crashing the gateway process.

---

### 2.4 `chat_completions()`
- **Location:** [`LiteLLM_Proxy/gateway/app/routers/chat.py`](file:///home/djelu/projects/LiteLLM_Proxy/gateway/app/routers/chat.py)
- **What Was Done:**
  - Added missing `import httpx` at module level, eliminating fatal `NameError: name 'httpx' is not defined` when read-timeouts occur.
  - Replaced narrow `except httpx.ReadTimeout:` with universal `except httpx.TimeoutException:` (covering connect, read, write, and pool timeouts).
  - Extracted reasoning/thinking blocks (`p["thought"]`) from Gemini response parts so `message_dict["content"]` never degrades to `None` when upstream answers with reasoning tokens.
  - Added fast-failover on HTTP 500/502/503/504 with 45s model cooldown.
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* Upstream models `gemini-3.8-flash` and `3.7-flash` returned HTTP 503 Overloaded. When read-timeout (60s) triggered, Python raised `NameError` due to missing import, crashing the gateway with 500.
  - *Intermediate Conclusion:* Adding `import httpx` and catching `httpx.TimeoutException` allows the gateway to cleanly cycle to healthy models/keys and return controlled status codes.
- **Rationale & "Why":** Upstream Gemini capacity spikes must not crash proxy processes or freeze downstream client assessment sessions.
- **Invariants:** Gateway must never throw unhandled python exceptions on upstream timeouts.

---

### 2.5 `live_affinity & websocket_live_proxy(): Sticky Key Affinity, Resumption Shield & Upstream Close Transparency (Spec 42)`
- **Location:** [`LiteLLM_Proxy/gateway/app/services/live_affinity.py`](file:///home/djelu/projects/LiteLLM_Proxy/gateway/app/services/live_affinity.py), [`LiteLLM_Proxy/gateway/app/routers/live.py`](file:///home/djelu/projects/LiteLLM_Proxy/gateway/app/routers/live.py), [`LiteLLM_Proxy/tests/test_live_ws_affinity_and_close.py`](file:///home/djelu/projects/LiteLLM_Proxy/tests/test_live_ws_affinity_and_close.py)
- **What Was Done (Commit `5dfafab` on `LiteLLM_Proxy/master`):**
  1. **Sticky Session-to-Key Affinity:** Added `prioritize_execution_plan_by_affinity()` / `record_affine_key_mask()` keyed by `session_id` (30m TTL) via `InMemoryTTLRedis`, keeping reconnects and `GoAway` handoffs pinned to the same Google API key so server-issued `sessionResumption.handle` remains valid (Google Live handles are key-scoped).
  2. **Cross-Key Resumption Stripping:** When affinity rotates to a backup key across the 4-key pool, `prepare_live_setup_payload()` strips incompatible foreign `sessionResumption` / `sessionResumptionConfig` handles and emits `{ "type": "key_rotated", "previousKeyMask", "activeKeyMask" }` to `interview_tutor`.
  3. **Transparent Close Code Propagation:** Added `upstream_closed` JSON frame before websocket close and RFC-6455 close code sanitization (`classify_upstream_termination()`), preserving `1008`/`1011` instead of rewriting upstream drops to blank `1000`.
- **Verification Note (Empirical):**
  - Pushed to private repo `iliaIz/LiteLLM_Proxy` (`5dfafab`), where GitHub Actions run `45642648800` failed prior to job start due to account billing quota on private runners (local execution skipped per VPS `AGENTS.md`). Backwards-compatible handling ensures `interview_tutor` operates cleanly both before and after gateway rollout.

