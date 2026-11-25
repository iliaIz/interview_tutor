/**
 * ChallengeSubmissionRepository.ts
 * Domain repository for challenge manifests, canonical IDs, file validation,
 * and canonical v2 SQLite submission persistence (Spec 43 / <= 140 lines).
 */

import Database, { Statement } from 'better-sqlite3';
import { db } from '../db';
import type { CodingChallenge } from '../challengeSeedData';
import type { SandboxExecutionResponse } from './JvmExecutionService';
import type { EvaluationResult } from '../codeEvaluatorTypes';
import type {
  CanonicalPersistedEvaluation,
  EvaluationAiFeedbackPayload,
  EvaluationAstViolation,
  EvaluationCodeFile,
  EvaluationMutationScorePayload,
  PersistSubmissionParams,
  ValidateWorkspaceFilesOptions,
  WorkspaceValidationErrorCode
} from './evaluationPipelineTypes';

export type { CanonicalPersistedEvaluation, PersistSubmissionParams, ValidateWorkspaceFilesOptions, WorkspaceValidationErrorCode };

export class WorkspaceValidationError extends Error {
  public readonly statusCode = 400;
  constructor(public readonly code: WorkspaceValidationErrorCode, message: string) {
    super(message);
    this.name = 'WorkspaceValidationError';
  }
}

/** Validates workspace file boundaries before sandbox execution or draft persistence. */
export function validateWorkspaceFiles(
  files: unknown,
  options: ValidateWorkspaceFilesOptions = {}
): EvaluationCodeFile[] {
  const maxFiles = options.maxFiles ?? 15;
  const maxFileBytes = options.maxFileBytes ?? 200_000;
  if (!Array.isArray(files)) throw new WorkspaceValidationError('INVALID_FILES', 'files array is required');
  if (!options.allowEmpty && files.length === 0) throw new WorkspaceValidationError('EMPTY_FILES', 'non-empty files array is required');
  if (files.length > maxFiles) {
    throw new WorkspaceValidationError('MAX_FILES_EXCEEDED', `Files exceed maximum allowable limit (${maxFiles} files max)`);
  }
  for (const f of files) {
    if (!f || typeof f !== 'object') throw new WorkspaceValidationError('INVALID_FILES', 'Each workspace file entry must be an object');
    const content = (f as { content?: unknown }).content;
    if (typeof content === 'string' && content.length > maxFileBytes) {
      const filePath = (f as { path?: string }).path || 'unknown';
      throw new WorkspaceValidationError('MAX_FILE_BYTES_EXCEEDED', `File ${filePath} exceeds maximum allowable size (${maxFileBytes} chars max)`);
    }
  }
  return files as EvaluationCodeFile[];
}

interface RepoStatements { load?: Statement; resolveId?: Statement; upsert?: Statement; }
const stmtCache = new WeakMap<Database.Database, RepoStatements>();
const SQL_LOAD = 'SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ? LIMIT 1';
const SQL_RESOLVE = 'SELECT id FROM coding_challenges WHERE id = ? OR slug = ? LIMIT 1';
const SQL_UPSERT = `INSERT INTO coding_submissions (id, challenge_id, user_id, files_json, active_phase, status, score, evaluation_json, time_spent_seconds, updated_at)
  VALUES (@id, @challenge_id, @user_id, @files_json, @active_phase, @status, @score, @evaluation_json, @time_spent_seconds, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET files_json = excluded.files_json, active_phase = excluded.active_phase,
  status = excluded.status, score = excluded.score, evaluation_json = excluded.evaluation_json,
  time_spent_seconds = excluded.time_spent_seconds, updated_at = CURRENT_TIMESTAMP`;

function getStmt(database: Database.Database, key: keyof RepoStatements, sql: string): Statement {
  let entry = stmtCache.get(database);
  if (!entry) { entry = {}; stmtCache.set(database, entry); }
  if (!entry[key]) entry[key] = database.prepare(sql);
  return entry[key]!;
}

