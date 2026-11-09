# SPEC-12: Company Prep Studio Deepening & ArenaNavigator Seam Architecture

> **Status:** APPROVED  
> **Author:** Antigravity AI (Pair Programming)  
> **Governing Standards:** [GLOSSARY.md](../../../GLOSSARY.md), [ADR-0002](../../adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md), [ADR-0003](../../adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), [SPEC-10](10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md), [SPEC-11](11_OMNIPRESENT_AI_COPILOT_ARCHITECTURE.md)  
> **Target Subsystem:** Company Track Hub, Polymorphic AI Copilot, Cross-Arena Navigation  

---

## 1. Intent & Workload Envelope

### 1.1. Context & Business Intent
The Raiffeisen DGTL company track was introduced to provide end-to-end preparation for the Product Engineer archetype across 6 assessment formats (Voice Fit, Live Coding, Code Review, PostgreSQL Arena, System Design, Take-Home Lab). However, the initial implementation suffered from **domain knowledge fracture** and **broken cross-arena navigation**:
1. Over 920 lines of domain assessment requirements (9 PE competencies, 8-point spec review, 4 STAR scenarios, Talent Q test guide) were hardcoded inside 4 React presentation components, leaving the backend and the AI Copilot completely isolated from the company hiring bar.
2. Clicking "Launch Stage" dropped the `targetEntityId` parameter (`iban-validator`, `case_transfer_service`, `SD-ATM-HARDWARE-DISPENSER`), stranding candidates in arbitrary unrelated challenges.
3. Bank-specific entities leaked across the seam into generic shared normalizers and backend prompts.

This specification unifies the company track domain into a single **deep domain manifest SSOT**, establishes a deterministic **`ArenaNavigator` seam** for seamless cross-arena execution, and purges all leaked domain constants from the polymorphic copilot core.

### 1.2. Operating Envelope
- **Target Latency:** Client-side store hydration and view transition $\le 50$ms (p99).
- **Profile Fetch Overhead:** $\le 10$ms response time for `GET /api/companies` (in-memory cached JSON).
- **Memory Overhead:** $0$ MB server RAM delta (pure JSON catalog serving).
- **Client Bundle Impact:** Deleting duplicated TSX data bags reduces frontend bundle by $\ge 700$ lines.
- **Tenancy & Security Tier:** Internal Assessment Platform; Zero PII/PCI storage.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

To protect platform stability and avoid speculative rewrites, the implementing agent is **physically forbidden** from touching:
1. **Audio DSP & WebSocket Pipeline:** Any file in `frontend/src/services/audio/`, `AudioPlayoutManager.ts`, `AudioWorkletProcessor.ts`, or backend Live WebSocket routes (`backend/src/routes/liveVoiceSession.ts`).
2. **PGlite WASM Engine:** `frontend/src/services/sql/pgliteExecutionEngine.ts` and `tableDiffEvaluator.ts`.
3. **Database Schema & Migrations:** SQLite schemas in `data/interview.db` or database migration runners.
4. **Existing Kata Manifests:** In-flight katas in `json/machine_coding_challenges.json` and `system_design_challenges/` (other than reading their identifiers).
5. **AST Verification Engine:** `backend/src/services/sandbox/` rules and compilers.

---

## 3. Pre-Agreed Verification Seams

### 3.1. Primary Verification Seams
1. **Shared Contract Seam:** `shared/src/schemas/companyProfile.ts` and `shared/src/schemas/tutorNormalizer.ts`.
   - Verified via unit test suite: `node backend/tests/test_company_profile_schema.js` and `node backend/tests/test_polymorphic_tutor_normalizers.js`.
2. **Navigation Coordinator Seam:** `frontend/src/services/arenaNavigator.ts`.
   - Verified via deterministic test asserting correct store hydration before view switching.
3. **End-to-End Typecheck Seam:**
   - Command: `remote-verify` (GitHub Actions CI/CD runner executing `npx tsc --noEmit` and build verification).

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Deep Domain Manifest Contract (`CompanyProfileSchema`)

