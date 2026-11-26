import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { WebSocket } from 'ws';
import { db } from '../db';
import { CandidateMemoryAggregate } from '../memory/CandidateMemoryAggregate';
import { QuestionEvaluationRepository, normalizeUserId } from '../evaluation/QuestionEvaluationRepository';
import { QuestionEvaluationRecordInput, QuestionEvaluationService, questionEvaluationService } from '../evaluation/QuestionEvaluationService';
import { ProxySession, UpstreamTransportPort } from './liveSessionTypes';
import { ToolAudioMutex } from './ToolAudioMutex';
import { LiveWorkspaceStore, resolveWorkspaceFileMatch } from './LiveWorkspaceStore';
import { handleUpdateWhiteboard, handleReadFile, handleMarkBugSolved, handleReportIdentifiedSmell } from './liveWorkspaceHandlers';
import { handleSubmitInterviewEvaluation } from './liveEvaluationToolDispatcher';
import { handleInjectChaosFailure, handleRecordCandidateObservation, handleSubmitHiringCommitteeVerdict } from './liveSystemDesignToolDispatcher';
import { handleAdvanceHrPhase, handleAdvanceHrLearningStep, handleEmitHrRoundEvaluation, handleSubmitHrEvaluation } from './liveHrToolDispatcher';

export type ToolScheduling = 'WHEN_IDLE' | 'SILENT';
export const WHITEBOARD_SILENT_AUDIO_THRESHOLD_BYTES = 24000;

export function resolveWhiteboardScheduling(action: unknown, currentTurnAudioBytes: number = 0): ToolScheduling {
  return action === 'clear' || (currentTurnAudioBytes || 0) >= WHITEBOARD_SILENT_AUDIO_THRESHOLD_BYTES ? 'SILENT' : 'WHEN_IDLE';
}

export interface UpdateBugSolvedInput {
  challengeId: string;
  status: 'solved';
  decayedTopic?: string;
  userId: string;
  isSolved?: boolean;
  score?: number;
  feedback?: string;
  keyTakeaways?: string[];
  assistanceLevel?: 'solo' | 'assisted' | 'relapse';
  resolvedGapIds?: string[];
}

export interface SystemDesignSubmissionInput {
  userId: string;
  scenarioId: string;
  diagramMermaid: string;
  overallScore: number;
  verdictJson: string;
  submissionId?: string;
  notesMarkdown?: string;
}

export interface ToolPersistencePort {
  saveEvaluationOutcome(input: QuestionEvaluationRecordInput): Promise<{ evaluationId: string; deltaProgress?: unknown; knowledgeUpdate?: unknown }>;
  saveSystemDesignSubmission(input: SystemDesignSubmissionInput): void;
  updateBugSolved(input: UpdateBugSolvedInput): Promise<{ knowledgeUpdate?: unknown } | void>;
  readChallengeFileFromStore(challengeId: string, filePath: string): Promise<{ path: string; content: string } | null>;
}

export function createDefaultToolPersistencePort(deps: {
  database?: Database.Database;
  evaluationService?: Pick<QuestionEvaluationService, 'recordOutcome'>;
  memoryAggregate?: Pick<CandidateMemoryAggregate, 'applyKnowledgeDecay'>;
} = {}): ToolPersistencePort {
  const database = deps.database ?? db;
  const memory = deps.memoryAggregate ?? CandidateMemoryAggregate.getInstance();
  const evalSvc = deps.evaluationService ?? (
    deps.database
      ? new QuestionEvaluationService(new QuestionEvaluationRepository(database), { memoryAggregate: memory as any })
      : questionEvaluationService
  );

  return {
    async saveEvaluationOutcome(input) {
      const outcome = await evalSvc.recordOutcome(input);
      return {
        evaluationId: outcome.evalId,
        deltaProgress: outcome.progress,
        knowledgeUpdate: outcome.knowledgeUpdate
      };
    },
    saveSystemDesignSubmission(input) {
      const id = input.submissionId || `sd_hc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      database.prepare(
        'INSERT INTO system_design_submissions (id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, input.scenarioId, normalizeUserId(input.userId), input.diagramMermaid, input.notesMarkdown ?? '', input.verdictJson);
    },
    async updateBugSolved(input) {
      const userId = normalizeUserId(input.userId);
      const isSolved = input.isSolved ?? true;
      try {
        database.prepare(`
          UPDATE bug_challenges
          SET is_solved = ?, last_score = COALESCE(?, last_score), last_feedback = COALESCE(?, last_feedback),
              key_takeaways_json = COALESCE(?, key_takeaways_json), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          isSolved ? 1 : 0,
          input.score ?? null,
          input.feedback ?? null,
          input.keyTakeaways ? JSON.stringify(input.keyTakeaways) : null,
          input.challengeId
        );
      } catch (e) {
        console.warn('Could not update bug challenge status in db:', e);
      }
      try {
        const knowledgeUpdate = await memory.applyKnowledgeDecay({
          userId,
          questionId: input.challengeId,
          topic: input.decayedTopic || 'General',
          assistanceLevel: input.assistanceLevel || 'solo',
          resolvedGapIds: input.resolvedGapIds
        });
        return { knowledgeUpdate };
      } catch (decayErr) {
        console.warn('Bug challenge decay error:', decayErr);
        return {};
      }
    },
    async readChallengeFileFromStore(challengeId, filePath) {
      try {
        const row = database.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ?').get(challengeId, challengeId) as any;
        if (!row?.manifest_json) return null;
        const parsed = JSON.parse(row.manifest_json);
        if (!Array.isArray(parsed.workspaceFiles)) return null;
        const workspaceFiles = parsed.workspaceFiles as Array<{ path?: string; content?: string }>;
        const hit = resolveWorkspaceFileMatch(workspaceFiles, filePath).match;
        return hit?.path && typeof hit.content === 'string' ? { path: hit.path, content: hit.content } : null;
      } catch {
        return null;
      }
    }
  };
}

