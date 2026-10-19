# Phase 1: Backend Turn 0 Pre-Connection Frame Queue Purge & Barge-In Protection

> **Document:** `PHASE_01_BACKEND_TURN0_FRAME_PURGE.md`  
> **Status:** Pending Execution  
> **Target Subsystem:** `backend/src/services/live/liveAudioStreamRouter.ts`  
> **Cognitive Limit:** <= 150 lines  

---

## 1. Problem Statement & Root Cause

In `backend/src/services/live/liveAudioStreamRouter.ts`, when `setupComplete` arrives from Gemini, the router executes:
```typescript
handleSetupCompleteGreeting(...);

// Drain queued frames
while (session.frameQueue.length > 0) {
  const frame = session.frameQueue.shift();
  if (frame && geminiSocket.readyState === WebSocket.OPEN) {
    geminiSocket.send(frame);
  }
}
```

### The Acoustic Collision
1. While the browser was connecting over WebSocket, `MicrophoneCapture` had already started sending 16kHz PCM chunks.
2. In `liveWsClientFrameHandler.ts`, frames received before `session.isSetupComplete` are appended to `session.frameQueue`.
3. These frames contain ambient room noise, candidate exhalations, or microphone initialization pops.
4. When `setupComplete` arrives, `handleSetupCompleteGreeting()` sends `initialGreetingTurn` (asking Gemini to speak the greeting/question).
5. Immediately after, lines 218-223 blast all buffered audio frames into `geminiSocket`.
6. Gemini 3.8 Live interprets this sudden burst of audio as candidate speech / barge-in, immediately aborting the greeting synthesis. In `session_1792415957654_f776k`, this resulted in 0 tokens emitted, leaving the candidate in complete dead air.

---

## 2. Implementation Specifications

1. **Selective Frame Queue Purge on Turn 0:**
   In `backend/src/services/live/liveAudioStreamRouter.ts`:
   - If the session is initiating Turn 0 (`!session.hasCandidateResponded` and `!isResumed`):
     - Completely purge `session.frameQueue = []` upon `setupComplete`.
     - Log: `🧹 [FRAME_QUEUE_PURGE] Purged ${count} pre-connection audio frames to protect Turn 0 recitation.`
     - Do NOT send any buffered audio frames to `geminiSocket`.
   - Only for genuine mid-stream reconnections (`session.isResumed && wasReconnecting`) should non-audio frames or legitimate queued turns be preserved.

2. **Strict Invariant Assertion:**
   On Turn 0, Gemini Live MUST receive zero `realtimeInput.audio` frames until physical playout finishes or an explicit user tactile barge-in occurs.

---

## 3. Exit Gates (Verification Contract)

- [ ] Automated headless test connecting with simulated pre-connection audio frames receives `modelTurn` audio for Turn 0 in < 2.0s without turn truncation.
- [ ] Backend logs confirm `[FRAME_QUEUE_PURGE]` firing and 0 audio frames leaked to Gemini before initial greeting.
