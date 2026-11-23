# 01: [Prefactor] Voice Tutor Presentation & Headless Session Extraction

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
Extract the headless session hook `useVoiceTutorSession.ts` from `VoiceTutorView.tsx` (currently 801 lines with 32 props passed from `VoiceModal.tsx`).
1. Encapsulate keyboard hotkeys (`Alt+ArrowLeft`, `Alt+ArrowRight`), text input management (`inputText`, `setInputText`, `handleInputKeyDown`, `handleSendCustomText`), tutor mode switching, and session pause controls in `useVoiceTutorSession.ts`.
2. Slim down `VoiceTutorView.tsx` to &le; 350 lines, taking a unified `session` object plus `activeQuestion` and `onClose`.
3. Keep 100% of existing UI features, Markdown rendering, CodeViewer, selection focus, and accessibility contracts intact (UI Deletion Test Exception).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/audio/useVoiceTutorSession.ts` and `frontend/src/components/voice/VoiceTutorView.tsx`.
- **Dependencies**: React 18, `@interview-prep/shared`.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Cognitive Bounding (Rule 8): `VoiceTutorView.tsx` &le; 350 lines; `useVoiceTutorSession.ts` &le; 300 lines.
- Voice Modal Props: Props passed from `VoiceModal` to `VoiceTutorView` shrink from 32 down to minimal interface.

## Explicit Non-Goals
- Modifying Web Audio DSP pipelines or `NativeLiveVoiceEngine.ts`.
- Changing the rubric scorecard or verdict rendering logic.

## Acceptance Criteria
- [ ] `useVoiceTutorSession.ts` created and &le; 300 lines.
- [ ] `VoiceTutorView.tsx` decomposed and &le; 350 lines.
- [ ] All keyboard shortcuts (`Alt+ArrowLeft`, `Alt+ArrowRight`, `Enter`) function identically.
- [ ] Remote verification (`remote-verify`) passes 100% green.
