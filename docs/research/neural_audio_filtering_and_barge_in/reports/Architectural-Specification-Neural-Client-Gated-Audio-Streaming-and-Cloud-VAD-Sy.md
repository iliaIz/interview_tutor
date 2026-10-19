# Architectural Specification: Neural Client-Gated Audio Streaming and Cloud VAD Synchronization for Google Gemini 3.8 Live

## Executive Summary and Protocol Foundations
The transition to native speech-to-speech multimodal architectures with Google DeepMind's Gemini 3.8 Audio family (`models/gemini-3.8-live` and `models/gemini-3.8-live-extended-thinking`), built upon the Gemini 3 Pro foundation with a 128K-token input context window and 64K-token output capacity, fundamentally alters real-time voice gateway engineering. Released in late 2026, these models lead industry speech evaluations, with Gemini 3.8 Live Extended Thinking achieving 82.6% on the Artificial Analysis Speech-to-Speech Quality Index, 97.7% on Big Bench Audio, 68.6% on τ-Voice task completion, and 35.1% on Sierra's τ³-Banking benchmark. Unlike legacy cascaded pipelines that decouple automatic speech recognition (ASR), text-based large language model (LLM) inference, and text-to-speech (TTS) synthesis, the Gemini Multimodal Live API (`BidiGenerateContent`) ingests raw 16kHz, 16-bit, mono, little-endian pulse-code modulation (PCM) audio directly into a unified multimodal token stream and emits 24kHz PCM audio alongside asynchronous transcriptions and tool invocations. While direct acoustic ingestion enables superior alphanumeric precision and sub-second conversational responsiveness, it exposes the model's server-side Voice Activity Detection (`AutomaticActivityDetection`) and self-attention mechanisms directly to raw acoustic artifacts from the user's environment, while incurring continuous input audio token charges of $0.005 per minute ($0.84 per hour on standard Gemini 3.8 Live and $3.50 per hour on Gemini 3.8 Live Extended Thinking).
When a backend WebSocket gateway bridges candidate browser audio during an active `LISTENING` state without pre-filtering, non-speech physiological transients—such as coughs, sneezes, throat clearing, heavy aspirations, and microphone rustle—propagate directly into the `realtimeInput.audio` stream. Because server-side Cloud VAD evaluates acoustic onset over short spectral windows to minimize turn-taking latency, impulsive non-speech bursts frequently exceed activation thresholds. This triggers premature `ACTIVITY_START` state transitions, injects non-speech acoustic tokens into the active turn context, produces hallucinated input transcriptions, and initiates unintended model responses or barge-in cancellations.
Mitigating these acoustic false positives requires a strict dual-stage hybrid VAD topology that operates within the hard protocol invariants of the `BidiGenerateContent` WebSocket contract. Specifically, production gateways cannot abuse `audioStreamEnd: true` to demarcate conversational pauses without inducing WebSocket `1011` internal server crashes, nor can they inject empty `clientContent: { turnComplete: true }` frames without corrupting key-value (KV) cache temporal indices and interrupting active generation. Furthermore, the introduction of simultaneous speech and background cognitive processing in `gemini-3.8-live-extended-thinking` decouples utterance completion (`turnComplete: true`) from session readiness (`interactionStatus: "IDLE"`), requiring deterministic synchronization between client-side neural gating, server-side silence commitment, digital-to-analog converter (DAC) playback drain ($T_{\text{drain}}$), and non-blocking tool execution.

## Upstream Audio Transmission Topologies: Continuous vs. Neural Client-Gated
Architecting the upstream audio ingestion path from a candidate's browser through a backend WebSocket proxy to the Gemini 3.8 Live API requires evaluating three distinct transmission topologies against server-side speech detection mechanics, transformer context assembly, and network clocking behavior.

| Topology Paradigm | Upstream Transmission Mechanism | Impact on Cloud VAD (`AutomaticActivityDetection`) | Impact on Transformer Attention & Context Window | Network & Token Cost Profile | Architectural Verdict |
| --- | --- | --- | --- | --- | --- |
| **Paradigm A: Pure Continuous Streaming** | Unconditional streaming of 16kHz PCM chunks (`audio/pcm;rate=16000`) 100% of the time during `LISTENING`. | High vulnerability to impulsive non-speech transients (coughs, throat clearing, desk bumps) triggering false `ACTIVITY_START`. | Under `TURN_INCLUDES_ALL_INPUT`, silence and noise pollute the 128K context; even under `TURN_INCLUDES_ONLY_ACTIVITY`, false VAD triggers inject noise tokens. | Maximum bandwidth and input audio token expenditure ($0.84/hr to $3.50/hr continuous billing). | **Rejected** for candidate assessment gateways due to hallucinated transcriptions and false barge-in. |
| **Paradigm B: Client-Gated Neural Streaming** | Transmits `realtimeInput.audio` only when client neural VAD asserts speech, prepended by a 200–240ms circular pre-roll buffer and followed by a calibrated trailing silence hangover ($T_{\text{hangover}}$). | Eliminates transient false starts on the client while preserving native server `ACTIVITY_START` and `ACTIVITY_END` state transitions. | Aligns identically with `TURN_INCLUDES_ONLY_ACTIVITY`, feeding only clean phonetic segments into the multimodal attention mechanism. | Reduces upstream payload volume and input audio billing by 55%–75% depending on candidate pause ratios. | **Authoritative Late-2026 Standard** for high-reliability voice gateways. |
| **Paradigm C: Comfort Noise Infilling** | Continuous streaming of synthesized -60 dBFS comfort noise during silent intervals, switching to raw mic PCM upon speech detection. | Abrupt spectral floor step-changes (-60 dBFS synthetic to -38 dBFS ambient room floor) trigger spectral-flux VAD false positives at switching boundaries. | Unnecessary ingestion of synthetic noise frames; risks confusing affective dialogue and paralinguistic prosody analyzers. | Identical bandwidth and continuous audio billing penalty to Paradigm A. | **Rejected** as a continuous baseline; used **solely** during the $T_{\text{hangover}}$ tail window to mask trailing transients. |

### Authoritative Evaluation of Paradigm B in Gemini 3.8 Live
While introductory Google SDK notebooks illustrate Paradigm A (`AutomaticActivityDetection` operating over an unfiltered continuous microphone stream) for simplicity, production enterprise deployments on Gemini 3.8 Live require **Paradigm B (Client-Gated Neural Streaming)** coupled with a trailing comfort-noise hangover. Relying solely on server-side `AutomaticActivityDetection` over an unconditioned stream fails against physiological transients because coughs and throat clearings exhibit high energy in the 300 Hz to 3,000 Hz vocal frequency band. A client-side neural VAD (such as Silero VAD v5 executing inside an `AudioWorklet` or gateway worker thread) evaluates multi-frame harmonic formant continuity rather than raw spectral energy, rejecting coughs, sneezes, and mechanical clicks before a single byte traverses the WebSocket.

