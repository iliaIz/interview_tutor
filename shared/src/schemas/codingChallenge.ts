import { Type, Static } from '@sinclair/typebox';
import {
  AstBytecodeConstraintSchema,
  BarRaiserQuestionSchema,
  CodeSmellItemSchema,
  SocraticProbeSchema
} from './refactoringManifest';
import {
  AntiPatternSmellSchema,
  PatternCategoryTier,
  SocraticTradeOffProbeSchema
} from './designPatternManifest';

/**
 * codingChallenge.ts
 * Unified SSOT TypeBox schema for all Coding, Refactoring, Design Pattern, and Mutation Katas.
 * Cognitive bounding limit: <= 160 lines.
 */

export const ChallengeDifficultyEnum = Type.Union([
  Type.Literal('Junior'),
  Type.Literal('Middle'),
  Type.Literal('Senior'),
  Type.Literal('Lead')
]);
export type ChallengeDifficulty = Static<typeof ChallengeDifficultyEnum>;

export const ChallengeFileNodeSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  content: Type.String(),
  readOnly: Type.Optional(Type.Boolean()),
  isReadOnly: Type.Optional(Type.Boolean()),
  hidden: Type.Optional(Type.Boolean()),
  isMainEntryPoint: Type.Optional(Type.Boolean()),
  isTestFile: Type.Optional(Type.Boolean())
});
export type ChallengeFileNode = Static<typeof ChallengeFileNodeSchema>;

export const TestCaseSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  phase: Type.Number(),
  weight: Type.Number(),
  timeoutMs: Type.Number(),
  input: Type.Optional(Type.String()),
  expectedOutput: Type.Optional(Type.String()),
  assertionScript: Type.Optional(Type.String()),
  isHidden: Type.Boolean()
});
export type TestCase = Static<typeof TestCaseSchema>;

export const PhasedRequirementSchema = Type.Object({
  phase: Type.Number(),
  unlockTimeMinutes: Type.Number(),
  title: Type.String(),
  descriptionMarkdown: Type.String(),
  addedFiles: Type.Optional(Type.Array(ChallengeFileNodeSchema)),
  testCases: Type.Optional(Type.Array(TestCaseSchema))
});
export type PhasedRequirement = Static<typeof PhasedRequirementSchema>;

export const GoldenMasterConfigSchema = Type.Object({
  enabled: Type.Boolean(),
  approvedSnapshotPath: Type.String(),
  receivedSnapshotPath: Type.String(),
  snapshotGeneratorClass: Type.String(),
  simulatedIterations: Type.Number(),
  ignoreLineEndings: Type.Boolean(),
  sampleBaselineText: Type.Optional(Type.String())
});
export type GoldenMasterConfig = Static<typeof GoldenMasterConfigSchema>;

export const ConcurrencyHarnessConfigSchema = Type.Object({
  enabled: Type.Boolean(),
  useVirtualThreads: Type.Boolean(),
  concurrentThreadCount: Type.Number(),
  executionTimeoutMs: Type.Number(),
  detectCarrierThreadPinning: Type.Boolean(),
  detectThreadLeaks: Type.Boolean(),
  stressLoopCount: Type.Number()
});
export type ConcurrencyHarnessConfig = Static<typeof ConcurrencyHarnessConfigSchema>;

export const JavaIdiomRequirementsSchema = Type.Object({
  requireSealedClasses: Type.Optional(Type.Boolean()),
  requireRecords: Type.Optional(Type.Boolean()),
  requirePatternMatching: Type.Optional(Type.Boolean()),
  disallowSynchronizedKeyword: Type.Optional(Type.Boolean())
});
export type JavaIdiomRequirements = Static<typeof JavaIdiomRequirementsSchema>;

export const ChallengeMutantSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  mutatorType: Type.Optional(Type.String()),
  file: Type.String({ minLength: 1 }),
  line: Type.Number(),
  mutatedContent: Type.String()
});
export type ChallengeMutant = Static<typeof ChallengeMutantSchema>;

export const ChallengeScoringWeightsSchema = Type.Object({
  functionalCorrectness: Type.Number(),
  concurrencySafety: Type.Number(),
  architectureAndCleanCode: Type.Number(),
  modernIdioms: Type.Number(),
  oralDefense: Type.Optional(Type.Number())
});
export type ChallengeScoringWeights = Static<typeof ChallengeScoringWeightsSchema>;

export const CodingChallengeDesignPatternContextSchema = Type.Object({
  targetPattern: Type.String({ minLength: 1 }),
  categoryTier: PatternCategoryTier,
  antiPatternSmell: AntiPatternSmellSchema,
  modernAlternativeTip: Type.Optional(Type.String()),
  socraticProbes: Type.Array(SocraticTradeOffProbeSchema),
  structuralConstraints: AstBytecodeConstraintSchema
});

export const CodingChallengeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  category: Type.String({ minLength: 1 }),
  track: Type.Optional(Type.String()),
  taskCode: Type.Optional(Type.String()),
  badge: Type.String({ minLength: 1 }),
  difficulty: ChallengeDifficultyEnum,
  targetStack: Type.Optional(Type.String()),
  techStack: Type.Optional(Type.String()),
  architecturePattern: Type.Optional(Type.String()),
  timeLimitMinutes: Type.Optional(Type.Number({ minimum: 1 })),
  estimatedMinutes: Type.Optional(Type.Number({ minimum: 1 })),
  shortDescription: Type.String(),
  instructionsMarkdown: Type.String(),
  scenarioMarkdown: Type.Optional(Type.String()),
  workspaceFiles: Type.Array(ChallengeFileNodeSchema, { minItems: 1 }),
  referenceSolutionFiles: Type.Optional(Type.Array(ChallengeFileNodeSchema)),
  phasedRequirements: Type.Optional(Type.Array(PhasedRequirementSchema)),
  phases: Type.Optional(Type.Array(PhasedRequirementSchema)),
  goldenMasterConfig: Type.Optional(GoldenMasterConfigSchema),
  enforceSeamValidation: Type.Optional(Type.Boolean()),
  allowedPublicSignatureChanges: Type.Optional(Type.Number()),
  concurrencyConfig: Type.Optional(ConcurrencyHarnessConfigSchema),
  idiomRequirements: Type.Optional(JavaIdiomRequirementsSchema),
  challengeMode: Type.Optional(Type.Union([Type.Literal('machine_coding'), Type.Literal('write_the_tests')])),
  requiredMutationScore: Type.Optional(Type.Number()),
  mutants: Type.Optional(Type.Array(ChallengeMutantSchema)),
  scoringWeights: Type.Optional(ChallengeScoringWeightsSchema),
  astRules: Type.Optional(Type.Array(Type.String())),
  hints: Type.Optional(Type.Array(Type.String())),
  grade: Type.Optional(Type.String()),
  archetype: Type.Optional(Type.String()),
  companyContext: Type.Optional(Type.String()),
  smellsChecklist: Type.Optional(Type.Array(CodeSmellItemSchema)),
  socraticProbes: Type.Optional(Type.Array(SocraticProbeSchema)),
  barRaiserQuestions: Type.Optional(Type.Array(BarRaiserQuestionSchema)),
  structuralConstraints: Type.Optional(AstBytecodeConstraintSchema),
  designPatternContext: Type.Optional(CodingChallengeDesignPatternContextSchema)
});
export type CodingChallenge = Static<typeof CodingChallengeSchema>;
