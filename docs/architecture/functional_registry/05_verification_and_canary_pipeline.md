# 05. Verification Harness & Acoustic Canary Pipeline

> **Location:** `docs/architecture/functional_registry/05_verification_and_canary_pipeline.md`  
> **Subsystem (Level 1):** Verification Harness & Acoustic Canary Pipeline  
> **Primary Files:** [`backend/tests/audio/runAcousticVadMatrix.ts`](file:///home/djelu/projects/interview_tutor/backend/tests/audio/runAcousticVadMatrix.ts), [`backend/tests/audio/SimulatedLiveClient.ts`](file:///home/djelu/projects/interview_tutor/backend/tests/audio/SimulatedLiveClient.ts), [`backend/tests/audio/fixtures/acousticFixtures.ts`](file:///home/djelu/projects/interview_tutor/backend/tests/audio/fixtures/acousticFixtures.ts)

---

## 1. Subsystem Scope
Headless verification harness and CI/CD pre-flight gate. Replays real acoustic PCM fixtures against the live WebSocket endpoint, testing end-to-end audio delivery, turn-taking latency, and guarding against regressions.

---

## 2. Touch List & Function Hierarchy (Level 2)

### 2.1 `runAcousticVadMatrix()`
- **Location:** [`runAcousticVadMatrix.ts#L40-L150`](file:///home/djelu/projects/interview_tutor/backend/tests/audio/runAcousticVadMatrix.ts)
- **What Was Done:**
  - Automated canary test suite executed during CI/CD (`--suite=canary`) and comprehensive regression suites.
  - Added inter-session cooldown (`INTER_SESSION_COOLDOWN_MS = 2500`) to prevent back-to-back WebSocket sessions from triggering upstream rate limits.
  - Replays synthesized speech fixtures (e.g. Russian candidate answer) and asserts non-zero audio responses.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Automated tests prevent regressions from reaching production.
  - *Empirical Finding:* While the canary suite validates correctness, running exhaustive matrix tests repeatedly against free-tier Google API keys burns daily quotas (143 sessions logged in 24 hours).
  - *Actionable Takeaway:* CI/CD must run minimal-path canaries (1 fast scenario), reserving multi-turn stress tests for dedicated environments.
- **Rationale & "Why":** Provides automated proof of live audio streaming health before container deployment.
- **Invariants:** Pre-flight canary must pass in CI/CD before VPS deployment.

---

### 2.2 `SimulatedLiveClient.connectAndExchange()`
- **Location:** [`SimulatedLiveClient.ts#L50-L130`](file:///home/djelu/projects/interview_tutor/backend/tests/audio/SimulatedLiveClient.ts)
- **What Was Done:** Headless WebSocket client simulating candidate browser behavior: initiates session, receives greeting audio, streams 16kHz PCM chunks at real-time intervals (100ms frames), and measures round-trip TTFA and total audio bytes.
- **Hypotheses & Intermediate Conclusions:**
  - Pacing audio streaming at real-time cadence (100ms intervals) rather than dumping all bytes instantaneously is essential for Gemini's cloud VAD to properly endpoint speech boundaries.
- **Rationale & "Why":** Faithfully replicates browser AudioWorklet streaming behavior in a headless CI environment.
- **Invariants:** Must stream PCM at real-time intervals; bulk dumping triggers unnatural model endpointing.

---

### 2.3 `assertAudioBytesAndLatency()`
- **Location:** [`runAcousticVadMatrix.ts#L160-L210`](file:///home/djelu/projects/interview_tutor/backend/tests/audio/runAcousticVadMatrix.ts)
- **What Was Done:** Enforces strict conjunction SLA on model responses:
  - Minimum audio bytes: $\ge 1200$ bytes ($\ge 250$ms spoken audio).
  - Minimum subtitle text: $\ge 10$ characters.
  - Maximum TTFA latency: $\le 2500$ms.
- **Hypotheses & Intermediate Conclusions:**
  - Gemini occasionally emits empty responses (`turnComplete: true` with 0 bytes audio) under high load. This assertion detects silent regressions immediately.
- **Rationale & "Why":** Guarantees candidate experience meets voice tutoring standards.
- **Invariants:** Fails fast if model returns digital silence or un-recovered non-speech tokens.
