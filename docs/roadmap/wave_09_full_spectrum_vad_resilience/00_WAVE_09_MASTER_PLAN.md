# Wave 09: Full-Spectrum Acoustic Auto-VAD Resilience & Browser E2E Audio Harness (FAVR-BEAH)

> Living Specification & Single Source of Truth (SSOT)  
> Architectural Standard: SOTA September 2026

---

## 1. Executive Summary & Problem Formulation

In Wave 08, we introduced the Acoustic Simulation & Real-Time Matrix Test Harness (ASSTH) and the Pre-Flight Canary Deployment Gate on the production VPS. While this eliminated synthetic-only blind spots and caught fundamental socket lifecycle issues (e.g. Node.js event loop hanging on unclosed handles, unauthenticated WebSocket connections), real-world multi-turn conversational interviews and browser-side audio capture revealed 4 critical resilience gaps:

1. **Multi-Turn Context & Latency Accumulation:** Single-turn tests cannot detect state leakage, context window degradation, or latency spikes ($TTFA > 4000\text{ms}$) across sequential dialogue turns (Turn 1 $\to$ Turn 2 $\to$ Turn 3).
2. **Acoustic Edge Conditions & False Triggers:** Candidates in real voice interviews exhibit vocalized hesitations ("э-э-э", "м-м-м"), background mechanical keyboard typing during live coding, and heavy exhalations/breaths. Standard VAD without stress testing risks mid-sentence truncation or spurious triggers.
3. **Single-Engine Canary Gaps:** Running only `gemini-live-v3` in the pre-flight gate leaves `gemini-live-thinking-v3` unverified for Extended Thinking Chain-of-Thought (CoT) leakage and tool declaration boundaries.
4. **Client-Side Web Audio Blind Spots:** Server-side simulation tests do not verify client-side `AudioWorklet` loading, 48kHz $\to$ 16kHz resampling math, or browser fake media stream capture.

Wave 09 bridges all four gaps with zero tech debt and strict architectural invariants.

---

## 2. Architectural Components & Invariants

```
+-----------------------------------------------------------------------------------------+
|                                    CI / CD PIPELINE                                     |
|                                                                                         |
|  [quality-gate]                                                                         |
|    |-- npm run test:prompts       (35+ automated prompt & anti-sycophancy assertions)   |
|    |-- npm run test:vad:unit      (Fixtures, WAV parser, 24k->16k resampler)            |
|    |-- npm run test:vad:pacer     (Real-time audio streamer, 40ms pacing, drift <=80ms) |
|    |-- npm run build              (Backend & Shared TypeScript compile)                 |
|                                                                                         |
|  [build-caddy & build-backend]                                                          |
|    |-- Native bare-metal frontend build + multi-arch Docker image push to GHCR          |
|                                                                                         |
|  [deploy-vps]                                                                           |
|    |-- Step 4/5: Pre-Flight Canary Container on VPS                                     |
|    |     |-- Mount /home/djelu/spring/data/audio_fixtures:/app/tests/fixtures/audio     |
|    |     \-- node dist/scripts/runAcousticVadMatrix.js --suite=canary                   |
|    |           |-- [Canary 1/2] Multi-Turn Turn-Taking with SLA (gemini-live-v3)         |
|    |           \-- [Canary 2/2] Extended Thinking CoT Shield (gemini-live-thinking-v3)  |
|    |                                                                                    |
|    \-- Step 5/5: Zero-Downtime Production Rolling Swap (Caddy / Backend / Sandbox)       |
+-----------------------------------------------------------------------------------------+
```

### 2.1. Multi-Turn Dialogue Scenario (`vadMultiTurnDialogue.scenario.ts`)
- **Execution Flow:** Connects a single continuous live WebSocket session and sequences 3 full dialogue turns:
  - Turn 1: Basic concept explanation (`candidate_normal_answer_java`).
  - Turn 2: Architectural deep dive (`candidate_complex_architecture`).
  - Turn 3: Edge-case clarification (`candidate_hesitation_part1`).
- **Strict Latency SLA:** Asserts that for every turn, $TTFA \le 6000\text{ms}$ (non-thinking) or $\le 8000\text{ms}$ (thinking).
- **Context Preservation:** Verifies that the AI interviewer maintains topic continuity without repeating previous probes or truncating candidate audio.

