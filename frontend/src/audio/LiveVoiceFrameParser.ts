/**
 * LiveVoiceFrameParser.ts — SOTA Late-2026 Discriminated Protocol Frame Parser (Spec 53 / <= 250L).
 * Emits 4 tagged slices (control, domainEvents, modelTurn, toolLifecycle) & domain dispatcher.
 */

import { VoiceEngineCallbacks, VoiceEvaluationResult } from './types';

export type LiveControlFrameKind =
  | 'ping' | 'setupComplete' | 'tool_executing' | 'tool_execution_complete'
  | 'thinking_delay' | 'dead_air_recovery' | 'upstream_reconnecting'
  | 'hot_handoff_started' | 'hot_handoff_complete' | 'tool_awaiting_speech'
  | 'stream_recovery' | 'stream_stall_detected' | 'sync_pong' | 'upstream_error';

export type LiveDomainFrameKind =
  | 'evaluation_completed' | 'evaluation' | 'whiteboard_update' | 'chaos_injected'
  | 'hiring_committee_verdict' | 'bug_solved' | 'candidate_observation_recorded'
  | 'candidate_observation' | 'smell_discovered' | 'tool_call'
  | 'hr_phase_transition' | 'hr_scorecard_ready' | 'hr_user_transcript_delta' | 'hr_step_state';

export type LiveFrameType = LiveControlFrameKind | LiveDomainFrameKind | 'model_turn' | 'unknown';

export interface SyncPongPayload { isUpstreamConnected?: boolean; isUpstreamReconnecting?: boolean; isHandoffActive?: boolean; }
export interface UpstreamErrorPayload { error: string; errorCode?: string; retryable: boolean; }

export type LiveControlSignal =
  | { kind: 'ping'; timestamp?: number }
  | { kind: 'setup_complete'; reconnected: boolean; silent: boolean }
  | { kind: 'tool_lifecycle'; phase: 'executing' | 'complete' }
  | { kind: 'thinking_delay' }
  | { kind: 'dead_air_recovery'; reason?: string }
  | { kind: 'upstream_reconnecting'; attempt?: number; maxAttempts?: number; mode?: string }
  | { kind: 'hot_handoff'; state: 'started' | 'complete' }
  | { kind: 'tool_awaiting_speech' }
  | { kind: 'stream_recovery' }
  | { kind: 'sync_pong'; payload: SyncPongPayload }
  | { kind: 'upstream_error'; payload: UpstreamErrorPayload };

export type LiveDomainEvent =
  | { kind: 'evaluation'; payload: VoiceEvaluationResult }
  | { kind: 'whiteboard_update'; payload: unknown }
  | { kind: 'chaos_injected'; payload: unknown }
  | { kind: 'hiring_committee_verdict'; payload: unknown }
  | { kind: 'bug_solved'; payload: unknown }
  | { kind: 'candidate_observation'; payload: unknown }
  | { kind: 'smell_discovered'; payload: unknown }
  | { kind: 'tool_call'; payload: unknown }
  | { kind: 'hr_phase_transition'; payload: unknown }
  | { kind: 'hr_scorecard_ready'; payload: unknown }
  | { kind: 'hr_transcript_delta'; text: string }
  | { kind: 'hr_step_state'; payload: unknown };

export interface LiveModelTurnSlice {
  hasModelTurn: boolean;
  hasAudio: boolean;
  audioChunks: string[];
  hasText: boolean;
  textDeltas: string[];
  isTurnDone: boolean;
  interactionStatus?: string;
  isInterrupted: boolean;
  voiceActivity?: 'ACTIVITY_START' | 'ACTIVITY_END';
}

export interface ParsedLiveFrameResult {
  readonly kind: LiveFrameType;
  readonly control?: LiveControlSignal;
  readonly domainEvents: LiveDomainEvent[];
  readonly toolLifecycle?: 'executing' | 'complete';
  readonly modelTurn?: LiveModelTurnSlice;
}

interface RawServerFrame {
  type?: string;
  timestamp?: unknown;
  reconnected?: unknown;
  silent?: unknown;
  reason?: unknown;
  setupComplete?: unknown;
  evaluation?: VoiceEvaluationResult;
  payload?: unknown;
  scorecard?: unknown;
  delta?: string;
  text?: string;
  attempt?: number;
  maxAttempts?: number;
  mode?: string;
  isUpstreamConnected?: boolean;
  isUpstreamReconnecting?: boolean;
  isHandoffActive?: boolean;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  serverContent?: {
    modelTurn?: { parts?: Array<{ thought?: boolean; isThought?: boolean; text?: unknown; inlineData?: { data?: string }; inline_data?: { data?: string } }> };
    outputTranscription?: { text?: unknown };
    output_transcription?: { text?: unknown };
    turnComplete?: boolean;
    generationComplete?: boolean;
    interactionStatus?: string;
    interrupted?: boolean;
    voiceActivity?: 'ACTIVITY_START' | 'ACTIVITY_END';
  };
}

