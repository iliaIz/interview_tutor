# 02: [Tracer-Bullet] Raiffeisen Track Starter Workspaces Remediation (sparse-vector & code review katas)

**Archetype:** Tracer-Bullet
**Blocked by:** #01
**Status:** ready-for-agent

## What to Build
Remediate the defective starter workspaces in the Raiffeisen track:
1. `sparse-vector` (LLD-74 in `json/machine_coding_challenges.json`):
   - Replace the completed two-pointer dot-product algorithm in `SparseVector.java` with a TDD stub: store indices/values or skeleton fields and throw `new UnsupportedOperationException("Not implemented yet")` in `dotProduct(SparseVector other)`.
2. `case_transfer_service` (LLD-24 in `json/refactoring_challenges.json`):
   - Restore the 7 interview anti-patterns: unsorted locks (deadlock risk), missing `findForUpdate`, non-atomic balance checks, missing fail-fast check, etc.
3. `case_account_collections` (LLD-23 in `json/refactoring_challenges.json`):
   - Restore the 6 interview anti-patterns: `package java.snippet.account`, `TreeMap<Date, TransactionRecord>` (drops concurrent transactions in same ms), `double balance` (floating-point loss), and leaking mutable internal transaction list.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `json/machine_coding_challenges.json` and `json/refactoring_challenges.json`
- **Dependencies**: None (JSON schema compliance).
- **Verification Command**: `node backend/tests/verify_starter_workspaces_integrity.js --filter=raiffeisen`

## Embedded Contract Slice & Invariants
- `iban-validator` was already remediated; ensure it remains a valid TDD stub.
- All JSON manifests must parse without syntax errors and conform to `StarterWorkspaceManifest` schema.

## Explicit Non-Goals
- Modifying test suites (`*Test.java` files).

## Acceptance Criteria
- [ ] `sparse-vector` starter code throws `UnsupportedOperationException`.
- [ ] `case_transfer_service` and `case_account_collections` contain documented code review defects.
- [ ] Passes integrity verifier for Raiffeisen track katas.
