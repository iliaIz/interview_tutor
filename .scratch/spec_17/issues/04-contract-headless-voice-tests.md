# 04: [Contract] Headless Audio Playout & Voice Engine Regression Tests

**Archetype:** Contract  
**Blocked by:** #01, #02, #03  
**Status:** ready-for-agent  

## What to Build
Update and expand headless contract test suites:
1. `frontend/tests/audioPlayoutContracts.test.ts`: Verify that `handleInterruption()` maintains non-zero playout gain and subsequent chunk enqueues render with full nominal amplitude ($1.5$).
2. `frontend/tests/liveVoiceEngine.test.ts`: Verify that speaker feedback ($-35$ dBFS) during `AI_SPEAKING` does not trigger ducking or barge-in, while sustained speech $\ge -29$ dBFS for $\ge 180$ ms cleanly triggers barge-in.
3. Verify remote execution via `remote-verify` across all quality gates.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/tests/audioPlayoutContracts.test.ts`, `frontend/tests/liveVoiceEngine.test.ts`
- **Verification Command:** `remote-verify`

## Embedded Contract Slice & Invariants
- Zero internal mocks; synthetic PCM fixtures only.
- Strict conformance to Google Gemini Live protocol standards.

## Explicit Non-Goals
- Do not run local compilers or heavy test suites on the 1.8 GB VPS.

## Acceptance Criteria
- [ ] Headless playout contract tests pass in Node.js.
- [ ] Headless engine contract tests pass in Node.js.
- [ ] `remote-verify` completes with 100% success across all 24 quality gate steps in cloud runner.
