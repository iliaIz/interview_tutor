# Issue 01: [Prefactor] Extract Headless Voice Modal Lifecycle & Stage Coordinator

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Extract `useVoiceModalCoordinator.ts` from `frontend/src/components/VoiceModal.tsx`.
The hook encapsulates:
1. 4-stage lifecycle state machine (`lobby` -> `active` -> `verdict` -> `grand_finale`), initializing to `active` when `initialSessionType === 'tutor'`.
2. Batch navigation, checkpointing `batchResults`, resolving `effectiveQuestionText` and `effectiveReferenceAnswer`.
3. Auto-start guards and delay timers.
4. Custom DOM event bridge (`workspace_file_updated`).
5. Handlers: `handleSelectQuestion`, `handleEvaluationComplete`, `handleRetry`, `handleNextQuestion`, `handleFinishSession`, `handleLobbyStart`.

`VoiceModal.tsx` becomes a declarative component $\le 160$ lines composing subcomponents and drawers.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/components/voice/useVoiceModalCoordinator.ts` & `frontend/src/components/VoiceModal.tsx`.
- **Dependencies**: Pure React state, zero DOM mock libraries.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
export interface VoiceModalCoordinatorState {
  stage: 'lobby' | 'active' | 'verdict' | 'grand_finale';
  setStage: (stage: 'lobby' | 'active' | 'verdict' | 'grand_finale') => void;
  activeBatchIndex: number;
  batchResults: Record<string, VoiceEvaluationResult>;
  effectiveQuestionText: string;
  effectiveReferenceAnswer: string;
  effectiveTopic: string;
  effectiveQuestionId: string;
  isWhiteboardOpen: boolean;
  setIsWhiteboardOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isCribSheetOpen: boolean;
  setIsCribSheetOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  handleSelectQuestion: (index: number) => void;
  handleEvaluationComplete: (res: VoiceEvaluationResult) => void;
  handleRetry: (mode?: 'socratic' | 'deep_dive' | 'interview_probe') => void;
  handleNextQuestion: () => void;
  handleFinishSession: () => void;
  handleLobbyStart: (sessionType: 'interview' | 'tutor', tutorMode?: 'socratic' | 'deep_dive' | 'interview_probe') => void;
  sessionProps: VoiceEngineConfig;
}
```

## Explicit Non-Goals
- Do NOT touch `frontend/src/audio/NativeLiveVoiceEngine.ts` or `frontend/src/audio/LiveVoiceStateMachine.ts`.
- Do NOT alter the visual layout or styling of `VoiceLobbyView`, `VoiceActiveView`, `VoiceVerdictView`, or `VoiceGrandFinaleView`.

## Acceptance Criteria
- [ ] `VoiceModal.tsx` line count is $\le 160$ lines (Rule 8 strictly satisfied).
- [ ] `useVoiceModalCoordinator.ts` line count is $\le 250$ lines.
- [ ] All voice modal tests and remote build verification pass green.
