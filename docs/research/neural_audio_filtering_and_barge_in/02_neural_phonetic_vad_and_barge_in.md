# Deep Research Plane 2: Neural Phonetic VAD & Accidental Barge-In Resilience (Late 2026 SOTA)

> **File:** `02_neural_phonetic_vad_and_barge_in.md`  
> **Target Subsystem:** Voice Activity Detection (VAD) & Barge-In Floor Control  
> **Output Destination for Report:** `docs/research/neural_audio_filtering_and_barge_in/reports/02_neural_phonetic_vad_and_barge_in_report.md`  
> **Integration Context:** Google Gemini 3.8 Live Voice State Machine & AudioPlayoutManager

---

## Deep Research Prompt

```markdown
Role: Staff Conversational AI Architect & Acoustic Speech Scientist (State-of-the-Art Late 2026).

Context:
In our real-time duplex conversational assessment system (tutoring candidates with Google Gemini 3.8 Live), candidate microphones capture both intentional speech and unintentional acoustic transients.
The current client voice engine evaluates acoustic barge-in using an energy-only RMS Schmitt trigger (-35 dB threshold in an AudioWorklet). As a result, sudden non-speech acoustic spikes—such as sneezing, coughing, throat clearing, sighing, laughter, desk thumping, or pen clicking—immediately cause the engine to cut off AI speech and switch to listening mode. Conversely, when the candidate pauses to think during an answer, trailing mouth clicks or breaths hold the turn open.
CRITICAL INVARIANT: In Gemini 3.8 Live, an acoustic barge-in (`serverContent { interrupted: true }`) physically truncates the model's generated turn in the cloud KV-cache. A false barge-in irreversibly erases the model's unspoken thoughts. Therefore, false barge-in must be eliminated at the client side before the audio or interruption signal can touch the session.

Inquiry & Technical Scope:

1. Semantic Speech Activity Classification (Speech vs Non-Speech Vegetative Acoustics):
   - How do leading conversational duplex systems in late 2026 (OpenAI Advanced Voice Mode, LiveKit Agents, ElevenLabs Conversational AI, Daily Pipecat) mathematically formulate speech activity to cleanly distinguish:
     * Category A: Deliberate Conversational Interruption (sustained voiced phonemes, formant transitions F1-F3, fundamental frequency pitch contours, intentional words).
     * Category B: Accidental Vegetative / Paralinguistic Transients (coughs, sneezes, yawns, throat clearing, sniffing, heavy exhalations, laughter, desk taps).
     * Category C: Conversational Backchanneling ("uh-huh", "yeah", "sure", "угу", "да", "понятно") where the candidate signals active listening without intending to seize conversational floor custody?
   - What acoustic feature profiles (FFT spectral tilt, spectral flux, zero-crossing rate, harmonic-to-noise ratio) definitively separate a 100ms cough pulse from a 100ms speech onset?

2. Benchmarking Neural VAD Architectures on Web Edge:
   - Deep dive into state-of-the-art neural VAD models executable in the browser (via ONNX Runtime Web, Web Worker, or AudioWorklet with WASM SIMD):
     * Silero VAD (v5 and v5.1)
     * Ten-VAD (Agora)
     * WebRTC VAD (GMM-based baseline)
     * Lightweight streaming Whisper-VAD / Picovoice Cobra
   - Compare them across:
     * Model parameter size, memory footprint in WebAssembly, and quantization efficiency (INT8 vs FP16).
     * Inference latency per 32ms frame (512 samples @ 16kHz).
     * False Positive Rate (FPR) specifically on coughing and sneezing audio datasets.
     * False Negative Rate (FNR) on quiet, hesitant, or accented speech.

3. Mathematical Formulation of the Barge-In Filter & Minimum Voicing Duration:
   - What is the mathematically proven Minimum Voicing Duration ($T_{\text{min\_voice}}$) required to confirm intentional barge-in without introducing noticeable conversational lag?
   - What combination of:
     * Neural speech probability threshold ($P_{\text{speech\_start}}$, e.g., 0.85 vs 0.50),
     * Consecutive frame hysteresis ($N_{\text{frames}}$, e.g., 8–10 consecutive 32ms frames = 250–320ms),
     * Hangover duration ($T_{\text{hangover}}$, e.g., 200–300ms) to bridge natural intra-word plosive closures,
     is optimal to completely suppress 100% of sneezes and coughs while keeping speech interruption snappy?

4. Dual-Gate Speculative State Machine Design (Speculative Audio Ducking with Instant Rollback):
   - How can a client voice state machine implement "Speculative Audio Ducking with Instant Rollback"?
     * Stage 1 (Acoustic Onset): Candidate produces sound while AI speaks -> AI audio volume is softly attenuated (ducked by -12 dB with a 15ms ramp) rather than hard-cut. The audio output stream continues playing in the background.
     * Stage 2 (Phonetic Confirmation): If neural VAD asserts genuine speech sustained over $\ge 250$ms -> full barge-in triggered, AI audio instantly muted (5ms de-click ramp), UI switches to listening, dialogue turn transferred.
     * Stage 3 (Transient Rollback): If sound was a transient cough/sneeze ($< 200$ms or $P(\text{speech}) < 0.20$) -> AI volume smoothly ramps back to 0 dB within 15ms. Candidate hears uninterrupted AI speech, AI KV-cache remains intact, and zero disruption occurred!
   - Provide concrete state machine transition tables and mathematical equations for this speculative barge-in pattern.

Deliverable Requirements:
Provide a rigorous scientific and architectural report including mathematical state equations, acoustic feature profiles (FFT spectra of speech vs cough/sneeze), probability threshold recommendations, and executable TypeScript state machine code.
```
