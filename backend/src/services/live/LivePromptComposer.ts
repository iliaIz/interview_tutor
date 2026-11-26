/**
 * LivePromptComposer.ts
 * Pure, declarative Gemini Live system prompt synthesizer (Spec 55).
 * Zero filesystem I/O inside composer; HR fixtures arrive via PreResolvedHrContext.
 * Cognitive Bounding Limit: <= 310 lines.
 */

import {
  isHrSessionType,
  isHrPersonaId,
  CandidateDossier,
  JobContext,
  HrQuestionRubricItem,
  HrQuestionChunk,
  HrSessionMode,
  HrPersonaId,
  HrBeatScope
} from '@interview-prep/shared';
import { InterviewPersonaId, TargetGrade, getPersonaPromptDirectives } from '../../prompts/personas';
import { CandidateGap } from '../vectorMemoryService';
import { getAiGenderDirective, getCandidateGenderDirective } from '../../prompts/core/genderDirectives';
import { LANGUAGE_LOCK_INVARIANT } from '../../prompts/core/languageDirectives';
import {
  EXAM_ANTI_SYCOPHANCY_DIRECTIVES,
  StrictnessLevel,
  getStrictnessDirectives
} from '../../prompts/core/antiSycophancy';
import { wrapUntrustedContext } from '../../prompts/core/sandboxDirectives';
import { DEFAULT_TURN_MODE, DEFAULT_VOICE_NAME } from '../../config/liveDefaults';
import { buildWeightedRubric } from './liveRubricBuilder';
import { buildHrSimulatorSystemPrompt } from './hrPromptBuilder';
import { resolveGuidedSessionBeats } from './hrGuidedStepper';
import { getChallengeDomain } from '../../utils/challengeDomain';
import { buildLivePairPrompt } from '../../prompts/live/livePairPrompts';
import { LiveSessionResolvedConfig } from './liveSessionConfigTypes';
import {
  LIVE_TOOL_CAPABILITY_DIRECTIVES,
  ZERO_UNPROBED_DEDUCTIONS_INVARIANT,
  FIRST_TURN_LOCKDOWN_INSTRUCTION,
  TUTOR_ZERO_GRADING_INSTRUCTION,
  STANDARD_TUTOR_TEMPLATES,
  buildCognitiveEpistemicDirectives,
  renderSystemDesignPrompt,
  renderMockInterviewPrompt
} from './livePromptModeTemplates';

export { LIVE_TOOL_CAPABILITY_DIRECTIVES, ZERO_UNPROBED_DEDUCTIONS_INVARIANT };

export interface PreResolvedHrContext {
  dossier: CandidateDossier;
  jobContext: JobContext;
  question?: HrQuestionRubricItem;
  chunk?: HrQuestionChunk;
}

export interface LiveIncidentContext {
  systemName?: string;
  architectureType?: string;
  incidentSymptoms?: string;
  businessImpact?: string;
  prReviewContext?: string;
  stackTrace?: string;
}

export interface LivePromptInput {
  topic?: string;
  questionText?: string;
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
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill' | 'hr_tutor' | string;
  hrMode?: HrSessionMode | string;
  hrPersonaId?: HrPersonaId | string;
  dossierId?: string;
  jobId?: string;
  questionMatrixId?: string;
  questionId?: string;
  chunkId?: string;
  startBeatId?: string;
  beatScope?: HrBeatScope | 'all_from_beat' | 'single_beat';
  tutorMode?: 'deep_dive' | 'free_chat' | 'socratic' | 'eli5' | 'quick_qa' | 'bug_hunt' | 'practice_pair' | string;
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  fixedCode?: string;
  unitTest?: string;
  incidentContext?: LiveIncidentContext | null;
  hints?: string[];
  parsedHints?: string[];
  primaryStack?: string;
  candidateGaps?: CandidateGap[];
  activeCodeArtifact?: { id?: string; title?: string; language?: string; code?: string } | null;
  codeRevisionsSummary?: Array<{ id: string; title: string }> | null;
  persona?: InterviewPersonaId | string;
  targetGrade?: TargetGrade;
  challengeCategory?: string;
  challengeTrack?: string;
  strictness?: StrictnessLevel;
  workspaceManifest?: any;
  academyBridgeContext?: any;
  seniorReview?: any;
}