function toCanonicalEvaluation(params: PersistSubmissionParams): CanonicalPersistedEvaluation {
  const raw = params.evaluation && typeof params.evaluation === 'object' ? (params.evaluation as Record<string, any>) : {};
  const status: 'PASSED' | 'FAILED' = params.status === 'PASSED' ? 'PASSED' : 'FAILED';
  const sandboxResult = raw.sandboxResult as SandboxExecutionResponse | undefined;
  const aiEvaluationResult = raw.aiEvaluationResult as EvaluationResult | undefined;
  const aiFeedback = raw.aiFeedback as EvaluationAiFeedbackPayload | undefined;
  const compilationStatus = raw.compilationStatus ?? aiEvaluationResult?.compilationStatus ?? {
    isCompilable: sandboxResult?.isCompilable ?? status === 'PASSED',
    syntaxErrors: sandboxResult?.syntaxErrors ?? []
  };
  const scoreBreakdown = raw.scoreBreakdown ?? aiEvaluationResult?.scoreBreakdown ?? {
    overallScore: params.score,
    summaryReview: aiFeedback?.critique ?? ''
  };
  const canonical: CanonicalPersistedEvaluation = { schemaVersion: 2, status, compilationStatus, scoreBreakdown };
  if (sandboxResult !== undefined) canonical.sandboxResult = sandboxResult;
  if (raw.astViolations !== undefined) canonical.astViolations = raw.astViolations as EvaluationAstViolation[];
  if (raw.mutationScore !== undefined) canonical.mutationScore = raw.mutationScore as EvaluationMutationScorePayload;
  if (aiFeedback !== undefined) canonical.aiFeedback = aiFeedback;
  if (aiEvaluationResult !== undefined) canonical.aiEvaluationResult = aiEvaluationResult;
  return canonical;
}

/** Encapsulates challenge manifest reads and canonical v2 submission writes against SQLite. */
export class ChallengeSubmissionRepository {
  constructor(private readonly database: Database.Database = db) {}

  public loadManifest(idOrSlug: string): CodingChallenge | undefined {
    return ChallengeSubmissionRepository.loadManifest(idOrSlug, this.database);
  }
  public resolveCanonicalChallengeId(idOrSlug: string): string {
    return ChallengeSubmissionRepository.resolveCanonicalChallengeId(idOrSlug, this.database);
  }
  public persistSubmission(params: PersistSubmissionParams): void {
    ChallengeSubmissionRepository.persistSubmission(params, this.database);
  }

  public static loadManifest(idOrSlug: string, database: Database.Database = db): CodingChallenge | undefined {
    try {
      const row = getStmt(database, 'load', SQL_LOAD).get(idOrSlug, idOrSlug) as any;
      if (row?.manifest_json) return JSON.parse(row.manifest_json);
    } catch (err: any) {
      console.warn(`⚠️ Could not query manifest for challenge ${idOrSlug}:`, err?.message);
    }
    return undefined;
  }

  public static resolveCanonicalChallengeId(idOrSlug: string, database: Database.Database = db): string {
    try {
      const row = getStmt(database, 'resolveId', SQL_RESOLVE).get(idOrSlug, idOrSlug) as any;
      if (row?.id) return row.id;
    } catch {}
    return idOrSlug;
  }

  public static persistSubmission(params: PersistSubmissionParams, database: Database.Database = db): void {
    const canonicalId = ChallengeSubmissionRepository.resolveCanonicalChallengeId(params.challengeId, database);
    const canonicalEvaluation = toCanonicalEvaluation(params);
    getStmt(database, 'upsert', SQL_UPSERT).run({
      id: `sub_${canonicalId}_${params.userId}`,
      challenge_id: canonicalId,
      user_id: params.userId,
      files_json: JSON.stringify(params.files),
      active_phase: params.activePhase,
      status: params.status,
      score: params.score,
      evaluation_json: JSON.stringify(canonicalEvaluation),
      time_spent_seconds: params.timeSpentSeconds
    });
  }
}
