import { db } from './db';
import { TOPIC_MAP } from './topics';
import {
  GenerateBugChallengeParams,
  TECH_STACK_ARCHETYPES,
  DEFECT_FOCUS_MAP
} from './tutorService';

export interface BugPromptMeta {
  isExhausted: boolean;
  systemPrompt: string;
  userPrompt: string;
  topicName: string;
  topicId: string;
  preset: string;
  difficulty: string;
  isSeniorMulti: boolean;
  sampledQuestionId?: string;
  remainingCount: number;
  totalTopicQuestions: number;
}

/**
 * Builds system and user prompts for bug challenge generation.
 */
export function buildBugChallengePrompts(params: GenerateBugChallengeParams): BugPromptMeta {
  let topicName = params.topic || 'Java & Spring Framework';
  const topicId = params.topicId || (params.topic ? params.topic.toLowerCase().replace(/\s+/g, '-') : 'general');
  let contextInfo = '';
  let sampledQuestionId: string | undefined = undefined;
  let totalTopicQuestions = 0;
  let remainingCount = 0;

  const preset = params.workoutPreset || 'exhaustive';
  const difficulty = params.difficulty || (preset === 'senior_multi' ? 'senior' : 'middle');
  const defectFocusKey = params.defectFocus || 'all';
  const defectFocusInstruction = DEFECT_FOCUS_MAP[defectFocusKey] || DEFECT_FOCUS_MAP.all;

  const stackProfileKey = params.techStackProfile || 'modern_cloud';
  let targetTechStackPrompt = TECH_STACK_ARCHETYPES[stackProfileKey]?.stackPrompt || TECH_STACK_ARCHETYPES.modern_cloud.stackPrompt;
  if (stackProfileKey === 'custom' && params.customTechStack) {
    targetTechStackPrompt = `Пользовательский стек: ${params.customTechStack}`;
  }

  const customInstructionsPrompt = params.customInstructions
    ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ПОЛЬЗОВАТЕЛЯ:\n${params.customInstructions}`
    : '';

  if (params.topicId && !params.questionId && !params.questionText) {
    const dbTopicName = TOPIC_MAP[params.topicId.toLowerCase()] || params.topicId;
    topicName = dbTopicName;

    try {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?');
      const totalRow = countStmt.get(dbTopicName) as { count: number };
      totalTopicQuestions = totalRow?.count || 0;

      const excludeIds = params.excludeIds || [];
      const effectiveExclude = preset === 'exhaustive' ? excludeIds : [];

      let queryStr = 'SELECT id, question FROM questions WHERE topic = ?';
      const queryParams: any[] = [dbTopicName];
      if (effectiveExclude.length > 0) {
        const placeholders = effectiveExclude.map(() => '?').join(',');
        queryStr += ` AND id NOT IN (${placeholders})`;
        queryParams.push(...effectiveExclude);
      }
      queryStr += ' ORDER BY RANDOM() LIMIT 5';

      const sampleStmt = db.prepare(queryStr);
      const sampledRows = sampleStmt.all(...queryParams) as { id: string; question: string }[];

      if (preset === 'exhaustive' && sampledRows.length === 0 && totalTopicQuestions > 0) {
        return {
          isExhausted: true,
          systemPrompt: '',
          userPrompt: '',
          topicId,
          topicName,
          preset,
          difficulty,
          isSeniorMulti: false,
          totalTopicQuestions,
          remainingCount: 0
        };
      }

      if (sampledRows && sampledRows.length > 0) {
        sampledQuestionId = sampledRows[0].id;
        remainingCount = Math.max(0, totalTopicQuestions - effectiveExclude.length);
        contextInfo = `Подтемы и концепции для вдохновения:\n` + sampledRows.map((r) => `- ${r.question}`).join('\n');
      }
    } catch (e) {
      console.warn('Could not sample questions from DB for topic bug hunt:', e);
    }
  } else if (params.questionText || params.referenceAnswer) {
    contextInfo = `Конкретный вопрос темы: "${params.questionText || ''}"\nЭталонная теория:\n${params.referenceAnswer ? params.referenceAnswer.slice(0, 500) : ''}`;
    sampledQuestionId = params.questionId;
  }

  const isSeniorMulti = preset === 'senior_multi' || difficulty === 'senior';
  const bugCountInstruction = isSeniorMulti
    ? `Сгенерируй код уровня Senior/Lead/Staff с РОВНО 2 взаимосвязанными или скрытыми дефектами (например, concurrency race condition + пропуск отката транзакции при checked exception или carrier thread pinning).`
    : `Сгенерируй код с РОВНО 1 фундаментальной архитектурной, логической или concurrency ошибкой.`;

  const systemPrompt = `You are a Principal Systems Architect, Technical Interviewer, and Reliability Engineering Lead.
Your objective is to generate production-grade code debugging interview challenges based on real-world enterprise failures and post-mortems (2025-2026).

CORE OPERATIONAL MANDATES:
1. STRICT PROHIBITION OF TRIVIAL DEFECTS:
   - Prohibit all trivial syntax errors, typos, missing semicolons, obvious type mismatches, and rudimentary off-by-one loop boundaries.
   - Prohibit basic NullPointerException flaws caused by uninstantiated objects.
   - MANDATORY: Bugs must stem from architectural subtleties, framework lifecycle mismatches, thread concurrency races, transaction boundary bypasses, or distributed state inconsistencies.
   - The code snippet MUST be syntactically valid and compile cleanly.
2. FRAMEWORK IDIOMS & MODERN SPECIFICATIONS:
   - Target Tech Stack: ${targetTechStackPrompt}
   - For Java 17/21 and Spring Boot 3.x, use exclusively the 'jakarta.*' namespace (NEVER 'javax.*').
   - Leverage modern idioms: Records, Pattern Matching, Sealed Interfaces, Virtual Thread considerations.
3. PRODUCTION LORE GENERATION:
   - systemName: Realistic enterprise microservice name.
   - architectureType: Enterprise pattern.
   - incidentSymptoms: Precise telemetry and observability anomalies.
   - businessImpact: Measurable financial or organizational blast radius.
   - prReviewContext: Plausible developer explanation in the PR.
4. PROGRESSIVE HINTS:
   - Hint 1 (Direction), Hint 2 (Localization), Hint 3 (Solution mechanism).

${customInstructionsPrompt}

РЕЖИМ И СЛОЖНОСТЬ:
${bugCountInstruction}
${defectFocusInstruction}

OUTPUT ENFORCEMENT:
Emit a single, strictly conforming JSON object adhering to this schema:
{
  "title": "Краткое название кейса",
  "subtopic": "Конкретная подтема",
  "categoryBadge": "⚡ Concurrency",
  "difficultyBadge": "${isSeniorMulti ? 'Senior' : 'Middle'}",
  "language": "java",
  "techStack": {
    "language": "Java 21",
    "javaVersion": "Java 21 LTS",
    "framework": "Spring Boot 3.4.2",
    "keyLibraries": ["Spring WebMVC", "Spring Data JPA / Hibernate 6.6", "PostgreSQL 16", "Project Loom (Virtual Threads)"]
  },
  "productionContext": {
    "systemName": "payment-routing-orchestrator",
    "architectureType": "Highload Transactional Outbox (40k RPS)",
    "incidentSymptoms": "Всплеск p99 latency с 15мс до 4200мс в Grafana, алерты Sentry на дублирование списаний.",
    "businessImpact": "Дублирование финансовых транзакций у 2% клиентов в период пиковой распродажи.",
    "prReviewContext": "Коллега добавил локальное кэширование через ConcurrentHashMap."
  },
  "codeSnippet": "исходный код с дефектом (16-28 строк) со стандартными переносами строк \\n",
  "bugExplanation": "Глубокое объяснение механизма сбоя на уровне JVM/Spring/транзакций",
  "fixedCode": "исправленная эталонная версия кода (16-28 строк)",
  "hints": ["Подсказка 1", "Подсказка 2", "Подсказка 3"],
  "keyTakeaways": ["Ключевой вывод 1", "Ключевой вывод 2", "Ключевой вывод 3"]
}`;

  const userPrompt = `Тема: ${topicName}
${contextInfo}

Сгенерируй реалистичную задачу на поиск бага (Production Incident Code Review Challenge) в строгом JSON-формате.`;

  return {
    isExhausted: false,
    systemPrompt,
    userPrompt,
    topicName,
    topicId,
    preset,
    difficulty,
    isSeniorMulti,
    sampledQuestionId,
    remainingCount,
    totalTopicQuestions
  };
}
