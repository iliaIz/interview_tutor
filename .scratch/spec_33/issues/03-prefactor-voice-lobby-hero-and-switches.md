# Issue 03: [Prefactor] Voice Lobby Hero & Mode Switches Decoupling

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/voice/VoiceLobbyView.tsx` (354 lines):
1. Extract `frontend/src/components/voice/lobby/VoiceLobbyHero.tsx` (< 90 lines):
   - Avatar icon / gradient ring
   - Persona name & company badges
   - Strategy description
   - Turn mode pill
2. Extract `frontend/src/components/voice/lobby/VoiceLobbyModeSwitches.tsx` (< 90 lines):
   - RU/EN language toggle buttons
   - Deep-Dive toggle button
3. Reduce `VoiceLobbyView.tsx` to $\le 140$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `VoiceLobbyView.tsx`.
- **Dependencies**: Pure React components.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `VoiceLobbyView.tsx` shrinks from 354 to $\le 140$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