let cachedDefaultPort: ToolPersistencePort | null = null;
function getDefaultToolPersistencePort(): ToolPersistencePort {
  if (!cachedDefaultPort) cachedDefaultPort = createDefaultToolPersistencePort();
  return cachedDefaultPort;
}

export interface GeminiFunctionCall { id: string; name: string; args?: Record<string, any>; }
export interface ToolExecutionContext {
  callId: string; toolName: string; session: ProxySession; parsedHints: string[];
  liveCoaching: boolean; persistencePort?: ToolPersistencePort;
}
export interface ClientWsEvent { type: string; payload?: any; [key: string]: any; }
export interface ToolExecutionResult {
  result?: Record<string, any>; error?: string; clientEvent?: ClientWsEvent; scheduling?: ToolScheduling;
}
export type PureToolHandler = (args: Record<string, any>, ctx: ToolExecutionContext) => Promise<ToolExecutionResult> | ToolExecutionResult;
export interface LiveToolDefinition {
  name: string; handler: PureToolHandler; scheduling: ToolScheduling; isGatedOnTurn0?: boolean;
  turn0ErrorMessage?: string; dedupWindowMs?: number; dedupResponseResult?: Record<string, any>;
}
export interface ToolExecutorPorts { persistencePort?: ToolPersistencePort; }
export interface ToolExecutorOptions {
  functionCalls: GeminiFunctionCall[]; clientSocket: WebSocket; upstream?: UpstreamTransportPort;
  session: ProxySession; parsedHints: string[]; liveCoaching: boolean; persistencePort?: ToolPersistencePort;
}

const DEFAULT_TURN0_ERROR = 'Кандидат еще не отвечал на вопрос. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку на этапе первого приветствия. Пожалуйста, поприветствуйте кандидата голосом, четко зачитайте вопрос и передайте слово.';
const SD_TURN0_ERROR = 'Кандидат еще не защищал архитектуру. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выносить вердикт на этапе первого хода. Пожалуйста, поприветствуйте кандидата голосом, сформулируйте задачу и пригласите обсудить функциональные требования.';

const TOOL_DEFINITIONS: LiveToolDefinition[] = [
  {
    name: 'update_whiteboard', handler: handleUpdateWhiteboard, scheduling: 'WHEN_IDLE', dedupWindowMs: 3000,
    dedupResponseResult: { status: 'SUCCESS', message: 'Интерактивная доска уже обновлена.', directive: 'Кратко (в 1-2 предложениях) поясни кандидату голосом показанный фрагмент. Не вызывай повторных инструментов.' }
  },
  { name: 'read_file', handler: handleReadFile, scheduling: 'WHEN_IDLE' },
  { name: 'mark_bug_solved', handler: handleMarkBugSolved, scheduling: 'SILENT' },
  { name: 'report_identified_smell', handler: handleReportIdentifiedSmell, scheduling: 'WHEN_IDLE' },
  { name: 'submit_interview_evaluation', handler: handleSubmitInterviewEvaluation, scheduling: 'WHEN_IDLE', isGatedOnTurn0: true, turn0ErrorMessage: DEFAULT_TURN0_ERROR },
  { name: 'inject_chaos_failure', handler: handleInjectChaosFailure, scheduling: 'WHEN_IDLE' },
  { name: 'record_candidate_observation', handler: handleRecordCandidateObservation, scheduling: 'WHEN_IDLE' },
  { name: 'submit_hiring_committee_verdict', handler: handleSubmitHiringCommitteeVerdict, scheduling: 'WHEN_IDLE', isGatedOnTurn0: true, turn0ErrorMessage: SD_TURN0_ERROR },
  { name: 'advance_hr_phase', handler: handleAdvanceHrPhase, scheduling: 'SILENT' },
  { name: 'advance_hr_learning_step', handler: handleAdvanceHrLearningStep, scheduling: 'WHEN_IDLE', isGatedOnTurn0: true, turn0ErrorMessage: DEFAULT_TURN0_ERROR },
  { name: 'emit_hr_round_evaluation', handler: handleEmitHrRoundEvaluation, scheduling: 'SILENT', isGatedOnTurn0: true, turn0ErrorMessage: DEFAULT_TURN0_ERROR },
  { name: 'submit_hr_evaluation', handler: handleSubmitHrEvaluation, scheduling: 'SILENT', isGatedOnTurn0: true, turn0ErrorMessage: DEFAULT_TURN0_ERROR }
];

