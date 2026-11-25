import { envConfig } from '../../config/env';
import {
  DEFAULT_TURN_MODE,
  DEFAULT_VAD_PAUSE_MS,
  sanitizeVoiceName,
  clampVadPauseMs
} from '../../config/liveDefaults';
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';
import { TargetGrade } from '../../prompts/personas';
import {
  AuthenticatedWsUser,
  LiveSessionBlueprintParams,
  LiveSessionResolvedConfig
} from './liveSessionConfigTypes';
import { mergeWorkspaceManifests } from './workspaceManifestStore';

export const VALID_GENDERS = new Set(['female', 'male', 'neutral']);
const VALID_STRICTNESS = new Set(['learning', 'standard', 'hardcore']);

function safeJsonParse<T = any>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function parseQueryToBlueprintParams(
  query: Record<string, any>,
  authenticatedUser: AuthenticatedWsUser,
  rawInitFrame?: any
): LiveSessionBlueprintParams {
  const rawHints = safeJsonParse<any[]>(query.hints);
  const rawAnchors = safeJsonParse<any[]>(query.customAnchors);
  const rawStrict = String(query.strictness || '').toLowerCase();
  const rawTemp = query.temperature !== undefined ? parseFloat(String(query.temperature)) : undefined;
  const rawDebugStep = query.debugStep !== undefined ? parseInt(String(query.debugStep), 10) : undefined;
  return {
    authenticatedUser,
    userId: authenticatedUser.id || 'default_user',
    sessionId: ((query.sessionId as string) || '').trim() || undefined,
    questionId: (query.questionId as string) || (query.challengeId as string) || '',
    challengeId: (query.challengeId as string) || (query.questionId as string) || '',
    topic: (query.topic as string) || 'Java & Spring Framework',
    bugTitle: (query.bugTitle as string) || '',
    questionText: (query.questionText as string) || '',
    referenceAnswer: (query.referenceAnswer as string) || '',
    bugExplanation: (query.bugExplanation as string) || '',
    fixedCode: (query.fixedCode as string) || '',
    codeSnippet: (query.codeSnippet as string) || '',
    unitTest: (query.unitTest as string) || '',
    challengeCategory: (query.category as string) || (query.challengeCategory as string) || '',
    challengeTrack: (query.track as string) || (query.challengeTrack as string) || '',
    activeFilePath: (query.activeFilePath as string) || '',
    parsedHints: Array.isArray(rawHints) ? rawHints.map(String) : [],
    incidentContext: safeJsonParse(query.incidentContext),
    customAnchors: Array.isArray(rawAnchors) ? rawAnchors.slice(0, 10).map((a) => String(a).trim()).filter(Boolean) : [],
    activeCodeArtifact: safeJsonParse(query.activeCodeArtifact),
    codeRevisionsSummary: safeJsonParse(query.codeRevisionsSummary),
    academyBridgeContext: safeJsonParse(query.academyBridgeContext) || undefined,
    seniorReview: safeJsonParse(query.seniorReview) || undefined,
    voiceName: query.voice as string,
    userGender: (VALID_GENDERS.has(query.userGender) ? query.userGender : undefined) as any,
    turnMode: query.turnMode === 'manual' ? 'manual' : query.turnMode === 'auto' ? 'auto' : DEFAULT_TURN_MODE,
    strategy: query.strategy === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing',
    persona: (query.persona as string) || 'mentor',
    targetGrade: ((query.targetGrade as string) || 'L5_SENIOR') as TargetGrade,
    maxProbes: Math.max(1, Math.min(5, parseInt(String(query.maxProbes || '3'), 10) || 3)),
    deepDive: query.deepDive === 'true',
    liveCoaching: query.liveCoaching === 'true',
    strictness: VALID_STRICTNESS.has(rawStrict) ? (rawStrict as StrictnessLevel) : undefined,
    customPromptOverride: String(query.customPrompt || '').slice(0, 4000),
    initialUserMessage: ((query.initialUserMessage as string) || '').trim(),
    temperature: Number.isFinite(rawTemp) ? rawTemp : undefined,
    liveModel: (query.liveModel as string) || undefined,
    sessionType: (query.sessionType as any) || 'interview',
    tutorMode: (query.tutorMode as any) || 'deep_dive',
    questionIndex: Math.max(0, parseInt(String(query.questionIndex || '0'), 10) || 0),
    totalQuestions: Math.max(1, parseInt(String(query.totalQuestions || '1'), 10) || 1),
    isRetry: query.isRetry === 'true',
    isResumed: query.isResumed === 'true',
    initialProbesCount: Math.max(0, parseInt(String(query.probesCount || '0'), 10) || 0),
    vadPauseMs: clampVadPauseMs(query.vadPauseMs, DEFAULT_VAD_PAUSE_MS),
    enableSilenceClarification: query.enableSilenceClarification === 'true',
    debugStep: Number.isFinite(rawDebugStep) ? rawDebugStep : undefined,
    academyCourse: (query.academyCourse as string) || undefined,
    academyStep: (query.academyStep as string) || undefined,
    hrMode: (query.hrMode as any) || undefined,
    hrPersonaId: (query.hrPersonaId as any) || undefined,
    chunkId: (query.chunkId as string) || undefined,
    startBeatId: (query.startBeatId as string) || undefined,
    beatScope: query.beatScope === 'single_beat' ? 'single_beat' : query.beatScope === 'all_from_beat' ? 'all_from_beat' : undefined,
    rawInitFrame
  };
}

