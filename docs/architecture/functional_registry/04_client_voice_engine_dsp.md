# 04. Client Voice Engine & Audio DSP

> **Location:** `docs/architecture/functional_registry/04_client_voice_engine_dsp.md`  
> **Subsystem (Level 1):** Client Voice Engine & Audio DSP  
> **Primary Files:** [`frontend/src/audio/LiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceEngine.ts), [`frontend/src/services/AudioPlayoutManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/AudioPlayoutManager.ts), [`frontend/src/audio/LiveVoiceStateMachine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceStateMachine.ts), [`frontend/public/worklets/audio-capture-processor.js`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js)

---

## 1. Subsystem Scope
Client-side Web Audio DSP, AudioWorklet ring buffers, speech capture, audio playback queue management, dual-sided turn-taking handshake, tactile barge-in, and the candidate voice state machine.

---

## 2. Touch List & Function Hierarchy (Level 2)

> Historical entries `2.1–2.12` archived verbatim in [`04_client_voice_engine_dsp_archive.md`](./04_client_voice_engine_dsp_archive.md).

### 2.15 `Live Voice Modality Separation, Symmetrical Keepalive, & Defensive Dialog Layout (Spec 16 / #81-#86)`
- **Location:**
  - [`frontend/src/audio/NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts)
  - [`frontend/src/audio/LiveHeartbeatController.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveHeartbeatController.ts)
  - [`frontend/src/components/VoiceModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx)
  - [`frontend/src/components/voice/VoiceModalHeader.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceModalHeader.tsx)
  - [`frontend/src/components/voice/VoiceActiveView.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceActiveView.tsx)
  - [`frontend/src/components/voice/VoiceSubtitles.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceSubtitles.tsx)
  - [`frontend/src/components/companies/CompanyPrepStudio.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/companies/CompanyPrepStudio.tsx)
  - [`backend/src/services/live/LiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveVoiceSession.ts)
  - [`backend/src/services/live/SessionConfigurationResolver.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/SessionConfigurationResolver.ts)
- **What Was Done:**
  1. **Strict Modality Separation:** In `NativeLiveVoiceEngine.ts`, isolated text ingestion from audio state. `fsm.transition({ type: 'FIRST_AUDIO_RECEIVED' })` and status `🔊 ИИ говорит...` trigger ONLY when `parsed.hasAudio && parsed.audioChunks.length > 0`. Text-only frames update subtitles and accumulator without activating zero-byte audio playout.
  2. **Symmetrical Keepalive Protocol (1006 Elimination):** Extracted `LiveHeartbeatController.ts` (39 lines). Frontend replies with `{ type: 'pong' }` upon receiving server `ping` and broadcasts periodic `ping` every 20s. Backend `LiveVoiceSession.ts` inactivity limit extended from 180s (3m) to 900s (15m).
  3. **Dual-Sided Handshake Evaluation Drain:** When `submit_interview_evaluation` arrives (`evaluation_completed`), deferred `fsm.transition('EVALUATION_COMPLETED')` and stage transition until `AudioPlayoutManager` finishes physical DAC playback (`onPlaybackFinished`), preventing premature audio truncation.
  4. **VAD Pause Alignment (800ms):** Synchronized default VAD pause in `SessionConfigurationResolver.ts` and `CompanyPrepStudio.tsx` to 800ms, matching Step 6 of VAD Lab.
  5. **Defensive Layout & Contrast:** Upgraded close button ('X') in `VoiceModalHeader.tsx` to high-contrast `text-slate-700 bg-white/95 border border-slate-200/90 shadow-xs`. Fixed topic max width with truncation. Enforced `shrink-0` on controls and `overflow-hidden` with internal scrolling in `VoiceActiveView.tsx`.
- **Invariants:**
  - Transition to `AI_SPEAKING` strictly requires physical PCM audio chunks (`parsed.hasAudio === true && audioChunks.length > 0`).
  - Active sessions must not be terminated on idle deliberation for $\le 900$ seconds.
  - Evaluation completion must never truncate active verbal speech.

---

### 2.16 `Live Voice Acoustic Echo Immunity, Master Gain Safety & Strict Vocoder Temperature (Spec 17 / #88-#92)`
- **Location:**
  - [`frontend/src/services/AudioPlayoutManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/AudioPlayoutManager.ts)
  - [`frontend/src/audio/liveMicChunkDispatcher.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/liveMicChunkDispatcher.ts)
  - [`frontend/src/audio/liveVoiceUrlBuilder.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/liveVoiceUrlBuilder.ts)
  - [`frontend/src/components/VoiceModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx)
  - [`backend/src/services/live/liveGeminiConfigBuilder.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveGeminiConfigBuilder.ts)
  - [`backend/src/scripts/testGeminiConfigBuilder.ts`](file:///home/djelu/projects/interview_tutor/backend/src/scripts/testGeminiConfigBuilder.ts)
  - [`frontend/tests/audioPlayoutContracts.test.ts`](file:///home/djelu/projects/interview_tutor/frontend/tests/audioPlayoutContracts.test.ts)
  - [`frontend/tests/liveVoiceEngine.test.ts`](file:///home/djelu/projects/interview_tutor/frontend/tests/liveVoiceEngine.test.ts)
- **What Was Done:**
  1. **Master Playout Gain Safety (Zero-Trap Invariant):** In `AudioPlayoutManager.ts`, removed `linearRampToValueAtTime(0.0)` from `handleInterruption()`. Interruption pop-free de-ramping is handled natively inside the AudioWorklet (`gemini-audio-processor.js`) ring buffer via raised-cosine decay on message `{ type: 'flush' }`. In `enqueuePcmChunk`, enforced `masterGain.gain.setValueAtTime(1.5, now)` to guarantee subsequent speech turns play at full nominal volume ($1.5$).
  2. **Speculative Ducking Demolition:** Removed the naive ducking check on `rmsDb > -38` in `liveMicChunkDispatcher.ts` and `AudioDuckingController.ts`. Acoustic bleed from laptop/phone speakers reaches $-35$ to $-28$ dBFS, which previously caused the AI voice to constantly duck itself and trigger false self-interruption after 224ms.
  3. **Acoustic Filter & Energy Floor Calibration:** Aligned acoustic speech gating with `gemini_live_reference/AcousticFilter.ts`. Energy floor set to $-29$ dBFS ($RMS \ge 0.035$) with $\ge 180$ ms sustained non-transient phonation. Transient spikes (`isTransientSpike: true`) are filtered without modifying playout volume.
  4. **Strict Vocoder Temperature ($T = 1.0$):** In `liveGeminiConfigBuilder.ts`, clamped temperature to $1.0$ (preventing values $<0.7$ from collapsing latent acoustic vocoder space into digital silence). Serialized `temperature: 1.0` in `liveVoiceUrlBuilder.ts` and made explicit in `VoiceModal.tsx`.
- **Hypotheses & Intermediate Conclusions:**
  - *Empirical Finding:* The symptom where the AI voice became silent/muffled and knocking on the microphone abruptly restored sound was caused by a conjunction: speaker audio $> -38$ dBFS triggered `handleInterruption()` which set `masterGain = 0.0` indefinitely. Tapping the mic created an impulsive TKEO spike (`isTransientSpike: true`), invoking `rollbackDucking(15)` and setting `masterGain` back to 1.5.
- **Rationale & "Why":** Deep root-cause remediation: addresses acoustic discrimination in real-time DSP, avoids race conditions via speculative ducking, and maintains 100% compliance with Google Gemini 3.8 Live bidirectional streaming standards.
- **Invariants:**
  - `masterGain` must never remain locked at $0.0$ after an interruption.
  - The AI voice must never duck itself from its own speaker audio.
  - Autoregressive audio vocoder generation must strictly run with `temperature: 1.0`.

---

### 2.13 `useVoiceTutorSession & Split-Screen View Decomposition (Spec 28)`
- **Location:** [`frontend/src/audio/useVoiceTutorSession.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/useVoiceTutorSession.ts), [`frontend/src/components/voice/VoiceTutorView.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceTutorView.tsx)
- **What Was Done:**
  1. Extracted `useVoiceTutorSession.ts` (76 lines) as a headless session hook encapsulating keyboard shortcuts (Alt+Left/Right), text input buffer, question navigation, and deictic focus sync.
  2. Decomposed `VoiceTutorView.tsx` from 801 lines down to 202 lines by extracting `VoiceTutorTheoryPanel.tsx` (194 lines), `VoiceTutorControls.tsx` (35 lines), `VoiceTutorLobbyView.tsx` (103 lines), `VoiceTutorActiveHUD.tsx` (286 lines), and `VoiceTutorMediaCluster.tsx` (202 lines).
  3. Extracted `QuestionCatalogEngine.ts` (159 lines) with pure domain calculations, shrinking `QuestionExplorer.tsx` from 872 lines to 328 lines alongside `QuestionCardItem.tsx` (204 lines), `QuestionExplorerHeader.tsx` (195 lines), and `QuestionExplorerActionDock.tsx` (98 lines).
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* UI components passing 30+ props and holding both presentation and keyboard event listeners suffer from extreme coupling and cannot be tested headlessly.
  - *Empirical Finding:* Separating presentation from headless state hooks allows deterministic testing of keyboard events and multi-select filters in 0ms without DOM mocking.
- **Rationale & "Why":** Adheres to Rule 8 file size limits (all files <= 350 lines) and the UI Deletion Test Exception.
- **Invariants:**
  - `VoiceTutorView` must delegate all state and hotkeys to `useVoiceTutorSession`.
  - All newly created files must strictly remain <= 350 lines.

---

### 2.14 `Wave 4: Quiz Session Engine, Topic Catalog Aggregate & Executive Report Presenter (Spec 29)`
- **Location:** [`frontend/src/services/quiz/QuizSessionEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/quiz/QuizSessionEngine.ts), [`frontend/src/services/topics/TopicCatalogEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/topics/TopicCatalogEngine.ts), [`frontend/src/services/reports/ExecutiveReportPresenter.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/reports/ExecutiveReportPresenter.ts), [`frontend/src/components/ExamQuiz.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/ExamQuiz.tsx), [`frontend/src/components/TopicSelector.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/TopicSelector.tsx), [`frontend/src/components/InterviewReportModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/InterviewReportModal.tsx)
- **What Was Done:**
  1. **Topic Progression & FSRS Blitz Catalog:** Extracted `TopicCatalogEngine.ts` and `useTopicCatalog.ts`. Sliced `TopicSelector.tsx` from 793 to 138 lines into `TopicCatalogToolbar.tsx`, `TopicDomainAccordionList.tsx`, and `TopicCardGrid.tsx`.
  2. **Dual-Mode Quiz Session Engine:** Extracted `QuizSessionEngine.ts` and `useQuizSession.ts`. Reconciled dual evaluation pipelines (text vs Gemini Live voice) and auto-healing, shrinking `ExamQuiz.tsx` from 773 to 121 lines into `QuizQuestionArena.tsx` and `QuizScorecardView.tsx`.
  3. **Executive Report Presenter & Audio Coaching:** Extracted `ExecutiveReportPresenter.ts`, moving inlined JSX IIFEs (Deepgram Nova-3 filtering, JSON transcript parsing, acoustic speech profile mapping) into a pure view model transformer. Shrunk `InterviewReportModal.tsx` from 633 to 245 lines into `AcousticCoachingStudio.tsx` and `InterviewTranscriptViewer.tsx`.
- **Invariants:**
  - Zero modal-over-modal lock race (Rule 6 compliant).
  - All files strictly <= 350 lines (Rule 8 compliant).
  - Reconciled evaluation pipelines persist identical server progress across text and voice modalities.

---

### 2.15 `Wave 5: Acoustic DSP Engine Decoupling & Dead Code Cleanup (Spec 30)`
- **Location:** [`frontend/src/services/audio/AcousticDspEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/audio/AcousticDspEngine.ts), [`frontend/src/services/audio/SpeechClarityAnalyzer.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/audio/SpeechClarityAnalyzer.ts), [`frontend/src/services/audio/QuestionFrameworkClassifier.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/audio/QuestionFrameworkClassifier.ts), [`frontend/src/services/AcousticTelemetryService.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/AcousticTelemetryService.ts)
- **What Was Done:**
  1. **Acoustic DSP Decoupling:** Extracted `AcousticDspEngine.ts` (230 lines) as a pure math Float32 PCM engine (RMS dBFS, 10th percentile noise floor calibration, SNR, gross/net WPM, and 30-point energy sparkline downsampling) without any DOM, Tailwind, or styling dependencies.
  2. **Speech Clarity & Disfluencies:** Extracted `SpeechClarityAnalyzer.ts` (82 lines) with Russian/English filler words dictionary regex matching and clarity percentage scoring.
  3. **Question Framework Taxonomy:** Extracted `QuestionFrameworkClassifier.ts` (68 lines) categorizing prompts into STAR, PREP, and Rule-of-3 frameworks.
  4. **Lean Facade:** Shrunk `AcousticTelemetryService.ts` from 563 to 240 lines, preserving 100% backward compatibility for existing callers.
  5. **Dead Code Prototype Purge:** Deleted `frontend/src/hooks/useLiveKitAudioSession.ts` (550 lines of unimported prototype code) in strict compliance with the Rule 8 Zero Parallel Reimplementation invariant.
- **Invariants:**
  - DSP math runs headlessly on pure PCM buffers in <1ms without DOM or CSS dependencies.
  - Zero parallel reimplementation: audio streaming is governed solely by `LiveVoiceEngine`.
  - All files strictly <= 350 lines (Rule 8 compliant).

---

### 2.16 `Wave 6: Voice Modal Lifecycle & Stage Coordinator Decoupling (Spec 31)`
- **Location:** [`frontend/src/components/voice/useVoiceModalCoordinator.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/useVoiceModalCoordinator.ts), [`frontend/src/components/VoiceModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx)
- **What Was Done:**
  1. **Headless Coordinator Extraction:** Extracted `useVoiceModalCoordinator.ts` (344 lines) isolating the 4-stage lifecycle FSM (`lobby` -> `active` -> `verdict` -> `grand_finale`), question batch navigation, checkpointing, auto-start guards, and workspace custom DOM event listener.
  2. **Lean Presentation Shell:** Reduced `VoiceModal.tsx` from 398 lines (high-churn file on the verge of Rule 8 ceiling) to 185 lines of declarative presentation.
- **Invariants:**
  - Rule 8 compliant: `VoiceModal.tsx` <= 200 lines, `useVoiceModalCoordinator.ts` <= 350 lines.
  - Zero behavioral drift: Dual-Sided Handshake and Auto-VAD protocols fully preserved.

---

### 2.17 `Wave 8: Global Audio Control Pill & Voice Lobby Hero / Mode Switches Decoupling (Spec 33)`
- **Location:** [`frontend/src/components/voice/audio_pill/useGlobalAudioPill.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/audio_pill/useGlobalAudioPill.ts), [`frontend/src/components/voice/audio_pill/GlobalAudioDrawerContent.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/audio_pill/GlobalAudioDrawerContent.tsx), [`frontend/src/components/voice/GlobalAudioControlPill.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/GlobalAudioControlPill.tsx), [`frontend/src/components/voice/lobby/VoiceLobbyHero.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/lobby/VoiceLobbyHero.tsx), [`frontend/src/components/voice/lobby/VoiceLobbyModeSwitches.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/lobby/VoiceLobbyModeSwitches.tsx), [`frontend/src/components/voice/VoiceLobbyView.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceLobbyView.tsx)
- **What Was Done:**
  1. **Audio Pill Headless Hook & Drawer:** Extracted `useGlobalAudioPill.ts` (113 lines) managing voice preview greeting playback via HTML5 Audio, Escape / outside-click DOM listeners, and interview configuration bindings. Extracted `GlobalAudioDrawerContent.tsx` (266 lines) for turnMode, voice selector, and candidate grade controls. Reduced `GlobalAudioControlPill.tsx` from 378 to 91 lines.
  2. **Voice Lobby Decomposition:** Extracted `VoiceLobbyHero.tsx` (80 lines) for hero avatar, grade badge, and turn mode pill. Extracted `VoiceLobbyModeSwitches.tsx` (163 lines) for language switcher, deep dive, live coaching, and 3-tier calibration. Reduced `VoiceLobbyView.tsx` from 354 to 155 lines.
- **Invariants:**
  - Audio preview playback uses non-blocking asynchronous fetch and safely handles audio element error states without leaking memory.
  - All files strictly <= 350 lines (Rule 8 compliant).

---

### 2.18 `Wave 9: Audio Recap Settings Form Modular Decomposition (Spec 34)`
- **Location:** [`frontend/src/components/audio/recap/recapConfigTypes.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/audio/recap/recapConfigTypes.ts), [`frontend/src/components/audio/recap/VoiceSelectorGroup.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/audio/recap/VoiceSelectorGroup.tsx), [`frontend/src/components/audio/recap/AdvancedPromptsCollapsible.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/audio/recap/AdvancedPromptsCollapsible.tsx), [`frontend/src/components/audio/RecapSettingsForm.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/audio/RecapSettingsForm.tsx)
- **What Was Done:**
  1. **Voice Selector Subcomponent:** Extracted `VoiceSelectorGroup.tsx` (148 lines) managing Gemini Live voice persona cards (Puck, Charon, Aoede, Fenrir, Kore) and custom voice preview trigger.
  2. **Advanced Directives Collapsible:** Extracted `AdvancedPromptsCollapsible.tsx` (73 lines) managing accordion disclosure for custom TTS prompts, speed control, and topic emphasis directives.
  3. **Types SSOT & Facade:** Created `recapConfigTypes.ts` (21 lines) and collapsed `RecapSettingsForm.tsx` from 370 to 196 lines.
- **Invariants:**
  - Complete backward compatibility for existing parent consumers (`AudioRecapModal`).
  - All newly created files strictly <= 350 lines (Rule 8 compliant).

---

### 2.21 `voiceConfigResolver & VoiceDefaults: Global Auto-VAD, Engine & Voice SSOT Across All Arenas`
- **Location:** [`frontend/src/config/voiceDefaults.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/config/voiceDefaults.ts), [`frontend/src/audio/voiceConfigResolver.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/voiceConfigResolver.ts), [`frontend/src/audio/useLiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/useLiveVoiceSession.ts), [`frontend/src/audio/liveVoiceUrlBuilder.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/liveVoiceUrlBuilder.ts), [`frontend/src/components/VoiceSettingsDrawer.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceSettingsDrawer.tsx)
- **What Was Done:**
  1. Extracted pure `resolveLiveSessionConfig()` and `resolveEffectiveLiveModel()` inside `voiceConfigResolver.ts`, hydrating every `useLiveVoiceSession.connect()` caller (`HrScreeningArena`, `useBugHuntVoiceBridge`, `useSystemDesignVoiceDefense`, `PracticeVoiceContext`, `useVoiceModalCoordinator`, `DebugLiveConsole`) with active `getActiveConfig()` + `/api/config` defaults.
  2. Connected `uiSlice.fetchRuntimeConfig()` (`GET /api/config`) at `App.tsx` startup so model pickers (`GlobalAudioDrawerContent`, `VoiceDialogueModeSection`) render dynamic backend aliases in both `auto` and `manual` modes.
  3. Removed hardcoded overrides (`vadPauseMs={800}` in company tabs, `'Aoede'` in HR/BugHunt/Debug, profile selection resetting `turnMode`/`liveModel` in `VoiceSettingsDrawer`, persona selection overwriting `voice` in `VoiceLobbyView`).
- **Rationale & "Why":** Enforces global Auto-VAD, engine, and voice selection at one headless boundary rather than duplicating config plumbing per screen.
- **Invariants:** No arena may drop or override global Auto-VAD/engine/voice unless explicitly passed; `turnMode === 'manual'` remains intact.

---

### 2.19 `Spec 35: LiveVoiceStateMachine COMMITTING Decoupling & Silent Reconnect Recovery`
- **Location:** [`frontend/src/audio/LiveVoiceStateMachine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceStateMachine.ts), [`frontend/src/audio/NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts), [`frontend/src/audio/liveMicChunkDispatcher.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/liveMicChunkDispatcher.ts)
- **What Was Done:**
  1. **COMMITTING Public State Decoupling:** Replaced legacy mapping `COMMITTING -> LISTENING` with `COMMITTING -> CONNECTING`. This prevents `liveMicChunkDispatcher` from treating the waiting/thinking phase as candidate speech, eliminating continuous PCM streaming and duplicate turn commits.
  2. **Mic Dispatch Silence & Chunk Freeze:** Dispatched audio frames and trailing silence counters are frozen when `state !== 'LISTENING'`.
  3. **Silent Hot Reconnect Recovery:** When `setupComplete` arrives with `reconnected: true` or `silent: true`, `NativeLiveVoiceEngine` immediately resets `isTurn0Lockdown = false` and calls `unlockCandidateTurn()`, eliminating dead-air lockups on hot reconnect.
  4. **Idempotent Commit Guard:** `commitSpokenTurn()` requires `isCandidateTurnActive() === true`, preventing re-entrant commit loops.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Streaming mic chunks during `COMMITTING` caused Google Cloud VAD to interpret audio as user activity, triggering `START_OF_ACTIVITY_INTERRUPTS` and aborting generation.
  - *Empirical Observation:* Confirmed in Docker logs: candidate commits triggered repeated `Illegal state transition attempted: AI_THINKING -> COMMITTING`, causing 22s timeouts.
- **Rationale & "Why":**
  - Following `gemini_live_reference`, `COMMITTING` is a waiting state (`isThinking: true`). Upstream Gemini Live requires clean separation between candidate audio input and model output synthesis.
- **Failure Modes & Invariants:**
  - Prevents Google Gemini Live interrupt-cancel loop.
  - Prevents Turn 0 lockdown freeze on reconnected sessions.

---

### 2.21 `LiveVoiceFrameParser, LiveVoiceRecoveryController & PracticeVoiceHUD: Transport Visibility & Whiteboard Turn Hold (Spec 42 / #159)`
- **Location:** [`LiveVoiceFrameParser.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceFrameParser.ts), [`LiveVoiceStateMachine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceStateMachine.ts), [`LiveVoiceRecoveryController.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceRecoveryController.ts), [`NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts), [`useLiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/useLiveVoiceSession.ts), [`PracticeVoiceContext.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx), [`PracticeVoiceHUD.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/tutor/PracticeVoiceHUD.tsx), [`AmbientVoicePill.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/tutor/AmbientVoicePill.tsx)
- **What Was Done:**
  1. Extracted `LiveVoiceRecoveryController` (155 lines <= 350) managing bounded dead-air/tool-speech safety timers (8s/22s), 10s `sync_ping` upstream link liveness verification (`2x consecutive isUpstreamConnected === false` -> `UPSTREAM_LINK_LOST` error), close status mapping, and `upstream_reconnecting`, `hot_handoff_started`/`complete`, `tool_awaiting_speech`, `thinking_delay`, `dead_air_recovery`, `upstream_error` control frames.
  2. Extended `LiveVoiceStateMachine` so `THINKING_START` is valid from `AI_SPEAKING` and `AI_RECITING_QUESTION`, letting `NativeLiveVoiceEngine` hold `AI_THINKING` when `tool_awaiting_speech` precedes an empty intermediate `turnComplete`.
  3. Surfaced `isError` & `lastError` via `useLiveVoiceSession` and `PracticeVoiceContext` into `PracticeVoiceHUD` (with manual `Переподключить` button and single-shot auto-start ref preventing infinite retry loops on `ERROR`) and `AmbientVoicePill`.
- **Invariants:**
  - Cognitive bounding: `NativeLiveVoiceEngine.ts` <= 400 lines; `LiveVoiceRecoveryController.ts` <= 350 lines.
  - Client never silently masks terminal upstream drops as normal session completion.

---

### 2.20 `Spec 39: LiveMicChunkDispatcher Continuous Cloud VAD Streaming in Auto Mode`
- **Location:** [`frontend/src/audio/liveMicChunkDispatcher.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/liveMicChunkDispatcher.ts)
- **What Was Done:**
  1. Removed the client-side 500ms silence timer (`candidateSilenceFramesAfterVoicing >= 25 -> onCommitSpokenTurn()`) in auto mode (`turnMode !== 'manual'`).
  2. Maintained unbroken 16kHz PCM audio streaming (including natural ambient silence between speech utterances) directly into the WebSocket connection during `CANDIDATE_LISTENING`.
  3. Kept manual turn mode (`turnMode === 'manual'`) push-to-talk button behavior completely intact.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Cutting off the microphone stream on the client after 500ms of silence and sending `audioStreamEnd` caused Gemini Live to pause/flush rather than generate, leading to 22-second dead-air freezes across all arenas.
  - *Empirical Observation:* Google Gemini Live Native Cloud VAD endpoints turns server-side based on continuous audio + ambient silence, matching `gemini_live_reference`.
- **Rationale & "Why":** Aligns 100% with Google's canonical Live API standard without artificial client truncation hacks.
- **Invariants:**
  - In `turnMode === 'auto'`, PCM audio frames flow continuously to Gemini without artificial client cutoff.
  - Manual mode remains fully isolated and operable via tactile commit.

---

### 2.22 `ILiveVoiceEngine, subscribeAudioLevel, useLiveVoiceSession & PracticeVoiceProvider: Deep Client Voice Contract (Spec 47 / #173–#174)`
- **Location:** [`types.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/types.ts), [`NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts), [`useLiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/useLiveVoiceSession.ts), [`PracticeVoiceContext.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx), [`useVoiceModalCoordinator.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/useVoiceModalCoordinator.ts), [`App.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/App.tsx)
- **What Was Done:**
  1. Narrowed `ILiveVoiceEngine` in `types.ts` and `NativeLiveVoiceEngine.ts`, replacing reactive per-frame `metrics.rmsDb` polling with callback-based `subscribeAudioLevel(listener)` (sub-16ms CSS transform updates without React reconciliation storms) and replacing `aiTranscript`/`rmsDb`/alias bloat with `currentAiSubtitle`, `vadActive`, `isMuted`, and `dispatch()`.
  2. Unified `<PracticeVoiceProvider>` once at `App.tsx` root and removed duplicate arena providers in `PracticeArena.tsx`.
  3. Updated `liveVoiceEngine.test.ts` (`audio6Err.finishPlayoutDrain()` Dual-Sided Handshake check) and `liveAudioSessionContracts.test.ts` (`buildPracticeSessionParams`).
- **Invariants:** 60fps audio meter animation drives DOM refs via `subscribeAudioLevel` without React state churn; single `PracticeVoiceProvider` owns practice/design/defense voice lifecycle.

