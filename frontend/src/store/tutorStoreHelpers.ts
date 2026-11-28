import {
  normalizePracticeContext,
  type TutorActiveContext,
  type TutorPersona,
  type TutorRole
} from '@interview-prep/shared/tutor';
import { TutorTransportPort, httpTutorTransport } from './tutorTransport';

export type AssistanceLevel = 1 | 2 | 3 | 4;
export type CopilotDockTab = 'tutor' | 'whiteboard';

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  leakDetected?: boolean;
  similarity?: number;
}

export const ASSISTANCE_TO_PERSONA: Record<number, TutorPersona> = {
  1: 'junior_explainer',
  2: 'middle_scaffold',
  3: 'senior_socratic',
  4: 'faang_interviewer'
};

export function resolveTargetContext(
  provided: TutorActiveContext | undefined,
  activeContext: TutorActiveContext | null,
  persona: TutorPersona,
  assistanceLevel: number,
  tutorRole: TutorRole,
  patch?: { hintTier?: number; activeCompassRuleId?: string }
): TutorActiveContext {
  const base =
    provided ||
    activeContext ||
    normalizePracticeContext({
      kataId: 'practice-kata',
      kataTitle: 'Practice Kata',
      persona,
      assistanceLevel
    });

  return {
    ...base,
    persona,
    assistanceLevel,
    ...(base.arena === 'incidents' ? { tutorRole: base.tutorRole || tutorRole } : {}),
    ...(patch?.hintTier !== undefined ? { hintTier: patch.hintTier } : {}),
    ...(patch?.activeCompassRuleId !== undefined ? { activeCompassRuleId: patch.activeCompassRuleId } : {})
  };
}

export const DEFAULT_TUTOR_TRANSPORT: TutorTransportPort = httpTutorTransport;
let activeSingletonTransport: TutorTransportPort = DEFAULT_TUTOR_TRANSPORT;

export function setTutorTransportPort(transport: TutorTransportPort): void {
  activeSingletonTransport = transport;
}

export const singletonTransportProxy: TutorTransportPort = {
  streamChat: (opts) => activeSingletonTransport.streamChat(opts),
  fetchHint: (ctx, persona, lvl, signal) => activeSingletonTransport.fetchHint(ctx, persona, lvl, signal),
  groundRule: (ruleId, ctx, persona, lvl, signal) =>
    activeSingletonTransport.groundRule(ruleId, ctx, persona, lvl, signal),
  verifyBugDiagnosis: (diagnosis, ctx, signal) => {
    if (!activeSingletonTransport.verifyBugDiagnosis) {
      return Promise.reject(new Error('Диагностика диагнозов недоступна в текущем транспорте'));
    }
    return activeSingletonTransport.verifyBugDiagnosis(diagnosis, ctx, signal);
  }
};
