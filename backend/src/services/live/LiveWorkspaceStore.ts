import type Database from 'better-sqlite3';
import { db } from '../db';
import { envConfig } from '../../config/env';
import { DEFAULT_VAD_PAUSE_MS, sanitizeVoiceName, clampVadPauseMs } from '../../config/liveDefaults';
import { ChallengeResolutionInput, LiveSessionResolvedConfig, ResolvedChallengeContext } from './liveSessionConfigTypes';
import { ProxySession } from './liveSessionTypes';
import {
  FilePathMatchResult,
  normalizeWorkspacePath,
  resolveWorkspaceFileMatch,
  matchWorkspaceFilePath,
  buildManifestXml,
  mergeWorkspaceManifests,
  applyWorkspaceFileUpdate,
  switchActiveWorkspaceFile
} from './liveWorkspaceManifestUtils';

export type { FilePathMatchResult };
export {
  normalizeWorkspacePath,
  resolveWorkspaceFileMatch,
  matchWorkspaceFilePath,
  mergeWorkspaceManifests,
  applyWorkspaceFileUpdate
};

export interface ChallengeLookupRow {
  coding?: Record<string, any> | null;
  springTx?: Record<string, any> | null;
  bug?: Record<string, any> | null;
  question?: Record<string, any> | null;
}

export interface WorkspaceChallengeCatalogPort {
  findChallengeRecord(challengeId: string, sessionType: string, questionId?: string): ChallengeLookupRow | null;
}

const VALID_GENDERS = new Set(['female', 'male', 'neutral']);
const VALID_STRICTNESS = new Set(['learning', 'standard', 'hardcore']);

export function createSqliteWorkspaceCatalogPort(database: Database.Database = db): WorkspaceChallengeCatalogPort {
  return {
    findChallengeRecord(challengeId: string, _sessionType: string, questionId?: string): ChallengeLookupRow | null {
      const qId = questionId || challengeId;
      let coding: Record<string, any> | null = null;
      let springTx: Record<string, any> | null = null;
      let bug: Record<string, any> | null = null;
      let question: Record<string, any> | null = null;

      if (challengeId) {
        try {
          coding = (database.prepare(
            'SELECT id, slug, title, category, track, target_stack, short_description, instructions_markdown, manifest_json FROM coding_challenges WHERE id = ? OR slug = ? LIMIT 1'
          ).get(challengeId, challengeId) as Record<string, any>) || null;
        } catch {}
        try {
          springTx = (database.prepare(
            'SELECT id, slug, title, domain, difficulty, badge, manifest_json FROM spring_transaction_challenges WHERE id = ? OR slug = ? LIMIT 1'
          ).get(challengeId, challengeId) as Record<string, any>) || null;
        } catch {}
        try {
          bug = (database.prepare(
            'SELECT id, title, subtopic, code_snippet, bug_explanation, fixed_code, hints_json FROM bug_challenges WHERE id = ? LIMIT 1'
          ).get(challengeId) as Record<string, any>) || null;
        } catch {}
      }
      if (qId) {
        try {
          question = (database.prepare('SELECT topic, question, answer FROM questions WHERE id = ? LIMIT 1').get(qId) as Record<string, any>) || null;
        } catch {}
      }
      return coding || springTx || bug || question ? { coding, springTx, bug, question } : null;
    }
  };
}

/**
 * LiveWorkspaceStore (Spec 56).
 * Deep domain store owning workspace challenge resolution, path-disambiguated manifests,
 * and unified session_init / client frame merging.
 */
export class LiveWorkspaceStore {
  private readonly resolved: ResolvedChallengeContext;

  private constructor(resolved: ResolvedChallengeContext) {
    this.resolved = resolved;
  }

