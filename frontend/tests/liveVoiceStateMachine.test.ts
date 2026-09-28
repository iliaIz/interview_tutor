/**
 * liveVoiceStateMachine.test.ts
 * Exhaustive transition test suite for LiveVoiceStateMachine (SOTA Late 2026).
 */

import assert from 'assert';
import { LiveVoiceStateMachine } from '../src/audio/LiveVoiceStateMachine';

console.log('🧪 Testing LiveVoiceStateMachine transitions...');

const fsm = new LiveVoiceStateMachine();

// 1. Initial State
assert.strictEqual(fsm.getInternalState(), 'IDLE', 'Initial internal state must be IDLE');
assert.strictEqual(fsm.getPublicState(), 'IDLE', 'Initial public state must be IDLE');
console.log('  ✅ Initial state is IDLE');

// 2. Turn 0 Question Recitation Lockdown
assert.strictEqual(fsm.transition({ type: 'CONNECT' }), true, 'Transition to CONNECTING');
assert.strictEqual(fsm.getInternalState(), 'CONNECTING', 'State must be CONNECTING');

assert.strictEqual(fsm.transition({ type: 'SETUP_COMPLETE', isTurn0: true }), true, 'Transition to AI_RECITING_QUESTION');
assert.strictEqual(fsm.getInternalState(), 'AI_RECITING_QUESTION', 'State must be AI_RECITING_QUESTION');
assert.strictEqual(fsm.getPublicState(), 'AI_SPEAKING', 'Public state must be AI_SPEAKING');
assert.strictEqual(fsm.isTurn0RecitationActive(), true, 'Turn 0 lockdown must be active');

// Invariant: Acoustic speech frame CANNOT interrupt Turn 0 recitation
assert.strictEqual(fsm.transition({ type: 'SPEECH_STARTED' }), false, 'Speech cannot interrupt Turn 0');
assert.strictEqual(fsm.getInternalState(), 'AI_RECITING_QUESTION', 'State must remain AI_RECITING_QUESTION');
console.log('  ✅ Turn 0 Question Recitation Lockdown verified');

// Playout finish unlocks candidate listening
assert.strictEqual(fsm.transition({ type: 'PLAYOUT_FINISHED' }), true, 'Playout finished unlocks candidate');
assert.strictEqual(fsm.getInternalState(), 'CANDIDATE_LISTENING', 'State must be CANDIDATE_LISTENING');
assert.strictEqual(fsm.getPublicState(), 'LISTENING', 'Public state must be LISTENING');
assert.strictEqual(fsm.isTurn0RecitationActive(), false, 'Turn 0 lockdown must be lifted');
console.log('  ✅ Playout finish transitions to CANDIDATE_LISTENING');

// 3. Speech -> Hold -> Commit Lifecycle
assert.strictEqual(fsm.transition({ type: 'SPEECH_STARTED' }), true, 'Candidate starts speaking');
assert.strictEqual(fsm.getInternalState(), 'CANDIDATE_SPEAKING', 'State must be CANDIDATE_SPEAKING');
assert.strictEqual(fsm.getPublicState(), 'LISTENING', 'Public state must remain LISTENING');

assert.strictEqual(fsm.transition({ type: 'SPEECH_PAUSED' }), true, 'Candidate pauses speech');
assert.strictEqual(fsm.getInternalState(), 'CANDIDATE_HOLD', 'State must be CANDIDATE_HOLD');
assert.strictEqual(fsm.getPublicState(), 'LISTENING', 'Public state must remain LISTENING');

assert.strictEqual(fsm.transition({ type: 'COMMIT_TRIGGERED' }), true, 'Commit triggered');
assert.strictEqual(fsm.getInternalState(), 'COMMITTING', 'State must be COMMITTING');

assert.strictEqual(fsm.transition({ type: 'FIRST_AUDIO_RECEIVED' }), true, 'AI begins speaking');
assert.strictEqual(fsm.getInternalState(), 'AI_SPEAKING', 'State must be AI_SPEAKING');
assert.strictEqual(fsm.getPublicState(), 'AI_SPEAKING', 'Public state must be AI_SPEAKING');
console.log('  ✅ Candidate Speech -> Hold -> Commit -> AI Speaking lifecycle verified');

