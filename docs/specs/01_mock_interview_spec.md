# 01. Mock Interview Specification (FAANG Calibration L4–L6)

> **Версия**: 2.0 (Сентябрь 2026)  
> **Статус**: Production Ready  
> **Роут**: Модальный диалог `VoiceModal` поверх любого раздела платформы

---

## 1. Назначение и концепция
Режим имитации технического собеседования (Mock Interview) для калибровки инженерных грейдов L4 (Middle), L5 (Senior), L6 (Staff / Principal) по стеку Java 21, Spring Boot, реляционным/NoSQL базам данных и распределенным системам.

---

## 2. Диалоговый движок и протокол WebSocket
* **Транспорт**: WebSocket `ws://.../ws/live?sessionType=interview&targetGrade={grade}&strategy={strategy}&model=${GEMINI_LIVE_MODEL}&token=${LITELLM_API_KEY}`.
* **Модель по умолчанию**: `${GEMINI_LIVE_MODEL}` (`gemini-live-v3`).
* **Роль ИИ**: FAANG Senior / Principal Interviewer (Google, Meta, Amazon).
* **Стиль диалога**: Калибровочный, адаптивное зондирование глубины (Adaptive Probing), строгая оценка структуры ответа (STAR / PREP / Rule of 3).
* **First-Turn Lockdown**: Полный запрет на вызов оценочных инструментов на нулевом ходу (приветствие и чтение вопроса). Бэкенд жестко валидирует флаг `hasCandidateResponded`.

---

## 3. Инструменты модели (Model Tools)
1. `update_whiteboard`:
   * Вызывается для вывода контрпримеров, схем или фрагментов кода на доску.
   * Рендерится в боковой docked-панели с версионированием (`CodeArtifactTimeline`), диффом и подсветкой строк.
2. `submit_interview_evaluation`:
   * Вызывается в конце вопроса для фиксации баллов, штрафов (`deductions`), покрытия критериев рубрики и spoken feedback.

---

## 4. Жизненный цикл сессии (3-Stage Flow)
1. **Lobby (Сцена 1)**:
   * Проверка микрофона, выбор голоса (`Kore`, `Puck`, `Fenrir`), настройка режима ходов (`auto-VAD` vs `manual-push-to-talk`).
   * Проверка доступности моделей в реестре LiteLLM Proxy через `/api/health`.
2. **Active Interview (Сцена 2)**:
   * Двусторонний симметричный рукопожатие (Dual-Sided Handshake): микрофон разблокируется строго последним из двух событий: физический дренаж звука в наушниках (`playout.onPlaybackFinished`) ИЛИ флаг `turnComplete: true`.
   * Состояние `isThinking` блокирует клики для предотвращения ложного мьюта.
   * Тактильный перебив речи (Tactile Barge-In) с 5мс деклик-рампой.
3. **Verdict & Grand Finale (Сцена 3/4)**:
   * Развернутый скоркарт FAANG с радар-диаграммой по 6 компетенциям, цитированием стенограммы и 1-click retry.

---

## 5. UI/UX стандарты (SOTA 2026)
* **Non-Modal Standard**: Доска не перекрывает кнопки завершения звонка и транскрипт на десктопе; на мобильных устройствах — чистое переключение экранов.
* **100dvh Viewport**: Арена фиксирована на высоте `h-[calc(100dvh-4rem)]` для предотвращения скачков при появлении виртуальной клавиатуры.
* **Reference-Counted Scroll Lock**: Использование `useBodyScrollLock` с трекингом активных блокировок.
