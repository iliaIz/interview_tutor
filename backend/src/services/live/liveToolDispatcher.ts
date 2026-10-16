import { WebSocket } from 'ws';
import { db } from '../db';
import { updateBugChallengeStatus } from '../tutorService';
import { applyKnowledgeDecay } from '../vectorMemoryService';
import { TurnTelemetryEvent } from '@interview-prep/shared';
import { handleEvaluationToolCall } from './liveEvaluationToolDispatcher';
import { handleSystemDesignToolCall } from './liveSystemDesignToolDispatcher';
import { ProxySession } from './liveSessionTypes';

export interface LiveToolContext {
  call: {
    id: string;
    name: string;
    args?: any;
  };
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  session: {
    sessionId?: string;
    questionId?: string;
    userId?: string;
    topic?: string;
    questionText?: string;
    referenceAnswer?: string;
    relevantGapIds?: string[];
    probesCount?: number;
    isRetry?: boolean;
    hasCandidateResponded?: boolean;
    persona?: any;
    targetGrade?: any;
    currentArchitectureMermaid?: string;
    currentGraphIr?: string;
    turnTelemetryHistory?: TurnTelemetryEvent[];
  };
  parsedHints?: string[];
  liveCoaching?: boolean;
}

export function matchWorkspaceFilePath(candidatePath: string | undefined, targetPath: string): boolean {
  if (!candidatePath || !targetPath) return false;
  const c = candidatePath.replace(/\\/g, '/').trim();
  const t = targetPath.replace(/\\/g, '/').trim();
  if (c === t) return true;
  const cSimple = c.split('/').pop() || c;
  const tSimple = t.split('/').pop() || t;
  return cSimple === tSimple || c.endsWith(`/${tSimple}`) || t.endsWith(`/${cSimple}`);
}

export function applyWorkspaceFileUpdate(session: ProxySession, rawPath: string, content: string): void {
  const trimmedPath = (rawPath || '').trim();
  if (!trimmedPath || typeof content !== 'string') return;

  if (!session.workspaceManifest) {
    session.workspaceManifest = { files: [], secondaryFiles: [], projectTree: [] };
  }
  if (!Array.isArray(session.workspaceManifest.files)) {
    session.workspaceManifest.files = [];
  }
  if (!Array.isArray(session.workspaceManifest.secondaryFiles)) {
    session.workspaceManifest.secondaryFiles = [];
  }
  if (!Array.isArray(session.workspaceManifest.projectTree)) {
    session.workspaceManifest.projectTree = [];
  }

  // 1. Update in files array
  const existingFile = session.workspaceManifest.files.find((f: any) => matchWorkspaceFilePath(f.path, trimmedPath));
  if (existingFile) {
    existingFile.content = content;
  } else {
    session.workspaceManifest.files.push({ path: trimmedPath, content, isReadOnly: false });
  }

  // 2. Update in secondaryFiles array if present
  const secFile = session.workspaceManifest.secondaryFiles.find((f: any) => matchWorkspaceFilePath(f.path, trimmedPath));
  if (secFile) {
    secFile.content = content;
  }

  // 3. Update activeFile if it matches or if none set
  const isActive = matchWorkspaceFilePath(session.workspaceManifest.activeFile?.path, trimmedPath) || !session.workspaceManifest.activeFile;
  if (isActive) {
    session.workspaceManifest.activeFile = {
      path: session.workspaceManifest.activeFile?.path || trimmedPath,
      content,
      isReadOnly: false
    };
    session.codeSnippet = content;
    session.activeFilePath = session.workspaceManifest.activeFile.path;
  }

  // 4. Ensure projectTree has the path
  if (!session.workspaceManifest.projectTree.some((p: string) => matchWorkspaceFilePath(p, trimmedPath))) {
    session.workspaceManifest.projectTree.push(trimmedPath);
  }

  console.log(`📝 [WORKSPACE_FILE_UPDATE] Updated in-memory file "${trimmedPath}" (${content.length} chars, active: ${isActive})`);
}

