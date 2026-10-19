# Phase 02: Deterministic Zero-Timeout State Handoff

> **Document:** `docs/roadmap/wave_17_unified_voice_batch_and_continuity_remediation/PHASE_02_ZERO_TIMEOUT_STATE_HANDOFF.md`  
> **Phase:** 02 of 05  
> **Status:** Specification Complete (Awaiting Execution)  
> **Target Files:**
> - `frontend/src/components/VoiceModal.tsx`
> - `frontend/src/components/voice/VoiceActiveView.tsx`
> - `frontend/src/components/voice/VoiceVerdictView.tsx`

---

## 1. Objectives & Scope

1. Eliminate the `setTimeout(() => startSession(), 100)` stale closure race condition in `VoiceModal.tsx`.
2. Convert `startSession` into a parameterized function `startSessionForIndex(targetIndex: number, isRetry?: boolean)`.
3. Add a synchronization effect for `initialQuestionIndex` to ensure the modal state reactively tracks parent props.
4. Pass `isRetry: true` when retrying questions from `VoiceVerdictView`.
5. Ensure `VoiceModal.tsx` remains strictly under the 350-line cognitive bounding limit.

---

## 2. As-Is Defect Analysis

In `frontend/src/components/VoiceModal.tsx`:
```tsx
const handleNextQuestion = useCallback(() => {
  disconnect();
  pendingEvaluationRef.current = null;
  const nextIdx = activeBatchIndex + 1;
  setActiveBatchIndex(nextIdx);
  onIndexChange?.(nextIdx);
  setTimeout(() => {
    startSession();
  }, 100);
}, [activeBatchIndex, onIndexChange, disconnect, startSession]);
```

### The Mechanism of Failure:
1. `startSession` is memoized via `useCallback` and closes over `activeBatchIndex: 0`, `activeQuestionId: questionsBatch[0].id`, etc.
2. In `handleNextQuestion`, `setTimeout` holds a closure over `startSession` from the current render.
3. When the 100ms timeout expires, it executes the captured `startSession` function, connecting with Question 0 instead of Question 1.
4. `setActiveBatchIndex(nextIdx)` only updates the visual UI in the modal, causing a catastrophic desynchronization where the candidate sees Question 2 on screen while the AI speaks Question 1.

---

## 3. To-Be Implementation Specification

### 3.1 Parameterized Session Starter (`VoiceModal.tsx`)
```tsx
const startSessionForIndex = useCallback(async (targetIndex: number, isRetryAttempt = false) => {
  setStage('active');
  const targetQ = isBatchMode && questionsBatch ? questionsBatch[targetIndex] : null;
  const qId = targetQ?.id || questionId || 'Q_DEFAULT';
  const qTopic = targetQ?.topic || topic;
  const qText = targetQ?.question || currentQuestionText;
  const qAnswer = targetQ?.answer || referenceAnswer;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const config: VoiceEngineConfig = {
    sessionId,
    questionId: qId,
    topic: qTopic,
    questionText: qText,
    referenceAnswer: qAnswer,
    sessionType: initialSessionType,
    tutorMode: initialSessionType === 'tutor' ? initialTutorMode : undefined,
    voice: interviewConfig.voice || 'Kore',
    turnMode: interviewConfig.turnMode || 'auto',
    liveModel: interviewConfig.liveModel || 'gemini-live-v3',
    vadPauseMs: interviewConfig.vadPauseMs ?? 1800,
    enableSilenceClarification: interviewConfig.enableSilenceClarification ?? false,
    persona: interviewConfig.persona || 'mentor',
    targetGrade: interviewConfig.targetGrade || 'L5_SENIOR',
    strategy: initialSessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
    customPrompt: customPromptOverride,
    questionIndex: targetIndex,
    totalQuestions,
    isRetry: isRetryAttempt
  };

  await connect(config);
}, [
  isBatchMode,
  questionsBatch,
  questionId,
  topic,
  currentQuestionText,
  referenceAnswer,
  initialSessionType,
  initialTutorMode,
  interviewConfig,
  customPromptOverride,
  totalQuestions,
  connect
]);
```

### 3.2 Deterministic `handleNextQuestion` (Zero Timeouts)
```tsx
const handleNextQuestion = useCallback(() => {
  disconnect();
  pendingEvaluationRef.current = null;
  const nextIdx = activeBatchIndex + 1;
  setActiveBatchIndex(nextIdx);
  onIndexChange?.(nextIdx);
  void startSessionForIndex(nextIdx, false);
}, [activeBatchIndex, onIndexChange, disconnect, startSessionForIndex]);
```

### 3.3 Clean Question Retry
```tsx
const handleRetryCurrentQuestion = useCallback(() => {
  disconnect();
  pendingEvaluationRef.current = null;
  void startSessionForIndex(activeBatchIndex, true);
}, [activeBatchIndex, disconnect, startSessionForIndex]);
```

### 3.4 Reactive Prop Synchronization
```tsx
useEffect(() => {
  if (initialQuestionIndex !== undefined && initialQuestionIndex !== activeBatchIndex) {
    setActiveBatchIndex(initialQuestionIndex);
  }
}, [initialQuestionIndex]);
```

---

## 4. Verification Gate (Gate 2 Criteria)
1. In `VoiceModal`, clicking next directly invokes `startSessionForIndex(1)` synchronously with zero `setTimeout`.
2. `VoiceEngineConfig` carries `questionIndex: 1`, `questionId: questionsBatch[1].id`, `questionText: questionsBatch[1].question`.
3. `VoiceModal.tsx` remains strictly under 350 lines.
4. Clean TypeScript check (`npx tsc --noEmit`).