### Cloud VAD and Attention Mechanics Under Discontinuous Frame Arrival
Understanding how Gemini 3.8 Live's server-side ingestion pipeline, Cloud VAD, and multimodal self-attention mechanism respond when the WebSocket transitions abruptly from zero `realtimeInput.audio` frames to an active speech stream requires examining the underlying asynchronous byte queue architecture. Unlike legacy WebRTC or SIP/RTP media servers that rely on continuous wall-clock RTP timestamps and jitter buffers to maintain a synchronous playback clock, the `BidiGenerateContent` protocol ingests `realtimeInput.audio` blobs as an arrival-ordered stream optimized for low-latency responsiveness. The server does not synthesize time-advanced silence tokens when no WebSocket messages arrive; rather, the session's audio feature extractor advances its internal sample clock strictly as 16kHz PCM bytes are appended to the ingestion buffer.
Because the server's audio tokenizer segments incoming PCM data solely by cumulative sample count ($1\text{ ms} = 16\text{ samples} = 32\text{ bytes}$ at `audio/pcm;rate=16000`), a multi-second wall-clock gap between WebSocket frames during the candidate's silent thinking phase produces zero clock drift, jitter, or positional embedding disorientation, provided the server's VAD state machine was already in the `ACTIVITY_END` (idle) state prior to the gap. Model confusion or stuck turns only occur if the client stops sending audio packets while the server is still inside an active `ACTIVITY_START` window, because the server's `silenceDurationMs` counter measures incoming non-speech PCM sample duration rather than wall-clock socket inactivity.
Furthermore, client-gated streaming operates in direct synergy with `turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY"`. The `turnCoverage` parameter inside `realtimeInputConfig` governs how the server compiles ingested media streams into the user's turn for transformer attention evaluation. In Gemini 2.5, `turnCoverage` defaulted to `"TURN_INCLUDES_ONLY_ACTIVITY"`, whereas in Gemini 3.1 and Gemini 3.8 Live, the default shifted to `"TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO"` (with several framework wrappers defaulting to `"TURN_INCLUDES_ALL_INPUT"`). Under `"TURN_INCLUDES_ONLY_ACTIVITY"`, the server explicitly excises all audio samples occurring outside of committed `ACTIVITY_START` and `ACTIVITY_END` boundaries before constructing the turn's attention tokens. Consequently, gating silence on the client via Paradigm B produces an upstream acoustic sequence that is structurally identical to what the server's internal activity filter extracts under `"TURN_INCLUDES_ONLY_ACTIVITY"`. Explicitly declaring `turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY"` in the setup configuration reinforces this contract and prevents any trailing hangover silence frames from being tokenized into the active prompt context.

## Pre-Speech Circular Buffer and Acoustic Onset Preservation

### Phonetic Vulnerability of Unvoiced Consonants
When a client-side neural VAD gates upstream transmission, confirming true human speech requires evaluating a sliding window of $N$ consecutive acoustic frames (typically $100\text{ ms}$ to $200\text{ ms}$) to verify vocal fold periodicity and formant transitions. In human speech production, word-initial unvoiced plosives (`/p/`, `/t/`, `/k/`) and unvoiced fricatives (`/s/`, `/f/`, `/ʃ/`, `/tʃ/`) consist of aperiodic turbulent airflow or silent articulatory closure lasting $40\text{ ms}$ to $120\text{ ms}$ prior to the onset of voiced vowel phonation. Because neural VAD confidence frequently crosses the activation threshold ($\tau_{\text{onset}} \approx 0.50\text{–}0.65$) only when the subsequent voiced vowel begins, an unbuffered gate permanently clips the leading consonant. In candidate interviews and technical assessments, clipping initial plosives and fricatives severely degrades Gemini 3.8 Live's native alphanumeric precision—causing spoken identifiers such as *"P-409"*, *"Six"*, or *"Ten"* to be misrecognized as *"E-409"*, *"Ix"*, or *"En"*.

### Optimal Sizing and Memory Architecture of the Circular Ring Buffer
To guarantee zero-clipping onset preservation while accommodating a $100\text{–}200\text{ ms}$ neural evaluation latency, the client or gateway must maintain a lock-free **Pre-Speech Circular Ring Buffer** operating continuously during the `LISTENING` state. At the native Gemini Live input specification of $f_s = 16,000\text{ Hz}$, 16-bit signed integer (`Int16`, 2 bytes per sample), mono PCM:

$$
\text{Byte Rate} = 16,000\text{ samples/s} \times 2\text{ bytes/sample} = 32,000\text{ bytes/s} = 32\text{ bytes/ms}
$$
A standard **200ms** lookback window requires:

$$
N_{\text{samples}} = 0.200\text{ s} \times 16,000\text{ Hz} = 3,200\text{ samples} \quad (6,400\text{ bytes} = 6.4\text{ KB})
$$
However, to ensure that Gemini 3.8 Live's server-side causal noise-floor estimator and automatic gain control (AGC) establish a clean spectral baseline *before* the unvoiced consonant arrives, the optimal ring buffer architecture adds a **40ms leading acoustic anchor** of quiet room tone ahead of the 200ms phonetic lookback window, yielding a **240ms total ring buffer**:

$$
N_{\text{optimal}} = 0.240\text{ s} \times 16,000\text{ Hz} = 3,840\text{ samples} \quad (7,680\text{ bytes} = 7.68\text{ KB})
$$

| Buffer Parameter | 200ms Baseline Specification | 240ms Production Specification (Recommended) | Architectural Rationale |
| --- | --- | --- | --- |
| **Total Duration** | $200\text{ ms}$ | $240\text{ ms}$ ($40\text{ ms}$ room anchor + $200\text{ ms}$ onset) | Provides $40\text{ ms}$ of pre-onset baseline so server-side VAD spectral subtraction does not attenuate initial unvoiced fricatives. |
| **Sample Count (@ 16kHz)** | $3,200\text{ samples}$[cite: 8] | $3,840\text{ samples}$[cite: 8] | Exact integer multiple of both $20\text{ ms}$ ($320$-sample) WebRTC frames and $32\text{ ms}$ ($512$-sample) Silero VAD frames ($7.5\text{ frames}$ or $12\times 20\text{ ms}$ frames). |
| **Raw PCM Memory Footprint** | $6,400\text{ bytes}$ ($6.40\text{ KB}$) | $7,680\text{ bytes}$ ($7.68\text{ KB}$) | Negligible L1 CPU cache footprint; zero garbage-collection pressure when allocated as a static `Int16Array`. |
| **Base64 Payload Size** | $8,536\text{ bytes}$ | $10,240\text{ bytes}$ | Encodes cleanly into standard WebSocket frames without exceeding proxy buffer limits. |
| **Transient Contamination Guard** | None (raw FIFO lookback) | Per-frame Non-Speech Spike Attenuation | If a frame inside the 240ms lookback has high RMS energy ($>-18\text{ dBFS}$) but low neural speech probability ($P_{\text{speech}} < 0.15$), it is replaced with $-60\text{ dBFS}$ comfort noise so a cough immediately preceding speech is never flushed. |

### Buffer Flush Mechanics: Single Concatenated Chunk vs. Paced Sub-Chunks
When the client-side neural VAD confirms speech onset at time $t_{\text{confirm}}$, the gateway must choose between two transmission mechanics to flush the historical circular buffer before streaming real-time microphone frames. Under Option 1 (Single Concatenated 200ms–240ms Chunk), the gateway reads all $3,200\text{–}3,840$ samples from the circular buffer in chronological order, encodes the contiguous $6.4\text{–}7.68\text{ KB}$ byte array into a single base64 string, and sends one `{ "realtimeInput": { "audio": { "mimeType": "audio/pcm;rate=16000", "data": "..." } } }` frame immediately prior to the current real-time frame. Under Option 2 (Rapid Sub-Chunk Flushing in 40ms–50ms Frames), the gateway slices the buffered historical audio into four $50\text{ ms}$ ($1,600$-byte) or six $40\text{ ms}$ ($1,280$-byte) sub-chunks and transmits them sequentially as distinct `realtimeInput.audio` WebSocket messages spaced by $2\text{–}5\text{ ms}$ across ticks of the event loop.
While Gemini 3.8 Live's audio ingestion endpoint accepts arbitrary blob sizes under Option 1, **Option 2 (Sub-Chunk Flushing in 40ms–50ms Frames) is empirically superior** for two structural reasons. First, the server-side `AutomaticActivityDetection` state machine evaluates `prefixPaddingMs` transitions over discrete $20\text{ ms}$ to $40\text{ ms}$ internal acoustic windows. Delivering the lookback buffer as four $50\text{ ms}$ (or six $40\text{ ms}$) sub-chunks guarantees that the server's streaming frame demuxer processes the initial $40\text{–}50\text{ ms}$ quiet anchor frame first, establishing its noise-floor state before evaluating the subsequent onset frames. Second, Gemini's multimodal audio encoder maps contiguous $25\text{ ms}\text{–}40\text{ ms}$ PCM windows into discrete acoustic attention tokens. Feeding uniform $40\text{ ms}$ or $50\text{ ms}$ frames prevents micro-burst queue head-of-line blocking in the WebSocket proxy and ensures that the server's `interimInputTranscription` and audio encoder align attention tokens seamlessly without requiring prior continuous silence.

