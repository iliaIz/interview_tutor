/**
 * liveGeminiConfigBuilder.ts
 * Builds the canonical setup message for Google Gemini Live.
 * Configures generationConfig, realtimeInputConfig (Auto-VAD & interruption rules),
 * systemInstruction, and function declarations.
 */

import { envConfig } from '../../config/env';
import {
  MIN_VAD_SILENCE_MS,
  clampVadPauseMs,
  sanitizeVoiceName
} from '../../config/liveDefaults';

export interface BuildGeminiSetupOptions {
  liveModel: string;
  voiceName: string;
  systemPromptText: string;
  sessionType: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill' | 'hr_tutor';
  strategy: 'adaptive_probing' | 'socratic_tutoring';
  normalizedTools: any[];
  vadPauseMs?: number;
  turnMode?: 'auto' | 'manual';
  temperature?: number;
  resumptionHandle?: string;
}

export function buildGeminiLiveSetupMessage(opts: BuildGeminiSetupOptions): any {
  const {
    liveModel: rawLiveModel,
    voiceName,
    systemPromptText,
    sessionType,
    strategy,
    normalizedTools,
    vadPauseMs = MIN_VAD_SILENCE_MS,
    turnMode = 'auto'
  } = opts;

  const liveModel = rawLiveModel || envConfig.models.live;
  const resolvedVoice = sanitizeVoiceName(voiceName);

  const isThinkingModel = liveModel.includes('thinking') || liveModel === envConfig.models.liveThinking;

  // Canonical Gemini Live Standard (SOTA Late 2026):
  // Audio vocoder autoregressive synthesis requires temperature 1.0 (Google default).
  // Lower temperatures (<0.7) collapse latent acoustic space into 14-50s digital silence stalls.
  const effectiveTemperature = typeof opts.temperature === 'number' && opts.temperature >= 0.7
    ? opts.temperature
    : 1.0;

  const generationConfig: any = {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: resolvedVoice
        }
      }
    },
    temperature: effectiveTemperature
  };

  if (isThinkingModel) {
    generationConfig.thinkingConfig = {
      thinkingLevel: 'low',
      includeThoughts: true
    };
  }

  // Native Cloud VAD & Activity Detection for Gemini Live (Canonical Google Standard)
  const isAutoVad = turnMode === 'auto';
  const effectiveSilenceDurationMs = clampVadPauseMs(vadPauseMs, MIN_VAD_SILENCE_MS);

  const automaticActivityDetection: any = isAutoVad
    ? {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
        prefixPaddingMs: 200,
        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
        silenceDurationMs: effectiveSilenceDurationMs
      }
    : {
        disabled: true
      };

  const realtimeInputConfig: any = {
    automaticActivityDetection,
    activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
  };

  const setupMessage: any = {
    setup: {
      model: `models/${liveModel}`,
      generationConfig,
      systemInstruction: {
        parts: [{ text: systemPromptText }]
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig
    }
  };

  if (opts.resumptionHandle) {
    setupMessage.setup.sessionResumptionConfig = {
      handle: opts.resumptionHandle
    };
  }

  if (normalizedTools && normalizedTools.length > 0) {
    setupMessage.setup.tools = [
      {
        functionDeclarations: normalizedTools
      }
    ];
  }

  return setupMessage;
}
