# Deep Research Plane 3: Gemini 3.8 Live Protocol Arbitration & Stream Gating (Late 2026 SOTA)

> **File:** `03_gemini_live_stream_arbitration_and_gating.md`  
> **Target Subsystem:** WebSocket Gateway & Upstream Gemini Live Audio Bridge  
> **Output Destination for Report:** `docs/research/neural_audio_filtering_and_barge_in/reports/03_gemini_live_stream_arbitration_and_gating_report.md`  
> **Anchored System Target:** Google Gemini 3.8 Live (`models/gemini-3.8-live` & `gemini-3.8-live-extended-thinking`), Multimodal Live API (`BidiGenerateContent`)

---

## Deep Research Prompt

```markdown
Role: Google Gemini Multimodal Live Protocol Architect & Real-Time Streaming Systems Specialist (Late 2026 Standard).

Context:
Our backend WebSocket gateway bridges candidate browser audio to Google Gemini 3.8 Live (`models/gemini-3.8-live` and `gemini-3.8-live-extended-thinking`) using raw 16kHz 16-bit Mono Little-Endian PCM wrapped in `{ realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: base64 } } }`.
Currently, during the candidate's turn (`LISTENING`), if the candidate coughs, sneezes, or clears their throat, that non-speech audio flows unfiltered into Google Gemini Live, triggering accidental Cloud VAD activity (`ACTIVITY_START`), hallucinated non-speech transcriptions, and premature model generation.

PROVEN PROTOCOL INVARIANTS (NON-NEGOTIABLE BOUNDARIES):
1. PROHIBITED: `audioStreamEnd: true` in active dialogue. Sending `{ realtimeInput: { audioStreamEnd: true } }` upon local pause/silence causes WebSocket Close 1011 (Failed to close streaming context). `audioStreamEnd` is reserved strictly for physical Mute or session Hangup.
2. PROHIBITED: empty `clientContent: { turnComplete: true }` injection. Injecting empty `clientContent` into an active audio stream corrupts KV-cache temporal indices, muting the model.
3. PROHIBITED: streaming microphone audio during tool execution. Transmitting mic chunks between `toolCall` and `toolResponse` causes WebSocket Close 1008 Policy Violation.
4. MANDATORY: DAC Drain synchronization ($T_{\text{drain}}$). The microphone must never be unblocked until physical speaker playback has fully drained, eliminating acoustic self-interruption loops.

RESEARCH METHODOLOGY MANDATE (SOTA PROTOCOL DISCOVERY):
You are anchored to Google Gemini 3.8 Live. Inspect the authoritative Google GenAI SDK (`@google/genai` late-2026 releases) and Multimodal Live API documentation. Do NOT rely on obsolete early-2024 preview drafts. Identify all contemporary configuration fields, directives, and streaming contracts governing real-time bidirectional audio.

Inquiry & Technical Scope:

1. Upstream Audio Transmission Topologies (Continuous vs Neural Client-Gated):
   - What is Google's authoritative late-2026 recommendation for audio transmission in Gemini 3.8 Live:
     * Paradigm A (Pure Continuous Streaming): Streaming 16kHz PCM chunks unconditionally 100% of the time, including ambient background silence.
     * Paradigm B (Client-Gated Neural Streaming): Transmitting `{ realtimeInput: { audio: ... } }` ONLY when client-side neural VAD asserts active speech (with a 200ms pre-speech circular buffer flushed upon onset), and streaming continuously with natural trailing silence until turn completion.
     * Paradigm C (Comfort Noise Infilling): Streaming synthesized low-level comfort noise (-60 dB) during pauses instead of raw microphone background.
   - If Paradigm B is employed:
     * How does Google Gemini 3.8 Live's Cloud VAD and attention mechanism handle the transition from zero WebSocket audio frames to active speech?
     * Does a sudden burst of audio cause clock jitter, timestamp disorientation, or model confusion?
     * How does `turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY"` (as specified in Google reference implementations) alter the server's expectation of continuous vs gated streaming?

2. Pre-Speech Circular Buffer & Acoustic Onset Preservation:
   - When client-side neural VAD gates transmission, detecting speech requires an evaluation window of 100–250ms ($N$ frames). Without buffering, leading unvoiced consonants (/p/, /t/, /k/, /s/, /f/, /tʃ/) occurring during this detection window are permanently lost (clipped onset).
   - What is the optimal sizing and architecture of the Pre-Speech Circular Ring Buffer (e.g. 200ms = 3,200 samples @ 16kHz = 6.4 KB)?
   - When speech is confirmed, how should this buffered historical audio be transmitted to Gemini Live:
     * Option 1: Sent as a single concatenated 200ms chunk immediately before real-time streaming resumes?
     * Option 2: Sent in rapid sub-chunks (e.g. four 50ms frames)?
   - Does Gemini's audio encoder properly align attention tokens when a 200ms burst arrives without prior silence?

3. End-of-Turn Natural Handoff (Server Cloud VAD Synergy):
   - Given that `audioStreamEnd: true` is strictly forbidden for turn-taking (§5.1), how does client-gated audio seamlessly hand off turn completion to Gemini's native Cloud VAD?
   - Once the candidate finishes speaking:
     * How much trailing ambient audio ($T_{\text{hangover}}$, e.g. 400–600ms) must the client continue streaming to allow Google's calibrated `silenceDurationMs: 500` to cleanly fire `ACTIVITY_END` and `turnComplete: true`?
     * What hangover duration guarantees that Gemini's Cloud VAD fires reliably without cutting off trailing syllables or creating dead air?

4. Authoritative Gemini 3.8 Live Setup Configuration:
   - What is the definitive, empirically proven configuration of `realtimeInputConfig.automaticActivityDetection` and related parameters in Gemini 3.8 Live to maximize resistance to breathing, fan noise, and rustle while ensuring crisp turn-taking:
     * `disabled`: `false`
     * `startOfSpeechSensitivity`: `"START_SENSITIVITY_LOW"` vs `"START_SENSITIVITY_HIGH"`
     * `prefixPaddingMs`: `200` vs `500`
     * `endOfSpeechSensitivity`: `"END_SENSITIVITY_LOW"`
     * `silenceDurationMs`: `500`
     * `activityHandling`: `"START_OF_ACTIVITY_INTERRUPTS"` vs `"NO_INTERRUPT"`
     * `turnCoverage`: `"TURN_INCLUDES_ONLY_ACTIVITY"`
   - Have any new configuration fields or VAD sensitivity directives been introduced in late-2026 versions of `@google/genai` for speech-to-speech sessions?

Deliverable Requirements:
Provide a comprehensive protocol specification with annotated WebSocket JSON payloads, timing sequence diagrams for pre-speech buffer flushing and trailing silence handoff, risk analysis of Cloud VAD edge cases, and exact TypeScript implementations conforming to Google Gemini Live API standards.
```
