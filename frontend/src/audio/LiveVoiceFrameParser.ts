/**
 * LiveVoiceFrameParser.ts
 * SOTA Late September 2026 Protocol Frame Parser for Gemini 3.8 Live & LiteLLM Gateway.
 * Exposes a closed discriminated control union and typed flags without leaky rawParsed.
 */

import { VoiceEvaluationResult } from './types';

export type LiveControlFrameKind =
  | 'ping'
  | 'setupComplete'
  | 'tool_executing'
  | 'tool_execution_complete'
  | 'thinking_delay'
  | 'dead_air_recovery'
  | 'upstream_reconnecting'
  | 'hot_handoff_started'
  | 'hot_handoff_complete'
  | 'tool_awaiting_speech'
  | 'stream_recovery'
  | 'stream_stall_detected'
  | 'sync_pong'
  | 'upstream_error';

export type LiveDomainFrameKind =
  | 'evaluation_completed'
  | 'evaluation'
  | 'whiteboard_update'
  | 'chaos_injected'
  | 'hiring_committee_verdict'
  | 'bug_solved'
  | 'candidate_observation_recorded'
  | 'candidate_observation'
  | 'smell_discovered'
  | 'tool_call'
  | 'hr_phase_transition'
  | 'hr_scorecard_ready'
  | 'hr_user_transcript_delta'
  | 'hr_step_state';

export type LiveFrameType = LiveControlFrameKind | LiveDomainFrameKind | 'unknown';

export interface SyncPongPayload {
  isUpstreamConnected?: boolean;
  isUpstreamReconnecting?: boolean;
  isHandoffActive?: boolean;
}

export interface UpstreamErrorPayload {
  error: string;
  errorCode?: string;
  retryable: boolean;
}

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

export interface ParsedLiveFrameResult {
  type?: LiveFrameType;
  controlSignal?: LiveControlSignal;
  isPing?: boolean;
  pingTimestamp?: number;
  toolLifecycle?: 'executing' | 'complete';
  isSetupComplete?: boolean;
  isReconnected?: boolean;
  isSilentSetup?: boolean;
  isThinkingDelay?: boolean;
  isDeadAirRecovery?: boolean;
  deadAirReason?: string;
  hasModelTurn: boolean;
  hasAudio: boolean;
  audioChunks: string[];
  hasText: boolean;
  textDeltas: string[];
  isTurnDone: boolean;
  interactionStatus?: string;
  isInterrupted: boolean;
  voiceActivity?: 'ACTIVITY_START' | 'ACTIVITY_END';
  evaluation?: VoiceEvaluationResult;
  toolCallPayload?: unknown;
  whiteboardPayload?: unknown;
  chaosPayload?: unknown;
  verdictPayload?: unknown;
  bugSolvedPayload?: unknown;
  candidateObservationPayload?: unknown;
  smellDiscoveredPayload?: unknown;
  hrPhaseTransitionPayload?: unknown;
  hrScorecardPayload?: unknown;
  hrTranscriptDelta?: string;
  hrStepStatePayload?: unknown;
  reconnectPayload?: { attempt?: number; maxAttempts?: number; mode?: string };
  hotHandoffState?: 'started' | 'complete';
  toolAwaitingSpeech?: boolean;
  isStreamRecovery?: boolean;
  syncPongPayload?: SyncPongPayload;
  errorPayload?: UpstreamErrorPayload;
}

