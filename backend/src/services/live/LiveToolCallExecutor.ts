import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { handleLiveToolCall } from './liveToolDispatcher';

export interface ToolExecutorOptions {
  functionCalls: any[];
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

/**
 * LiveToolCallExecutor (SOTA Late 2026).
 * Handles function calls execution, duplicate update_whiteboard suppression,
 * and graceful negative responses to prevent Gemini Bidi hangs.
 * Cognitive bounding limit: <= 350 lines.
 */
export class LiveToolCallExecutor {
  public static async executeFunctionCalls(options: ToolExecutorOptions): Promise<void> {
    const { functionCalls, clientSocket, geminiSocket, session, parsedHints, liveCoaching } = options;

    session.isToolCallPending = true;
    session.lastActivityAt = Date.now();
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

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'tool_executing',
        tools: functionCalls.map((fc: any) => fc.name)
      }));
    }

    for (const call of functionCalls) {
      if (call.name === 'update_whiteboard') {
        const callKey = JSON.stringify(call.args || {});
        const now = Date.now();
        if (session.lastToolCallHash === callKey && now - (session.lastToolCallTime || 0) < 3000) {
          console.log('🔄 Suppressing duplicate update_whiteboard call within 3s');
          if (geminiSocket.readyState === WebSocket.OPEN) {
            geminiSocket.send(JSON.stringify({
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    name: call.name,
                    response: {
                      result: {
                        status: 'SUCCESS',
                        message: 'Интерактивная доска уже обновлена.',
                        directive: 'Кратко (в 1-2 предложениях) поясни кандидату голосом показанный фрагмент. Не вызывай повторных инструментов.'
                      }
                    }
                  }
                ]
              }
            }));
          }
          continue;
        }
        session.lastToolCallHash = callKey;
        session.lastToolCallTime = now;
      }

      try {
        const isHandled = await handleLiveToolCall({
          call,
          clientSocket,
          geminiSocket,
          session,
          parsedHints,
          liveCoaching
        });

        if (!isHandled) {
          console.warn(`⚠️ Unhandled or unsupported tool call [${call.name}]. Emitting graceful negative toolResponse.`);
          if (geminiSocket.readyState === WebSocket.OPEN) {
            geminiSocket.send(JSON.stringify({
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    name: call.name,
                    response: {
                      result: {
                        error: `Tool '${call.name}' is not supported in this session. Please explain verbally or use update_whiteboard.`
                      }
                    }
                  }
                ]
              }
            }));
          }
        }
      } catch (toolErr) {
        const errorMessage = toolErr instanceof Error ? toolErr.message : 'Internal error';
        console.error(`❌ Error executing tool ${call.name}:`, toolErr);
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(JSON.stringify({
            toolResponse: {
              functionResponses: [
                {
                  id: call.id,
                  name: call.name,
                  response: {
                    result: {
                      error: `Tool execution failed: ${errorMessage}`
                    }
                  }
                }
              ]
            }
          }));
        }
      }
    }

    session.isToolCallPending = false;
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'tool_execution_complete',
        tools: functionCalls.map((fc: any) => fc.name)
      }));
    }
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
