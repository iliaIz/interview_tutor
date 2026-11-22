# 03: [Prefactor] Rename tutorService to BugChallengeGeneratorService and Consolidate Domain Exports

**Parent:** Spec 23 (`spec-23-codebase-deepening-and-seam-consolidation.md`)  
**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
1. Rename `backend/src/services/tutorService.ts` to `backend/src/services/BugChallengeGeneratorService.ts`.
   - The current file name `tutorService.ts` is an architectural misnomer: it does not perform Socratic tutoring; it generates bug-hunt challenges (`generateBugChallenge`, `buildBugChallengeSystemPrompt`).
2. Update callers and imports across the backend:
   - `backend/src/routes/tutor.ts` (router for `/api/tutor/saved-challenges`, `/api/tutor/generate`)
   - `backend/src/services/dbSeedCatalogs.ts` or wherever imported
3. Provide a temporary backward-compatibility re-export in `backend/src/services/tutorService.ts` with `@deprecated` tag to ensure zero breaking changes during migration.
4. Clean up unused imports and verify domain clarity.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/BugChallengeGeneratorService.ts` and `backend/src/routes/tutor.ts`.
- **Dependencies**: SQLite DB, LiteLLM Proxy chat URL. Zero domain mocks.
- **Verification Command**: `npm --prefix backend run build` (or cloud runner `remote-verify`).

## Embedded Contract Slice & Invariants
- Hoare Logic {P} C {Q}:
  - {P}: `tutorService.ts` is imported by bug-hunt generation routes.
  - C: File is renamed to `BugChallengeGeneratorService.ts`. `tutorService.ts` re-exports it. Callers are updated.
  - {Q}: All tests pass. Domain terminology is aligned with actual file contents.
- Rule 8 Limit: `BugChallengeGeneratorService.ts` $\le 350$ lines.

## Explicit Non-Goals
- Do not alter the prompt templates or ground truth physics in `buildBugChallengeSystemPrompt`.
- Do not alter the database repository queries in `bugChallengeRepository.ts`.

## Acceptance Criteria
- [ ] `BugChallengeGeneratorService.ts` cleanly houses bug challenge generation.
- [ ] Callers in `backend/src/routes/tutor.ts` import the accurately named service.
- [ ] Full backend TypeScript compilation passes without errors.
