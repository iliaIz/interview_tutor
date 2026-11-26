# Spec 58: Unified `TutorActiveContext` & Injectable `TutorTransportPort`

> **Governing Glossary:** `Omnipresent AI Copilot`, `TutorTransportPort`, `Socratic Scaffold Ladder` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0003](../../adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Cross-arena Copilot (`<= 5500` token prompt budget)

---

## 1. Intent & Workload Envelope
Collapse the dual frontend/backend AI Copilot contracts (`PracticeTutorContextPayload` vs `TutorActiveContext`, `isPolymorphic` branching in `tutorTransport.ts` and `routes/practiceTutor.ts`) onto a single schema-validated `TutorActiveContext`. Fix verified production defects:
1. `routes/practiceTutor.ts` (`arena === 'practice'`) currently sets `isPolymorphic = false`, routing canonical normalized Practice payloads to legacy handlers where fields silently arrive empty.
2. `/rule-grounding` rejects Concurrency, Transactions, and Refactoring Compass rules with HTTP `400` because it checks only `LLD_COMPASS_RULES || TESTING_COMPASS_RULES`, while frontend `ConcurrencyCompassSheet.tsx` & `RefactoringCompassSheet.tsx` pass mismatched rule IDs (`DEADLOCK_FREE_HIERARCHY` vs `STAMPED_LOCK_OPTIMISTIC`, etc.), skip `TreeEditDistanceGuard`, and convert `503` gateway errors into `500`.
3. `tutorTransport.ts` hardcodes `'middle_scaffold', 2` on `/hint` & `/rule-grounding` and drops `AbortSignal`.
4. `PracticeTutorDrawer.tsx` subscribes to whole `useAppStore()` and `usePracticeTutorStore()`, re-rendering on every keystroke/timer tick, while `normalizePracticeContext` has `0` production callers and `CompanyTrackContextAdapter` duplicates `normalizeCompanyContext`.
5. `practiceTutor.ts` removes direct runtime dependence on static TS array `ALL_MUTATION_CHALLENGES` (reading canonical tests via SQLite `manifest_json` / `ChallengeCatalogLoader`).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT break existing `TreeEditDistanceGuard` anti-leak behavior or `<= 5500` token pruning (`pruneTutorContext`, `skeletonizeJavaFile`).
- Keep `academyBridgeContext` / `academyBreadcrumbContext` propagation working across Practice and Academy arenas (preserving contracts tested by `test_polymorphic_tutor_normalizers.js`, `test_polymorphic_prompt_builder.js`, `verify_practice_tutor.js`).
- Newly created/modified files stay `<= 350L` (new) / `<= 400L` (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seams:**
  - `usePracticeTutorStore` (`frontend/src/store/usePracticeTutorStore.ts`) driven across injectable `TutorTransportPort` (`streamChat`, `fetchHint`, `groundRule`).
  - Backend `/api/practice-tutor` unified normalizer `resolveTutorRouteContext(body)` (`backend/src/routes/practiceTutor.ts`) + `buildPolymorphicTutorSystemPrompt` + `buildPracticeTutorSystemPrompt`.
- **Adapters (`ports & adapters`):** HTTP `FetchTutorTransportAdapter` in production; in-memory `FakeTutorTransportPort` in new `frontend/tests/tutorTransportStore.test.ts` (asserting abort cancellation, live persona propagation on hints/grounding, zero hardcoded `'middle_scaffold', 2`).
- **Verification Command (CI):**
  - Backend: `npm run test:tutor:normalizers && node tests/test_polymorphic_prompt_builder.js && node tests/verify_practice_tutor.js && npm run build`
  - Frontend: `npm run test:audio-contracts && npm run build`

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface TutorTransportPort {
  streamChat(opts: TutorStreamChatRequest): Promise<void>;
  fetchHint(context: TutorActiveContext, persona: TutorPersona, assistanceLevel: number, signal?: AbortSignal): Promise<{ hintTier: number; content: string }>;
  groundRule(ruleId: string, context: TutorActiveContext, persona: TutorPersona, assistanceLevel: number, signal?: AbortSignal): Promise<{ ruleId: string; ruleName: string; content: string }>;
}
```
- **Schema Extension (`shared/src/schemas/tutorContext.ts`):** Extend `TutorActiveContextSchema` with optional Practice/Copilot fields: `selectedCodeSnippet`, `cursorLine`, `cursorColumn`, `survivingMutants`, `activeCompassRuleId`, `activeWhiteboardSnippet`, `workspaceManifest`, `academyBridgeContext`, `hintTier`, plus normalize via `normalizePracticeContext(...)`.
- **Backend Route Contract (`/chat`, `/hint`, `/rule-grounding`):**
  - `resolveTutorRouteContext(req.body)` accepts canonical `TutorActiveContext` for ALL 5 arenas (`practice`, `sql_arena`, `companies`, `system_design`, `incidents`) plus legacy compat fields if present; calls `pruneTutorContext`.
  - `/rule-grounding` resolves against ALL 5 rule maps (`TESTING_`, `LLD_`, `TRANSACTION_`, `CONCURRENCY_`, `REFACTORING_COMPASS_RULES`), runs `TreeEditDistanceGuard.guardResponse` when canonical solutions exist, and propagates `LlmGatewayUnavailableError` as `503`/`429`.
  - `ConcurrencyCompassSheet.tsx` and `RefactoringCompassSheet.tsx` align button rule IDs identically to backend rule keys (`STAMPED_LOCK_OPTIMISTIC`, `DISRUPTOR_LOCK_FREE`, `REPLACE_CONDITIONAL_WITH_POLYMORPHISM`, `SMELL_REMEDIATION`, etc.).
  - `polymorphicPromptBuilder.ts` implements `buildSystemDesignTutorPrompt(context)` instead of dropping `activeCodeOrQuery`/`instructions`; `practiceTutorPersonaDirectives.ts` handles `'company_interviewer'` cleanly.

---

## 5. Storage & Zero-Downtime Migration Contract
- Pure API/schema normalization; zero SQL DDL changes.
- Expand-Migrate-Contract sequence:
  1. **Expand (`T6`):** Extend `TutorActiveContextSchema` & `normalizePracticeContext` (`shared`), unify `routes/practiceTutor.ts` + `polymorphicPromptBuilder.ts` + `practiceTutorPersonaDirectives.ts` (accepting both `TutorActiveContext` and legacy shape cleanly) + replace `ALL_MUTATION_CHALLENGES` direct import with SQLite/catalog lookup.
  2. **Contract (`T7`):** Migrate the 6 Practice/Compass callers + `CompanyTrackContextAdapter` + `PracticeTutorDrawer.tsx` (using atomic store selectors + live workspace resolution on open/send so editor edits are never stale) + `usePracticeTutorStore` + `TutorTransportPort` (with `AbortController` on `requestHint`/`groundRule`), removing legacy `PracticeTutorContextPayload` dual branching and fixing Compass rule IDs.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `TutorActiveContext` across any of the 5 arenas with active `persona`, `assistanceLevel`, and optional `AbortController`.
- `{C}` Dispatch `sendMessage`, `requestHint`, or `groundRule` via `TutorTransportPort` forwarding live `persona`, `assistanceLevel`, `signal`, and pruned/canonical workspace state; backend resolves across all 5 arenas and all 5 compass rule maps.
- `{Q}` `arena === 'practice'` routes natively without losing `entityTitle`/`activeCodeOrQuery`; Concurrency & Refactoring rule-grounding buttons succeed with HTTP 200; calling `abortGeneration()` cancels in-flight hint & rule-grounding requests; closing drawer stops unnecessary editor re-renders.
