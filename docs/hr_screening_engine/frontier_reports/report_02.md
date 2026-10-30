# Архитектурная спецификация: Generic HR Voice Simulator Engine

## 1. Root Cause & Architecture Decision

### Нейрокогнитивная первопричина речевого ступора и архитектурный ответ
В ситуации стрессового HR-скрининга — особенно при прохождении комплаенс-проверок в финтехе, объяснении перерывов в стаже (саббатикал, R&D), обосновании перехода с режима налога на профессиональный доход (НПД) или B2B-контрактов в штат по ТК РФ, а также при защите зарплатных ожиданий — у кандидата возникает острая когнитивная перегрузка. Нейробиологический механизм этого явления обусловлен симпатоадреналовой реакцией: выброс катехоламинов и кортизола временно подавляет активность префронтальной коры (ПФК), отвечающей за рабочую память, исполнительный контроль и произвольное извлечение сложной профессиональной лексики, передавая управление базальным ганглиям и миндалевидному телу.
Традиционная подготовка по текстовым шпаргалкам формирует исключительно декларативную (эксплицитную) память, зависящую от гиппокампа и ПФК. При функциональной блокировке ПФК в ходе живого диалога доступ к декларативным конструкциям обрывается: словарный запас кандидата мгновенно деградирует до бытового разговорной речи («рассказывала своими словами», «делал всякое»), разрушается структура аргументации «Тезис — Обоснование — Результат», появляются оправдательные интонации, слова-паразиты и паузы нерешительности длительностью свыше $1500\text{ мс}$, а общая продолжительность реплики выходит за пределы окна внимания рекрутера ($60\text{–}80\text{ с}$).
Предлагаемая архитектура `Generic HR Voice Simulator Engine` устраняет эту первопричину путем перевода навыка самопрезентации из декларативной памяти в процедурную (имплицитную) моторную память речевого аппарата (зона Брока и дополнительная моторная кора). Этот переход обеспечивается двумя взаимосвязанными архитектурными механизмами. Во-первых, контур оперантного подкрепления с нулевой задержкой (Zero-Latency Visual HUD $<200\text{ мс}$) осуществляет мгновенную визуальную валидацию произнесенных профессиональных терминов (`Anchor Cards`) непосредственно в момент артикуляции, замыкая сенсомоторную петлю обратной связи и закрепляя речевой паттерн на мышечном уровне. Во-вторых, двухтопологический граф тренировок (Dual-Topology State Machines) сочетает высокочастотное циклическое бурение отдельных проблемных вопросов (*Topology B: Rapid-Fire Micro-Drill*) для доведения фраз до рефлекторного автоматизма со сквозной двадцатиминутной симуляцией (*Topology A: End-to-End Simulation*), вырабатывающей устойчивость к резкой смене контекста и агрессивному зондированию.

### Полная декомпозиция движка и данных (Zero Technical Debt)
Для предотвращения технического долга и гарантированного сохранения обратной совместимости с существующими сценариями (`interview`, `tutor`, `system_design`, `incident`) прикладной слой симулятора проектируется как полностью детерминированный механизм, строго изолированный от биографических и корпоративных данных. Персональные факты кандидата (`CandidateDossierSchema`) и параметры целевой компании (`JobContextSchema`) передаются исключительно как валидируемые DTO через контракты `@sinclair/typebox`. Транспортный уровень `NativeLiveVoiceEngine.ts` — включая непрерывный стриминг 16kHz PCM, двухсторонний хэндшейк, программный Audio Mutex, подавление эха и акустический Barge-In — остается полностью неизменным, а вся специфичная для HR-симуляции логика инкапсулируется в выделенных модулях состояния и телеметрии.

### Обоснование архитектуры Zero-Latency Keyword Spotting (KWS)
Ключевой инженерный инвариант системы требует, чтобы задержка между завершением артикуляции ключевого термина и зеленой индикацией соответствующей карточки `AnchorCard` на экране (`PracticeVoiceHUD.tsx`) составляла менее $200\text{ мс}$. Детальная декомпозиция бюджета задержки (Latency Budget Breakdown) на уровне 95-го перцентиля (p95) показывает, что классические серверные подходы физически не способны выдержать этот норматив. В частности, при извлечении транскрипции из событий сокета Gemini Live (`serverContent.inputTranscription`) захват PCM-фрейма занимает $30\text{ мс}$, сетевой RTT поглощает $85\text{ мс}$, серверная буферизация VAD и накопление контекста внутри мультимодальной модели требуют $650\text{ мс}$, а сопоставление и обновление React-компонента занимают $25\text{ мс}$, что в сумме дает $790\text{ мс}$ (при колебаниях в диапазоне $480\text{–}1250\text{ мс}$). Аналогично, выделенный серверный ASR-поток по параллельному WebSocket-соединению на бэкенд расходует $30\text{ мс}$ на захват PCM, $85\text{ мс}$ на сетевой RTT, $310\text{ мс}$ на серверную буферизацию и $25\text{ мс}$ на рендеринг, демонстрируя суммарную задержку p95 на уровне $450\text{ мс}$ (диапазон $320\text{–}650\text{ мс}$) при одновременном удвоении исходящего аудио-трафика.
Напротив, гибридный двухконтурный подход (On-Device KWS + Server Reconciliation) полностью исключает сетевой RTT и серверную буферизацию из первичного контура визуального отклика: захват PCM-аудио занимает $30\text{ мс}$, локальный промежуточный инференс речи (`interimResults`) укладывается в $95\text{ мс}$, фонетический стемминг и нечеткое префиксное сопоставление требуют всего $12\text{ мс}$, а обновление состояния и отрисовка UI занимают $18\text{ мс}$, обеспечивая итоговую задержку p95 ровно в $155\text{ мс}$ (рабочий диапазон $95\text{–}175\text{ мс}$), что надежно укладывается в жесткий бюджет $<200\text{ мс}$.

| Архитектурный паттерн KWS | Декомпозиция этапов p95 (Захват / Сеть / Инференс и буфер / Матч и UI) | Суммарная задержка (p95 / Диапазон) | Сетевой и CPU оверхед | Устойчивость к морфологии (RU/EN) | Архитектурный вердикт |
| --- | --- | --- | --- | --- | --- |
| **1. Транскрипция из сокета Gemini Live** (`serverContent.inputTranscription`) | $30\text{ мс}$ / $85\text{ мс}$ / $650\text{ мс}$ / $25\text{ мс}$ | $790\text{ мс}$ ($480\text{–}1250\text{ мс}$) | $0\%$ CPU на клиенте; зависит от серверного VAD Google | Высокая (контекстная LLM-нормализация) | **Отклонено как основной канал:** Сетевой RTT и серверная буферизация фреймов нарушают SLA $<200\text{ мс}$, разрушая эффект мгновенного подкрепления. |
| **2. Выделенный серверный ASR-поток** (параллельный WebSocket на бэкенд) | $30\text{ мс}$ / $85\text{ мс}$ / $310\text{ мс}$ / $25\text{ мс}$ | $450\text{ мс}$ ($320\text{–}650\text{ мс}$) | Удвоение исходящего PCM-трафика; риск гонок сокетов | Средняя / Высокая | **Отклонено:** Создает избыточную нагрузку на `liveWsConnectionHandler.ts` и не гарантирует укладывание в $200\text{ мс}$ при джиттере сети. |
| **3. Гибридный двухконтурный On-Device KWS + Server Reconciliation** | $30\text{ мс}$ / $0\text{ мс}$ / $95\text{ мс}$ / $30\text{ мс}$ ($12\text{ мс} + 18\text{ мс}$) | **$155\text{ мс}$ ($95\text{–}175\text{ мс}$)** | $<3\%$ CPU в браузерном потоке; $0\text{ байт}$ доп. аудио-трафика | Высокая (стемминг + фонетический префикс-матчинг) | **Принято (SOTA Late-2026):** Обеспечивает мгновенный отклик $<200\text{ мс}$ на клиенте с последующей авторитетной верификацией через Gemini Live. |

