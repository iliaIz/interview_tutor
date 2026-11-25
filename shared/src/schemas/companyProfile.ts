import { Type, Static } from '@sinclair/typebox';
import { TutorQuickActionChipSchema } from './tutorContext';

/**
 * companyProfile.ts
 * SSOT TypeBox schema for Targeted Company Preparation Hub (Pillars 10, 11 & 12).
 * Governs employer profiles, engineering culture, red/green flags, express runbooks,
 * curated interview pipeline stages, rich engineering dossier artifacts,
 * and take-home PR forensics.
 * File length limit: <= 350 lines (Rule 8).
 */

export const StageFormatEnum = Type.Union([
  Type.Literal('voice_fit'),
  Type.Literal('live_coding'),
  Type.Literal('code_review'),
  Type.Literal('sql_arena'),
  Type.Literal('system_design'),
  Type.Literal('take_home')
]);
export type StageFormat = Static<typeof StageFormatEnum>;

export const TargetArenaEnum = Type.Union([
  Type.Literal('practice'),
  Type.Literal('incidents'),
  Type.Literal('system_design'),
  Type.Literal('sql_arena'),
  Type.Literal('voice_modal'),
  Type.Literal('take_home')
]);
export type TargetArena = Static<typeof TargetArenaEnum>;

export const ArenaLaunchIntentSchema = Type.Object({
  targetArena: TargetArenaEnum,
  targetEntityId: Type.String({ minLength: 1 }),
  companyId: Type.Optional(Type.String()),
  stageId: Type.Optional(Type.String())
});
export type ArenaLaunchIntent = Static<typeof ArenaLaunchIntentSchema>;

export const CompanyPipelineStageSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  stageNumber: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  format: StageFormatEnum,
  estimatedMinutes: Type.Number({ minimum: 5 }),
  description: Type.String({ minLength: 1 }),
  targetArena: TargetArenaEnum,
  targetEntityId: Type.String({ minLength: 1 }),
  weight: Type.Number({ minimum: 0, maximum: 1 })
});
export type CompanyPipelineStage = Static<typeof CompanyPipelineStageSchema>;

export const CompanyCultureSchema = Type.Object({
  engineeringParadigm: Type.String({ minLength: 1 }),
  metricsFocus: Type.Array(Type.String(), { default: [] }),
  redFlags: Type.Array(Type.String(), { default: [] }),
  greenFlags: Type.Array(Type.String(), { default: [] })
});
export type CompanyCulture = Static<typeof CompanyCultureSchema>;

export const ExpressRunbookTaskLinkSchema = Type.Object({
  taskId: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  targetArena: TargetArenaEnum,
  badge: Type.Optional(Type.String())
});
export type ExpressRunbookTaskLink = Static<typeof ExpressRunbookTaskLinkSchema>;

export const ExpressRunbookSchema = Type.Object({
  pitchScriptMarkdown: Type.String({ minLength: 1 }),
  mustReviewTaskIds: Type.Array(Type.String(), { default: [] }),
  mustReviewTasks: Type.Optional(Type.Array(ExpressRunbookTaskLinkSchema)),
  checklist: Type.Array(Type.String(), { default: [] })
});
export type ExpressRunbook = Static<typeof ExpressRunbookSchema>;

// --- Rich Dossier Artifacts ---

export const CompetencyItemSchema = Type.Object({
  id: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.Union([Type.Literal('engineering'), Type.Literal('product'), Type.Literal('quality_ai')]),
  categoryLabel: Type.String({ minLength: 1 }),
  iconName: Type.String({ minLength: 1 }),
  techStack: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  interviewQuestion: Type.String({ minLength: 1 }),
  barRaiserExpectation: Type.String({ minLength: 1 })
});
export type CompetencyItem = Static<typeof CompetencyItemSchema>;

export const SpecReviewItemSchema = Type.Object({
  id: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  tag: Type.String({ minLength: 1 }),
  question: Type.String({ minLength: 1 }),
  deliverable: Type.String({ minLength: 1 }),
  dangerIfMissing: Type.String({ minLength: 1 })
});
export type SpecReviewItem = Static<typeof SpecReviewItemSchema>;

export const StarCaseSchema = Type.Object({
  id: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  tagline: Type.String({ minLength: 1 }),
  badge: Type.String({ minLength: 1 }),
  interviewQuestion: Type.String({ minLength: 1 }),
  situation: Type.String({ minLength: 1 }),
  task: Type.String({ minLength: 1 }),
  action: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  result: Type.String({ minLength: 1 }),
  strongHireTakeaway: Type.String({ minLength: 1 }),
  redFlagToAvoid: Type.String({ minLength: 1 })
});
export type StarCase = Static<typeof StarCaseSchema>;

