import { WebSocket, WebSocketServer, RawData } from 'ws';
import http from 'http';
import url from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { updateBugChallengeStatus } from './tutorService';
dotenv.config();

interface ProxySession {
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  isSetupComplete: boolean;
  frameQueue: Buffer[];
  questionId?: string;
  topic?: string;
  referenceAnswer?: string;
}

/**
 * Extracts up to 10 semantic evaluation anchors from reference answer
 */
function extractDefaultAnchors(referenceAnswer: string, questionText: string): string[] {
  if (!referenceAnswer || referenceAnswer.trim().length === 0) {
    return [
      'Понимание базового определения и терминологии',
      'Архитектурные компоненты и их назначение',
      'Практическое применение и примеры использования'
    ];
  }

  // Split by markdown lists, bullet points, newlines or semicolon
  const rawLines = referenceAnswer
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((l) => l.length > 10 && !l.startsWith('#') && !l.startsWith('```'));

  if (rawLines.length >= 2) {
    return rawLines.slice(0, 10);
  }

  // Fallback: split by sentences
  const sentences = referenceAnswer
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length >= 2) {
    return sentences.slice(0, 10);
  }

  return [referenceAnswer.slice(0, 120)];
}

export function buildSystemPrompt(params: {
  topic: string;
  questionText: string;
  referenceAnswer: string;
  strategy: 'adaptive_probing' | 'socratic_tutoring';
  voiceName: string;
  maxProbes: number;
  anchors: string[];
  deepDive?: boolean;
  liveCoaching?: boolean;
  customPromptOverride?: string;
  questionIndex?: number;
  totalQuestions?: number;
  sessionType?: 'interview' | 'tutor';
  tutorMode?: 'deep_dive' | 'free_chat' | 'socratic' | 'eli5' | 'quick_qa' | 'bug_hunt';
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  hints?: string[];
}): string {
  const {
    topic,
    questionText,
    referenceAnswer,
    strategy,
    voiceName,
    maxProbes,
    anchors,
    deepDive,
    liveCoaching,
    customPromptOverride,
    questionIndex,
    totalQuestions,
    sessionType,
    tutorMode,
    bugTitle,
    bugExplanation,
    codeSnippet,
    hints
  } = params;

  const isFemale = ['Kore', 'Aoede'].includes(voiceName);
  const genderRule = isFemale
    ? 'ГРАММАТИЧЕСКИЙ РОД (СТРОГО ЖЕНСКИЙ): У тебя женский голос. Обязательно используй ЖЕНСКИЕ окончания в глаголах и формах от первого лица: «Я готова», «Я внимательно выслушала», «Я рада», «Я хотела бы уточнить». Категорически запрещено использовать мужские окончания («готов», «слушал», «рад»).'
    : 'ГРАММАТИЧЕСКИЙ РОД (СТРОГО МУЖСКОЙ): У тебя мужской голос. Обязательно используй МУЖСКИЕ окончания в глаголах и формах от первого лица: «Я готов», «Я внимательно выслушал», «Я рад», «Я хотел бы уточнить». Категорически запрещено использовать женские окончания («готова», «слушала», «рада»).';

  // === TUTOR SESSION LOGIC (Study Card / Bug Hunt Arena) ===
  if (sessionType === 'tutor') {
    if (tutorMode === 'bug_hunt') {
      return `=== 1. РОЛЬ: SENIOR ТЕХЛИД И НАСТАВНИК ПО CODE REVIEW ===
Ты опытный, доброжелательный ${isFemale ? 'техлид (женщина)' : 'техлид (мужчина)'}. Ты проводишь с кандидатом интерактивное устное код-ревью.
${genderRule}

=== 2. КОНТЕКСТ ЗАДАЧИ НА ЭКРАНЕ ===
ТЕМА: ${topic}
НАЗВАНИЕ КЕЙСА: "${bugTitle || 'Поиск ошибки в коде'}"
СУТЬ БАГА (ДЛЯ ТВОЕГО ЗНАНИЯ, НЕ СПОЙЛЕРИ СРАЗУ):
"""
${bugExplanation || 'Неочевидный баг в многопоточности, транзакциях или структурах данных.'}
"""

КОД НА ЭКРАНЕ:
\`\`\`
${codeSnippet || '// Код задачи'}
\`\`\`

ПОДСКАЗКИ:
${(hints || []).map((h, i) => `[Уровень ${i + 1}] ${h}`).join('\n')}

=== 3. ПРАВИЛА ГОЛОСОВОГО ОБЩЕНИЯ (CRITICAL AUDIO INVARIANTS) ===
1. КРАТКОСТЬ: Твои устные реплики должны быть краткими — СТРОГО 2-3 предложения (до 25-30 слов). Никаких длинных монологов!
2. НЕ ЗАЧИТЫВАЙ КОД ГОЛОСОМ: Кандидат видит код на экране. Ссылайся на строки («Посмотри на 12-ю строку...», «Обрати внимание на метод save...»).
3. ПРИВЕТСТВИЕ: В начале диалога поприветствуй кандидата и задай вопрос: «Привет! Посмотри на код задачи «${bugTitle || 'на экране'}». Здесь есть неочевидная проблема. Что пойдет не так под нагрузкой?»
4. НАСТАВНИЧЕСТВО:
   - Если кандидат нашел второстепенную проблему: мягко подтверди и направь на корневой баг (подсказка 1).
   - Если кандидат застрял или просит подсказку: дай компактную подсказку (подсказка 1 или 2).
   - Если кандидат точно нашел ошибку и объяснил причину: похвали, в 1-2 предложениях резюмируй правильный фикс и вызови функцию \`mark_bug_solved(isSolved=true, feedback="...", keyInsight="...")\`.`;
    }

    if (tutorMode === 'free_chat') {
      return `=== 1. РОЛЬ: SENIOR ТЕХЛИД И ДРУЖЕЛЮБНЫЙ НАПАРНИК (СВОБОДНЫЙ ДИАЛОГ) ===
Ты доброжелательный, высококвалифицированный Senior Java/Spring архитектор ${isFemale ? '(женщина)' : '(мужчина)'} и напарник по парному программированию.
${genderRule}

[КОНТЕКСТ ОБСУЖДЕНИЯ]
ТЕМА: ${topic || 'Java & Spring'}
${questionText ? `ВОПРОС: "${questionText}"` : ''}
${referenceAnswer ? `ЭТАЛОННАЯ ТЕОРИЯ:\n"""\n${referenceAnswer.slice(0, 800)}\n"""` : ''}
${bugTitle ? `КЕЙС КОДА: "${bugTitle}"` : ''}
${codeSnippet ? `КОД НА ЭКРАНЕ:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ''}

=== ПРАВИЛА СВОБОДНОГО ДИАЛОГА (CRITICAL INVARIANTS) ===
1. БЕЗ ЭКЗАМЕНАЦИОННЫХ РАМОК И ЗАГАДОК: Кандидат пришел просто посоветоваться или спросить о непонятной детали.
2. ПРЯМЫЕ И ЧЕТКИЕ ОТВЕТЫ: Если кандидат спрашивает «как это работает?», «почему тут ошибка?» или «объясни 10-ю строку» — отвечай прямо, дружелюбно, профессионально и по существу, приводя лучшие инженерные практики.
3. КРАТКОСТЬ УСТНОЙ РЕЧИ: Отвечай емко (2-4 предложения за раз), без бесконечных академических лекций.
4. ПОДДЕРЖКА: Всегда поддерживай, подбадривай и помогай досконально понять концепцию.`;
    }

    if (tutorMode === 'deep_dive') {
      return `=== 1. РОЛЬ: DEEP-DIVE AI-ТЬЮТОР (ПОД КАПОТ JVM / SPRING) ===
Ты глубокий технический эксперт ${isFemale ? '(женщина)' : '(мужчина)'} по Java, JVM internals, Spring Framework, многопоточности и базам данных.
${genderRule}

[КОНТЕКСТ КАРТОЧКИ]
ВОПРОС: "${questionText}"
ЭТАЛОННЫЙ ОТВЕТ:
"""
${referenceAnswer}
"""

=== ПРАВИЛА ДИАЛОГА ===
1. Твоя цель — отвечать на вопросы кандидата и раскрывать «что происходит под капотом» (байткод, прокси, AOP, сборка мусора, JMM, структуры данных, системные вызовы).
2. КРАТКОСТЬ УСТНОЙ РЕЧИ: Отвечай 2-3 емкими предложениями за раз. Заканчивай мини-вопросом или предложением углубиться («Хочешь разобрать, как это устроено в памяти?»).
3. НЕ ЗАЧИТЫВАЙ длинные простыни текста. Веди живую, интерактивную беседу.`;
    }

    if (tutorMode === 'socratic') {
      return `=== 1. РОЛЬ: СОКРАТИЧЕСКИЙ МЕНТОР ===
Ты доброжелательный наставник ${isFemale ? '(женщина)' : '(мужчина)'}. Твоя цель — не давать готовых ответов, а короткими наводящими вопросами помогать кандидату самостоятельно дойти до истины.
${genderRule}

[КОНТЕКСТ ВОПРОСА]
ВОПРОС: "${questionText}"
ЭТАЛОН:
"""
${referenceAnswer}
"""

=== ПРАВИЛА ===
1. Никогда не выпаливай готовое решение сразу.
2. Задавай 1 короткий наводящий вопрос в ответ на реплику кандидата.
3. Длина ответа: строго 1-2 предложения.`;
    }

    if (tutorMode === 'eli5') {
      return `=== 1. РОЛЬ: ELI5 ТЬЮТОР (ПРОСТЫМИ СЛОВАМИ И АНАЛОГИЯМИ) ===
Ты умеешь объяснять сложнейшие концепции архитектуры, многопоточности и баз данных на простых жизненных аналогиях (как библиотекарь, кассир в банке, почтальон).
${genderRule}

[КОНТЕКСТ]
ВОПРОС: "${questionText}"
ЭТАЛОН:
"""
${referenceAnswer}
"""

=== ПРАВИЛА ===
1. Используй яркую и понятную бытовую аналогию.
2. Без заумного академизма и перегруженного синтаксиса.
3. Длина: 2-3 коротких предложения.`;
    }

    // Default tutor mode: quick_qa
    return `=== 1. РОЛЬ: ЭКСПРЕСС-КОНСУЛЬТАНТ (QUICK Q&A) ===
Ты лаконичный и точный технический консультант ${isFemale ? '(женщина)' : '(мужчина)'}.
${genderRule}

[КОНТЕКСТ]
ВОПРОС: "${questionText}"
ЭТАЛОН:
"""
${referenceAnswer}
"""

=== ПРАВИЛА ===
1. Отвечай прямо, точно и без лишней «воды».
2. Длина ответа: строго 2 предложения.`;
  }

  // === INTERVIEW SESSION LOGIC (FAANG Mock Assessment) ===
  const batchContext = (totalQuestions && totalQuestions > 1)
    ? `=== КОНТЕКСТ СЕРИИ ВОПРОСОВ (HANDS-FREE MOCK INTERVIEW) ===
Ты проводишь серию вопросов (вопрос ${(questionIndex ?? 0) + 1} из ${totalQuestions}).
${((questionIndex ?? 0) + 1 < totalQuestions)
  ? 'В финале текущего ответа кратко подведи итог и вызови submit_interview_evaluation. НЕ прощайся окончательно, так как сразу последует следующий вопрос темы.'
  : 'Это заключительный вопрос серии. После вызова submit_interview_evaluation поблагодари за всё пройденное собеседование.'}
`
    : '';

  // Deep-dive & Scope modifier instructions
  const deepDiveInstruction = deepDive
    ? `=== РЕЖИМ ЗОНДИРОВАНИЯ: ГЛУБОКОЕ ЗОНДИРОВАНИЕ (DEEP-DIVE & UNDER-THE-HOOD) [ВКЛЮЧЕН] ===
Ты НЕ ограничен только формулировкой эталонного ответа. Твоя цель — исследовать реальную глубину знаний кандидата:
1. Если кандидат уверенно отвечает, копай глубже под капот (low-level механизмы, прокси, рефлексия, многопоточность, транзакции, память).
2. Задавай вопросы на краевые случаи (Edge Cases) и смежные концепции 1-го круга смежности (Radius-1: AOP, JDBC, Concurrency, Virtual Threads).
3. Проверяй понимание («А что произойдет, если...?», «Почему именно такой подход, а не альтернативный?»).
4. Правило возврата (Breadcrumb): не уходи глубже 2 шагов в одну подтему — кратко резюмируй и возвращайся к основному контексту вопроса темы.`
    : `=== РЕЖИМ ЗОНДИРОВАНИЯ: СТАНДАРТНЫЙ СКОУП (ПО ЭТАЛОНУ) ===
Твои ожидания и вопросы СТРОГО ограничены фактурой из ЭТАЛОННОГО ОТВЕТА. Не уходи в оффтоп и далекие смежные технологии, которых нет в эталоне.`;

  // Live Coaching modifier instructions
  const liveCoachingInstruction = liveCoaching
    ? `=== РЕЖИМ ОБУЧЕНИЯ: РАЗБОР ОШИБОК И ОБУЧЕНИЕ НА ЛЕТУ (LIVE COACHING) [ВКЛЮЧЕН] ===
Если кандидат допускает неточность, ошибку, говорит «Не знаю / не помню / подскажи / как правильно» или застрял:
1. Мягко поддержи и переключись в режим наставника.
2. Дай емкое, живое 30-секундное объяснение по правилу Micro-Lecture:
   - [Суть в 1 предложение]: ключевое определение простыми словами.
   - [Механизм под капотом]: как это физически устроено в рантайме.
   - [«Золотая фраза для собеседования»]: точная формулировка, которую ценят Senior-интервьюеры.
3. Запусти Active Recall (закрепление): сразу задай один мини-вопрос на понимание («Уловила суть? Попробуй теперь сформулировать, почему...?»).
4. В итоговой оценке (submit_interview_evaluation) обязательно отметь, что материал был успешно усвоен в процессе диалога.`
    : `=== РЕЖИМ ОЦЕНКИ: ВАЛИДАЦИЯ БЕЗ ПОДСКАЗОК ===
Не раскрывай готовых решений и эталонных ответов до момента завершения диалога.`;

  if (customPromptOverride && customPromptOverride.trim().length > 20) {
    return `${customPromptOverride.trim()}

${genderRule}

${deepDiveInstruction}

${liveCoachingInstruction}

[КОНТЕКСТ ВОПРОСА]
ВОПРОС: "${questionText}"
ЭТАЛОННЫЙ ОТВЕТ:
${referenceAnswer}

ЧЕК-ЛИСТ КРИТЕРИЕВ:
${anchors.map((a, i) => `[${i + 1}] ${a}`).join('\n')}

[ФИНАЛИЗАЦИЯ]
По окончании собеседования обязательно скажи краткое устное резюме и вызови функцию submit_interview_evaluation.`;
  }

  const anchorsFormatted = anchors.map((a, i) => `  [Критерий ${i + 1}] ${a}`).join('\n');

  if (strategy === 'socratic_tutoring') {
    return `=== 1. РОЛЬ, ИДЕНТИЧНОСТЬ И СТИЛЬ (TOP INVARIANTS) ===
Ты поддерживающий, доброжелательный и опытный ${isFemale ? 'ментор (женщина)' : 'ментор (мужчина)'} по теме «${topic}».
${genderRule}

${batchContext}

${deepDiveInstruction}

${liveCoachingInstruction}

=== 2. КОНТЕКСТНАЯ ФАКТУРА ТЕМЫ (CONTEXT PAYLOAD) ===
ВОПРОС ТЕМЫ: "${questionText || 'Расскажите о вашем опыте в разработке'}"

ЭТАЛОННЫЙ ОТВЕТ:
"""
${referenceAnswer || 'Точный и структурированный ответ с ключевыми концепциями.'}
"""

ЧЕК-ЛИСТ КЛЮЧЕВЫХ КРИТЕРИЕВ:
${anchorsFormatted}

=== 3. ОПЕРАЦИОННЫЙ СЦЕНАРИЙ ДИАЛОГА (EXECUTION RULES) ===
1. ПРИВЕТСТВИЕ: В самом начале сессии тепло поздоровайся одной фразой и четко зачитай вопрос темы.
2. ВНИМАТЕЛЬНОЕ СЛУШАНИЕ: Дай кандидату спокойно высказаться.
3. РЕАКЦИЯ НА МЕТА-РЕПЛИКИ:
   - Если кандидат говорит «Повтори вопрос», «Не расслышала» — вежливо и четко повтори вопрос.
   - Если кандидат просит помощи — следуй правилам режима Live Coaching выше.
4. СОКРАТИЧЕСКОЕ ЗОНДИРОВАНИЕ:
   - Если кандидат раскрыл только часть критериев — задай наводящий вопрос (лимит: не более ${maxProbes} раундов).
   - Если кандидат своими словами раскрыл суть — поблагодари за отличный ответ и переходи к финалу.
5. ФИНАЛИЗАЦИЯ И ОЦЕНКА:
   - Когда аспекты разобраны или кандидат завершил ответ:
     а) ОБЯЗАТЕЛЬНО сначала произнеси вслух теплое устное резюме (2-3 предложения): похвали за верные мысли, отметь зоны роста и скажи «Сейчас зафиксирую результаты и сформирую оценку».
     б) И только затем вызови функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;
  }

  // Default: adaptive_probing (FAANG Standard Technical Assessment)
  return `=== 1. РОЛЬ, ИДЕНТИЧНОСТЬ И СТИЛЬ (TOP INVARIANTS) ===
Ты профессиональный, объективный и доброжелательный Senior/Lead технический ${isFemale ? 'интервьюер (женщина)' : 'интервьюер (мужчина)'} по теме «${topic}».
${genderRule}

${batchContext}

${deepDiveInstruction}

${liveCoachingInstruction}

=== 2. КОНТЕКСТНАЯ ФАКТУРА ТЕМЫ (CONTEXT PAYLOAD) ===
ВОПРОС ТЕМЫ: "${questionText || 'Расскажите о вашем опыте в backend-разработке'}"

ЭТАЛОННЫЙ ОТВЕТ:
"""
${referenceAnswer || 'Точный и структурированный ответ с ключевыми концепциями.'}
"""

ЧЕК-ЛИСТ КЛЮЧЕВЫХ КРИТЕРИЕВ:
${anchorsFormatted}

=== 3. ОПЕРАЦИОННЫЙ СЦЕНАРИЙ ДИАЛОГА (EXECUTION RULES) ===
1. ПРИВЕТСТВИЕ: В начале сессии кратко и вежливо поприветствуй кандидата и четко озвучь вопрос темы.
2. ЗОНДИРОВАНИЕ И FOLLOW-UP:
   - Внимательно сопоставляй ответ кандидата с критериями темы.
   - Задавай точечные вопросы по недостающим пунктам или углубляйся под капот (лимит раундов: до ${maxProbes}).
   - Если кандидат говорит «Не знаю / не помню» — при включенном Live Coaching помоги и объясни, иначе зафиксируй пробел и переходи дальше.
3. ФИНАЛИЗАЦИЯ И ВЕРДИКТ:
   - Когда ключевые вопросы обсуждены, исчерпан лимит ${maxProbes} раундов или кандидат завершил ответ:
     а) ОБЯЗАТЕЛЬНО сначала произнеси вслух четкое устное резюме (2-3 предложения): оцени полноту ответа и скажи «Спасибо за ответ! Сейчас зафиксирую результаты и выставлю оценку».
     б) И только затем вызови функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;
}

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (clientSocket: WebSocket, req: http.IncomingMessage) => {
    console.log('🎙️ Client connected to Live Audio WS Proxy');

    const parsedUrl = url.parse(req.url || '', true);
    const query = parsedUrl.query;

    const sessionType = ((query.sessionType as string) === 'tutor' ? 'tutor' : 'interview') as 'interview' | 'tutor';
    const tutorMode = (query.tutorMode as any) || 'deep_dive';
    const bugTitle = (query.bugTitle as string) || '';
    const bugExplanation = (query.bugExplanation as string) || '';
    const codeSnippet = (query.codeSnippet as string) || '';
    let parsedHints: string[] = [];
    if (query.hints) {
      try {
        const h = JSON.parse(query.hints as string);
        if (Array.isArray(h)) parsedHints = h.map(String);
      } catch {}
    }

    const questionId = (query.questionId as string) || '';
    const topic = (query.topic as string) || 'Java & Spring Framework';
    const questionText = (query.questionText as string) || '';
    const referenceAnswer = (query.referenceAnswer as string) || '';
    const voiceName = (query.voice as string) || 'Kore';
    const strategy = ((query.strategy as string) === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing') as 'adaptive_probing' | 'socratic_tutoring';
    const maxProbes = Math.max(1, Math.min(5, parseInt((query.maxProbes as string) || '3', 10) || 3));
    const deepDive = query.deepDive === 'true';
    const liveCoaching = query.liveCoaching === 'true';
    const customPromptOverride = (query.customPrompt as string) || '';
    const questionIndex = Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0);
    const totalQuestions = Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1);

    let customAnchors: string[] = [];
    if (query.customAnchors) {
      try {
        const parsed = JSON.parse(query.customAnchors as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customAnchors = parsed.slice(0, 10).map((a) => String(a).trim()).filter((a) => a.length > 0);
        }
      } catch {}
    }

    const anchors = customAnchors.length > 0 ? customAnchors : extractDefaultAnchors(referenceAnswer, questionText);

    const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
    const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
    
    const liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-live';

    const cleanProxyWs = rawProxyUrl.replace(/^http/, 'ws').replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}`;
    console.log(`⚡ Connecting to Upstream Gemini Live WS (${upstreamWsUrl}) [Type: ${sessionType}, Mode: ${tutorMode}, Voice: ${voiceName}]...`);

    const geminiSocket = new WebSocket(upstreamWsUrl);
    let greetingWatchdog: NodeJS.Timeout | null = null;

    const session: ProxySession = {
      clientSocket,
      geminiSocket,
      isSetupComplete: false,
      frameQueue: [],
      questionId,
      topic,
      referenceAnswer
    };

    const systemPromptText = buildSystemPrompt({
      topic,
      questionText,
      referenceAnswer,
      strategy,
      voiceName,
      maxProbes,
      anchors,
      deepDive,
      liveCoaching,
      customPromptOverride,
      questionIndex,
      totalQuestions,
      sessionType,
      tutorMode,
      bugTitle,
      bugExplanation,
      codeSnippet,
      hints: parsedHints
    });

    const toolDeclarations: any[] = [
      {
        name: 'submit_interview_evaluation',
        description: 'Сохранить итоговую оценку, баллы и рекомендации по устному ответу кандидата',
        parameters: {
          type: 'OBJECT',
          properties: {
            score: { type: 'NUMBER', description: 'Балл от 0 до 100' },
            isPassed: { type: 'BOOLEAN', description: 'true если score >= 70, иначе false' },
            positivePoints: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Список того, что кандидат ответил точно и правильно'
            },
            missingPoints: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Список важных терминов или концепций, которые кандидат упустил'
            },
            spokenFeedback: {
              type: 'STRING',
              description: 'Краткое текстовое резюме для озвучивания и карточки отчета'
            }
          },
          required: ['score', 'isPassed', 'positivePoints', 'missingPoints', 'spokenFeedback']
        }
      }
    ];

    if (sessionType === 'tutor') {
      toolDeclarations.push({
        name: 'mark_bug_solved',
        description: 'Зафиксировать успешное нахождение и объяснение бага кандидатом',
        parameters: {
          type: 'OBJECT',
          properties: {
            isSolved: { type: 'BOOLEAN', description: 'true если баг найден и объяснен' },
            feedback: { type: 'STRING', description: 'Краткая похвала и подтверждение' },
            keyInsight: { type: 'STRING', description: 'Ключевая мысль фикса' }
          },
          required: ['isSolved', 'feedback', 'keyInsight']
        }
      });
    }

    const setupMessage = {
      setup: {
        model: `models/${liveModel}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'].includes(voiceName) ? voiceName : 'Kore'
              }
            }
          },
          temperature: sessionType === 'tutor' ? 0.3 : (strategy === 'socratic_tutoring' ? 0.4 : 0.2)
        },
        systemInstruction: {
          parts: [{ text: systemPromptText }]
        },
        tools: [
          {
            functionDeclarations: toolDeclarations
          }
        ]
      }
    };

    geminiSocket.on('open', () => {
      console.log(`✅ Connected to Upstream Gemini Live WS (${liveModel}), sending setup frame...`);
      geminiSocket.send(JSON.stringify(setupMessage));
    });

    geminiSocket.on('message', (data: RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const str = buffer.toString();
      let isToolCallProcessed = false;

      try {
        const parsed = JSON.parse(str);

        // Handle setupComplete from Google Gemini
        if (parsed.setupComplete) {
          session.isSetupComplete = true;
          console.log(`🎉 Upstream setupComplete received (Type: ${sessionType})! Sending greeting trigger...`);

          let greetingText = '';
          if (sessionType === 'tutor') {
            if (tutorMode === 'bug_hunt') {
              greetingText = `Привет! Я смотрю на задачу на экране «${bugTitle || 'Code Review'}». Поприветствуй меня в 1 коротком предложении и спроси, в чем здесь ошибка.`;
            } else if (tutorMode === 'deep_dive') {
              greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 предложении и предложи разобрать любые тонкости или устройство под капотом.`;
            } else if (tutorMode === 'socratic') {
              greetingText = `Привет! Я готов разобрать вопрос «${questionText || topic}». Задай мне первый наводящий вопрос.`;
            } else if (tutorMode === 'eli5') {
              greetingText = `Привет! Объясни мне суть вопроса «${questionText || topic}» на простой жизненной аналогии.`;
            } else {
              greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 короткой фразе.`;
            }
          } else {
            const isSubsequent = questionIndex > 0;
            greetingText = isSubsequent
              ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой-переходом подтверди прогресс и четко зачитай следующий технический вопрос: "${questionText || 'Следующий вопрос темы'}"`
              : `Привет! Я готова к собеседованию. Поприветствуй меня одной фразой и четко зачитай технический вопрос: "${questionText || 'Расскажи о себе и опыте в Java'}"`;
          }

          const initialGreetingTurn = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: greetingText
                    }
                  ]
                }
              ],
              turnComplete: true
            }
          };

          if (geminiSocket.readyState === WebSocket.OPEN) {
            geminiSocket.send(JSON.stringify(initialGreetingTurn));
          }

          // Watchdog
          if (greetingWatchdog) clearTimeout(greetingWatchdog);
          greetingWatchdog = setTimeout(() => {
            if (geminiSocket.readyState === WebSocket.OPEN) {
              console.log(`⏱️ Watchdog triggered: sending greeting nudge...`);
              const nudgeTurn = {
                clientContent: {
                  turns: [
                    {
                      role: 'user',
                      parts: [
                        {
                          text: sessionType === 'tutor'
                            ? (tutorMode === 'bug_hunt' ? 'Начни устное код-ревью в 1 короткой фразе.' : 'Начни диалог тьютора в 1 короткой фразе.')
                            : `Пожалуйста, начни диалог прямо сейчас: поприветствуй кандидата и четко зачитай вопрос: "${questionText || 'Вопрос темы'}"`
                        }
                      ]
                    }
                  ],
                  turnComplete: true
                }
              };
              try {
                geminiSocket.send(JSON.stringify(nudgeTurn));
              } catch (nudgeErr) {
                console.warn('Watchdog nudge send warning:', nudgeErr);
              }
            }
          }, 3500);

          // Drain queued frames
          while (session.frameQueue.length > 0) {
            const frame = session.frameQueue.shift();
            if (frame && geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(frame);
            }
          }

          // Notify client
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'setupComplete' }));
          }
        }

        // Clear watchdog as soon as model starts responding
        if (parsed.serverContent?.modelTurn) {
          if (greetingWatchdog) {
            clearTimeout(greetingWatchdog);
            greetingWatchdog = null;
          }
        }

        // Handle Function Calling / toolCall
        if (parsed.toolCall?.functionCalls) {
          console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(parsed.toolCall.functionCalls));

          for (const call of parsed.toolCall.functionCalls) {
            if (call.name === 'mark_bug_solved') {
              isToolCallProcessed = true;
              const args = call.args || {};
              const isSolved = args.isSolved ?? true;
              const feedback = args.feedback || 'Отлично! Ошибка найдена верно.';
              const keyInsight = args.keyInsight || '';

              console.log(`🎯 Bug challenge marked as solved: ${feedback}`);

              const toolResponse = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: {
                        status: 'SUCCESS',
                        message: 'Баг подтвержден как решенный.'
                      }
                    }
                  ]
                }
              };

              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(toolResponse));
              }

              if (session.questionId) {
                try {
                  updateBugChallengeStatus({
                    challengeId: session.questionId,
                    isSolved: Boolean(isSolved),
                    score: isSolved ? 10 : 5,
                    feedback: feedback,
                    keyTakeaways: keyInsight ? [keyInsight] : undefined
                  });
                } catch (e) {
                  console.warn('Could not update bug challenge status in db:', e);
                }
              }

              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'bug_solved',
                  payload: {
                    isSolved,
                    feedback,
                    keyInsight
                  }
                }));
              }
            } else if (call.name === 'submit_interview_evaluation') {
              isToolCallProcessed = true;
              const args = call.args || {};
              const score = typeof args.score === 'number' ? args.score : 75;
              const isPassed = args.isPassed ?? (score >= 70);
              const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
              const missingPoints = Array.isArray(args.missingPoints) ? args.missingPoints : [];
              const feedback = args.spokenFeedback || args.feedback || 'Ответ принят.';

              let savedEvalId = '';
              if (session.questionId) {
                try {
                  savedEvalId = crypto.randomBytes(16).toString('hex');
                  const stmt = db.prepare(`
                    INSERT INTO question_evaluations (
                      id, question_id, topic, mode, score, is_passed,
                      positive_points, missing_points, feedback, user_answer,
                      transcript, audio_metrics, created_at, updated_at
                    ) VALUES (
                      @id, @question_id, @topic, @mode, @score, @is_passed,
                      @positive_points, @missing_points, @feedback, @user_answer,
                      @transcript, @audio_metrics, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                  `);

                  stmt.run({
                    id: savedEvalId,
                    question_id: session.questionId,
                    topic: session.topic || 'General',
                    mode: 'voice',
                    score,
                    is_passed: isPassed ? 1 : 0,
                    positive_points: JSON.stringify(positivePoints),
                    missing_points: JSON.stringify(missingPoints),
                    feedback,
                    user_answer: 'Устный ответ в Gemini Live',
                    transcript: '',
                    audio_metrics: null
                  });
                  console.log(`💾 Live evaluation saved to DB: ${savedEvalId} (Score: ${score})`);
                } catch (dbErr) {
                  console.error('Error saving Live evaluation to DB:', dbErr);
                }
              }

              // Send toolResponse back to Gemini Live
              const toolResponse = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: {
                        status: 'COMMITTED',
                        evaluationId: savedEvalId,
                        message: 'Оценка сохранена.'
                      }
                    }
                  ]
                }
              };

              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(toolResponse));
              }

              // Notify frontend client with evaluation data
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'evaluation_completed',
                  evaluation: {
                    id: savedEvalId,
                    score,
                    isPassed,
                    positivePoints,
                    missingPoints,
                    feedback,
                    spokenFeedback: feedback
                  }
                }));
              }

              if (sessionType !== 'tutor') {
                console.log('🔒 Evaluation delivered. Closing upstream Gemini WS to stop further AI speech.');
                try {
                  if (geminiSocket.readyState === WebSocket.OPEN) {
                    geminiSocket.close();
                  }
                } catch (closeErr) {
                  console.warn('Error closing upstream WS post-evaluation:', closeErr);
                }
              }
            }
          }
        }
      } catch (e) {
        // Non-JSON or binary pass-through
      }

      // Forward everything upstream -> client as Text JSON (avoid double forwarding raw toolCall)
      if (!isToolCallProcessed && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(str);
      }
    });

    clientSocket.on('message', (data: RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      if (!session.isSetupComplete) {
        try {
          const text = buffer.toString();
          const parsed = JSON.parse(text);
          if (parsed.setup) {
            // Client sent setup, forward
            if (geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(buffer);
            }
            return;
          }
        } catch {}

        // Buffer audio or turns while waiting for setupComplete
        session.frameQueue.push(buffer);
      } else {
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(buffer);
        }
      }
    });

    const terminate = () => {
      if (greetingWatchdog) {
        clearTimeout(greetingWatchdog);
        greetingWatchdog = null;
      }
      session.frameQueue = [];
      if (geminiSocket.readyState === WebSocket.OPEN || geminiSocket.readyState === WebSocket.CONNECTING) {
        geminiSocket.close();
      }
      if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
        clientSocket.close();
      }
    };

    clientSocket.on('close', terminate);
    clientSocket.on('error', (err) => {
      console.error('Client WS error:', err.message);
      terminate();
    });

    geminiSocket.on('close', () => {
      console.log('Gemini Live upstream connection closed');
      terminate();
    });

    geminiSocket.on('error', (err) => {
      console.error('Gemini Live upstream WS error:', err.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ error: `Ошибка голосового шлюза: ${err.message}` }));
      }
      terminate();
    });
  });
}
