import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized Application Environment Configuration
 * Single Source of Truth for Models, Gateways, and Keys (August 2026 SOTA)
 */

const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');

export const envConfig = {
  proxy: {
    rawUrl: rawProxyUrl,
    baseUrl: cleanProxyBase,
    v1Url: `${cleanProxyBase}/v1`,
    speechUrl: `${cleanProxyBase}/v1/audio/speech`,
    chatUrl: `${cleanProxyBase}/v1/chat/completions`,
    embeddingsUrl: `${cleanProxyBase}/v1/embeddings`,
    modelsUrl: `${cleanProxyBase}/v1/models`,
    healthUrl: `${cleanProxyBase}/health/liveness`,
    apiKey: process.env.LITELLM_API_KEY || 'sk-1234'
  },
  models: {
    text: process.env.GEMINI_TEXT_MODEL || 'gemini-smart',
    fast: process.env.GEMINI_FAST_MODEL || 'gemini-fast',
    live: process.env.GEMINI_LIVE_MODEL || 'gemini-live-v3',
    livePreview: process.env.GEMINI_LIVE_PREVIEW_MODEL || 'gemini-live-v2',
    supportedLiveModels: [
      process.env.GEMINI_LIVE_MODEL || 'gemini-live-v3',
      process.env.GEMINI_LIVE_PREVIEW_MODEL || 'gemini-live-v2',
      'gemini-live-v2',
      'gemini-live-v3'
    ].filter(Boolean),
    tts: process.env.GEMINI_TTS_MODEL || 'gemini-tts-v3',
    embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding'
  },
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || ''
  },
  server: {
    backendPort: parseInt(process.env.BACKEND_PORT || '5000', 10),
    frontendPort: parseInt(process.env.FRONTEND_PORT || '8090', 10)
  }
} as const;

export type EnvConfig = typeof envConfig;
