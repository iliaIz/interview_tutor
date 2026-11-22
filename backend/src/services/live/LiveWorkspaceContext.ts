import { db } from '../db';
import type { Statement } from 'better-sqlite3';
import { matchWorkspaceFilePath, applyWorkspaceFileUpdate, mergeWorkspaceManifests } from './workspaceManifestStore';
import { ChallengeResolutionInput, ResolvedChallengeContext } from './liveWsChallengeResolver';
import { ProxySession } from './liveSessionTypes';

let codingChallengeStmt: Statement | null = null;
let springTxChallengeStmt: Statement | null = null;
let bugChallengeStmt: Statement | null = null;
let questionStmt: Statement | null = null;

function getCodingStmt(): Statement {
  if (!codingChallengeStmt) {
    codingChallengeStmt = db.prepare(`
      SELECT id, slug, title, category, track, target_stack, short_description, instructions_markdown, manifest_json 
      FROM coding_challenges 
      WHERE id = ? OR slug = ?
      LIMIT 1
    `);
  }
  return codingChallengeStmt;
}

function getSpringTxStmt(): Statement {
  if (!springTxChallengeStmt) {
    springTxChallengeStmt = db.prepare(`
      SELECT id, slug, title, domain, difficulty, badge, manifest_json 
      FROM spring_transaction_challenges 
      WHERE id = ? OR slug = ?
      LIMIT 1
    `);
  }
  return springTxChallengeStmt;
}

function getBugStmt(): Statement {
  if (!bugChallengeStmt) {
    bugChallengeStmt = db.prepare(`
      SELECT id, title, subtopic, code_snippet, bug_explanation, fixed_code, hints_json 
      FROM bug_challenges 
      WHERE id = ?
      LIMIT 1
    `);
  }
  return bugChallengeStmt;
}

function getQuestionStmt(): Statement {
  if (!questionStmt) {
    questionStmt = db.prepare(`
      SELECT topic, question, answer 
      FROM questions 
      WHERE id = ?
      LIMIT 1
    `);
  }
  return questionStmt;
}

/**
 * LiveWorkspaceContext
 * Encapsulated domain entity for technical workspace resolution and live sync (Spec 24).
 * Single Source of Truth for challenge manifests, active files, and XML grounding.
 * Cognitive Bounding Limit: <= 250 lines (Rule 8).
 */
export class LiveWorkspaceContext {
  private resolved: ResolvedChallengeContext;

  private constructor(resolved: ResolvedChallengeContext) {
    this.resolved = resolved;
  }

  public static resolve(input: ChallengeResolutionInput): LiveWorkspaceContext {
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

    // 1. Coding challenges
    if (challengeId) {
      try {
        const cRow = getCodingStmt().get(challengeId, challengeId) as any;
        if (cRow) {
          if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
            topic = cRow.category || 'Machine Coding & LLD';
          }
          if (!bugTitle) bugTitle = cRow.title;
          if (!questionText) questionText = `${cRow.title}: ${cRow.short_description || ''}`;
          if (!referenceAnswer) referenceAnswer = cRow.instructions_markdown;
          if (!bugExplanation) bugExplanation = cRow.instructions_markdown;
          if (!challengeCategory) challengeCategory = cRow.category;
          if (!challengeTrack) challengeTrack = cRow.track;

          if (cRow.manifest_json) {
            try {
              const parsed = JSON.parse(cRow.manifest_json);
              if (Array.isArray(parsed.workspaceFiles) && parsed.workspaceFiles.length > 0) {
                const visibleFiles = parsed.workspaceFiles.filter((f: any) => !f.hidden);
                const activeIndex = activeFilePath
                  ? visibleFiles.findIndex((f: any) => matchWorkspaceFilePath(f.path, activeFilePath))
                  : visibleFiles.findIndex((f: any) => !f.readOnly);
                const safeIndex = activeIndex >= 0 ? activeIndex : 0;
                const active = visibleFiles[safeIndex] || visibleFiles[0];
                const secondary = visibleFiles.filter((_: any, idx: number) => idx !== safeIndex);

                workspaceManifest = {
                  activeFile: {
                    path: active.path,
                    content: active.content,
                    isReadOnly: Boolean(active.readOnly)
                  },
                  fileCount: visibleFiles.length,
                  projectTree: visibleFiles.map((f: any) => f.path),
                  secondaryFiles: secondary.map((f: any) => ({
                    path: f.path,
                    content: f.content,
                    isReadOnly: Boolean(f.readOnly)
                  })),
                  files: visibleFiles.map((f: any) => ({
                    path: f.path,
                    content: f.content,
                    isReadOnly: Boolean(f.readOnly)
                  })),
                  xmlManifest: ''
                };
                workspaceManifest.xmlManifest = LiveWorkspaceContext.buildXml(active, visibleFiles, secondary);
                if (!activeFilePath) activeFilePath = active.path;
                if (!codeSnippet) codeSnippet = active.content;
              }
            } catch {}
          }
        }
      } catch {}
    }

