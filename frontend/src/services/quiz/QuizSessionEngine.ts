/**
 * QuizSessionEngine.ts
 * Pure domain engine for quiz evaluation reconciliation, scorecard calculations,
 * and retry slicing.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import { Question } from '../../store/useAppStore';

export interface EvalRecord {
  question: Question;
  userAnswer: string;
  score: number;
  isPassed: boolean;
  feedback: string;
  positivePoints: string[];
  missingPoints: string[];
}

export interface QuizScorecardSummary {
  records: EvalRecord[];
  totalTested: number;
  passedCount: number;
  failedCount: number;
  avgScore: number;
}

export class QuizSessionEngine {
  /**
   * Reconciles text evaluation response into standard EvalRecord.
   */
  static reconcileTextEval(
    question: Question,
    userAnswer: string,
    evalData: any
  ): EvalRecord {
    return {
      question,
      userAnswer,
      score: evalData?.score ?? 0,
      isPassed: Boolean(evalData?.isPassed),
      feedback: evalData?.feedback || '',
      positivePoints: evalData?.positivePoints || [],
      missingPoints: evalData?.missingPoints || []
    };
  }

  /**
   * Reconciles Gemini Live voice evaluation verdict into standard EvalRecord.
   */
  static reconcileVoiceEval(
    question: Question,
    voiceEvalData: any
  ): EvalRecord {
    const score = typeof voiceEvalData?.score === 'number'
      ? voiceEvalData.score
      : parseFloat(String(voiceEvalData?.score)) || 0;

    return {
      question,
      userAnswer: voiceEvalData?.transcript || '🎙️ Устный ответ в Gemini Live',
      score,
      isPassed: Boolean(voiceEvalData?.isPassed || score >= 8),
      feedback: voiceEvalData?.feedback || 'Устное собеседование завершено.',
      positivePoints: voiceEvalData?.positivePoints || [],
      missingPoints: voiceEvalData?.missingPoints || []
    };
  }

  /**
   * Computes aggregate scorecard statistics from evaluation history.
   */
  static computeScorecard(resultsHistory: Record<string, EvalRecord>): QuizScorecardSummary {
    const records = Object.values(resultsHistory);
    const totalTested = records.length;
    const passedCount = records.filter((r) => r.isPassed).length;
    const failedCount = totalTested - passedCount;
    const avgScore = totalTested > 0
      ? Math.round(records.reduce((acc, r) => acc + r.score, 0) / totalTested)
      : 0;

    return {
      records,
      totalTested,
      passedCount,
      failedCount,
      avgScore
    };
  }

  /**
   * Extracts failed questions from the current batch for retrying.
   */
  static getFailedQuestions(
    currentBatch: Question[],
    resultsHistory: Record<string, EvalRecord>
  ): Question[] {
    return currentBatch.filter((q) => {
      const rec = resultsHistory[q.id];
      return rec && !rec.isPassed;
    });
  }
}