```typescript
// shared/src/schemas/companyProfile.ts

export const CompetencyItemSchema = Type.Object({
  id: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.Union([Type.Literal('engineering'), Type.Literal('product'), Type.Literal('quality_ai')]),
  categoryLabel: Type.String({ minLength: 1 }),
  iconName: Type.String({ minLength: 1 }),
  techStack: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  interviewQuestion: Type.String({ minLength: 1 }),
  barRaiserExpectation: Type.String({ minLength: 1 })
});
export type CompetencyItem = Static<typeof CompetencyItemSchema>;

export const SpecReviewItemSchema = Type.Object({
  id: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  tag: Type.String({ minLength: 1 }),
  question: Type.String({ minLength: 1 }),
  deliverable: Type.String({ minLength: 1 }),
  dangerIfMissing: Type.String({ minLength: 1 })
});
export type SpecReviewItem = Static<typeof SpecReviewItemSchema>;

export const StarCaseSchema = Type.Object({
  id: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  tagline: Type.String({ minLength: 1 }),
  badge: Type.String({ minLength: 1 }),
  interviewQuestion: Type.String({ minLength: 1 }),
  situation: Type.String({ minLength: 1 }),
  task: Type.String({ minLength: 1 }),
  action: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  result: Type.String({ minLength: 1 }),
  strongHireTakeaway: Type.String({ minLength: 1 }),
  redFlagToAvoid: Type.String({ minLength: 1 })
});
export type StarCase = Static<typeof StarCaseSchema>;

export const TalentQGuideSchema = Type.Object({
  deadlineHours: Type.Number({ default: 72 }),
  warningTitle: Type.String({ minLength: 1 }),
  warningMarkdown: Type.String({ minLength: 1 }),
  numericalTestNotes: Type.Array(Type.String()),
  verbalLogicRules: Type.Array(Type.String())
});
export type TalentQGuide = Static<typeof TalentQGuideSchema>;

export const TakeHomePrCaseSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  prNumber: Type.String({ minLength: 1 }),
  author: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  flawCategory: Type.String({ minLength: 1 }),
  codeSnippet: Type.String({ minLength: 1 }),
  options: Type.Array(Type.Object({
    id: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    isCorrect: Type.Boolean(),
    explanation: Type.String({ minLength: 1 })
  }), { minItems: 2 }),
  canonicalFixSql: Type.String({ minLength: 1 })
});
export type TakeHomePrCase = Static<typeof TakeHomePrCaseSchema>;

export const CompanyProfileSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  brandColor: Type.String({ default: '#FFE600' }),
  logoBadge: Type.String({ default: '🏦' }),
  tagline: Type.String({ minLength: 1 }),
  culture: CompanyCultureSchema,
  expressRunbook: ExpressRunbookSchema,
  stages: Type.Array(CompanyPipelineStageSchema, { minItems: 1 }),
  // Deepening extensions (Pillars 10 & 11 SSOT):
  competencies: Type.Optional(Type.Array(CompetencyItemSchema)),
  specReviewChecklist: Type.Optional(Type.Array(SpecReviewItemSchema)),
  starScenarios: Type.Optional(Type.Array(StarCaseSchema)),
  talentQGuide: Type.Optional(TalentQGuideSchema),
  takeHomePrCases: Type.Optional(Type.Array(TakeHomePrCaseSchema)),
  customQuickActionChips: Type.Optional(Type.Array(TutorQuickActionChipSchema))
});
export type CompanyProfile = Static<typeof CompanyProfileSchema>;
```

### 4.2. Navigation Coordinator Interface (`ArenaNavigator`)

```typescript
// frontend/src/services/arenaNavigator.ts

export interface ArenaNavigationTarget {
  arena: 'practice' | 'incidents' | 'system_design' | 'sql_arena' | 'voice_modal' | 'take_home';
  entityId: string;
  contextTitle?: string;
  options?: {
    sqlInitialQuery?: string;
    voiceCustomPrompt?: string;
    voiceTopic?: string;
  };
}

export interface IArenaNavigator {
  /**
   * Deterministically hydrates target arena store and switches active view.
   * Eliminates dangling entity IDs and missing parameters.
   */
  launchTask(target: ArenaNavigationTarget): Promise<void> | void;
}
```

---

## 5. Storage & Zero-Downtime Migration Contract

- **Rollout Strategy:** Additive-Only JSON Schema Evolution.
- **Manifest Diff:**
  - `json/company_profiles.json`: Extend the `raiffeisen_dgtl` object by embedding the 9 competencies, 8 spec review checks, 4 STAR scenarios, Talent Q rules, and 5 Take-Home PR cases.
  - Backward Compatibility: All newly added fields in `CompanyProfileSchema` are `Type.Optional()`, ensuring existing consumers do not break during rollout.
- **No Database DDL:** Zero SQLite migration needed; company profiles are served directly from the immutable JSON catalog via `resolveJsonCatalogPath('company_profiles.json')`.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Cross-Arena Navigation Transition
- **Pre-Conditions {P}:**
  - Caller invokes `ArenaNavigator.launchTask({ arena, entityId, contextTitle })`.
  - `targetArena` is a valid member of `TargetArenaEnum`.
  - `entityId` is a non-empty string referencing a valid catalog challenge.
- **Algorithm C:**
  1. If `arena === 'practice'`: Fetch `/api/practice/challenges/${entityId}`, hydrate `useAppStore.getState().setPracticeWorkspaceFiles(data.workspaceFiles)`, set active challenge, and call `useAppStore.getState().setStudioTab('practice')`.
  2. If `arena === 'incidents'`: Fetch or match incident from `useAppStore.getState().bugHuntIncidents` by `entityId`, set `useAppStore.getState().setActiveTopicBugHunt(incident)`, and switch tab to `'incidents'`.
  3. If `arena === 'system_design'`: Match scenario by `canonical_id === entityId`, set `useAppStore.getState().setActiveSystemDesignScenario(scenario)`, and switch tab to `'system_design'`.
  4. If `arena === 'sql_arena'`: Dispatch `onSelectSqlChallenge(entityId)` and switch sub-tab.
  5. If `arena === 'take_home'`: Switch sub-tab to `'take_home'` and set active PR case index.
  6. If `arena === 'voice_modal'`: Open voice modal with company persona context.
- **Post-Conditions {Q}:**
  - Active store holds the target entity matching `entityId`.
  - The viewport seamlessly presents the target challenge without requiring user re-selection.
  - Zero dangling task pointer errors.

### 6.2. Polymorphic Tutor Spoke Normalization
- **Pre-Conditions {P}:**
  - `normalizeCompanyContext(payload)` is invoked with `CompanyStudioSpokePayload`.
- **Algorithm C:**
  1. Ingest `quickActionChips` dynamically from `profile.customQuickActionChips` if present; fallback to generic Socratic chips if absent.
  2. Map `takeHomeContext` dynamically from `profile.takeHomePrCases` or `profile.culture` without hardcoded strings.
  3. Emit canonical `TutorActiveContext`.
- **Post-Conditions {Q}:**
  - `TutorActiveContext.quickActionChips` contains zero hardcoded vendor bias.
  - Socratic ladder prompts accurately reflect active company profile parameters.
