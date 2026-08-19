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
}

interface GenerateBugChallengeParams {
  questionId?: string;
  topicId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
}

export async function generateBugChallenge(params: GenerateBugChallengeParams): Promise<BugChallenge> {
  const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
  const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const endpointUrl = `${cleanProxyBase}/v1/chat/completions`;
  const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
  const modelName = process.env.GEMINI_TEXT_MODEL || 'gemini-smart';

  let topicName = params.topic || 'Java & Spring Framework';
  let contextInfo = '';

  // Case 1: Topic-level bug hunt (from TopicSelector)
  if (params.topicId && !params.questionId && !params.questionText) {
    const dbTopicName = TOPIC_MAP[params.topicId.toLowerCase()] || params.topicId;
    topicName = dbTopicName;

    // Sample 5 random questions from this topic to guarantee diverse subtopics
    try {
      const sampleStmt = db.prepare('SELECT question FROM questions WHERE topic = ? ORDER BY RANDOM() LIMIT 5');
      const sampledRows = sampleStmt.all(dbTopicName) as { question: string }[];
      if (sampledRows && sampledRows.length > 0) {
        contextInfo = `Подтемы и концепции для вдохновения:\n` + sampledRows.map((r, i) => `- ${r.question}`).join('\n');
      }
    } catch (e) {
      console.warn('Could not sample questions from DB for topic bug hunt:', e);
    }
  } 
  // Case 2: Question-specific bug hunt (from StudyDeck)
  else if (params.questionText || params.referenceAnswer) {
    contextInfo = `Конкретный вопрос темы: "${params.questionText || ''}"\nЭталонная теория:\n${params.referenceAnswer ? params.referenceAnswer.slice(0, 500) : ''}`;
  } else if (params.questionId) {
    try {
      const qStmt = db.prepare('SELECT topic, question, answer FROM questions WHERE id = ?');
      const qRow = qStmt.get(params.questionId) as { topic: string; question: string; answer: string };
      if (qRow) {
        topicName = qRow.topic;
        contextInfo = `Конкретный вопрос темы: "${qRow.question}"\nЭталонная теория:\n${qRow.answer.slice(0, 500)}`;
      }
    } catch (e) {
      console.warn('Could not fetch question from DB for bug hunt:', e);
    }
  }

  const systemPrompt = `Ты Senior Java/Spring архитектор и автор технических задач на собеседованиях.
Твоя задача — сгенерировать компактный (12-25 строк), реалистичный кусок кода (Java или SQL/Spring) с РОВНО ОДНОЙ неочевидной архитектурной, логической или concurrency/transactional ошибкой (Bug / Pitfall / Gotcha).

Требования к коду:
1. Код должен выглядеть как реальный продакшен-код сервиса или компонента (чистый, с нормальным форматированием и типами).
2. Баг должен быть фундаментальным и жизненным (например: proxy bypass в @Transactional/@Async, race condition в check-then-act, утечка ThreadLocal, N+1/LazyInit в Hibernate, некорректный equals/hashCode, deadlock в локах, непойманный checked exception при откате транзакции, etc.).
3. Код должен компилироваться или быть синтаксически правдоподобным.
4. Обязательно дай 2 короткие подсказки (hints): Hint 1 направляет внимание на область, Hint 2 указывает на конкретные строки/механизм.
5. Приведи исправленный вариант кода (fixedCode).

Формат ответа — СТРОГО валидный JSON без markdown кавычек:
{
  "title": "Название кейса (например: 'Потокобезопасное обновление кэша заказов')",
  "subtopic": "Конкретная подтема (например: 'Concurrency & Atomic Operations')",
  "language": "java",
  "codeSnippet": "исходный код с багом (12-25 строк) со стандартными переносами строк \\n",
  "bugExplanation": "Четкое объяснение, в чем именно баг, к чему он приведет в проде под нагрузкой и почему",
  "fixedCode": "исправленная версия кода (12-25 строк)",
  "hints": [
    "Подсказка 1: общее направление",
    "Подсказка 2: локализация строк и нюанс поведения"
  ]
}`;

  const prompt = `Тема: ${topicName}
${contextInfo}

Сгенерируй интересную задачу на поиск бага (Code Review Challenge).`;

  try {
    console.log(`🐛 Generating bug challenge via LiteLLM Proxy [Model: ${modelName}, Topic: ${topicName}]...`);
    
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
          temperature: 0.7
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
            temperature: 0.7
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
        : ['Обратите внимание на взаимодействие потоков и синхронизацию.', 'Посмотрите на метод обновления состояния.']
    };
  } catch (err: any) {
    console.error('Error generating bug challenge:', err);
    // Safe graceful fallback if LLM has temporary hiccup
    return {
      id: `fallback_${Date.now()}`,
      title: 'Гонка состояний в обработчике платежей',
      subtopic: topicName,
      language: 'java',
      codeSnippet: `@Service\npublic class PaymentService {\n    private final Map<String, Integer> balances = new HashMap<>();\n\n    public void addBalance(String userId, int amount) {\n        if (balances.containsKey(userId)) {\n            balances.put(userId, balances.get(userId) + amount);\n        } else {\n            balances.put(userId, amount);\n        }\n    }\n}`,
      bugExplanation: 'Использование непотокобезопасного HashMap и составной неатомарной операции check-then-act приводит к race condition и потере данных при параллельных запросах.',
      fixedCode: `@Service\npublic class PaymentService {\n    private final ConcurrentMap<String, Integer> balances = new ConcurrentHashMap<>();\n\n    public void addBalance(String userId, int amount) {\n        balances.merge(userId, amount, Integer::sum);\n    }\n}`,
      hints: [
        'Подумайте, как поведет себя коллекция balances при одновременных запросах от разных потоков.',
        'Обратите внимание на строки с containsKey и put — операция не атомарна.'
      ]
    };
  }
}
