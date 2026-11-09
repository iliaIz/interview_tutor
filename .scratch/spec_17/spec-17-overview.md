# SPEC-17 Overview: Live Voice Acoustic Echo Immunity, Master Gain Safety & Strict Vocoder Temperature

## Problem Statement
During live Gemini Live voice sessions (e.g. Raiffeisen Fit Interview in Company Prep Studio Stage 1):
1. The AI voice becomes completely silent or heavily muffled mid-speech.
2. Knocking on the microphone or making a loud noise abruptly causes the AI speech to become loud and clear again, continuing from whatever timestamp the model was speaking at.
3. Root Cause 1: `LiveMicChunkDispatcher.ts` runs a speculative ducking check on `rmsDb > -38`. Physical speaker audio picked up by the microphone exceeds -38 dBFS, triggering `speculativeDuck(0.35)` and after 7 frames (224ms) triggering false acoustic barge-in.
4. Root Cause 2: `AudioPlayoutManager.handleInterruption()` ramps `masterGain.gain` to `0.0` over 5ms and never restores it to nominal level (1.5). AudioWorklet continues rendering samples through a 0.0 gain node.
5. Root Cause 3: Striking the microphone creates an impulsive transient spike (`isTransientSpike = true`), which invokes `rollbackDucking(15)` and ramps `masterGain.gain` back to 1.5, causing a sudden burst of sound.
6. Root Cause 4: Vocoder stability requires strictly `temperature: 1.0` in Gemini Live generationConfig to prevent latent acoustic space collapse into digital silence loops.

## Scope of Remediation
- **Ticket 1 [Prefactor]:** Non-Zero Master Playout Gain Safety in `AudioPlayoutManager.ts` (pop-free de-ramping strictly inside AudioWorklet; `masterGain` preserved at 1.5).
- **Ticket 2 [Tracer-Bullet]:** Speculative Ducking Demolition in `liveMicChunkDispatcher.ts` and `AudioDuckingController.ts`.
- **Ticket 3 [Tracer-Bullet]:** Acoustic Echo Immunity & Energy Floor Calibration ($-29$ dBFS / $RMS \ge 0.035$, $\ge 180$ms sustained phonation matching `gemini_live_reference`).
- **Ticket 4 [Tracer-Bullet]:** Strict Vocoder Temperature Calibration ($T = 1.0$) across backend `liveGeminiConfigBuilder.ts`, `liveVoiceUrlBuilder.ts`, and frontend modal launchers.
- **Ticket 5 [Contract]:** Headless Contract Test Suite & End-to-End Verification (`audioPlayoutContracts.test.ts`, `liveVoiceEngine.test.ts`).
