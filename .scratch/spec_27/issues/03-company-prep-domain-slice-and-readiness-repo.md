# 03: [Tracer-Bullet] Company Prep Domain Slice and Readiness Repository

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** closed-verified
**Verification Run:** GitHub Actions Run ID 45160011852 (100% Green)

## What to Build
Extract company preparation state from component-local React `useState` into a centralized Zustand domain slice and extract backend readiness calculations from Express handlers into a clean repository:
1. `frontend/src/store/slices/companySlice.ts`: Manages `selectedProfileId`, `activeSubTab`, `completedStageIds`, `readinessData`, `isLoading`, and `loadError` (&le; 200 lines).
2. `frontend/src/store/useAppStore.ts`: Re-exports `companySlice` and its state in the composite application store.
3. `frontend/src/components/companies/CompanyPrepStudio.tsx`: Decomposes bloated controller logic to consume `companySlice`, reducing lines to &le; 250 lines while preserving 100% of UI elements and ARIA accessibility.
4. `backend/src/services/companies/CompanyReadinessRepository.ts`: Encapsulates SQLite queries for theory mastery and coding submissions (&le; 180 lines).
5. `backend/src/routes/companies.ts`: Delegates readiness calculations to `CompanyReadinessRepository` (&le; 80 lines).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/store/slices/companySlice.ts` and `backend/src/services/companies/CompanyReadinessRepository.ts`.
- **Dependencies**: React, Zustand, SQLite.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **Contract Fragment**:
```typescript
export interface CompanySlice {
  selectedProfileId: string;
  activeCompanySubTab: 'pipeline' | 'theory' | 'challenges' | 'dossier' | 'runbook' | 'sql_arena' | 'take_home';
  completedCompanyStageIds: string[];
  companyReadinessData: any;
  isCompanyLoading: boolean;
  companyLoadError: string | null;
  setSelectedProfileId: (id: string) => void;
  setActiveCompanySubTab: (tab: any) => void;
  markStageComplete: (stageId: string) => void;
  setCompanyReadinessData: (data: any) => void;
}
```
- **Invariants**: All modified files &le; 400 lines, all new files &le; 350 lines.

## Explicit Non-Goals
- Do not delete any UI tabs, banner elements, or badges in `CompanyPrepStudio.tsx`.
- Do not alter `company_profiles.json`.

## Acceptance Criteria
- [ ] `companySlice.ts` created and integrated into `useAppStore.ts`.
- [ ] `CompanyPrepStudio.tsx` reduced to &le; 260 lines.
- [ ] `CompanyReadinessRepository.ts` encapsulates SQLite queries.
- [ ] `backend/src/routes/companies.ts` simplified and delegating.
