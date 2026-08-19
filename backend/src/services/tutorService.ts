import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { TOPIC_MAP, TOPIC_DEFINITIONS } from './topics';

dotenv.config();

export interface BugChallenge {
  id: string;
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
}

const DEFECT_FOCUS_MAP: Record<string, string> = {
  concurrency: 'ФОКУС: Многопоточность, гонки состояний (Race Condition), видимость (Visibility/Volatile), блокировки (Deadlock/ReentrantLock), атомики и пулы потоков.',
  memory: 'ФОКУС: Утечки памяти (Memory Leaks), удержание ссылок (ThreadLocal, static collections), неэффективная сложность O(N^2) и перегрузка GC.',
  spring_aop: 'ФОКУС: Spring AOP прокси (Self-invocation bypass), жизненный цикл бинов (@PostConstruct/Prototype injection), распространение транзакций (@Transactional propagation/rollback on checked exceptions).',
  contracts: 'ФОКУС: Нарушение контрактов equals/hashCode, мутации неизменяемых коллекций, некорректные Comparator (compare == 0 vs equals), serialization traps.',
  all: 'ФОКУС: Любые фундаментальные архитектурные, логические, concurrency или транзакционные ловушки.'
};

export async function generateBugChallenge(params: GenerateBugChallengeParams): Promise<BugChallenge> {
  const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
  const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const endpointUrl = `${cleanProxyBase}/v1/chat/completions`;
  const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
  const modelName = process.env.GEMINI_TEXT_MODEL || 'gemini-smart';

  let topicName = params.topic || 'Java & Spring Framework';
  let contextInfo = '';
  let sampledQuestionId: string | undefined = undefined;
  let totalTopicQuestions = 0;
  let remainingCount = 0;

  const preset = params.workoutPreset || 'exhaustive';
  const difficulty = params.difficulty || (preset === 'senior_multi' ? 'senior' : 'middle');
  const defectFocusKey = params.defectFocus || 'all';
  const defectFocusInstruction = DEFECT_FOCUS_MAP[defectFocusKey] || DEFECT_FOCUS_MAP.all;

  // Case 1: Topic-level bug hunt (from TopicSelector)
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
    ? `Сгенерируй код уровня Senior/Lead с РОВНО 2 взаимосвязанными или тонко скрытыми дефектами (например, concurrency race condition + пропуск отката транзакции при checked exception).`
    : `Сгенерируй код с РОВНО 1 фундаментальной архитектурной, логической или concurrency ошибкой.`;

  const systemPrompt = `Ты Senior/Principal Java & Spring архитектор и автор технического код-ревью на собеседованиях.
Твоя задача — сгенерировать компактный (14-25 строк), реалистичный кусок кода (Java или Spring/SQL) с ошибкой для проведения устного Code Review.

РЕЖИМ И СЛОЖНОСТЬ:
${bugCountInstruction}
${defectFocusInstruction}

АНТИ-КЛИШЕ И ТРЕБОВАНИЯ К КАЧЕСТВУ (CRITICAL INVARIANTS):
1. Категорически ЗАПРЕЩЕНО использовать избитые учебные примеры:
   - Банальный ConcurrentModificationException в цикле for-each без глубоких нюансов.
   - Опечатку в сигнатуре equals (Object vs Type) без глубокого контекста хэш-таблиц.
   - Базовый non-thread-safe HashMap без реалистичного бизнес-сценария.
2. Код должен выглядеть как настоящий продакшен-сервис или компонент с чистым форматированием, реальными типами и правдоподобной логикой.
3. Обязательно дай 2 короткие подсказки (hints): Hint 1 направляет внимание на область, Hint 2 указывает на конкретные строки/механизм.
4. Приведи исправленный вариант кода (fixedCode).
5. Определи категорию бага (categoryBadge: "⚡ Concurrency" | "💾 Memory & GC" | "🍃 Spring AOP" | "📐 Contract Trap" | "🔒 Transactions").

Формат ответа — СТРОГО валидный JSON без markdown кавычек:
{
  "title": "Название кейса (например: 'Потокобезопасное обновление кэша заказов')",
  "subtopic": "Конкретная подтема (например: 'Concurrent Collections & Atomicity')",
  "categoryBadge": "⚡ Concurrency",
  "difficultyBadge": "${isSeniorMulti ? 'Senior' : 'Middle'}",
  "language": "java",
  "codeSnippet": "исходный код с дефектом (14-25 строк) со стандартными переносами строк \\n",
  "bugExplanation": "Четкое объяснение дефекта (или 2 дефектов), к чему это приведет в проде под нагрузкой и почему",
  "fixedCode": "исправленная версия кода (14-25 строк)",
  "hints": [
    "Подсказка 1: общее направление",
    "Подсказка 2: локализация строк и нюанс поведения"
  ]
}`;

  const prompt = `Тема: ${topicName}
${contextInfo}

Сгенерируй интересную задачу на поиск бага (Code Review Challenge).`;

  try {
    console.log(`🐛 Generating bug challenge via LiteLLM Proxy [Model: ${modelName}, Topic: ${topicName}, Preset: ${preset}, Diff: ${difficulty}]...`);
    
    let proxyRes: Response;
    try {
      proxyRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxyApiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.75
        })
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
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.75
          })
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
    const parsed = JSON.parse(rawContent);

    const challengeId = `bug_${crypto.randomBytes(8).toString('hex')}`;

    return {
      id: challengeId,
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
      sampledQuestionId,
      isTopicExhausted: false,
      remainingCount,
      totalTopicQuestions
    };
  } catch (err: any) {
    console.error('Error generating bug challenge:', err);
    // Safe graceful fallback if LLM has temporary hiccup
    return {
      id: `fallback_${Date.now()}`,
      title: isSeniorMulti ? 'Гонка состояний и утечка транзакции' : 'Гонка состояний в обработчике платежей',
      subtopic: topicName,
      language: 'java',
      codeSnippet: `@Service\npublic class PaymentService {\n    private final Map<String, Integer> balances = new HashMap<>();\n\n    @Transactional\n    public void addBalance(String userId, int amount) {\n        if (balances.containsKey(userId)) {\n            balances.put(userId, balances.get(userId) + amount);\n        } else {\n            balances.put(userId, amount);\n        }\n    }\n}`,
      bugExplanation: '1. Использование непотокобезопасного HashMap и составной неатомарной операции check-then-act приводит к потере данных при параллельных запросах.\n2. Аннотация @Transactional без thread-safe хранилища не защищает in-memory состояние.',
      fixedCode: `@Service\npublic class PaymentService {\n    private final ConcurrentMap<String, Integer> balances = new ConcurrentHashMap<>();\n\n    public void addBalance(String userId, int amount) {\n        balances.merge(userId, amount, Integer::sum);\n    }\n}`,
      hints: [
        'Подумайте, как поведет себя коллекция balances при одновременных запросах от разных потоков.',
        'Обратите внимание на строки с containsKey и put — операция не атомарна.'
      ],
      categoryBadge: '⚡ Concurrency',
      difficultyBadge: isSeniorMulti ? 'Senior' : 'Middle',
      sampledQuestionId,
      isTopicExhausted: false,
      remainingCount,
      totalTopicQuestions
    };
  }
}
