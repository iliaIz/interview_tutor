/**
 * turnInterviewTypes.ts
 * Types and formatting helpers for cascaded turn-based interview evaluations (SPEC-27).
 * Cognitive Bounding SLA: <= 100 lines (Rule 8 compliant).
 */

export interface DeductionItem {
  criterionId?: string;
  reason: string;
  penalty: number;
}

export interface TurnReasoningResult {
  action: 'probe' | 'evaluate';
  replyText?: string;
  score?: number;
  isPassed?: boolean;
  deductions?: DeductionItem[];
  positivePoints?: string[];
  missingPoints?: string[];
  feedback?: string;
  spokenFeedback?: string;
  faangScorecard?: any;
}

export interface CascadedTurnInput {
  sessionId?: string;
  questionId?: string;
  topic?: string;
  questionText: string;
  referenceAnswer?: string;
  userTranscript?: string;
  audioBase64?: string;
  pcmBase64?: string;
  history?: Array<{ role?: string; speaker?: string; text: string }>;
  turnCount?: number;
  maxProbes?: number;
  strategy?: 'socratic_tutoring' | 'adaptive_probing';
  deepDive?: boolean;
  liveCoaching?: boolean;
  voice?: string;
  userGender?: 'female' | 'male' | 'neutral';
  activeCodeArtifact?: { code?: string; title?: string };
  persona?: string;
  targetGrade?: string;
  sessionType?: 'interview' | 'tutor';
  strictness?: 'learning' | 'standard' | 'hardcore';
  userId?: string;
  abortSignal?: AbortSignal;
}

export interface CascadedTurnResult {
  action: 'probe' | 'evaluate';
  transcript: string;
  replyText: string | null;
  evaluation: {
    score: number;
    isPassed: boolean;
    deductions: DeductionItem[];
    positivePoints: string[];
    missingPoints: string[];
    feedback: string;
    spokenFeedback: string;
    faangScorecard: any;
  } | null;
  audioBase64: string;
  knowledgeUpdate?: any;
  progress?: any;
}

export function getSafeSpokenText(reasoningResult: TurnReasoningResult): string {
  if (reasoningResult.action === 'probe') {
    return reasoningResult.replyText || 'Расскажи подробнее об этой части.';
  }
  if (reasoningResult.spokenFeedback && reasoningResult.spokenFeedback.trim().length > 0) {
    const trimmed = reasoningResult.spokenFeedback.trim();
    const words = trimmed.split(/\s+/);
    if (words.length <= 40) {
      return trimmed;
    }
    return words.slice(0, 38).join(' ') + '... Подробный разбор открыт на экране.';
  }
  const score = reasoningResult.score ?? 0;
  return `Спасибо за ответ! Я зафиксировал результаты и выставил оценку ${score} баллов. Подробный разбор открыт на экране.`;
}
