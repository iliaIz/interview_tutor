# Phase 03: Turn 0 Dynamic Recitation & Backend Grounding

> **Document:** `docs/roadmap/wave_17_unified_voice_batch_and_continuity_remediation/PHASE_03_DYNAMIC_RECITATION_AND_BACKEND_GROUNDING.md`  
> **Phase:** 03 of 05  
> **Status:** Specification Complete (Awaiting Execution)  
> **Target Files:**
> - `backend/src/services/live/LiveGreetingReplay.ts`
> - `backend/src/services/live/liveAudioStreamRouter.ts`
> - `backend/src/services/live/liveEvaluationToolDispatcher.ts`
> - `backend/src/services/live/livePromptBuilder.ts`

---

## 1. Objectives & Scope

1. Update `LiveGreetingReplay.ts` to properly differentiate between initial question (`questionIndex === 0`), subsequent question (`questionIndex > 0`), and retry attempt (`isRetry === true`) across BOTH `interview` and `tutor` session types.
2. Ensure that in `tutor` mode, advancing to question $N > 0$ introduces the new question naturally and prompts the user to explore it.
3. Fix `liveEvaluationToolDispatcher.ts` to ensure evaluations are strictly saved to the active question's ID, avoiding DB overwrite collisions.

---

## 2. As-Is Defect Analysis

### Greeting Logic in `LiveGreetingReplay.ts`:
For `sessionType === 'tutor'`:
```ts
} else if (sessionType === 'tutor') {
  if (tutorMode === 'deep_dive') {
    greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 предложении и предложи разобрать любые тонкости или устройство под капотом. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
...
```
Notice: In `tutor` mode, there was NO branch for `questionIndex > 0`. The AI always greeted as if it was the very first interaction ("Привет! Я изучаю..."), ignoring previous conversation turns.

For `sessionType === 'interview'`:
```ts
const isSubsequent = questionIndex > 0;
if (session.isRetry) {
  greetingText = `Мы пробуем ответить на технический вопрос темы заново с чистого листа: "${questionText || 'Вопрос темы'}". Коротко подбодри в 1 фразе и сразу задай этот вопрос слитным...`;
} else {
  greetingText = isSubsequent
    ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой подтверди прогресс и сразу четко зачитай следующий технический вопрос: "${questionText}"...`
    : `Привет! Я готова к собеседованию. Поздоровайся в 1 коротком предложении и сразу полностью зачитай...`;
}
```
Because `questionIndex` was stripped by the URL builder, `isSubsequent` was always `false`.

### Evaluation Overwriting in `liveEvaluationToolDispatcher.ts`:
When `submit_interview_evaluation` was dispatched:
```ts
const syncResult = await recordEvaluationAndSyncProgress({
  userId: session.userId,
  questionId: session.questionId, // If session.questionId was stuck on Q1, Q1 was overwritten!
  ...
});
```

---

## 3. To-Be Implementation Specification

### 3.1 Enhanced Tutor Subsequent Greeting in `LiveGreetingReplay.ts`
```ts
} else if (sessionType === 'tutor') {
  const isSubsequent = questionIndex > 0;
  if (isSubsequent) {
    greetingText = `Мы переходим к следующему вопросу (вопрос ${questionIndex + 1} из ${totalQuestions}): «${questionText || topic}». В 1 короткой фразе предложи с чего начнем разбор: с базовых концепций или устройства под капотом. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 короткая фраза).`;
  } else if (tutorMode === 'bug_hunt') {
    greetingText = `Привет! Я смотрю на задачу на экране «${bugTitle || 'Code Review'}». Поприветствуй меня в 1 коротком предложении и спроси, в чем здесь ошибка. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
  } else if (tutorMode === 'deep_dive') {
    greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 предложении и предложи разобрать любые тонкости или устройство под капотом. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
  ...
```

### 3.2 Dynamic Context Logging & Guarding
In `liveAudioStreamRouter.ts`, log the turn configuration:
```ts
console.log(`🎙️ [LIVE_AUDIO_ROUTER] Initializing Turn 0 greeting: type=${sessionType}, qIdx=${questionIndex}/${totalQuestions}, isRetry=${isRetry}, qId=${questionId}`);
```

### 3.3 Target Question Verification in `liveEvaluationToolDispatcher.ts`
Ensure `session.questionId` matches the question ID sent in the latest `session_init` / query string, and verify progress syncing registers against the correct database row.

---

## 4. Verification Gate (Gate 3 Criteria)
1. For `sessionType === 'interview'` with `questionIndex = 1`, Gemini Live speaks: *"Мы продолжаем собеседование (вопрос 2 из 3)..."* followed by Question 2's text.
2. For `sessionType === 'tutor'` with `questionIndex = 1`, Gemini Live speaks: *"Мы переходим к следующему вопросу (вопрос 2 из 3)..."* followed by Question 2's text.
3. Database inspection confirms evaluation records for both Question 1 and Question 2 exist in SQLite.
