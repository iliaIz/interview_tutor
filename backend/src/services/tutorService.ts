import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { envConfig } from '../config/env';
import { TOPIC_MAP } from './topics';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
import { LlmGatewayUnavailableError } from './dynamicTaskGenerator';
import { callLiteLlmChat, parseJsonFromLlm } from './llmClient';

dotenv.config();

export interface TechStackInfo {
  language: string;
  javaVersion: string;
  framework: string;
  keyLibraries: string[];
}

export interface ProductionContext {
  systemName: string;
  architectureType: string;
  incidentSymptoms: string;
  businessImpact: string;
  prReviewContext: string;
}

export interface BugChallenge {
  id: string;
  topicId?: string;
  topicName?: string;
  title: string;
  subtopic: string;
  language: 'java' | 'sql' | 'kotlin';
  codeSnippet: string;
  bugExplanation: string;
  fixedCode: string;
  hints: string[];
  categoryBadge?: string;
  difficultyBadge?: string;
  sampledQuestionId?: string;
  isTopicExhausted?: boolean;
  remainingCount?: number;
  totalTopicQuestions?: number;
  isSolved?: boolean;
  lastScore?: number;
  lastFeedback?: string;
  keyTakeaways?: string[];
  techStack?: TechStackInfo;
  productionContext?: ProductionContext;
  createdAt?: string;
}

export interface GenerateBugChallengeParams {
  questionId?: string;
  topicId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  workoutPreset?: 'exhaustive' | 'senior_multi' | 'random';
  defectFocus?: string;
  difficulty?: 'middle' | 'senior';
  excludeIds?: string[];
  techStackProfile?: 'modern_cloud' | 'fintech_transactional' | 'enterprise_migration' | 'reactive_streaming' | 'custom';
  customTechStack?: string;
  customInstructions?: string;
}

export const TECH_STACK_ARCHETYPES: Record<string, { name: string; badge: string; description: string; stackPrompt: string }> = {
  modern_cloud: {
    name: 'Modern Cloud-Native',
    badge: '🚀 Loom & Spring 3.4+',
    description: 'Java 21 LTS, Spring Boot 3.4.x, Project Loom (Virtual Threads), PostgreSQL 16, Hibernate 6.6+, Kafka 3.8',
    stackPrompt: `Язык: Java 21 LTS. Фреймворк: Spring Boot 3.4.x / Spring Framework 6.2. Модель: Project Loom (Virtual Threads per Task). Персистентность: Spring Data JPA + Hibernate 6.6+, HikariCP, PostgreSQL 16. Брокер: Kafka 3.8 (KRaft). Метрики: Micrometer 1.14.`
  },
  fintech_transactional: {
    name: 'FinTech / Mission-Critical',
    badge: '💳 Outbox & ACID',
    description: 'Java 21 LTS, Spring Boot 3.4.x, Transactional Outbox, Debezium CDC, Redisson 3.35 Fenced Locks, PostgreSQL 16',
    stackPrompt: `Язык: Java 21 LTS. Фреймворк: Spring Boot 3.4.x. Персистентность: Spring Data JPA, PostgreSQL 16 (Repeatable Read / Serializable), Transactional Outbox. Распределенная синхронизация: Redisson 3.35 Fenced Locks. Брокер: Kafka EOS (Exactly-Once).`
  },
  enterprise_migration: {
    name: 'Enterprise Migration',
    badge: '🏛️ Boot 2.7 ➔ 3.x / Jakarta',
    description: 'Java 17 ➔ 21, Spring Boot 2.7.18 ➔ 3.4+, Jakarta EE 10/11 (jakarta.*), Hibernate 5.6 ➔ 6.6 (SQM), Flyway 10',
    stackPrompt: `Язык: Java 17/21. Фреймворк: Spring Boot 3.4.x (миграция с 2.7). Пространство имен: строго jakarta.* (Servlet, JPA, Validation). Персистентность: Hibernate 6.6 (Semantic Query Model SQM), Flyway 10. HTTP: RestClient / HttpComponentsClientHttpRequestFactory.`
  },
  reactive_streaming: {
    name: 'Highload Reactive',
    badge: '⚡ WebFlux & Netty',
    description: 'Java 21, Spring WebFlux, Project Reactor 3.6, Netty EventLoop, Spring Data R2DBC, Redis Reactive',
    stackPrompt: `Язык: Java 21. Фреймворк: Spring Boot 3.4.x WebFlux. Движок: Project Reactor 3.6 + Netty EventLoop. Персистентность: Spring Data R2DBC (PostgreSQL Driver), ReactiveRedisTemplate. Трассировка: Micrometer Reactor Context Propagation.`
  }
};

