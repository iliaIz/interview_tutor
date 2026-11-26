import {
  RecordEvaluationParams,
  TopicProgressSummary,
  normalizeUserId,
  questionEvaluationRepository
} from './evaluation/QuestionEvaluationRepository';
import { updateFsrsCardState } from './fsrsEngine';

export { RecordEvaluationParams, TopicProgressSummary };

/**
 * Resolves any topic input (slug, id, name, lowercase) to the exact database topic name and slug
 */
export function resolveTopic(topicInput: string, questionId?: string): { dbTopicName: string; topicId: string } {
  return questionEvaluationRepository.resolveTopic(topicInput, questionId);
}

/**
 * Records a question evaluation and atomically synchronizes user_progress in SQLite
 */
export function recordEvaluationAndSyncProgress(params: RecordEvaluationParams): {
  evalId: string;
  progress: TopicProgressSummary;
} {
  const { evalId, persisted, progress } = questionEvaluationRepository.recordEvaluationAndSyncProgress(params);
  if (persisted) {
    void updateFsrsCardState({
      userId: normalizeUserId(params.userId),
      questionId: params.questionId,
      score: params.score,
      isPassed: params.isPassed
    }).catch((err) => console.warn('FSRS state update warning:', err));
  }
  return { evalId, progress };
}

/**
 * Calculates current progress summary for a given topic and user
 */
export function getTopicProgress(userId: string, topicIdOrName: string): TopicProgressSummary {
  return questionEvaluationRepository.syncTopicProgressFromEvaluations(userId, topicIdOrName);
}

/**
 * Resets user progress and evaluations for a topic
 */
export function resetTopicProgress(userId: string, topicIdOrName: string): { success: boolean; topic: string } {
  return questionEvaluationRepository.resetTopicProgress(userId, topicIdOrName);
}
