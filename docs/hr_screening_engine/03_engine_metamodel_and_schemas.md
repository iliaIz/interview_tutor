# Метамодель данных и схемы контрактов (HR Engine Data Contracts)

**Версия документа:** SOTA Late 2026 (Октябрь 2026)  
**Назначение:** Канонические схемы контрактов `@sinclair/typebox` и интерфейсы TypeScript для размещения в `shared/src/schemas/` и использования в шлюзе и клиенте.

---

## 1. Схема досье кандидата (`CandidateDossierSchema`)

```typescript
import { Type, Static } from '@sinclair/typebox';

export const CareerTrackItemSchema = Type.Object({
  id: Type.String(),
  company: Type.String(),
  role: Type.String(),
  startDate: Type.String({ description: 'YYYY-MM or string' }),
  endDate: Type.Union([Type.String(), Type.Literal('present')]),
  durationMonths: Type.Integer(),
  isOfficialRecord: Type.Boolean({ description: 'Зафиксировано ли в СТД-СФР / Госуслугах' }),
  verificationProof: Type.Optional(Type.String({ description: 'Выписка СТД-СФР с ЭЦП' })),
  scaleMetrics: Type.Array(Type.String(), { description: 'Например: 15+ млн документов, 5000+ RPS' }),
  primaryStack: Type.Array(Type.String()),
  exitReason: Type.String({ description: 'Каноническая причина перехода' })
});

export const LegalComplianceSchema = Type.Object({
  militaryStatus: Type.String({ description: 'Категория В, запас, старше 30 лет' }),
  militaryTicketOnHands: Type.Boolean(),
  currentTaxStatus: Type.Union([Type.Literal('npd_self_employed'), Type.Literal('unemployed'), Type.Literal('employed_tk')]),
  taxRegistrationDate: Type.Optional(Type.String()),
  taxDocumentForm: Type.Optional(Type.String({ description: 'КНД 1122035' })),
  receiptsAvailable: Type.Boolean({ description: 'false для pre-revenue R&D' }),
  receiptsLegalJustification: Type.String({ description: 'ст. 2 и 14 ФЗ № 422-ФЗ' }),
  citizenship: Type.String(),
  taxResidency: Type.String()
});

export const CompensationExpectationsSchema = Type.Object({
  targetSalaryNet: Type.Integer({ description: '310000 - 330000' }),
  currency: Type.Literal('RUB'),
  taxFormat: Type.Literal('tk_rf'),
  probationDiscountAcceptable: Type.Boolean({ description: 'false - 310k с первого дня' }),
  parallelOffersStatus: Type.String(),
  noticePeriodDays: Type.Integer({ description: '7-10 дней' })
});

export const ProjectShowcaseSchema = Type.Object({
  name: Type.String(),
  repoUrl: Type.String(),
  isOpenSource: Type.Boolean(),
  topology: Type.String({ description: 'Dual-Service Topology' }),
  rpsSustained: Type.Integer({ description: '2200' }),
  p95LatencyMs: Type.Number({ description: '28.4' }),
  keyPatterns: Type.Array(Type.String(), { description: 'Transactional Outbox, Virtual Threads Loom, pgvector, XFetch' }),
  testParity: Type.String({ description: '100% Testcontainers without H2' })
});

export const CandidateDossierSchema = Type.Object({
  dossierId: Type.String(),
  fullName: Type.String(),
  targetRole: Type.String(),
  totalExperienceYears: Type.Number(),
  location: Type.String(),
  remotePolicy: Type.Literal('100_percent_remote_rf'),
  careerTracks: Type.Array(CareerTrackItemSchema),
  compliance: LegalComplianceSchema,
  financials: CompensationExpectationsSchema,
  showcase: ProjectShowcaseSchema,
  prohibitedPhrases: Type.Array(Type.String(), { description: 'Черный список стоп-слов для детекции' })
});

export type CandidateDossier = Static<typeof CandidateDossierSchema>;
```

---

## 2. Схема контекста вакансии (`JobContextSchema`)