export function mergeWorkspaceManifests(baseManifest: any, incomingManifest: any): any {
  if (!baseManifest && !incomingManifest) {
    return { files: [], secondaryFiles: [], projectTree: [] };
  }
  if (!baseManifest) return incomingManifest;
  if (!incomingManifest) return baseManifest;

  const result = { ...baseManifest };
  const fileMap = new Map<string, any>();

  // Ingest base files
  if (Array.isArray(baseManifest.files)) {
    for (const f of baseManifest.files) {
      if (f?.path) fileMap.set(f.path, { ...f });
    }
  }
  if (baseManifest.activeFile?.path) {
    fileMap.set(baseManifest.activeFile.path, { ...baseManifest.activeFile });
  }
  if (Array.isArray(baseManifest.secondaryFiles)) {
    for (const f of baseManifest.secondaryFiles) {
      if (f?.path && !fileMap.has(f.path)) fileMap.set(f.path, { ...f });
    }
  }

  // Ingest incoming files (authoritative overrides for content)
  if (Array.isArray(incomingManifest.files)) {
    for (const f of incomingManifest.files) {
      if (f?.path) {
        const existingKey = Array.from(fileMap.keys()).find((k) => matchWorkspaceFilePath(k, f.path));
        fileMap.set(existingKey || f.path, { ...f });
      }
    }
  }
  if (incomingManifest.activeFile?.path) {
    const act = incomingManifest.activeFile;
    const existingKey = Array.from(fileMap.keys()).find((k) => matchWorkspaceFilePath(k, act.path));
    fileMap.set(existingKey || act.path, { ...act });
    result.activeFile = { ...(fileMap.get(existingKey || act.path) || act) };
  }
  if (Array.isArray(incomingManifest.secondaryFiles)) {
    for (const f of incomingManifest.secondaryFiles) {
      if (f?.path) {
        const existingKey = Array.from(fileMap.keys()).find((k) => matchWorkspaceFilePath(k, f.path));
        fileMap.set(existingKey || f.path, { ...f });
      }
    }
  }

  const allFiles = Array.from(fileMap.values());
  result.files = allFiles;
  result.fileCount = allFiles.length;
  result.projectTree = allFiles.map((f) => f.path);
  result.secondaryFiles = allFiles.filter(
    (f) => !matchWorkspaceFilePath(f.path, result.activeFile?.path)
  );

  return result;
}

