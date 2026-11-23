import { isHrSessionType } from '@interview-prep/shared';
import {
  InterviewPersonaId,
  TargetGrade,
  getPersonaPromptDirectives
} from '../../prompts/personas';
import { CandidateGap } from '../vectorMemoryService';
import { getAiGenderDirective, getCandidateGenderDirective } from '../../prompts/core/genderDirectives';
import { LANGUAGE_LOCK_INVARIANT } from '../../prompts/core/languageDirectives';
import {
  VOICE_ANTI_SYCOPHANCY_DIRECTIVES,
  EXAM_ANTI_SYCOPHANCY_DIRECTIVES,
  TRIVIA_IMMUNITY_INVARIANT,
  CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES,
  CHAIN_OF_VERIFICATION_THOUGHT_DIRECTIVE,
  StrictnessLevel,
  getStrictnessDirectives
} from '../../prompts/core/antiSycophancy';
import {
  TUTOR_ZERO_GRADING_INSTRUCTION,
  buildCognitiveEpistemicDirectives
} from './liveTutorPromptDirectives';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from '../../prompts/core/sandboxDirectives';
import { LIVE_TOOL_CAPABILITY_DIRECTIVES, ZERO_UNPROBED_DEDUCTIONS_INVARIANT } from './livePromptBuilderConstants';
import { buildSystemDesignLivePrompt } from './liveSystemDesignPromptBuilder';
import { extractDefaultAnchors, WeightedAnchor, buildWeightedRubric } from './liveRubricBuilder';
import { buildMockInterviewLivePrompt } from './liveMockInterviewPromptBuilder';
import { buildTutorSessionLivePrompt } from './liveTutorSessionPromptBuilder';

export {
  LIVE_TOOL_CAPABILITY_DIRECTIVES,
  ZERO_UNPROBED_DEDUCTIONS_INVARIANT,
  extractDefaultAnchors,
  WeightedAnchor,
  buildWeightedRubric
};

