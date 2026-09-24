# Stage 3: Headless Voice Engine Architecture & Monolith Decomposition

> **Document:** `STAGE_03_HEADLESS_VOICE_ENGINE_REFACTORING.md`  
> **Parent Roadmap:** [00_WAVE_10_MASTER_ROADMAP.md](file:///d:/projects/interview_projects/spring/docs/roadmap/wave_10_unified_headless_voice_engine_and_file_hygiene/00_WAVE_10_MASTER_ROADMAP.md)  
> **Target Branch:** `refactor/wave-10-unified-voice-engine-and-file-hygiene`  
> **Base Target File:** `frontend/src/components/VoiceModal.tsx` (Current size: **4,220 lines**)  
> **Target Architecture:** Headless Engine ($\le 300$ lines) + Atomic UI Components ($\le 250$ lines each)  
> **Target Commit Message:** `refactor(voice): extract headless LiveVoiceEngine and decompose VoiceModal monolith`

---

## 1. Problem Formulation & Architectural Necessity

Currently, [VoiceModal.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx) contains **4,220 lines of code**. It violates the Single Responsibility Principle by combining:
1. Low-level Web Audio API graph management (AudioContext, GainNode, MediaStreamAudioDestinationNode).
2. AudioWorklet script loading and 16-bit PCM chunk serialization.
3. WebSocket transport, heartbeat keepalives, reconnection backoff, and LiteLLM protocol routing.
4. Dual-sided handshake state machine (`CONNECTING`, `AI_SPEAKING`, `LISTENING`, `EVALUATING`, `ERROR`).
5. Live streaming subtitle pacing, sentence accumulation, and token smoothing.
6. Evaluation rubric verdict layout, multi-criteria scores, radar charts, and audio replay.
7. Responsive modal dialog UI, soft luxury pastel styling, and touch gestures.

### Why This Caused the Bug
Because modifying this 4,220-line file was error-prone and daunting:
- Developers avoided modifying shared code, creating ad-hoc branches like `if (sessionType === 'tutor')`.
- Parallel voice files (`ProjectDefenseStudio.tsx`) were duplicated with divergent WebSocket code.
- Terminal signal checking (`turnComplete` vs `generationComplete`) was duplicated across multiple locations without unified handling.

---

## 2. Target Component & Class Hierarchy

```
frontend/src/
├── audio/
│   ├── LiveVoiceEngine.ts          # Core Headless Engine (Pure TS, ~280 lines)
│   ├── AudioPlayoutManager.ts      # Jitter buffer, seamless timeline scheduling (~220 lines)
│   ├── MicrophoneCapture.ts        # AudioWorklet / 16kHz PCM capture (~180 lines)
│   └── types.ts                    # Voice engine state, events & options (~80 lines)
└── components/
    └── voice/
        ├── VoiceModal.tsx           # Slim UI Coordinator (< 200 lines)
        ├── VoiceMicButton.tsx       # Interactive pulsing mic button & barge-in (< 180 lines)
        ├── VoiceSubtitles.tsx       # Live transcript & real-time subtitle stream (< 160 lines)
        ├── VoiceVisualizer.tsx      # Smooth frequency aura / canvas waves (< 150 lines)
        └── VoiceVerdictCard.tsx     # Structured evaluation card & rubric scores (< 240 lines)
```

### 2.1. `LiveVoiceEngine` (Headless Pure TypeScript)
- **Zero React dependencies:** Can be instantiated in React, Vue, vanilla TS, or headless Node.js tests.
- **State Machine:**
  - States: `IDLE` $\rightarrow$ `CONNECTING` $\rightarrow$ `AI_SPEAKING` $\rightarrow$ `LISTENING` $\rightarrow$ `EVALUATING` $\rightarrow$ `COMPLETED` / `ERROR`.
  - Dispatches observable events: `onStateChange`, `onAudioChunk`, `onTranscriptDelta`, `onVerdict`, `onError`.
- **Protocol Encapsulation:**
  - Handles `serverContent.generationComplete` and `turnComplete` uniformly.
  - Automatically manages EchoGuard gating and 5ms tactile barge-in de-click ramp.
  - Enforces the Dual-Sided Handshake Invariant: candidates speak only when generation has concluded AND physical audio has completed draining.

### 2.2. Atomic UI Subcomponents
- **`VoiceModal.tsx` ($\le 200$ lines):**
  - Subscribes to `LiveVoiceEngine` via a clean `useLiveVoiceEngine` hook.
  - Controls dialog visibility and body scroll lock (`useBodyScrollLock`).
- **`VoiceMicButton.tsx` ($\le 180$ lines):**
  - Renders the soft luxury pastel button (`#FFF0F5`, gentle mesh glow aura).
  - Handles tactile click barge-in and keyboard spacebar shortcuts.
- **`VoiceSubtitles.tsx` ($\le 160$ lines):**
  - Renders streaming text with natural typing pacing.
- **`VoiceVerdictCard.tsx` ($\le 240$ lines):**
  - Renders evaluation scores and recommendations.

---

## 3. Step-by-Step Refactoring Plan

1. **Extract Core Audio Modules:**
   - Create `frontend/src/audio/types.ts`.
   - Extract `MicrophoneCapture.ts` from existing capture logic.
   - Refactor `AudioPlayoutManager.ts` to adhere to $\le 300$ lines.
   - Implement `LiveVoiceEngine.ts` encapsulating WebSocket lifecycle and state transitions.
2. **Build Unit Tests for Engine:**
   - Write `LiveVoiceEngine.test.ts` mocking WebSocket and AudioContext.
   - Verify state transition from `AI_SPEAKING` $\rightarrow$ `LISTENING` on both `generationComplete` and `turnComplete`.
3. **Decompose `VoiceModal.tsx`:**
   - Extract `VoiceMicButton.tsx`, `VoiceSubtitles.tsx`, `VoiceVisualizer.tsx`, and `VoiceVerdictCard.tsx`.
   - Rewrite `VoiceModal.tsx` to bind subcomponents to `LiveVoiceEngine`.
   - Verify that `VoiceModal.tsx` is under 250 lines of code.
4. **Refactor Consumers for 100% Code Reuse:**
   - Migrate `useLiveAudioSession.ts` and `useLegacyLiveAudioSession.ts` to consume `LiveVoiceEngine.ts` instead of hosting a 1,200-line parallel WebSocket client.
   - Update `PracticeVoiceContext.tsx` and `ProjectDefenseStudio.tsx` to utilize `LiveVoiceEngine` rather than duplicate socket logic.
   - Delete all duplicated `new WebSocket('/ws/live')` callers; `LiveVoiceEngine` becomes the ONLY live audio WebSocket client in the frontend.
5. **Git Commit:**
   - `git commit -m "refactor(voice): extract headless LiveVoiceEngine and decompose VoiceModal monolith"`

---

## 4. Acceptance Criteria
- [ ] No single file in `frontend/src/audio/` or `frontend/src/components/voice/` exceeds 350 lines.
- [ ] `VoiceModal.tsx` is under 250 lines.
- [ ] Zero duplicate WebSocket connection code in the frontend codebase.
- [ ] Headless tests (`LiveVoiceEngine.test.ts`) pass with 100% coverage of turn custody transitions.
