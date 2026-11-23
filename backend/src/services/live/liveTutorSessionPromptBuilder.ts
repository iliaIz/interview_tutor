/**
 * liveTutorSessionPromptBuilder.ts
 * Prompt synthesis for Live Tutor modes (deep_dive, socratic, eli5, bug_hunt, practice_pair, free_chat).
 * Cognitive Bounding Limit: <= 160 lines (Rule 8 compliant).
 */

import { LANGUAGE_LOCK_INVARIANT } from '../../prompts/core/languageDirectives';
import { LIVE_TOOL_CAPABILITY_DIRECTIVES } from './livePromptBuilderConstants';
import { getChallengeDomain } from '../../utils/challengeDomain';
import { buildLivePairPrompt } from '../../prompts/live/livePairPrompts';
import {
  buildTutorCustomOverridePrompt,
  buildBugHuntTutorPrompt,
  buildFreeChatTutorPrompt,
  buildDeepDiveTutorPrompt,
  buildSocraticTutorPrompt,
  buildEli5TutorPrompt,
  buildQuickQaTutorPrompt
} from './liveTutorPromptDirectives';

export interface TutorPromptParams {
  customPromptOverride?: string;
  tutorMode?: string;
  isFemale: boolean;
  userGender?: string;
  genderRule: string;
  cognitiveEpistemicDirectives: string;
  questionText?: string;
  referenceAnswer?: string;
  topic?: string;
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  fixedCode?: string;
  unitTest?: string;
  incidentContext?: any;
  hints?: string[];
  challengeCategory?: string;
  challengeTrack?: string;
  persona?: any;
  activeCodeArtifact?: any;
  workspaceManifest?: any;
  academyBridgeContext?: any;
  seniorReview?: any;
}

