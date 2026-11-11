import { db } from '../db';
import { updateBugChallengeStatus } from '../tutorService';
import { applyKnowledgeDecay } from '../vectorMemoryService';
import { applyWorkspaceFileUpdate, matchWorkspaceFilePath } from './workspaceManifestStore';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolEngine';

/**
 * liveWorkspaceHandlers.ts
 * Чистые обработчики инструментов доски, чтения файлов, баг-хантинга и код-ревью.
 * Без прямого доступа к WebSocket.
 */

export function handleUpdateWhiteboard(
  args: Record<string, any>
): ToolExecutionResult {
  const action = args.action || 'write';
  const title = args.title || (action === 'clear' ? 'Доска очищена' : 'Демонстрация кода');
  const language = args.language || 'java';
  const code = args.code || '';
  const highlightLines = Array.isArray(args.highlightLines) ? args.highlightLines : [];
  const explanation = args.explanation || '';

  console.log(`🎨 Gemini Live emitted Whiteboard update: [${action}] "${title}" (lang: ${language}, lines: ${highlightLines.length})`);

  return {
    result: {
      status: 'SUCCESS',
      message: 'Интерактивная доска обновлена на экране кандидата.',
      directive:
        'Кратко объясни кандидату суть показанного фрагмента и ответь на его вопрос. Не произноси сервисных фраз вроде "я вывела код на доску" — сразу обсуждай логику и ключевые детали решения.'
    },
    clientEvent: {
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
    },
    scheduling: 'WHEN_IDLE'
  };
}

export function handleReadFile(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
  const rawPath = (args.filePath || '').trim();
  const manifest = session.workspaceManifest;
  let foundContent: string | null = null;

  if (manifest) {
    if (manifest.activeFile?.path && matchWorkspaceFilePath(manifest.activeFile.path, rawPath)) {
      foundContent = manifest.activeFile.content;
    }
    if (!foundContent && Array.isArray(manifest.secondaryFiles)) {
      const sec = manifest.secondaryFiles.find((f: any) => matchWorkspaceFilePath(f.path, rawPath));
      if (sec) foundContent = sec.content;
    }
    if (!foundContent && Array.isArray(manifest.files)) {
      const f = manifest.files.find((file: any) => matchWorkspaceFilePath(file.path, rawPath));
      if (f) foundContent = f.content;
    }
  }

  if (!foundContent && session.questionId) {
    try {
      const cRow = db
        .prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ?')
        .get(session.questionId, session.questionId) as any;
      if (cRow?.manifest_json) {
        const parsed = JSON.parse(cRow.manifest_json);
        if (Array.isArray(parsed.workspaceFiles)) {
          const match = parsed.workspaceFiles.find((f: any) => matchWorkspaceFilePath(f.path, rawPath));
          if (match) {
            foundContent = match.content;
            applyWorkspaceFileUpdate(session, match.path, match.content);
          }
        }
      }
    } catch (err) {
      console.warn(`[READ_FILE] Could not fallback to SQLite for "${rawPath}":`, err);
    }
  }

  if (!foundContent && session.codeSnippet) {
    const activePath = manifest?.activeFile?.path || session.activeFilePath || 'Solution.java';
    if (matchWorkspaceFilePath(activePath, rawPath)) {
      foundContent = session.codeSnippet;
    }
  }

  // Fallback for Whiteboard queries: "Whiteboard.java", "whiteboard", "доска"
  if (!foundContent) {
    const isWbQuery =
      rawPath.toLowerCase().includes('whiteboard') ||
      rawPath.toLowerCase().includes('доск');
    if (isWbQuery && manifest) {
      const allFiles = [...(manifest.files || []), ...(manifest.secondaryFiles || [])];
      const wbFile = allFiles.find((f: any) =>
        (f?.path || '').toLowerCase().includes('whiteboard')
      );
      if (wbFile) {
        foundContent = wbFile.content;
      }
    }
  }

  const resolved = Boolean(foundContent);
  const availableFiles = manifest?.projectTree?.join(', ') || 'нет файлов';
  const fileContent =
    foundContent || `Файл "${rawPath}" не найден в структуре проекта. Доступные файлы:\n${availableFiles}`;
  console.log(`📂 [READ_FILE] Gemini Live requested: "${rawPath}" (resolved: ${resolved}, len: ${fileContent.length})`);

  return {
    result: {
      filePath: rawPath,
      content: fileContent,
      success: resolved,
      ...(resolved ? {} : { error: 'FILE_NOT_FOUND' })
    },
    scheduling: 'WHEN_IDLE'
  };
}

export async function handleMarkBugSolved(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { session, parsedHints } = ctx;
  const isSolved = args.isSolved ?? true;
  const feedback = args.feedback || 'Отлично! Ошибка найдена верно.';
  const keyInsight = args.keyInsight || '';

  console.log(`🎯 Bug challenge marked as solved: ${feedback}`);

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
        userId: session.userId || 'anonymous',
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

  return {
    result: {
      status: 'SUCCESS',
      message: 'Баг подтвержден как решенный.'
    },
    clientEvent: {
      type: 'bug_solved',
      payload: {
        isSolved,
        feedback,
        keyInsight,
        knowledgeUpdate: decayResult
      }
    },
    scheduling: 'SILENT'
  };
}

export function handleReportIdentifiedSmell(
  args: Record<string, any>
): ToolExecutionResult {
  const smellId = args.smellId || 'unknown_smell';
  const justification = args.justification || '';

  return {
    result: {
      success: true,
      message: `Запах '${smellId}' успешно зафиксирован в скоркорде ревью. Продолжай сократическое интервью.`
    },
    clientEvent: {
      type: 'smell_discovered',
      smellId,
      justification,
      timestamp: Date.now()
    },
    scheduling: 'WHEN_IDLE'
  };
}
