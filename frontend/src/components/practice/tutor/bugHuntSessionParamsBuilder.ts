import type { TutorRole } from '@interview-prep/shared/tutor';
import type { LiveAudioSessionParams } from '../../../audio/useLiveVoiceSession';
import type { BugChallenge } from '../../BugChallengeCard';
import type { InterviewConfig } from '../../../types/interviewConfig';
import type { ActiveWhiteboardArtifact, CodeArtifactRevision } from '../../../store/slices/whiteboardSlice';

/**
 * bugHuntSessionParamsBuilder.ts
 * Spec 62 SSOT builder for Bug Hunt / Incidents Live Voice sessions.
 * Reuses root PracticeVoiceProvider without parallel WebSocket bridges.
 * File length limit: <= 140 lines (Rule 8).
 */

export interface BugHuntSessionParamsInput {
  challenge: BugChallenge;
  tutorRole: TutorRole;
  interviewConfig: InterviewConfig;
  tutorPersona?: string;
  activeArtifact?: ActiveWhiteboardArtifact | null;
  codeRevisions?: CodeArtifactRevision[];
  selectedCodeSnippet?: string | null;
  cursorLine?: number | null;
  isRevisit?: boolean;
}

export function buildBugHuntSessionParams(input: BugHuntSessionParamsInput): LiveAudioSessionParams {
  const {
    challenge,
    tutorRole,
    interviewConfig,
    tutorPersona,
    activeArtifact,
    codeRevisions = [],
    selectedCodeSnippet,
    cursorLine,
    isRevisit = false
  } = input;

  const chId = challenge.id || 'bug-hunt';
  const topicName = challenge.topicName || challenge.topicId || 'Java & Spring Bug Hunt';
  const focusNote =
    selectedCodeSnippet || cursorLine
      ? `[ФОКУС КАНДИДАТА${cursorLine ? ` на строке ${cursorLine}` : ''}]: ${selectedCodeSnippet || `Строка ${cursorLine}`}`
      : undefined;

  const bridgeMessage = isRevisit
    ? `[ВОЗВРАТ К ПРЕДЫДУЩЕМУ КЕЙСУ «${challenge.title}»]: Кандидат вернулся назад к этой задаче. Кратко (1 предложение) напомни, какую гипотезу мы обсуждали, и спроси, готов ли он продолжить.`
    : focusNote;

  const revSummary = codeRevisions.length > 0 ? codeRevisions.map((r) => ({ id: r.id, title: r.title })) : undefined;

  return {
    sessionId: `session_bughunt_${chId}_${Date.now()}`,
    questionId: chId,
    sessionType: 'tutor',
    tutorMode: tutorRole === 'free_chat' ? 'free_chat' : 'bug_hunt',
    topic: topicName,
    bugTitle: challenge.title || '',
    bugExplanation: challenge.bugExplanation || '',
    codeSnippet: challenge.codeSnippet || '',
    fixedCode: challenge.fixedCode || '',
    unitTest: challenge.testSuite || '',
    incidentContext: challenge.productionContext
      ? {
          systemName: challenge.productionContext.systemName,
          architectureType: challenge.productionContext.architectureType,
          incidentSymptoms: challenge.productionContext.incidentSymptoms,
          businessImpact: challenge.productionContext.businessImpact,
          prReviewContext: challenge.productionContext.prReviewContext
        }
      : undefined,
    hints: challenge.hints || [],
    activeCodeArtifact: activeArtifact
      ? { id: activeArtifact.id, title: activeArtifact.title, language: activeArtifact.language, code: activeArtifact.code }
      : undefined,
    codeRevisionsSummary: revSummary,
    voice: interviewConfig.voice,
    userGender: interviewConfig.userGender,
    turnMode: interviewConfig.turnMode,
    liveModel: interviewConfig.liveModel,
    vadPauseMs: interviewConfig.vadPauseMs,
    enableSilenceClarification: interviewConfig.enableSilenceClarification,
    targetGrade: interviewConfig.targetGrade,
    strictness: interviewConfig.strictness,
    deepDive: interviewConfig.deepDive,
    liveCoaching: interviewConfig.liveCoaching,
    maxProbes: interviewConfig.maxProbes,
    tutorPersona: tutorPersona || 'senior_socratic',
    initialUserMessage: bridgeMessage
  };
}
