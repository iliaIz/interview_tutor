/**
 * liveVoiceUrlBuilder.ts
 * Builds the canonical WebSocket endpoint URL for Gemini Live voice sessions.
 * Cognitive bounding limit: <= 50 lines.
 */

import { VoiceEngineConfig } from './types';

export function buildLiveVoiceWebSocketUrl(cfg: VoiceEngineConfig): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined'
    ? (window.location.port === '8090' ? `${window.location.hostname}:8091` : window.location.host)
    : 'localhost:5000';

  const params = new URLSearchParams({
    sessionId: cfg.sessionId,
    questionId: cfg.questionId,
    sessionType: cfg.sessionType,
    topic: cfg.topic || '',
    questionText: cfg.questionText || '',
    referenceAnswer: cfg.referenceAnswer || '',
    voice: cfg.voice || 'Kore',
    turnMode: cfg.turnMode || 'auto',
    liveModel: cfg.liveModel || 'gemini-live-v3',
    vadPauseMs: String(cfg.vadPauseMs || 1800)
  });

  const optionalKeys = ['tutorMode', 'persona', 'targetGrade', 'strategy'] as const;
  for (const k of optionalKeys) {
    if (cfg[k]) params.set(k, String(cfg[k]));
  }

  return `${protocol}//${host}/ws/live?${params.toString()}`;
}
