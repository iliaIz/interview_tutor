import http from 'http';
import url from 'url';
import { envConfig } from '../../config/env';
import {
  DEFAULT_VOICE_NAME,
  DEFAULT_TURN_MODE,
  DEFAULT_VAD_PAUSE_MS,
  sanitizeVoiceName,
  clampVadPauseMs
} from '../../config/liveDefaults';
import { findRelevantCandidateGaps, getUserProfile, CandidateGap } from '../vectorMemoryService';
import { TargetGrade } from '../../prompts/personas';
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';
import { extractDefaultAnchors } from './livePromptBuilder';
import { resolveLiveChallengeContext } from './liveWsChallengeResolver';
import { LiveSessionPromptConfig, LiveSessionResolvedConfig, LiveSessionConfig } from './liveSessionConfigTypes';
import { authenticateWsRequest } from './sessionConfigAuth';
import { mergeInitFrame } from './sessionInitFrameMerger';

export type { LiveSessionPromptConfig, LiveSessionResolvedConfig, LiveSessionConfig };

export class SessionConfigurationResolver {
  public static authenticate = authenticateWsRequest;
  public static mergeInitFrame = mergeInitFrame;

  public static async resolve(req: http.IncomingMessage, rawInitFrame?: any): Promise<LiveSessionResolvedConfig | null> {
    const query = url.parse(req.url || '', true).query;
    const authenticatedUser = SessionConfigurationResolver.authenticate(req, query);
    if (!authenticatedUser) return null;

    const questionId = (query.questionId as string) || (query.challengeId as string) || '';
    const challengeId = (query.challengeId as string) || (query.questionId as string) || '';
    let parsedHints: string[] = [];
    if (query.hints) { try { const h = JSON.parse(query.hints as string); if (Array.isArray(h)) parsedHints = h.map(String); } catch {} }
    let incidentContext: any = null;
    if (query.incidentContext) { try { incidentContext = JSON.parse(query.incidentContext as string); } catch {} }

    const resolved = resolveLiveChallengeContext({
      challengeId, questionId,
      queryTopic: (query.topic as string) || 'Java & Spring Framework',
      queryBugTitle: (query.bugTitle as string) || '',
      queryQuestionText: (query.questionText as string) || '',
      queryReferenceAnswer: (query.referenceAnswer as string) || '',
      queryBugExplanation: (query.bugExplanation as string) || '',
      queryFixedCode: (query.fixedCode as string) || '',
      queryCodeSnippet: (query.codeSnippet as string) || '',
      queryChallengeCategory: (query.category as string) || (query.challengeCategory as string) || '',
      queryChallengeTrack: (query.track as string) || (query.challengeTrack as string) || '',
      queryActiveFilePath: (query.activeFilePath as string) || ''
    });

    let refAnswer = resolved.referenceAnswer;
    if (refAnswer && refAnswer.length > 20000) refAnswer = refAnswer.slice(0, 20000);

    let customAnchors: string[] = [];
    if (query.customAnchors) {
      try { const p = JSON.parse(query.customAnchors as string); if (Array.isArray(p)) customAnchors = p.slice(0, 10).map((a) => String(a).trim()).filter(Boolean); } catch {}
    }
    const anchors = customAnchors.length > 0 ? customAnchors : extractDefaultAnchors(refAnswer, resolved.questionText);

    let candidateGaps: CandidateGap[] = [];
    try {
      candidateGaps = await findRelevantCandidateGaps(
        resolved.questionText || resolved.bugTitle || resolved.topic,
        resolved.topic,
        questionId,
        0.70,
        authenticatedUser.id || 'default_user'
      );
    } catch {}

    const rawStrict = ((query.strictness as string) || '').toLowerCase();
    const strictness = ['learning', 'standard', 'hardcore'].includes(rawStrict) ? (rawStrict as StrictnessLevel) : undefined;
    const isSupported = envConfig.models.supportedLiveModels.includes((query.liveModel as string) || '');
    const liveModel = isSupported ? (query.liveModel as string) : envConfig.models.live;
    const rawSessionId = ((query.sessionId as string) || '').trim();
    const sessionId = rawSessionId || `session_${authenticatedUser.id || 'anon'}_${Date.now()}`;
    const cleanProxyWs = envConfig.proxy.baseUrl.replace(/^http/, 'ws');
    const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(envConfig.proxy.apiKey)}&session_id=${encodeURIComponent(sessionId)}`;

    let activeCodeArtifact: any = null;
    if (query.activeCodeArtifact) { try { activeCodeArtifact = JSON.parse(query.activeCodeArtifact as string); } catch {} }
    let codeRevisionsSummary: any = null;
    if (query.codeRevisionsSummary) { try { codeRevisionsSummary = JSON.parse(query.codeRevisionsSummary as string); } catch {} }

    const promptConfig: LiveSessionPromptConfig = {
      voiceName: sanitizeVoiceName(query.voice, DEFAULT_VOICE_NAME),
      userGender: ((query.userGender as string) === 'male' || (query.userGender as string) === 'neutral' ? query.userGender : 'female') as 'female' | 'male' | 'neutral',
      turnMode: (query.turnMode === 'manual' ? 'manual' : query.turnMode === 'auto' ? 'auto' : DEFAULT_TURN_MODE) as 'manual' | 'auto',
      strategy: ((query.strategy as string) === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing') as 'adaptive_probing' | 'socratic_tutoring',
      persona: (query.persona as string) || 'mentor',
      targetGrade: ((query.targetGrade as string) || 'L5_SENIOR') as TargetGrade,
      maxProbes: Math.max(1, Math.min(5, parseInt((query.maxProbes as string) || '3', 10) || 3)),
      deepDive: query.deepDive === 'true',
      liveCoaching: query.liveCoaching === 'true',
      strictness,
      customPromptOverride: String(query.customPrompt || '').slice(0, 4000),
      anchors,
      initialUserMessage: ((query.initialUserMessage as string) || '').trim(),
      temperature: query.temperature !== undefined ? parseFloat(String(query.temperature)) : undefined
    };

    const config: LiveSessionResolvedConfig = {
      ...resolved,
      ...promptConfig,
      promptConfig,
      sessionId,
      userId: authenticatedUser.id || 'default_user',
      authenticatedUser,
      sessionType: (query.sessionType as any) || 'interview',
      tutorMode: (query.tutorMode as any) || 'deep_dive',
      questionId,
      referenceAnswer: refAnswer,
      targetGrade: promptConfig.targetGrade,
      manifest: resolved.workspaceManifest,
      unitTest: (query.unitTest as string) || '',
      incidentContext,
      parsedHints,
      activeCodeArtifact,
      codeRevisionsSummary,
      questionIndex: Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0),
      totalQuestions: Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1),
      isRetry: query.isRetry === 'true',
      isResumed: query.isResumed === 'true',
      initialProbesCount: Math.max(0, parseInt((query.probesCount as string) || '0', 10) || 0),
      candidateGaps,
      relevantGapIds: candidateGaps.map((g) => g.id),
      userProfile: getUserProfile(authenticatedUser.id || 'default_user'),
      liveModel,
      upstreamWsUrl,
      vadPauseMs: clampVadPauseMs(query.vadPauseMs, DEFAULT_VAD_PAUSE_MS),
      enableSilenceClarification: query.enableSilenceClarification === 'true',
      debugStep: query.debugStep !== undefined ? parseInt(String(query.debugStep), 10) : undefined,
      academyCourse: (query.academyCourse as string) || undefined,
      academyStep: (query.academyStep as string) || undefined,
      hrMode: (query.hrMode as any) || undefined,
      hrPersonaId: (query.hrPersonaId as any) || undefined,
      chunkId: (query.chunkId as string) || undefined
    };

    SessionConfigurationResolver.mergeInitFrame(config, rawInitFrame);
    return config;
  }
}
