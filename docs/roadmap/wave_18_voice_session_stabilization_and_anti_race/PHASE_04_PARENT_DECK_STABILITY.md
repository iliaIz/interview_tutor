# Phase 4: Parent Deck State Isolation & Key Stability (`StudyDeck.tsx`)

> **Document:** `PHASE_04_PARENT_DECK_STABILITY.md`  
> **Status:** Pending Execution  
> **Target Subsystem:** `frontend/src/components/StudyDeck.tsx`  
> **Cognitive Limit:** <= 150 lines  

---

## 1. Problem Statement & Root Cause

In `frontend/src/components/StudyDeck.tsx`:
```tsx
{isVoiceOpen && voiceSessionId && (
  <VoiceModal
    key={voiceSessionId}
    isOpen={isVoiceOpen}
    onClose={() => {
      setIsVoiceOpen(false);
      setVoiceSessionId(null);
    }}
    questionId={currentQ.id}
    topic={selectedTopicName || currentQ.topic}
    currentQuestionText={currentQ.question}
    referenceAnswer={currentQ.answer}
    questionsBatch={currentBatch}
    initialQuestionIndex={voiceInitialIndex}
    onIndexChange={(newIdx) => {
      setQuestionIndex(newIdx);
      setVoiceInitialIndex(newIdx);
    }}
    initialSessionType={voiceModalSessionType}
    initialTutorMode={voiceModalTutorMode}
    customPromptOverride={customPromptForTutor}
    ...
```

### The Invalidation Chain
When `onIndexChange(newIdx)` was called:
1. `StudyDeck` updated `currentQuestionIndex` and `voiceInitialIndex`.
2. This triggered a parent re-render.
3. While `key={voiceSessionId}` prevented full unmounting, changing `questionId`, `currentQuestionText`, and `referenceAnswer` props directly mutated the dependency array of `startSessionForIndex` inside `VoiceModal`.
4. As discovered in Phase 3, this combined with the un-guarded `useEffect` to trigger a duplicate session connect while the first one was still establishing.

---

## 2. Implementation Specifications

1. **Batch SSOT Prioritization:**
   - In `VoiceModal`, when `questionsBatch` is provided, the modal must treat `questionsBatch[activeBatchIndex]` as the **exclusive Single Source of Truth** for the current question's metadata.
   - Props `currentQuestionText`, `questionId`, and `referenceAnswer` serve only as fallbacks when `questionsBatch` is empty.
   - This eliminates re-renders driven by parent prop changes during internal batch navigation.

2. **Decoupled Parent Index Notification:**
   - `onIndexChange?.(nextIdx)` is deferred or wrapped in `requestAnimationFrame` / state synchronization to ensure `VoiceModal` completes its socket transition before parent state churn occurs.

---

## 3. Exit Gates (Verification Contract)

- [ ] Navigating forward across 3 questions in a study deck maintains stable component identity without extraneous prop-driven socket aborts.
- [ ] Parent `StudyDeck` card indicators reflect the current active question smoothly in the background.
