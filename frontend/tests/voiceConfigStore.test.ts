/**
 * voiceConfigStore.test.ts
 * Spec 59 Contract Test Suite:
 * - 10-key legacy localStorage migration into 'interview_voice_config_v2'
 * - Zustand store updateConfig / setConfig / applyProfile / explicitLiveModel
 * - fetchRuntimeConfig discovery & explicitLiveModel preservation
 * - Node non-DOM safety (window / localStorage undefined)
 * - Cross-tab StorageEvent synchronization via handleStorageSync
 */

import assert from 'assert';
import {
  VOICE_CONFIG_STORAGE_KEY,
  StoragePort,
  migrateLegacyVoiceConfig
} from '../src/services/voiceConfigStorage';
import {
  createVoiceConfigStore,
  handleStorageSync,
  useVoiceConfigStore
} from '../src/store/useVoiceConfigStore';
import { resolveLiveSessionConfig } from '../src/audio/voiceConfigResolver';
import { buildLiveVoiceWebSocketUrl } from '../src/audio/LiveTransportSupervisor';
import type { RuntimeVoiceConfig } from '../src/config/voiceDefaults';

class InMemoryStorage implements StoragePort {
  public map = new Map<string, string>();
  public setCalls = 0;

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) {
      this.map.set(k, v);
    }
  }

  public getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  public setItem(key: string, value: string): void {
    this.setCalls++;
    this.map.set(key, value);
  }
}

