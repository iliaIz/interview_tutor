# 01: [Prefactor] Company Prep & Theory Deck Multimodal Adapter

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Eliminate eager chat spam and modality split-brain in company preparation:
1. Create `CompanyTrackContextAdapter` normalizing company profiles and theory questions into `TutorActiveContext`.
2. Extract `useCompanyTheoryDeck` headless hook managing question catalog, mastery toggling, filters, and search.
3. Decompose `CompanyTheoryDeckTab.tsx` (339 lines -> <= 180 lines) using `CompanyQuestionItem.tsx` and `CompanyTheoryHeader.tsx`.
4. Provide 3 distinct user actions per company question:
   - 🎙️ **Тьютор** (`sessionType: 'tutor'` in `VoiceModal`)
   - 🎙️ **Скрининг** (`sessionType: 'interview'` in `VoiceModal`)
   - 💬 **Спросить Тьютора** (opens `PracticeTutorDrawer` with context, ZERO auto-send).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/services/companies/CompanyTrackContextAdapter.ts` and `frontend/src/components/companies/CompanyTheoryDeckTab.tsx`.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Zero-Auto-Send Invariant: `store.toggleOpen(true)` MUST NOT call `store.sendMessage(...)`.
- Rule 8: All new files <= 350 lines, modified files <= 400 lines.

## Explicit Non-Goals
- Do not modify backend database schemas or `company_profiles.json`.