  public static resolve(
    input: ChallengeResolutionInput,
    catalogPort: WorkspaceChallengeCatalogPort = createSqliteWorkspaceCatalogPort()
  ): LiveWorkspaceStore {
    const { challengeId, questionId } = input;
    let topic = input.queryTopic || 'Java & Spring Framework';
    let bugTitle = input.queryBugTitle || '';
    let questionText = input.queryQuestionText || '';
    let referenceAnswer = input.queryReferenceAnswer || '';
    let bugExplanation = input.queryBugExplanation || '';
    let fixedCode = input.queryFixedCode || '';
    let codeSnippet = input.queryCodeSnippet || '';
    let challengeCategory = input.queryChallengeCategory || '';
    let challengeTrack = input.queryChallengeTrack || '';
    let activeFilePath = input.queryActiveFilePath || '';
    let workspaceManifest: any = null;

    const record = challengeId || questionId
      ? catalogPort.findChallengeRecord(challengeId, input.sessionType || 'interview', questionId)
      : null;

    const cRow = record?.coding;
    if (cRow) {
      if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') topic = cRow.category || 'Machine Coding & LLD';
      if (!bugTitle) bugTitle = cRow.title || '';
      if (!questionText) questionText = `${cRow.title}: ${cRow.short_description || ''}`;
      if (!referenceAnswer) referenceAnswer = cRow.instructions_markdown || '';
      if (!bugExplanation) bugExplanation = cRow.instructions_markdown || '';
      if (!challengeCategory) challengeCategory = cRow.category || '';
      if (!challengeTrack) challengeTrack = cRow.track || '';
      if (cRow.manifest_json) {
        try {
          const parsed = JSON.parse(cRow.manifest_json);
          if (Array.isArray(parsed.workspaceFiles) && parsed.workspaceFiles.length > 0) {
            const visible = parsed.workspaceFiles.filter((f: any) => !f.hidden);
            const matched = activeFilePath ? resolveWorkspaceFileMatch(visible, activeFilePath).match : null;
            const active = matched || visible.find((f: any) => !f.readOnly) || visible[0];
            const mapped = visible.map((f: any) => ({ path: f.path, content: f.content, isReadOnly: Boolean(f.readOnly) }));
            const activeNorm = normalizeWorkspacePath(active?.path);
            const secondary = mapped.filter((f: any) => normalizeWorkspacePath(f.path) !== activeNorm);
            const activeEntry = { path: active.path, content: active.content, isReadOnly: Boolean(active.readOnly) };
            workspaceManifest = {
              activeFile: activeEntry,
              fileCount: mapped.length,
              projectTree: mapped.map((f: any) => f.path),
              secondaryFiles: secondary,
              files: mapped,
              xmlManifest: buildManifestXml(activeEntry, mapped, secondary)
            };
            if (!activeFilePath) activeFilePath = active.path;
            if (!codeSnippet) codeSnippet = active.content;
          }
        } catch {}
      }
    }

    const txRow = record?.springTx;
    if (txRow && (!challengeCategory || challengeCategory === 'spring_transactions')) {
      challengeCategory = 'spring_transactions';
      challengeTrack = 'transactions';
      if (!bugTitle) bugTitle = txRow.title || '';
      if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') topic = `Spring Transactions: ${txRow.title}`;
      if (txRow.manifest_json) {
        try {
          const manifest = JSON.parse(txRow.manifest_json);
          if (!questionText) questionText = manifest.problemStatement || txRow.title;
          if (!referenceAnswer) referenceAnswer = JSON.stringify({ domain: txRow.domain, problemStatement: manifest.problemStatement, probingQuestions: manifest.probingQuestions });
          if (!bugExplanation) bugExplanation = manifest.problemStatement || '';
          if (!codeSnippet && Array.isArray(manifest.services)) {
            codeSnippet = manifest.services.map((s: any) => s.methods.map((m: any) => m.codeSnippet).join('\n')).join('\n');
          }
        } catch {}
      }
    }

    const bRow = record?.bug;
    if (bRow && (!bugExplanation || !codeSnippet)) {
      if (!bugTitle) bugTitle = bRow.title || '';
      if (!bugExplanation) bugExplanation = bRow.bug_explanation || '';
      if (!fixedCode) fixedCode = bRow.fixed_code || '';
      if (!codeSnippet) codeSnippet = bRow.code_snippet || '';
      if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') topic = bRow.subtopic || topic;
    }

    const qRow = record?.question;
    if (qRow && (!questionText || !referenceAnswer)) {
      if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') topic = qRow.topic || topic;
      if (!questionText) questionText = qRow.question || questionText;
      if (!referenceAnswer) referenceAnswer = qRow.answer || referenceAnswer;
    }

    return new LiveWorkspaceStore({
      topic, bugTitle, questionText, referenceAnswer, bugExplanation, fixedCode,
      codeSnippet, challengeCategory, challengeTrack, workspaceManifest, activeFilePath
    });
  }