export function buildTutorSessionLivePrompt(params: TutorPromptParams): string {
  const {
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
    challengeCategory = '',
    challengeTrack = '',
    persona,
    activeCodeArtifact,
    workspaceManifest,
    academyBridgeContext,
    seniorReview
  } = params;

  let tutorPrompt = '';

  if (customPromptOverride && customPromptOverride.trim().length > 20) {
    tutorPrompt = buildTutorCustomOverridePrompt({
      customPromptOverride,
      genderRule,
      cognitiveEpistemicDirectives,
      questionText: questionText || '',
      referenceAnswer: referenceAnswer || ''
    });
  } else if (tutorMode === 'bug_hunt') {
    const incidentBlock = incidentContext
      ? `\n=== КОНТЕКСТ ПРОДАКШЕН-ИНЦИДЕНТА & ТЕЛЕМЕТРИЯ ===
СИСТЕМА: ${incidentContext.systemName || 'Production Service'} (${incidentContext.architectureType || 'Микросервис'})
СИМПТОМЫ / АЛЕРТЫ:
"""
${incidentContext.incidentSymptoms || 'Аномалия в логах/метриках'}
"""
БИЗНЕС-ВОЗДЕЙСТВИЕ: ${incidentContext.businessImpact || 'Замедление или сбой обработки запросов'}
${incidentContext.prReviewContext ? `ПРЕДЫСТОРИЯ PR: ${incidentContext.prReviewContext}\n` : ''}${incidentContext.stackTrace ? `СТЕК-ТРЕЙС / ЛОГ:\n\`\`\`\n${incidentContext.stackTrace}\n\`\`\`\n` : ''}`
      : '';

    const solutionBlock = fixedCode
      ? `\n=== ЭТАЛОННОЕ ИСПРАВЛЕНИЕ (GOLDEN MASTER, ДЛЯ ТВОЕГО ЗНАНИЯ) ===
\`\`\`java
${fixedCode}
\`\`\`\n`
      : '';

    const unitTestBlock = unitTest
      ? `\n=== ВОСПРОИЗВОДЯЩИЙ UNIT-ТЕСТ ===
\`\`\`java
${unitTest}
\`\`\`\n`
      : '';

    const taskContextBlock = `=== 2. КОНТЕКСТ ЗАДАЧИ НА ЭКРАНЕ ===
ТЕМА: ${topic}
НАЗВАНИЕ КЕЙСА: "${bugTitle || 'Поиск ошибки в коде'}"
СУТЬ БАГА (ДЛЯ ТВОЕГО ЗНАНИЯ, НЕ СПОЙЛЕРИ СРАЗУ):
"""
${bugExplanation || 'Неочевидный баг в многопоточности, транзакциях или структурах данных.'}
"""
${incidentBlock}
КОД НА ЭКРАНЕ:
\`\`\`
${codeSnippet || '// Код задачи'}
\`\`\`
${solutionBlock}${unitTestBlock}
ПОДСКАЗКИ:
${(hints || []).map((h, i) => `[Уровень ${i + 1}] ${h}`).join('\n')}`;

    tutorPrompt = buildBugHuntTutorPrompt({
      isFemale,
      genderRule,
      cognitiveEpistemicDirectives,
      taskContextBlock
    });
  } else if (tutorMode === 'practice_pair') {
    const domain = getChallengeDomain({ category: challengeCategory, track: challengeTrack, slug: bugTitle });
    tutorPrompt = buildLivePairPrompt({
      domain,
      persona: typeof persona === 'string' ? persona : 'middle_scaffold',
      isFemale,
      userGender: userGender as any,
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
  } else if (tutorMode === 'free_chat') {
    const incidentInfo = incidentContext
      ? `\nПРОДАКШЕН-ИНЦИДЕНТ:\n- Система: ${incidentContext.systemName || ''}\n- Симптомы: ${incidentContext.incidentSymptoms || ''}\n`
      : '';
    const fixedInfo = fixedCode ? `\nЭТАЛОННЫЙ ФИКС:\n\`\`\`\n${fixedCode}\n\`\`\`\n` : '';
    const hintsInfo = hints && hints.length > 0 ? `\nПОДСКАЗКИ:\n${hints.map((h, i) => `[${i + 1}] ${h}`).join('\n')}\n` : '';

    const contextBlock = `[КОНТЕКСТ ОБСУЖДЕНИЯ]
ТЕМА: ${topic || 'Java & Spring'}
${questionText ? `ВОПРОС: "${questionText}"` : ''}
${referenceAnswer ? `ЭТАЛОННАЯ ТЕОРИЯ:\n"""\n${referenceAnswer}\n"""` : ''}
${bugTitle ? `КЕЙС КОДА: "${bugTitle}"` : ''}
${codeSnippet ? `КОД НА ЭКРАНЕ:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ''}${incidentInfo}${fixedInfo}${hintsInfo}`;

    tutorPrompt = buildFreeChatTutorPrompt({
      isFemale,
      genderRule,
      cognitiveEpistemicDirectives,
      contextBlock
    });
  } else if (tutorMode === 'deep_dive') {
    tutorPrompt = buildDeepDiveTutorPrompt({
      isFemale,
      genderRule,
      cognitiveEpistemicDirectives,
      questionText: questionText || '',
      referenceAnswer: referenceAnswer || ''
    });
  } else if (tutorMode === 'socratic') {
    tutorPrompt = buildSocraticTutorPrompt({
      isFemale,
      genderRule,
      cognitiveEpistemicDirectives,
      questionText: questionText || '',
      referenceAnswer: referenceAnswer || ''
    });
  } else if (tutorMode === 'eli5') {
    tutorPrompt = buildEli5TutorPrompt({
      isFemale,
      genderRule,
      cognitiveEpistemicDirectives,
      questionText: questionText || '',
      referenceAnswer: referenceAnswer || ''
    });
  } else {
    tutorPrompt = buildQuickQaTutorPrompt({
      isFemale,
      genderRule,
      cognitiveEpistemicDirectives,
      questionText: questionText || '',
      referenceAnswer: referenceAnswer || ''
    });
  }

  const finalTutorPrompt = tutorPrompt.startsWith(LANGUAGE_LOCK_INVARIANT)
    ? tutorPrompt
    : `${LANGUAGE_LOCK_INVARIANT}\n\n${tutorPrompt}`;

  return `${finalTutorPrompt}\n\n${LIVE_TOOL_CAPABILITY_DIRECTIVES}`;
}
