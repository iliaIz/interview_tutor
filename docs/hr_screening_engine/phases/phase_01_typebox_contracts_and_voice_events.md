# Phase 1: TypeBox Contracts, Meta-Schemas & Voice Events

> **Document:** `docs/hr_screening_engine/phases/phase_01_typebox_contracts_and_voice_events.md`  
> **Status:** Phase 1 Specification & Execution Gate  
> **Quality Gate G1:** `npm --prefix shared run build` exit code 0.

---

## 1. Objectives & Scope
1. Implement canonical `@sinclair/typebox` schemas in `shared/src/schemas/hrSimulator.ts`:
   - `CandidateDossierSchema` and sub-schemas (`LegalComplianceSchema`, `CareerTrackItemSchema`, `CompensationExpectationsSchema`, `ProjectShowcaseSchema`).
   - `JobContextSchema`.
   - `HrSessionConfigSchema`, `HrSessionModeSchema`, `HrPersonaIdSchema`, `HrSimulationPhaseSchema`.
   - `HrAnchorCardSchema`, `HrAnchorStatusSchema`.
   - `HrTelemetryTickSchema`, `HrScorecardSchema`.
2. Expand `shared/src/schemas/voiceEvents.ts` with `HR_VOICE_EVENTS` constants and payload interfaces.
3. Update `shared/src/index.ts` with re-exports and type guards: `isHrSessionType` and `isHrPersonaId`.

---

## 2. Invariants & Guardrails
- File length of `shared/src/schemas/hrSimulator.ts` $\le 300$ lines.
- No personal names or hardcoded candidate data in schema descriptions.
- Full backwards compatibility with existing types in `shared/src/index.ts`.

---

## 3. Verification Commands
```bash
npm --prefix shared run build
```
Gate passes when TypeScript compiler emits `dist/` declarations cleanly without type errors.
