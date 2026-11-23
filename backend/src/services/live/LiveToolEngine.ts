import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import {
  handleUpdateWhiteboard,
  handleReadFile,
  handleMarkBugSolved,
  handleReportIdentifiedSmell
} from './liveWorkspaceHandlers';
import { handleSubmitInterviewEvaluation } from './liveEvaluationToolDispatcher';
import {
  handleInjectChaosFailure,
  handleRecordCandidateObservation,
  handleSubmitHiringCommitteeVerdict
} from './liveSystemDesignToolDispatcher';
import {
  handleAdvanceHrPhase,
  handleEmitHrRoundEvaluation,
  handleSubmitHrEvaluation
} from './liveHrToolDispatcher';

export type ToolScheduling = 'WHEN_IDLE' | 'SILENT';

export interface GeminiFunctionCall {
  id: string;
  name: string;
  args?: Record<string, any>;
}

export interface ToolExecutionContext {
  callId: string;
  toolName: string;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

export interface ClientWsEvent {
  type: string;
  payload?: any;
  [key: string]: any;
}

export interface ToolExecutionResult {
  result?: Record<string, any>;
  error?: string;
  clientEvent?: ClientWsEvent;
  scheduling?: ToolScheduling;
}

export type PureToolHandler = (
  args: Record<string, any>,
  ctx: ToolExecutionContext
) => Promise<ToolExecutionResult> | ToolExecutionResult;

export interface LiveToolDefinition {
  name: string;
  handler: PureToolHandler;
  scheduling: ToolScheduling;
  isGatedOnTurn0?: boolean;
  turn0ErrorMessage?: string;
  dedupWindowMs?: number;
  dedupResponseResult?: Record<string, any>;
}

export interface ToolExecutorOptions {
  functionCalls: GeminiFunctionCall[];
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

const DEFAULT_TURN0_ERROR =
  'Кандидат еще не отвечал на вопрос. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку на этапе первого приветствия. Пожалуйста, поприветствуйте кандидата голосом, четко зачитайте вопрос и передайте слово.';

const SD_TURN0_ERROR =
  'Кандидат еще не защищал архитектуру. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выносить вердикт на этапе первого хода. Пожалуйста, поприветствуйте кандидата голосом, сформулируйте задачу и пригласите обсудить функциональные требования.';

const TOOL_DEFINITIONS: LiveToolDefinition[] = [
  {
    name: 'update_whiteboard',
    handler: handleUpdateWhiteboard,
    scheduling: 'WHEN_IDLE',
    dedupWindowMs: 3000,
    dedupResponseResult: {
      status: 'SUCCESS',
      message: 'Интерактивная доска уже обновлена.',
      directive:
        'Кратко (в 1-2 предложениях) поясни кандидату голосом показанный фрагмент. Не вызывай повторных инструментов.'
    }
  },
  {
    name: 'read_file',
    handler: handleReadFile,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'mark_bug_solved',
    handler: handleMarkBugSolved,
    scheduling: 'SILENT'
  },
  {
    name: 'report_identified_smell',
    handler: handleReportIdentifiedSmell,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'submit_interview_evaluation',
    handler: handleSubmitInterviewEvaluation,
    scheduling: 'WHEN_IDLE',
    isGatedOnTurn0: true,
    turn0ErrorMessage: DEFAULT_TURN0_ERROR
  },
  {
    name: 'inject_chaos_failure',
    handler: handleInjectChaosFailure,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'record_candidate_observation',
    handler: handleRecordCandidateObservation,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'submit_hiring_committee_verdict',
    handler: handleSubmitHiringCommitteeVerdict,
    scheduling: 'WHEN_IDLE',
    isGatedOnTurn0: true,
    turn0ErrorMessage: SD_TURN0_ERROR
  },
  {
    name: 'advance_hr_phase',
    handler: handleAdvanceHrPhase,
    scheduling: 'SILENT'
  },
  {
    name: 'emit_hr_round_evaluation',
    handler: handleEmitHrRoundEvaluation,
    scheduling: 'SILENT',
    isGatedOnTurn0: true,
    turn0ErrorMessage: DEFAULT_TURN0_ERROR
  },
  {
    name: 'submit_hr_evaluation',
    handler: handleSubmitHrEvaluation,
    scheduling: 'SILENT',
    isGatedOnTurn0: true,
    turn0ErrorMessage: DEFAULT_TURN0_ERROR
  }
];

export const LIVE_TOOL_REGISTRY: ReadonlyMap<string, LiveToolDefinition> = new Map(
  TOOL_DEFINITIONS.map((def) => [def.name, def])
);

export class LiveToolEngine {
  private static sendGeminiToolResponse(
    geminiSocket: WebSocket,
    callId: string,
    toolName: string,
    payload: { result?: Record<string, any>; error?: string },
    scheduling: ToolScheduling = 'WHEN_IDLE'
  ): void {
    if (geminiSocket.readyState !== WebSocket.OPEN) return;

    const responseBody = payload.error
      ? { error: payload.error }
      : { result: payload.result ?? { status: 'SUCCESS' } };

    geminiSocket.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              id: callId,
              name: toolName,
              response: responseBody,
              scheduling
            }
          ]
        }
      })
    );
  }

  private static sendClientEvent(clientSocket: WebSocket, event: ClientWsEvent): void {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify(event));
    }
  }

  public static async executeFunctionCalls(options: ToolExecutorOptions): Promise<void> {
    const { functionCalls, clientSocket, geminiSocket, session, parsedHints, liveCoaching } = options;

    session.isToolCallPending = true;
    session.lastActivityAt = Date.now();
    session.watchdogs?.disarmAll();
    if (session.nudgeWatchdog) {
      clearTimeout(session.nudgeWatchdog);
      session.nudgeWatchdog = null;
    }
    console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(functionCalls));

    if (session.toolCallSafetyTimeout) clearTimeout(session.toolCallSafetyTimeout);
    session.toolCallSafetyTimeout = setTimeout(() => {
      if (session.isToolCallPending) {
        console.warn('⚠️ Tool call safety timeout (10s) reached: releasing audio gate');
        session.isToolCallPending = false;
      }
    }, 10000);

    this.sendClientEvent(clientSocket, {
      type: 'tool_executing',
      tools: functionCalls.map((fc) => fc.name)
    });

    for (const call of functionCalls) {
      const definition = LIVE_TOOL_REGISTRY.get(call.name);

      if (!definition) {
        console.warn(`⚠️ Unhandled or unsupported tool call [${call.name}]. Emitting graceful negative toolResponse.`);
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          {
            result: {
              error: `Tool '${call.name}' is not supported in this session. Please explain verbally or use update_whiteboard.`
            }
          },
          'WHEN_IDLE'
        );
        continue;
      }

      // 1. Central Invariant 2.1: Turn 0 Tool Lockdown (Enforced via LiveSessionAggregate)
      const isBlockedByAggregate = session.aggregate?.canExecuteGradingTools
        ? !session.aggregate.canExecuteGradingTools().allowed
        : !session.hasCandidateResponded;
      if (definition.isGatedOnTurn0 && isBlockedByAggregate) {
        console.warn(`🛡️ [First-Turn Guard] Blocked premature ${call.name} before candidate spoke.`);
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          { error: definition.turn0ErrorMessage || DEFAULT_TURN0_ERROR },
          'WHEN_IDLE'
        );
        continue;
      }

      // 2. Central Declarative Deduplication Window
      if (definition.dedupWindowMs && definition.dedupWindowMs > 0) {
        const callKey = JSON.stringify(call.args || {});
        const now = Date.now();
        if (!session.toolDedupCache) session.toolDedupCache = {};
        const cached = session.toolDedupCache[call.name];
        const isDuplicate =
          (cached && cached.hash === callKey && now - cached.timestamp < definition.dedupWindowMs) ||
          (call.name === 'update_whiteboard' &&
            session.lastToolCallHash === callKey &&
            now - (session.lastToolCallTime || 0) < definition.dedupWindowMs);

        if (isDuplicate) {
          console.log(`🔄 Suppressing duplicate ${call.name} call within ${definition.dedupWindowMs}ms`);
          this.sendGeminiToolResponse(
            geminiSocket,
            call.id,
            call.name,
            { result: definition.dedupResponseResult || { status: 'SUCCESS', deduplicated: true } },
            definition.scheduling
          );
          continue;
        }

        session.toolDedupCache[call.name] = { hash: callKey, timestamp: now };
        session.lastToolCallHash = callKey;
        session.lastToolCallTime = now;
      }

      // 3. Execute Pure Domain Handler
      try {
        const outcome = await definition.handler(call.args || {}, {
          callId: call.id,
          toolName: call.name,
          session,
          parsedHints,
          liveCoaching
        });

        const scheduling = outcome.scheduling || definition.scheduling || 'WHEN_IDLE';
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          { result: outcome.result, error: outcome.error },
          scheduling
        );

        if (outcome.clientEvent) {
          this.sendClientEvent(clientSocket, outcome.clientEvent);
        }
      } catch (toolErr) {
        const errorMessage = toolErr instanceof Error ? toolErr.message : 'Internal error';
        console.error(`❌ Error executing tool ${call.name}:`, toolErr);
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          { result: { error: `Tool execution failed: ${errorMessage}` } },
          'WHEN_IDLE'
        );
      }
    }

    session.isToolCallPending = false;
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
    this.sendClientEvent(clientSocket, {
      type: 'tool_execution_complete',
      tools: functionCalls.map((fc) => fc.name)
    });
  }

  public static handleCancellation(session: ProxySession, ids: string[]): void {
    console.log('🚫 [TOOL_CALL_CANCELLED] Upstream Gemini cancelled tool calls:', ids);
    session.isToolCallPending = false;
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
  }
}
