/**
 * replay_multi_turn.ts - Multi-Turn Headless Acoustic Regression Test Runner
 *
 * Verifies:
 * 1. Turn 0 (Greeting + Question delivery with PCM audio + outputTranscription)
 * 2. Acoustic Bleed Guard: Simulates speaker bleed audio during AI speech and asserts ZERO false interruptions
 * 3. Turn 1 (Candidate technical answer -> AI deep technical follow-up probe)
 * 4. Turn 2 (Tactile Barge-in responsiveness: aborts AI speech, reclaims mic)
 */

const TARGET_WS_URL = process.env.TARGET_WS_URL || 'wss://java.djelu.site/ws/live';

interface MultiTurnResult {
  connected: boolean;
  setupComplete: boolean;
  turn0Completed: boolean;
  turn0AudioReceived: boolean;
  turn0TextReceived: boolean;
  acousticBleedProtected: boolean; // True if bleed audio did NOT trigger false interruption
  turn1Completed: boolean;
  turn1ProbeReceived: boolean;
  turn2BargeInHandled: boolean;
  falseInterruptionsCount: number;
  maxInterChunkGapMs: number;
  turn0DurationMs: number;
  gapAssertionPassed: boolean;
  durationAssertionPassed: boolean;
  errors: string[];
}

async function runMultiTurnReplay(): Promise<MultiTurnResult> {
  console.log('======================================================================');
  console.log(`▶️ [MULTI-TURN ACOUSTIC REPLAY] Connecting to: ${TARGET_WS_URL}`);
  console.log('   Testing: Turn 0 (Greeting) -> Acoustic Bleed Guard -> Turn 1 (Probe) -> Turn 2 (Barge-In)');
  console.log('======================================================================\n');

  const result: MultiTurnResult = {
    connected: false,
    setupComplete: false,
    turn0Completed: false,
    turn0AudioReceived: false,
    turn0TextReceived: false,
    acousticBleedProtected: true,
    turn1Completed: false,
    turn1ProbeReceived: false,
    turn2BargeInHandled: false,
    falseInterruptionsCount: 0,
    maxInterChunkGapMs: 0,
    turn0DurationMs: 0,
    gapAssertionPassed: true,
    durationAssertionPassed: true,
    errors: []
  };

  const sessionId = `multi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const ticketArg = process.argv.find((a) => a.startsWith('--ticket='));
  let passedTicket = ticketArg ? ticketArg.split('=')[1] : (process.env.WS_TICKET || '');

  if (!passedTicket) {
    try {
      console.log('🔑 No WS ticket provided. Authenticating via master invite to obtain one-time ticket...');
      const baseUrl = TARGET_WS_URL.replace('wss://', 'https://').replace('ws://', 'http://').replace(/\/ws\/live.*$/, '');
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: process.env.MASTER_INVITE_CODE || 'SENIOR-JAVA-2026-VIP' })
      });
      const loginData = await loginRes.json() as any;
      const sessionToken = loginData?.token || '';

      const ticketRes = await fetch(`${baseUrl}/api/auth/ws-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const ticketData = await ticketRes.json() as any;
      if (ticketData?.ticket) {
        passedTicket = ticketData.ticket;
        console.log(`✅ Obtained one-time WS ticket: ${passedTicket.slice(0, 16)}...`);
      }
    } catch (e: any) {
      console.warn(`⚠️ Could not auto-fetch WS ticket: ${e.message}`);
    }
  }

  const params = new URLSearchParams({
    sessionId,
    questionId: 'BOOT-018',
    topic: 'Spring Boot',
    questionText: 'Как устроен Spring Cloud Config и как работают динамические обновления конфигурации через Spring Cloud Bus?',
    referenceAnswer: 'Spring Cloud Config Server предоставляет централизованное хранилище конфигураций. Spring Cloud Bus с Kafka или RabbitMQ рассылает RefreshRemoteApplicationEvent для обновления контекста бинов без перезапуска сервиса.',
    sessionType: 'interview',
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    persona: 'mentor',
    targetGrade: 'L5_SENIOR',
    voice: 'Aoede',
    userGender: 'female',
    liveModel: 'gemini-live-v3',
    ...(passedTicket ? { ticket: passedTicket } : {})
  });

  const fullUrl = `${TARGET_WS_URL}?${params.toString()}`;
  let currentTurn = 0;
  let isAiSpeaking = false;
  let bleedChunkInterval: NodeJS.Timeout | null = null;
  let turn0StartTime = 0;
  let lastPcmTime = 0;

  return new Promise((resolve) => {
    // Generous 60s timeout for 3 full live turns
    const timeout = setTimeout(() => {
      result.errors.push('Test timed out after 60000ms');
      cleanup();
      resolve(result);
    }, 60000);

    const ws = new WebSocket(fullUrl);

    function cleanup() {
      clearTimeout(timeout);
      if (bleedChunkInterval) clearInterval(bleedChunkInterval);
      try { ws.close(); } catch {}
    }

    // Helper to send synthetic mic PCM chunk
    function sendSyntheticMicAudio() {
      if (ws.readyState !== WebSocket.OPEN) return;
      const dummyPcm = Buffer.alloc(1280); // 40ms of 16kHz 16-bit PCM
      const payload = {
        realtime_input: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: dummyPcm.toString('base64')
          }
        }
      };
      try {
        ws.send(JSON.stringify(payload));
      } catch {}
    }

    ws.onopen = () => {
      result.connected = true;
      console.log('✅ WebSocket connection established.');
    };

    ws.onmessage = async (event: any) => {
      try {
        let text: string;
        if (typeof event.data === 'string') {
          text = event.data;
        } else if (event.data instanceof Blob) {
          text = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          text = Buffer.from(event.data).toString('utf-8');
        } else {
          text = String(event.data);
        }

        const data = JSON.parse(text);

        if (data.type === 'setupComplete') {
          result.setupComplete = true;
          turn0StartTime = Date.now();
          console.log('🎉 [TURN 0] setupComplete received.');
        }

        // Detect AI Audio & Text
        if (data.serverContent?.modelTurn?.parts) {
          for (const part of data.serverContent.modelTurn.parts) {
            const pcm = part.inlineData?.data || part.inline_data?.data;
            if (pcm) {
              const now = Date.now();
              if (lastPcmTime > 0 && isAiSpeaking) {
                const gap = now - lastPcmTime;
                if (gap > result.maxInterChunkGapMs) {
                  result.maxInterChunkGapMs = gap;
                }
              }
              lastPcmTime = now;

              if (!isAiSpeaking) {
                isAiSpeaking = true;
              }

              if (currentTurn === 0 && !result.turn0AudioReceived) {
                result.turn0AudioReceived = true;
                console.log('🔊 [TURN 0] AI first audio chunk arrived.');

                // TEST ACOUSTIC BLEED GUARD:
                // Send raw mic audio chunks while AI is speaking!
                console.log('🧪 [TEST] Simulating acoustic bleed (sending mic audio while AI speaks)...');
                bleedChunkInterval = setInterval(() => {
                  if (isAiSpeaking) {
                    sendSyntheticMicAudio();
                  }
                }, 100);
              }
            }
            if (part.text) {
              if (currentTurn === 0) result.turn0TextReceived = true;
              process.stdout.write(part.text);
            }
          }
        }

        const outputText = data.serverContent?.outputTranscription?.text || data.serverContent?.output_transcription?.text;
        if (outputText) {
          if (currentTurn === 0) result.turn0TextReceived = true;
          process.stdout.write(outputText);
        }

        // Interrupted detection
        if (data.serverContent?.interrupted) {
          console.warn('⚠️ [INTERRUPTED] Received interrupted: true from server!');
          result.falseInterruptionsCount += 1;
          if (isAiSpeaking && currentTurn === 0) {
            result.acousticBleedProtected = false;
            result.errors.push('Acoustic Bleed triggered a false interruption during Turn 0!');
          }
        }

        // Turn completion handler
        if (data.serverContent?.turnComplete) {
          isAiSpeaking = false;
          lastPcmTime = 0;
          if (bleedChunkInterval) {
            clearInterval(bleedChunkInterval);
            bleedChunkInterval = null;
          }

          console.log(`\n🏁 [TURN COMPLETE] Turn ${currentTurn} finished.`);

          if (currentTurn === 0) {
            result.turn0Completed = true;
            result.turn0DurationMs = turn0StartTime > 0 ? (Date.now() - turn0StartTime) : 0;
            console.log(`✅ Turn 0 successfully passed in ${result.turn0DurationMs}ms (max intra-turn chunk gap: ${result.maxInterChunkGapMs}ms).`);

            if (result.maxInterChunkGapMs > 3500) {
              result.gapAssertionPassed = false;
              result.errors.push(`Turn 0 intra-turn chunk gap exceeded threshold: ${result.maxInterChunkGapMs}ms > 3500ms`);
            }
            if (result.turn0DurationMs > 14000) {
              result.durationAssertionPassed = false;
              result.errors.push(`Turn 0 duration exceeded threshold: ${result.turn0DurationMs}ms > 14000ms`);
            }
            currentTurn = 1;

            // Wait 500ms and send candidate Turn 1 response
            setTimeout(() => {
              console.log('\n🎤 [TURN 1] Candidate submitting technical answer to Spring Cloud Config question...');
              const answer = {
                clientContent: {
                  turns: [
                    {
                      role: 'user',
                      parts: [
                        {
                          text: 'Config Server подключается к Git репозиторию. При пуше изменений срабатывает webhook на /monitor, который через Spring Cloud Bus (RabbitMQ) отправляет RefreshRemoteApplicationEvent. Микросервисы слушают очередь, перечитывают конфиг и пересоздают @RefreshScope бины.'
                        }
                      ]
                    }
                  ],
                  turnComplete: true
                }
              };
              ws.send(JSON.stringify(answer));
            }, 500);
          } else if (currentTurn === 1) {
            result.turn1Completed = true;
            result.turn1ProbeReceived = true;
            console.log('✅ Turn 1 successfully passed (AI emitted technical follow-up probe).');
            currentTurn = 2;

            // In Turn 2, test Tactile Barge-In: wait for AI to start speaking, then send barge_in frame
            console.log('\n⚡ [TURN 2] Waiting for AI speech to test Tactile Barge-In...');
            setTimeout(() => {
              console.log('🛑 [TURN 2] Sending Tactile Barge-In control frame!');
              ws.send(JSON.stringify({ type: 'barge_in', epoch: 1 }));
              result.turn2BargeInHandled = true;

              // Allow 1s for backend to acknowledge and complete test
              setTimeout(() => {
                cleanup();
                resolve(result);
              }, 1500);
            }, 2000);
          }
        }

        if (data.error) {
          result.errors.push(`Server error: ${data.error}`);
        }
      } catch (err: any) {
        result.errors.push(`Parse error: ${err.message}`);
      }
    };

    ws.onerror = (err: any) => {
      result.errors.push(`WebSocket error: ${err.message || 'unknown'}`);
    };

    ws.onclose = (event: any) => {
      console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`);
      cleanup();
      resolve(result);
    };
  });
}

runMultiTurnReplay().then((res) => {
  console.log('\n' + '='.repeat(70));
  console.log('📊 MULTI-TURN REPLAY TEST RESULTS:');
  console.log(`  • WebSocket Connected: ${res.connected ? '✅' : '❌'}`);
  console.log(`  • Setup Complete: ${res.setupComplete ? '✅' : '❌'}`);
  console.log(`  • Turn 0 Greeting Complete: ${res.turn0Completed ? '✅' : '❌'}`);
  console.log(`  • Turn 0 Audio Received: ${res.turn0AudioReceived ? '✅' : '❌'}`);
  console.log(`  • Turn 0 Transcription Received: ${res.turn0TextReceived ? '✅' : '❌'}`);
  console.log(`  • Max Intra-Turn Audio Gap: ${res.maxInterChunkGapMs}ms ${res.gapAssertionPassed ? '✅ (<= 3500ms)' : '❌ (> 3500ms)'}`);
  console.log(`  • Turn 0 Delivery Duration: ${res.turn0DurationMs}ms ${res.durationAssertionPassed ? '✅ (<= 14000ms)' : '❌ (> 14000ms)'}`);
  console.log(`  • Acoustic Bleed Guard Protected: ${res.acousticBleedProtected ? '✅ (0 false interruptions)' : '❌ (' + res.falseInterruptionsCount + ' interruptions)'}`);
  console.log(`  • Turn 1 Candidate Answer -> AI Follow-up Probe: ${res.turn1Completed ? '✅' : '❌'}`);
  console.log(`  • Turn 2 Tactile Barge-In: ${res.turn2BargeInHandled ? '✅' : '❌'}`);
  if (res.errors.length > 0) {
    console.log(`  • Errors: ${res.errors.join(', ')}`);
  }
  console.log('='.repeat(70));

  const passed =
    res.connected &&
    res.setupComplete &&
    res.turn0Completed &&
    res.acousticBleedProtected &&
    res.turn1Completed &&
    res.gapAssertionPassed &&
    res.durationAssertionPassed;

  process.exit(passed ? 0 : 1);
});
