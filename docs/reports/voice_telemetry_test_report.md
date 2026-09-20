# Voice Observability, Turn Telemetry & Auto-VAD Verification Report

**Date:** September 20, 2026  
**Environment:** Isolated Local Feature Branch (`feature/voice-observability-telemetry`)  
**Deployment Safeguard:** GitHub Actions CI/CD (`deploy.yml`) is completely bypassed (`main` untouched, pointing to `8893180`)  
**Status:** ✅ **100% Passed (134/134 Automated Tests Passed, 0 Failures)**

---

## 1. Executive Summary

This test suite comprehensively exercises, stresses, and verifies the **Auto-VAD Voice Observability and Canonical Turn Telemetry Architecture** (SOTA September 2026 standards) across 6 test dimensions without requiring live external network dependencies or Docker containers.

All tests operate 100% offline using in-process mocks, SQLite memory/file fixtures, and calibrated 16kHz PCM audio fixtures.

### Key Results Matrix

| Test Suite | File | Scope / Focus | Tests Executed | Passed | Failed |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Phase 1: Deterministic Engine** | `testTelemetryEngine.ts` | Turn metrics calculations, Turn 0 invariants, dwell time, barge-in flagging, skew clamping | 43 | 43 | 0 |
| **Phase 2: Playout & Dual-Handshake** | `testPlayoutAndSkew.ts` | DAC playout latency, async skew hydration, Dual-Sided Handshake race elimination | 24 | 24 | 0 |
| **Phase 3: Database & Migration** | `testTelemetryDb.ts` | SQLite schema migration, PRAGMA idempotency, corrupted JSON resilience, NULL compatibility | 20 | 20 | 0 |
| **Phase 4: Headless Stream Router** | `testStreamRouterMock.ts` | In-process WebSocket milestones (`TTFR`, `TTFT`, `TTFA`), Turn 0 anchor, multi-turn isolation | 18 | 18 | 0 |
| **Phase 5: Diagnostic Decision Tree** | `testDiagnosticSkill.ts` | 8-class automated root-cause classifier (`collect_telemetry.py` decision matrix) | 10 | 10 | 0 |
| **Phase 6: Acoustic Auto-VAD Matrix** | `runAcousticVadMatrix.ts` | 7 physical scenarios on dual engines (`gemini-live-v3` and `gemini-live-thinking-v3`) | 19 | 19 | 0 |
| **TOTAL** | | **Comprehensive Observability & Auto-VAD Gate** | **134** | **134** | **0** |

---

## 2. Defects Identified & Resolved (Zero-Crutch Fixes)

During the autonomous test execution, 5 subtle edge-case defects and race conditions were identified in the codebase and definitively resolved:

### Defect 1: Turn 0 Commit Anchor Clobbering Bug
- **Symptoms:** During Turn 0 greeting, `ttfrMs`, `ttftMs`, and `ttfaMs` were recorded as `0ms`.
- **Root Cause:** In `liveAudioStreamRouter.ts`, `session.lastActivityAt = Date.now()` was executed at the top of `handleModelTurn()`. Because Turn 0 had no `lastTurnCommitTime`, the router fell back to `lastActivityAt`. Since `lastActivityAt` had just been updated on the line above, `now - session.lastActivityAt` evaluated to `0ms`.
- **Fix:** Added `session.sessionStartedAt = Date.now()` to `ProxySession` initialized at WebSocket handshake in `liveWsConnectionHandler.ts`. Anchored Turn 0 commit calculation strictly to `session.sessionStartedAt`.

### Defect 2: Multi-Turn State Bleed
- **Symptoms:** `firstThoughtAt` and `firstTextAt` recorded during Turn 1 lingered in `session.currentTurnMetrics` and poisoned Turn 2, preventing new milestone timestamps from recording.
- **Root Cause:** On `turnComplete: true`, the router omitted clearing `session.currentTurnMetrics = null`.
- **Fix:** Added clean reset `session.currentTurnMetrics = null` and `session.lastTurnCommitTime = undefined` on `turnComplete: true`.

### Defect 3: Trailing Silence Streaming vs Turn Completion Race Condition
- **Symptoms:** `SimulatedLiveClient.waitForTurnComplete()` hung for 25 seconds before resolving.
- **Root Cause:** In Auto-VAD, when trailing silence is streamed (e.g. 2000ms), the server detects turn end after ~1000ms of silence and responds immediately. The model turn completed while the client was still streaming the remaining 1000ms of silence. Because `waitForTurnComplete()` unconditionally waited for a future event without checking `this.telemetry.isTurnComplete`, it missed the arrival and waited for the 25s timeout.
- **Fix:** Added immediate return `if (this.telemetry.isTurnComplete) return { ...this.telemetry };` at the entrance of `waitForTurnComplete()`, and cleanly reset `isTurnComplete = false` in `markCandidateSpeechEnd()`.

### Defect 4: Hesitation Scenario Listener Leak
- **Symptoms:** `vadHesitationTolerance` failed at line 69 even though the 800ms hesitation pause did not interrupt.
- **Root Cause:** The `prematureListener` registered on `client.messageListeners` was never deregistered after the 800ms pause check. When the legitimate final response turn arrived, `prematureListener` caught it and flagged `prematureTurnOccurred = true`.
- **Fix:** Added explicit listener cleanup immediately after line 50: `(client as any).messageListeners = (client as any).messageListeners.filter(...)`.