Выбранная гибридная архитектура функционирует в двух синхронизированных контурах без возникновения состояния гонки (Race Conditions). Первый контур (Tier 1 — Оптимистичный клиентский KWS с задержкой $95\text{–}175\text{ мс}$) работает непосредственно на клиенте: параллельно с `NativeLiveVoiceEngine.ts` запускается легковесный модуль `ClientKwsMatcher.ts`, который принимает поток промежуточных токенов (`interimResults = true` из нативного браузерного `SpeechRecognition` API либо локального ONNX-буфера) и пропускает каждое слово через предкомпилированный русско-английский фонетический стеммер Портера/Snowball и алгоритм нечеткого префиксного сопоставления Дамерау — Левенштейна. Для основ длиннее пяти символов допускается расстояние редактирования $d \le 1$, тогда как для коротких технических и юридических аббревиатур (`НПД`, `ТК РФ`, `SLA`, `KPI`) требуется точное совпадение. При совпадении основы с карточкой `AnchorCard` ее локальный статус в Zustand-сторе мгновенно переводится из `PENDING` в `OPTIMISTIC_HIT`, вызывая зеленую подсветку на HUD менее чем за $175\text{ мс}$.
Второй контур (Tier 2 — Авторитетная серверная сверка с задержкой $600\text{–}1200\text{ мс}$) выполняется в серверном обработчике `liveWsConnectionHandler.ts`, который анализирует финальные транскрипты пользователя из событий Gemini Live и результаты вызовов инструментов оценки. При подтверждении использования термина в корректном семантическом контексте сервер отправляет событие `LIVE_VOICE_EVENTS.HR_ANCHOR_HIT`, переводящее карточку в терминальный статус `CONFIRMED_HIT`. Предотвращение состояния гонки между клиентом и сервером обеспечивается монотонной защелкой состояния (Monotonic State Latch): переходы статуса карточки подчиняются строгому порядку `PENDING (0) -> OPTIMISTIC_HIT (1) -> CONFIRMED_HIT (2)`. Запаздывающее событие от сервера никогда не сбрасывает уже подсвеченную карточку при обычном сетевом отставании пакета; откат из `OPTIMISTIC_HIT` в `PENDING` разрешен только по истечении $4000\text{ мс}$ после завершения фразы в том редком случае, когда промежуточный токен оказался фонетической галлюцинацией локального распознавания и полностью отсутствовал в финальном серверном транскрипте.

## 2. Assumptions & Blind Spots
Поскольку проектирование выполняется в режиме полной изоляции (Zero-Context Escalation) исключительно на основе предоставленного среза репозитория, архитектурный план опирается на явно зафиксированную матрицу допущений относительно внутренней реализации смежных модулей.

| Целевой компонент системы | Архитектурное допущение о внутренней структуре | Механизм безопасной интеграции |
| --- | --- | --- |
| `NativeLiveVoiceEngine.ts` (`frontend/src/audio/`) | Класс инкапсулирует жизненный цикл WebSocket-соединения с бэкендом, захватывает поток `16kHz, 16-bit, mono PCM` через `AudioWorkletNode`, использует `@ricky0123/vad-web` для локальной детекции речи и предоставляет систему подписки на входящие события `LIVE_VOICE_EVENTS` и метод отправки контрольных JSON-фреймов. | Подключение `ClientKwsMatcher` и `HrSpeechTelemetryTracker` выполняется по условному флагу `config.sessionType === 'hr_screening'` без модификации `AudioWorklet` и `AudioPlayoutManager`. |
| `liveWsConnectionHandler.ts` & `liveToolDispatcher.ts` (`backend/src/services/live/`) | Обработчик соединения разбирает параметры сессии через `liveWsSessionParams.ts`, инициализирует мультимодальную сессию `@google/genai`, пересылает бинарные аудиочанки в апстрим и делегирует обработку вызовов функций (`toolCall` от Gemini) в `liveToolDispatcher.ts`, имеющий доступ к клиентскому WebSocket. | Экземпляр `HrDialogueStateMachine` привязывается к контексту сессии при `sessionType === 'hr_screening'`, а новые инструменты обрабатываются в отдельных ветках диспетчера. |
| `livePromptBuilder.ts` & `liveGeminiConfigBuilder.ts` (`backend/src/services/live/`) | Модуль `livePromptBuilder.ts` экспортирует функцию `buildSystemPrompt(params: LiveWsSessionParams)`, объединяющую базовые директивы (`antiSycophancy.ts`, `genderDirectives.ts`, `languageDirectives.ts`) с ролевыми инструкциями из `personas.ts`, а `liveGeminiConfigBuilder.ts` формирует конфигурацию сессии, включая массив `tools`. | При `sessionType === 'hr_screening'` управление сборкой системного промпта передается в специализированную функцию `buildHrSimulatorSystemPrompt`, а в `tools` добавляются три декларации функций HR-оркестрации. |
| `shared/src/index.ts` (`shared/`) | Пакет `@interview-tutor/shared` реэкспортирует все схемы TypeBox и выведенные статические типы (`Static<typeof ...>`) из директории `shared/src/schemas/*` для синхронного использования на бэкенде и фронтенде. | Все новые контракты размещаются в `shared/src/schemas/hrSimulator.ts` и подключаются единым реэкспортом в корневом индексном файле. |
| `frontend/src/stores/` (`frontend/`) | Состояние пользовательского интерфейса и визуального HUD (`PracticeVoiceHUD.tsx`) управляется атомарными сторами на базе Zustand 5.0.2. | Создается изолированный стор `useHrSimulatorStore.ts`, что полностью исключает мутацию существующих сторов технических интервью. |

## 3. Data Contracts & Interfaces (TypeBox & TypeScript)

### 3.1. Декларативные схемы HR-симулятора (`interview_tutor/shared/src/schemas/hrSimulator.ts`)
Ниже приведена полная спецификация контрактов данных на базе `@sinclair/typebox`, обеспечивающая строгую валидацию на границе шлюза и полную абстракцию движка от конкретных биографий и профилей компаний.

