# Issue 02: [Prefactor] Audio Recap Settings Value Object & Subcomponents

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/audio/RecapSettingsForm.tsx` (370 lines):
1. Extract `frontend/src/components/audio/recap/recapConfigTypes.ts` (< 50 lines):
   - `AudioRecapConfig` value object
2. Extract `frontend/src/components/audio/recap/VoiceSelectorGroup.tsx` (< 90 lines):
   - Solo/duo voice selection & greeting preview audio triggers
3. Extract `frontend/src/components/audio/recap/AdvancedPromptsCollapsible.tsx` (< 80 lines):
   - Accordion for system and user prompt tuning
4. Reduce `RecapSettingsForm.tsx` to $\le 100$ lines with a 5-prop interface. Update `AudioRecapModal.tsx` to pass cohesive config.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `RecapSettingsForm.tsx` & `AudioRecapModal.tsx`.
- **Dependencies**: React UI form state.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `RecapSettingsForm.tsx` shrinks from 370 to $\le 100$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
