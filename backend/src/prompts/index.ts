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
  EXAM_ANTI_SYCOPHANCY_DIRECTIVES
} from './core/antiSycophancy';

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

import { buildPracticeTutorSystemPrompt, PracticeTutorContext } from './practiceTutorPrompts';
import { buildLivePairPrompt, LivePairPromptParams } from './live/livePairPrompts';
import { TESTING_COMPASS_RULES } from './tutor/testingCompassRules';
import { LLD_COMPASS_RULES } from './tutor/lldCompassRules';
import { ANTI_SYCOPHANCY_DIRECTIVES, VOICE_ANTI_SYCOPHANCY_DIRECTIVES } from './core/antiSycophancy';
import { JAVA21_PLATFORM_INVARIANTS } from './core/platformInvariants';

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

  getInvariants() {
    return {
      antiSycophancy: ANTI_SYCOPHANCY_DIRECTIVES,
      voiceAntiSycophancy: VOICE_ANTI_SYCOPHANCY_DIRECTIVES,
      platformInvariants: JAVA21_PLATFORM_INVARIANTS
    };
  }
};
