import { envConfig } from '../config/env';
import {
  buildSystemDesignProbePrompt,
  SystemDesignTutorMode
} from '../prompts/systemDesign/systemDesignPrompts';
import { wrapUntrustedContext } from '../prompts/core/sandboxDirectives';
import { resolveScenarioManifest } from './scenarioResolver';
import { llmGateway } from './LlmGatewayClient';

export interface SystemDesignProbeParams {
  scenarioId?: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  mode?: SystemDesignTutorMode;
  contextType?: 'scenario' | 'math_coach';
  mathContext?: any;
  currentTopology?: any;
  candidateNotes?: string;
}

export interface SystemDesignProbeResult {
  reply: string;
  mode: SystemDesignTutorMode;
}

export class SystemDesignProbeGateway {
  static async probe(params: SystemDesignProbeParams, signal?: AbortSignal): Promise<SystemDesignProbeResult> {
    const {
      scenarioId,
      userMessage,
      conversationHistory,
      mode = 'free_chat',
      contextType = 'scenario',
      mathContext,
      currentTopology,
      candidateNotes
    } = params;

    const scenario = contextType === 'scenario' && scenarioId ? resolveScenarioManifest(scenarioId) : null;
    const systemPrompt = buildSystemDesignProbePrompt({
      scenarioTitle: scenario?.title,
      category: scenario?.category,
      archetype: scenario?.archetype,
      targetLevel: scenario?.target_level,
      trafficProfile: scenario?.trafficProfile,
      bottlenecksMarkdown: scenario?.bottlenecksMarkdown,
      tradeOffProbes: scenario?.tradeOffProbes,
      mode,
      contextType,
      mathContext,
      currentTopology,
      candidateNotes
    });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: wrapUntrustedContext('user_message', userMessage) }
    ];

    const reply = await llmGateway.completeText({
      messages,
      model: envConfig.models.text,
      temperature: mode === 'deep_dive' ? 0.4 : mode === 'socratic' ? 0.7 : 0.6,
      maxTokens: 1000,
      maxRetries: 2,
      timeoutMs: 45_000,
      abortSignal: signal
    });
    return {
      reply: reply || 'Не удалось сформировать ответ тьютора. Попробуйте уточнить вопрос.',
      mode
    };
  }
}
