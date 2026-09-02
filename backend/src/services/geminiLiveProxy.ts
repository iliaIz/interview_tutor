import { WebSocket, WebSocketServer, RawData } from 'ws';
import http from 'http';
import url from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { envConfig } from '../config/env';
import { updateBugChallengeStatus } from './tutorService';
import {
  findRelevantCandidateGaps,
  applyKnowledgeDecay,
  recordNewErrorGap,
  getUserProfile,
  CandidateGap
} from './vectorMemoryService';
import { authService } from './authService';
import { parseCookies } from '../middleware/auth';
import { recordEvaluationAndSyncProgress } from './progressService';


dotenv.config();

export interface LiveTurn {
  role: 'user' | 'model';
  text: string;
}

export interface LiveSessionMemory {
  sessionId: string;
  questionId: string;
  turns: LiveTurn[];
  lastSpeaker: 'user' | 'model' | 'none';
  updatedAt: number;
}

export const liveSessionRegistry = new Map<string, LiveSessionMemory>();

// Auto-cleanup registry every 10 minutes (remove sessions idle > 30 mins)
setInterval(() => {
  const now = Date.now();
  for (const [key, mem] of liveSessionRegistry.entries()) {
    if (now - mem.updatedAt > 30 * 60 * 1000) {
      liveSessionRegistry.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function getOrCreateSessionMemory(sessionId: string, questionId: string): LiveSessionMemory {
  let mem = liveSessionRegistry.get(sessionId);
  if (!mem) {
    mem = {
      sessionId,
      questionId,
      turns: [],
      lastSpeaker: 'none',
      updatedAt: Date.now()
    };
    liveSessionRegistry.set(sessionId, mem);
  }
  return mem;
}

interface ProxySession {
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  isSetupComplete: boolean;
  frameQueue: Buffer[];
  sessionId?: string;
  questionId?: string;
  userId?: string;
  topic?: string;
  referenceAnswer?: string;
  relevantGapIds?: string[];
  probesCount?: number;
  isRetry?: boolean;
  hasCandidateResponded?: boolean;
  lastActivityAt: number;
  heartbeatInterval?: NodeJS.Timeout | null;
  nudgeWatchdog?: NodeJS.Timeout | null;
  greetingWatchdog?: NodeJS.Timeout | null;
  currentAiTurnText?: string;
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
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
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
  targetSeniority?: string;
  primaryStack?: string;
  candidateGaps?: CandidateGap[];
  activeCodeArtifact?: { id?: string; title?: string; language?: string; code?: string; };
  codeRevisionsSummary?: Array<{ id: string; title: string; }>;
}): string {
  const {
    topic,
    questionText,
    referenceAnswer,
    strategy,
    voiceName,
    userGender = 'female',
    turnMode = 'manual',
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
    hints,
    targetSeniority = 'senior',
    primaryStack = 'Java 21, Spring Boot 3.3',
    candidateGaps = [],
    activeCodeArtifact,
    codeRevisionsSummary
  } = params;

  const isFemale = ['Kore', 'Aoede'].includes(voiceName);
  const aiGenderRule = isFemale
    ? 'ГРАММАТИЧЕСКИЙ РОД ИИ (СТРОГО ЖЕНСКИЙ): У тебя женский голос. Обязательно используй ЖЕНСКИЕ окончания в глаголах и формах от первого лица: «Я готова», «Я внимательно выслушала», «Я рада», «Я хотела бы уточнить». Категорически запрещено использовать мужские окончания («готов», «слушал», «рад»).'
    : 'ГРАММАТИЧЕСКИЙ РОД ИИ (СТРОГО МУЖСКОЙ): У тебя мужской голос. Обязательно используй МУЖСКИЕ окончания в глаголах и формах от первого лица: «Я готов», «Я внимательно выслушал», «Я рад», «Я хотел бы уточнить». Категорически запрещено использовать женские окончания («готова», «слушала», «рада»).';

  const candidateGenderRule = userGender === 'female'
    ? `=== ГРАММАТИЧЕСКИЙ РОД ОБРАЩЕНИЯ К КАНДИДАТУ (СТРОГО ЖЕНСКИЙ РОД) ===
Кандидат — ДЕВУШКА/ЖЕНЩИНА.
Ты ОБЯЗАН обращаться к кандидату СТРОГО в ЖЕНСКОМ РОДЕ прошедшего времени и грамматических форм:
✓ «Ты отлично справилась!», «Как ты думаешь?», «Ты правильно заметила...», «Ты готова продолжить?», «Ты упомянула важную деталь».
✗ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать мужской род по отношению к кандидату («ты ответил», «ты сказал», «ты готов», «ты упомянул»).`
    : userGender === 'male'
    ? `=== ГРАММАТИЧЕСКИЙ РОД ОБРАЩЕНИЯ К КАНДИДАТУ (СТРОГО МУЖСКОЙ РОД) ===
Кандидат — МУЖЧИНА/ПАРЕНЬ.
Обращайся к кандидату СТРОГО в МУЖСКОМ РОДЕ прошедшего времени:
✓ «Ты отлично справился!», «Как ты думаешь?», «Ты правильно заметил...», «Ты готов продолжить?», «Ты упомянул важную деталь».
✗ ЗАПРЕЩЕНО использовать женский род по отношению к кандидату («ты ответила», «ты сказала», «ты готова»).`
    : `=== ГРАММАТИЧЕСКИЙ РОД ОБРАЩЕНИЯ К КАНДИДАТУ (НЕЙТРАЛЬНО / НА «ВЫ») ===
Обращайся к кандидату уважительно на «Вы»:
✓ «Вы отлично справились!», «Как Вы считаете?», «Вы правильно отметили...», «Вы готовы продолжить?».`;

  const turnModeInstruction = turnMode === 'manual'
    ? `=== РЕЖИМ ВЕДЕНИЯ ДИАЛОГА: ПОШАГОВЫЙ С КОНТРОЛЕМ КАНДИДАТА (MANUAL TURN-TAKING) [ВКЛЮЧЕН] ===
1. После того как ты озвучишь вопрос темы или наводящий вопрос, кандидат берет паузу на размышление.
2. Пауза может длиться до нескольких минут (тишина). НЕ перебивай, НЕ делай поспешных выводов и НЕ пытайся отвечать за кандидата во время паузы.
3. Кандидат сам нажмет кнопку «Закончить ответ», когда завершит свою мысль. Только после этого проанализируй ответ и дай развернутый фидбек.`
    : `=== РЕЖИМ ВЕДЕНИЯ ДИАЛОГА: СВОБОДНЫЙ ДИАЛОГ (FULL DUPLEX AUTO-VAD) ===
Слушай речь кандидата и реагируй после естественных пауз в ответе.`;

  const whiteboardInstruction = `=== ИНТЕРАКТИВНАЯ ДОСКА И ДЕМОНСТРАЦИЯ КОДА (ИНСТРУМЕНТ: update_whiteboard) ===
У кандидата на экране есть выдвижная интерактивная доска для кода и схем.
Если кандидат просит показать пример кода («покажи на коде», «напиши пример», «как это выглядит в Spring / Java», «напиши реализацию»),
или если при объяснении устройства под капотом, паттерна, структуры данных, алгоритма или аннотации полезно наглядно показать код:
1. ОБЯЗАТЕЛЬНО вызови инструмент \`update_whiteboard\` со структурированным сниппетом (action: 'write' | 'patch' | 'highlight' | 'clear', title: '...', language: 'java', code: '...', highlightLines: [...], explanation: '...').
2. Одновременно голосом кратко поясни, на что обратить внимание («Я вывела пример на доску справа...»).
3. Когда ты переходишь к новой теме или стираешь код — вызови \`update_whiteboard\` с action: 'clear'.`;

  const activeArtifactSection = activeCodeArtifact?.code
    ? `\n=== АКТИВНЫЙ КОД НА ЭКРАНЕ КАНДИДАТА (${activeCodeArtifact.id || 'активная версия'}: "${activeCodeArtifact.title || 'Сниппет'}") ===
\`\`\`${activeCodeArtifact.language || 'java'}
${activeCodeArtifact.code}
\`\`\`
${(codeRevisionsSummary && codeRevisionsSummary.length > 1) ? `\nДРУГИЕ ВЕРСИИ КОДА В ИСТОРИИ СЕССИИ (Кандидат сейчас просматривает версию ${activeCodeArtifact.id || 'активную'}):\n${codeRevisionsSummary.map((r: any) => `  - [${r.id}] ${r.title} ${r.id === activeCodeArtifact?.id ? '(АКТИВНА)' : ''}`).join('\n')}\n` : ''}
ДИРЕКТИВА ПО КОНТЕКСТУ КОДА: Кандидат сейчас смотрит на версию ${activeCodeArtifact.id || 'активную'}. Если он задает вопрос по коду или строкам («почему тут так?», «что в 5-й строке?»), отвечай применительно именно к этому сниппету.\n`
    : '';

  const genderRule = `${aiGenderRule}\n\n${candidateGenderRule}\n\n${turnModeInstruction}\n\n${whiteboardInstruction}${activeArtifactSection}`;


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
4. ПОДДЕРЖКА И НЕПРЕРЫВНЫЙ ДИАЛОГ: Всегда поддерживай, отвечай на вопросы и после каждого ответа переходи в режим прослушивания кандидата. НЕ пытайся завершить диалог самостоятельно.`;
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
3. НЕ ЗАЧИТЫВАЙ длинные простыни текста. Веди живую, интерактивную беседу.
4. НЕПРЕРЫВНОЕ СЛУШАНИЕ: После каждого ответа обязательно делай паузу и слушай микрофон кандидата. Диалог завершается только по явной команде пользователя.`;
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
3. Длина ответа: строго 1-2 предложения.
4. Слушай ответ кандидата после каждого вопроса.`;
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
3. Длина: 2-3 коротких предложения.
4. После аналогии спроси: «Понятна ли аналогия или разобрать на другом примере?» и слушай ответ.`;
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
2. Длина ответа: строго 2 предложения.
3. Слушай дальнейшие вопросы кандидата.`;
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

  // Interactive Breakpoint & Micro-Coaching Protocol (Active for all interview strategies)
  const breakpointCoachingInstruction = `=== 4. ПРОТОКОЛ БРЕЙКПОИНТА И КАПИТУЛЯЦИИ (INTERACTIVE BREAKPOINT & SANDBOX) ===
Если кандидат говорит «Не знаю», «Не помню», «Подскажи», «Расскажи как правильно», «Сдаюсь», «Зафиксируй пробел» или поступает системный запрос на объяснение:
1. НЕ спорь, НЕ молчи и НЕ продолжай настаивать на ответе.
2. Мгновенно переключись в поддерживающего Senior-наставника (Sandbox Breakpoint).
3. Дай емкое, живое 30-40 секундное объяснение под капотом (Micro-Lecture):
   - [Суть в 1 предложение простыми словами]
   - [Как физически устроено под капотом: JVM, Spring, многопоточность, память, структуры данных]
   - [«Золотая фраза для собеседования»]: точная формулировка, которую ценят Senior-интервьюеры.
4. В конце своего объяснения ОБЯЗАТЕЛЬНО задай кандидату вопрос для выбора пути:
   «Понятна ли эта концепция? Хотите уточнить какую-то деталь, попробовать ответить на вопрос заново с чистого листа или пойдем дальше?»
5. Если кандидат задает встречный вопрос («А почему именно так?», «Объясни еще про...») — подробно и дружелюбно ответь в режиме наставника.
6. Если кандидат говорит «Давай заново / хочу попробовать сама / начни сначала» — скажи «Отлично, давай с чистого листа!» и четко переспроси вопрос.
7. Если кандидат говорит «Пойдем дальше / всё понятно» — произнеси краткое устное резюме и вызови submit_interview_evaluation со справедливой оценкой первой попытки (зафиксировав упущенный критерий в missingPoints).`;

  // Live Coaching modifier instructions
  const liveCoachingInstruction = liveCoaching
    ? `=== РЕЖИМ ОБУЧЕНИЯ: РАЗБОР ОШИБОК И ОБУЧЕНИЕ НА ЛЕТУ (LIVE COACHING) [ВКЛЮЧЕН] ===
Если кандидат допускает неточность или ошибку — сразу примени протокол брейкпоинта и Micro-Lecture выше.
В итоговой оценке (submit_interview_evaluation) обязательно отметь, что материал был успешно усвоен в процессе диалога.`
    : `=== РЕЖИМ ОЦЕНКИ С ПОДДЕРЖКОЙ БРЕЙКПОИНТА ===
Пока кандидат сам отвечает — оценивай без подсказок. Но если кандидат явно просит объяснить или сдается — строго следуй протоколу брейкпоинта выше.`;

  const firstTurnLockdownInstruction = `=== КАТЕГОРИЧЕСКИЙ ЗАПРЕТ ВЫЗОВА submit_interview_evaluation НА СТАРТЕ (FIRST-TURN LOCKDOWN) ===
1. В самом начале сессии (на этапе приветствия) ты обязана ТОЛЬКО поздороваться и зачитать технический вопрос ГОЛОСОМ.
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать функцию submit_interview_evaluation на этапе первого приветствия и первого хода!
3. Функция submit_interview_evaluation вызывается ИСКЛЮЧИТЕЛЬНО ПОСЛЕ того, как кандидат дал свой содержательный устный ответ на вопрос.`;

  if (customPromptOverride && customPromptOverride.trim().length > 20) {
    return `${customPromptOverride.trim()}

${genderRule}

${firstTurnLockdownInstruction}

${deepDiveInstruction}

${breakpointCoachingInstruction}

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

  const candidateContextSection = candidateGaps && candidateGaps.length > 0
    ? `=== 0. ПРОФИЛЬ И СМЕЖНЫЕ ЗОНЫ ВНИМАНИЯ (EPISODIC VECTOR MEMORY) ===
ЦЕЛЕВОЙ ГРЕЙД: ${targetSeniority.toUpperCase()} | СТЕК: ${primaryStack}
ИЗВЕСТНЫЕ ПРОБЕЛЫ КАНДИДАТА ИЗ СМЕЖНЫХ ТЕМ:
${candidateGaps.map((g, i) => `  [Пробел ${i + 1}] "${g.errorConcept}" (Степень дефицита: ${g.deficitWeight.toFixed(1)}, Сходство: ${Math.round((g.similarity ?? 0.8) * 100)}%)`).join('\n')}
ДИРЕКТИВА: Если кандидат в ответе касается этой темы, обрати особое внимание. Если раскрыл сам и без ошибок — зафиксируй самостоятельное освоение. Если затрудняется — мягко направь наводящим вопросом.`
    : `=== 0. ПРОФИЛЬ КАНДИДАТА ===
ЦЕЛЕВОЙ ГРЕЙД: ${targetSeniority.toUpperCase()} | СТЕК: ${primaryStack}`;

  if (strategy === 'socratic_tutoring') {
    return `${candidateContextSection}

=== 1. РОЛЬ, ИДЕНТИЧНОСТЬ И СТИЛЬ (TOP INVARIANTS) ===
Ты поддерживающий, доброжелательный и опытный ${isFemale ? 'ментор (женщина)' : 'ментор (мужчина)'} по теме «${topic}».
${genderRule}

${batchContext}

${deepDiveInstruction}

${breakpointCoachingInstruction}

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
3. РЕАКЦИЯ НА МЕТА-РЕПЛИКИ И КАПИТУЛЯЦИЮ:
   - Если кандидат говорит «Повтори вопрос», «Не расслышала» — вежливо и четко повтори вопрос.
   - Если кандидат говорит «Не знаю», «Сдаюсь», «Объясни» — строго следуй протоколу брейкпоинта (Micro-Lecture) выше.
4. СОКРАТИЧЕСКОЕ ЗОНДИРОВАНИЕ:
   - Если кандидат раскрыл только часть критериев или включен Deep Dive — задай четкий наводящий вопрос (лимит: не более ${maxProbes} раундов). ВАЖНО: произнеси вопрос ПОЛНОСТЬЮ голосом до конца. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО обрывать фразу на полуслове и НЕЛЬЗЯ вызывать submit_interview_evaluation, пока задаешь вопрос!
   - Если кандидат ответил на наводящий вопрос или своими словами раскрыл суть — поблагодари за отличный ответ и сразу переходи к финалу (шаг 5).
5. ФИНАЛИЗАЦИЯ И ОЦЕНКА:
   - По завершении ответа кандидата (или после того, как дан ответ на уточняющий вопрос):
     а) ОБЯЗАТЕЛЬНО сначала произнеси вслух теплое устное резюме (2-3 предложения): похвали за верные мысли, отметь зоны роста и скажи «Сейчас зафиксирую результаты и сформирую оценку».
     б) И затем вызови функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;
  }

  // Default: adaptive_probing (FAANG Standard Technical Assessment)
  return `${candidateContextSection}

=== 1. РОЛЬ, ИДЕНТИЧНОСТЬ И СТИЛЬ (TOP INVARIANTS) ===
Ты профессиональный, объективный и доброжелательный Senior/Lead технический ${isFemale ? 'интервьюер (женщина)' : 'интервьюер (мужчина)'} по теме «${topic}».
${genderRule}

${batchContext}

${deepDiveInstruction}

${breakpointCoachingInstruction}

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
   - Задавай точечные вопросы по недостающим пунктам или углубляйся под капот (лимит раундов: до ${maxProbes}). ВАЖНО: произнеси вопрос ПОЛНОСТЬЮ голосом до конца. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО обрывать фразу на полуслове и НЕЛЬЗЯ вызывать submit_interview_evaluation, пока задаешь вопрос!
   - Если кандидат ответил на вопрос или говорит «Не знаю / не помню / объясни / сдаюсь» — переходи к финализации (шаг 3).
3. ФИНАЛИЗАЦИЯ И ВЕРДИКТ:
   - Когда ключевые вопросы обсуждены, дан ответ на уточнение или кандидат завершил ответ:
     а) ОБЯЗАТЕЛЬНО сначала произнеси вслух четкое устное резюме (2-3 предложения): оцени полноту ответа и скажи «Спасибо за ответ! Сейчас зафиксирую результаты и выставлю оценку».
     б) И затем вызови функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;
}

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', async (clientSocket: WebSocket, req: http.IncomingMessage) => {
    const parsedUrl = url.parse(req.url || '', true);
    const query = parsedUrl.query;

    // Zero-Trust WebSocket Auth Verification (Ticket or HttpOnly Cookie)
    const ticket = (query.ticket as string) || '';
    let authenticatedUser: any = null;

    if (ticket) {
      const ticketResult = authService.verifyAndConsumeWsTicket(ticket);
      if (ticketResult) {
        authenticatedUser = ticketResult.user;
      }
    }

    if (!authenticatedUser) {
      const cookies = parseCookies(req.headers.cookie);
      const sessionToken = cookies['session_token'];
      if (sessionToken) {
        const sessionResult = authService.validateSession(sessionToken);
        if (sessionResult) {
          authenticatedUser = sessionResult.user;
        }
      }
    }

    if (!authenticatedUser) {
      console.warn('⛔ Unauthorized WebSocket connection attempt rejected.');
      clientSocket.close(4401, 'Unauthorized: Valid ticket or invite session required');
      return;
    }

    console.log(`🎙️ Authenticated client connected to Live Audio WS Proxy (user: ${authenticatedUser.name})`);

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

    const sessionId = (query.sessionId as string) || '';
    const questionId = (query.questionId as string) || '';
    const topic = (query.topic as string) || 'Java & Spring Framework';
    const questionText = (query.questionText as string) || '';
    const referenceAnswer = (query.referenceAnswer as string) || '';
    const voiceName = (query.voice as string) || 'Kore';
    const userGender = ((query.userGender as string) === 'male' || (query.userGender as string) === 'neutral' ? query.userGender : 'female') as 'female' | 'male' | 'neutral';
    const turnMode = ((query.turnMode as string) === 'auto' ? 'auto' : 'manual') as 'manual' | 'auto';
    const strategy = ((query.strategy as string) === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing') as 'adaptive_probing' | 'socratic_tutoring';
    const maxProbes = Math.max(1, Math.min(5, parseInt((query.maxProbes as string) || '3', 10) || 3));
    const deepDive = query.deepDive === 'true';
    const liveCoaching = query.liveCoaching === 'true';
    const customPromptOverride = (query.customPrompt as string) || '';
    const questionIndex = Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0);
    const totalQuestions = Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1);
    const isRetry = query.isRetry === 'true';
    const isResumed = query.isResumed === 'true';
    const initialProbesCount = Math.max(0, parseInt((query.probesCount as string) || '0', 10) || 0);
    const initialUserMessage = ((query.initialUserMessage as string) || '').trim();

    let activeCodeArtifact: any = null;
    if (query.activeCodeArtifact) {
      try {
        activeCodeArtifact = JSON.parse(query.activeCodeArtifact as string);
      } catch {}
    }

    let codeRevisionsSummary: any = null;
    if (query.codeRevisionsSummary) {
      try {
        codeRevisionsSummary = JSON.parse(query.codeRevisionsSummary as string);
      } catch {}
    }

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

    // Pre-warmed retrieval of candidate gaps & profile (< 5ms)
    let candidateGaps: CandidateGap[] = [];
    try {
      candidateGaps = await findRelevantCandidateGaps(questionText || bugTitle || topic, topic, questionId);
      if (candidateGaps.length > 0) {
        console.log(`🧠 Injected ${candidateGaps.length} relevant vector gaps into Live prompt for "${topic}"`);
      }
    } catch (gapErr) {
      console.warn('Could not pre-warm candidate gaps:', gapErr);
    }

    const userProfile = getUserProfile();
    const relevantGapIds = candidateGaps.map((g) => g.id);

    const proxyApiKey = envConfig.proxy.apiKey;
    const requestedModel = (query.liveModel as string) || '';
    const isSupported = envConfig.models.supportedLiveModels.includes(requestedModel);
    const liveModel = isSupported ? requestedModel : envConfig.models.live;
    if (requestedModel && !isSupported) {
      console.warn(`⚠️ Requested Live model "${requestedModel}" is not in supported list [${envConfig.models.supportedLiveModels.join(', ')}]. Falling back to default "${envConfig.models.live}".`);
    }

    const cleanProxyWs = envConfig.proxy.baseUrl.replace(/^http/, 'ws');
    const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}`;
    console.log(`⚡ Connecting to Upstream Gemini Live WS (${upstreamWsUrl}) [Session: ${sessionId || 'anon'}, Type: ${sessionType}, Mode: ${tutorMode}, Voice: ${voiceName}, Gender: ${userGender}, TurnMode: ${turnMode}, isRetry: ${isRetry}, isResumed: ${isResumed}]...`);

    const geminiSocket = new WebSocket(upstreamWsUrl);
    let greetingWatchdog: NodeJS.Timeout | null = null;

    const session: ProxySession = {
      clientSocket,
      geminiSocket,
      isSetupComplete: false,
      frameQueue: [],
      sessionId,
      questionId,
      userId: authenticatedUser.id || 'default_user',
      topic,
      referenceAnswer,
      relevantGapIds,
      probesCount: isResumed ? initialProbesCount : 0,
      isRetry,
      hasCandidateResponded: isResumed, // Resumed session already has previous candidate speech
      lastActivityAt: Date.now(),
      heartbeatInterval: null,
      nudgeWatchdog: null,
      greetingWatchdog: null,
      currentAiTurnText: ''
    };

    // WebSocket Keepalive Heartbeat (every 15s)
    session.heartbeatInterval = setInterval(() => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
      // Adaptive Keepalive: In manual mode candidate might reflect/pause for up to 3 minutes (180s)
      const inactivityLimitMs = turnMode === 'manual' ? 180000 : 60000;
      if (Date.now() - session.lastActivityAt > inactivityLimitMs) {
        console.warn(`⚠️ Session inactive for >${inactivityLimitMs / 1000}s. Terminating keepalive expired socket.`);
        terminate('KeepaliveTimeout');
      }
    }, 15000);

    const systemPromptText = buildSystemPrompt({
      topic,
      questionText,
      referenceAnswer,
      strategy,
      voiceName,
      userGender,
      turnMode,
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
      hints: parsedHints,
      targetSeniority: userProfile.targetSeniority,
      primaryStack: userProfile.primaryStack,
      candidateGaps,
      activeCodeArtifact,
      codeRevisionsSummary
    });


    const toolDeclarations: any[] = [];

    // Universal AI Whiteboard Tool (available in all interview & tutor sessions)
    toolDeclarations.push({
      name: 'update_whiteboard',
      description: 'Отобразить, обновить, выделить или стереть пример кода или архитектурную схему на интерактивной доске кандидата',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: {
            type: 'STRING',
            enum: ['write', 'patch', 'highlight', 'clear'],
            description: 'write: создать/заменить код; patch: показать diff правок; highlight: подсветить строки; clear: очистить доску'
          },
          title: { type: 'STRING', description: 'Краткий понятный заголовок (например, "Пример Singleton с volatile")' },
          language: { type: 'STRING', description: 'Язык программирования (java, sql, yaml, json)' },
          code: { type: 'STRING', description: 'Исходный код для показа на доске' },
          highlightLines: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
            description: 'Номера строк для визуального акцента'
          },
          explanation: { type: 'STRING', description: 'Краткое пояснение' }
        },
        required: ['action']
      }
    });

    if (sessionType === 'interview') {
      toolDeclarations.push({
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
      });
    } else if (sessionType === 'tutor' && tutorMode === 'bug_hunt') {
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

    const setupMessage: any = {
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
        }
      }
    };

    if (toolDeclarations.length > 0) {
      setupMessage.setup.tools = [
        {
          functionDeclarations: toolDeclarations
        }
      ];
    }

    geminiSocket.on('open', () => {
      console.log(`✅ Connected to Upstream Gemini Live WS (${liveModel}), sending setup frame...`);
      geminiSocket.send(JSON.stringify(setupMessage));
    });

    geminiSocket.on('message', (data: RawData) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const str = buffer.toString('utf8');
      let isToolCallProcessed = false;

      try {
        const parsed = JSON.parse(str);

        // Handle setupComplete from Google Gemini
        if (parsed.setupComplete) {
          session.isSetupComplete = true;
          console.log(`🎉 Upstream setupComplete received (Type: ${sessionType}, isResumed: ${isResumed}, sessionId: ${session.sessionId || 'none'})!`);

          if (isResumed) {
            const mem = session.sessionId ? liveSessionRegistry.get(session.sessionId) : null;
            const hasHistory = mem && mem.turns.length > 0;

            if (hasHistory) {
              console.log(`🔄 Replaying ${mem.turns.length} structured multi-turn dialogue steps to upstream Live model for session ${session.sessionId}...`);
              const replayTurns = mem.turns.map((t) => ({
                role: t.role,
                parts: [{ text: t.text }]
              }));

              // Send structured multi-turn conversation history to Google Gemini Live
              const multiTurnMessage = {
                clientContent: {
                  turns: replayTurns,
                  turnComplete: false
                }
              };
              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(multiTurnMessage));
              }

              // Silent Resumption: if candidate was speaking or reflecting when connection dropped, keep AI silent!
              if (mem.lastSpeaker === 'user' || mem.lastSpeaker === 'none') {
                console.log(`🤫 Silent Resumption active for session ${session.sessionId}: AI remains quiet, microphone immediately unlocked for candidate.`);
                if (clientSocket.readyState === WebSocket.OPEN) {
                  clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: true }));
                }
              } else {
                // If disconnect happened mid-AI monologue, trigger a concise 1-sentence thought completion
                console.log(`🎙️ Mid-turn Resumption for session ${session.sessionId}: triggering brief completion without greetings.`);
                const continueTurn = {
                  clientContent: {
                    turns: [
                      {
                        role: 'user',
                        parts: [
                          {
                            text: '[ТЕХНИЧЕСКАЯ СИНХРОНИЗАЦИЯ СВЯЗИ]: Закончи свою предыдущую мысль одной короткой фразой (1 предложение) и передай слово кандидату.'
                          }
                        ]
                      }
                    ],
                    turnComplete: true
                  }
                };
                if (geminiSocket.readyState === WebSocket.OPEN) {
                  geminiSocket.send(JSON.stringify(continueTurn));
                }
                if (clientSocket.readyState === WebSocket.OPEN) {
                  clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: false }));
                }
              }
            } else {
              // Fallback if memory was cold: send concise non-regreeting continuation
              const fallbackGreeting = `[ВОЗОБНОВЛЕНИЕ ДИАЛОГА]: Мы продолжаем обсуждение вопроса "${questionText || topic}". Не здоровайся заново. Одной короткой фразой передай слово кандидату.`;
              const initialGreetingTurn = {
                clientContent: {
                  turns: [
                    {
                      role: 'user',
                      parts: [{ text: fallbackGreeting }]
                    }
                  ],
                  turnComplete: true
                }
              };
              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(initialGreetingTurn));
              }
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: false }));
              }
            }
          } else {
            let greetingText = '';
            if (initialUserMessage) {
              // User connected by sending a concrete textual question/code critique
              greetingText = initialUserMessage;
              session.hasCandidateResponded = true;
              console.log(`💬 User initiated session with direct prompt turn: "${initialUserMessage.slice(0, 80)}..."`);
            } else if (sessionType === 'tutor') {
              if (tutorMode === 'bug_hunt') {
                greetingText = `Привет! Я смотрю на задачу на экране «${bugTitle || 'Code Review'}». Поприветствуй меня в 1 коротком предложении и спроси, в чем здесь ошибка.`;
              } else if (tutorMode === 'deep_dive') {
                greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 предложении и предложи разобрать любые тонкости или устройство под капотом.`;
              } else if (tutorMode === 'free_chat') {
                greetingText = `Привет! Я разбираю тему «${questionText || topic}». Поприветствуй меня в 1 коротком предложении и скажи, что готова ответить на любые вопросы и помочь разобраться.`;
              } else if (tutorMode === 'socratic') {
                greetingText = `Привет! Я готов разобрать вопрос «${questionText || topic}». Задай мне первый наводящий вопрос.`;
              } else if (tutorMode === 'eli5') {
                greetingText = `Привет! Объясни мне суть вопроса «${questionText || topic}» на простой жизненной аналогии.`;
              } else {
                greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 короткой фразе.`;
              }
            } else {
              const isSubsequent = questionIndex > 0;
              if (session.isRetry) {
                greetingText = `Мы пробуем ответить на технический вопрос темы заново с чистого листа: "${questionText || 'Вопрос темы'}". Коротко подбодри одной фразой и четко задай этот вопрос.`;
              } else {
                greetingText = isSubsequent
                  ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой-переходом подтверди прогресс и четко зачитай следующий технический вопрос: "${questionText || 'Следующий вопрос темы'}"`
                  : `Привет! Я готова к собеседованию. Поприветствуй меня одной фразой и четко зачитай технический вопрос: "${questionText || 'Расскажи о себе и опыте в Java'}"`;
              }
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

            // Watchdog (only for synthetic greetings, never for user queries)
            if (greetingWatchdog) clearTimeout(greetingWatchdog);
            if (!initialUserMessage) {
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
                                ? (tutorMode === 'bug_hunt'
                                  ? 'Начни устное код-ревью в 1 короткой фразе.'
                                  : tutorMode === 'free_chat'
                                  ? 'Поприветствуй пользователя и начни свободный диалог тьютора в 1 короткой фразе.'
                                  : 'Начни диалог тьютора в 1 короткой фразе.')
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
            }

            // Notify client
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({
                type: 'setupComplete',
                hasInitialUserMessage: !!initialUserMessage
              }));
            }
          }


          // Drain queued frames
          while (session.frameQueue.length > 0) {
            const frame = session.frameQueue.shift();
            if (frame && geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(frame);
            }
          }
        }

        // Model Turn Text accumulation and watchdog clearing
        if (parsed.serverContent?.modelTurn) {
          session.lastActivityAt = Date.now();
          session.probesCount = (session.probesCount || 0) + 1;
          if (greetingWatchdog) {
            clearTimeout(greetingWatchdog);
            greetingWatchdog = null;
          }
          if (session.nudgeWatchdog) {
            clearTimeout(session.nudgeWatchdog);
            session.nudgeWatchdog = null;
          }

          if (parsed.serverContent.modelTurn.parts) {
            for (const part of parsed.serverContent.modelTurn.parts) {
              if (part.text) {
                session.currentAiTurnText = (session.currentAiTurnText || '') + part.text;
              }
            }
          }
        }

        // AI finished generating turn: commit to session turn history
        if (parsed.serverContent?.turnComplete) {
          if (session.currentAiTurnText && session.sessionId) {
            const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
            mem.turns.push({ role: 'model', text: session.currentAiTurnText.trim() });
            mem.lastSpeaker = 'model';
            mem.updatedAt = Date.now();
            session.currentAiTurnText = '';
          }
        }

        // Barge-in interruption during AI speech
        if (parsed.serverContent?.interrupted) {
          if (session.sessionId) {
            const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
            if (session.currentAiTurnText) {
              mem.turns.push({ role: 'model', text: session.currentAiTurnText.trim() });
              session.currentAiTurnText = '';
            }
            mem.lastSpeaker = 'user';
            mem.updatedAt = Date.now();
          }
        }

        // Handle Function Calling / toolCall
        if (parsed.toolCall?.functionCalls) {
          session.lastActivityAt = Date.now();
          if (session.nudgeWatchdog) {
            clearTimeout(session.nudgeWatchdog);
            session.nudgeWatchdog = null;
          }
          console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(parsed.toolCall.functionCalls));

          for (const call of parsed.toolCall.functionCalls) {
            if (call.name === 'update_whiteboard') {
              isToolCallProcessed = true;
              const args = call.args || {};
              const action = args.action || 'write';
              const title = args.title || (action === 'clear' ? 'Доска очищена' : 'Демонстрация кода');
              const language = args.language || 'java';
              const code = args.code || '';
              const highlightLines = Array.isArray(args.highlightLines) ? args.highlightLines : [];
              const explanation = args.explanation || '';

              console.log(`🎨 Gemini Live emitted Whiteboard update: [${action}] "${title}" (lang: ${language}, lines: ${highlightLines.length})`);

              // Immediate toolResponse so model continues speaking seamlessly
              const toolResponse = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: {
                        status: 'SUCCESS',
                        message: 'Интерактивная доска обновлена на экране кандидата.'
                      }
                    }
                  ]
                }
              };

              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(toolResponse));
              }

              // Send event to client
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'whiteboard_update',
                  payload: {
                    action,
                    title,
                    language,
                    code,
                    highlightLines,
                    explanation,
                    updatedAt: Date.now()
                  }
                }));
              }
            } else if (call.name === 'mark_bug_solved') {
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

              let decayResult: any = null;
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

                // Apply knowledge decay
                try {
                  void applyKnowledgeDecay({
                    questionId: session.questionId,
                    topic: session.topic || 'General',
                    assistanceLevel: isSolved ? (parsedHints.length > 0 ? 'assisted' : 'solo') : 'relapse',
                    resolvedGapIds: session.relevantGapIds
                  }).then((res) => {
                    decayResult = res;
                    console.log(`🧠 Bug challenge decay applied:`, res);
                  });
                } catch (decayErr) {
                  console.warn('Bug challenge decay error:', decayErr);
                }
              }

              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'bug_solved',
                  payload: {
                    isSolved,
                    feedback,
                    keyInsight,
                    knowledgeUpdate: decayResult
                  }
                }));
              }
            } else if (call.name === 'submit_interview_evaluation') {
              // SOTA First-Turn Guard: Reject premature evaluation if candidate has not yet responded
              if (!session.hasCandidateResponded) {
                console.warn('🛡️ [First-Turn Guard] Blocked premature submit_interview_evaluation before candidate spoke. Re-prompting AI to speak question...');
                isToolCallProcessed = true;
                if (geminiSocket.readyState === WebSocket.OPEN) {
                  geminiSocket.send(JSON.stringify({
                    toolResponse: {
                      functionResponses: [
                        {
                          response: {
                            error: 'Кандидат еще не отвечал на вопрос. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку на этапе первого приветствия. Пожалуйста, поприветствуйте кандидата голосом и четко зачитайте вопрос темы вслух.'
                          },
                          id: call.id
                        }
                      ]
                    }
                  }));
                }
                return;
              }

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
                  const syncResult = recordEvaluationAndSyncProgress({
                    userId: session.userId || 'default_user',
                    questionId: session.questionId,
                    topic: session.topic || 'General',
                    mode: 'voice',
                    score,
                    isPassed,
                    positivePoints,
                    missingPoints,
                    feedback,
                    userAnswer: 'Устный ответ в Gemini Live'
                  });
                  savedEvalId = syncResult.evalId;
                  console.log(`💾 Live evaluation saved & progress synced to DB: ${savedEvalId} (Score: ${score}, Topic: ${syncResult.progress.topic}, Percentage: ${syncResult.progress.percentage}%)`);
                } catch (dbErr) {
                  console.error('Error saving Live evaluation to DB:', dbErr);
                }
              }

              // Determine assistance level for knowledge tracing
              const probes = session.probesCount || 0;
              let assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse' = 'solo';
              if (session.isRetry) {
                assistanceLevel = isPassed ? 'assisted' : 'relapse';
              } else if (score >= 80 && probes <= 2 && !liveCoaching) {
                assistanceLevel = 'solo';
              } else if (score >= 70) {
                assistanceLevel = 'guided';
              } else if (liveCoaching || (score >= 60 && score < 70)) {
                assistanceLevel = isPassed ? 'assisted' : 'relapse';
              } else {
                assistanceLevel = 'relapse';
              }

              // Apply knowledge decay & record new gap if failed
              let decayResult: any = null;
              try {
                void applyKnowledgeDecay({
                  questionId: session.questionId,
                  topic: session.topic || 'General',
                  assistanceLevel,
                  resolvedGapIds: session.relevantGapIds
                }).then((res) => {
                  decayResult = res;
                  console.log(`🧠 Knowledge decay applied (${assistanceLevel}):`, JSON.stringify(res));
                });
              } catch (decayErr) {
                console.error('Error applying knowledge decay:', decayErr);
              }

              if (!isPassed && missingPoints.length > 0) {
                try {
                  void recordNewErrorGap({
                    questionId: session.questionId,
                    topic: session.topic || 'General',
                    errorConcept: missingPoints[0],
                    initialDeficit: 1.0
                  });
                } catch (recErr) {
                  console.warn('Could not record new gap:', recErr);
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
                    spokenFeedback: feedback,
                    assistanceLevel,
                    knowledgeUpdate: decayResult
                  }
                }));
              }

              console.log('✅ Evaluation delivered to client. Keeping session lifeline open for Q&A and transition.');
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

    clientSocket.on('message', (data: RawData) => {
      session.lastActivityAt = Date.now();
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      let payloadBuffer = buffer;

      try {
        const text = buffer.toString();
        const parsed = JSON.parse(text);

        // Heartbeat Pong response from client: calculate RTT and send ack to client
        if (parsed.type === 'pong') {
          const sentTs = typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now();
          const rtt = Math.max(0, Date.now() - sentTs);
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'pong_ack', rtt, timestamp: Date.now() }));
          }
          return;
        }

        // Heartbeat Ping from client: immediate Pong reply
        if (parsed.type === 'ping') {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'pong', timestamp: parsed.timestamp || Date.now() }));
          }
          return;
        }

        // First-frame resumption sync from client (robust fallback if memory was cold)
        if (parsed.type === 'resume_sync' && Array.isArray(parsed.turns) && session.sessionId) {
          const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
          if (mem.turns.length === 0 && parsed.turns.length > 0) {
            mem.turns = parsed.turns
              .map((t: any) => ({
                role: (t.role === 'model' || t.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
                text: String(t.text || '').trim()
              }))
              .filter((t: any) => t.text.length > 0);
            mem.lastSpeaker = mem.turns[mem.turns.length - 1]?.role || 'none';
            mem.updatedAt = Date.now();
            console.log(`📥 Seeded session memory from client resume_sync frame: ${mem.turns.length} turns for session ${session.sessionId}`);
          }
          return;
        }

        // Client text message turn tracking
        if (parsed.clientContent?.turns && session.sessionId) {
          for (const turn of parsed.clientContent.turns) {
            if (turn.parts) {
              const turnText = turn.parts.map((p: any) => p.text || '').join('').trim();
              if (turnText && !turnText.startsWith('[ВОЗОБНОВЛЕНИЕ') && !turnText.startsWith('[ТЕХНИЧЕСКАЯ')) {
                const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
                mem.turns.push({ role: 'user', text: turnText });
                mem.lastSpeaker = 'user';
                mem.updatedAt = Date.now();
              }
            }
          }
        }

        // Client audio turn tracking
        if (session.sessionId && (parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks)) {
          const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
          mem.lastSpeaker = 'user';
          mem.updatedAt = Date.now();
        }

        // Ignore duplicate setup frames from client since setup is already initiated via URL query params
        if (parsed.setup) {
          console.log('ℹ️ Client sent setup frame (session already configured via URL params, skipping duplicate setup)');
          return;
        }

        // Client committed candidate turn (text, audio or turnComplete)
        if (parsed.clientContent?.turns || parsed.clientContent?.turnComplete || parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks) {
          session.hasCandidateResponded = true;
        }

        // Client committed turnComplete -> start upstream nudge watchdog (5.5s)
        if (parsed.clientContent?.turnComplete) {
          if (session.nudgeWatchdog) clearTimeout(session.nudgeWatchdog);
          session.nudgeWatchdog = setTimeout(() => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              console.log('⏱️ Upstream response delayed (>5.5s), notifying client...');
              clientSocket.send(JSON.stringify({ type: 'thinking_delay', elapsedMs: 5500 }));
            }
          }, 5500);
        }

        // Normalize realtime audio chunks to canonical Gemini Live realtimeInput.audio
        if (parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks) {
          const audioData =
            parsed.realtime_input?.audio?.data ||
            parsed.realtimeInput?.audio?.data ||
            parsed.realtimeInput?.mediaChunks?.[0]?.data;
          const mimeType =
            parsed.realtime_input?.audio?.mimeType ||
            parsed.realtimeInput?.audio?.mimeType ||
            parsed.realtimeInput?.mediaChunks?.[0]?.mimeType ||
            'audio/pcm;rate=16000';

          if (audioData) {
            const normalized = {
              realtimeInput: {
                audio: {
                  mimeType,
                  data: audioData
                }
              }
            };
            payloadBuffer = Buffer.from(JSON.stringify(normalized));
          }
        }
      } catch {}

      if (!session.isSetupComplete) {
        // Buffer audio or turns while waiting for setupComplete
        session.frameQueue.push(payloadBuffer);
      } else {
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(payloadBuffer);
        }
      }
    });

    const terminate = (source: string, code?: number, reason?: Buffer) => {
      console.log(`🔌 Termination triggered by [${source}], code=${code}, reason=${reason ? reason.toString() : 'none'}`);
      if (greetingWatchdog) {
        clearTimeout(greetingWatchdog);
        greetingWatchdog = null;
      }
      if (session.greetingWatchdog) {
        clearTimeout(session.greetingWatchdog);
        session.greetingWatchdog = null;
      }
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
        session.heartbeatInterval = null;
      }
      if (session.nudgeWatchdog) {
        clearTimeout(session.nudgeWatchdog);
        session.nudgeWatchdog = null;
      }
      session.frameQueue = [];
      if (geminiSocket.readyState === WebSocket.OPEN || geminiSocket.readyState === WebSocket.CONNECTING) {
        geminiSocket.close();
      }
      if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
        clientSocket.close();
      }
    };

    clientSocket.on('close', (code, reason) => terminate('ClientSocket', code, reason));
    clientSocket.on('error', (err) => {
      console.error('Client WS error:', err.message);
      terminate('ClientSocketError');
    });

    geminiSocket.on('close', (code, reason) => terminate('GeminiUpstream', code, reason));
    geminiSocket.on('error', (err) => {
      console.error('Gemini Live upstream WS error:', err.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ error: `Ошибка голосового шлюза: ${err.message}` }));
      }
      terminate('GeminiUpstreamError');
    });
  });
}