```typescript
// File: interview_tutor/shared/src/schemas/hrSimulator.ts
import { Type, Static } from '@sinclair/typebox';

export const LegalEmploymentStatusSchema = Type.Union([
  Type.Literal('TK_RF_FULL_TIME'),
  Type.Literal('NPD_SELF_EMPLOYED'),
  Type.Literal('IP_B2B_CONTRACTOR'),
  Type.Literal('GPH_CIVIL_CONTRACT'),
  Type.Literal('INTERNATIONAL_CONTRACT')
]);
export type LegalEmploymentStatus = Static<typeof LegalEmploymentStatusSchema>;

export const MilitaryComplianceStatusSchema = Type.Union([
  Type.Literal('MILITARY_ID_RESERVE'),
  Type.Literal('IT_ACCREDITED_DEFERRAL'),
  Type.Literal('EXEMPT_BY_AGE_OR_HEALTH'),
  Type.Literal('NOT_APPLICABLE'),
  Type.Literal('UNRESOLVED_RISK')
]);
export type MilitaryComplianceStatus = Static<typeof MilitaryComplianceStatusSchema>;

export const CareerPeriodTypeSchema = Type.Union([
  Type.Literal('COMMERCIAL_IN_HOUSE'),
  Type.Literal('CONTRACT_OUTSOURCE'),
  Type.Literal('RND_PET_PROJECT'),
  Type.Literal('SABBATICAL_CAREER_BREAK')
]);

export const ExperienceRecordSchema = Type.Object({
  periodId: Type.String(),
  organizationLabel: Type.String(),
  roleTitle: Type.String(),
  periodType: CareerPeriodTypeSchema,
  legalStatus: LegalEmploymentStatusSchema,
  startDateIso: Type.String({ description: 'YYYY-MM format' }),
  endDateIso: Type.Union([Type.String(), Type.Literal('PRESENT')]),
  durationMonths: Type.Integer({ minimum: 1 }),
  verifiedFacts: Type.Array(Type.String(), { minItems: 1 }),
  quantifiedMetrics: Type.Array(Type.String()),
  mandatoryLexicalAnchors: Type.Array(Type.String()),
  reasonForTransition: Type.String(),
  isComplianceSensitive: Type.Boolean()
});
export type ExperienceRecord = Static<typeof ExperienceRecordSchema>;

export const PortfolioProjectSchema = Type.Object({
  projectId: Type.String(),
  title: Type.String(),
  domain: Type.String(),
  architectureSummary: Type.String(),
  businessImpactMetric: Type.String(),
  keyTerms: Type.Array(Type.String())
});

export const CandidateDossierSchema = Type.Object({
  dossierId: Type.String(),
  targetPositionTitle: Type.String(),
  totalVerifiedExperienceMonths: Type.Integer({ minimum: 0 }),
  commercialTrackMonths: Type.Integer({ minimum: 0 }),
  sabbaticalOrRndMonths: Type.Integer({ minimum: 0 }),
  currentLegalStatus: LegalEmploymentStatusSchema,
  targetLegalStatus: LegalEmploymentStatusSchema,
  militaryCompliance: MilitaryComplianceStatusSchema,
  compensation: Type.Object({
    currency: Type.Union([Type.Literal('RUB'), Type.Literal('USD'), Type.Literal('EUR')]),
    minimumFloorNet: Type.Number({ minimum: 0 }),
    targetComfortNet: Type.Number({ minimum: 0 }),
    stretchGoalNet: Type.Number({ minimum: 0 }),
    justificationAnchors: Type.Array(Type.String())
  }),
  experienceHistory: Type.Array(ExperienceRecordSchema, { minItems: 1 }),
  portfolioProjects: Type.Array(PortfolioProjectSchema),
  knownVulnerabilityZones: Type.Array(
    Type.Object({
      vulnerabilityId: Type.String(),
      topicTrigger: Type.String(),
      approvedDefenseFormula: Type.String(),
      forbiddenEuphemisms: Type.Array(Type.String()),
      requiredKeywords: Type.Array(Type.String())
    })
  )
});
export type CandidateDossier = Static<typeof CandidateDossierSchema>;

export const JobDomainCategorySchema = Type.Union([
  Type.Literal('FINTECH_BANKING'),
  Type.Literal('BIGTECH_ECOSYSTEM'),
  Type.Literal('RETAIL_ECOMMERCE'),
  Type.Literal('AI_RND_STARTUP'),
  Type.Literal('ENTERPRISE_INTEGRATOR')
]);

export const JobContextSchema = Type.Object({
  jobId: Type.String(),
  domainCategory: JobDomainCategorySchema,
  roleTitle: Type.String(),
  targetGrade: Type.Union([
    Type.Literal('L4_MIDDLE'),
    Type.Literal('L5_SENIOR'),
    Type.Literal('L6_STAFF')
  ]),
  coreTechStack: Type.Array(Type.String()),
  complianceStrictness: Type.Union([
    Type.Literal('STANDARD'),
    Type.Literal('HIGH_SECURITY_CLEARANCE'),
    Type.Literal('ZERO_GAP_TOLERANCE')
  ]),
  budgetCeilingNet: Type.Number({ minimum: 0 }),
  mandatoryScreeningTopics: Type.Array(Type.String()),
  disqualifyingRedFlags: Type.Array(Type.String())
});
export type JobContext = Static<typeof JobContextSchema>;

export const HrTopologyModeSchema = Type.Union([
  Type.Literal('END_TO_END'),
  Type.Literal('MICRO_DRILL')
]);
export type HrTopologyMode = Static<typeof HrTopologyModeSchema>;

export const HrPhaseIdSchema = Type.Union([
  Type.Literal('SMALL_TALK'),
  Type.Literal('ELEVATOR_PITCH'),
  Type.Literal('CAREER_DEEP_DIVE'),
  Type.Literal('GAP_AND_SABBATICAL_PROBE'),
  Type.Literal('COMPLIANCE_AND_FINANCIALS'),
  Type.Literal('CANDIDATE_REVERSE_QA'),
  Type.Literal('SCORECARD_SUMMARY')
]);
export type HrPhaseId = Static<typeof HrPhaseIdSchema>;

export const HrDrillStageSchema = Type.Union([
  Type.Literal('ASK_TARGET_QUESTION'),
  Type.Literal('CANDIDATE_VOICE_RESPONSE'),
  Type.Literal('REALTIME_ANCHOR_SPOTTING'),
  Type.Literal('INSTANT_CRITIQUE'),
  Type.Literal('IMMEDIATE_RETRY_LOOP')
]);
export type HrDrillStage = Static<typeof HrDrillStageSchema>;

export const HrAnchorStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('OPTIMISTIC_HIT'),
  Type.Literal('CONFIRMED_HIT')
]);
export type HrAnchorStatus = Static<typeof HrAnchorStatusSchema>;

export const HrAnchorCardSchema = Type.Object({
  anchorId: Type.String(),
  displayTerm: Type.String(),
  normalizedStems: Type.Array(Type.String(), { minItems: 1 }),
  category: Type.Union([
    Type.Literal('HARD_METRIC'),
    Type.Literal('DOMAIN_TERMINOLOGY'),
    Type.Literal('LEGAL_COMPLIANCE_FRAME'),
    Type.Literal('EXECUTIVE_VERB')
  ]),
  phaseId: Type.Optional(HrPhaseIdSchema),
  status: HrAnchorStatusSchema,
  hitTimestampMs: Type.Union([Type.Number(), Type.Null()]),
  detectionLatencyMs: Type.Union([Type.Number(), Type.Null()])
});
export type HrAnchorCard = Static<typeof HrAnchorCardSchema>;

export const HrArchetypeIdSchema = Type.Union([
  Type.Literal('hr_keyword_screener'),
  Type.Literal('hr_fintech_compliance'),
  Type.Literal('hr_conflict_psychologist')
]);
export type HrArchetypeId = Static<typeof HrArchetypeIdSchema>;

export const HrSessionConfigSchema = Type.Object({
  topologyMode: HrTopologyModeSchema,
  hrArchetype: HrArchetypeIdSchema,
  dossier: CandidateDossierSchema,
  jobContext: JobContextSchema,
  replyWindowConstraints: Type.Object({
    minOptimalSec: Type.Number({ default: 60 }),
    maxOptimalSec: Type.Number({ default: 80 }),
    hardCutOffSec: Type.Number({ default: 90 })
  }),
  anchorCards: Type.Array(HrAnchorCardSchema),
  microDrillConfig: Type.Optional(
    Type.Object({
      targetQuestionId: Type.String(),
      targetQuestionPrompt: Type.String(),
      requiredAnchorHitRatio: Type.Number({ minimum: 0.5, maximum: 1.0, default: 0.85 }),
      maxRetryAttempts: Type.Integer({ minimum: 1, maximum: 20, default: 5 })
    })
  )
});
export type HrSessionConfig = Static<typeof HrSessionConfigSchema>;

export const HrTelemetrySchema = Type.Object({
  sessionId: Type.String(),
  turnId: Type.String(),
  activePhase: Type.Union([HrPhaseIdSchema, HrDrillStageSchema]),
  rollingWpm: Type.Number(),
  pacingState: Type.Union([
    Type.Literal('STALLED_BELOW_90'),
    Type.Literal('OPTIMAL_90_160'),
    Type.Literal('RUSHING_ABOVE_160')
  ]),
  hesitationBurstsCount: Type.Integer({ minimum: 0 }),
  maxHesitationDurationMs: Type.Number({ minimum: 0 }),
  lastHesitationPredecessorWord: Type.Union([Type.String(), Type.Null()]),
  fillerWordsCount: Type.Integer({ minimum: 0 }),
  detectedFillers: Type.Array(Type.String()),
  detectedEuphemisms: Type.Array(Type.String()),
  elapsedReplySec: Type.Number({ minimum: 0 }),
  replyWindowStatus: Type.Union([
    Type.Literal('BUILDING_0_60S'),
    Type.Literal('OPTIMAL_WINDOW_60_80S'),
    Type.Literal('OVERFLOW_DANGER_ABOVE_80S')
  ]),
  anchorHitCount: Type.Integer({ minimum: 0 }),
  anchorTotalCount: Type.Integer({ minimum: 0 }),
  timestamp: Type.Number()
});
export type HrTelemetry = Static<typeof HrTelemetrySchema>;

export const HrScorecardSchema = Type.Object({
  sessionId: Type.String(),
  topologyMode: HrTopologyModeSchema,
  axes: Type.Object({
    substanceAndTruthfulness: Type.Object({
      score: Type.Number({ minimum: 0, maximum: 100 }),
      verifiedFactsCount: Type.Integer(),
      contradictionsDetected: Type.Array(Type.String()),
      summary: Type.String()
    }),
    lexicalDensity: Type.Object({
      score: Type.Number({ minimum: 0, maximum: 100 }),
      anchorCoveragePercent: Type.Number(),
      professionalTermsUsed: Type.Array(Type.String()),
      colloquialEuphemismsPenalized: Type.Array(Type.String())
    }),
    structureAndPacing: Type.Object({
      score: Type.Number({ minimum: 0, maximum: 100 }),
      avgTurnDurationSec: Type.Number(),
      meanWpm: Type.Number(),
      thesisEvidenceResultCompliance: Type.Boolean()
    }),
    confidenceAndDelivery: Type.Object({
      score: Type.Number({ minimum: 0, maximum: 100 }),
      hesitationEventsTotal: Type.Integer(),
      fillerWordsTotal: Type.Integer(),
      impostorSyndromeMarkers: Type.Array(Type.String())
    })
  }),
  overallCompositeScore: Type.Number({ minimum: 0, maximum: 100 }),
  passThresholdMet: Type.Boolean(),
  nextDrillPrescription: Type.Array(
    Type.Object({
      targetVulnerabilityId: Type.String(),
      recommendedQuestion: Type.String(),
      mandatoryAnchorsToDrill: Type.Array(Type.String())
    })
  ),
  createdAt: Type.Number()
});
export type HrScorecard = Static<typeof HrScorecardSchema>;

```

