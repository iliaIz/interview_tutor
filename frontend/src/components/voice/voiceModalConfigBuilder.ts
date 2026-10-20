/**
 * voiceModalConfigBuilder.ts
 * Helper to construct VoiceEngineConfig for VoiceModal orchestrator.
 * Cognitive bounding limit: <= 350 lines.
 */

import { VoiceEngineConfig } from '../../audio/types';
import { QuestionItem } from './voiceModalTypes';

export interface BuildVoiceModalConfigParams {
  targetIndex: number;
  isRetryAttempt: boolean;
  isBatchMode: boolean;
  questionsBatch?: QuestionItem[];
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  initialSessionType?: string;
  initialTutorMode?: string;
  interviewConfig: any;
  customPromptOverride?: string;
  totalQuestions: number;
}

export function buildVoiceModalConfig(params: BuildVoiceModalConfigParams): VoiceEngineConfig {
  const {
    targetIndex,
    isRetryAttempt,
    isBatchMode,
    questionsBatch,
    questionId,
    topic,
    currentQuestionText,
    referenceAnswer,
    initialSessionType = 'interview',
    initialTutorMode,
    interviewConfig,
    customPromptOverride,
    totalQuestions
  } = params;

  const targetQ = isBatchMode && questionsBatch ? questionsBatch[targetIndex] : null;
  const qId = targetQ?.id || questionId || 'Q_DEFAULT';
  const qTopic = targetQ?.topic || topic;
  const qText = targetQ?.question || currentQuestionText;
  const qAnswer = targetQ?.answer || referenceAnswer;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    sessionId,
    questionId: qId,
    topic: qTopic,
    questionText: qText,
    referenceAnswer: qAnswer,
    sessionType: initialSessionType,
    tutorMode: initialSessionType === 'tutor' ? initialTutorMode : undefined,
    voice: interviewConfig.voice || 'Kore',
    turnMode: interviewConfig.turnMode || 'auto',
    liveModel: interviewConfig.liveModel || 'gemini-live-v3',
    vadPauseMs: interviewConfig.vadPauseMs ?? 1800,
    enableSilenceClarification: interviewConfig.enableSilenceClarification ?? false,
    persona: interviewConfig.persona || 'mentor',
    targetGrade: interviewConfig.targetGrade || 'L5_SENIOR',
    strategy: initialSessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
    customPrompt: customPromptOverride,
    questionIndex: targetIndex,
    totalQuestions,
    isRetry: isRetryAttempt
  };
}
