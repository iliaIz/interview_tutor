/**
 * liveVoiceUrlBuilder.ts
 * Builds the canonical WebSocket endpoint URL for Gemini Live voice sessions.
 * Cognitive bounding limit: <= 50 lines.
 */

import { VoiceEngineConfig, LiveSessionInitFrame } from './types';

export function buildLiveVoiceWebSocketUrl(cfg: VoiceEngineConfig): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined'
    ? (window.location.port === '8090' ? `${window.location.hostname}:8091` : window.location.host)
    : 'localhost:5000';

  const params = new URLSearchParams({
    sessionId: cfg.sessionId,
    questionId: cfg.questionId,
    sessionType: cfg.sessionType,
    questionText: cfg.questionText ? cfg.questionText.slice(0, 300) : (cfg.bugExplanation ? cfg.bugExplanation.slice(0, 300) : ''),
    voice: cfg.voice || 'Kore',
    turnMode: cfg.turnMode || 'auto',
    liveModel: cfg.liveModel || 'gemini-live-v3',
    vadPauseMs: String(cfg.vadPauseMs || 1800)
  });

  if (cfg.questionId) {
    params.set('challengeId', cfg.questionId);
  }

  const optionalKeys = ['tutorMode', 'persona', 'targetGrade', 'strategy', 'userGender', 'academyCourse', 'academyStep', 'dossierId', 'targetQuestionId', 'hrMode'] as const;
  for (const k of optionalKeys) {
    if (cfg[k]) params.set(k, String(cfg[k]));
  }

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

  return `${protocol}//${host}/ws/live?${params.toString()}`;
}

export function sendLiveSessionInit(ws: WebSocket, cfg: VoiceEngineConfig): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  const initFrame: LiveSessionInitFrame = {
    type: 'session_init',
    sessionId: cfg.sessionId,
    sessionType: cfg.sessionType,
    tutorMode: cfg.tutorMode,
    topic: cfg.topic,
    questionText: cfg.questionText,
    referenceAnswer: cfg.referenceAnswer,
    persona: cfg.persona,
    strategy: cfg.strategy,
    targetGrade: cfg.targetGrade,
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
    seniorReview: cfg.seniorReview
  };

  try {
    ws.send(JSON.stringify(initFrame));
  } catch (err) {
    console.warn('[LiveVoiceEngine] Failed to dispatch session_init frame:', err);
  }
}
