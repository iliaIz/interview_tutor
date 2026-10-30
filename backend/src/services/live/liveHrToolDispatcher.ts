/**
 * liveHrToolDispatcher.ts
 * Dedicated dispatcher for HR Screening and Micro-Drill tool calls.
 * SOTA Late 2026 Engine vs. Payload isolation.
 */

import { WebSocket } from 'ws';
import { LiveToolContext } from './liveToolDispatcher';
import { HR_VOICE_EVENTS, HrScorecard } from '@interview-prep/shared';

export async function handleHrToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session } = ctx;

  // 1. Tool: advance_hr_phase
  if (call.name === 'advance_hr_phase') {
    const args = call.args || {};
    const fromPhase = args.fromPhase || 'unknown';
    const toPhase = args.toPhase || 'next_phase';
    const phaseSummary = args.phaseSummary || 'Фаза завершена.';

    console.log(`🧭 [HR_FSM] Phase transition requested: "${fromPhase}" -> "${toPhase}" (Summary: ${phaseSummary.slice(0, 80)}...)`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: `Фаза успешно переключена на ${toPhase}.`,
                directive: `Ты перешла к фазе ${toPhase}. Задай следующий вопрос кандидату естественным речевым потоком согласно твоей роли рекрутера. Избегай сервисных комментариев («переходим к следующей фазе») — сразу задавай содержательный вопрос.`
              }
            },
            scheduling: 'SILENT'
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_PHASE_TRANSITION,
          payload: {
            fromPhase,
            toPhase,
            phaseSummary,
            timestamp: Date.now()
          }
        })
      );
    }

    return true;
  }

  // 2. Tool: emit_hr_round_evaluation (Micro-Drill mode)
  if (call.name === 'emit_hr_round_evaluation') {
    const args = call.args || {};
    const questionId = args.questionId || session.questionId || 'hr_q0_elevator_pitch';
    const passed = Boolean(args.passed ?? ((args.overallScore || 0) >= 85));
    const overallScore = Math.max(0, Math.min(100, Math.round(Number(args.overallScore) || 75)));
    const substanceMatch = Math.max(0, Math.min(100, Math.round(Number(args.substanceMatch) || 75)));
    const lexicalDensity = Math.max(0, Math.min(100, Math.round(Number(args.lexicalDensity) || 75)));
    const pacingScore = Math.max(0, Math.min(100, Math.round(Number(args.pacingScore) || 75)));
    const deliveryConfidence = Math.max(0, Math.min(100, Math.round(Number(args.deliveryConfidence) || 75)));
    const missedAnchors = Array.isArray(args.missedAnchors) ? args.missedAnchors.map(String) : [];
    const actionableCritique = args.actionableCritique || 'Хороший ответ, продолжайте отработку.';
    const nextAction = args.nextAction === 'advance_next_question' ? 'advance_next_question' : 'repeat_drill';

    console.log(`🎯 [HR_DRILL_EVAL] Question: ${questionId} | Score: ${overallScore} | Passed: ${passed} | Next: ${nextAction}`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: 'Оценка зафиксирована в системе.',
                directive: `Озвучь кандидату краткий вердикт голосом (СТРОГО НЕ БОЛЕЕ 15-20 СЕКУНД!). Сфокусируйся на 1-2 главных ошибках или похвали за точность, если балл >= 85. Предложи повторить дубль или перейти дальше.`
              }
            },
            scheduling: 'SILENT'
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    const scorecard: HrScorecard = {
      sessionId: session.sessionId || 'hr_session',
      turnId: `turn_${Date.now()}`,
      questionId,
      mode: 'rapid_fire_micro_drill',
      overallScore,
      passed,
      metrics: {
        substanceMatch,
        lexicalDensity,
        pacingScore,
        deliveryConfidence
      },
      turnDurationSec: 75,
      averageWpm: 125,
      fillerWordsSpotted: [],
      anchorsHit: [],
      anchorsMissed: missedAnchors,
      actionableCritique,
      nextAction
    };

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
          payload: scorecard
        })
      );
    }

    return true;
  }

  // 3. Tool: submit_hr_evaluation (Full Simulation mode)
  if (call.name === 'submit_hr_evaluation') {
    const args = call.args || {};
    const overallScore = Math.max(0, Math.min(100, Math.round(Number(args.overallScore) || 80)));
    const passed = overallScore >= 85;
    const substanceMatch = Math.max(0, Math.min(100, Math.round(Number(args.substanceMatch) || overallScore)));
    const lexicalDensity = Math.max(0, Math.min(100, Math.round(Number(args.lexicalDensity) || overallScore)));
    const pacingScore = Math.max(0, Math.min(100, Math.round(Number(args.pacingScore) || overallScore)));
    const deliveryConfidence = Math.max(0, Math.min(100, Math.round(Number(args.deliveryConfidence) || overallScore)));
    const spokenFeedback = args.spokenFeedback || 'Скрининг завершен.';
    const redFlags = Array.isArray(args.redFlags) ? args.redFlags.map(String) : [];
    const strengths = Array.isArray(args.strengths) ? args.strengths.map(String) : [];

    console.log(`📋 [HR_SIMULATION_SUMMARY] Full screening evaluated: ${overallScore}/100 (Passed: ${passed})`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: 'Сводный отчет по скринингу сформирован.',
                directive: `Поблагодари кандидата за созвон, озвучь итоговое впечатление в 1-2 предложениях и попрощайся.`
              }
            },
            scheduling: 'SILENT'
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    const scorecard: HrScorecard = {
      sessionId: session.sessionId || 'hr_sim_session',
      turnId: `sim_turn_${Date.now()}`,
      questionId: 'full_screening_evaluation',
      mode: 'full_screening_simulation',
      overallScore,
      passed,
      metrics: {
        substanceMatch,
        lexicalDensity,
        pacingScore,
        deliveryConfidence
      },
      turnDurationSec: 900,
      averageWpm: 122,
      fillerWordsSpotted: [],
      anchorsHit: strengths,
      anchorsMissed: redFlags,
      actionableCritique: spokenFeedback,
      nextAction: 'session_completed'
    };

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
          payload: scorecard
        })
      );
    }

    return true;
  }

  return false;
}