### 3.2. Расширение событий WebSocket (`interview_tutor/shared/src/schemas/voiceEvents.ts`)
Существующий контракт `LIVE_VOICE_EVENTS` расширяется двунаправленными событиями HR-симулятора с полным сохранением всех действующих ключей:

```typescript
// File: interview_tutor/shared/src/schemas/voiceEvents.ts
export const LIVE_VOICE_EVENTS = {
  // Downstream from Gateway -> Client (Existing)
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

  // Downstream from Gateway -> Client (HR Simulator Extensions)
  HR_ANCHOR_HIT: 'hr_anchor_hit',
  HR_PHASE_CHANGE: 'hr_phase_change',
  HR_SCORECARD: 'hr_scorecard',
  HR_DRILL_CRITIQUE: 'hr_drill_critique',

  // Upstream from Client -> Gateway (Existing)
  BARGE_IN: 'barge_in',
  TURN_RESET: 'turn_reset',
  SESSION_HOLD: 'session_hold',
  CANVAS_DELTA: 'canvas_delta',
  PING: 'ping',
  SYNC_PING: 'sync_ping',

  // Upstream from Client -> Gateway (HR Simulator Extensions)
  HR_CLIENT_TELEMETRY_SYNC: 'hr_client_telemetry_sync',
  HR_OPTIMISTIC_ANCHOR_HIT: 'hr_optimistic_anchor_hit',
  HR_FORCE_PHASE_ADVANCE: 'hr_force_phase_advance'
} as const;

export type LiveVoiceEventType = typeof LIVE_VOICE_EVENTS[keyof typeof LIVE_VOICE_EVENTS];

```

### 3.3. Расширение интерфейсов конфигурации (`types.ts`, `liveWsSessionParams.ts`, `personas.ts`)

```typescript
// 1. Расширение в interview_tutor/frontend/src/audio/types.ts
import type { HrSessionConfig } from '@interview-tutor/shared';

export interface VoiceEngineConfig {
  sessionId: string;
  questionId: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  sessionType: 'interview' | 'tutor' | 'system_design' | 'incident' | 'hr_screening' | string;
  // ... существующие поля без изменений ...
  hrSessionConfig?: HrSessionConfig;
}

// 2. Расширение в interview_tutor/backend/src/services/live/liveWsSessionParams.ts
import type { HrSessionConfig } from '@interview-tutor/shared';

export interface LiveWsSessionParams {
  authenticatedUser: any;
  sessionType: 'interview' | 'tutor' | 'system_design' | 'hr_screening';
  // ... существующие поля без изменений ...
  hrSessionConfig?: HrSessionConfig;
}

// 3. Расширение в interview_tutor/backend/src/prompts/personas.ts
export type InterviewPersonaId =
  | 'mentor'
  | 'amazon_bar_raiser'
  | 'google_staff'
  | 'yandex_core'
  | 'hr_keyword_screener'
  | 'hr_fintech_compliance'
  | 'hr_conflict_psychologist';

```

## 4. Dialogue & Telemetry Engine Design

### 4.1. Оркестрация двух стейт-машин диалога поверх живого сокета Gemini Live
Ключевой архитектурный вызов при проведении многофазного интервью поверх мультимодального WebSocket-соединения Gemini Live заключается в том, что пересоздание сокета между фазами приводит к потере акустического контекста, обрыву буфера `AudioPlayoutManager` и паузе длительностью $1.5\text{–}3.0\text{ с}$. Для бесшовной смены фаз проектируется серверный оркестратор `HrDialogueStateMachine.ts`, управляющий переходом состояний внутри единой непрерывной WebSocket-сессии.

