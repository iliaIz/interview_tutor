import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { transcribeWithDeepgram } from '../services/deepgramService';
import { getAuthUserId } from '../middleware/auth';
import { questionEvaluationRepository } from '../services/evaluation/QuestionEvaluationRepository';

const router = Router();
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');

function encodePcmToWav(pcmBuffer: Buffer, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

// POST /api/stt/transcribe - Transcribe PCM audio buffer with Deepgram Nova-3 (Russian)
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    let pcmBuffer: Buffer | null = null;

    if (Buffer.isBuffer(req.body)) {
      pcmBuffer = req.body;
    } else if (req.body?.audioBase64) {
      pcmBuffer = Buffer.from(req.body.audioBase64, 'base64');
    } else if (req.body?.pcmBase64) {
      pcmBuffer = Buffer.from(req.body.pcmBase64, 'base64');
    } else if (Array.isArray(req.body?.samples)) {
      const int16Array = new Int16Array(req.body.samples.length);
      for (let i = 0; i < req.body.samples.length; i++) {
        const val = req.body.samples[i];
        int16Array[i] = typeof val === 'number' && Math.abs(val) <= 1.0
          ? (val < 0 ? val * 32768 : val * 32767)
          : val;
      }
      pcmBuffer = Buffer.from(int16Array.buffer);
    }

    if (!pcmBuffer || pcmBuffer.length === 0) {
      return res.status(400).json({ error: 'No audio data provided in request body' });
    }

    const sampleRate = parseInt(req.query.sampleRate as string, 10) || 16000;
    const sessionId = (req.body?.sessionId || req.query.sessionId || '').toString().replace(/[^a-zA-Z0-9_-]/g, '');
    const questionId = (req.body?.questionId || req.query.questionId || '').toString().replace(/[^a-zA-Z0-9_-]/g, '');

    // SOTA 2026 Invariant: Persist physical audio WAV file to storage volume
    let audioPath: string | null = null;
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }
      const wavBuffer = encodePcmToWav(pcmBuffer, sampleRate);
      const fileName = `session_${sessionId || 'anon'}_${questionId || 'turn'}_${Date.now()}.wav`;
      const fullPath = path.join(STORAGE_DIR, fileName);
      await fs.promises.writeFile(fullPath, wavBuffer);
      audioPath = fileName;
      console.log(`💾 Saved candidate audio recording to storage: ${fileName} (${wavBuffer.length} bytes)`);

      // Auto-link audio_path in question_evaluations scoped by authenticated user_id
      if (questionId) {
        try {
          const userId = getAuthUserId(req);
          questionEvaluationRepository.updateEvaluationAudioPath(questionId, userId, audioPath);
        } catch {}
      }
    } catch (saveErr) {
      console.warn('Could not persist audio WAV to storage volume:', saveErr);
    }

    const result = await transcribeWithDeepgram(pcmBuffer, sampleRate);

    res.json({
      success: true,
      transcript: result.transcript,
      wordsCount: result.wordsCount,
      confidence: result.confidence,
      duration: result.duration,
      words: result.words,
      audioPath
    });
  } catch (err: any) {
    console.error('Error in /api/stt/transcribe:', err);
    res.status(500).json({ error: err.message || 'Speech transcription failed' });
  }
});

export default router;
