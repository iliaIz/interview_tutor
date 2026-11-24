/**
 * voiceConfigResolver.ts
 * Pure headless Single Source of Truth (SSOT) merger for Live Voice sessions.
 * Hydrates every AI dialogue entry point with active global settings & backend /api/config defaults.
 * Cognitive Bounding Limit: <= 140 lines (Rule 8 compliant).
 */

import { InterviewConfig } from '../types/interviewConfig';
import {
  VOICE_DEFAULTS,
  RuntimeVoiceConfig,
  getCachedRuntimeVoiceConfig
} from '../config/voiceDefaults';
import { getActiveConfig } from '../services/profileStorage';
import type { LiveAudioSessionParams } from './useLiveVoiceSession';
import type { VoiceEngineConfig } from './types';

export function resolveEffectiveLiveModel(
  globalConfig: InterviewConfig,
  runtime?: RuntimeVoiceConfig | null,
  explicitOverride?: string
): string {
  const effectiveRuntime = runtime ?? getCachedRuntimeVoiceConfig();
  const supported = effectiveRuntime?.models?.supportedLiveModels;
  const runtimeDefault = effectiveRuntime?.models?.defaultLiveModel || VOICE_DEFAULTS.liveModel;

  if (explicitOverride) {
    if (!supported || supported.length === 0 || supported.includes(explicitOverride)) {
      return explicitOverride;
    }
    return runtimeDefault;
  }

  const candidate = globalConfig.liveModel;
  if (candidate) {
    if (!supported || supported.length === 0 || supported.includes(candidate)) {
      return candidate;
    }
  }

  return runtimeDefault;
}

export function clampClientVadPauseMs(
  rawValue: unknown,
  runtime?: RuntimeVoiceConfig | null
): number {
  const effectiveRuntime = runtime ?? getCachedRuntimeVoiceConfig();
  const minMs = effectiveRuntime?.vad?.minMs ?? VOICE_DEFAULTS.minVadPauseMs;
  const maxMs = effectiveRuntime?.vad?.maxMs ?? VOICE_DEFAULTS.maxVadPauseMs;
  const defaultMs = effectiveRuntime?.defaults?.vadPauseMs ?? VOICE_DEFAULTS.vadPauseMs;
  const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  const candidate = Number.isFinite(numeric) && numeric > 0 ? numeric : defaultMs;
  return Math.max(minMs, Math.min(maxMs, Math.round(candidate)));
}

export interface ResolveLiveConfigOptions {
  activeCode?: string;
  globalConfig?: InterviewConfig;
  runtimeConfig?: RuntimeVoiceConfig | null;
}

export function resolveLiveSessionConfig(
  params: LiveAudioSessionParams,
  options: ResolveLiveConfigOptions = {}
): VoiceEngineConfig {
  const globalConfig = options.globalConfig ?? getActiveConfig();
  const runtime = options.runtimeConfig ?? getCachedRuntimeVoiceConfig();

  const effectiveVoice =
    params.voice ||
    globalConfig.voice ||
    runtime?.defaults?.voice ||
    VOICE_DEFAULTS.voice;

  const effectiveUserGender =
    params.userGender ||
    globalConfig.userGender ||
    VOICE_DEFAULTS.userGender;

  const effectiveTurnMode =
    params.turnMode ||
    globalConfig.turnMode ||
    VOICE_DEFAULTS.turnMode;

  const effectiveLiveModel = resolveEffectiveLiveModel(
    globalConfig,
    runtime,
    params.liveModel
  );

  const effectiveVadPauseMs = clampClientVadPauseMs(
    params.vadPauseMs ?? globalConfig.vadPauseMs ?? runtime?.defaults?.vadPauseMs,
    runtime
  );

  const effectiveSilenceClarification =
    params.enableSilenceClarification ??
    globalConfig.enableSilenceClarification ??
    runtime?.defaults?.enableSilenceClarification ??
    VOICE_DEFAULTS.enableSilenceClarification;

  return {
    sessionId: params.sessionId || `session_${Date.now()}`,
    questionId: params.questionId || 'default_question',
    topic: params.topic,
    questionText: params.questionText,
    referenceAnswer: params.referenceAnswer,
    sessionType: params.sessionType || 'interview',
    tutorMode: params.tutorMode,
    voice: effectiveVoice,
    userGender: effectiveUserGender,
    turnMode: effectiveTurnMode,
    liveModel: effectiveLiveModel,
    vadPauseMs: effectiveVadPauseMs,
    persona: params.persona || params.tutorPersona || globalConfig.persona || VOICE_DEFAULTS.persona,
    targetGrade: params.targetGrade || globalConfig.targetGrade || VOICE_DEFAULTS.targetGrade,
    strategy: params.strategy || globalConfig.strategy || VOICE_DEFAULTS.strategy,
    strictness: params.strictness ?? globalConfig.strictness ?? VOICE_DEFAULTS.strictness,
    maxProbes: params.maxProbes ?? globalConfig.maxProbes ?? VOICE_DEFAULTS.maxProbes,
    deepDive: params.deepDive ?? globalConfig.deepDive ?? VOICE_DEFAULTS.deepDive,
    liveCoaching: params.liveCoaching ?? globalConfig.liveCoaching ?? VOICE_DEFAULTS.liveCoaching,
    bugTitle: params.bugTitle,
    bugExplanation: params.bugExplanation,
    codeSnippet: params.codeSnippet || options.activeCode,
    fixedCode: params.fixedCode,
    unitTest: params.unitTest,
    scenarioId: params.scenarioId,
    incidentContext: params.incidentContext,
    customPrompt: params.customPrompt,
    challengeCategory: params.challengeCategory,
    challengeTrack: params.challengeTrack,
    challengeDomain: params.challengeDomain,
    initialUserMessage: params.initialUserMessage,
    isResumed: params.isResumed,
    enableSilenceClarification: effectiveSilenceClarification,
    debugStep: params.debugStep,
    temperature: params.temperature,
    workspaceManifest: params.workspaceManifest,
    activeCodeArtifact: params.activeCodeArtifact as any,
    academyCourse: params.academyCourse,
    academyStep: params.academyStep,
    academyBridgeContext: params.academyBridgeContext,
    seniorReview: params.seniorReview,
    hrMode: params.hrMode as any,
    dossierId: params.dossierId,
    jobId: params.jobId,
    hrPersonaId: params.hrPersonaId,
    questionMatrixId: params.questionMatrixId,
    chunkId: params.chunkId,
    questionIndex: params.questionIndex,
    totalQuestions: params.totalQuestions,
    isRetry: params.isRetry,
  };
}
