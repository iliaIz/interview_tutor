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

RESEARCH METHODOLOGY MANDATE (ZERO-ANCHORING):
Do NOT anchor your investigation to legacy 2023–2024 model versions or obsolete GMM baselines. You are expected to survey the frontier of production neural Voice Activity Detection (VAD) and phonetic activity classifiers as of late 2026. This includes the latest generations of established engines (such as modern Silero VAD, Agora Ten-VAD, Picovoice) alongside newer emergent paradigms (e.g. streaming Conformer-based VADs, distilled audio foundation frontends, or lightweight ONNX/WASM neural phonetic classifiers).

Inquiry & Technical Scope:

1. Acoustic & Phonetic Discrimination (Speech vs Non-Speech Vegetative Acoustics):
   - What acoustic, spectral, and temporal features definitively differentiate genuine speech from impulsive non-speech transients:
     * Human Speech: Sustained vocal fold vibration, formant transitions (F1–F3), pitch periodicity (F0), typical vowel nucleus duration ($\ge 80\text{--}150$ ms), and syllable structure.
     * Accidental Vegetative Acoustics: Sudden broadband energy bursts (coughs, sneezes, throat clears, snorts), turbulent friction noise (sighs, sharp inhalation), or mechanical impacts (desk thumps, keyboard clicks).
     * Backchannels: Brief affirmative vocalizations ("угу", "да", "ага", "yeah", "mhm") that signify listening without intent to seize the conversational floor.
   - What mathematical feature extraction (MFCCs, log-mel filterbanks, spectral centroid, spectral flux, zero-crossing rate) or end-to-end neural embeddings achieve $< 1\%$ False Positive Rate on coughing/sneezing datasets?

2. Benchmarking Late-2026 Edge Neural VAD Engines:
   - Identify and benchmark the top-performing neural VAD models capable of client-side execution in modern browsers (WebAssembly SIMD / ONNX Runtime Web / WebGPU):
     * Model parameter size, quantized weight footprint (INT8/FP16), and memory requirements.
     * Execution latency per 32ms frame (512 samples @ 16kHz) on low-end and high-end client devices.
     * ROC curves: False Positive Rate (FPR) on paralinguistic sounds (coughs, sneezes, laughs) versus False Negative Rate (FNR) on quiet, accented, or hesitant speech.
     * Cold-start initialization time and runtime thread safety inside Web Workers or AudioWorklets.

3. Mathematical Formulation of the Barge-In Filter & Temporal Hysteresis:
   - What is the mathematically optimal Minimum Voicing Duration ($T_{\text{min\_voice}}$) that reliably excludes coughs/sneezes while feeling instantaneous to a human user who intentionally starts speaking?
   - What combination of:
     * Neural speech probability activation threshold ($P_{\text{speech\_start}}$, e.g. 0.85 vs 0.50),
     * Deactivation threshold ($P_{\text{speech\_end}}$, e.g. 0.35),
     * Frame-aggregation hysteresis ($N_{\text{active}}$ consecutive frames of verified speech),
     * Hangover duration ($T_{\text{hangover}}$ frames to bridge unvoiced stops and intra-word closures),
     provides provable mathematical stability against impulsive burst interruptions?

4. Dual-Gate Speculative State Machine Design (Speculative Audio Ducking with Instant Rollback):
   - How should a client voice state machine orchestrate "Speculative Audio Ducking with Instant Rollback" to eliminate user friction:
     * Stage 1 (Acoustic Trigger): An acoustic onset is detected while AI is speaking. Rather than hard-muting, the AI playback volume is smoothly ducked (e.g. -12 dB with a 15ms linear/exponential ramp). Audio continues decoding and playing.
     * Stage 2 (Phonetic Verification): The neural VAD analyzes the audio across a 200–300ms verification window. If intentional speech is confirmed ($P(\text{speech}) > P_{\text{threshold}}$ over $N$ frames) $\to$ full barge-in is committed, AI audio is silenced with a 5ms de-click ramp, and the floor is transferred.
     * Stage 3 (Transient Rollback): If the sound was a transient cough/sneeze/click $\to$ AI playback volume smoothly ramps back to 0 dB within 15ms. The candidate hears uninterrupted speech, and the AI's cloud KV-cache is never truncated!
   - Provide formal state transition tables, edge-trigger definitions, and TypeScript implementation code for this dual-gate controller.

Deliverable Requirements:
Provide a rigorous scientific and architectural report including mathematical state equations, acoustic feature profiles (FFT spectra of speech vs cough/sneeze), probability threshold recommendations, and executable TypeScript state machine code.
```
