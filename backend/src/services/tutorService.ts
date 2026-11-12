import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { envConfig } from '../config/env';
import { TOPIC_MAP } from './topics';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
import { LlmGatewayUnavailableError } from './dynamicTaskGenerator';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from '../prompts/core/sandboxDirectives';
import { ANTI_SYCOPHANCY_DIRECTIVES } from '../prompts/core/antiSycophancy';
import {
  TechStackInfo,
  ProductionContext,
  BugChallenge,
  GenerateBugChallengeParams,
  TECH_STACK_ARCHETYPES,
  DEFECT_FOCUS_MAP
} from './bugChallengeTypes';
import {
  saveBugChallengeToDb,
  getSavedBugChallenges,
  updateBugChallengeStatus
} from './bugChallengeRepository';

dotenv.config();

export {
  TechStackInfo,
  ProductionContext,
  BugChallenge,
  GenerateBugChallengeParams,
  TECH_STACK_ARCHETYPES,
  DEFECT_FOCUS_MAP,
  getSavedBugChallenges,
  updateBugChallengeStatus
};

export interface BugChallengeSystemPromptParams {
  targetTechStackPrompt: string;
  bugCountInstruction: string;
  defectFocusInstruction: string;
  customInstructionsPrompt?: string;
  isSeniorMulti: boolean;
}

export function buildBugChallengeSystemPrompt(params: BugChallengeSystemPromptParams): string {
  const {
    targetTechStackPrompt,
    bugCountInstruction,
    defectFocusInstruction,
    customInstructionsPrompt = '',
    isSeniorMulti
  } = params;

  return `You are a Principal Systems Architect, Technical Interviewer, and Reliability Engineering Lead.
Your objective is to generate production-grade code debugging interview challenges based on real-world enterprise failures and post-mortems (2025-2026).

${PROMPT_INJECTION_DEFENSE_DIRECTIVE}
${ANTI_SYCOPHANCY_DIRECTIVES}

================================================================================
EPISTEMIC RIGOR & GROUND TRUTH INVARIANT (CRITICAL FOR DOWNSTREAM EVALUATION):
1. Zero Ambiguity in bugExplanation: You MUST formulate "bugExplanation" at the level of exact low-level failure physics so the downstream AI tutor has an unambiguous, deterministic source of truth and never accepts vague or hand-wavy candidate answers.
   - Explicitly specify the exact broken mechanism: e.g., Java Memory Model (JMM) missing happens-before edge, Virtual Thread carrier thread pinning inside synchronized/native frames, Spring AOP proxy self-invocation bypassing @Transactional/@Cacheable, SimpleKeyGenerator hash/array collision, PostgreSQL isolation level anomaly (Read Committed phantom/non-repeatable read or lost update), or HikariCP connection starvation.
   - Structure "bugExplanation" clearly into: (a) Exact Root Cause Mechanism, (b) Runtime Failure Manifestation under load, and (c) Required Production-Grade Fix (indicating why naive workarounds fail).
2. Non-Spoiler Analytical Hints: Formulate "hints" to guide the candidate toward inspecting specific architectural boundaries (thread lifecycle, proxy boundary, lock scope, transaction boundary) without giving away the answer or validating superficial guesses.

================================================================================
CORE OPERATIONAL MANDATES:
1. STRICT PROHIBITION OF TRIVIAL DEFECTS:
   - Prohibit all trivial syntax errors, typos, missing semicolons, obvious type mismatches, and rudimentary off-by-one loop boundaries.
   - Prohibit basic NullPointerException flaws caused by uninstantiated objects that standard IDE linters flag immediately.
   - MANDATORY: Bugs must stem from architectural subtleties, framework lifecycle mismatches, thread concurrency races, transaction boundary bypasses, or distributed state inconsistencies.
   - The code snippet MUST be syntactically valid and compile cleanly.
2. FRAMEWORK IDIOMS & MODERN SPECIFICATIONS:
   - Target Tech Stack: ${targetTechStackPrompt}
   - For Java 17/21 and Spring Boot 3.x, use exclusively the 'jakarta.*' namespace (NEVER 'javax.*' for persistence, validation, or servlet APIs).
   - Leverage modern idioms: Records, Pattern Matching, Sealed Interfaces, Virtual Thread considerations, and idiomatic annotations (@RequiredArgsConstructor, @Transactional, @Retryable, @Version).
3. PRODUCTION LORE GENERATION (Rich Enterprise Context):
   - systemName: Realistic enterprise microservice name (e.g., 'clearing-settlement-engine', 'order-routing-orchestrator', 'catalog-pricing-engine').
   - architectureType: Enterprise pattern (e.g., 'Transactional Outbox & Event-Driven', 'CQRS Read-Side Processor', 'Highload Ingress API').
   - incidentSymptoms: Precise telemetry and observability anomalies (e.g., 'p99 latency spike to 4500ms under 50k RPS, HikariCP connection starvation, Kafka lag accumulation, HTTP 504 at Ingress').
   - businessImpact: Measurable financial or organizational blast radius (e.g., 'Duplicate financial transactions, SLA breach fines, inventory ghost holds').
   - prReviewContext: Plausible developer explanation and rationale submitted in the pull request.
4. PROGRESSIVE HINTS:
   - Hint 1 (Direction): High-level architectural pointer directing attention to the affected subsystem.
   - Hint 2 (Localization): Pinpoints the precise component interaction, proxy boundary, or concurrency hazard.
   - Hint 3 (Solution mechanism): Concrete refactoring strategy or synchronization primitive required to resolve the issue.

${customInstructionsPrompt}

РЕЖИМ И СЛОЖНОСТЬ:
${bugCountInstruction}
${defectFocusInstruction}

================================================================================
OUTPUT ENFORCEMENT:
Emit a single, strictly conforming JSON object adhering to this schema:
{
  "title": "Краткое название кейса (например: 'Гонка состояний в обработчике платежей')",
  "subtopic": "Конкретная подтема (например: 'Concurrent Collections & Atomicity')",
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
    "incidentSymptoms": "Всплеск p99 latency с 15мс до 4200мс в Grafana, алерты Sentry на дублирование списаний баланса.",
    "businessImpact": "Дублирование финансовых транзакций у 2% клиентов в период пиковой распродажи.",
    "prReviewContext": "Коллега добавил локальное кэширование через ConcurrentHashMap, пытаясь снизить нагрузку на БД."
  },
  "codeSnippet": "исходный код с дефектом (16-28 строк) со стандартными переносами строк \\n",
  "bugExplanation": "Детерминированное объяснение низкоуровневой физики сбоя (JMM/Loom/AOP/ACID) с тремя обязательными секциями: (a) Первопричина и механизм, (b) Проявление под нагрузкой, (c) Надежный продакшен-фикс и почему наивные правки не работают",
  "fixedCode": "исправленная эталонная версия кода (16-28 строк)",
  "hints": [
    "Подсказка 1 (Направление): общее архитектурное указание",
    "Подсказка 2 (Локализация): конкретные строки и механизм сбоя",
    "Подсказка 3 (Решение): точный примитив или контракт для исправления"
  ],
  "keyTakeaways": [
    "Ключевой вывод 1 для собеседования",
    "Ключевой вывод 2 для собеседования",
    "Ключевой вывод 3 для собеседования"
  ]
}`;
}

