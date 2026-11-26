/**
 * test_spec37_deadair_mutex_resumption.js
 * Verification suite for Spec 37 / Spec 51 (#188) against real dist/ modules:
 * - LiveDeadAirGuard vocoder stall clamping
 * - ToolAudioMutex active tool mic gating
 * - SessionResumptionManager cryptographic handle rotation
 * - LiveDeadAirGuard.calculateBase64PcmRms
 */

const assert = require('assert');
const { LiveDeadAirGuard } = require('../dist/services/live/LiveDeadAirGuard');
const { ToolAudioMutex } = require('../dist/services/live/ToolAudioMutex');
const { SessionResumptionManager } = require('../dist/services/live/SessionResumptionManager');

function testLiveDeadAirGuard() {
  console.log('Testing real LiveDeadAirGuard...');
  const guard = new LiveDeadAirGuard();

  // Before speech: zero energy is not clamped (Turn 0 waiting)
  let res = guard.inspectAudioFrame(true, 1000);
  assert.strictEqual(res.suppressFrame, false);
  assert.strictEqual(res.synthesizeTurnComplete, false);

  // Active speech flows
  res = guard.inspectAudioFrame(false, 2000);
  assert.strictEqual(res.suppressFrame, false);
  assert.strictEqual(res.synthesizeTurnComplete, false);

  // Silence begins at 2500ms (0ms elapsed silence) -> normal pass-through
  res = guard.inspectAudioFrame(true, 2500);
  assert.strictEqual(res.suppressFrame, false);
  assert.strictEqual(res.synthesizeTurnComplete, false);

  // Silence continues (1300ms elapsed since 2500ms >= 1200ms) -> suppress frame
  res = guard.inspectAudioFrame(true, 3800);
  assert.strictEqual(res.suppressFrame, true);
  assert.strictEqual(res.synthesizeTurnComplete, false);

  // Silence continues (2100ms elapsed since 2500ms >= 2000ms) -> clamp turnComplete!
  res = guard.inspectAudioFrame(true, 4600);
  assert.strictEqual(res.suppressFrame, true);
  assert.strictEqual(res.synthesizeTurnComplete, true);

  // Subsequent frames after clamp remain unclamped until new speech
  res = guard.inspectAudioFrame(true, 4700);
  assert.strictEqual(res.suppressFrame, false);
  assert.strictEqual(res.synthesizeTurnComplete, false);

  guard.reset();
  res = guard.inspectAudioFrame(true, 5000);
  assert.strictEqual(res.suppressFrame, false);
  assert.strictEqual(res.synthesizeTurnComplete, false);
  console.log('✅ Real LiveDeadAirGuard passed 100%');
}

function testToolAudioMutex() {
  console.log('Testing real ToolAudioMutex...');
  const mutex = new ToolAudioMutex();
  assert.strictEqual(mutex.shouldGateMicAudio(), false);

  mutex.acquire('call_1');
  mutex.acquire('call_2');
  assert.strictEqual(mutex.shouldGateMicAudio(), true);

  mutex.release('call_1');
  assert.strictEqual(mutex.shouldGateMicAudio(), true);

  mutex.release('call_2');
  assert.strictEqual(mutex.shouldGateMicAudio(), false);

  mutex.acquire('call_3');
  mutex.acquire('call_4');
  mutex.cancel(['call_3', 'call_4']);
  assert.strictEqual(mutex.shouldGateMicAudio(), false);
  console.log('✅ Real ToolAudioMutex passed 100%');
}

function testSessionResumptionManager() {
  console.log('Testing real SessionResumptionManager...');
  const manager = new SessionResumptionManager('init_handle');
  assert.strictEqual(manager.getLatestHandle(), 'init_handle');
  assert.strictEqual(manager.hasValidHandle(), true);

  assert.strictEqual(manager.update({ newHandle: 'corrupt', resumable: false }), false);
  assert.strictEqual(manager.getLatestHandle(), 'init_handle');

  assert.strictEqual(manager.update({ newHandle: 'handle_v2', resumable: true }), true);
  assert.strictEqual(manager.getLatestHandle(), 'handle_v2');

  manager.clear();
  assert.strictEqual(manager.getLatestHandle(), null);
  assert.strictEqual(manager.hasValidHandle(), false);
  console.log('✅ Real SessionResumptionManager passed 100%');
}

function testPcmRms() {
  console.log('Testing real LiveDeadAirGuard.calculateBase64PcmRms...');
  const silenceBuf = Buffer.alloc(320);
  assert.strictEqual(LiveDeadAirGuard.calculateBase64PcmRms(silenceBuf.toString('base64')), 0);

  const audioBuf = Buffer.alloc(320);
  for (let i = 0; i < 160; i++) audioBuf.writeInt16LE(16000, i * 2);
  const audioRms = LiveDeadAirGuard.calculateBase64PcmRms(audioBuf.toString('base64'));
  assert(audioRms > 0.45, `Expected audioRms > 0.45, got ${audioRms}`);
  console.log('✅ Real calculateBase64PcmRms passed 100%');
}

testLiveDeadAirGuard();
testToolAudioMutex();
testSessionResumptionManager();
testPcmRms();
console.log('\n🎉 ALL SPEC 37 INVARIANT TESTS PASSED SUCCESSFULLY!');
