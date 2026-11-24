import { LiveSessionResolvedConfig } from './liveSessionConfigTypes';
import { mergeWorkspaceManifests } from './workspaceManifestStore';
import { envConfig } from '../../config/env';
import { clampVadPauseMs, sanitizeVoiceName } from '../../config/liveDefaults';

export function mergeInitFrame(config: LiveSessionResolvedConfig, rawInitFrame?: any): void {
  if (!rawInitFrame) return;
  let init = rawInitFrame;
  if (typeof init === 'string' || Buffer.isBuffer(init)) {
    try { init = JSON.parse(init.toString('utf8')); } catch { return; }
  }
  if (!init || typeof init !== 'object') return;
  if (init.sessionType) config.sessionType = init.sessionType;
  if (init.tutorMode) config.tutorMode = init.tutorMode;
  if (init.voice) {
    config.voiceName = config.promptConfig.voiceName = sanitizeVoiceName(init.voice, config.voiceName);
  }
  if (init.userGender === 'female' || init.userGender === 'male' || init.userGender === 'neutral') {
    config.userGender = config.promptConfig.userGender = init.userGender;
  }
  if (init.turnMode === 'manual' || init.turnMode === 'auto') {
    config.turnMode = config.promptConfig.turnMode = init.turnMode;
  }
  if (init.liveModel && envConfig.models.supportedLiveModels.includes(String(init.liveModel))) {
    config.liveModel = String(init.liveModel);
  }
  if (init.vadPauseMs !== undefined) {
    config.vadPauseMs = clampVadPauseMs(init.vadPauseMs, config.vadPauseMs);
  }
  if (typeof init.enableSilenceClarification === 'boolean') {
    config.enableSilenceClarification = init.enableSilenceClarification;
  }
  if (init.strictness === 'learning' || init.strictness === 'standard' || init.strictness === 'hardcore') {
    config.strictness = config.promptConfig.strictness = init.strictness;
  }
  if (typeof init.deepDive === 'boolean') {
    config.deepDive = config.promptConfig.deepDive = init.deepDive;
  }
  if (typeof init.liveCoaching === 'boolean') {
    config.liveCoaching = config.promptConfig.liveCoaching = init.liveCoaching;
  }
  if (typeof init.maxProbes === 'number' && Number.isFinite(init.maxProbes)) {
    config.maxProbes = config.promptConfig.maxProbes = Math.max(1, Math.min(5, Math.round(init.maxProbes)));
  }
  if (init.challenge) {
    const ch = init.challenge;
    if (ch.category) config.challengeCategory = ch.category;
    if (ch.track) config.challengeTrack = ch.track;
    if (ch.title) { config.bugTitle = ch.title; config.questionText = ch.title; }
    if (ch.instructions) config.bugExplanation = ch.instructions;
    if (ch.activeFileContent) config.codeSnippet = ch.activeFileContent;
    if (ch.activeFilePath) config.activeFilePath = ch.activeFilePath;
    if (ch.workspaceManifest) config.manifest = config.workspaceManifest = mergeWorkspaceManifests(config.manifest, ch.workspaceManifest);
  }
  if (init.workspaceManifest) config.manifest = config.workspaceManifest = mergeWorkspaceManifests(config.manifest, init.workspaceManifest);
  if (init.codeSnippet) config.codeSnippet = init.codeSnippet;
  if (init.bugTitle) { config.bugTitle = init.bugTitle; config.questionText = init.bugTitle; }
  if (init.bugExplanation) config.bugExplanation = init.bugExplanation;
  if (init.questionText) config.questionText = init.questionText;
  if (init.referenceAnswer) config.referenceAnswer = init.referenceAnswer;
  if (init.topic) config.topic = init.topic;
  if (init.persona) config.persona = config.promptConfig.persona = init.persona;
  if (init.strategy) config.strategy = config.promptConfig.strategy = init.strategy;
  if (init.targetGrade) config.targetGrade = config.promptConfig.targetGrade = init.targetGrade;
  if (init.activeCodeArtifact) config.activeCodeArtifact = init.activeCodeArtifact;
  if (init.academyBridgeContext) config.academyBridgeContext = init.academyBridgeContext;
  if (init.seniorReview) config.seniorReview = init.seniorReview;
  if (typeof init.questionIndex === 'number') config.questionIndex = init.questionIndex;
  if (typeof init.totalQuestions === 'number') config.totalQuestions = init.totalQuestions;
  if (typeof init.isRetry === 'boolean') config.isRetry = init.isRetry;
  if (init.hrMode) config.hrMode = init.hrMode;
  if (init.hrPersonaId) config.hrPersonaId = init.hrPersonaId;
  if (init.chunkId) config.chunkId = init.chunkId;
  if (init.sessionId) config.sessionId = init.sessionId;
}