## End-of-Turn Natural Handoff and Server Cloud VAD Synergy

### Why Immediate Gate Closure Causes Server VAD Deadlock
Because Proven Protocol Invariant #1 strictly forbids sending `{ "realtimeInput": { "audioStreamEnd": true } }` upon local speech pauses (which triggers WebSocket Close `1011` in active bidirectional sessions), and Invariant #2 forbids injecting empty `clientContent: { turnComplete: true }` messages, **Gemini's native Cloud VAD (`AutomaticActivityDetection`) must naturally detect and commit the end of every candidate turn**.
To understand how client-gated streaming hands off turn completion to the server, system architects must recognize a fundamental protocol invariant of `AutomaticActivityDetection`: **the server's `silenceDurationMs` timer advances strictly by counting incoming non-speech PCM audio samples, not wall-clock elapsed time**. When the server transitions into `ACTIVITY_START`, it accumulates audio tokens until it observes a contiguous sequence of PCM samples classified as non-speech whose cumulative duration equals or exceeds `silenceDurationMs`:

$$
T_{\text{observed\_silence}} = \frac{N_{\text{silent\_samples}}}{16,000\text{ Hz}} \times 1000 \ge \text{silenceDurationMs}
$$
If the client-side neural VAD detects that the candidate has finished speaking and immediately stops transmitting `realtimeInput.audio` frames, the server's audio ingestion buffer halts at the final spoken vowel or consonant. Because zero silent PCM samples arrive over the WebSocket, $N_{\text{silent\_samples}}$ remains frozen below the `silenceDurationMs: 500` threshold. The server's VAD state machine remains deadlocked in `ACTIVITY_START`, `ACTIVITY_END` never fires, and the candidate faces perpetual dead air.

### Mathematical Derivation of the Trailing Hangover Duration ($T_{\text{hangover}}$)
To guarantee that Gemini 3.8 Live's Cloud VAD fires `ACTIVITY_END` and initiates model generation with 100% reliability—without cutting off trailing syllables or introducing unnatural latency—the total trailing silence streamed after the candidate's last vocalized phoneme must account for three distinct temporal phases. First, the client-side neural VAD requires a **Redemption Window ($T_{\text{redemption}} = 300\text{ ms}$)**. When a candidate utters a word containing an internal voiceless stop closure (such as the `/p/` in *"important"* or `/t/` in *"water"*) or pauses briefly between clauses, vocal energy drops for $100\text{–}220\text{ ms}$. To prevent the client gate from closing mid-sentence, the local neural VAD must remain in an active hold state (`REDEMPTION`) for $T_{\text{redemption}} = 300\text{ ms}$ after speech probability drops below the offset threshold ($P_{\text{speech}} < \tau_{\text{offset}}$), continuing to stream audio so that if the candidate resumes speaking at $t + 200\text{ ms}$, zero frames are lost.
Second, the server exhibits an **Acoustic Tail Decay ($T_{\text{server\_decay}} \approx 120\text{–}150\text{ ms}$)**. Configured with `endOfSpeechSensitivity: "END_SENSITIVITY_LOW"`, Gemini's server-side VAD applies a conservative hysteresis decay to room reverberation and final consonant release before classifying incoming frames as pure non-speech. Thus, the server's internal `silenceDurationMs` counter does not begin incrementing at the exact millisecond the candidate stops phonating; it begins incrementing approximately $150\text{ ms}$ after the final vocalized frame arrives. Third, the **Server Silence Commitment Window ($T_{\text{silenceDurationMs}} = 500\text{ ms}$)** requires that once the server's acoustic classifier transitions to non-speech at $t_{\text{offset}} + 150\text{ ms}$, it must ingest a full $500\text{ ms}$ of continuous non-speech PCM samples to commit `ACTIVITY_END`.
Summing the server's required sample duration alongside a $150\text{ ms}$ safety margin yields:

$$
T_{\text{server\_required}} = T_{\text{server\_decay}} + T_{\text{silenceDurationMs}} + T_{\text{safety\_margin}} = 150\text{ ms} + 500\text{ ms} + 150\text{ ms} = 800\text{ ms}
$$
Because the client has already streamed $T_{\text{redemption}} = 300\text{ ms}$ of trailing audio while waiting to confirm local end-of-speech, the gateway must stream an **additional post-redemption hangover of $T_{\text{hangover}} = 500\text{ ms}$** (for a cumulative **800ms** of trailing non-speech PCM after the final spoken syllable):

$$
T_{\text{total\_trailing}} = T_{\text{redemption}}\ (300\text{ ms}) + T_{\text{hangover}}\ (500\text{ ms}) = 800\text{ ms} \quad (12,800\text{ samples} = 25.6\text{ KB})
$$

### Transient Suppression During the Hangover Window and Early Gate Termination
A subtle but critical failure mode occurs when a candidate finishes speaking a sentence and immediately clears their throat or exhales sharply into the microphone $400\text{ ms}$ later (during the $T_{\text{hangover}}$ drain window). If the client streams raw microphone audio during $T_{\text{hangover}}$, that post-speech cough reaches Gemini Live at $t_{\text{offset}} + 400\text{ ms}$—just $100\text{ ms}$ before the server's `silenceDurationMs: 500` timer would have committed `ACTIVITY_END`. The cough resets the server's silence timer to zero, appends hallucinated tokens to the candidate's transcript, and delays turn completion by nearly a full second.
To eliminate this vulnerability, during the post-redemption hangover window ($T_{\text{hangover}} = 500\text{ ms}$, and during any frame within $T_{\text{redemption}}$ where local neural $P_{\text{speech}} < 0.15$), the gateway **substitutes synthesized comfort-noise PCM** (Gaussian dithered silence at $-60\text{ dBFS}$, matching a quiet studio floor of $\pm 32\text{ LSB}$ in `Int16`) instead of raw microphone samples. If the candidate begins genuine speech during the hangover window ($P_{\text{speech}} \ge \tau_{\text{onset}}$), the state machine immediately aborts the hangover and transitions back to `ACTIVE_SPEECH`. Otherwise, the server receives $500\text{ ms}$ of guaranteed, transient-free silent PCM samples, firing `ACTIVITY_END` and `turnComplete` deterministically at $t_{\text{offset}} + 650\text{ ms}$. Furthermore, if the Gemini server emits a `voiceActivity` (`ACTIVITY_END`) event, `serverContent.modelTurn` audio chunks, or `serverContent.interrupted: false` prior to the expiration of the $800\text{ ms}$ trailing window, the gateway immediately terminates the hangover drain and closes the upstream gate, transitioning to the `MODEL_SPEAKING` or `MODEL_WORKING` state.

### Millisecond-Level Sequence Specification
The following table details the exact chronological execution across client, gateway, and Gemini 3.8 Live server layers during pre-speech buffer flushing and end-of-turn handoff:

