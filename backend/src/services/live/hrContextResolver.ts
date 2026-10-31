/**
 * hrContextResolver.ts
 * Resolves, validates and caches Candidate Dossiers, Job Contexts and HR Question Rubrics.
 * SOTA Late 2026 Engine vs. Payload isolation.
 */

import fs from 'fs';
import path from 'path';
import {
  CandidateDossier,
  CandidateDossierSchema,
  JobContext,
  JobContextSchema,
  HrQuestionRubricItem,
  Value
} from '@interview-prep/shared';

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

const FIXTURES_DIR = resolveFixturesDir();

interface HrContextCache {
  dossiers: Map<string, CandidateDossier>;
  jobContexts: Map<string, JobContext>;
  questions: Map<string, HrQuestionRubricItem>;
  questionsList: HrQuestionRubricItem[];
}

let cache: HrContextCache | null = null;

function loadJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[HR_FIXTURE_ERROR] File not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function initCache(): HrContextCache {
  if (cache) return cache;

  const dossiers = new Map<string, CandidateDossier>();
  const jobContexts = new Map<string, JobContext>();
  const questions = new Map<string, HrQuestionRubricItem>();

  // 1. Load Canonical Dossier
  const dossierPath = path.join(FIXTURES_DIR, 'canonicalCandidateDossier.json');
  const rawDossier = loadJsonFile<CandidateDossier>(dossierPath);

  if (!Value.Check(CandidateDossierSchema, rawDossier)) {
    const errors = [...Value.Errors(CandidateDossierSchema, rawDossier)];
    throw new Error(`[HR_SCHEMA_ERROR] Canonical dossier failed validation: ${JSON.stringify(errors[0])}`);
  }
  dossiers.set(rawDossier.dossierId, rawDossier);

  // 2. Load Job Contexts
  const jobsPath = path.join(FIXTURES_DIR, 'defaultJobContexts.json');
  const rawJobs = loadJsonFile<any[]>(jobsPath);
  for (const job of rawJobs) {
    if (!Value.Check(JobContextSchema, job)) {
      const errors = [...Value.Errors(JobContextSchema, job)];
      throw new Error(`[HR_SCHEMA_ERROR] Job context "${(job as any).jobId}" failed validation: ${JSON.stringify(errors[0])}`);
    }
    const typedJob = job as JobContext;
    jobContexts.set(typedJob.jobId, typedJob);
  }

  // 3. Load Questions Matrix
  const questionsPath = path.join(FIXTURES_DIR, 'canonicalQuestionMatrix.json');
  const rawQuestions = loadJsonFile<HrQuestionRubricItem[]>(questionsPath);
  for (const q of rawQuestions) {
    questions.set(q.id, q);
  }

  cache = {
    dossiers,
    jobContexts,
    questions,
    questionsList: rawQuestions
  };

  return cache;
}

export function getCandidateDossier(dossierId: string = 'canonical_senior_java'): CandidateDossier {
  const c = initCache();
  const dossier = c.dossiers.get(dossierId) || c.dossiers.get('canonical_senior_java');
  if (!dossier) {
    throw new Error(`[HR_CONTEXT_ERROR] Dossier not found for id "${dossierId}"`);
  }
  return dossier;
}

export function getJobContext(jobId: string = 'fintech_highload_expansion'): JobContext {
  const c = initCache();
  const job = c.jobContexts.get(jobId) || c.jobContexts.get('fintech_highload_expansion');
  if (!job) {
    // Return first available job context as fallback
    const first = c.jobContexts.values().next().value;
    if (first) return first;
    throw new Error(`[HR_CONTEXT_ERROR] No JobContext available in cache`);
  }
  return job;
}

export function getHrQuestion(questionId?: string): HrQuestionRubricItem {
  const c = initCache();
  if (questionId && c.questions.has(questionId)) {
    return c.questions.get(questionId)!;
  }
  return c.questionsList[0];
}

export function getAllHrQuestions(): HrQuestionRubricItem[] {
  const c = initCache();
  return c.questionsList;
}