```typescript
export const JobContextSchema = Type.Object({
  jobId: Type.String(),
  companyName: Type.String(),
  industryDomain: Type.Union([
    Type.Literal('fintech_banking'),
    Type.Literal('bigtech_ecommerce'),
    Type.Literal('system_integrator'),
    Type.Literal('product_saas')
  ]),
  roleTitle: Type.String(),
  requiredKeywords: Type.Array(Type.String(), { description: 'Java 21, Spring Boot 3, Kafka, Postgres' }),
  hiringGoal: Type.Union([
    Type.Literal('highload_expansion'),
    Type.Literal('legacy_migration'),
    Type.Literal('platform_engineering')
  ]),
  companyCultureRedFlags: Type.Array(Type.String())
});

export type JobContext = Static<typeof JobContextSchema>;
```

---

## 3. Схема конфигурации сессии и скоринг-карты (`HrSessionConfigSchema`)

```typescript
export const HrSessionModeSchema = Type.Union([
  Type.Literal('full_screening_simulation'),
  Type.Literal('rapid_fire_micro_drill')
]);

export const HrPersonaIdSchema = Type.Union([
  Type.Literal('friendly_sourcer'),
  Type.Literal('bank_compliance_officer'),
  Type.Literal('behavioral_conflict_hunter')
]);

export const HrSessionConfigSchema = Type.Object({
  sessionId: Type.String(),
  mode: HrSessionModeSchema,
  personaId: HrPersonaIdSchema,
  targetQuestionId: Type.Optional(Type.String({ description: 'Используется в режиме micro_drill' })),
  dossierId: Type.String(),
  jobId: Type.Optional(Type.String()),
  targetPacingWindowSec: Type.Object({
    minSec: Type.Integer({ default: 60 }),
    maxSec: Type.Integer({ default: 80 })
  }),
  activeKeywords: Type.Array(Type.String(), { description: 'Слова-якоря для визуального HUD' })
});

export const HrScorecardSchema = Type.Object({
  turnId: Type.String(),
  questionId: Type.String(),
  overallScore: Type.Integer({ minimum: 0, maximum: 100 }),
  metrics: Type.Object({
    substanceMatch: Type.Integer({ minimum: 0, maximum: 100, description: 'Соответствие фактам досье' }),
    lexicalDensity: Type.Integer({ minimum: 0, maximum: 100, description: 'Процент сеньорного тезауруса' }),
    pacingScore: Type.Integer({ minimum: 0, maximum: 100, description: 'Укладывание в окно 60-80 сек' }),
    deliveryConfidence: Type.Integer({ minimum: 0, maximum: 100, description: 'Уверенность речи без заискивания' })
  }),
  turnDurationSec: Type.Number(),
  wpm: Type.Number(),
  fillerWordsSpotted: Type.Array(Type.String()),
  anchorsHit: Type.Array(Type.String()),
  anchorsMissed: Type.Array(Type.String()),
  actionableCritique: Type.String({ description: 'Четкий разбор: что улучшить в следующем дубле' })
});

export type HrScorecard = Static<typeof HrScorecardSchema>;
```

---

## 4. Расширение событий WebSocket (`shared/src/schemas/voiceEvents.ts`)

```typescript
export const HR_VOICE_EVENTS = {
  // Downstream (Gateway -> Client)
  HR_ANCHOR_SPOTTED: 'hr_anchor_spotted',       // { keyword: string, latencyMs: number }
  HR_PACING_TICK: 'hr_pacing_tick',             // { elapsedSec: number, currentWpm: number, warningLevel: 'green'|'yellow'|'red' }
  HR_SCORECARD_READY: 'hr_scorecard_ready',     // HrScorecard
  HR_PHASE_TRANSITION: 'hr_phase_transition',   // { fromPhase: string, toPhase: string }

  // Upstream (Client -> Gateway)
  HR_DRILL_RETRY: 'hr_drill_retry',             // { questionId: string }
  HR_DRILL_NEXT: 'hr_drill_next'                // { nextQuestionId: string }
} as const;
```