interface RawModelPart {
  thought?: boolean;
  isThought?: boolean;
  text?: unknown;
  inlineData?: { data?: string };
  inline_data?: { data?: string };
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
    modelTurn?: { parts?: RawModelPart[] };
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

export class LiveVoiceFrameParser {
  public static parse(rawData: unknown): ParsedLiveFrameResult | null {
    try {
      const text = decodeFrameText(rawData);
      if (text === null) return null;
      const data = JSON.parse(text) as RawServerFrame;

      const resolvedType: LiveFrameType | undefined =
        typeof data.type === 'string'
          ? (KNOWN_FRAME_TYPES.has(data.type) ? (data.type as LiveFrameType) : 'unknown')
          : undefined;

      const result: ParsedLiveFrameResult = {
        type: resolvedType,
        hasModelTurn: Boolean(data.serverContent?.modelTurn),
        hasAudio: false,
        audioChunks: [],
        hasText: false,
        textDeltas: [],
        isTurnDone: false,
        interactionStatus: data.serverContent?.interactionStatus,
        isInterrupted: Boolean(data.serverContent?.interrupted),
        voiceActivity: data.serverContent?.voiceActivity
      };

      if (parseControlFrame(data, result)) return result;
      if (parseDomainFrame(data, result)) return result;

      // 1. Extract audio chunks and text from modelTurn.parts
      for (const part of data.serverContent?.modelTurn?.parts ?? []) {
        if (part.thought || part.isThought) continue;
        appendCleanText(part.text, result);
        const pcm = part.inlineData?.data || part.inline_data?.data;
        if (pcm) {
          result.hasAudio = true;
          result.audioChunks.push(pcm);
        }
      }

      // 2. Extract synthesized speech transcription tokens from outputTranscription
      const outputTranscriptionText =
        data.serverContent?.outputTranscription?.text ??
        data.serverContent?.output_transcription?.text;
      appendCleanText(outputTranscriptionText, result);

      // 3. Terminal turn signals: generationComplete or turnComplete
      result.isTurnDone = Boolean(
        data.serverContent?.turnComplete ||
        data.serverContent?.generationComplete
      );

      return result;
    } catch {
      return null;
    }
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

function parseControlFrame(data: RawServerFrame, result: ParsedLiveFrameResult): boolean {
  if (data.type === 'ping') {
    const pingTimestamp = typeof data.timestamp === 'number' ? data.timestamp : undefined;
    result.isPing = true;
    result.pingTimestamp = pingTimestamp;
    result.controlSignal = { kind: 'ping', timestamp: pingTimestamp };
    return true;
  }

  if (data.type === 'setupComplete' || data.setupComplete !== undefined) {
    result.type = 'setupComplete';
    result.isSetupComplete = true;
    result.isReconnected = Boolean(data.reconnected);
    result.isSilentSetup = Boolean(data.silent);
    result.controlSignal = {
      kind: 'setup_complete',
      reconnected: result.isReconnected,
      silent: result.isSilentSetup
    };
    return true;
  }

  if (data.type === 'tool_executing' || data.type === 'tool_execution_complete') {
    const phase = data.type === 'tool_executing' ? 'executing' : 'complete';
    result.toolLifecycle = phase;
    result.controlSignal = { kind: 'tool_lifecycle', phase };
    return true;
  }

  if (data.type === 'thinking_delay') {
    result.isThinkingDelay = true;
    result.controlSignal = { kind: 'thinking_delay' };
    return true;
  }

  if (data.type === 'dead_air_recovery') {
    const deadAirReason = typeof data.reason === 'string' ? data.reason : undefined;
    result.isDeadAirRecovery = true;
    result.deadAirReason = deadAirReason;
    result.controlSignal = { kind: 'dead_air_recovery', reason: deadAirReason };
    return true;
  }

  if (data.type === 'upstream_reconnecting') {
    result.reconnectPayload = { attempt: data.attempt, maxAttempts: data.maxAttempts, mode: data.mode };
    result.controlSignal = { kind: 'upstream_reconnecting', ...result.reconnectPayload };
    return true;
  }

  if (data.type === 'hot_handoff_started' || data.type === 'hot_handoff_complete') {
    const state = data.type === 'hot_handoff_started' ? 'started' : 'complete';
    result.hotHandoffState = state;
    result.controlSignal = { kind: 'hot_handoff', state };
    return true;
  }

  if (data.type === 'tool_awaiting_speech') {
    result.toolAwaitingSpeech = true;
    result.controlSignal = { kind: 'tool_awaiting_speech' };
    return true;
  }

  if (data.type === 'stream_recovery' || data.type === 'stream_stall_detected') {
    result.isStreamRecovery = true;
    result.controlSignal = { kind: 'stream_recovery' };
    return true;
  }

  if (data.type === 'sync_pong') {
    const syncPongPayload: SyncPongPayload = {
      isUpstreamConnected: data.isUpstreamConnected,
      isUpstreamReconnecting: data.isUpstreamReconnecting,
      isHandoffActive: data.isHandoffActive
    };
    result.syncPongPayload = syncPongPayload;
    result.controlSignal = { kind: 'sync_pong', payload: syncPongPayload };
    return true;
  }

  if (data.type === 'upstream_error' || (typeof data.error === 'string' && data.error.length > 0)) {
    const errorPayload: UpstreamErrorPayload = {
      error: String(data.error || 'Сбой голосового шлюза'),
      errorCode: data.errorCode,
      retryable: Boolean(data.retryable)
    };
    result.errorPayload = errorPayload;
    result.controlSignal = { kind: 'upstream_error', payload: errorPayload };
    return true;
  }

  return false;
}

function parseDomainFrame(data: RawServerFrame, result: ParsedLiveFrameResult): boolean {
  switch (data.type) {
    case 'evaluation_completed':
    case 'evaluation':
      result.evaluation = (data.evaluation || data.payload) as VoiceEvaluationResult;
      return true;
    case 'whiteboard_update':
      result.whiteboardPayload = data.payload;
      return true;
    case 'chaos_injected':
      result.chaosPayload = data.payload;
      return true;
    case 'hiring_committee_verdict':
      result.verdictPayload = data.payload;
      return true;
    case 'bug_solved':
      result.bugSolvedPayload = data.payload || data;
      return true;
    case 'candidate_observation_recorded':
    case 'candidate_observation':
      result.candidateObservationPayload = data.payload || data;
      return true;
    case 'smell_discovered':
      result.smellDiscoveredPayload = data.payload || data;
      return true;
    case 'tool_call':
      result.toolCallPayload = data;
      return true;
    case 'hr_phase_transition':
      result.hrPhaseTransitionPayload = data.payload || data;
      return true;
    case 'hr_scorecard_ready':
      result.hrScorecardPayload = data.scorecard || data.payload || data;
      return true;
    case 'hr_user_transcript_delta':
      result.hrTranscriptDelta = data.delta || data.text || '';
      return true;
    case 'hr_step_state':
      result.hrStepStatePayload = data.payload || data;
      return true;
    default:
      return false;
  }
}

function appendCleanText(rawText: unknown, result: ParsedLiveFrameResult): void {
  if (typeof rawText !== 'string' || rawText.length === 0) return;
  const clean = sanitizeModelText(rawText);
  if (clean.length > 0) {
    result.hasText = true;
    result.textDeltas.push(clean);
  }
}

function sanitizeModelText(text: string): string {
  return text
    .replace(/<no\s*speech>/gi, '')
    .replace(/\{pause\}/gi, '')
    .replace(/\[no\s*speech\]/gi, '')
    .replace(/<pause>/gi, '');
}
