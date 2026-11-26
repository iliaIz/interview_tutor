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
import { isHrSessionType } from '@interview-prep/shared';
import { authService } from '../authService';
import { parseCookies } from '../../middleware/auth';
import { findRelevantCandidateGaps, getUserProfile, CandidateGap } from '../vectorMemoryService';
import { TargetGrade } from '../../prompts/personas';
import { composeLiveSystemPrompt, PreResolvedHrContext } from './LivePromptComposer';
import { extractDefaultAnchors } from './liveRubricBuilder';
import { resolvePreResolvedHrContext } from './hrContextResolver';
import { getLiveToolDeclarations } from './liveToolDeclarations';
import { buildGeminiLiveSetupMessage } from './liveGeminiConfigBuilder';
import { LiveWorkspaceContext } from './LiveWorkspaceContext';
import { mergeWorkspaceManifests } from './workspaceManifestStore';
import {
  mergeInitFrameIntoConfig,
  parseQueryToBlueprintParams,
  VALID_GENDERS
} from './liveBlueprintParamParser';
import { resolveTurn0GreetingText } from './liveTurn0GreetingResolver';
import {
  AuthenticatedWsUser,
  BlueprintDependencies,
  ChallengeResolutionInput,
  LiveSessionBlueprint,
  LiveSessionBlueprintParams,
  LiveSessionConfig,
  LiveSessionPromptConfig,
  LiveSessionResolvedConfig,
  ResolveTurn0GreetingOptions,
  Turn0GreetingRuntime
} from './liveSessionConfigTypes';

export type {
  AuthenticatedWsUser,
  BlueprintDependencies,
  LiveSessionBlueprint,
  LiveSessionBlueprintParams,
  LiveSessionConfig,
  LiveSessionPromptConfig,
  LiveSessionResolvedConfig,
  ResolveTurn0GreetingOptions,
  Turn0GreetingRuntime
};

/**
 * LiveSessionBlueprintBuilder (Spec 45).
 * Deep module unifying WS auth, query & parameter resolution, early session_init hydration,
 * prompt/tool assembly, canonical Gemini setup generation, and Turn 0 greeting synthesis.
 */
export class LiveSessionBlueprintBuilder {
  public static resolveTurn0GreetingText = resolveTurn0GreetingText;

  public static authenticateRequest(req: http.IncomingMessage, query: Record<string, any>): AuthenticatedWsUser | null {
    if (query?.ticket) {
      const res = authService.verifyAndConsumeWsTicket(String(query.ticket));
      if (res) return res.user;
    }
    const token = parseCookies(req.headers?.cookie)['session_token'];
    if (token) {
      const res = authService.validateSession(token);
      if (res) return res.user;
    }
    const auth = (req.headers?.authorization as string) || '';
    const qToken = (query?.token as string) || (query?.auth_token as string) || '';
    if (envConfig.proxy.apiKey && (auth === `Bearer ${envConfig.proxy.apiKey}` || qToken === envConfig.proxy.apiKey)) {
      return { id: 'user_master', name: 'Automated Test Runner', role: 'owner', created_at: new Date().toISOString() };
    }
    return null;
  }

  public static async resolveFromRequest(
    req: http.IncomingMessage,
    rawInitFrame?: any,
    deps: BlueprintDependencies = {}
  ): Promise<LiveSessionBlueprint | null> {
    const query = url.parse(req.url || '', true).query as Record<string, any>;
    const authenticate = deps.authenticate || LiveSessionBlueprintBuilder.authenticateRequest;
    const authenticatedUser = authenticate(req, query);
    if (!authenticatedUser) return null;
    return LiveSessionBlueprintBuilder.resolveFromParams(parseQueryToBlueprintParams(query, authenticatedUser, rawInitFrame), deps);
  }