    // 2. Spring Transactions
    if (challengeId && (!challengeCategory || challengeCategory === 'spring_transactions')) {
      try {
        const txRow = getSpringTxStmt().get(challengeId, challengeId) as any;
        if (txRow) {
          challengeCategory = 'spring_transactions';
          challengeTrack = 'transactions';
          if (!bugTitle) bugTitle = txRow.title;
          if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
            topic = `Spring Transactions: ${txRow.title}`;
          }
          if (txRow.manifest_json) {
            try {
              const manifest = JSON.parse(txRow.manifest_json);
              if (!questionText) questionText = manifest.problemStatement || txRow.title;
              if (!referenceAnswer) {
                referenceAnswer = JSON.stringify({
                  domain: txRow.domain,
                  problemStatement: manifest.problemStatement,
                  probingQuestions: manifest.probingQuestions
                });
              }
              if (!bugExplanation) bugExplanation = manifest.problemStatement;
              if (!codeSnippet && Array.isArray(manifest.services)) {
                codeSnippet = manifest.services
                  .map((s: any) => s.methods.map((m: any) => m.codeSnippet).join('\n'))
                  .join('\n');
              }
            } catch {}
          }
        }
      } catch {}
    }

    // 3. Bug Hunt Challenges
    if (challengeId && (!bugExplanation || !codeSnippet)) {
      try {
        const bRow = getBugStmt().get(challengeId) as any;
        if (bRow) {
          if (!bugTitle) bugTitle = bRow.title;
          if (!bugExplanation) bugExplanation = bRow.bug_explanation;
          if (!fixedCode) fixedCode = bRow.fixed_code;
          if (!codeSnippet) codeSnippet = bRow.code_snippet;
          if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
            topic = bRow.subtopic || topic;
          }
        }
      } catch {}
    }

    // 4. Theory questions
    if (questionId && (!questionText || !referenceAnswer)) {
      try {
        const qRow = getQuestionStmt().get(questionId) as any;
        if (qRow) {
          if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
            topic = qRow.topic || topic;
          }
          if (!questionText) questionText = qRow.question || questionText;
          if (!referenceAnswer) referenceAnswer = qRow.answer || referenceAnswer;
        }
      } catch {}
    }

    return new LiveWorkspaceContext({
      topic,
      bugTitle,
      questionText,
      referenceAnswer,
      bugExplanation,
      fixedCode,
      codeSnippet,
      challengeCategory,
      challengeTrack,
      workspaceManifest,
      activeFilePath
    });
  }

  private static buildXml(active: any, visibleFiles: any[], secondary: any[]): string {
    return [
      `<project_workspace active_file="${active.path}">`,
      `  <project_tree>`,
      ...visibleFiles.map((f: any) => `    <file path="${f.path}" />`),
      `  </project_tree>`,
      `  <active_file path="${active.path}" read_only="${Boolean(active.readOnly)}">`,
      active.content,
      `  </active_file>`,
      ...(secondary.length > 0
        ? [
            `  <secondary_files>`,
            ...secondary.flatMap((sec: any) => [
              `    <file path="${sec.path}" read_only="${Boolean(sec.readOnly)}">`,
              sec.content,
              `    </file>`
            ]),
            `  </secondary_files>`
          ]
        : []),
      `</project_workspace>`
    ].join('\n');
  }

  public getResolved(): ResolvedChallengeContext {
    return this.resolved;
  }

  public toXmlManifest(): string {
    return this.resolved.workspaceManifest?.xmlManifest || '';
  }

  /**
   * Applies client workspace frames in memory, eliminating ad-hoc mutative frame handling.
   * Handles session_init, workspace_file_update, workspace_active_file_changed,
   * sandbox/mutation/tx summaries.
   */
  public static applyClientFrame(session: ProxySession, parsed: any): boolean {
    if (!parsed || typeof parsed !== 'object') return false;

    if (parsed.type === 'session_init') {
      if (parsed.challenge) {
        const ch = parsed.challenge;
        if (ch.category) session.challengeCategory = ch.category;
        if (ch.track) session.challengeTrack = ch.track;
        if (ch.title) { session.bugTitle = ch.title; session.questionText = ch.title; }
        if (ch.instructions) session.bugExplanation = ch.instructions;
        if (ch.activeFileContent) session.codeSnippet = ch.activeFileContent;
        if (ch.activeFilePath) session.activeFilePath = ch.activeFilePath;
        if (ch.workspaceManifest) {
          session.workspaceManifest = mergeWorkspaceManifests(session.workspaceManifest, ch.workspaceManifest);
        }
      }
      if (parsed.workspaceManifest) {
        session.workspaceManifest = mergeWorkspaceManifests(session.workspaceManifest, parsed.workspaceManifest);
      }
      if (parsed.codeSnippet) session.codeSnippet = parsed.codeSnippet;
      if (parsed.bugTitle) { session.bugTitle = parsed.bugTitle; session.questionText = parsed.bugTitle; }
      if (parsed.bugExplanation) session.bugExplanation = parsed.bugExplanation;
      if (parsed.questionText && !session.questionText) session.questionText = parsed.questionText;
      if (parsed.referenceAnswer && !session.referenceAnswer) session.referenceAnswer = parsed.referenceAnswer;
      if (parsed.topic) session.topic = parsed.topic;
      if (parsed.persona) session.persona = parsed.persona;
      if (parsed.strategy) session.strategy = parsed.strategy;
      if (parsed.targetGrade) session.targetGrade = parsed.targetGrade;
      if (parsed.activeCodeArtifact) session.activeCodeArtifact = parsed.activeCodeArtifact;
      if (parsed.academyBridgeContext) session.academyBridgeContext = parsed.academyBridgeContext;
      if (parsed.seniorReview) session.seniorReview = parsed.seniorReview;
      if (typeof parsed.questionIndex === 'number') session.questionIndex = parsed.questionIndex;
      if (typeof parsed.totalQuestions === 'number') session.totalQuestions = parsed.totalQuestions;
      if (typeof parsed.isRetry === 'boolean') session.isRetry = parsed.isRetry;

      console.log(`📋 [LIVE_SESSION_INIT] Session initialized: domain=${parsed.challenge?.domain || 'auto'}, title="${session.bugTitle || 'unknown'}", files=${session.workspaceManifest?.fileCount || 1}${session.seniorReview ? ', with seniorReview' : ''}`);
      return true;
    }

    if (parsed.type === 'workspace_file_update') {
      applyWorkspaceFileUpdate(session, parsed.path, parsed.content);
      return true;
    }

    if (parsed.type === 'workspace_active_file_changed') {
      const filePath = (parsed.path || '').trim();
      if (filePath && session.workspaceManifest) {
        const manifest = session.workspaceManifest;
        const allFiles = Array.isArray(manifest.files) ? manifest.files : [];
        const secondary = Array.isArray(manifest.secondaryFiles) ? manifest.secondaryFiles : [];
        const found = allFiles.find((f: any) => matchWorkspaceFilePath(f.path, filePath))
          || secondary.find((f: any) => matchWorkspaceFilePath(f.path, filePath));
        if (found) {
          if (manifest.activeFile && manifest.activeFile.path !== found.path) {
            if (!secondary.some((s: any) => matchWorkspaceFilePath(s.path, manifest.activeFile.path))) {
              secondary.push({ ...manifest.activeFile });
            }
          }
          manifest.activeFile = { path: found.path, content: found.content };
          manifest.secondaryFiles = secondary.filter((s: any) => !matchWorkspaceFilePath(s.path, found.path));
          session.codeSnippet = found.content;
          session.activeFilePath = found.path;
          console.log(`🎯 [WORKSPACE_ACTIVE_FILE] Active file switched to "${found.path}" in memory`);
        }
      }
      return true;
    }

    if (parsed.type === 'screen_context_sync') {
      return true;
    }

    if (parsed.type === 'sandbox_result_update') {
      session.latestSandboxSummary = parsed.summary;
      console.log(`🧪 [SANDBOX_RESULT_UPDATE] Intercepted in-memory: "${(parsed.summary || '').slice(0, 60)}..."`);
      return true;
    }

    if (parsed.type === 'mutation_result_update') {
      session.latestMutationSummary = parsed.summary;
      console.log(`🧬 [MUTATION_RESULT_UPDATE] Intercepted in-memory: "${(parsed.summary || '').slice(0, 60)}..."`);
      return true;
    }

    if (parsed.type === 'tx_evaluation_update') {
      session.latestTxSummary = parsed.summary;
      console.log(`💳 [TX_EVALUATION_UPDATE] Intercepted in-memory: "${(parsed.summary || '').slice(0, 60)}..."`);
      return true;
    }

    return false;
  }
}
