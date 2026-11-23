## Parent
Part of #128

## Archetype
Tracer-Bullet

## Pre-Agreed Verification Seam
- **Primary Seam**: `frontend/src/components/practice/tutor/PracticeVoiceContext.tsx`.
- **Verification Command**: `remote-verify`

## What to Build
Align default `vadPauseMs` in `PracticeVoiceContext.tsx` to `800` ms (matching `CompanyPrepStudio.tsx` and `gemini_live_reference`), removing the 1800ms dead-air interval.

## Embedded Contract Slice & Invariants
```typescript
vadPauseMs: interviewConfig.vadPauseMs ?? 800,
```

## Explicit Non-Goals
- Do not modify audio worklet capture settings.
- Do not remove user custom config overrides if explicitly configured.

## Acceptance Criteria
- [ ] `PracticeVoiceContext` starts session with `vadPauseMs: 800` by default.
- [ ] Cloud VAD and client fast-handoff operate synchronously in the [500, 1000]ms range.
