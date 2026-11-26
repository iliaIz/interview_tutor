import {
  TutorActiveContext,
  TutorAcademyBridgeContext,
  TutorPersona,
  TutorQuickActionChip,
  TutorWhiteboardSnippet,
  TutorWorkspaceManifest
} from './tutorContext';

/**
 * tutorPracticeNormalizer.ts
 * SSOT Practice Workspace Context Normalizer (Spec 58 / Pillar 11).
 * File length limit: <= 150 lines.
 */

export interface PracticeSpokePayload {
  kataId: string;
  kataTitle: string;
  kataCategory?: string;
  kataInstructions?: string;
  activeFilePath?: string;
  activeFileContent?: string;
  selectedCodeSnippet?: string;
  cursorLine?: number;
  cursorColumn?: number;
  survivingMutants?: Array<any>;
  compilerError?: string;
  testFailureMessage?: string;
  activeCompassRuleId?: string;
  activeWhiteboardSnippet?: TutorWhiteboardSnippet;
  workspaceManifest?: TutorWorkspaceManifest;
  academyBridgeContext?: TutorAcademyBridgeContext;
  hintTier?: number;
  persona?: TutorPersona;
  assistanceLevel?: number;
}

const DEFAULT_PRACTICE_CHIPS: TutorQuickActionChip[] = [
  {
    id: 'socratic_hint',
    label: '💡 Socratic Намёк',
    promptMessage: 'Дай Socratic-намёк на нарушение инварианта в коде, не раскрывая готовое решение.'
  },
  {
    id: 'mutation_kill',
    label: '🎯 Как убить мутанта?',
    promptMessage: 'Объясни структуру выжившего мутанта и какой граничный тест необходим для его уничтожения.'
  },
  {
    id: 'ast_structure',
    label: '🧩 Архитектурный паттерн',
    promptMessage: 'Какой архитектурный паттерн или рефакторинг здесь наиболее уместен?'
  }
];

/**
 * Normalizes Practice Workspace into canonical TutorActiveContext without losing editor,
 * mutant, whiteboard, workspace manifest, or academy bridge metadata.
 */
export function normalizePracticeContext(payload: PracticeSpokePayload): TutorActiveContext {
  const instructions = payload.kataInstructions || '';

  return {
    arena: 'practice',
    entityId: payload.kataId || 'practice-kata',
    entityTitle: payload.kataTitle || payload.kataId || 'Practice Kata',
    domain: payload.kataCategory || 'Testing & Mutation Katas',
    persona: payload.persona || 'middle_scaffold',
    assistanceLevel: payload.assistanceLevel ?? 2,
    activeFilePath: payload.activeFilePath,
    activeCodeOrQuery: payload.activeFileContent,
    instructions,
    kataInstructions: instructions,
    selectedCodeSnippet: payload.selectedCodeSnippet,
    cursorLine: payload.cursorLine,
    cursorColumn: payload.cursorColumn,
    survivingMutants: payload.survivingMutants,
    compilerError: payload.compilerError,
    runtimeError: payload.testFailureMessage,
    activeCompassRuleId: payload.activeCompassRuleId,
    activeWhiteboardSnippet: payload.activeWhiteboardSnippet,
    workspaceManifest: payload.workspaceManifest,
    academyBridgeContext: payload.academyBridgeContext,
    hintTier: payload.hintTier,
    quickActionChips: DEFAULT_PRACTICE_CHIPS
  };
}
