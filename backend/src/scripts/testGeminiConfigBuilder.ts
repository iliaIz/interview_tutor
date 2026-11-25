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

import { buildGeminiLiveSetupMessage } from '../services/live/liveGeminiConfigBuilder';

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

console.log(`\n📊 GeminiConfigBuilder Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
