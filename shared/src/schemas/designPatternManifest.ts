import { Type, Static } from '@sinclair/typebox';
import {
  FileNodeSchema,
  CodeSmellItemSchema,
  SocraticProbeSchema,
  BarRaiserQuestionSchema,
  AstBytecodeConstraintSchema
} from './refactoringManifest';

/**
 * designPatternManifest.ts
 * SSOT TypeBox schema for SOTA 2026 Design Patterns Practice Arena (Pillar 09).
 * Governs Anti-Pattern Refactoring Katas, Modern Java 21 feature replacements,
 * and Enterprise Spring GoF idioms.
 * File length limit: <= 350 lines (Rule 8).
 */

export const PatternCategoryTier = Type.Union([
  Type.Literal('modern_alternatives'),
  Type.Literal('anti_patterns'),
  Type.Literal('enterprise_gof')
]);
export type PatternCategoryTier = Static<typeof PatternCategoryTier>;

export const TargetPatternEnum = Type.Union([
  Type.Literal('STATE'),
  Type.Literal('ADAPTER'),
  Type.Literal('DECORATOR'),
  Type.Literal('PROXY'),
  Type.Literal('CHAIN_OF_RESPONSIBILITY'),
  Type.Literal('FACTORY_METHOD'),
  Type.Literal('BUILDER'),
  Type.Literal('SEALED_VISITOR_REPLACEMENT'),
  Type.Literal('FUNCTIONAL_STRATEGY')
]);
export type TargetPattern = Static<typeof TargetPatternEnum>;

export const AntiPatternSmellSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  symptoms: Type.Array(Type.String(), { default: [] }),
  riskImpact: Type.String({ default: '' })
});
export type AntiPatternSmell = Static<typeof AntiPatternSmellSchema>;

export const SocraticTradeOffProbeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  question: Type.String({ minLength: 1 }),
  expectedTradeOffConsideration: Type.String({ default: '' })
});
export type SocraticTradeOffProbe = Static<typeof SocraticTradeOffProbeSchema>;

export const DesignPatternContextSchema = Type.Object({
  targetPattern: TargetPatternEnum,
  categoryTier: PatternCategoryTier,
  antiPatternSmell: AntiPatternSmellSchema,
  modernAlternativeTip: Type.Optional(Type.String()),
  socraticProbes: Type.Array(SocraticTradeOffProbeSchema, { default: [] }),
  structuralConstraints: AstBytecodeConstraintSchema
});
export type DesignPatternContext = Static<typeof DesignPatternContextSchema>;

export const DesignPatternChallengeManifestSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.Literal('design_patterns'),
  track: Type.Literal('design_patterns'),
  badge: Type.String({ default: '🏛️ Design Patterns' }),
  difficulty: Type.Union([
    Type.Literal('Junior'),
    Type.Literal('Middle'),
    Type.Literal('Senior'),
    Type.Literal('Lead')
  ]),
  targetStack: Type.String({ default: 'Java 21 LTS' }),
  estimatedMinutes: Type.Integer({ minimum: 10, maximum: 120, default: 45 }),
  companyContext: Type.String({ default: '' }),
  shortDescription: Type.String({ minLength: 1 }),
  instructionsMarkdown: Type.String({ minLength: 1 }),

  // Workspaces
  workspaceFiles: Type.Array(FileNodeSchema),
  referenceSolutionFiles: Type.Array(FileNodeSchema),

  // Voice & Review Rubrics
  smellsChecklist: Type.Array(CodeSmellItemSchema, { default: [] }),
  socraticProbes: Type.Array(SocraticProbeSchema, { default: [] }),
  barRaiserQuestions: Type.Array(BarRaiserQuestionSchema, { default: [] }),

  // Pattern Specific Context & Constraints
  designPatternContext: DesignPatternContextSchema,
  structuralConstraints: AstBytecodeConstraintSchema
});
export type DesignPatternChallengeManifest = Static<typeof DesignPatternChallengeManifestSchema>;
