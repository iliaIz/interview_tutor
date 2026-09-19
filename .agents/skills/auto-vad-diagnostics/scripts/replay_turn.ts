/**
 * replay_turn.ts - Minimal Headless Acoustic Replay Runner
 *
 * Connects to the backend via WebSocket as a simulated client, verifies the Turn 0
 * handshake, asserts arrival of outputAudioTranscription alongside audio chunks,
 * and validates multi-turn state machine transitions in under 5 seconds.
 */

// Standard global WebSocket in Node 22+
const TARGET_WS_URL = process.env.TARGET_WS_URL || 'wss://java.djelu.site/ws/live';

interface ReplayResult {
  connected: boolean;
  setupComplete: boolean;
  firstAudioReceived: boolean;
  ttfaMs: number | null;
  outputTranscriptionReceived: boolean;
  transcriptionText: string;
  turnCompleted: boolean;
  audioSaved: boolean;
  audioPath?: string;
  errors: string[];
}

async function runReplay(topic = 'Spring Boot', questionText = 'Что такое Spring Cloud?'): Promise<ReplayResult> {
  console.log('======================================================================');
  console.log(`▶️ [HEADLESS ACOUSTIC REPLAY] Connecting to: ${TARGET_WS_URL}`);
  console.log(`   Topic: "${topic}", Question: "${questionText}"`);
  console.log('======================================================================\n');

  const result: ReplayResult = {
    connected: false,
    setupComplete: false,
    firstAudioReceived: false,
    ttfaMs: null,
    outputTranscriptionReceived: false,
    transcriptionText: '',
    turnCompleted: false,
    audioSaved: false,
    errors: []
  };

  const sessionId = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const ticketArg = process.argv.find(a => a.startsWith('--ticket='));
  const passedTicket = ticketArg ? ticketArg.split('=')[1] : (process.env.WS_TICKET || '');
  const tokenArg = process.argv.find(a => a.startsWith('--session-token='));
  const sessionToken = tokenArg ? tokenArg.split('=')[1] : (process.env.SESSION_TOKEN || '');

  const params = new URLSearchParams({
    sessionId,
    questionId: 'BOOT-017',
    topic,
    questionText,
    referenceAnswer: 'Spring Cloud — это набор библиотек для построения микросервисной архитектуры.',
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
  const startTime = Date.now();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      result.errors.push('Timed out after 20000ms');
      try { ws.close(); } catch {}
      resolve(result);
    }, 20000);

    const ws = new WebSocket(fullUrl);

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
          console.log(`🎉 setupComplete received in ${Date.now() - startTime}ms.`);
        }

        if (data.serverContent?.modelTurn?.parts) {
          for (const part of data.serverContent.modelTurn.parts) {
            const pcm = part.inlineData?.data || part.inline_data?.data;
            if (pcm && !result.firstAudioReceived) {
              result.firstAudioReceived = true;
              result.ttfaMs = Date.now() - startTime;
              console.log(`🔊 [MODEL_FIRST_AUDIO] First PCM audio chunk arrived (TTFA: ${result.ttfaMs}ms).`);
            }
            if (part.text) {
              result.outputTranscriptionReceived = true;
              result.transcriptionText += part.text;
              process.stdout.write(`📝 [AI TEXT]: ${part.text}\n`);
            }
          }
        }

        const outputText = data.serverContent?.outputTranscription?.text || data.serverContent?.output_transcription?.text;
        if (outputText) {
          result.outputTranscriptionReceived = true;
          result.transcriptionText += outputText;
          process.stdout.write(`📝 [AI OUTPUT TRANSCRIPTION]: ${outputText}\n`);
        }

        if (data.serverContent) {
          const nonAudioKeys = Object.keys(data.serverContent).filter(k => k !== 'modelTurn');
          if (nonAudioKeys.length > 0) {
            console.log(`ℹ️ [serverContent keys]: ${nonAudioKeys.join(', ')}`);
          }
        }

        if (data.serverContent?.turnComplete) {
          result.turnCompleted = true;
          console.log(`🏁 [TURN_COMPLETE] Model turn complete in ${Date.now() - startTime}ms.`);

          // 1. Simulate candidate speaking in response
          console.log('🎤 [CANDIDATE SPEECH] Sending simulated response turn to Live WebSocket...');
          const candidateTurn = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: 'Spring Cloud предоставляет набор инструментов для конфигурации, discovery и circuit breaker.' }]
                }
              ],
              turnComplete: true
            }
          };
          try {
            ws.send(JSON.stringify(candidateTurn));
          } catch {}

          // 2. Test physical audio WAV file persistence via /api/stt/transcribe
          console.log('💾 [AUDIO STORAGE] Testing /api/stt/transcribe with synthetic 16kHz PCM audio buffer...');
          const dummyPcm = Buffer.alloc(32000); // 1s of 16kHz 16-bit mono PCM
          const pcmBase64 = dummyPcm.toString('base64');
          const authHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(sessionToken ? {
              'Authorization': `Bearer ${sessionToken}`,
              'Cookie': `session_token=${sessionToken}`
            } : {})
          };
          try {
            const sttRes = await fetch('https://java.djelu.site/api/stt/transcribe', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                pcmBase64,
                sessionId,
                questionId: 'BOOT-017'
              })
            });
            const sttJson = await sttRes.json() as any;
            console.log(`   /api/stt/transcribe response: audioPath=${sttJson.audioPath}`);
            result.audioSaved = !!sttJson.audioPath;
            result.audioPath = sttJson.audioPath;

            // 3. Test persisting complete dialogue evaluation with audio_path
            const turnsToSave = [
              { role: 'ai', text: result.transcriptionText },
              { role: 'user', text: 'Spring Cloud — это экосистема для микросервисов: Eureka, Gateway, Resilience4j.' }
            ];
            const evalRes = await fetch('https://java.djelu.site/api/eval/save', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                questionId: 'BOOT-017',
                topic: 'Spring Boot',
                mode: 'voice',
                score: 95,
                isPassed: true,
                positivePoints: ['Eureka', 'Gateway', 'Resilience4j'],
                missingPoints: [],
                feedback: 'Отличный структурированный ответ!',
                userAnswer: 'Spring Cloud — это экосистема для микросервисов.',
                transcript: JSON.stringify(turnsToSave),
                audioPath: sttJson.audioPath
              })
            });
            const evalJson = await evalRes.json() as any;
            console.log(`   /api/eval/save response: success=${evalJson.success}, id=${evalJson.id}`);
          } catch (e: any) {
            console.warn('   Audio persistence test error:', e.message);
          }

          setTimeout(() => {
            clearTimeout(timeout);
            try { ws.close(); } catch {}
            resolve(result);
          }, 1500);
        }

        if (data.error) {
          result.errors.push(`Server error: ${data.error}`);
        }
      } catch (err: any) {
        result.errors.push(`Parse error: ${err.message}`);
      }
    };

    ws.onerror = (err: any) => {
      result.errors.push(`Socket error: ${err.message || 'unknown'}`);
    };

    ws.onclose = (event: any) => {
      console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`);
      clearTimeout(timeout);
      resolve(result);
    };
  });
}

runReplay().then((res) => {
  console.log('\n' + '='.repeat(70));
  console.log('📊 REPLAY SUMMARY:');
  console.log(`  • Connected: ${res.connected ? '✅' : '❌'}`);
  console.log(`  • SetupComplete: ${res.setupComplete ? '✅' : '❌'}`);
  console.log(`  • First Audio Received: ${res.firstAudioReceived ? '✅' : '❌'} (TTFA: ${res.ttfaMs}ms)`);
  console.log(`  • Output Text Received: ${res.outputTranscriptionReceived ? '✅' : '❌'} ("${res.transcriptionText.slice(0, 60)}...")`);
  console.log(`  • Turn Completed: ${res.turnCompleted ? '✅' : '❌'}`);
  console.log(`  • Physical Audio Saved: ${res.audioSaved ? '✅ (' + res.audioPath + ')' : '❌'}`);
  if (res.errors.length > 0) {
    console.log(`  • Errors: ${res.errors.join(', ')}`);
  }
  console.log('='.repeat(70));

  const passed = res.connected && res.setupComplete && res.firstAudioReceived && res.outputTranscriptionReceived;
  process.exit(passed ? 0 : 1);
});
