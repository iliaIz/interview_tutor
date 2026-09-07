import { Router } from 'express';
import { transcribeWithDeepgram } from '../services/deepgramService';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// POST /api/stt/transcribe - Transcribe PCM audio buffer with Deepgram Nova-3 (Russian)
router.post('/transcribe', asyncHandler(async (req, res) => {
  let pcmBuffer: Buffer | null = null;

  if (Buffer.isBuffer(req.body)) {
    pcmBuffer = req.body;
  } else if (req.body?.audioBase64) {
    pcmBuffer = Buffer.from(req.body.audioBase64, 'base64');
  } else if (req.body?.pcmBase64) {
    pcmBuffer = Buffer.from(req.body.pcmBase64, 'base64');
  } else if (Array.isArray(req.body?.samples)) {
    // Float32 or Int16 array passed as JSON numbers
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
    throw new AppError('No audio data provided in request body', 400);
  }

  const sampleRate = parseInt(req.query.sampleRate as string, 10) || 16000;
  const result = await transcribeWithDeepgram(pcmBuffer, sampleRate);

  res.json({
    success: true,
    transcript: result.transcript,
    wordsCount: result.wordsCount,
    confidence: result.confidence,
    duration: result.duration,
    words: result.words
  });
}));

export default router;
