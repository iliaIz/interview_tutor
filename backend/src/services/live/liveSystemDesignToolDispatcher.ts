import { normalizeUserId } from '../evaluation/QuestionEvaluationRepository';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolExecutor';

export function handleInjectChaosFailure(
  args: Record<string, any>
): ToolExecutionResult {
  const failureType = args.failure_type || 'ASYMMETRIC_NETWORK_PARTITION';
  const targetId = args.target_component_id || 'primary_db';
  const context = args.technical_context || 'Инъекция аппаратного или сетевого сбоя на узле.';

  console.log(`💥 Chaos Injected by Gemini Live: [${failureType}] on "${targetId}": ${context}`);

  return {
    result: {
      status: 'INJECTED',
      failureType,
      targetComponentId: targetId,
      message: `Сбой [${failureType}] успешно активирован на компоненте ${targetId}.`
    },
    clientEvent: {
      type: 'chaos_injected',
      failureType,
      targetComponentId: targetId,
      technicalContext: context,
      payload: {
        failureType,
        targetComponentId: targetId,
        technicalContext: context,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    },
    scheduling: 'WHEN_IDLE'
  };
}

export function handleRecordCandidateObservation(
  args: Record<string, any>
): ToolExecutionResult {
  console.log(`👁️ Candidate Observation Recorded: [${args.signal}] ${args.dimension} -> ${args.demonstrated_level}`);

  return {
    result: {
      status: 'RECORDED',
      message: 'Наблюдение зафиксировано в протоколе комитета найма.'
    },
    clientEvent: {
      type: 'candidate_observation_recorded',
      observation: args,
      payload: args,
      timestamp: Date.now()
    },
    scheduling: 'WHEN_IDLE'
  };
}

export function handleSubmitHiringCommitteeVerdict(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
  const userId = normalizeUserId(session.userId);
  const targetLevel = args.target_level || 'L6';
  const calibratedLevel = args.calibrated_level || 'L5';
  const verdict = args.verdict || 'NO_HIRE';
  const scores = args.scores || {
    exploration: 3.0,
    architecture: 3.0,
    deep_dives: 2.5,
    operational_excellence: 2.8
  };
  const defense = args.calibration_defense || 'Калибровочное заключение комитета по найму.';

  const scoreValues = Object.values(scores).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const overallScore = scoreValues.length > 0
    ? Number((scoreValues.reduce((acc, n) => acc + n, 0) / scoreValues.length).toFixed(2))
    : 0;

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

  if (session.questionId && ctx.persistencePort) {
    try {
      ctx.persistencePort.saveSystemDesignSubmission({
        submissionId,
        userId,
        scenarioId: session.questionId,
        diagramMermaid: session.currentArchitectureMermaid || '',
        notesMarkdown: defense,
        overallScore,
        verdictJson: JSON.stringify(packet)
      });
      console.log(`💾 Persisted Hiring Committee submission ${submissionId} for scenario ${session.questionId}`);
    } catch (dbErr) {
      console.warn('Could not persist hiring committee submission via ToolPersistencePort:', dbErr);
    }
  }

  return {
    result: {
      status: 'COMMITTED',
      verdict,
      calibratedLevel,
      message: 'Вердикт калибровочного комитета официально зарегистрирован.'
    },
    clientEvent: {
      type: 'hiring_committee_verdict',
      submissionId,
      packet,
      payload: packet,
      timestamp: Date.now()
    },
    scheduling: 'WHEN_IDLE'
  };
}
