# Issue 01: [Prefactor] Company Prep Studio Session & Header Decoupling

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/companies/CompanyPrepStudio.tsx` (365 lines, top churn hotspot):
1. Extract `frontend/src/components/companies/hooks/useCompanyStudioSession.ts` (< 180 lines):
   - Profile loading from `/api/companies`
   - Readiness score calculation (CRI)
   - Completed stages localStorage persistence
   - AI Copilot context synchronization and unmount cleanup
   - Stage and runbook task launch navigation (`launchArenaTask`)
2. Extract `frontend/src/components/companies/components/CompanyPrepStudioHeader.tsx` (< 90 lines):
   - Brand banner
   - Sub-tab buttons (Dossier, Pipeline, Tasks, Theory, Coding, SQL Arena, Take-Home)
3. Reduce `CompanyPrepStudio.tsx` to $\le 140$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `useCompanyStudioSession.ts` & `CompanyPrepStudio.tsx`.
- **Dependencies**: React hooks & browser localStorage.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `CompanyPrepStudio.tsx` shrinks from 365 to $\le 140$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
