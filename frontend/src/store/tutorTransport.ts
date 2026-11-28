import type {
  TutorActiveContext,
  TutorChatMessage,
  TutorPersona,
  TutorVerifyDiagnosisResponse
} from '@interview-prep/shared/tutor';

/**
 * tutorTransport.ts
 * Injectable TutorTransportPort and HTTP adapter for AI Copilot (Spec 58 / Pillar 11).
 * Decouples SSE stream consumption and HTTP network calls from Zustand state.
 * File length limit: <= 350 lines (Rule 8).
 */

export interface TutorStreamChatRequest {
  persona: TutorPersona;
  assistanceLevel: number;
  messages: TutorChatMessage[];
  context?: TutorActiveContext;
  signal?: AbortSignal;
  onChunk: (delta: string) => void;
  onDone?: (meta: { leakDetected?: boolean; maxSimilarity?: number }) => void;
}

export interface TutorStreamChatResult {
  fullText: string;
  leakDetected: boolean;
  similarity: number;
}

export interface TutorHintResponse {
  hintTier: number;
  content: string;
  leakDetected?: boolean;
}

export interface TutorRuleGroundingResponse {
  ruleId: string;
  ruleName: string;
  content: string;
  leakDetected?: boolean;
}

export interface TutorTransportPort {
  streamChat(opts: TutorStreamChatRequest): Promise<TutorStreamChatResult | void>;
  fetchHint(
    context: TutorActiveContext,
    persona: TutorPersona,
    assistanceLevel: number,
    signal?: AbortSignal
  ): Promise<TutorHintResponse>;
  groundRule(
    ruleId: string,
    context: TutorActiveContext,
    persona: TutorPersona,
    assistanceLevel: number,
    signal?: AbortSignal
  ): Promise<TutorRuleGroundingResponse>;
  verifyBugDiagnosis?(
    diagnosis: string,
    context: TutorActiveContext,
    signal?: AbortSignal
  ): Promise<TutorVerifyDiagnosisResponse>;
}

export function formatTutorRequestBody(
  persona: TutorPersona,
  assistanceLevel: number,
  messages: TutorChatMessage[],
  context?: TutorActiveContext,
  stream: boolean = true
): Record<string, unknown> {
  return {
    ...(context || {}),
    persona,
    assistanceLevel,
    messages,
    stream
  };
}

async function readTutorErrorMessage(response: Response): Promise<string> {
  const errJson = await response.json().catch(() => ({ error: 'Сетевая ошибка' }));
  return (errJson && typeof errJson.error === 'string' && errJson.error) || `HTTP ${response.status}`;
}

export async function streamTutorChat(options: TutorStreamChatRequest): Promise<TutorStreamChatResult> {
  const { persona, assistanceLevel, messages, context, signal, onChunk, onDone } = options;
  const body = formatTutorRequestBody(persona, assistanceLevel, messages, context, true);

  const response = await fetch('/api/practice-tutor/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readTutorErrorMessage(response));
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Не удалось подключить поток данных');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let leakDetected = false;
  let similarity = 0;

  const processLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith('data:')) return;
    try {
      const data = JSON.parse(trimmed.slice(5).trim());
      if (data.error) {
        throw new Error(String(data.error));
      }
      if (data.delta) {
        fullText += data.delta;
        onChunk(fullText);
      }
      if (data.done) {
        leakDetected = Boolean(data.leakDetected);
        similarity = data.maxSimilarity || 0;
        onDone?.({ leakDetected, maxSimilarity: similarity });
      }
    } catch (err) {
      if (err instanceof SyntaxError) return;
      throw err;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      processLine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      processLine(line);
    }
  }

  return { fullText, leakDetected, similarity };
}

export async function fetchTutorHint(
  context: TutorActiveContext,
  persona: TutorPersona,
  assistanceLevel: number,
  signal?: AbortSignal
): Promise<TutorHintResponse> {
  const hintTier = context.hintTier ?? 1;
  const body = {
    ...formatTutorRequestBody(persona, assistanceLevel, [], context, false),
    hintTier
  };

  const response = await fetch('/api/practice-tutor/hint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readTutorErrorMessage(response));
  }

  const data = (await response.json()) as Partial<TutorHintResponse>;
  return {
    hintTier: data.hintTier ?? hintTier,
    content: data.content || '',
    leakDetected: data.leakDetected
  };
}

export async function fetchTutorRuleGrounding(
  ruleId: string,
  context: TutorActiveContext,
  persona: TutorPersona,
  assistanceLevel: number,
  signal?: AbortSignal
): Promise<TutorRuleGroundingResponse> {
  const body = {
    ...formatTutorRequestBody(persona, assistanceLevel, [], context, false),
    ruleId,
    activeCompassRuleId: ruleId
  };

  const response = await fetch('/api/practice-tutor/rule-grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readTutorErrorMessage(response));
  }

  const data = (await response.json()) as Partial<TutorRuleGroundingResponse>;
  return {
    ruleId: data.ruleId ?? ruleId,
    ruleName: data.ruleName ?? ruleId,
    content: data.content || '',
    leakDetected: data.leakDetected
  };
}

export async function verifyTutorBugDiagnosis(
  diagnosis: string,
  context: TutorActiveContext,
  signal?: AbortSignal
): Promise<TutorVerifyDiagnosisResponse> {
  const response = await fetch('/api/practice-tutor/verify-diagnosis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify({
      bugId: context.incidentMeta?.incidentId || context.entityId,
      diagnosis,
      context
    })
  });

  if (!response.ok) {
    throw new Error(await readTutorErrorMessage(response));
  }

  const data = (await response.json()) as Partial<TutorVerifyDiagnosisResponse>;
  const verdict =
    data.verdict === 'solved' || data.verdict === 'partial' || data.verdict === 'incorrect'
      ? data.verdict
      : data.isCorrect
        ? 'solved'
        : 'incorrect';
  return {
    verdict,
    isCorrect: Boolean(data.isCorrect ?? verdict === 'solved'),
    feedback: data.feedback || 'Проверка выполнена.',
    revealedExplanation: data.revealedExplanation,
    fsrsRecorded: Boolean(data.fsrsRecorded)
  };
}

export const httpTutorTransport: TutorTransportPort = {
  streamChat: streamTutorChat,
  fetchHint: fetchTutorHint,
  groundRule: fetchTutorRuleGrounding,
  verifyBugDiagnosis: verifyTutorBugDiagnosis
};
