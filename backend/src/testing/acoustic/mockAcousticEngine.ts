/**
 * mockAcousticEngine.ts
 *
 * SOTA September 2026 In-Process Mock Gemini Live & Auto-VAD Engine.
 * Spins up an ephemeral local WebSocket server that speaks the exact
 * Gemini Live multimodal protocol (greeting, model turns, inline PCM, turnComplete, interrupted)
 * allowing the entire Acoustic Matrix to execute 100% offline in 1-2 seconds.
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TurnTelemetryEvent } from '@interview-prep/shared';

export interface MockAcousticEngineInstance {
  port: number;
  close: () => Promise<void>;
}

function computeRms(buffer: Buffer): number {
  if (buffer.length < 2) return 0;
  let sumSq = 0;
  const numSamples = Math.floor(buffer.length / 2);
  for (let i = 0; i < numSamples; i++) {
    const s = buffer.readInt16LE(i * 2);
    sumSq += s * s;
  }
  return Math.sqrt(sumSq / numSamples);
}

export async function startMockAcousticEngine(): Promise<MockAcousticEngineInstance> {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  wss.on('connection', (ws, req) => {
    let turnIndex = 0;
    let isAiGenerating = false;
    let isGreetingPhase = true;
    let greetingInterval: NodeJS.Timeout | null = null;
    let greetingCompleteTimeout: NodeJS.Timeout | null = null;
    let thinkingDwellTimeout: NodeJS.Timeout | null = null;

    let speechFramesCount = 0;
    let silenceFramesCount = 0;
    let inSpeech = false;
    let turnCommitScheduled = false;

    const parsedUrl = new URL(req.url || '', 'http://localhost');
    const liveModel = parsedUrl.searchParams.get('liveModel') || '';
    const isThinking = liveModel.includes('thinking');
    const topic = parsedUrl.searchParams.get('topic') || '';
    const questionText = parsedUrl.searchParams.get('questionText') || '';

    // --- PHASE 1: Greeting Execution ---
    // Start greeting after 60ms
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      isAiGenerating = true;

      // Send initial greeting text and first audio slice
      const greetingChunkBase64 = Buffer.alloc(3840, 1).toString('base64'); // ~80ms 24kHz audio
      ws.send(JSON.stringify({
        serverContent: {
          modelTurn: {
            parts: [
              { text: 'Здравствуйте! Я ваш технический интервьюер. Расскажите подробно о теме.' },
              { inlineData: { mimeType: 'audio/pcm;rate=24000', data: greetingChunkBase64 } }
            ]
          }
        }
      }));

      // Stream ongoing audio slices every 120ms to allow barge-in testing
      let chunksSent = 1;
      greetingInterval = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN || !isGreetingPhase) {
          if (greetingInterval) clearInterval(greetingInterval);
          return;
        }
        chunksSent++;
        ws.send(JSON.stringify({
          serverContent: {
            modelTurn: {
              parts: [
                { inlineData: { mimeType: 'audio/pcm;rate=24000', data: greetingChunkBase64 } }
              ]
            }
          }
        }));
      }, 120);

      // Complete greeting at 1100ms if no barge-in interrupted it
      greetingCompleteTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN || !isGreetingPhase) return;
        if (greetingInterval) clearInterval(greetingInterval);
        isGreetingPhase = false;
        isAiGenerating = false;

        ws.send(JSON.stringify({
          serverContent: {
            turnComplete: true,
            interactionStatus: 'IDLE'
          }
        }));

        const greetingTelemetry: TurnTelemetryEvent = {
          turnId: `mock_turn_${Date.now()}_0`,
          sessionId: 'mock_sess',
          turnIndex: 0,
          speaker: 'model',
          vadPauseSettingMs: 1800,
          speechDurationMs: 0,
          ttfrMs: 30,
          ttftMs: 60,
          ttfaMs: 80,
          ttfpMs: 100,
          audioTextSkewMs: 20,
          audioDurationMs: 1100,
          textChars: 72,
          echoLeakageDroppedMs: 0,
          networkRttMs: 10,
          modelName: liveModel || 'gemini-live-mock',
          wasBargeIn: false,
          bargeInType: null,
          createdAt: Date.now()
        };

        ws.send(JSON.stringify({
          type: 'turn_telemetry',
          data: greetingTelemetry
        }));
      }, 1100);
    }, 60);

    // --- PHASE 2: Client Message Handling & Auto-VAD ---
    ws.on('message', (raw) => {
      try {
        const text = raw.toString();
        const parsed = JSON.parse(text);

        // Tactile interruption signal
        if (parsed.type === 'tactile_barge_in' || parsed.type === 'interrupt') {
          handleInterruption();
          return;
        }

        // Manual or client content turn complete
        if (parsed.clientContent?.turnComplete || parsed.turnComplete) {
          triggerModelResponseTurn();
          return;
        }

        // Realtime audio frames from client
        const mediaChunks = parsed.realtimeInput?.mediaChunks || parsed.realtime_input?.media_chunks || [];
        for (const chunk of mediaChunks) {
          if (!chunk.data) continue;
          const pcmBuf = Buffer.from(chunk.data, 'base64');
          const rms = computeRms(pcmBuf);

          // Active speech detection (speech threshold: RMS > 300)
          if (rms > 300) {
            speechFramesCount++;
            silenceFramesCount = 0;
            inSpeech = true;

            // Acoustic Barge-in: if candidate speaks while AI is generating / greeting / thinking
            if (isAiGenerating) {
              handleInterruption();
            }
          } else {
            // Silence / low energy floor (RMS <= 300)
            if (inSpeech) {
              silenceFramesCount++;

              // Auto-VAD Decision Boundary:
              // Reject micro-noise clicks (< 8 chunks = 320ms) or short breaths (< 12 chunks = 480ms)
              // Valid candidate turn requires at least 15 speech chunks (>= 600ms of voice).
              // Hesitation pause tolerance: 800ms silence = 20 chunks.
              // Silence commitment threshold = 28 chunks (~1120ms of silence).
              if (speechFramesCount >= 15 && silenceFramesCount >= 28 && !turnCommitScheduled) {
                turnCommitScheduled = true;
                inSpeech = false;
                triggerModelResponseTurn();
              }
            }
          }
        }
      } catch {}
    });

    function handleInterruption(): void {
      if (greetingInterval) {
        clearInterval(greetingInterval);
        greetingInterval = null;
      }
      if (greetingCompleteTimeout) {
        clearTimeout(greetingCompleteTimeout);
        greetingCompleteTimeout = null;
      }
      if (thinkingDwellTimeout) {
        clearTimeout(thinkingDwellTimeout);
        thinkingDwellTimeout = null;
      }

      isGreetingPhase = false;
      isAiGenerating = false;
      turnCommitScheduled = false;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          serverContent: { interrupted: true }
        }));
      }
    }

    function triggerModelResponseTurn(): void {
      if (ws.readyState !== WebSocket.OPEN) return;
      turnIndex++;
      isAiGenerating = true;

      const speechDurationMs = speechFramesCount * 40;
      speechFramesCount = 0;
      silenceFramesCount = 0;
      turnCommitScheduled = false;

      // Extended Thinking workflow
      if (isThinking) {
        // Step 1: Send CoT thought frames
        const thoughtParts = [
          'Analyzing @CacheEvict key generation and parameters. ',
          'Validating object hashing and SimpleKeyGenerator key parameters. ',
          'Causal check: key generation determines cache eviction target. ',
          'Ensuring epistemic neutrality and preventing false sycophantic agreement.'
        ];

        ws.send(JSON.stringify({
          serverContent: {
            modelTurn: {
              parts: [{ thought: thoughtParts.join('') }]
            }
          }
        }));

        // Thinking dwell window (allows Pre-Vocal Barge-In test to interrupt during reasoning)
        // If question is about Deadlocks, dwell for 800ms so pre-vocal speech can inject
        const dwellTime = questionText.includes('дедлок') || topic.includes('Deadlocks') ? 800 : 200;

        thinkingDwellTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN || !isAiGenerating) return;
          sendSpokenReply('thinking');
        }, dwellTime);

      } else {
        // Standard non-thinking model turn response (100ms processing delay)
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN || !isAiGenerating) return;
          sendSpokenReply('standard');
        }, 100);
      }

      function sendSpokenReply(mode: 'thinking' | 'standard'): void {
        const responsePcm = Buffer.alloc(9600, 1).toString('base64'); // 200ms audio
        const spokenText = mode === 'thinking'
          ? 'Аннотация @CacheEvict удаляет запись из кэша. Если ключ не задан явно, Spring использует SimpleKeyGenerator на основе параметров метода.'
          : 'Отличный ответ! Вы точно раскрыли архитектурные детали и механизмы инвалидации.';

        ws.send(JSON.stringify({
          serverContent: {
            modelTurn: {
              parts: [
                { text: spokenText },
                { inlineData: { mimeType: 'audio/pcm;rate=24000', data: responsePcm } }
              ]
            },
            turnComplete: true,
            interactionStatus: 'IDLE'
          }
        }));

        const turnEvent: TurnTelemetryEvent = {
          turnId: `mock_turn_${Date.now()}_${turnIndex}`,
          sessionId: 'mock_sess',
          turnIndex,
          speaker: 'model',
          vadPauseSettingMs: 1800,
          speechDurationMs,
          ttfrMs: mode === 'thinking' ? 80 : 0,
          ttftMs: mode === 'thinking' ? 240 : 120,
          ttfaMs: mode === 'thinking' ? 280 : 150,
          ttfpMs: mode === 'thinking' ? 320 : 180,
          audioTextSkewMs: mode === 'thinking' ? 40 : 30,
          audioDurationMs: 200,
          textChars: spokenText.length,
          echoLeakageDroppedMs: 0,
          networkRttMs: 12,
          modelName: liveModel || 'gemini-live-mock',
          wasBargeIn: false,
          bargeInType: null,
          createdAt: Date.now()
        };

        ws.send(JSON.stringify({
          type: 'turn_telemetry',
          data: turnEvent
        }));

        isAiGenerating = false;
      }
    }
  });

  return {
    port,
    close: async () => {
      wss.clients.forEach((c) => {
        try { c.terminate(); } catch {}
      });
      wss.close();
      (server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}
