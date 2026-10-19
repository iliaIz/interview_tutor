# Phase 01: Protocol & URL Serialization SSOT

> **Document:** `docs/roadmap/wave_17_unified_voice_batch_and_continuity_remediation/PHASE_01_PROTOCOL_AND_URL_SERIALIZATION.md`  
> **Phase:** 01 of 05  
> **Status:** Specification Complete (Awaiting Execution)  
> **Target Files:**
> - `frontend/src/audio/liveVoiceUrlBuilder.ts`
> - `frontend/src/audio/types.ts`
> - `backend/src/services/live/liveWsSessionParams.ts`
> - `backend/src/services/live/liveWsClientFrameHandler.ts`

---

## 1. Objectives & Scope

1. Fix the protocol contract so that whenever `VoiceEngineConfig` defines `questionIndex`, `totalQuestions`, or `isRetry`, these parameters are 100% serialized into the WebSocket URL query string.
2. Synchronize the `LiveSessionInitFrame` schema so that incoming `session_init` frames also carry `questionIndex`, `totalQuestions`, and `isRetry`.
3. Update `liveWsClientFrameHandler.ts` on the backend to update session state in memory upon receiving `session_init`.

---

## 2. As-Is Defect Analysis

In `frontend/src/audio/liveVoiceUrlBuilder.ts`:
```ts
export function buildLiveVoiceWebSocketUrl(cfg: VoiceEngineConfig): string {
  const params = new URLSearchParams({
    sessionId: cfg.sessionId,
    questionId: cfg.questionId,
    sessionType: cfg.sessionType,
    questionText: cfg.questionText ? cfg.questionText.slice(0, 300) : '',
    voice: cfg.voice || 'Kore',
    turnMode: cfg.turnMode || 'auto',
    liveModel: cfg.liveModel || 'gemini-live-v3',
    vadPauseMs: String(cfg.vadPauseMs || 1800)
  });
  // MISSING:
  // cfg.questionIndex
  // cfg.totalQuestions
  // cfg.isRetry
```

On the backend (`backend/src/services/live/liveWsSessionParams.ts`):
```ts
const questionIndex = Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0);
const totalQuestions = Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1);
const isRetry = query.isRetry === 'true';
```

Because `query.questionIndex` is undefined:
- `questionIndex` defaults to `0`.
- `totalQuestions` defaults to `1`.
- `isRetry` defaults to `false`.
- Upstream Turn 0 greeting logic in `LiveGreetingReplay.ts` cannot recognize that the session is continuing an ongoing batch.

---

## 3. To-Be Implementation Specification

### 3.1 Update `buildLiveVoiceWebSocketUrl` (`liveVoiceUrlBuilder.ts`)
```ts
if (typeof cfg.questionIndex === 'number') {
  params.set('questionIndex', String(cfg.questionIndex));
}
if (typeof cfg.totalQuestions === 'number') {
  params.set('totalQuestions', String(cfg.totalQuestions));
}
if (cfg.isRetry) {
  params.set('isRetry', 'true');
}
```

### 3.2 Update `sendLiveSessionInit` (`liveVoiceUrlBuilder.ts`)
Add `questionIndex`, `totalQuestions`, and `isRetry` to `LiveSessionInitFrame`:
```ts
export function sendLiveSessionInit(ws: WebSocket, cfg: VoiceEngineConfig): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  const initFrame: LiveSessionInitFrame = {
    type: 'session_init',
    sessionId: cfg.sessionId,
    sessionType: cfg.sessionType,
    tutorMode: cfg.tutorMode,
    topic: cfg.topic,
    questionText: cfg.questionText,
    referenceAnswer: cfg.referenceAnswer,
    persona: cfg.persona,
    strategy: cfg.strategy,
    targetGrade: cfg.targetGrade,
    customPrompt: cfg.customPrompt,
    questionIndex: cfg.questionIndex,
    totalQuestions: cfg.totalQuestions,
    isRetry: cfg.isRetry,
    ...
```

### 3.3 Update `liveWsClientFrameHandler.ts`
When `parsed.type === 'session_init'`:
```ts
if (typeof parsed.questionIndex === 'number') session.questionIndex = parsed.questionIndex;
if (typeof parsed.totalQuestions === 'number') session.totalQuestions = parsed.totalQuestions;
if (typeof parsed.isRetry === 'boolean') session.isRetry = parsed.isRetry;
```

---

## 4. Verification Gate (Gate 1 Criteria)
1. Unit test `liveVoiceUrlBuilder.test.ts` asserts that `buildLiveVoiceWebSocketUrl` with `questionIndex: 2, totalQuestions: 5, isRetry: true` returns a URL containing `questionIndex=2&totalQuestions=5&isRetry=true`.
2. Integration check confirms `resolveLiveWsSessionParams` parses `questionIndex: 2`, `totalQuestions: 5`, `isRetry: true`.
3. Zero TypeScript compile errors (`npx tsc --noEmit`).
