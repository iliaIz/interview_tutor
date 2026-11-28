import { Type, Static } from '@sinclair/typebox';

/**
 * tutorContext.ts
 * SSOT TypeBox schema for Polymorphic TutorActiveContext (Pillar 11).
 * Governs cross-arena AI Copilot context ingestion (Practice, SQL Arena, Companies, Incidents, System Design).
 * File length limit: <= 350 lines (Rule 8).
 */

export const TutorArenaType = Type.Union([
  Type.Literal('practice'),
  Type.Literal('sql_arena'),
  Type.Literal('companies'),
  Type.Literal('incidents'),
  Type.Literal('system_design')
]);
export type TutorArenaType = Static<typeof TutorArenaType>;

export const TutorPersona = Type.Union([
  Type.Literal('junior_explainer'),
  Type.Literal('middle_scaffold'),
  Type.Literal('senior_socratic'),
  Type.Literal('faang_interviewer'),
  Type.Literal('company_interviewer')
]);
export type TutorPersona = Static<typeof TutorPersona>;

export const TutorQuickActionChipSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
  promptMessage: Type.String({ minLength: 1 }),
  icon: Type.Optional(Type.String())
});
export type TutorQuickActionChip = Static<typeof TutorQuickActionChipSchema>;

export const TutorExecutionDiffSchema = Type.Object({
  missingRowsCount: Type.Optional(Type.Number()),
  unexpectedRowsCount: Type.Optional(Type.Number()),
  mismatchSample: Type.Optional(Type.String())
});
export type TutorExecutionDiff = Static<typeof TutorExecutionDiffSchema>;

export const TutorCompanyContextSchema = Type.Object({
  companyId: Type.String({ minLength: 1 }),
  companyName: Type.String({ minLength: 1 }),
  stageTitle: Type.Optional(Type.String()),
  cultureMetrics: Type.Optional(Type.Array(Type.String())),
  redFlags: Type.Optional(Type.Array(Type.String())),
  greenFlags: Type.Optional(Type.Array(Type.String())),
  takeHomeContext: Type.Optional(
    Type.Object({
      title: Type.String(),
      prAntiPatternsSummary: Type.Optional(Type.String())
    })
  )
});
export type TutorCompanyContext = Static<typeof TutorCompanyContextSchema>;

export const TutorChatMessageSchema = Type.Object({
  role: Type.Union([
    Type.Literal('user'),
    Type.Literal('assistant'),
    Type.Literal('system')
  ]),
  content: Type.String()
});
export type TutorChatMessage = Static<typeof TutorChatMessageSchema>;

export const TutorWhiteboardSnippetSchema = Type.Object({
  title: Type.String(),
  code: Type.String(),
  language: Type.String()
});
export type TutorWhiteboardSnippet = Static<typeof TutorWhiteboardSnippetSchema>;

export const TutorWorkspaceManifestSchema = Type.Object(
  {
    activeFile: Type.Optional(Type.Object({ path: Type.String(), content: Type.String() }, { additionalProperties: true })),
    secondaryFiles: Type.Optional(
      Type.Array(Type.Object({ path: Type.String(), content: Type.String() }, { additionalProperties: true }))
    ),
    projectTree: Type.Optional(Type.Array(Type.String())),
    xmlManifest: Type.Optional(Type.String())
  },
  { additionalProperties: true }
);
export type TutorWorkspaceManifest = Static<typeof TutorWorkspaceManifestSchema>;

export const TutorAcademyBridgeContextSchema = Type.Object({
  courseId: Type.Optional(Type.String()),
  stepId: Type.Optional(Type.String()),
  moduleTitle: Type.Optional(Type.String()),
  learningObjective: Type.Optional(Type.String()),
  targetConcepts: Type.Optional(Type.Array(Type.String()))
});
export type TutorAcademyBridgeContext = Static<typeof TutorAcademyBridgeContextSchema>;

export const TutorRoleSchema = Type.Union([
  Type.Literal('code_review'),
  Type.Literal('free_chat')
]);
export type TutorRole = Static<typeof TutorRoleSchema>;

export const TutorIncidentMetaSchema = Type.Object({
  incidentId: Type.Optional(Type.String()),
  bugType: Type.Optional(Type.String()),
  difficulty: Type.Optional(Type.String()),
  incidentContext: Type.Optional(Type.String()),
  hintCost: Type.Optional(Type.String()),
  topic: Type.Optional(Type.String()),
  language: Type.Optional(Type.String())
});
export type TutorIncidentMeta = Static<typeof TutorIncidentMetaSchema>;

export const TutorActiveContextSchema = Type.Object({
  arena: TutorArenaType,
  entityId: Type.String({ minLength: 1 }),
  entityTitle: Type.String({ minLength: 1 }),
  domain: Type.String({ minLength: 1 }),
  persona: TutorPersona,
  assistanceLevel: Type.Number({ minimum: 1, maximum: 4, default: 2 }),

  // Code & Query Workspace Payload
  activeCodeOrQuery: Type.Optional(Type.String()),
  activeFilePath: Type.Optional(Type.String()),
  schemaOrDdl: Type.Optional(Type.String()),
  instructions: Type.Optional(Type.String()),
  kataInstructions: Type.Optional(Type.String()),
  selectedCodeSnippet: Type.Optional(Type.String()),
  cursorLine: Type.Optional(Type.Number()),
  cursorColumn: Type.Optional(Type.Number()),
  survivingMutants: Type.Optional(Type.Array(Type.Any())),
  activeCompassRuleId: Type.Optional(Type.String()),
  activeWhiteboardSnippet: Type.Optional(TutorWhiteboardSnippetSchema),
  workspaceManifest: Type.Optional(TutorWorkspaceManifestSchema),
  academyBridgeContext: Type.Optional(TutorAcademyBridgeContextSchema),
  hintTier: Type.Optional(Type.Number({ minimum: 0, maximum: 4 })),
  tutorRole: Type.Optional(TutorRoleSchema),
  incidentMeta: Type.Optional(TutorIncidentMetaSchema),

  // Real-Time Execution Feedback
  compilerError: Type.Optional(Type.String()),
  runtimeError: Type.Optional(Type.String()),
  executionDiff: Type.Optional(TutorExecutionDiffSchema),

  // Company Culture Context
  companyContext: Type.Optional(TutorCompanyContextSchema),

  // Domain Quick Chips Configuration
  quickActionChips: Type.Array(TutorQuickActionChipSchema, { default: [] }),

  // Message History
  messages: Type.Optional(Type.Array(TutorChatMessageSchema))
});
export type TutorActiveContext = Static<typeof TutorActiveContextSchema>;

export const TutorVerifyDiagnosisRequestSchema = Type.Object({
  bugId: Type.Optional(Type.String()),
  diagnosis: Type.String({ minLength: 1 }),
  context: TutorActiveContextSchema
});
export type TutorVerifyDiagnosisRequest = Static<typeof TutorVerifyDiagnosisRequestSchema>;

export const TutorVerifyDiagnosisResponseSchema = Type.Object({
  verdict: Type.Union([
    Type.Literal('solved'),
    Type.Literal('partial'),
    Type.Literal('incorrect')
  ]),
  isCorrect: Type.Boolean(),
  feedback: Type.String(),
  revealedExplanation: Type.Optional(Type.String()),
  fsrsRecorded: Type.Optional(Type.Boolean())
});
export type TutorVerifyDiagnosisResponse = Static<typeof TutorVerifyDiagnosisResponseSchema>;
