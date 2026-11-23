# Issue 02: [Prefactor] Global Audio Control Pill & Quick-Switch Drawer Decoupling

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/voice/GlobalAudioControlPill.tsx` (378 lines):
1. Extract `frontend/src/components/voice/audio_pill/useGlobalAudioPill.ts` (< 120 lines):
   - Popover open/close state and outside click / Escape listener
   - Voice preview greeting playback via HTML5 Audio element
   - Config bindings (`turnMode`, `voice`, `targetGrade`, `alwaysShowPreflight`)
2. Extract `frontend/src/components/voice/audio_pill/GlobalAudioDrawerContent.tsx` (< 150 lines):
   - Popover options, turn mode toggles, voice selector pills, grade buttons
3. Reduce `GlobalAudioControlPill.tsx` to $\le 130$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `useGlobalAudioPill.ts` & `GlobalAudioControlPill.tsx`.
- **Dependencies**: HTML5 Audio & React DOM events.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `GlobalAudioControlPill.tsx` shrinks from 378 to $\le 130$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
