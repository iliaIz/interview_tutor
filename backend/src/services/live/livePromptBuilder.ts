/**
 * livePromptBuilder.ts
 * Prompt builder orchestrator for Gemini 3.8 Live sessions.
 * Decomposed into promptDirectives, liveTutorPromptBuilder, and liveSystemDesignPromptBuilder.
 * Cognitive bounding limit: <= 400 lines (Rule 8).
 */

import {
  InterviewPersonaId,
  TargetGrade,
  getPersonaPromptDirectives
} from '../../prompts/personas';
import { CandidateGap } from '../vectorMemoryService';
import { getChallengeDomain } from '../../utils/challengeDomain';
import { buildLivePairPrompt } from '../../prompts/live/livePairPrompts';
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
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from '../../prompts/core/sandboxDirectives';
import {
  LIVE_TOOL_CAPABILITY_DIRECTIVES,
  ZERO_UNPROBED_DEDUCTIONS_INVARIANT,
  VOICE_NAVIGATION_CAPABILITY_DIRECTIVES,
  extractDefaultAnchors,
  WeightedAnchor,
  buildWeightedRubric
} from './promptDirectives';
import { buildTutorPrompt } from './liveTutorPromptBuilder';
import { buildSystemDesignPrompt } from './liveSystemDesignPromptBuilder';