export function mergeInitFrameIntoConfig(config: LiveSessionResolvedConfig, rawInitFrame?: any): void {
  if (!rawInitFrame) return;
  let init = rawInitFrame;
  if (typeof init === 'string' || Buffer.isBuffer(init)) {
    try {
      init = JSON.parse(init.toString('utf8'));
    } catch {
      return;
    }
  }
  if (!init || typeof init !== 'object') return;
  if (init.sessionType) config.sessionType = init.sessionType;
  if (init.tutorMode) config.tutorMode = init.tutorMode;
  if (init.voice) config.voiceName = config.promptConfig.voiceName = sanitizeVoiceName(init.voice, config.voiceName);
  if (VALID_GENDERS.has(init.userGender)) config.userGender = config.promptConfig.userGender = init.userGender;
  if (init.turnMode === 'manual' || init.turnMode === 'auto') config.turnMode = config.promptConfig.turnMode = init.turnMode;
  if (init.liveModel && envConfig.models.supportedLiveModels.includes(String(init.liveModel))) config.liveModel = String(init.liveModel);
  if (init.vadPauseMs !== undefined) config.vadPauseMs = clampVadPauseMs(init.vadPauseMs, config.vadPauseMs);
  if (typeof init.enableSilenceClarification === 'boolean') config.enableSilenceClarification = init.enableSilenceClarification;
  if (VALID_STRICTNESS.has(init.strictness)) config.strictness = config.promptConfig.strictness = init.strictness;
  if (typeof init.deepDive === 'boolean') config.deepDive = config.promptConfig.deepDive = init.deepDive;
  if (typeof init.liveCoaching === 'boolean') config.liveCoaching = config.promptConfig.liveCoaching = init.liveCoaching;
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
  if (typeof init.customPrompt === 'string') config.customPromptOverride = config.promptConfig.customPromptOverride = init.customPrompt.slice(0, 4000);
  if (typeof init.initialUserMessage === 'string') config.initialUserMessage = config.promptConfig.initialUserMessage = init.initialUserMessage.trim();
  if (typeof init.temperature === 'number' && Number.isFinite(init.temperature)) config.temperature = config.promptConfig.temperature = init.temperature;
  if (init.activeCodeArtifact) config.activeCodeArtifact = init.activeCodeArtifact;
  if (init.academyBridgeContext) config.academyBridgeContext = init.academyBridgeContext;
  if (init.seniorReview) config.seniorReview = init.seniorReview;
  if (typeof init.questionIndex === 'number') config.questionIndex = init.questionIndex;
  if (typeof init.totalQuestions === 'number') config.totalQuestions = init.totalQuestions;
  if (typeof init.isRetry === 'boolean') config.isRetry = init.isRetry;
  if (typeof init.isResumed === 'boolean') config.isResumed = init.isResumed;
  if (init.hrMode) config.hrMode = init.hrMode;
  if (init.hrPersonaId) config.hrPersonaId = init.hrPersonaId;
  if (init.chunkId) config.chunkId = init.chunkId;
  if (init.startBeatId) config.startBeatId = String(init.startBeatId);
  if (init.beatScope === 'single_beat' || init.beatScope === 'all_from_beat') config.beatScope = init.beatScope;
  if (init.academyCourse) config.academyCourse = init.academyCourse;
  if (init.academyStep) config.academyStep = init.academyStep;
  if (init.questionId) config.questionId = String(init.questionId);
  if (init.sessionId) config.sessionId = init.sessionId;
}
