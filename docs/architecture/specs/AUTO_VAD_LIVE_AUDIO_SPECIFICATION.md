# Canonical Auto-VAD Live Audio Protocol Specification (SSOT)

> **Document:** `AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`  
> **Status:** Authoritative Single Source of Truth (SSOT)  
> **Target Standard:** SOTA Late September 2026  
> **Mandatory Reference:** All AI agents, engineers, and diagnostic tools working with Web Audio, WebSockets, AudioWorklets, VAD, or Gemini Live streaming MUST strictly comply with this specification.

---

## 1. Executive Summary & Architecture Topology (Canonical Gemini Live Protocol)

The InterviewPrep AI platform delivers zero-latency, full-duplex conversational voice tutoring and technical interview simulations. Under SOTA Late September 2026 standards, the voice pipeline strictly adheres to Google's canonical Gemini Live protocol (`google-gemini/gemini-live-api-examples` and `@google/genai` SDK):
- **Native Cloud VAD Enabled:** In Auto-VAD mode (`turnMode === 'auto'`), server-side VAD is active (`automaticActivityDetection.disabled = false`) with `silenceDurationMs: 800`ms and `prefixPaddingMs: 500`ms. Gemini Live natively detects speech boundaries (`voiceActivity: ACTIVITY_START` and `ACTIVITY_END`).
- **Continuous Mic Streaming:** Candidate audio flows continuously as 16kHz 16-bit Mono PCM chunks wrapped in canonical `{ realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } }`. Ambient trailing silence flows naturally between utterances to allow cloud VAD to endpoint turns.
- **Strict Channel Separation (No Interleaving):** Injecting empty `{ clientContent: { turnComplete: true } }` frames into an active audio stream is strictly forbidden. Per Google specifications, `clientContent` is reserved for text prompts/history, while audio streaming uses `realtimeInput`.
- **Hybrid VAD Fast-Handoff:** When client-side neural Silero VAD detects speech cessation, it signals endpointing via canonical `{ realtimeInput: { audioStreamEnd: true } }`, triggering zero-latency handoff without violating WebSocket contracts.

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Browser (LiveVoiceEngine + Silero VAD)
    participant Backend as Node.js Gateway (/ws/live)
    participant LiteLLM as LiteLLM Proxy (:4000)
    participant Gemini as Google Gemini Live 3.8 (Cloud VAD: Active)

    Candidate->>Backend: WebSocket Connect (/ws/live?turnMode=auto&model=gemini-live-v3)
    Backend->>LiteLLM: WebSocket Connect (/ws/live?model=gemini-live-v3&token=LITELLM_KEY)
    Backend->>Gemini: setup (automaticActivityDetection: { disabled: false, silenceDurationMs: 800 })
    Backend-->>Candidate: { type: 'setupComplete' }
    
    rect rgb(240, 248, 255)
    Note over Candidate,Gemini: Turn 0: AI Greeting & Question Recitation (Lockdown)
    Backend->>Gemini: initialGreetingTurn (role: 'user', text: "...", turnComplete: true)
    Gemini-->>Backend: serverContent (modelTurn: 24kHz PCM audio chunks)
    Backend-->>Candidate: modelTurn (Base64 PCM chunks)
    Gemini-->>Backend: serverContent (generationComplete: true)
    Gemini-->>Backend: serverContent (turnComplete: true) [Deduplicated]
    Backend-->>Candidate: serverContent (turnComplete: true)
    Note over Candidate: AudioWorklet drains physical samples in DAC
    Candidate->>Candidate: Playout drain unlocks mic (State: CANDIDATE_LISTENING)
    end

    rect rgb(255, 245, 245)
    Note over Candidate,Gemini: Turn 1+: Continuous PCM Streaming & Hybrid Fast-Handoff
    Candidate->>Backend: realtimeInput { audio: { data, mimeType: 'audio/pcm;rate=16000' } }
    Backend->>Gemini: realtimeInput (continuous 16kHz PCM chunks)
    Note over Candidate,Gemini: Cloud VAD detects voiceActivity: ACTIVITY_START -> ACTIVITY_END
    Candidate->>Backend: realtimeInput { audioStreamEnd: true } (Silero VAD Endpointing)
    Backend->>Gemini: realtimeInput { audioStreamEnd: true }
    Gemini-->>Backend: serverContent (modelTurn: AI Response speech begins)
    Backend-->>Candidate: modelTurn (24kHz Base64 PCM chunks)
    end
