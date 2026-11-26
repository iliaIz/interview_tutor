/**
 * LlmGatewayClient.ts
 * Unified backend outbound AI transport (Spec 49).
 * Consolidates text/JSON completions, pre-byte SSE streaming, TTS speech synthesis,
 * and embeddings over an injectable HttpTransportPort with host failover & Full-Jitter retries.
 */

import { envConfig } from '../config/env';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';

export type ReasoningPresetKey = keyof typeof REASONING_PRESETS;

export interface LlmExecutionOptions {
  systemPrompt?: string;
  userPrompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  presetKey?: ReasoningPresetKey;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  maxRetries?: number;
  extraBody?: Record<string, any>;
  responseFormat?: 'json_object' | 'text';
}

export type GatewayUnavailableReason =
  | 'rate_limit_exceeded'
  | 'proxy_unreachable'
  | 'upstream_timeout'
  | 'schema_parse_error';

export class LlmGatewayUnavailableError extends Error {
  public readonly category = 'transient';
  public readonly reason: GatewayUnavailableReason;
  public readonly retryAfterSeconds: number;
  public readonly userMessage: string;
  public readonly healthEndpoint = '/api/health';
  public readonly availableBankCount = 70;

  constructor(reason: GatewayUnavailableReason, technicalDetail?: string, retryAfterSeconds = 15) {
    let userMsg = 'ИИ-модель перегружена или шлюз временно недоступен. Мы автоматически восстанавливаем связь.';
    let retryAfter = retryAfterSeconds;

    if (reason === 'rate_limit_exceeded') {
      userMsg = 'Достигнут кратковременный лимит запросов к ИИ-модели (Rate Limit). Автоматический повтор через несколько секунд.';
      retryAfter = Math.max(6, retryAfterSeconds);
    } else if (reason === 'proxy_unreachable') {
      userMsg = 'Локальный шлюз LiteLLM временно недоступен (Docker контейнер перезапускается или обновляет сетевой маршрут).';
      retryAfter = Math.max(4, retryAfterSeconds);
    } else if (reason === 'upstream_timeout') {
      userMsg = 'Время ожидания ответа ИИ-модели превысило допустимый лимит (сетевой таймаут).';
      retryAfter = Math.max(5, retryAfterSeconds);
    } else if (reason === 'schema_parse_error') {
      userMsg = 'ИИ-модель вернула неполный ответ. Повторный запрос восстановит корректную генерацию.';
      retryAfter = Math.max(3, retryAfterSeconds);
    }

    super(technicalDetail || userMsg);
    this.name = 'LlmGatewayUnavailableError';
    this.reason = reason;
    this.userMessage = userMsg;
    this.retryAfterSeconds = retryAfter;
  }
}

export interface HttpTransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export interface HttpTransportPort {
  postJson(req: HttpTransportRequest): Promise<globalThis.Response>;
}

export const FetchTransportAdapter: HttpTransportPort = {
  postJson(req: HttpTransportRequest): Promise<globalThis.Response> {
    return globalThis.fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: req.body,
      signal: req.signal
    });
  }
};

const DEFAULT_RETRY_STATUSES = [429, 500, 502, 503, 504];

function createAbortError(): Error {
  const err = new Error('Request aborted by client');
  err.name = 'AbortError';
  return err;
}

export class LlmGatewayClient {
  private readonly transport: HttpTransportPort;

  constructor(transport: HttpTransportPort = FetchTransportAdapter) {
    this.transport = transport;
  }

  public async completeText(options: LlmExecutionOptions): Promise<string> {
    const res = await this.dispatchChat(options, false);
    const data: any = await res.json();
    return String(data?.choices?.[0]?.message?.content || '').trim();
  }

  public async completeJson<T = any>(options: LlmExecutionOptions): Promise<T> {
    const res = await this.dispatchChat({ ...options, responseFormat: 'json_object' }, false);
    const data: any = await res.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    return LlmGatewayClient.parseJsonWithRepair<T>(raw);
  }

