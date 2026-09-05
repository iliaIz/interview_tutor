import { WebSocket } from 'ws';
import { db } from '../db';
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
    currentArchitectureMermaid?: string;
    currentGraphIr?: string;
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
              result: {
                status: 'SUCCESS',
                message: 'Интерактивная доска обновлена на экране кандидата.'
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
              result: {
                status: 'SUCCESS',
                message: 'Баг подтвержден как решенный.'
              }
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
              result: {
                status: 'COMMITTED',
                evaluationId: savedEvalId,
                message: 'Оценка сохранена.'
              }
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

  // --- SOTA System Design Tools ---

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