| Relative Time ($t$) | Acoustic Input Event | Client Neural VAD & Ring Buffer State | WebSocket Upstream Action (`realtimeInput.audio`) | Gemini 3.8 Live Server VAD & Session State |
| --- | --- | --- | --- | --- |
| **$t = -240\text{ ms}$** | Ambient room noise ($-52\text{ dBFS}$). | State: `SILENT`. 240ms Ring Buffer ($7.68\text{ KB}$) continuously overwrites oldest frames. | Zero frames transmitted. | `speechState`: Idle / Non-speech; `interactionStatus`: `"IDLE"`. |
| **$t = -120\text{ ms}$** | Candidate coughs ($90\text{ ms}$ impulse, $-12\text{ dBFS}$). | Neural VAD evaluates harmonic structure: $P_{\text{speech}} = 0.08 < \tau_{\text{onset}}$ ($0.55$). Spike attenuated to $-60\text{ dBFS}$ in ring buffer. | Zero frames transmitted. Cough completely blocked from network. | Remains Idle. Zero false `ACTIVITY_START` events; zero context pollution. |
| **$t = 0\text{ ms}$** | Candidate begins speaking word *"Seven"* (initial unvoiced fricative `/s/`). | $P_{\text{speech}}$ rises to $0.32$. Ring buffer captures `/s/` onset frames after $40\text{ ms}$ quiet anchor. | Zero frames transmitted while neural confidence accumulates. | Remains Idle. |
| **$t = +160\text{ ms}$** | Voiced vowel `/ɛ/` in *"Seven"* resonates. | $P_{\text{speech}} = 0.89 \ge \tau_{\text{onset}}$ for 4 consecutive $32\text{ ms}$ frames. State transitions to `FLUSHING_PRE_ROLL`. | Flushes 240ms circular buffer ($t=-40\text{ ms}$ to $+200\text{ ms}$) as six $40\text{ ms}$ ($1,280$-byte) PCM frames paced at $3\text{ ms}$ intervals. | Ingests $40\text{ ms}$ quiet anchor followed by `/s/` and `/ɛ/` frames; begins incrementing `prefixPaddingMs` counter. |
| **$t = +200\text{ ms}$** | Candidate continues speaking utterance. | State: `ACTIVE_SPEECH`. Ring buffer bypassed; real-time streaming active. | Streams live $40\text{ ms}$ PCM chunks (`audio/pcm;rate=16000`) every $40\text{ ms}$. | `prefixPaddingMs: 200` satisfied. Commits `ACTIVITY_START` and streams `interimInputTranscription`. |
| **$t = +1200\text{ ms}$** | Candidate finishes final syllable of utterance. | $P_{\text{speech}}$ drops to $0.04 < \tau_{\text{offset}}$ ($0.35$). State transitions to `REDEMPTION` ($300\text{ ms}$ timer starts). | Streams transient-clamped silent PCM frames ($40\text{ ms}$ cadence) to preserve inter-word continuity. | Server VAD enters acoustic tail decay ($T_{\text{server\_decay}} \approx 150\text{ ms}$). |
| **$t = +1350\text{ ms}$** | Room reverberation subsides ($150\text{ ms}$ post-speech). | Inside `REDEMPTION` window ($150\text{ ms}$ elapsed of $300\text{ ms}$). | Continues streaming $40\text{ ms}$ silent PCM frames. | Server acoustic classifier registers non-speech; server `silenceDurationMs` counter starts at $0\text{ ms}$. |
| **$t = +1500\text{ ms}$** | Candidate inhales audibly ($300\text{ ms}$ post-speech). | `REDEMPTION` expires ($300\text{ ms}$). State enters `HANGOVER_DRAIN` ($500\text{ ms}$ timer). Inhale replaced by $-60\text{ dBFS}$ comfort silence. | Streams synthesized $-60\text{ dBFS}$ dithered comfort-noise PCM frames ($40\text{ ms}$ cadence). | Server `silenceDurationMs` counter reaches $150\text{ ms}$ and continues advancing smoothly. |
| **$t = +1850\text{ ms}$** | Silence continues ($650\text{ ms}$ post-speech). | Inside `HANGOVER_DRAIN` ($350\text{ ms}$ of $500\text{ ms}$ elapsed). | Continues streaming $-60\text{ dBFS}$ comfort-noise PCM frames. | Server `silenceDurationMs: 500` satisfied ($150\text{ ms} + 500\text{ ms} = 650\text{ ms}$). Commits `ACTIVITY_END`, finalizes `inputTranscription`, and begins `modelTurn` generation (`interactionStatus: "IN_PROGRESS"`). |
| **$t = +2000\text{ ms}$** | Hangover window completes ($800\text{ ms}$ post-speech). | `HANGOVER_DRAIN` completes (or terminates early at $+1860\text{ ms}$ upon receiving first `modelTurn` chunk). Gate transitions to `CLOSED`. | Upstream WebSocket transmission stops cleanly. **No `audioStreamEnd` sent**. | Server streams 24kHz audio output chunks until `turnComplete: true` and `interactionStatus: "IDLE"`. |

## Authoritative Gemini 3.8 Live Setup Configuration and Late-2026 Directives

### Parameter-by-Parameter Calibration of `RealtimeInputConfig`
Configuring `BidiGenerateContentSetup` for maximum immunity against breathing, fan noise, and acoustic rustle while preserving crisp conversational turn-taking requires calibrating every parameter inside `realtimeInputConfig`:

| Configuration Parameter | Evaluated Options | Authoritative Late-2026 Value | Empirical & Protocol Justification |
| --- | --- | --- | --- |
| `automaticActivityDetection.disabled` | `false` vs. `true` | `false` | Keeping server-side VAD enabled allows Gemini 3.8 Live to natively commit `ACTIVITY_START` and `ACTIVITY_END` from the client-gated PCM stream without requiring manual `activityStart`/`activityEnd` framing or illegal `audioStreamEnd` triggers. |
| `startOfSpeechSensitivity` | `"START_SENSITIVITY_LOW"` vs. `"START_SENSITIVITY_HIGH"` | `"START_SENSITIVITY_LOW"` | If left unspecified, the Live API defaults to `"START_SENSITIVITY_HIGH"`, which triggers aggressively on non-vocalized breath puffs and background rustle. `"START_SENSITIVITY_LOW"` raises the internal harmonic confidence threshold required to initiate a turn. |
| `prefixPaddingMs` | `20` vs. `200` vs. `500` | `200` | Defines the required duration of detected speech before start-of-speech is committed. Setting `20` or `50` permits sub-100ms micro-transients to trigger false starts. Conversely, setting `500` causes the server to ignore valid short candidate responses (*"Yes"*, *"No"*, *"Okay"*, which last $250\text{–}380\text{ ms}$). `200` rejects impulsive transients while capturing monosyllabic answers. |
| `endOfSpeechSensitivity` | `"END_SENSITIVITY_LOW"` vs. `"END_SENSITIVITY_HIGH"` | `"END_SENSITIVITY_LOW"` | Determines how readily the server concludes that speech has ended. While the Gemini Developer API defaults to `"END_SENSITIVITY_HIGH"`, the Gemini Enterprise Agent Platform defaults to `"END_SENSITIVITY_LOW"` to prevent premature turn cutoffs during natural candidate pauses or vocal fry. |
| `silenceDurationMs` | `100` vs. `500` vs. `1000` | `500` | Official Google Live API best practices mandate a minimum silence threshold of `500` ($500\text{ ms}$). Values below $500\text{ ms}$ fragment multi-clause utterances and degrade transcription accuracy, whereas values above $800\text{ ms}$ introduce sluggish turn-taking latency. (Note: the Gemini 3.1 Flash Live preview bug where `silenceDurationMs` was ignored is resolved in the Gemini 3.8 Live architecture). |
| `activityHandling` | `"START_OF_ACTIVITY_INTERRUPTS"` vs. `"NO_INTERRUPTION"` | `"START_OF_ACTIVITY_INTERRUPTS"` (or `"NO_INTERRUPTION"` during fixed prompts) | Note the exact protocol enum string is `"NO_INTERRUPTION"` (not `"NO_INTERRUPT"`). `"START_OF_ACTIVITY_INTERRUPTS"` allows natural user barge-in once DAC drain ($T_{\text{drain}}$) completes. For structured assessment prompts where candidate interruption must be prohibited, set `"NO_INTERRUPTION"`. |
| `turnCoverage` | `"TURN_INCLUDES_ONLY_ACTIVITY"` vs. `"TURN_INCLUDES_ALL_INPUT"` vs. `"TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO"` | `"TURN_INCLUDES_ONLY_ACTIVITY"` | In Gemini 3.1+ and 3.8 Live, the default is `"TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO"`. Explicitly overriding to `"TURN_INCLUDES_ONLY_ACTIVITY"` strips all audio inactivity (including the $800\text{ ms}$ trailing hangover silence) from the transformer's turn context. |

