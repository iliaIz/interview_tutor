# Oral Mock Interview & Voice Studio Specification (Pillar 1 SSOT)

> **Document:** `01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md`  
> **Status:** Authoritative Single Source of Truth (SSOT)  
> **Target Standard:** SOTA Late September 2026  
> **Parent Master Architecture:** [docs/architecture.md](file:///d:/projects/interview_projects/spring/docs/architecture.md)  
> **Low-Level Protocol Specification:** [AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](file:///d:/projects/interview_projects/spring/docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md)

---

## 1. Domain Vision & Real-Time Multimodal Voice

The **Oral Mock Interview Studio** simulates FAANG/BigTech technical interviews over a real-time, bidirectional voice pipeline powered by Google Gemini Multimodal Live API (`models/gemini-3.8-live` via LiteLLM).

The studio provides:
- Socratic oral examination with adaptive cognitive probing.
- Sub-second acoustic responsiveness with Auto-VAD.
- Tactile and acoustic barge-in (interruption) mechanics.
- Zero-latency subtitle pacing synchronized to physical DAC ear playback.

---

## 2. Architectural Subsystems & Single-Source Abstractions

To prevent codebase bloat and monolithic decay, the voice stack is strictly modularized:

| Layer | Implementation Module | Lines | Core Responsibility |
| :--- | :--- | :---: | :--- |
| **Headless Voice Engine** | [`frontend/src/audio/LiveVoiceEngine.ts`](file:///d:/projects/interview_projects/spring/frontend/src/audio/LiveVoiceEngine.ts) | 384 | State machine, WebSocket lifecycle, playout synchronization |
| **Microphone Capture** | [`frontend/src/audio/MicrophoneCapture.ts`](file:///d:/projects/interview_projects/spring/frontend/src/audio/MicrophoneCapture.ts) | 137 | 16kHz AudioWorklet capture, mono PCM uplink, AGC/AEC |
| **Session Hook** | [`frontend/src/audio/useLiveVoiceSession.ts`](file:///d:/projects/interview_projects/spring/frontend/src/audio/useLiveVoiceSession.ts) | 116 | Headless React binding for components |
| **Mic Interaction** | [`frontend/src/components/voice/VoiceMicButton.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/voice/VoiceMicButton.tsx) | 130 | Tactile button, ripple animations, state indicators |
| **Subtitles** | [`frontend/src/components/voice/VoiceSubtitles.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/voice/VoiceSubtitles.tsx) | 91 | Real-time paced subtitle revealing and role badges |
| **Visualizer** | [`frontend/src/components/voice/VoiceVisualizer.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/voice/VoiceVisualizer.tsx) | 49 | 5-bar CSS volume visualizer |
| **Modal Container** | [`frontend/src/components/VoiceModal.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx) | 306 | Clean layout, persona selector, 100dvh modal wrapper |

---

## 3. Immutable Core Invariants

All engineers and agents MUST strictly adhere to the invariants defined in the low-level protocol spec:
1. **The Dual-Sided Handshake:** Candidate mic is unblocked if and only if both network generation is finished AND physical DAC buffer is drained.
2. **Canonical Continuous PCM & No Interleaving:** In Auto-VAD mode, candidate mic streams continuous 16kHz PCM chunks with trailing silence (`realtimeInput.audio`). Injecting empty `{ clientContent: { turnComplete: true } }` frames into an active audio stream is strictly prohibited.
3. **Hybrid VAD Fast-Handoff:** Client-side Silero VAD signals endpointing via canonical `{ realtimeInput: { audioStreamEnd: true } }`, triggering zero-latency handoff without violating WebSocket contracts.
4. **Terminal Signal Equivalence & Deduplication:** `serverContent.generationComplete` and `turnComplete` are equivalent terminal signals, with duplicate frame rejection in the backend router to eliminate false circuit breaker recovery nudges.
5. **Turn 0 Tool Lockdown:** AI interviewer is strictly forbidden from executing evaluation tools on Turn 0 before candidate answers.
6. **EchoGuard Uplink Gating:** Gateway drops candidate mic chunks received during active AI speech/playout (+450ms reverb padding), protecting cloud VAD from speaker-bleed.

> 📖 **Complete Protocol Details:** Refer directly to the canonical protocol SSOT:  
> [AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](file:///d:/projects/interview_projects/spring/docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md).