  public static async resolveFromParams(
    params: LiveSessionBlueprintParams,
    deps: BlueprintDependencies = {}
  ): Promise<LiveSessionBlueprint> {
    const userId = params.authenticatedUser?.id || params.userId || 'default_user';
    const authenticatedUser = params.authenticatedUser || { id: userId };
    const userProfile = (deps.getUserProfile || getUserProfile)(userId);
    const questionId = params.questionId || params.challengeId || '';
    const challengeId = params.challengeId || params.questionId || '';
    const resolveChallenge = deps.resolveChallenge || ((input: ChallengeResolutionInput) => LiveWorkspaceContext.resolve(input).getResolved());
    const resolved = resolveChallenge({
      challengeId, questionId,
      queryTopic: params.topic || 'Java & Spring Framework',
      queryBugTitle: params.bugTitle || '',
      queryQuestionText: params.questionText || '',
      queryReferenceAnswer: params.referenceAnswer || '',
      queryBugExplanation: params.bugExplanation || '',
      queryFixedCode: params.fixedCode || '',
      queryCodeSnippet: params.codeSnippet || '',
      queryChallengeCategory: params.challengeCategory || '',
      queryChallengeTrack: params.challengeTrack || '',
      queryActiveFilePath: params.activeFilePath || ''
    });

    if (params.workspaceManifest) {
      resolved.workspaceManifest = mergeWorkspaceManifests(resolved.workspaceManifest, params.workspaceManifest);
    }

    const profileGender = (userProfile as any)?.gender;
    const defaultGender = VALID_GENDERS.has(profileGender) ? profileGender : 'female';
    const liveModel = envConfig.models.supportedLiveModels.includes(params.liveModel || '')
      ? String(params.liveModel)
      : envConfig.models.live;
    const sessionId = (params.sessionId || '').trim() || `session_${userId}_${Date.now()}`;
    const promptConfig: LiveSessionPromptConfig = {
      voiceName: sanitizeVoiceName(params.voiceName || params.voice, DEFAULT_VOICE_NAME),
      userGender: (VALID_GENDERS.has(params.userGender || '') ? params.userGender : defaultGender) as 'female' | 'male' | 'neutral',
      turnMode: params.turnMode === 'manual' ? 'manual' : params.turnMode === 'auto' ? 'auto' : DEFAULT_TURN_MODE,
      strategy: params.strategy === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing',
      persona: params.persona || 'mentor',
      targetGrade: params.targetGrade || ('L5_SENIOR' as TargetGrade),
      maxProbes: Math.max(1, Math.min(5, Math.round(params.maxProbes ?? 3))),
      deepDive: Boolean(params.deepDive),
      liveCoaching: Boolean(params.liveCoaching),
      strictness: params.strictness,
      customPromptOverride: String(params.customPromptOverride || params.customPrompt || '').slice(0, 4000),
      anchors: params.customAnchors?.length ? [...params.customAnchors] : params.anchors?.length ? [...params.anchors] : [],
      initialUserMessage: (params.initialUserMessage || '').trim(),
      temperature: params.temperature
    };

    const config: LiveSessionResolvedConfig = {
      ...resolved,
      ...promptConfig,
      promptConfig,
      sessionId,
      userId,
      authenticatedUser,
      sessionType: params.sessionType || 'interview',
      tutorMode: params.tutorMode || 'deep_dive',
      questionId,
      manifest: resolved.workspaceManifest,
      unitTest: params.unitTest || '',
      incidentContext: params.incidentContext || null,
      parsedHints: params.parsedHints || params.hints || [],
      activeCodeArtifact: params.activeCodeArtifact || null,
      codeRevisionsSummary: params.codeRevisionsSummary || null,
      academyBridgeContext: params.academyBridgeContext,
      seniorReview: params.seniorReview,
      questionIndex: Math.max(0, params.questionIndex ?? 0),
      totalQuestions: Math.max(1, params.totalQuestions ?? 1),
      isRetry: Boolean(params.isRetry),
      isResumed: Boolean(params.isResumed),
      initialProbesCount: Math.max(0, params.initialProbesCount ?? 0),
      candidateGaps: [],
      relevantGapIds: [],
      userProfile,
      liveModel,
      upstreamWsUrl: '',
      vadPauseMs: clampVadPauseMs(params.vadPauseMs, DEFAULT_VAD_PAUSE_MS),
      enableSilenceClarification: Boolean(params.enableSilenceClarification),
      debugStep: params.debugStep,
      academyCourse: params.academyCourse,
      academyStep: params.academyStep,
      hrMode: params.hrMode,
      hrPersonaId: params.hrPersonaId,
      dossierId: params.dossierId,
      jobId: params.jobId,
      questionMatrixId: params.questionMatrixId,
      chunkId: params.chunkId,
      startBeatId: params.startBeatId,
      beatScope: params.beatScope,
      resumptionHandle: params.resumptionHandle
    };

    mergeInitFrameIntoConfig(config, params.rawInitFrame);
    if (config.referenceAnswer && config.referenceAnswer.length > 20000) {
      config.referenceAnswer = config.referenceAnswer.slice(0, 20000);
    }
    if (!isHrSessionType(config.sessionType) && config.anchors.length === 0) {
      config.anchors = config.promptConfig.anchors = extractDefaultAnchors(config.referenceAnswer, config.questionText);
    }
    const cleanProxyWs = envConfig.proxy.baseUrl.replace(/^http/, 'ws');
    config.upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(config.liveModel)}&token=${encodeURIComponent(envConfig.proxy.apiKey)}&session_id=${encodeURIComponent(config.sessionId)}`;

    let candidateGaps: CandidateGap[] = [];
    try {
      const findGaps = deps.findGaps || findRelevantCandidateGaps;
      candidateGaps = await findGaps(config.questionText || config.bugTitle || config.topic, config.topic, config.questionId, 0.70, userId);
    } catch {}
    config.candidateGaps = candidateGaps;
    config.relevantGapIds = candidateGaps.map((g) => g.id);

    let hrContext: PreResolvedHrContext | undefined;
    if (isHrSessionType(config.sessionType)) {
      const resolveHr = deps.resolveHrContext || resolvePreResolvedHrContext;
      hrContext = resolveHr({
        dossierId: config.dossierId,
        jobId: config.jobId,
        questionId: config.questionId,
        chunkId: config.chunkId,
        questionMatrixId: config.questionMatrixId
      });
    }

    const systemPromptText = composeLiveSystemPrompt(
      {
        ...config,
        hints: config.parsedHints,
        primaryStack: config.userProfile?.primaryStack,
        workspaceManifest: config.workspaceManifest || config.manifest,
        academyBridgeContext: config.academyBridgeContext || (config.academyCourse ? { courseId: config.academyCourse, stepId: config.academyStep } : undefined)
      },
      hrContext
    );
    const toolDeclarations = getLiveToolDeclarations(config.sessionType, config.tutorMode, config.hrMode);
    const baseSetupMessage = buildGeminiLiveSetupMessage({
      liveModel: config.liveModel, voiceName: config.voiceName, systemPromptText,
      sessionType: config.sessionType, strategy: config.strategy, normalizedTools: toolDeclarations,
      vadPauseMs: config.vadPauseMs, turnMode: config.turnMode, temperature: config.temperature, resumptionHandle: config.resumptionHandle
    });

    return {
      config,
      systemPromptText,
      toolDeclarations,
      buildUpstreamSetup: (...args: [resumptionHandle?: string]) =>
        LiveSessionBlueprintBuilder.buildDynamicSetupMessage(baseSetupMessage, args.length > 0 ? args[0] : config.resumptionHandle),
      buildTurn0Greeting: (runtime?: Turn0GreetingRuntime) =>
        resolveTurn0GreetingText({
          sessionType: config.sessionType, tutorMode: config.tutorMode, bugTitle: config.bugTitle,
          questionText: config.questionText, topic: config.topic, questionId: config.questionId,
          questionIndex: config.questionIndex, totalQuestions: config.totalQuestions, isRetry: config.isRetry,
          initialUserMessage: config.initialUserMessage, challengeCategory: config.challengeCategory,
          challengeTrack: config.challengeTrack, seniorReview: runtime?.seniorReview ?? config.seniorReview,
          hrMode: config.hrMode, startBeatId: config.startBeatId, beatScope: config.beatScope,
          hrGuidedState: runtime?.hrGuidedState, hrQuestion: runtime?.hrQuestion ?? hrContext?.question, replayOverride: runtime?.replayOverride
        })
    };
  }

  public static buildDynamicSetupMessage(baseSetupMessage: any, resumptionHandle?: string): Record<string, unknown> {
    const baseSetup = baseSetupMessage?.setup || {};
    const nextSetup: Record<string, any> = {
      ...baseSetup,
      contextWindowCompression: baseSetup.contextWindowCompression || { slidingWindow: {} }
    };
    delete nextSetup.sessionResumptionConfig;
    if (resumptionHandle) nextSetup.sessionResumption = { handle: resumptionHandle };
    else delete nextSetup.sessionResumption;
    return { setup: nextSetup };
  }
}
