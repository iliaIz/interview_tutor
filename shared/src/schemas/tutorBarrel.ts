/**
 * tutorBarrel.ts
 * Pure TypeBox + normalizer barrel for TutorActiveContext consumers (Node ESM & Browser safe).
 * Excludes cel-js/chevrotain validation engine so headless Node tests never hit ESM/CJS loader conflicts.
 */

export * from './tutorContext';
export * from './tutorNormalizer';
export * from './tutorPracticeNormalizer';
export * from './tutorIncidentsNormalizer';
export type { CompanyProfile } from './companyProfile';
export {
  TutorArenaType,
  TutorPersona,
  TutorRoleSchema,
  TutorIncidentMetaSchema,
  TutorVerifyDiagnosisRequestSchema,
  TutorVerifyDiagnosisResponseSchema,
  TutorQuickActionChipSchema,
  TutorCompanyContextSchema,
  TutorChatMessageSchema,
  TutorWhiteboardSnippetSchema,
  TutorWorkspaceManifestSchema,
  TutorAcademyBridgeContextSchema,
  TutorActiveContextSchema
} from './tutorContext';
export {
  DEFAULT_SOCRATIC_COMPANY_CHIPS,
  normalizeSqlArenaContext,
  normalizeCompanyContext,
  normalizeSystemDesignContext
} from './tutorNormalizer';
export { normalizePracticeContext } from './tutorPracticeNormalizer';
export { normalizeIncidentsContext } from './tutorIncidentsNormalizer';
