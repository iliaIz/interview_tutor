import {
  TutorActiveContext,
  TutorQuickActionChip
} from './tutorContext';

/**
 * tutorNormalizer.ts
 * SSOT Context Normalizer Engine (Pillar 11).
 * Transforms spoke payloads (Practice, SQL Arena, Company Studio) into canonical TutorActiveContext.
 * File length limit: <= 350 lines (Rule 8).
 */

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

export const DEFAULT_SOCRATIC_COMPANY_CHIPS: TutorQuickActionChip[] = [
  {
    id: 'pitch_review',
    label: '🎙️ Отрепетируй питч',
    promptMessage: 'Послушай мой 4-минутный питч о себе как Product Engineer и оцени его по ключевым инженерным и продуктовым метрикам.'
  },
  {
    id: 'star_drill',
    label: '🚨 Каверзный вопрос по STAR',
    promptMessage: 'Задай мне неожиданный каверзный вопрос по методике STAR на тему отказа в проде, комплаенса или сложных архитектурных компромиссов.'
  },
  {
    id: 'culture_fit',
    label: '🛡️ Проверка на Red/Green флаги',
    promptMessage: 'Проверь мой подход к решению задач на соответствие культурным ценностям компании и маркерам сеньорности (Green Flags).'
  },
  {
    id: 'architecture_defense',
    label: '🏛️ Защита техдизайна',
    promptMessage: 'Проведи экспресс-ревью архитектурного решения: какие узкие места и скрытые предположения в нем есть?'
  }
];

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
    customQuickActionChips?: TutorQuickActionChip[];
    takeHomePrCases?: Array<{ title?: string; focus?: string; [k: string]: any }>;
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

export interface PracticeSpokePayload {
  kataId: string;
  kataTitle: string;
  kataCategory?: string;
  kataInstructions?: string;
  activeFilePath?: string;
  activeFileContent?: string;
  compilerError?: string;
  testFailureMessage?: string;
  assistanceLevel?: number;
}

/**
 * Normalizes SQL Arena workspace into canonical TutorActiveContext.
 */
export function normalizeSqlArenaContext(payload: SqlArenaSpokePayload): TutorActiveContext {
  const { challenge, currentSql, executionResult, companyContextName } = payload;
  const missingRows = executionResult?.diff?.missingRows || [];
  const unexpectedRows = executionResult?.diff?.unexpectedRows || [];

  const quickActionChips: TutorQuickActionChip[] = [
    {
      id: 'why_empty',
      label: '🔍 Почему пустая выборка?',
      promptMessage: 'Объясни, почему мой SQL запрос возвращает пустой результат или неожиданное число строк, не раскрывая готовый ответ.'
    },
    {
      id: 'index_plan',
      label: '⚡ План индексов',
      promptMessage: 'Как оптимизировать этот запрос с точки зрения индексов PostgreSQL (B-Tree, предикаты, селективность), не решая задачу за меня?'
    },
    {
      id: 'socratic_nudge',
      label: '💡 Намёк без решения',
      promptMessage: 'Дай Socratic-намёк первого уровня на скрытую логическую ошибку в моем SQL-запросе.'
    },
    {
      id: 'postgres_trap',
      label: '🛡️ Доменная ловушка',
      promptMessage: 'Какая ключевая ловушка реляционной СУБД (PostgreSQL 16) заложена в этом сценарии?'
    }
  ];

  return {
    arena: 'sql_arena',
    entityId: challenge.id || challenge.slug || 'sql-challenge',
    entityTitle: challenge.title,
    domain: 'PostgreSQL 16 & Relational Invariants',
    persona: 'middle_scaffold',
    assistanceLevel: 2,
    activeCodeOrQuery: currentSql,
    schemaOrDdl: `${challenge.schemaSql || ''}\n${challenge.seedSql || ''}`.trim(),
    instructions: challenge.instructionsMarkdown || '',
    runtimeError: executionResult?.error,
    executionDiff: executionResult?.diff
      ? {
          missingRowsCount: missingRows.length,
          unexpectedRowsCount: unexpectedRows.length,
          mismatchSample: missingRows[0] ? JSON.stringify(missingRows[0]) : undefined
        }
      : undefined,
    companyContext: companyContextName
      ? {
          companyId: 'company_sql_context',
          companyName: companyContextName,
          stageTitle: challenge.title
        }
      : undefined,
    quickActionChips
  };
}

/**
 * Normalizes Company Preparation Studio into canonical TutorActiveContext.
 */
export function normalizeCompanyContext(payload: CompanyStudioSpokePayload): TutorActiveContext {
  const { profile, activeStage, activeCodeSnippet, activeTaskTitle } = payload;

  const quickActionChips = profile.customQuickActionChips && profile.customQuickActionChips.length > 0
    ? profile.customQuickActionChips
    : DEFAULT_SOCRATIC_COMPANY_CHIPS;

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
      takeHomeContext: profile.takeHomePrCases && profile.takeHomePrCases.length > 0
        ? {
            title: `Take-Home Lab (${profile.name})`,
            prAntiPatternsSummary: profile.takeHomePrCases
              .map((c) => c.title || '')
              .filter(Boolean)
              .slice(0, 3)
              .join(', ')
          }
        : undefined
    },
    quickActionChips
  };
}

/**
 * Normalizes Practice Workspace into canonical TutorActiveContext.
 */
