import { Type, Static } from '@sinclair/typebox';

/**
 * SOTA September 2026 Canonical Turn Telemetry Schema
 * Defines the structured performance and acoustic milestone contract for each dialogue turn.
 */
export const TurnTelemetryEventSchema = Type.Object({
  turnId: Type.String({ description: 'Unique identifier for the dialogue turn' }),
  sessionId: Type.String({ description: 'WebSocket session identifier' }),
  turnIndex: Type.Integer({ minimum: 0, description: 'Sequential zero-based turn index' }),
  speaker: Type.Union([Type.Literal('user'), Type.Literal('model')], {
    description: 'Speaker role initiating or completing the turn'
  }),

  // 1. Client VAD & Speech Duration Metrics
  vadPauseSettingMs: Type.Number({
    description: 'Configured VAD silence gate duration in ms (typically 1200-2500ms)'
  }),
  speechDurationMs: Type.Number({
    description: 'Duration of active user speech in milliseconds'
  }),
  vadTriggerLagMs: Type.Optional(Type.Number({
    description: 'Calculated latency drift between silence end and actual socket commit'
  })),

  // 2. AI Turn Generation & Handoff Milestones (milliseconds relative to turn commit)
  ttfrMs: Type.Union([Type.Number(), Type.Null()], {
    description: 'Time-to-First-Reasoning (Extended Thinking CoT token arrival) [Target: 200-1500ms]'
  }),
  ttftMs: Type.Union([Type.Number(), Type.Null()], {
    description: 'Time-to-First-Text (First token of response text/transcript) [Target: 300-800ms]'
  }),
  ttfaMs: Type.Union([Type.Number(), Type.Null()], {
    description: 'Time-to-First-Audio (First PCM packet arrival at backend WebSocket) [Target: 400-900ms]'
  }),
  ttfpMs: Type.Union([Type.Number(), Type.Null()], {
    description: 'Time-to-First-Phonation (Ear latency: physical DAC playout start via AudioContext) [Target: 450-1000ms]'
  }),

  // 3. Audio-Visual Alignment & Playout Quality
  audioTextSkewMs: Type.Union([Type.Number(), Type.Null()], {
    description: 'Skew delta between audio playout and text rendering: T_audio - T_text. Negative means text appears before speech'
  }),
  audioDurationMs: Type.Number({
    description: 'Total duration of generated audio stream in milliseconds'
  }),
  textChars: Type.Number({
    description: 'Total character length of the generated response text'
  }),
  workletBufferUnderruns: Type.Optional(Type.Number({
    description: 'Number of sample buffer underrun/glitch events during turn playout'
  })),
  echoLeakageDroppedMs: Type.Number({
    description: 'Milliseconds of microphone audio suppressed by Half-Duplex guard while AI was speaking'
  }),

  // 4. Infrastructure & Interruption Telemetry
  networkRttMs: Type.Union([Type.Number(), Type.Null()], {
    description: 'Round-trip time (RTT) measured via WebSocket ping/pong at turn commit'
  }),
  modelName: Type.String({
    description: 'Active upstream Live model identifier'
  }),
  wasBargeIn: Type.Boolean({
    description: 'Indicates whether AI speech was interrupted mid-turn by the candidate'
  }),
  bargeInType: Type.Union([Type.Literal('tactile'), Type.Literal('acoustic'), Type.Null()], {
    description: 'Source of interruption: tactile button click or acoustic speech detection'
  }),

  createdAt: Type.Number({
    description: 'Epoch timestamp when turn telemetry was sealed'
  })
});

export type TurnTelemetryEvent = Static<typeof TurnTelemetryEventSchema>;

/**
 * Standard Telemetry SLAs and Health Thresholds (as of September 2026)
 */
export const VOICE_TELEMETRY_SLA = {
  MAX_ACCEPTABLE_TTFA_MS: 1500,
  MAX_ACCEPTABLE_TTFT_MS: 1200,
  MAX_ACCEPTABLE_TTFP_MS: 1800,
  MAX_ACCEPTABLE_SKEW_MS: 300,
  MAX_ACCEPTABLE_RTT_MS: 250,
  MAX_ACCEPTABLE_ECHO_LEAKAGE_MS: 1000
} as const;
