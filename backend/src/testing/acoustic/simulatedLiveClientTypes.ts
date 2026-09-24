/**
 * simulatedLiveClientTypes.ts
 * Types and interfaces for SimulatedLiveClient.
 */

export interface SimulatedClientOptions {
  hostWithPort?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  strictness?: 'learning' | 'standard' | 'hardcore';
  persona?: string;
  liveModel?: string;
  sessionType?: 'interview' | 'tutor';
  tutorMode?: string;
  turnMode?: 'auto' | 'manual';
  customPrompt?: string;
  questionId?: string;
  sessionId?: string;
  maxProbes?: number;
}

export interface ClientTelemetry {
  ttfrMs: number | null; // Time To First Reasoning / Thought (from candidate speech end)
  ttftMs: number | null; // Time To First Text token (from candidate speech end)
  ttfaMs: number | null; // Time To First Audio packet (from candidate speech end)
  isInterrupted: boolean;
  interruptionLatencyMs: number | null;
  thoughtTokens: string[];
  replyText: string;
  audioBytesReceived: number;
  isTurnComplete: boolean;
  toolCallsReceived: string[];
  canonicalTurnEvent?: any;
}
