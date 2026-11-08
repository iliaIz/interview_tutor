export * from './schemas/manifest';
export * from './schemas/refactoringManifest';
export * from './schemas/designPatternManifest';
export * from './schemas/telemetry';
export * from './schemas/voiceEvents';
export * from './schemas/hrSimulator';
export * from './schemas/sqlChallenge';
export * from './schemas/companyProfile';
export * from './validation/celEvaluator';
export * from './validation/invariantEngine';
export { evaluateCel } from './validation/celEvaluator';
export { validateInvariants } from './validation/invariantEngine';
export { Value } from '@sinclair/typebox/value';
export { Type } from '@sinclair/typebox';

export type SessionType =
  | 'interview'
  | 'tutor'
  | 'system_design'
  | 'incident'
  | 'hr_simulation'
  | 'hr_micro_drill';

export function isHrSessionType(sessionType: string | undefined): sessionType is 'hr_simulation' | 'hr_micro_drill' {
  return sessionType === 'hr_simulation' || sessionType === 'hr_micro_drill';
}

export function isHrPersonaId(persona: string | undefined): persona is import('./schemas/hrSimulator').HrPersonaId {
  return (
    persona === 'friendly_sourcer' ||
    persona === 'bank_compliance_officer' ||
    persona === 'behavioral_conflict_hunter'
  );
}
