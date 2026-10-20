/**
 * liveNavigationToolDispatcher.ts
 * SOTA Late-2026 Navigation Tool Call Dispatcher for Gemini 3.8 Live.
 * Handles voice-commanded paging ('next', 'prev', 'to_index', 'finish') within question batches.
 * Cognitive bounding limit: <= 350 lines.
 */

import { WebSocket } from 'ws';
import { recordEvaluationAndSyncProgress } from '../progressService';
import { recordNewErrorGap } from '../vectorMemoryService';
import { LiveToolContext } from './liveToolDispatcher';

export interface NavigationToolArgs {
  direction: 'next' | 'prev' | 'to_index' | 'finish';
  action?: 'skip_unanswered' | 'proceed_next' | 'review_previous' | 'finish_batch';
  targetIndex?: number;
  candidateReason?: string;
}

export async function handleNavigationToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session } = ctx;

  if (call.name !== 'navigate_question') {
    return false;
  }

  const args: NavigationToolArgs = call.args || { direction: 'next', action: 'proceed_next' };
  const direction = args.direction || 'next';
  let action = args.action || (direction === 'next' ? 'proceed_next' : 'review_previous');
  const candidateReason = args.candidateReason || '';

  const currentIndex = typeof session.questionIndex === 'number' ? session.questionIndex : 0;
  const totalQuestions = typeof session.totalQuestions === 'number' && session.totalQuestions > 0
    ? session.totalQuestions
    : 1;

  let targetIndex = currentIndex;
  let isBoundaryBlocked = false;
  let boundaryMessage = '';

  if (direction === 'next') {
    if (currentIndex + 1 >= totalQuestions) {
      action = 'finish_batch';
      targetIndex = totalQuestions - 1;
    } else {
      targetIndex = currentIndex + 1;
    }
  } else if (direction === 'prev') {
    if (currentIndex <= 0) {
      isBoundaryBlocked = true;
      targetIndex = 0;
      boundaryMessage = 'Кандидат уже находится на первом вопросе. Назад идти некуда.';
    } else {
      targetIndex = currentIndex - 1;
      action = 'review_previous';
    }
  } else if (direction === 'to_index') {
    const rawTarget = typeof args.targetIndex === 'number' ? args.targetIndex : currentIndex;
    targetIndex = Math.max(0, Math.min(totalQuestions - 1, rawTarget));
  } else if (direction === 'finish') {
    action = 'finish_batch';
    targetIndex = currentIndex;
  }

  // SOTA Fair Evaluation Invariant:
  // If candidate skips a question in an interview before completing an oral answer,
  // record a synthetic 0-point evaluation so the grade reflects the uncompleted question.
  if (
    session.sessionType === 'interview' &&
    action === 'skip_unanswered' &&
    !(session as any).hasCompletedEvaluation &&
    session.questionId
  ) {
    try {
      const syntheticFeedback = 'Вопрос пропущен по запросу кандидата без устного ответа.';
      const syncResult = recordEvaluationAndSyncProgress({
        userId: session.userId || 'default_user',
        questionId: session.questionId,
        topic: session.topic || 'General',
        mode: 'voice',
        score: 0,
        isPassed: false,
        positivePoints: [],
        missingPoints: ['Вопрос пропущен кандидатом без ответа'],
        feedback: syntheticFeedback,
        speechCoaching: {
          questionType: 'definitional',
          criteriaBreakdown: [
            {
              id: 'c1',
              title: 'Ответ на вопрос',
              maxPoints: 100,
              earnedPoints: 0,
              status: 'missed',
              gap: 'Кандидат пропустил вопрос.'
            }
          ],
          deductions: [
            {
              penalty: 100,
              criteria: 'Полнота ответа',
              reason: 'Кандидат пропустил вопрос без ответа (-100 б.)'
            }
          ]
        },
        turnTelemetry: session.turnTelemetryHistory || [],
        transcript: `Кандидат запросил пропуск вопроса. Причина: ${candidateReason || 'Не ответил'}.`,
        userAnswer: '[Вопрос пропущен]'
      });

      (session as any).hasCompletedEvaluation = true;

      // Register unlearned gap in vector memory/FSRS
      try {
        await recordNewErrorGap({
          userId: session.userId || 'default_user',
          questionId: session.questionId,
          topic: session.topic || 'General',
          questionText: session.questionText || '',
          gapDescription: 'Кандидат пропустил вопрос без ответа.',
          initialDeficit: 1.0
        });
      } catch (err) {
        console.warn('[NavigationDispatcher] Could not record skip gap in vector memory:', err);
      }

      // Notify client socket with synthetic evaluation so batch results and scorecards update
      if (clientSocket.readyState === WebSocket.OPEN) {
        const evalPayload = {
          evalId: syncResult.evalId,
          score: 0,
          isPassed: false,
          isSkipped: true,
          feedback: syntheticFeedback,
          positivePoints: [],
          missingPoints: ['Вопрос пропущен кандидатом без ответа'],
          criteriaBreakdown: [
            {
              id: 'c1',
              title: 'Ответ на вопрос',
              maxPoints: 100,
              earnedPoints: 0,
              status: 'missed'
            }
          ],
          deductions: [{ penalty: 100, criteria: 'Отказ от ответа', reason: 'Вопрос пропущен без ответа' }]
        };

        clientSocket.send(JSON.stringify({
          type: 'evaluation',
          evaluation: evalPayload,
          payload: evalPayload
        }));
      }
      console.log(`[NavigationDispatcher] Registered 0-score skip for question ${session.questionId} in interview`);
    } catch (evalErr) {
      console.error('[NavigationDispatcher] Error registering skip evaluation:', evalErr);
    }
  }

  // Notify frontend client about the navigation action
  if (clientSocket.readyState === WebSocket.OPEN) {
    clientSocket.send(JSON.stringify({
      type: 'navigation_action',
      direction,
      action,
      currentIndex,
      targetIndex,
      totalQuestions,
      isBoundaryBlocked,
      boundaryMessage,
      reason: candidateReason
    }));
  }

  // Formulate Gemini Live toolResponse with natural verbal guidance
  const isLast = targetIndex >= totalQuestions - 1 && action === 'finish_batch';
  let verbalDirective = '';
  if (isBoundaryBlocked) {
    verbalDirective = 'Голосом скажи кандидату: "Мы уже находимся на первом вопросе. Куда именно вы хотите перейти?" и жди указаний.';
  } else if (isLast) {
    verbalDirective = 'Это был заключительный вопрос темы. Озвучь короткую завершающую фразу (1 предложение) и поблагодари за прохождение темы.';
  } else if (action === 'skip_unanswered') {
    verbalDirective = 'Кратко подтверди голосом (1 фраза, например: "Хорошо, фиксирую пропуск вопроса. Переходим к следующему:") и четко зачитай следующий вопрос темы.';
  } else if (action === 'review_previous') {
    verbalDirective = 'Кратко подтверди голосом (1 фраза, например: "Возвращаемся к предыдущему вопросу:") и четко зачитай вопрос темы.';
  } else {
    verbalDirective = 'Кратко подтверди голосом (1 фраза, например: "Отлично, переходим к следующему вопросу:") и четко зачитай следующий вопрос темы.';
  }

  const toolResponse = {
    toolResponse: {
      functionResponses: [
        {
          id: call.id,
          name: call.name,
          response: {
            result: {
              success: !isBoundaryBlocked,
              direction,
              action,
              targetIndex,
              totalQuestions,
              isBoundaryBlocked,
              message: isBoundaryBlocked ? boundaryMessage : `Переход к вопросу ${targetIndex + 1} из ${totalQuestions}`,
              directive: verbalDirective
            }
          },
          scheduling: 'WHEN_IDLE'
        }
      ]
    }
  };

  if (geminiSocket.readyState === WebSocket.OPEN) {
    geminiSocket.send(JSON.stringify(toolResponse));
  }

  console.log(`[NavigationDispatcher] Handled navigate_question: ${direction} -> targetIndex ${targetIndex}/${totalQuestions}`);
  return true;
}
