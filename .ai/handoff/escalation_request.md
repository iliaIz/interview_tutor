# SYSTEM ROLE: Principal Software Architect (Zero-Context Escalation)
Ты проектируешь архитектурное решение и атомарный план имплементации для локального CLI-исполнителя (Gemini 3.8 Flash в Antigravity CLI). Ты работаешь в полной изоляции и видишь ТОЛЬКО данные из этого документа. Не додумывай существование файлов, методов или библиотек, которых нет ниже.

<project_environment>
- **Monorepo / Workspaces:** npm workspaces across `shared`, `backend`, `frontend`.
- **Node.js:** v22.x LTS.
- **TypeScript:** v5.7.2.
- **Shared Schema Engine:** `@sinclair/typebox` v0.34.52 (SSOT for all wire, catalog, and context schemas).
- **Backend:** Express v4.21.2, TypeScript, ts-node-dev, better-sqlite3 v12.11.1, ws v8.18.0.
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide icons, Zustand (`useAppStore`, `usePracticeTutorStore`), CodeMirror, PGlite WASM (`@electric-sql/pglite` v0.5.15).
- **Remote Verification:** Verification MUST NOT run locally (1.8 GB RAM constraint, Invariant 0). Verification runs via `remote-verify` in GitHub Actions.
- **File Length Limit:** Strictly $\le 350$ lines per source file (Rule 8 File-Hygiene). Any modified file $> 400$ lines must be decomposed.
</project_environment>

<problem_statement>
## Задача: Архитектурное углубление раздела компании «Райффайзен» (Raiffeisen DGTL Track & Company Preparation Hub)

### Анализ первопричин (Root Causes vs Symptoms):
1. **Domain Knowledge Fracture (Расщепление доменной модели):**
   - Доменная схема `CompanyProfileSchema` в `shared/src/schemas/companyProfile.ts` оказалась анемичной.
   - Свыше 920 строк важнейшего доменного знания (9 компетенций Product Engineer, 8 пунктов Spec Review, 4 подробных кейса STAR и гайд Talent Q) были жестко захардкожены в 4 UI-компонентах (`CompanyCompetenciesRadar.tsx`, `CompanySpecReviewChecklist.tsx`, `CompanyStarScenarios.tsx`, `CompanyTalentQGuide.tsx`).
   - Бэкенд и AI-Напарник полностью отрезаны от этих данных и не могут их динамически инжектировать.
2. **Severed Navigation Seam (Разорванный шов запуска этапов):**
   - В `CompanyPrepStudio.tsx` функция `handleLaunchStage` для Live Coding (`iban-validator`), Code Review (`case_transfer_service`) и System Design (`SD-ATM-HARDWARE-DISPENSER`) вызывает лишь `setStudioTab(...)`, теряя `targetEntityId`. Кандидат нажимает «Перейти к этапу» и попадает в произвольную чужую задачу, открытую ранее.
   - Навигация по ранбуку `handleNavigateToTask` использует ad-hoc проверку префиксов строк (`startsWith('sql-')`, `startsWith('case_')`).
3. **Domain Leakage across Copilot Boundary (Утечка контекста банка в generic-ядро):**
   - В универсальный нормализатор `tutorNormalizer.ts` и промпт-билдер `polymorphicPromptBuilder.ts` протекли специфичные для Райффайзена строки («Склад носков», «TransferService», «cib-interns-test-task»). При добавлении любой второй компании нормализатор продолжит предлагать носки и переводы.
4. **Take-Home Minigame Isolation (Дублирование каталога в изолированном TSX):**
   - Компонент `CompanyTakeHomeLab.tsx` на 325 строк содержит массив `PR_CASES` прямо в теле файла, обходя каноническое хранилище манифестов платформы.

### Утвержденная архитектурная спецификация (SPEC-12) & Ticket DAG:
- Parent Issue: **#54** (`spec(companies): SPEC-12 Company Prep Studio Deepening & ArenaNavigator Seam Architecture`)
- Sub-Issue #55: `[Prefactor] Deepen CompanyProfileSchema & Ingest Rich Dossier Manifest into SSOT` (Root Node)
- Sub-Issue #56: `[Tracer-Bullet] Build ArenaNavigator Seam & Wire Deterministic Cross-Arena Execution` (Blocked by #55)
- Sub-Issue #57: `[Migrate-Batch] Refactor Dossier Subcomponents into Generic View Adapters` (Blocked by #55)
- Sub-Issue #58: `[Tracer-Bullet] Purge Leaked Domain Constants from Polymorphic Copilot Core` (Blocked by #55)
- Sub-Issue #59: `[Contract] Decompose Take-Home PR Forensics into Manifest-Driven Architecture` (Blocked by #56, #57)
</problem_statement>

