---
status: accepted
verification: pending
date: 2026-11-26
---

# 0005. Unified AI Gateway Transport, Slim Live Handshake & In-Process Simulation Kernel

## Context & Problem Statement
Post-Wave 10 architectural review (`main` @ `aceceda`) exposed five structural leaks across the platform:
1. Seven backend AI callers bypass `LlmExecutionEngine` and `httpRetry` with direct `fetch` calls to `LiteLLM_Proxy`, missing `localhost` failover, Full-Jitter retries, and `AbortSignal` cancellation (`SystemDesignProbeGateway`, `practiceTutorStreaming`, `triage`, `dynamicTaskGenerator`, `systemDesignEvaluator`, `PodcastAudioPipeline`, `VectorEmbeddingRepository`).
2. `AudioPlayoutManager` retained 3 dead audio modules (200L) and 11 unused public methods + unwired `setMuted`, forcing contract tests into 7 `(playout as any)` hacks.
3. `liveAudioStreamRouter` leaked raw `session.geminiSocket.send()` writes across 5 collaborators during `goAway` rotation, while 7 inline mock tests in `testVadFaultInjection.ts` contradicted production guards (`SessionTurnState`, `LiveClientGuardService`).
4. `LoadSimulationWorker` (550L) and `desSimulator.worker` (367L) duplicated queueing/DAG physics and ignored `engineEval.cacheHitRatio`.
5. `liveVoiceUrlBuilder` duplicated 25+ fields across URL query and `session_init` (including duplicate `hrMode`/`dossierId` params) while `NativeLiveVoiceEngine` coordinated 5 shallow helpers via 12 manual calls and 39 flat frame fields.

## Decision
1. **Unified Backend AI Gateway (`LlmGatewayClient` + `HttpTransportPort`):** Consolidate all text, JSON, SSE streaming, TTS binary speech, and embedding calls onto `LlmGatewayClient`, retrying SSE streams (`429`/`503`) strictly before flushing any byte and propagating HTTP request `AbortSignal` across all routes. Embeddings override `maxRetries: 0` and keep deterministic fallback hashes.
2. **Exclusive Upstream Socket Custody (`UpstreamLiveChannel`):** Remove raw `session.geminiSocket` access outside `UpstreamLiveChannel`; every upstream frame travels through `UpstreamTransportPort.sendUpstream` / `isUpstreamOpen`, and `testVadFaultInjection.ts` exercises real `DownstreamClientPipe` + loopback `UpstreamSocketPort`.
3. **Strict Audio Playout Surface (`AudioPlayoutManager` + `AudioBackendPort`):** Delete dead audio chimes/ducking/buffer-playback modules and 11 unused methods plus unused output `setMuted`; test strictly through injected `AudioBackendPort`.
4. **Slim WebSocket Handshake (`?awaitInit=1`):** Limit WebSocket URL params to compact routing/calibration scalars (<400 bytes) + `awaitInit=1`, passing rich challenge/HR/whiteboard context exclusively via `session_init` (`mergeInitFrameIntoConfig` also maps `dossierId`, `jobId`, `questionMatrixId`). `LiveVoiceSession.start()` deterministically awaits the initial `session_init` frame up to 150ms when `?awaitInit=1` is set before building Gemini `setup`.
5. **Headless `in-process` `TopologySimulationKernel`:** Extract continuous tick, DES scenario, and Tarjan/DFS SPOF linting into one pure module honoring `engineEval.cacheHitRatio`, shrinking both Web Workers to ~30L adapters.

## Verification & Guardrail
- `backend`: `npm run test:vad:unit && npm run test:vad:fault-injection && npm run test:telemetry:all && npm run test:practice:resilience && npm run build`
- `frontend`: `npm run test:audio-contracts && npm run build` (includes new `LlmGatewayClient`, `AudioPlayoutManager(AudioBackendPort)`, `TopologySimulationKernel`, and `LiveTransportSupervisor`/`awaitInit` contract suites).
- Rule 8 enforcement: new source files `<= 350` lines, modified source files `<= 400` lines.

## Consequences
- **Positive**: Uniform proxy failover and cancellation across all 13 AI callers; atomic `goAway` socket swapping without split-brain writes; eliminates HTTP 431 risk on Live WS while eliminating TCP `session_init` race; both System Design physics modes testable in 0ms in Node.
- **Trade-offs / Negatives**: Adds a 0–150ms bounded handshake wait only on `?awaitInit=1` connections (~1–2ms typical over loopback) and replaces legacy URL-only debugging with `?awaitInit=0`/standalone script compatibility or compact query params.

## Considered & Rejected Alternatives
- **Chat-only gateway leaving TTS/Embeddings as raw `fetch`:** Rejected because all 4 endpoints hit the exact same `LiteLLM_Proxy` network/auth failure modes.
- **Keeping `session.geminiSocket` exposed on `ProxySession`:** Rejected because concurrent direct writes defeat standby socket handoff on `goAway`.
- **Keeping all 25 fields duplicated in WS URL:** Rejected due to recurring HTTP 431 header overflow and parameter drift (`hrMode`/`dossierId` set twice).
