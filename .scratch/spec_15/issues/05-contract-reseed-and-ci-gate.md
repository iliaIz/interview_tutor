# 05: [Contract] Database Catalog Reseed, Integrity Verification & CI Gate Enforcement

**Archetype:** Contract
**Blocked by:** #02, #03, #04
**Status:** ready-for-agent

## What to Build
Synchronize the remediated challenge manifests with SQLite database `data/interview.db` and wire the integrity verifier into CI quality gates.

1. Reseed `coding_challenges` in SQLite `data/interview.db` using `dbSeedCatalogs.ts`.
2. Clear any stale submissions or cached evaluations for modified challenges where users had not completed them.
3. Integrate `verify_starter_workspaces_integrity.js` into `.github/workflows/deploy.yml` (or test runner) so regression is blocked automatically.
4. Run `remote-verify` to ensure cloud CI builds and tests pass cleanly.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: SQLite DB `data/interview.db`, `verify_starter_workspaces_integrity.js`, GitHub Actions CI.
- **Dependencies**: SQLite database, GitHub Actions runner.
- **Verification Command**: `node backend/tests/verify_starter_workspaces_integrity.js && remote-verify`

## Embedded Contract Slice & Invariants
- 100% of the 132 challenges must be clean (zero stillborn workspaces).
- Zero local compilation on VPS (adheres to Rule 0).
- Remote verification must succeed.

## Explicit Non-Goals
- Modifying sandbox containers or VPS infrastructure.

## Acceptance Criteria
- [ ] SQLite database `coding_challenges` table updated with clean starter workspaces.
- [ ] `node backend/tests/verify_starter_workspaces_integrity.js` exits with code 0 across all 132 katas.
- [ ] `remote-verify` passes on GitHub Actions.
