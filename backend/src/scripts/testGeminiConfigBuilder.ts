/**
 * testGeminiConfigBuilder.ts
 *
 * Deterministic Unit Test Suite for buildGeminiLiveSetupMessage (Wave 14 Native SOTA).
 * Validates canonical Gemini 3.8 Live setup frames:
 * 1. Standard model (gemini-live-v3): temp 1.0, native Cloud VAD, NO thinkingConfig, NO sessionResumption handle.
 * 2. Thinking model (gemini-live-thinking-v3): thinkingConfig with thinkingLevel='low' and includeThoughts=true.
 * 3. Automatic activity detection calibration (silenceDurationMs, low sensitivities, prefixPaddingMs).
 * 4. Asynchronous non-blocking tools preservation.
 */

import http from 'http';
import { buildGeminiLiveSetupMessage } from '../services/live/liveGeminiConfigBuilder';
import { LiveSessionBlueprintBuilder } from '../services/live/LiveSessionBlueprintBuilder';
import { LiveVoiceSession } from '../services/live/LiveVoiceSession';
import type { BlueprintDependencies, ChallengeResolutionInput } from '../services/live/liveSessionConfigTypes';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} ${detail ? `(${detail})` : ''}`);
  }
}

console.log('🧪 Running buildGeminiLiveSetupMessage Unit Test Suite...\n');

// Test 1: Standard gemini-live-v3 model setup configuration
const standardSetup = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'Aoede',
  systemPromptText: 'You are a senior technical interviewer.',
  sessionType: 'interview',
  strategy: 'adaptive_probing',
  normalizedTools: []
});

assert(standardSetup.setup.model === 'models/gemini-live-v3', 'Standard model name correctly prefixed');
assert(standardSetup.setup.generationConfig.temperature === 1.0, 'Temperature defaults to 1.0 for audio vocoder stability');
assert(standardSetup.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Aoede', 'Voice Aoede resolved correctly');
assert(standardSetup.setup.generationConfig.thinkingConfig === undefined, 'Standard model must NOT include thinkingConfig');
assert(standardSetup.setup.sessionResumption === undefined, 'Setup frame must NOT include sessionResumption (prevents 1008 across rotated keys)');

// Test 2: Native Cloud VAD configuration
const aad = standardSetup.setup.realtimeInputConfig.automaticActivityDetection;
assert(aad.disabled === false, 'Auto-VAD is enabled by default in auto turn mode');
assert(aad.silenceDurationMs === 500, 'Native silenceDurationMs calibrated to 500ms');
assert(aad.startOfSpeechSensitivity === 'START_SENSITIVITY_LOW', 'Start sensitivity set to START_SENSITIVITY_LOW');
assert(aad.endOfSpeechSensitivity === 'END_SENSITIVITY_LOW', 'End sensitivity set to END_SENSITIVITY_LOW');
assert(aad.prefixPaddingMs === 200, 'Audio prefix padding calibrated to 200ms');

// Test 3: Thinking model (gemini-live-thinking-v3) configuration
const thinkingSetup = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-thinking-v3',
  voiceName: 'Puck',
  systemPromptText: 'You are a technical tutor.',
  sessionType: 'tutor',
  strategy: 'socratic_tutoring',
  normalizedTools: []
});

assert(thinkingSetup.setup.model === 'models/gemini-live-thinking-v3', 'Thinking model name correctly prefixed');
assert(thinkingSetup.setup.generationConfig.thinkingConfig?.thinkingLevel === 'low', 'Thinking model has thinkingLevel: low');
assert(thinkingSetup.setup.generationConfig.thinkingConfig?.includeThoughts === true, 'Thinking model has includeThoughts: true');

// Test 4: Tool Declarations preservation
const dummyTools = [
  {
    name: 'read_workspace_file',
    description: 'Reads a project file.',
    behavior: 'NON_BLOCKING',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] }
  }
];

const toolsSetup = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'Puck',
  systemPromptText: 'Interviewer with tools.',
  sessionType: 'interview',
  strategy: 'adaptive_probing',
  normalizedTools: dummyTools
});

assert(Array.isArray(toolsSetup.setup.tools), 'Tools array is defined when tools provided');
assert(toolsSetup.setup.tools[0].functionDeclarations[0].name === 'read_workspace_file', 'Tool name preserved');
assert(toolsSetup.setup.tools[0].functionDeclarations[0].behavior === 'NON_BLOCKING', 'NON_BLOCKING behavior preserved');

// Test 5: Voice fallback for invalid voice name
const fallbackSetup = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'InvalidVoice123',
  systemPromptText: 'Prompt',
  sessionType: 'interview',
  strategy: 'adaptive_probing',
  normalizedTools: []
});

assert(fallbackSetup.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Kore', 'Invalid voice safely falls back to canonical Kore');

// Test 6+: Canonical contextWindowCompression & sessionResumption wire fields (Spec 42)
assert(
  Boolean(standardSetup.setup.contextWindowCompression?.slidingWindow),
  'Setup includes contextWindowCompression.slidingWindow to bypass 15-min ceiling'
);
assert(
  standardSetup.setup.sessionResumptionConfig === undefined,
  'Legacy sessionResumptionConfig field is eliminated'
);

const resumedSetup = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'Kore',
  systemPromptText: 'Prompt',
  sessionType: 'tutor',
  strategy: 'socratic_tutoring',
  normalizedTools: [],
  resumptionHandle: 'crypto_handle_spec42'
});
assert(
  resumedSetup.setup.sessionResumption?.handle === 'crypto_handle_spec42',
  'Resumed setup sets canonical setup.sessionResumption.handle'
);
assert(
  resumedSetup.setup.sessionResumptionConfig === undefined,
  'Resumed setup omits legacy sessionResumptionConfig field'
);

// Test 6: Low temperature clamp for vocoder stability (Spec 17)
const clampedSetup = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'Puck',
  systemPromptText: 'Prompt',
  sessionType: 'interview',
  strategy: 'adaptive_probing',
  temperature: 0.2,
  normalizedTools: []
});
assert(clampedSetup.setup.generationConfig.temperature === 1.0, 'Low temperature < 0.7 clamped to 1.0 for vocoder stability');

// Test 7: Global Auto-VAD silenceDurationMs range [500, 2500] and Manual Mode preservation
const vad1800 = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'Aoede',
  systemPromptText: 'Prompt',
  sessionType: 'interview',
  strategy: 'adaptive_probing',
  vadPauseMs: 1800,
  turnMode: 'auto',
  normalizedTools: []
});
assert(vad1800.setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs === 1800, 'UI default 1800ms passes through unclamped');

const vadClampedHigh = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'Aoede',
  systemPromptText: 'Prompt',
  sessionType: 'interview',
  strategy: 'adaptive_probing',
  vadPauseMs: 3500,
  turnMode: 'auto',
  normalizedTools: []
});
assert(vadClampedHigh.setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs === 2500, 'Extreme pause clamps to 2500ms ceiling');

const manualSetup = buildGeminiLiveSetupMessage({
  liveModel: 'gemini-live-v3',
  voiceName: 'Kore',
  systemPromptText: 'Prompt',
  sessionType: 'interview',
  strategy: 'adaptive_probing',
  vadPauseMs: 1800,
  turnMode: 'manual',
  normalizedTools: []
});
assert(manualSetup.setup.realtimeInputConfig.automaticActivityDetection.disabled === true, 'Manual turn mode preserves automaticActivityDetection.disabled: true');

async function runBlueprintBuilderTests() {
  console.log('\n🧪 Running LiveSessionBlueprintBuilder (Spec 45) Test Suite...');

  const stubDeps: BlueprintDependencies = {
    authenticate: (_req, query) => (query.ticket === 'valid_ticket' ? { id: 'user_spec45', name: 'Test Candidate', role: 'user' } : null),
    findGaps: async () => [],
    getUserProfile: () => ({ targetSeniority: 'Senior', primaryStack: 'Java 21, Spring Boot 3.4' } as any),
    resolveChallenge: (input: ChallengeResolutionInput) => ({
      topic: input.queryTopic || 'Java Concurrency',
      bugTitle: input.queryBugTitle || '',
      questionText: input.queryQuestionText || 'Explain volatile.',
      referenceAnswer: input.queryReferenceAnswer || 'Memory visibility and happens-before ordering.',
      bugExplanation: input.queryBugExplanation || '',
      fixedCode: input.queryFixedCode || '',
      codeSnippet: input.queryCodeSnippet || '',
      challengeCategory: input.queryChallengeCategory || '',
      challengeTrack: input.queryChallengeTrack || '',
      workspaceManifest: null,
      activeFilePath: input.queryActiveFilePath || ''
    })
  };

  // Test 8: Auth rejection returns null
  const unauthReq = { url: '/ws/live?sessionType=interview', headers: {} } as unknown as http.IncomingMessage;
  const unauthBlueprint = await LiveSessionBlueprintBuilder.resolveFromRequest(unauthReq, undefined, stubDeps);
  assert(unauthBlueprint === null, 'resolveFromRequest rejects unauthorized request with null');

  // Test 9: resolveFromRequest merges early session_init (vadPauseMs + academyBridgeContext + seniorReview + voice) BEFORE upstream setup
  const authReq = {
    url: '/ws/live?ticket=valid_ticket&sessionType=tutor&tutorMode=practice_pair&voice=Aoede&vadPauseMs=1200&questionId=kata_rate_limiter',
    headers: {}
  } as unknown as http.IncomingMessage;

  const earlyInitFrame = {
    type: 'session_init',
    voice: 'Puck',
    vadPauseMs: 2400,
    academyBridgeContext: {
      courseId: 'concurrency-deep-dive',
      stepId: 'step-volatile',
      moduleTitle: 'JMM & Happens-Before',
      learningObjective: 'Master volatile write-read visibility',
      targetConcepts: ['StoreLoad', 'Cache coherence']
    },
    seniorReview: {
      overallScore: 78,
      summaryReview: 'Missing memory fence reasoning',
      focusedFinding: {
        category: 'Concurrency',
        location: 'TokenBucket.java:42',
        description: 'Non-volatile refill timestamp read without synchronization',
        remediation: 'Use AtomicReference or volatile'
      }
    },
    workspaceManifest: {
      activeFile: { path: 'src/TokenBucket.java', content: 'public class TokenBucket {}' },
      files: [{ path: 'src/TokenBucket.java', content: 'public class TokenBucket {}' }]
    }
  };

  const practiceBlueprint = await LiveSessionBlueprintBuilder.resolveFromRequest(authReq, earlyInitFrame, stubDeps);
  assert(practiceBlueprint !== null, 'resolveFromRequest resolves blueprint for authorized request');
  if (practiceBlueprint) {
    assert(practiceBlueprint.config.voiceName === 'Puck', 'session_init overrides voice to Puck before connect');
    assert(practiceBlueprint.config.vadPauseMs === 2400, 'session_init overrides vadPauseMs to 2400 before connect');
    assert(practiceBlueprint.config.academyBridgeContext?.moduleTitle === 'JMM & Happens-Before', 'session_init hydrates academyBridgeContext');
    assert(practiceBlueprint.config.seniorReview?.overallScore === 78, 'session_init hydrates seniorReview');
    assert(practiceBlueprint.systemPromptText.includes('JMM & Happens-Before'), 'systemPromptText embeds hydrated academyBridgeContext');

    const setupBeforeConnect = practiceBlueprint.buildUpstreamSetup() as any;
    assert(setupBeforeConnect.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Puck', 'buildUpstreamSetup() carries session_init voice Puck');
    assert(setupBeforeConnect.setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs === 2400, 'buildUpstreamSetup() carries session_init vadPauseMs=2400');
    assert(setupBeforeConnect.setup.systemInstruction.parts[0].text.includes('JMM & Happens-Before'), 'buildUpstreamSetup() systemInstruction carries hydrated academyBridgeContext');
    assert(Boolean(setupBeforeConnect.setup.contextWindowCompression?.slidingWindow), 'buildUpstreamSetup() preserves Spec 42 compression');

    const dynamicResumed = practiceBlueprint.buildUpstreamSetup('crypto_spec45') as any;
    assert(dynamicResumed.setup.sessionResumption?.handle === 'crypto_spec45', 'buildUpstreamSetup(handle) injects sessionResumption.handle');
    assert(dynamicResumed.setup.sessionResumptionConfig === undefined, 'buildUpstreamSetup(handle) omits legacy sessionResumptionConfig');
    const strippedResumed = practiceBlueprint.buildUpstreamSetup(undefined) as any;
    assert(strippedResumed.setup.sessionResumption === undefined, 'buildUpstreamSetup(undefined) strips stale resumption handle');
  }

  // Test 10: session_init merges hrMode + startBeatId + beatScope into HR blueprint before connect
  const hrReq = {
    url: '/ws/live?ticket=valid_ticket&sessionType=hr_tutor&questionId=hr_q0_elevator_pitch&hrMode=tutor_rehearsal',
    headers: {}
  } as unknown as http.IncomingMessage;
  const hrInitFrame = {
    type: 'session_init',
    hrMode: 'guided_zero_start',
    startBeatId: 'beat_0_2_scale_kafka',
    beatScope: 'single_beat',
    vadPauseMs: 2100
  };
  const hrBlueprint = await LiveSessionBlueprintBuilder.resolveFromRequest(hrReq, hrInitFrame, stubDeps);
  assert(hrBlueprint !== null, 'HR resolveFromRequest resolves blueprint');
  if (hrBlueprint) {
    assert(hrBlueprint.config.hrMode === 'guided_zero_start', 'session_init overrides hrMode to guided_zero_start');
    assert(hrBlueprint.config.startBeatId === 'q01_b2', 'session_init hydrates startBeatId');
    assert(hrBlueprint.config.beatScope === 'single_beat', 'session_init hydrates beatScope');
    const hrSetup = hrBlueprint.buildUpstreamSetup() as any;
    assert(hrSetup.setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs === 2100, 'HR setup carries session_init vadPauseMs=2100');
    const hrGreeting = hrBlueprint.buildTurn0Greeting();
    assert(hrGreeting.includes('Изолированная тренировка одного блока'), 'HR Turn 0 greeting reflects single_beat startBeatId scope');
  }

  // Test 11: resolveFromParams & Turn 0 greeting parity across WS & LiveKit modes
  const lkSysDesign = await LiveSessionBlueprintBuilder.resolveFromParams(
    { sessionType: 'system_design', topic: 'Distributed Rate Limiter', questionText: 'Design Rate Limiter' },
    stubDeps
  );
  const wsSysDesignGreeting = LiveSessionBlueprintBuilder.resolveTurn0GreetingText({
    sessionType: 'system_design',
    topic: 'Distributed Rate Limiter',
    questionText: 'Design Rate Limiter'
  });
  assert(lkSysDesign.buildTurn0Greeting() === wsSysDesignGreeting && wsSysDesignGreeting.includes('Distributed Rate Limiter'), 'System design Turn 0 greeting matches identically across WS and LiveKit');

  const lkPractice = await LiveSessionBlueprintBuilder.resolveFromParams(
    {
      sessionType: 'tutor',
      tutorMode: 'practice_pair',
      questionId: 'kata_rate_limiter',
      academyBridgeContext: earlyInitFrame.academyBridgeContext,
      seniorReview: earlyInitFrame.seniorReview,
      workspaceManifest: earlyInitFrame.workspaceManifest
    },
    stubDeps
  );
  assert(
    practiceBlueprint !== null && lkPractice.buildTurn0Greeting() === practiceBlueprint.buildTurn0Greeting(),
    'Practice pair Turn 0 greeting with seniorReview matches identically across WS and LiveKit'
  );

  // Test 12: LiveVoiceSession.extractEarlySessionInit detects session_init in earlyQueue without consuming audio frames
  const earlyQueue = [
    Buffer.from(JSON.stringify({ realtimeInput: { audio: { data: 'AAAA', mimeType: 'audio/pcm;rate=16000' } } })),
    Buffer.from(JSON.stringify(earlyInitFrame))
  ];
  const extractedInit = LiveVoiceSession.extractEarlySessionInit(earlyQueue);
  assert(extractedInit?.type === 'session_init' && extractedInit?.vadPauseMs === 2400, 'extractEarlySessionInit extracts session_init from Buffer earlyQueue');
  assert(earlyQueue.length === 2, 'extractEarlySessionInit leaves earlyQueue intact for DownstreamClientPipe');
}

runBlueprintBuilderTests()
  .then(() => {
    console.log(`\n📊 GeminiConfigBuilder Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error('❌ Test suite threw error:', err);
    process.exit(1);
  });
