/**
 * practiceSessionParamsBuilder.ts
 * Pure in-process builder for Practice Voice Tutor LiveAudioSessionParams (Spec 47 / #173).
 */

import type { LiveAudioSessionParams } from '../../../audio/useLiveVoiceSession';
import type { CodingChallenge, FileNode } from '../../../types/practice';
import type { InterviewConfig } from '../../../types/interviewConfig';
import type { TransactionScenario } from '../../../types/transactionLab';
import type { ActiveWhiteboardArtifact, CodeArtifactRevision } from '../../../store/slices/whiteboardSlice';
import type { AcademyBreadcrumbContext } from '../../../store/slices/academySlice';
import { TRANSACTION_LAB_SCENARIOS } from '../../../data/transactionLabCatalog';
import { resolveTutorDomain } from './TutorDomain';
import { buildWorkspaceManifest } from '../../../utils/workspaceManifest';

const DOMAIN_TOPICS: Record<string, string> = {
  lld: 'LLD архитектура и чистое проектирование на Java 21',
  transactions: 'Транзакции Spring Boot, распространение и аномалии БД',
  concurrency: 'Многопоточность, JMM и Project Loom',
  refactoring: 'Рефакторинг легаси-кода и швы по Физерсу',
  java21: 'Идиомы Java 21 LTS (Records, Sealed, Pattern Matching)',
  testing: 'Юнит-тестирование и мутации Java 21'
};

export interface PracticeSessionParamsInput {
  sessionId?: string;
  activePracticeChallenge: CodingChallenge | null;
  files: FileNode[];
  activeFileIndex: number;
  activeTransactionLabScenarioId?: string | null;
  transactionScenario?: TransactionScenario | null;
  activeArtifact?: ActiveWhiteboardArtifact | null;
  codeRevisions?: CodeArtifactRevision[];
  interviewConfig: InterviewConfig;
  tutorPersona?: string;
  seniorReviewPayload?: unknown;
  academyBreadcrumbContext?: AcademyBreadcrumbContext | null;
}

export function buildPracticeSessionParams(input: PracticeSessionParamsInput): LiveAudioSessionParams {
  const {
    activePracticeChallenge,
    files,
    activeFileIndex,
    activeTransactionLabScenarioId,
    transactionScenario,
    activeArtifact,
    codeRevisions = [],
    interviewConfig,
    tutorPersona,
    seniorReviewPayload,
    academyBreadcrumbContext
  } = input;

  const currentFile = files[activeFileIndex] || files[0];
  const hasActiveTxScenario = Boolean(transactionScenario || activeTransactionLabScenarioId);
  const domain = resolveTutorDomain({
    category: activePracticeChallenge?.category,
    track: activePracticeChallenge?.track,
    title: activePracticeChallenge?.title,
    hasActiveTxScenario
  });

  const topic = DOMAIN_TOPICS[domain] || DOMAIN_TOPICS.testing;
  let challengeCategory = activePracticeChallenge?.category || domain;
  let challengeTrack = activePracticeChallenge?.track || domain;
  let bugTitle = activePracticeChallenge?.title || 'Практическая задача';
  let bugExplanation = activePracticeChallenge?.instructionsMarkdown || '';
  let codeSnippet = currentFile?.content || '';

  if (hasActiveTxScenario) {
    const txScenario =
      transactionScenario ||
      TRANSACTION_LAB_SCENARIOS.find((s) => s.id === activeTransactionLabScenarioId) ||
      TRANSACTION_LAB_SCENARIOS[0];
    challengeCategory = 'Spring Transactions';
    challengeTrack = 'spring_transactions';
    bugTitle = txScenario.title;
    bugExplanation = txScenario.problemStatement || '';
    codeSnippet = txScenario.services
      .map((s) => `// ${s.className}\n` + s.methods.map((m) => m.codeSnippet).join('\n\n'))
      .join('\n\n');
  }

  const revSummary = codeRevisions.length > 0 ? codeRevisions.map((r) => ({ id: r.id, title: r.title })) : undefined;
  const workspaceManifest = buildWorkspaceManifest(files, activeFileIndex);
  const challengeId =
    activePracticeChallenge?.id ||
    activePracticeChallenge?.slug ||
    activeTransactionLabScenarioId ||
    transactionScenario?.id ||
    '';

  return {
    sessionId: input.sessionId || `session_practice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    questionId: challengeId,
    sessionType: 'tutor',
    tutorMode: 'practice_pair',
    topic,
    challengeCategory,
    challengeTrack,
    challengeDomain: domain,
    bugTitle,
    bugExplanation: bugExplanation || activePracticeChallenge?.instructionsMarkdown || activePracticeChallenge?.shortDescription || '',
    referenceAnswer: activePracticeChallenge?.instructionsMarkdown || bugExplanation || '',
    codeSnippet,
    workspaceManifest,
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
    tutorPersona: seniorReviewPayload ? 'senior_socratic' : tutorPersona,
    strategy: 'socratic_tutoring',
    seniorReview: seniorReviewPayload,
    academyCourse: academyBreadcrumbContext?.courseId,
    academyStep: academyBreadcrumbContext ? `step-${academyBreadcrumbContext.stepNumber}` : undefined,
    academyBridgeContext: academyBreadcrumbContext
      ? {
          courseId: academyBreadcrumbContext.courseId,
          stepId: `step-${academyBreadcrumbContext.stepNumber}`,
          moduleTitle: academyBreadcrumbContext.moduleTitle || academyBreadcrumbContext.stepTitle,
          learningObjective: academyBreadcrumbContext.learningObjective,
          targetConcepts: academyBreadcrumbContext.targetConcepts
        }
      : undefined
  };
}
