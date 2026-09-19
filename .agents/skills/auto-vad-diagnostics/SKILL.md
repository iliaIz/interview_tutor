---
name: auto-vad-diagnostics
description: Strict evidence-based diagnostics and headless acoustic replay for Auto-VAD and Gemini Live audio streaming. Enforces zero-guesswork log triangulation (VPS, Gateway, SQLite, Storage) and automated verification via minimal-path playback fixtures.
---

# Auto-VAD Diagnostics & Headless Acoustic Replay Skill

This skill governs the systematic investigation, root-cause diagnosis, and verification of issues in the real-time multimodal voice stack (Auto-VAD, Gemini Live WebSocket, AudioWorklets, AudioPlayoutManager, Deepgram STT, and turn synchronization).

---

## 1. Absolute Core Principles

1. **Zero Guesswork / Zero Speculation Invariant:**
   - NEVER make assumptions based on UI symptoms alone (e.g. "button is pink, so WebSocket must be broken").
   - ALWAYS pull and triangulate real telemetric evidence from the 4 system layers:
     * **Layer 1: LiteLLM Gateway Logs** (upstream WebSocket status, dynamic model mapping, disconnect codes `1001`/`1005`/`1006`).
     * **Layer 2: Backend Stream Router Logs** (`WS_CONNECT`, `setupComplete`, `MODEL_FIRST_AUDIO`, `CLIENT_SPEECH_START`, `TURN_COMMIT`, Barge-In events).
     * **Layer 3: SQLite Snapshot** (`question_evaluations`: check presence of `role: 'ai'` and `role: 'user'` turns in `transcript`, `user_answer`, `score`).
     * **Layer 4: Storage Volume Inspection** (`/app/storage`: check existence and validity of recorded `.wav` PCM audio).

2. **Minimal Reproduction Path Replay (Наименьший путь наигрывания):**
   - NEVER ask the user to manually click buttons, talk into their microphone, or perform full 10-minute interviews to verify a fix.
   - ALWAYS execute automated headless acoustic replay via `SimulatedLiveClient` (`scripts/replay_turn.ts` or acoustic scenarios in `backend/src/testing/acoustic/`).
   - The minimal replay connects directly over WebSocket, verifies `setupComplete`, asserts `outputAudioTranscription` arrival, transmits recorded PCM audio frames, and verifies clean turn completion in $<5$ seconds.

3. **Multi-Modal Symmetry Invariant:**
   - Gemini Live sessions MUST always enable both `inputAudioTranscription: {}` AND `outputAudioTranscription: {}` symmetrically in `setupMessage.setup`.
   - Streaming raw PCM audio without textual transcription of model turns leads to silent context drops in `liveSessionRegistry` and database transcripts.

4. **Synchronous User-Gesture Priming Invariant:**
   - In browser Web Audio API, `AudioContext` instantiation or `context.resume()` MUST be called synchronously inside the user's direct DOM event handler (`onClick`), BEFORE any asynchronous boundary (`await fetch()`, network roundtrips, or deferred React `useEffect`).
   - `navigator.maxTouchPoints > 0` MUST NEVER be used as an indicator of a mobile phone; only explicit mobile OS checks (`/android/i.test(...)`) are valid. On Windows / macOS / Linux, audio MUST route directly to physical DAC (`context.destination`).

---

## 2. Standard 4-Step Diagnostic Workflow

### Step 1: Triangulate Quad-Vector Evidence
Run the automated telemetry collector:
```bash
python .agents/skills/auto-vad-diagnostics/scripts/collect_telemetry.py
```
This script connects to the target environment via SSH key (from `vps_info.md`), pulls logs, inspects SQLite, and measures:
- **Audio Delivery Gap:** Time elapsed between `MODEL_FIRST_AUDIO` and `CLIENT_SPEECH_START`. (If $>3000$ms with 0 speech, audio was stalled on client).
- **Socket Health:** Clean closure vs abrupt termination codes (`1001 Going Away`, `1005 No Status`, `1006 Abnormal`).
- **Transcript Integrity:** Verifies that both AI and User turns are recorded in the database.
- **Storage State:** Confirms physical audio file existence on disk.

### Step 2: Root-Cause Classification Matrix

| Observed Telemetry Pattern | Root Cause Layer | Verified Mechanism |
| :--- | :--- | :--- |
| `MODEL_FIRST_AUDIO` emitted, but candidate mic activates $>10$s later on manual click | **Browser Autoplay Barrier** | `AudioContext` was initialized in `useEffect` or after `await fetch`, leaving it in `'suspended'` state, or routed to unattached `<audio>` tag due to `maxTouchPoints > 0`. |
| DB `transcript` has only `system` and `user` turns, `role: 'ai'` is missing | **Protocol Asymmetry** | `outputAudioTranscription: {}` omitted in `setupMessage.setup`. Server only receives binary PCM without text parts. |
| Client disconnects with code `1001` or `1005` after 2–8 seconds | **Upstream / Gateway Sever** | Model key exhaustion (429), gateway proxy timeout, or client unmounted modal. |
| `/app/storage` is empty, `audio_path` in SQLite is `NULL` | **Storage Pipeline Void** | Audio buffer sent to Deepgram STT over HTTP but never written to disk volume. |

### Step 3: Minimal Path Headless Verification
Replay the exact failing session or turn scenario without touching the browser:
```bash
npx ts-node .agents/skills/auto-vad-diagnostics/scripts/replay_turn.ts
```
Or run the specialized acoustic scenario:
```bash
npm --prefix backend run test:acoustic:standard
```
The runner asserts:
- Upstream `setupComplete` received in $<1500$ms.
- Model first audio chunk received in $<1000$ms.
- Text transcript parts emitted alongside audio chunks.
- Candidate audio chunks processed without false barge-in.
- Full multi-turn dialogue recorded to database.

### Step 4: Definition of Done (DoD)
A voice/VAD issue is only considered resolved when:
1. `collect_telemetry.py` confirms 0ms artificial stall.
2. `replay_turn.ts` passes with exit code 0 and verified telemetry.
3. Live SQLite snapshot confirms both `role: "ai"` and `role: "user"` in the evaluation transcript.
4. Physical audio recording exists in storage.