const KNOWN_FRAME_TYPES = new Set<string>([
  'ping', 'setupComplete', 'tool_executing', 'tool_execution_complete', 'thinking_delay',
  'dead_air_recovery', 'upstream_reconnecting', 'hot_handoff_started', 'hot_handoff_complete',
  'tool_awaiting_speech', 'stream_recovery', 'stream_stall_detected', 'sync_pong', 'upstream_error',
  'evaluation_completed', 'evaluation', 'whiteboard_update', 'chaos_injected',
  'hiring_committee_verdict', 'bug_solved', 'candidate_observation_recorded',
  'candidate_observation', 'smell_discovered', 'tool_call', 'hr_phase_transition',
  'hr_scorecard_ready', 'hr_user_transcript_delta', 'hr_step_state'
]);

const CONTROL_BUILDERS: Record<string, (d: RawServerFrame) => LiveControlSignal> = {
  ping: (d) => ({ kind: 'ping', timestamp: typeof d.timestamp === 'number' ? d.timestamp : undefined }),
  tool_executing: () => ({ kind: 'tool_lifecycle', phase: 'executing' }),
  tool_execution_complete: () => ({ kind: 'tool_lifecycle', phase: 'complete' }),
  thinking_delay: () => ({ kind: 'thinking_delay' }),
  dead_air_recovery: (d) => ({ kind: 'dead_air_recovery', reason: typeof d.reason === 'string' ? d.reason : undefined }),
  upstream_reconnecting: (d) => ({ kind: 'upstream_reconnecting', attempt: d.attempt, maxAttempts: d.maxAttempts, mode: d.mode }),
  hot_handoff_started: () => ({ kind: 'hot_handoff', state: 'started' }),
  hot_handoff_complete: () => ({ kind: 'hot_handoff', state: 'complete' }),
  tool_awaiting_speech: () => ({ kind: 'tool_awaiting_speech' }),
  stream_recovery: () => ({ kind: 'stream_recovery' }),
  stream_stall_detected: () => ({ kind: 'stream_recovery' }),
  sync_pong: (d) => ({
    kind: 'sync_pong',
    payload: { isUpstreamConnected: d.isUpstreamConnected, isUpstreamReconnecting: d.isUpstreamReconnecting, isHandoffActive: d.isHandoffActive }
  }),
  upstream_error: (d) => ({
    kind: 'upstream_error',
    payload: { error: String(d.error || 'Сбой голосового шлюза'), errorCode: d.errorCode, retryable: Boolean(d.retryable) }
  })
};

const DOMAIN_BUILDERS: Record<string, (d: RawServerFrame) => LiveDomainEvent> = {
  evaluation_completed: (d) => ({ kind: 'evaluation', payload: (d.evaluation || d.payload) as VoiceEvaluationResult }),
  evaluation: (d) => ({ kind: 'evaluation', payload: (d.evaluation || d.payload) as VoiceEvaluationResult }),
  whiteboard_update: (d) => ({ kind: 'whiteboard_update', payload: d.payload }),
  chaos_injected: (d) => ({ kind: 'chaos_injected', payload: d.payload }),
  hiring_committee_verdict: (d) => ({ kind: 'hiring_committee_verdict', payload: d.payload }),
  bug_solved: (d) => ({ kind: 'bug_solved', payload: d.payload || d }),
  candidate_observation_recorded: (d) => ({ kind: 'candidate_observation', payload: d.payload || d }),
  candidate_observation: (d) => ({ kind: 'candidate_observation', payload: d.payload || d }),
  smell_discovered: (d) => ({ kind: 'smell_discovered', payload: d.payload || d }),
  tool_call: (d) => ({ kind: 'tool_call', payload: d }),
  hr_phase_transition: (d) => ({ kind: 'hr_phase_transition', payload: d.payload || d }),
  hr_scorecard_ready: (d) => ({ kind: 'hr_scorecard_ready', payload: d.scorecard || d.payload || d }),
  hr_user_transcript_delta: (d) => ({ kind: 'hr_transcript_delta', text: d.delta || d.text || '' }),
  hr_step_state: (d) => ({ kind: 'hr_step_state', payload: d.payload || d })
};

