import crypto from 'crypto';
import type { Response } from 'express';
import { envConfig } from '../config/env';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
import { LlmGatewayUnavailableError } from './dynamicTaskGenerator';
import { buildBugChallengePrompts } from './bugChallengePromptBuilder';
import {
  GenerateBugChallengeParams,
  BugChallenge,
  generateBugChallenge,
  saveBugChallengeToDb,
  sanitizeJsonControlChars
} from './tutorService';

export interface BugStreamMeta {
  ttftMs: number | null;
  totalMs: number;
  reasoningChars: number;
}

const WATCHDOG_HEARTBEAT_MS = 12_000;
const WATCHDOG_CHECK_INTERVAL_MS = 2_000;
const HARD_STALL_TIMEOUT_MS = 60_000;

function writeSseEvent(res: Response, event: string, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function writeSsePing(res: Response): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`: ping\n\n`);
}

/**
 * Normalizes raw parsed object into a clean BugChallenge.
 */
function normalizeBugChallenge(parsed: any, meta: any): BugChallenge {
  const challengeId = `bug_${crypto.randomBytes(8).toString('hex')}`;
  return {
    id: challengeId,
    topicId: meta.topicId,
    topicName: meta.topicName,
    title: parsed.title || 'Поиск ошибки в коде',
    subtopic: parsed.subtopic || meta.topicName,
    language: parsed.language || 'java',
    codeSnippet: parsed.codeSnippet || '// Код недоступен',
    bugExplanation: parsed.bugExplanation || 'Неочевидная ошибка в логике работы компонента.',
    fixedCode: parsed.fixedCode || parsed.codeSnippet || '',
    hints: Array.isArray(parsed.hints) && parsed.hints.length > 0
      ? parsed.hints
      : ['Обратите внимание на взаимодействие потоков и синхронизацию.', 'Посмотрите на метод обновления состояния.'],
    categoryBadge: parsed.categoryBadge || '⚡ Concurrency',
    difficultyBadge: parsed.difficultyBadge || (meta.isSeniorMulti ? 'Senior' : 'Middle'),
    keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : undefined,
    techStack: parsed.techStack || {
      language: 'Java 21',
      javaVersion: 'Java 21 LTS',
      framework: 'Spring Boot 3.4.x',
      keyLibraries: ['Spring WebMVC', 'PostgreSQL 16', 'Hibernate 6.6']
    },
    productionContext: parsed.productionContext || undefined,
    sampledQuestionId: meta.sampledQuestionId,
    isTopicExhausted: false,
    remainingCount: meta.remainingCount,
    totalTopicQuestions: meta.totalTopicQuestions
  };
}

/**
 * Streams two-phase SSE bug challenge response.
 */
