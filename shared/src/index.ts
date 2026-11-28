export * from './schemas/manifest';
export * from './schemas/refactoringManifest';
export * from './schemas/designPatternManifest';
export * from './schemas/codingChallenge';
export * from './schemas/telemetry';
export * from './schemas/voiceEvents';
export * from './schemas/hrSimulator';
export * from './schemas/sqlChallenge';
export * from './schemas/companyProfile';
export * from './schemas/tutorContext';
export * from './schemas/tutorNormalizer';
export * from './schemas/tutorPracticeNormalizer';
export * from './schemas/tutorIncidentsNormalizer';
export * from './validation/celEvaluator';
export * from './validation/invariantEngine';
export { evaluateCel } from './validation/celEvaluator';
export { validateInvariants } from './validation/invariantEngine';
export {
  DEFAULT_SOCRATIC_COMPANY_CHIPS,
  normalizeSqlArenaContext,
  normalizeCompanyContext,
  normalizeSystemDesignContext
} from './schemas/tutorNormalizer';
export { normalizePracticeContext } from './schemas/tutorPracticeNormalizer';
export { normalizeIncidentsContext } from './schemas/tutorIncidentsNormalizer';
export { Value } from '@sinclair/typebox/value';
export { Type } from '@sinclair/typebox';

export type SessionType =
  | 'interview'
  | 'tutor'
  | 'system_design'
  | 'incident'
  | 'hr_simulation'
  | 'hr_micro_drill'
  | 'hr_tutor';

export function isHrSessionType(sessionType: string | undefined): sessionType is 'hr_simulation' | 'hr_micro_drill' | 'hr_tutor' {
  return sessionType === 'hr_simulation' || sessionType === 'hr_micro_drill' || sessionType === 'hr_tutor';
}

export function isHrPersonaId(persona: string | undefined): persona is import('./schemas/hrSimulator').HrPersonaId {
  return (
    persona === 'friendly_sourcer' ||
    persona === 'bank_compliance_officer' ||
    persona === 'behavioral_conflict_hunter' ||
    persona === 'mentor_coach'
  );
}
