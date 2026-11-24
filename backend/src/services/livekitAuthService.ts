import { AccessToken } from 'livekit-server-sdk';
import { envConfig } from '../config/env';
import { DEFAULT_TURN_MODE, DEFAULT_VOICE_NAME, sanitizeVoiceName } from '../config/liveDefaults';
import { getUserProfile, findRelevantCandidateGaps, CandidateGap } from './vectorMemoryService';
import { buildSystemPrompt, extractDefaultAnchors } from './live/livePromptBuilder';
import { InterviewPersonaId, TargetGrade } from '../prompts/personas';

export interface CreateLiveKitTokenParams {
  sessionId?: string;
  userId?: string;
  userName?: string;
  roomName?: string;
  sessionType?: 'interview' | 'tutor' | 'system_design';
  topic?: string;
  questionText?: string;
  questionId?: string;
  referenceAnswer?: string;
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  voiceName?: string;
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
  liveModel?: string;
  questionIndex?: number;
  totalQuestions?: number;
  tutorMode?: 'deep_dive' | 'free_chat' | 'socratic' | 'eli5' | 'quick_qa' | 'bug_hunt' | 'practice_pair';
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  hints?: string[];
  persona?: InterviewPersonaId | string;
  targetGrade?: TargetGrade;
  initialUserMessage?: string;
}

export interface LiveKitTokenResponse {
  token: string;
  livekitUrl: string;
  roomName: string;
  participantIdentity: string;
}

export async function generateLiveKitVoiceToken(
  params: CreateLiveKitTokenParams
): Promise<LiveKitTokenResponse> {
  const userProfile = getUserProfile();
  const sessionId = params.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const roomName = params.roomName || `interview_${sessionId}`;
  const userId = params.userId || 'candidate_user';
  const userName = params.userName || userProfile.targetSeniority ? `${userProfile.targetSeniority} Candidate` : 'Candidate';

  const sessionType = params.sessionType || 'interview';
  const tutorMode = params.tutorMode || 'deep_dive';
  const topic = params.topic || 'Java Spring Engineering';
  const questionText = params.questionText || '';
  const referenceAnswer = params.referenceAnswer || '';
  const voiceName = sanitizeVoiceName(params.voiceName, DEFAULT_VOICE_NAME);
  const userGender = params.userGender || (userProfile as any).gender || 'female';
  const turnMode = params.turnMode === 'manual' ? 'manual' : params.turnMode === 'auto' ? 'auto' : DEFAULT_TURN_MODE;
  const strategy = params.strategy || 'socratic_tutoring';
  const persona = params.persona || 'friendly_mentor';
  const targetGrade: TargetGrade = params.targetGrade || 'L4_MIDDLE';
  const questionIndex = params.questionIndex ?? 0;
  const totalQuestions = params.totalQuestions ?? 1;

  // Retrieve candidate gaps if available
  let candidateGaps: CandidateGap[] = [];
  try {
    candidateGaps = await findRelevantCandidateGaps(questionText || params.bugTitle || topic, topic, params.questionId);
  } catch (err) {
    console.warn('Could not find candidate gaps for LiveKit token:', err);
  }

  const anchors = extractDefaultAnchors(referenceAnswer, questionText);

  // Build full rich prompt
  const systemPromptText = buildSystemPrompt({
    topic,
    questionText,
    referenceAnswer,
    strategy,
    voiceName,
    userGender,
    turnMode,
    maxProbes: 3,
    anchors,
    questionIndex,
    totalQuestions,
    sessionType,
    tutorMode,
    bugTitle: params.bugTitle,
    bugExplanation: params.bugExplanation,
    codeSnippet: params.codeSnippet,
    hints: params.hints || [],
    targetSeniority: userProfile.targetSeniority,
    primaryStack: userProfile.primaryStack,
    candidateGaps,
    persona,
    targetGrade
  });

  // Determine initial greeting text
  let greetingText = '';
  if (params.initialUserMessage) {
    greetingText = params.initialUserMessage;
  } else if (sessionType === 'tutor') {
    if (tutorMode === 'bug_hunt') {
      greetingText = `Привет! Я смотрю на задачу на экране «${params.bugTitle || 'Code Review'}». Поприветствуй меня в 1 коротком предложении и спроси, в чем здесь ошибка.`;
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
  } else if (sessionType === 'system_design') {
    greetingText = `Привет! Я готова к защите архитектуры по сценарию «${topic || questionText || 'System Design'}». Поприветствуй меня в 1 коротком предложении и предложи начать с функциональных и нефункциональных требований.`;
  } else {
    const isSubsequent = questionIndex > 0;
    greetingText = isSubsequent
      ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой-переходом подтверди прогресс и четко зачитай следующий технический вопрос: "${questionText || 'Следующий вопрос темы'}"`
      : `Привет! Я готова к собеседованию. Поприветствуй меня одной фразой и четко зачитай технический вопрос: "${questionText || 'Расскажи о себе и опыте в Java'}"`;
  }

  const requestedModel = params.liveModel || '';
  const isSupported = envConfig.models.supportedLiveModels.includes(requestedModel);
  const liveModel = isSupported ? requestedModel : envConfig.models.live;

  const metadata = JSON.stringify({
    voice: voiceName,
    liveModel,
    systemPrompt: systemPromptText,
    greetingText,
    sessionType,
    topic,
    questionId: params.questionId,
    userGender
  });

  const participantIdentity = `${userId}_${Math.random().toString(36).slice(2, 6)}`;

  const at = new AccessToken(envConfig.livekit.apiKey, envConfig.livekit.apiSecret, {
    identity: participantIdentity,
    name: userName,
    metadata
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  const token = await at.toJwt();

  return {
    token,
    livekitUrl: envConfig.livekit.publicUrl,
    roomName,
    participantIdentity
  };
}
