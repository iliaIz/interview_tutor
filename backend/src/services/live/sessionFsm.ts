/**
 * sessionFsm.ts
 * Finite State Machine for Live Voice Session Lifecycle (Invariant 2.8 & SPEC-003).
 * Enforces trap-free transitions and guarantees that COMMITTING and AI_THINKING
 * states can always recover cleanly to CANDIDATE_LISTENING on dead-air recovery or barge-in.
 */

export type LiveSessionState =
  | 'INIT'
  | 'CANDIDATE_LISTENING'
  | 'CANDIDATE_SPEAKING'
  | 'COMMITTING'
  | 'AI_THINKING'
  | 'AI_SPEAKING'
  | 'TERMINATED';

export type StateTransitionListener = (from: LiveSessionState, to: LiveSessionState) => void;

export class SessionFsm {
  private _state: LiveSessionState;
  private readonly listeners: StateTransitionListener[] = [];

  constructor(initialState: LiveSessionState = 'INIT') {
    this._state = initialState;
  }

  public get state(): LiveSessionState {
    return this._state;
  }

  public onTransition(listener: StateTransitionListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  public canTransition(to: LiveSessionState): boolean {
    if (this._state === 'TERMINATED') return false;
    if (to === 'TERMINATED') return true;
    if (this._state === to) return true;

    switch (this._state) {
      case 'INIT':
        return to === 'AI_SPEAKING' || to === 'CANDIDATE_LISTENING' || to === 'COMMITTING';
      case 'CANDIDATE_LISTENING':
        return to === 'CANDIDATE_SPEAKING' || to === 'COMMITTING' || to === 'AI_SPEAKING';
      case 'CANDIDATE_SPEAKING':
        return to === 'COMMITTING' || to === 'CANDIDATE_LISTENING' || to === 'AI_SPEAKING';
      case 'COMMITTING':
        // Trap-free: Must transition to AI_THINKING, or recover directly to CANDIDATE_LISTENING / AI_SPEAKING
        return to === 'AI_THINKING' || to === 'CANDIDATE_LISTENING' || to === 'AI_SPEAKING';
      case 'AI_THINKING':
        // Trap-free: Transitions to AI_SPEAKING, or reclaims mic (CANDIDATE_LISTENING) on timeout/barge-in
        return to === 'AI_SPEAKING' || to === 'CANDIDATE_LISTENING';
      case 'AI_SPEAKING':
        return to === 'CANDIDATE_LISTENING' || to === 'CANDIDATE_SPEAKING' || to === 'COMMITTING';
      default:
        return false;
    }
  }

  public transition(to: LiveSessionState): boolean {
    if (this._state === 'TERMINATED') {
      console.warn(`🛑 [SessionFsm] Transition rejected: session is TERMINATED, cannot transition to ${to}.`);
      return false;
    }
    if (this._state === to) return true;
    if (!this.canTransition(to)) {
      console.warn(`⚠️ [SessionFsm] Illegal state transition attempted: ${this._state} -> ${to}. Forcing transition for resilience.`);
    }

    const from = this._state;
    this._state = to;
    for (const listener of this.listeners) {
      try {
        listener(from, to);
      } catch (err) {
        console.error(`❌ [SessionFsm] Error in transition listener:`, err);
      }
    }
    return true;
  }
}