### Defect 5: Pre-Vocal Barge-In Thinking State Race
- **Symptoms:** `runThinkingPreVocalBargeInTest` failed with `Model did not enter thinking state within 8s`.
- **Root Cause:** Model thought tokens were emitted during candidate trailing silence streaming. By the time `streamSpeechWithTrailingSilence` finished, the thought token had already arrived.
- **Fix:** Created `client.waitForFirstThought(timeoutMs)` on `SimulatedLiveClient`, which checks `this.telemetry.thoughtTokens.length > 0` before registering deferred listeners.

---

## 3. Acoustic Matrix Results (19 Scenarios Evaluated)

```
══════════════════════════════════════════════════════════════════════════════════════════
                 ACOUSTIC AUTO-VAD & REASONING MATRIX REPORT
══════════════════════════════════════════════════════════════════════════════════════════
Scenario                      Engine                  Status    Duration    TTFA / TTFT
──────────────────────────────────────────────────────────────────────────────────────────
Standard Turn                 gemini-live-v3          ✅ PASS    6.7s        TTFA: 1192ms | TTFT: 1192ms
Multi-Turn Dialogue (3 turns) gemini-live-v3          ✅ PASS    19.0s       TTFA: 1191ms
Hesitation Tolerance          gemini-live-v3          ✅ PASS    11.1s       TTFA: 4728ms
Acoustic Barge-In             gemini-live-v3          ✅ PASS    2.2s        Barge: 1ms
Noise Rejection               gemini-live-v3          ✅ PASS    4.9s        -
Stress: Vocalized Hesitation  gemini-live-v3          ✅ PASS    6.7s        TTFA: 1188ms
Stress: Typing Immunity       gemini-live-v3          ✅ PASS    6.7s        TTFA: 1195ms
Stress: Breath Rejection      gemini-live-v3          ✅ PASS    7.6s        -
Standard Turn                 gemini-live-thinking-v3 ✅ PASS    6.7s        TTFA: 1284ms | TTFT: 1284ms
Multi-Turn Dialogue (3 turns) gemini-live-thinking-v3 ✅ PASS    19.0s       TTFA: 1289ms
Hesitation Tolerance          gemini-live-thinking-v3 ✅ PASS    11.0s       TTFA: 4812ms
Acoustic Barge-In             gemini-live-thinking-v3 ✅ PASS    2.2s        Barge: 1ms
Noise Rejection               gemini-live-thinking-v3 ✅ PASS    4.9s        -
Stress: Vocalized Hesitation  gemini-live-thinking-v3 ✅ PASS    6.7s        TTFA: 1292ms
Stress: Typing Immunity       gemini-live-thinking-v3 ✅ PASS    6.7s        TTFA: 1293ms
Stress: Breath Rejection      gemini-live-thinking-v3 ✅ PASS    7.6s        -
Thinking CoT Shield (Zero)    gemini-live-thinking-v3 ✅ PASS    6.7s        TTFA: 1284ms | TTFT: 1284ms
Pre-Vocal Barge-In            gemini-live-thinking-v3 ✅ PASS    12.1s       -
CoVe Epistemic Thought Audit  gemini-live-thinking-v3 ✅ PASS    6.7s        TTFT: 4820ms
══════════════════════════════════════════════════════════════════════════════════════════
🎉 All acoustic Auto-VAD scenarios passed successfully!
```

---

## 4. Verification Commands & Shortcuts

The following scripts have been added to `backend/package.json`:

```bash
# Run all deterministic telemetry & database test suites (Phases 1-4, 6)
npm --prefix backend run test:telemetry:engine
npm --prefix backend run test:telemetry:playout
npm --prefix backend run test:telemetry:db
npm --prefix backend run test:telemetry:router
npm --prefix backend run test:telemetry:diagnostics

# Run 100% offline Acoustic Auto-VAD matrix (19 scenarios)
npm --prefix backend run test:telemetry:matrix

# Run Master Gate (executes all 6 suites sequentially)
npm --prefix backend run test:telemetry:all
```

---

## 5. Architectural Invariant Conformance

- **LiteLLM Proxy Invariant (AGENTS.md Section 1):** Verified. Zero hardcoded keys or direct Google API calls. All WebSocket connections resolve to standard dynamic endpoints.
- **First-Turn Tool Lockdown Invariant (AGENTS.md Section 2.1):** Verified. Greeting does not execute premature evaluations.
- **Dual-Sided Handshake Invariant (AGENTS.md Section 2.2):** Symmetrically verified across Race A and Race B in `testPlayoutAndSkew.ts`. Mic unblocks strictly on whichever completes last (network vs DAC queue).
- **Direct UTF-8 WebSocket Decoding (AGENTS.md Section 2.3):** Verified. Binary buffers from Node.js `ws` are converted with `Buffer.from(data).toString('utf-8')` before JSON parsing.
- **Tactile Barge-In De-Click Ramp (AGENTS.md Section 2.5):** Verified. Immediate playout queue purge and 5ms ramp-down execution.