export function dispatchDomainEvents(callbacks: VoiceEngineCallbacks, events: LiveDomainEvent[]): void {
  for (const event of events) {
    switch (event.kind) {
      case 'whiteboard_update': callbacks.onWhiteboardUpdate?.(event.payload); break;
      case 'chaos_injected': callbacks.onChaosInjected?.(event.payload); break;
      case 'hiring_committee_verdict': callbacks.onHiringCommitteeVerdict?.(event.payload); break;
      case 'bug_solved': callbacks.onBugSolved?.(event.payload); break;
      case 'candidate_observation': callbacks.onCandidateObservationRecorded?.(event.payload); break;
      case 'smell_discovered':
        callbacks.onSmellDiscovered?.(event.payload);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('smell_discovered', { detail: event.payload }));
        break;
      case 'tool_call': callbacks.onToolCall?.(event.payload); break;
      case 'hr_phase_transition': callbacks.onHrPhaseTransition?.(event.payload); break;
      case 'hr_scorecard_ready': callbacks.onHrScorecardReady?.(event.payload); break;
      case 'hr_transcript_delta': callbacks.onHrTranscriptDelta?.(event.text); break;
      case 'hr_step_state': callbacks.onHrStepState?.(event.payload); break;
    }
  }
}

export class LiveVoiceFrameParser {
  public static parse(rawData: unknown): ParsedLiveFrameResult | null {
    try {
      const text = decodeFrameText(rawData);
      if (text === null) return null;
      const data = JSON.parse(text) as RawServerFrame;
      const control = parseControlSignal(data);
      const kind: LiveFrameType =
        data.type === 'setupComplete' || data.setupComplete !== undefined ? 'setupComplete'
          : typeof data.type === 'string' ? (KNOWN_FRAME_TYPES.has(data.type) ? (data.type as LiveFrameType) : 'unknown')
            : data.serverContent ? 'model_turn' : 'unknown';
      const toolLifecycle = control?.kind === 'tool_lifecycle' ? control.phase : undefined;
      if (control) return { kind, control, domainEvents: [], toolLifecycle };
      const domainBuilder = data.type ? DOMAIN_BUILDERS[data.type] : undefined;
      if (domainBuilder) return { kind, domainEvents: [domainBuilder(data)] };
      return { kind, domainEvents: [], modelTurn: parseModelTurn(data.serverContent) };
    } catch { return null; }
  }
}

function decodeFrameText(rawData: unknown): string | null {
  if (typeof rawData === 'string') return rawData;
  if (rawData instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(rawData);
  if (rawData && typeof (rawData as { toString?: (enc?: string) => string }).toString === 'function') {
    return (rawData as { toString: (enc?: string) => string }).toString('utf8');
  }
  return null;
}

function parseControlSignal(data: RawServerFrame): LiveControlSignal | undefined {
  if (data.type === 'setupComplete' || data.setupComplete !== undefined) {
    return { kind: 'setup_complete', reconnected: Boolean(data.reconnected), silent: Boolean(data.silent) };
  }
  const builder = data.type ? CONTROL_BUILDERS[data.type] : undefined;
  if (builder) return builder(data);
  if (typeof data.error === 'string' && data.error.length > 0) {
    return { kind: 'upstream_error', payload: { error: data.error, errorCode: data.errorCode, retryable: Boolean(data.retryable) } };
  }
  return undefined;
}

function parseModelTurn(sc?: RawServerFrame['serverContent']): LiveModelTurnSlice | undefined {
  if (!sc) return undefined;
  const audioChunks: string[] = [];
  const textDeltas: string[] = [];
  for (const part of sc.modelTurn?.parts ?? []) {
    if (part.thought || part.isThought) continue;
    appendCleanText(part.text, textDeltas);
    const pcm = part.inlineData?.data || part.inline_data?.data;
    if (pcm) audioChunks.push(pcm);
  }
  appendCleanText(sc.outputTranscription?.text ?? sc.output_transcription?.text, textDeltas);
  return {
    hasModelTurn: Boolean(sc.modelTurn),
    hasAudio: audioChunks.length > 0,
    audioChunks,
    hasText: textDeltas.length > 0,
    textDeltas,
    isTurnDone: Boolean(sc.turnComplete || sc.generationComplete),
    interactionStatus: sc.interactionStatus,
    isInterrupted: Boolean(sc.interrupted),
    voiceActivity: sc.voiceActivity
  };
}

function appendCleanText(rawText: unknown, target: string[]): void {
  if (typeof rawText !== 'string' || rawText.length === 0) return;
  const clean = rawText.replace(/<no\s*speech>|\{pause\}|\[no\s*speech\]|<pause>/gi, '');
  if (clean.length > 0) target.push(clean);
}
