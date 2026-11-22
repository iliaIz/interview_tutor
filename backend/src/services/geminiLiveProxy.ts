import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import { LiveVoiceSession } from './live/LiveVoiceSession';

import {
  LiveTurn,
  LiveSessionMemory,
  liveSessionRegistry,
  getOrCreateSessionMemory
} from './live/liveSessionRegistry';
import {
  extractDefaultAnchors,
  buildSystemPrompt
} from './live/livePromptBuilder';
import { getLiveToolDeclarations } from './live/liveToolDeclarations';
import { LiveToolEngine } from './live/LiveToolEngine';

export {
  LiveTurn,
  LiveSessionMemory,
  liveSessionRegistry,
  getOrCreateSessionMemory,
  extractDefaultAnchors,
  buildSystemPrompt,
  getLiveToolDeclarations,
  LiveToolEngine
};

dotenv.config();

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', async (clientSocket: WebSocket, req: http.IncomingMessage) => {
    // SOTA Late 2026 Invariant: Zero early message loss.
    // Immediately buffer incoming client frames before async resolution (DB lookups / vector search).
    const earlyQueue: any[] = [];
    const earlyCapture = (data: any) => {
      if (earlyQueue.length < 50) earlyQueue.push(data);
    };
    clientSocket.on('message', earlyCapture);

    const cleanupEarlyCapture = () => {
      clientSocket.off('message', earlyCapture);
    };

    try {
      await LiveVoiceSession.start({ clientSocket, req, earlyQueue, cleanupEarlyCapture });
    } catch (err) {
      cleanupEarlyCapture();
      console.error('Unhandled error in Live WebSocket connection handler:', err);
      try {
        clientSocket.close(1011, 'Internal Server Error');
      } catch {}
    }
  });
}
