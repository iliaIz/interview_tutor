import { envConfig } from '../config/env';
import {
  buildSystemDesignProbePrompt,
  SystemDesignTutorMode
} from '../prompts/systemDesign/systemDesignPrompts';
import { wrapUntrustedContext } from '../prompts/core/sandboxDirectives';
import { resolveScenarioManifest } from './scenarioResolver';

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

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: wrapUntrustedContext('user_message', userMessage) }
    ];

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.text;

    let response: any;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxyApiKey}`
        },
        signal,
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: mode === 'deep_dive' ? 0.4 : mode === 'socratic' ? 0.7 : 0.6,
          max_tokens: 1000
        })
      });
    } catch (err: any) {
      if (endpointUrl.includes('host.docker.internal')) {
        const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
        response = await fetch(localUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proxyApiKey}`
          },
          signal,
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: mode === 'deep_dive' ? 0.4 : mode === 'socratic' ? 0.7 : 0.6,
            max_tokens: 1000
          })
        });
      } else {
        throw err;
      }
    }

    if (!response.ok) {
      throw new Error(`LLM Gateway HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Не удалось сформировать ответ тьютора. Попробуйте уточнить вопрос.';
    return { reply, mode };
  }
}
