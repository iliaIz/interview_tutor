# Spec 39: Gemini Live Cloud VAD Pipeline Restoration & Auto-Turn Unblocking

> **Governing ADRs:** [`docs/adr/0001-sota-2026-design-patterns-practice.md`](docs/adr/0001-sota-2026-design-patterns-practice.md), [`docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md`](docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md)  
> **Reference Architecture SSOT:** `/home/djelu/projects/gemini_live_reference/*` (`packages/bff-gateway/`, `packages/core/`, `packages/client/`)  
> **Authoritative Specification:** [`docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md)  
> **Domain Glossary:** [`GLOSSARY.md`](GLOSSARY.md)

---

## 1. Intent & Workload Envelope

- **Objective:** Eliminate dialogue stalling and post-greeting dead-air hangs in the full-duplex Voice Arenas (HR-Screening, Knowledge Base Tutor, Alfa-Bank Company Tutor) by aligning the Auto-VAD pipeline 100% with Google's canonical Gemini 3.8 Live reference architecture (`gemini_live_reference`). In `auto` mode, candidate speech and trailing ambient silence must stream continuously without artificial client-side truncation, phantom generation flags, or backend audio choking.
- **Operating Envelope:**
  - **Transport:** WebSocket Full-Duplex PCM Streaming (16kHz 16-bit Mono uplink, 24kHz 16-bit Mono downlink).
  - **Turn Latency:** Server-side VAD silence trigger: 500ms; TTFA (Time to First Audio): $\le 1250$ms.
  - **Turn Mode:** Strict isolation of `auto` mode (continuous Cloud VAD) from `manual` mode (Push-to-Talk / `turnComplete`). Manual mode logic remains completely untouched.
  - **Watchdog SLA:** Standard generation watchdog: 22.0s; Informational nudge: 5.0s.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

The implementing agents are **strictly forbidden** from modifying:
1. Manual turn commit mode (`turnMode === 'manual'`, tactile button Push-to-Talk commits, `clientContent: { turnComplete: true }`).
2. JVM sandboxing and PGlite WASM execution engines (`frontend/src/services/sql/`, `backend/src/services/sandbox/`).
3. HR simulation scoring rubrics or evaluation data models (`frontend/src/features/hr-simulator/`, `backend/src/services/live/liveHrToolDispatcher.ts`).
4. Database schemas, SQLite migrations, or questions JSON fixtures.

---

## 3. Pre-Agreed Verification Seams

- **Primary Seam 1 (Backend Client Pipe & Echo Guard):**
  `backend/src/services/live/DownstreamClientPipe.ts` & `backend/src/services/live/liveClientGuardService.ts`.
  - Verifies that in `turnMode === 'auto'`, incoming audio chunks are never suppressed during candidate listening/pause, and `session.isAiGenerating` is never set prematurely on `audioStreamEnd`.
- **Primary Seam 2 (Client Mic Dispatcher & State Machine):**
  `frontend/src/audio/liveMicChunkDispatcher.ts` & `frontend/src/audio/NativeLiveVoiceEngine.ts`.
  - Verifies that in `turnMode !== 'manual'`, microphone chunks and ambient trailing silence stream continuously without artificial 500ms client cutoff, maintaining `CANDIDATE_LISTENING` until model audio arrives.
- **Whole-Platform Verification:**
  Cloud GitHub Actions runner via `remote-verify`.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Auto Mode Uplink Contract (`turnMode === 'auto'`)
Continuous 16kHz 16-bit mono PCM chunks wrapped in canonical BidiRealtimeAudioInput:

```json
{
  "realtimeInput": {
    "audio": {
      "mimeType": "audio/pcm;rate=16000",
      "data": "<base64-pcm-chunk>"
    }
  }
}
```

- **Invariant:** Ambient silence between speech segments MUST stream continuously to Google Gemini Live so server-side VAD (`automaticActivityDetection.silenceDurationMs = 500`) can endpoint speech turns naturally.
- **Prohibition:** In `turnMode === 'auto'`, client-side fast-cutoff timers must NOT dispatch `{ realtimeInput: { audioStreamEnd: true } }` on mid-dialogue speech pauses, and must NOT terminate mic streaming.

### 4.2. Downlink Turn Generation Contract
Upstream Google Gemini Live emits:
1. `serverContent.modelTurn.parts` with inline 24kHz PCM audio chunks.
2. `serverContent.turnComplete: true` upon turn conclusion.

---

## 5. Storage & Zero-Downtime Migration Contract

- **Rollout Strategy:** Additive code adjustment, zero schema migrations.
- **Backward Compatibility:** Zero breaking changes to WebSocket URL parameters, auth tokens, or session resumption handles.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Client Mic Dispatcher in Auto Mode
- **Pre-Conditions {P}:** Session is connected, `turnMode === 'auto'`, FSM is in `CANDIDATE_LISTENING` (`state === 'LISTENING'`).
- **Algorithm C:**
  - Candidate speaks $\to$ stream PCM chunks to WebSocket.
  - Candidate pauses/finishes speaking $\to$ continue streaming PCM audio (ambient silence) to WebSocket.
  - Do NOT trigger `commitSpokenTurn()` or switch FSM state based on client-side silence frame count.
- **Post-Conditions {Q}:**
  - Unbroken PCM stream arrives at Google Gemini Live.
  - Client state remains `LISTENING` until model audio arrives (`FIRST_AUDIO_RECEIVED`).

### 6.2. Backend Echo Guard & Downstream Pipe
- **Pre-Conditions {P}:** Incoming client frame is audio chunk or control frame.
- **Algorithm C:**
  - In `liveClientGuardService.ts`: Check `if (turnMode === 'auto') return false;` before evaluating `session.isAiGenerating` to guarantee audio flow in Auto-VAD mode.
  - In `DownstreamClientPipe.ts`: If `audioStreamEnd` arrives, do NOT set `session.isAiGenerating = true` and do NOT arm generation watchdogs. `isAiGenerating` is asserted strictly when `serverContent.modelTurn` arrives from upstream Gemini.
- **Post-Conditions {Q}:**
  - Zero dropped audio chunks during candidate speech and pauses in auto mode.
  - Zero phantom watchdog timeouts (`DEAD_AIR_WATCHDOG`) while awaiting model speech.