const DEFECT_FOCUS_MAP: Record<string, string> = {
  streams: 'ФОКУС: Java Streams API, Collectors null/collision safety, mapMulti vs flatMap (Zero-GC), Collectors.teeing, ForkJoinPool isolation, distinct/sorted stateful traps, Spliterators, sliding window collectors.',
  concurrency: 'ФОКУС: Многопоточность Java 21+, устранение Carrier Thread Pinning (synchronized -> ReentrantLock/StampedLock), ScopedValue vs ThreadLocal, JMM Release/Acquire fences на VarHandle, lock-free FieldUpdater, LongAdder, CompletableFuture DAGs.',
  testing: 'ФОКУС: Практическое тестирование и рефакторинг, Legacy Seams (Subclass & Override, Overloaded Constructor), Approval / Golden Master, JUnit 5 (@MethodSource, @TestFactory, Extensions), Mockito 5 (@MockitoBean, InOrder, mockStatic), Testcontainers (@ServiceConnection), ArchUnit и Pitest Mutation Score.',
  memory: 'ФОКУС: Утечки памяти (Memory Leaks / Metaspace), удержание ссылок (ThreadLocal, static collections), декартово произведение в Hibernate 6 и перегрузка GC.',
  spring_aop: 'ФОКУС: Spring AOP прокси (Self-invocation bypass), жизненный цикл бинов (@PostConstruct / Prototype injection), распространение транзакций (@Transactional propagation / rollback on checked exceptions).',
  contracts: 'ФОКУС: Нарушение контрактов equals/hashCode, мутации неизменяемых коллекций, некорректные Comparator (compare == 0 vs equals), serialization traps.',
  all: 'ФОКУС: Любые фундаментальные архитектурные, логические, Streams, Concurrency, Testing или транзакционные ловушки.'
};

/**
 * Saves or updates a bug challenge record in SQLite database
 */