<failed_local_attempts>
None (Preventive architectural escalation: Greenfield & Architecture + Blast Radius > 3 files)
</failed_local_attempts>

<repository_topology>
shared/src/schemas/companyProfile.ts
shared/src/schemas/tutorNormalizer.ts
shared/src/schemas/tutorContext.ts
json/company_profiles.json
backend/src/routes/companies.ts
backend/src/prompts/tutor/polymorphicPromptBuilder.ts
backend/src/prompts/personas.ts
backend/tests/test_polymorphic_tutor_normalizers.js
backend/tests/test_polymorphic_prompt_builder.js
frontend/src/components/companies/CompanyPrepStudio.tsx
frontend/src/components/companies/CompanyPipelineTab.tsx
frontend/src/components/companies/CompanyRunbookTab.tsx
frontend/src/components/companies/CompanyTakeHomeLab.tsx
frontend/src/components/companies/CompanyDossierTab.tsx
frontend/src/components/companies/dossier/CompanyCompetenciesRadar.tsx
frontend/src/components/companies/dossier/CompanySpecReviewChecklist.tsx
frontend/src/components/companies/dossier/CompanyStarScenarios.tsx
frontend/src/components/companies/dossier/CompanyTalentQGuide.tsx
frontend/src/store/useAppStore.ts
frontend/src/store/usePracticeTutorStore.ts
docs/architecture/specs/12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md
</repository_topology>

<source_context>

<file path="shared/src/schemas/companyProfile.ts">
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

export const ExpressRunbookSchema = Type.Object({
  pitchScriptMarkdown: Type.String({ minLength: 1 }),
  mustReviewTaskIds: Type.Array(Type.String(), { default: [] }),
  checklist: Type.Array(Type.String(), { default: [] })
});
export type ExpressRunbook = Static<typeof ExpressRunbookSchema>;

export const CompanyProfileSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  brandColor: Type.String({ default: '#FFE600' }),
  logoBadge: Type.String({ default: '🏦' }),
  tagline: Type.String({ minLength: 1 }),
  culture: CompanyCultureSchema,
  expressRunbook: ExpressRunbookSchema,
  stages: Type.Array(CompanyPipelineStageSchema, { minItems: 1 })
});
export type CompanyProfile = Static<typeof CompanyProfileSchema>;
</file>

<file path="shared/src/schemas/tutorNormalizer.ts">
import {
  TutorActiveContext,
  TutorQuickActionChip
} from './tutorContext';

export interface SqlArenaSpokePayload {
  challenge: {
    id: string;
    slug?: string;
    title: string;
    instructionsMarkdown?: string;
    schemaSql?: string;
    seedSql?: string;
    category?: string;
  };
  currentSql: string;
  executionResult?: {
    success?: boolean;
    error?: string;
    diff?: {
      missingRows?: Array<Record<string, any>>;
      unexpectedRows?: Array<Record<string, any>>;
      columnMismatch?: boolean;
      orderMismatch?: boolean;
    };
  };
  companyContextName?: string;
}

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

export function normalizeCompanyContext(payload: CompanyStudioSpokePayload): TutorActiveContext {
  const { profile, activeStage, activeCodeSnippet, activeTaskTitle } = payload;

  const quickActionChips: TutorQuickActionChip[] = [
    {
      id: 'pitch_review',
      label: '🎙️ Отрепетируй 4-мин питч',
      promptMessage: 'Послушай мой 4-минутный питч о себе как Product Engineer и оцени его по метрикам банка (TTM, Pain Index, Zero-Downtime, Shift-Left).'
    },
    {
      id: 'star_drill',
      label: '🚨 Каверзный вопрос по STAR',
      promptMessage: 'Задай мне неожиданный каверзный вопрос по методике STAR на тему отказа в проде, комплаенса или распила легаси-монолита.'
    },
    {
      id: 'socks_warehouse',
      label: '🧦 Ловушки «Склада носков»',
      promptMessage: 'Разбери частые антипаттерны и гонки данных в тестовом задании склада носков (cib-interns-test-task).'
    },
    {
      id: 'transferservice_defects',
      label: '🛡️ Дефекты TransferService',
      promptMessage: 'Объясни скрытые баги в TransferService: почему возникает дедлок в БД и как работает детерминированная сортировка min(id)->max(id).'
    }
  ];

  return {
    arena: 'companies',
    entityId: profile.id,
    entityTitle: activeTaskTitle || activeStage?.title || profile.name,
    domain: 'Product Engineering & Enterprise Invariants',
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
      takeHomeContext: {
        title: 'cib-interns-test-task (Склад носков)',
        prAntiPatternsSummary: 'Гонка данных в Java balance read, отсутствие UNIQUE(color, cotton_part), использование double'
      }
    },
    quickActionChips
  };
}
</file>

