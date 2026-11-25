# Spec 44: Manifest-Driven Company Readiness SSOT & Cross-Arena Navigation Seam

> **Governing Glossary:** `Curated Company Practice Track`, `Arena Pre-Hydration Envelope` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0002](../../adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md), [ADR 0003](../../adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · `< 20ms` SQLite readiness query

---

## 1. Intent & Workload Envelope
Eliminate `alfa_digital` branches and magic totals in `CompanyReadinessRepository` and company views, enforce TypeBox validation on `company_profiles.json` load (fixing `prompt` -> `promptMessage` drift), enforce authenticated tenant isolation (`getAuthUserId`) in `/api/companies/*`, and unify `academySlice.launchAcademyStepTarget` with `ArenaWorkspaceCoordinator` (`arenaNavigator.ts`).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- **UI Deletion Test Exception:** Conditional rendering, filter buttons, keyboard shortcuts, and ARIA attributes in `CompanyPrepStudioHeader.tsx`, `CompanyChallengesTab.tsx`, `CompanyPipelineTab.tsx`, and `CompanyPrepStudio.tsx` MUST remain intact.
- PGlite WASM SQL runner internals (`pgliteExecutionEngine.ts`) and SQL challenge datasets MUST NOT be modified.

---

## 3. Pre-Agreed Verification Seams
- **Backend Seam:** `CompanyReadinessRepository` (`loadProfiles`, `calculateReadiness`, `getCuratedQuestions`) tested against `local-substitutable` in-memory `better-sqlite3` DB + schema test `backend/tests/test_company_profile_schema.js` + route handler auth `backend/src/routes/companies.ts`.
- **Frontend Seam:** `ArenaWorkspaceCoordinator.launch` / `resolveStageTarget` / `resolveRunbookTaskTarget` in `frontend/tests/arenaNavigator.test.ts` + `CompanyTrackContextAdapter` (`createCompanyVoiceProps`, `createTheoryQuestionContext`).

---

## 4. Formal Wire & Messaging Contracts
Extend `CompanyProfileSchema` (`shared/src/schemas/companyProfile.ts`) with optional additive manifest fields:
```ts
export const ReadinessCategoryRuleSchema = Type.Object({
  total: Type.Number({ minimum: 1 }),
  idPrefixes: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  exactIds: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
});

export const CompanyReadinessManifestSchema = Type.Object({
  questionCatalogFile: Type.Optional(Type.String({ minLength: 1 })),
  theory: ReadinessCategoryRuleSchema,
  codeReview: ReadinessCategoryRuleSchema,
  liveCoding: ReadinessCategoryRuleSchema,
  sql: ReadinessCategoryRuleSchema,
  systemDesignTotal: Type.Number({ minimum: 1 })
});

export const CompanyCuratedChallengeItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.Union([Type.Literal('code_review'), Type.Literal('live_coding')]),
  difficulty: Type.Union([Type.Literal('Middle'), Type.Literal('Senior')]),
  estimatedMinutes: Type.Number({ minimum: 1 }),
  summary: Type.String({ minLength: 1 }),
  keyPoints: Type.Array(Type.String())
});

export const CompanyVoicePresetSchema = Type.Object({
  topic: Type.String({ minLength: 1 }),
  initialQuestionText: Type.String({ minLength: 1 }),
  systemPrompt: Type.String({ minLength: 1 })
});
```
- All `customQuickActionChips` entries in `json/company_profiles.json` MUST satisfy `TutorQuickActionChipSchema` (`promptMessage`, not `prompt`).

---

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy:** Additive JSON manifest extension in `json/company_profiles.json` with clean fallback defaults in `CompanyReadinessRepository`; zero SQLite DDL modifications.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- **Profile SSOT & Readiness Contract:**
  - `{P}` Validated `CompanyProfile` with `readinessConfig` & `userId = getAuthUserId(req)`.
  - `{C}` Compute category counts from `readinessConfig` SQL `LIKE`/exact-ID predicates parameterized strictly by `userId`.
  - `{Q}` Zero hardcoded company ID checks in repository; tenant `userA` mastery never leaks to `userB` or `'default_user'`.
- **Cross-Arena Navigation Contract:**
  - `{P}` Launch intent from Company Studio, Runbook, or Academy (`launchAcademyStepTarget`).
  - `{C}` Dispatch through `ArenaWorkspaceCoordinator.launch(target, ports)`; practice challenges MUST invoke `openPracticeChallengeById(id)` (never shallow `/api/practice/challenges` list objects).
  - `{Q}` Every target arena pre-hydrates full starter files before switching UI tab; stale `completedCompanyStageIds` clears when switching profiles without saved storage.
