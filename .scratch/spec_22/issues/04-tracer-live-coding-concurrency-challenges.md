# 04: [Tracer-Bullet] Live Coding & Concurrency Sandbox Challenges (LC-01 .. LC-05)

**Parent:** Spec 22 (`22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #01  
**Status:** ready-for-agent  

## What to Build
1. In `json/machine_coding_challenges.json`:
   - Ingest 5 live coding challenges:
     - `lc-alfa-01`: `SegmentedConcurrentHashMap` (Striped `ReentrantLock` per segment, volatile read visibility, avoiding `Collections.synchronizedMap` bottlenecks).
     - `lc-alfa-02`: Banking Stream API (`BigDecimal` groupingBy, reducing, avoiding float rounding, parallelStream thread-safety traps).
     - `lc-alfa-03`: Map to canonical `lld-key-value-cache-ttl` (In-Memory Key-Value Cache with TTL & Stampede protection) — **Zero Duplicate Code!**
     - `lc-alfa-04`: Immutable Class & `equals`/`hashCode` Contract (Defensive copying of mutable fields, hash collisions, record invariants).
     - `lc-alfa-05`: REST Controller with Jakarta Validation & Mockito ArgumentCaptor (`@Valid`, `@Pattern`, `ArgumentCaptor` in unit tests).
2. Starter workspace & tests:
   - Provide clean starter workspace files and JUnit 5 test suites for `lc-alfa-01`, `lc-alfa-02`, `lc-alfa-04`, `lc-alfa-05`.
3. In `backend/src/services/dbSeedCatalogs.ts`:
   - Seed challenges into `coding_challenges` with track `alfa_livecoding` and badge `🅰️ Alfa Live Coding`.
4. In `frontend/src/services/arenaNavigator.ts`:
   - Verify `launchArenaTask` opens challenges directly in `PracticeArena` with code hydration.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `json/machine_coding_challenges.json` & `PracticeArena`
- **Dependencies**: Real SQLite database (`data/interview.db`).
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Time Virtualization Invariant: Clock injection where time is tested.
- Financial Precision Invariant: `BigDecimal` in `lc-alfa-02`, zero floats.
- Manifest adheres to `CodingChallenge` schema with `starterFiles` and `tests`.

## Explicit Non-Goals
- Modifying `ResidentSandboxDaemon.java` runner daemon.
- Re-implementing cache logic for `lc-alfa-03` (must reuse `lld-key-value-cache-ttl`).

## Acceptance Criteria
- [ ] Challenges seeded cleanly into `coding_challenges`.
- [ ] Starter files and unit tests compile and run in sandbox.
- [ ] Direct navigation from `launchArenaTask` opens challenge in Practice Arena.
