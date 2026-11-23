/**
 * liveWsClientFrameHandler.ts
 * Adapter attaching DownstreamClientPipe to client WebSocket.
 * Cognitive Bounding Limit: <= 100 lines (Rule 8 compliant).
 */

import { WebSocket, RawData } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { DownstreamClientPipe } from './DownstreamClientPipe';

export interface ClientFrameHandlerOptions {
  session: ProxySession;
  clientSocket: WebSocket;
  turnMode: 'manual' | 'auto';
  terminate: (source: string, code?: number, reason?: Buffer) => void;
  earlyQueue?: any[];
  cleanupEarlyCapture?: () => void;
}

export function attachLiveClientFrameHandler(options: ClientFrameHandlerOptions): void {
  const { session, clientSocket, turnMode, terminate, earlyQueue, cleanupEarlyCapture } = options;

  const pipe = new DownstreamClientPipe({
    session,
    clientSocket,
    turnMode,
    terminate
  });

  const handleIncomingFrame = (data: RawData) => {
    pipe.handleFrame(data);
  };

  if (cleanupEarlyCapture) cleanupEarlyCapture();
  clientSocket.on('message', handleIncomingFrame);

  if (Array.isArray(earlyQueue) && earlyQueue.length > 0) {
    for (const earlyData of earlyQueue) {
      handleIncomingFrame(earlyData);
    }
  }
}
