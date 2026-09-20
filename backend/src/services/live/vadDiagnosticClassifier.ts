/**
 * vadDiagnosticClassifier.ts
 *
 * SOTA September 2026 Auto-VAD & Multimodal Voice Diagnostic Engine.
 * Implements the 8-class Diagnostic Decision Matrix defined in
 * .agents/skills/auto-vad-diagnostics/SKILL.md to triangulate evidence
 * across SQLite, canonical turn telemetry, stream router logs, and storage.
 */

import { TurnTelemetryEvent } from '@interview-prep/shared';

export type DiagnosticClassification =
  | 'BROWSER_AUTOPLAY_BARRIER'
  | 'SUBTITLE_SPOILER'
  | 'UPSTREAM_AI_LATENCY'
  | 'ACOUSTIC_SPEAKER_BLEED'
  | 'PREMATURE_VAD_ENDPOINTING'
  | 'PROTOCOL_ASYMMETRY'
  | 'UPSTREAM_GATEWAY_SEVER'
  | 'STORAGE_PIPELINE_VOID'
  | 'HEALTHY';

export interface DiagnosticResult {
  classification: DiagnosticClassification;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  title: string;
  explanation: string;
  prescribedFix: string;
  turnIndexTriggered?: number;
  metrics?: {
    ttfaMs?: number | null;
    ttfpMs?: number | null;
    audioTextSkewMs?: number | null;
    echoLeakageDroppedMs?: number;
    speechDurationMs?: number;
    aiTurnsCount?: number;
    userTurnsCount?: number;
  };
}

export interface DiagnosticInput {
  turnTelemetry?: TurnTelemetryEvent[] | string | null;
  transcript?: string | Array<{ role: string; content?: string }> | null;
  audioPath?: string | null;
  backendLogs?: string[];
  litellmLogs?: string[];
  storageFiles?: string[];
}

