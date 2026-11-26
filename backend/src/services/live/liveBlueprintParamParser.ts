import {
  DEFAULT_TURN_MODE,
  DEFAULT_VAD_PAUSE_MS,
  clampVadPauseMs
} from '../../config/liveDefaults';
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';
import { TargetGrade } from '../../prompts/personas';
import {
  AuthenticatedWsUser,
  LiveSessionBlueprintParams,
  LiveSessionResolvedConfig
} from './liveSessionConfigTypes';
import { LiveWorkspaceStore } from './LiveWorkspaceStore';

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
    dossierId: (query.dossierId as string) || undefined,
    jobId: (query.jobId as string) || undefined,
    questionMatrixId: (query.questionMatrixId as string) || undefined,
    chunkId: (query.chunkId as string) || undefined,
    startBeatId: (query.startBeatId as string) || undefined,
    beatScope: query.beatScope === 'single_beat' ? 'single_beat' : query.beatScope === 'all_from_beat' ? 'all_from_beat' : undefined,
    rawInitFrame
  };
}

export function mergeInitFrameIntoConfig(config: LiveSessionResolvedConfig, rawInitFrame?: any): void {
  LiveWorkspaceStore.mergeInitFrame(config, rawInitFrame, { preserveExistingQuestionText: false });
}
