import { db } from '../db';
import type { Statement } from 'better-sqlite3';
import { matchWorkspaceFilePath } from './workspaceManifestStore';

let codingChallengeStmt: Statement | null = null;
let springTxChallengeStmt: Statement | null = null;
let bugChallengeStmt: Statement | null = null;
let questionStmt: Statement | null = null;

function getCodingChallengeStmt(): Statement {
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

function getSpringTxChallengeStmt(): Statement {
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

function getBugChallengeStmt(): Statement {
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

export interface ChallengeResolutionInput {
  challengeId: string;
  questionId: string;
  queryTopic?: string;
  queryBugTitle?: string;
  queryQuestionText?: string;
  queryReferenceAnswer?: string;
  queryBugExplanation?: string;
  queryFixedCode?: string;
  queryCodeSnippet?: string;
  queryChallengeCategory?: string;
  queryChallengeTrack?: string;
  queryActiveFilePath?: string;
}

export interface ResolvedChallengeContext {
  topic: string;
  bugTitle: string;
  questionText: string;
  referenceAnswer: string;
  bugExplanation: string;
  fixedCode: string;
  codeSnippet: string;
  challengeCategory: string;
  challengeTrack: string;
  workspaceManifest: any | null;
  activeFilePath: string;
}

/**
 * Resolves technical challenge context across SQLite domains:
 * 1. Coding challenges (Machine Coding, Testing, Refactoring)
 * 2. Spring Transaction challenges (Transactions Lab)
 * 3. Bug challenges (Bug Hunt Arena)
 * 4. Theory questions (Questions Table)
 */
export function resolveLiveChallengeContext(input: ChallengeResolutionInput): ResolvedChallengeContext {
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

  // 1. Coding challenges (Machine Coding, Refactoring, Testing)
  if (challengeId) {
    try {
      const cRow = getCodingChallengeStmt().get(challengeId, challengeId) as any;

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
                xmlManifest: [
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
                ].join('\n')
              };
              if (!activeFilePath) activeFilePath = active.path;
              if (!codeSnippet) codeSnippet = active.content;
            }
          } catch (mErr) {
            console.warn('[resolveLiveChallengeContext] Could not parse manifest_json:', mErr);
          }
        }
      }
    } catch (err) {
      console.warn(`[resolveLiveChallengeContext] Could not fetch coding challenge ${challengeId}:`, err);
    }
  }

  // 2. Spring Transaction challenges (Transactions Lab)
  if (challengeId && (!challengeCategory || challengeCategory === 'spring_transactions')) {
    try {
      const txRow = getSpringTxChallengeStmt().get(challengeId, challengeId) as any;

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
          } catch (tErr) {
            console.warn('[resolveLiveChallengeContext] Could not parse tx manifest_json:', tErr);
          }
        }
      }
    } catch (err) {
      console.warn(`[resolveLiveChallengeContext] Could not fetch tx challenge ${challengeId}:`, err);
    }
  }

  // 3. Bug challenges (Bug Hunt Arena)
  if (challengeId && (!bugExplanation || !codeSnippet)) {
    try {
      const bRow = getBugChallengeStmt().get(challengeId) as any;

      if (bRow) {
        if (!bugTitle) bugTitle = bRow.title;
        if (!bugExplanation) bugExplanation = bRow.bug_explanation;
        if (!fixedCode) fixedCode = bRow.fixed_code;
        if (!codeSnippet) codeSnippet = bRow.code_snippet;
        if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
          topic = bRow.subtopic || topic;
        }
      }
    } catch (err) {
      console.warn(`[resolveLiveChallengeContext] Could not fetch bug challenge ${challengeId}:`, err);
    }
  }

  // 4. Theory questions (Questions Table)
  if (questionId && (!questionText || !referenceAnswer)) {
    try {
      const qRow = getQuestionStmt().get(questionId) as any;

      if (qRow) {
        if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
          topic = qRow.topic || topic;
        }
        if (!questionText) {
          questionText = qRow.question || questionText;
        }
        if (!referenceAnswer) {
          referenceAnswer = qRow.answer || referenceAnswer;
        }
      }
    } catch (err) {
      console.warn(`[resolveLiveChallengeContext] Could not fetch question by id ${questionId}:`, err);
    }
  }

  return {
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
  };
}
