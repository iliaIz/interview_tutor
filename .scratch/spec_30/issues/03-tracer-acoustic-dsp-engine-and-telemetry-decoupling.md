# 03: [Tracer-Bullet] Acoustic Telemetry DSP Decoupling & Facade Seam

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Decompose the 563-line `AcousticTelemetryService.ts` into deep domain engines and a lean facade:
1. `frontend/src/services/audio/AcousticDspEngine.ts` ($\le 250$ lines): Pure Float32 PCM signal math (RMS, noise floor, SNR, 30-pt energy sparkline normalization, gross/net WPM, pause ratio).
2. `frontend/src/services/audio/SpeechClarityAnalyzer.ts` ($\le 150$ lines): Disfluency/filler-words dictionary regexes, penalty density, and clarity score.
3. `frontend/src/services/audio/QuestionFrameworkClassifier.ts` ($\le 150$ lines): Pedagogical taxonomy mapping question text to STAR, PREP, and Rule-of-3 frameworks.
4. `frontend/src/services/AcousticTelemetryService.ts` ($\le 180$ lines): Lean backward-compatible facade delegating to the engines and generating humanized profiles.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/services/audio/AcousticDspEngine.ts` and `AcousticTelemetryService.ts`.
- **Dependencies**: Pure in-process Float32Array PCM samples.
- **Verification Command**: `remote-verify` passes all acoustic fixture tests and frontend production build.

## Embedded Contract Slice & Invariants
- 100% Backward Compatibility: All public static methods (`computeMetrics`, `getHumanizedProfile`, `classifyQuestionStructure`, `analyzeSpeechClarity`) maintain exact signatures and return types.
- Rule 8 Compliance: All files strictly $\le 350$ lines.

## Explicit Non-Goals
- Do NOT change `AcousticMetrics` or `HumanizedAcousticProfile` interface shapes consumed by UI modals.
