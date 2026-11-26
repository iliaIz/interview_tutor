/**
 * SOTA 2026 Unified Socratic Tutor Types & Cross-Arena Contracts
 * Synthesized from Wave 4 Deep Research: Multimodal Socratic Curriculum Routing
 */

import type { TutorPersona } from '@interview-prep/shared';

export type { TutorPersona };

export type TutorArenaId =
  | 'testing'
  | 'transactions'
  | 'system_design'
  | 'triage'
  | 'lld'
  | 'oral';

export type TutorModality = 'text' | 'voice';

export interface UnifiedTutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  leakDetected?: boolean;
  similarity?: number;
  suggestedAction?: {
    label: string;
    arena: TutorArenaId;
    scenarioId: string;
  };
}

export interface UnifiedTutorContextPayload {
  arena: TutorArenaId;
  scenarioId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  instructions: string;
  activeFilePath?: string;
  activeFileContent?: string;
  selectedCodeSnippet?: string;
  cursorLine?: number;
  cursorColumn?: number;
  compilerError?: string;
  testFailureMessage?: string;
  activeCompassRuleId?: string;
  customTelemetry?: Record<string, unknown>;
}

export interface SocraticTutorConfig {
  arena: TutorArenaId;
  scenarioId: string;
  compassId?: string;
  systemPromptPersona: string;
  contextPayload: () => UnifiedTutorContextPayload;
}

export interface CrossArenaTutorEvent {
  id: string;
  timestamp: number;
  arena: TutorArenaId;
  scenarioId: string;
  eventType:
    | 'test_failure'
    | 'mutation_survived'
    | 'deadlock_detected'
    | 'isolation_leak'
    | 'spof_detected'
    | 'oom_crash'
    | 'hesitation_pause'
    | 'rule_grounded';
  payload: Record<string, unknown>;
}
