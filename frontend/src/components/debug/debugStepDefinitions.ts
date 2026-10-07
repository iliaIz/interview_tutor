/**
 * debugStepDefinitions.ts
 * Step-by-step decomposition definitions for Gemini Live v3 (SOTA Late 2026).
 * Cognitive bounding limit: <= 350 lines.
 */

export interface DebugStepDef {
  step: number;
  badge: string;
  title: string;
  subtitle: string;
  layerAdded: string;
  description: string;
  highlights: string[];
  expectedGreeting: string;
  expectedBehavior: string;
  setupPayload: Record<string, any>;
}

export const DEBUG_STEPS: DebugStepDef[] = [
  {
    step: 0,
    badge: 'Baseline OOTB',
    title: 'Шаг 0: Чистый Gemini Live v3 «из коробки»',
    subtitle: 'Абсолютный базис: чистый WebSocket без единой платформенной надстройки',
    layerAdded: 'Только сетевой транспорт WebSocket и базовая генерация звука',
    description:
      'Инициализация Gemini Live v3 без системных промптов, без tools, без XML-манифестов и без кастомных параметров VAD. Проверяет чистоту соединения и базовую отзывчивость модели.',
    highlights: [
      'Чистый setup (только model и voice Aoede)',
      'Никаких systemInstruction',
      'Никаких деклараций инструментов (tools: [])',
      'Никакого заземления на код проекта',
      'Дефолтное VAD поведение Google Gemini Live'
    ],
    expectedGreeting: 'Привет! Это чистая проверка Gemini Live v3 из коробки без надстроек. Скажи мне что-нибудь, и я отвечу.',
    expectedBehavior: 'Модель мгновенно (TTFA < 1.5s) здоровается чистым голосом и ожидает ответ кандидата.',
    setupPayload: {
      setup: {
        model: 'models/gemini-live-v3',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' }
            }
          }
        }
      }
    }
  },
  {
    step: 1,
    badge: '+ System Prompt',
    title: 'Шаг 1: + Системная инструкция роли (System Prompt)',
    subtitle: 'Добавление русскоязычного промпта AI-интервьюера / Тьютора',
    layerAdded: 'systemInstruction (роль, русский язык, лаконичный стиль речи)',
    description:
      'Добавляет в setup сообщение системную инструкцию роли (русский язык, анти-поддакивание, лаконичный формат речевых ответов в 1-2 предложения).',
    highlights: [
      'Промпт роли (Senior Interviewer / Tutor)',
      'Языковой замок: строго русский язык',
      'Инструкция краткости ответов для голоса',
      'Инструменты и код проекта все еще отключены'
    ],
    expectedGreeting: 'Привет! Проверяем системную инструкцию роли на русском языке. Скажи одну короткую фразу: Связь установлена.',
    expectedBehavior: 'Модель отвечает на чистом русском языке с интонацией технического интервьюера.',
    setupPayload: {
      setup: {
        model: 'models/gemini-live-v3',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        },
        systemInstruction: {
          parts: [{ text: 'Ты — опытный Staff/Principal Java интервьюер. Отвечай кратко, емко, строго на русском языке.' }]
        }
      }
    }
  },
  {
    step: 2,
    badge: '+ Grounding',
    title: 'Шаг 2: + Контекст задачи и код (Workspace Grounding)',
    subtitle: 'Передача XML-манифеста проекта и исходного кода Solution.java',
    layerAdded: 'Первый ход с XML-манифестом, Solution.java и условиями задачи',
    description:
      'Включает пакетное заземление на проектное дерево, условия задачи и код решения в первом ходе. Позволяет проверить устойчивость контекстного окна.',
    highlights: [
      'XML-манифест структуры проекта',
      'Исходный код Solution.java',
      'Бизнес-требования и условия задачи',
      'Атомарная передача в Turn 0 без race condition'
    ],
    expectedGreeting: 'Привет! Проверяем контекст и заземление на код проекта. Скажи: Контекст получен.',
    expectedBehavior: 'Модель учитывает код и структуру классов, не вылетая по ошибке переполнения или 1011.',
    setupPayload: {
      setup: {
        model: 'models/gemini-live-v3',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        },
        systemInstruction: {
          parts: [{ text: 'Ты — AI-напарник по парному программированию Java.' }]
        }
      },
      turn0Context: 'XML Workspace Manifest (classes, interfaces) + Solution.java'
    }
  },
  {
    step: 3,
    badge: '+ Function Tools',
    title: 'Шаг 3: + Инструменты вызова функций (Tool Declarations)',
    subtitle: 'Декларация инструментов update_whiteboard и submit_interview_evaluation',
    layerAdded: 'tools: [{ functionDeclarations: [...] }] в конфигурации сессии',
    description:
      'Включает декларации инструментов вызова функций в setup. Проверяет, не вызывают ли схемы инструментов галлюцинаций tool_call на нулевом ходе и не подвешивают ли сессию.',
    highlights: [
      'Схема update_whiteboard для архитектурных правок',
      'Схема submit_interview_evaluation для вердикта',
      'First-Turn Tool Lockdown (блокировка вызова вердикта на Turn 0)',
      'Строгая JSON-валидация параметров'
    ],
    expectedGreeting: 'Привет! Проверяем инструменты и вызовы функций. Скажи: Проверка инструментов.',
    expectedBehavior: 'Модель не срывается в преждевременные tool-вызовы и ведет естественный диалог.',
    setupPayload: {
      setup: {
        model: 'models/gemini-live-v3',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        },
        systemInstruction: { parts: [{ text: 'AI-Тьютор с возможностью работы с холстом.' }] },
        tools: [{
          functionDeclarations: [
            { name: 'update_whiteboard', description: 'Обновление архитектурной диаграммы' },
            { name: 'submit_interview_evaluation', description: 'Финальная оценка ответа' }
          ]
        }]
      }
    }
  },
  {
    step: 4,
    badge: '+ Cloud VAD',
    title: 'Шаг 4: + Серверный Cloud VAD & Транскрипция',
    subtitle: 'Активация automaticActivityDetection и текстовых транскрипций',
    layerAdded: 'automaticActivityDetection (800ms) + input/output audio transcription',
    description:
      'Включает облачный Voice Activity Detection Gemini Live для автоматического определения пауз кандидата (silenceDurationMs) и распознавание речи.',
    highlights: [
      'automaticActivityDetection: { silenceDurationMs: 800, prefixPaddingMs: 500 }',
      'inputAudioTranscription (распознавание речи кандидата)',
      'outputAudioTranscription (распознавание речи ИИ)',
      'Синхронные субтитры в реальном времени'
    ],
    expectedGreeting: 'Привет! Проверяем серверный Cloud VAD и транскрипцию речи. Ответь мне короткой фразой.',
    expectedBehavior: 'Облачный VAD чисто отсекает паузы 800ms и автоматически начинает генерацию ответа.',
    setupPayload: {
      setup: {
        model: 'models/gemini-live-v3',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        },
        systemInstruction: { parts: [{ text: 'AI-Собеседник с облачным VAD.' }] },
        automaticActivityDetection: { disabled: false, silenceDurationMs: 800, prefixPaddingMs: 500 },
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    }
  },
  {
    step: 5,
    badge: '+ Client Tract',
    title: 'Шаг 5: + Клиентский звуковой тракт и Silero VAD',
    subtitle: 'Локальный микрофон, AudioWorklet ring buffer и нейросетевой Silero VAD v5',
    layerAdded: 'Клиентский захват микрофона, Silero VAD v5 Fast-Handoff и стриминг 16кГц',
    description:
      'Подключает клиентскую цепочку Web Audio API: захват микрофона 16кГц Mono PCM, детекцию речи через Silero VAD v5 в Web Worker и Fast-Handoff через audioStreamEnd.',
    highlights: [
      'AudioWorklet ring buffer 2^22 сэмплов (защита от переполнения)',
      'Silero VAD v5 WebAssembly (порог речи 0.45, гистерезис)',
      'Fast-Handoff сигнал { realtimeInput: { audioStreamEnd: true } }',
      'Устранение паразитного эха (EchoGuard +450ms)'
    ],
    expectedGreeting: 'Привет! Проверяем клиентский звуковой тракт и Silero VAD. Скажи что-нибудь в микрофон.',
    expectedBehavior: 'Индикатор громкости и речи на клиенте реагирует мгновенно, звук передается чисто.',
    setupPayload: {
      clientPipeline: {
        sampleRate: 16000,
        channels: 1,
        vadEngine: 'Silero VAD v5 (ONNX/WASM)',
        ringBufferSizeSamples: 4194304,
        echoGuardHoldoffMs: 450
      }
    }
  },
  {
    step: 6,
    badge: 'Full Production',
    title: 'Шаг 6: + Полный стек платформы AI-Напарника',
    subtitle: 'Все защитные контуры: FSM, Dead Air Guard, Двухфазный Watchdog, Non-Speech фильтр',
    layerAdded: 'Полный боевой комплекс отказоустойчивости (FSM + Guardrails + Reconnect)',
    description:
      'Боевой стек платформы: Turn 0 lockdown, LiveDeadAirGuard против зависания вокодера, двухфазный watchdog (5с/18с), фильтрация токенов <no speech> и тактильный Barge-in.',
    highlights: [
      'LiveDeadAirGuard (клампинг тишины >1200ms/2000ms)',
      'Двухфазный Watchdog (5с Nudge / 18с Interruption Recovery)',
      'Фильтрация артефактов <no speech> и системных сбоев',
      'Автономный таймер безопасности клиента (22с fallback)',
      'Тактильный Barge-In с de-click рампой 5ms'
    ],
    expectedGreeting: 'Привет! Я готов к разбору задачи. Поприветствуй меня в 1 коротком предложении и предложи план.',
    expectedBehavior: 'Штатный режим AI-Напарника с полной защитой от зависаний, рассинхронов и обрывов связи.',
    setupPayload: {
      guards: {
        deadAirClampMs: 2000,
        watchdogNudgeSec: 5.0,
        watchdogTimeoutSec: 18.0,
        clientSafetyFallbackSec: 22.0,
        turn0Lockdown: true
      }
    }
  }
];