export const TalentQVerbalRuleSchema = Type.Object({
  outcome: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  badgeColor: Type.Optional(Type.String())
});
export type TalentQVerbalRule = Static<typeof TalentQVerbalRuleSchema>;

export const TalentQGuideSchema = Type.Object({
  deadlineHours: Type.Number({ default: 72 }),
  warningTitle: Type.String({ minLength: 1 }),
  warningMarkdown: Type.String({ minLength: 1 }),
  formulaMarkdown: Type.String({ minLength: 1 }),
  verbalRules: Type.Array(TalentQVerbalRuleSchema, { default: [] }),
  strategyTips: Type.Array(Type.String(), { default: [] })
});
export type TalentQGuide = Static<typeof TalentQGuideSchema>;

// --- Take-Home PR Forensics Artifacts ---

export const PrCaseOptionSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
  isCorrect: Type.Boolean(),
  explanation: Type.String({ minLength: 1 })
});
export type PrCaseOption = Static<typeof PrCaseOptionSchema>;

export const TakeHomePrCaseSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  prNumber: Type.String({ minLength: 1 }),
  author: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  flawCategory: Type.String({ minLength: 1 }),
  codeSnippet: Type.String({ minLength: 1 }),
  options: Type.Array(PrCaseOptionSchema, { minItems: 2 }),
  canonicalFixSql: Type.String({ minLength: 1 })
});
export type TakeHomePrCase = Static<typeof TakeHomePrCaseSchema>;

// --- Manifest-Driven Readiness, Curated Challenges & Voice Presets (Spec 44) ---

export const ReadinessCategoryRuleSchema = Type.Object({
  total: Type.Number({ minimum: 1 }),
  idPrefixes: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  exactIds: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
});
export type ReadinessCategoryRule = Static<typeof ReadinessCategoryRuleSchema>;

export const CompanyReadinessManifestSchema = Type.Object({
  questionCatalogFile: Type.Optional(Type.String({ minLength: 1 })),
  theory: ReadinessCategoryRuleSchema,
  codeReview: ReadinessCategoryRuleSchema,
  liveCoding: ReadinessCategoryRuleSchema,
  sql: ReadinessCategoryRuleSchema,
  systemDesignTotal: Type.Number({ minimum: 1 })
});
export type CompanyReadinessManifest = Static<typeof CompanyReadinessManifestSchema>;

export const CompanyCuratedChallengeItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.Union([Type.Literal('code_review'), Type.Literal('live_coding')]),
  difficulty: Type.Union([Type.Literal('Middle'), Type.Literal('Senior')]),
  estimatedMinutes: Type.Number({ minimum: 1 }),
  summary: Type.String({ minLength: 1 }),
  keyPoints: Type.Array(Type.String())
});
export type CompanyCuratedChallengeItem = Static<typeof CompanyCuratedChallengeItemSchema>;

export const CompanyVoicePresetSchema = Type.Object({
  topic: Type.String({ minLength: 1 }),
  initialQuestionText: Type.String({ minLength: 1 }),
  systemPrompt: Type.String({ minLength: 1 })
});
export type CompanyVoicePreset = Static<typeof CompanyVoicePresetSchema>;

export const CompanyProfileSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  brandColor: Type.String({ default: '#FFE600' }),
  logoBadge: Type.String({ default: '🏦' }),
  tagline: Type.String({ minLength: 1 }),
  culture: CompanyCultureSchema,
  expressRunbook: ExpressRunbookSchema,
  stages: Type.Array(CompanyPipelineStageSchema, { minItems: 1 }),
  // Deepening Extensions (Pillars 10, 11 & 12 SSOT):
  competencies: Type.Optional(Type.Array(CompetencyItemSchema)),
  specReviewChecklist: Type.Optional(Type.Array(SpecReviewItemSchema)),
  starScenarios: Type.Optional(Type.Array(StarCaseSchema)),
  talentQGuide: Type.Optional(TalentQGuideSchema),
  takeHomePrCases: Type.Optional(Type.Array(TakeHomePrCaseSchema)),
  customQuickActionChips: Type.Optional(Type.Array(TutorQuickActionChipSchema)),
  // Spec 44 Manifest Extensions:
  readinessConfig: Type.Optional(CompanyReadinessManifestSchema),
  curatedChallenges: Type.Optional(Type.Array(CompanyCuratedChallengeItemSchema)),
  voicePreset: Type.Optional(CompanyVoicePresetSchema)
});
export type CompanyProfile = Static<typeof CompanyProfileSchema>;
