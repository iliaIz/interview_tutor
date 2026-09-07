# Этап 2: Декомпозиция `VoiceModal.tsx` (3770 $\rightarrow$ 240 строк)

> **Цель:** Превратить 3770-строчный Год-компонент `VoiceModal.tsx` в компактный декларативный оркестратор (~240 строк), разложив логику по сфокусированным хукам и вьюхам, не потеряв ни одного визуального или поведенческого нюанса.

---

## 1. Архитектура декомпозиции

```
VoiceModal.tsx (Оркестратор, ~240 строк)
│
├── Хуки логики (Headless Engines):
│   ├── useLiveAudioSession.ts       (~380 строк) <-- Единый звук и сеть из Этапа 1
│   ├── useBatchInterviewSession.ts  (~160 строк) <-- Управление пакетом 27 вопросов, таймер 5с, чекпоинты FSRS/SQLite
│   └── useSpeechCoachingTelemetry.ts(~150 строк) <-- Аналитика речи STAR/PREP, паузы, Deepgram STT
│
└── Презентационные вьюхи (Pure View Components):
    ├── VoiceLobbyView.tsx           (уже существует, ~350 строк)
    ├── VoiceActiveInterviewView.tsx (НОВЫЙ, ~320 строк) <-- Экран диалога с пульсирующим шаром
    ├── VoiceTransitionView.tsx      (НОВЫЙ, ~200 строк) <-- Экран автоперехода с отсчётом 5 сек
    ├── VoiceVerdictView.tsx         (уже существует, ~380 строк)
    ├── VoiceGrandFinaleView.tsx     (уже существует, ~450 строк)
    └── RubricScorecard.tsx          (уже существует, ~280 строк)
```

---

## 2. Спецификация выносимых модулей

### 2.1. `frontend/src/hooks/useBatchInterviewSession.ts` (~160 строк)
* **За что отвечает:**
  - Текущий индекс вопроса (`activeBatchIndex`, от 0 до 26).
  - Хранилище промежуточных оценок (`batchResults: Record<string, EvaluationResult>`).
  - Таймер автоперехода: 5-секундный обратный отсчет с возможностью паузы (`isTransitionPaused`).
  - **Восстановление при перезагрузке (Mid-Session Recovery):** если пользователь обновил страницу на вопросе 14 из 27, хук восстанавливает сессию из `activeBatchSession` (Zustand + SQLite) без потери оценок за вопросы 1..13!
  - Определение активного вопроса: `currentQuestion`, `activeTopic`, `activeReferenceAnswer`.
* **Что возвращает:**
  ```typescript
  {
    activeBatchIndex,
    totalQuestions,
    isBatchMode,
    currentQuestion,
    batchResults,
    countdown,
    isTransitionPaused,
    recordQuestionEvaluation: (qId: string, result: EvaluationResult) => void,
    goToNextQuestion: () => void,
    skipToQuestion: (index: number) => void,
    toggleTransitionPause: () => void,
    resetBatch: () => void
  }
  ```

### 2.2. `frontend/src/hooks/useSpeechCoachingTelemetry.ts` (~150 строк)
* **За что отвечает:**
  - Локальный замер темпа речи (слов в минуту) и чистоты артикуляции.
  - Fallback на браузерный Web Speech API (`webkitSpeechRecognition`) для локальной подстраховки транскрипта при зашумленном канале.
  - Анализ структуры ответа (STAR: Situation-Task-Action-Result / PREP).
  - **Фоновое Deepgram STT транскрибирование (`/api/stt/transcribe`):** отправка `pcmBase64` чанков после ответа кандидата для генерации дословного текста в итоговом отчете.
* **Что возвращает:**
  ```typescript
  {
    liveClarityMetrics,
    speechCoachingMode,
    setSpeechCoachingMode,
    liveTranscript,
    deepgramTranscript,
    isTranscribing,
    triggerBackgroundStt: (pcmBase64: string) => Promise<string>,
    startCoachingRecognition: () => void,
    stopCoachingRecognition: () => void
  }
  ```

### 2.3. `frontend/src/components/voice/VoiceActiveInterviewView.tsx` (~320 строк)
* **За что отвечает:**
  - Центральный интерактивный пульсирующий шар (Acoustic Aura / Soundwave), реагирующий на `rmsDb` и статус `isAiSpeaking`/`isRecording`.
  - Кнопка тактильного прерывания (Barge-In) с плавной анимацией.
  - Плашка текущей темы и текста вопроса.
  - Выдвижная панель транскрипта текущей реплики.
  - Индикатор задержки (watchdog: «ИИ формулирует ответ...»).
  - Форма текстового ввода (для тихого ввода в наушниках или в транспорте).

### 2.4. `frontend/src/components/voice/VoiceTransitionView.tsx` (~200 строк)
* **За что отвечает:**
  - Круговой индикатор 5-секундного отсчета до следующего вопроса.
  - Кнопки «Пауза / Продолжить», «Следующий вопрос прямо сейчас».
  - Превью текста следующего вопроса.
  - Карточка баллов текущего вопроса с внедренным `RubricScorecard` (штрафы `-X б.`, обоснования, эталонный сниппет).

---

## 3. Критические инварианты интерфейса, сохраняемые в `VoiceModal.tsx`

1. **Reference-Counted Scroll Lock (`useBodyScrollLock`):**
   При открытии модала вызывается `useBodyScrollLock(isOpen)`. Благодаря счетчику ссылок при открытии вложенных шторок (`MemoryRadarDrawer`, `VoiceSettingsDrawer`, `WhiteboardDrawer`) скролл страницы не разблокируется преждевременно.
2. **100dvh Viewport Standard (Мобильная верстка):**
   Классы `modal-overscroll-contain` и `max-h-[96dvh] sm:max-h-[92vh]` сохраняются на родительском контейнере, предотвращая прыжки экрана при скрытии/появлении мобильной адресной строки браузера.
3. **Праздничные эффекты (Confetti Celebrations):**
   Вызов `triggerSuccessConfetti()` сохраняется при получении оценки $\ge 80$ баллов и при переходе на экран `grand_finale`.
4. **Хранение открытых шторок в аккордеоне:**
   `expandedSummaryIds` в Grand Finale для удобного просмотра всех 27 карточек.

---

## 4. Definition of Done (DoD) для Этапа 2

- [ ] Размер `VoiceModal.tsx` составляет менее 300 строк.
- [ ] Все вынесенные модули (`VoiceActiveInterviewView`, `VoiceTransitionView`, хуки) не превышают 350 строк.
- [ ] В квизе по 27 вопросам Spring Framework:
  - Сессия стартует из лобби.
  - AI зачитывает вопрос голосом, микрофон включается после окончания речи.
  - Тактильный Barge-In работает мгновенно.
  - По завершении ответа отображается экран перехода с отсчётом 5 сек и рубрикой баллов 35/35/30.
  - Все 27 вопросов проходятся последовательно без разрывов сессии.
  - При обновлении страницы в середине сессии прогресс восстанавливается из чекпоинта.
  - В финале открывается `VoiceGrandFinaleView` с разворачивающимися аккордеонами и конфетти.
- [ ] `npm run build` проходит без ошибок и предупреждений.