export const LIVE_TOOL_REGISTRY: ReadonlyMap<string, LiveToolDefinition> = new Map(TOOL_DEFINITIONS.map((d) => [d.name, d]));

export class LiveToolExecutor {
  constructor(private readonly defaultPersistencePort?: ToolPersistencePort) {}

  public async executeFunctionCalls(options: ToolExecutorOptions, ports?: ToolExecutorPorts): Promise<void> {
    return LiveToolExecutor.executeFunctionCalls(options, { persistencePort: ports?.persistencePort ?? this.defaultPersistencePort });
  }
  public handleCancellation(session: ProxySession, ids: string[]): void {
    LiveToolExecutor.handleCancellation(session, ids);
  }

  private static syncPendingState(session: ProxySession): void {
    const active = Boolean(session.toolAudioMutex?.shouldGateMicAudio());
    session.isToolCallPending = active;
    if (!active && session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
  }

  private static sendGeminiToolResponse(
    upstream: UpstreamTransportPort | undefined,
    callId: string,
    toolName: string,
    payload: { result?: Record<string, any>; error?: string },
    scheduling: ToolScheduling = 'WHEN_IDLE'
  ): void {
    if (!upstream?.isUpstreamOpen()) return;
    const response = payload.error ? { error: payload.error } : { result: payload.result ?? { status: 'SUCCESS' } };
    upstream.sendUpstream(JSON.stringify({ toolResponse: { functionResponses: [{ id: callId, name: toolName, response, scheduling }] } }));
  }

  private static sendClientEvent(clientSocket: WebSocket, event: ClientWsEvent): void {
    if (clientSocket.readyState === WebSocket.OPEN) clientSocket.send(JSON.stringify(event));
  }

  public static async executeFunctionCalls(options: ToolExecutorOptions, ports?: ToolExecutorPorts): Promise<void> {
    const { functionCalls, clientSocket, upstream, session, parsedHints, liveCoaching } = options;
    const upstreamTarget = upstream || session.upstreamTransport;
    const persistencePort = ports?.persistencePort ?? options.persistencePort ?? getDefaultToolPersistencePort();
    const mutex = session.toolAudioMutex ?? (session.toolAudioMutex = new ToolAudioMutex());

    const entries = functionCalls.map((call, i) => ({ call, lockId: call.id || `tool_${Date.now()}_${i}` }));
    for (const { lockId } of entries) mutex.acquire(lockId);
    LiveToolExecutor.syncPendingState(session);
    session.lastActivityAt = Date.now();
    session.watchdogs?.disarmAll();
    console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(functionCalls));

    if (session.toolCallSafetyTimeout) clearTimeout(session.toolCallSafetyTimeout);
    session.toolCallSafetyTimeout = setTimeout(() => {
      if (mutex.shouldGateMicAudio() || session.isToolCallPending) {
        console.warn('⚠️ Tool call safety timeout (10s) reached: releasing audio gate');
        mutex.reset();
        LiveToolExecutor.syncPendingState(session);
      }
    }, 10000);
    (session.toolCallSafetyTimeout as any)?.unref?.();

    this.sendClientEvent(clientSocket, { type: 'tool_executing', tools: functionCalls.map((fc) => fc.name) });
    let awaitingSpeechForTools = false;

    try {
      for (const { call, lockId } of entries) {
        try {
          const def = LIVE_TOOL_REGISTRY.get(call.name);
          if (!def) {
            this.sendGeminiToolResponse(upstreamTarget, call.id, call.name, {
              result: { error: `Tool '${call.name}' is not supported in this session. Please explain verbally or use update_whiteboard.` }
            }, 'WHEN_IDLE');
            continue;
          }

          const isBlocked = session.aggregate?.canExecuteGradingTools
            ? !session.aggregate.canExecuteGradingTools().allowed
            : !session.hasCandidateResponded;
          if (def.isGatedOnTurn0 && isBlocked) {
            console.warn(`🛡️ [First-Turn Guard] Blocked premature ${call.name} before candidate spoke.`);
            this.sendGeminiToolResponse(upstreamTarget, call.id, call.name, { error: def.turn0ErrorMessage || DEFAULT_TURN0_ERROR }, 'WHEN_IDLE');
            continue;
          }

          if (def.dedupWindowMs && def.dedupWindowMs > 0) {
            const callKey = JSON.stringify(call.args || {});
            const now = Date.now();
            if (!session.toolDedupCache) session.toolDedupCache = {};
            const cached = session.toolDedupCache[call.name];
            const isDup = (cached && cached.hash === callKey && now - cached.timestamp < def.dedupWindowMs) ||
              (call.name === 'update_whiteboard' && session.lastToolCallHash === callKey && now - (session.lastToolCallTime || 0) < def.dedupWindowMs);
            if (isDup) {
              const dupScheduling = call.name === 'update_whiteboard'
                ? resolveWhiteboardScheduling(call.args?.action, session.currentTurnAudioBytes || 0)
                : def.scheduling;
              if (dupScheduling === 'WHEN_IDLE' && (session.currentTurnAudioBytes || 0) < WHITEBOARD_SILENT_AUDIO_THRESHOLD_BYTES) {
                awaitingSpeechForTools = true;
              }
              this.sendGeminiToolResponse(upstreamTarget, call.id, call.name, { result: def.dedupResponseResult || { status: 'SUCCESS', deduplicated: true } }, dupScheduling);
              continue;
            }
            session.toolDedupCache[call.name] = { hash: callKey, timestamp: now };
            session.lastToolCallHash = callKey;
            session.lastToolCallTime = now;
          }

          const outcome = await def.handler(call.args || {}, { callId: call.id, toolName: call.name, session, parsedHints, liveCoaching, persistencePort });
          const scheduling = call.name === 'update_whiteboard'
            ? resolveWhiteboardScheduling(call.args?.action, session.currentTurnAudioBytes || 0)
            : (outcome.scheduling || def.scheduling || 'WHEN_IDLE');
          let resultPayload = outcome.result;
          if (call.name === 'update_whiteboard' && scheduling === 'SILENT' && resultPayload?.directive) {
            resultPayload = { ...resultPayload };
            delete resultPayload.directive;
          }
          if (scheduling === 'WHEN_IDLE' && (session.currentTurnAudioBytes || 0) < WHITEBOARD_SILENT_AUDIO_THRESHOLD_BYTES) {
            awaitingSpeechForTools = true;
          }
          this.sendGeminiToolResponse(upstreamTarget, call.id, call.name, { result: resultPayload, error: outcome.error }, scheduling);
          if (outcome.clientEvent) this.sendClientEvent(clientSocket, outcome.clientEvent);
        } catch (toolErr) {
          const msg = toolErr instanceof Error ? toolErr.message : 'Internal error';
          console.error(`❌ Error executing tool ${call.name}:`, toolErr);
          this.sendGeminiToolResponse(upstreamTarget, call.id, call.name, { result: { error: `Tool execution failed: ${msg}` } }, 'WHEN_IDLE');
        } finally {
          mutex.release(lockId);
          LiveToolExecutor.syncPendingState(session);
        }
      }

      if (awaitingSpeechForTools) {
        session.awaitingToolSpeech = true;
        this.sendClientEvent(clientSocket, { type: 'tool_awaiting_speech', tools: functionCalls.map((fc) => fc.name) });
      }
      this.sendClientEvent(clientSocket, { type: 'tool_execution_complete', tools: functionCalls.map((fc) => fc.name) });
    } finally {
      for (const { lockId } of entries) mutex.release(lockId);
      LiveToolExecutor.syncPendingState(session);
    }
  }

  public static handleCancellation(session: ProxySession, ids: string[]): void {
    console.log('🚫 [TOOL_CALL_CANCELLED] Upstream Gemini cancelled tool calls:', ids);
    session.toolAudioMutex?.cancel(ids);
    LiveToolExecutor.syncPendingState(session);
  }
}

export const LiveToolEngine = LiveToolExecutor;
export { LiveWorkspaceStore };
