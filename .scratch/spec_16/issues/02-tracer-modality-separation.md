# 02: [Tracer-Bullet] SOTA Live Voice Modality Separation (Strict PCM Audio Gating)

**Archetype:** Tracer-Bullet  
**Blocked by:** #01  
**Parent:** #81  
**Status:** ready-for-agent  

## What to Build
Eliminate the defect where the AI writes text in subtitles without speaking audio out loud:
1. In `NativeLiveVoiceEngine.ts:265`: Strictly separate text ingestion (`parsed.hasText`) from audio playout transition (`parsed.hasAudio && parsed.audioChunks.length > 0`).
2. Text updates transcripts and subtitles via `this.callbacks.onTranscriptDelta` and `this.turnManager.updateLastAiTurn` without triggering `FIRST_AUDIO_RECEIVED` or claiming `🔊 ИИ говорит...`.
3. Transition to `FIRST_AUDIO_RECEIVED` and `🔊 ИИ говорит...` occurs ONLY when actual PCM audio chunks are received and enqueued in `playoutManager`.
4. If a turn completes (`isTurnDone: true`) without any physical audio (e.g. text-only frame or tool call), the engine cleanly resets without unlocking the mic or simulating unplayed audio.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/audio/LiveVoiceStateMachine.ts`.
- **Verification Command:** `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
// SOTA Modality Separation
if (parsed.hasText) {
  for (const textChunk of parsed.textDeltas) {
    this.currentAiTurnAccumulator += textChunk;
    this.callbacks.onTranscriptDelta?.('ai', textChunk);
    this.turnManager.updateLastAiTurn(this.currentAiTurnAccumulator);
  }
}

if (parsed.hasAudio && parsed.audioChunks.length > 0) {
  this.isSessionReady = true;
  this.isServerTurnComplete = false;
  this.clearClientSafetyTimer();
  this.fsm.transition({ type: 'FIRST_AUDIO_RECEIVED' });
  this.callbacks.onStatusMessage?.('🔊 ИИ говорит...');
  for (const pcm of parsed.audioChunks) {
    this.playoutManager.enqueuePcmChunk(pcm);
  }
}
```
- Invariant: Zero audio enqueued implies zero `FIRST_AUDIO_RECEIVED` FSM transition.
- Invariant: No subtitle flash followed by instantaneous mic unlocking.

## Explicit Non-Goals
- Modifying audio sampling rates (16kHz in, 24kHz out).
- Re-architecting `AudioPlayoutManager` ring buffer.

## Acceptance Criteria
- [ ] Text frames without audio update subtitles but do NOT switch FSM to `AI_SPEAKING`.
- [ ] Receiving PCM audio cleanly transitions FSM to `AI_SPEAKING` and enqueues into `playoutManager`.
- [ ] Zero-audio turns do not cause race conditions or premature mic unblocking.
- [ ] All tests pass via `remote-verify`.
