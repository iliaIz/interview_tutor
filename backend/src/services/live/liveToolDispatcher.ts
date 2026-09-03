import { WebSocket } from 'ws';
import { updateBugChallengeStatus } from '../tutorService';
import { applyKnowledgeDecay, recordNewErrorGap } from '../vectorMemoryService';
import { recordEvaluationAndSyncProgress } from '../progressService';
import { calculateFaangScorecard } from '../../prompts/personas';

export interface LiveToolContext {
  call: {
    id: string;
    name: string;
    args?: any;
  };
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  session: {
    sessionId?: string;
    questionId?: string;
    userId?: string;
    topic?: string;
    relevantGapIds?: string[];
    probesCount?: number;
    isRetry?: boolean;
    hasCandidateResponded?: boolean;
    persona?: any;
    targetGrade?: any;
  };
  parsedHints?: string[];
  liveCoaching?: boolean;
}

export async function handleLiveToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session, parsedHints = [], liveCoaching = false } = ctx;

  if (call.name === 'update_whiteboard') {
    const args = call.args || {};
    const action = args.action || 'write';
    const title = args.title || (action === 'clear' ? 'Доска очищена' : 'Демонстрация кода');
    const language = args.language || 'java';
    const code = args.code || '';
    const highlightLines = Array.isArray(args.highlightLines) ? args.highlightLines : [];
    const explanation = args.explanation || '';

    console.log(`🎨 Gemini Live emitted Whiteboard update: [${action}] "${title}" (lang: ${language}, lines: ${highlightLines.length})`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              status: 'SUCCESS',
              message: 'Интерактивная доска обновлена на экране кандидата.'
            }
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'whiteboard_update',
        payload: {
          action,
          title,
          language,
          code,
          highlightLines,
          explanation,
          updatedAt: Date.now()
        }
      }));
    }
    return true;
  }

  if (call.name === 'mark_bug_solved') {
    const args = call.args || {};
    const isSolved = args.isSolved ?? true;
    const feedback = args.feedback || 'Отлично! Ошибка найдена верно.';
    const keyInsight = args.keyInsight || '';

    console.log(`🎯 Bug challenge marked as solved: ${feedback}`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              status: 'SUCCESS',
              message: 'Баг подтвержден как решенный.'
            }
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    let decayResult: any = null;
    if (session.questionId) {
      try {
        updateBugChallengeStatus({
          challengeId: session.questionId,
          isSolved: Boolean(isSolved),
          score: isSolved ? 10 : 5,
          feedback,
          keyTakeaways: keyInsight ? [keyInsight] : undefined
        });
      } catch (e) {
        console.warn('Could not update bug challenge status in db:', e);
      }

      try {
        decayResult = await applyKnowledgeDecay({
          questionId: session.questionId,
          topic: session.topic || 'General',
          assistanceLevel: isSolved ? (parsedHints.length > 0 ? 'assisted' : 'solo') : 'relapse',
          resolvedGapIds: session.relevantGapIds
        });
        console.log(`🧠 Bug challenge decay applied:`, decayResult);
      } catch (decayErr) {
        console.warn('Bug challenge decay error:', decayErr);
      }
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'bug_solved',
        payload: {
          isSolved,
          feedback,
          keyInsight,
          knowledgeUpdate: decayResult
        }
      }));
    }
    return true;
  }

  if (call.name === 'submit_interview_evaluation') {
    // SOTA First-Turn Guard: Reject premature evaluation if candidate has not yet responded
    if (!session.hasCandidateResponded) {
      console.warn('🛡️ [First-Turn Guard] Blocked premature submit_interview_evaluation before candidate spoke. Re-prompting AI to speak question...');
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify({
          toolResponse: {
            functionResponses: [
              {
                response: {
                  error: 'Кандидат еще не отвечал на вопрос. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку на этапе первого приветствия. Пожалуйста, поприветствуйте кандидата голосом и четко зачитайте вопрос темы вслух.'
                },
                id: call.id
              }
            ]
          }
        }));
      }
      return true;
    }

    const args = call.args || {};
    const score = typeof args.score === 'number' ? args.score : 75;
    const isPassed = args.isPassed ?? (score >= 70);
    const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
    const missingPoints = Array.isArray(args.missingPoints) ? args.missingPoints : [];
    const feedback = args.spokenFeedback || args.feedback || 'Ответ принят.';
    const questionType = args.questionType || 'definitional';
    const speechCoaching = args.speechCoaching || null;

    // FAANG Calibration Scorecard calculation
    const calculatedScorecard = calculateFaangScorecard({
      score,
      persona: session.persona || 'mentor',
      targetGrade: session.targetGrade || 'L5_SENIOR',
      positivePoints,
      missingPoints,
      questionType
    });

    const faangScorecard = args.faangScorecard ? {
      ...calculatedScorecard,
      ...args.faangScorecard,
      dimensionScores: {
        ...calculatedScorecard.dimensionScores,
        ...(args.faangScorecard.dimensionScores || {})
      }
    } : calculatedScorecard;

    let savedEvalId = '';
    if (session.questionId) {
      try {
        const syncResult = recordEvaluationAndSyncProgress({
          userId: session.userId || 'default_user',
          questionId: session.questionId,
          topic: session.topic || 'General',
          mode: 'voice',
          score,
          isPassed,
          positivePoints,
          missingPoints,
          feedback,
          speechCoaching: speechCoaching ? { ...speechCoaching, questionType, faangScorecard } : { faangScorecard },
          userAnswer: 'Устный ответ в Gemini Live'
        });
        savedEvalId = syncResult.evalId;
        console.log(`💾 Live evaluation saved & progress synced to DB: ${savedEvalId} (Score: ${score}, Topic: ${syncResult.progress.topic}, Percentage: ${syncResult.progress.percentage}%)`);
      } catch (dbErr) {
        console.error('Error saving Live evaluation to DB:', dbErr);
      }
    }

    // Determine assistance level for knowledge tracing
    const probes = session.probesCount || 0;
    let assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse' = 'solo';
    if (session.isRetry) {
      assistanceLevel = isPassed ? 'assisted' : 'relapse';
    } else if (score >= 80 && probes <= 2 && !liveCoaching) {
      assistanceLevel = 'solo';
    } else if (score >= 70) {
      assistanceLevel = 'guided';
    } else if (liveCoaching || (score >= 60 && score < 70)) {
      assistanceLevel = isPassed ? 'assisted' : 'relapse';
    } else {
      assistanceLevel = 'relapse';
    }

    // Apply knowledge decay & record new gap if failed
    let decayResult: any = null;
    try {
      decayResult = await applyKnowledgeDecay({
        questionId: session.questionId,
        topic: session.topic || 'General',
        assistanceLevel,
        resolvedGapIds: session.relevantGapIds
      });
      console.log(`🧠 Knowledge decay applied (${assistanceLevel}):`, JSON.stringify(decayResult));
    } catch (decayErr) {
      console.error('Error applying knowledge decay:', decayErr);
    }

    if (!isPassed && missingPoints.length > 0) {
      try {
        void recordNewErrorGap({
          questionId: session.questionId,
          topic: session.topic || 'General',
          errorConcept: missingPoints[0],
          initialDeficit: 1.0
        });
      } catch (recErr) {
        console.warn('Could not record new gap:', recErr);
      }
    }

    // Send toolResponse back to Gemini Live
    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              status: 'COMMITTED',
              evaluationId: savedEvalId,
              message: 'Оценка сохранена.'
            }
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    // Notify frontend client with evaluation data
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'evaluation_completed',
        evaluation: {
          id: savedEvalId,
          score,
          isPassed,
          positivePoints,
          missingPoints,
          feedback,
          spokenFeedback: feedback,
          questionType,
          speechCoaching,
          faangScorecard,
          assistanceLevel,
          knowledgeUpdate: decayResult
        }
      }));
    }

    console.log('✅ Evaluation delivered to client. Keeping session lifeline open for Q&A and transition.');
    return true;
  }

  return false;
}
