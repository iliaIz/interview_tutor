# Phase 2: Backend SSE Endpoint & Two-Phase Assembler
## Express Server-Sent Events Architecture & Clean JSON Buffering

> **Phase:** 2 of 5  
> **Status:** Draft / Specification  
> **Target Subsystem:** `backend/src/routes/tutor.ts` & `backend/src/services/bugChallengeStreamService.ts`  
> **Dependencies:** Phase 1 (LiteLLM Proxy Reasoning Delta Stream)  

---

## 1. Context & Objective

The backend must provide a resilient, authenticated SSE endpoint:
`POST /api/tutor/bug-challenge/stream`

This endpoint bridges the client's event source to LiteLLM Proxy's streaming completion, separating:
- **Phase 1 (Live Streaming):** Immediate forwarding of `thought` events to the client.
- **Phase 2 (Buffered Assembly):** Accumulating `content` chunks, running `sanitizeJsonControlChars()`, validating the structure against `BugChallenge`, and emitting `challenge_ready`.

---

## 2. Technical Specification

### 2.1. SSE Headers & Connection Setup
```typescript
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no', // Disables Nginx/Caddy proxy buffering
});
res.flushHeaders?.();
```

### 2.2. Protocol Event Contract
The stream emits the following typed events:
1. `event: thought`:
   ```
   event: thought
   data: {"delta": "Checking for race condition in ConcurrentHashMap computeIfAbsent..."}
   ```
2. `event: ping`:
   ```
   : ping
   ```
   Sent every 15 seconds to prevent intermediate proxy drops.
3. `event: challenge_ready`:
   ```
   event: challenge_ready
   data: { ...complete validated BugChallenge object... }
   ```
4. `event: stream_error`:
   ```
   event: stream_error
   data: {"code": "STREAM_TIMEOUT", "message": "Upstream response stalled"}
   ```

### 2.3. Safe Stream Consumer Service (`bugChallengeStreamService.ts`)
To adhere to Rule 8 (File-Hygiene), this streaming logic MUST NOT be crammed into `tutorService.ts` (which is already 587 lines). It will be housed in a standalone single-responsibility module:
`backend/src/services/bugChallengeStreamService.ts` (< 250 lines).

---

## 3. Verification Gate (Gate 2)

1. Authenticated curl test to `/api/tutor/bug-challenge/stream`.
2. Verify headers: `Content-Type: text/event-stream` and `X-Accel-Buffering: no`.
3. Assert reception of sequential `thought` events followed by a single complete `challenge_ready` JSON event.