async function runVoiceConfigStoreTests() {
  console.log('\n=========================================================================');
  console.log('🧪 SPEC 59 VOICE CONFIG STORE & LEGACY MIGRATION CONTRACT TESTS');
  console.log('=========================================================================\n');

  // [Test 1] 10-Key Legacy localStorage Migration into 'interview_voice_config_v2'
  console.log('[Test 1] 10-Key Legacy localStorage Migration');
  {
    const legacyStorage = new InMemoryStorage({
      interview_prep_active_config_v1: JSON.stringify({
        strategy: 'socratic_tutoring',
        voice: 'Fenrir',
        maxProbes: 5,
        deepDive: false,
        liveCoaching: true
      }),
      interview_user_gender: 'male',
      interview_turn_mode: 'auto',
      interview_live_model: 'gemini-live-thinking-v3',
      interview_live_model_explicit: 'true',
      interview_vad_pause_ms: '1200',
      interview_silence_clarification: 'true',
      interview_always_show_preflight: 'true',
      interview_study_modality: 'text',
      interview_strictness_level: 'hardcore'
    });

    const migrated = migrateLegacyVoiceConfig(legacyStorage);
    assert.strictEqual(migrated.strategy, 'socratic_tutoring', 'Folds v1 strategy');
    assert.strictEqual(migrated.voice, 'Fenrir', 'Folds v1 voice');
    assert.strictEqual(migrated.maxProbes, 5, 'Folds v1 maxProbes');
    assert.strictEqual(migrated.deepDive, false, 'Folds v1 deepDive');
    assert.strictEqual(migrated.liveCoaching, true, 'Folds v1 liveCoaching');
    assert.strictEqual(migrated.userGender, 'male', 'Folds interview_user_gender');
    assert.strictEqual(migrated.turnMode, 'auto', 'Folds interview_turn_mode');
    assert.strictEqual(migrated.liveModel, 'gemini-live-thinking-v3', 'Folds explicit interview_live_model');
    assert.strictEqual(migrated.vadPauseMs, 1200, 'Folds interview_vad_pause_ms');
    assert.strictEqual(migrated.enableSilenceClarification, true, 'Folds interview_silence_clarification');
    assert.strictEqual(migrated.alwaysShowPreflight, true, 'Folds interview_always_show_preflight');
    assert.strictEqual(migrated.studyModality, 'text', 'Folds interview_study_modality');
    assert.strictEqual(migrated.strictness, 'hardcore', 'Folds interview_strictness_level');

    const persistedRaw = legacyStorage.getItem(VOICE_CONFIG_STORAGE_KEY);
    assert.ok(persistedRaw, 'Persists migrated payload into interview_voice_config_v2');
    const persistedParsed = JSON.parse(persistedRaw!);
    assert.strictEqual(persistedParsed.explicitLiveModel, true, 'Preserves explicitLiveModel flag');
    assert.strictEqual(persistedParsed.config.turnMode, 'auto', 'Persisted v2 config retains turnMode');

    // When explicit flag is false, fallback runtime default model wins over stale model
    const nonExplicitStorage = new InMemoryStorage({
      interview_live_model: 'gemini-live-v2',
      interview_live_model_explicit: 'false',
      interview_turn_mode: 'auto'
    });
    const fallbackMigrated = migrateLegacyVoiceConfig(nonExplicitStorage, {
      liveModel: 'gemini-runtime-default'
    });
    assert.strictEqual(
      fallbackMigrated.liveModel,
      'gemini-runtime-default',
      'Non-explicit model yields to fallbackDefaults.liveModel'
    );

    // When v2 key already exists, legacy keys do NOT overwrite v2
    const v2Storage = new InMemoryStorage({
      [VOICE_CONFIG_STORAGE_KEY]: JSON.stringify({
        version: 2,
        explicitLiveModel: true,
        config: { strategy: 'adaptive_probing', voice: 'Aoede', maxProbes: 2, turnMode: 'manual' }
      }),
      interview_turn_mode: 'auto',
      interview_user_gender: 'male'
    });
    const existingV2 = migrateLegacyVoiceConfig(v2Storage);
    assert.strictEqual(existingV2.voice, 'Aoede', 'Existing v2 config takes precedence over legacy keys');
    assert.strictEqual(existingV2.turnMode, 'manual', 'Existing v2 turnMode not overwritten by legacy');
    console.log('  ✅ Passed: 10-key migration & v2 precedence');
  }

  // [Test 2] Store State Updates & Profile Application (Zero Side-Effect Updaters)
  console.log('\n[Test 2] updateConfig, setConfig, applyProfile');
  {
    const mem = new InMemoryStorage();
    const store = createVoiceConfigStore(mem);

    store.getState().updateConfig({ turnMode: 'auto', vadPauseMs: 2400, strictness: 'hardcore' });
    assert.strictEqual(store.getState().config.turnMode, 'auto', 'updateConfig updates turnMode');
    assert.strictEqual(store.getState().config.vadPauseMs, 2400, 'updateConfig updates vadPauseMs');
    assert.strictEqual(store.getState().config.strictness, 'hardcore', 'updateConfig updates strictness');
    assert.strictEqual(store.getState().explicitLiveModel, false, 'Non-model patch preserves explicitLiveModel=false');

    const storedAfterUpdate = JSON.parse(mem.getItem(VOICE_CONFIG_STORAGE_KEY)!);
    assert.strictEqual(storedAfterUpdate.config.vadPauseMs, 2400, 'Persisted v2 reflects updateConfig');

    store.getState().updateConfig({ liveModel: 'gemini-live-v2' });
    assert.strictEqual(store.getState().explicitLiveModel, true, 'Model patch flips explicitLiveModel=true');

    store.getState().applyProfile('preset_soft_mentor');
    assert.strictEqual(store.getState().config.strategy, 'socratic_tutoring', 'applyProfile updates strategy');
    assert.strictEqual(store.getState().config.voice, 'Kore', 'applyProfile updates voice');
    assert.strictEqual(store.getState().config.turnMode, 'auto', 'applyProfile preserves turnMode');
    console.log('  ✅ Passed: updateConfig & applyProfile');
  }

  // [Test 3] fetchRuntimeConfig Discovery & Explicit Model Preservation
  console.log('\n[Test 3] fetchRuntimeConfig & Explicit Model Preservation');
  {
    const runtimePayload: RuntimeVoiceConfig = {
      models: {
        defaultLiveModel: 'gemini-live-next',
        supportedLiveModels: ['gemini-live-next', 'gemini-live-v3', 'gemini-live-v2']
      },
      vad: { minMs: 500, maxMs: 2500, presetsMs: [800, 1200, 1800, 2400] },
      defaults: { voice: 'Aoede', turnMode: 'auto', vadPauseMs: 1800 }
    };

    const autoStore = createVoiceConfigStore(new InMemoryStorage());
    const fetched = await autoStore.getState().fetchRuntimeConfig(async () => runtimePayload);
    assert.strictEqual(fetched?.models.defaultLiveModel, 'gemini-live-next', 'fetchRuntimeConfig returns payload');
    assert.strictEqual(
      autoStore.getState().runtimeConfig?.models.defaultLiveModel,
      'gemini-live-next',
      'Store populates runtimeConfig'
    );
    assert.strictEqual(
      autoStore.getState().config.liveModel,
      'gemini-live-next',
      'Non-explicit liveModel adopts runtime defaultLiveModel'
    );

    const pinnedStore = createVoiceConfigStore(new InMemoryStorage());
    pinnedStore.getState().setExplicitLiveModel(true);
    pinnedStore.getState().updateConfig({ liveModel: 'gemini-live-v2' });
    await pinnedStore.getState().fetchRuntimeConfig(async () => runtimePayload);
    assert.strictEqual(
      pinnedStore.getState().config.liveModel,
      'gemini-live-v2',
      'Explicitly pinned liveModel is NOT overwritten by runtime default'
    );

    const failed = await autoStore.getState().fetchRuntimeConfig(async () => {
      throw new Error('network down');
    });
    assert.strictEqual(failed, null, 'fetchRuntimeConfig handles fetcher errors gracefully');
    console.log('  ✅ Passed: fetchRuntimeConfig & explicit preference guard');
  }

  // [Test 4] Node Non-DOM Safety (window / localStorage undefined)
  console.log('\n[Test 4] Node Non-DOM Safety');
  {
    assert.strictEqual(typeof window, 'undefined', 'Running in Node without window');
    assert.strictEqual(typeof localStorage, 'undefined', 'Running in Node without localStorage');

    const state = useVoiceConfigStore.getState();
    assert.ok(state.config.voice, 'Module singleton useVoiceConfigStore hydrates safely in Node');

    const resolved = resolveLiveSessionConfig({
      sessionId: 'node_safe_sess_1',
      questionId: 'q_node_1',
      sessionType: 'interview'
    });
    assert.ok(resolved.liveModel, 'resolveLiveSessionConfig reads singleton safely in Node');

    const wsUrl = buildLiveVoiceWebSocketUrl(resolved);
    assert.ok(wsUrl.startsWith('ws://localhost:5000/ws/live?'), 'buildLiveVoiceWebSocketUrl succeeds in Node');
    console.log('  ✅ Passed: Node non-DOM execution safe');
  }

  // [Test 5] Cross-Tab StorageEvent Synchronization (handleStorageSync)
  console.log('\n[Test 5] Cross-Tab handleStorageSync');
  {
    const mem = new InMemoryStorage();
    const store = createVoiceConfigStore(mem);
    const writesBeforeSync = mem.setCalls;

    handleStorageSync({ key: 'unrelated_storage_key', newValue: '{"voice":"Puck"}' }, store);
    assert.strictEqual(store.getState().config.voice, 'Kore', 'Ignores unrelated storage keys');

    const syncedPayload = JSON.stringify({
      version: 2,
      explicitLiveModel: true,
      config: {
        ...store.getState().config,
        voice: 'Aoede',
        turnMode: 'auto',
        vadPauseMs: 800,
        liveModel: 'gemini-live-thinking-v3'
      }
    });
    handleStorageSync({ key: VOICE_CONFIG_STORAGE_KEY, newValue: syncedPayload }, store);
    assert.strictEqual(store.getState().config.voice, 'Aoede', 'Cross-tab sync updates voice');
    assert.strictEqual(store.getState().config.turnMode, 'auto', 'Cross-tab sync updates turnMode');
    assert.strictEqual(store.getState().config.vadPauseMs, 800, 'Cross-tab sync updates vadPauseMs');
    assert.strictEqual(store.getState().explicitLiveModel, true, 'Cross-tab sync updates explicitLiveModel');
    assert.strictEqual(mem.setCalls, writesBeforeSync, 'Cross-tab sync does not trigger redundant storage write');

    handleStorageSync({ key: VOICE_CONFIG_STORAGE_KEY, newValue: null }, store);
    assert.strictEqual(store.getState().config.voice, 'Kore', 'Clearing v2 key resets to default voice');
    assert.strictEqual(store.getState().explicitLiveModel, false, 'Clearing v2 key resets explicitLiveModel');
    console.log('  ✅ Passed: Cross-tab handleStorageSync');
  }

  console.log('\n🎉 ALL SPEC 59 VOICE CONFIG STORE CONTRACT TESTS PASSED!');
}

runVoiceConfigStoreTests().catch((err) => {
  console.error('❌ voiceConfigStore.test.ts failed:', err);
  process.exit(1);
});
