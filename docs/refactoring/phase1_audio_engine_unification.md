# Этап 1: Унификация Аудио-Ядра (`useLiveAudioSession`)

> **Цель:** Создать один канонический, надежный, полностью типизированный хук `useLiveAudioSession.ts` (~380 строк), ликвидировав дублирование между `useLegacyLiveAudioSession` и встроенным кодом `VoiceModal`, сохранив 100% критических нюансов.

---

## 1. Проблема, которую решаем

Прямо сейчас в проекте:
- `VoiceModal.tsx` имеет собственную inline-реализацию WebSocket, микрофона и AudioWorklet на 1500+ строк.
- `useLegacyLiveAudioSession.ts` (898 строк) частично дублирует этот код, но в нём отсутствуют критические фичи (Deictic Grounding ревизий кода, тикет-авторизация, WakeLock, буферизация PCM для фонового Deepgram STT).
- `useLiveKitAudioSession.ts` (551 строка) пытался ходить на несуществующий порт 7880 и падал по таймауту.

---

## 2. Архитектурный контракт хука (`types/voice.ts`)

Хук экспортирует строгий, исчерпывающий интерфейс:

```typescript
export interface LiveAudioSessionOptions {
  // Идентификация и параметры темы
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'practice';
  tutorMode?: 'deep_dive' | 'free_chat' | 'socratic' | 'eli5' | 'bug_hunt' | 'practice_pair';
  topic?: string;
  questionId?: string;
  questionText?: string;
  referenceAnswer?: string;
  
  // Конфигурация голоса и персоны
  voice?: string;
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
  vadPauseMs?: number;
  liveModel?: string;
  persona?: string;
  targetGrade?: string;
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  
  // Пакетная навигация
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  
  // Сценарные поля (Practice, Bug Hunt, System Design)
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  hints?: string[];
  initialUserMessage?: string;
  
  // Коллбэки событий и инструментов
  onSetupComplete?: () => void;
  onEvaluationCompleted?: (evaluation: VoiceEvaluationResult) => void;
  onWhiteboardUpdate?: (payload: WhiteboardUpdatePayload) => void;
  onBugSolved?: (payload: any) => void;
  onCandidateObservationRecorded?: (observation: any) => void;
  onHiringCommitteeVerdict?: (verdict: any) => void;
  onError?: (errorMsg: string) => void;
  onDisconnect?: () => void;
}

export interface LiveAudioSessionState {
  // Статусы сессии
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isThinking: boolean;
  isMuted: boolean;
  isSessionPaused: boolean;
  thinkingStage: 'idle' | 'processing' | 'delayed' | 'critical';
  
  // Метрики звука и сети
  rmsDb: number;
  rttMs: number | null;
  statusMessage: string;
  
  // Диалог и буферы
  dialogueTurns: DialogueTurn[];
  aiTranscript: string;
  
  // Управляющие методы
  startSession: (overrideParams?: Partial<LiveAudioSessionOptions>) => Promise<void>;
  stopSession: () => Promise<void>;
  toggleMute: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  handleBargeIn: (reason?: string) => void;
  sendTextMessage: (text: string, displayText?: string) => Promise<void>;
  injectCodeRevisionGrounding: (title: string, code: string, language?: string) => void;
  
  // Буфер сырого звука для высокоточного фонового STT транскрибирования
  getRecordedPcmBase64: () => string;
  clearRecordedPcm: () => void;
}
```

---

## 3. Критические нюансы реализации, которые ОБЯЗАТЕЛЬНО сохраняются

1. **Подавление перекрёстного звука (Ambient Crosstalk Suppression):**
   При старте аудио-сессии вызывается глушение всех других плееров на странице:
   `document.querySelectorAll('audio').forEach(el => { try { el.pause(); } catch {} });`
   Это гарантирует, что если кандидат слушал подкаст рекапа или урока, звук не попадёт в микрофон.