### 2.2. Acoustic Stress & Noise Suite (`vadAcousticStress.scenario.ts`)
- **Vocalized Hesitation Test:** Streams speech containing natural fillers ("Мы... э-э-э... используем ConcurrentHashMap... м-м-м..."). Verifies the VAD does not interrupt mid-sentence during vocalized pauses.
- **Keyboard Typing Immunity:** Synthesizes randomized mechanical keyboard click transients (4 clicks/sec, 20ms exponential decay) and mixes them into the speech buffer. Asserts clear speech turn completion under typing noise.
- **Breath / Exhale Burst Rejection:** Generates 400ms low-pass filtered noise with a raised cosine bell envelope. Verifies that non-speech exhalations do NOT trigger spurious AI response turns.

### 2.3. SOTA Dual-Engine Canary Gate (`deploy.yml`)
- Executes in isolated container `interview-backend-canary` on the VPS before any production service is updated.
- Runs `--suite=canary`, which executes:
  1. `gemini-live-v3`: Multi-Turn Turn-Taking with Latency SLA.
  2. `gemini-live-thinking-v3`: Extended Thinking CoT Shield & Zero-Leakage audit.
- Persistent fixture mount (`-v /home/djelu/spring/data/audio_fixtures:/app/tests/fixtures/audio`) guarantees cached PCM reads (0ms synthesis time).

### 2.4. Playwright Headless Browser Audio E2E Harness (`voiceSession.spec.ts`)
- Runs Chromium in headless mode with specialized Web Audio flags:
  - `--use-fake-ui-for-media-stream`
  - `--use-fake-device-for-media-stream`
  - `--autoplay-policy=no-user-gesture-required`
  - `--allow-file-access`
- **Verified Invariants:**
  1. `navigator.mediaDevices.getUserMedia` activates simulated hardware audio tracks.
  2. `AudioCaptureWorklet` successfully loads `/worklets/audio-capture-processor.js` and instantiates the audio node.
  3. `GeminiPlayoutWorklet` successfully loads `/worklets/gemini-audio-processor.js` for 24kHz Hermite interpolation playout.
  4. Real-time capture loop receives host microphone stream and produces 16kHz PCM frames via AudioWorklet port.

---

## 3. Verification & Compliance Matrix

| Target Layer | Test Script / Suite | Engine / Environment | Status | SLA / Assertion |
| :--- | :--- | :--- | :--- | :--- |
| **Prompts & Security** | `npm run test:prompts` | Node.js Runtime | Passed (35+) | Anti-sycophancy, XML sandboxing, CoT shield |
| **Fixtures & Resampling**| `npm run test:vad:unit` | Node.js Runtime | Passed (10/10) | 24kHz $\to$ 16kHz resampler, fixture catalog |
| **Audio Pacing** | `npm run test:vad:pacer`| Node.js Runtime | Passed (6/6) | 40ms real-time chunk pacing, drift $\le 80\text{ms}$ |
| **Browser Web Audio** | `npm run test:e2e:voice`| Headless Chromium | Passed (4/4) | Worklets, fake media stream, 16kHz frames |
| **VPS Pre-Flight Canary**| `--suite=canary` | Docker on VPS | Gate Active | Multi-Turn SLA + Thinking CoT Shield |

---

## 4. Production Artifacts & Directory Layout

- `backend/src/testing/acoustic/scenarios/vadMultiTurnDialogue.scenario.ts`: 3-turn dialogue scenario.
- `backend/src/testing/acoustic/scenarios/vadAcousticStress.scenario.ts`: Hesitation, typing, and breath tests.
- `backend/src/testing/acoustic/silenceGenerator.ts`: Noise generation utilities.
- `backend/src/testing/acoustic/acousticFixtureManager.ts`: Golden acoustic fixtures catalog.
- `backend/src/scripts/runAcousticVadMatrix.ts`: Matrix CLI supporting `--suite=canary`.
- `frontend/playwright.config.ts`: Playwright configuration with Chromium Web Audio flags.
- `frontend/e2e/voiceSession.spec.ts`: Headless browser Web Audio test suite.
- `.github/workflows/deploy.yml`: Pre-Flight Canary Dual-Engine Gate.
