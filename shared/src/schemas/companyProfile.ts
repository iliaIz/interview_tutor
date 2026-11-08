import { Type, Static } from '@sinclair/typebox';

/**
 * companyProfile.ts
 * SSOT TypeBox schema for Targeted Company Preparation Hub (Pillar 10).
 * Governs employer profiles, engineering culture, red/green flags, express runbooks,
 * and curated interview pipeline stages.
 * File length limit: <= 350 lines (Rule 8).
 */

export const StageFormatEnum = Type.Union([
  Type.Literal('voice_fit'),
  Type.Literal('live_coding'),
  Type.Literal('code_review'),
  Type.Literal('sql_arena'),
  Type.Literal('system_design')
]);
export type StageFormat = Static<typeof StageFormatEnum>;

export const TargetArenaEnum = Type.Union([
  Type.Literal('practice'),
  Type.Literal('incidents'),
  Type.Literal('system_design'),
  Type.Literal('sql_arena'),
  Type.Literal('voice_modal')
]);
export type TargetArena = Static<typeof TargetArenaEnum>;

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

export const ExpressRunbookSchema = Type.Object({
  pitchScriptMarkdown: Type.String({ minLength: 1 }),
  mustReviewTaskIds: Type.Array(Type.String(), { default: [] }),
  checklist: Type.Array(Type.String(), { default: [] })
});
export type ExpressRunbook = Static<typeof ExpressRunbookSchema>;

export const CompanyProfileSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  brandColor: Type.String({ default: '#FFE600' }),
  logoBadge: Type.String({ default: '🏦' }),
  tagline: Type.String({ minLength: 1 }),
  culture: CompanyCultureSchema,
  expressRunbook: ExpressRunbookSchema,
  stages: Type.Array(CompanyPipelineStageSchema, { minItems: 1 })
});
export type CompanyProfile = Static<typeof CompanyProfileSchema>;
