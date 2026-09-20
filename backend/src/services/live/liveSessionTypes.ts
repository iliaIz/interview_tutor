import { WebSocket, RawData } from 'ws';
import { InterviewPersonaId, TargetGrade } from '../../prompts/personas';
import { TurnTelemetryEvent } from '@interview-prep/shared';

export function toRawBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

export interface CurrentTurnMetrics {
  turnIndex: number;
  candidateSpeechStartedAt?: number;
  candidateSpeechEndedAt?: number;
  vadPauseSettingMs: number;
  speechDurationMs: number;
  firstThoughtAt?: number;
  firstTextAt?: number;
  firstAudioAt?: number;
  audioBytesReceived: number;
  textChars: number;
  droppedEchoChunksCount: number;
  wasBargeIn: boolean;
  bargeInType?: 'tactile' | 'acoustic' | null;
  lastRttMs?: number | null;
}

export interface ProxySession {
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  isSetupComplete: boolean;
  frameQueue: Buffer[];
  sessionId?: string;
  questionId?: string;
  userId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  relevantGapIds?: string[];
  probesCount?: number;
  isRetry?: boolean;
  hasCandidateResponded?: boolean;
  isOnHold?: boolean;
  lastActivityAt: number;
  heartbeatInterval?: NodeJS.Timeout | null;
  nudgeWatchdog?: NodeJS.Timeout | null;
  currentAiTurnText?: string;
  persona?: InterviewPersonaId | string;
  targetGrade?: TargetGrade;
  isToolCallPending?: boolean;
  sessionType?: 'interview' | 'tutor' | 'system_design';
  currentArchitectureMermaid?: string;
  currentGraphIr?: string;
  isUpstreamReconnecting?: boolean;
  reconnectAttempts?: number;
  reconnectTimer?: NodeJS.Timeout | null;
  toolCallSafetyTimeout?: NodeJS.Timeout | null;
  lastToolCallHash?: string;
  lastToolCallTime?: number;
  isTerminated?: boolean;
  audioChunksCount?: number;
  lastTurnCommitTime?: number;
  firstAudioChunkLogged?: boolean;
  challengeCategory?: string;
  challengeTrack?: string;
  isAiGenerating?: boolean;
  hasTerminalError?: boolean;
  terminalErrorCode?: string;
  currentTurnIndex?: number;
  currentTurnMetrics?: CurrentTurnMetrics | null;
  turnTelemetryHistory?: TurnTelemetryEvent[];
  vadPauseMs?: number;
  lastRttMs?: number | null;
}