  public async *streamChat(options: LlmExecutionOptions): AsyncIterable<string> {
    const res = await this.dispatchChat(options, true);
    const reader = res.body?.getReader();
    if (!reader) {
      throw new LlmGatewayUnavailableError('proxy_unreachable', 'No readable SSE stream body returned from proxy');
    }

    const decoder = new TextDecoder('utf-8');
    let lineBuffer = '';
    try {
      while (true) {
        if (options.abortSignal?.aborted) throw createAbortError();
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const delta = LlmGatewayClient.extractSseDelta(rawLine);
          if (delta) yield delta;
        }
      }
      const trailing = decoder.decode();
      const tailLines = (lineBuffer + trailing).split('\n');
      for (const rawLine of tailLines) {
        const delta = LlmGatewayClient.extractSseDelta(rawLine);
        if (delta) yield delta;
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
  }

  public async synthesizeSpeech(input: {
    text: string;
    voice: string;
    model?: string;
    responseFormat?: 'mp3' | 'pcm' | 'wav';
    speed?: number;
    timeoutMs?: number;
    maxRetries?: number;
    abortSignal?: AbortSignal;
  }): Promise<Buffer> {
    const payload: Record<string, any> = {
      model: input.model || envConfig.models.tts,
      input: input.text,
      voice: input.voice,
      response_format: input.responseFormat || 'wav'
    };
    if (typeof input.speed === 'number') payload.speed = input.speed;

    const res = await this.requestWithFailover(
      envConfig.proxy.speechUrl,
      JSON.stringify(payload),
      input.maxRetries ?? 3,
      input.timeoutMs ?? 45_000,
      input.abortSignal
    );
    return Buffer.from(await res.arrayBuffer());
  }

  public async embed(input: {
    input: string;
    model?: string;
    timeoutMs?: number;
    maxRetries?: number;
    abortSignal?: AbortSignal;
  }): Promise<Float32Array> {
    const res = await this.requestWithFailover(
      envConfig.proxy.embeddingsUrl,
      JSON.stringify({
        model: input.model || envConfig.models.embedding,
        input: input.input
      }),
      input.maxRetries ?? 0,
      input.timeoutMs ?? 4_000,
      input.abortSignal
    );
    const data: any = await res.json();
    const rawVector = data?.data?.[0]?.embedding;
    if (!Array.isArray(rawVector) || rawVector.length === 0) {
      throw new LlmGatewayUnavailableError('schema_parse_error', 'Embedding payload missing data[0].embedding vector');
    }
    return new Float32Array(rawVector);
  }

  private static extractSseDelta(rawLine: string): string {
    const trimmed = rawLine.trim();
    if (!trimmed || !trimmed.startsWith('data:')) return '';
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return '';
    try {
      const parsed = JSON.parse(data);
      return typeof parsed?.choices?.[0]?.delta?.content === 'string'
        ? parsed.choices[0].delta.content
        : '';
    } catch {
      return '';
    }
  }

  private async dispatchChat(options: LlmExecutionOptions, stream: boolean): Promise<globalThis.Response> {
    const messages = options.messages ? [...options.messages] : [];
    if (!options.messages) {
      if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
      if (options.userPrompt) messages.push({ role: 'user', content: options.userPrompt });
    }
    const preset = options.presetKey ? REASONING_PRESETS[options.presetKey] : undefined;
    const reasoningExtra = preset ? buildReasoningExtraBody(preset) : {};

    const payload: Record<string, any> = {
      model: options.model || envConfig.models.text,
      messages,
      temperature: options.temperature ?? preset?.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? preset?.maxTokens ?? 4096,
      ...reasoningExtra,
      ...(options.extraBody || {})
    };
    if (options.responseFormat === 'json_object') payload.response_format = { type: 'json_object' };
    if (stream) payload.stream = true;

    return this.requestWithFailover(
      envConfig.proxy.chatUrl,
      JSON.stringify(payload),
      options.maxRetries ?? 2,
      options.timeoutMs ?? 60_000,
      options.abortSignal
    );
  }

  private async requestWithFailover(
    endpointUrl: string,
    body: string,
    maxRetries: number,
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): Promise<globalThis.Response> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${envConfig.proxy.apiKey}`
    };

    try {
      return await this.executeRetries(endpointUrl, headers, body, maxRetries, timeoutMs, parentSignal);
    } catch (err: any) {
      if (parentSignal?.aborted || err?.name === 'AbortError' || err instanceof LlmGatewayUnavailableError) {
        throw err;
      }
      if (endpointUrl.includes('host.docker.internal')) {
        const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
        console.warn(`🔄 [LlmGatewayClient] Host unreachable, retrying via localhost: ${localUrl}`);
        return await this.executeRetries(localUrl, headers, body, maxRetries, timeoutMs, parentSignal);
      }
      if (err?.name === 'TimeoutError' || String(err?.message || '').toLowerCase().includes('timeout')) {
        throw new LlmGatewayUnavailableError('upstream_timeout', err?.message || String(err));
      }
      throw new LlmGatewayUnavailableError('proxy_unreachable', `LiteLLM Gateway connection failed: ${err?.message || err}`);
    }
  }

  private async executeRetries(
    url: string,
    headers: Record<string, string>,
    body: string,
    maxRetries: number,
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): Promise<globalThis.Response> {
    let lastHttpError: Error | null = null;
    let lastNetworkError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (parentSignal?.aborted) throw createAbortError();
      if (attempt > 0) {
        const delay = Math.floor(Math.random() * Math.min(2500, Math.floor(800 * Math.pow(1.8, attempt))));
        await new Promise((r) => setTimeout(r, delay));
        if (parentSignal?.aborted) throw createAbortError();
      }

      const timeoutSig = AbortSignal.timeout(timeoutMs);
      const signal = parentSignal ? AbortSignal.any([parentSignal, timeoutSig]) : timeoutSig;
      try {
        const res = await this.transport.postJson({ url, headers, body, signal });
        if (res.ok) return res;

        const errText = await res.text().catch(() => '');
        if (DEFAULT_RETRY_STATUSES.includes(res.status)) {
          lastHttpError = LlmGatewayClient.mapStatusError(res.status, errText);
          lastNetworkError = null;
          continue;
        }
        throw new Error(`LiteLLM Proxy HTTP ${res.status}: ${errText}`);
      } catch (err: any) {
        if (parentSignal?.aborted || err?.name === 'AbortError') throw createAbortError();
        if (err instanceof LlmGatewayUnavailableError || !err?.message) {
          throw err;
        }
        if (lastHttpError && err === lastHttpError) throw err;
        if (String(err.message).startsWith('LiteLLM Proxy HTTP')) throw err;
        lastNetworkError = err;
        lastHttpError = null;
      }
    }

    if (lastHttpError) throw lastHttpError;
    throw lastNetworkError instanceof Error ? lastNetworkError : new Error('Gateway transport request failed');
  }

  private static mapStatusError(status: number, errText: string): Error {
    if (status === 429) {
      return new LlmGatewayUnavailableError('rate_limit_exceeded', `Upstream rate limit exhausted (HTTP 429): ${errText}`, 30);
    }
    if (status === 502 || status === 503) {
      return new LlmGatewayUnavailableError('proxy_unreachable', `LiteLLM Gateway unavailable (HTTP ${status}): ${errText}`, 20);
    }
    if (status === 504) {
      return new LlmGatewayUnavailableError('upstream_timeout', `LiteLLM Gateway timeout (HTTP 504): ${errText}`, 10);
    }
    return new Error(`LiteLLM Proxy HTTP ${status}: ${errText}`);
  }

  public static parseJsonWithRepair<T = any>(raw: string): T {
    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {}
      }
      throw new LlmGatewayUnavailableError(
        'schema_parse_error',
        `Failed to parse valid JSON from LLM output: ${cleaned.slice(0, 100)}...`
      );
    }
  }
}

export const llmGateway = new LlmGatewayClient();
