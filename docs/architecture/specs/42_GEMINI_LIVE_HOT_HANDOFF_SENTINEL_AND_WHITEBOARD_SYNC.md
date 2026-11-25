# Spec 42: Gemini Live Infinite Session Continuity, Hot Handoff, Passive Auto-VAD Sentinel & Multimodal Whiteboard Speech Sync

> **Spec ID:** `42`  
> **Status:** Approved / Authoritative SSOT  
> **Location:** `docs/architecture/specs/42_GEMINI_LIVE_HOT_HANDOFF_SENTINEL_AND_WHITEBOARD_SYNC.md`  
> **Target Standard:** SOTA Late 2026 / Zero-Downtime Duplex Live Streaming & Multimodal Tool Continuity  
> **Parent Specification:** [`AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](./AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md), [`Spec 36`](./36_GEMINI_LIVE_PRACTICE_PAIR_RESILIENCE.md), [`Spec 37`](./37_GEMINI_LIVE_LONG_SESSION_STABILITY_AND_STREAM_SYNC.md), [`Spec 39`](./39_GEMINI_LIVE_CLOUD_VAD_PIPELINE_RESTORATION.md)

---

## 1. Intent & Workload Envelope

### 1.1. Context & Glossary
- **Target Glossary & ADRs:** [`GLOSSARY.md`](../../../GLOSSARY.md) (`Dual-Sided Handshake`, `Acoustic Barge-In`, `LiveSessionAggregate`, `Turn 0 Lockdown`).
- **Verified Production Failures Fixed (2026-11-25 Telemetry):**
  1. **Silent 10-Minute Disconnect (`GoAway -> 1008`) & Half-Dead Zombie UI:**
     - `liveGeminiConfigBuilder.ts` omitted `contextWindowCompression: { slidingWindow: {} }` and serialized `sessionResumptionConfig` instead of canonical `sessionResumption`.
     - `LiveVoiceSession.ts` built a static `setupMessage` snapshot at `t = 0`, so rotated handles in `SessionResumptionManager` were never sent on reconnect.
     - Neither `liveAudioStreamRouter.ts` nor `UpstreamGeminiPipe.ts` handled `goAway { timeLeft }` frames, causing Google to abort sessions at ~590s (`1008 Connection aborted because the client failed to close the connection after receiving a GoAway signal`).
     - `LiteLLM_Proxy/gateway/app/routers/live.py` closed `client_ws` with default `code=1000` regardless of upstream error, while `UpstreamGeminiPipe.ts` silently returned on `code === 1000 || code === 1001` even when `!this.isClosed` — leaving browser sessions stuck for 6+ minutes on green "Слушаю" while silently dropping all mic audio.
     - `LiteLLM_Proxy` lacked `session_id -> key_mask` sticky affinity across its 4-key pool, risking cross-key `1008` failures during native resumption.
  2. **Zero Watchdog Protection in `Auto-VAD` + Audio Mutex Latch Race:**
     - After Spec 39 removed `audioStreamEnd` in `auto` mode, neither server `WatchdogManager` nor client `clientSafetyTimer` ever armed during Auto-VAD turns.
     - Forwarding raw `serverContent + toolCall` frames after `tool_execution_complete` latched `NativeLiveVoiceEngine.isAudioMutexLocked = true` prematurely.
  3. **Mutually Exclusive Whiteboard Display vs Spoken Explanation (`update_whiteboard`):**
     - `LiveToolEngine.ts` / `liveWorkspaceHandlers.ts` forced `scheduling: 'SILENT'` on `update_whiteboard` while `livePairPrompts.ts` and tool `result.directive` simultaneously commanded the model to explain verbally. Because `gemini-3.1-flash-live-preview` emits pure `toolCall`-only turns (`0ms` audio), `SILENT` suppressed verbal explanations until the candidate asked manually.
     - Naive `WHEN_IDLE` previously collided with candidate speech because `NativeLiveVoiceEngine` immediately unlocked `LISTENING` on the empty `turnComplete` following `toolCall`.

### 1.2. Operating Envelope
- **Session Duration Target:** Unbounded multi-turn sessions (`> 30 min`) with proactive socket rotation (`< 250ms` Make-Before-Break Hot Handoff on `goAway`) and transparent multi-key failover across 4 upstream Gemini keys.
- **Auto-VAD Stall SLA:** Passive detection of post-speech upstream silence without interrupting continuous PCM flow: Phase 1 status nudge at `7s` after speech cessation, Phase 2 active recovery at `16s` (0 false triggers during silent code reading).
- **Whiteboard Speech Continuity:** `>= 1200 bytes` (`>= 250ms`) of spoken explanation accompanying `write | patch | highlight` updates when the model has not yet spoken in that turn.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

1. **Database & Sandbox:** Zero changes to SQLite DDL (`questions`, `coding_challenges`, etc.) or Java 21 sandbox containers.
2. **AudioWorklet Core Math:** Zero changes to PCM 16kHz/24kHz resamplers, TKEO transient clipping, or `AudioPlayoutManager` ring-buffer capacity math.
3. **Continuous Auto-VAD Flow (`Spec 39`):** Passive Stream Sentinel MUST NEVER emit `audioStreamEnd` or truncate trailing ambient silence frames in `turnMode === 'auto'`.
4. **Manual Mode Isolation:** `turnMode === 'manual'` push-to-talk commit semantics remain unchanged.
5. **File-Hygiene SLA (`AGENTS.md §8`):** Newly created source files MUST be `<= 350` lines; modified source files MUST remain `<= 400` lines (decompose cohesive helpers before adding logic).

---

## 3. Pre-Agreed Verification Seams

- **Seam 1 (LiteLLM Gateway Proxy):** `LiteLLM_Proxy/gateway/app/routers/live.py`, `gateway/app/services/key_pool.py` -> Verified via `pytest tests/` in `LiteLLM_Proxy` CI.
- **Seam 2 (Shared Contracts & Gemini Config):** `shared/src/schemas/voiceEvents.ts`, `backend/src/services/live/liveGeminiConfigBuilder.ts`, `UpstreamGeminiPipe.ts`, `LivePromptDirector.ts` -> Verified via `npm --prefix shared run build`, `testGeminiConfigBuilder.ts`, and `test_vad:unit`.
- **Seam 3 (Backend Hot Handoff, Passive Sentinel & Tool Continuity):** `LiveHotHandoffCoordinator.ts`, `LiveStreamSentinel.ts`, `liveAudioStreamRouter.ts`, `DownstreamClientPipe.ts`, `LiveToolEngine.ts`, `liveWorkspaceHandlers.ts` -> Verified via `test:telemetry:router`, `test:vad:fault-injection`, `test:live:tool-isolation`, `test:vad:canary`.
- **Seam 4 (Frontend Voice Engine, FSM & Drawer UI):** `LiveVoiceFrameParser.ts`, `NativeLiveVoiceEngine.ts` + recovery helper, `LiveVoiceStateMachine.ts`, `PracticeVoiceContext.tsx`, `PracticeVoiceHUD.tsx`, `AmbientVoicePill.tsx` -> Verified via `npm --prefix frontend run test:audio-contracts`, `npm run build`, and `verify-hygiene`.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Canonical Gemini Setup (`liveGeminiConfigBuilder.ts`)
```json
{
  "setup": {
    "model": "models/gemini-live-v3",
    "generationConfig": { "responseModalities": ["AUDIO"], "temperature": 1.0 },
    "contextWindowCompression": {
      "slidingWindow": {}
    },
    "realtimeInputConfig": { "...": "..." },
    "sessionResumption": {
      "handle": "<optional_cryptographic_handle_on_resume_only>"
    }
  }
}
```
- Initial setup (`!opts.resumptionHandle`): omits `setup.sessionResumption` (`undefined`), preserving cross-key startup purity while `v1alpha` streams `sessionResumptionUpdate` handles.
- Resumed/handoff setup (`opts.resumptionHandle` present): sets `setup.sessionResumption = { handle }` (never legacy `sessionResumptionConfig`).

### 4.2. LiteLLM Proxy Downstream Lifecycle Frames (`live.py` -> Backend)
Before closing `client_ws` on unexpected upstream termination (`!client_disconnected`), `LiteLLM_Proxy` emits:
```json
{
  "type": "upstream_closed",
  "upstreamCode": 1008,
  "upstreamReason": "Connection aborted after GoAway",
  "keyMask": "AQ.Ab8R...-xsw",
  "bytesOut": 102400
}
```
followed by `await client_ws.close(code=safe_ws_code, reason=truncated_reason)` where `safe_ws_code` preserves `1008`/`1011`/`1012` (mapping invalid wire codes such as `None`/`1005`/`1006` to `1011`).

When sticky `session_id -> key_mask` affinity falls back to a different key due to cooldown/exhaustion during a session with `sessionResumption`:
```json
{
  "type": "key_rotated",
  "previousKeyMask": "AQ.Ab8R...-xsw",
  "activeKeyMask": "AQ.Ab8R...Ca5g"
}
```
and `LiteLLM_Proxy` strips incompatible cross-project `setup.sessionResumption` before sending to the newly selected key so it does not trigger a spurious `1008` or false key cooldown.

### 4.3. Backend -> Frontend Protocol Events (`shared/src/schemas/voiceEvents.ts`)
- Added events:
  - `upstream_reconnecting`: `{ type: 'upstream_reconnecting', attempt, maxAttempts, mode?: 'hot_handoff' | 'reconnect' }`
  - `hot_handoff_started` / `hot_handoff_complete`
  - `tool_awaiting_speech`: `{ type: 'tool_awaiting_speech', tools: string[] }` (instructs frontend FSM to remain in `AI_THINKING` until `WHEN_IDLE` spoken turn arrives or bounded `8s` safety timer expires)
  - `upstream_error`: structured recoverable/terminal error `{ type: 'upstream_error', error, errorCode, retryable }`
- `sync_pong` expanded cleanly with `isUpstreamConnected: boolean`.

### 4.4. Whiteboard Tool Scheduling Contract
- `update_whiteboard`:
  - `args.action === 'clear'` $\rightarrow$ `scheduling = 'SILENT'`.
  - `args.action` in `['write', 'patch', 'highlight']`:
    - If `session.currentTurnAudioBytes >= 24000` (`>= 500ms` of audio already emitted in the same model turn) $\rightarrow$ `scheduling = 'SILENT'` (avoid duplicate chatter).
    - Otherwise $\rightarrow$ `scheduling = 'WHEN_IDLE'` with crisp explanation directive (*«Доска обновлена. Сразу голосом в 2–3 предложениях объясни логику показанного фрагмента без вводных фраз вроде 'я вывела код на доску'.»*) + server/client hold in `AI_THINKING` until speech begins.

---

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy:** `Additive-Only` & Backwards-Compatible.
- Backend `interview_tutor` treats BOTH new (`upstream_closed`, `1008`/`1011`, `key_rotated`) AND legacy (`code=1000` unexpected upstream close when `!isClosed`) identically cleanly, allowing zero-downtime staggered deployment of `LiteLLM_Proxy` and `interview_tutor`.

---

## 6. Hoare-Logic Behavioral Contracts (`{P} C {Q}`)

### 6.1. Unexpected Upstream Closure vs Intentional Teardown (`UpstreamGeminiPipe`)
- **Pre-Conditions `{P}`:** Upstream socket closes with any code (`1000`, `1001`, `1006`, `1008`, `1011`).
- **Algorithm `C`:**
  - Iff `this.isClosed === true` (explicitly terminated via `pipe.close()`), ignore close event (`0` reconnects, `0` zombie tasks).
  - Iff `this.isClosed === false`, upstream termination is **always unexpected** (even on `code === 1000`):
    - Classify `1008` containing `goaway | session durat | expired | inactivity | resumed` OR unknown `1000` as retryable/resumable; classify `forbidden | unauthorized | invalid virtual key | exhausted` as non-retryable terminal error.
    - Schedule reconnect using fresh `getSetupMessage()` factory; if reconnect with `resumptionHandle` fails before `setupComplete` (`!hasReceivedSetupComplete`), clear `resumptionHandle` on immediate retry and fall back to Tier-2 context replay (`LiveGreetingReplay`).
    - If retries exhaust or error is non-retryable, notify client cleanly (`upstream_error`) and call `terminate()`.
- **Post-Conditions `{Q}`:** Zero silent zombie sessions; user is either seamlessly reconnected or explicitly informed cleanly.

### 6.2. Proactive `GoAway` Make-Before-Break Hot Handoff (`LiveHotHandoffCoordinator`)
- **Pre-Conditions `{P}`:** Active Socket A receives `parsed.goAway` with valid `timeLeft`, while `!session.isTerminated`.
- **Algorithm `C`:**
  1. Mark `handoffInProgress = true`; notify frontend `{ type: 'hot_handoff_started' }` (keeps mic usable, does not drop `isConnected`).
  2. Open Socket B with `buildSetupMessage({ resumptionHandle })` while Socket A continues servicing in-flight frames.
  3. On Socket B `setupComplete`: wait up to brief audio drain window if Socket A is mid-sentence (`!session.isAiGenerating`), or swap immediately when idle; atomically assign active socket = Socket B (`isSetupComplete = true`), close Socket A cleanly with `1000`, notify `{ type: 'hot_handoff_complete' }`.
  4. If Socket B fails with `resumptionHandle`, seamlessly fall back once without `handle` (`LiveGreetingReplay` `turnComplete: false` history hydration).
- **Post-Conditions `{Q}`:** Socket A terminates BEFORE Google's `1008` cutoff; conversation continues past 10, 20, 30+ minutes with zero user-visible drop.

### 6.3. Passive Auto-VAD Stream Sentinel (`LiveStreamSentinel`)
- **Pre-Conditions `{P}`:** Session operates in `turnMode === 'auto'`.
- **Algorithm `C`:**
  - Observe incoming 16kHz PCM RMS against adaptive noise floor + `serverContent.inputTranscription` + `serverContent.voiceActivity`:
    - Silence without prior user speech $\rightarrow$ `0` timers armed (reading code silently is never disturbed).
    - Speech activity detected $\rightarrow$ `hasSpokenInTurn = true`; on trailing silence exceeding `clampVadPauseMs(vadPauseMs) + 1500ms` (or `ACTIVITY_END`), arm Sentinel (`7s` Phase-1 `thinking_delay`, `16s` Phase-2 `dead_air_recovery` + recovery nudge/reconnect).
    - While `isAiGenerating === true` (`thought` / `WHEN_IDLE` / initial `modelTurn` without audio chunks or `turnComplete`), track chunk progress heartbeat (`10s` stall timeout) to unfreeze silent stalls.
- **Post-Conditions `{Q}`:** Zero interference with Google Cloud VAD audio frames; deterministic recovery from Auto-VAD or vocoder stalls.

### 6.4. Whiteboard + Speech Custody Sync (`LiveToolEngine` & `NativeLiveVoiceEngine`)
- **Pre-Conditions `{P}`:** Upstream emits `toolCall: update_whiteboard(write|patch|highlight)` with `0` or `< 500ms` prior turn audio.
- **Algorithm `C`:**
  - Backend dispatches `whiteboard_update` to UI, returns `toolResponse(..., 'WHEN_IDLE')`, emits `tool_awaiting_speech`, and clears any raw `toolCall` property before forwarding `serverContent` (`liveAudioStreamRouter#L324`).
  - Client receives `tool_awaiting_speech`, holds FSM in `AI_THINKING` across the empty `turnComplete` boundary under a bounded `8s` safety timer, then transitions cleanly to `AI_SPEAKING -> LISTENING` once the explanation finishes draining.
- **Post-Conditions `{Q}`:** Whiteboard renders immediately AND AI explains it aloud without candidate mic premature unlock or `isAudioMutexLocked` deadlock.
