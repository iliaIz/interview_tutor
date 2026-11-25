# Spec 53: `LiveTransportSupervisor`, Slim Handshake (`?awaitInit=1`) & Discriminated `LiveVoiceFrameParser`

> **Governing Glossary:** `Slim Live Handshake`, `LiveVoiceFrameParser` -> [GLOSSARY.md](../../../GLOSSARY.md)  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Browser WS client supervision & frame decoding (`<= 250`-byte URL)

---

## 1. Intent & Workload Envelope
Eliminate five shallow, leaky helpers around `NativeLiveVoiceEngine.ts` (373L):
1. Compress `ParsedLiveFrameResult` in `LiveVoiceFrameParser.ts` (380L -> `<= 250L`) from 39 duplicate flat fields to 4 tagged slices (`control`, `domainEvents`, `modelTurn`, `toolLifecycle`), absorbing `liveVoiceDomainEvents.ts` (26L).
2. Collapse `liveVoiceUrlBuilder.ts` (139L, currently setting `hrMode`/`dossierId` twice), `LiveHeartbeatController.ts` (45L), and `LiveVoiceRecoveryController.ts` (158L, 12 manual coordination calls) into one cohesive `LiveTransportSupervisor`.
3. Enforce the **Slim Live Handshake (`?awaitInit=1`)** (`<= 400`-byte WS URL carrying routing/calibration scalars while rich text/HR/whiteboard payloads ship exclusively via `session_init`) backed by an evented 150ms init-wait barrier in backend `LiveVoiceSession.start()` + `mergeInitFrameIntoConfig` mapping for `dossierId`/`jobId`/`questionMatrixId`.
4. Narrow `liveMicChunkDispatcher.ts` (94L, 10 positional args + unused `_turnMode`/`onCommitSpokenTurn`) into `MicBargeInGate`.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT alter `ILiveVoiceEngine`, `useLiveVoiceSession`, `LiveTransportPort`, or `LiveAudioIOPort` external seams established in Spec 47 (`#173`, `#174`).
- Do NOT weaken Cloud VAD continuous PCM streaming (`turnMode === 'auto'`), `-29 dBFS` acoustic echo threshold, `audioPlayoutManager` Dual-Sided Handshake, or non-speech tag stripping (`<no speech>`, `{pause}`).
- Keep Test 5 URL calibration checks (`voice`, `turnMode`, `liveModel`, `vadPauseMs`, `enableSilenceClarification`, `strictness`) passing cleanly.

---

## 3. Pre-Agreed Verification Seams
- **Primary Seams:** `NativeLiveVoiceEngine(callbacks, { transport, audio })` (`LiveTransportPort` + `LiveAudioIOPort`), `LiveVoiceFrameParser.parse(raw)`, and backend `LiveVoiceSession.start({ clientSocket, req, earlyQueue })` (`awaitInit=1` barrier).
- **Dependencies:** `ports & adapters` on frontend (`liveVoiceEngine.test.ts`, `liveAudioSessionContracts.test.ts`, `liveVoiceFrameParser.test.ts`) + loopback/mock WS on backend (`testLiveWsProtocol.ts`).
- **Verification Commands (CI):** Frontend `npm run test:audio-contracts && npm run build`; Backend `npm run test:vad:unit && npm run test:hr && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export type LiveDomainEvent =
  | { kind: 'evaluation'; payload: VoiceEvaluationResult }
  | { kind: 'whiteboard_update'; payload: unknown }
  | { kind: 'chaos_injected'; payload: unknown }
  | { kind: 'hiring_committee_verdict'; payload: unknown }
  | { kind: 'bug_solved'; payload: unknown }
  | { kind: 'candidate_observation'; payload: unknown }
  | { kind: 'smell_discovered'; payload: unknown }
  | { kind: 'tool_call'; payload: unknown }
  | { kind: 'hr_phase_transition'; payload: unknown }
  | { kind: 'hr_scorecard_ready'; payload: unknown }
  | { kind: 'hr_transcript_delta'; text: string }
  | { kind: 'hr_step_state'; payload: unknown };

export interface ParsedLiveFrameResult {
  readonly kind: LiveFrameType;
  readonly control?: LiveControlSignal;
  readonly domainEvents: LiveDomainEvent[];
  readonly modelTurn?: {
    hasAudio: boolean;
    audioChunks: string[];
    hasText: boolean;
    textDeltas: string[];
    isTurnDone: boolean;
    interactionStatus?: string;
    isInterrupted: boolean;
    voiceActivity?: 'ACTIVITY_START' | 'ACTIVITY_END';
  };
}
```
- **Slim URL Contract:** `LiveTransportSupervisor.buildWsUrl(cfg)` includes only `{ sessionId, questionId, challengeId?, sessionType, voice, turnMode, liveModel, vadPauseMs, enableSilenceClarification, strictness, userGender, targetGrade, temperature, isResumed, awaitInit: '1' }`; ALL rich/long fields (`questionText`, `referenceAnswer`, `bugTitle`, `bugExplanation`, `customPrompt`, `seniorReview`, `academyBridgeContext`, `hrMode`, `hrPersonaId`, `dossierId`, `jobId`, `questionMatrixId`, `chunkId`, `startBeatId`, `beatScope`) travel solely in `session_init` (`LiveSessionInitFrame`).
- **Server Handshake Barrier:** When `req.url` contains `awaitInit=1`, `LiveVoiceSession.start()` attaches a bounded 150ms wait on the client socket/queue for the first `type === 'session_init'` frame before calling `LiveSessionBlueprintBuilder.resolveFromRequest`, waking instantaneously upon arrival; `mergeInitFrameIntoConfig` maps `dossierId`, `jobId`, and `questionMatrixId` identically to query parsing.

---

## 5. Storage & Zero-Downtime Migration Contract
- Backwards-compatible handshake: clients without `?awaitInit=1` (e.g. legacy diagnostic scripts) bypass the init wait immediately; `?awaitInit=1` times out cleanly after 150ms falling back to SQLite `questionId` hydration without failing connection setup.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `VoiceEngineConfig` + `LiveTransportPort` / `LiveAudioIOPort` OR server WS connection with `?awaitInit=1`.
- `{C}` Build slim URL (`<400` bytes) -> send `session_init` on `onOpen` -> server barrier collects `session_init` before Gemini `setup` -> supervise ping/`sync_pong`/8s-22s watchdogs inside `LiveTransportSupervisor` -> parse inbound frames into 4 tagged slices and route continuous 16kHz PCM / `-29 dBFS` acoustic barge-in via `MicBargeInGate(snapshot)`.
- `{Q}` Zero duplicate `hrMode`/`dossierId` query keys; `NativeLiveVoiceEngine` shrinks `<= 300L`, `LiveVoiceFrameParser` shrinks `<= 250L`; deferred `session_init` TCP arrival hydrates `blueprint` identically to pre-queued `earlyQueue` on Turn 0.
