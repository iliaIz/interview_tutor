/**
 * voiceEvents.ts
 * Canonical WebSocket Voice Events SSOT (SOTA Late September 2026).
 * Enforces bilateral event type safety across Gateway and Client.
 */

export const LIVE_VOICE_EVENTS = {
  // Downstream from Gateway -> Client
  SETUP_COMPLETE: 'setupComplete',
  UPSTREAM_READY: 'upstream_ready',
  UPSTREAM_RECONNECTING: 'upstream_reconnecting',
  EVALUATION_COMPLETED: 'evaluation_completed',
  EVALUATION_LEGACY: 'evaluation',
  WHITEBOARD_UPDATE: 'whiteboard_update',
  BUG_SOLVED: 'bug_solved',
  STREAM_RECOVERY: 'stream_recovery',
  DEAD_AIR_RECOVERY: 'dead_air_recovery',
  TURN_TELEMETRY: 'turn_telemetry',
  PONG: 'pong',
  PONG_ACK: 'pong_ack',

  // Upstream from Client -> Gateway
  BARGE_IN: 'barge_in',
  TURN_RESET: 'turn_reset',
  SESSION_HOLD: 'session_hold',
  CANVAS_DELTA: 'canvas_delta',
  PING: 'ping',
  SYNC_PING: 'sync_ping'
} as const;

export type LiveVoiceEventType = typeof LIVE_VOICE_EVENTS[keyof typeof LIVE_VOICE_EVENTS];

export interface WhiteboardUpdatePayload {
  action: 'write' | 'patch' | 'highlight' | 'clear';
  title?: string;
  language?: string;
  code?: string;
  highlightLines?: number[];
  explanation?: string;
  updatedAt?: number;
}

export const HR_VOICE_EVENTS = {
  // Downstream from Gateway -> Client
  HR_SESSION_INITIALIZED: 'hr_session_initialized',
  HR_ANCHOR_HIT: 'hr_anchor_hit',
  HR_TELEMETRY_TICK: 'hr_telemetry_tick',
  HR_USER_TRANSCRIPT_DELTA: 'hr_user_transcript_delta',
  HR_PHASE_TRANSITION: 'hr_phase_transition',
  HR_SCORECARD_READY: 'hr_scorecard_ready',

  // Upstream from Client -> Gateway
  HR_DRILL_RETRY: 'hr_drill_retry',
  HR_DRILL_NEXT: 'hr_drill_next',
  HR_PHASE_ADVANCE_REQUEST: 'hr_phase_advance_req'
} as const;

export type HrVoiceEventType = typeof HR_VOICE_EVENTS[keyof typeof HR_VOICE_EVENTS];
