# 03: [Tracer-Bullet] Dual-Sided Handshake Evaluation Drain & Non-Blocking Spoken Feedback

**Archetype:** Tracer-Bullet  
**Blocked by:** #02  
**Parent:** #81  
**Status:** ready-for-agent  

## What to Build
Prevent premature modal collapse into the verdict screen when `submit_interview_evaluation` is called, ensuring the candidate hears the AI interviewer's full concluding remarks:
1. In `NativeLiveVoiceEngine.ts`, receiving `parsed.evaluation` stores the evaluation payload in `this.pendingEvaluation` without immediately forcing FSM to `COMPLETED` if speech is active or queued in `playoutManager`.
2. FSM transitions to `COMPLETED` only when `playoutManager.isPlaying()` is false AND all closing audio has drained physically via `onPlaybackFinished`.
3. In `VoiceModal.tsx`, ensure the stage transition to `'verdict'` respects `AudioPlayoutManager` physical playback drain, showing a gentle notice (*«🎙️ ИИ подводит итоги ответа... Дослушайте вердикт»*) while closing audio is still playing.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/components/VoiceModal.tsx`.
- **Verification Command:** `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
if (parsed.evaluation) {
  this.clearClientSafetyTimer();
  this.pendingEvaluation = parsed.evaluation;
  if (!this.playoutManager.isPlaying() && this.isServerTurnComplete) {
    this.fsm.transition({ type: 'EVALUATION_COMPLETED' });
    this.callbacks.onEvaluationReceived?.(parsed.evaluation);
  } else {
    // Await audio drain before completing
    this.hasPendingEvaluationDrain = true;
  }
  return;
}
```
- Invariant: Candidate must hear complete spoken feedback before the scorecard view replaces the dialog.
- Invariant: FSM in `AI_SPEAKING` must not prematurely drop closing audio chunks.

## Explicit Non-Goals
- Modifying the scorecard JSON schema or evaluation criteria.
- Modifying `VoiceVerdictView` layout.

## Acceptance Criteria
- [ ] Receiving evaluation while audio is playing queues the verdict transition until playback completes.
- [ ] Concluding spoken remarks are not muted or truncated.
- [ ] When audio completes, FSM transitions to `COMPLETED` and stage updates to `verdict`.
- [ ] All tests pass via `remote-verify`.
