/**
 * liveGeminiConfigBuilder.ts
 * Builds the canonical setup message for Google Gemini Live / Gemini 3.8 Live.
 * Configures generationConfig, realtimeInputConfig (Auto-VAD & interruption rules),
 * systemInstruction, and function declarations.
 */

export interface BuildGeminiSetupOptions {
  liveModel: string;
  voiceName: string;
  systemPromptText: string;
  sessionType: 'interview' | 'tutor' | 'system_design';
  strategy: 'adaptive_probing' | 'socratic_tutoring';
  normalizedTools: any[];
  vadPauseMs?: number;
  turnMode?: 'auto' | 'manual';
  temperature?: number;
  resumptionHandle?: string;
}

export function buildGeminiLiveSetupMessage(opts: BuildGeminiSetupOptions): any {
  const {
    liveModel,
    voiceName,
    systemPromptText,
    sessionType,
    strategy,
    normalizedTools,
    vadPauseMs = 500,
    turnMode = 'auto',
    resumptionHandle
  } = opts;

  const validVoices = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'];
  const resolvedVoice = validVoices.includes(voiceName) ? voiceName : 'Puck';

  const isThinkingModel = liveModel.includes('thinking') || liveModel === 'gemini-live-thinking-v3';

  // Canonical Gemini Live Standard (SOTA Late 2026):
  // Audio vocoder autoregressive synthesis requires temperature 1.0 (Google default).
  // Lower temperatures (<0.7) collapse latent acoustic space into 14-50s digital silence stalls.
  const effectiveTemperature = typeof opts.temperature === 'number'
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
      thinkingLevel: 'LOW',
      includeThoughts: true
    };
  }

  // Native Cloud VAD & Activity Detection for Gemini 3.8 Live (Canonical Google Standard)
  const isAutoVad = turnMode === 'auto';
  const effectiveSilenceDurationMs = Math.max(500, Math.min(1000, vadPauseMs ? Number(vadPauseMs) : 500));

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

  const sessionResumption = resumptionHandle
    ? { handle: resumptionHandle }
    : {};

  const setupMessage: any = {
    setup: {
      model: `models/${liveModel}`,
      generationConfig,
      systemInstruction: {
        parts: [{ text: systemPromptText }]
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig,
      sessionResumption
    }
  };

  if (normalizedTools && normalizedTools.length > 0) {
    setupMessage.setup.tools = [
      {
        functionDeclarations: normalizedTools
      }
    ];
  }

  return setupMessage;
}