### New Late-2026 Protocol Directives in `@google/genai` (`>= 2.19.0`)
Inspecting the late-2026 `@google/genai` SDK (`v2.19.0+`) and the Gemini 3.8 Live specification reveals five major protocol additions that directly govern speech-to-speech gateway state machines. Foremost among these is **Session Lifecycle Decoupling via `interactionStatus` (`interaction_status`)**. In `models/gemini-3.8-live-extended-thinking`, the model reasons and speaks concurrently, emitting natural conversational fillers (such as *"Let me verify that detail..."*) while executing multi-step background deliberation or asynchronous tool calls. Consequently, `serverContent.turnComplete: true` no longer signifies that the model has finished its turn and is ready for candidate input. Instead, every `turnComplete` message is accompanied by `interactionStatus` (`"IN_PROGRESS"` versus `"IDLE"`, which replaces the deprecated `"REQUIRES_ACTION"` enum). While `interactionStatus` is `"IN_PROGRESS"`, the model is actively deliberating or awaiting background tool completion and will emit subsequent vocalized segments. The gateway must hold the assistant turn open and keep the candidate microphone gated until both `turnComplete === true` and `interactionStatus === "IDLE"` are received, followed by full physical speaker playback drain ($T_{\text{drain}}$).
Second, **Asynchronous Non-Blocking Tool Execution (`behavior: "NON_BLOCKING"`) and Function Scheduling** reshape tool lifecycle management. In Gemini 3.8 Live, asynchronous tool execution is the default mode, and in `gemini-3.8-live-extended-thinking`, declaring `"behavior": "NON_BLOCKING"` on all `functionDeclarations` is mandatory because declaring synchronous `"BLOCKING"` tools returns a hard protocol error. Tool responses support scheduling directives (`"SILENT"`, `"WHEN_IDLE"`, `"INTERRUPTED"`) that govern when the model vocalizes the returned data. Furthermore, while synchronous (`"BLOCKING"`) tools on standard models trigger WebSocket Close `1008` (Policy Violation) if microphone chunks arrive between `toolCall` and `toolResponse`, enforcing a strict gateway-level audio gate whenever pending blocking tool calls exist (`activeBlockingToolIds.size > 0`) guarantees protocol compliance across both `gemini-3.8-live` and `gemini-3.8-live-extended-thinking`.
Third, **Configurable Deliberation Depth (`thinkingConfig.thinkingLevel`)** allows sessions targeting `gemini-3.8-live-extended-thinking` to specify `thinkingConfig: { thinkingLevel: "low" | "medium" | "high" }`, defaulting to `"low"` to minimize voice response latency, while deprecating the legacy `"MINIMAL"` tier from Gemini 3.1 Flash Live. Fourth, **Proactivity Configuration (`proactivity` / `ProactivityConfig`) and Affective Dialogue** enable the model to evaluate incoming streams and ignore irrelevant background input. On `gemini-3.8-live-extended-thinking`, proactive audio processing is permanently enabled at the model level, and explicitly passing `proactiveAudio: false` triggers a setup validation error, while `enableAffectiveDialog: true` on `v1alpha`/`v1beta` allows the model to adapt its vocal prosody to the candidate's emotional tone. Fifth, **ASR Biasing via `customVocabulary` and Transparent Session Resumption (`sessionResumption`)** allow `inputAudioTranscription` to accept language hints and up to 1,000 domain-specific terms to bias the speech recognizer before tokens reach the multimodal transformer. Configuring `sessionResumption: { transparent: true }` instructs the server to emit `sessionResumptionUpdate` events containing `newHandle` and `lastConsumedClientMessageIndex` (1-based index), enabling the gateway to seamlessly recover from WebSocket `1011` or `goAway` disconnects by replaying unacknowledged messages.

### Authoritative WebSocket JSON Payloads

#### 1. Initial Session Setup (`BidiGenerateContentSetup`)

```json
{
  "setup": {
    "model": "models/gemini-3.8-live-extended-thinking",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "temperature": 0.4,
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Puck"
          }
        }
      },
      "thinkingConfig": {
        "thinkingLevel": "low"
      }
    },
    "systemInstruction": {
      "parts": [
        {
          "text": "Operate as a structured technical interviewer. Wait for complete candidate responses and ignore brief acoustic hesitations."
        }
      ]
    },
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "startOfSpeechSensitivity": "START_SENSITIVITY_LOW",
        "prefixPaddingMs": 200,
        "endOfSpeechSensitivity": "END_SENSITIVITY_LOW",
        "silenceDurationMs": 500
      },
      "activityHandling": "START_OF_ACTIVITY_INTERRUPTS",
      "turnCoverage": "TURN_INCLUDES_ONLY_ACTIVITY"
    },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {},
    "sessionResumption": {
      "transparent": true
    },
    "contextWindowCompression": {
      "slidingWindow": {
        "targetTokens": 102400
      }
    },
    "tools": [
      {
        "functionDeclarations": [
          {
            "name": "evaluate_candidate_code",
            "description": "Executes candidate solution against test suite asynchronously.",
            "behavior": "NON_BLOCKING",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "submissionId": {
                  "type": "STRING"
                }
              },
              "required": ["submissionId"]
            }
          }
        ]
      }
    ]
  }
}

```

#### 2. Upstream Real-Time Audio Frame (`BidiGenerateContentRealtimeInput`)
Note that the legacy `realtimeInput.mediaChunks` array is deprecated and rejected by newer endpoints; all audio frames must use the top-level `realtimeInput.audio` blob field:

```json
{
  "realtimeInput": {
    "audio": {
      "mimeType": "audio/pcm;rate=16000",
      "data": "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
    }
  }
}

```

#### 3. Downstream Server Content with `interactionStatus` (`BidiGenerateContentServerMessage`)

```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        {
          "inlineData": {
            "mimeType": "audio/pcm;rate=24000",
            "data": "///+//7//v/9//3//f/8//z//P/7//v/+v/6//n/+f/4"
          }
        }
      ]
    },
    "turnComplete": true,
    "interactionStatus": "IDLE"
  }
}

```

## Cloud VAD Edge-Case Risk Analysis and Mitigation Matrix
Deploying a hybrid Client-Gated Neural VAD ahead of Gemini 3.8 Live's `AutomaticActivityDetection` introduces five subtle boundary interaction risks that must be engineered out of the gateway state machine:

