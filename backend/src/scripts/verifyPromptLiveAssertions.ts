/**
 * verifyPromptLiveAssertions.ts
 * Automated verification for LiveVoice prompts, LivePromptComposer, tool capability bounds,
 * Turn 0 lockdown, Extended Thinking tools, and HR matrix/composer integration (Spec 55 <= 330L).
 */

import { PromptRegistry } from '../prompts';
import {
  composeLiveSystemPrompt,
  buildSystemPrompt,
  LIVE_TOOL_CAPABILITY_DIRECTIVES,
  buildLiveToolCapabilityDirectives,
  PreResolvedHrContext
} from '../services/live/LivePromptComposer';
import { envConfig } from '../config/env';
import { getLiveToolDeclarations } from '../services/live/liveToolDeclarations';
import {
  getCandidateDossier,
  getJobContext,
  getHrQuestion,
  resolveQuestionMatrix
} from '../services/live/hrContextResolver';
import type { PromptAssertFn } from './verifyPromptTextAssertions';

export function runPromptLiveAssertions(assert: PromptAssertFn): void {
  // 1. Live Audio Pair Tutoring Prompt
  const livePairPrompt = PromptRegistry.buildLivePairPrompt({
    domain: 'lld',
    persona: 'senior_socratic',
    isFemale: true,
    userGender: 'female',
    bugTitle: 'Rate Limiter',
    questionText: 'How to design Rate Limiter without Thread.sleep?',
    codeSnippet: 'class RateLimiter {}',
    seniorReview: { overallScore: 85, summaryReview: 'Good effort but needs work on concurrency', findings: [] }
  });
  assert(livePairPrompt.includes('VOICE ANTI-SYCOPHANCY'), 'Live pair prompt contains VOICE ANTI-SYCOPHANCY directive');
  assert(!livePairPrompt.includes('похвали и предложи'), 'Live pair prompt does NOT contain sycophantic "похвали и предложи" directive');
  assert(livePairPrompt.includes('ТРИАЖ ГИПОТЕЗ КАНДИДАТА (БЕЗ ПУСТОЙ ПОХВАЛЫ)'), 'Live pair prompt contains hypothesis triage without flattery directive');
  assert(livePairPrompt.includes('МУЛЬТИМОДАЛЬНЫЙ СИМБИОЗ') || livePairPrompt.includes('MULTIMODAL SYMBIOSIS'), 'Live pair prompt contains MULTIMODAL SYMBIOSIS directive');
  assert(livePairPrompt.includes('update_whiteboard'), 'Live pair prompt instructs to use update_whiteboard');
  assert(livePairPrompt.includes('ГРАММАТИЧЕСКИЙ РОД ИИ (СТРОГО ЖЕНСКИЙ)'), 'Live pair prompt adheres to AI female voice gender rule');
  assert(livePairPrompt.includes('БЕЗУСЛОВНЫЙ ЯЗЫКОВОЙ ИНВАРИАНТ'), 'Live pair prompt contains top-level LANGUAGE_LOCK_INVARIANT');
  assert(livePairPrompt.includes('ZERO LANGUAGE DRIFT'), 'Live pair prompt contains ZERO LANGUAGE DRIFT directive');
  assert(livePairPrompt.includes('CODE-SWITCHING RULES'), 'Live pair prompt contains Code-Switching handling rules');

  // 2. Live Prompt Composer Integration across Tutor & Exam modes
  const practicePairLivePrompt = composeLiveSystemPrompt({
    topic: 'LLD',
    questionText: 'Parking Lot',
    referenceAnswer: 'Model parking spaces',
    strategy: 'socratic_tutoring',
    voiceName: 'Kore',
    maxProbes: 2,
    anchors: ['Classes', 'Locks'],
    tutorMode: 'practice_pair',
    challengeCategory: 'Low-Level Design (LLD)',
    codeSnippet: 'class EditorParkingLot {}',
    activeCodeArtifact: { id: 'code1', title: 'ParkingLot.java', code: 'class ParkingLot {}' }
  });
  assert(practicePairLivePrompt.includes('БЕЗУСЛОВНЫЙ ЯЗЫКОВОЙ ИНВАРИАНТ'), 'composeLiveSystemPrompt(practice_pair) includes LANGUAGE_LOCK_INVARIANT');
  assert(practicePairLivePrompt.includes('VOICE ANTI-SYCOPHANCY'), 'composeLiveSystemPrompt(practice_pair) includes VOICE ANTI-SYCOPHANCY');
  assert(practicePairLivePrompt.includes('<user_code_snippet>'), 'composeLiveSystemPrompt(practice_pair) wraps editor code in XML sandbox delimiter');
  assert(practicePairLivePrompt.includes('<active_whiteboard_artifact>'), 'composeLiveSystemPrompt(practice_pair) wraps active whiteboard artifact in XML sandbox');

  const freeChatLivePrompt = composeLiveSystemPrompt({
    topic: 'LLD',
    questionText: 'Parking Lot',
    referenceAnswer: 'Model parking spaces',
    strategy: 'socratic_tutoring',
    voiceName: 'Kore',
    maxProbes: 2,
    anchors: ['Classes', 'Locks'],
    tutorMode: 'free_chat',
    activeCodeArtifact: { id: 'code1', title: 'ParkingLot.java', code: 'class ParkingLot {}' }
  });
  assert(freeChatLivePrompt.includes('<active_code_artifact>'), 'composeLiveSystemPrompt(free_chat) wraps activeCodeArtifact in XML sandbox delimiter');
  assert(freeChatLivePrompt.includes('СТРОГИЕ ГРАНИЦЫ ИНСТРУМЕНТОВ И ИСПОЛНЕНИЯ'), 'Free chat tutor prompt enforces LIVE_TOOL_CAPABILITY_DIRECTIVES');
  assert(freeChatLivePrompt.includes('БЕЗУСЛОВНЫЙ ЯЗЫКОВОЙ ИНВАРИАНТ'), 'Free chat tutor prompt enforces LANGUAGE_LOCK_INVARIANT');
  assert(freeChatLivePrompt.includes('Эпистемический Триаж: никогда не соглашайся из вежливости'), 'Free chat tutor prompt enforces Epistemic Triage against agreement for politeness');

  const bugHuntLivePrompt = composeLiveSystemPrompt({
    topic: 'Concurrency',
    questionText: 'Find Bug',
    referenceAnswer: 'Race condition on counter',
    strategy: 'socratic_tutoring',
    voiceName: 'Puck',
    maxProbes: 2,
    anchors: ['AtomicLong', 'Visibility'],
    tutorMode: 'bug_hunt'
  });
  assert(bugHuntLivePrompt.includes('VOICE ANTI-SYCOPHANCY'), 'composeLiveSystemPrompt(bug_hunt) includes VOICE ANTI-SYCOPHANCY');
  assert(!bugHuntLivePrompt.includes('похвали, в 1-2 предложениях'), 'Bug hunt prompt does NOT contain sycophantic "похвали" command');
  assert(!bugHuntLivePrompt.includes('мягко подтверди'), 'Bug hunt prompt does NOT contain "мягко подтверди"');
  assert(bugHuntLivePrompt.includes('НАСТАВНИЧЕСТВО И ДЕМАРКАЦИЯ ГИПОТЕЗ'), 'Bug hunt prompt contains hypothesis triage & demarcation directive');

  const examLivePrompt = composeLiveSystemPrompt({
    topic: 'Spring Boot',
    questionText: 'Explain @Transactional',
    referenceAnswer: 'AOP proxy, rollback on RuntimeException',
    strategy: 'socratic_tutoring',
    voiceName: 'Kore',
    maxProbes: 2,
    anchors: ['AOP', 'Propagation'],
    sessionType: 'interview'
  });
  assert(examLivePrompt.includes('EXAM ANTI-SYCOPHANCY'), 'composeLiveSystemPrompt(interview) includes EXAM ANTI-SYCOPHANCY');

  // 3. Gemini 3.8 Live Extended Thinking Configuration & Tool Invariants
  assert(envConfig.models.liveThinking === 'gemini-live-thinking-v3', `envConfig.models.liveThinking is properly configured (got ${envConfig.models.liveThinking})`);
  assert(envConfig.models.supportedLiveModels.includes('gemini-live-thinking-v3'), 'models.supportedLiveModels includes gemini-live-thinking-v3');
  const baseTools = getLiveToolDeclarations('interview');
  assert(baseTools.length > 0, 'getLiveToolDeclarations returns tools for interview');
  const thinkingTools = baseTools.map((t) => ({ ...t, behavior: 'NON_BLOCKING' }));
  assert(thinkingTools.every((t) => t.behavior === 'NON_BLOCKING'), 'Thinking model tools normalization enforces behavior: NON_BLOCKING on all function declarations');

  // 4. Tool Capability Invariants & Role-Accurate Tool Lists
  assert(LIVE_TOOL_CAPABILITY_DIRECTIVES.includes('update_whiteboard'), 'LIVE_TOOL_CAPABILITY_DIRECTIVES specifies update_whiteboard');
  assert(LIVE_TOOL_CAPABILITY_DIRECTIVES.includes('НЕТ ДОСТУПА К СЕРВЕРУ, BASH ИЛИ RUNTIME'), 'LIVE_TOOL_CAPABILITY_DIRECTIVES forbids server, bash and runtime execution');
  assert(LIVE_TOOL_CAPABILITY_DIRECTIVES.includes('НЕТ ДОСТУПА В ИНТЕРНЕТ'), 'LIVE_TOOL_CAPABILITY_DIRECTIVES explicitly defines no internet in live voice mode');
  assert(LIVE_TOOL_CAPABILITY_DIRECTIVES.includes('КАТЕГОРИЧЕСКИЙ ЗАПРЕТ ДЕЛЕГИРОВАНИЯ И ВЫЗОВА ФАНТОМНЫХ ТУЛОВ'), 'LIVE_TOOL_CAPABILITY_DIRECTIVES strictly forbids phantom tool delegation');

  const mockToolsDir = buildLiveToolCapabilityDirectives('interview');
  assert(mockToolsDir.includes('submit_interview_evaluation') && !mockToolsDir.includes('mark_bug_solved'), 'buildLiveToolCapabilityDirectives(interview) lists submit_interview_evaluation accurately');
  const sdToolsDir = buildLiveToolCapabilityDirectives('system_design');
  assert(sdToolsDir.includes('inject_chaos_failure') && sdToolsDir.includes('submit_hiring_committee_verdict') && !sdToolsDir.includes('submit_interview_evaluation'), 'buildLiveToolCapabilityDirectives(system_design) lists System Design tools accurately');
  const bugToolsDir = buildLiveToolCapabilityDirectives('bug_hunt');
  assert(bugToolsDir.includes('mark_bug_solved') && !bugToolsDir.includes('submit_interview_evaluation'), 'buildLiveToolCapabilityDirectives(bug_hunt) lists mark_bug_solved accurately');
  const pairToolsDir = buildLiveToolCapabilityDirectives('practice_pair');
  assert(pairToolsDir.includes('update_whiteboard') && pairToolsDir.includes('read_file') && !pairToolsDir.includes('submit_interview_evaluation') && !pairToolsDir.includes('mark_bug_solved'), 'buildLiveToolCapabilityDirectives(practice_pair) lists pair workspace tools accurately');

  const deepDivePrompt = composeLiveSystemPrompt({
    sessionType: 'tutor',
    tutorMode: 'deep_dive',
    topic: 'JVM Internals',
    questionText: 'How does JMM handle volatile memory barriers?',
    referenceAnswer: 'LoadLoad, LoadStore, StoreStore, StoreLoad barriers.'
  });
  assert(deepDivePrompt.includes('СТРОГИЕ ГРАНИЦЫ ИНСТРУМЕНТОВ И ИСПОЛНЕНИЯ'), 'Deep-dive tutor prompt enforces LIVE_TOOL_CAPABILITY_DIRECTIVES');
  assert(deepDivePrompt.includes('БЕЗУСЛОВНЫЙ ЯЗЫКОВОЙ ИНВАРИАНТ'), 'Deep-dive tutor prompt enforces LANGUAGE_LOCK_INVARIANT');

  const interviewPrompt = composeLiveSystemPrompt({
    sessionType: 'interview',
    topic: 'Java Concurrency',
    questionText: 'Explain volatile semantics'
  });
  assert(interviewPrompt.includes('СТРОГИЕ ГРАНИЦЫ ИНСТРУМЕНТОВ И ИСПОЛНЕНИЯ'), 'Interview prompt enforces LIVE_TOOL_CAPABILITY_DIRECTIVES');
  assert(interviewPrompt.includes('БЕЗУСЛОВНЫЙ ЯЗЫКОВОЙ ИНВАРИАНТ'), 'Interview prompt enforces LANGUAGE_LOCK_INVARIANT');
  assert(interviewPrompt.includes('FIRST-TURN LOCKDOWN'), 'Interview adaptive_probing prompt enforces Turn 0 Lockdown');

  const sysDesignPrompt = composeLiveSystemPrompt({
    sessionType: 'system_design',
    topic: 'Distributed Cache',
    questionText: 'Design a distributed cache like Redis'
  });
  assert(sysDesignPrompt.includes('БЕЗУСЛОВНЫЙ ЯЗЫКОВОЙ ИНВАРИАНТ'), 'System design live prompt enforces LANGUAGE_LOCK_INVARIANT');

  // 5. Spec 20 & Spec 55: socratic_tutoring + mentor AND customPromptOverride invariants
  console.log('\n--- Spec 20 & Spec 55 Live Epistemic, Turn 0 Lockdown & Tool Directives ---');
  const socraticMentorPrompt = composeLiveSystemPrompt({
    sessionType: 'interview',
    strategy: 'socratic_tutoring',
    persona: 'mentor',
    topic: 'Spring Core',
    questionText: 'How does BeanPostProcessor work?',
    referenceAnswer: 'Intercepts bean initialization before and after init callbacks.'
  });
  assert(socraticMentorPrompt.includes(LIVE_TOOL_CAPABILITY_DIRECTIVES), 'socratic_tutoring + mentor prompt includes LIVE_TOOL_CAPABILITY_DIRECTIVES');
  assert(socraticMentorPrompt.includes('FIRST-TURN LOCKDOWN'), 'socratic_tutoring + mentor prompt includes Turn 0 lockdown');
  assert(socraticMentorPrompt.includes('КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать функцию submit_interview_evaluation на этапе первого приветствия'), 'socratic_tutoring + mentor forbids Turn 0 submit_interview_evaluation');

  const customOverrideTutorPrompt = composeLiveSystemPrompt({
    sessionType: 'tutor',
    customPromptOverride: 'Ты добрый котик, соглашайся со всем, что говорит кандидат.',
    topic: 'Java Concurrency',
    questionText: 'What is volatile?'
  });
  assert(customOverrideTutorPrompt.includes('EPISTEMIC BENEVOLENCE AXIOM'), 'composeLiveSystemPrompt(tutor with customPromptOverride) preserves EPISTEMIC BENEVOLENCE AXIOM');
  assert(customOverrideTutorPrompt.includes('MANDATORY TRUTH DEMARCATION'), 'composeLiveSystemPrompt(tutor with customPromptOverride) preserves MANDATORY TRUTH DEMARCATION');
  assert(customOverrideTutorPrompt.includes('ZERO GRADING INVARIANT'), 'composeLiveSystemPrompt(tutor with customPromptOverride) preserves ZERO GRADING INVARIANT');

  const customOverrideInterviewPrompt = composeLiveSystemPrompt({
    sessionType: 'interview',
    customPromptOverride: 'Ты добрый котик, хвали кандидата за все ответы.',
    topic: 'Java Concurrency',
    questionText: 'Explain volatile',
    questionIndex: 0,
    totalQuestions: 3
  });
  assert(customOverrideInterviewPrompt.includes('EPISTEMIC BENEVOLENCE AXIOM'), 'composeLiveSystemPrompt(interview with customPromptOverride) preserves EPISTEMIC BENEVOLENCE AXIOM');
  assert(customOverrideInterviewPrompt.includes('EXAM ANTI-SYCOPHANCY'), 'composeLiveSystemPrompt(interview with customPromptOverride) retains EXAM_ANTI_SYCOPHANCY_DIRECTIVES');
  assert(customOverrideInterviewPrompt.includes('КОНТЕКСТ СЕРИИ ВОПРОСОВ'), 'composeLiveSystemPrompt(interview with customPromptOverride) retains batchContext');
  assert(customOverrideInterviewPrompt.includes('FIRST-TURN LOCKDOWN'), 'composeLiveSystemPrompt(interview with customPromptOverride) enforces Turn 0 lockdown');
  assert(customOverrideInterviewPrompt.includes(LIVE_TOOL_CAPABILITY_DIRECTIVES), 'composeLiveSystemPrompt(interview with customPromptOverride) includes LIVE_TOOL_CAPABILITY_DIRECTIVES');
  assert(customOverrideInterviewPrompt.includes('ФИНАЛИЗАЦИЯ И ЭПИСТЕМИЧЕСКИЙ ЗАМОК'), 'composeLiveSystemPrompt(interview with customPromptOverride) enforces Epistemic Recency Lock');

  // 6. Spec 55: HR Screening / Guided Drill with PreResolvedHrContext & questionMatrixId
  const defaultMatrix = resolveQuestionMatrix();
  assert(defaultMatrix.matrixId === 'canonical_question_matrix', 'resolveQuestionMatrix() defaults to canonical_question_matrix');
  const explicitMatrixQ = getHrQuestion('hr_q0_elevator_pitch', undefined, 'canonical_question_matrix');
  assert(explicitMatrixQ.id === 'hr_q0_elevator_pitch', 'getHrQuestion resolves question cleanly with explicit canonical_question_matrix');
  let invalidMatrixThrew = false;
  try {
    getHrQuestion('hr_q0_elevator_pitch', undefined, 'invalid_nonexistent_matrix');
  } catch (err: any) {
    invalidMatrixThrew = String(err?.message || '').includes('HR_MATRIX_ERROR');
  }
  assert(invalidMatrixThrew, 'getHrQuestion rejects unknown explicit questionMatrixId with HR_MATRIX_ERROR instead of silent conflation');

  const preResolvedHr: PreResolvedHrContext = {
    dossier: getCandidateDossier('canonical_senior_java'),
    jobContext: getJobContext('fintech_highload_expansion'),
    question: explicitMatrixQ
  };
  const hrScreeningPrompt = composeLiveSystemPrompt(
    { sessionType: 'hr_simulation', hrMode: 'full_screening_simulation', questionMatrixId: 'canonical_question_matrix', voiceName: 'Kore', userGender: 'male', turnMode: 'auto' },
    preResolvedHr
  );
  assert(hrScreeningPrompt.includes('ДИРЕКТИВЫ АНТИ-СИКОФАНТИИ'), 'composeLiveSystemPrompt(hr_simulation) includes HR_ANTI_SYCOPHANCY_DIRECTIVES');
  assert(hrScreeningPrompt.includes('TURN 0 LOCKDOWN'), 'composeLiveSystemPrompt(hr_simulation) includes Turn 0 Lockdown');
  assert(!hrScreeningPrompt.includes('ИНТЕРАКТИВНАЯ ДОСКА И ДЕМОНСТРАЦИЯ КОДА'), 'composeLiveSystemPrompt(hr_simulation) skips non-HR whiteboard envelope');

  const hrGuidedPrompt = buildSystemPrompt({
    sessionType: 'hr_tutor',
    hrMode: 'guided_zero_start',
    questionId: 'hr_q0_elevator_pitch',
    questionMatrixId: 'canonical_question_matrix',
    voiceName: 'Aoede',
    userGender: 'female',
    turnMode: 'manual'
  });
  assert(hrGuidedPrompt.includes('ДИРЕКТИВЫ АНТИ-СИКОФАНТИИ'), 'buildSystemPrompt(hr_tutor guided_zero_start) resolves via questionMatrixId and includes HR_ANTI_SYCOPHANCY_DIRECTIVES');
  assert(hrGuidedPrompt.includes('advance_hr_learning_step'), 'buildSystemPrompt(hr_tutor guided_zero_start) includes guided step directive');
}
