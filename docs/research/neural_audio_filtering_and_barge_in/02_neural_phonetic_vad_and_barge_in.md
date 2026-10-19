# Deep Research Plane 2: Neural Phonetic VAD & Accidental Barge-In Resilience (Late 2026 SOTA)

> **File:** `02_neural_phonetic_vad_and_barge_in.md`  
> **Target Subsystem:** Voice Activity Detection (VAD) & Barge-In Floor Control  
> **Output Destination for Report:** `docs/research/neural_audio_filtering_and_barge_in/reports/02_neural_phonetic_vad_and_barge_in_report.md`

---

## Deep Research Prompt

```markdown
Role: Staff Conversational AI Architect & Acoustic Speech Scientist (State-of-the-Art Late 2026).

Context:
In our real-time duplex conversational assessment system, candidate microphones capture both intentional speech and unintentional acoustic noise. Currently, our client voice engine evaluates barge-in using an energy-only RMS Schmitt trigger (-35 dB threshold). As a result, sudden non-speech acoustic spikes—such as sneezing, coughing, throat clearing, sighing, laughter, or pen clicking—immediately cause the engine to cut off AI speech and switch to listening mode. Conversely, when the candidate pauses to think during an answer, trailing mouth clicks or breaths hold the turn open.

Inquiry & Technical Scope:

1. Semantic Speech Activity Classification (Speech vs Non-Speech Vegetative Acoustics):
   - How do leading conversational duplex systems in late 2026 (OpenAI Advanced Voice Mode, LiveKit Agents, ElevenLabs Conversational AI, Daily Pipecat) mathematically formulate speech activity to cleanly distinguish:
     * Category A: Deliberate Conversational Interruption (voiced phonemes, vowels, formants F1-F3, intentional words).
     * Category B: Accidental Vegetative / Paralinguistic Transients (coughs, sneezes, yawns, throat clearing, sniffing, heavy exhalations, laughter).
     * Category C: Conversational Backchanneling ("uh-huh", "yeah", "sure", "угу", "да", "понятно") where the candidate signals active listening without intending to seize conversational floor custody?

2. Benchmarking Neural VAD Architectures:
   - Deep dive into state-of-the-art neural VAD models executable in the browser (ONNX Runtime Web, Web Worker, or AudioWorklet):
     * Silero VAD (v5 and v5.1)
     * Ten-VAD (Agora)
     * WebRTC VAD (GMM-based baseline)
     * Lightweight streaming Whisper-VAD / Picovoice Cobra
   - Compare them across:
     * Model parameter size, memory footprint in WebAssembly, and quantization efficiency (INT8 vs FP16).
     * Inference latency per 32ms frame (512 samples @ 16kHz).
     * False Positive Rate (FPR) specifically on coughing and sneezing audio datasets.
     * False Negative Rate (FNR) on quiet, hesitant, or accented speech.

3. Mathematical Formulation of the Barge-In Filter:
   - What is the mathematically proven Minimum Voicing Duration ($T_{\text{min\_voice}}$) required to confirm intentional barge-in without introducing noticeable conversational lag?
   - What combination of:
     * Neural speech probability threshold ($P_{\text{speech\_start}}$, e.g., 0.85 vs 0.50),
     * Consecutive frame hysteresis ($N_{\text{frames}}$, e.g., 3–5 frames = 96–160ms),
     * Spectral energy tilt / zero-crossing rate checks,
     is optimal to completely suppress 100% of sneezes and coughs?

4. Dual-Gate Speculative State Machine Design:
   - How can a client voice state machine implement "Speculative Audio Ducking with Instant Rollback"?
     * Stage 1: Candidate makes a sound while AI speaks -> AI audio volume is softly attenuated (ducked by -12 dB) rather than hard-cut.
     * Stage 2: If neural VAD asserts genuine speech within 250ms -> full barge-in triggered, AI silenced, turn transferred.
     * Stage 3: If sound was a transient cough/sneeze -> AI volume instantly ramps back to 0 dB within 10ms with zero perception of disruption.
   - Provide concrete state machine transition tables and mathematical equations for this speculative barge-in pattern.

Deliverable Requirements:
Provide a rigorous scientific and architectural report including mathematical state equations, acoustic feature profiles (FFT spectra of speech vs cough/sneeze), probability threshold recommendations, and executable TypeScript state machine code.
```