export async function generateBugChallenge(params: GenerateBugChallengeParams): Promise<BugChallenge> {
  const endpointUrl = envConfig.proxy.chatUrl;
  const proxyApiKey = envConfig.proxy.apiKey;
  const modelName = envConfig.models.text;

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

  // Resolve target tech stack
  const stackProfileKey = params.techStackProfile || 'modern_cloud';
  let targetTechStackPrompt = TECH_STACK_ARCHETYPES[stackProfileKey]?.stackPrompt || TECH_STACK_ARCHETYPES.modern_cloud.stackPrompt;

  if (stackProfileKey === 'custom' && params.customTechStack) {
    targetTechStackPrompt = `Пользовательский стек: ${params.customTechStack}`;
  }

  const customInstructionsPrompt = params.customInstructions
    ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ПОЛЬЗОВАТЕЛЯ:\n${params.customInstructions}`
    : '';

  // Case 1: Topic-level bug hunt (from TopicSelector / Bug Hunt Arena)
  if (params.topicId && !params.questionId && !params.questionText) {
    const dbTopicName = TOPIC_MAP[params.topicId.toLowerCase()] || params.topicId;
    topicName = dbTopicName;

    try {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?');
      const totalRow = countStmt.get(dbTopicName) as { count: number };
      totalTopicQuestions = totalRow?.count || 0;

      // Handle Exhaustive Mode with excludeIds
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
        console.log(`🎉 Topic ${topicName} is 100% exhausted (${effectiveExclude.length}/${totalTopicQuestions})!`);
        return {
          id: `exhausted_${Date.now()}`,
          title: 'Тема полностью пройдена!',
          subtopic: topicName,
          language: 'java',
          codeSnippet: '// Все разделы темы успешно отработаны на 100%!',
          bugExplanation: 'Вы закрыли все подразделы и вопросы данной темы без повторов.',
          fixedCode: '// 100% Topic Mastery Achieved',
          hints: ['Тема завершена.'],
          isTopicExhausted: true,
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
  } 
  // Case 2: Question-specific bug hunt (from StudyDeck)
  else if (params.questionText || params.referenceAnswer) {
    contextInfo = `Конкретный вопрос темы: "${params.questionText || ''}"\nЭталонная теория:\n${params.referenceAnswer ? params.referenceAnswer.slice(0, 500) : ''}`;
    sampledQuestionId = params.questionId;
  } else if (params.questionId) {
    try {
      const qStmt = db.prepare('SELECT topic, question, answer FROM questions WHERE id = ?');
      const qRow = qStmt.get(params.questionId) as { topic: string; question: string; answer: string };
      if (qRow) {
        topicName = qRow.topic;
        contextInfo = `Конкретный вопрос темы: "${qRow.question}"\nЭталонная теория:\n${qRow.answer.slice(0, 500)}`;
        sampledQuestionId = params.questionId;
      }
    } catch (e) {
      console.warn('Could not fetch question from DB for bug hunt:', e);
    }
  }

  const isSeniorMulti = preset === 'senior_multi' || difficulty === 'senior';
  const bugCountInstruction = isSeniorMulti
    ? `Сгенерируй код уровня Senior/Lead/Staff с РОВНО 2 взаимосвязанными или скрытыми дефектами (например, concurrency race condition + пропуск отката транзакции при checked exception или carrier thread pinning).`
    : `Сгенерируй код с РОВНО 1 фундаментальной архитектурной, логической или concurrency ошибкой.`;

  const systemPrompt = buildBugChallengeSystemPrompt({
    targetTechStackPrompt,
    bugCountInstruction,
    defectFocusInstruction,
    customInstructionsPrompt,
    isSeniorMulti
  });

  const prompt = `Тема: ${topicName}
${contextInfo}

Сгенерируй реалистичную задачу на поиск бага (Production Incident Code Review Challenge) в строгом JSON-формате.`;

  try {
    console.log(`🐛 Generating bug challenge via LiteLLM Proxy [Model: ${modelName}, Topic: ${topicName}, Preset: ${preset}, Stack: ${stackProfileKey}, Diff: ${difficulty}]...`);
    
    const reasoningPayload = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: REASONING_PRESETS.deepIncidentSynthesis.temperature,
      max_tokens: REASONING_PRESETS.deepIncidentSynthesis.maxTokens,
      extra_body: buildReasoningExtraBody(REASONING_PRESETS.deepIncidentSynthesis)
    };

    let proxyRes: Response;
    try {
      proxyRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxyApiKey}`,
        },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify(reasoningPayload)
      });
    } catch (fetchErr: any) {
      if (endpointUrl.includes('host.docker.internal')) {
        const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
        console.log(`🔄 Retrying with local URL: ${localUrl}`);
        proxyRes = await fetch(localUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proxyApiKey}`,
          },
          signal: AbortSignal.timeout(90_000),
          body: JSON.stringify(reasoningPayload)
        });
      } else {
        throw fetchErr;
      }
    }

    if (!proxyRes.ok) {
      const errText = await proxyRes.text();
      throw new Error(`LiteLLM Proxy (${proxyRes.status}): ${errText}`);
    }

    const data = await proxyRes.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';
    let cleanedJson = rawContent.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (parseErr) {
      console.warn('JSON.parse failed on LLM output, extracting JSON block:', parseErr);
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw parseErr;
      }
    }

    const challengeId = `bug_${crypto.randomBytes(8).toString('hex')}`;

    const generatedChallenge: BugChallenge = {
      id: challengeId,
      topicId,
      topicName,
      title: parsed.title || 'Поиск ошибки в коде',
      subtopic: parsed.subtopic || topicName,
      language: parsed.language || 'java',
      codeSnippet: parsed.codeSnippet || '// Код недоступен',
      bugExplanation: parsed.bugExplanation || 'Неочевидная ошибка в логике работы компонента.',
      fixedCode: parsed.fixedCode || parsed.codeSnippet || '',
      hints: Array.isArray(parsed.hints) && parsed.hints.length > 0 
        ? parsed.hints 
        : ['Обратите внимание на взаимодействие потоков и синхронизацию.', 'Посмотрите на метод обновления состояния.'],
      categoryBadge: parsed.categoryBadge || '⚡ Concurrency',
      difficultyBadge: parsed.difficultyBadge || (isSeniorMulti ? 'Senior' : 'Middle'),
      keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : undefined,
      techStack: parsed.techStack || {
        language: 'Java 21',
        javaVersion: 'Java 21 LTS',
        framework: 'Spring Boot 3.4.x',
        keyLibraries: ['Spring WebMVC', 'PostgreSQL 16', 'Hibernate 6.6']
      },
      productionContext: parsed.productionContext || undefined,
      sampledQuestionId,
      isTopicExhausted: false,
      remainingCount,
      totalTopicQuestions
    };

    // Save to SQLite Persistent Problem Bank
    saveBugChallengeToDb(generatedChallenge, topicId, topicName, preset, difficulty);

    return generatedChallenge;
  } catch (err: any) {
    console.error('Error generating bug challenge via LiteLLM Proxy:', err);
    if (err instanceof LlmGatewayUnavailableError) {
      throw err;
    }
    const reason = err.name === 'TimeoutError' || err.message?.includes('timeout')
      ? 'upstream_timeout'
      : err.message?.includes('ECONNREFUSED') || err.message?.includes('Failed to fetch')
      ? 'proxy_unreachable'
      : err.message?.includes('429')
      ? 'rate_limit_exceeded'
      : 'proxy_unreachable';
    throw new LlmGatewayUnavailableError(reason, err.message);
  }
}
