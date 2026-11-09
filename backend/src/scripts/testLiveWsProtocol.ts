/**
 * testLiveWsProtocol.ts
 * Deterministic unit test asserting Live Audio Protocol invariants (SPEC-13 / Ticket 1).
 * Asserts:
 * 1. Zero 'realtimeInput.interruption' frames dispatched on barge-in.
 * 2. 'realtimeInput.audioStreamEnd' is cleanly forwarded upstream on speech cessation.
 */

import { attachLiveClientFrameHandler } from '../services/live/liveWsClientFrameHandler';
import { EventEmitter } from 'events';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('🧪 Running Live WebSocket Protocol Unit Test Suite...\n');

// Mock client socket and upstream gemini socket
const clientSocket = new EventEmitter() as any;
clientSocket.readyState = 1; // WebSocket.OPEN

const sentUpstreamFrames: any[] = [];
const geminiSocket = {
  readyState: 1,
  send: (data: string | Buffer) => {
    try {
      sentUpstreamFrames.push(JSON.parse(data.toString()));
    } catch {
      sentUpstreamFrames.push(data);
    }
  }
};

const session: any = {
  isTerminated: false,
  isSetupComplete: true,
  geminiSocket,
  frameQueue: [],
  fsm: { transition: () => {} },
  watchdogs: { armNudge: () => {}, armDeadAir: () => {}, disarmAll: () => {} }
};

attachLiveClientFrameHandler({
  session,
  clientSocket,
  turnMode: 'auto',
  terminate: () => {}
});

// Test 1: Barge-in frame must NOT dispatch { realtimeInput: { interruption: true } }
const bargeInMsg = Buffer.from(JSON.stringify({
  type: 'barge_in',
  bargeIn: true,
  bargeInType: 'tactile',
  epoch: Date.now()
}));

clientSocket.emit('message', bargeInMsg);

const illegalInterruptionFrame = sentUpstreamFrames.find(f => f?.realtimeInput?.interruption);
assert(!illegalInterruptionFrame, 'Zero illegal realtimeInput.interruption frames dispatched upstream');

// Test 2: audioStreamEnd must be forwarded to upstream
const audioStreamEndMsg = Buffer.from(JSON.stringify({
  realtimeInput: { audioStreamEnd: true }
}));

clientSocket.emit('message', audioStreamEndMsg);

const forwardedEndFrame = sentUpstreamFrames.find(f => f?.realtimeInput?.audioStreamEnd === true);
assert(Boolean(forwardedEndFrame), 'realtimeInput.audioStreamEnd is forwarded upstream for fast-handoff');
assert(session.hasCandidateResponded === true, 'session.hasCandidateResponded is flagged true on audioStreamEnd');

console.log('\n🎉 All Live WebSocket Protocol tests passed successfully!');
