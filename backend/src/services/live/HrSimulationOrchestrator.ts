/**
 * HrSimulationOrchestrator.ts
 * Deterministic Finite State Machine & Watchdog for HR Screening and Micro-Drill.
 * SOTA Late 2026 Engine vs. Payload isolation.
 */

import { WebSocket } from 'ws';
import {
  HrSimulationPhase,
  HrSessionMode,
  HR_VOICE_EVENTS,
  HrQuestionRubricItem
} from '@interview-prep/shared';
import { ProxySession } from './liveSessionTypes';

export interface HrOrchestratorConfig {
  session: ProxySession;
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  mode: HrSessionMode;
  initialPhase?: HrSimulationPhase;
  activeQuestion?: HrQuestionRubricItem;
}

export class HrSimulationOrchestrator {
  private currentPhase: HrSimulationPhase;
  private mode: HrSessionMode;
  private activeQuestion: HrQuestionRubricItem | null;
  private phaseStartedAt: number;
  private turnStartedAt: number;
  private pacingWarningTimer: NodeJS.Timeout | null = null;
  private hardCutoffTimer: NodeJS.Timeout | null = null;

  constructor(private config: HrOrchestratorConfig) {
    this.mode = config.mode;
    this.currentPhase = config.initialPhase || (this.mode === 'rapid_fire_micro_drill' ? 'phase2_elevator_pitch' : 'phase1_small_talk');
    this.activeQuestion = config.activeQuestion || null;
    this.phaseStartedAt = Date.now();
    this.turnStartedAt = Date.now();
  }

  public getCurrentPhase(): HrSimulationPhase {
    return this.currentPhase;
  }

  public transitionToPhase(targetPhase: HrSimulationPhase, reason: string = 'normal_progression'): void {
    const fromPhase = this.currentPhase;
    this.currentPhase = targetPhase;
    this.phaseStartedAt = Date.now();
    this.clearWatchdogs();

    console.log(`🧭 [HR_ORCHESTRATOR] Transitioned: ${fromPhase} -> ${targetPhase} (${reason})`);

    if (this.config.clientSocket.readyState === WebSocket.OPEN) {
      this.config.clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_PHASE_TRANSITION,
          payload: {
            fromPhase,
            toPhase: targetPhase,
            reason,
            timestamp: Date.now()
          }
        })
      );
    }
  }

  public onCandidateSpeechStart(): void {
    this.turnStartedAt = Date.now();
    this.clearWatchdogs();

    // 1. Soft warning at 75 seconds (Pacing Warning)
    this.pacingWarningTimer = setTimeout(() => {
      this.dispatchPacingTick(75, 'overflow');
    }, 75000);

    // 2. Hard cut-off at 90 seconds (Interrupt and force turn advance)
    this.hardCutoffTimer = setTimeout(() => {
      this.triggerHardCutoff();
    }, 90000);
  }

  public onCandidateSpeechEnd(): void {
    this.clearWatchdogs();
  }

  public handleClientRetry(questionId?: string): void {
    console.log(`🔄 [HR_ORCHESTRATOR] Drill retry requested for question: "${questionId || 'current'}"`);
    this.clearWatchdogs();
    this.turnStartedAt = Date.now();

    const qText = this.activeQuestion?.canonicalQuestion || 'Расскажите о себе.';

    // Inject immediate conversational prompt to Gemini Live to re-ask question
    const retryInstruction = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: `[КАНДИДАТ ЗАПРОСИЛ ПОВТОРНЫЙ ДУБЛЬ]: Ободри кандидата одной короткой фразой (например: «Давай еще раз, соберись!») и сразу четко повтори вопрос: «${qText}». Не оценивай сейчас, только задай вопрос вслух.`
              }
            ]
          }
        ],
        turnComplete: true
      }
    };

    if (this.config.geminiSocket.readyState === WebSocket.OPEN) {
      this.config.geminiSocket.send(JSON.stringify(retryInstruction));
    }
  }

  private dispatchPacingTick(elapsedSec: number, windowStatus: 'building' | 'optimal' | 'overflow'): void {
    if (this.config.clientSocket.readyState === WebSocket.OPEN) {
      this.config.clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_TELEMETRY_TICK,
          payload: {
            sessionId: this.config.session.sessionId || 'hr_session',
            turnId: `turn_${this.turnStartedAt}`,
            elapsedTurnSec: elapsedSec,
            rollingWpm: 120,
            pacingStatus: elapsedSec > 85 ? 'too_slow' : 'optimal',
            pacingWindowStatus: windowStatus,
            hesitationCount: 0,
            maxHesitationMs: 0,
            fillerWordsSpotted: [],
            anchorsHitCount: 0,
            anchorsTotalCount: this.activeQuestion?.requiredAnchors.length || 5
          }
        })
      );
    }
  }

  private triggerHardCutoff(): void {
    console.warn(`⏱️ [HR_ORCHESTRATOR] 90s hard cut-off reached. Nudging model to interrupt.`);
    this.dispatchPacingTick(90, 'overflow');

    const cutoffInstruction = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: `[ПРЕВЫШЕН ХАРД-ЛИМИТ ТАЙМИНГА 90 СЕКУНД]: Вежливо перебей кандидата одной фразой: «Простите, что перебиваю, но нам нужно уложиться в регламент скрининга. Давайте зафиксируем этот ответ...» и переходи к оценке ответа через вызов соответствующего инструмента.`
              }
            ]
          }
        ],
        turnComplete: true
      }
    };

    if (this.config.geminiSocket.readyState === WebSocket.OPEN) {
      this.config.geminiSocket.send(JSON.stringify(cutoffInstruction));
    }
  }

  private clearWatchdogs(): void {
    if (this.pacingWarningTimer) {
      clearTimeout(this.pacingWarningTimer);
      this.pacingWarningTimer = null;
    }
    if (this.hardCutoffTimer) {
      clearTimeout(this.hardCutoffTimer);
      this.hardCutoffTimer = null;
    }
  }

  public destroy(): void {
    this.clearWatchdogs();
  }
}
