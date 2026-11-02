import { Type, Static } from '@sinclair/typebox';

/**
 * refactoringManifest.ts
 * SSOT TypeBox schema for Canonical Refactoring & Code Review Katas (L0–L3).
 * SOTA Late 2026 Assessment Standard.
 * File length limit: <= 350 lines (Rule 8).
 */

export const RefactoringGrade = Type.Union([
  Type.Literal('L0_JUNIOR'),
  Type.Literal('L1_MIDDLE'),
  Type.Literal('L2_SENIOR'),
  Type.Literal('L3_STAFF')
]);
export type RefactoringGrade = Static<typeof RefactoringGrade>;

export const SmellCategory = Type.Union([
  Type.Literal('CLEAN_CODE'),
  Type.Literal('CONCURRENCY_JMM'),
  Type.Literal('TRANSACTION_BOUNDARY'),
  Type.Literal('ARCHITECTURAL_COUPLING'),
  Type.Literal('RESOURCE_MANAGEMENT'),
  Type.Literal('TYPE_SAFETY')
]);
export type SmellCategory = Static<typeof SmellCategory>;

export const SmellSeverity = Type.Union([
  Type.Literal('CRITICAL'),
  Type.Literal('MAJOR'),
  Type.Literal('MINOR')
]);
export type SmellSeverity = Static<typeof SmellSeverity>;

export const FileNodeSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  content: Type.String(),
  readOnly: Type.Boolean({ default: false }),
  hidden: Type.Boolean({ default: false }),
  isMainEntryPoint: Type.Optional(Type.Boolean())
});
export type FileNode = Static<typeof FileNodeSchema>;

export const CodeSmellItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  category: SmellCategory,
  description: Type.String(),
  targetLinesSnippet: Type.Optional(Type.String()),
  voiceKeywords: Type.Array(Type.String()),
  severity: SmellSeverity
});
export type CodeSmellItem = Static<typeof CodeSmellItemSchema>;

export const BarRaiserQuestionSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  questionText: Type.String(),
  voicePrompt: Type.String(),
  idealResponseSummary: Type.String(),
  followUpDeepDives: Type.Array(Type.String())
});
export type BarRaiserQuestion = Static<typeof BarRaiserQuestionSchema>;

export const SocraticProbeSchema = Type.Object({
  triggerCondition: Type.String(),
  spokenGuidance: Type.String()
});
export type SocraticProbe = Static<typeof SocraticProbeSchema>;

export const AstBytecodeConstraintSchema = Type.Object({
  disallowedAstNodes: Type.Array(Type.String(), { default: [] }),
  disallowedClassImports: Type.Array(Type.String(), { default: [] }),
  disallowedFieldTypes: Type.Array(Type.String(), { default: [] }),
  requiredInjections: Type.Array(Type.String(), { default: [] }),
  disallowedConstructs: Type.Optional(Type.Array(Type.String(), { default: [] })),
  requiredKeywords: Type.Optional(Type.Array(Type.String(), { default: [] })),
  maxMethodLines: Type.Optional(Type.Integer({ minimum: 5 }))
});
export type AstBytecodeConstraint = Static<typeof AstBytecodeConstraintSchema>;

export const RefactoringChallengeManifestSchema = Type.Object({
  id: Type.String({ pattern: '^[L][0-3]-REF-\\d{2}$' }),
  slug: Type.String(),
  title: Type.String({ minLength: 1 }),
  grade: RefactoringGrade,
  archetype: Type.String(),
  category: Type.Literal('refactoring_kata'),
  track: Type.Literal('refactoring'),
  badge: Type.String({ default: '🛡️ Refactoring Kata' }),
  difficulty: Type.Union([
    Type.Literal('Junior'),
    Type.Literal('Middle'),
    Type.Literal('Senior'),
    Type.Literal('Lead')
  ]),
  targetStack: Type.String({ default: 'Java 21 LTS' }),
  estimatedMinutes: Type.Integer({ minimum: 10, maximum: 120, default: 45 }),
  companyContext: Type.String(),
  shortDescription: Type.String(),
  instructionsMarkdown: Type.String(),
  
  // Workspaces (Seamless compatibility with WorkspaceEditor.tsx)
  workspaceFiles: Type.Array(FileNodeSchema),
  referenceSolutionFiles: Type.Array(FileNodeSchema),
  
  // Voice & Review Rubrics
  smellsChecklist: Type.Array(CodeSmellItemSchema),
  socraticProbes: Type.Array(SocraticProbeSchema, { default: [] }),
  barRaiserQuestions: Type.Array(BarRaiserQuestionSchema, { default: [] }),
  
  // Deterministic Sandbox Invariants (3-Gate)
  structuralConstraints: AstBytecodeConstraintSchema
});
export type RefactoringChallengeManifest = Static<typeof RefactoringChallengeManifestSchema>;
