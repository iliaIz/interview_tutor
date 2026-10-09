#!/usr/bin/env node
/**
 * verify_clean_gemini_live.mjs
 * SOTA Late 2026 Clean Baseline Verification Script (Tracer Bullet).
 * Connects directly to LiteLLM Proxy / Gemini Live without application middleware.
 * Usage:
 *   node scripts/verify_clean_gemini_live.mjs [--url=ws://localhost:4000/ws/live] [--model=gemini-live-v3]
 */

import WebSocket from 'ws';

const WS_URL = process.env.LITELLM_LIVE_URL || 'ws://litellm-gateway:4000/ws/live?model=gemini-live-v3&token=sk-interview-training';
const LIVE_MODEL = 'gemini-live-v3';

console.log('═'.repeat(80));
console.log('   SOTA 2026 CLEAN BASELINE TRACER BULLET: GEMINI 3.8 LIVE');
console.log('═'.repeat(80));
console.log(`📡 Connecting to: ${WS_URL}`);

const ws = new WebSocket(WS_URL);

let sessionStartTime = Date.now();
let greetingAudioBytes = 0;
let replyAudioBytes = 0;
let currentPhase = 'CONNECTING';
let turnStartEpoch = 0;

function generateSpeechPcmChunk(sampleCount = 1600, freq = 440) {
  // 1600 samples = 100ms at 16kHz
  const buffer = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    // Generate soft sine wave mimicking voice formants
    const val = Math.sin((2 * Math.PI * freq * i) / 16000) * 0.4;
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(val * 32767)));
    buffer.writeInt16LE(int16, i * 2);
  }
  return buffer;
}

function generateSilencePcmChunk(sampleCount = 1600) {
  return Buffer.alloc(sampleCount * 2); // Digital zeroes
}

