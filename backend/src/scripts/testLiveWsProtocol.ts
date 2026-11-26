/**
 * testLiveWsProtocol.ts
 * Deterministic unit test asserting Live Audio Protocol invariants & LiveVoiceSession Ports (SPEC-13 / Spec 46).
 * Asserts:
 * 1. Zero 'realtimeInput.interruption' frames dispatched on barge-in.
 * 2. 'realtimeInput.audioStreamEnd' is cleanly forwarded upstream on speech cessation.
 * 3. LiveVoiceSession.start accepts injected UpstreamTransportPort + LiveSessionBlueprint, enforces Turn 0 lockdown
 *    until candidate speech arrives via handleClientFrame, and disposes WatchdogManager cleanly on terminate().
 */

import { DownstreamClientPipe } from '../services/live/DownstreamClientPipe';
import { LiveVoiceSession } from '../services/live/LiveVoiceSession';
import { LiveSessionBlueprintBuilder } from '../services/live/LiveSessionBlueprintBuilder';
import { mergeInitFrameIntoConfig } from '../services/live/liveBlueprintParamParser';
import { SessionTurnState } from '../services/live/SessionTurnState';
import { EventEmitter } from 'events';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runTests() {
  console.log('🧪 Running Live WebSocket Protocol & Session Port Unit Test Suite...\n');

  // --- Suite 1: Direct DownstreamClientPipe protocol guards ---
  const clientSocket = new EventEmitter() as any;
  clientSocket.readyState = 1; // WebSocket.OPEN
  clientSocket.send = () => {};
  clientSocket.close = () => {};

  const sentUpstreamFrames: any[] = [];
  const geminiSocket = {
    readyState: 1,
    send: (data: string | Buffer) => {
      try { sentUpstreamFrames.push(JSON.parse(data.toString())); } catch { sentUpstreamFrames.push(data); }
    }
  };

  const session: any = {
    isTerminated: false,
    isSetupComplete: true,
    geminiSocket,
    frameQueue: [],
    fsm: { transition: () => {} },
    watchdogs: { arm: () => {}, armNudge: () => {}, armDeadAir: () => {}, disarmAll: () => {} }
  };

  const pipe = new DownstreamClientPipe({
    session,
    clientSocket,
    turnMode: 'auto',
    terminate: () => {}
  });

  pipe.handleFrame(Buffer.from(JSON.stringify({
    type: 'barge_in',
    bargeIn: true,
    bargeInType: 'tactile',
    epoch: Date.now()
  })));
  assert(!sentUpstreamFrames.find((f) => f?.realtimeInput?.interruption), 'Zero illegal realtimeInput.interruption frames dispatched upstream');

  pipe.handleFrame(Buffer.from(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })));
  assert(Boolean(sentUpstreamFrames.find((f) => f?.realtimeInput?.audioStreamEnd === true)), 'realtimeInput.audioStreamEnd is forwarded upstream for fast-handoff');
  assert(session.hasCandidateResponded === true, 'session.hasCandidateResponded is flagged true on audioStreamEnd');

  // --- Suite 2: LiveVoiceSession.start with injected Blueprint & UpstreamTransportPort ---
  const sessionClient = new EventEmitter() as any;
  sessionClient.readyState = 1;
  sessionClient.send = () => {};
  sessionClient.close = () => {};

  let upstreamConnectCalled = false;
  let upstreamClosed = false;
  const blueprint = await LiveSessionBlueprintBuilder.resolveFromParams(
    {
      userId: 'spec46_user',
      sessionType: 'interview',
      topic: 'Concurrency',
      questionText: 'Explain Virtual Threads'
    },
    {
      findGaps: async () => [],
      getUserProfile: () => ({ targetSeniority: 'Senior', primaryStack: 'Java 21' } as any),
      resolveChallenge: (input) => ({
        topic: input.queryTopic || 'Concurrency',
        bugTitle: '',
        questionText: input.queryQuestionText || 'Explain Virtual Threads',
        referenceAnswer: 'Virtual threads mount on carrier threads.',
        bugExplanation: '',
        fixedCode: '',
        codeSnippet: '',
        challengeCategory: '',
        challengeTrack: '',
        workspaceManifest: null,
        activeFilePath: ''
      })
    }
  );

  const liveSession = await LiveVoiceSession.start({
    clientSocket: sessionClient,
    blueprint,
    createUpstream: (opts) => {
      opts.session.isSetupComplete = true;
      return {
        connectGemini: () => { upstreamConnectCalled = true; },
        close: () => { upstreamClosed = true; }
      };
    }
  });

  assert(Boolean(liveSession), 'LiveVoiceSession.start initializes cleanly with injected blueprint + UpstreamTransportPort');
  assert(upstreamConnectCalled, 'Injected UpstreamTransportPort.connectGemini() invoked on start');
  assert(liveSession!.turnState.canExecuteGradingTools().allowed === false, 'Turn 0 lockdown blocks grading tools before candidate speech');

  SessionTurnState.armTurnWatchdogs(liveSession!.turnState.proxySession, sessionClient);
  assert(liveSession!.watchdogs.isArmed(), 'SessionTurnState.armTurnWatchdogs arms unified WatchdogManager');

  liveSession!.handleClientFrame(Buffer.from(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })));
  assert(liveSession!.turnState.hasCandidateResponded === true, 'handleClientFrame updates SessionTurnState.hasCandidateResponded');
  assert(liveSession!.turnState.canExecuteGradingTools().allowed === true, 'Turn 0 lockdown unlocks once candidate responded');

  liveSession!.terminate('Spec46TestComplete', 1000, 'UnitTest');
  assert(upstreamClosed, 'LiveVoiceSession.terminate closes injected UpstreamTransportPort');
  assert(!liveSession!.watchdogs.isArmed(), 'LiveVoiceSession.terminate disposes WatchdogManager cleanly');

  // --- Suite 3: Spec 53 Slim Handshake Barrier (?awaitInit=1) + HR context mapping ---
  const delayedClient = new EventEmitter() as any;
  delayedClient.readyState = 1;
  delayedClient.send = () => {};
  delayedClient.close = () => {};
  const delayedEarlyQueue: any[] = [];
  let receivedInitFrame: any = null;
  const barrierStartedAt = Date.now();
  setTimeout(() => {
    delayedClient.emit(
      'message',
      Buffer.from(JSON.stringify({
        type: 'session_init',
        sessionId: 'spec53_barrier_sess',
        dossierId: 'dossier_abc',
        jobId: 'job_xyz',
        questionMatrixId: 'matrix_9',
        hrMode: 'guided_zero_start'
      }))
    );
  }, 15);

  const barrierSession = await LiveVoiceSession.start({
    clientSocket: delayedClient,
    req: { url: '/ws/live?sessionId=spec53_barrier_sess&awaitInit=1' } as any,
    earlyQueue: delayedEarlyQueue,
    initWaitTimeoutMs: 150,
    blueprintBuilder: async (_req, rawInitFrame) => {
      receivedInitFrame = rawInitFrame;
      return blueprint;
    },
    createUpstream: (opts) => {
      opts.session.isSetupComplete = true;
      return { connectGemini: () => {}, close: () => {} };
    }
  });
  const barrierElapsed = Date.now() - barrierStartedAt;
  assert(Boolean(barrierSession), 'Spec 53 ?awaitInit=1 barrier initializes cleanly after deferred session_init');
  assert(receivedInitFrame?.dossierId === 'dossier_abc' && receivedInitFrame?.questionMatrixId === 'matrix_9', 'Spec 53 ?awaitInit=1 barrier receives deferred session_init before blueprint build');
  assert(barrierElapsed < 120, `Spec 53 ?awaitInit=1 wakes immediately upon session_init arrival (${barrierElapsed}ms < 120ms)`);
  barrierSession!.terminate('Spec53BarrierTestComplete', 1000, 'UnitTest');

  const mergedConfig: any = { ...blueprint.config, promptConfig: { ...blueprint.config.promptConfig } };
  mergeInitFrameIntoConfig(mergedConfig, receivedInitFrame);
  assert(
    mergedConfig.dossierId === 'dossier_abc' &&
      mergedConfig.jobId === 'job_xyz' &&
      mergedConfig.questionMatrixId === 'matrix_9' &&
      mergedConfig.hrMode === 'guided_zero_start',
    'mergeInitFrameIntoConfig maps dossierId, jobId, questionMatrixId, and hrMode'
  );

  const timeoutClient = new EventEmitter() as any;
  timeoutClient.readyState = 1;
  timeoutClient.send = () => {};
  timeoutClient.close = () => {};
  let timeoutInitFrame: any = 'not-called';
  const timeoutSession = await LiveVoiceSession.start({
    clientSocket: timeoutClient,
    req: { url: '/ws/live?sessionId=spec53_timeout&awaitInit=1' } as any,
    earlyQueue: [],
    initWaitTimeoutMs: 25,
    blueprintBuilder: async (_req, rawInitFrame) => {
      timeoutInitFrame = rawInitFrame;
      return blueprint;
    },
    createUpstream: (opts) => {
      opts.session.isSetupComplete = true;
      return { connectGemini: () => {}, close: () => {} };
    }
  });
  assert(Boolean(timeoutSession) && timeoutInitFrame === undefined, 'Spec 53 ?awaitInit=1 timeout degrades gracefully without failing handshake');
  timeoutSession!.terminate('Spec53TimeoutTestComplete', 1000, 'UnitTest');

  console.log('\n🎉 All Live WebSocket Protocol & Session Port tests passed successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test error:', err);
  process.exit(1);
});
