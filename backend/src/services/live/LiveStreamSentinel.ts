/**
 * LiveStreamSentinel.ts
 * Passive Auto-VAD & Mid-Generation Stream Sentinel (Spec 42 / #158).
 * Observes uplink PCM RMS + upstream VAD/transcription events without ever interrupting
 * continuous PCM streaming or injecting illegal audioStreamEnd frames.
 * Arms two-phase watchdogs strictly after candidate speech stops (zero false alarms
 * when reading code silently) or when model generation stalls mid-turn.
 * Cognitive Bounding Limit: <= 230 lines (Rule 8 compliant).
 */

import { LiveDeadAirGuard } from './LiveDeadAirGuard';
import { clampVadPauseMs, DEFAULT_VAD_PAUSE_MS } from '../../config/liveDefaults';

export type StreamSentinelSignal =
  | 'activity_start'
  | 'activity_end'
  | 'input_transcription'
  | 'model_turn_start'
  | 'model_audio_chunk'
  | 'model_text_or_thought'
  | 'tool_call_when_idle'
  | 'turn_complete'
  | 'interrupted';

export interface LiveStreamSentinelOptions {
  phase1DelayMs?: number;
  phase2DelayMs?: number;
  midTurnStallMs?: number;
  vadSlackMs?: number;
  onPhase1ThinkingDelay?: (elapsedMs: number) => void;
  onPhase2StallRecovery?: (reason: 'auto_vad_stream_stall' | 'mid_generation_stall', consecutiveStalls: number) => void;
}

export class LiveStreamSentinel {
  private readonly phase1DelayMs: number;
  private readonly phase2DelayMs: number;
  private readonly midTurnStallMs: number;
  private readonly vadSlackMs: number;

  private noiseFloorRms = 0.005;
  private hasSpokenInTurn = false;
  private isAiActive = false;
  private trailingSilenceStartedAt: number | null = null;
  private consecutiveStalls = 0;
  private isDisposed = false;

  private phase1Timer: NodeJS.Timeout | null = null;
  private phase2Timer: NodeJS.Timeout | null = null;
  private midTurnTimer: NodeJS.Timeout | null = null;
  private postSpeechArmedAt: number | null = null;

  constructor(private readonly options: LiveStreamSentinelOptions = {}) {
    this.phase1DelayMs = options.phase1DelayMs ?? 7000;
    this.phase2DelayMs = options.phase2DelayMs ?? 16000;
    this.midTurnStallMs = options.midTurnStallMs ?? 10000;
    this.vadSlackMs = options.vadSlackMs ?? 1500;
  }

  /**
   * Passively inspects incoming 16kHz PCM audio frames in auto-VAD mode.
   * Never alters or blocks frames. Arms watchdogs only after real speech cessation.
   */
  public observeClientAudio(
    base64Pcm: string,
    vadPauseMs: number = DEFAULT_VAD_PAUSE_MS,
    turnMode: 'auto' | 'manual' = 'auto',
    now: number = Date.now()
  ): void {
    if (this.isDisposed || turnMode !== 'auto' || this.isAiActive) return;

    const rms = LiveDeadAirGuard.calculateBase64PcmRms(base64Pcm);
    const adaptive = 0.97 * this.noiseFloorRms + 0.03 * rms;
    this.noiseFloorRms = Math.max(0.002, Math.min(0.03, adaptive));

    const speechThreshold = Math.max(0.015, this.noiseFloorRms * 2.5);
    const isSpeech = rms > speechThreshold;

    if (isSpeech) {
      this.hasSpokenInTurn = true;
      this.trailingSilenceStartedAt = null;
      this.disarmPostSpeechWatchdogs();
      return;
    }

    // Zero false triggers while reading code silently before any utterance
    if (!this.hasSpokenInTurn) {
      return;
    }

    if (this.trailingSilenceStartedAt === null) {
      this.trailingSilenceStartedAt = now;
      return;
    }

    const silenceElapsed = now - this.trailingSilenceStartedAt;
    const endOfSpeechWindowMs = clampVadPauseMs(vadPauseMs, DEFAULT_VAD_PAUSE_MS) + this.vadSlackMs;

    if (silenceElapsed >= endOfSpeechWindowMs) {
      this.hasSpokenInTurn = false;
      this.trailingSilenceStartedAt = null;
      this.armPostSpeechWatchdogs(now);
    }
  }