  public getResolved(): ResolvedChallengeContext { return this.resolved; }
  public toXmlManifest(): string { return this.resolved.workspaceManifest?.xmlManifest || ''; }

  public static matchFilePath<T extends { path?: string }>(files: T[], targetPath: string): FilePathMatchResult<T> {
    return resolveWorkspaceFileMatch(files, targetPath);
  }
  public static mergeWorkspaceManifests = mergeWorkspaceManifests;
  public static applyWorkspaceFileUpdate = applyWorkspaceFileUpdate;
  public static buildXmlManifest(manifest: any): string {
    return buildManifestXml(manifest?.activeFile || manifest?.files?.[0], manifest?.files || [], manifest?.secondaryFiles || []);
  }

  public static mergeInitFrame(
    target: LiveSessionResolvedConfig | ProxySession,
    rawInitFrame?: any,
    options: { preserveExistingQuestionText?: boolean } = {}
  ): boolean {
    let init = rawInitFrame;
    if (typeof init === 'string' || Buffer.isBuffer(init)) {
      try { init = JSON.parse(init.toString('utf8')); } catch { return false; }
    }
    if (!init || typeof init !== 'object') return false;

    const cfg = 'promptConfig' in target ? (target as LiveSessionResolvedConfig) : null;
    if (init.sessionType) target.sessionType = init.sessionType;
    if (init.tutorMode) target.tutorMode = init.tutorMode;
    if (init.voice && cfg) cfg.voiceName = cfg.promptConfig.voiceName = sanitizeVoiceName(init.voice, cfg.voiceName);
    if (VALID_GENDERS.has(init.userGender) && cfg) cfg.userGender = cfg.promptConfig.userGender = init.userGender;
    if ((init.turnMode === 'manual' || init.turnMode === 'auto') && cfg) cfg.turnMode = cfg.promptConfig.turnMode = init.turnMode;
    if (init.liveModel && envConfig.models.supportedLiveModels.includes(String(init.liveModel))) target.liveModel = String(init.liveModel);
    if (init.vadPauseMs !== undefined) target.vadPauseMs = clampVadPauseMs(init.vadPauseMs, target.vadPauseMs ?? DEFAULT_VAD_PAUSE_MS);
    if (typeof init.enableSilenceClarification === 'boolean') target.enableSilenceClarification = init.enableSilenceClarification;
    if (VALID_STRICTNESS.has(init.strictness) && cfg) cfg.strictness = cfg.promptConfig.strictness = init.strictness;
    if (typeof init.deepDive === 'boolean' && cfg) cfg.deepDive = cfg.promptConfig.deepDive = init.deepDive;
    if (typeof init.liveCoaching === 'boolean' && cfg) cfg.liveCoaching = cfg.promptConfig.liveCoaching = init.liveCoaching;
    if (typeof init.maxProbes === 'number' && Number.isFinite(init.maxProbes) && cfg) {
      cfg.maxProbes = cfg.promptConfig.maxProbes = Math.max(1, Math.min(5, Math.round(init.maxProbes)));
    }

    if (init.challenge) {
      const ch = init.challenge;
      if (ch.category) target.challengeCategory = ch.category;
      if (ch.track) target.challengeTrack = ch.track;
      if (ch.title) target.bugTitle = ch.title;
      if (ch.instructions) target.bugExplanation = ch.instructions;
      if (ch.activeFileContent) target.codeSnippet = ch.activeFileContent;
      if (ch.activeFilePath) target.activeFilePath = ch.activeFilePath;
      if (ch.workspaceManifest) {
        target.workspaceManifest = mergeWorkspaceManifests(target.workspaceManifest, ch.workspaceManifest);
        if (cfg) cfg.manifest = target.workspaceManifest;
      }
    }
    if (init.workspaceManifest) {
      target.workspaceManifest = mergeWorkspaceManifests(target.workspaceManifest, init.workspaceManifest);
      if (cfg) cfg.manifest = target.workspaceManifest;
    }
    if (init.codeSnippet) target.codeSnippet = init.codeSnippet;
    if (init.bugTitle) target.bugTitle = init.bugTitle;
    if (init.bugExplanation) target.bugExplanation = init.bugExplanation;

    const explicitQuestionText = typeof init.questionText === 'string' ? init.questionText.trim() : '';
    const fallbackTitle = (typeof init.bugTitle === 'string' && init.bugTitle.trim())
      || (typeof init.challenge?.title === 'string' && init.challenge.title.trim()) || '';
    if (explicitQuestionText) {
      if (!options.preserveExistingQuestionText || !target.questionText) target.questionText = explicitQuestionText;
    } else if (!target.questionText && fallbackTitle) {
      target.questionText = fallbackTitle;
    }
    if (init.referenceAnswer && (!options.preserveExistingQuestionText || !target.referenceAnswer)) {
      target.referenceAnswer = init.referenceAnswer;
    }
    if (init.topic) target.topic = init.topic;
    if (init.persona) { target.persona = init.persona; if (cfg) cfg.promptConfig.persona = init.persona; }
    if (init.strategy) { target.strategy = init.strategy; if (cfg) cfg.promptConfig.strategy = init.strategy; }
    if (init.targetGrade) { target.targetGrade = init.targetGrade; if (cfg) cfg.promptConfig.targetGrade = init.targetGrade; }
    if (typeof init.customPrompt === 'string' && cfg) cfg.customPromptOverride = cfg.promptConfig.customPromptOverride = init.customPrompt.slice(0, 4000);
    if (typeof init.initialUserMessage === 'string' && cfg) cfg.initialUserMessage = cfg.promptConfig.initialUserMessage = init.initialUserMessage.trim();
    if (typeof init.temperature === 'number' && Number.isFinite(init.temperature) && cfg) cfg.temperature = cfg.promptConfig.temperature = init.temperature;
    if (init.activeCodeArtifact) target.activeCodeArtifact = init.activeCodeArtifact;
    if (init.academyBridgeContext) target.academyBridgeContext = init.academyBridgeContext;
    if (init.seniorReview) target.seniorReview = init.seniorReview;
    if (typeof init.questionIndex === 'number') target.questionIndex = init.questionIndex;
    if (typeof init.totalQuestions === 'number') target.totalQuestions = init.totalQuestions;
    if (typeof init.isRetry === 'boolean') target.isRetry = init.isRetry;
    if (typeof init.isResumed === 'boolean' && cfg) cfg.isResumed = init.isResumed;
    if (init.hrMode) target.hrMode = init.hrMode;
    if (init.hrPersonaId && cfg) cfg.hrPersonaId = init.hrPersonaId;
    if (init.dossierId) target.dossierId = String(init.dossierId);
    if (init.jobId) target.jobId = String(init.jobId);
    if (init.questionMatrixId) target.questionMatrixId = String(init.questionMatrixId);
    if (init.chunkId) target.chunkId = init.chunkId;
    if (init.startBeatId) target.startBeatId = String(init.startBeatId);
    if (init.beatScope === 'single_beat' || init.beatScope === 'all_from_beat') target.beatScope = init.beatScope;
    if (init.academyCourse) target.academyCourse = init.academyCourse;
    if (init.academyStep) target.academyStep = init.academyStep;
    if (init.questionId) target.questionId = String(init.questionId);
    if (init.sessionId) target.sessionId = init.sessionId;
    return true;
  }

  public static applyClientFrame(session: ProxySession, parsed: any): boolean {
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.type === 'session_init') {
      LiveWorkspaceStore.mergeInitFrame(session, parsed, { preserveExistingQuestionText: true });
      console.log(`📋 [LIVE_SESSION_INIT] Session initialized: domain=${parsed.challenge?.domain || 'auto'}, title="${session.bugTitle || 'unknown'}", files=${session.workspaceManifest?.fileCount || 1}`);
      return true;
    }
    if (parsed.type === 'workspace_file_update') { applyWorkspaceFileUpdate(session, parsed.path, parsed.content); return true; }
    if (parsed.type === 'workspace_active_file_changed') { switchActiveWorkspaceFile(session, parsed.path); return true; }
    if (parsed.type === 'screen_context_sync') return true;
    if (parsed.type === 'sandbox_result_update') { session.latestSandboxSummary = parsed.summary; return true; }
    if (parsed.type === 'mutation_result_update') { session.latestMutationSummary = parsed.summary; return true; }
    if (parsed.type === 'tx_evaluation_update') { session.latestTxSummary = parsed.summary; return true; }
    return false;
  }
}