export function buildSystemPrompt(params: {
  topic: string;
  questionText: string;
  referenceAnswer?: string;
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  voiceName?: string;
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
  maxProbes?: number;
  anchors?: string[];
  deepDive?: boolean;
  liveCoaching?: boolean;
  customPromptOverride?: string;
  questionIndex?: number;
  totalQuestions?: number;
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill' | string;
  candidateDossier?: any;
  jobContext?: any;
  hrQuestion?: any;
  hrMode?: any;
  tutorMode?: 'deep_dive' | 'free_chat' | 'socratic' | 'eli5' | 'quick_qa' | 'bug_hunt' | 'practice_pair';
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  fixedCode?: string;
  unitTest?: string;
  incidentContext?: {
    systemName?: string;
    architectureType?: string;
    incidentSymptoms?: string;
    businessImpact?: string;
    prReviewContext?: string;
    stackTrace?: string;
  };
  hints?: string[];
  targetSeniority?: string;
  primaryStack?: string;
  candidateGaps?: CandidateGap[];
  activeCodeArtifact?: { id?: string; title?: string; language?: string; code?: string; };
  codeRevisionsSummary?: Array<{ id: string; title: string; }>;
  persona?: InterviewPersonaId | string;
  targetGrade?: TargetGrade;
  challengeCategory?: string;
  challengeTrack?: string;
  strictness?: StrictnessLevel;
  workspaceManifest?: any;
  academyBridgeContext?: any;
  seniorReview?: any;
}): string {
  const {
    topic,
    questionText,
    referenceAnswer = '',
    strategy = 'adaptive_probing',
    voiceName = 'Kore',
    userGender = 'female',
    turnMode = 'manual',
    maxProbes = 3,
    anchors = [],
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
    fixedCode,
    unitTest,
    incidentContext,
    hints,
    primaryStack = 'Java 21, Spring Boot 3.3',
    candidateGaps = [],
    activeCodeArtifact,
    codeRevisionsSummary,
    persona = 'mentor',
    targetGrade = 'L5_SENIOR',
    strictness,
    challengeCategory = '',
    challengeTrack = '',
    workspaceManifest,
    academyBridgeContext,
    seniorReview
  } = params;

  const isFemale = ['Kore', 'Aoede'].includes(voiceName);
  const aiGenderRule = getAiGenderDirective(isFemale);
  const candidateGenderRule = getCandidateGenderDirective(userGender);

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
2. Одновременно голосом сразу объясни суть фрагмента и на что обратить внимание. Избегай сервисных фраз («я вывела код на доску») — сразу переходи к техническому содержанию.
3. Когда ты переходишь к новой теме или стираешь код — вызови \`update_whiteboard\` с action: 'clear'.`;

  const activeArtifactSection = activeCodeArtifact?.code
    ? `\n=== АКТИВНЫЙ КОД НА ЭКРАНЕ КАНДИДАТА (${activeCodeArtifact.id || 'активная версия'}: "${activeCodeArtifact.title || 'Сниппет'}") ===
${wrapUntrustedContext('active_code_artifact', activeCodeArtifact.code)}
${(codeRevisionsSummary && codeRevisionsSummary.length > 1) ? `\nДРУГИЕ ВЕРСИИ КОДА В ИСТОРИИ СЕССИИ (Кандидат сейчас просматривает версию ${activeCodeArtifact.id || 'активную'}):\n${codeRevisionsSummary.map((r: any) => `  - [${r.id}] ${r.title} ${r.id === activeCodeArtifact?.id ? '(АКТИВНА)' : ''}`).join('\n')}\n` : ''}
ДИРЕКТИВА ПО КОНТЕКСТУ КОДА: Кандидат сейчас смотрит на версию ${activeCodeArtifact.id || 'активную'}. Если он задает вопрос по коду или строкам («почему тут так?», «что в 5-й строке?»), отвечай применительно именно к этому сниппету.\n`
    : '';

  const tutorZeroGradingInstruction = TUTOR_ZERO_GRADING_INSTRUCTION;

  const effectiveStrictness: StrictnessLevel = strictness ||
    (sessionType === 'tutor' ? 'learning' : (targetGrade === 'L6_STAFF' || persona === 'amazon_bar_raiser' ? 'hardcore' : 'standard'));

  const strictnessDirective = getStrictnessDirectives(effectiveStrictness);

  const cognitiveEpistemicDirectives = buildCognitiveEpistemicDirectives(strictnessDirective);

  const genderRule = `${aiGenderRule}\n\n${candidateGenderRule}\n\n${turnModeInstruction}\n\n${whiteboardInstruction}${activeArtifactSection}${
    sessionType === 'tutor' ? `\n\n${tutorZeroGradingInstruction}` : ''
  }`;

  const rubric = buildWeightedRubric(referenceAnswer || '', questionText || '', anchors);
  const anchorsFormatted = rubric.map((r, i) => `  [Критерий ${i + 1}: ${r.id}] (Вес: ${r.weight} б.) ${r.title}\n    Суть: ${r.description}`).join('\n');

  // === SYSTEM DESIGN LIVE BAR-RAISER DEFENSE ===
  if (sessionType === 'system_design') {
    return buildSystemDesignLivePrompt({
      isFemale,
      genderRule,
      questionText,
      topic,
      referenceAnswer,
      anchorsFormatted,
      codeSnippet,
      customPromptOverride
    });
  }

  // === TUTOR SESSION LOGIC (Study Card / Bug Hunt Arena) ===
  if (sessionType === 'tutor' || tutorMode === 'practice_pair' || tutorMode === 'bug_hunt' || tutorMode === 'free_chat') {
    return buildTutorSessionLivePrompt({
      customPromptOverride,
      tutorMode,
      isFemale,
      userGender,
      genderRule,
      cognitiveEpistemicDirectives,
      questionText,
      referenceAnswer,
      topic,
      bugTitle,
      bugExplanation,
      codeSnippet,
      fixedCode,
      unitTest,
      incidentContext,
      hints,
      challengeCategory,
      challengeTrack,
      persona,
      activeCodeArtifact,
      workspaceManifest,
      academyBridgeContext,
      seniorReview
    });
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
    return `${LANGUAGE_LOCK_INVARIANT}

${customPromptOverride.trim()}

${genderRule}

${cognitiveEpistemicDirectives}

${firstTurnLockdownInstruction}

${ZERO_UNPROBED_DEDUCTIONS_INVARIANT}

${deepDiveInstruction}

${breakpointCoachingInstruction}

${liveCoachingInstruction}

[КОНТЕКСТ ВОПРОСА]
ВОПРОС: "${questionText}"
ЭТАЛОННЫЙ ОТВЕТ:
${referenceAnswer}

ЧЕК-ЛИСТ КРИТЕРИЕВ:
${anchors.map((a, i) => `[${i + 1}] ${a}`).join('\n')}

[ФИНАЛИЗАЦИЯ И ЭПИСТЕМИЧЕСКИЙ ЗАМОК]
По окончании собеседования обязательно скажи краткое устное резюме и вызови функцию submit_interview_evaluation.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО завышать оценку или соглашаться с ошибочными ответами кандидата из вежливости!`;
  }

  const personaDirectives = getPersonaPromptDirectives({
    persona: (persona as InterviewPersonaId) || 'mentor',
    targetGrade,
    topic
  });

  const candidateContextSection = candidateGaps && candidateGaps.length > 0
    ? `=== 0. ПРОФИЛЬ И СМЕЖНЫЕ ЗОНЫ ВНИМАНИЯ (EPISODIC VECTOR MEMORY) ===
ИНТЕРВЬЮЕР: ${personaDirectives.personaTitle}
${personaDirectives.gradeExpectationDirective}
СТЕК: ${primaryStack}
ИЗВЕСТНЫЕ ПРОБЕЛЫ КАНДИДАТА ИЗ СМЕЖНЫХ ТЕМ:
${candidateGaps.map((g, i) => `  [Пробел ${i + 1}] "${g.errorConcept}" (Степень дефицита: ${g.deficitWeight.toFixed(1)}, Сходство: ${Math.round((g.similarity ?? 0.8) * 100)}%)`).join('\n')}
ДИРЕКТИВА: Если кандидат в ответе касается этой темы, обрати особое внимание. Если раскрыл сам и без ошибок — зафиксируй самостоятельное освоение. Если затрудняется — мягко направь наводящим вопросом.`
    : `=== 0. ПРОФИЛЬ КАНДИДАТА ===
ИНТЕРВЬЮЕР: ${personaDirectives.personaTitle}
${personaDirectives.gradeExpectationDirective}
СТЕК: ${primaryStack}`;

  return buildMockInterviewLivePrompt({
    candidateContextSection,
    personaDirectives,
    isFemale,
    topic,
    genderRule,
    cognitiveEpistemicDirectives,
    batchContext,
    deepDiveInstruction,
    breakpointCoachingInstruction,
    liveCoachingInstruction,
    questionText,
    referenceAnswer,
    anchorsFormatted,
    maxProbes,
    rubric,
    strategy,
    persona
  });
}
