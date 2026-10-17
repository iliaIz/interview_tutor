import { LiveToolCallContext } from './liveToolDispatcher';

/**
 * liveRefactoringToolDispatcher.ts
 * Dispatches real-time code smell identifications from Gemini Live to client UI.
 * Single responsibility: Refactoring smell tool handling and WebSocket event emission.
 * Cognitive bounding limit: <= 350 lines (Rule 8).
 */
export function handleRefactoringSmellToolCall(ctx: LiveToolCallContext): boolean {
  const { call, clientSocket, geminiSocket } = ctx;
  const { smellId, justification } = call.args || {};

  // 1. Notify candidate's UI in real time via client WebSocket
  if (clientSocket && clientSocket.readyState === 1 /* OPEN */) {
    clientSocket.send(
      JSON.stringify({
        type: 'smell_discovered',
        smellId: smellId || 'unknown_smell',
        justification: justification || '',
        timestamp: Date.now()
      })
    );
  }

  // 2. Acknowledge tool response to Gemini Live stream
  geminiSocket.send(
    JSON.stringify({
      toolResponse: {
        functionResponses: [
          {
            response: {
              output: {
                success: true,
                message: `Запах '${smellId}' успешно зафиксирован в скоркорде ревью. Продолжай сократическое интервью.`
              }
            },
            id: call.id
          }
        ]
      }
    })
  );

  return true;
}
