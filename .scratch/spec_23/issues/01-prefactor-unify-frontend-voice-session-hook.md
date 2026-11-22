# 01: [Prefactor] Delete Obsolete useLiveAudioSession Adapter and Unify on useLiveVoiceSession

**Parent:** Spec 23 (`spec-23-codebase-deepening-and-seam-consolidation.md`)  
**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
1. Delete `frontend/src/hooks/useLiveAudioSession.ts` (108-line obsolete wrapper created during the initial Live Voice refactoring).
2. Migrate all 3 remaining call sites directly to `frontend/src/audio/useLiveVoiceSession.ts`:
   - `frontend/src/components/practice/tutor/PracticeVoiceContext.tsx`
   - `frontend/src/components/system_design/arena/useSystemDesignVoiceDefense.ts`
   - `frontend/src/components/voice/VoiceTutorView.tsx`
3. Ensure `useLiveVoiceSession` exposes direct boolean projections (`isConnected`, `isAiSpeaking`, `isListening`, `isRecording`, `isUserSpeaking`, `isPauseHolding`, `rmsDb`) so no caller needs an intermediate translation layer.
4. Eliminate the 11-argument parameter smell in `liveMicChunkDispatcher.ts` by passing state via engine context.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/audio/useLiveVoiceSession.ts` and its consuming components.
- **Dependencies**: React 18, Web Audio API, Vitest / TypeScript compiler. Zero backend mocks.
- **Verification Command**: `npx tsc --noEmit --project frontend/tsconfig.json` (or cloud runner `remote-verify`).

## Embedded Contract Slice & Invariants
- Hoare Logic {P} C {Q}:
  - {P}: `useLiveAudioSession.ts` exists and is imported by 3 components.
  - C: 3 components are updated to import `useLiveVoiceSession` from `../../audio/useLiveVoiceSession` (or alias). `useLiveAudioSession.ts` is deleted.
  - {Q}: Codebase compiles with 0 errors. Voice tutoring in Practice Arena and System Design Defense works identically.
- Rule 8 Limit: Modified files $\le 400$ lines.

## Explicit Non-Goals
- Do not alter `frontend/src/services/AudioPlayoutManager.ts` or Web Audio DSP nodes.
- Do not redesign the UI layouts of `PracticeVoiceContext` or `useSystemDesignVoiceDefense`.

## Acceptance Criteria
- [ ] `frontend/src/hooks/useLiveAudioSession.ts` is deleted.
- [ ] Zero references to `useLiveAudioSession` remain in `frontend/src/`.
- [ ] `frontend/src/audio/useLiveVoiceSession.ts` satisfies all contracts required by callers.
- [ ] Full TypeScript typecheck passes cleanly.
