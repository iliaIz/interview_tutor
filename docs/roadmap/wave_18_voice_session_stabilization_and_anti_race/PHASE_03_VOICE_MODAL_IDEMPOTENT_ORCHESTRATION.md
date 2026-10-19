# Phase 3: React Lifecycle & Idempotent Connection Orchestration (`VoiceModal.tsx`)

> **Document:** `PHASE_03_VOICE_MODAL_IDEMPOTENT_ORCHESTRATION.md`  
> **Status:** Pending Execution  
> **Target Subsystem:** `frontend/src/components/VoiceModal.tsx`  
> **Cognitive Limit:** <= 180 lines  

---

## 1. Problem Statement & Root Cause

In `frontend/src/components/VoiceModal.tsx`, Wave 17 introduced:
```tsx
// Auto-start session for Socratic Tutor when launched from study flashcard
useEffect(() => {
  if (isOpen && initialSessionType === 'tutor' && stage === 'active' && state === 'IDLE') {
    void startSessionForIndex(activeBatchIndex, false);
  }
}, [isOpen, initialSessionType, stage, state, activeBatchIndex, startSessionForIndex]);
```

### The Root Cause of Repeated Disconnects & Greetings
1. **Volatile Dependency:** `startSessionForIndex` was recreated on every render where `interviewConfig`, `currentQuestionText`, `questionId`, etc., changed.
2. **Double-Fire Race Condition:**
   - When `startSessionForIndex` runs, it calls `connect()`.
   - `connect()` begins by calling `disconnect()`, which sets `state = 'IDLE'`.
   - React observes `state === 'IDLE'` and new `startSessionForIndex`, triggering the `useEffect` **a second time**.
   - The second invocation immediately severs the active connection with code 1000 ("Normal Closure") and reconnects from scratch, reciting the greeting again!
3. **No Guarding Against Concurrent Execution:** Neither `startSessionForIndex` nor `handleNextQuestion` had mutexes or connecting ref guards.

---

## 2. Implementation Specifications

1. **Eliminate Reactive Re-Trigger Loop:**
   - Remove `startSessionForIndex` and volatile state from the auto-start `useEffect`.
   - Introduce an explicit single-fire ref: `hasAutoStartedRef = useRef(false)`.
   - Ensure the auto-start fires **exactly once** when `isOpen` transitions to true:
     ```tsx
     useEffect(() => {
       if (isOpen && initialSessionType === 'tutor' && !hasAutoStartedRef.current) {
         hasAutoStartedRef.current = true;
         void startSessionForIndex(activeBatchIndex, false);
       }
       if (!isOpen) {
         hasAutoStartedRef.current = false;
       }
     }, [isOpen, initialSessionType]);
     ```

2. **Re-Entrancy & Connection Mutex (`isConnectingRef`):**
   - Guard `startSessionForIndex`:
     ```tsx
     if (isConnectingRef.current) return;
     isConnectingRef.current = true;
     try {
       await connect(config);
     } finally {
       isConnectingRef.current = false;
     }
     ```
   - Protect `handleNextQuestion` and `handleRetryCurrentQuestion` from rapid multi-clicks.

3. **Strict Parameterization & Zero Stale Closures:**
   - `startSessionForIndex(targetIndex: number, isRetry: boolean)` resolves all question text, reference answers, and IDs directly from `questionsBatch[targetIndex]` rather than stale component state variables.

---

## 3. Exit Gates (Verification Contract)

- [ ] Opening Tutor modal connects exactly once with 1 greeting turn in WebSocket logs.
- [ ] Multi-turn dialogue does NOT disconnect or reconnect upon candidate speaking or subtitles updating.
- [ ] Clicking "Следующий вопрос" advances to the next question cleanly without aborting the new connection.
