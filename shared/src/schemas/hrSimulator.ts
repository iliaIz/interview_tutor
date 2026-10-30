import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// 1. CAREER & COMPLIANCE DATA CONTRACTS
// ============================================================================

export const LegalTaxStatusSchema = Type.Union([
  Type.Literal('tk_rf_full_time'),
  Type.Literal('npd_self_employed'),
  Type.Literal('ip_contractor'),
  Type.Literal('gph_civil'),
  Type.Literal('unemployed')
]);
export type LegalTaxStatus = Static<typeof LegalTaxStatusSchema>;

export const MilitaryStatusSchema = Type.Object({
  category: Type.Union([
    Type.Literal('A'),
    Type.Literal('B'),
    Type.Literal('V'),
    Type.Literal('G'),
    Type.Literal('D')
  ]),
  inReserve: Type.Boolean(),
  exemptByAge: Type.Boolean({ description: 'true if >= 30 years old' }),
  ticketOnHands: Type.Boolean(),
  description: Type.String()
});
export type MilitaryStatus = Static<typeof MilitaryStatusSchema>;

export const CareerTrackItemSchema = Type.Object({
  id: Type.String(),
  companyAlias: Type.String(),
  role: Type.String(),
  startDate: Type.String({ description: 'YYYY-MM format' }),
  endDate: Type.Union([Type.String(), Type.Literal('present')]),
  durationMonths: Type.Integer({ minimum: 1 }),
  isOfficialRecord: Type.Boolean({ description: 'Confirmed via STD-SFR / Gosuslugi' }),
  verificationProof: Type.Optional(Type.String({ description: 'Document name, e.g. STD-SFR with digital signature' })),
  scaleMetrics: Type.Array(Type.String(), { description: 'e.g. 15+ million docs, 5000+ active users' }),
  primaryStack: Type.Array(Type.String()),
  exitReason: Type.String({ description: 'Canonical exit justification' }),
  achievements: Type.Array(Type.String())
});
export type CareerTrackItem = Static<typeof CareerTrackItemSchema>;

export const LegalComplianceSchema = Type.Object({
  military: MilitaryStatusSchema,
  taxStatus: LegalTaxStatusSchema,
  taxRegistrationDate: Type.Optional(Type.String()),
  taxDocumentForm: Type.Optional(Type.String({ description: 'e.g. KND 1122035' })),
  receiptsAvailable: Type.Boolean({ description: 'false for pre-revenue R&D' }),
  receiptsLegalJustification: Type.String({ description: 'Legal ground: Articles 2 & 14 of Federal Law No. 422-FZ' }),
  citizenship: Type.String(),
  taxResidency: Type.String()
});
export type LegalCompliance = Static<typeof LegalComplianceSchema>;

export const CompensationExpectationsSchema = Type.Object({
  targetSalaryNet: Type.Integer({ minimum: 50000, description: 'Net take-home salary in RUB' }),
  currency: Type.Literal('RUB'),
  taxFormat: Type.Literal('tk_rf'),
  probationDiscountAcceptable: Type.Boolean({ description: 'false if full salary required from day 1' }),
  parallelOffersStatus: Type.String(),
  noticePeriodDays: Type.Integer({ default: 10 })
});
export type CompensationExpectations = Static<typeof CompensationExpectationsSchema>;

export const ProjectShowcaseSchema = Type.Object({
  name: Type.String(),
  repoUrl: Type.String(),
  isOpenSource: Type.Boolean(),
  topology: Type.String({ description: 'e.g. Dual-Service Architecture' }),
  rpsSustained: Type.Integer({ minimum: 0 }),
  p95LatencyMs: Type.Number({ minimum: 0 }),
  keyPatterns: Type.Array(Type.String(), { description: 'Transactional Outbox, Virtual Threads Loom, pgvector, etc.' }),
  testParity: Type.String({ description: 'e.g. 100% Testcontainers without H2' })
});
export type ProjectShowcase = Static<typeof ProjectShowcaseSchema>;

