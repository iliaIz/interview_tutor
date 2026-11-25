/**
 * liveVoiceEngine.test.ts
 * Contract test for Headless NativeLiveVoiceEngine (SOTA Late 2026 / Spec 47).
 * Tests purely through public engine interface + injected LiveTransportPort & LiveAudioIOPort
 * with zero internal `(engine as any)` property/method bypasses.
 */

import assert from 'assert';
import { NativeLiveVoiceEngine as LiveVoiceEngine } from '../src/audio/NativeLiveVoiceEngine';
import { MicrophoneMetrics } from '../src/audio/MicrophoneCapture';
import {
  VoiceEngineState,
  VoiceEngineCallbacks,
  LiveTransportPort,
  LiveTransportConnection,
  LiveAudioIOPort
} from '../src/audio/types';

class FakeTransportPort implements LiveTransportPort {
  public lastUrl = '';
  public sentMessages: string[] = [];
  public closedWith: Array<{ code?: number; reason?: string }> = [];
  private open = false;
  private handlers: {
    onOpen: () => void;
    onMessage: (data: unknown) => void;
    onClose: (code?: number) => void;
    onError: (err: unknown) => void;
  } | null = null;

  public connect(
    url: string,
    handlers: {
      onOpen: () => void;
      onMessage: (data: unknown) => void;
      onClose: (code?: number) => void;
      onError: (err: unknown) => void;
    }
  ): LiveTransportConnection {
    this.lastUrl = url;
    this.handlers = handlers;
    this.open = true;
    queueMicrotask(() => {
      if (this.open) handlers.onOpen();
    });
    return {
      send: (payload: string) => {
        if (this.open) this.sentMessages.push(payload);
      },
      close: (code?: number, reason?: string) => {
        this.open = false;
        this.closedWith.push({ code, reason });
      },
      isOpen: () => this.open
    };
  }

  public emitServerMessage(payload: Record<string, unknown>): void {
    this.handlers?.onMessage(JSON.stringify(payload));
  }

  public emitRemoteClose(code: number): void {
    this.open = false;
    this.handlers?.onClose(code);
  }
}

class FakeAudioIOPort implements LiveAudioIOPort {
  public playing = false;
  public muted = false;
  public enqueuedPcm: string[] = [];
  public interruptCount = 0;
  public captureStarted = false;
  private onFrameCb: ((pcm: string, metrics?: MicrophoneMetrics) => void) | null = null;
  private onPlayoutFinishedCb: (() => void) | null = null;

  public async startCapture(
    onFrame: (pcm: string, metrics?: MicrophoneMetrics) => void,
    _onLevel: (db: number) => void
  ): Promise<void> {
    this.captureStarted = true;
    this.onFrameCb = onFrame;
  }

  public stopCapture(): void {
    this.captureStarted = false;
    this.onFrameCb = null;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public enqueuePcm(pcm: string): void {
    this.enqueuedPcm.push(pcm);
    this.playing = true;
  }

  public interruptPlayout(): void {
    this.interruptCount++;
    this.playing = false;
  }

  public notifyTurnComplete(): void {}

  public handlePlayoutFinished(cb: () => void): void {
    this.onPlayoutFinishedCb = cb;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public clearPlayout(): void {
    this.playing = false;
    this.enqueuedPcm = [];
  }

  public emitMicChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
    this.onFrameCb?.(base64Pcm, metrics);
  }

  public finishPlayoutDrain(): void {
    this.playing = false;
    this.onPlayoutFinishedCb?.();
  }
}

function createHarness(callbacks: VoiceEngineCallbacks = {}) {
  const transport = new FakeTransportPort();
  const audio = new FakeAudioIOPort();
  const engine = new LiveVoiceEngine(callbacks, { transport, audio });
  return { engine, transport, audio };
}

async function runLiveVoiceEngineTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🧪 SOTA 2026 HEADLESS LIVE VOICE ENGINE CONTRACT TESTS');
  console.log('═══════════════════════════════════════════════════════════════');

  const statesObserved: VoiceEngineState[] = [];
  const statusMessages: string[] = [];

  const { engine, transport } = createHarness({
    onStateChange: (state) => statesObserved.push(state),
    onStatusMessage: (msg) => statusMessages.push(msg)
  });

  // Test 1: Initial State
  assert.strictEqual(engine.getSnapshot().state, 'IDLE', 'Initial state must be IDLE');
  console.log('  ✅ Test 1 Passed: Initial state is IDLE');

