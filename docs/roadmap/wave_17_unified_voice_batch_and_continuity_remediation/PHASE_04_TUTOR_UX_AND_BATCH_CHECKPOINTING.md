# Phase 04: Socratic Tutor UX & Batch Checkpointing

> **Document:** `docs/roadmap/wave_17_unified_voice_batch_and_continuity_remediation/PHASE_04_TUTOR_UX_AND_BATCH_CHECKPOINTING.md`  
> **Phase:** 04 of 05  
> **Status:** Specification Complete (Awaiting Execution)  
> **Target Files:**
> - `frontend/src/components/VoiceModal.tsx`
> - `frontend/src/components/StudyDeck.tsx`
> - `frontend/src/store/useAppStore.ts`
> - `frontend/src/components/voice/VoiceGrandFinaleView.tsx`

---

## 1. Objectives & Scope

1. Eliminate the redundant and confusing FAANG exam lobby when clicking "Тьютор" from a study flashcard (`StudyDeck`). In Tutor mode, the voice session must open immediately into active discussion of the visible card.
2. Connect `useAppStore.activeBatchSession` with `VoiceModal` so that multi-question blitz interviews can be paused, resumed, or recovered after a page refresh.
3. Fix Grand Finale score aggregation to reflect the full batch of questions evaluated.

---

## 2. As-Is Defect Analysis

### 1. Tutor Lobby Mismatch:
In `VoiceModal.tsx`:
```tsx
const [stage, setStage] = useState<'lobby' | 'active' | 'verdict' | 'grand_finale'>('lobby');
```
When a student is reading Card 3 in `StudyDeck` and clicks "Тьютор" (or submits a quick question "Спросить Тьютора"), `VoiceModal` pops up in `'lobby'` with:
> *"Готовы пройти серию из 10 вопросов? Режим 'Без рук' (Hands-Free): ИИ последовательно задаст каждый вопрос темы..."*

This introduces high friction, confuses the user, and forces an unnecessary button press.

### 2. Disconnected Session Checkpoints:
In `VoiceModal.tsx`:
```tsx
{stage === 'lobby' && (
  <VoiceLobbyView
    ...
    canResumeSession={false}
    activeBatchSession={null}
    handleResumeSession={() => {}}
    handleStartFresh={() => {}}
```
Meanwhile, `useAppStore` has fully implemented `activeBatchSession`, `saveBatchSessionCheckpoint`, and `clearBatchSession`, persisted across browser reloads via `zustand/persist`. Because `VoiceModal` passed `null`, the feature was dead code.

---

## 3. To-Be Implementation Specification

### 3.1 Direct Active Launch for Tutor Mode (`VoiceModal.tsx`)
```tsx
const [stage, setStage] = useState<'lobby' | 'active' | 'verdict' | 'grand_finale'>(() => {
  return initialSessionType === 'tutor' ? 'active' : 'lobby';
});

// Auto-connect immediately if launching in tutor mode
useEffect(() => {
  if (isOpen && initialSessionType === 'tutor' && stage === 'active' && state === 'IDLE') {
    void startSessionForIndex(activeBatchIndex, false);
  }
}, [isOpen, initialSessionType, stage, state, activeBatchIndex, startSessionForIndex]);
```

### 3.2 Wire Batch Checkpoints (`VoiceModal.tsx`)
1. Read `activeBatchSession = useAppStore((s) => s.activeBatchSession)`.
2. Read `saveBatchSessionCheckpoint = useAppStore((s) => s.saveBatchSessionCheckpoint)`.
3. In `onEvaluationComplete`:
   ```tsx
   saveBatchSessionCheckpoint(sessionId, {
     topicName: activeTopic,
     questions: questionsBatch || [],
     currentIndex: activeBatchIndex,
     results: { ...batchResults, [activeQuestionId]: evaluation },
     isComplete: activeBatchIndex + 1 >= totalQuestions
   });
   ```
4. In `VoiceLobbyView`:
   ```tsx
   <VoiceLobbyView
     canResumeSession={Boolean(activeBatchSession && !activeBatchSession.isComplete)}
     activeBatchSession={activeBatchSession}
     handleResumeSession={() => {
       const resumeIdx = activeBatchSession?.currentIndex ?? 0;
       setActiveBatchIndex(resumeIdx);
       void startSessionForIndex(resumeIdx, false);
     }}
     handleStartFresh={() => {
       clearBatchSession();
       setActiveBatchIndex(0);
       void startSessionForIndex(0, false);
     }}
     ...
   ```

### 3.3 Clear Checkpoint on Completion
When `handleFinishBatch` or `grand_finale` is reached, call `clearBatchSession()`.

---

## 4. Verification Gate (Gate 4 Criteria)
1. Opening "Тьютор" from `StudyDeck` skips the lobby and immediately engages in dialogue about the active card.
2. Refreshing the page during a blitz interview displays the "Продолжить (#N)" resume card in the lobby.
3. `VoiceGrandFinaleView` accurately lists scores for all completed questions in the batch.