function saveBugChallengeToDb(challenge: BugChallenge, topicId: string, topicName: string, preset: string, difficulty: string) {
  try {
    const stmt = db.prepare(`
      INSERT INTO bug_challenges (
        id, topic_id, topic_name, preset, difficulty, category_badge,
        title, subtopic, language, code_snippet, bug_explanation, fixed_code,
        hints_json, is_solved, last_score, last_feedback, key_takeaways_json,
        tech_stack_json, production_context_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        is_solved = COALESCE(excluded.is_solved, bug_challenges.is_solved),
        last_score = COALESCE(excluded.last_score, bug_challenges.last_score),
        last_feedback = COALESCE(excluded.last_feedback, bug_challenges.last_feedback),
        key_takeaways_json = COALESCE(excluded.key_takeaways_json, bug_challenges.key_takeaways_json),
        tech_stack_json = COALESCE(excluded.tech_stack_json, bug_challenges.tech_stack_json),
        production_context_json = COALESCE(excluded.production_context_json, bug_challenges.production_context_json),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      challenge.id,
      topicId,
      topicName,
      preset,
      difficulty,
      challenge.categoryBadge || '⚡ Concurrency',
      challenge.title,
      challenge.subtopic,
      challenge.language || 'java',
      challenge.codeSnippet,
      challenge.bugExplanation,
      challenge.fixedCode,
      JSON.stringify(challenge.hints || []),
      challenge.isSolved ? 1 : 0,
      challenge.lastScore || null,
      challenge.lastFeedback || null,
      challenge.keyTakeaways ? JSON.stringify(challenge.keyTakeaways) : null,
      challenge.techStack ? JSON.stringify(challenge.techStack) : null,
      challenge.productionContext ? JSON.stringify(challenge.productionContext) : null
    );
  } catch (err) {
    console.error('Error saving bug challenge to SQLite:', err);
  }
}

/**
 * Fetches saved challenges from SQLite for zero-latency, zero-cost problem bank replay
 */
export function getSavedBugChallenges(topicId?: string, filter: 'all' | 'unsolved' | 'solved' = 'all'): BugChallenge[] {
  try {
    let query = 'SELECT * FROM bug_challenges';
    const conditions: string[] = [];
    const params: any[] = [];

    if (topicId) {
      conditions.push('(topic_id = ? OR topic_name = ?)');
      params.push(topicId, topicId);
    }

    if (filter === 'unsolved') {
      conditions.push('(is_solved = 0 OR is_solved IS NULL)');
    } else if (filter === 'solved') {
      conditions.push('is_solved = 1');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      topicName: r.topic_name,
      title: r.title,
      subtopic: r.subtopic,
      language: r.language || 'java',
      codeSnippet: r.code_snippet,
      bugExplanation: r.bug_explanation,
      fixedCode: r.fixed_code,
      hints: r.hints_json ? JSON.parse(r.hints_json) : [],
      categoryBadge: r.category_badge,
      difficultyBadge: r.difficulty || 'Middle',
      isSolved: Boolean(r.is_solved),
      lastScore: r.last_score || undefined,
      lastFeedback: r.last_feedback || undefined,
      keyTakeaways: r.key_takeaways_json ? JSON.parse(r.key_takeaways_json) : undefined,
      techStack: r.tech_stack_json ? JSON.parse(r.tech_stack_json) : undefined,
      productionContext: r.production_context_json ? JSON.parse(r.production_context_json) : undefined,
      createdAt: r.created_at
    }));
  } catch (err) {
    console.error('Error fetching saved bug challenges:', err);
    return [];
  }
}

/**
 * Updates evaluation result and status for a bug challenge
 */
export function updateBugChallengeStatus(params: {
  challengeId: string;
  isSolved: boolean;
  score?: number;
  feedback?: string;
  keyTakeaways?: string[];
}): boolean {
  try {
    const stmt = db.prepare(`
      UPDATE bug_challenges
      SET is_solved = ?,
          last_score = COALESCE(?, last_score),
          last_feedback = COALESCE(?, last_feedback),
          key_takeaways_json = COALESCE(?, key_takeaways_json),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const res = stmt.run(
      params.isSolved ? 1 : 0,
      params.score ?? null,
      params.feedback ?? null,
      params.keyTakeaways ? JSON.stringify(params.keyTakeaways) : null,
      params.challengeId
    );
    return res.changes > 0;
  } catch (err) {
    console.error('Error updating bug challenge status:', err);
    return false;
  }
}

export async function generateBugChallenge(params: GenerateBugChallengeParams): Promise<BugChallenge> {
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

  const systemPrompt = `You are a Principal Systems Architect, Technical Interviewer, and Reliability Engineering Lead.
Your objective is to generate production-grade code debugging interview challenges based on real-world enterprise failures and post-mortems (2025-2026).

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
  "bugExplanation": "Глубокое объяснение механизма сбоя на уровне JVM/Spring/транзакций и почему это ломается под нагрузкой",
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

    const chatResult = await callLiteLlmChat(reasoningPayload, {
      timeoutMs: 90_000,
      maxRetries: 2
    });

    const parsed = parseJsonFromLlm(chatResult.content);

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