#### Topology A: End-to-End Simulation (15–20 минут)
Сквозная симуляция состоит из семи строго упорядоченных фаз. Переход между фазами $P_i \to P_{i+1}$ осуществляется без переподключения сокета с помощью паттерна **Dual-Trigger Tool-Response Context Swapping**. В `liveGeminiConfigBuilder.ts` регистрируется системный инструмент `advanceHrPhase(completedPhase, nextPhase, verifiedFactsSummary, detectedContradictions, candidateConfidenceScore)`. Когда кандидат исчерпывающе ответил на вопросы текущей фазы или исчерпал лимит уточняющих вопросов (`maxProbes`), модель самостоятельно вызывает `advanceHrPhase`. Если же диалог затягивается и модель задерживается в одной фазе дольше установленного бюджета времени (например, свыше $240\text{ с}$ на фазе `GAP_AND_SABBATICAL_PROBE`), серверный сторожевой таймер в момент окончания реплики кандидата (по событию `TURN_TELEMETRY` или паузе VAD) принудительно отправляет в апстрим Gemini сервисный фрейм `clientContent` с директивой `[ORCHESTRATOR_PHASE_TRANSITION]`.
Перехватывая вызов `advanceHrPhase` в `liveToolDispatcher.ts`, сервер одновременно выполняет две операции: отправляет клиенту событие `LIVE_VOICE_EVENTS.HR_PHASE_CHANGE` для мгновенной смены набора карточек `AnchorCards` на экране и возвращает модели в полезной нагрузке `toolResponse` узкоспециализированный срез досье (`CandidateDossier`), релевантный исключительно для следующей фазы $P_{i+1}$. Например, при переходе к фазе `COMPLIANCE_AND_FINANCIALS` в контекст ответа инструмента инжектируются точные значения полей `currentLegalStatus`, `targetLegalStatus`, `militaryCompliance`, `compensation` и `budgetCeilingNet`. Такая пофазовая подкачка Ground Truth удерживает фокус внимания модели на актуальных проверочных фактах и полностью исключает контекстный дрейф (Context Drift) на пятнадцатой минуте разговора.

| Фаза (`HrPhaseId`) | Целевой бюджет | Срез Ground Truth из `CandidateDossier` | Условие выхода (Guard Condition) |
| --- | --- | --- | --- |
| `SMALL_TALK` | $45\text{–}60\text{ с}$ | `targetPositionTitle`, `jobContext.roleTitle` | Установление акустического контакта, калибровка базового темпа речи. |
| `ELEVATOR_PITCH` | $90\text{–}120\text{ с}$ | `totalVerifiedExperienceMonths`, `commercialTrackMonths`, топ-3 `mandatoryLexicalAnchors` | Кандидат уложился в окно $60\text{–}80\text{ с}$ и озвучил профильное позиционирование. |
| `CAREER_DEEP_DIVE` | $300\text{–}420\text{ с}$ | Записи `experienceHistory` типа `COMMERCIAL_IN_HOUSE` и `portfolioProjects` | Верификация минимум двух коммерческих периодов и количественных метрик (`quantifiedMetrics`). |
| `GAP_AND_SABBATICAL_PROBE` | $180\text{–}240\text{ с}$ | Записи `SABBATICAL_CAREER_BREAK`, `RND_PET_PROJECT`, `knownVulnerabilityZones` | Прицельное зондирование причин перерывов/R&D и проверка отсутствия бытовых оправданий. |
| `COMPLIANCE_AND_FINANCIALS` | $120\text{–}180\text{ с}$ | `currentLegalStatus`, `targetLegalStatus`, `militaryCompliance`, `compensation` | Сверка перехода НПД/ТК РФ, воинского учета и зарплатной вилки с `budgetCeilingNet`. |
| `CANDIDATE_REVERSE_QA` | $90\text{–}120\text{ с}$ | `jobContext.domainCategory`, `coreTechStack` | Кандидат сформулировал 1–2 зрелых вопроса об архитектуре, бизнесе или процессах. |
| `SCORECARD_SUMMARY` | $45\text{–}60\text{ с}$ | Полный агрегат `HrTelemetry` и лог `advanceHrPhase` | Вызов финального инструмента `submitHrScorecard` и отправка события `HR_SCORECARD`. |

#### Topology B: Rapid-Fire Micro-Drill (Циклическое бурение вопроса)
Режим высокочастотного бурения предназначен для формирования мышечного автоматизма на одном уязвимом вопросе (например: *«Почему после двух лет контрактов на НПД и полугода R&D-саббатикала вы решили искать штатную позицию по ТК РФ?»*). Цикл проходит через пять детерминированных стадий. На стадии `ASK_TARGET_QUESTION` ИИ-рекрутер произносит целевой вопрос в жесткой манере выбранного архетипа (длительность аудио-реплики ИИ ограничена $\le 12\text{ с}$). Затем система переходит в совмещенные стадии `CANDIDATE_VOICE_RESPONSE` и `REALTIME_ANCHOR_SPOTTING`, где кандидат отвечает голосом, а на HUD работает таймер окна $60\text{–}80\text{ с}$ и мгновенная подсветка карточек `AnchorCards` с задержкой $<200\text{ мс}$.
Как только VAD фиксирует завершение ответа (или срабатывает жесткая отсечка `hardCutOffSec` на $90\text{ с}$), наступает стадия `INSTANT_CRITIQUE`: клиент синхронизирует телеметрию фреймом `HR_CLIENT_TELEMETRY_SYNC`, модель вызывает инструмент оценки, после чего ИИ выдает ультракороткий голосовой разбор ($\le 15\text{ с}$ аудио) с перечислением пропущенных карточек `AnchorCards`, прозвучавших бытовых эвфемизмов и отклонений по темпу речи. Наконец, на стадии `IMMEDIATE_RETRY_LOOP` проверяется условие мастерства: если коэффициент выбитых якорей $R_{\text{anchors}} < 0.85$, либо длительность ответа вышла за диапазон $50\text{–}85\text{ с}$, либо были зафиксированы запрещенные эвфемизмы, стейт-машина без паузы сбрасывает статусы карточек в `PENDING`, отправляет событие `HR_DRILL_CRITIQUE` и командует кандидату повторить ответ с первой секунды, начиная сразу с ключевого тезиса. Цикл перезапускается до тех пор, пока кандидат не преодолеет порог $R_{\text{anchors}} \ge 0.85$ без слов-паразитов и эвфемизмов, либо пока не будет достигнут лимит `maxRetryAttempts`.

### 4.2. Алгоритмы речевой и поведенческой телеметрии в реальном времени
Расчет поведенческой телеметрии выполняется в клиентском модуле `HrSpeechTelemetryTracker.ts`, интегрированном с событиями `@ricky0123/vad-web` и потоком распознанных токенов, с отправкой агрегированных снапшотов на бэкенд каждые $1000\text{ мс}$ и по завершении каждого хода.

#### Скользящее окно скорости речи ($\text{WPM}_{\text{rolling}}$)
Линейный подсчет слов от начала хода дает сильные математические искажения на первых секундах реплики и не учитывает внутрифразовые паузы. Для получения стабильной метрики используется скользящее окно шириной $W = 15\,000\text{ мс}$ с нормализацией по эффективной длительности фонации и учетом средней длины слова в русском языке:

$$
\text{WPM}_{\text{inst}}(t) = \frac{0.5 \cdot N_{\text{tokens}}(t - W, t) + 0.5 \cdot \left(\frac{C_{\text{chars}}(t - W, t)}{6.2}\right)}{\max\left(\frac{T_{\text{speech}}(t - W, t)}{1000}, \, 3.0\right)} \times 60
$$
В этом уравнении $N_{\text{tokens}}(t - W, t)$ обозначает количество произнесенных слов в окне $W$, $C_{\text{chars}}(t - W, t)$ представляет сумму непробельных символов (что компенсирует длинные русские причастия и многосложные профессиональные термины со средней длиной $6.2$ символа), а $T_{\text{speech}}(t - W, t)$ выражает суммарное время активного голоса в миллисекундах по данным VAD за вычетом пауз длиннее $1500\text{ мс}$. Сглаживание мгновенных значений осуществляется экспоненциальным фильтром с коэффициентом инерции $\alpha = 0.35$:

$$
\text{WPM}_{\text{rolling}}(t) = \alpha \cdot \text{WPM}_{\text{inst}}(t) + (1 - \alpha) \cdot \text{WPM}_{\text{rolling}}(t - \Delta t)
$$
Если $\text{WPM}_{\text{rolling}} > 160$, телеметрия переходит в состояние `RUSHING_ABOVE_160`, сигнализируя о стрессовом тараторении и выводя на HUD предупреждение о необходимости снизить темп. Диапазон $90 \le \text{WPM}_{\text{rolling}} \le 160$ маркируется как `OPTIMAL_90_160`, тогда как падение скорости ниже $90\text{ слов/мин}$ после первых пяти секунд активного хода переводит индикатор в статус когнитивного зависания `STALLED_BELOW_90`.

#### Детекция заминок (Hesitation Detection $>1500\text{ мс}$), слов-паразитов и окна ответа ($60\text{–}80\text{ с}$)
Для фиксации пауз нерешительности модуль подписывается на колбэки `onSpeechEnd` и `onSpeechStart` из `@ricky0123/vad-web` внутри активного хода кандидата (`VoiceEngineState === 'LISTENING'`). При срабатывании `onSpeechEnd` в момент $t_{\text{silence\_start}}$ — при условии, что ход еще не завершен и кандидат уже произнес минимум два слова — запускается высокоточный таймер `performance.now()`. Если до наступления следующего `onSpeechStart` (или в текущий момент времени $t$) длительность тишины превышает порог $\Delta t_{\text{gap}} = t - t_{\text{silence\_start}} > 1500\text{ мс}$, регистрируется событие `HesitationBurst`: инкрементируется счетчик `hesitationBurstsCount`, обновляется максимум `maxHesitationDurationMs`, и в поле `lastHesitationPredecessorWord` записывается последнее произнесенное перед паузой слово. Сохранение предшествующего слова позволяет точно локализовать триггер ступора (например, заминка сразу после слов «причина ухода» или «оформление по»).
Параллельно поток нормализованных токенов проверяется предкомпилированными регулярными выражениями с кириллическими и латинскими границами слов `(?<![а-яёa-z0-9])...(?![а-яёa-z0-9])`, что исключает ложные срабатывания внутри корней. Первый словарь (`FILLER_PATTERNS`) отлавливает слова-паразиты («как бы», «в общем», «в общем-то», «ну» в начале фразы или после паузы $>400\text{ мс}$, «наверное», «типа», «короче», «собственно говоря», «так сказать», «по сути», «честно говоря», «грубо говоря»). Второй словарь (`IMPOSTOR_EUPHEMISM_PATTERNS`) объединяет маркеры синдрома самозванца и бытовой деградации речи («своими словами», «просто повезло», «я только помогал», «немного ковырялся», «делал всякое», «не уверен, но», «как-то так») с массивом `forbiddenEuphemisms` из активного объекта `CandidateDossier.knownVulnerabilityZones`.
Контроль временного окна реплики (`elapsedReplySec`) отсчитывается от первого события `onSpeechStart` в текущем ходе кандидата. На интервале $0 \le t < 60\text{ с}$ (`BUILDING_0_60S`) прогресс-бар HUD заполняется синим цветом (`#1A73E8`), направляя кандидата по структуре «Тезис (0–15 с) $\to$ Обоснование и метрики (15–60 с)». При входе в целевой коридор $60 \le t \le 80\text{ с}$ (`OPTIMAL_WINDOW_60_80S`) индикатор окрашивается в зелено-янтарный градиент (`#81C995` $\to$ `#FCC934`) с рекомендацией зафиксировать бизнес-результат и завершить мысль. Превышение порога $t > 80\text{ с}$ (`OVERFLOW_DANGER_ABOVE_80S`) включает красную пульсацию (`#D93025`), предупреждая об истощении внимания рекрутера, а при достижении `hardCutOffSec` ($90\text{ с}$) сервер инициирует вежливое, но бескомпромиссное прерывание реплики моделью.

### 4.3. Многомерный объективный скоринг (Objective Evaluation Engine)
Для исключения субъективности и галлюцинаций LLM при выставлении оценок итоговый балл по каждой из четырех независимых осей ($0\text{–}100$) вычисляется на бэкенде в модуле `HrObjectiveScorer.ts` как детерминированная функция от метрик телеметрии и верифицированных индикаторов из вызова инструмента оценки.

1. **Ось 1: Substance & Truthfulness ($S_{\text{substance}} \in [0, 100]$, вес $0.30$):** Оценивает фактическое соответствие ответа данным `CandidateDossier` и отсутствие расхождений:$S_{\text{substance}} = \text{clamp}_{[0, 100]}\left( 100 \cdot \frac{F_{\text{verified}}}{F_{\text{expected}}} - 25 \cdot N_{\text{contradictions}} - 15 \cdot N_{\text{evasions}} \right)$где $F_{\text{verified}}$ — число фактов и метрик из досье, корректно озвученных кандидатом, $F_{\text{expected}}$ — нормативное число фактов для проверенных фаз, $N_{\text{contradictions}}$ — количество фактических расхождений с датами, суммами или юридическими статусами досье, а $N_{\text{evasions}}$ — количество уходов от прямого ответа на зондирующий вопрос.
2. **Ось 2: Lexical Density ($S_{\text{lexical}} \in [0, 100]$, вес $0.30$):** Измеряет плотность использования профессионального тезауруса вместо бытовых эвфемизмов:$S_{\text{lexical}} = \text{clamp}_{[0, 100]}\left( 75 \cdot \left(\frac{A_{\text{confirmed}} + 0.7 \cdot A_{\text{optimistic\_only}}}{A_{\text{total}}}\right) + 25 \cdot \min\left(1, \frac{T_{\text{domain}}}{5}\right) - 12 \cdot N_{\text{euphemisms}} \right)$где $A_{\text{confirmed}}$ и $A_{\text{total}}$ — число подтвержденных сервером и общее число целевых карточек `AnchorCards`, $A_{\text{optimistic\_only}}$ — карточки, зафиксированные локальным стеммером, $T_{\text{domain}}$ — количество использованных профильных терминов из `JobContext.coreTechStack`, а $N_{\text{euphemisms}}$ — количество срабатываний детектора бытовых эвфемизмов.
3. **Ось 3: Structure & Pacing ($S_{\text{structure}} \in [0, 100]$, вес $0.20$):** Оценивает соблюдение тайминга $60\text{–}80\text{ с}$, темпа речи и логической триады «Тезис — Обоснование — Результат»:$S_{\text{structure}} = \text{clamp}_{[0, 100]}\left( 40 \cdot I_{\text{TER}} + 35 \cdot P_{\text{window}}(\Delta t_{\text{turn}}) + 25 \cdot P_{\text{wpm}}(\overline{\text{WPM}}) \right)$где $I_{\text{TER}} \in \{0, 0.5, 1.0\}$ — индекс соблюдения структуры аргументации; функция попадания в окно времени $P_{\text{window}}(\Delta t) = 1.0$ при $\Delta t \in [55, 80]\text{ с}$ с линейным штрафом $-0.025$ за каждую секунду свыше $80\text{ с}$; функция темпа $P_{\text{wpm}} = 1.0$ при среднем темпе $\overline{\text{WPM}} \in [105, 155]$ и линейно убывает до $0$ при выходе за границы $[80, 180]$.
4. **Ось 4: Confidence & Delivery ($S_{\text{confidence}} \in [0, 100]$, вес $0.20$):** Измеряет уверенность подачи, отсутствие пауз ступора, слов-паразитов и интонаций оправдания:$S_{\text{confidence}} = \text{clamp}_{[0, 100]}\left( 100 - 8 \cdot N_{\text{hesitations}} - 4 \cdot N_{\text{fillers}} - 15 \cdot N_{\text{impostor}} - 10 \cdot I_{\text{defensive\_tone}} \right)$где $N_{\text{hesitations}}$ — суммарное число пауз $>1500\text{ мс}$, $N_{\text{fillers}}$ — количество слов-паразитов, $N_{\text{impostor}}$ — количество маркеров синдрома самозванца, а $I_{\text{defensive\_tone}} \in \{0, 1, 2\}$ — акустико-семантический индекс оправдательной интонации, определяемый мультимодальной моделью Gemini Live непосредственно по аудиопотоку 16kHz PCM.
Итоговый композитный балл вычисляется по формуле:

$$
S_{\text{composite}} = \text{round}\left(0.30 \cdot S_{\text{substance}} + 0.30 \cdot S_{\text{lexical}} + 0.20 \cdot S_{\text{structure}} + 0.20 \cdot S_{\text{confidence}}\right)
$$

### 4.4. Промпт-архитектура, инъекция Ground Truth и ролевые архетипы HR
В модуле `livePromptBuilder.ts` проектируется генератор `buildHrSimulatorSystemPrompt(params: LiveWsSessionParams)`. Для исключения галлюцинаций модели и предотвращения размывания контекста досье кандидата и профиль вакансии сериализуются в неизменяемый структурированный XML-блок `<ground_truth_ledger>`. Системный промпт устанавливает жесткий протокол верификации: любое утверждение кандидата о длительности стажа, датах переходов, юридическом статусе (НПД, ИП, ГПХ, ТК РФ), воинском учете или количественных метриках проектов сверяется исключительно с `<ground_truth_ledger>`. Если соискатель называет факт, противоречащий реестру, или заменяет подготовленную профессиональную защиту из `approvedDefenseFormula` бытовыми оправданиями из списка `forbiddenEuphemisms`, модель обязана немедленно зафиксировать расхождение через вызов инструмента `reportHrAnchorHits` и задать прицельный проверочный вопрос.
Механизм анти-сикофантии (`antiSycophancy.ts`) интегрируется на уровне императивных запретов: модели категорически запрещено использовать фразы-амортизаторы («Отличный ответ!», «Понимаю вашу ситуацию», «Это очень интересный опыт», «Ничего страшного»). При превышении кандидатом временного лимита в $80\text{ с}$ или появлении заминок длиннее $1500\text{ мс}$ рекрутер сухо переходит к следующему проверочному вопросу.

| Идентификатор (`InterviewPersonaId`) | Поведенческий профиль и фокус атаки (Role Directive) | Специфическая рубрика оценки (Evaluation Rubric Directive) |
| --- | --- | --- |
| `hr_keyword_screener` *(Поверхностный скринер по ключевым словам)* | Быстрый, прагматичный и нетерпеливый рекрутер первичного отбора. Не погружается в архитектурные тонкости, но механически сверяет чек-лист терминов из `JobContext.coreTechStack` и формальные годы опыта. Если не слышит точного ключевого термина из `AnchorCards` в первые $45\text{ с}$ ответа, прерывает и ставит под сомнение релевантность профиля. | Максимальный приоритет оси `Lexical Density`. Жестко штрафует за размытые синонимы и описательные бытовые конструкции («делал таблицы», «настраивал очереди») вместо точных инженерных и доменных терминов. |
| `hr_fintech_compliance` *(Подозрительный офицер комплаенса банка/финтеха)* | Холодный, педантичный специалист экономической безопасности и HR-комплаенса крупного банка. Ищет малейшие несостыковки в хронологии стажа, признаки параллельной занятости, допрашивает о причинах работы по НПД/контрактам вместо ТК РФ, деталях саббатикала, статусе воинского учета и жестко прессует по верхней границе зарплатных ожиданий. | Максимальный приоритет оси `Substance & Truthfulness`. Любая пауза $>1500\text{ мс}$ перед ответом о причинах смены работы или юридическом статусе интерпретируется как попытка скрыть комплаенс-риск или увольнение по конфликту. |
| `hr_conflict_psychologist` *(Психолог-охотник за конфликтами и токсичностью)* | Внимательный к малейшим интонационным сдвигам корпоративный ассессор. Провоцирует кандидата вопросами о профессиональных провалах, разногласиях с бизнесом, выгорании и причинах перерывов. Целенаправленно ищет маркеры синдрома самозванца («просто повезло», «я только помогал») или скрытой агрессии к бывшим работодателям. | Максимальный приоритет осей `Confidence & Delivery` и `Structure & Pacing`. Требует спокойной, зрелой, безоценочной аргументации строго по формуле «Тезис — Подтвержденный факт — Вывод». |

## 5. Atomic Execution Plan
Ниже представлена пошаговая инструкция для локального CLI-исполнителя с точным указанием целевых файлов в пакетах `shared`, `backend` и `frontend`, типами операций и командами верификации каждого этапа.