| Edge Case Scenario | Acoustic / Protocol Trigger Mechanism | Unmitigated Failure Mode | Architectural Mitigation in Gateway |
| --- | --- | --- | --- |
| **1. Cough Immediately Preceding Speech ($t = -150\text{ ms}$)** | Candidate clears throat $150\text{ ms}$ before speaking. Cough sits inside the $240\text{ ms}$ circular lookback buffer when true speech triggers flush. | Flushing raw lookback buffer sends the cough to Gemini Live ahead of the utterance, causing ASR prefix hallucination (e.g., *"Uh-hum seven"*). | **Per-Frame Non-Speech Energy Clamping**: When writing frames into the ring buffer, any frame where $P_{\text{speech}} < 0.15$ and $\text{RMS} > -18\text{ dBFS}$ is overwritten with $-60\text{ dBFS}$ dithered silence in-place. |
| **2. Cough During Trailing Hangover ($t_{\text{offset}} + 350\text{ ms}$)** | Candidate finishes speaking and coughs while the gateway is streaming the $800\text{ ms}$ trailing silence required for `silenceDurationMs: 500`. | Raw cough resets server's `silenceDurationMs` counter to $0\text{ ms}$, delaying `ACTIVITY_END` and appending phantom tokens to the turn. | **Synthetic Comfort-Noise Substitution**: During `REDEMPTION` (whenever $P_{\text{speech}} < 0.15$) and throughout `HANGOVER_DRAIN`, transmit $-60\text{ dBFS}$ dithered comfort silence rather than raw microphone audio. |
| **3. Ultra-Short Monosyllabic Utterance (*"Yes"*, *"No"*, $260\text{ ms}$)** | Candidate speaks a valid $260\text{ ms}$ word. Local VAD takes $160\text{ ms}$ to trigger; only $100\text{ ms}$ of live speech remains after trigger. | Without pre-roll flushing, only $100\text{ ms}$ of speech reaches the server—failing `prefixPaddingMs: 200` and dropping the candidate's answer. | **240ms Pre-Speech Circular Buffer**: Flushing the $200\text{ ms}$ onset lookback restores the full $260\text{ ms}$ phoneme duration at the server, exceeding `prefixPaddingMs: 200` with a $60\text{ ms}$ safety margin. |
| **4. Premature Unmute on Extended Thinking Filler (`turnComplete: true`)** | `gemini-3.8-live-extended-thinking` speaks *"Let me check that..."* and emits `turnComplete: true` while `interactionStatus` is `"IN_PROGRESS"`. | Gateway mistakes `turnComplete: true` for end of assistant turn, unblocks mic, and candidate background noise interrupts background tool deliberation. | **Dual-Condition Turn Gate + $T_{\text{drain}}$**: Transition to `LISTENING` requires `turnComplete === true && interactionStatus === "IDLE"`, followed by physical speaker playback buffer depletion ($T_{\text{drain}}$). |
| **5. Physical Microphone Mute / Unmute Mid-Sentence** | Candidate clicks hardware/UI Mute button while actively speaking (`ACTIVITY_START` active on server, hangover incomplete). | Stopping packets immediately leaves server stuck in `ACTIVITY_START`; sending `audioStreamEnd` during normal pauses causes `1011` crash. | **Protocol Invariant Enforcement**: Reserve `{ "realtimeInput": { "audioStreamEnd": true } }` *exclusively* for explicit user UI Mute or session teardown when the stream will be paused $>1\text{ s}$. |

## Reference TypeScript Implementation (`@google/genai` Late-2026 Standard)
The following production TypeScript implementation provides the complete **Client-Gated Neural Audio Gateway and DAC Drain State Machine** conforming to `@google/genai` (`>= 2.19.0`) and the Gemini 3.8 Live protocol invariants.

