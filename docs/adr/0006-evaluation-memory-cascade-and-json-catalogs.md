---
status: accepted
verification: pending
date: 2026-11-26
---

# 0006. Unified Evaluation Memory Cascade, Pure Prompt Composition & TypeBox JSON Catalogs

## Context & Problem Statement
Post-Wave 11 empirical audit of `main @ 4d72ce1` identified six remaining cross-cutting structural defects:
1. Conceptual evaluation cascades across `routes/eval.ts`, `CascadedTurnEngine.ts`, and `liveEvaluationToolDispatcher.ts` omit or split `userId` (`'default_user'` vs `'anonymous'`), duplicate FAANG scorecard assembly and self-healing `user_progress` SQL merges 3x, and couple HTTP grading errors to raw `500`s.
2. Live system prompt synthesis executes top-level `fs.existsSync` scans on import, ignores `questionMatrixId` from Spec 53, passes 53-field bags, and drops `LIVE_TOOL_CAPABILITY_DIRECTIVES` in both `socratic_tutoring + mentor` and `customPromptOverride` interview branches.
3. Spec 53 `?awaitInit=1` `earlyQueue` replay in `LiveWorkspaceContext.applyClientFrame` overwrites resolved `questionText` with `challenge.title`/`bugTitle`, `ToolAudioMutex.release(id)` is never called on overlapping async tool batches, and `matchWorkspaceFilePath` collides on basenames.
4. `dbSeedCatalogs.ts` overwrites `DP-01..DP-07` `task_code` values with `LLD-xx` on subsequent server boots; `dbIndexes.ts` executes hidden auth `DELETE` statements on module import; 12,897L of static TS challenge literals bloat V8 heap and TypeScript compilation.
5. `routes/practiceTutor.ts` (`arena === 'practice'`) routes normalized `TutorActiveContext` through legacy handlers, rejects Concurrency/Transactions/Refactoring `/rule-grounding` with HTTP 400 (plus mismatched frontend rule IDs), hardcodes `'middle_scaffold', 2` on hints/grounding, and subscribes `PracticeTutorDrawer.tsx` to whole stores.
6. Client voice configuration mirrors across `uiSlice.runtimeConfig`, mutable global `cachedRuntimeVoiceConfig`, 2 `CustomEvent` buses, and 10 `localStorage` keys with side effects inside React `setState` updaters, while `questionsSlice.ts` retains dead `batchSizeMap`/`shuffleMap` state.

## Decision
1. **Multi-Tenant `QuestionEvaluationService` (Spec 54):** Extract text judging + unified outcome/FSRS/deficit cascade behind `QuestionEvaluationRepository(db)`, normalizing `userId` everywhere and preserving HTTP `503` propagation and prompt injection/anti-sycophancy invariants.
2. **Pure `LivePromptComposer` & Upstream Preload (Spec 55):** Preload `PreResolvedHrContext` (honoring `questionMatrixId`) inside `LiveSessionBlueprintBuilder`, collapse 5 single-caller modules into declarative templates guaranteeing Turn 0 Lockdown + `LIVE_TOOL_CAPABILITY_DIRECTIVES` across all interview modes, and split `verifyPrompts.ts` under 350L/module.
3. **Encapsulated `LiveToolExecutor` & `LiveWorkspaceStore` (Spec 56):** Unify `session_init` merging, fix `earlyQueue` `questionText` overwrite and per-call `ToolAudioMutex.release(id)`, enforce exact/suffix path resolution, and decouple handlers via `ToolPersistencePort` & `WorkspaceChallengeCatalogPort`.
4. **Atomic JSON `CatalogSeeder` & Explicit `DatabaseBootstrap` (Spec 57):** Partition `TST` / `DP` / `LLD` task codes disjointly inside one transaction, extract hidden auth cleanups out of `dbIndexes.ts` into explicit server startup calls, and externalize 12,897L of TS challenge literals into TypeBox-validated (`CodingChallengeSchema`) root `json/*.json` catalogs.
5. **Single `TutorActiveContext` & `TutorTransportPort` (Spec 58):** Extend `TutorActiveContextSchema` to subsume Practice, normalize all 5 arenas and all 5 Compass maps identically, align Concurrency/Refactoring rule IDs, propagate `AbortSignal`/live persona on hints/grounding, and read canonical solution tests from JSON/SQLite catalog rather than TS seed arrays.
6. **Standalone `useVoiceConfigStore` & `questionsSlice` Pruning (Spec 59):** Consolidate `runtimeConfig` and 10 `localStorage` keys into one store (`'interview_voice_config_v2'`) with 1-time legacy migration and SSR/Node safety, deleting global caches and `CustomEvent` buses plus dead `batchSizeMap`/`shuffleMap` fields.

## Verification & Guardrail
- Full CI gate in `.github/workflows/ai-verify.yml` (`test:prompts`, `test:vad:*`, `test:hr`, `test:companies`, `test:live:tool-isolation`, `test:practice:*`, `test:tutor:normalizers`, `test:audio-contracts`, `backend` & `frontend` builds).
- Every new file `<= 350` lines; every modified file `<= 400` lines (`scripts/verify_file_hygiene.ts`).

## Considered & Rejected Alternatives
- **Retaining dual `ChallengeSeedData` TS blobs + thin JS shims indefinitely:** Rejected because keeping 12,897L of static TS literals continues pinning heap/TSC memory on the 1.8 GB VPS; instead, both CI and non-CI catalog scripts migrate cleanly onto the shared JSON loader.
- **Keeping `geminiText.ts` / `liveEvaluationToolDispatcher.ts` on raw singletons during #7:** Rejected because multi-tenant `userId` leaks and top-level `fs.existsSync` imports recur unless `QuestionEvaluationService` (Spec 54) and `liveRubricBuilder` separation (Spec 55) land first.
