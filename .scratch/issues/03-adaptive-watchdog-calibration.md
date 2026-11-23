## Parent
Part of #128

## Archetype
Tracer-Bullet

## Pre-Agreed Verification Seam
- **Primary Seam**: `backend/src/services/live/liveWsTurnCommitHandler.ts`.
- **Verification Command**: `remote-verify`

## What to Build
Calibrate two-phase watchdog in `liveWsTurnCommitHandler.ts` so that `practice_pair` / tool-heavy tutor sessions use the extended thinking/heavy-tool SLA: Phase 1 nudge at 8.0s, Phase 2 dead-air recovery at 25.0s, preventing premature generation cut-offs when Google vocoder KV-cache inference takes >17s.

## Embedded Contract Slice & Invariants
```typescript
const isExtendedThinkingOrToolHeavy = Boolean(
  (session.liveModel && session.liveModel.includes('thinking')) ||
  session.tutorMode === 'practice_pair' ||
  session.sessionType === 'tutor'
);
```

## Explicit Non-Goals
- Do not disable the watchdog completely.
- Do not alter the 5s/22s timeout for standard rapid mock interview Q&A.

## Acceptance Criteria
- [ ] In `practice_pair` sessions, watchdog Phase 2 timeout is 25000ms.
- [ ] TTFA durations between 17s and 24s do not trigger premature dead-air turn resets.