export class VadDiagnosticClassifier {
  /**
   * Evaluates session evidence against the Diagnostic Decision Matrix.
   * Priority ordering: Protocol/Storage voids -> Playout barriers -> Upstream latencies -> Healthy.
   */
  public static classify(input: DiagnosticInput): DiagnosticResult {
    // 1. Parse and sanitize Turn Telemetry
    let turns: TurnTelemetryEvent[] = [];
    if (Array.isArray(input.turnTelemetry)) {
      turns = input.turnTelemetry;
    } else if (typeof input.turnTelemetry === 'string') {
      try {
        const parsed = JSON.parse(input.turnTelemetry);
        if (Array.isArray(parsed)) turns = parsed;
      } catch {}
    }

    // 2. Parse and sanitize Transcript
    let transcriptTurns: Array<{ role: string; content?: string }> = [];
    if (Array.isArray(input.transcript)) {
      transcriptTurns = input.transcript;
    } else if (typeof input.transcript === 'string') {
      try {
        const parsed = JSON.parse(input.transcript);
        if (Array.isArray(parsed)) transcriptTurns = parsed;
      } catch {}
    }

    const aiTurns = transcriptTurns.filter((t) => t.role === 'ai');
    const userTurns = transcriptTurns.filter((t) => t.role === 'user');

    // --- RULE 1: Protocol Asymmetry (Missing AI turns in transcript) ---
    // If conversation occurred (user turns present) but 0 AI turns recorded
    if (userTurns.length > 0 && aiTurns.length === 0) {
      return {
        classification: 'PROTOCOL_ASYMMETRY',
        severity: 'CRITICAL',
        title: 'Protocol Asymmetry Detected',
        explanation: 'The transcript contains candidate turns but 0 AI turns. Model text was never captured.',
        prescribedFix: 'Ensure outputAudioTranscription: {} is symmetrically declared alongside inputAudioTranscription: {} in setupMessage.setup.',
        metrics: {
          aiTurnsCount: 0,
          userTurnsCount: userTurns.length
        }
      };
    }

    // --- RULE 2: Upstream / Gateway Sever (Sudden 1001/1005/1006 disconnect) ---
    const allLogs = [...(input.backendLogs || []), ...(input.litellmLogs || [])];
    const hasSeverCode = allLogs.some((l) =>
      l.includes('1001') || l.includes('1005') || l.includes('1006') || l.includes('connection reset by peer')
    );
    if (hasSeverCode && turns.length === 0) {
      return {
        classification: 'UPSTREAM_GATEWAY_SEVER',
        severity: 'CRITICAL',
        title: 'Upstream / Gateway Disconnect Sever',
        explanation: 'WebSocket session terminated abruptly with code 1001/1005/1006 before conversational turns completed.',
        prescribedFix: 'Check LiteLLM Proxy upstream key pool for 429 quota exhaustion or model 503 circuit-breaker trips.',
      };
    }

    // --- RULE 3: Storage Pipeline Void (Missing physical recording) ---
    const audioPathNull = !input.audioPath || input.audioPath === 'null';
    const storageEmpty = input.storageFiles ? input.storageFiles.length === 0 : false;
    if (userTurns.length > 0 && audioPathNull && storageEmpty) {
      return {
        classification: 'STORAGE_PIPELINE_VOID',
        severity: 'CRITICAL',
        title: 'Storage Pipeline Void',
        explanation: 'Audio was processed through WebSocket, but no audio file was written to disk volume (/app/storage is empty and audio_path is NULL).',
        prescribedFix: 'Verify that writeToDisk / Deepgram persistence pipeline writes audio buffer to storage volume before evaluation insert.'
      };
    }

    // --- RULE 4: Browser Autoplay Barrier (Audio buffered on server, but DAC output blocked) ---
    // Pattern: TTFA < 800ms, but TTFP > 4000ms or null
    for (const t of turns) {
      if (t.speaker === 'model') {
        const ttfa = t.ttfaMs;
        const ttfp = t.ttfpMs;
        if (ttfa !== null && ttfa !== undefined && ttfa < 800 && (ttfp === null || ttfp === undefined || ttfp > 4000)) {
          return {
            classification: 'BROWSER_AUTOPLAY_BARRIER',
            severity: 'CRITICAL',
            title: 'Browser Web Audio Autoplay Barrier',
            explanation: `First audio packet arrived in ${ttfa}ms, but ear playout was delayed to ${ttfp ?? 'unplayed'}ms (> 4000ms). Web Audio AudioContext was blocked or suspended by browser policy.`,
            prescribedFix: 'AudioContext instantiation or context.resume() must be invoked synchronously inside direct user DOM onClick before any await/fetch boundary.',
            turnIndexTriggered: t.turnIndex,
            metrics: { ttfaMs: ttfa, ttfpMs: ttfp }
          };
        }
      }
    }

    // --- RULE 5: Subtitle Spoilering (Text rendered ahead of audio playout) ---
    // Pattern: audioTextSkewMs < -800ms
    for (const t of turns) {
      if (t.speaker === 'model' && t.audioTextSkewMs !== null && t.audioTextSkewMs !== undefined) {
        if (t.audioTextSkewMs < -800) {
          return {
            classification: 'SUBTITLE_SPOILER',
            severity: 'WARNING',
            title: 'Negative Playout Skew (Subtitle Spoilering)',
            explanation: `Audio-Text Skew was ${t.audioTextSkewMs}ms (< -800ms). Candidate read AI answer subtitles long before voice was audible in headphones.`,
            prescribedFix: 'Apply subtitle pacing queue aligned with AudioPlayoutManager ring buffer drain rather than instant text rendering.',
            turnIndexTriggered: t.turnIndex,
            metrics: { audioTextSkewMs: t.audioTextSkewMs }
          };
        }
      }
    }

    // --- RULE 6: Upstream AI Latency (Stalled Gemini Live queue) ---
    // Pattern: TTFA > 4000ms with normal network RTT < 60ms
    for (const t of turns) {
      if (t.speaker === 'model' && t.ttfaMs !== null && t.ttfaMs !== undefined && t.ttfaMs > 4000) {
        if (!t.networkRttMs || t.networkRttMs < 60) {
          return {
            classification: 'UPSTREAM_AI_LATENCY',
            severity: 'CRITICAL',
            title: 'Upstream Model Generation Queue Saturation',
            explanation: `TTFA was ${t.ttfaMs}ms (> 4000ms) despite normal network latency (${t.networkRttMs ?? 20}ms). Upstream model was stalled in token/audio synthesis.`,
            prescribedFix: 'Check Gemini Live queue saturation on LiteLLM Proxy; trigger circuit-breaker failover to secondary model or regional replica.',
            turnIndexTriggered: t.turnIndex,
            metrics: { ttfaMs: t.ttfaMs }
          };
        }
      }
    }

    // --- RULE 7: Acoustic Speaker Bleed (Loudspeaker loop causing half-duplex drop) ---
    // Pattern: echoLeakageDroppedMs > 3000ms
    for (const t of turns) {
      if (t.echoLeakageDroppedMs && t.echoLeakageDroppedMs > 3000) {
        return {
          classification: 'ACOUSTIC_SPEAKER_BLEED',
          severity: 'WARNING',
          title: 'Acoustic Speaker Bleed & Echo Suppression',
          explanation: `Backend half-duplex filter dropped ${t.echoLeakageDroppedMs}ms of microphone audio while AI was speaking. User is likely not wearing headphones.`,
          prescribedFix: 'Prompt candidate to wear headphones and ensure single-sink audio routing is active on client device.',
          turnIndexTriggered: t.turnIndex,
          metrics: { echoLeakageDroppedMs: t.echoLeakageDroppedMs }
        };
      }
    }

    // --- RULE 8: Premature VAD Endpointing (Cut off candidate speech) ---
    // Pattern: speechDurationMs < 800ms with turn commit
    for (const t of turns) {
      if (t.speaker === 'user' && t.speechDurationMs > 0 && t.speechDurationMs < 800) {
        return {
          classification: 'PREMATURE_VAD_ENDPOINTING',
          severity: 'WARNING',
          title: 'Premature VAD Endpointing',
          explanation: `Candidate speech turn was finalized after only ${t.speechDurationMs}ms (< 800ms). Natural cognitive pause was prematurely classified as turn end.`,
          prescribedFix: 'Increase VAD pause gate from 1200ms to 1800ms (standard) or 2200ms (thinking/complex topics).',
          turnIndexTriggered: t.turnIndex,
          metrics: { speechDurationMs: t.speechDurationMs }
        };
      }
    }

    // --- HEALTHY SESSION ---
    return {
      classification: 'HEALTHY',
      severity: 'HEALTHY',
      title: 'Acoustic & Observability Stack Healthy',
      explanation: 'All canonical turn metrics, audio-text sync skew, and conversation transcripts are within SOTA SLA bounds.',
      prescribedFix: 'No remediation required.',
      metrics: {
        aiTurnsCount: aiTurns.length,
        userTurnsCount: userTurns.length
      }
    };
  }
}
