# Spec 59: Consolidated `useVoiceConfigStore` & Pruned `questionsSlice`

> **Governing Glossary:** `useVoiceConfigStore`, `Slim Live Handshake Barrier` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md)  
> **Domain Classification:** `Single-Tenant` client config · `Public`/`Internal` · Zero `CustomEvent` buses; SSR/Node-safe for headless test execution

---

## 1. Intent & Workload Envelope
Eliminate client state fragmentation where runtime voice configuration is mirrored simultaneously in Zustand (`uiSlice.runtimeConfig`), a mutable module-global singleton (`cachedRuntimeVoiceConfig` in `voiceDefaults.ts`), two `window` `CustomEvent` buses (`interview_config_updated`, `interview_runtime_config_updated`), 10 `localStorage` keys (4 bypassed directly in settings JSX), and a side-effecting `setConfigState` updater in `useInterviewConfig.ts` (calling `saveActiveConfig` + `window.dispatchEvent` inside React state updaters). Simultaneously prune confirmed dead state (`batchSizeMap`, `setBatchSize`, `toggleShuffle`, write-dead `shuffleMap`, `TopicProgress.{shuffle,batchSize}`) from `questionsSlice.ts` and `useAppStore.ts`, remove `runtimeConfig` from `uiSlice.ts`, decouple `App.tsx` mount boot from `[systemHealth.isAiReady]` polling, and clean dead `isSettingsOpen` plumbing in `useVoiceModalCoordinator.ts`.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT break Node (`tsx`) test imports in `frontend/tests/liveAudioSessionContracts.test.ts` (`voiceConfigResolver.ts`, `LiveTransportSupervisor.ts`) — store accessors MUST guard `localStorage` / `window` cleanly when running outside browser DOM.
- Do NOT lose existing user settings (`turnMode`, `liveModel`, `userGender`, `vadPauseMs`, `studyModality`, `strictnessLevel`) stored in legacy `localStorage` keys — perform automatic one-time migration on hydration.
- Every newly created or modified file under `frontend/src/` stays `<= 350L` (new) / `<= 400L` (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seams:** `useVoiceConfigStore` (`frontend/src/store/useVoiceConfigStore.ts`) + `voiceConfigStorage` (`frontend/src/services/voiceConfigStorage.ts`) + pure `voiceConfigResolver` (`frontend/src/audio/voiceConfigResolver.ts`).
- **Adapters (`local-substitutable`):** Injectable `StorageAdapter` & `fetchRuntimeConfig` port so unit tests run deterministically in Node without browser globals.
- **Verification Command (CI):** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface VoiceConfigStoreState {
  config: InterviewConfig;
  runtimeConfig: RuntimeVoiceConfig | null;
  profiles: InterviewProfile[];
  updateConfig(patch: Partial<InterviewConfig>): void;
  setConfig(next: InterviewConfig): void;
  fetchRuntimeConfig(): Promise<RuntimeVoiceConfig | null>;
  applyProfile(profileId: string): void;
}
```
- **Storage Consolidation Contract (`'interview_voice_config_v2'`):**
  - All scalar voice preferences live in one persisted store payload under `'interview_voice_config_v2'` (plus `'interview_prep_profiles_v1'` if fetched/saved via API/local cache).
  - **One-Time Migration:** On first hydration when `'interview_voice_config_v2'` is absent, read and fold legacy keys (`interview_prep_active_config_v1`, `interview_user_gender`, `interview_turn_mode`, `interview_live_model`, `interview_live_model_explicit`, `interview_vad_pause_ms`, `interview_silence_clarification`, `interview_always_show_preflight`, `interview_study_modality`, `interview_strictness_level`), preserving user values faithfully.
  - **Cross-Tab Sync:** One single module-level `window.addEventListener('storage', ...)` listener rehydrates `useVoiceConfigStore` when `'interview_voice_config_v2'` changes across tabs (replacing 14 per-component listeners + 2 `CustomEvent` buses).
- **Component & Helper Migration:**
  - `VoiceDefaults` deletes mutable `cachedRuntimeVoiceConfig` (`getCachedRuntimeVoiceConfig` / `setCachedRuntimeVoiceConfig` removed).
  - `VoiceStrategySection.tsx` and `VoiceDialogueModeSection.tsx` stop writing raw `localStorage.setItem(...)` keys directly.
  - `useInterviewConfig()` stays a clean `<= 35L` Zustand hook facade over `useVoiceConfigStore` (zero local `useState`, zero updater side effects).
  - `LiveTransportSupervisor.ts` and `voiceConfigResolver.ts` accept explicit `config`/`runtimeConfig` or read safely from `useVoiceConfigStore.getState()`.

---

## 5. Storage & Zero-Downtime Migration Contract
- **Expand-Migrate-Contract Phasing:**
  1. **Expand (`T8`):** Introduce `useVoiceConfigStore` + `voiceConfigStorage` (with legacy 10-key migration), rewire `App.tsx` (atomic `useAppStore` selectors + separate mount-only `useEffect([])` for `fetchRuntimeConfig` / `checkAuthSession`), rewire `voiceConfigResolver.ts`, `LiveTransportSupervisor.ts`, settings sections (`VoiceStrategySection`, `VoiceDialogueModeSection`, `VoiceVadPauseSection`, `GlobalAudioDrawerContent`, `DebugConfigInspector`), and swap `useInterviewConfig()` internals to the store.
  2. **Contract (`T9`):** Remove `cachedRuntimeVoiceConfig` from `voiceDefaults.ts`, remove `runtimeConfig`/`fetchRuntimeConfig` from `uiSlice.ts`, remove `interview_config_updated`/`interview_runtime_config_updated` CustomEvent emitters, remove dead `batchSizeMap`/`setBatchSize`/`toggleShuffle`/`shuffleMap`/`TopicProgress.{shuffle,batchSize}` from `questionsSlice.ts`/`useTopicCatalog.ts`/`useAppStore.ts`, and prune dead `isSettingsOpen` plumbing from `useVoiceModalCoordinator.ts` (`VoiceLobbyView.tsx` if unused).

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Clean DOM or Node test runtime, OR browser `localStorage` pre-populated with legacy v1 voice keys.
- `{C}` Hydrate `useVoiceConfigStore`, migrate legacy keys into unified state if v2 key absent, dispatch `updateConfig(patch)` outside React render updaters, and fetch `/api/config` once at app mount.
- `{Q}` Zero `CustomEvent` dispatches and zero per-component `window` listeners exist; `updateConfig` updates all subscribers synchronously via Zustand without StrictMode double-writes; `npm run test:audio-contracts` (including `voiceConfigStore.test.ts` legacy migration + Node safety + `questionsSlice` checks) and `tsc && vite build` pass cleanly.
