import { AccessToken } from 'livekit-server-sdk';
import { envConfig } from '../config/env';
import { InterviewPersonaId, TargetGrade } from '../prompts/personas';
import { LiveSessionBlueprintBuilder } from './live/LiveSessionBlueprintBuilder';

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
  const sessionId = params.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const roomName = params.roomName || `interview_${sessionId}`;
  const userId = params.userId || 'candidate_user';

  const blueprint = await LiveSessionBlueprintBuilder.resolveFromParams({
    ...params,
    sessionId,
    userId,
    topic: params.topic || 'Java Spring Engineering',
    strategy: params.strategy || 'socratic_tutoring',
    persona: params.persona || 'friendly_mentor',
    targetGrade: params.targetGrade || 'L4_MIDDLE'
  });

  const { config, systemPromptText } = blueprint;
  const greetingText = blueprint.buildTurn0Greeting();
  const targetSeniority = config.userProfile?.targetSeniority;
  const userName = params.userName || (targetSeniority ? `${targetSeniority} Candidate` : 'Candidate');

  const metadata = JSON.stringify({
    voice: config.voiceName,
    liveModel: config.liveModel,
    systemPrompt: systemPromptText,
    greetingText,
    sessionType: config.sessionType,
    topic: config.topic,
    questionId: params.questionId,
    userGender: config.userGender
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
