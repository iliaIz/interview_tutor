import { LiveSessionResolvedConfig } from './liveSessionConfigTypes';
import { mergeWorkspaceManifests } from './workspaceManifestStore';

export function mergeInitFrame(config: LiveSessionResolvedConfig, rawInitFrame?: any): void {
  if (!rawInitFrame) return;
  let init = rawInitFrame;
  if (typeof init === 'string' || Buffer.isBuffer(init)) {
    try { init = JSON.parse(init.toString('utf8')); } catch { return; }
  }
  if (!init || typeof init !== 'object') return;
  if (init.sessionType) config.sessionType = init.sessionType;
  if (init.tutorMode) config.tutorMode = init.tutorMode;
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
  if (init.sessionId) config.sessionId = init.sessionId;
}
