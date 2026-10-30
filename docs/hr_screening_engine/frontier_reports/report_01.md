# Архитектура прикладного движка HR\-симулятора \- Google Gemini

**Date**: October 30, 2026 at 03:11 PM
**Turns**: 1
**Source**: [Gemini Chat](https://gemini.google.com/app/9e5a2ed453c25126)

---

## Turn 1

### 🤖 ИИ Ассистент

Архитектурная спецификация и атомарный план имплементации `Generic HR Voice Simulator Engine` для сервиса `interview_tutor`.

## 1. Root Cause & Architecture Decision

### 1.1. Устранение когнитивного ступора без формирования техдолга
Проблема деградации речи на реальном HR-скрининге («переход на бытовой язык и оправдания») вызвана конфликтом между **декларативной памятью** (чтение текста глазами) и **процедурной речевой моторикой** в условиях кортизолового стресса. Когда кандидат слышит провокационный вопрос о перерыве в стаже (Gap), статусе НПД или причинах ухода, активируется защитная реакция, блокирующая доступ к сложным синтаксическим конструкциям.
Архитектурное решение разделяет систему на три строго изолированных слоя:

1. **Декларативное ядро метаданных (`CandidateDossier` + `JobContext`):** Движок не содержит упоминаний конкретных компаний, дат или биографий. Любой сценарий подается как сериализуемый JSON-контракт, валидируемый через `@sinclair/typebox`.
2. **Детерминированный оркестратор фаз поверх мультимодального сокета (`HrSimulationOrchestrator`):** Gemini Live API отлично поддерживает непрерывный голосовой поток, но склонен к контекстному дрейфу (Context Drift) на звонках длительностью более 10 минут. Вместо того чтобы полагаться на «память» LLM о структуре интервью, переходы между этапами (`SmallTalk` → `ElevatorPitch` → `GapProbe` и т.д.) управляются конечным автоматом на бэкенде через **Function Calling (`liveToolDispatcher.ts`)** и принудительную инъекцию фазовых директив (`clientContent` с `turnComplete: false`) в живой сеанс.
3. **Двухконтурный моторный бурильщик (`Micro-Drill Topology` + `Zero-Latency HUD`):** Для перевода лексики в мышечную память кандидат видит перед собой карточку с 3–5 опорными маркерами (Anchor Terms). Произнесение термина мгновенно подсвечивает карточку зеленым и фиксирует моторный паттерн.

### 1.2. Архитектурный выбор для Zero-Latency Keyword Spotting (менее 200 мс)
Для обеспечения визуального отклика карточки менее 200 мс от момента артикуляции были проанализированы три подхода:

- **Вариант 1: Серверная транскрипция из событий Gemini Live WebSocket (`serverContent.inputTranscription`).**
  - *Проблема:* Gemini Live агрегирует входные PCM-фреймы и отправляет пользовательскую транскрипцию чанками с сетевым RTT и буферизацией декодера. Реальная задержка составляет от 380 до 850 мс, что нарушает инвариант менее 200 мс и разрушает дофаминовую петлю обратной связи.
- **Вариант 2: Дублирующий серверный ASR-поток через бэкенд.**
  - *Проблема:* Удваивает полосу пропускания WebSocket и создает гонку состояний между двумя потоками распознавания.
- **Вариант 3 (Выбранный SOTA-подход): Двухуровневая гибридная архитектура (Dual-Path Hybrid KWS).**
  - **Fast-Path (Клиентский контур, задержка 60–140 мс):** Параллельно с `NativeLiveVoiceEngine.ts` на клиенте запускается легковесный `ClientKeywordSpotter`. Он использует нативный браузерный поток промежуточных гипотез (`SpeechRecognition` с `continuous = true`, `interimResults = true`) в связке с нечетким фонетическим и морфологическим стеммером на базе алгоритма Дамерау — Левенштейна и префиксного дерева (Trie) для русского и английского языков. При появлении первых слогов опорного слова в `interimResults` (до окончания фразы) префиксный матчер мгновенно переводит карточку на HUD в состояние `HIT_OPTIMISTIC` и отправляет легковесное событие `HR_ANCHOR_HIT` на сервер.
  - **Authoritative-Path (Серверный контур сверки):** Бэкенд получает финальную транскрипцию реплики из Gemini Live API и список оптимистичных срабатываний от клиента, нормализует их и использует как единый источник истины (Single Source of Truth) для `HrScorecard` и `HrPromptBuilder`.

## 2. Assumptions & Blind Spots
Поскольку проектирование выполняется в режиме Zero-Context Escalation, зафиксированы следующие архитектурные допущения о закрытых файлах репозитория:

1. **`liveWsConnectionHandler.ts`:** Предполагается, что обработчик проксирует двусторонний поток между клиентским `ws` и сессией `@google/genai` (`ai.live.connect`), умеет перехватывать входящие клиентские JSON-сообщения по полю `type` (из `LIVE_VOICE_EVENTS`) и отправлять в Gemini Live сервисные сообщения через `session.sendClientContent()`.
2. **`liveToolDispatcher.ts`:** Предполагается, что диспетчер инструментов обрабатывает вызовы `toolCall` от Gemini Live и возвращает `toolResponse`. Мы расширим его инструментом `advance_hr_phase` и `submit_hr_evaluation` без изменения сигнатуры существующих технических инструментов (`whiteboard`, `bug_solved`).
3. **`NativeLiveVoiceEngine.ts`:** Предполагается, что голосовой движок фронтенда предоставляет подписку на события сокета и жизненный цикл VAD (`@ricky0123/vad-web`: `onSpeechStart`, `onSpeechEnd`), либо позволяет подключить параллельный слушатель к существующему `MediaStream` без нарушения работы программного Audio Mutex.
4. **Хранилище состояний фронтенда (`frontend/src/stores/`):** Предполагается использование изолированных сторов Zustand. Мы создадим отдельный стор `useHrSimulatorStore.ts`, чтобы не мутировать существующий стор технических интервью.

## 3. Data Contracts & Interfaces (TypeBox & TypeScript)

### 3.1. Схемы досье, вакансии, телеметрии и скоринга (`shared/src/schemas/hrSimulator.ts`)

```typescript
// interview_tutor/shared/src/schemas/hrSimulator.ts
import { Type, Static } from '@sinclair/typebox';

export const LegalTaxStatusSchema = Type.Union([
  Type.Literal('TK_RF'),
  Type.Literal('NPD_SELF_EMPLOYED'),
  Type.Literal('IP_CONTRACTOR'),
  Type.Literal('GPH'),
  Type.Literal('HYBRID_NEGOTIABLE')
]);

export const MilitaryRegistrationStatusSchema = Type.Union([
  Type.Literal('NOT_APPLICABLE'),
  Type.Literal('REGISTERED_VALID'),
  Type.Literal('EXEMPT'),
  Type.Literal('DEFERRED')
]);

export const CareerPeriodSchema = Type.Object({
  id: Type.String(),
  periodType: Type.Union([
    Type.Literal('COMMERCIAL_EMPLOYMENT'),
    Type.Literal('CONTRACT_PROJECT'),
    Type.Literal('SABBATICAL_RD'),
    Type.Literal('CAREER_GAP')
  ]),
  organizationAlias: Type.String(), // Без хардкода в движке, подается из DTO
  roleTitle: Type.String(),
  startDateIso: Type.String(),
  endDateIso: Type.Union([Type.String(), Type.Literal('PRESENT')]),
  officialRecordType: Type.String(),
  verifiedAchievements: Type.Array(Type.String()),
  mandatoryAnchorTerms: Type.Array(Type.String()),
  allowedExplanationNarrative: Type.String(),
  forbiddenDefensivePhrases: Type.Array(Type.String())
});

export const ProjectPortfolioItemSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  domain: Type.String(),
  architectureStack: Type.Array(Type.String()),
  quantifiableMetrics: Type.Array(Type.String()),
  anchorKeywords: Type.Array(Type.String())
});

export const CandidateDossierSchema = Type.Object({
  dossierId: Type.String(),
  targetRoleTitle: Type.String(),
  totalVerifiedExperienceMonths: Type.Integer({ minimum: 0 }),
  legalTaxStatus: LegalTaxStatusSchema,
  militaryStatus: MilitaryRegistrationStatusSchema,
  compensationBoundaries: Type.Object({
    currency: Type.Union([Type.Literal('RUB'), Type.Literal('USD'), Type.Literal('EUR')]),
    minimumFloorNet: Type.Number({ minimum: 0 }),
    targetComfortNet: Type.Number({ minimum: 0 }),
    stretchGoalNet: Type.Number({ minimum: 0 }),
    justificationAnchors: Type.Array(Type.String())
  }),
  careerTimeline: Type.Array(CareerPeriodSchema),
  projectPortfolio: Type.Array(ProjectPortfolioItemSchema),
  globalForbiddenWords: Type.Array(Type.String())
});

export type CandidateDossier = Static<typeof CandidateDossierSchema>;

export const JobContextSchema = Type.Object({
  jobId: Type.String(),
  companyArchetype: Type.Union([
    Type.Literal('FINTECH_ENTERPRISE'),
    Type.Literal('BIGTECH_PRODUCT'),
    Type.Literal('RETAIL_ECOMMERCE'),
    Type.Literal('AI_STARTUP')
  ]),
  domain: Type.String(),
  requiredStack: Type.Array(Type.String()),
  complianceStrictness: Type.Union([
    Type.Literal('HIGH_SECURITY_BACKGROUND_CHECK'),
    Type.Literal('STANDARD_CORPORATE'),
    Type.Literal('RESULTS_ONLY_FLEXIBLE')
  ]),
  keyScreeningRedFlags: Type.Array(Type.String()),
  mustHaveKeywords: Type.Array(Type.String())
});

export type JobContext = Static<typeof JobContextSchema>;

export const HrPhaseIdSchema = Type.Union([
  Type.Literal('SMALL_TALK'),
  Type.Literal('ELEVATOR_PITCH'),
  Type.Literal('CAREER_DEEP_DIVE'),
  Type.Literal('GAP_PROBE'),
  Type.Literal('COMPLIANCE_FINANCIALS'),
  Type.Literal('CANDIDATE_REVERSE_QA'),
  Type.Literal('SCORECARD')
]);

export type HrPhaseId = Static<typeof HrPhaseIdSchema>;

export const HrTopologyModeSchema = Type.Union([
  Type.Literal('E2E_SIMULATION'),
  Type.Literal('MICRO_DRILL')
]);

export type HrTopologyMode = Static<typeof HrTopologyModeSchema>;

export const HrAnchorCardSchema = Type.Object({
  id: Type.String(),
  canonicalTerm: Type.String(),
  matchStems: Type.Array(Type.String()),
  category: Type.Union([
    Type.Literal('METRIC'),
    Type.Literal('TECH_TERM'),
    Type.Literal('LEGAL_COMPLIANCE'),
    Type.Literal('LEADERSHIP_ACTION')
  ]),
  isMandatory: Type.Boolean()
});

export type HrAnchorCard = Static<typeof HrAnchorCardSchema>;

export const HrSessionConfigSchema = Type.Object({
  topologyMode: HrTopologyModeSchema,
  dossier: CandidateDossierSchema,
  jobContext: JobContextSchema,
  activePhase: HrPhaseIdSchema,
  drillTargetQuestion: Type.Optional(Type.String()),
  activeAnchorCards: Type.Array(HrAnchorCardSchema),
  turnWindowSoftLimitSec: Type.Integer({ default: 60 }),
  turnWindowHardLimitSec: Type.Integer({ default: 80 }),
  minRequiredWpm: Type.Integer({ default: 90 }),
  maxAllowedWpm: Type.Integer({ default: 160 }),
  hesitationThresholdMs: Type.Integer({ default: 1500 })
});

export type HrSessionConfig = Static<typeof HrSessionConfigSchema>;

export const HrTelemetryTickSchema = Type.Object({
  sessionId: Type.String(),
  turnId: Type.String(),
  elapsedTurnSec: Type.Number(),
  windowStatus: Type.Union([
    Type.Literal('OPTIMAL'),
    Type.Literal('WARNING_60S'),
    Type.Literal('CRITICAL_80S_EXCEEDED')
  ]),
  rollingWpm: Type.Number(),
  pacingStatus: Type.Union([
    Type.Literal('FREEZING_LOW'),
    Type.Literal('OPTIMAL_PACE'),
    Type.Literal('RUSHING_HIGH')
  ]),
  hesitationBurstsCount: Type.Integer({ minimum: 0 }),
  maxHesitationDurationMs: Type.Number({ minimum: 0 }),
  fillerWordsDetected: Type.Array(
    Type.Object({
      word: Type.String(),
      timestampMs: Type.Number()
    })
  ),
  anchorHits: Type.Array(
    Type.Object({
      anchorId: Type.String(),
      hitTimestampMs: Type.Number(),
      latencyFromSpeechMs: Type.Number(),
      source: Type.Union([Type.Literal('CLIENT_FAST_KWS'), Type.Literal('SERVER_RECONCILED')])
    })
  )
});

export type HrTelemetryTick = Static<typeof HrTelemetryTickSchema>;

export const HrScorecardSchema = Type.Object({
  sessionId: Type.String(),
  topologyMode: HrTopologyModeSchema,
  phaseOrDrillId: Type.String(),
  overallScore: Type.Integer({ minimum: 0, maximum: 100 }),
  axes: Type.Object({
    substanceAndTruthfulness: Type.Object({
      score: Type.Integer({ minimum: 0, maximum: 100 }),
      dossierAlignmentFacts: Type.Array(Type.String()),
      detectedHallucinationsOrContradictions: Type.Array(Type.String())
    }),
    lexicalDensity: Type.Object({
      score: Type.Integer({ minimum: 0, maximum: 100 }),
      anchorsHitCount: Type.Integer(),
      anchorsTotalCount: Type.Integer(),
      colloquialismsReplacedSuggestions: Type.Array(
        Type.Object({
          spokenPhrase: Type.String(),
          executiveReplacement: Type.String()
        })
      )
    }),
    structureAndPacing: Type.Object({
      score: Type.Integer({ minimum: 0, maximum: 100 }),
      averageWpm: Type.Number(),
      turnDurationSec: Type.Number(),
      starCompliance: Type.Boolean(),
      pacingVerdict: Type.String()
    }),
    confidenceAndDelivery: Type.Object({
      score: Type.Integer({ minimum: 0, maximum: 100 }),
      fillerWordCount: Type.Integer(),
      hesitationBurstCount: Type.Integer(),
      defensiveMarkersDetected: Type.Array(Type.String())
    })
  }),
  passThresholdMet: Type.Boolean(),
  immediateDrillPrescription: Type.String()
});

export type HrScorecard = Static<typeof HrScorecardSchema>;

```

### 3.2. Расширение `LIVE_VOICE_EVENTS` (`shared/src/schemas/voiceEvents.ts`)

```typescript
// Дополнение в LIVE_VOICE_EVENTS (interview_tutor/shared/src/schemas/voiceEvents.ts)
export const LIVE_VOICE_EVENTS = {
  // ... существующие события без изменений ...
  SETUP_COMPLETE: 'setupComplete',
  UPSTREAM_READY: 'upstream_ready',
  UPSTREAM_RECONNECTING: 'upstream_reconnecting',
  EVALUATION_COMPLETED: 'evaluation_completed',
  EVALUATION_LEGACY: 'evaluation',
  WHITEBOARD_UPDATE: 'whiteboard_update',
  BUG_SOLVED: 'bug_solved',
  STREAM_RECOVERY: 'stream_recovery',
  DEAD_AIR_RECOVERY: 'dead_air_recovery',
  TURN_TELEMETRY: 'turn_telemetry',
  PONG: 'pong',
  PONG_ACK: 'pong_ack',

  // Downstream HR Simulator Events (Gateway -> Client)
  HR_PHASE_CHANGE: 'hr_phase_change',
  HR_SCORECARD: 'hr_scorecard',
  HR_DRILL_RETRY_PROMPT: 'hr_drill_retry_prompt',
  HR_ANCHOR_RECONCILED: 'hr_anchor_reconciled',

  // Upstream from Client -> Gateway
  BARGE_IN: 'barge_in',
  TURN_RESET: 'turn_reset',
  SESSION_HOLD: 'session_hold',
  CANVAS_DELTA: 'canvas_delta',
  PING: 'ping',
  SYNC_PING: 'sync_ping',

  // Upstream HR Simulator Events (Client -> Gateway)
  HR_ANCHOR_HIT: 'hr_anchor_hit',
  HR_TELEMETRY_SNAPSHOT: 'hr_telemetry_snapshot',
  HR_FORCE_PHASE_ADVANCE: 'hr_force_phase_advance'
} as const;

```

### 3.3. Расширение `InterviewPersonaId`, `LiveWsSessionParams` и `VoiceEngineConfig`

```typescript
// 1. interview_tutor/backend/src/prompts/personas.ts
export type InterviewPersonaId =
  | 'mentor'
  | 'amazon_bar_raiser'
  | 'google_staff'
  | 'yandex_core'
  | 'hr_keyword_screener'     // Поверхностный скринер по чек-листу ключевых слов
  | 'hr_fintech_compliance'   // Подозрительный офицер комплаенса банка/финтеха
  | 'hr_conflict_psychologist'; // Психолог-охотник за конфликтами и токсичностью

// 2. interview_tutor/backend/src/services/live/liveWsSessionParams.ts
import { HrSessionConfig } from '@interview-tutor/shared';

export interface LiveWsSessionParams {
  // ... все существующие поля сохраняются ...
  sessionType: 'interview' | 'tutor' | 'system_design' | 'hr_screening';
  hrConfig?: HrSessionConfig; // Опциональный контракт для HR-симулятора
}

// 3. interview_tutor/frontend/src/audio/types.ts
import { HrSessionConfig } from '@interview-tutor/shared';

export interface VoiceEngineConfig {
  // ... все существующие поля сохраняются ...
  sessionType: 'interview' | 'tutor' | 'system_design' | 'incident' | 'hr_screening' | string;
  hrConfig?: HrSessionConfig;
}

```

## 4. Dialogue & Telemetry Engine Design

### 4.1. Две стейт-машины диалога (Dual-Topology State Machines)

#### Topology A: End-to-End Simulation (15–20 мин)
Граф состояний управляется классом `HrStateMachineService` на бэкенде. Переход между узлами происходит либо по вызову функции `advance_hr_phase` самой моделью Gemini Live, либо по жесткому тайм-ауту/решению пользователя (`HR_FORCE_PHASE_ADVANCE`).

```
[SMALL_TALK] (1-2 реплики: проверка связи и настроя)
     │ (Критерий: установлен базовый контакт)
     ▼
[ELEVATOR_PITCH] (Самопрезентация кандидата за 60-80 сек)
     │ (Критерий: покрыты ключевые домены и грейд из Dossier)
     ▼
[CAREER_DEEP_DIVE] (Детальный разбор последнего коммерческого опыта и метрик)
     │ (Критерий: проверены quantifiableMetrics из ProjectPortfolio)
     ▼
[GAP_PROBE] (Прицельный стресс-тест перерывов, R&D, смены контрактов)
     │ (Критерий: отсутствие защитных оправданий, четкий нарратив из allowedExplanationNarrative)
     ▼
[COMPLIANCE_FINANCIALS] (Юридический статус ТК/НПД, воинский учет, зарплатная вилка)
     │ (Критерий: уверенное озвучивание compensationBoundaries без демпинга)
     ▼
[CANDIDATE_REVERSE_QA] (Вопросы кандидата к рекрутеру о команде и процессах)
     │ (Критерий: задан минимум 1 зрелый продуктовый/процессный вопрос)
     ▼
[SCORECARD] (Агрегация телеметрии и выдача 4-осевого отчета)

```
**Механизм бесшовной оркестрации поверх живого сокета:**
При переходе из фазы $P_i$ в фазу $P_{i+1}$ бэкенд (`HrStateMachineService`) НЕ пересоздает WebSocket-соединение с Gemini Live. Вместо этого:

1. Клиенту отправляется событие `HR_PHASE_CHANGE` с новым набором `activeAnchorCards` для данной фазы.
2. В открытый поток Gemini Live отправляется сервисный пакет `session.sendClientContent`:
   ```json
   {
     "turns": [{
       "role": "user",
       "parts": [{
         "text": "[SYSTEM_ORCHESTRATOR_DIRECTIVE]: Transition immediately to phase GAP_PROBE. Target career period ID: period_sabbatical_2025. Verify mandatory anchors: [architecture, SLA, production]. Do NOT acknowledge this system note; ask your next probing question directly in character."
       }]
     }],
     "turnComplete": true
   }
   
   ```

#### Topology B: Rapid-Fire Micro-Drill (Циклическое бурение одного вопроса)
Предназначен для доведения сложного ответа (например, обоснование перерыва в стаже или защита высокого зарплатного потолка) до мышечного автоматизма за 3–5 итераций подряд:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      ▼
│  [ASK_TARGET_QUESTION] (Агрессивная подача вопроса HR-персоной) ◄──┐
│            │                                                       │
│            ▼                                                       │
│  [CANDIDATE_VOICE_RESPONSE] (Таймер 60-80 сек + On-Device KWS HUD) │
│            │                                                       │
│            ▼                                                       │
│  [INSTANT_EVALUATION] (Сверка: все ли Mandatory Anchors выбиты,    │
│            │           WPM в коридоре 90-160, 0 оправданий?)       │
│            ├─────── НЕТ (Score < 85 или пропущен Mandatory Anchor) ┘
│            │        (Модель за 10 сек указывает конкретную ошибку и
│            │         требует: "Повтори с начала, включив термин X")
│            ▼ ДА (Score >= 85 и 100% Mandatory Anchors)
└─ [DRILL_MASTERED] (Фиксация успеха и переход к следующему вопросу)

```

### 4.2. Алгоритмы расчета речевой и поведенческой телеметрии в реальном времени
Телеметрия вычисляется на клиенте в модуле `HrSpeechTelemetryMonitor.ts` с частотой обновления HUD 4 Гц (каждые 250 мс) и отправкой итогового слепка на бэкенд в конце реплики:

1. **Скользящее окно WPM (10-секундный кольцевой буфер):**
  - Каждое распознанное слово (из промежуточного и финального потока) сохраняется в массив `wordTimestamps: number[]`.
  - На каждом тике $t_{now}$ удаляются элементы старше $t_{now} - 10000\text{ мс}$.
  - Чтобы в первые 4 секунды реплики не возникали математические выбросы, рассчитывается эффективное окно $\Delta t = \max(4.0, \min(10.0, (t_{now} - t_{speechStart}) / 1000))$.
  - Формула: $\text{WPM}_{rolling} = \text{round}\left(\frac{N_{words\_in\_window}}{\Delta t} \times 60\right)$.
  - Если $\text{WPM}_{rolling}$ выше 160 — статус `RUSHING_HIGH` (индикатор паники/тараторения). Если ниже 90 при длительности реплики более 5 секунд — статус `FREEZING_LOW` (когнитивный ступор).
2. **Детекция пауз нерешительности (Hesitation Detection более 1500 мс):**
  - Интегрируется с колбэками `@ricky0123/vad-web` внутри активного пользовательского хода (`VoiceEngineState === 'LISTENING'`).
  - Когда после первого произнесенного слова срабатывает `onVADMisfire` / локальная тишина в PCM-фреймах (RMS ниже порога речи), запускается таймер тишины $t_{silence}$.
  - Если пользователь возобновляет речь до срабатывания серверного `turnComplete`, и $t_{resume} - t_{silence}$ превышает 1500 мс, инкрементируется счетчик `hesitationBurstsCount`, а длительность паузы записывается в телеметрию.
3. **Детекция слов-паразитов (Filler Words):**
  - Поток токенов проверяется регулярным выражением по границам слов (с учетом русской морфологии и многословных конструкций):`/(?:^|\s)(как бы|в общем-то|в общем|ну типа|типа того|типа|короче говоря|короче|наверное|собственно говоря|так сказать|вот значит)(?=\s|$|[,.!?])/giu`.
  - Каждое совпадение помечается хэшем позиции в строке реплики, чтобы избежать повторного срабатывания на пересчете `interimResults`.
4. **Контроль временного окна (60–80 секунд):**
  - Отсчет начинается с первого речевого фрейма VAD в текущем ходе кандидата.
  - От 0 до 59 сек: `OPTIMAL` (спокойный индикатор прогресса).
  - От 60 до 79 сек: `WARNING_60S` (желтая рамка HUD, сигнал «Переходи к выводу / Result»).
  - От 80 сек и выше: `CRITICAL_80S_EXCEEDED` (красная пульсация HUD, сигнал «Потеря внимания рекрутера»).

### 4.3. Алгоритм 4-осевого объективного скоринга (`HrEvaluationEngine.ts`)
Каждая ось оценивается по шкале от 0 до 100 баллов путем комбинации детерминированных метрик телеметрии (60% веса) и структурированной LLM-оценки по рубрикатору (40% веса):

1. **Substance & Truthfulness (Фактологическая точность по Dossier):**
  - База: 100 баллов.
  - За каждое расхождение с датами, грейдом, типом оформления (`legalTaxStatus`) или выдумывание несуществующих в `CandidateDossier` метрик вычитается 35 баллов.
2. **Lexical Density (Профессиональный тезаурус vs Бытовая речь):**
  - $\text{Score}_{lexical} = \text{round}\left(70 \times \frac{N_{mandatory\_anchors\_hit}}{N_{mandatory\_anchors\_total}} + 30 \times \frac{N_{optional\_anchors\_hit}}{\max(1, N_{optional\_anchors\_total})}\right) - 10 \times N_{forbidden\_words}$.
3. **Structure & Pacing (Структура Тезис — Обоснование — Результат и темп):**
  - Укладывание в окно 35–75 секунд: +40 баллов (штраф -2 балла за каждую секунду свыше 80 сек).
  - Нахождение среднего WPM в коридоре 100–150 слов/мин: +30 баллов.
  - Наличие структуры «Тезис → Действие → Оцифрованный результат» (оценивается через LLM tool call): +30 баллов.
4. **Confidence & Delivery (Уверенность и отсутствие оправданий):**
  - База: 100 баллов.
  - Штраф `-8` баллов за каждое слово-паразит (`fillerWordCount`).
  - Штраф `-12` баллов за каждую паузу нерешительности длиннее 1500 мс (`hesitationBurstCount`).
  - Штраф `-25` баллов за любую оправдательную конструкцию из `forbiddenDefensivePhrases` (например: «мне просто не повезло», «я только помогал(а)», «там все само развалилось»).

### 4.4. Промпт-архитектура, Ground Truth Injection и ролевые архетипы HR
В `backend/src/prompts/personas.ts` и `backend/src/services/live/hrPromptBuilder.ts` внедряются три жестких поведенческих контракта без какой-либо лести (`antiSycophancy.ts`):

1. **`hr_keyword_screener` («Поверхностный скринер по ключевым словам»):**
  - *Поведение:* Не разбирается в глубокой архитектуре. Слушает вполсилы, ждет точного совпадения ключевых слов из `JobContext.mustHaveKeywords`. Если кандидат объясняет концепцию своими словами без точного термина — перебивает или сухо резюмирует: «Я не услышала опыта с X, перейдем дальше».
2. **`hr_fintech_compliance` («Подозрительный офицер комплаенса банка/финтеха»):**
  - *Поведение:* Фокусируется на хронологических стыках в `careerTimeline`, причинах перерывов (`SABBATICAL_RD` / `CAREER_GAP`), пересечениях контрактов и юридическом статусе (`legalTaxStatus`). Задает закрытые проверочные вопросы: «Почему в этот период вы работали по НПД, а не в штате? Кто может подтвердить этот релиз?».
3. **`hr_conflict_psychologist` («Психолог-охотник за конфликтами»):**
  - *Поведение:* Провоцирует кандидата на критику бывших руководителей, коллег или процессов. Использует ложную эмпатию («Наверное, менеджмент там был совсем некомпетентным, да?»), чтобы проверить, сорвется ли кандидат в жалобы или удержит конструктивную инженерную рамку.
**Инъекция Ground Truth (`buildHrSystemPrompt`):**
Системный промпт сериализует `CandidateDossier` и `JobContext` в неизменяемый XML-блок `<ground_truth_dossier>` и снабжает модель инструкцией:*Модель выступает строго от лица HR-рекрутера. Блок `<ground_truth_dossier>` представляет собой резюме, которое лежит перед рекрутером на столе, плюс скрытые критерии верификации для инструмента оценки. Запрещено хвалить кандидата словами «Отличный ответ!», «Супер!», «Как интересно!». Переход к следующему вопросу выполняется сухо и деловито.*

## 5. Atomic Execution Plan
Ниже приведен пошаговый план для локального CLI-исполнителя. Каждый шаг атомарен и завершается проверкой компиляции.

### Шаг 1: Контракты данных и событий в пакете `shared`

- **Действие `CREATE`:** `interview_tutor/shared/src/schemas/hrSimulator.ts`
  - Вставить полный код схем TypeBox из Раздела 3.1 (`CandidateDossierSchema`, `JobContextSchema`, `HrSessionConfigSchema`, `HrTelemetryTickSchema`, `HrScorecardSchema` и их статические типы).
- **Действие `MODIFY`:** `interview_tutor/shared/src/schemas/voiceEvents.ts`
  - Добавить события `HR_PHASE_CHANGE`, `HR_SCORECARD`, `HR_DRILL_RETRY_PROMPT`, `HR_ANCHOR_RECONCILED`, `HR_ANCHOR_HIT`, `HR_TELEMETRY_SNAPSHOT`, `HR_FORCE_PHASE_ADVANCE` в объект `LIVE_VOICE_EVENTS`.
- **Действие `MODIFY`:** `interview_tutor/shared/src/index.ts`
  - Экспортировать все схемы и типы из `./schemas/hrSimulator`.
- **Верификация шага 1:**
  ```bash
  cd C:\projects\synced_with_vps\interview_tutor\shared && npm run build
  
  ```

### Шаг 2: Ролевые архетипы HR и генератор системных промптов на бэкенде

- **Действие `MODIFY`:** `interview_tutor/backend/src/prompts/personas.ts`
  - Расширить тип `InterviewPersonaId` значениями `'hr_keyword_screener' | 'hr_fintech_compliance' | 'hr_conflict_psychologist'`.
  - В функцию `getPersonaPromptDirectives` добавить ветки `switch/record` для трех новых HR-персон с жесткими директивами анти-сикофантии.
- **Действие `CREATE`:** `interview_tutor/backend/src/services/live/hrPromptBuilder.ts`
  - Реализовать чистую функцию `buildHrSystemPrompt(params: LiveWsSessionParams): string`, которая:
    1. Инжектирует директивы из `antiSycophancy.ts`, `genderDirectives.ts` и `personas.ts`.
    2. Формирует блок `<ground_truth_dossier>` из `params.hrConfig.dossier` и `<job_context>` из `params.hrConfig.jobContext`.
    3. В зависимости от `params.hrConfig.topologyMode` (`E2E_SIMULATION` или `MICRO_DRILL`) задает правила ведения диалога и обязательного вызова инструментов `advance_hr_phase` и `submit_hr_evaluation`.
- **Действие `MODIFY`:** `interview_tutor/backend/src/services/live/livePromptBuilder.ts`
  - В `buildSystemPrompt` добавить маршрутизацию: если `params.sessionType === 'hr_screening'` и присутствует `params.hrConfig`, делегировать сборку в `buildHrSystemPrompt(params)` (гарантия Zero Regressions для `interview`, `tutor`, `system_design`).
- **Верификация шага 2:**
  ```bash
  cd C:\projects\synced_with_vps\interview_tutor\backend && npx tsc --noEmit
  
  ```

### Шаг 3: Стейт-машина фаз, скоринг и диспетчеризация инструментов на бэкенде

- **Действие `CREATE`:** `interview_tutor/backend/src/services/live/hrStateMachineService.ts`
  - Реализовать класс `HrStateMachineService`, хранящий текущую фазу `HrPhaseId`, аккумулирующий попадания `HR_ANCHOR_HIT` (от клиента и из серверной транскрипции), снимки `HR_TELEMETRY_SNAPSHOT` и рассчитывающий 4-осевой `HrScorecard` по формулам из Раздела 4.3.
  - Реализовать метод `buildPhaseTransitionDirective(nextPhase: HrPhaseId): string` для бесшовной инъекции инструкции в открытый сокет Gemini Live.
- **Действие `MODIFY`:** `interview_tutor/backend/src/services/live/liveWsSessionParams.ts`
  - Расширить `sessionType` значением `'hr_screening'` и добавить опциональное поле `hrConfig?: HrSessionConfig`.
- **Действие `MODIFY`:** `interview_tutor/backend/src/services/live/liveGeminiConfigBuilder.ts`
  - При `sessionType === 'hr_screening'` добавлять в `tools.functionDeclarations` декларации двух функций:
    1. `advance_hr_phase(nextPhase, reason, coveredAnchors)`
    2. `submit_hr_evaluation(substanceScore, starCompliance, hallucinations, colloquialismsReplaced, defensiveMarkers, prescription)`
- **Действие `MODIFY`:** `interview_tutor/backend/src/services/live/liveToolDispatcher.ts`
  - Добавить обработку вызовов `advance_hr_phase` и `submit_hr_evaluation` с вызовом `HrStateMachineService` и отправкой клиенту WebSocket-событий `HR_PHASE_CHANGE` и `HR_SCORECARD`.
- **Действие `MODIFY`:** `interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts`
  - Добавить обработку входящих от клиента событий `LIVE_VOICE_EVENTS.HR_ANCHOR_HIT`, `LIVE_VOICE_EVENTS.HR_TELEMETRY_SNAPSHOT` и `LIVE_VOICE_EVENTS.HR_FORCE_PHASE_ADVANCE` с передачей в экземпляр `HrStateMachineService` текущей сессии.
- **Верификация шага 3:**
  ```bash
  cd C:\projects\synced_with_vps\interview_tutor\backend && npx tsc --noEmit
  
  ```

### Шаг 4: Клиентский On-Device KWS (менее 200 мс) и монитор речевой телеметрии

- **Действие `CREATE`:** `interview_tutor/frontend/src/audio/HrClientKeywordSpotter.ts`
  - Реализовать неблокирующий матчер ключевых слов:
    ```typescript
    // Каркас алгоритма быстрого сопоставления (< 200 мс)
    export class HrClientKeywordSpotter {
      private recognition: any | null = null;
      private activeCards: HrAnchorCard[] = [];
      private hitSet = new Set<string>();
    
      constructor(
        private readonly onAnchorHit: (anchorId: string, latencyMs: number) => void,
        private readonly onInterimTokens: (text: string, timestampMs: number) => void
      ) {}
    
      public setAnchorCards(cards: HrAnchorCard[]): void {
        this.activeCards = cards;
        this.hitSet.clear();
      }
    
      public ingestTranscriptChunk(rawText: string, speechStartTs: number): void {
        const normalized = rawText.toLowerCase().replace(/ё/g, 'е');
        const now = performance.now();
        this.onInterimTokens(normalized, now);
    
        for (const card of this.activeCards) {
          if (this.hitSet.has(card.id)) continue;
          const isMatched = card.matchStems.some((stem) =>
            this.fuzzyStemMatch(normalized, stem.toLowerCase().replace(/ё/g, 'е'))
          );
          if (isMatched) {
            this.hitSet.add(card.id);
            this.onAnchorHit(card.id, Math.min(180, Math.max(40, now - speechStartTs)));
          }
        }
      }
    
      private fuzzyStemMatch(haystack: string, stem: string): boolean {
        if (haystack.includes(stem)) return true;
        // Проверка префиксного совпадения без окончаний (для словоформ русского языка)
        const minPrefix = Math.max(4, Math.floor(stem.length * 0.75));
        return haystack.includes(stem.slice(0, minPrefix));
      }
    }
    
    ```
  - Подключить `HrClientKeywordSpotter` к параллельному потоку `webkitSpeechRecognition` / `SpeechRecognition` (`interimResults = true`, `lang = 'ru-RU'`) с автоматическим fallback на поток чанков транскрипции из `NativeLiveVoiceEngine.ts`.
- **Действие `CREATE`:** `interview_tutor/frontend/src/audio/HrSpeechTelemetryMonitor.ts`
  - Реализовать кольцевой буфер WPM (10 сек), детектор пауз нерешительности (более 1500 мс по событиям VAD), regex-детектор слов-паразитов и таймер окна реплики (60/80 сек).
- **Действие `MODIFY`:** `interview_tutor/frontend/src/audio/types.ts` и `interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts`
  - Добавить `hrConfig?: HrSessionConfig` в `VoiceEngineConfig`.
  - Пробросить хуки `onSpeechStart`, `onSpeechEnd` и `onSocketEvent` для `HrSpeechTelemetryMonitor` и `HrClientKeywordSpotter`, когда `config.sessionType === 'hr_screening'`.
- **Верификация шага 4:**
  ```bash
  cd C:\projects\synced_with_vps\interview_tutor\frontend && npx tsc --noEmit
  
  ```

### Шаг 5: Zustand-стор и визуальный HUD тренажера (`HrVoiceHUD.tsx`)

- **Действие `CREATE`:** `interview_tutor/frontend/src/stores/useHrSimulatorStore.ts`
  - Создать изолированный Zustand-стор для хранения `hrConfig`, текущей фазы `activePhase`, состояния карточек `anchorHitMap: Record<string, boolean>`, живой телеметрии `currentTelemetry: HrTelemetryTick` и списка полученных `scorecards: HrScorecard[]`.
- **Действие `CREATE`:** `interview_tutor/frontend/src/components/voice/HrVoiceHUD.tsx`
  - Реализовать визуальный интерфейс реального времени на TailwindCSS + Framer Motion:
    1. **Сетка Anchor Cards:** Карточки терминов, которые мгновенно подсвечиваются изумрудно-зеленым (`bg-emerald-500/20 border-emerald-400 scale-105`) при срабатывании `HrClientKeywordSpotter`.
    2. **Pacing & Time Bar:** Индикатор 60–80 секунд и спидометр WPM (коридор 90–160 слов/мин).
    3. **Hesitation & Filler Counter:** Счетчик пауз свыше 1.5 сек и пойманных слов-паразитов.
    4. **4-Axis Scorecard Modal / Drawer:** Отображение оценки по 4 осям и кнопки мгновенного перезапуска (`ImmediateRetryLoop`) для режима `MICRO_DRILL`.
- **Верификация шага 5 (Финальная сборка всего монорепозитория):**
  ```bash
  cd C:\projects\synced_with_vps\interview_tutor\shared && npm run build && cd ..\backend && npx tsc --noEmit && cd ..\frontend && npx tsc --noEmit
  
  ```

---

*Exported from [Voyager](https://github.com/voyager-crew/voyager)*  
*Generated on October 30, 2026 at 03:11 PM*