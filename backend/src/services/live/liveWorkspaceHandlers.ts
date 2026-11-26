import { normalizeUserId } from '../evaluation/QuestionEvaluationRepository';
import {
  applyWorkspaceFileUpdate,
  matchWorkspaceFilePath,
  normalizeWorkspacePath,
  resolveWorkspaceFileMatch
} from './LiveWorkspaceStore';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolExecutor';

/**
 * liveWorkspaceHandlers.ts
 * Pure handlers for whiteboard, workspace file reading, bug hunt resolution, and code smell reporting.
 * Zero direct WebSocket or global SQLite dependencies (delegates storage to ToolPersistencePort).
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
  const isClear = action === 'clear';

  console.log(
    `🎨 Gemini Live emitted Whiteboard update: [${action}] "${title}" (lang: ${language}, lines: ${highlightLines.length})`
  );

  return {
    result: isClear
      ? {
          status: 'SUCCESS',
          message: 'Интерактивная доска обновлена на экране кандидата.'
        }
      : {
          status: 'SUCCESS',
          message: 'Интерактивная доска обновлена на экране кандидата.',
          directive:
            'Сразу голосом на русском языке (в 2-3 предложениях) объясни кандидату логику показанного фрагмента и ответь на его вопрос. Не произноси сервисных фраз вроде «я вывела код на доску».'
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
    scheduling: isClear ? 'SILENT' : 'WHEN_IDLE'
  };
}

export async function handleReadFile(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { session } = ctx;
  const rawPath = (args.filePath || '').trim();
  const manifest = session.workspaceManifest;
  let foundContent: string | null = null;
  let ambiguousMatches: string[] = [];

  if (manifest) {
    const candidates: Array<{ path: string; content: string }> = [];
    const seen = new Set<string>();
    const addCandidate = (f: any) => {
      const norm = normalizeWorkspacePath(f?.path);
      if (f?.path && norm && !seen.has(norm)) {
        seen.add(norm);
        candidates.push(f);
      }
    };
    if (manifest.activeFile) addCandidate(manifest.activeFile);
    if (Array.isArray(manifest.secondaryFiles)) manifest.secondaryFiles.forEach(addCandidate);
    if (Array.isArray(manifest.files)) manifest.files.forEach(addCandidate);

    const matchRes = resolveWorkspaceFileMatch(candidates, rawPath);
    if (matchRes.match) {
      foundContent = matchRes.match.content;
    } else if (matchRes.ambiguous) {
      ambiguousMatches = matchRes.matches.map((m) => m.path);
    }
  }

  if (!foundContent && ambiguousMatches.length === 0 && session.questionId && ctx.persistencePort) {
    try {
      const stored = await ctx.persistencePort.readChallengeFileFromStore(session.questionId, rawPath);
      if (stored) {
        foundContent = stored.content;
        applyWorkspaceFileUpdate(session, stored.path, stored.content, {
          markActive: Boolean(args.markActive),
          allowActivateIfEmpty: Boolean(args.markActive)
        });
      }
    } catch (err) {
      console.warn(`[READ_FILE] Could not fallback to store for "${rawPath}":`, err);
    }
  }

  if (!foundContent && ambiguousMatches.length === 0 && session.codeSnippet) {
    const activePath = manifest?.activeFile?.path || session.activeFilePath || 'Solution.java';
    if (matchWorkspaceFilePath(activePath, rawPath)) {
      foundContent = session.codeSnippet;
    }
  }

  // Fallback for Whiteboard queries: "Whiteboard.java", "whiteboard", "доска"
  if (!foundContent && ambiguousMatches.length === 0) {
    const isWbQuery =
      rawPath.toLowerCase().includes('whiteboard') ||
      rawPath.toLowerCase().includes('доск');
    if (isWbQuery && manifest) {
      const allFiles = [...(manifest.files || []), ...(manifest.secondaryFiles || [])];
      const wbFile = allFiles.find((f: any) => (f?.path || '').toLowerCase().includes('whiteboard'));
      if (wbFile) foundContent = wbFile.content;
    }
  }

  const resolved = foundContent !== null;
  const availableFiles = manifest?.projectTree?.join(', ') || 'нет файлов';
  const fileContent = resolved
    ? foundContent!
    : ambiguousMatches.length > 0
      ? `Путь "${rawPath}" неоднозначен. Уточните полный путь из списка: ${ambiguousMatches.join(', ')}`
      : `Файл "${rawPath}" не найден в структуре проекта. Доступные файлы:\n${availableFiles}`;

  console.log(`📂 [READ_FILE] Gemini Live requested: "${rawPath}" (resolved: ${resolved}, ambiguous: ${ambiguousMatches.length}, len: ${fileContent.length})`);

  return {
    result: {
      filePath: rawPath,
      content: fileContent,
      success: resolved,
      ...(resolved
        ? {}
        : ambiguousMatches.length > 0
          ? { error: 'AMBIGUOUS_FILE_PATH', matches: ambiguousMatches }
          : { error: 'FILE_NOT_FOUND' })
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
  const userId = normalizeUserId(session.userId);
  const assistanceLevel: 'solo' | 'assisted' | 'relapse' = isSolved
    ? (parsedHints.length > 0 ? 'assisted' : 'solo')
    : 'relapse';

  console.log(`🎯 Bug challenge marked as solved: ${feedback}`);

  let decayResult: any = null;
  if (session.questionId && ctx.persistencePort) {
    try {
      const persisted = await ctx.persistencePort.updateBugSolved({
        challengeId: session.questionId,
        status: 'solved',
        isSolved: Boolean(isSolved),
        score: isSolved ? 10 : 5,
        feedback,
        keyTakeaways: keyInsight ? [keyInsight] : undefined,
        decayedTopic: session.topic || 'General',
        assistanceLevel,
        resolvedGapIds: session.relevantGapIds,
        userId
      });
      decayResult = persisted && typeof persisted === 'object' && 'knowledgeUpdate' in persisted
        ? persisted.knowledgeUpdate ?? null
        : null;
    } catch (err) {
      console.warn('Bug challenge persistence error:', err);
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
