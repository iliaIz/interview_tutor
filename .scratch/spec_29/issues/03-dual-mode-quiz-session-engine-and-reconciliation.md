# 03: [Tracer-Bullet] Dual-Mode Quiz Session Engine & Results Reconciliation

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Unify split-brain text and Gemini Live voice evaluation in `ExamQuiz.tsx`:
1. Create `QuizSessionEngine` encapsulating evaluation record synthesis, progress synchronization, and scorecard generation.
2. Extract `useQuizSession` hook managing quiz state machine, timer, answers, and modal toggles.
3. Decompose `ExamQuiz.tsx` (773 lines -> <= 140 lines) into:
   - `QuizQuestionArena.tsx` (active test)
   - `QuizScorecardView.tsx` (post-quiz breakdown & retry)

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/services/quiz/QuizSessionEngine.ts` and `frontend/src/components/ExamQuiz.tsx`.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Both text and voice evaluations must update identical progress and result history.
- Rule 8: All files <= 350 lines.

## Explicit Non-Goals
- Do not alter VoiceModal or AudioPlayoutManager contracts.