export function normalizePracticeContext(payload: PracticeSpokePayload): TutorActiveContext {
  const quickActionChips: TutorQuickActionChip[] = [
    {
      id: 'socratic_hint',
      label: '💡 Socratic Намёк',
      promptMessage: 'Дай Socratic-намёк на нарушение инварианта в коде, не раскрывая готовое решение.'
    },
    {
      id: 'mutation_kill',
      label: '🎯 Как убить мутанта?',
      promptMessage: 'Объясни структуру выжившего мутанта и какой граничный тест необходим для его уничтожения.'
    },
    {
      id: 'ast_structure',
      label: '🧩 Архитектурный паттерн',
      promptMessage: 'Какой архитектурный паттерн или рефакторинг здесь наиболее уместен?'
    }
  ];

  return {
    arena: 'practice',
    entityId: payload.kataId,
    entityTitle: payload.kataTitle,
    domain: payload.kataCategory || 'Testing & Mutation Katas',
    persona: 'middle_scaffold',
    assistanceLevel: payload.assistanceLevel || 2,
    activeFilePath: payload.activeFilePath,
    activeCodeOrQuery: payload.activeFileContent,
    instructions: payload.kataInstructions || '',
    compilerError: payload.compilerError,
    runtimeError: payload.testFailureMessage,
    quickActionChips
  };
}

export interface SystemDesignSpokePayload {
  scenarioId: string;
  scenarioTitle: string;
  targetLevel?: string;
  activeStudioTab: 'spec' | 'math_coach' | 'architecture' | 'staff_ai' | 'runtime' | 'topology' | 'defense';
  activeCodeSnippet?: string;
  activeFilePath?: string;
  fadedBug?: {
    lineNumber?: number;
    description?: string;
    bugPattern?: string;
  };
  topologySummary?: string;
  capacityMathSummary?: string;
  companyContextName?: string;
}

/**
 * Normalizes System Design Workspace into canonical TutorActiveContext.
 * Token-budget ceiling <= 15000 tokens (SPEC-13 §4.2.1).
 */
export function normalizeSystemDesignContext(payload: SystemDesignSpokePayload): TutorActiveContext {
  const quickActionChips: TutorQuickActionChip[] = [
    {
      id: 'hld_tradeoffs',
      label: '⚖️ Архитектурные компромиссы',
      promptMessage: 'Какие фундаментальные компромиссы (CAP, консистентность, задержка vs пропускная способность) критичны для этого сценария?'
    },
    {
      id: 'hld_bottlenecks',
      label: '🚨 Узкие места и точки отказа',
      promptMessage: 'Где в текущей архитектуре находятся потенциальные Single Point of Failure (SPOF) и ботлнеки масштабирования?'
    },
    {
      id: 'hld_runtime_bug',
      label: '🐛 Поиск рантайм-дефекта',
      promptMessage: 'Дай Socratic-подсказку на дефект в Студии 1 (Runtime), не раскрывая готовый код исправления.'
    },
    {
      id: 'hld_math_verify',
      label: '🔢 Верификация расчетов RPS/Storage',
      promptMessage: 'Помоги проверить порядок величин для объема хранилища и сетевой полосы (Capacity Planning).'
    }
  ];

  // Token-budget protection: clamp activeCodeSnippet to 4000 chars, summaries to 2000 chars
  const codeSnippet = payload.activeCodeSnippet
    ? (payload.activeCodeSnippet.length > 4000 ? payload.activeCodeSnippet.slice(0, 4000) + '\n// ... [truncated for context budget]' : payload.activeCodeSnippet)
    : undefined;

  const topSummary = payload.topologySummary
    ? (payload.topologySummary.length > 2000 ? payload.topologySummary.slice(0, 2000) + '...' : payload.topologySummary)
    : undefined;

  const mathSummary = payload.capacityMathSummary
    ? (payload.capacityMathSummary.length > 2000 ? payload.capacityMathSummary.slice(0, 2000) + '...' : payload.capacityMathSummary)
    : undefined;

  let instructionsText = `[АКТИВНАЯ ВКЛАДКА / РЕЖИМ]: ${payload.activeStudioTab.toUpperCase()}`;
  if (payload.targetLevel) {
    instructionsText += `\n[ЦЕЛЕВОЙ ГРЕЙД]: ${payload.targetLevel}`;
  }
  if (payload.fadedBug) {
    instructionsText += `\n[ДЕФЕКТ СТУДИИ 1]: ${payload.fadedBug.lineNumber ? `Строка ${payload.fadedBug.lineNumber} — ` : ''}${payload.fadedBug.description || ''} (${payload.fadedBug.bugPattern || ''})`;
  }
  if (mathSummary) {
    instructionsText += `\n[РАСЧЕТЫ CAPACITY]: ${mathSummary}`;
  }
  if (topSummary) {
    instructionsText += `\n[ТОПОЛОГИЯ УЗЛОВ]: ${topSummary}`;
  }

  return {
    arena: 'system_design',
    entityId: payload.scenarioId,
    entityTitle: payload.scenarioTitle,
    domain: 'Distributed System Design & High-Load Architecture',
    persona: 'faang_interviewer',
    assistanceLevel: 3,
    activeFilePath: payload.activeFilePath || 'src/main/java/Service.java',
    activeCodeOrQuery: codeSnippet,
    instructions: instructionsText,
    companyContext: payload.companyContextName
      ? {
          companyId: 'company_hld_context',
          companyName: payload.companyContextName,
          stageTitle: payload.scenarioTitle
        }
      : undefined,
    quickActionChips
  };
}