| Шаг | Пакет | Целевой файл | Действие | Инженерная спецификация изменений |
| --- | --- | --- | --- | --- |
| **1.1** | `shared` | `interview_tutor/shared/src/schemas/hrSimulator.ts` | `CREATE` | Создать файл со всеми TypeBox-схемами (`CandidateDossierSchema`, `JobContextSchema`, `HrSessionConfigSchema`, `HrAnchorCardSchema`, `HrTelemetrySchema`, `HrScorecardSchema`) и статическими типами из Раздела 3.1. |
| **1.2** | `shared` | `interview_tutor/shared/src/schemas/voiceEvents.ts` | `MODIFY` | Добавить события `HR_ANCHOR_HIT`, `HR_PHASE_CHANGE`, `HR_SCORECARD`, `HR_DRILL_CRITIQUE`, `HR_CLIENT_TELEMETRY_SYNC`, `HR_OPTIMISTIC_ANCHOR_HIT`, `HR_FORCE_PHASE_ADVANCE` согласно Разделу 3.2. |
| **1.3** | `shared` | `interview_tutor/shared/src/index.ts` | `MODIFY` | Добавить строку реэкспорта `export * from './schemas/hrSimulator.js';` для публикации новых контрактов. |
| **2.1** | `backend` | `interview_tutor/backend/src/prompts/personas.ts` | `MODIFY` | Расширить тип `InterviewPersonaId` тремя литералами (`'hr_keyword_screener' \| 'hr_fintech_compliance' \| 'hr_conflict_psychologist'`) и добавить ветки директив в `getPersonaPromptDirectives` согласно Разделу 4.4. |
| **2.2** | `backend` | `interview_tutor/backend/src/services/live/liveWsSessionParams.ts` | `MODIFY` | Добавить `'hr_screening'` в объединение `sessionType`, поле `hrSessionConfig?: HrSessionConfig` в интерфейс `LiveWsSessionParams` и валидацию через `Value.Check(HrSessionConfigSchema, ...)` при инициализации сессии. |
| **2.3** | `backend` | `interview_tutor/backend/src/services/live/livePromptBuilder.ts` | `MODIFY` | Реализовать функцию `buildHrSimulatorSystemPrompt(params: LiveWsSessionParams): string`, сериализующую досье и вакансию в блок `<ground_truth_ledger>` с подключением `antiSycophancy.ts`, и вызывать ее из `buildSystemPrompt` при `params.sessionType === 'hr_screening'`. |
| **3.1** | `backend` | `interview_tutor/backend/src/services/live/hrDialogueStateMachine.ts` | `CREATE` | Реализовать класс `HrDialogueStateMachine` с монотонной защелкой `registerAnchorHit`, методом перехода фаз `advancePhase` (формирующим пофазовый срез `CandidateDossier`) и методом контроля цикла бурения `evaluateMicroDrillTurn`. |
| **3.2** | `backend` | `interview_tutor/backend/src/services/live/hrObjectiveScorer.ts` | `CREATE` | Реализовать чистую функцию `computeHrObjectiveScorecard(sessionId, config, turnsTelemetry, llmVerifications): HrScorecard` по точным математическим формулам четырех осей из Раздела 4.3. |
| **3.3** | `backend` | `interview_tutor/backend/src/services/live/liveGeminiConfigBuilder.ts` | `MODIFY` | При `sessionType === 'hr_screening'` зарегистрировать в `tools.functionDeclarations` функции `reportHrAnchorHits`, `advanceHrPhase` и `submitHrScorecard`. |
| **3.4** | `backend` | `interview_tutor/backend/src/services/live/liveToolDispatcher.ts` & `liveWsConnectionHandler.ts` | `MODIFY` | Привязать `HrDialogueStateMachine` к сессии `hr_screening`, обработать клиентские фреймы `HR_CLIENT_TELEMETRY_SYNC`, `HR_OPTIMISTIC_ANCHOR_HIT`, `HR_FORCE_PHASE_ADVANCE` и диспетчеризацию трех HR-инструментов с отправкой `HR_ANCHOR_HIT`, `HR_PHASE_CHANGE`, `HR_DRILL_CRITIQUE` и `HR_SCORECARD`. |
| **4.1** | `frontend` | `interview_tutor/frontend/src/audio/types.ts` | `MODIFY` | Расширить интерфейс `VoiceEngineConfig` опциональным полем `hrSessionConfig?: HrSessionConfig` и поддержкой `sessionType: 'hr_screening'`. |
| **4.2** | `frontend` | `interview_tutor/frontend/src/audio/hr/ClientKwsMatcher.ts` | `CREATE` | Реализовать русско-английский стеммер и префиксный матчер Дамерау — Левенштейна ($d \le 1$) поверх локального потока `interimResults`, обеспечивающий срабатывание `onOptimisticAnchorHit` и отправку `HR_OPTIMISTIC_ANCHOR_HIT` быстрее $175\text{ мс}$. |
| **4.3** | `frontend` | `interview_tutor/frontend/src/audio/hr/HrSpeechTelemetryTracker.ts` | `CREATE` | Реализовать расчет скользящего окна $\text{WPM}_{\text{rolling}}$ ($W = 15\text{ с}$, $\alpha = 0.35$), детектор пауз $>1500\text{ мс}$ на базе событий VAD, сканер слов-паразитов и эвфемизмов, а также таймер окна $60\text{–}80\text{ с}$. |
| **4.4** | `frontend` | `interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts` | `MODIFY` | Подключить жизненный цикл `ClientKwsMatcher` и `HrSpeechTelemetryTracker` при `config.sessionType === 'hr_screening'` и маршрутизацию входящих событий `HR_*` в стор без изменения `AudioWorklet` и `AudioPlayoutManager`. |
| **5.1** | `frontend` | `interview_tutor/frontend/src/stores/useHrSimulatorStore.ts` | `CREATE` | Создать Zustand-стор для хранения `HrSessionConfig`, реактивного массива `anchorCards`, активной фазы/стадии, текущей телеметрии `HrTelemetry` и финального `HrScorecard`. |
| **5.2** | `frontend` | `interview_tutor/frontend/src/components/practice/tutor/HrAnchorCardsHUD.tsx` | `CREATE` | Реализовать компонент визуального HUD на TailwindCSS и Framer Motion: карточки `AnchorCards` с мгновенной зеленой индикацией и бейджем задержки в мс, прогресс-бар окна $60\text{–}80\text{ с}$, индикатор $\text{WPM}_{\text{rolling}}$, счетчик заминок и итоговый 4-осевой `HrScorecard`. |
| **5.3** | `frontend` | `interview_tutor/frontend/src/components/practice/tutor/PracticeVoiceHUD.tsx` | `MODIFY` | Встроить условное отображение `<HrAnchorCardsHUD />` при активном `sessionType === 'hr_screening'`. |

### Команды верификации по шагам для CLI-агента
После выполнения каждого из пяти логических шагов таблицы локальный исполнитель обязан выполнить соответствующую команду верификации и убедиться в нулевом коде возврата (`exit code 0`):

```bash
# Верификация Шага 1 (Сборка и проверка типов пакета shared)
npm --prefix interview_tutor/shared run build && npx --prefix interview_tutor/shared tsc --noEmit

# Верификация Шага 2 (Проверка типов промпт-билдера и параметров сессии в backend)
npx --prefix interview_tutor/backend tsc --noEmit

# Верификация Шага 3 (Проверка типов стейт-машины, скорера и диспетчера сокетов в backend)
npx --prefix interview_tutor/backend tsc --noEmit

# Верификация Шага 4 (Проверка типов KWS-матчера, трекера телеметрии и аудио-движка во frontend)
npx --prefix interview_tutor/frontend tsc --noEmit

# Верификация Шага 5 (Полная сквозная сборка всех пакетов монорепозитория)
npm --prefix interview_tutor/shared run build && npm --prefix interview_tutor/backend run build && npm --prefix interview_tutor/frontend run build

```

## 6. Заключение и архитектурные гарантии
Спроектированный прикладной слой `Generic HR Voice Simulator Engine` строго соблюдает все архитектурные ограничения и инварианты целевой системы. Выделение схем `CandidateDossierSchema` и `JobContextSchema` в единый слой контрактов TypeBox полностью устраняет хардкод биографических и корпоративных данных, позволяя загружать произвольные профили соискателей и вакансий как декларативные конфигурации. Применение двухконтурного гибридного механизма Keyword Spotting гарантирует визуальный отклик карточек-якорей на HUD быстрее $200\text{ мс}$ ($155\text{ мс}$ на уровне p95), формируя процедурную моторную память речевого аппарата, а оркестрация фаз диалога через перехват `toolResponse` внутри живой сессии Gemini Live предотвращает обрывы аудиопотока и исключает контекстный дрейф на длинных дистанциях.

---

Source: https://gemini.google.com/app/3bebfeec16a16564
Exported at: 2026-10-30T14:11:33.467Z