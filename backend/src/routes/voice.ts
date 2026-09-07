import { Router, Request, Response } from 'express';
import { getAuthUserId } from '../middleware/auth';
import { generateLiveKitVoiceToken } from '../services/livekitAuthService';

export const voiceRouter = Router();

// POST /api/voice/livekit-token - Generate WebRTC room token for low-latency voice dialogue
voiceRouter.post('/livekit-token', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req) || 'candidate_user';
    const params = {
      ...req.body,
      userId
    };

    const tokenResponse = await generateLiveKitVoiceToken(params);
    res.json(tokenResponse);
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    res.status(500).json({ error: error.message || 'Failed to generate voice token' });
  }
});