```

---

## 2. Mathematical Audio Formats & DSP Models

### 2.1. Candidate Microphone Capture (Uplink)
- **Sampling Frequency ($f_{s,\text{in}}$):** $16,000 \text{ Hz}$ (16 kHz).
- **Channels ($C_{\text{in}}$):** 1 (Mono).
- **Quantization:** 16-bit Linear PCM (Signed integer, Little-Endian, 2 bytes/sample).
- **Frame Buffer Size ($N_{\text{frame}}$):** 512 samples.
- **Frame Duration ($\Delta t_{\text{frame}}$):**
  $$\Delta t_{\text{frame}} = \frac{N_{\text{frame}}}{f_{s,\text{in}}} = \frac{512}{16000} = 0.032 \text{ s} = 32 \text{ ms}$$
- **Frame Byte Payload ($B_{\text{frame}}$):**
  $$B_{\text{frame}} = 512 \text{ samples} \times 2 \text{ bytes} = 1024 \text{ bytes}$$
- **Data Throughput:** $16,000 \times 2 = 32,000 \text{ B/s} = 32 \text{ kB/s}$.
- **Acoustic Pre-Processing:** Hardware AEC (Acoustic Echo Cancellation), Noise Suppression, and AGC (Automatic Gain Control) enabled via `navigator.mediaDevices.getUserMedia`.

### 2.2. AI Speech Playout (Downlink)
- **Sampling Frequency ($f_{s,\text{out}}$):** $24,000 \text{ Hz}$ (24 kHz).
- **Channels ($C_{\text{out}}$):** 1 (Mono).
- **Sample Format:** Int16 Linear PCM (Base64 encoded inside JSON `modelTurn.parts[].inlineData.data`).
- **Throughput:** $24,000 \times 2 = 48,000 \text{ B/s} = 48 \text{ kB/s}$.
- **Web Audio Playout Graph:**
  `AudioWorkletNode ('gemini-audio-processor')` $\longrightarrow$ `GainNode (Master)` $\longrightarrow$ `AudioContext.destination` (or `MediaStreamAudioDestinationNode` on mobile).
- **Ring Buffer Size:** $2^{22} = 4,194,304 \text{ samples}$ ($\approx 174.76 \text{ s}$ of audio buffer at 24kHz = 16MB Float32Array) with anti-lapping reservation (`size - currentOccupancy - 1`) to guarantee zero buffer overflow or unplayed audio corruption during fast model synthesis bursts ($3.5\times$ real-time).
- **Resampling:** Dynamic 4-point, 3rd-order Hermite polynomial interpolation from 24 kHz to host DAC hardware frequency ($44.1 \text{ kHz}$ or $48 \text{ kHz}$) with persistent filter history to eliminate Gibbs phenomena and phase clicks.

---

## 3. The Dual-Sided Handshake Invariant

A major race condition in voice conversational AI occurs when network generation concludes while physical audio is still draining in the candidate's headphones, or when audio drains before the final network packet arrives.

### 3.1. Formal State Equation
Turn custody from AI to Candidate is unblocked if and only if:

$$\text{CanCandidateSpeak} \iff \Big( \text{NetworkGenerationFinished} \land \text{PhysicalDacBufferDrained} \Big)$$

### 3.2. Truth Table

| Network Generation Finished | AudioWorklet Drained (`drained`) | System State | Candidate Mic | EchoGuard State |
| :---: | :---: | :---: | :---: | :---: |
| **False** | **False** | `AI_SPEAKING` | Locked (Gated) | Drops all candidate mic chunks |
| **True** | **False** | `AI_DRAINING` | Locked (Gated) | Drops candidate mic chunks (+450ms reverb) |
| **False** | **True** | `AI_SPEAKING` (Network lag) | Locked (Gated) | Drops all candidate mic chunks |
| **True** | **True** | `LISTENING` | **Unlocked (Green)** | Pass-through to Gemini |

### 3.3. Symmetrical Resolution
- **Case 1 (Network completes first):** Gemini sends `generationComplete`. The engine sets `isServerTurnComplete = true` and dispatches `{ type: 'drain' }` to AudioWorklet. When the buffer reaches 0 samples, AudioWorklet posts `{ type: 'drained' }` $\rightarrow$ `onPlaybackFinished()` instantly unlocks candidate mic.
- **Case 2 (Audio drains first):** Audio finishes playing while network is still waiting for terminal packet. `isServerTurnComplete` is false $\rightarrow$ mic remains locked. When `generationComplete` arrives, the engine detects that the playout queue is already empty $\rightarrow$ instantly unlocks candidate mic in 0ms.

### 3.4. Trap-Free FSM Invariant (COMMITTING & AI_THINKING Recovery)
A critical failure mode in multi-turn duplex dialogues is the **State Machine Trap**:
- When the candidate stops speaking, `LiveVoiceStateMachine` transitions from `CANDIDATE_HOLD` $\rightarrow$ `COMMITTING`.
- In naive implementations, `COMMITTING` and `AI_THINKING` could only exit via `FIRST_AUDIO_RECEIVED` or `EVALUATION_COMPLETED`. If the upstream model stalled, delayed, or if the server watchdog fired, the FSM remained trapped in `COMMITTING` with candidate microphone locked (`isCandidateTurnActive() === false`).
- **Trap-Free Invariant:** The FSM MUST implement unconstrained, deterministic recovery transitions from both `COMMITTING` and `AI_THINKING`:
  1. `DEAD_AIR_RECOVERED`: Triggered by backend watchdog `{ type: 'dead_air_recovery' }` or client safety timer $\rightarrow$ immediately transitions to `CANDIDATE_LISTENING` (public `LISTENING`).
  2. `BARGE_IN_TRIGGERED` (Tactile): Candidate clicks the central button while waiting $\rightarrow$ immediately cancels waiting and transitions to `CANDIDATE_LISTENING` (public `LISTENING`).
  3. `PLAYOUT_FINISHED`: If the server emits a zero-audio turn completed frame $\rightarrow$ transitions cleanly to `CANDIDATE_LISTENING`.

---

## 4. Terminal Signal Equivalence & Deduplication

Google Gemini Multimodal Live API (`gemini-3.8-live` via LiteLLM) emits `serverContent.generationComplete: true` upon speech synthesis conclusion. It does not consistently emit `turnComplete: true` for turn-based prompt recitations.

### 4.1. Equivalence Invariant
All backend routers and frontend voice engines MUST treat:
$$\text{IsTurnFinished} \equiv \text{Boolean}(\text{serverContent.turnComplete} \lor \text{serverContent.generationComplete})$$

### 4.2. Backend Normalization Contract
Whenever the backend receives `serverContent.generationComplete: true` and `turnComplete` is falsy, it MUST inject `turnComplete: true` into the forwarded client payload:
```typescript
if (parsed?.serverContent?.generationComplete && !parsed.serverContent?.turnComplete) {
  parsed.serverContent.turnComplete = true;
  str = JSON.stringify(parsed);
}
```

### 4.3. Terminal Frame Deduplication Invariant
Upstream Gemini Live frequently emits `generationComplete: true` immediately followed by `turnComplete: true` in successive frames (1ms delta).
To prevent false-positive circuit breaker activations on the second frame (where `audioBytes === 0` after reset), the backend router deduplicates terminal frames:
```typescript
if (!session.isAiGenerating && (session.currentTurnAudioBytes || 0) === 0 && (session.aiPlayoutEstimatedEndEpoch || 0) > Date.now()) {
  return;
}
```

---

## 5. Structural Acoustic Isolation & Gateway Protections

Under SOTA Late September 2026 standards, acoustic echo isolation is achieved structurally through continuous streaming and DAC playout gating:

### 5.1. Native Cloud VAD & Anti-Echo Gating
- In Auto-VAD mode, `automaticActivityDetection.disabled = false` allows Google Cloud VAD to endpoint speech turns accurately.
- **EchoGuard Uplink Gating:** During AI speech generation and DAC playout (+450ms reverb padding), candidate mic input is locked at the client AudioWorklet level and dropped if received by the gateway. Speaker audio from the device loudspeaker never leaks into the upstream cloud VAD.
- **Continuous Mic Streaming:** When the candidate speaks, 16kHz PCM chunks flow continuously along with natural trailing silence, providing clean acoustic boundaries (`voiceActivity: ACTIVITY_START` and `ACTIVITY_END`).

### 5.2. Deprecation of Split-Brain Heuristic Guards
The legacy reactive guards in the Node.js gateway (`STALE_GUARD`, `ZERO_CHUNK_GUARD`, `FLOOD_GUARD`) are **formally deprecated and removed**. The gateway acts as a high-throughput, transparent session router without speculative heuristic drops.

### 5.3. Live Dead-Air & Vocoder Stall Protection (`LiveDeadAirGuard`)
- **Acoustic Root Cause:** When synthesizing Russian dialogue with technical English terms on certain voice personas (or under upstream network pressure), Google's Gemini Live vocoder can generate opening words, finish text generation, but stream digital silence (PCM noise floor $\le -65\text{ dB}$) holding the turn open.
- **Backend Dead-Air Guard:** `LiveDeadAirGuard` tracks active speech vs digital dead-air in real-time ($> 200$ RMS amplitude threshold for speech, $\le 100$ for silence floor).
- **Latency Tolerances:**
  - Conversational pauses during active speech are permitted up to 1200ms.
  - Trailing silence between 1200ms and 2000ms is suppressed.
  - Trailing silence $\ge 2000$ms clamps the turn: router synthesizes `turnComplete: true`, sets `deadAirClamped: true`, and unblocks turn custody.

### 5.4. Playout Protection Deduplication
`LiveTelemetryAccumulator` preserves EchoGuard protection until the candidate's DAC finishes physical playback, eliminating premature mic unblocking.

### 5.5. Two-Phase Watchdog & Clean Upstream Interruption Protocol
- **Phase 1: Informational Nudge (5.0s / 8.0s):** Standard models (`gemini-live-v3`): $5000\text{ ms}$; thinking models: $8000\text{ ms}$. Dispatches `{ type: 'thinking_delay', elapsedMs }` without disturbing upstream session.
- **Phase 2: Bounded Generation Watchdog (18.0s / 25.0s):** Standard models: $18,000\text{ ms}$; thinking models: $25,000\text{ ms}$. Sends clean interruption frame `{ clientContent: { interrupted: true } }` upstream and `{ type: 'dead_air_recovery' }` to client.

### 5.6. Non-Speech Token Interception & Active Conversational Recovery Invariant
- **Strict Regex Anchoring:** Acoustic token patterns in `liveStreamErrorDetector.ts` MUST use strict boundaries (`/^<no\s*speech>$/i`, `/^<pause>$/i`). Conversational `<pause>` tokens occurring naturally within candidate or tutor speech are never treated as errors.
- **Acoustic Non-Zero Audio SLA ($\ge 1200$ bytes):** Any turn with $\ge 1200$ audio bytes ($\ge 250$ms) is strictly exempt from non-speech classification. Every valid tutor turn must satisfy `audioBytes >= 1200 && text.length >= 10`.
- **Active Conversational Recovery:** If upstream emits `<no speech>` or synthesizes $< 200$ audio bytes after candidate speech, `LiveCannedErrorRecovery` intercepts the turn and sends an active conversational nudge in Russian aloud:
  `"[КАНДИДАТ ЗАВЕРШИЛ ОТВЕТ, НО ЗВУК БЫЛ ТИХИМ / НЕРАЗБОРЧИВЫМ]: Среагируй естественно голосом на русском языке (1 короткая фраза): 'Я тебя не расслышала, повтори, пожалуйста, ответ.' или продолжи тему вопроса."`

### 5.7. LiteLLM Key Pool Round-Robin Load Balancing
In `/home/djelu/LiteLLM_Proxy/data/gateway.db`, `key_routing_strategy` MUST be configured to `round_robin` across the Google Gemini API key pool. This distributes quota evenly and prevents single-key rate limit exhaustion (`1011 Resource has been exhausted`) during multi-turn extended thinking sessions.

---

## 6. Neural Client VAD & Barge-In Mechanics

### 6.1. Neural Speech Activity Detection (Silero VAD v5 WASM)
Speech detection is performed in the client browser using **Silero VAD v5** running via WebAssembly (`onnxruntime-web`):
- **Input:** 512 samples @ 16kHz (32ms frames).
- **Inference Time:** $<0.8\text{ ms}$ per frame in background Web Worker / Worklet.
- **Speech Threshold:** $p_{\text{speech}} > 0.5$ across 2 consecutive frames ($64\text{ ms}$) asserts speech start.
- **Silence Threshold:** $p_{\text{speech}} < 0.35$ for $\ge 1800\text{ ms}$ triggers turn completion.

### 6.2. Turn 0 Question Recitation Acoustic Lockdown
During Turn 0 initial greeting and question recitation:
- **Acoustic Lockdown:** Client-side Silero VAD is gated (`AI_RECITING_QUESTION` state). Acoustic microphone frames cannot trigger barge-in, guaranteeing the technical question is recited aloud without truncation.
- **Extended Drain Clamp:** The playout drain wait ceiling is calibrated to 25 seconds (`Math.min(25000, ...)`), preventing premature unlock during extended initial greetings.
- **Tactile Override:** User click/tap on the central circle remains active at all times as an intentional human skip.
- **Automatic Unlock:** Once Turn 0 audio finishes physical playback in the DAC (`AudioPlayoutManager.onPlaybackFinished()`), state transitions to `CANDIDATE_LISTENING` and the microphone is unlocked.

### 6.3. Canonical Turn Handoff (Continuous Trailing Silence & Fast-Handoff)
- While the candidate is speaking (`CANDIDATE_SPEAKING`), 16kHz audio chunks stream continuously to Gemini as `{ realtimeInput: { audio: ... } }`.
- When candidate stops speaking, Silero VAD enters `CANDIDATE_HOLD`.
- Once silence threshold is reached:
  1. Client state transitions to `COMMITTING`.
  2. In Auto-VAD mode, client sends canonical `{ realtimeInput: { audioStreamEnd: true } }` (NEVER injects empty `{ clientContent: { turnComplete: true } }` into the active audio stream).
  3. Client transitions to `AI_THINKING`, awaiting response.

### 6.4. Intentional Mid-Dialogue Barge-In (Interruption)
If the candidate intentionally speaks while AI is answering a follow-up question (`AI_SPEAKING`):
1. Silero VAD confirms human phonemes ($p_{\text{speech}} > 0.5$ for $\ge 3$ frames, or loud direct speech $\ge -20\text{ dB}$).
2. Client `AudioPlayoutManager` triggers a 5ms exponential de-click ramp down and flushes DAC buffer.
3. Client dispatches:
   ```json
   { "realtimeInput": { "interrupted": true }, "bargeIn": true }
   ```
4. Client state transitions immediately to `CANDIDATE_SPEAKING`.

---

## 7. Turn 0 Gating Invariant & Immutable Tools Constraint

### 7.1. Gemini Live Immutable Tools Rule
In the Gemini Multimodal Live API, tools declared in `setup.tools` are **immutable for the lifespan of that WebSocket connection**. Sending a secondary `setup` frame terminates the connection with protocol error.

### 7.2. Turn 0 Prompt Shield
To prevent the model from preemptively executing evaluation functions (`submit_interview_evaluation`) before the candidate has answered:
1. Turn 0 prompt explicitly directs speech output:
   `"Привет! Я готова к собеседованию. Пожалуйста, поприветствуй меня в 1 фразе и четко зачитай технический вопрос вслух: \"${questionText}\". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала)."`
2. If the model attempts to call evaluation tools on Turn 0 (`!session.hasCandidateResponded`), `liveToolDispatcher` returns a structured error instructing the model to speak the question.

---

## 8. Subtitle Pacing & Skew Calibration

### 8.1. Actual Word Token Counting
Dynamic subtitle reveal algorithms MUST count real linguistic words rather than whitespace delimiters:
```typescript
const actualWords = allTokens.filter(t => t.trim().length > 0).length;
const estimatedDurationMs = isComplete
  ? Math.max(600, audioDurationQueuedMsRef.current)
  : Math.max(audioDurationQueuedMsRef.current, Math.max(600, actualWords * 240));
