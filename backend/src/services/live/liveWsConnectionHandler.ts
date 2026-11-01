import { WebSocket } from 'ws';
import http from 'http';
import { LiveVoiceSession } from './LiveVoiceSession';

/**
 * liveWsConnectionHandler.ts
 * Thin HTTP WebSocket connection adapter (SPEC-003).
 * Delegates full connection lifecycle to LiveVoiceSession aggregate.
 * SLA: <= 60 lines.
 */
export async function handleLiveClientConnection(
  clientSocket: WebSocket,
  req: http.IncomingMessage,
  earlyQueue?: any[],
  cleanupEarlyCapture?: () => void
): Promise<LiveVoiceSession | null> {
  return LiveVoiceSession.start({
    clientSocket,
    req,
    earlyQueue,
    cleanupEarlyCapture
  });
}
