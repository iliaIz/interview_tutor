# Deep Research Plane 3: Gemini 3.8 Live Protocol Arbitration & Stream Gating (Late 2026 SOTA)

> **File:** `03_gemini_live_stream_arbitration_and_gating.md`  
> **Target Subsystem:** WebSocket Gateway & Upstream Gemini Live Audio Bridge  
> **Output Destination for Report:** `docs/research/neural_audio_filtering_and_barge_in/reports/03_gemini_live_stream_arbitration_and_gating_report.md`

---

## Deep Research Prompt

```markdown
Role: Google Gemini Multimodal Live Protocol Architect & Real-Time Streaming Systems Specialist (Late 2026 Standard).

Context:
Our backend WebSocket gateway bridges candidate browser audio to Google Gemini 3.8 Live (`models/gemini-3.8-live` and `gemini-3.8-live-extended-thinking`) using raw 16kHz 16-bit Mono Little-Endian PCM wrapped in `{ realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: base64 } } }`. 
Currently, we stream audio continuously while `automaticActivityDetection` is enabled (`startOfSpeechSensitivity: "START_SENSITIVITY_LOW"`, `activityHandling: "START_OF_ACTIVITY_INTERRUPTS"`). 
When candidates cough, sneeze, or produce ambient room noises, Google's Cloud VAD detects start-of-activity, causing Gemini to either interrupt its own speech or generate hallucinatory responses to non-speech audio.

Inquiry & Technical Scope:

1. Authoritative Gemini Live Audio Transmission Contracts:
   - What is Google's late-2026 authoritative architectural recommendation for audio transmission in bidirectional voice agents:
     * Paradigm A (Continuous Streaming): Streaming audio chunks unconditionally 100% of the time, including ambient background silence.
     * Paradigm B (Client-Gated Streaming): Streaming `{ realtimeInput: { audio: ... } }` ONLY when client-side neural VAD detects active speech, with pre-speech and post-speech padding.
     * Paradigm C (Comfort Noise / Zero Infilling): Streaming synthesized low-level comfort noise (-60 dB) during pauses instead of raw microphone background.
   - What are the documented failure modes of Paradigm B? If the WebSocket sends zero audio frames during silence, does Google's Cloud VAD lose acoustic context, fail turn endpointing, or close the session?

2. Decoupling Cloud Barge-In from Cloud VAD:
   - What is the exact behavioral difference in Gemini 3.8 Live between:
     * `activityHandling: "START_OF_ACTIVITY_INTERRUPTS"`
     * `activityHandling: "NO_INTERRUPT"` / client-controlled explicit interruption
   - How can an enterprise voice gateway completely eliminate upstream Cloud VAD false barge-in by taking authoritative client custody of the interruption signal (using `{ clientContent: { turnComplete: true } }` or explicit barge-in control frames) instead of letting raw acoustic spikes trigger server-side interruption?

3. Pre-Speech Ring Buffer & Acoustic Onset Preservation:
   - If client audio is gated (only transmitted upon verified neural speech), leading unvoiced consonants (/p/, /t/, /k/, /s/, /f/, /tʃ/) occurring during the 100–250ms VAD detection window risk being clipped.
   - How large should the client-side Pre-Speech Circular Ring Buffer be (e.g. 150ms, 250ms, 400ms)?
   - When speech is confirmed, how should this buffered historical audio be transmitted to Gemini Live? Does bursting multiple pre-speech frames in 0ms cause upstream vocoder jitter, timestamp disorientation, or rate limiting?

4. End-of-Speech Handoff & Fast-Handoff Protocol:
   - What is the exact contract for `{ realtimeInput: { audioStreamEnd: true } }` in Gemini 3.8 Live?
   - How does `audioStreamEnd: true` interact with `silenceDurationMs` in `automaticActivityDetection`?
   - Can client-signaled `audioStreamEnd` achieve zero-latency turn handoff without waiting for Google's 800ms server silence timeout?

Deliverable Requirements:
Provide a comprehensive protocol specification with annotated WebSocket JSON payloads, sequence diagrams for gated vs continuous streaming, timing diagrams for pre-speech buffer flushing, and explicit recommendations for Gemini Live session setup parameters.
```
