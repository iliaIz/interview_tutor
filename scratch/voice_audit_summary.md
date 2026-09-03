# Итоговый отчёт по аудиту и устранению техдолга голосового и диалогового стека (SOTA 2026)

**Дата проведения:** 3 сентября 2026 г.  
**Статус:** Успешно завершено (Все категории CRITICAL, HIGH, MEDIUM и TECH_DEBT устранены)  
**Реестр дефектов:** [`scratch/voice_dialogue_ledger.md`](file:///d:/projects/interview_projects/spring/scratch/voice_dialogue_ledger.md)

---

## 1. Обзор проделанной работы

В рамках автономного многоитерационного аудита кодовой базы AI-диалогов (голосовой стек Web Audio / AudioWorklet, WebSocket-шлюз Gemini Live Proxy, REST-маршруты и синтез TTS) был выполнен детальный анализ 6 ключевых модулей системы. Все выявленные критические уязвимости, утечки памяти, десинхронизации стейт-машины и искажения аудиопотока были устранены с обязательной пошаговой верификацией компиляции `frontend` и `backend`.

---

## 2. Перечень устранённых дефектов по категориям

### 🔴 CRITICAL
* **CRIT-01: Гонка `teardown()` vs `handleInterruption()` с утечкой узлов Web Audio в [`AudioPlayoutManager.ts`](file:///d:/projects/interview_projects/spring/frontend/src/services/AudioPlayoutManager.ts)**
  * *Причина:* При вызове `teardown()` вызывался `handleInterruption()`, переносивший узлы в массив с отложенным `setTimeout(..., 7ms)` на остановку, но затем `teardown()` сразу же очищал `interruptionTimer`. В результате узлы `AudioBufferSourceNode` оставались активными в памяти.
  * *Решение:* Внедрён трекер `pendingInterruptionSources: Set<AudioBufferSourceNode>`, вызов аппаратной остановки по временной шкале Web Audio API `source.stop(now + fadeDurationSec)`, а также синхронный сбор и отключение всех источников в `clearQueue()` и `teardown()`.

---

### 🟠 HIGH
* **HIGH-01: Одноразовый AbortSignal в механизме Full-Jitter Retry в [`interviewTurn.ts`](file:///d:/projects/interview_projects/spring/backend/src/routes/interviewTurn.ts)**
  * *Причина:* В функцию `fetchWithFullJitterRetry` передавался статический `AbortSignal.timeout(45_000)`. При таймауте первой попытки `signal.aborted` становился `true`, из-за чего все последующие ретраи падали мгновенно без сетевого запроса.
  * *Решение:* Создание свежего `AbortSignal.timeout(timeoutMs)` на каждую попытку ретрая с объединением через `AbortSignal.any([parentSignal, timeoutSignal])`.

* **HIGH-02: Отсутствие сквозной проброски отмены клиента (`req.signal`) в LiteLLM / TTS в [`interviewTurn.ts`](file:///d:/projects/interview_projects/spring/backend/src/routes/interviewTurn.ts)**
  * *Причина:* При закрытии модального окна или прерывании пользователем клиентский HTTP-запрос прерывался, но бэкенд продолжал выполнять дорогостоящую генерацию LiteLLM и синтез TTS.
  * *Решение:* Проброшен `(req as any).signal` во все вызовы `fetchWithFullJitterRetry`, добавлены промежуточные проверки `signal.aborted` перед фазой синтеза аудио с корректным возвратом HTTP 499 Client Closed Request.

* **HIGH-03: Отсутствие Re-entrancy Guard и незащищённая отправка ошибок в сокет в [`geminiLiveProxy.ts`](file:///d:/projects/interview_projects/spring/backend/src/services/geminiLiveProxy.ts)**
  * *Причина:* Метод `terminate()` вызывал закрытие сокетов, что инициировало события `close` и повторный re-entrant вызов `terminate()`, приводя к дублированию реплик в сессионной памяти SQLite. При ошибках сокета отправка уведомления клиенту не была защищена `try/catch`.
  * *Решение:* Внедрён атомарный флаг `isTerminated`, защищены блоки закрытия сокетов и отправки диагностических сообщений клиенту.

* **HIGH-04: Неожидаемый промис `applyKnowledgeDecay` в Live Audio Tooling в [`liveToolDispatcher.ts`](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveToolDispatcher.ts)**
  * *Причина:* В функциях `mark_bug_solved` и `submit_interview_evaluation` вызов `applyKnowledgeDecay` выполнялся через `void applyKnowledgeDecay(...)`, а сообщение клиенту отправлялось сразу же, из-за чего поле `knowledgeUpdate` всегда передавалось как `null`.
  * *Решение:* Добавлен `await applyKnowledgeDecay(...)`, гарантирующий доставку актуальных метрик деградации/прогресса знаний на клиент.

---

### 🟡 MEDIUM
* **MED-01: Зависание стейт-машины при ошибках шлюза (`data.error`) в [`VoiceModal.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx)**
  * *Причина:* При получении `data.error` сообщение записывалось в лог, но флаги `isThinking`, `isAiSpeaking` и `isSubmitting` не сбрасывались, блокируя микрофон кандидата и интерфейсный шар навсегда.
  * *Решение:* В блок обработки `data.error` добавлен полный сброс состояний `setIsThinking(false)`, `setIsAiSpeaking(false)`, `setIsSubmitting(false)`, `setThinkingStage('idle')` и разблокировка записи `setIsRecording(true)`.

* **MED-02: Утечка экземпляра SpeechRecognition при закрытии модалки в [`VoiceModal.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx)**
  * *Причина:* Экземпляр распознавания речи браузера не останавливался при вызове `teardownWsAndBuffersOnly()`, а событие `recognition.onend` не сбрасывало ссылку.
  * *Решение:* Добавлен обработчик `recognition.onend`, очищающий ссылку, и вызов `speechRecognitionRef.current.stop()` в процедуре `teardownWsAndBuffersOnly()`.

* **MED-03: Фазовые искажения и граничный треск ресемплера в [`audio-capture-processor.js`](file:///d:/projects/interview_projects/spring/frontend/public/worklets/audio-capture-processor.js)**
  * *Причина:* При линейной интерполяции с 48 кГц до 16 кГц на границе 128-сэмплового кванта сэмплы `s0` и `s1` принудительно зажимались в `inputChannel[inputLength - 1]`, создавая ступенчатый разрыв каждые 2.6 мс (гармонический писк 375 Гц).
  * *Решение:* Реализована непрерывная межквантовая интерполяция: цикл ресемплинга завершается на `inputLength - 1`, а недостающий граничный отрезок плавно интерполируется в начале следующего кванта с использованием `this.prevSample`.

---

### 🟢 TECH_DEBT
* **TECH-01: Устранение `any` и строгая типизация голосовых компонентов**
  * Строго типизированы параметры `code` компонента в [`VoiceTutorView.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/voice/VoiceTutorView.tsx).
  * Введён интерфейс `ISpeechRecognitionInstance` и типизирована валидация `speechCoachingMode` в [`VoiceModal.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx).
  * Добавлен интерфейс `TurnReasoningResult` и функция безопасной валидации голосов `sanitizeVoice` в [`interviewTurn.ts`](file:///d:/projects/interview_projects/spring/backend/src/routes/interviewTurn.ts).

---

## 3. Подтверждение целостности системы (Verification)

* **Frontend Build:** `npm run build` в `d:\projects\interview_projects\spring\frontend` -> **Exit Code: 0** (Vite v6.4.3 production build успешен, 4403 модулей трансформировано).
* **Backend Build:** `npm run build` в `d:\projects\interview_projects\spring\backend` -> **Exit Code: 0** (`tsc` и `javac` компиляция sandbox runner успешна).
* **Архитектурные инварианты:**
  * Все сетевые вызовы проходят исключительно через `LiteLLM_Proxy` без прямых обращений к Google API или хардкода API-ключей.
  * Формат звука строго сохранён: 16 кГц PCM, Little-Endian Int16.
  * Дизайн-система (пастельная роскошь `#FFF0F5`, эргономика Fitts's Law) полностью сохранена без добавления избыточных внешних зависимостей.
