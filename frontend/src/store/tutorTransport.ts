import { TutorActiveContext } from '@interview-prep/shared';
import { PracticeTutorContextPayload, TutorPersona, TutorMessage } from './usePracticeTutorStore';

/**
 * tutorTransport.ts
 * Dedicated streaming transport service for AI Copilot (Pillar 11).
 * Decouples SSE stream consumption and HTTP network calls from Zustand state.
 * File length limit: <= 350 lines (Rule 8).
 */

export type TutorContextInput = TutorActiveContext | PracticeTutorContextPayload;

export interface StreamChatOptions {
  persona: TutorPersona;
  assistanceLevel: number;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  context?: TutorContextInput;
  signal?: AbortSignal;
  onChunk: (delta: string) => void;
  onDone?: (meta: { leakDetected?: boolean; maxSimilarity?: number }) => void;
}

export function formatTutorRequestBody(
  persona: TutorPersona,
  assistanceLevel: number,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  context?: TutorContextInput
): Record<string, unknown> {
  const isPolymorphic = Boolean(context && 'arena' in context);

  if (isPolymorphic) {
    const poly = context as TutorActiveContext;
    return {
      persona,
      assistanceLevel,
      arena: poly.arena,
      entityId: poly.entityId,
      entityTitle: poly.entityTitle,
      domain: poly.domain,
      activeCodeOrQuery: poly.activeCodeOrQuery,
      activeFilePath: poly.activeFilePath,
      schemaOrDdl: poly.schemaOrDdl,
      instructions: poly.instructions,
      compilerError: poly.compilerError,
      runtimeError: poly.runtimeError,
      executionDiff: poly.executionDiff,
      companyContext: poly.companyContext,
      messages,
      stream: true
    };
  }

  return {
    persona,
    assistanceLevel,
    ...(context as PracticeTutorContextPayload || {}),
    messages,
    stream: true
  };
}

export async function streamTutorChat(options: StreamChatOptions): Promise<{
  fullText: string;
  leakDetected: boolean;
  similarity: number;
}> {
  const { persona, assistanceLevel, messages, context, signal, onChunk, onDone } = options;
  const body = formatTutorRequestBody(persona, assistanceLevel, messages, context);

  const response = await fetch('/api/practice-tutor/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({ error: 'Сетевая ошибка' }));
    throw new Error(errJson.error || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Не удалось подключить поток данных');

  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let leakDetected = false;
  let similarity = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      try {
        const data = JSON.parse(trimmed.slice(5).trim());
        if (data.delta) {
          fullText += data.delta;
          onChunk(fullText);
        }
        if (data.done) {
          leakDetected = Boolean(data.leakDetected);
          similarity = data.maxSimilarity || 0;
          onDone?.({ leakDetected, maxSimilarity: similarity });
        }
      } catch {
        // ignore JSON parse chunk errors
      }
    }
  }

  return { fullText, leakDetected, similarity };
}

export async function fetchTutorHint(
  hintTier: number,
  context?: TutorContextInput
): Promise<{ content: string; leakDetected?: boolean }> {
  const body = context && 'arena' in context
    ? { hintTier, ...formatTutorRequestBody('middle_scaffold', 2, [], context) }
    : { hintTier, ...(context || {}) };

  const response = await fetch('/api/practice-tutor/hint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({ error: 'Сетевая ошибка' }));
    throw new Error(errJson.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchTutorRuleGrounding(
  ruleId: string,
  context?: TutorContextInput
): Promise<{ content: string }> {
  const body = context && 'arena' in context
    ? { ruleId, ...formatTutorRequestBody('middle_scaffold', 2, [], context) }
    : { ruleId, ...(context || {}) };

  const response = await fetch('/api/practice-tutor/rule-grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({ error: 'Сетевая ошибка' }));
    throw new Error(errJson.error || `HTTP ${response.status}`);
  }

  return response.json();
}