// 4. Mid-Dialogue Genuine Barge-In
assert.strictEqual(fsm.transition({ type: 'BARGE_IN_TRIGGERED', source: 'acoustic' }), true, 'Mid-dialogue barge-in accepted');
assert.strictEqual(fsm.getInternalState(), 'CANDIDATE_SPEAKING', 'State transitions to CANDIDATE_SPEAKING on barge-in');
assert.strictEqual(fsm.getPublicState(), 'LISTENING', 'Public state must be LISTENING');
console.log('  ✅ Mid-dialogue barge-in verified');

// 5. Trap-Free Recovery Contracts (Dead-Air & Tactile Override during COMMITTING / AI_THINKING)
// 5a. DEAD_AIR_RECOVERED from COMMITTING
const recoveryFsm = new LiveVoiceStateMachine();
recoveryFsm.transition({ type: 'CONNECT' });
recoveryFsm.transition({ type: 'SETUP_COMPLETE', isTurn0: false });
assert.strictEqual(recoveryFsm.getInternalState(), 'CANDIDATE_LISTENING');

recoveryFsm.transition({ type: 'SPEECH_STARTED' });
recoveryFsm.transition({ type: 'COMMIT_TRIGGERED' });
assert.strictEqual(recoveryFsm.getInternalState(), 'COMMITTING');

assert.strictEqual(recoveryFsm.transition({ type: 'DEAD_AIR_RECOVERED', reason: 'upstream_timeout' }), true);
assert.strictEqual(recoveryFsm.getInternalState(), 'CANDIDATE_LISTENING', 'COMMITTING -> DEAD_AIR_RECOVERED must unlock CANDIDATE_LISTENING');
assert.strictEqual(recoveryFsm.getPublicState(), 'LISTENING', 'Public state must be LISTENING after dead air recovery');
console.log('  ✅ Dead-air recovery from COMMITTING verified');

// 5b. Tactile override (BARGE_IN_TRIGGERED) from COMMITTING
recoveryFsm.transition({ type: 'SPEECH_STARTED' });
recoveryFsm.transition({ type: 'COMMIT_TRIGGERED' });
assert.strictEqual(recoveryFsm.getInternalState(), 'COMMITTING');

assert.strictEqual(recoveryFsm.transition({ type: 'BARGE_IN_TRIGGERED', source: 'tactile' }), true);
assert.strictEqual(recoveryFsm.getInternalState(), 'CANDIDATE_LISTENING', 'COMMITTING -> BARGE_IN_TRIGGERED must unlock CANDIDATE_LISTENING');
assert.strictEqual(recoveryFsm.getPublicState(), 'LISTENING');
console.log('  ✅ Tactile barge-in override from COMMITTING verified');

// 5c. Zero-audio turn completion (PLAYOUT_FINISHED) from COMMITTING
recoveryFsm.transition({ type: 'SPEECH_STARTED' });
recoveryFsm.transition({ type: 'COMMIT_TRIGGERED' });
assert.strictEqual(recoveryFsm.getInternalState(), 'COMMITTING');

assert.strictEqual(recoveryFsm.transition({ type: 'PLAYOUT_FINISHED' }), true);
assert.strictEqual(recoveryFsm.getInternalState(), 'CANDIDATE_LISTENING', 'COMMITTING -> PLAYOUT_FINISHED must unlock CANDIDATE_LISTENING');
assert.strictEqual(recoveryFsm.getPublicState(), 'LISTENING');
console.log('  ✅ Playout finish from COMMITTING verified');

// 6. Evaluation Termination
assert.strictEqual(fsm.transition({ type: 'COMMIT_TRIGGERED' }), true);
assert.strictEqual(fsm.transition({ type: 'EVALUATION_COMPLETED' }), true);
assert.strictEqual(fsm.getInternalState(), 'COMPLETED', 'State must be COMPLETED');
assert.strictEqual(fsm.getPublicState(), 'COMPLETED', 'Public state must be COMPLETED');
console.log('  ✅ Evaluation completion verified');

console.log('🎉 All LiveVoiceStateMachine transition contracts PASSED!');
