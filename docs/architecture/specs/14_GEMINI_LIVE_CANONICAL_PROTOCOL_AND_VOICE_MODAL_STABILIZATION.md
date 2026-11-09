# Spec 14: Canonical Gemini Live Protocol Alignment & Voice Modal Stabilization

> **Governing ADRs:** [`docs/adr/0001-sota-2026-design-patterns-practice.md`](docs/adr/0001-sota-2026-design-patterns-practice.md), [`docs/adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md`](docs/adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md), [`docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md`](docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md)  
> **Reference Architecture SSOT:** `~/projects/gemini_live_reference/*` (`AGENTS.md`, `packages/core/`, `packages/bff-gateway/`, `packages/client/`)  
> **Domain Glossary:** [`GLOSSARY.md`](GLOSSARY.md)

---

## 1. Intent & Workload Envelope

- **Objective:** Eliminate dialogue stalling, zero-audio silent turns, browser autoplay barriers, and header flexbox clipping in the full-duplex Voice Interview Arena (Stage 1: Raiffeisen Product Engineer Fit Interview) by aligning the implementation 100% with Google's canonical Gemini 3.8 Live reference implementation (`~/projects/gemini_live_reference`).
- **Operating Envelope:**
  - **Transport:** WebSocket Full-Duplex PCM Streaming (16kHz 16-bit Mono uplink, 24kHz 16-bit Mono downlink).
  - **Acoustic Non-Zero Audio SLA:** Every spoken response following candidate speech must contain $\ge 1200$ bytes ($\ge 250$ms) of PCM audio and $\ge 10$ characters (Invariant 2.9).
  - **Latency:** TTFA (Time to First Audio) $\le 1250$ms; barge-in de-click ramp: 5ms ($120$ samples @ 24kHz).
  - **Tenancy:** Single-tenant client Web Audio session with stateful LiteLLM proxy failover.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

The implementing agents are **strictly forbidden** from modifying:
1. SQL challenges database and schema (`backend/src/routes/sqlChallenges.ts`, `json/sql_challenges.json`).
2. JVM sandboxing and PGlite WASM execution engines (`frontend/src/services/sql/pgliteExecutionEngine.ts`, `backend/src/services/sandbox/`).
3. Refactoring or Machine Coding catalog structures (`json/refactoring_challenges.json`, `json/machine_coding_challenges.json`).
4. System Design state machine or canvas renderer (`frontend/src/components/system_design/`).

---

## 3. Pre-Agreed Verification Seams

- **Primary Seam 1 (Backend Streaming & Circuit Breaker):**  
  `backend/src/services/live/liveAudioStreamRouter.ts` and `backend/src/services/live/liveWsClientFrameHandler.ts`.  
  Verification command: `node backend/tests/test_live_circuit_breaker.js`
- **Primary Seam 2 (Client Engine & Playout):**  
  `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/services/AudioPlayoutManager.ts`.  
  Verification: Contract unit tests in `frontend/tests/audioEngineContract.test.ts`.
- **Primary Seam 3 (UI Layout & Accessibility):**  
  `frontend/src/components/voice/VoiceModalHeader.tsx` and `frontend/src/components/voice/VoiceActiveView.tsx`.  
  Verification: DOM truncation, element visibility, and layout bounding assertions.
- **Whole-Platform Verification:** Cloud GitHub Actions runner via `remote-verify`.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Fast-Handoff Upstream Protocol (Invariant 1.5 & Rule 2.6)
On candidate speech cessation, the client must stream strictly `{ realtimeInput: { audioStreamEnd: true } }`:

```json
{
  "realtimeInput": {
    "audioStreamEnd": true
  }
}
```
**Strict Prohibition:** NEVER bundle `{ clientContent: { turnComplete: true } }` into an active audio stream.

### 4.2. Acoustic Circuit Breaker Recovery Nudge (Invariant 1.7 & 1.11)
When upstream synthesizes substantive text but $< 200$ audio bytes (vocoder stall), the router suppresses downstream forwarding and dispatches:

```json
{
  "clientContent": {
    "turns": [
      {
        "role": "user",
        "parts": [{ "text": "[КАНДИДАТ ЗАВЕРШИЛ ОТВЕТ, НО ЗВУК БЫЛ ТИХИМ / НЕРАЗБОРЧИВЫМ]: Среагируй естественно голосом на русском языке (1 короткая фраза): 'Я тебя не расслышала, повтори, пожалуйста, ответ.' или продолжи тему вопроса. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ)" }]
      }
    ],
    "turnComplete": true
  }
}
```

### 4.3. Header Flexbox & Close Button Contract
```html
<header class="flex items-center justify-between pb-3 border-b border-rose-100/60 shrink-0">
  <div class="flex-1 min-w-0 flex items-center gap-2">
    <span class="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping shrink-0" />
    <h2 class="font-bold text-slate-800 text-sm sm:text-base tracking-tight truncate">
      {activeTopic}
    </h2>
  </div>
  <div class="shrink-0 flex items-center gap-2">
    {/* Actions: CribSheet, Whiteboard */}
    <button onClick={onClose} class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Закрыть окно диалога">
      <X class="w-5 h-5" />
    </button>
  </div>
</header>
```

---

## 5. Storage & Zero-Downtime Migration Contract

- **Rollout Strategy:** Additive-Only client and router updates. No database schema changes.
- **State Invariant:** Zero persistent SQLite migrations required.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Candidate Speech Handoff
- **{P}:** Candidate speaks into microphone; `candidateSilenceFramesAfterVoicing >= 25` (~500ms trailing silence) during state `CANDIDATE_LISTENING`.
- **C:** `commitSpokenTurn()` sends `{ realtimeInput: { audioStreamEnd: true } }`; transitions FSM to `COMMITTING`. Backend forwards frame to `geminiSocket` without evaluating `ZERO_CHUNK_GUARD`.
- **{Q}:** Gemini Live Cloud VAD cleanly endpoints speech and initiates audio generation.

### 6.2. Zero-Audio Interception & Playout
- **{P}:** Gemini upstream completes turn with `audioBytes < 200` and `text.length > 0` (Vocoder stall).
- **C:** `liveAudioStreamRouter` intercepts the frame, sets `session.isCannedErrorTurn = true`, suppresses text tokens from client forwarding, and invokes `LiveCannedErrorRecovery.executeRecoveryNudge()`.
- **{Q}:** Candidate never sees "ghost text" with dead silence. Model speaks a real verbal response.

### 6.3. Header Accessibility & Close Button Visibility
- **{P}:** Modal opened with topic of arbitrary length (e.g., 71 chars: `"АО «Райффайзенбанк» (Raiffeisen DGTL): Product Engineer Fit Interview"`).
- **C:** Flexbox computes title width with `flex-1 min-w-0` and CSS `truncate`; action container and close button retain `shrink-0`.
- **{Q}:** Close button `[X]` remains 100% visible, fully inside viewport boundaries, with active hover and click handlers.