<file path="backend/src/routes/companies.ts">
import { Router, Request, Response } from 'express';
import fs from 'fs';
import { CompanyProfile } from '@interview-prep/shared';
import { resolveJsonCatalogPath } from '../utils/pathResolver';

const router = Router();
let cachedProfiles: CompanyProfile[] | null = null;

function loadProfiles(): CompanyProfile[] {
  if (cachedProfiles && cachedProfiles.length > 0) return cachedProfiles;
  try {
    const profilesPath = resolveJsonCatalogPath('company_profiles.json');
    if (!fs.existsSync(profilesPath)) {
      console.error(`[CompaniesRoute] company_profiles.json not found at: ${profilesPath}`);
      return [];
    }
    const raw = fs.readFileSync(profilesPath, 'utf-8');
    cachedProfiles = JSON.parse(raw);
    return cachedProfiles || [];
  } catch (err) {
    console.error('[CompaniesRoute] Failed to load company profiles:', err);
    return [];
  }
}

router.get('/', (_req: Request, res: Response) => {
  const profiles = loadProfiles();
  res.json(profiles);
});

router.get('/:id', (req: Request, res: Response) => {
  const profiles = loadProfiles();
  const profile = profiles.find((p) => p.id === req.params.id);
  if (!profile) {
    return res.status(404).json({ error: `Company profile '${req.params.id}' not found` });
  }
  res.json(profile);
});

export default router;
</file>

<file path="frontend/src/components/companies/CompanyPrepStudio.tsx">
// Snippet of handleLaunchStage and handleNavigateToTask friction:
  const handleLaunchStage = (stage: CompanyPipelineStage) => {
    switch (stage.format) {
      case 'voice_fit':
        setIsVoiceOpen(true);
        break;
      case 'live_coding':
        setStudioTab('practice');
        break;
      case 'code_review':
        setStudioTab('incidents');
        break;
      case 'sql_arena':
        setTargetSqlChallengeId(stage.targetEntityId);
        setActiveSubTab('sql_arena');
        break;
      case 'system_design':
        setStudioTab('system_design');
        break;
      case 'take_home':
        setActiveSubTab('take_home');
        break;
    }
  };

  const handleNavigateToTask = (taskId: string) => {
    if (taskId.startsWith('sql-')) {
      setTargetSqlChallengeId(taskId);
      setActiveSubTab('sql_arena');
    } else if (taskId.startsWith('case_')) {
      setStudioTab('incidents');
    } else if (taskId.startsWith('sd-') || taskId.startsWith('SD-')) {
      setStudioTab('system_design');
    } else if (taskId === 'cib-interns-test-task') {
      setActiveSubTab('take_home');
    } else {
      setStudioTab('practice');
    }
  };
</file>

<file path="docs/architecture/specs/12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md">
[Full approved specification SPEC-12 as created above]
</file>

</source_context>

<constraints_and_invariants>
1. **Rule 8 File-Hygiene:** Newly created files $\le 350$ lines. Modified files $> 400$ lines must be decomposed.
2. **Invariant 0 (No Local Compiles/Tests):** Local builds on VPS are hardware blocked. Verification MUST run via `remote-verify`.
3. **Zero Phantom Fallbacks:** No hardcoded mock fallbacks masquerading as real data.
4. **UI Deletion Test Exception:** Do not delete UI components that provide accessibility (ARIA), modals, or user interaction (e.g. Talent Q calculator). Turn them into generic visualizers driven by props.
</constraints_and_invariants>

<required_output_contract>
Верни ответ строго в формате инженерной спецификации, готовой для сохранения в `.ai/handoff/architect_response.md` и исполнения локальным CLI-агентом:

1. **Root Cause & Architecture Decision:** В чем фундаментальная причина проблемы и почему выбранная архитектура исключает техдолг.
2. **Assumptions & Blind Spots:** Явный список допущений о частях системы, которые не попали в этот промпт (CLI-агент обязан проверить каждый пункт по файловой системе перед стартом).
3. **Data Contracts & Interfaces:** Точные определения всех новых и изменяемых типов, схем и сигнатур.
4. **Atomic Execution Plan:** Пошаговая инструкция для CLI-агента. Для каждого шага укажи:
   - Целевой файл (`path/to/file`).
   - Действие (`CREATE` / `MODIFY` / `DELETE`) и точная реализация.
   - Команда локальной верификации шага (конкретная команда запуска теста, линтера или компилятора).
</required_output_contract>
