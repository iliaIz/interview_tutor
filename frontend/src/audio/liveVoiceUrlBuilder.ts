/**
 * liveVoiceUrlBuilder.ts
 * Builds the canonical WebSocket endpoint URL for Gemini Live voice sessions.
 * Cognitive bounding limit: <= 50 lines.
 */

import { VoiceEngineConfig, LiveSessionInitFrame } from './types';
import { VOICE_DEFAULTS, getCachedRuntimeVoiceConfig } from '../config/voiceDefaults';

export function buildLiveVoiceWebSocketUrl(cfg: VoiceEngineConfig): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined'
    ? (window.location.port === '8090' ? `${window.location.hostname}:8091` : window.location.host)
    : 'localhost:5000';

  const runtimeDefaults = getCachedRuntimeVoiceConfig();
  const resolvedDefaultModel = runtimeDefaults?.models?.defaultLiveModel || VOICE_DEFAULTS.liveModel;

  const params = new URLSearchParams({
    sessionId: cfg.sessionId,
    questionId: cfg.questionId,
    sessionType: cfg.sessionType,
    questionText: cfg.questionText ? cfg.questionText.slice(0, 300) : (cfg.bugExplanation ? cfg.bugExplanation.slice(0, 300) : ''),
    voice: cfg.voice || runtimeDefaults?.defaults?.voice || VOICE_DEFAULTS.voice,
    turnMode: cfg.turnMode || runtimeDefaults?.defaults?.turnMode || VOICE_DEFAULTS.turnMode,
    liveModel: cfg.liveModel || resolvedDefaultModel,
    vadPauseMs: String(cfg.vadPauseMs ?? runtimeDefaults?.defaults?.vadPauseMs ?? VOICE_DEFAULTS.vadPauseMs),
    temperature: String(cfg.temperature ?? 1.0)
  });

  if (cfg.questionId) {
    params.set('challengeId', cfg.questionId);
  }

  const optionalKeys = ['tutorMode', 'persona', 'targetGrade', 'strategy', 'strictness', 'userGender', 'academyCourse', 'academyStep', 'dossierId', 'targetQuestionId', 'hrMode'] as const;
  for (const k of optionalKeys) {
    if (cfg[k]) params.set(k, String(cfg[k]));
  }

  if (typeof cfg.deepDive === 'boolean') params.set('deepDive', String(cfg.deepDive));
  if (typeof cfg.liveCoaching === 'boolean') params.set('liveCoaching', String(cfg.liveCoaching));
  if (typeof cfg.maxProbes === 'number') params.set('maxProbes', String(cfg.maxProbes));

  if (cfg.challengeCategory) params.set('category', cfg.challengeCategory);
  if (cfg.challengeTrack) params.set('track', cfg.challengeTrack);
  if (cfg.challengeDomain) params.set('domain', cfg.challengeDomain);
  if (cfg.bugTitle) params.set('bugTitle', cfg.bugTitle.slice(0, 200));

  if (typeof cfg.enableSilenceClarification === 'boolean') {
    params.set('enableSilenceClarification', String(cfg.enableSilenceClarification));
  }

  if (cfg.debugStep !== undefined) {
    params.set('debugStep', String(cfg.debugStep));
  }

  if (typeof cfg.questionIndex === 'number') {
    params.set('questionIndex', String(cfg.questionIndex));
  }
  if (typeof cfg.totalQuestions === 'number') {
    params.set('totalQuestions', String(cfg.totalQuestions));
  }
  if (cfg.isRetry) {
    params.set('isRetry', 'true');
  }
  if (cfg.hrMode) params.set('hrMode', cfg.hrMode);
  if (cfg.dossierId) params.set('dossierId', cfg.dossierId);
  if (cfg.jobId) params.set('jobId', cfg.jobId);
  if (cfg.hrPersonaId) params.set('hrPersonaId', cfg.hrPersonaId);
  if (cfg.questionMatrixId) params.set('questionMatrixId', cfg.questionMatrixId);
  if (cfg.chunkId) params.set('chunkId', cfg.chunkId);
  if (cfg.startBeatId) params.set('startBeatId', cfg.startBeatId);
  if (cfg.beatScope) params.set('beatScope', cfg.beatScope);

  return `${protocol}//${host}/ws/live?${params.toString()}`;
}

export function sendLiveSessionInit(ws: WebSocket, cfg: VoiceEngineConfig): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  const initFrame: LiveSessionInitFrame = {
    type: 'session_init',
    sessionId: cfg.sessionId,
    sessionType: cfg.sessionType,
    tutorMode: cfg.tutorMode,
    voice: cfg.voice,
    userGender: cfg.userGender,
    turnMode: cfg.turnMode,
    liveModel: cfg.liveModel,
    vadPauseMs: cfg.vadPauseMs,
    enableSilenceClarification: cfg.enableSilenceClarification,
    topic: cfg.topic,
    questionText: cfg.questionText,
    referenceAnswer: cfg.referenceAnswer,
    persona: cfg.persona,
    strategy: cfg.strategy,
    targetGrade: cfg.targetGrade,
    strictness: cfg.strictness,
    maxProbes: cfg.maxProbes,
    deepDive: cfg.deepDive,
    liveCoaching: cfg.liveCoaching,
    customPrompt: cfg.customPrompt,
    questionIndex: cfg.questionIndex,
    totalQuestions: cfg.totalQuestions,
    isRetry: cfg.isRetry,
    challenge: {
      id: cfg.questionId,
      title: cfg.bugTitle || cfg.questionText,
      category: cfg.challengeCategory,
      track: cfg.challengeTrack,
      domain: cfg.challengeDomain,
      instructions: cfg.bugExplanation,
      activeFilePath: cfg.workspaceManifest?.activeFile?.path,
      activeFileContent: cfg.codeSnippet || cfg.workspaceManifest?.activeFile?.content,
      workspaceManifest: cfg.workspaceManifest
    },
    activeCodeArtifact: cfg.activeCodeArtifact,
    academyBridgeContext: cfg.academyBridgeContext,
    seniorReview: cfg.seniorReview,
    hrMode: cfg.hrMode,
    dossierId: cfg.dossierId,
    jobId: cfg.jobId,
    hrPersonaId: cfg.hrPersonaId,
    questionMatrixId: cfg.questionMatrixId,
    chunkId: cfg.chunkId,
    startBeatId: cfg.startBeatId,
    beatScope: cfg.beatScope
  };

  try {
    ws.send(JSON.stringify(initFrame));
  } catch (err) {
    console.warn('[LiveVoiceEngine] Failed to dispatch session_init frame:', err);
  }
}
