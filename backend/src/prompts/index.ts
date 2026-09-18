/**
 * index.ts
 *
 * Centralized Prompt Architecture & Registry for InterviewPrep AI.
 * SOTA 2026 Standards: Modularization, Epistemic Vigilance, and Invariant Grounding.
 */

// Core Directives & Invariants
export {
  ANTI_SYCOPHANCY_DIRECTIVES,
  VOICE_ANTI_SYCOPHANCY_DIRECTIVES,
  EXAM_ANTI_SYCOPHANCY_DIRECTIVES,
  SOCRATIC_FORWARD_PROBING_DIRECTIVES,
  TRIVIA_IMMUNITY_INVARIANT,
  CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES,
  CHAIN_OF_VERIFICATION_THOUGHT_DIRECTIVE,
  StrictnessLevel,
  getStrictnessDirectives
} from './core/antiSycophancy';

export {
  wrapUntrustedContext,
  PROMPT_INJECTION_DEFENSE_DIRECTIVE
} from './core/sandboxDirectives';

export {
  getAiGenderDirective,
  getCandidateGenderDirective
} from './core/genderDirectives';

export {
  JAVA21_PLATFORM_INVARIANTS
} from './core/platformInvariants';

// Compass Rules
export {
  TESTING_COMPASS_RULES,
  CompassRule
} from './tutor/testingCompassRules';

export {
  LLD_COMPASS_RULES
} from './tutor/lldCompassRules';

// Practice Tutor Prompt Engine
export {
  buildPracticeTutorSystemPrompt,
  PracticeTutorContext,
  TutorPersona,
  HintTier
} from './practiceTutorPrompts';

// Live Multimodal Audio Prompts
export {
  buildLivePairPrompt,
  LivePairPromptParams
} from './live/livePairPrompts';

// Examiner Personas & Grade Calibration
export {
  InterviewPersonaId,
  TargetGrade,
  PersonaPromptContext,
  getPersonaPromptDirectives
} from './personas';

// System Design Prompts
export {
  buildSystemDesignProbePrompt,
  buildSystemDesignEvaluationPrompt,
  SystemDesignTutorMode,
  SystemDesignProbeParams,
  SystemDesignEvalParams
} from './systemDesign/systemDesignPrompts';

// Production Incident Triage Prompts
export {
  buildTriageEvaluationPrompt,
  buildTriageProbePrompt,
  TriageEvaluationParams,
  TriageProbeParams
} from './triage/triagePrompts';

import { buildPracticeTutorSystemPrompt, PracticeTutorContext } from './practiceTutorPrompts';
import { buildLivePairPrompt, LivePairPromptParams } from './live/livePairPrompts';
import { TESTING_COMPASS_RULES } from './tutor/testingCompassRules';
import { LLD_COMPASS_RULES } from './tutor/lldCompassRules';
import {
  ANTI_SYCOPHANCY_DIRECTIVES,
  VOICE_ANTI_SYCOPHANCY_DIRECTIVES,
  SOCRATIC_FORWARD_PROBING_DIRECTIVES
} from './core/antiSycophancy';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from './core/sandboxDirectives';
import { JAVA21_PLATFORM_INVARIANTS } from './core/platformInvariants';
import {
  buildSystemDesignProbePrompt,
  buildSystemDesignEvaluationPrompt,
  SystemDesignProbeParams,
  SystemDesignEvalParams
} from './systemDesign/systemDesignPrompts';
import {
  buildTriageEvaluationPrompt,
  buildTriageProbePrompt,
  TriageEvaluationParams,
  TriageProbeParams
} from './triage/triagePrompts';

/**
 * High-Level Prompt Registry Facade
 */
export const PromptRegistry = {
  version: '2026.9.1',

  getTestingRules() {
    return Object.values(TESTING_COMPASS_RULES);
  },

  getLldRules() {
    return Object.values(LLD_COMPASS_RULES);
  },

  buildTutorPrompt(context: PracticeTutorContext): string {
    return buildPracticeTutorSystemPrompt(context);
  },

  buildLivePairPrompt(params: LivePairPromptParams): string {
    return buildLivePairPrompt(params);
  },

  buildSystemDesignProbePrompt(params: SystemDesignProbeParams): string {
    return buildSystemDesignProbePrompt(params);
  },

  buildSystemDesignEvaluationPrompt(params: SystemDesignEvalParams): string {
    return buildSystemDesignEvaluationPrompt(params);
  },

  buildTriageEvaluationPrompt(params: TriageEvaluationParams): { systemPrompt: string; userPrompt: string } {
    return buildTriageEvaluationPrompt(params);
  },

  buildTriageProbePrompt(params: TriageProbeParams): string {
    return buildTriageProbePrompt(params);
  },

  wrapUntrustedContext(tag: string, content: string): string {
    return wrapUntrustedContext(tag, content);
  },

  getInvariants() {
    return {
      antiSycophancy: ANTI_SYCOPHANCY_DIRECTIVES,
      voiceAntiSycophancy: VOICE_ANTI_SYCOPHANCY_DIRECTIVES,
      socraticForwardProbing: SOCRATIC_FORWARD_PROBING_DIRECTIVES,
      promptInjectionDefense: PROMPT_INJECTION_DEFENSE_DIRECTIVE,
      platformInvariants: JAVA21_PLATFORM_INVARIANTS
    };
  }
};
