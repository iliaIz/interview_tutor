import { db } from '../db';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolEngine';

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
