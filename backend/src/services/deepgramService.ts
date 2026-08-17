import dotenv from 'dotenv';
dotenv.config();

export interface DeepgramTranscriptionResult {
  transcript: string;
  confidence: number;
  wordsCount: number;
  duration: number;
  words?: Array<{ word: string; start: number; end: number; confidence: number; punctuated_word?: string }>;
}

/**
 * Prepend standard 44-byte WAV header to 16-bit linear PCM buffer
 */
export function pcmToWav(pcmBuffer: Buffer, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Transcribes audio buffer using Deepgram Nova-3 model with Russian language optimization
 */
export async function transcribeWithDeepgram(
  audioBuffer: Buffer,
  sampleRate = 16000
): Promise<DeepgramTranscriptionResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ DEEPGRAM_API_KEY is not configured in .env. Skipping Deepgram transcription.');
    return { transcript: '', confidence: 0, wordsCount: 0, duration: 0 };
  }

  if (audioBuffer.length < 500) {
    return { transcript: '', confidence: 0, wordsCount: 0, duration: 0 };
  }

  const wavBuffer = pcmToWav(audioBuffer, sampleRate);
  const url = 'https://api.deepgram.com/v1/listen?model=nova-3&language=ru&smart_format=true&punctuate=true';

  try {
    console.log(`🎙️ Sending ${audioBuffer.length} bytes of PCM audio to Deepgram Nova-3 (Russian)...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: new Uint8Array(wavBuffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ Deepgram API error (${res.status}):`, errText);
      return { transcript: '', confidence: 0, wordsCount: 0, duration: 0 };
    }

    const data: any = await res.json();
    const channel = data.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    const transcript = (alternative?.transcript || '').trim();
    const confidence = alternative?.confidence || 0;
    const words = alternative?.words || [];
    const wordsCount = words.length || (transcript ? transcript.split(/\s+/).length : 0);
    const duration = data.metadata?.duration || (audioBuffer.length / 2 / sampleRate);

    console.log(`✅ Deepgram Nova-3 transcription completed: "${transcript.slice(0, 80)}${transcript.length > 80 ? '...' : ''}" (${wordsCount} words, confidence: ${confidence.toFixed(2)})`);

    return {
      transcript,
      confidence,
      wordsCount,
      duration,
      words
    };
  } catch (error: any) {
    console.error('❌ Error calling Deepgram STT:', error);
    return { transcript: '', confidence: 0, wordsCount: 0, duration: 0 };
  }
}
