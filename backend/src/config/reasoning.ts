/**
 * Standardized Thinking Budget & Reasoning Configurations for Gemini 3.7 Flash
 * SOTA August 2026 Strategy: Zero Hallucination for Complex Engineering Tasks
 */

export interface ReasoningConfig {
  thinkingBudget: number;
  temperature?: number;
  maxTokens?: number;
}

export const REASONING_PRESETS = {
  /** 
   * Ultra-Deep Reasoning (4096 tokens): For synthesizing production incidents,
   * subtle concurrency race conditions, JVM memory model leaks, and multi-step bug challenges.
   */
  deepIncidentSynthesis: {
    thinkingBudget: 4096,
    temperature: 0.2,
    maxTokens: 4096
  },

  /**
   * Code & Concurrency Audit (3072 tokens): For AST comparison, thread safety analysis,
   * and strict rubric evaluation of candidate solutions.
   */
  codeAudit: {
    thinkingBudget: 3072,
    temperature: 0.1,
    maxTokens: 8192
  },

  /**
   * Deep Conceptual Grading (1024 tokens): For Senior/Lead technical Q&A grading,
   * semantic equivalence verification, and missing concept detection.
   */
  conceptualGrading: {
    thinkingBudget: 1024,
    temperature: 0.2,
    maxTokens: 2048
  },

  /**
   * Pedagogical Podcast Script (1024 tokens): For structuring educational deep-dive
   * audio dialogues with clear narrative and zero fictional APIs.
   */
  podcastDramaturgy: {
    thinkingBudget: 1024,
    temperature: 0.3,
    maxTokens: 4096
  },

  /**
   * Realtime Conversational (0 tokens): Sub-300ms SLA for realtime speech turns.
   */
  realtimeFast: {
    thinkingBudget: 0,
    temperature: 0.3,
    maxTokens: 800
  }
} as const;

/**
 * Attaches thinking_budget to LiteLLM / OpenAI-compatible payload via extra_body.
 * Safely ignored by fallback models (3.6/3.5 Flash) if 3.7 Flash fails over.
 */
export function buildReasoningExtraBody(preset: ReasoningConfig): Record<string, any> {
  const budget = preset.thinkingBudget || 0;
  return {
    thinking_budget: budget,
    google: {
      thinking_config: {
        thinking_budget: budget
      }
    },
    generation_config: {
      thinking_config: {
        thinking_budget: budget
      }
    }
  };
}

