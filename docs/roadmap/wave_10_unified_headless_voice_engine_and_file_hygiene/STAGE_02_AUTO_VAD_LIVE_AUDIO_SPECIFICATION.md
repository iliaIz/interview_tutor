# Stage 2: Auto-VAD Live Audio Single Source of Truth (SSOT) Specification

> **Document:** `STAGE_02_AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`  
> **Parent Roadmap:** [00_WAVE_10_MASTER_ROADMAP.md](file:///d:/projects/interview_projects/spring/docs/roadmap/wave_10_unified_headless_voice_engine_and_file_hygiene/00_WAVE_10_MASTER_ROADMAP.md)  
> **Target Branch:** `refactor/wave-10-unified-voice-engine-and-file-hygiene`  
> **Target Commit Message:** `docs(voice): establish authoritative Auto-VAD live audio SSOT specification`

---

## 1. Objectives & Context

Previous waves experienced architectural fragmentation because protocol details, buffer sizing, and turn arbitration rules were scattered across comments in `VoiceModal.tsx`, `liveAudioStreamRouter.ts`, and `AGENTS.md`. Whenever an AI agent or developer touched the audio subsystem, subtle inconsistencies were introduced (e.g. listening for `turnComplete` instead of `generationComplete`, or registering evaluation tools on Turn 0).

Stage 2 establishes the canonical, authoritative specification in:
`docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`

All future code modifications, lint rules, and agent skills MUST reference and adhere to this specification.

---

## 2. Specification Sections & Content Outline

The generated specification document will codify:

### 2.1. System Topology & Network Architecture
- Hop 1: Browser client $\longleftrightarrow$ Backend Node server via WebSocket (`/ws/live?sessionId=...&turnMode=auto`).
- Hop 2: Backend Node server $\longleftrightarrow$ `litellm-gateway:4000` via WebSocket (`/ws/live?model=...&token=...`).
- Hop 3: `litellm-gateway` $\longleftrightarrow$ Google Gemini Live Multimodal API (`wss://generativelanguage.googleapis.com/...`).
- Transport framing: UTF-8 JSON encapsulation for control signals; Base64-encoded PCM inside JSON payloads.

### 2.2. Audio Format & DSP Mathematical Models
- **Input Pipeline (Candidate Mic):**
  - Sampling Rate: $f_s = 16,000 \text{ Hz}$ (16 kHz).
  - Channels: 1 (Mono).
  - Sample Format: 16-bit Linear PCM (Signed integer, Little-Endian).
  - Frame Duration: $\Delta t = 32 \text{ ms}$ (512 samples / 1024 bytes per frame).
  - Bandwidth: $16,000 \times 2 = 32 \text{ kB/s}$.
- **Output Pipeline (AI Speech):**
  - Upstream Sampling Rate: $f_s = 24,000 \text{ Hz}$ (24 kHz).
  - Channels: 1 (Mono).
  - Web Audio Context Destination: Resampled dynamically by `AudioContext.destination` (usually 44.1 kHz or 48 kHz).
  - Jitter Buffer: Continuous timeline scheduling using `AudioContext.currentTime` with lookahead horizon of 60ms.

### 2.3. The Dual-Sided Handshake Invariant (Race-Free Turn Custody)
Turn transition from AI speech to Candidate recording is governed by the state machine:

$$\text{CanCandidateSpeak} \iff (\text{NetworkGenerationFinished} \land \text{PhysicalAudioDrained})$$

| Network Generation Finished (`generationComplete` / `turnComplete`) | Physical Audio Playout Drained (`onPlaybackFinished`) | System State | Candidate Mic |
| :---: | :---: | :---: | :---: |
| **False** | **False** | `AI_SPEAKING` | Blocked (EchoGuard drops) |
| **True** | **False** | `AI_DRAINING` | Blocked (EchoGuard drops) |
| **False** | **True** | `AI_SPEAKING` (Network lagging) | Blocked (EchoGuard drops) |
| **True** | **True** | `CANDIDATE_LISTENING` | **Active / Green** |

### 2.4. EchoGuard & Barge-In Invariant
- **EchoGuard:** Any microphone chunks received while `session.isAiGenerating === true` or during physical playout drain MUST be dropped at the server boundary to prevent AI audio loop feedback.
- **Barge-In (Interruption):**
  - If the user speaks during AI playback (detected by client-side energy VAD) or clicks the central circle:
    1. Immediately issue 5ms exponential de-click ramp down on active `GainNode`.
    2. Dispatch `{ clientContent: { turnComplete: true, interrupted: true } }` upstream to abort generation.
    3. Clear pending audio queue and set `isAiSpeaking = false`.
    4. Transition immediately to `CANDIDATE_RECORDING`.

### 2.5. Turn 0 Gating Invariant
- Turn 0 exists purely to establish session rapport and recite the question.
- No evaluation tools may be declared in `setupMessage.tools` until Turn 1.
- Gemini is configured via system instruction:
  *"Greet the candidate warmly, read the full question text clearly and completely, and then pause to allow them to answer."*

---

## 3. Implementation Plan
1. Draft canonical `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`.
2. Add sequence diagrams (Mermaid) for:
   - Successful Turn Exchange.
   - User Barge-in Interruption.
   - Upstream Network Disconnection & Recovery.
3. Review and link specification from `AGENTS.md` and `docs/architecture.md`.
4. Git commit:
   `git commit -m "docs(voice): establish authoritative Auto-VAD live audio SSOT specification"`