// ============================================================================
// 2. CANDIDATE GROUND TRUTH DOSSIER SCHEMA
// ============================================================================

export const CandidateDossierSchema = Type.Object({
  dossierId: Type.String(),
  fullName: Type.String(),
  age: Type.Integer({ minimum: 18, maximum: 90 }),
  targetRole: Type.String(),
  totalExperienceYears: Type.Number(),
  location: Type.String(),
  remotePolicy: Type.Union([
    Type.Literal('100_percent_remote_rf'),
    Type.Literal('hybrid_possible'),
    Type.Literal('relocation_ready')
  ]),
  careerTracks: Type.Array(CareerTrackItemSchema, { minItems: 1 }),
  compliance: LegalComplianceSchema,
  financials: CompensationExpectationsSchema,
  showcase: ProjectShowcaseSchema,
  prohibitedPhrases: Type.Array(Type.String(), { description: 'Colloquial euphemisms and defensive phrases to penalize' })
});
export type CandidateDossier = Static<typeof CandidateDossierSchema>;

// ============================================================================
// 3. JOB CONTEXT SCHEMA
// ============================================================================

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
  requiredKeywords: Type.Array(Type.String()),
  hiringGoal: Type.Union([
    Type.Literal('highload_expansion'),
    Type.Literal('legacy_migration'),
    Type.Literal('platform_engineering')
  ]),
  companyCultureRedFlags: Type.Array(Type.String())
});
export type JobContext = Static<typeof JobContextSchema>;

// ============================================================================
// 4. SESSION MODES, PERSONAS & PHASES
// ============================================================================

export const HrSessionModeSchema = Type.Union([
  Type.Literal('full_screening_simulation'),
  Type.Literal('rapid_fire_micro_drill')
]);
export type HrSessionMode = Static<typeof HrSessionModeSchema>;

export const HrPersonaIdSchema = Type.Union([
  Type.Literal('friendly_sourcer'),
  Type.Literal('bank_compliance_officer'),
  Type.Literal('behavioral_conflict_hunter')
]);
export type HrPersonaId = Static<typeof HrPersonaIdSchema>;

export const HrSimulationPhaseSchema = Type.Union([
  Type.Literal('phase0_init'),
  Type.Literal('phase1_small_talk'),
  Type.Literal('phase2_elevator_pitch'),
  Type.Literal('phase3_work_history'),
  Type.Literal('phase4_gap_deep_dive'),
  Type.Literal('phase5_compliance_financials'),
  Type.Literal('phase6_candidate_qa'),
  Type.Literal('phase7_evaluation')
]);
export type HrSimulationPhase = Static<typeof HrSimulationPhaseSchema>;

// ============================================================================
// 5. HUD ANCHOR CARDS & KWS STATE
// ============================================================================

export const HrAnchorStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('OPTIMISTIC_HIT'),
  Type.Literal('CONFIRMED_HIT')
]);
export type HrAnchorStatus = Static<typeof HrAnchorStatusSchema>;

export const HrAnchorCardSchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
  category: Type.Union([
    Type.Literal('legal'),
    Type.Literal('architecture'),
    Type.Literal('metrics'),
    Type.Literal('compensation'),
    Type.Literal('motivation')
  ]),
  matchStems: Type.Array(Type.String(), { description: 'Morphological stems and prefixes in lowercase' }),
  synonymStems: Type.Optional(Type.Array(Type.Array(Type.String()))),
  weight: Type.Integer({ minimum: 1, maximum: 3, default: 2 }),
  status: HrAnchorStatusSchema,
  hitTimestampMs: Type.Optional(Type.Number()),
  detectionLatencyMs: Type.Optional(Type.Number()),
  source: Type.Optional(Type.Union([Type.Literal('client_fast_kws'), Type.Literal('server_reconciled')]))
});
export type HrAnchorCard = Static<typeof HrAnchorCardSchema>;

// ============================================================================
// 6. QUESTION RUBRICS & MATRIX
// ============================================================================

