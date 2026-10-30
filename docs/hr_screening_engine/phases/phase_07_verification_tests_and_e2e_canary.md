# Phase 7: Automated Test Suite, Acoustic Canary & CI/CD Gate

> **Document:** `docs/hr_screening_engine/phases/phase_07_verification_tests_and_e2e_canary.md`  
> **Status:** Phase 7 Specification & Execution Gate  
> **Quality Gate G7:** Full quality-gate suite passing in GitHub Actions CI/CD on branch `feat/wave-20-hr-voice-screening-engine`.

---

## 1. Objectives & Scope
1. Implement unit tests in `backend/src/tests/hr/hrSimulator.spec.ts`:
   - Validates TypeBox schemas with positive and negative cases.
   - Tests `hrPromptBuilder.ts` anti-sycophancy directives and ground truth serialization.
   - Tests `hrContextResolver.ts` fixture loading.
2. Implement acoustic canary in `backend/src/tests/hr/acousticHrScreeningCanary.ts`:
   - Headless acoustic replay of canonical 75-second Elevator Pitch PCM audio.
   - Asserts all 6 anchor cards are spotted, WPM is $115\text{–}135$, and scorecard composite $\ge 85$.
3. Git push to origin `feat/wave-20-hr-voice-screening-engine`.
4. Monitor GitHub Actions CI/CD pipeline until all quality-gate jobs succeed.

---

## 2. Invariants & Guardrails
- Zero VPS Docker builds (Rule 0).
- All tests pass locally and on GitHub Actions runners.
- Zero regressions across existing interview and tutor test suites.

---

## 3. Verification Commands
```bash
npm --prefix backend test
git push origin feat/wave-20-hr-voice-screening-engine
```