```

### 8.2. Unconditional Text Flush
Whenever `isTurnDone` or `onPlaybackFinished()` triggers, `finalizeAiTurnSubtitles()` MUST be invoked unconditionally to reveal 100% of accumulated text in 0ms, preventing slow-typing deadlocks.

---

## 9. Verification & Architectural Checkpoints

Any code changes touching voice audio MUST satisfy the following test contracts before merging:
1. `npm run test:telemetry:router` (Backend router mock & `generationComplete` normalization).
2. `npm run test:telemetry:playout` (Dual-sided handshake race condition matrix).
3. `npm run test:audio-contracts` (AudioWorklet draining & single-voice contracts).
4. `replay_turn.ts` (Headless acoustic loopback with 0 EchoGuard dropped chunks).
5. `runAcousticVadMatrix.ts --suite=canary` (4-Suite Pre-Flight Canary Matrix against real LiteLLM Gateway):
   - **Canary 1/4 (Multi-Turn Dialogue 2 turns):** Asserts clean handover across consecutive candidate speech turns without dead-air or dropped custody.
   - **Canary 2/4 (Acoustic Barge-In):** Asserts prompt audio cutoff and candidate mic takeover with latency $\le 500$ms.
   - **Canary 3/4 (Thinking CoT Shield):** Asserts zero thought-token leakage and audio delivery on `gemini-live-thinking-v3`.
   - **Canary 4/4 (Code Handover SLA):** Asserts sub-1500ms TTFA on technical coding discussion in `practice_pair` mode.
   - **Strict Conjunction Assertion:** `audioBytes >= 1200 && !replyText.includes('<no speech>') && replyText.trim().length >= 10` on all turns. Blocks deployment on zero-audio or non-speech returns.


