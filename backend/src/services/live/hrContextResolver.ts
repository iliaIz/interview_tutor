/**
 * hrContextResolver.ts
 * Resolves, validates and caches Candidate Dossiers, Job Contexts and HR Question Rubrics.
 * Lazy-initialized on explicit preload or getter call (zero top-level fs scans on import).
 */

import fs from 'fs';
import path from 'path';
import {
  CandidateDossier,
  CandidateDossierSchema,
  JobContext,
  JobContextSchema,
  HrQuestionRubricItem,
  HrQuestionRubricItemSchema,
  HrQuestionChunk,
  Value
} from '@interview-prep/shared';
import type { PreResolvedHrContext } from './LivePromptComposer';

export const DEFAULT_QUESTION_MATRIX_ID = 'canonical_question_matrix';
const SAFE_MATRIX_ID_RE = /^[a-zA-Z0-9_-]+$/;

export interface LoadedQuestionMatrix {
  matrixId: string;
  questions: Map<string, HrQuestionRubricItem>;
  questionsList: HrQuestionRubricItem[];
}

interface HrContextCache {
  fixturesDir: string;
  dossiers: Map<string, CandidateDossier>;
  jobContexts: Map<string, JobContext>;
  questionMatrices: Map<string, LoadedQuestionMatrix>;
}

let cache: HrContextCache | null = null;

function resolveFixturesDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../data/hr/fixtures'),
    path.resolve(__dirname, '../../../src/data/hr/fixtures'),
    path.resolve(process.cwd(), 'dist/data/hr/fixtures'),
    path.resolve(process.cwd(), 'src/data/hr/fixtures'),
    path.resolve(process.cwd(), 'backend/src/data/hr/fixtures'),
    path.resolve(process.cwd(), 'backend/dist/data/hr/fixtures'),
    '/app/dist/data/hr/fixtures',
    '/app/src/data/hr/fixtures'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function loadJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[HR_FIXTURE_ERROR] File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function validateAndIndexMatrix(matrixId: string, rawPayload: unknown): LoadedQuestionMatrix {
  const items = Array.isArray(rawPayload)
    ? rawPayload
    : rawPayload && typeof rawPayload === 'object' && Array.isArray((rawPayload as any).questions)
    ? (rawPayload as any).questions
    : null;
  if (!items) {
    throw new Error(`[HR_SCHEMA_ERROR] HR question matrix "${matrixId}" must be an array`);
  }
  const questions = new Map<string, HrQuestionRubricItem>();
  for (const q of items) {
    if (!Value.Check(HrQuestionRubricItemSchema, q)) {
      const errors = [...Value.Errors(HrQuestionRubricItemSchema, q)];
      throw new Error(`[HR_SCHEMA_ERROR] HR question "${(q as any)?.id || 'unknown'}" failed validation: ${JSON.stringify(errors[0])}`);
    }
    questions.set(q.id, q);
  }
  return { matrixId, questions, questionsList: items as HrQuestionRubricItem[] };
}

function initCache(): HrContextCache {
  if (cache) return cache;
  const fixturesDir = resolveFixturesDir();
  const dossiers = new Map<string, CandidateDossier>();
  const jobContexts = new Map<string, JobContext>();
  const questionMatrices = new Map<string, LoadedQuestionMatrix>();

  const rawDossier = loadJsonFile<CandidateDossier>(path.join(fixturesDir, 'canonicalCandidateDossier.json'));
  if (!Value.Check(CandidateDossierSchema, rawDossier)) {
    const errors = [...Value.Errors(CandidateDossierSchema, rawDossier)];
    throw new Error(`[HR_SCHEMA_ERROR] Canonical dossier failed validation: ${JSON.stringify(errors[0])}`);
  }
  dossiers.set(rawDossier.dossierId, rawDossier);

  const rawJobs = loadJsonFile<any[]>(path.join(fixturesDir, 'defaultJobContexts.json'));
  for (const job of rawJobs) {
    if (!Value.Check(JobContextSchema, job)) {
      const errors = [...Value.Errors(JobContextSchema, job)];
      throw new Error(`[HR_SCHEMA_ERROR] Job context "${(job as any).jobId}" failed validation: ${JSON.stringify(errors[0])}`);
    }
    const typedJob = job as JobContext;
    jobContexts.set(typedJob.jobId, typedJob);
  }

  const rawCanonicalQuestions = loadJsonFile<unknown>(path.join(fixturesDir, 'canonicalQuestionMatrix.json'));
  questionMatrices.set(DEFAULT_QUESTION_MATRIX_ID, validateAndIndexMatrix(DEFAULT_QUESTION_MATRIX_ID, rawCanonicalQuestions));

  cache = { fixturesDir, dossiers, jobContexts, questionMatrices };
  return cache;
}