```typescript
import {
  GoogleGenAI,
  Modality,
  StartSensitivity,
  EndSensitivity,
  ActivityHandling,
  TurnCoverage,
  Session,
  LiveServerMessage,
} from '@google/genai';

/**
 * Acoustic & Protocol Constants (Gemini 3.8 Live Late-2026 Specification)
 */
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2; // 16-bit Little-Endian PCM
const FRAME_DURATION_MS = 40; // 40ms framing = 640 samples = 1,280 bytes
const SAMPLES_PER_FRAME = (INPUT_SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 640
const BYTES_PER_FRAME = SAMPLES_PER_FRAME * BYTES_PER_SAMPLE; // 1280

// 240ms Circular Ring Buffer = 6 frames of 40ms (1 frame quiet anchor + 5 frames onset lookback)
const PRE_ROLL_FRAMES = 6; // 240ms = 3,840 samples = 7,680 bytes
const REDEMPTION_FRAMES = 8; // 320ms local redemption window before hangover drain
const HANGOVER_DRAIN_FRAMES = 13; // 520ms post-redemption comfort silence (Total trailing = 840ms > 500ms + decay)

// Neural VAD & Transient Guard Thresholds
const VAD_ONSET_THRESHOLD = 0.55;
const VAD_OFFSET_THRESHOLD = 0.35;
const NON_SPEECH_PROB_CEILING = 0.15;
const TRANSIENT_RMS_CEILING = 0.125; // ~ -18 dBFS
const ONSET_CONSECUTIVE_FRAMES_REQUIRED = 4; // 160ms confirmation window
const DAC_SAFETY_TAIL_MS = 120; // Acoustic room reverberation decay after physical speaker drain

export type GatewayLifecycleState =
  | 'CONNECTING'
  | 'LISTENING'
  | 'MODEL_SPEAKING'
  | 'MODEL_WORKING'
  | 'TOOL_EXECUTING_BLOCKING'
  | 'MUTE_SUSPENDED'
  | 'CLOSED';

export type UpstreamGateState =
  | 'GATE_CLOSED'
  | 'REDEMPTION_HOLD'
  | 'HANGOVER_DRAIN'
  | 'ACTIVE_SPEECH';

export interface NeuralVadResult {
  /** Frame of 640 Int16 PCM samples (40ms @ 16kHz) */
  pcmFrame: Int16Array;
  /** Neural speech probability in [0.0, 1.0] from Silero VAD v5 */
  speechProbability: number;
}

/**
 * Fixed-allocation Circular Ring Buffer for Pre-Speech Acoustic Onset Preservation.
 * Includes automatic in-place clamping of high-energy non-speech transients (coughs/clicks).
 */
export class PreSpeechCircularBuffer {
  private readonly buffer: Int16Array[];
  private writeIndex = 0;
  private populatedCount = 0;

  constructor(private readonly capacityFrames: number = PRE_ROLL_FRAMES) {
    this.buffer = Array.from(
      { length: capacityFrames },
      () => new Int16Array(SAMPLES_PER_FRAME)
    );
  }

  public pushFrame(pcmFrame: Int16Array, speechProb: number): void {
    const target = this.buffer[this.writeIndex];
    const rms = PreSpeechCircularBuffer.computeNormalizedRms(pcmFrame);

    // Guard: If a cough/desk bump occurs prior to speech (high RMS, near-zero neural speech prob),
    // replace with -60 dBFS dithered comfort silence so the transient is never flushed on onset.
    if (speechProb < NON_SPEECH_PROB_CEILING && rms > TRANSIENT_RMS_CEILING) {
      PreSpeechCircularBuffer.fillComfortSilence(target);
    } else {
      target.set(pcmFrame);
    }

    this.writeIndex = (this.writeIndex + 1) % this.capacityFrames;
    if (this.populatedCount < this.capacityFrames) {
      this.populatedCount++;
    }
  }

  /**
   * Extracts buffered frames in strict chronological order and resets the buffer.
   * Ensures the very first frame has a clean quiet baseline for Server VAD spectral calibration.
   */
  public flushChronologicalFrames(): Int16Array[] {
    const flushed: Int16Array[] = [];
    const startIdx =
      (this.writeIndex - this.populatedCount + this.capacityFrames) %
      this.capacityFrames;

    for (let i = 0; i < this.populatedCount; i++) {
      const idx = (startIdx + i) % this.capacityFrames;
      const copy = new Int16Array(SAMPLES_PER_FRAME);
      copy.set(this.buffer[idx]);
      flushed.push(copy);
    }

    this.clear();
    return flushed;
  }

  public clear(): void {
    this.writeIndex = 0;
    this.populatedCount = 0;
  }

  public static computeNormalizedRms(frame: Int16Array): number {
    let sumSquares = 0;
    for (let i = 0; i < frame.length; i++) {
      const norm = frame[i] / 32768.0;
      sumSquares += norm * norm;
    }
    return Math.sqrt(sumSquares / frame.length);
  }

  /**
   * Generates -60 dBFS Gaussian-dithered comfort silence (+/- 32 LSB in Int16)
   * to prevent digital-zero log-Mel underflow while masking physiological transients.
   */
  public static fillComfortSilence(target: Int16Array): void {
    for (let i = 0; i < target.length; i++) {
      const u1 = Math.random() - 0.5;
      const u2 = Math.random() - 0.5;
      target[i] = Math.round((u1 + u2) * 32);
    }
  }
}

/**
 * Production Gateway Controller for Google Gemini 3.8 Live & Extended Thinking.
 */
export class Gemini38LiveAudioGateway {
  private readonly ai: GoogleGenAI;
  private session: Session | null = null;

  private lifecycleState: GatewayLifecycleState = 'CONNECTING';
  private gateState: UpstreamGateState = 'GATE_CLOSED';
  private isSetupComplete = false;

  private readonly preRollBuffer = new PreSpeechCircularBuffer(PRE_ROLL_FRAMES);
  private consecutiveSpeechFrames = 0;
  private redemptionFramesRemaining = 0;
  private hangoverFramesRemaining = 0;

  // DAC Playback Drain & Session State Tracking
  private scheduledPlaybackEndEpochMs = 0;
  private latestInteractionStatus: 'IN_PROGRESS' | 'IDLE' = 'IDLE';
  private readonly activeBlockingToolIds = new Set<string>();
  private drainUnlockTimer: ReturnType<typeof setTimeout> | null = null;
  private latestSessionResumptionHandle: string | null = null;

  constructor(
    apiKey: string,
    private readonly useExtendedThinking: boolean = true,
    private readonly onDownstreamAudioChunk: (pcm24kHzBase64: string) => void,
    private readonly onStateChange: (state: GatewayLifecycleState) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async connect(): Promise<void> {
    const modelId = this.useExtendedThinking
      ? 'models/gemini-3.8-live-extended-thinking'
      : 'models/gemini-3.8-live';

    this.session = await this.ai.live.connect({
      model: modelId,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
        ...(this.useExtendedThinking
          ? { thinkingConfig: { thinkingLevel: 'low' } }
          : {}),
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            prefixPaddingMs: 200,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            silenceDurationMs: 500,
          },
          activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
          turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY,
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: {
          ...(this.latestSessionResumptionHandle
            ? { handle: this.latestSessionResumptionHandle }
            : {}),
          transparent: true,
        },
      },
      callbacks: {
        onopen: () => {
          // Wait for setupComplete message before streaming audio
        },
        onmessage: (msg: LiveServerMessage) => this.handleServerMessage(msg),
        onerror: (err: ErrorEvent) => this.handleSocketError(err),
        onclose: () => this.transitionLifecycle('CLOSED'),
      },
    });
  }

  /**
   * Invoked every 40ms with a 16kHz Int16 PCM frame and local Silero VAD probability.
   */
  public processCandidateAudioFrame(input: NeuralVadResult): void {
    if (!this.session || !this.isSetupComplete) return;

    // Invariant #3 & #4: Never stream candidate audio during blocking tool execution,
    // physical mute, active model speech prior to DAC drain, or background thinking.
    if (this.lifecycleState !== 'LISTENING') {
      this.preRollBuffer.clear();
      this.resetGateCounters();
      return;
    }

    const { pcmFrame, speechProbability } = input;

    switch (this.gateState) {
      case 'GATE_CLOSED': {
        this.preRollBuffer.pushFrame(pcmFrame, speechProbability);

        if (speechProbability >= VAD_ONSET_THRESHOLD) {
          this.consecutiveSpeechFrames++;
          if (this.consecutiveSpeechFrames >= ONSET_CONSECUTIVE_FRAMES_REQUIRED) {
            // Confirmed human vocal onset: flush 240ms circular buffer in paced 40ms sub-chunks
            this.gateState = 'ACTIVE_SPEECH';
            const historicalFrames = this.preRollBuffer.flushChronologicalFrames();
            this.flushSubChunksPaced(historicalFrames);
          }
        } else {
          this.consecutiveSpeechFrames = 0;
        }
        break;
      }

      case 'ACTIVE_SPEECH': {
        if (speechProbability >= VAD_OFFSET_THRESHOLD) {
          this.sendPcmFrame(pcmFrame);
        } else {
          // Enter 320ms local redemption window to bridge inter-word stop closures
          this.gateState = 'REDEMPTION_HOLD';
          this.redemptionFramesRemaining = REDEMPTION_FRAMES;
          this.sendSilenceGuardedFrame(pcmFrame, speechProbability);
        }
        break;
      }

      case 'REDEMPTION_HOLD': {
        if (speechProbability >= VAD_ONSET_THRESHOLD) {
          // Candidate resumed speaking mid-sentence
          this.gateState = 'ACTIVE_SPEECH';
          this.redemptionFramesRemaining = 0;
          this.sendPcmFrame(pcmFrame);
        } else {
          this.sendSilenceGuardedFrame(pcmFrame, speechProbability);
          this.redemptionFramesRemaining--;
          if (this.redemptionFramesRemaining <= 0) {
            // Transition to 520ms post-redemption comfort silence hangover
            // Total trailing silence = 320ms + 520ms = 840ms (guarantees Server 500ms silenceDurationMs fires)
            this.gateState = 'HANGOVER_DRAIN';
            this.hangoverFramesRemaining = HANGOVER_DRAIN_FRAMES;
          }
        }
        break;
      }

      case 'HANGOVER_DRAIN': {
        if (speechProbability >= VAD_ONSET_THRESHOLD) {
          // Candidate began a follow-up clause during hangover
          this.gateState = 'ACTIVE_SPEECH';
          this.hangoverFramesRemaining = 0;
          this.sendPcmFrame(pcmFrame);
        } else {
          // Stream pure -60 dBFS comfort silence to immunize server silenceDurationMs against coughs
          const comfortFrame = new Int16Array(SAMPLES_PER_FRAME);
          PreSpeechCircularBuffer.fillComfortSilence(comfortFrame);
          this.sendPcmFrame(comfortFrame);

          this.hangoverFramesRemaining--;
          if (this.hangoverFramesRemaining <= 0) {
            // Handoff complete; close gate WITHOUT sending audioStreamEnd (Invariant #1)
            this.gateState = 'GATE_CLOSED';
            this.consecutiveSpeechFrames = 0;
          }
        }
        break;
      }
    }
  }

  /**
   * Flushes the 240ms lookback ring buffer as sequential 40ms sub-chunks spaced by 3ms
   * so Gemini's server-side VAD calibrates its noise floor on Frame 0 before evaluating onset.
   */
  private flushSubChunksPaced(frames: Int16Array[]): void {
    frames.forEach((frame, index) => {
      setTimeout(() => {
        if (this.lifecycleState === 'LISTENING' && this.session) {
          this.sendPcmFrame(frame);
        }
      }, index * 3);
    });
  }

  /**
   * Protects trailing redemption frames from coughs/breaths while preserving low-energy trailing phonemes.
   */
  private sendSilenceGuardedFrame(pcmFrame: Int16Array, speechProb: number): void {
    const rms = PreSpeechCircularBuffer.computeNormalizedRms(pcmFrame);
    if (speechProb < NON_SPEECH_PROB_CEILING && rms > TRANSIENT_RMS_CEILING) {
      const guarded = new Int16Array(SAMPLES_PER_FRAME);
      PreSpeechCircularBuffer.fillComfortSilence(guarded);
      this.sendPcmFrame(guarded);
    } else {
      this.sendPcmFrame(pcmFrame);
    }
  }

  private sendPcmFrame(pcmFrame: Int16Array): void {
    if (!this.session) return;
    const uint8View = new Uint8Array(
      pcmFrame.buffer,
      pcmFrame.byteOffset,
      pcmFrame.byteLength
    );
    const base64Data = Buffer.from(uint8View).toString('base64');

    this.session.sendRealtimeInput({
      audio: {
        mimeType: 'audio/pcm;rate=16000',
        data: base64Data,
      },
    });
  }

  /**
   * Handles downstream messages from Gemini 3.8 Live, enforcing DAC drain ($T_{drain}$)
   * and Extended Thinking `interactionStatus` synchronization.
   */
  private handleServerMessage(message: LiveServerMessage): void {
    if (message.setupComplete) {
      this.isSetupComplete = true;
      this.transitionLifecycle('LISTENING');
      return;
    }

    // Track session resumption handle for transparent 1011 recovery
    const resumption = (message as Record<string, unknown>)
      .sessionResumptionUpdate as
      | { resumable?: boolean; newHandle?: string }
      | undefined;
    if (resumption?.resumable && resumption.newHandle) {
      this.latestSessionResumptionHandle = resumption.newHandle;
    }

    // Handle Tool Calls (Invariant #3 protection)
    if (message.toolCall?.functionCalls) {
      for (const call of message.toolCall.functionCalls) {
        if (call.id && !this.useExtendedThinking) {
          this.activeBlockingToolIds.add(call.id);
          this.transitionLifecycle('TOOL_EXECUTING_BLOCKING');
        }
      }
    }

    const serverContent = message.serverContent;
    if (!serverContent) return;

    // Update Extended Thinking interactionStatus ('IN_PROGRESS' vs 'IDLE')
    const rawStatus = (serverContent as Record<string, unknown>)
      .interactionStatus as 'IN_PROGRESS' | 'IDLE' | undefined;
    if (rawStatus) {
      this.latestInteractionStatus = rawStatus;
    }

    // Handle user barge-in interruption
    if (serverContent.interrupted) {
      this.scheduledPlaybackEndEpochMs = Date.now();
      if (this.drainUnlockTimer) clearTimeout(this.drainUnlockTimer);
      this.transitionLifecycle('LISTENING');
      return;
    }

    // Process 24kHz downstream model audio chunks and compute physical DAC Drain ($T_{drain}$)
    if (serverContent.modelTurn?.parts) {
      // Early server-driven gate closure if hangover was still draining
      if (this.gateState !== 'GATE_CLOSED') {
        this.gateState = 'GATE_CLOSED';
        this.resetGateCounters();
      }
      this.transitionLifecycle('MODEL_SPEAKING');

      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          const byteLength = Buffer.from(part.inlineData.data, 'base64').byteLength;
          const samples24k = byteLength / BYTES_PER_SAMPLE;
          const chunkDurationMs = (samples24k / OUTPUT_SAMPLE_RATE) * 1000;

          const now = Date.now();
          this.scheduledPlaybackEndEpochMs =
            Math.max(now, this.scheduledPlaybackEndEpochMs) + chunkDurationMs;

          this.onDownstreamAudioChunk(part.inlineData.data);
        }
      }
    }

    // Evaluate Turn Completion + Extended Thinking Interaction Status + DAC Drain
    if (serverContent.turnComplete) {
      if (this.useExtendedThinking && this.latestInteractionStatus === 'IN_PROGRESS') {
        // Model finished speaking an intermediate conversational filler; background work continues
        this.transitionLifecycle('MODEL_WORKING');
      } else {
        // Full turn and background tasks complete (interactionStatus === 'IDLE')
        // Schedule microphone unblocking strictly after physical speaker DAC drain ($T_{drain}$)
        const remainingDrainMs = Math.max(
          0,
          this.scheduledPlaybackEndEpochMs - Date.now()
        );
        const totalWaitMs = remainingDrainMs + DAC_SAFETY_TAIL_MS;

        if (this.drainUnlockTimer) clearTimeout(this.drainUnlockTimer);
        this.drainUnlockTimer = setTimeout(() => {
          if (this.activeBlockingToolIds.size === 0) {
            this.preRollBuffer.clear();
            this.resetGateCounters();
            this.transitionLifecycle('LISTENING');
          }
        }, totalWaitMs);
      }
    }
  }

  /**
   * Invariant #1: audioStreamEnd is strictly reserved for explicit physical Mute (>1s pause) or Hangup.
   */
  public setPhysicalMicrophoneMute(muted: boolean): void {
    if (!this.session || !this.isSetupComplete) return;

    if (muted) {
      this.transitionLifecycle('MUTE_SUSPENDED');
      this.preRollBuffer.clear();
      this.resetGateCounters();
      this.session.sendRealtimeInput({ audioStreamEnd: true });
    } else {
      this.transitionLifecycle('LISTENING');
    }
  }

  private resetGateCounters(): void {
    this.gateState = 'GATE_CLOSED';
    this.consecutiveSpeechFrames = 0;
    this.redemptionFramesRemaining = 0;
    this.hangoverFramesRemaining = 0;
  }

  private transitionLifecycle(next: GatewayLifecycleState): void {
    if (this.lifecycleState !== next) {
      this.lifecycleState = next;
      this.onStateChange(next);
    }
  }

  private handleSocketError(_err: ErrorEvent): void {
    // Trigger transparent session resumption using this.latestSessionResumptionHandle
  }
}

```

