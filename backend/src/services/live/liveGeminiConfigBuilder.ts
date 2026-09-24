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
}

export function buildGeminiLiveSetupMessage(opts: BuildGeminiSetupOptions): any {
  const {
    liveModel,
    voiceName,
    systemPromptText,
    sessionType,
    strategy,
    normalizedTools,
    vadPauseMs = 1800,
    turnMode = 'auto'
  } = opts;

  const validVoices = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'];
  const resolvedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

  const isThinkingModel = liveModel.includes('thinking') || liveModel === 'gemini-live-thinking-v3';

  const generationConfig: any = {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: resolvedVoice
        }
      }
    },
    temperature: sessionType === 'tutor' ? 0.3 : (strategy === 'socratic_tutoring' ? 0.4 : 0.2)
  };

  if (isThinkingModel) {
    generationConfig.thinkingConfig = {
      thinkingLevel: 'LOW',
      includeThoughts: true
    };
  }

  // SOTA Late 2026: Gemini 3.8 Live RealtimeInputConfig with native Auto-VAD
  const isAutoVad = turnMode === 'auto';
  const realtimeInputConfig: any = {
    automaticActivityDetection: {
      disabled: !isAutoVad,
      startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
      endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
      prefixPaddingMs: 40,
      silenceDurationMs: vadPauseMs
    },
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

  if (normalizedTools && normalizedTools.length > 0) {
    setupMessage.setup.tools = [
      {
        functionDeclarations: normalizedTools
      }
    ];
  }

  return setupMessage;
}
