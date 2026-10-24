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
  - Dynamic Per-Attempt Headroom & RFC 9651 Budget Calibration (October 2026):
    - Removed arbitrary 25.0s per-attempt clamp (`read=min(remaining_budget, 25.0)`). Replaced with dynamic reasoning headroom up to 70.0s (`max_attempt_read = 70.0 if (thinking_budget and thinking_budget > 0) or client_timeout_budget > 60.0 else 55.0`).
    - Base HTTP client `read` timeout increased to 75.0s in `connection.py`.
    - Key cooldown on upstream attempt timeout lowered from 120s to 60s to prevent false key pool starvation.
    - Added RFC 9651 `Request-Timeout: 90` / `X-Request-Timeout: 90` propagation from backend `generateBugChallenge`.
    - Calibrated `deepIncidentSynthesis` reasoning config: `thinkingBudget: 2048`, `maxTokens: 8192` (sub-30s synthesis vs previous 45s+).
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* Upstream models `gemini-3.8-flash` and `3.7-flash` returned HTTP 503 Overloaded. When read-timeout (60s) triggered, Python raised `NameError` due to missing import, crashing the gateway with 500.
  - *Empirical Bug Hunt Failure:* In Bug Hunt Arena (`/api/tutor/bug-challenge`), case generation timed out after 60s twice in a row. Empirical profiling revealed `gemini-3.8-flash` took 25.60s–35.77s for deep incident JSON synthesis. Because `attempt_timeout` was hard-clamped at 25.0s, the proxy killed the generation at 25.0s, penalized the key for 120s, and repeated until the 60s total deadline budget threw 504 Gateway Timeout.
  - *Intermediate Conclusion:* Deep reasoning models require $\ge 55$s per-attempt headroom. Providing dynamic 70s headroom and transmitting `Request-Timeout: 90` allows `gemini-3.8-flash` to cleanly complete deep incident synthesis in 26-28s on the first attempt without timeouts.
- **Rationale & "Why":** Deep reasoning models naturally require 20–45s for synthesis. Artificially clamping attempts below the physical token generation timeline guarantees 100% cascade failure.
- **Invariants:**
  - Gateway must never truncate legitimate reasoning turns shorter than the client's declared `Request-Timeout` budget.
  - API keys must not be permanently penalized with long cooldowns for internal proxy timeout clamps.

