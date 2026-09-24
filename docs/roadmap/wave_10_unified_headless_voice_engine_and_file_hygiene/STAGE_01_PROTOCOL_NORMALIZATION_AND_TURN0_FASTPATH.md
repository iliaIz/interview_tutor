# Stage 1: Protocol Normalization & Turn 0 Fast-Path

> **Document:** `STAGE_01_PROTOCOL_NORMALIZATION_AND_TURN0_FASTPATH.md`  
> **Parent Roadmap:** [00_WAVE_10_MASTER_ROADMAP.md](file:///d:/projects/interview_projects/spring/docs/roadmap/wave_10_unified_headless_voice_engine_and_file_hygiene/00_WAVE_10_MASTER_ROADMAP.md)  
> **Target Branch:** `refactor/wave-10-unified-voice-engine-and-file-hygiene`  
> **Base Commit:** `d27d8224c9296d39f49e063e0e8948ee82f37676`  
> **Target Commit Message:** `fix(voice): normalize generationComplete terminal signal and enforce Turn 0 fast-path`

---

## 1. Problem Statement & Root Cause

Live testing in production (commit `d27d822`) identified three interconnected blocking issues during "Теория. Собеседование":

1. **Protocol Signal Mismatch:**
   - LiteLLM routing to Google Gemini Live Multimodal (`models/gemini-3.8-live`) sends `serverContent.generationComplete: true` upon speech synthesis completion, not necessarily `turnComplete: true`.
   - In [liveAudioStreamRouter.ts:520](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveAudioStreamRouter.ts#L520), the backend checks only:
     ```typescript
     if (parsed.serverContent?.turnComplete) {
       session.isAiGenerating = false;
       // ...
     }
     ```
   - In [VoiceModal.tsx:1607](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx#L1607) and [useLegacyLiveAudioSession.ts:937](file:///d:/projects/interview_projects/spring/frontend/src/hooks/useLegacyLiveAudioSession.ts#L937):
     ```typescript
     if (data.serverContent?.turnComplete) { ... }
     ```
   - Because `turnComplete` was absent, `session.isAiGenerating` stayed `true` indefinitely.
   - In [liveWsConnectionHandler.ts:805](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveWsConnectionHandler.ts#L805), `ECHO_GUARD` discarded 100% of candidate audio (775 dropped chunks over 31s). The UI mic remained stuck in pink ("AI Speaking").

2. **Turn 0 Function Calling Overhead:**
   - In `sessionType: 'interview'`, `submit_interview_evaluation` was declared in `tools` on initial handshake. Gemini spent internal generation capacity evaluating rubric schema, cutting off audio output after one sentence and transmitting text at extreme latency.
   - In `sessionType: 'tutor'`, no evaluation tool was declared, which allowed audio generation to complete cleanly.

3. **Hot-Reconnect State Loss:**
   - When upstream WebSocket drops or restarts (code 1000/1006) during Turn 0, [liveAudioStreamRouter.ts:339](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveAudioStreamRouter.ts#L339) guards with `if (!wasReconnecting)`. The reconnected socket did not resend the Turn 0 question prompt if the candidate hadn't yet spoken, leaving the session frozen in silence.

---

## 2. Technical Modifications

### 2.1. Backend Stream Normalization
- In [liveAudioStreamRouter.ts](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveAudioStreamRouter.ts):
  - Treat `parsed.serverContent?.turnComplete || parsed.serverContent?.generationComplete` as the canonical `turnFinished` event.
  - Reset `session.isAiGenerating = false` on either condition.
  - Forward both flags faithfully to downstream client WebSocket so clients can synchronize physical audio queues.

### 2.2. Turn 0 Evaluation Tool Shield
- In [liveWsConnectionHandler.ts](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveWsConnectionHandler.ts) and [liveToolDeclarations.ts](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveToolDeclarations.ts):
  - Do not register `submit_interview_evaluation` or `submit_defense_evaluation` in `setupMessage.tools` during initial handshake (Turn 0).
  - Declare tools dynamically or activate tool listeners only after `session.hasCandidateResponded === true`.
  - Enforce Turn 0 greeting prompt instructions: strictly stream question text and voice without premature rubric computation.

### 2.3. Frontend Client Terminal Signal & Subtitle Pacer Synchronization
- In [VoiceModal.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx) and [useLegacyLiveAudioSession.ts](file:///d:/projects/interview_projects/spring/frontend/src/hooks/useLegacyLiveAudioSession.ts):
  - Update turn completion listener to trigger on:
    ```typescript
    const isGenerationDone = Boolean(data.serverContent?.turnComplete || data.serverContent?.generationComplete);
    ```
  - Upon `isGenerationDone`:
    - Set `isServerTurnCompleteRef.current = true`.
    - Trigger `audioPlayoutManager.notifyTurnComplete()`.
    - If audio queue is already drained, immediately activate mic (`setIsAiSpeaking(false); setIsRecording(true)`).
    - If audio is still playing in speakers, `onPlaybackFinished` will seamlessly activate the mic when physical audio drains.
  - **Subtitle Pacer Calibration:**
    - Fix the token calculation in `startSubtitlePacing`: `aiTurnTextAccumulatorRef.current.split(/(\s+)/)` counts spaces and words as separate tokens, artificially doubling the estimated duration. Use actual word tokens (`split(/\s+/).filter(Boolean)`) or sync directly with the audio playout timeline.
    - Ensure `finalizeAiTurnSubtitles()` is called unconditionally when `onPlaybackFinished` or `isGenerationDone` triggers, preventing text from stalling.

### 2.4. Upstream Reconnection Recovery
- In [liveAudioStreamRouter.ts](file:///d:/projects/interview_projects/spring/backend/src/services/live/liveAudioStreamRouter.ts):
  - If reconnecting while `session.hasCandidateResponded === false` and greeting was not completed, replay the Turn 0 prompt into the upstream channel.
  - Explicitly reinforce in Turn 0 prompt: `"Привет! Я готова к собеседованию. Пожалуйста, поприветствуй меня в 1 фразе и четко зачитай технический вопрос вслух: \"${questionText}\". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала)."`.

---

## 3. Step-by-Step Implementation Sequence

1. **Backend Patch:**
   - Update `backend/src/services/live/liveAudioStreamRouter.ts`.
   - Update `backend/src/services/live/liveWsConnectionHandler.ts`.
   - Verify tool declaration filtering for Turn 0.
2. **Frontend Patch:**
   - Update `frontend/src/hooks/useLegacyLiveAudioSession.ts`.
   - Update `frontend/src/components/VoiceModal.tsx`.
3. **Headless Verification:**
   - Run `ts-node backend/scripts/replay_turn.ts` against local backend.
   - Assert zero dropped chunks in `ECHO_GUARD` after AI turn finishes.
   - Assert frontend transitions to active recording (`state: 'LISTENING'`).
4. **Git Commit:**
   - `git commit -m "fix(voice): normalize generationComplete terminal signal and enforce Turn 0 fast-path"`

---

## 4. Verification & Acceptance Criteria
- [ ] `replay_turn.ts` exits with code 0.
- [ ] Backend logs confirm `session.isAiGenerating` resets to `false` when Gemini emits `generationComplete`.
- [ ] `ECHO_GUARD` does not suppress candidate voice chunks after physical drain.
- [ ] Turn 0 greeting plays contiguously without stutter or premature tool execution.
