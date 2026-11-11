/**
 * practiceTutorPrompts.ts
 *
 * SOTA 2026 Multimodal AI Pair-Programming Co-Pilot & Compass Prompt Engine.
 * Supports Domain-Adaptive prompts (LLD, Concurrency, Transactions, Testing, Refactoring, Java 21),
 * Two-Tier Persona Directives (Psychological Safety + Epistemic Rigor), Progressive Hint Ladders,
 * Golden Rules Grounding, and Centralized Epistemic Vigilance (Anti-Sycophancy & Triage).
 */

import { ANTI_SYCOPHANCY_DIRECTIVES } from './core/antiSycophancy';
import { JAVA21_PLATFORM_INVARIANTS } from './core/platformInvariants';
import { TESTING_COMPASS_RULES, CompassRule } from './tutor/testingCompassRules';
import { LLD_COMPASS_RULES } from './tutor/lldCompassRules';
import { TRANSACTION_COMPASS_RULES } from './tutor/transactionCompassRules';
import { CONCURRENCY_COMPASS_RULES } from './tutor/concurrencyCompassRules';
import { REFACTORING_COMPASS_RULES } from './tutor/refactoringCompassRules';
import { buildHintLadderDirective } from './tutor/hintLadderDirectives';
import { buildPracticeTutorPersonaDirectives } from './tutor/practiceTutorPersonaDirectives';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from './core/sandboxDirectives';
import { normalizeCategorySlug } from '../utils/challengeDomain';

// Re-export for 100% backward compatibility across backend routes
export {
  TESTING_COMPASS_RULES,
  LLD_COMPASS_RULES,
  TRANSACTION_COMPASS_RULES,
  CONCURRENCY_COMPASS_RULES,
  REFACTORING_COMPASS_RULES,
  CompassRule
};

export type TutorPersona = 'junior_explainer' | 'middle_scaffold' | 'senior_socratic' | 'faang_interviewer';

export type HintTier = 0 | 1 | 2 | 3 | 4;

export interface PracticeTutorContext {
  persona: TutorPersona;
  assistanceLevel: number; // 1 (Junior) to 4 (Staff)
  kataTitle: string;
  kataCategory: string;
  kataInstructions: string;
  activeFilePath: string;
  activeFileContent: string;
  selectedCodeSnippet?: string;
  cursorLine?: number;
  cursorColumn?: number;
  survivingMutants?: Array<{
    id: string;
    name: string;
    description: string;
    file: string;
    line: number;
    mutatedContent: string;
  }>;
  compilerError?: string;
  testFailureMessage?: string;
  activeCompassRuleId?: string;
  activeWhiteboardSnippet?: {
    title: string;
    code: string;
    language: string;
  };
  hintTier?: HintTier;
  workspaceManifest?: {
    xmlManifest?: string;
  };
  academyBridgeContext?: {
    courseId?: string;
    stepId?: string;
    moduleTitle?: string;
    learningObjective?: string;
    targetConcepts?: string[];
  };
  earlierTurnsSummary?: string;
}