const ARENA_ALLOWED_TOOLS: Record<string, string> = {
  interview: 'update_whiteboard, read_file, report_identified_smell, submit_interview_evaluation (ТОЛЬКО после устного ответа кандидата; ЗАПРЕЩЕНО на Turn 0)',
  system_design: 'update_whiteboard, read_file, report_identified_smell, inject_chaos_failure, record_candidate_observation, submit_hiring_committee_verdict (ЗАПРЕЩЕНО на Turn 0)',
  bug_hunt: 'update_whiteboard, read_file, report_identified_smell, mark_bug_solved',
  practice_pair: 'update_whiteboard, read_file, report_identified_smell',
  tutor: 'update_whiteboard, read_file, report_identified_smell',
  hr_tutor_guided: 'update_whiteboard, read_file, advance_hr_learning_step (ЗАПРЕЩЕНО на Turn 0)',
  hr_tutor: 'update_whiteboard, read_file',
  hr: 'update_whiteboard, read_file, advance_hr_phase, emit_hr_round_evaluation, submit_hr_evaluation (оценка ЗАПРЕЩЕНА на Turn 0)'
};

function resolveToolArenaKey(sessionType?: string, tutorMode?: string, hrMode?: string): string {
  if (sessionType === 'bug_hunt' || ((sessionType === 'tutor' || !sessionType) && tutorMode === 'bug_hunt')) return 'bug_hunt';
  if (sessionType === 'practice_pair' || ((sessionType === 'tutor' || !sessionType) && tutorMode === 'practice_pair')) return 'practice_pair';
  if (sessionType === 'system_design') return 'system_design';
  if (sessionType === 'hr_tutor') return hrMode === 'guided_zero_start' ? 'hr_tutor_guided' : 'hr_tutor';
  if (isHrSessionType(sessionType)) return 'hr';
  if (sessionType === 'tutor' || tutorMode === 'free_chat') return 'tutor';
  return 'interview';
}

export function buildLiveToolCapabilityDirectives(sessionType?: string, tutorMode?: string, hrMode?: string): string {
  const arenaKey = resolveToolArenaKey(sessionType, tutorMode, hrMode);
  const toolsList = ARENA_ALLOWED_TOOLS[arenaKey] || ARENA_ALLOWED_TOOLS.interview;
  return `${LIVE_TOOL_CAPABILITY_DIRECTIVES}
6. РАЗРЕШЁННЫЕ ИНСТРУМЕНТЫ ТЕКУЩЕЙ АРЕНЫ (${arenaKey}): ${toolsList}.`;
}

function buildHrSessionPrompt(input: LivePromptInput, hrContext?: PreResolvedHrContext): string {
  if (!hrContext) {
    throw new Error(`[LIVE_PROMPT_COMPOSER_ERROR] preResolvedHrContext is required for HR sessionType "${input.sessionType}"`);
  }
  const sessionType = input.sessionType!;
  const hrMode = (input.hrMode || (sessionType === 'hr_simulation' ? 'full_screening_simulation' : sessionType === 'hr_tutor' ? 'tutor_rehearsal' : 'rapid_fire_micro_drill')) as HrSessionMode;
  const personaId: HrPersonaId = isHrPersonaId(String(input.hrPersonaId || ''))
    ? (input.hrPersonaId as HrPersonaId)
    : isHrPersonaId(String(input.persona || ''))
    ? (input.persona as HrPersonaId)
    : sessionType === 'hr_tutor'
    ? 'mentor_coach'
    : 'friendly_sourcer';
  const beatScope: HrBeatScope = input.beatScope === 'single_beat' ? 'single_beat' : 'all_from_beat';
  const microBeats = hrMode === 'guided_zero_start' ? resolveGuidedSessionBeats(hrContext.question, { startBeatId: input.startBeatId, beatScope }) : [];
  const matchedIdx = input.startBeatId ? microBeats.findIndex((b) => b.id === input.startBeatId) : -1;
  const initialBeatIdx = matchedIdx >= 0 ? matchedIdx : 0;

  return buildHrSimulatorSystemPrompt({
    dossier: hrContext.dossier,
    jobContext: hrContext.jobContext,
    mode: hrMode,
    personaId,
    activeQuestion: hrContext.question,
    activeChunk: hrContext.chunk,
    activeBeat: microBeats[initialBeatIdx],
    beatIndex: initialBeatIdx,
    totalBeats: microBeats.length,
    beatScope,
    beatOutline: microBeats.map((b, idx) => `${idx + 1}. ${b.title}`).join(' | '),
    voiceName: input.voiceName || DEFAULT_VOICE_NAME,
    userGender: input.userGender || 'female',
    turnMode: input.turnMode || DEFAULT_TURN_MODE
  });
}

