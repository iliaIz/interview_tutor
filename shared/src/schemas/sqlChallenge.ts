import { Type, Static } from '@sinclair/typebox';

/**
 * sqlChallenge.ts
 * SSOT TypeBox schema for In-Browser PGlite WASM SQL Arena (Pillar 10).
 * Governs PostgreSQL 16 challenges, traps, relational fixtures, and expected queries.
 * File length limit: <= 350 lines (Rule 8).
 */

export const SqlChallengeCategory = Type.Union([
  Type.Literal('traps'),
  Type.Literal('window_functions'),
  Type.Literal('aggregations'),
  Type.Literal('financial_analytics')
]);
export type SqlChallengeCategory = Static<typeof SqlChallengeCategory>;

export const SqlChallengeDifficulty = Type.Union([
  Type.Literal('middle'),
  Type.Literal('senior')
]);
export type SqlChallengeDifficulty = Static<typeof SqlChallengeDifficulty>;

export const SqlCompanyContextSchema = Type.Object({
  company: Type.String({ minLength: 1 }),
  stage: Type.String({ minLength: 1 }),
  importance: Type.Union([
    Type.Literal('CRITICAL'),
    Type.Literal('HIGH'),
    Type.Literal('MEDIUM')
  ]),
  interviewTrapDescription: Type.String({ default: '' })
});
export type SqlCompanyContext = Static<typeof SqlCompanyContextSchema>;

export const SqlChallengeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  category: SqlChallengeCategory,
  difficulty: SqlChallengeDifficulty,
  tags: Type.Array(Type.String(), { default: [] }),
  companyContext: SqlCompanyContextSchema,
  instructionsMarkdown: Type.String({ minLength: 1 }),
  schemaSql: Type.String({ minLength: 1 }),
  seedSql: Type.String({ minLength: 1 }),
  expectedQuery: Type.String({ minLength: 1 }),
  initialEditorSql: Type.String({ default: 'SELECT ' }),
  orderMatters: Type.Boolean({ default: false }),
  explanationMarkdown: Type.String({ default: '' })
});
export type SqlChallenge = Static<typeof SqlChallengeSchema>;

export const SqlResultDiffSchema = Type.Object({
  isMatched: Type.Boolean(),
  columnMismatch: Type.Boolean({ default: false }),
  expectedColumns: Type.Array(Type.String(), { default: [] }),
  actualColumns: Type.Array(Type.String(), { default: [] }),
  expectedRowCount: Type.Number({ default: 0 }),
  actualRowCount: Type.Number({ default: 0 }),
  missingRows: Type.Array(Type.Record(Type.String(), Type.Any()), { default: [] }),
  unexpectedRows: Type.Array(Type.Record(Type.String(), Type.Any()), { default: [] }),
  orderMismatch: Type.Boolean({ default: false })
});
export type SqlResultDiff = Static<typeof SqlResultDiffSchema>;

export const SqlExecutionResultSchema = Type.Object({
  success: Type.Boolean(),
  executionTimeMs: Type.Number(),
  rowCount: Type.Number(),
  columns: Type.Array(Type.String()),
  rows: Type.Array(Type.Record(Type.String(), Type.Any())),
  error: Type.Optional(Type.String()),
  diff: Type.Optional(SqlResultDiffSchema)
});
export type SqlExecutionResult = Static<typeof SqlExecutionResultSchema>;
