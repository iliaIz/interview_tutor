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

  // 2. Check LiteLLM Gateway
  const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000';
  const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const livenessUrl = `${cleanProxyBase}/health/liveness`;

  let aiStatus: 'ready' | 'connecting' | 'unreachable' = 'connecting';
  let latencyMs: number | undefined = undefined;
  let aiError: string | undefined = undefined;

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const res = await fetch(livenessUrl, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    latencyMs = Date.now() - start;

    if (res.ok) {
      aiStatus = 'ready';
    } else {
      aiStatus = 'connecting';
      aiError = `HTTP ${res.status} from Gateway`;
    }
  } catch (err: any) {
    aiStatus = 'unreachable';
    aiError = err?.name === 'AbortError' 
      ? 'Таймаут соединения (шлюз запускается...)' 
      : (err?.message || 'Не удалось связаться с AI шлюзом');
  }

  const isAiReady = aiStatus === 'ready';
  const overallStatus = (dbReady && isAiReady) ? 'ready' : (dbReady && aiStatus === 'connecting') ? 'warming_up' : 'unreachable';

  cachedHealth = {
    status: overallStatus,
    isAiReady,
    timestamp: new Date().toISOString(),
    aiGateway: {
      url: cleanProxyBase,
      status: aiStatus,
      latencyMs,
      error: aiError
    },
    database: {
      ready: dbReady,
      totalQuestions
    }
  };
  lastCheckTime = now;

  return cachedHealth;
}
