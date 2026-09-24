import { WebSocket } from 'ws';
import { db } from '../db';
import { LiveToolContext } from './liveToolDispatcher';

export async function handleSystemDesignToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session } = ctx;

  if (call.name === 'inject_chaos_failure') {
    const args = call.args || {};
    const failureType = args.failure_type || 'ASYMMETRIC_NETWORK_PARTITION';
    const targetId = args.target_component_id || 'primary_db';
    const context = args.technical_context || 'Инъекция аппаратного или сетевого сбоя на узле.';

    console.log(`💥 Chaos Injected by Gemini Live: [${failureType}] on "${targetId}": ${context}`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'INJECTED',
                failureType,
                targetComponentId: targetId,
                message: `Сбой [${failureType}] успешно активирован на компоненте ${targetId}.`
              }
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
        type: 'chaos_injected',
        failureType,
        targetComponentId: targetId,
        technicalContext: context,
        timestamp: Date.now()
      }));
    }
    return true;
  }

  if (call.name === 'record_candidate_observation') {
    const args = call.args || {};
    console.log(`📝 Candidate Observation Logged [${args.signal} / ${args.demonstrated_level}] in ${args.dimension}: "${args.evidence_transcript}"`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'RECORDED',
                message: 'Наблюдение зафиксировано в протоколе комитета найма.'
              }
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
        type: 'candidate_observation_recorded',
        observation: args,
        timestamp: Date.now()
      }));
    }
    return true;
  }

  if (call.name === 'submit_hiring_committee_verdict') {
    // SOTA First-Turn Guard: Reject premature evaluation if candidate has not yet defended their architecture
    if (!session.hasCandidateResponded) {
      console.warn('🛡️ [First-Turn Guard] Blocked premature submit_hiring_committee_verdict before candidate spoke.');
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify({
          toolResponse: {
            functionResponses: [
              {
                response: {
                  error: 'Кандидат еще не защищал архитектуру. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выносить вердикт на этапе первого хода. Пожалуйста, поприветствуйте кандидата голосом, сформулируйте задачу и пригласите обсудить функциональные требования.'
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
    const targetLevel = args.target_level || 'L6';
    const calibratedLevel = args.calibrated_level || 'L5';
    const verdict = args.verdict || 'NO_HIRE';
    const scores = args.scores || { exploration: 3.0, architecture: 3.0, deep_dives: 2.5, operational_excellence: 2.8 };
    const defense = args.calibration_defense || 'Калибровочное заключение комитета по найму.';

    console.log(`⚖️ Hiring Committee Verdict Submitted: [${verdict}] Target: ${targetLevel} -> Calibrated: ${calibratedLevel}`);

    const submissionId = `sd_hc_${session.sessionId || Date.now()}`;
    const packet = {
      candidate_id: session.userId || 'candidate',
      interview_timestamp: new Date().toISOString(),
      target_level: targetLevel,
      calibrated_level: calibratedLevel,
      hiring_recommendation: verdict,
      scores,
      leveling_justification: defense
    };

    if (session.questionId) {
      try {
        db.prepare(`
          INSERT INTO system_design_submissions (id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          submissionId,
          session.questionId,
          session.userId || 'default_user',
          session.currentArchitectureMermaid || '',
          defense,
          JSON.stringify(packet)
        );
        console.log(`💾 Persisted Hiring Committee submission ${submissionId} for scenario ${session.questionId}`);
      } catch (dbErr) {
        console.warn('Could not persist hiring committee submission to db:', dbErr);
      }
    }

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'COMMITTED',
                verdict,
                calibratedLevel,
                message: 'Вердикт калибровочного комитета официально зарегистрирован.'
              }
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
        type: 'hiring_committee_verdict',
        submissionId,
        packet,
        timestamp: Date.now()
      }));
    }
    return true;
  }

  return false;
}
