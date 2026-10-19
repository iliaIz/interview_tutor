# Phase 2: Client Voice Engine Pre-`setupComplete` Capture Gate

> **Document:** `PHASE_02_CLIENT_ENGINE_PRE_SETUP_GATE.md`  
> **Status:** Pending Execution  
> **Target Subsystem:** `frontend/src/audio/NativeLiveVoiceEngine.ts`  
> **Cognitive Limit:** <= 150 lines  

---

## 1. Problem Statement & Root Cause

In `frontend/src/audio/NativeLiveVoiceEngine.ts`:
```typescript
private handleMicrophoneChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
  if (this.isMuted) return;
  if (this.isAudioMutexLocked) return;

  if (this.getState() === 'AI_SPEAKING') {
    if (metrics?.speechDetected && !this.isTurn0Lockdown) {
      this.handleBargeInInterruption('acoustic');
    }
    return;
  }

  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({
      realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: base64Pcm } }
    }));
  }
}
```

### The Defect
When `connect()` is executed, `this.micCapture.start(ctx)` is called immediately.
While the WebSocket is establishing (`ws.readyState === WebSocket.OPEN` but `setupComplete` has NOT arrived yet), `this.getState()` is `'CONNECTING'`.
Because `this.getState() !== 'AI_SPEAKING'`, the method unconditionally transmits `realtimeInput.audio` chunks into the socket.
Furthermore, during Turn 0 question recitation, while the model has not yet produced its first audio chunk, state may be `AI_RECITING_QUESTION` (which maps to `AI_SPEAKING`), but if `metrics?.speechDetected` is false, it was previously possible to leak ambient frames.

---

## 2. Implementation Specifications

1. **Uplink Capture Gating in `handleMicrophoneChunk`:**
   Candidate mic chunks MUST ONLY be transmitted over WebSocket when:
   - WebSocket is open (`this.ws?.readyState === WebSocket.OPEN`).
   - Session setup is complete (`this.isSessionReady === true` / received `setupComplete`).
   - The engine is in a candidate speaking state:
     - State is `LISTENING` (`CANDIDATE_LISTENING`, `CANDIDATE_SPEAKING`, `CANDIDATE_HOLD`).
     - Or explicit acoustic barge-in has been validated during follow-up turns (`!this.isTurn0Lockdown`).
   - Under NO circumstances may audio chunks be sent when state is `CONNECTING` or `AI_RECITING_QUESTION` (without barge-in).

2. **Clean State Reset in `disconnect()`:**
   - Explicitly reset `isSessionReady = false`.
   - Ensure `micCapture.stop()` cleanly halts Worklet emission.

---

## 3. Exit Gates (Verification Contract)

- [ ] Network inspector / unit test confirms 0 bytes of `realtimeInput.audio` emitted to WebSocket before `setupComplete`.
- [ ] Turn 0 Question Recitation plays completely to physical audio drain without false barge-in drops.