export function preloadHrFixtures(): void {
  initCache();
}

export function resolveQuestionMatrix(questionMatrixId?: string): LoadedQuestionMatrix {
  const c = initCache();
  const rawId = (questionMatrixId || '').trim();
  const normalizedId = !rawId || rawId === 'canonicalQuestionMatrix' ? DEFAULT_QUESTION_MATRIX_ID : rawId;
  const cached = c.questionMatrices.get(normalizedId);
  if (cached) return cached;

  if (!SAFE_MATRIX_ID_RE.test(normalizedId)) {
    throw new Error(`[HR_MATRIX_ERROR] Invalid questionMatrixId "${normalizedId}"`);
  }
  const namedPath = path.join(c.fixturesDir, `${normalizedId}.json`);
  if (fs.existsSync(namedPath)) {
    const loaded = validateAndIndexMatrix(normalizedId, loadJsonFile<unknown>(namedPath));
    c.questionMatrices.set(normalizedId, loaded);
    return loaded;
  }
  throw new Error(`[HR_MATRIX_ERROR] Question matrix not found for id "${normalizedId}"`);
}

export function getCandidateDossier(dossierId: string = 'canonical_senior_java'): CandidateDossier {
  const c = initCache();
  const dossier = c.dossiers.get(dossierId) || c.dossiers.get('canonical_senior_java');
  if (!dossier) throw new Error(`[HR_CONTEXT_ERROR] Dossier not found for id "${dossierId}"`);
  return dossier;
}

export function getJobContext(jobId: string = 'fintech_highload_expansion'): JobContext {
  const c = initCache();
  const job = c.jobContexts.get(jobId) || c.jobContexts.get('fintech_highload_expansion') || c.jobContexts.values().next().value;
  if (!job) throw new Error('[HR_CONTEXT_ERROR] No JobContext available in cache');
  return job;
}

export function getHrQuestion(questionId?: string, _chunkId?: string, questionMatrixId?: string): HrQuestionRubricItem {
  const matrix = resolveQuestionMatrix(questionMatrixId);
  if (questionId && matrix.questions.has(questionId)) {
    return matrix.questions.get(questionId)!;
  }
  if (matrix.questionsList.length === 0) {
    throw new Error(`[HR_MATRIX_ERROR] Question matrix "${matrix.matrixId}" is empty`);
  }
  return matrix.questionsList[0];
}

export function getHrQuestionChunk(questionId: string, chunkId?: string, questionMatrixId?: string): HrQuestionChunk | undefined {
  if (!chunkId) return undefined;
  return getHrQuestion(questionId, chunkId, questionMatrixId).chunks?.find((ch) => ch.id === chunkId);
}

export function getAllHrQuestions(questionMatrixId?: string): HrQuestionRubricItem[] {
  return resolveQuestionMatrix(questionMatrixId).questionsList;
}

export function resolvePreResolvedHrContext(params: {
  dossierId?: string;
  jobId?: string;
  questionId?: string;
  chunkId?: string;
  questionMatrixId?: string;
} = {}): PreResolvedHrContext {
  preloadHrFixtures();
  const dossier = getCandidateDossier(params.dossierId);
  const jobContext = getJobContext(params.jobId);
  const question = getHrQuestion(params.questionId, params.chunkId, params.questionMatrixId);
  const chunk = params.chunkId ? getHrQuestionChunk(params.questionId || question.id, params.chunkId, params.questionMatrixId) : undefined;
  return { dossier, jobContext, question, chunk };
}