2. **Буферизация сырого PCM для фонового Deepgram STT:**
   Во время речи кандидата чанки Little-Endian Int16 накапливаются в `userPcmChunksRef`.
   После завершения ответа метод `getRecordedPcmBase64()` позволяет отправить аудио в `/api/stt/transcribe` для получения стенограммы с таймкодами слов, не нагружая сокет во время диалога.

3. **Безопасная авторизация через One-Time Ticket:**
   - Предзагрузка тикета через `POST /api/auth/ws-ticket` (с куки fallback).
   - Формирование URL строго на порт 443: `wss://${window.location.host}/ws/live?...`.

4. **Аудио-конвейер высокой надежности:**
   - Единый синглтон `AudioPlayoutManager` с защитой от щелчков (5ms fade-out de-click ramp).
   - AudioWorklet (`/worklets/audio-capture-processor.js`) с Little-Endian 16-bit PCM конвертацией на 16/24 кГц.
   - Hardware AEC (`echoCancellation: true, noiseSuppression: true, autoGainControl: true`).
   - Защита от эха помещения: 450 мс кулдаун (`isReverbCooldownActive`) после окончания речи AI, в течение которого VAD не триггерится.
   - Защита от микрокликов: минимальный порог речи 150 мс для коротких ответов («Да», «Нет», «Ок»).

5. **Dual-Sided Handshake & Tactile Barge-In:**
   - Микрофон активируется симметрично последним из двух событий: опустошение физического буфера динамиков + получение серверного `turnComplete: true`.
   - При клике или голосе кандидата — мгновенная пауза воспроизведения, сброс AudioWorklet (`RESET`) и отправка Barge-In кадра на бэкенд.

6. **Deictic Grounding (Зрение на экран и выделение текста):**
   - Интеграция с `useSelectionFocusStore`: если пользователь выделил фрагмент кода или термин на экране перед ответом или текстом, хук автоматически оборачивает реплику в блок `[ФОКУС ВНИМАНИЯ КАНДИДАТА: ...]` и очищает фокус.
   - Метод `injectCodeRevisionGrounding()` передает в сокет тихий кадр контекста, когда пользователь переключает ревизию задачи.

7. **Мобильная стабильность:**
   - Интеграция с `navigator.wakeLock` (экран смартфона не тухнет во время сессии).
   - Интеграция с `visibilitychange` (AudioContext корректно возобновляется при возврате в браузер).

8. **Watchdog-таймеры задержки:**
   - 3.5 сек $\rightarrow$ статус «delayed».
   - 6.5 сек $\rightarrow$ статус «critical» (полоса восстановления).
   - 10.0 сек $\rightarrow$ мягкая разблокировка микрофона или REST eval fallback (в зависимости от `sessionType`).

---

## 4. Потребители, переключаемые на Этапе 1

Хук сразу подключается к следующим компонентам:
1. `frontend/src/components/practice/tutor/PracticeVoiceHUD.tsx` (AI-Напарник в Практике).
2. `frontend/src/components/system_design/SystemDesignArena.tsx` (Защита архитектуры).
3. `frontend/src/components/incidents/BugHuntArena.tsx` (Поиск багов).

> **Важно:** `VoiceModal.tsx` на Этапе 1 **НЕ трогается**, чтобы минимизировать риски. Он будет переключен на Этапе 2.

---

## 5. Definition of Done (DoD) для Этапа 1

- [ ] Файл `useLiveAudioSession.ts` содержит не более 420 строк.
- [ ] Экспорт строго типизирован через `LiveAudioSessionOptions` и `LiveAudioSessionState`.
- [ ] В `PracticeVoiceHUD`, `SystemDesignArena` и `BugHuntArena` звук запускается по порту 443 без единой ошибки в консоли.
- [ ] Тактильный Barge-In мгновенно прерывает речь модели на всех трех аренах.
- [ ] Буфер PCM накапливается и доступен через `getRecordedPcmBase64()`.
- [ ] `npm run build` проходит без TypeScript ошибок.
