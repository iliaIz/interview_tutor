# 03: [Tracer-Bullet] Strict Autoregressive Vocoder Temperature (1.0) Across All Layers

**Archetype:** Tracer-Bullet  
**Blocked by:** #01, #02  
**Status:** ready-for-agent  

## What to Build
Enforce strict temperature calibration ($T = 1.0$) for Gemini Live audio vocoder autoregressive synthesis across all layers:
1. `backend/src/services/live/liveGeminiConfigBuilder.ts`: Enforce `effectiveTemperature = 1.0` (guarding against any values $<0.7$ that collapse latent acoustic space into digital silence).
2. `frontend/src/audio/liveVoiceUrlBuilder.ts`: Explicitly serialize `params.set('temperature', String(cfg.temperature ?? 1.0))`.
3. `frontend/src/components/VoiceModal.tsx` & `CompanyPrepStudio.tsx`: Explicitly set `temperature: 1.0` in session launch configurations.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `backend/src/services/live/liveGeminiConfigBuilder.ts`, `frontend/src/audio/liveVoiceUrlBuilder.ts`
- **Verification Command:** `node --loader ts-node/esm backend/src/scripts/testGeminiConfigBuilder.ts` (and remote CI `remote-verify`)

## Embedded Contract Slice & Invariants
```typescript
const effectiveTemperature = typeof opts.temperature === 'number' && opts.temperature >= 0.7
  ? opts.temperature
  : 1.0;
```
- **Invariant:** Autoregressive audio synthesis generationConfig MUST strictly pass `temperature: 1.0`.

## Explicit Non-Goals
- Do not alter temperatures for non-live textual reasoning tasks (e.g. `geminiText.ts`, `codeEvaluator.ts`).

## Acceptance Criteria
- [ ] Backend config builder guarantees `generationConfig.temperature === 1.0`.
- [ ] Frontend URL builder serializes `temperature=1.0`.
- [ ] All voice session modal launchers explicitly pass `temperature: 1.0`.