export const HrQuestionRubricItemSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  canonicalQuestion: Type.String(),
  referenceAnswer: Type.String(),
  targetDurationSec: Type.Object({
    minSec: Type.Integer({ default: 60 }),
    maxSec: Type.Integer({ default: 80 }),
    hardCapSec: Type.Integer({ default: 90 })
  }),
  requiredAnchors: Type.Array(HrAnchorCardSchema),
  forbiddenPatterns: Type.Array(Type.String()),
  phase: Type.Optional(HrSimulationPhaseSchema)
});
export type HrQuestionRubricItem = Static<typeof HrQuestionRubricItemSchema>;

// ============================================================================
// 7. REAL-TIME SPEECH TELEMETRY & SCORECARD
// ============================================================================

export const HrTelemetryTickSchema = Type.Object({
  sessionId: Type.String(),
  turnId: Type.String(),
  elapsedTurnSec: Type.Number(),
  rollingWpm: Type.Number(),
  pacingStatus: Type.Union([
    Type.Literal('too_slow'),
    Type.Literal('optimal'),
    Type.Literal('too_fast')
  ]),
  pacingWindowStatus: Type.Union([
    Type.Literal('building'),
    Type.Literal('optimal'),
    Type.Literal('overflow')
  ]),
  hesitationCount: Type.Integer({ minimum: 0 }),
  maxHesitationMs: Type.Number({ minimum: 0 }),
  fillerWordsSpotted: Type.Array(Type.String()),
  anchorsHitCount: Type.Integer({ minimum: 0 }),
  anchorsTotalCount: Type.Integer({ minimum: 0 })
});
export type HrTelemetryTick = Static<typeof HrTelemetryTickSchema>;

export const HrScorecardMetricsSchema = Type.Object({
  substanceMatch: Type.Integer({ minimum: 0, maximum: 100, description: 'Weight 30%: Alignment with ground truth facts' }),
  lexicalDensity: Type.Integer({ minimum: 0, maximum: 100, description: 'Weight 25%: Senior vocabulary vs colloquialisms' }),
  pacingScore: Type.Integer({ minimum: 0, maximum: 100, description: 'Weight 25%: 60-80s window & Anchor-Build-Bridge' }),
  deliveryConfidence: Type.Integer({ minimum: 0, maximum: 100, description: 'Weight 20%: WPM consistency & zero defensive justifications' })
});
export type HrScorecardMetrics = Static<typeof HrScorecardMetricsSchema>;

export const HrScorecardSchema = Type.Object({
  sessionId: Type.String(),
  turnId: Type.String(),
  questionId: Type.String(),
  mode: HrSessionModeSchema,
  overallScore: Type.Integer({ minimum: 0, maximum: 100 }),
  passed: Type.Boolean({ description: 'true if overallScore >= 85' }),
  metrics: HrScorecardMetricsSchema,
  turnDurationSec: Type.Number(),
  averageWpm: Type.Number(),
  fillerWordsSpotted: Type.Array(Type.String()),
  anchorsHit: Type.Array(Type.String()),
  anchorsMissed: Type.Array(Type.String()),
  actionableCritique: Type.String({ description: 'Concise, constructive feedback for the next drill attempt' }),
  nextAction: Type.Union([
    Type.Literal('repeat_drill'),
    Type.Literal('advance_next_question'),
    Type.Literal('session_completed')
  ])
});
export type HrScorecard = Static<typeof HrScorecardSchema>;

// ============================================================================
// 8. SESSION CONFIG DTO
// ============================================================================

export const HrSessionConfigSchema = Type.Object({
  sessionId: Type.String(),
  mode: HrSessionModeSchema,
  personaId: HrPersonaIdSchema,
  dossierId: Type.String(),
  jobId: Type.Optional(Type.String()),
  targetQuestionId: Type.Optional(Type.String({ description: 'Target question for micro_drill mode' })),
  pacingWindow: Type.Object({
    minSec: Type.Integer({ default: 60 }),
    maxSec: Type.Integer({ default: 80 })
  })
});
export type HrSessionConfig = Static<typeof HrSessionConfigSchema>;
