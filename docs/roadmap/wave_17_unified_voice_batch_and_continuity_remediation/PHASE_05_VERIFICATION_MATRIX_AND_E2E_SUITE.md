# Phase 05: Verification Matrix, Acoustic Canary & E2E Suite

> **Document:** `docs/roadmap/wave_17_unified_voice_batch_and_continuity_remediation/PHASE_05_VERIFICATION_MATRIX_AND_E2E_SUITE.md`  
> **Phase:** 05 of 05  
> **Status:** Specification Complete (Awaiting Execution)  
> **Target Files:**
> - `backend/src/testing/acoustic/scenarios/voiceBatchProgression.scenario.ts`
> - `frontend/src/tests/liveVoiceUrlBuilder.test.ts`
> - `frontend/src/tests/VoiceModalProgression.test.tsx`
> - `.github/workflows/deploy.yml`

---

## 1. Objectives & Scope

1. Construct an end-to-end multi-question headless acoustic canary scenario that verifies progression across questions 0, 1, and 2 without dropped frames or question stagnation.
2. Build unit test coverage for `buildLiveVoiceWebSocketUrl` and `VoiceModal` progression transitions.
3. Validate typecheck across the full repository (`npx tsc --noEmit`).
4. Execute deployment through canonical CI/CD (`.github/workflows/deploy.yml`) on cloud runners without local VPS Docker builds.

---

## 2. Test Matrix

| Test Suite | File | What is Verified | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **URL Serialization Unit Test** | `frontend/src/tests/liveVoiceUrlBuilder.test.ts` | Serialization of `questionIndex`, `totalQuestions`, `isRetry` | URL contains exact query params |
| **Deterministic Transition Unit Test** | `frontend/src/tests/VoiceModalProgression.test.tsx` | Calling `handleNextQuestion` advances to target question synchronously | `connect` called with `questionIndex: 1`, zero `setTimeout` |
| **Headless Batch Progression Canary** | `backend/src/testing/acoustic/scenarios/voiceBatchProgression.scenario.ts` | 3-Question Interview batch sequence via WebSocket gateway | Q0, Q1, Q2 greeted with distinct texts; TTFA $\le 1200$ms; 0 stalls |
| **Tutor Immediate Launch Test** | Manual / E2E Playwright | Opening tutor on card 2 starts dialogue without lobby | Model greets with Card 2 question; whiteboard drawer accessible |
| **Grand Finale Aggregation Test** | Integration Test | 3-question evaluation completes into Grand Finale | All 3 evaluations present in result ledger |

---

## 3. Headless Batch Progression Scenario Design

```ts
import { describeAcousticScenario } from '../acousticScenarioRunner';

export const voiceBatchProgressionScenario = describeAcousticScenario({
  name: 'Voice Multi-Question Batch Progression Canary',
  description: 'Asserts that transitioning to question N+1 correctly seeds new question context without stale closure regression.',
  turns: [
    // Turn 1: Question 0 (Initial)
    {
      action: 'connect',
      params: { questionIndex: 0, totalQuestions: 3, questionText: 'Что такое Spring Bean Lifecycle?' }
    },
    {
      expectedGreeting: (text) => text.includes('Bean Lifecycle'),
      candidateSpeech: 'Жизненный цикл бина включает инстанцирование, внедрение зависимостей и post-construct.',
      expectToolCall: 'submit_interview_evaluation'
    },
    // Turn 2: Question 1 (Next Question)
    {
      action: 'next_question',
      params: { questionIndex: 1, totalQuestions: 3, questionText: 'Как устроен ConcurrentHashMap в Java?' }
    },
    {
      expectedGreeting: (text) => text.includes('ConcurrentHashMap') && text.includes('вопрос 2 из 3'),
      candidateSpeech: 'ConcurrentHashMap использует блокировки по сегментам и CAS в Node массиве.',
      expectToolCall: 'submit_interview_evaluation'
    }
  ]
});
```

---

## 4. CI/CD Pipeline & Deployment Invariant Compliance

1. **Local Typecheck Verification:**
   ```bash
   cd frontend && npx tsc --noEmit
   cd ../backend && npx tsc --noEmit
   ```
2. **Commit & Push to Feature Branch:**
   ```bash
   git add .
   git commit -m "fix(voice): remediate batch question continuity and stale closure in tutor and interview modes (Wave 17)"
   git push origin <branch>
   ```
3. **Automated Cloud Runner Build (Zero VPS Docker Build Invariant):**
   - GitHub Actions executes build, lint, test, pushes GHCR image, and runs zero-downtime deployment on the VPS.
   - VPS executes only `docker compose pull && docker compose up -d`.

---

## 5. Verification Gate (Gate 5 Criteria)
1. All acoustic canary tests pass with zero stalls and $\ge 1200$ audio bytes per response.
2. Both frontend and backend compile cleanly without TypeScript errors.
3. CI/CD pipeline completes successfully on GitHub Actions.
