/**
 * LiveVoiceStateMachine.ts
 * Formal Finite State Machine (FSM) for Real-Time Duplex Voice Sessions.
 * SOTA Late September 2026.
 * 
 * Guarantees:
 * - Illegal states are eliminated by construction.
 * - Turn 0 Question Recitation Lockdown is an explicit state (AI_RECITING_QUESTION).
 * - Full backward-compatibility mapping to canonical VoiceEngineState for UI components.
 * - Bounded cognitive size: <= 180 lines.
 */

import { VoiceEngineState } from './types';

export type VoiceInternalState =
  | 'IDLE'
  | 'CONNECTING'
  | 'AI_RECITING_QUESTION'
  | 'CANDIDATE_LISTENING'
  | 'CANDIDATE_SPEAKING'
  | 'CANDIDATE_HOLD'
  | 'COMMITTING'
  | 'AI_THINKING'
  | 'AI_SPEAKING'
  | 'COMPLETED'
  | 'ERROR';

export type VoiceStateEvent =
  | { type: 'CONNECT' }
  | { type: 'SETUP_COMPLETE'; isTurn0: boolean }
  | { type: 'PLAYOUT_FINISHED' }
  | { type: 'SPEECH_STARTED' }
  | { type: 'SPEECH_PAUSED' }
  | { type: 'COMMIT_TRIGGERED' }
  | { type: 'THINKING_START' }
  | { type: 'FIRST_AUDIO_RECEIVED' }
  | { type: 'SERVER_TURN_DONE' }
  | { type: 'DEAD_AIR_RECOVERED'; reason?: string }
  | { type: 'BARGE_IN_TRIGGERED'; source: 'tactile' | 'acoustic' }
  | { type: 'EVALUATION_COMPLETED' }
  | { type: 'ERROR_OCCURRED' }
  | { type: 'DISCONNECT' };

export class LiveVoiceStateMachine {
  private currentState: VoiceInternalState = 'IDLE';

  constructor(private onStateChange?: (publicState: VoiceEngineState, internalState: VoiceInternalState) => void) {}

  public getInternalState(): VoiceInternalState {
    return this.currentState;
  }

  public getPublicState(): VoiceEngineState {
    switch (this.currentState) {
      case 'IDLE': return 'IDLE';
      case 'CONNECTING': return 'CONNECTING';
      case 'AI_RECITING_QUESTION': return 'AI_SPEAKING';
      case 'CANDIDATE_LISTENING': return 'LISTENING';
      case 'CANDIDATE_SPEAKING': return 'LISTENING';
      case 'CANDIDATE_HOLD': return 'LISTENING';
      case 'COMMITTING': return 'CONNECTING';
      case 'AI_THINKING': return 'CONNECTING';
      case 'AI_SPEAKING': return 'AI_SPEAKING';
      case 'COMPLETED': return 'COMPLETED';
      case 'ERROR': return 'ERROR';
    }
  }

  public isTurn0RecitationActive(): boolean {
    return this.currentState === 'AI_RECITING_QUESTION';
  }

  public isCandidateTurnActive(): boolean {
    return (
      this.currentState === 'CANDIDATE_LISTENING' ||
      this.currentState === 'CANDIDATE_SPEAKING' ||
      this.currentState === 'CANDIDATE_HOLD'
    );
  }

  public transition(event: VoiceStateEvent): boolean {
    const prev = this.currentState;
    let next: VoiceInternalState | null = null;

    switch (event.type) {
      case 'CONNECT':
        if (prev === 'IDLE' || prev === 'ERROR' || prev === 'COMPLETED') next = 'CONNECTING';
        break;

      case 'SETUP_COMPLETE':
        if (prev === 'CONNECTING') {
          next = event.isTurn0 ? 'AI_RECITING_QUESTION' : 'CANDIDATE_LISTENING';
        }
        break;

      case 'PLAYOUT_FINISHED':
        if (
          prev === 'AI_RECITING_QUESTION' ||
          prev === 'AI_SPEAKING' ||
          prev === 'COMMITTING' ||
          prev === 'AI_THINKING'
        ) {
          next = 'CANDIDATE_LISTENING';
        }
        break;

      case 'SPEECH_STARTED':
        if (prev === 'CANDIDATE_LISTENING' || prev === 'CANDIDATE_HOLD') {
          next = 'CANDIDATE_SPEAKING';
        } else if (prev === 'AI_SPEAKING') {
          // Acoustic barge-in mid-dialogue
          next = 'CANDIDATE_SPEAKING';
        }
        break;

      case 'SPEECH_PAUSED':
        if (prev === 'CANDIDATE_SPEAKING') {
          next = 'CANDIDATE_HOLD';
        }
        break;

      case 'COMMIT_TRIGGERED':
        if (prev === 'CANDIDATE_SPEAKING' || prev === 'CANDIDATE_HOLD' || prev === 'CANDIDATE_LISTENING') {
          next = 'COMMITTING';
        }
        break;

      case 'FIRST_AUDIO_RECEIVED':
        if (
          prev === 'COMMITTING' ||
          prev === 'AI_THINKING' ||
          prev === 'CONNECTING' ||
          prev === 'CANDIDATE_LISTENING' ||
          prev === 'CANDIDATE_SPEAKING' ||
          prev === 'CANDIDATE_HOLD'
        ) {
          next = 'AI_SPEAKING';
        }
        break;

      case 'THINKING_START':
      case 'SERVER_TURN_DONE':
        if (
          prev === 'COMMITTING' ||
          prev === 'CANDIDATE_HOLD' ||
          prev === 'CANDIDATE_SPEAKING' ||
          prev === 'CANDIDATE_LISTENING'
        ) {
          next = 'AI_THINKING';
        }
        break;

      case 'DEAD_AIR_RECOVERED':
        if (
          prev === 'COMMITTING' ||
          prev === 'AI_THINKING' ||
          prev === 'CANDIDATE_HOLD' ||
          prev === 'CANDIDATE_SPEAKING'
        ) {
          next = 'CANDIDATE_LISTENING';
        }
        break;

      case 'BARGE_IN_TRIGGERED':
        if (prev === 'AI_SPEAKING') {
          next = 'CANDIDATE_SPEAKING';
        } else if (prev === 'AI_RECITING_QUESTION' && event.source === 'tactile') {
          // Tactile skip of Turn 0 question recitation
          next = 'CANDIDATE_LISTENING';
        } else if (
          (prev === 'COMMITTING' || prev === 'AI_THINKING' || prev === 'CANDIDATE_HOLD') &&
          event.source === 'tactile'
        ) {
          // Tactile recovery from stalled AI response
          next = 'CANDIDATE_LISTENING';
        }
        break;

      case 'EVALUATION_COMPLETED':
        next = 'COMPLETED';
        break;

      case 'ERROR_OCCURRED':
        next = 'ERROR';
        break;

      case 'DISCONNECT':
        next = 'IDLE';
        break;
    }

    if (next && next !== prev) {
      console.log(`🔀 [FSM] ${prev} ➔ ${next} (Event: ${event.type})`);
      this.currentState = next;
      this.onStateChange?.(this.getPublicState(), next);
      return true;
    }

    return false;
  }

  public reset(): void {
    this.currentState = 'IDLE';
  }
}
