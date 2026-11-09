# Архитектурная спецификация SPEC\-12 Company Prep Studio

**Date**: November 9, 2026 at 09:40 AM
**Turns**: 1
**Source**: [Gemini Chat](https://gemini.google.com/app/43bf9447347cdf7a)

---

## Turn 1

### 🤖 ИИ Ассистент

# ARCHITECTURAL SPECIFICATION: SPEC-12 — Company Prep Studio Deepening & ArenaNavigator Seam Architecture

## 1. Root Cause & Architecture Decision

### 1.1. Диагностика первопричин (Root Causes)

1. **Anemic Domain Schema & UI-Embedded Knowledge Fracture:** Схема `CompanyProfileSchema` в `shared/src/schemas/companyProfile.ts` описывает только поверхностные метаданные (`culture`, `expressRunbook`, `stages`). В результате более 920 строк структурированных доменных знаний (матрица компетенций Product Engineer, чеклист Spec Review, сценарии STAR с весами/ловушками, тренажер Talent Q и форензика PR-кейсов Take-Home) оказались зашиты в виде локальных констант внутри TSX-компонентов (`CompanyCompetenciesRadar.tsx`, `CompanySpecReviewChecklist.tsx`, `CompanyStarScenarios.tsx`, `CompanyTalentQGuide.tsx`, `CompanyTakeHomeLab.tsx`). Это лишает бэкенд и AI-копилота доступа к доменному контексту и блокирует масштабирование платформы на новые компании.
2. **Severed Cross-Arena Navigation Seam:** В `CompanyPrepStudio.tsx` диспетчеризация этапов (`handleLaunchStage`) и задач ранбука (`handleNavigateToTask`) переключает глобальную вкладку (`setStudioTab('practice' | 'incidents' | 'system_design')`), но теряет `targetEntityId` для всех арен, кроме `sql_arena`. Дополнительно `handleNavigateToTask` опирается на хрупкую эвристику строковых префиксов (`startsWith('sql-')`, `startsWith('case_')`), нарушая инвариант детерминированной маршрутизации.
3. **Copilot Core Domain Leakage:** В универсальный нормализатор `shared/src/schemas/tutorNormalizer.ts` (`normalizeCompanyContext`) и промпт-билдер `backend/src/prompts/tutor/polymorphicPromptBuilder.ts` жестко зашиты артефакты Райффайзена (`cib-interns-test-task`, «Склад носков», `TransferService`, метрики TTM/Pain Index). При открытии профиля любой другой компании AI-интервьюер галлюцинирует банковским контекстом Райффайзена.
4. **Take-Home Minigame Isolation:**`CompanyTakeHomeLab.tsx` хранит массив `PR_CASES` непосредственно внутри UI-компонента, смешивая каталог данных, бизнес-логику проверки вердиктов и представление (325 строк на грани лимита Rule 8).

### 1.2. Архитектурное решение (Target Architecture)

1. **SSOT Domain Schema Deepening (#55):** Расширение `CompanyProfileSchema` в `@interview-prep/shared` полными контрактами `CompanyDossierSchema` (компетенции, Spec Review, STAR-сценарии, Talent Q), `CompanyTakeHomeLabSchema` (форензика PR-диффов и антипаттернов), `ExpressRunbookItemSchema` (типизированные ссылки `targetArena` + `targetEntityId` вместо сырых ID) и `customQuickActionChips`. Перенос всех данных Райффайзена в `json/company_profiles.json` с валидацией через TypeBox на уровне `backend/src/routes/companies.ts`.
2. **Deterministic ArenaNavigator Seam (#56):** Введение единого контракта `ArenaLaunchIntent` (`targetArena`, `targetEntityId`, `companyId`, `stageId`) в `useAppStore.ts` и чистой функции/хука диспетчеризации, которая атомарно устанавливает как активную арену (`studioTab` / `activeSubTab`), так и целевой `entityId` в соответствующем слайсе стора без префиксного угадывания.
3. **Props-Driven Dossier & Take-Home View Adapters (#57, #59):** Трансформация `CompanyCompetenciesRadar`, `CompanySpecReviewChecklist`, `CompanyStarScenarios`, `CompanyTalentQGuide` и `CompanyTakeHomeLab` в чистые презентационные адаптеры с полным сохранением интерактивности (ARIA, модальные окна, калькулятор Talent Q, выбор дефектов PR), получающие данные исключительно через пропсы из `CompanyProfile` без фантомных фолбэков.
4. **Zero-Leakage Polymorphic Copilot (#58):** Очистка `tutorNormalizer.ts` и `polymorphicPromptBuilder.ts` от констант Райффайзена. Быстрые чипсы (`quickActionChips`), резюме Take-Home и фокус-метрики динамически синтезируются из переданного `CompanyProfile`.

## 2. Assumptions & Blind Spots (Обязательный Pre-Flight Audit для CLI-агента)
Перед внесением изменений CLI-агент **обязан** выполнить локальную ревизию следующих файлов (чтение через `cat`/`sed`/`rg`, **без** запуска сборки):

1. **`frontend/src/store/useAppStore.ts`:**
  - **Допущение:** Стор управляет `studioTab`, `targetSqlChallengeId` и (возможно) активными ID задач для арен `practice`, `incidents`, `system_design`, либо соответствующие сеттеры находятся в `useAppStore` / `usePracticeTutorStore`.
  - **Действие агента:** Прочитать `frontend/src/store/useAppStore.ts` и `frontend/src/store/usePracticeTutorStore.ts`. Выявить точные имена полей для выбора активной задачи в `practice` (например, `activeProblemId` / `selectedTaskId`), `incidents` (`activeIncidentId` / `selectedCaseId`) и `system_design` (`activeScenarioId` / `selectedSystemDesignId`). Если в `useAppStore` отсутствуют целевые указатели для кросс-аренного перехода, добавить типизированные поля `targetPracticeTaskId`, `targetIncidentId`, `targetSystemDesignId` (или единый `pendingArenaIntent: ArenaLaunchIntent | null`).
2. **`shared/src/schemas/tutorContext.ts` и `shared/src/index.ts`:**
  - **Допущение:** `TutorActiveContext` содержит поле `companyContext`, а `shared/src/index.ts` реэкспортирует схемы из `shared/src/schemas/companyProfile.ts`.
  - **Действие агента:** Проверить точное определение `TutorActiveContext` в `shared/src/schemas/tutorContext.ts` и экспорты в `shared/src/index.ts`, чтобы новые типы (`CompanyDossier`, `CompanyTakeHomeLabConfig`, `ArenaLaunchIntent` и др.) корректно экспортировались из пакета `@interview-prep/shared`.
3. **Файлы досье и лаборатории (`frontend/src/components/companies/dossier/*.tsx`, `CompanyDossierTab.tsx`, `CompanyTakeHomeLab.tsx`, `CompanyRunbookTab.tsx`):**
  - **Допущение:** Внутри 4 файлов `dossier/*.tsx` и `CompanyTakeHomeLab.tsx` находятся захардкоженные массивы данных Райффайзена, а также интерактивный стейт (калькулятор долей/процентов в `CompanyTalentQGuide.tsx`, чекбоксы в `CompanySpecReviewChecklist.tsx`, раскрытие карточек/модалок в `CompanyStarScenarios.tsx` и `CompanyCompetenciesRadar.tsx`, проверка PR в `CompanyTakeHomeLab.tsx`).
  - **Действие агента:** Перед миграцией (#55, #57, #59) извлечь **100% текста и чисел** из этих 5 файлов дословно в `json/company_profiles.json`, чтобы не потерять ни одного сценария, вопроса или PR-кейса.
4. **`backend/src/prompts/tutor/polymorphicPromptBuilder.ts` и `backend/src/prompts/personas.ts`:**
  - **Допущение:** Содержат строковые литералы Райффайзена (`TransferService`, `cib-interns-test-task`, `Склад носков`) и покрыты тестами `backend/tests/test_polymorphic_tutor_normalizers.js` и `backend/tests/test_polymorphic_prompt_builder.js`.
  - **Действие агента:** Прочитать оба файла промптов и оба тестовых файла перед выполнением шага #58, чтобы синхронизировать ассерты в тестах с динамическим контрактом.
5. **Спецификация `docs/architecture/specs/12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md`:**
  - **Действие агента:** Сверить имена полей в `docs/architecture/specs/12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md` перед редактированием `companyProfile.ts`. При любых расхождениях в именах мелких свойств приоритет имеет существующий файл спецификации `SPEC-12` в репозитории.

## 3. Data Contracts & Interfaces

### 3.1. Расширенная доменная схема (`shared/src/schemas/companyProfile.ts`)
Схема декомпозируется на логические блоки (строго $\le 350$ строк в файле) с использованием `@sinclair/typebox`:

```typescript
import { Type, Static } from '@sinclair/typebox';

export const StageFormatEnum = Type.Union([
  Type.Literal('voice_fit'),
  Type.Literal('live_coding'),
  Type.Literal('code_review'),
  Type.Literal('sql_arena'),
  Type.Literal('system_design'),
  Type.Literal('take_home')
]);
export type StageFormat = Static<typeof StageFormatEnum>;

export const TargetArenaEnum = Type.Union([
  Type.Literal('practice'),
  Type.Literal('incidents'),
  Type.Literal('system_design'),
  Type.Literal('sql_arena'),
  Type.Literal('voice_modal'),
  Type.Literal('take_home')
]);
export type TargetArena = Static<typeof TargetArenaEnum>;

export const ArenaLaunchIntentSchema = Type.Object({
  targetArena: TargetArenaEnum,
  targetEntityId: Type.String({ minLength: 1 }),
  companyId: Type.Optional(Type.String()),
  stageId: Type.Optional(Type.String())
});
export type ArenaLaunchIntent = Static<typeof ArenaLaunchIntentSchema>;

export const CompanyPipelineStageSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  stageNumber: Type.Number({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  format: StageFormatEnum,
  estimatedMinutes: Type.Number({ minimum: 5 }),
  description: Type.String({ minLength: 1 }),
  targetArena: TargetArenaEnum,
  targetEntityId: Type.String({ minLength: 1 }),
  weight: Type.Number({ minimum: 0, maximum: 1 })
});
export type CompanyPipelineStage = Static<typeof CompanyPipelineStageSchema>;

export const CompanyCultureSchema = Type.Object({
  engineeringParadigm: Type.String({ minLength: 1 }),
  metricsFocus: Type.Array(Type.String(), { default: [] }),
  redFlags: Type.Array(Type.String(), { default: [] }),
  greenFlags: Type.Array(Type.String(), { default: [] })
});
export type CompanyCulture = Static<typeof CompanyCultureSchema>;

export const ExpressRunbookTaskLinkSchema = Type.Object({
  taskId: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  targetArena: TargetArenaEnum,
  badge: Type.Optional(Type.String())
});
export type ExpressRunbookTaskLink = Static<typeof ExpressRunbookTaskLinkSchema>;

export const ExpressRunbookSchema = Type.Object({
  pitchScriptMarkdown: Type.String({ minLength: 1 }),
  mustReviewTaskIds: Type.Array(Type.String(), { default: [] }),
  mustReviewTasks: Type.Optional(Type.Array(ExpressRunbookTaskLinkSchema, { default: [] })),
  checklist: Type.Array(Type.String(), { default: [] })
});
export type ExpressRunbook = Static<typeof ExpressRunbookSchema>;

// --- Dossier Sub-Schemas ---

export const CompetencyItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.String({ minLength: 1 }),
  weight: Type.Number({ minimum: 0, maximum: 100 }),
  expectation: Type.String({ minLength: 1 }),
  seniorSignal: Type.String({ minLength: 1 }),
  rejectionTrigger: Type.String({ minLength: 1 }),
  verificationQuestions: Type.Optional(Type.Array(Type.String(), { default: [] }))
});
export type CompetencyItem = Static<typeof CompetencyItemSchema>;

export const SpecReviewCheckItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  category: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  riskDescription: Type.String({ minLength: 1 }),
  requiredAction: Type.String({ minLength: 1 }),
  severity: Type.Union([
    Type.Literal('blocker'),
    Type.Literal('critical'),
    Type.Literal('major')
  ])
});
export type SpecReviewCheckItem = Static<typeof SpecReviewCheckItemSchema>;

export const StarScenarioItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  competencyFocus: Type.String({ minLength: 1 }),
  promptQuestion: Type.String({ minLength: 1 }),
  situation: Type.String({ minLength: 1 }),
  task: Type.String({ minLength: 1 }),
  action: Type.String({ minLength: 1 }),
  result: Type.String({ minLength: 1 }),
  followUpTraps: Type.Array(Type.String(), { default: [] }),
  metricsUsed: Type.Optional(Type.Array(Type.String(), { default: [] }))
});
export type StarScenarioItem = Static<typeof StarScenarioItemSchema>;

export const TalentQRuleItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  formulaOrRule: Type.String({ minLength: 1 }),
  trapWarning: Type.String({ minLength: 1 }),
  exampleSnippet: Type.Optional(Type.String())
});
export type TalentQRuleItem = Static<typeof TalentQRuleItemSchema>;

export const TalentQGuideSchema = Type.Object({
  timePerQuestionSeconds: Type.Number({ minimum: 10 }),
  totalQuestions: Type.Number({ minimum: 1 }),
  passingPercentile: Type.Number({ minimum: 1, maximum: 100 }),
  numericalRules: Type.Array(TalentQRuleItemSchema, { default: [] }),
  verbalRules: Type.Array(TalentQRuleItemSchema, { default: [] }),
  strategyTips: Type.Array(Type.String(), { default: [] })
});
export type TalentQGuide = Static<typeof TalentQGuideSchema>;

export const CompanyDossierSchema = Type.Object({
  competencies: Type.Array(CompetencyItemSchema, { default: [] }),
  specReviewChecklist: Type.Array(SpecReviewCheckItemSchema, { default: [] }),
  starScenarios: Type.Array(StarScenarioItemSchema, { default: [] }),
  talentQGuide: Type.Optional(TalentQGuideSchema)
});
export type CompanyDossier = Static<typeof CompanyDossierSchema>;

// --- Take-Home PR Forensics Sub-Schemas ---

export const TakeHomePrCaseSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  authorPersona: Type.String({ minLength: 1 }),
  summary: Type.String({ minLength: 1 }),
  codeSnippet: Type.String({ minLength: 1 }),
  expectedVerdict: Type.Union([
    Type.Literal('reject'),
    Type.Literal('request_changes'),
    Type.Literal('approve')
  ]),
  defectOptions: Type.Array(
    Type.Object({
      id: Type.String({ minLength: 1 }),
      label: Type.String({ minLength: 1 }),
      isActualDefect: Type.Boolean(),
      explanation: Type.String({ minLength: 1 })
    }),
    { minItems: 1 }
  ),
  architecturalFix: Type.String({ minLength: 1 })
});
export type TakeHomePrCase = Static<typeof TakeHomePrCaseSchema>;

export const CompanyTakeHomeLabSchema = Type.Object({
  taskId: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  repoSlug: Type.String({ minLength: 1 }),
  briefMarkdown: Type.String({ minLength: 1 }),
  antiPatternsSummary: Type.String({ minLength: 1 }),
  goldenStandardChecklist: Type.Array(Type.String(), { default: [] }),
  prCases: Type.Array(TakeHomePrCaseSchema, { default: [] })
});
export type CompanyTakeHomeLab = Static<typeof CompanyTakeHomeLabSchema>;

export const CompanyQuickActionChipSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
  promptMessage: Type.String({ minLength: 1 })
});
export type CompanyQuickActionChip = Static<typeof CompanyQuickActionChipSchema>;

export const CompanyProfileSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  brandColor: Type.String({ default: '#FFE600' }),
  logoBadge: Type.String({ default: '🏦' }),
  tagline: Type.String({ minLength: 1 }),
  culture: CompanyCultureSchema,
  expressRunbook: ExpressRunbookSchema,
  stages: Type.Array(CompanyPipelineStageSchema, { minItems: 1 }),
  dossier: Type.Optional(CompanyDossierSchema),
  takeHomeLab: Type.Optional(CompanyTakeHomeLabSchema),
  quickActionChips: Type.Optional(Type.Array(CompanyQuickActionChipSchema, { default: [] }))
});
export type CompanyProfile = Static<typeof CompanyProfileSchema>;

```

### 3.2. Контракт `CompanyStudioSpokePayload` (`shared/src/schemas/tutorNormalizer.ts`)
Универсальный контракт для нормализации контекста любой компании без захардкоженных строк Райффайзена:

```typescript
export interface CompanyStudioSpokePayload {
  profile: {
    id: string;
    name: string;
    tagline?: string;
    culture?: {
      engineeringParadigm?: string;
      metricsFocus?: string[];
      redFlags?: string[];
      greenFlags?: string[];
    };
    takeHomeLab?: {
      title: string;
      repoSlug?: string;
      antiPatternsSummary: string;
    };
    quickActionChips?: TutorQuickActionChip[];
  };
  activeStage?: {
    id: string;
    title: string;
    description?: string;
    format?: string;
  };
  activeCodeSnippet?: string;
  activeTaskTitle?: string;
}

```

### 3.3. Контракт диспетчера `ArenaNavigator` (`frontend/src/components/companies/arenaNavigator.ts`)
Выделенный модуль для атомарной маршрутизации между `CompanyPrepStudio` и аренами платформы:

```typescript
import { ArenaLaunchIntent, CompanyPipelineStage, CompanyProfile } from '@interview-prep/shared';

export interface ArenaNavigationCallbacks {
  setStudioTab: (tab: 'practice' | 'incidents' | 'system_design' | 'companies') => void;
  setActiveSubTab: (subTab: 'pipeline' | 'dossier' | 'runbook' | 'sql_arena' | 'take_home') => void;
  setIsVoiceOpen: (open: boolean) => void;
  setTargetSqlChallengeId: (id: string) => void;
  setTargetPracticeTaskId: (id: string) => void;
  setTargetIncidentId: (id: string) => void;
  setTargetSystemDesignId: (id: string) => void;
}

export function executeArenaLaunchIntent(
  intent: ArenaLaunchIntent,
  callbacks: ArenaNavigationCallbacks
): void;

export function resolveRunbookTaskIntent(
  taskId: string,
  profile: CompanyProfile
): ArenaLaunchIntent | null;

```

## 4. Atomic Execution Plan

> **КРИТИЧЕСКИЙ ИНВАРИАНТ (INVARIANT 0):**
> Локальный запуск компиляторов (`tsc`, `npm run build`, `vite build`) и тестовых раннеров (`npm test`, `node --test`) на VPS **СТРОГО ЗАПРЕЩЕН** из-за лимита 1.8 GB RAM.
>
> - На каждом шаге выполняются только легковесные команды проверки синтаксиса/размера (`wc -l`, `node -e "JSON.parse(...)"`, `rg`).
> - Полная проверка типов и тестов запускается через `remote-verify` (GitHub Actions) в конце каждого логического узла Ticket DAG.

### УЗЕЛ 1: Sub-Issue #55 — `[Prefactor] Deepen CompanyProfileSchema & Ingest Rich Dossier Manifest into SSOT`

#### Шаг 1.1: Аудит существующих TSX-компонентов досье и спецификации SPEC-12

- **Целевые файлы (Read-Only):**
  - `docs/architecture/specs/12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md`
  - `frontend/src/components/companies/dossier/CompanyCompetenciesRadar.tsx`
  - `frontend/src/components/companies/dossier/CompanySpecReviewChecklist.tsx`
  - `frontend/src/components/companies/dossier/CompanyStarScenarios.tsx`
  - `frontend/src/components/companies/dossier/CompanyTalentQGuide.tsx`
  - `frontend/src/components/companies/CompanyTakeHomeLab.tsx`
- **Действие:** Прочитать файлы, зафиксировать точные структуры локальных констант (`COMPETENCIES`, `SPEC_ITEMS`, `STAR_SCENARIOS`, `TALENT_Q_RULES`, `PR_CASES`), чтобы согласовать имена полей со схемой `shared/src/schemas/companyProfile.ts`.

#### Шаг 1.2: Расширение `shared/src/schemas/companyProfile.ts`

- **Целевой файл:** `shared/src/schemas/companyProfile.ts`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Добавить схемы `ArenaLaunchIntentSchema`, `ExpressRunbookTaskLinkSchema`, `CompetencyItemSchema`, `SpecReviewCheckItemSchema`, `StarScenarioItemSchema`, `TalentQRuleItemSchema`, `TalentQGuideSchema`, `CompanyDossierSchema`, `TakeHomePrCaseSchema`, `CompanyTakeHomeLabSchema`, `CompanyQuickActionChipSchema` согласно Разделу 3.1 (с учетом точных имен полей из `SPEC-12` и прочитанных в Шаге 1.1 компонентов).
  2. Расширить `CompanyProfileSchema` полями `dossier`, `takeHomeLab`, `quickActionChips`.
  3. Убедиться, что все новые типы и схемы реэкспортируются через `shared/src/index.ts`.
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l shared/src/schemas/companyProfile.ts
  # Должно быть <= 350 строк (Rule 8)
  
  ```

#### Шаг 1.3: Миграция доменных знаний Райффайзена в `json/company_profiles.json`

- **Целевой файл:** `json/company_profiles.json`
- **Действие:** `MODIFY`
- **Реализация:** Перенести в профиль `raiffeisen` (без сокращений и потери данных):
  1. `expressRunbook.mustReviewTasks`: типизированный массив ссылок с явным `targetArena` и `taskId`:
    - `iban-validator` $\rightarrow$ `targetArena: "practice"`
    - `case_transfer_service` $\rightarrow$ `targetArena: "incidents"`
    - `sql-raif-cib-2026` (или актуальный ID из `stages`) $\rightarrow$ `targetArena: "sql_arena"`
    - `SD-ATM-HARDWARE-DISPENSER` $\rightarrow$ `targetArena: "system_design"`
    - `cib-interns-test-task` $\rightarrow$ `targetArena: "take_home"`
  2. `dossier.competencies`: все 9 компетенций Product Engineer из `CompanyCompetenciesRadar.tsx`.
  3. `dossier.specReviewChecklist`: все 8 пунктов проверки ТЗ из `CompanySpecReviewChecklist.tsx`.
  4. `dossier.starScenarios`: все 4 кейса STAR из `CompanyStarScenarios.tsx`.
  5. `dossier.talentQGuide`: все правила, тайминги и примеры из `CompanyTalentQGuide.tsx`.
  6. `takeHomeLab`: полное описание задачи склада носков (`cib-interns-test-task`) и массив `prCases` из `CompanyTakeHomeLab.tsx`.
  7. `quickActionChips`: 4 специфичных для Райффайзена чипса (`pitch_review`, `star_drill`, `socks_warehouse`, `transferservice_defects`).
- **Локальная верификация (Zero-RAM):**
  ```bash
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('json/company_profiles.json', 'utf8'));
    const raif = data.find(p => p.id === 'raiffeisen') || data[0];
    if (!raif.dossier || raif.dossier.competencies.length < 9) throw new Error('Missing competencies');
    if (raif.dossier.specReviewChecklist.length < 8) throw new Error('Missing specReviewChecklist');
    if (raif.dossier.starScenarios.length < 4) throw new Error('Missing starScenarios');
    if (!raif.takeHomeLab || !raif.takeHomeLab.prCases.length) throw new Error('Missing takeHomeLab');
    console.log('JSON SSOT validation passed:', raif.id);
  "
  
  ```

#### Шаг 1.4: Валидация схемы на уровне `backend/src/routes/companies.ts`

- **Целевой файл:** `backend/src/routes/companies.ts`
- **Действие:** `MODIFY`
- **Реализация:** Добавить проверку загружаемых профилей через `Value.Check(CompanyProfileSchema, profile)` из `@sinclair/typebox/value` при чтении `company_profiles.json` и функцию `resetCompanyProfilesCache()` для тестовой среды.
  ```typescript
  import { Router, Request, Response } from 'express';
  import fs from 'fs';
  import { Value } from '@sinclair/typebox/value';
  import { CompanyProfile, CompanyProfileSchema } from '@interview-prep/shared';
  import { resolveJsonCatalogPath } from '../utils/pathResolver';
  
  const router = Router();
  let cachedProfiles: CompanyProfile[] | null = null;
  
  export function resetCompanyProfilesCache(): void {
    cachedProfiles = null;
  }
  
  function loadProfiles(): CompanyProfile[] {
    if (cachedProfiles && cachedProfiles.length > 0) return cachedProfiles;
    try {
      const profilesPath = resolveJsonCatalogPath('company_profiles.json');
      if (!fs.existsSync(profilesPath)) {
        console.error(`[CompaniesRoute] company_profiles.json not found at: ${profilesPath}`);
        return [];
      }
      const raw = fs.readFileSync(profilesPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.error('[CompaniesRoute] company_profiles.json root must be an array');
        return [];
      }
      const validProfiles: CompanyProfile[] = [];
      for (const item of parsed) {
        if (Value.Check(CompanyProfileSchema, item)) {
          validProfiles.push(item);
        } else {
          const errors = [...Value.Errors(CompanyProfileSchema, item)];
          console.error('[CompaniesRoute] Schema validation error for profile:', errors[0]);
        }
      }
      cachedProfiles = validProfiles;
      return cachedProfiles;
    } catch (err) {
      console.error('[CompaniesRoute] Failed to load company profiles:', err);
      return [];
    }
  }
  
  ```
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l backend/src/routes/companies.ts
  
  ```

### УЗЕЛ 2: Sub-Issue #56 — `[Tracer-Bullet] Build ArenaNavigator Seam & Wire Deterministic Cross-Arena Execution`

#### Шаг 2.1: Расширение кросс-аренных указателей в `frontend/src/store/useAppStore.ts`

- **Целевой файл:** `frontend/src/store/useAppStore.ts`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Проверить текущие поля стора в `useAppStore.ts` и `usePracticeTutorStore.ts`.
  2. Обеспечить наличие детерминированных целевых ID для всех арен (если часть уже есть — переиспользовать их; недостающие добавить в `AppState`):
    - `targetSqlChallengeId: string | null` + `setTargetSqlChallengeId: (id: string | null) => void`
    - `targetPracticeTaskId: string | null` + `setTargetPracticeTaskId: (id: string | null) => void`
    - `targetIncidentId: string | null` + `setTargetIncidentId: (id: string | null) => void`
    - `targetSystemDesignId: string | null` + `setTargetSystemDesignId: (id: string | null) => void`
  3. Проверить, как компоненты арен (`Practice` / `Incidents` / `SystemDesign`) инициализируют выбранную задачу при монтировании. Если они читают из `useAppStore` или `usePracticeTutorStore`, связать потребление `targetPracticeTaskId` / `targetIncidentId` / `targetSystemDesignId` при входе на вкладку, чтобы открывалась именно задача `targetEntityId`.
  4. Проверить длину `useAppStore.ts` (Rule 8: $\le 350$ строк).
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/store/useAppStore.ts
  
  ```

#### Шаг 2.2: Создание детерминированного навигатора `frontend/src/components/companies/arenaNavigator.ts`

- **Целевой файл:** `frontend/src/components/companies/arenaNavigator.ts`
- **Действие:** `CREATE`
- **Реализация:**
  ```typescript
  import {
    ArenaLaunchIntent,
    CompanyPipelineStage,
    CompanyProfile,
    TargetArena
  } from '@interview-prep/shared';
  
  export type CompanyStudioSubTab =
    | 'pipeline'
    | 'dossier'
    | 'runbook'
    | 'sql_arena'
    | 'take_home';
  
  export interface ArenaNavigationCallbacks {
    setStudioTab: (tab: any) => void;
    setActiveSubTab: (subTab: CompanyStudioSubTab) => void;
    setIsVoiceOpen: (open: boolean) => void;
    setTargetSqlChallengeId: (id: string) => void;
    setTargetPracticeTaskId?: (id: string) => void;
    setTargetIncidentId?: (id: string) => void;
    setTargetSystemDesignId?: (id: string) => void;
  }
  
  export function createIntentFromStage(
    stage: CompanyPipelineStage,
    companyId: string
  ): ArenaLaunchIntent {
    return {
      targetArena: stage.targetArena,
      targetEntityId: stage.targetEntityId,
      companyId,
      stageId: stage.id
    };
  }
  
  export function resolveRunbookTaskIntent(
    taskId: string,
    profile: CompanyProfile
  ): ArenaLaunchIntent | null {
    // 1. Детерминированный поиск в типизированных ссылках ранбука
    const explicitTask = profile.expressRunbook.mustReviewTasks?.find(
      (t) => t.taskId === taskId
    );
    if (explicitTask) {
      return {
        targetArena: explicitTask.targetArena,
        targetEntityId: explicitTask.taskId,
        companyId: profile.id
      };
    }
  
    // 2. Детерминированный поиск по этапам пайплайна компании
    const matchingStage = profile.stages.find(
      (s) => s.targetEntityId === taskId || s.id === taskId
    );
    if (matchingStage) {
      return createIntentFromStage(matchingStage, profile.id);
    }
  
    // 3. Детерминированный поиск по Take-Home Lab
    if (profile.takeHomeLab?.taskId === taskId || profile.takeHomeLab?.repoSlug === taskId) {
      return {
        targetArena: 'take_home',
        targetEntityId: taskId,
        companyId: profile.id
      };
    }
  
    return null;
  }
  
  export function executeArenaLaunchIntent(
    intent: ArenaLaunchIntent,
    callbacks: ArenaNavigationCallbacks
  ): void {
    const { targetArena, targetEntityId } = intent;
  
    switch (targetArena) {
      case 'voice_modal':
        callbacks.setIsVoiceOpen(true);
        break;
      case 'practice':
        callbacks.setTargetPracticeTaskId?.(targetEntityId);
        callbacks.setStudioTab('practice');
        break;
      case 'incidents':
        callbacks.setTargetIncidentId?.(targetEntityId);
        callbacks.setStudioTab('incidents');
        break;
      case 'sql_arena':
        callbacks.setTargetSqlChallengeId(targetEntityId);
        callbacks.setActiveSubTab('sql_arena');
        break;
      case 'system_design':
        callbacks.setTargetSystemDesignId?.(targetEntityId);
        callbacks.setStudioTab('system_design');
        break;
      case 'take_home':
        callbacks.setActiveSubTab('take_home');
        break;
    }
  }
  
  ```
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/components/companies/arenaNavigator.ts
  
  ```

#### Шаг 2.3: Подключение `arenaNavigator` в `CompanyPrepStudio.tsx` и `CompanyRunbookTab.tsx`

- **Целевые файлы:**
  - `frontend/src/components/companies/CompanyPrepStudio.tsx`
  - `frontend/src/components/companies/CompanyRunbookTab.tsx`
- **Действие:** `MODIFY`
- **Реализация:**
  1. В `CompanyPrepStudio.tsx` заменить старые `handleLaunchStage` и `handleNavigateToTask` (содержавшие `startsWith('sql-')`, `startsWith('case_')` и потерю `targetEntityId`) на вызовы `createIntentFromStage`, `resolveRunbookTaskIntent` и `executeArenaLaunchIntent`.
  2. В `CompanyRunbookTab.tsx` рендерить список задач для повторения из `profile.expressRunbook.mustReviewTasks` (или сопоставлять `mustReviewTaskIds` с этапами профиля), отображая точный бейдж целевой арены и вызывая `onNavigateToTask(taskId)`.
- **Локальная верификация (Zero-RAM):**
  ```bash
  rg "startsWith\('(sql-|case_|sd-)" frontend/src/components/companies/
  # Должно вернуть 0 совпадений
  wc -l frontend/src/components/companies/CompanyPrepStudio.tsx frontend/src/components/companies/CompanyRunbookTab.tsx
  
  ```

### УЗЕЛ 3: Sub-Issue #57 — `[Migrate-Batch] Refactor Dossier Subcomponents into Generic View Adapters`

> **Инвариант UI Deletion Test Exception:**
> Все 4 подкомпонента досье сохраняют свою интерактивность (раскрытие секций, ARIA-атрибуты, чекбоксы Spec Review, интерактивный калькулятор долей и таймер в Talent Q), но полностью очищаются от захардкоженных массивов Райффайзена и принимают данные через типизированные пропсы из `CompanyDossier`.

#### Шаг 3.1: Перевод `CompanyCompetenciesRadar.tsx` на пропсы

- **Целевой файл:** `frontend/src/components/companies/dossier/CompanyCompetenciesRadar.tsx`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Удалить захардкоженный массив компетенций Райффайзена из файла.
  2. Принимать пропсы `{ competencies: CompetencyItem[]; companyName?: string }`.
  3. Если `competencies.length === 0`, рендерить явное пустое состояние (`EmptyState`: «Матрица компетенций для данного профиля еще не заполнена») — без подстановки фантомных фолбэков.
  4. Сохранить интерактивный выбор/фильтрацию компетенций и ARIA-разметку.
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/components/companies/dossier/CompanyCompetenciesRadar.tsx
  
  ```

#### Шаг 3.2: Перевод `CompanySpecReviewChecklist.tsx` на пропсы

- **Целевой файл:** `frontend/src/components/companies/dossier/CompanySpecReviewChecklist.tsx`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Удалить локальный массив пунктов Spec Review.
  2. Принимать пропсы `{ items: SpecReviewCheckItem[] }`.
  3. Сохранить интерактивное состояние отмеченных чекбоксов (`checkedIds`), прогресс-бар готовности ТЗ и фильтрацию по критичности.
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/components/companies/dossier/CompanySpecReviewChecklist.tsx
  
  ```

#### Шаг 3.3: Перевод `CompanyStarScenarios.tsx` на пропсы

- **Целевой файл:** `frontend/src/components/companies/dossier/CompanyStarScenarios.tsx`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Удалить захардкоженный массив из 4 STAR-кейсов Райффайзена.
  2. Принимать пропсы `{ scenarios: StarScenarioItem[]; onPracticeWithTutor?: (scenario: StarScenarioItem) => void }`.
  3. Сохранить аккордеоны/карточки декомпозиции `Situation -> Task -> Action -> Result` и блок каверзных follow-up ловушек.
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/components/companies/dossier/CompanyStarScenarios.tsx
  
  ```

#### Шаг 3.4: Перевод `CompanyTalentQGuide.tsx` на пропсы

- **Целевой файл:** `frontend/src/components/companies/dossier/CompanyTalentQGuide.tsx`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Удалить захардкоженные правила и тексты Райффайзена.
  2. Принимать пропсы `{ guide?: TalentQGuide }`.
  3. **Сохранить интерактивный мини-калькулятор Talent Q** (расчет процентов, изменения год-к-году, долей) и таймер симуляции, питая справочные карточки и лимиты времени из `guide`.
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/components/companies/dossier/CompanyTalentQGuide.tsx
  
  ```

#### Шаг 3.5: Проброс `profile.dossier` через `CompanyDossierTab.tsx`

- **Целевой файл:** `frontend/src/components/companies/CompanyDossierTab.tsx`
- **Действие:** `MODIFY`
- **Реализация:** Передать `profile.dossier?.competencies ?? []`, `profile.dossier?.specReviewChecklist ?? []`, `profile.dossier?.starScenarios ?? []` и `profile.dossier?.talentQGuide` в дочерние компоненты.
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/components/companies/CompanyDossierTab.tsx
  
  ```

### УЗЕЛ 4: Sub-Issue #58 — `[Tracer-Bullet] Purge Leaked Domain Constants from Polymorphic Copilot Core`

#### Шаг 4.1: Очистка `shared/src/schemas/tutorNormalizer.ts` от констант Райффайзена

- **Целевой файл:** `shared/src/schemas/tutorNormalizer.ts`
- **Действие:** `MODIFY`
- **Реализация:** Заменить захардкоженные чипсы («Склад носков», `TransferService`, `cib-interns-test-task`) на динамическое формирование из `payload.profile`:
  ```typescript
  export function normalizeCompanyContext(payload: CompanyStudioSpokePayload): TutorActiveContext {
    const { profile, activeStage, activeCodeSnippet, activeTaskTitle } = payload;
  
    const metricsList = profile.culture?.metricsFocus?.length
      ? profile.culture.metricsFocus.join(', ')
      : 'ключевым инженерным метрикам компании';
  
    const defaultChips: TutorQuickActionChip[] = [
      {
        id: 'pitch_review',
        label: '🎙️ Отрепетируй питч',
        promptMessage: `Послушай мой питч о себе для компании ${profile.name} и оцени его по фокусу культуры (${metricsList}).`
      },
      {
        id: 'star_drill',
        label: '🚨 Каверзный вопрос по STAR',
        promptMessage: `Задай мне каверзный поведенческий вопрос по методике STAR с учетом red flags компании ${profile.name}.`
      }
    ];
  
    if (profile.takeHomeLab?.title) {
      defaultChips.push({
        id: 'take_home_traps',
        label: `🧪 Ловушки Take-Home (${profile.takeHomeLab.title})`,
        promptMessage: `Разбери частые антипаттерны и архитектурные дефекты в задании ${profile.takeHomeLab.title}: ${profile.takeHomeLab.antiPatternsSummary}.`
      });
    }
  
    const quickActionChips: TutorQuickActionChip[] =
      profile.quickActionChips && profile.quickActionChips.length > 0
        ? profile.quickActionChips
        : defaultChips;
  
    return {
      arena: 'companies',
      entityId: profile.id,
      entityTitle: activeTaskTitle || activeStage?.title || profile.name,
      domain: profile.culture?.engineeringParadigm || 'Product Engineering & Enterprise Invariants',
      persona: 'company_interviewer',
      assistanceLevel: 3,
      activeCodeOrQuery: activeCodeSnippet,
      instructions: activeStage?.description || profile.tagline || '',
      companyContext: {
        companyId: profile.id,
        companyName: profile.name,
        stageTitle: activeStage?.title,
        cultureMetrics: profile.culture?.metricsFocus,
        redFlags: profile.culture?.redFlags,
        greenFlags: profile.culture?.greenFlags,
        takeHomeContext: profile.takeHomeLab
          ? {
              title: profile.takeHomeLab.title,
              prAntiPatternsSummary: profile.takeHomeLab.antiPatternsSummary
            }
          : undefined
      },
      quickActionChips
    };
  }
  
  ```
- **Локальная верификация (Zero-RAM):**
  ```bash
  rg "Склад носков|cib-interns-test-task|TransferService" shared/src/schemas/tutorNormalizer.ts
  # Должно вернуть 0 совпадений
  wc -l shared/src/schemas/tutorNormalizer.ts
  
  ```

#### Шаг 4.2: Очистка `polymorphicPromptBuilder.ts` и `personas.ts` от констант Райффайзена

- **Целевые файлы:**
  - `backend/src/prompts/tutor/polymorphicPromptBuilder.ts`
  - `backend/src/prompts/personas.ts`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Проверить оба файла через `rg "Райффайзен|Raiffeisen|Склад носков|TransferService|cib-interns-test-task"`.
  2. В `polymorphicPromptBuilder.ts` заменить любые захардкоженные упоминания банка или тестового задания на интерполяцию полей из `context.companyContext` (`companyName`, `cultureMetrics`, `redFlags`, `greenFlags`, `takeHomeContext.title`, `takeHomeContext.prAntiPatternsSummary`). Если `takeHomeContext` не задан в профиле компании, секция Take-Home в системный промпт не рендерится.
  3. В `personas.ts` убедиться, что персона `company_interviewer` описана как универсальный Staff/Principal Bar Raiser целевой компании из контекста, без привязки к одному банку.
- **Локальная верификация (Zero-RAM):**
  ```bash
  rg "Склад носков|cib-interns-test-task|TransferService" backend/src/prompts/
  # Должно вернуть 0 совпадений
  
  ```

#### Шаг 4.3: Обновление модульных тестов нормализатора и промпт-билдера

- **Целевые файлы:**
  - `backend/tests/test_polymorphic_tutor_normalizers.js`
  - `backend/tests/test_polymorphic_prompt_builder.js`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Добавить тестовый кейс с второй синтетической компанией (например, `id: 'acme-fintech'`, без `takeHomeLab` и без носков), проверяющий, что `normalizeCompanyContext` и `buildPolymorphicSystemPrompt` не содержат строк `cib-interns-test-task`, `Склад носков` или `TransferService`.
  2. Обновить существующие тесты для профиля Райффайзена так, чтобы они передавали `takeHomeLab` и `quickActionChips` из структуры профиля.

### УЗЕЛ 5: Sub-Issue #59 — `[Contract] Decompose Take-Home PR Forensics into Manifest-Driven Architecture`

#### Шаг 5.1: Декомпозиция `CompanyTakeHomeLab.tsx` на манифест-ориентированный компонент

- **Целевой файл:** `frontend/src/components/companies/CompanyTakeHomeLab.tsx`
- **Действие:** `MODIFY`
- **Реализация:**
  1. Удалить из тела `CompanyTakeHomeLab.tsx` захардкоженный массив `PR_CASES` и статическое описание `cib-interns-test-task` (они уже перенесены в `json/company_profiles.json` на Шаге 1.3).
  2. Принимать пропсы:
     ```typescript
     interface CompanyTakeHomeLabProps {
       lab?: CompanyTakeHomeLab;
       onAskTutorWithSnippet?: (snippet: string, caseTitle: string) => void;
     }
     
     ```
  3. Если `!lab` или `lab.prCases.length === 0`, рендерить чистый `EmptyState` без фантомных фолбэков.
  4. Сохранить всю интерактивную механику PR Forensics (переключение между PR-кейсами, выбор чекбоксов дефектов из `prCase.defectOptions`, выбор вердикта `reject | request_changes | approve`, вычисление точности ревью, показ `architecturalFix` и кнопку отправки кода в AI-Напарника).
  5. Убедиться, что размер файла после удаления встроенного каталога стал $< 220$ строк (при необходимости вынести карточку отдельного PR-диффа в `frontend/src/components/companies/TakeHomePrCaseCard.tsx`).
- **Локальная верификация (Zero-RAM):**
  ```bash
  wc -l frontend/src/components/companies/CompanyTakeHomeLab.tsx
  # Должно быть строго <= 350 строк
  
  ```

#### Шаг 5.2: Финальный Pre-Push Hygiene Audit & Remote Verification

- **Действие:** Проверить соблюдение всех инвариантов перед коммитом и запуском `remote-verify`:
  1. Проверка лимита строк (Rule 8 $\le 350$ строк для всех измененных и новых исходных файлов):
     ```bash
     wc -l \
       shared/src/schemas/companyProfile.ts \
       shared/src/schemas/tutorNormalizer.ts \
       backend/src/routes/companies.ts \
       backend/src/prompts/tutor/polymorphicPromptBuilder.ts \
       frontend/src/components/companies/arenaNavigator.ts \
       frontend/src/components/companies/CompanyPrepStudio.tsx \
       frontend/src/components/companies/CompanyRunbookTab.tsx \
       frontend/src/components/companies/CompanyDossierTab.tsx \
       frontend/src/components/companies/CompanyTakeHomeLab.tsx \
       frontend/src/components/companies/dossier/CompanyCompetenciesRadar.tsx \
       frontend/src/components/companies/dossier/CompanySpecReviewChecklist.tsx \
       frontend/src/components/companies/dossier/CompanyStarScenarios.tsx \
       frontend/src/components/companies/dossier/CompanyTalentQGuide.tsx
     
     ```
  2. Проверка отсутствия утечек домена Райффайзена вне `json/company_profiles.json` и тестов:
     ```bash
     rg "Склад носков|cib-interns-test-task" shared/ backend/src/ frontend/src/
     # Должно вернуть 0 совпадений
     
     ```
  3. Запуск удаленной верификации в GitHub Actions (Invariant 0 — **без** локального запуска `tsc` или `npm test`):
     ```bash
     remote-verify
     
     ```

---

*Exported from [Voyager](https://github.com/voyager-crew/voyager)*  
*Generated on November 9, 2026 at 09:40 AM*