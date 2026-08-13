import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (clientWs: WebSocket) => {
    console.log('🎙️ Browser connected to Live Audio WS Proxy');

    const apiKey = process.env.GEMINI_API_KEY;
    const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
    const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL;
    const liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-live-v3';

    if (!apiKey && !rawProxyUrl) {
      console.error('❌ Neither GEMINI_API_KEY nor LITELLM_PROXY_URL is configured');
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY and LiteLLM Proxy are missing on server' }));
      clientWs.close();
      return;
    }

    // Determine target WS URL
    let geminiWsUrl = '';
    if (rawProxyUrl) {
      const cleanProxyHost = rawProxyUrl
        .replace(/^https?:\/\//, '')
        .replace(/\/v1\/?$/, '')
        .replace(/\/$/, '');
      const wsProtocol = rawProxyUrl.startsWith('https') ? 'wss' : 'ws';
      geminiWsUrl = `${wsProtocol}://${cleanProxyHost}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${proxyApiKey}`;
      console.log(`🌐 Connecting via LiteLLM Proxy WS (${wsProtocol}://${cleanProxyHost}) using model [${liveModel}]...`);
    } else {
      geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      console.log(`⚡ Connecting directly to Gemini Live WS using model [${liveModel}]...`);
    }

    let geminiWs: WebSocket | null = new WebSocket(geminiWsUrl);

    geminiWs.on('open', () => {
      console.log(`✅ Connected to Gemini Multimodal Live API (Model: ${liveModel})`);

      const modelId = liveModel.startsWith('models/') ? liveModel : `models/${liveModel}`;

      // Send initial setup config
      const setupMessage = {
        setup: {
          model: modelId,
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
