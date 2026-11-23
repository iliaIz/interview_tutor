/**
 * LlmExecutionEngine.ts
 * Unified LLM Client & Prompt Execution Engine (SOTA Late 2026).
 * Enforces Invariant 1 (LiteLLM Proxy Centralization) and Invariant 5 (Zero-Phantom Full-Jitter Retry).
 * Encapsulates Docker networking failover, markdown code fence stripping, and regex JSON repair.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { envConfig } from '../config/env';
import { fetchWithFullJitterRetry } from '../utils/httpRetry';
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

export class LlmExecutionEngine {
  /**
   * Dispatches text prompt to LiteLLM Proxy and returns raw text response.
   */
  public static async executeText(options: LlmExecutionOptions): Promise<string> {
    const rawContent = await this.dispatchChatCompletion(options);
    return rawContent.trim();
  }

  /**
   * Dispatches prompt and extracts typed JSON object with markdown stripping & regex repair.
   */
  public static async executeJson<T = any>(options: LlmExecutionOptions): Promise<T> {
    const opts: LlmExecutionOptions = {
      ...options,
      responseFormat: 'json_object'
    };

    const rawContent = await this.dispatchChatCompletion(opts);
    return this.parseJsonWithRepair<T>(rawContent);
  }

  /**
   * Internal dispatcher handling LiteLLM headers, Docker host failover, and Full-Jitter retry.
   */
  private static async dispatchChatCompletion(options: LlmExecutionOptions): Promise<string> {
    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = options.model || envConfig.models.text;
    const timeoutMs = options.timeoutMs ?? 60_000;
    const maxRetries = options.maxRetries ?? 2;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = options.messages
      ? [...options.messages]
      : [];
    if (!options.messages) {
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      if (options.userPrompt) {
        messages.push({ role: 'user', content: options.userPrompt });
      }
    }

    const preset = options.presetKey ? REASONING_PRESETS[options.presetKey] : undefined;
    const reasoningExtra = preset ? buildReasoningExtraBody(preset) : {};

    const payload: Record<string, any> = {
      model: modelName,
      messages,
      temperature: options.temperature ?? preset?.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? preset?.maxTokens ?? 4096,
      ...reasoningExtra,
      ...(options.extraBody || {})
    };

    if (options.responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${proxyApiKey}`
    };

    const executeFetch = async (targetUrl: string): Promise<globalThis.Response> => {
      return fetchWithFullJitterRetry(
        targetUrl,
        {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(payload)
        },
        maxRetries,
        options.abortSignal,
        timeoutMs,
        [429, 500, 502, 503, 504]
      );
    };

    let proxyRes: globalThis.Response;
    try {
      proxyRes = await executeFetch(endpointUrl);
    } catch (fetchErr: any) {
      if (options.abortSignal?.aborted) {
        throw fetchErr;
      }

      // Docker host failover: host.docker.internal -> localhost
      if (endpointUrl.includes('host.docker.internal')) {
        const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
        console.warn(`🔄 [LlmExecutionEngine] Host unreachable, retrying via localhost: ${localUrl}`);
        try {
          proxyRes = await executeFetch(localUrl);
        } catch (localErr: any) {
          throw new LlmGatewayUnavailableError(
            'proxy_unreachable',
            `LiteLLM Gateway connection failed (localhost failover exhausted): ${localErr?.message || localErr}`
          );
        }
      } else {
        throw new LlmGatewayUnavailableError(
          'proxy_unreachable',
          `LiteLLM Gateway connection failed: ${fetchErr?.message || fetchErr}`
        );
      }
    }

    if (!proxyRes.ok) {
      const errText = await proxyRes.text().catch(() => '');
      if (proxyRes.status === 429) {
        throw new LlmGatewayUnavailableError(
          'rate_limit_exceeded',
          `Upstream rate limit exhausted (HTTP 429): ${errText}`,
          30
        );
      }
      if (proxyRes.status === 503 || proxyRes.status === 502) {
        throw new LlmGatewayUnavailableError(
          'proxy_unreachable',
          `LiteLLM Gateway unavailable (HTTP ${proxyRes.status}): ${errText}`,
          20
        );
      }
      throw new Error(`LiteLLM Proxy HTTP ${proxyRes.status}: ${errText}`);
    }

    const data: any = await proxyRes.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Robust JSON extraction and repair with regex fallback.
   */
  public static parseJsonWithRepair<T = any>(raw: string): T {
    let cleaned = (raw || '').trim();

    // Strip markdown code fences
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch (initialErr) {
      // Regex extraction fallback for bracketed JSON object or array
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
