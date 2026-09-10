import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import { handleLiveClientConnection } from './live/liveWsConnectionHandler';

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
import { handleLiveToolCall } from './live/liveToolDispatcher';

export {
  LiveTurn,
  LiveSessionMemory,
  liveSessionRegistry,
  getOrCreateSessionMemory,
  extractDefaultAnchors,
  buildSystemPrompt,
  getLiveToolDeclarations,
  handleLiveToolCall
};

dotenv.config();

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', async (clientSocket: WebSocket, req: http.IncomingMessage) => {
    try {
      await handleLiveClientConnection(clientSocket, req);
    } catch (err) {
      console.error('Unhandled error in Live WebSocket connection handler:', err);
      try {
        clientSocket.close(1011, 'Internal Server Error');
      } catch {}
    }
  });
}
