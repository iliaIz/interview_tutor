import dotenv from 'dotenv';
import { db } from './db';
import { envConfig } from '../config/env';
dotenv.config();

export interface SystemHealthStatus {
  status: 'ready' | 'warming_up' | 'unreachable';
  isAiReady: boolean;
  version: string;
  commitSha: string;
  timestamp: string;
  aiGateway: {
    url: string;
    status: 'ready' | 'connecting' | 'unreachable';
    latencyMs?: number;
    error?: string;
    models: {
      textModel: { name: string; ready: boolean };
      liveModel: { name: string; ready: boolean };
      liveThinkingModel?: { name: string; ready: boolean };
      ttsModel: { name: string; ready: boolean };
      embeddingModel: { name: string; ready: boolean };
      allReady: boolean;
      availableInProxy: string[];
    };
  };
  database: {
    ready: boolean;
    totalQuestions: number;
  };
}

let cachedHealth: SystemHealthStatus | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 2500; // 2.5 seconds cache to avoid overwhelming gateway on rapid polling

export async function checkSystemHealth(): Promise<SystemHealthStatus> {
  const now = Date.now();
  if (cachedHealth && (now - lastCheckTime < CACHE_TTL_MS)) {
    return cachedHealth;
  }

  // 1. Check Database
  let dbReady = false;
  let totalQuestions = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM questions').get() as { count: number };
    totalQuestions = row?.count || 0;
    dbReady = true;
  } catch (err) {
    console.error('Database health check failed:', err);
  }

  // 2. Check LiteLLM Gateway & Models
  const cleanProxyBase = envConfig.proxy.baseUrl;
  const proxyApiKey = envConfig.proxy.apiKey;

  const textModelName = envConfig.models.text;
  const liveModelName = envConfig.models.live;
  const livePreviewModelName = envConfig.models.livePreview;
  const liveThinkingModelName = envConfig.models.liveThinking;
  const ttsModelName = envConfig.models.tts;
  const embeddingModelName = envConfig.models.embedding;

  let aiStatus: 'ready' | 'connecting' | 'unreachable' = 'connecting';
  let latencyMs: number | undefined = undefined;
  let aiError: string | undefined = undefined;
  let availableInProxy: string[] = [];

  let textModelReady = false;
  let liveModelReady = false;
  let livePreviewModelReady = false;
  let liveThinkingModelReady = false;
  let ttsModelReady = false;
  let embeddingModelReady = false;

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    // Step 2a: Check Liveness
    const livenessRes = await fetch(`${cleanProxyBase}/health/liveness`, {
      signal: controller.signal
    });

    if (livenessRes.ok) {
      // Step 2b: Query available models from LiteLLM Proxy
      const modelsRes = await fetch(`${cleanProxyBase}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${proxyApiKey}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      latencyMs = Date.now() - start;

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        if (Array.isArray(modelsData?.data)) {
          availableInProxy = modelsData.data.map((m: any) => m.id);
        }

        // Verify models existence dynamically from envConfig / LiteLLM registry
        textModelReady = availableInProxy.includes(textModelName);
        liveModelReady = availableInProxy.includes(liveModelName) ||
                         envConfig.models.supportedLiveModels.some((m) => availableInProxy.includes(m)) ||
                         availableInProxy.includes('gemini-live');
        livePreviewModelReady = !livePreviewModelName ||
                                availableInProxy.includes(livePreviewModelName) ||
                                envConfig.models.supportedLiveModels.some((m) => availableInProxy.includes(m));
        liveThinkingModelReady = !liveThinkingModelName ||
                                 availableInProxy.includes(liveThinkingModelName) ||
                                 envConfig.models.supportedLiveModels.some((m) => m.includes('thinking') && availableInProxy.includes(m));
        ttsModelReady = availableInProxy.includes(ttsModelName);
        embeddingModelReady = availableInProxy.includes(embeddingModelName) ||
                              availableInProxy.includes('gemini-embedding') ||
                              availableInProxy.includes('text-embedding-3-small') ||
                              availableInProxy.includes('text-embedding-004');

        if (textModelReady && liveModelReady && livePreviewModelReady && ttsModelReady && embeddingModelReady) {
          aiStatus = 'ready';
        } else {
          aiStatus = 'connecting';
          const missing = [];
          if (!textModelReady) missing.push(`TEXT (${textModelName})`);
          if (!liveModelReady) missing.push(`LIVE (${liveModelName})`);
          if (!livePreviewModelReady && livePreviewModelName) missing.push(`LIVE_PREVIEW (${livePreviewModelName})`);
          if (!ttsModelReady) missing.push(`TTS (${ttsModelName})`);
          if (!embeddingModelReady) missing.push(`EMBEDDING (${embeddingModelName})`);
          aiError = `Не найдены модели в LiteLLM-Proxy: ${missing.join(', ')}`;
        }
      } else {
        aiStatus = 'connecting';
        aiError = `LiteLLM вернул HTTP ${modelsRes.status} на /v1/models`;
      }
    } else {
      clearTimeout(timeoutId);
      aiStatus = 'connecting';
      aiError = `LiteLLM liveness HTTP ${livenessRes.status}`;
    }
  } catch (err: any) {
    aiStatus = 'unreachable';
    aiError = err?.name === 'AbortError' 
      ? 'Таймаут соединения с LiteLLM Proxy' 
      : (err?.message || 'Не удалось связаться с LiteLLM Proxy');
  }

  const allModelsReady = textModelReady && liveModelReady && ttsModelReady && embeddingModelReady;
  const isAiReady = aiStatus === 'ready' && allModelsReady;
  const overallStatus = isAiReady ? 'ready' : (aiStatus === 'unreachable' ? 'unreachable' : 'warming_up');

  const rawSha = process.env.GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  const commitSha = rawSha ? rawSha.slice(0, 7) : 'dev';

  cachedHealth = {
    status: overallStatus,
    isAiReady,
    version: commitSha,
    commitSha,
    timestamp: new Date().toISOString(),
    aiGateway: {
      url: cleanProxyBase,
      status: aiStatus,
      latencyMs,
      error: aiError,
      models: {
        textModel: { name: textModelName, ready: textModelReady },
        liveModel: { name: liveModelName, ready: liveModelReady },
        liveThinkingModel: { name: liveThinkingModelName, ready: liveThinkingModelReady },
        ttsModel: { name: ttsModelName, ready: ttsModelReady },
        embeddingModel: { name: embeddingModelName, ready: embeddingModelReady },
        allReady: allModelsReady,
        availableInProxy
      }
    },
    database: {
      ready: dbReady,
      totalQuestions
    }
  };
  lastCheckTime = now;

  return cachedHealth;
}