ws.on('open', () => {
  console.log('✅ WebSocket Connected. Sending minimal setup frame...');
  currentPhase = 'SETUP';

  const setupFrame = {
    setup: {
      model: `models/${LIVE_MODEL}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede'
            }
          }
        },
        temperature: 1.0
      },
      systemInstruction: {
        parts: [
          {
            text: 'Ты дружелюбный ИИ-собеседник. Отвечай кратко в 1-2 предложениях на русском языке исключительно голосом.'
          }
        ]
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          silenceDurationMs: 500,
          prefixPaddingMs: 200
        },
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
      }
    }
  };

  ws.send(JSON.stringify(setupFrame));
});

ws.on('message', async (data) => {
  const str = data.toString('utf8');
  let parsed = null;
  try {
    parsed = JSON.parse(str);
  } catch {
    return;
  }

  // 1. Setup Complete
  if (parsed.setupComplete) {
    console.log('🎉 SetupComplete received! Triggering Turn 0 Greeting via pure clientContent...');
    currentPhase = 'GREETING_REQUEST';

    const greetingRequest = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: 'Привет! Поприветствуй меня в одном коротком предложении.' }]
          }
        ],
        turnComplete: true
      }
    };
    turnStartEpoch = Date.now();
    ws.send(JSON.stringify(greetingRequest));
    return;
  }

  // 2. Audio Chunks from Model
  if (parsed.serverContent?.modelTurn?.parts) {
    for (const part of parsed.serverContent.modelTurn.parts) {
      if (part.inlineData?.data) {
        const bytes = Buffer.from(part.inlineData.data, 'base64').length;
        if (currentPhase === 'GREETING_REQUEST' || currentPhase === 'GREETING_PLAYING') {
          if (greetingAudioBytes === 0) {
            const ttfa = Date.now() - turnStartEpoch;
            console.log(`🔊 [GREETING_FIRST_AUDIO] TTFA: ${ttfa}ms`);
            currentPhase = 'GREETING_PLAYING';
          }
          greetingAudioBytes += bytes;
        } else if (currentPhase === 'AWAITING_CANDIDATE_REPLY') {
          if (replyAudioBytes === 0) {
            const ttfa = Date.now() - turnStartEpoch;
            console.log(`🔊 [REPLY_FIRST_AUDIO] TTFA: ${ttfa}ms (Native Cloud VAD successfully endpointed!)`);
          }
          replyAudioBytes += bytes;
        }
      }
      if (part.text) {
        console.log(`📝 Model Text: "${part.text.trim()}"`);
      }
    }
  }

  // 3. Turn Complete
  if (parsed.serverContent?.turnComplete) {
    if (currentPhase === 'GREETING_PLAYING') {
      console.log(`🏁 Greeting complete (${greetingAudioBytes} bytes).`);
      console.log('🎤 Beginning simulated Candidate Speech (streaming real PCM speech fixture)...');
      currentPhase = 'STREAMING_CANDIDATE_SPEECH';

      import('fs').then(async (fs) => {
        let pcmData = null;
        const candidates = [
          '/app/speech.pcm',
          'speech.pcm',
          'backend/tests/fixtures/audio/candidate_normal_answer_java_7500cef4eb0d.pcm'
        ];
        for (const p of candidates) {
          try {
            if (fs.existsSync(p)) {
              pcmData = fs.readFileSync(p);
              console.log(`📂 Loaded real speech fixture from ${p} (${(pcmData.length / 32000).toFixed(2)}s, ${pcmData.length} bytes)`);
              break;
            }
          } catch {}
        }

        if (pcmData) {
          // Stream real PCM speech in 100ms chunks (3200 bytes per chunk)
          const chunkSize = 3200;
          for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
            const chunk = pcmData.subarray(offset, Math.min(offset + chunkSize, pcmData.length));
            ws.send(JSON.stringify({
              realtimeInput: {
                audio: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: chunk.toString('base64')
                }
              }
            }));
            await new Promise((r) => setTimeout(r, 100));
          }
        } else {
          // Fallback if file not accessible
          const speechChunks = 30;
          for (let i = 0; i < speechChunks; i++) {
            const pcm = generateSpeechPcmChunk(1600, 300 + (i % 5) * 40);
            ws.send(JSON.stringify({
              realtimeInput: {
                audio: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: pcm.toString('base64')
                }
              }
            }));
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        console.log('🤫 Candidate stopped speaking. Streaming continuous ambient silence (live mic emulation)...');
        turnStartEpoch = Date.now();
        currentPhase = 'AWAITING_CANDIDATE_REPLY';

        while (currentPhase === 'AWAITING_CANDIDATE_REPLY' && ws.readyState === WebSocket.OPEN) {
          const pcm = generateSilencePcmChunk(1600);
          ws.send(JSON.stringify({
            realtimeInput: {
              audio: {
                mimeType: 'audio/pcm;rate=16000',
                data: pcm.toString('base64')
              }
            }
          }));
          await new Promise((r) => setTimeout(r, 100));
        }
      });
    } else if (currentPhase === 'AWAITING_CANDIDATE_REPLY') {
      console.log(`🏁 Candidate reply turn completed (${replyAudioBytes} bytes)!`);
      console.log('═'.repeat(80));
      console.log('   VERDICT: ✅ CLEAN BASELINE VERIFICATION PASSED');
      console.log(`   • Greeting Audio: ${greetingAudioBytes} bytes`);
      console.log(`   • Reply Audio:    ${replyAudioBytes} bytes`);
      console.log(`   • Total Session:  ${((Date.now() - sessionStartTime) / 1000).toFixed(2)}s`);
      console.log('═'.repeat(80));
      ws.close(1000, 'Test Finished');
      process.exit(0);
    }
  }

  // 4. Error Handling
  if (parsed.error) {
    console.error('❌ Upstream Error Received:', parsed.error);
    ws.close(1000, 'Error received');
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket Connection Error:', err.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason ? reason.toString() : 'none'}`);
});
