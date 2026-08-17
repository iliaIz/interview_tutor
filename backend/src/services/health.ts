import dotenv from 'dotenv';
import { db } from './db';
dotenv.config();

export interface SystemHealthStatus {
  status: 'ready' | 'warming_up' | 'unreachable';
  isAiReady: boolean;
  timestamp: string;
  aiGateway: {
    url: string;
    status: 'ready' | 'connecting' | 'unreachable';
    latencyMs?: number;
    error?: string;
    models: {
      textModel: { name: string; ready: boolean };
      liveModel: { name: string; ready: boolean };
      ttsModel: { name: string; ready: boolean };
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
  const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
  const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';

  const textModelName = process.env.GEMINI_TEXT_MODEL || 'gemini-smart';
  const liveModelName = process.env.GEMINI_LIVE_MODEL || 'gemini-live';
  const ttsModelName = process.env.GEMINI_TTS_MODEL || 'gemini-tts-v3';

  let aiStatus: 'ready' | 'connecting' | 'unreachable' = 'connecting';
  let latencyMs: number | undefined = undefined;
  let aiError: string | undefined = undefined;
  let availableInProxy: string[] = [];

  let textModelReady = false;
  let liveModelReady = false;
  let ttsModelReady = false;

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

        // Verify models existence
        textModelReady = availableInProxy.includes(textModelName);
        liveModelReady = availableInProxy.includes(liveModelName) || 
                         availableInProxy.includes('gemini-tts-live-v3') ||
                         availableInProxy.includes('gemini-live');
        ttsModelReady = availableInProxy.includes(ttsModelName) ||
                        availableInProxy.includes('gemini-tts-v3');

        if (textModelReady && liveModelReady && ttsModelReady) {
          aiStatus = 'ready';
        } else {
          aiStatus = 'connecting';
          const missing = [];
          if (!textModelReady) missing.push(`TEXT (${textModelName})`);
          if (!liveModelReady) missing.push(`LIVE (${liveModelName})`);
          if (!ttsModelReady) missing.push(`TTS (${ttsModelName})`);
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

  const allModelsReady = textModelReady && liveModelReady && ttsModelReady;
  const isAiReady = aiStatus === 'ready' && allModelsReady;
  const overallStatus = (dbReady && isAiReady) ? 'ready' : (dbReady && aiStatus === 'connecting') ? 'warming_up' : 'unreachable';

  cachedHealth = {
    status: overallStatus,
    isAiReady,
    timestamp: new Date().toISOString(),
    aiGateway: {
      url: cleanProxyBase,
      status: aiStatus,
      latencyMs,
      error: aiError,
      models: {
        textModel: { name: textModelName, ready: textModelReady },
        liveModel: { name: liveModelName, ready: liveModelReady },
        ttsModel: { name: ttsModelName, ready: ttsModelReady },
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
