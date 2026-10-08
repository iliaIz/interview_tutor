# Deep Research Inquiry 06: Zero-Middleware Native Voice Agent Architecture

> **Inquiry ID:** `W14-INQ-06`  
> **Topic:** Minimalist, Zero-Middleware Enterprise AI Voice Interviewer Architecture  
> **Target Models:** `gemini-3.8-live`  
> **Standard:** Google GenAI SDK (`@google/genai` >= 2.3.0) & Web Audio API (AudioWorklet)  

---

## 1. Deep Research Prompt (Copy & Paste)

```text
Design a state-of-the-art, zero-middleware architecture for a production enterprise Technical Interview AI voice platform powered by Google Gemini 3.8 Live (generativelanguage.googleapis.com / BidiGenerateContent) as of late 2026.

The overarching design mandate is the complete elimination of custom middleware hacks and technical debt:
- NO custom digital silence audio clamping (dead-air guards).
- NO client-side neural VAD (Silero VAD) overriding model turn boundaries.
- NO synthetic audio padding, audio patching, or fake conversational nudges.
- NO blind hot-reconnect loops or manual past-turn text replaying.
- NO dual-output audio routing or fragile state machine watchdog traps.

Investigate the following architectural blueprint requirements:
1. Pure Web Audio Client Pipeline: How should the browser frontend capture microphone input (16kHz Mono 16-bit PCM) via an AudioWorklet, stream chunks continuously to the server, and play back incoming 24kHz Mono PCM audio with sub-10ms buffer latency, anti-lapping ring buffer, and clean tactile/acoustic barge-in?
2. Transparent Edge/Proxy Layer: What is the optimal responsibility split between the client browser, an edge proxy (e.g. Node.js WebSocket router or LiteLLM gateway), and upstream Google? How should the proxy manage authentication and key rotation while maintaining pure, transparent protocol pass-through without altering or intercepting frame sequences?
3. Symmetrical Turn-Taking & Playout Synchronization: What is the cleanest, mathematically sound state machine for transitioning between AI speech and candidate microphone that eliminates race conditions between WebSocket turnComplete signals and physical audio DAC headphone drain?
4. Observability & Telemetry: How should latency metrics (TTFA, round-trip audio latency, candidate pause durations) and usage metadata be tracked transparently from Google's native serverContent frames without introducing polling or proxy bottlenecks?
5. Reference Implementation: Provide a complete architectural specification and TypeScript code skeletons for both client AudioWorklet / Web Audio manager and backend WebSocket forwarder following Google's canonical Live API standards.
```

---

## 2. Technical Focus Areas & Specific Verification Targets

- **AudioWorklet DSP Design:** Buffer sizing ($2^{20}$ to $2^{22}$ samples), drift compensation, avoiding main-thread GC pauses.
- **Single-Sink Audio Routing:** How to cleanly route audio on both mobile devices (Android loudspeaker/iOS) and desktop without dual-channel echo.
- **Tactile Barge-In Ramp:** Smooth 5ms gain de-clicking ramp when interrupting playing audio buffers.
- **Pass-Through Transparency:** Invariant that the backend proxy never deserializes or modifies audio payload buffers unless strictly necessary for auth or metrics.

---

## 3. Expected Deliverables in Research Report

1. Comprehensive architecture diagram illustrating the end-to-end data flow (Microphone -> AudioWorklet -> Proxy -> Google Gemini -> AudioContext Destination).
2. Clean TypeScript implementation skeletons for the headless client engine and backend router.
3. Verification checklist confirming the removal of all legacy middleware layers.
