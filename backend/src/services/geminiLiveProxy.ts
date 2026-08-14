import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (clientWs: WebSocket) => {
    console.log('🎙️ Browser connected to Live Audio WS Proxy');

    const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
    const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
    const liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-tts-live-v3';

    const cleanProxyWs = rawProxyUrl.replace(/^http/, 'ws').replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}`;
    console.log(`⚡ Connecting to LiteLLM Gateway Live WS (${upstreamWsUrl})...`);

    let geminiWs: WebSocket | null = new WebSocket(upstreamWsUrl);

    geminiWs.on('open', () => {
      console.log(`✅ Connected to Upstream Live WebSocket (${liveModel})`);

      // Send initial setup config
      const setupMessage = {
        setup: {
          model: `models/${liveModel}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Kore'
                }
              }
            }
          },
          systemInstruction: {
            parts: [
              {
                text: 'Ты дружелюбный и компетентный русскоязычный технический интервьюер. Твоя задача — проводить устные собеседования на русском языке, зачитывать вопросы по Java, Spring, Hibernate и Docker, выслушивать ответы кандидата и давать короткий, полезный фидбек.'
              }
            ]
          }
        }
      };

      geminiWs?.send(JSON.stringify(setupMessage));
    });

    // Forward client messages to Gemini WS
    clientWs.on('message', (message: Buffer | string) => {
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(message);
      }
    });

    // Forward Gemini WS messages back to client
    geminiWs.on('message', (data: Buffer | string) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    geminiWs.on('error', (err) => {
      console.error('Gemini WS error:', err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: 'Gemini Live WS error: ' + err.message }));
      }
    });

    clientWs.on('close', () => {
      console.log('Client WS disconnected');
      if (geminiWs) {
        geminiWs.close();
        geminiWs = null;
      }
    });

    geminiWs.on('close', () => {
      console.log('Gemini Live WS connection closed');
    });
  });

  console.log('📡 Gemini Live WebSocket Proxy registered at /ws/live');
}