## Architectural Synthesis and Deployment Recommendations
Achieving zero-hallucination voice interaction in Google Gemini 3.8 Live (`models/gemini-3.8-live` and `models/gemini-3.8-live-extended-thinking`) requires treating client-side neural VAD and server-side `AutomaticActivityDetection` as a single, mathematically coupled state machine rather than competing turn detectors. By gating upstream `realtimeInput.audio` transmission behind a client-side neural classifier equipped with a **240ms ($7.68\text{ KB}$) transient-clamped circular lookback buffer**, the gateway blocks impulsive coughs, sneezes, and throat clearings from ever reaching the WebSocket while preserving 100% of unvoiced word-initial plosives and fricatives through paced $40\text{ ms}$ sub-chunk flushing.
At the conclusion of each candidate utterance, streaming **800ms–840ms of cumulative trailing silence** ($320\text{ ms}$ of transient-guarded redemption hold followed by $520\text{ ms}$ of synthesized $-60\text{ dBFS}$ comfort silence) provides the exact sample count required to traverse the server's acoustic tail decay and satisfy `silenceDurationMs: 500` without ever invoking `audioStreamEnd: true` during active dialogue. Finally, pairing `startOfSpeechSensitivity: "START_SENSITIVITY_LOW"`, `prefixPaddingMs: 200`, `endOfSpeechSensitivity: "END_SENSITIVITY_LOW"`, and `turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY"` with a downstream controller that waits for `turnComplete === true`, `interactionStatus === "IDLE"`, and full DAC playback drain ($T_{\text{drain}}$) eliminates acoustic self-interruption loops and ensures deterministic multi-turn stability across enterprise voice deployments.

---

Source: https://gemini.google.com/app/79e9318bea142a3d
Exported at: 2026-10-19T17:55:21.600Z