export function buildPracticeTutorSystemPrompt(context: PracticeTutorContext): string {
  const {
    persona,
    kataTitle,
    kataCategory,
    kataInstructions,
    activeFilePath,
    activeFileContent,
    selectedCodeSnippet,
    cursorLine,
    survivingMutants,
    compilerError,
    testFailureMessage,
    activeCompassRuleId,
    activeWhiteboardSnippet,
    hintTier,
    workspaceManifest
  } = context;

  const cat = normalizeCategorySlug(kataCategory);
  const tit = normalizeCategorySlug(kataTitle);

  const isLld =
    cat.includes('lld') ||
    cat.includes('machine coding') ||
    tit.includes('rate limiter') ||
    tit.includes('matching engine') ||
    tit.includes('parking lot') ||
    tit.includes('cache') ||
    tit.includes('sliding window');

  const isTx = cat.includes('transaction');

  const isConcurrency =
    cat.includes('concurrency') ||
    cat.includes('deadlock') ||
    cat.includes('loom') ||
    tit.includes('thread') ||
    tit.includes('atomic') ||
    tit.includes('lock') ||
    tit.includes('disruptor');

  const isRefactoring =
    cat.includes('refactoring') ||
    cat.includes('legacy') ||
    cat.includes('seam') ||
    tit.includes('gilded') ||
    tit.includes('trip service');

  const isJava21 =
    cat.includes('java21') ||
    cat.includes('java 21') ||
    tit.includes('pattern') ||
    tit.includes('record') ||
    tit.includes('sealed');

  // 1. Persona Directives (Domain-Adaptive with Epistemic Rigor via SRP Module)
  const domainFlags = { isLld, isTx, isConcurrency, isRefactoring, isJava21 };
  const personaDirectives = buildPracticeTutorPersonaDirectives(persona, domainFlags);

  // 2. Hint Ladder Directive (Domain-Adaptive Socratic Guidance)
  const hintLadderDirective = buildHintLadderDirective(domainFlags, hintTier);

  // 3. Compass Rule Grounding
  let compassDirective = '';
  const activeRulesMap = isTx
    ? TRANSACTION_COMPASS_RULES
    : isConcurrency
    ? CONCURRENCY_COMPASS_RULES
    : isRefactoring
    ? REFACTORING_COMPASS_RULES
    : isLld
    ? LLD_COMPASS_RULES
    : TESTING_COMPASS_RULES;
  if (activeCompassRuleId && activeRulesMap[activeCompassRuleId]) {
    const rule = activeRulesMap[activeCompassRuleId];
    compassDirective = `
АКТИВНОЕ ПРАВИЛО КОМПАСА:
Правило: "${rule.name}"
Суть: "${rule.shortFormula}"
Описание: ${rule.fullPrinciple}
Чек-лист для проверки:
${rule.actionableChecklist.map((c) => `- ${c}`).join('\n')}

ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ ПРАВИЛА:
Внимательно проанализируй текущий код кандидата через призму этого правила.
Укажи, где в его коде нарушается это правило и как конкретно его применить прямо сейчас.`;
  }

  // 4. Mutants / Defects Context (if applicable)
  let mutantsContext = '';
  if (survivingMutants && survivingMutants.length > 0) {
    mutantsContext = `
ВЫЖИВШИЕ МУТАНТЫ (НЕУБИТЫЕ ТЕСТАМИ):
${survivingMutants
  .map(
    (m, idx) => `
[Мутант #${idx + 1}] ID: ${m.id} (${m.name})
Описание: ${m.description}
Файл: ${m.file} (строка ${m.line})
Мутированный фрагмент:
${m.mutatedContent}
`
  )
  .join('\n')}`;
  }

  let roleSummary = `Ты — интеллектуальный наставник и парный программист (AI Pair-Programming Co-Pilot) по написанию юнит-тестов и мутационному тестированию в экосистеме Java 21 LTS, Spring Boot, JUnit 5, AssertJ и Mockito.`;
  if (isLld) {
    roleSummary = `Ты — интеллектуальный наставник и парный архитектор (AI Pair-Programming LLD Architect) по низкоуровневому проектированию, чистой архитектуре, структурам данных и потокобезопасности на Java 21 LTS.`;
  } else if (isTx) {
    roleSummary = `Ты — эксперт по транзакциям Spring Boot, уровням изоляции и базам данных.`;
  } else if (isConcurrency) {
    roleSummary = `Ты — эксперт по high-load, многопоточности, Project Loom (Virtual Threads) и неблокирующим алгоритмам на Java 21 LTS.`;
  } else if (isRefactoring) {
    roleSummary = `Ты — эксперт по рефакторингу легаси-кода, созданию швов по Майклу Физерсу, characterization-тестам и устранению запахов кода.`;
  } else if (isJava21) {
    roleSummary = `Ты — эксперт по современным идиомам и архитектурным возможностям Java 21 LTS (Pattern Matching, Records, Sealed Types).`;
  }

  return `
${roleSummary}

${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

${ANTI_SYCOPHANCY_DIRECTIVES}

${JAVA21_PLATFORM_INVARIANTS}

${personaDirectives}

${hintLadderDirective}

${compassDirective}
${context.academyBridgeContext?.moduleTitle || context.academyBridgeContext?.learningObjective ? `
=== ДИДАКТИЧЕСКИЙ КОНТЕКСТ АКАДЕМИИ (CURRICULUM BRIDGE) ===
Учебный модуль: "${context.academyBridgeContext.moduleTitle || 'Урок Академии'}"
Дидактическая цель: "${context.academyBridgeContext.learningObjective || 'Отработка навыков'}"
Целевые концепты для применения: ${(context.academyBridgeContext.targetConcepts || []).join(', ')}
ПЕДАГОГИЧЕСКОЕ ПРАВИЛО: Направляйте наводящие вопросы так, чтобы кандидат самостоятельно применил эти ключевые концепты.
` : ''}${context.earlierTurnsSummary ? `
=== РЕЗЮМЕ РАННЕГО ДИАЛОГА (СЖАТЫЙ КОНТЕКСТ) ===
${context.earlierTurnsSummary}
` : ''}

ТЕКУЩИЙ КОНТЕКСТ ЗАДАЧИ:
- Название задачи: "${kataTitle}"
- Категория: ${kataCategory}
- Инструкция:
${kataInstructions}

АКТИВНЫЙ ФАЙЛ В РЕДАКТОРЕ:
Путь: ${activeFilePath}
${cursorLine ? `Курсор пользователя на строке: ${cursorLine}` : ''}
${selectedCodeSnippet ? `Выделенный фрагмент кода:\n\`\`\`java\n${selectedCodeSnippet}\n\`\`\`` : ''}

ПОЛНЫЙ КОД АКТИВНОГО ФАЙЛА:
${wrapUntrustedContext('active_file_code', activeFileContent)}${
  activeWhiteboardSnippet?.code && activeWhiteboardSnippet.code.trim().length > 0
    ? `\n\nАКТИВНЫЙ КОД НА ИНТЕРАКТИВНОЙ ДОСКЕ (${activeWhiteboardSnippet.title || 'Сниппет'}):\n${wrapUntrustedContext('active_whiteboard_code', activeWhiteboardSnippet.code)}\nДИРЕКТИВА: Пользователь сейчас открыл этот сниппет на доске справа от редактора. Если он задает вопрос по коду на доске или просит сопоставить его со своим файлом, опирайся на этот артефакт.`
    : ''
}${
  workspaceManifest?.xmlManifest
    ? `\n\n=== СТРУКТУРА ПРОЕКТА И ВСЕ ФАЙЛЫ ВОРКСПЕЙСА ===\n${workspaceManifest.xmlManifest}\nДИРЕКТИВА: Ты видишь все классы и тесты проекта. При ответах учитывай архитектурные связи между всеми файлами воркспейса.`
    : ''
}

СТАТУС ВЫПОЛНЕНИЯ:
${compilerError ? `❌ ОШИБКА КОМПИЛЯЦИИ:\n${compilerError}\n` : ''}
${testFailureMessage ? `❌ ОШИБКА ТЕСТА / ПРОВЕРКИ:\n${testFailureMessage}\n` : ''}
${mutantsContext}

ОБЩИЕ ПРАВИЛА ОТВЕТА (ФИНАЛЬНЫЙ ЭПИСТЕМИЧЕСКИЙ ЗАМОК):
1. ЯЗЫК И СТИЛЬ: Отвечай на русском языке, уважительно, четко и структурировано, используя Markdown и блоки \`\`\`java.
2. ЛАКОНИЧНОСТЬ: Говори кратко и по существу (максимум 2-4 абзаца). Разработчик находится в процессе написания кода, длинные лекции отвлекают.
3. ОБЯЗАТЕЛЬНОЕ РАЗГРАНИЧЕНИЕ ПРАВОТЫ (NO SYCOPHANCY):
   - Никогда не поддакивай из вежливости и не хвали сырые идеи («Отличная мысль!», «В целом верно, но...»). Кандидату полезнее всего знать точную техническую правду.
   - Если кандидат в чем-то прав, а в чем-то ошибается — в первом же абзаце проведи четкую границу: явно подтверди верную часть мысли и прямо укажи, какая часть ошибочна и к какому багу она приведет.
   - Если утверждение кандидата неверно — начни ответ с прямого несогласия («Нет, это не сработает: [почему]») и приведи конкретный контрпример.
4. ПЕДАГОГИЧЕСКИЙ БАЛАНС: Если пользователь задает общий вопрос по Java/архитектуре — ответь емко с примером, но в рамках решаемой задачи направляй кандидата к самостоятельному исправлению дефекта.
`.trim();
}
