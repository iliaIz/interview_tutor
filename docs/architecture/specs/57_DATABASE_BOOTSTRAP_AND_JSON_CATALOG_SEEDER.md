# Spec 57: `DatabaseBootstrap`, Atomic `CatalogSeeder` & TypeBox JSON Catalogs

> **Governing Glossary:** `CatalogSeeder`, `DatabaseBootstrap`, `Design Pattern Kata` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0001](../../adr/0001-sota-2026-design-patterns-practice.md), [ADR 0002](../../adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md), [ADR 0006](../../adr/0006-evaluation-memory-cascade-and-json-catalogs.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Cold-boot seed `< 200ms` (1 atomic transaction); zero V8 heap retention of static Java challenge blobs

---

## 1. Intent & Workload Envelope
Eliminate four verified structural and correctness defects in persistence initialization:
1. Fix the confirmed `DP-01..DP-07 -> LLD-xx` task-code clobbering bug in `dbSeedCatalogs.ts` where running `seedCodingChallenges()` after `seedNextGenCatalogs()` matches `track != 'testing_mutation'` on Design Pattern katas and creates 7 numbering gaps in `LLD-01..LLD-100`.
2. Remove 4 unguarded auth `DELETE` statements (`user_sessions`, `ws_tickets`, `invite_tokens`, `users`) executed silently on every module import inside `dbIndexes.ts:runSchemaMigrations`.
3. Decouple SQLite construction from module-load side effects (`db.ts`, 48L) via `DatabaseBootstrap.init(database)` so tests bind `:memory:` DBs cleanly without mutating `data/interview.db`.
4. Externalize **12,897 lines** of static TypeScript coding/mutation challenge blobs (`challengeSeedData.ts` 934L, `additionalChallenges.ts` 1,179L, `mutationChallenges/*` 10,775L) into TypeBox-validated JSON catalogs under `backend/json/` validated against a unified `CodingChallengeSchema` in `@interview-prep/shared`, cutting `dbSchema.ts` (357L) and `dbSeedCatalogs.ts` (351L) below 350L and eliminating V8/TSC heap bloat on the 1.8 GB VPS.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT drop or alter production SQLite tables/columns (`coding_challenges`, `questions`, `users`, `company_profiles`, `sql_challenges`); row counts (`135` coding katas + `7` design pattern katas = `142`, exact `42 TST-*`, `93 LLD-*`, `7 DP-*`) MUST remain byte-for-byte identical.
- Do NOT run live DB migrations or delete active user sessions automatically on test DBs; auth cleanup belongs only to an explicit server startup method (`DatabaseBootstrap.cleanupInactiveInvites` / `AuthService`) invoked in `server.ts`.
- Do NOT break CI scripts (`verify_starter_workspaces_integrity.js`, `verify_all_mutation_challenges.js`, `test_practice_task_codes.js`) or non-CI catalog scripts (`verify_all_katas.js`, `verify_curriculum_catalog.js`, `verify_mutation_katas.js`).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seams:**
  - `DatabaseBootstrap.createDatabase(dbPath)` & `DatabaseBootstrap.initSchema(db)` (`backend/src/services/db/DatabaseBootstrap.ts`)
  - `CatalogSeeder.seedAllCatalogs(db, catalogDir?)` (`backend/src/services/db/CatalogSeeder.ts`)
  - `loadCodingChallengeCatalogs()` (`backend/src/services/db/ChallengeCatalogLoader.ts`)
  - `CodingChallengeSchema` (`shared/src/schemas/codingChallenge.ts`)
- **Real-Wire / Local-Substitutable:** Ephemeral `:memory:` SQLite `Database` in unit tests; TypeBox `Value.Check` on every JSON catalog file in `backend/json/`.
- **Verification Command (CI):** `npm run test:practice:task-codes && npm run test:practice:mutation-challenges && npm run test:companies && npm run test:practice:ast-verifier && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
// shared/src/schemas/codingChallenge.ts
export const ChallengeFileNodeSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  content: Type.String(),
  isReadOnly: Type.Optional(Type.Boolean()),
  isTestFile: Type.Optional(Type.Boolean())
});
export const CodingChallengeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.String({ minLength: 1 }),
  track: Type.Optional(Type.String()),
  difficulty: Type.Union([Type.Literal('Junior'), Type.Literal('Middle'), Type.Literal('Senior'), Type.Literal('Lead')]),
  timeLimitMinutes: Type.Number({ minimum: 1 }),
  workspaceFiles: Type.Array(ChallengeFileNodeSchema, { minItems: 1 }),
  // optional grading/mutation/concurrency/idiom metadata preserved verbatim
});
```
- **Disjoint Task-Code Partitioning Rule (`CatalogSeeder`):**
  1. `track = 'testing_mutation'` -> `TST-01..TST-N`
  2. `track = 'design_patterns' OR category = 'design_patterns'` -> `DP-01..DP-N`
  3. All remaining `coding_challenges` (`track NOT IN ('testing_mutation', 'design_patterns') AND category != 'design_patterns'`) -> `LLD-01..LLD-N`
  Running `seedAllCatalogs(db)` 1, 2, or $K$ times produces zero ID collisions and zero gaps.
- **Unified JSON Path Resolution:** Every catalog read traverses `resolveJsonCatalogPath(filename)` (removing the 3-element hardcoded path list in `seedCodingChallenges`).

---

## 5. Storage & Zero-Downtime Migration Contract
- **Expand-Migrate-Contract Phasing:**
  1. **Expand:** Add `CodingChallengeSchema` (`shared`), `DatabaseBootstrap`, `CatalogSeeder`, `ChallengeCatalogLoader`, and exported `backend/json/{base_challenges,additional_lld_challenges,mutation_challenges}.json` (plus move `dbSchema` / `dbIndexes` cleanly under `<= 350L`). Existing `db.ts` remains a thin backward-compatible singleton facade over `DatabaseBootstrap` for untouched importers while tests use `:memory:` directly.
  2. **Contract (once `practiceTutor.ts` removes `ALL_MUTATION_CHALLENGES` import in Spec 58 / prerequisite):** Delete `challengeSeedData.ts`, `additionalChallenges.ts`, `additionalMutationChallenges.ts`, and `mutationChallenges/*` (except thin `CodingChallenge` type re-export in `@interview-prep/shared` / `ChallengeCatalogLoader.ts`), and switch `verify_starter_workspaces_integrity.js`, `verify_all_mutation_challenges.js`, and non-CI catalog scripts onto `ChallengeCatalogLoader` + `Value.Check`.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid JSON catalogs on disk passing `Value.Check(CodingChallengeSchema, row)` + fresh or already-populated SQLite `Database`.
- `{C}` Open DB (explicit path or `:memory:`), apply PRAGMAs + DDL (`<= 350L` schema module) + non-destructive index migrations (zero hidden auth `DELETE`s), and execute `CatalogSeeder.seedAllCatalogs(db)` inside one `db.transaction(...)` with disjoint `TST` / `DP` / `LLD` task-code assignment.
- `{Q}` Repeated calls to `CatalogSeeder.seedAllCatalogs(db)` leave `DP-01..DP-07`, `TST-01..TST-42`, and contiguous `LLD-01..LLD-93` 100% intact with zero gaps; `:memory:` test suites seed all 142 challenges without creating `data/interview.db` on disk; zero legacy TS seed blobs >400L remain in `backend/src/services/`.