  public observeUpstreamSignal(signal: StreamSentinelSignal, now: number = Date.now()): void {
    if (this.isDisposed) return;

    switch (signal) {
      case 'activity_start':
      case 'input_transcription':
        this.hasSpokenInTurn = true;
        this.trailingSilenceStartedAt = null;
        this.disarmPostSpeechWatchdogs();
        break;

      case 'activity_end':
        this.hasSpokenInTurn = false;
        this.trailingSilenceStartedAt = null;
        if (!this.isAiActive) {
          this.armPostSpeechWatchdogs(now);
        }
        break;

      case 'model_turn_start':
      case 'model_text_or_thought':
      case 'tool_call_when_idle':
        this.isAiActive = true;
        this.hasSpokenInTurn = false;
        this.trailingSilenceStartedAt = null;
        this.consecutiveStalls = 0;
        this.disarmPostSpeechWatchdogs();
        this.armMidTurnGuard();
        break;

      case 'model_audio_chunk':
        this.isAiActive = true;
        this.hasSpokenInTurn = false;
        this.consecutiveStalls = 0;
        this.disarmPostSpeechWatchdogs();
        // Refresh mid-turn timeout while waiting for subsequent chunks or turnComplete
        this.armMidTurnGuard(Math.max(this.midTurnStallMs, 12000));
        break;

      case 'turn_complete':
      case 'interrupted':
        this.resetTurnState();
        break;
    }
  }

  public isPostSpeechArmed(): boolean {
    return this.phase1Timer !== null || this.phase2Timer !== null;
  }

  public isMidTurnArmed(): boolean {
    return this.midTurnTimer !== null;
  }

  public resetTurnState(): void {
    this.isAiActive = false;
    this.hasSpokenInTurn = false;
    this.trailingSilenceStartedAt = null;
    this.disarmAll();
  }

  public disarmAll(): void {
    this.disarmPostSpeechWatchdogs();
    this.disarmMidTurnGuard();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.resetTurnState();
  }

  private armPostSpeechWatchdogs(now: number): void {
    this.disarmPostSpeechWatchdogs();
    this.postSpeechArmedAt = now;

    this.phase1Timer = setTimeout(() => {
      this.phase1Timer = null;
      if (this.isDisposed || this.isAiActive) return;
      const elapsed = this.postSpeechArmedAt ? Date.now() - this.postSpeechArmedAt : this.phase1DelayMs;
      this.options.onPhase1ThinkingDelay?.(elapsed);
    }, this.phase1DelayMs);

    this.phase2Timer = setTimeout(() => {
      this.phase2Timer = null;
      this.disarmPostSpeechWatchdogs();
      if (this.isDisposed || this.isAiActive) return;
      this.consecutiveStalls += 1;
      this.options.onPhase2StallRecovery?.('auto_vad_stream_stall', this.consecutiveStalls);
    }, this.phase2DelayMs);
  }

  private disarmPostSpeechWatchdogs(): void {
    if (this.phase1Timer) {
      clearTimeout(this.phase1Timer);
      this.phase1Timer = null;
    }
    if (this.phase2Timer) {
      clearTimeout(this.phase2Timer);
      this.phase2Timer = null;
    }
    this.postSpeechArmedAt = null;
  }

  private armMidTurnGuard(timeoutMs: number = this.midTurnStallMs): void {
    this.disarmMidTurnGuard();
    this.midTurnTimer = setTimeout(() => {
      this.midTurnTimer = null;
      if (this.isDisposed || !this.isAiActive) return;
      this.isAiActive = false;
      this.consecutiveStalls += 1;
      this.options.onPhase2StallRecovery?.('mid_generation_stall', this.consecutiveStalls);
    }, timeoutMs);
  }

  private disarmMidTurnGuard(): void {
    if (this.midTurnTimer) {
      clearTimeout(this.midTurnTimer);
      this.midTurnTimer = null;
    }
  }
}