function buildTutorBranchPrompt(input: LivePromptInput, isFemale: boolean, genderRule: string, epistemic: string): string {
  const { customPromptOverride, tutorMode, questionText = '', referenceAnswer = '', topic = 'Java & Spring', bugTitle, bugExplanation, codeSnippet, fixedCode, unitTest, incidentContext, challengeCategory = '', challengeTrack = '', persona, activeCodeArtifact, workspaceManifest, academyBridgeContext, seniorReview } = input;
  const hints = input.hints ?? input.parsedHints;
  const toolDirectives = buildLiveToolCapabilityDirectives(input.sessionType || 'tutor', tutorMode);
  let body = '';

  if (customPromptOverride && customPromptOverride.trim().length > 20) {
    body = `${customPromptOverride.trim()}\n\n${genderRule}\n\n${epistemic}\n\n${TUTOR_ZERO_GRADING_INSTRUCTION}\n\n[КОНТЕКСТ ВОПРОСА]\nВОПРОС: "${questionText}"\nЭТАЛОННЫЙ ОТВЕТ:\n${referenceAnswer}\n\n=== ПРАВИЛА ОБУЧЕНИЯ (AI-ТЬЮТОР) ===\n1. Отвечай на вопросы кандидата емко (2-3 предложения вслух, до 25-35 слов), объясняй физику процессов и демонстрируй примеры на доске (update_whiteboard).\n2. РАЗГРАНИЧЕНИЕ ИСТИНЫ И ОШИБОК: Никогда не поддакивай ошибочным или неполным утверждениям ради вежливости. Если кандидат прав частично — четко отдели верную часть от ошибочной в первой же фразе. Если неправ — прямо укажи на ошибку и объясни корректный механизм.\n3. Категорически ЗАПРЕЩЕНО выставлять оценки, баллы и вызывать функцию submit_interview_evaluation.`;
  } else if (tutorMode === 'bug_hunt') {
    const inc = incidentContext ? `\n=== КОНТЕКСТ ПРОДАКШЕН-ИНЦИДЕНТА & ТЕЛЕМЕТРИЯ ===\nСИСТЕМА: ${incidentContext.systemName || 'Production Service'} (${incidentContext.architectureType || 'Микросервис'})\nСИМПТОМЫ / АЛЕРТЫ:\n"""\n${incidentContext.incidentSymptoms || 'Аномалия в логах/метриках'}\n"""\nБИЗНЕС-ВОЗДЕЙСТВИЕ: ${incidentContext.businessImpact || 'Замедление или сбой обработки запросов'}\n${incidentContext.prReviewContext ? `ПРЕДЫСТОРИЯ PR: ${incidentContext.prReviewContext}\n` : ''}${incidentContext.stackTrace ? `СТЕК-ТРЕЙС / ЛОГ:\n\`\`\`\n${incidentContext.stackTrace}\n\`\`\`\n` : ''}` : '';
    const sol = fixedCode ? `\n=== ЭТАЛОННОЕ ИСПРАВЛЕНИЕ (GOLDEN MASTER, ДЛЯ ТВОЕГО ЗНАНИЯ) ===\n\`\`\`java\n${fixedCode}\n\`\`\`\n` : '';
    const testBlk = unitTest ? `\n=== ВОСПРОИЗВОДЯЩИЙ UNIT-ТЕСТ ===\n\`\`\`java\n${unitTest}\n\`\`\`\n` : '';
    body = `=== 1. РОЛЬ: SENIOR ТЕХЛИД И НАСТАВНИК ПО CODE REVIEW ===\nТы опытный, объективный и доброжелательный ${isFemale ? 'техлид (женщина)' : 'техлид (мужчина)'}. Ты проводишь с кандидатом интерактивное устное код-ревью.\n${genderRule}\n\n${epistemic}\n\n=== 2. КОНТЕКСТ ЗАДАЧИ НА ЭКРАНЕ ===\nТЕМА: ${topic}\nНАЗВАНИЕ КЕЙСА: "${bugTitle || 'Поиск ошибки в коде'}"\nСУТЬ БАГА (ДЛЯ ТВОЕГО ЗНАНИЯ, НЕ СПОЙЛЕРИ СРАЗУ):\n"""\n${bugExplanation || 'Неочевидный баг в многопоточности, транзакциях или структурах данных.'}\n"""\n${inc}\nКОД НА ЭКРАНЕ:\n\`\`\`\n${codeSnippet || '// Код задачи'}\n\`\`\`\n${sol}${testBlk}\nПОДСКАЗКИ:\n${(hints || []).map((h, i) => `[Уровень ${i + 1}] ${h}`).join('\n')}\n\n=== 3. ПРАВИЛА ГОЛОСОВОГО ОБЩЕНИЯ И ТРИАЖА (CRITICAL AUDIO & EPISTEMIC INVARIANTS) ===\n1. КРАТКОСТЬ: Твои устные реплики должны быть краткими — СТРОГО 2-3 предложения (до 25-30 слов). Никаких длинных монологов!\n2. НЕ ЗАЧИТЫВАЙ КОД ГОЛОСОМ: Кандидат видит код на экране. Называй только номер строки или имя метода/переменной.\n3. ЗАПРЕТ ПУСТОЙ ПОХВАЛЫ: Категорически запрещено расточать восторги («блестяще», «отлично подмечено», «супер») на базовые наблюдения или сырые догадки.\n4. НАСТАВНИЧЕСТВО И ДЕМАРКАЦИЯ ГИПОТЕЗ:\n   - Если гипотеза кандидата ОШИБОЧНА: прямо и спокойно скажи, почему этот участок кода не является причиной бага, и верни фокус к реальному симптому.\n   - Если кандидат нашел ВТОРОСТЕПЕННУЮ проблему (code smell, но не root cause): четко разграничь — подтверди, что замечание валидно как рефакторинг, но прямо укажи, что корневой баг инцидента в другом месте, и дай компактную наводку (подсказка 1).\n   - Если кандидат застрял или просит подсказку: дай компактную техническую подсказку (подсказка 1 или 2) без готового ответа.\n   - Если кандидат ТОЧНО локализовал корневой баг И верно объяснил механику отказа: кратко подтверди точность диагноза по существу (без лести), в 1-2 предложениях резюмируй корректный фикс и вызови функцию mark_bug_solved.`;
  } else if (tutorMode === 'practice_pair') {
    const domain = getChallengeDomain({ category: challengeCategory, track: challengeTrack, slug: bugTitle });
    body = buildLivePairPrompt({ domain, persona: typeof persona === 'string' ? persona : 'middle_scaffold', isFemale, userGender: input.userGender, bugTitle, questionText, bugExplanation, referenceAnswer, codeSnippet, activeCodeArtifact: activeCodeArtifact ?? undefined, workspaceManifest, academyBridgeContext, seniorReview });
  } else if (tutorMode === 'free_chat') {
    const inc = incidentContext ? `\nПРОДАКШЕН-ИНЦИДЕНТ:\n- Система: ${incidentContext.systemName || ''}\n- Симптомы: ${incidentContext.incidentSymptoms || ''}\n` : '';
    const fix = fixedCode ? `\nЭТАЛОННЫЙ ФИКС:\n\`\`\`\n${fixedCode}\n\`\`\`\n` : '';
    const hnt = hints && hints.length > 0 ? `\nПОДСКАЗКИ:\n${hints.map((h, i) => `[${i + 1}] ${h}`).join('\n')}\n` : '';
    body = `=== 1. РОЛЬ: SENIOR ТЕХЛИД И ОБЪЕКТИВНЫЙ НАПАРНИК (СВОБОДНЫЙ ДИАЛОГ) ===\nТы доброжелательный, высококвалифицированный Senior Java/Spring архитектор ${isFemale ? '(женщина)' : '(мужчина)'} и напарник по парному программированию.\n${genderRule}\n\n${epistemic}\n\n[КОНТЕКСТ ОБСУЖДЕНИЯ]\nТЕМА: ${topic}\n${questionText ? `ВОПРОС: "${questionText}"` : ''}\n${referenceAnswer ? `ЭТАЛОННАЯ ТЕОРИЯ:\n"""\n${referenceAnswer}\n"""` : ''}\n${bugTitle ? `КЕЙС КОДА: "${bugTitle}"` : ''}\n${codeSnippet ? `КОД НА ЭКРАНЕ:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ''}${inc}${fix}${hnt}\n\n=== ПРАВИЛА СВОБОДНОГО ДИАЛОГА (CRITICAL INVARIANTS) ===\n1. БЕЗ ЭКЗАМЕНАЦИОННЫХ РАМОК И ЗАГАДОК: Кандидат пришел посоветоваться, проверить свою гипотезу или разобрать сложную деталь.\n2. ПРЯМЫЕ ОТВЕТЫ И СТРОГАЯ ПРОВЕРКА УТВЕРЖДЕНИЙ:\n   - Если кандидат задает вопрос («как это работает?», «почему тут ошибка?») — отвечай прямо, профессионально и по существу, опираясь на физику работы системы и лучшие инженерные практики.\n   - Если кандидат высказывает утверждение или предлагает свое решение — примени Эпистемический Триаж: никогда не соглашайся из вежливости. Если утверждение ошибочно — прямо не согласись и объясни, к какому багу или деградации это приведет. Если верно лишь отчасти — сразу проведи четкую границу между тем, где кандидат прав, и где он заблуждается.\n3. КРАТКОСТЬ УСТНОЙ РЕЧИ: Отвечай емко (2-3 предложения за раз, до 25-35 слов), без академических лекций и без зачитывания кода вслух.\n4. НЕПРЕРЫВНЫЙ ДИАЛОГ: После каждого емкого ответа или разбора переходи в режим прослушивания кандидата. НЕ пытайся завершить диалог самостоятельно.`;
  } else {
    const key = tutorMode === 'deep_dive' || tutorMode === 'socratic' || tutorMode === 'eli5' ? tutorMode : 'quick_qa';
    const tpl = STANDARD_TUTOR_TEMPLATES[key];
    body = `${tpl.roleHeader}\n${tpl.roleIntro(isFemale)}\n${genderRule}\n\n${epistemic}\n\n${tpl.contextTitle}\nВОПРОС: "${questionText}"\n${key === 'socratic' ? 'ЭТАЛОН:' : key === 'deep_dive' ? 'ЭТАЛОННЫЙ ОТВЕТ:' : 'ЭТАЛОН:'}\n"""\n${referenceAnswer}\n"""\n\n${tpl.rulesHeader}\n${tpl.rulesBody}`;
  }

  const locked = body.startsWith(LANGUAGE_LOCK_INVARIANT) ? body : `${LANGUAGE_LOCK_INVARIANT}\n\n${body}`;
  return `${locked}\n\n${toolDirectives}`;
}

export function composeLiveSystemPrompt(
  config: LiveSessionResolvedConfig | Partial<LivePromptInput>,
  preResolvedHrContext?: PreResolvedHrContext
): string {
  const input = config as LivePromptInput;
  const sessionType = input.sessionType;

  if (isHrSessionType(sessionType)) {
    return buildHrSessionPrompt(input, preResolvedHrContext);
  }

  const topic = input.topic || 'Java & Spring Framework';
  const questionText = input.questionText || '';
  const referenceAnswer = input.referenceAnswer || '';
  const voiceName = input.voiceName || DEFAULT_VOICE_NAME;
  const userGender = input.userGender || 'female';
  const turnMode = input.turnMode || DEFAULT_TURN_MODE;
  const strategy = input.strategy || 'adaptive_probing';
  const maxProbes = input.maxProbes ?? 3;
  const anchors = input.anchors || [];
  const primaryStack = input.primaryStack || 'Java 21, Spring Boot 3.3';
  const candidateGaps = input.candidateGaps || [];
  const persona = input.persona || 'mentor';
  const targetGrade = input.targetGrade || 'L5_SENIOR';
  const isFemale = ['Kore', 'Aoede'].includes(voiceName);

  const turnModeInstruction = turnMode === 'manual'
    ? `=== РЕЖИМ ВЕДЕНИЯ ДИАЛОГА: ПОШАГОВЫЙ С КОНТРОЛЕМ КАНДИДАТА (MANUAL TURN-TAKING) [ВКЛЮЧЕН] ===\n1. После того как ты озвучишь вопрос темы или наводящий вопрос, кандидат берет паузу на размышление.\n2. Пауза может длиться до нескольких минут (тишина). НЕ перебивай, НЕ делай поспешных выводов и НЕ пытайся отвечать за кандидата во время паузы.\n3. Кандидат сам нажмет кнопку «Закончить ответ», когда завершит свою мысль. Только после этого проанализируй ответ и дай развернутый фидбек.`
    : `=== РЕЖИМ ВЕДЕНИЯ ДИАЛОГА: СВОБОДНЫЙ ДИАЛОГ (FULL DUPLEX AUTO-VAD) ===\nСлушай речь кандидата и реагируй после естественных пауз в ответе.`;

  const whiteboardInstruction = `=== ИНТЕРАКТИВНАЯ ДОСКА И ДЕМОНСТРАЦИЯ КОДА (ИНСТРУМЕНТ: update_whiteboard) ===\nУ кандидата на экране есть выдвижная интерактивная доска для кода и схем.\nЕсли кандидат просит показать пример кода («покажи на коде», «напиши пример», «как это выглядит в Spring / Java», «напиши реализацию»),\nили если при объяснении устройства под капотом, паттерна, структуры данных, алгоритма или аннотации полезно наглядно показать код:\n1. ОБЯЗАТЕЛЬНО вызови инструмент \`update_whiteboard\` со структурированным сниппетом (action: 'write' | 'patch' | 'highlight' | 'clear', title: '...', language: 'java', code: '...', highlightLines: [...], explanation: '...').\n2. Одновременно голосом сразу объясни суть фрагмента и на что обратить внимание. Избегай сервисных фраз («я вывела код на доску») — сразу переходи к техническому содержанию.\n3. Когда ты переходишь к новой теме или стираешь код — вызови \`update_whiteboard\` с action: 'clear'.`;

  const activeArt = input.activeCodeArtifact;
  const revSummary = input.codeRevisionsSummary;
  const activeArtifactSection = activeArt?.code
    ? `\n=== АКТИВНЫЙ КОД НА ЭКРАНЕ КАНДИДАТА (${activeArt.id || 'активная версия'}: "${activeArt.title || 'Сниппет'}") ===\n${wrapUntrustedContext('active_code_artifact', activeArt.code)}\n${(revSummary && revSummary.length > 1) ? `\nДРУГИЕ ВЕРСИИ КОДА В ИСТОРИИ СЕССИИ (Кандидат сейчас просматривает версию ${activeArt.id || 'активную'}):\n${revSummary.map((r) => `  - [${r.id}] ${r.title} ${r.id === activeArt.id ? '(АКТИВНА)' : ''}`).join('\n')}\n` : ''}ДИРЕКТИВА ПО КОНТЕКСТУ КОДА: Кандидат сейчас смотрит на версию ${activeArt.id || 'активную'}. Если он задает вопрос по коду или строкам («почему тут так?», «что в 5-й строке?»), отвечай применительно именно к этому сниппету.\n`
    : '';

  const effectiveStrictness: StrictnessLevel = input.strictness || (sessionType === 'tutor' ? 'learning' : (targetGrade === 'L6_STAFF' || persona === 'amazon_bar_raiser' ? 'hardcore' : 'standard'));
  const epistemic = buildCognitiveEpistemicDirectives(getStrictnessDirectives(effectiveStrictness));
  const genderRule = `${getAiGenderDirective(isFemale)}\n\n${getCandidateGenderDirective(userGender)}\n\n${turnModeInstruction}\n\n${whiteboardInstruction}${activeArtifactSection}${sessionType === 'tutor' ? `\n\n${TUTOR_ZERO_GRADING_INSTRUCTION}` : ''}`;

  if (sessionType === 'tutor' || input.tutorMode === 'practice_pair' || input.tutorMode === 'bug_hunt' || input.tutorMode === 'free_chat') {
    return buildTutorBranchPrompt(input, isFemale, genderRule, epistemic);
  }

  const rubric = buildWeightedRubric(referenceAnswer, questionText, anchors);
  const anchorsFormatted = rubric.map((r, i) => `  [Критерий ${i + 1}: ${r.id}] (Вес: ${r.weight} б.) ${r.title}\n    Суть: ${r.description}`).join('\n');

  if (sessionType === 'system_design') {
    return renderSystemDesignPrompt({
      isFemale, genderRule, questionText, topic, referenceAnswer, anchorsFormatted,
      codeSnippet: input.codeSnippet, customPromptOverride: input.customPromptOverride,
      toolDirectives: buildLiveToolCapabilityDirectives('system_design')
    });
  }

  const interviewTools = buildLiveToolCapabilityDirectives('interview');
  const qIndex = input.questionIndex ?? 0;
  const totalQ = input.totalQuestions ?? 0;
  const batchContext = totalQ > 1
    ? `=== КОНТЕКСТ СЕРИИ ВОПРОСОВ (HANDS-FREE MOCK INTERVIEW) ===\nТы проводишь серию вопросов (вопрос ${qIndex + 1} из ${totalQ}).\n${qIndex + 1 < totalQ ? 'В финале текущего ответа кратко подведи итог и вызови submit_interview_evaluation. НЕ прощайся окончательно, так как сразу последует следующий вопрос темы.' : 'Это заклютельный вопрос серии. После вызова submit_interview_evaluation поблагодари за всё пройденное собеседование.'}`
    : '';
  const deepDiveInstruction = input.deepDive
    ? `=== РЕЖИМ ЗОНДИРОВАНИЯ: ГЛУБОКОЕ ЗОНДИРОВАНИЕ (DEEP-DIVE & UNDER-THE-HOOD) [ВКЛЮЧЕН] ===\nТы НЕ ограничен только формулировкой эталонного ответа. Твоя цель — исследовать реальную глубину знаний кандидата:\n1. Если кандидат уверенно отвечает, копай глубже под капот (low-level механизмы, прокси, рефлексия, многопоточность, транзакции, память).\n2. Задавай вопросы на краевые случаи (Edge Cases) и смежные концепции 1-го круга смежности (Radius-1: AOP, JDBC, Concurrency, Virtual Threads).\n3. Проверяй понимание («А что произойдет, если...?», «Почему именно такой подход, а не альтернативный?»).\n4. Правило возврата (Breadcrumb): не уходи глубже 2 шагов в одну подтему — кратко резюмируй и возвращайся к основному контексту вопроса темы.`
    : `=== РЕЖИМ ЗОНДИРОВАНИЯ: СТАНДАРТНЫЙ СКОУП (ПО ЭТАЛОНУ) ===\nТвои ожидания и вопросы СТРОГО ограничены фактурой из ЭТАЛОННОГО ОТВЕТА. Не уходи в оффтоп и далекие смежные технологии, которых нет в эталоне.`;
  const breakpointCoachingInstruction = `=== 4. ПРОТОКОЛ БРЕЙКПОИНТА И КАПИТУЛЯЦИИ (INTERACTIVE BREAKPOINT & SANDBOX) ===\nЕсли кандидат говорит «Не знаю», «Не помню», «Подскажи», «Расскажи как правильно», «Сдаюсь», «Зафиксируй пробел» или поступает системный запрос на объяснение:\n1. НЕ спорь, НЕ молчи и НЕ продолжай настаивать на ответе.\n2. Мгновенно переключись в поддерживающего Senior-наставника (Sandbox Breakpoint).\n3. Дай емкое, живое 30-40 секундное объяснение под капотом (Micro-Lecture):\n   - [Суть в 1 предложение простыми словами]\n   - [Как физически устроено под капотом: JVM, Spring, многопоточность, память, структуры данных]\n   - [«Золотая фраза для собеседования»]: точная формулировка, которую ценят Senior-интервьюеры.\n4. В конце своего объяснения ОБЯЗАТЕЛЬНО задай кандидату вопрос для выбора пути:\n   «Понятна ли эта концепция? Хотите уточнить какую-то деталь, попробовать ответить на вопрос заново с чистого листа или пойдем дальше?»\n5. Если кандидат задает встречный вопрос («А почему именно так?», «Объясни еще про...») — подробно и дружелюбно ответь в режиме наставника.\n6. Если кандидат говорит «Давай заново / хочу попробовать сама / начни сначала» — скажи «Отлично, давай с чистого листа!» и четко переспроси вопрос.\n7. Если кандидат говорит «Пойдем дальше / всё понятно» — произнеси краткое устное резюме и вызови submit_interview_evaluation со справедливой оценкой первой попытки (зафиксировав упущенный критерий в missingPoints).`;
  const liveCoachingInstruction = input.liveCoaching
    ? `=== РЕЖИМ ОБУЧЕНИЯ: РАЗБОР ОШИБОК И ОБУЧЕНИЕ НА ЛЕТУ (LIVE COACHING) [ВКЛЮЧЕН] ===\nЕсли кандидат допускает неточность или ошибку — сразу примени протокол брейкпоинта и Micro-Lecture выше.\nВ итоговой оценке (submit_interview_evaluation) обязательно отметь, что материал был успешно усвоен в процессе диалога.`
    : `=== РЕЖИМ ОЦЕНКИ С ПОДДЕРЖКОЙ БРЕЙКПОИНТА ===\nПока кандидат сам отвечает — оценивай без подсказок. Но если кандидат явно просит объяснить или сдается — строго следуй протоколу брейкпоинта выше.`;

  if (input.customPromptOverride && input.customPromptOverride.trim().length > 20) {
    return [
      LANGUAGE_LOCK_INVARIANT, input.customPromptOverride.trim(), genderRule, epistemic,
      EXAM_ANTI_SYCOPHANCY_DIRECTIVES, FIRST_TURN_LOCKDOWN_INSTRUCTION, batchContext,
      ZERO_UNPROBED_DEDUCTIONS_INVARIANT, deepDiveInstruction, breakpointCoachingInstruction, liveCoachingInstruction,
      `[КОНТЕКСТ ВОПРОСА]\nВОПРОС: "${questionText}"\nЭТАЛОННЫЙ ОТВЕТ:\n${referenceAnswer}\n\nЧЕК-ЛИСТ КРИТЕРИЕВ:\n${anchors.map((a, i) => `[${i + 1}] ${a}`).join('\n')}\n\n[ФИНАЛИЗАЦИЯ И ЭПИСТЕМИЧЕСКИЙ ЗАМОК]\nПо окончании собеседования обязательно скажи краткое устное резюме и вызови функцию submit_interview_evaluation.\nКАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО завышать оценку или соглашаться с ошибочными ответами кандидата из вежливости!`,
      interviewTools
    ].filter(Boolean).join('\n\n');
  }

  const personaDirectives = getPersonaPromptDirectives({ persona: (persona as InterviewPersonaId) || 'mentor', targetGrade, topic });
  const candidateContextSection = candidateGaps.length > 0
    ? `=== 0. ПРОФИЛЬ И СМЕЖНЫЕ ЗОНЫ ВНИМАНИЯ (EPISODIC VECTOR MEMORY) ===\nИНТЕРВЬЮЕР: ${personaDirectives.personaTitle}\n${personaDirectives.gradeExpectationDirective}\nСТЕК: ${primaryStack}\nИЗВЕСТНЫЕ ПРОБЕЛЫ КАНДИДАТА ИЗ СМЕЖНЫХ ТЕМ:\n${candidateGaps.map((g, i) => `  [Пробел ${i + 1}] "${g.errorConcept}" (Степень дефицита: ${g.deficitWeight.toFixed(1)}, Сходство: ${Math.round((g.similarity ?? 0.8) * 100)}%)`).join('\n')}\nДИРЕКТИВА: Если кандидат в ответе касается этой темы, обрати особое внимание. Если раскрыл сам и без ошибок — зафиксируй самостоятельное освоение. Если затрудняется — мягко направь наводящим вопросом.`
    : `=== 0. ПРОФИЛЬ КАНДИДАТА ===\nИНТЕРВЬЮЕР: ${personaDirectives.personaTitle}\n${personaDirectives.gradeExpectationDirective}\nСТЕК: ${primaryStack}`;

  return renderMockInterviewPrompt({
    candidateContextSection, personaDirectives, isFemale, topic, genderRule,
    cognitiveEpistemicDirectives: epistemic, batchContext, deepDiveInstruction,
    breakpointCoachingInstruction, liveCoachingInstruction, questionText, referenceAnswer,
    anchorsFormatted, maxProbes, rubricIds: rubric.map((r) => r.id),
    isSocraticMentor: strategy === 'socratic_tutoring' && persona === 'mentor',
    toolDirectives: interviewTools
  });
}

export function buildSystemPrompt(
  params: LiveSessionResolvedConfig | Partial<LivePromptInput>,
  preResolvedHrContext?: PreResolvedHrContext
): string {
  return composeLiveSystemPrompt(params, preResolvedHrContext);
}