export {
  LIVE_TOOL_CAPABILITY_DIRECTIVES,
  ZERO_UNPROBED_DEDUCTIONS_INVARIANT,
  VOICE_NAVIGATION_CAPABILITY_DIRECTIVES,
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
  sessionType?: 'interview' | 'tutor' | 'system_design';
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
    candidateGaps = [],
    activeCodeArtifact,
    codeRevisionsSummary,
    primaryStack = 'Java 21, Spring Boot 3.3',
    persona = 'mentor',
    targetGrade = 'L5_SENIOR',
    challengeCategory = '',
    challengeTrack = '',
    strictness = 'lenient',
    workspaceManifest,
    academyBridgeContext,
    seniorReview
  } = params;

  const isFemale = ['Kore', 'Aoede'].includes(voiceName);
  const aiGenderRule = getAiGenderDirective(isFemale);
  const candidateGenderRule = getCandidateGenderDirective(userGender);

  const turnModeInstruction = turnMode === 'manual'
    ? '=== РЕЖИМ ПЕРЕДАЧИ ХОДА: РУЧНОЙ (PUSH-TO-TALK) ===\nКандидат управляет микрофоном вручную. Отвечай только после завершения хода.'
    : '=== РЕЖИМ ПЕРЕДАЧИ ХОДА: АВТОМАТИЧЕСКИЙ (VOICE ACTIVITY DETECTION) ===\nВнимательно слушай кандидата. Делай паузы между репликами.';

  const whiteboardInstruction = `=== ИНТЕРАКТИВНАЯ ДОСКА (AI WHITEBOARD) ===
Если нужно наглядно разобрать код или архитектурную схему, вызывай функцию update_whiteboard.`;

  const activeArtifactSection = activeCodeArtifact?.code
    ? `\n=== АКТИВНЫЙ КОД НА ЭКРАНЕ КАНДИДАТА (${activeCodeArtifact.id || 'активная версия'}: "${activeCodeArtifact.title || 'Сниппет'}") ===\n${wrapUntrustedContext('active_code_artifact', activeCodeArtifact.code)}\n${(codeRevisionsSummary && codeRevisionsSummary.length > 1) ? `\nДРУГИЕ ВЕРСИИ КОДА В ИСТОРИИ СЕССИИ (Кандидат сейчас просматривает версию ${activeCodeArtifact.id || 'активную'}):\n${codeRevisionsSummary.map((r: any) => `  - [${r.id}] ${r.title} ${r.id === activeCodeArtifact?.id ? '(АКТИВНА)' : ''}`).join('\n')}\n` : ''}\n`
    : '';

  const genderRule = `${aiGenderRule}\n\n${candidateGenderRule}\n\n${turnModeInstruction}\n\n${whiteboardInstruction}${activeArtifactSection}`;
  const cognitiveEpistemicDirectives = `${CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES}\n${CHAIN_OF_VERIFICATION_THOUGHT_DIRECTIVE}`.trim();

  const rubric = buildWeightedRubric(referenceAnswer || '', questionText || '', anchors);
  const anchorsFormatted = rubric.map((r, i) => `  [Критерий ${i + 1}: ${r.id}] (Вес: ${r.weight} б.) ${r.title}\n    Суть: ${r.description}`).join('\n');

  // 1. System Design Arena Live Defense
  if (sessionType === 'system_design') {
    return buildSystemDesignPrompt({
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

  // 2. Practice Pair Programming
  if (tutorMode === 'practice_pair') {
    const domain = getChallengeDomain({ category: challengeCategory, track: challengeTrack, slug: bugTitle });
    return buildLivePairPrompt({
      domain,
      persona: typeof persona === 'string' ? persona : 'middle_scaffold',
      isFemale,
      userGender,
      bugTitle,
      questionText,
      bugExplanation,
      referenceAnswer,
      codeSnippet,
      activeCodeArtifact,
      workspaceManifest,
      academyBridgeContext,
      seniorReview
    });
  }

  // 3. Tutor Session Logic (Study Card / Bug Hunt Arena / Free Chat / Socratic / ELI5)
  if (sessionType === 'tutor' || tutorMode === 'bug_hunt' || tutorMode === 'free_chat' || tutorMode === 'deep_dive' || tutorMode === 'socratic' || tutorMode === 'eli5') {
    return buildTutorPrompt({
      tutorMode,
      customPromptOverride,
      genderRule,
      isFemale,
      cognitiveEpistemicDirectives,
      questionText,
      referenceAnswer,
      topic,
      bugTitle,
      bugExplanation,
      codeSnippet,
      incidentContext,
      fixedCode,
      unitTest,
      hints,
      totalQuestions,
      questionIndex
    });
  }

  // 3. Interview Session Logic (FAANG Mock Assessment)
  const batchContext = (totalQuestions && totalQuestions > 1)
    ? `=== КОНТЕКСТ СЕРИИ ВОПРОСОВ (HANDS-FREE MOCK INTERVIEW) ===
Ты проводишь серию вопросов (вопрос ${(questionIndex ?? 0) + 1} из ${totalQuestions}).
${((questionIndex ?? 0) + 1 < totalQuestions)
  ? 'В финале текущего ответа кратко подведи итог и вызови submit_interview_evaluation. НЕ прощайся окончательно, так как сразу последует следующий вопрос темы. Обязательно спроси: "Твой балл [score]. Готов перейти к следующему вопросу?".'
  : 'Это заключительный вопрос серии. После вызова submit_interview_evaluation поблагодари за всё пройденное собеседование.'}
Если кандидат говорит «Пропусти / скипни этот вопрос» до ответа — вызови navigate_question(direction: 'next', action: 'skip_unanswered') и подтверди пропуск.
Если кандидат говорит «Вернись назад» — вызови navigate_question(direction: 'prev', action: 'review_previous').`
    : '';

  const deepDiveInstruction = deepDive
    ? `=== РЕЖИМ ЗОНДИРОВАНИЯ: ГЛУБОКОЕ ЗОНДИРОВАНИЕ (DEEP-DIVE) [ВКЛЮЧЕН] ===
Исследуй глубину знаний кандидата: low-level механизмы, память, краевые случаи и трейдоффы.`
    : `=== РЕЖИМ ЗОНДИРОВАНИЯ: СТАНДАРТНЫЙ СКОУП ===
Ограничивайся фактурой эталонного ответа без далеких смежных тем.`;

  const breakpointCoachingInstruction = `=== ПРОТОКОЛ БРЕЙКПОИНТА И КАПИТУЛЯЦИИ ===
Если кандидат сдается («Не знаю», «Сдаюсь», «Подскажи»):
1. Переключись в наставника и дай емкое 30-секундное объяснение под капотом.
2. Спроси: «Понятна ли концепция? Хотите попробовать заново с чистого листа или пойдем дальше?»
3. Если кандидат выбирает «Пойдем дальше» — зафиксируй пропуск через submit_interview_evaluation или navigate_question.`;

  const liveCoachingInstruction = liveCoaching
    ? `=== РЕЖИМ ОБУЧЕНИЯ (LIVE COACHING) ===\nРазбирай ошибки на лету и отмечай усвоение материала в оценке.`
    : `=== РЕЖИМ ОЦЕНКИ С ПОДДЕРЖКОЙ БРЕЙКПОИНТА ===`;

  const firstTurnLockdownInstruction = `=== КАТЕГОРИЧЕСКИЙ ЗАПРЕТ ВЫЗОВА submit_interview_evaluation НА СТАРТЕ (FIRST-TURN LOCKDOWN) ===
1. В самом начале сессии ты обязана ТОЛЬКО поздороваться и зачитать вопрос ГОЛОСОМ.
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать submit_interview_evaluation на первом приветствии!
3. Оценка вызывается ТОЛЬКО ПОСЛЕ содержательного ответа кандидата.`;

  if (customPromptOverride && customPromptOverride.trim().length > 20) {
    return `${LANGUAGE_LOCK_INVARIANT}

${customPromptOverride.trim()}

${genderRule}

${firstTurnLockdownInstruction}

${ZERO_UNPROBED_DEDUCTIONS_INVARIANT}

${deepDiveInstruction}

${breakpointCoachingInstruction}

${liveCoachingInstruction}

${batchContext}

[КОНТЕКСТ ВОПРОСА]
ВОПРОС: "${questionText}"
ЭТАЛОННЫЙ ОТВЕТ:
${referenceAnswer}

ЧЕК-ЛИСТ КРИТЕРИЕВ:
${anchors.map((a, i) => `[${i + 1}] ${a}`).join('\n')}

[ФИНАЛИЗАЦИЯ]
По окончании собеседования обязательно скажи краткое устное резюме и вызови функцию submit_interview_evaluation.

${LIVE_TOOL_CAPABILITY_DIRECTIVES}

${VOICE_NAVIGATION_CAPABILITY_DIRECTIVES}`;
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
СТЕК: ${primaryStack || 'Java 21, Spring Boot 3.3'}
ИЗВЕСТНЫЕ ПРОБЕЛЫ КАНДИДАТА ИЗ СМЕЖНЫХ ТЕМ:
${candidateGaps.map((g, i) => `  [Пробел ${i + 1}] "${g.errorConcept}" (Степень дефицита: ${g.deficitWeight.toFixed(1)}, Сходство: ${Math.round((g.similarity ?? 0.8) * 100)}%)`).join('\n')}
ДИРЕКТИВА: Если кандидат в ответе касается этой темы, обрати особое внимание. Если раскрыл сам и без ошибок — зафиксируй самостоятельное освоение. Если затрудняется — мягко направь наводящим вопросом.`
    : `=== 0. ПРОФИЛЬ КАНДИДАТА ===
ИНТЕРВЬЮЕР: ${personaDirectives.personaTitle}
${personaDirectives.gradeExpectationDirective}
СТЕК: ${primaryStack || 'Java 21, Spring Boot 3.3'}`;

  return `${LANGUAGE_LOCK_INVARIANT}

${firstTurnLockdownInstruction}

${candidateContextSection}

=== 1. РОЛЬ, ИДЕНТИЧНОСТЬ И СТИЛЬ (TOP INVARIANTS) ===
Ты ${personaDirectives.personaTitle} (${isFemale ? 'женщина' : 'мужчина'}) по теме «${topic}».
${personaDirectives.roleDirective}
${personaDirectives.evaluationRubricDirective}

${genderRule}

${cognitiveEpistemicDirectives}

${EXAM_ANTI_SYCOPHANCY_DIRECTIVES}

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
2. ЗОНДИРОВАНИЕ:
   - Сопоставляй ответ с критериями темы. Помни о TRIVIA IMMUNITY.
   - Задавай точечные зондирующие вопросы (до ${maxProbes} раундов) для добора баллов.
   - Произноси вопрос ПОЛНОСТЬЮ до конца. Запрещено обрывать речь!
3. ФИНАЛИЗАЦИЯ И ВЕРДИКТ (submit_interview_evaluation):
   - Произнеси объективное устное резюме (2-3 предложения) и назови вердикт.
   - Заполни criteriaBreakdown, deductions (если score < 100, сумма deductions строго 100 - score), score, isPassed, positivePoints, missingPoints, spokenFeedback.
   - В финале вердикта обязательно спроси: «Твой балл [score]. Готов перейти к следующему вопросу?» для перехода к следующей карточке темы.

${ZERO_UNPROBED_DEDUCTIONS_INVARIANT}

${LIVE_TOOL_CAPABILITY_DIRECTIVES}

${VOICE_NAVIGATION_CAPABILITY_DIRECTIVES}`;
}
