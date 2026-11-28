import {
  TutorActiveContext,
  TutorPersona,
  TutorQuickActionChip,
  TutorRole
} from './tutorContext';

/**
 * tutorIncidentsNormalizer.ts
 * SSOT Bug Hunt / Incidents Workspace Context Normalizer (Spec 62).
 * Normalizes code-review challenges without attaching ground-truth fixed_code spoilers.
 * File length limit: <= 150 lines.
 */

export interface IncidentsSpokePayload {
  bugId: string;
  title: string;
  topic?: string;
  difficulty?: string;
  buggyCode: string;
  bugType?: string;
  incidentContext?: string;
  hintCost?: string;
  language?: string;
  selectedCodeSnippet?: string;
  cursorLine?: number;
  tutorRole?: TutorRole;
  persona?: TutorPersona;
  assistanceLevel?: number;
  hintTier?: number;
}

const DEFAULT_INCIDENTS_CHIPS: TutorQuickActionChip[] = [
  {
    id: 'identify_symptom',
    label: '🔎 Где аномалия?',
    promptMessage: 'Помоги сузить зону поиска: на какой инвариант или контракт в этом фрагменте обратить внимание (без готового фикса)?'
  },
  {
    id: 'trace_failure',
    label: '⚡ Сценарий сбоя',
    promptMessage: 'Проследи пошагово выполнение этого кода при плохом входе или конкурентности и объясни симптом сбоя, не раскрывая исправленный код.'
  },
  {
    id: 'board_diagram',
    label: '📊 Схема на Доску',
    promptMessage: 'Визуализируй на Доске ИИ краткую Mermaid-диаграмму (sequenceDiagram или flowchart) возникновения этого бага, не выводя готовое решение.'
  }
];

export function normalizeIncidentsContext(payload: IncidentsSpokePayload): TutorActiveContext {
  const bugId = payload.bugId || 'bug-hunt';
  const title = payload.title || bugId || 'Bug Hunt Code Review';
  const instructions = payload.incidentContext
    ? `Инцидент (${payload.difficulty || 'Senior'}): ${payload.incidentContext}`
    : `Ревью кода и поиск корневой причины бага: ${title}`;

  return {
    arena: 'incidents',
    entityId: bugId,
    entityTitle: title,
    domain: payload.topic || 'Production Bug Hunt',
    persona: payload.persona || 'senior_socratic',
    assistanceLevel: payload.assistanceLevel ?? 3,
    activeCodeOrQuery: payload.buggyCode,
    instructions,
    selectedCodeSnippet: payload.selectedCodeSnippet,
    cursorLine: payload.cursorLine,
    tutorRole: payload.tutorRole || 'code_review',
    hintTier: payload.hintTier,
    incidentMeta: {
      incidentId: bugId,
      bugType: payload.bugType,
      difficulty: payload.difficulty,
      incidentContext: payload.incidentContext,
      hintCost: payload.hintCost,
      topic: payload.topic,
      language: payload.language
    },
    quickActionChips: DEFAULT_INCIDENTS_CHIPS
  };
}
