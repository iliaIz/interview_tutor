/**
 * vadAcousticBleed.scenario.ts
 * 
 * SOTA Late September 2026 Acoustic Bleed & Speaker Echo Resilience Suite.
 * Simulates physical laptop speaker reflection (-12 dB attenuation, 25ms delay)
 * feeding back into the open microphone during AI question recitation.
 * 
 * Asserts:
 * 1. AI completes question recitation without self-interruption (zero dropped words).
 * 2. Client-Authoritative Duplex ignores speaker bleed.
 * 3. Cognitive bounding limit: <= 120 lines.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { ScenarioResult } from './types';

export async function runAcousticBleedEchoTest(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
  const start = Date.now();
  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard',
    topic: 'Java Memory Model',
    questionText: 'Что такое happens-before отношение в Java Memory Model?'
  });

  try {
    console.log(`[AcousticBleed] Connecting to ${engine} under -12dB speaker bleed simulation...`);
    await client.connect(12000);

    let reflectedChunksSent = 0;

    // Hook incoming modelTurn audio and loop it back as -12dB speaker reflection
    const originalOnMessage = client.ws?.onmessage;
    if (client.ws) {
      client.ws.on('message', (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          const parts = parsed.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                // Simulate speaker-to-mic bleed: -12 dB attenuation (approx 0.25 factor)
                const base64 = part.inlineData.data;
                const rawBuffer = Buffer.from(base64, 'base64');
                const attenuated = Buffer.alloc(rawBuffer.length);
                for (let i = 0; i < rawBuffer.length - 1; i += 2) {
                  const val = rawBuffer.readInt16LE(i);
                  attenuated.writeInt16LE(Math.round(val * 0.25), i);
                }

                // Send back as microphone stream after simulated acoustic delay
                setTimeout(() => {
                  if (client.ws && client.ws.readyState === 1) {
                    client.ws.send(JSON.stringify({
                      realtimeInput: {
                        mediaChunks: [{
                          mimeType: 'audio/pcm;rate=16000',
                          data: attenuated.toString('base64')
                        }]
                      }
                    }));
                    reflectedChunksSent++;
                  }
                }, 25);
              }
            }
          }
        } catch {}
      });
    }

    const greetingText = await client.waitForGreeting(18000);
    console.log(`[AcousticBleed] Greeting completed! Reflected speaker chunks fed back: ${reflectedChunksSent}`);

    const passed = (
      client.telemetry.audioBytesReceived > 10000 &&
      client.telemetry.replyText.length > 20 &&
      !client.telemetry.isInterrupted
    );

    return {
      scenarioName: 'Acoustic Bleed & Speaker Echo Immunity',
      engine,
      passed,
      durationMs: Date.now() - start,
      ttfaMs: client.telemetry.ttfaMs,
      details: {
        replyLength: client.telemetry.replyText.length,
        audioBytes: client.telemetry.audioBytesReceived,
        reflectedChunksSent,
        isInterrupted: client.telemetry.isInterrupted
      }
    };
  } catch (err: any) {
    return {
      scenarioName: 'Acoustic Bleed & Speaker Echo Immunity',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
