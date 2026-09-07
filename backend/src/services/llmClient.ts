/**
 * llmClient.ts - Canonical LiteLLM Gateway Client
 * 
 * Strict Enforcement of Architectural Invariants:
 * - AGENTS.md Invariant 1: LiteLLM Proxy Invariant (all LLM & embeddings route strictly through LiteLLM Gateway).
 * - AGENTS.md Invariant 5: Zero-Phantom-Fallback & Full-Jitter Backoff:
 *   T = random(0, min(2500, 800 * 1.8^attempt)) up to 2 retries (3 total attempts).
 *   Generates per-attempt timeout signals and respects client parent cancellation signals.
 */

import { envConfig } from '../config/env';

export interface LiteLlmRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  endpointUrl?: string;
}

export interface LiteLlmChatResult {
  content: string;
  data: any;
  rawResponse: Response;
}

export class LlmGatewayError extends Error {
  public readonly status?: number;
  public readonly isTransient: boolean;

  constructor(message: string, status?: number, isTransient = false) {
    super(message);
    this.name = 'LlmGatewayError';
    this.status = status;
    this.isTransient = isTransient;
  }
}

/**
 * Calculates Full-Jitter Exponential Backoff delay:
 * T = random(0, min(2500, 800 * 1.8^attempt))
 */
export function calculateFullJitterDelay(attempt: number, capMs = 2500, baseMs = 800, factor = 1.8): number {
  const calculatedBackoff = Math.floor(baseMs * Math.pow(factor, attempt));
  const maxDelay = Math.min(capMs, calculatedBackoff);
  return Math.floor(Math.random() * maxDelay);
}

/**
 * Executes an HTTP fetch against LiteLLM Gateway with SOTA Full-Jitter Exponential Backoff retry.
 * Handles transient status codes (429, 500, 502, 503, 504) and network dropouts.
 */
export async function fetchWithFullJitterRetry(
  url: string,
  options: RequestInit,
  retryOpts: LiteLlmRequestOptions = {}
): Promise<Response> {
  const maxRetries = retryOpts.maxRetries ?? 2;
  const timeoutMs = retryOpts.timeoutMs ?? 45_000;
  const parentSignal = retryOpts.signal;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (parentSignal?.aborted) {
      throw new LlmGatewayError('Request aborted by client', undefined, false);
    }

    if (attempt > 0) {
      const delay = calculateFullJitterDelay(attempt);
      console.log(`⏱️ [LiteLLM] Retry attempt ${attempt}/${maxRetries} after ${delay}ms jitter delay...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (parentSignal?.aborted) {
        throw new LlmGatewayError('Request aborted by client', undefined, false);
      }
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = parentSignal
      ? AbortSignal.any([parentSignal, timeoutSignal])
      : timeoutSignal;

    const perAttemptOptions: RequestInit = {
      ...options,
      signal: combinedSignal
    };

    try {
      const res = await fetch(url, perAttemptOptions);

      if (res.ok) {
        return res;
      }

      // Transient rate limits or upstream server errors
      if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
        const errTxt = await res.text().catch(() => '');
        lastError = new LlmGatewayError(`LiteLLM transient error (${res.status}): ${errTxt}`, res.status, true);
        console.warn(`[LiteLLM Transient ${res.status}] Attempt ${attempt}/${maxRetries}:`, errTxt.slice(0, 150));
        continue;
      }

      // Non-transient client error (e.g. 400 Bad Request, 401 Unauthorized) -> do not retry
      const errTxt = await res.text().catch(() => '');
      throw new LlmGatewayError(`LiteLLM HTTP error (${res.status}): ${errTxt}`, res.status, false);
    } catch (err: any) {
      if (parentSignal?.aborted) {
        throw new LlmGatewayError('Request aborted by client', undefined, false);
      }
      if (err instanceof LlmGatewayError && !err.isTransient) {
        throw err;
      }
      lastError = err;
      console.warn(`[LiteLLM Network Error] Attempt ${attempt}/${maxRetries}:`, err?.message || err);
    }
  }

  throw (lastError instanceof Error
    ? lastError
    : new LlmGatewayError(`LiteLLM request failed after ${maxRetries} retries`, 503, true));
}

/**
 * Canonical helper for calling LiteLLM Chat Completions endpoint.
 * Automatically injects endpoint, Bearer authentication token, and standard headers.
 */
export async function callLiteLlmChat(
  payload: Record<string, any>,
  options: LiteLlmRequestOptions = {}
): Promise<LiteLlmChatResult> {
  const url = options.endpointUrl || envConfig.proxy.chatUrl;
  const apiKey = envConfig.proxy.apiKey;

  const fullPayload = {
    model: envConfig.models.text,
    ...payload
  };

  const response = await fetchWithFullJitterRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(fullPayload)
    },
    options
  );

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    data,
    rawResponse: response
  };
}

/**
 * Canonical helper for streaming or raw chat responses (e.g., SSE practice tutor).
 */
export async function callLiteLlmChatRaw(
  payload: Record<string, any>,
  options: LiteLlmRequestOptions = {}
): Promise<Response> {
  const url = options.endpointUrl || envConfig.proxy.chatUrl;
  const apiKey = envConfig.proxy.apiKey;

  const fullPayload = {
    model: envConfig.models.text,
    ...payload
  };

  return await fetchWithFullJitterRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(fullPayload)
    },
    options
  );
}

/**
 * Generates vector embedding via LiteLLM Proxy using configured GEMINI_EMBEDDING_MODEL.
 * Invariant 5: If LiteLLM is unavailable after retries, returns null. NEVER fabricates fake sinusoids.
 */
export async function callLiteLlmEmbedding(
  text: string,
  options: LiteLlmRequestOptions = {}
): Promise<Float32Array | null> {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const url = options.endpointUrl || envConfig.proxy.embeddingsUrl;
  const apiKey = envConfig.proxy.apiKey;
  const model = envConfig.models.embedding;

  try {
    const res = await fetchWithFullJitterRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: normalized
        })
      },
      {
        timeoutMs: options.timeoutMs ?? 10_000,
        maxRetries: options.maxRetries ?? 2,
        signal: options.signal
      }
    );

    const data = await res.json();
    const rawVector = data?.data?.[0]?.embedding;
    if (Array.isArray(rawVector) && rawVector.length > 0) {
      return new Float32Array(rawVector);
    }
    return null;
  } catch (err: any) {
    console.warn(`[LiteLLM Embeddings] Failed to generate embedding for model ${model}:`, err.message);
    return null;
  }
}

/**
 * Universal, battle-tested LLM JSON cleaner and parser.
 * Handles Markdown fences (```json ... ```, ``` ... ```), leading/trailing explanations,
 * and substring extraction for JSON objects/arrays.
 */
export function parseJsonFromLlm<T = any>(raw: string, fallback?: T): T {
  if (!raw || !raw.trim()) {
    if (fallback !== undefined) return fallback;
    throw new Error('Cannot parse empty LLM output as JSON');
  }

  const trimmed = raw.trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue to cleaners
  }

  // 2. Strip standard markdown code fences: ```json ... ``` or ``` ... ```
  let cleaned = trimmed
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue to regex substring extraction
  }

  // 3. Extract outermost { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate) as T;
    } catch {
      // Continue
    }
  }

  // 4. Extract outermost [ ... ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const candidate = cleaned.slice(firstBracket, lastBracket + 1);
      return JSON.parse(candidate) as T;
    } catch {
      // Continue
    }
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Failed to parse LLM response into JSON: ${trimmed.slice(0, 120)}...`);
}