export async function streamBugChallengeToResponse(
  params: GenerateBugChallengeParams,
  res: Response,
  clientSignal?: AbortSignal
): Promise<void> {
  const startedAt = Date.now();
  let ttftMs: number | null = null;
  let lastChunkAt = Date.now();
  let lastPingAt = Date.now();
  let currentPhase: 'init' | 'thinking' | 'assembling' = 'init';
  let reasoningChars = 0;
  let jsonBuffer = '';

  const upstreamAbort = new AbortController();
  const onClientAbort = () => upstreamAbort.abort(new Error('Client disconnected'));
  clientSignal?.addEventListener('abort', onClientAbort, { once: true });

  const watchdogTimer = setInterval(() => {
    const now = Date.now();
    if (now - lastChunkAt >= HARD_STALL_TIMEOUT_MS) {
      upstreamAbort.abort(new Error('Upstream LLM stalled for over 60 seconds'));
      return;
    }
    if (now - lastChunkAt >= WATCHDOG_HEARTBEAT_MS && now - lastPingAt >= WATCHDOG_HEARTBEAT_MS) {
      lastPingAt = now;
      writeSsePing(res);
    }
  }, WATCHDOG_CHECK_INTERVAL_MS);

  try {
    const promptMeta = buildBugChallengePrompts(params);

    if (promptMeta.isExhausted) {
      const exhaustedChallenge: BugChallenge = {
        id: `exhausted_${Date.now()}`,
        title: 'Тема полностью пройдена!',
        subtopic: promptMeta.topicName,
        language: 'java',
        codeSnippet: '// Все разделы темы успешно отработаны на 100%!',
        bugExplanation: 'Вы закрыли все подразделы и вопросы данной темы без повторов.',
        fixedCode: '// 100% Topic Mastery Achieved',
        hints: ['Тема завершена.'],
        isTopicExhausted: true,
        totalTopicQuestions: promptMeta.totalTopicQuestions,
        remainingCount: 0
      };
      writeSseEvent(res, 'challenge_ready', {
        challenge: exhaustedChallenge,
        meta: { ttftMs: 0, totalMs: Date.now() - startedAt, reasoningChars: 0 }
      });
      writeSseEvent(res, 'done', { ok: true });
      return;
    }

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.text;

    writeSseEvent(res, 'phase_change', { phase: 'thinking', timestamp: Date.now() });
    currentPhase = 'thinking';

    const reasoningPayload = {
      model: modelName,
      messages: [
        { role: 'system', content: promptMeta.systemPrompt },
        { role: 'user', content: promptMeta.userPrompt }
      ],
      stream: true,
      response_format: { type: 'json_object' },
      temperature: REASONING_PRESETS.deepIncidentSynthesis.temperature,
      max_tokens: REASONING_PRESETS.deepIncidentSynthesis.maxTokens,
      extra_body: buildReasoningExtraBody(REASONING_PRESETS.deepIncidentSynthesis)
    };

    let upstreamRes = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyApiKey}`,
        'Request-Timeout': '90',
        'X-Request-Timeout': '90'
      },
      signal: upstreamAbort.signal,
      body: JSON.stringify(reasoningPayload)
    });

    if (!upstreamRes.ok && endpointUrl.includes('host.docker.internal')) {
      const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
      upstreamRes = await fetch(localUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proxyApiKey}`,
          'Request-Timeout': '90',
          'X-Request-Timeout': '90'
        },
        signal: upstreamAbort.signal,
        body: JSON.stringify(reasoningPayload)
      });
    }

    if (!upstreamRes.ok || !upstreamRes.body) {
      throw new Error(`Upstream Gateway HTTP ${upstreamRes.status}`);
    }

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let sseRemainder = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      lastChunkAt = Date.now();
      sseRemainder += decoder.decode(value, { stream: true });
      const lines = sseRemainder.split('\n');
      sseRemainder = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr || payloadStr === '[DONE]') continue;

        let parsedChunk: any;
        try {
          parsedChunk = JSON.parse(payloadStr);
        } catch {
          continue;
        }

        const delta = parsedChunk?.choices?.[0]?.delta;
        if (!delta) continue;

        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
          if (ttftMs === null) ttftMs = Date.now() - startedAt;
          reasoningChars += delta.reasoning_content.length;
          writeSseEvent(res, 'thought_delta', { delta: delta.reasoning_content });
        }

        if (typeof delta.content === 'string' && delta.content.length > 0) {
          if (ttftMs === null) ttftMs = Date.now() - startedAt;
          if (currentPhase !== 'assembling') {
            currentPhase = 'assembling';
            writeSseEvent(res, 'phase_change', { phase: 'assembling', timestamp: Date.now() });
          }
          jsonBuffer += delta.content;
        }
      }
    }

    if (!jsonBuffer.trim()) {
      throw new Error('Empty structured output from reasoning stream');
    }

    let cleaned = jsonBuffer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let parsedRaw: any;
    try {
      parsedRaw = JSON.parse(cleaned);
    } catch {
      parsedRaw = JSON.parse(sanitizeJsonControlChars(cleaned));
    }

    const challenge = normalizeBugChallenge(parsedRaw, promptMeta);
    saveBugChallengeToDb(challenge, promptMeta.topicId, promptMeta.topicName, promptMeta.preset, promptMeta.difficulty);

    writeSseEvent(res, 'challenge_ready', {
      challenge,
      meta: {
        ttftMs,
        totalMs: Date.now() - startedAt,
        reasoningChars
      }
    });
    writeSseEvent(res, 'done', { ok: true });
  } catch (err: any) {
    if (clientSignal?.aborted) return;
    console.error('Error in streamBugChallengeToResponse, attempting fallback:', err);

    try {
      if (currentPhase !== 'assembling') {
        writeSseEvent(res, 'phase_change', { phase: 'assembling', timestamp: Date.now() });
      }
      const fallbackChallenge = await generateBugChallenge(params);
      writeSseEvent(res, 'challenge_ready', {
        challenge: fallbackChallenge,
        meta: {
          ttftMs: ttftMs ?? Date.now() - startedAt,
          totalMs: Date.now() - startedAt,
          reasoningChars
        }
      });
      writeSseEvent(res, 'done', { ok: true });
    } catch (fallbackErr: any) {
      writeSseEvent(res, 'error', {
        error: fallbackErr?.userMessage || fallbackErr?.message || err?.message || 'Ошибка генерации кейса',
        isGatewayUnavailable: fallbackErr instanceof LlmGatewayUnavailableError || Boolean(fallbackErr?.reason),
        retryAfterSeconds: fallbackErr?.retryAfterSeconds || 5,
        reason: fallbackErr?.reason || 'stream_failed',
        availableBankCount: 70
      });
    }
  } finally {
    clearInterval(watchdogTimer);
    clientSignal?.removeEventListener('abort', onClientAbort);
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  }
}