export async function handleLiveToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session, parsedHints = [] } = ctx;

  if (call.name === 'update_whiteboard') {
    const args = call.args || {};
    const action = args.action || 'write';
    const title = args.title || (action === 'clear' ? 'Доска очищена' : 'Демонстрация кода');
    const language = args.language || 'java';
    const code = args.code || '';
    const highlightLines = Array.isArray(args.highlightLines) ? args.highlightLines : [];
    const explanation = args.explanation || '';

    console.log(`🎨 Gemini Live emitted Whiteboard update: [${action}] "${title}" (lang: ${language}, lines: ${highlightLines.length})`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: 'Интерактивная доска обновлена на экране кандидата.',
                directive: 'Кратко объясни кандидату суть показанного фрагмента и ответь на его вопрос. Не произноси сервисных фраз вроде "я вывела код на доску" — сразу обсуждай логику и ключевые детали решения.'
              }
            },
            scheduling: 'WHEN_IDLE'
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'whiteboard_update',
        payload: {
          action,
          title,
          language,
          code,
          highlightLines,
          explanation,
          updatedAt: Date.now()
        }
      }));
    }
    return true;
  }

  if (call.name === 'read_file') {
    const rawPath = (call.args?.filePath || '').trim();
    const manifest = (session as any).workspaceManifest;
    let foundContent: string | null = null;

    if (manifest) {
      // 1. Check active file
      if (manifest.activeFile?.path && matchWorkspaceFilePath(manifest.activeFile.path, rawPath)) {
        foundContent = manifest.activeFile.content;
      }
      // 2. Check secondary files
      if (!foundContent && Array.isArray(manifest.secondaryFiles)) {
        const sec = manifest.secondaryFiles.find((f: any) => matchWorkspaceFilePath(f.path, rawPath));
        if (sec) foundContent = sec.content;
      }
      // 3. Check generic files array
      if (!foundContent && Array.isArray(manifest.files)) {
        const f = manifest.files.find((file: any) => matchWorkspaceFilePath(file.path, rawPath));
        if (f) foundContent = f.content;
      }
    }

    // 4. Check SQLite coding_challenges manifest_json as authoritative fallback if not loaded in memory
    if (!foundContent && session.questionId) {
      try {
        const cRow = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ?').get(session.questionId, session.questionId) as any;
        if (cRow?.manifest_json) {
          const parsed = JSON.parse(cRow.manifest_json);
          if (Array.isArray(parsed.workspaceFiles)) {
            const match = parsed.workspaceFiles.find((f: any) => matchWorkspaceFilePath(f.path, rawPath));
            if (match) {
              foundContent = match.content;
              applyWorkspaceFileUpdate(session as ProxySession, match.path, match.content);
            }
          }
        }
      } catch (err) {
        console.warn(`[READ_FILE] Could not fallback to SQLite for "${rawPath}":`, err);
      }
    }

    // 5. Fallback to session.codeSnippet ONLY if rawPath matches active file or single-file default
    if (!foundContent && (session as any).codeSnippet) {
      const activePath = manifest?.activeFile?.path || (session as any).activeFilePath || 'Solution.java';
      if (matchWorkspaceFilePath(activePath, rawPath)) {
        foundContent = (session as any).codeSnippet;
      }
    }

    const resolved = Boolean(foundContent);
    const availableFiles = manifest?.projectTree?.join(', ') || 'нет файлов';
    const fileContent = foundContent || `Файл "${rawPath}" не найден в структуре проекта. Доступные файлы:\n${availableFiles}`;
    console.log(`📂 [READ_FILE] Gemini Live requested: "${rawPath}" (resolved: ${resolved}, len: ${fileContent.length})`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              output: {
                filePath: rawPath,
                content: fileContent,
                success: resolved,
                error: resolved ? undefined : 'FILE_NOT_FOUND'
              },
              result: {
                filePath: rawPath,
                content: fileContent,
                success: resolved,
                error: resolved ? undefined : 'FILE_NOT_FOUND'
              }
            },
            scheduling: 'WHEN_IDLE'
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }
    return true;
  }

  if (call.name === 'mark_bug_solved') {
    const args = call.args || {};
    const isSolved = args.isSolved ?? true;
    const feedback = args.feedback || 'Отлично! Ошибка найдена верно.';
    const keyInsight = args.keyInsight || '';

    console.log(`🎯 Bug challenge marked as solved: ${feedback}`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: 'Баг подтвержден как решенный.'
              }
            },
            scheduling: 'SILENT'
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    let decayResult: any = null;
    if (session.questionId) {
      try {
        updateBugChallengeStatus({
          challengeId: session.questionId,
          isSolved: Boolean(isSolved),
          score: isSolved ? 10 : 5,
          feedback,
          keyTakeaways: keyInsight ? [keyInsight] : undefined
        });
      } catch (e) {
        console.warn('Could not update bug challenge status in db:', e);
      }

      try {
        decayResult = await applyKnowledgeDecay({
          questionId: session.questionId,
          topic: session.topic || 'General',
          assistanceLevel: isSolved ? (parsedHints.length > 0 ? 'assisted' : 'solo') : 'relapse',
          resolvedGapIds: session.relevantGapIds
        });
        console.log(`🧠 Bug challenge decay applied:`, decayResult);
      } catch (decayErr) {
        console.warn('Bug challenge decay error:', decayErr);
      }
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'bug_solved',
        payload: {
          isSolved,
          feedback,
          keyInsight,
          knowledgeUpdate: decayResult
        }
      }));
    }
    return true;
  }

  if (call.name === 'submit_interview_evaluation') {
    return handleEvaluationToolCall(ctx);
  }

  if (
    call.name === 'inject_chaos_failure' ||
    call.name === 'record_candidate_observation' ||
    call.name === 'submit_hiring_committee_verdict'
  ) {
    return handleSystemDesignToolCall(ctx);
  }

  return false;
}