  // Test 2: Connection Lifecycle & Terminal Equivalence
  await engine.connect({
    sessionId: 'test_engine_sess_1',
    questionId: 'Q_1',
    sessionType: 'interview',
    topic: 'Java',
    turnMode: 'auto'
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(engine.getSnapshot().state, 'CONNECTING', 'State transitions to CONNECTING on connect');
  console.log('  ✅ Test 2 Passed: Connect transitions state to CONNECTING');

  // Test 3 & 4: modelTurn -> AI_SPEAKING -> generationComplete -> LISTENING
  transport.emitServerMessage({ serverContent: { modelTurn: { parts: [{ text: 'Привет! Расскажи о Spring Boot.' }] } } });
  assert.strictEqual(engine.getSnapshot().state, 'AI_SPEAKING');
  transport.emitServerMessage({ serverContent: { generationComplete: true } });
  assert.strictEqual(engine.getSnapshot().state, 'LISTENING');
  console.log('  ✅ Test 3 & 4 Passed: modelTurn -> AI_SPEAKING & generationComplete -> LISTENING');

  // Test 5 & 5b: Tactile Barge-In via dispatch CENTRAL_ACTION & BARGE_IN
  transport.emitServerMessage({ serverContent: { modelTurn: { parts: [{ text: 'Продолжаю рассказ...' }] } } });
  assert.strictEqual(engine.getSnapshot().state, 'AI_SPEAKING');
  engine.dispatch({ type: 'CENTRAL_ACTION' });
  assert.strictEqual(engine.getSnapshot().state, 'LISTENING');
  const lastSent = JSON.parse(transport.sentMessages[transport.sentMessages.length - 1]);
  assert.strictEqual(lastSent.bargeIn, true);
  assert.strictEqual(lastSent.type, 'barge_in');

  transport.emitServerMessage({ serverContent: { modelTurn: { parts: [{ text: 'Еще одна реплика...' }] } } });
  engine.dispatch({ type: 'BARGE_IN', source: 'tactile' });
  assert.strictEqual(engine.getSnapshot().state, 'LISTENING');
  console.log('  ✅ Test 5 & 5b Passed: Tactile barge-in cuts AI speech and transitions to LISTENING');

  // Test 7, 8, 9, 10: interactionStatus, evaluation_completed, whiteboard_update
  let receivedEvaluation: any = null;
  let receivedWhiteboard: any = null;
  const { engine: engine2, transport: ws2 } = createHarness({
    onEvaluationReceived: (res) => { receivedEvaluation = res; },
    onWhiteboardUpdate: (wb) => { receivedWhiteboard = wb; }
  });
  await engine2.connect({ sessionId: 'test_engine_sess_2', questionId: 'Q_2', sessionType: 'interview', topic: 'Spring' });

  ws2.emitServerMessage({ serverContent: { modelTurn: { parts: [{ text: 'Дай подумать...' }] } } });
  ws2.emitServerMessage({ serverContent: { turnComplete: true, interactionStatus: 'IN_PROGRESS' } });
  assert.strictEqual(engine2.getSnapshot().state, 'AI_SPEAKING', 'Mic remains locked on IN_PROGRESS');

  ws2.emitServerMessage({ serverContent: { turnComplete: true, interactionStatus: 'IDLE' } });
  assert.strictEqual(engine2.getSnapshot().state, 'LISTENING', 'Mic unlocked on IDLE');

  ws2.emitServerMessage({
    type: 'evaluation_completed',
    evaluation: {
      score: 95,
      isPassed: true,
      feedback: 'Отличный ответ по Spring!',
      positivePoints: ['DI/IoC'],
      missingPoints: []
    }
  });
  assert.strictEqual(engine2.getSnapshot().state, 'COMPLETED');
  assert.strictEqual(receivedEvaluation?.score, 95);

  ws2.emitServerMessage({
    type: 'whiteboard_update',
    payload: { code: '@Service\npublic class PaymentService {}', language: 'java', title: 'Архитектура сервиса' }
  });
  assert.strictEqual(receivedWhiteboard?.title, 'Архитектура сервиса');
  console.log('  ✅ Test 7–10 Passed: interactionStatus, evaluation_completed, and whiteboard_update verified');

  // Test 11: Turn 0 Acoustic Lockdown & Dual-Sided Handshake Playout Drain Race
  const { engine: engine3, transport: ws3, audio: audio3 } = createHarness();
  await engine3.connect({ sessionId: 'test_sess_3', questionId: 'Q_3', sessionType: 'interview' });
  ws3.emitServerMessage({ serverContent: { modelTurn: { parts: [{ text: 'Привет! Расскажи о Spring Boot...' }] } } });
  assert.strictEqual(engine3.getSnapshot().state, 'AI_SPEAKING');

  // Mic bleed during Turn 0 MUST NOT barge in
  audio3.emitMicChunk('dummy_pcm_base64', { speechDetected: true, rmsDb: -15 });
  assert.strictEqual(engine3.getSnapshot().state, 'AI_SPEAKING', 'Turn 0 lockdown protects question recitation');

  // Race A: PCM audio still playing when turnComplete arrives -> stays AI_SPEAKING until audio drain finishes
  audio3.playing = true;
  ws3.emitServerMessage({ serverContent: { turnComplete: true, interactionStatus: 'IDLE' } });
  assert.strictEqual(engine3.getSnapshot().state, 'AI_SPEAKING', 'Mic locked while audio actively playing');

  audio3.finishPlayoutDrain();
  assert.strictEqual(engine3.getSnapshot().state, 'LISTENING', 'Mic unlocked after physical audio finish');

  // Mid-dialogue acoustic barge-in triggers after Turn 0 concludes
  ws3.emitServerMessage({ serverContent: { modelTurn: { parts: [{ text: 'Длинное объяснение...' }] } } });
  audio3.emitMicChunk('dummy_pcm_base64', { speechDetected: true, rmsDb: -15 });
  assert.strictEqual(engine3.getSnapshot().state, 'LISTENING', 'Mid-dialogue acoustic speech triggers barge-in');
  const acousticSent = JSON.parse(ws3.sentMessages[ws3.sentMessages.length - 1]);
  assert.strictEqual(acousticSent.bargeInType, 'acoustic');
  console.log('  ✅ Test 11 Passed: Turn 0 lockdown, Dual-Sided Handshake & acoustic barge-in verified');

  // Test 12: Dead-Air Recovery via COMMIT_TURN + dead_air_recovery
  const { engine: engine4, transport: ws4 } = createHarness();
  await engine4.connect({ sessionId: 'test_sess_4', questionId: 'Q_4', sessionType: 'interview', isResumed: true });
  ws4.emitServerMessage({ type: 'setupComplete' });
  assert.strictEqual(engine4.getSnapshot().isCandidateTurnActive, true);

  engine4.dispatch({ type: 'COMMIT_TURN' });
  assert.strictEqual(engine4.getSnapshot().internalState, 'COMMITTING');
  assert.strictEqual(engine4.getSnapshot().isCandidateTurnActive, false);

  ws4.emitServerMessage({ type: 'dead_air_recovery', reason: 'upstream_timeout', timestamp: Date.now() });
  assert.strictEqual(engine4.getSnapshot().internalState, 'CANDIDATE_LISTENING');
  assert.strictEqual(engine4.getSnapshot().isCandidateTurnActive, true);
  console.log('  ✅ Test 12 Passed: dead_air_recovery unfreezes FSM to CANDIDATE_LISTENING');

  // Test 13: Transient Suppression & 7-Frame Minimum Voicing Duration
  let transientFilteredCount = 0;
  const { engine: engine5, transport: ws5, audio: audio5 } = createHarness({
    onTransientFiltered: () => { transientFilteredCount++; }
  });
  await engine5.connect({ sessionId: 'test_sess_5', questionId: 'Q_5', sessionType: 'interview', isResumed: true });

  ws5.emitServerMessage({ serverContent: { modelTurn: { parts: [{ text: 'Объяснение...' }] } } });
  audio5.emitMicChunk('cough_pcm_data', { isTransientSpike: true, rmsDb: -15 });
  assert.strictEqual(engine5.getSnapshot().state, 'AI_SPEAKING');
  assert.strictEqual(transientFilteredCount, 1);

  audio5.emitMicChunk('bleed_pcm_data', { isTransientSpike: false, rmsDb: -35 });
  assert.strictEqual(engine5.getSnapshot().state, 'AI_SPEAKING');

  for (let f = 1; f <= 6; f++) {
    audio5.emitMicChunk('speech_pcm_data', { isTransientSpike: false, rmsDb: -25 });
    assert.strictEqual(engine5.getSnapshot().state, 'AI_SPEAKING');
  }
  audio5.emitMicChunk('speech_pcm_data', { isTransientSpike: false, rmsDb: -25 });
  assert.strictEqual(engine5.getSnapshot().state, 'LISTENING');

  audio5.emitMicChunk('cough_pcm_data', { isTransientSpike: true, rmsDb: -12 });
  const lastChunkMsg = JSON.parse(ws5.sentMessages[ws5.sentMessages.length - 1]);
  assert.strictEqual(lastChunkMsg.realtimeInput.audio.data.length, 1368);
  console.log('  ✅ Test 13 Passed: Transient clamp & 7-frame voicing floor verified');

  // Test 14: Multimodal Whiteboard + Speech Hold (tool_awaiting_speech)
  const { engine: engine6, transport: ws6 } = createHarness();
  let err6: { msg: string; retryable: boolean; code?: string } | null = null;
  const { engine: engine6WithErr, transport: ws6Err } = createHarness({
    onError: (msg, retryable, code) => { err6 = { msg, retryable, code }; }
  });
  await engine6WithErr.connect({ sessionId: 'test_sess_6', questionId: 'Q_6', sessionType: 'interview', isResumed: true });
  ws6Err.emitServerMessage({ type: 'setupComplete' });
  assert.strictEqual(engine6WithErr.getSnapshot().state, 'LISTENING');

  ws6Err.emitServerMessage({
    serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAA=' } }] } }
  });
  ws6Err.emitServerMessage({ type: 'tool_awaiting_speech', tools: ['update_whiteboard'] });
  ws6Err.emitServerMessage({ serverContent: { turnComplete: true } });
  assert.strictEqual(engine6WithErr.getSnapshot().internalState, 'AI_THINKING');
  assert.strictEqual(engine6WithErr.getSnapshot().state, 'CONNECTING');

  ws6Err.emitServerMessage({
    serverContent: { modelTurn: { parts: [{ text: 'Поясняю фрагмент на доске.' }] }, turnComplete: true }
  });
  assert.strictEqual(engine6WithErr.getSnapshot().internalState, 'CANDIDATE_LISTENING');
  console.log('  ✅ Test 14 Passed: tool_awaiting_speech holds AI_THINKING until speech completes');

  // Test 15 & 16: Hot Handoff + Sync Pong Dead-Link + upstream_error + SET_MUTED snapshot
  ws6Err.emitServerMessage({ type: 'hot_handoff_started', timeLeftSeconds: 50 });
  assert.strictEqual(engine6WithErr.getSnapshot().state, 'LISTENING');
  ws6Err.emitServerMessage({ type: 'hot_handoff_complete', mode: 'resumption' });
  assert.strictEqual(engine6WithErr.getSnapshot().state, 'LISTENING');

  engine6WithErr.dispatch({ type: 'SET_MUTED', muted: true });
  assert.strictEqual(engine6WithErr.getSnapshot().isMuted, true);

  ws6Err.emitServerMessage({ type: 'sync_pong', isUpstreamConnected: false, isUpstreamReconnecting: false, isHandoffActive: false });
  assert.strictEqual(engine6WithErr.getSnapshot().state, 'LISTENING');
  ws6Err.emitServerMessage({ type: 'sync_pong', isUpstreamConnected: false, isUpstreamReconnecting: false, isHandoffActive: false });
  assert.strictEqual(engine6WithErr.getSnapshot().state, 'ERROR');
  assert.strictEqual((err6 as any)?.code, 'UPSTREAM_LINK_LOST');

  let err7: { msg: string; retryable: boolean; code?: string } | null = null;
  const { engine: engine7, transport: ws7 } = createHarness({
    onError: (msg, retryable, code) => { err7 = { msg, retryable, code }; }
  });
  await engine7.connect({ sessionId: 'test_sess_7', questionId: 'Q_7', sessionType: 'interview', isResumed: true });
  ws7.emitServerMessage({
    type: 'upstream_error',
    error: 'Upstream pool exhausted',
    errorCode: 'RECONNECT_ATTEMPTS_EXHAUSTED',
    retryable: true
  });
  assert.strictEqual(engine7.getSnapshot().state, 'ERROR');
  assert.strictEqual((err7 as any)?.retryable, true);
  assert.strictEqual((err7 as any)?.code, 'RECONNECT_ATTEMPTS_EXHAUSTED');
  console.log('  ✅ Test 15 & 16 Passed: Port-injected hot handoff, SET_MUTED snapshot, sync_pong & upstream_error verified');

  [engine, engine2, engine3, engine4, engine5, engine6, engine6WithErr, engine7].forEach((e) => e.disconnect());
  console.log('\n🎉 ALL HEADLESS LIVE VOICE ENGINE CONTRACTS SATISFIED (0 white-box casts)!');
}

runLiveVoiceEngineTests()
  .then(() => process.exit(0))
  .catch((err) => { console.error('❌ Contract Test Failed:', err); process.exit(1); });
