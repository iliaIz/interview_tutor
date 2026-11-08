# SYSTEM ROLE: Principal Software Architect (Zero-Context Escalation)
Ты проектируешь архитектурное решение и атомарный план имплементации для локального CLI-исполнителя (Gemini 3.8 Flash в Antigravity CLI). Ты работаешь в полной изоляции и видишь ТОЛЬКО данные из этого документа. Не додумывай существование файлов, методов или библиотек, которых нет ниже.

<project_environment>
- Runtime: Node.js 22 LTS, TypeScript 5.7.2, Express 4.21.2, ws 8.18.0, better-sqlite3 12.11.1, @sinclair/typebox 0.34.52.
- Environment Invariant: VPS has 1.8GB RAM. NO LOCAL DOCKER BUILDS. Local verification: `npm run build` (tsc) or targeted node/ts-node test scripts.
- Cognitive Bounding Limit (Rule 8): Newly created source files MUST NOT exceed 350 lines. Modified files MUST NOT exceed 400 lines.
- Project Protocol & Invariants (from AGENTS.md):
  - Invariant 1: LiteLLM Proxy routing, no hardcoded API keys.
  - Invariant 2.1: Turn 0 Tool Lockdown — on Turn 0 (before candidate responds), Gemini Live is strictly blocked from calling evaluation tools.
  - Invariant 2.3: Direct UTF-8 WebSocket decoding.
  - Invariant 8: Zero parallel reimplementations.
</project_environment>

<problem_statement>
В модуле бэкенда для голосового интервью и тренажеров в реальном времени (Gemini Live Bidi WebSocket) выявлен архитектурный дефект: кластер избыточно фрагментированных мелких диспетчеров (shallow pass-through modules) с расходящимися wire-протоколами:
1. Вызовы функций от Gemini Live проходят через 3 слоя: `liveAudioStreamRouter` -> `LiveToolCallExecutor` -> `liveToolDispatcher` -> 4 доменных под-диспетчера (`liveEvaluationToolDispatcher`, `liveHrToolDispatcher`, `liveSystemDesignToolDispatcher`, `liveRefactoringToolDispatcher`).
2. Каждый под-диспетчер держит прямые ссылки на сырые сокеты (`geminiSocket` и `clientSocket`), вручную форматируя JSON для Gemini Live. В результате возникают баги в схеме ответов: `liveRefactoringToolDispatcher` теряет имя инструмента `name` и отправляет `response.output` вместо канонического `response.result`, провоцируя зависания апстрим-сессии Gemini (close code 1008/1011).
3. Инвариант Turn 0 Lockdown (`!session.hasCandidateResponded`) проверяется дублированием кода вручную в двух под-диспетчерах, а в HR-диспетчере вовсе упущен.
4. Дедупликация повторных вызовов (idempotency window) захардкожена внутри `LiveToolCallExecutor.ts` исключительно для инструмента `update_whiteboard` (окно 3000 мс).
5. Файл `liveToolDispatcher.ts` помимо маршрутизации содержит более 120 строк утилит работы с файловой системой и манифестом проекта (`matchWorkspaceFilePath`, `applyWorkspaceFileUpdate`, `mergeWorkspaceManifests`), из-за чего сторонние хендлеры (`liveWsClientFrameHandler.ts`, `liveWsChallengeResolver.ts`) импортируют манифест файлов из диспетчера инструментов.

По результатам гриллинга утверждены 4 архитектурных решения:
- **Q1 -> A (Чистый шов):** Обработчик инструмента не работает с WebSockets напрямую. Его контракт: `(args, ctx) => Promise<ToolResult>`. Сериализация в формат Gemini Live Bidi (`toolResponse.functionResponses`) и клиентские события централизованы в новом глубоком модуле `LiveToolEngine`.
- **Q2 -> A (Изоляция манифеста):** Утилиты манифеста выносятся в независимый доменный модуль `workspaceManifestStore.ts` (или `workspaceManifestManager.ts`).
- **Q3 -> A (Декларативные метаданные):** Инструменты объявляются с декларативными свойствами (`isGatedOnTurn0?: boolean`, `dedupWindowMs?: number`, `scheduling?: 'WHEN_IDLE' | 'SILENT'`). `LiveToolEngine` централизованно валидирует эти инварианты до вызова функции.
- **Q4 -> A (Non-Goals):** Внешний WebSocket-контракт событий клиента (`whiteboard_update`, `bug_solved`, `smell_discovered`, события HR-фаз) остается на 100% стабильным. Фронтенд и пакет `@interview-prep/shared` не меняются.
</problem_statement>

<failed_local_attempts>
None (Preventive architectural escalation: Blast Radius > 3 files and Greenfield deep module design)
</failed_local_attempts>

<repository_topology>
backend/
├── src/
│   ├── services/
│   │   ├── live/
│   │   │   ├── LiveToolCallExecutor.ts       (153 lines)
│   │   │   ├── liveToolDispatcher.ts         (399 lines)
│   │   │   ├── liveEvaluationToolDispatcher.ts (306 lines)
│   │   │   ├── liveHrToolDispatcher.ts       (210 lines)
│   │   │   ├── liveSystemDesignToolDispatcher.ts (182 lines)
│   │   │   ├── liveRefactoringToolDispatcher.ts (46 lines)
│   │   │   ├── liveToolDeclarations.ts       (366 lines)
│   │   │   ├── liveSessionTypes.ts           (110 lines)
│   │   │   ├── liveAudioStreamRouter.ts      (373 lines - Call site for tools)
│   │   │   ├── liveWsClientFrameHandler.ts   (395 lines - Call site for workspace manifest)
│   │   │   ├── liveWsChallengeResolver.ts    (244 lines - Call site for workspace manifest)
│   │   │   ├── hrContextResolver.ts
│   │   │   └── HrSimulationOrchestrator.ts
│   │   ├── geminiLiveProxy.ts               (56 lines - Re-exports)
│   │   ├── tutorService.ts
│   │   ├── vectorMemoryService.ts
│   │   ├── progressService.ts
│   │   └── db.ts
│   └── prompts/
│       └── personas.ts
</repository_topology>

<source_context>
<file path="backend/src/services/live/LiveToolCallExecutor.ts">
import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { handleLiveToolCall } from './liveToolDispatcher';

export interface ToolExecutorOptions {
  functionCalls: any[];
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

/**
 * LiveToolCallExecutor (SOTA Late 2026).
 * Handles function calls execution, duplicate update_whiteboard suppression,
 * and graceful negative responses to prevent Gemini Bidi hangs.
 * Cognitive bounding limit: <= 350 lines.
 */
export class LiveToolCallExecutor {
  public static async executeFunctionCalls(options: ToolExecutorOptions): Promise<void> {
    const { functionCalls, clientSocket, geminiSocket, session, parsedHints, liveCoaching } = options;

    session.isToolCallPending = true;
    session.lastActivityAt = Date.now();
    if (session.nudgeWatchdog) {
      clearTimeout(session.nudgeWatchdog);
      session.nudgeWatchdog = null;
    }
    console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(functionCalls));

    if (session.toolCallSafetyTimeout) clearTimeout(session.toolCallSafetyTimeout);
    session.toolCallSafetyTimeout = setTimeout(() => {
      if (session.isToolCallPending) {
        console.warn('⚠️ Tool call safety timeout (10s) reached: releasing audio gate');
        session.isToolCallPending = false;
      }
    }, 10000);

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'tool_executing',
        tools: functionCalls.map((fc: any) => fc.name)
      }));
    }

    for (const call of functionCalls) {
      if (call.name === 'update_whiteboard') {
        const callKey = JSON.stringify(call.args || {});
        const now = Date.now();
        if (session.lastToolCallHash === callKey && now - (session.lastToolCallTime || 0) < 3000) {
          console.log('🔄 Suppressing duplicate update_whiteboard call within 3s');
          if (geminiSocket.readyState === WebSocket.OPEN) {
            geminiSocket.send(JSON.stringify({
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    name: call.name,
                    response: {
                      result: {
                        status: 'SUCCESS',
                        message: 'Интерактивная доска уже обновлена.',
                        directive: 'Кратко (в 1-2 предложениях) поясни кандидату голосом показанный фрагмент. Не вызывай повторных инструментов.'
                      }
                    }
                  }
                ]
              }
            }));
          }
          continue;
        }
        session.lastToolCallHash = callKey;
        session.lastToolCallTime = now;
      }

      try {
        const isHandled = await handleLiveToolCall({
          call,
          clientSocket,
          geminiSocket,
          session,
          parsedHints,
          liveCoaching
        });

        if (!isHandled) {
          console.warn(`⚠️ Unhandled or unsupported tool call [${call.name}]. Emitting graceful negative toolResponse.`);
          if (geminiSocket.readyState === WebSocket.OPEN) {
            geminiSocket.send(JSON.stringify({
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    name: call.name,
                    response: {
                      result: {
                        error: `Tool '${call.name}' is not supported in this session. Please explain verbally or use update_whiteboard.`
                      }
                    }
                  }
                ]
              }
            }));
          }
        }
      } catch (toolErr) {
        const errorMessage = toolErr instanceof Error ? toolErr.message : 'Internal error';
        console.error(`❌ Error executing tool ${call.name}:`, toolErr);
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(JSON.stringify({
            toolResponse: {
              functionResponses: [
                {
                  id: call.id,
                  name: call.name,
                  response: {
                    result: {
                      error: `Tool execution failed: ${errorMessage}`
                    }
                  }
                }
              ]
            }
          }));
        }
      }
    }

    session.isToolCallPending = false;
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'tool_execution_complete',
        tools: functionCalls.map((fc: any) => fc.name)
      }));
    }
  }

  public static handleCancellation(session: ProxySession, ids: string[]): void {
    console.log('🚫 [TOOL_CALL_CANCELLED] Upstream Gemini cancelled tool calls:', ids);
    session.isToolCallPending = false;
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
  }
}
</file>

<file path="backend/src/services/live/liveToolDispatcher.ts">
import { handleHrToolCall } from './liveHrToolDispatcher';
import { WebSocket } from 'ws';
import { db } from '../db';
import { updateBugChallengeStatus } from '../tutorService';
import { applyKnowledgeDecay } from '../vectorMemoryService';
import { TurnTelemetryEvent } from '@interview-prep/shared';
import { handleEvaluationToolCall } from './liveEvaluationToolDispatcher';
import { handleSystemDesignToolCall } from './liveSystemDesignToolDispatcher';
import { handleRefactoringSmellToolCall } from './liveRefactoringToolDispatcher';
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

  if (call.name === 'report_identified_smell') {
    return handleRefactoringSmellToolCall(ctx);
  }

  if (
    call.name === 'inject_chaos_failure' ||
    call.name === 'record_candidate_observation' ||
    call.name === 'submit_hiring_committee_verdict'
  ) {
    return handleSystemDesignToolCall(ctx);
  }

  if (
    call.name === 'advance_hr_phase' ||
    call.name === 'submit_hr_evaluation' ||
    call.name === 'emit_hr_round_evaluation'
  ) {
    return handleHrToolCall(ctx);
  }

  return false;
}
</file>

<file path="backend/src/services/live/liveEvaluationToolDispatcher.ts">
import { WebSocket } from 'ws';
import { db } from '../db';
import { applyKnowledgeDecay, recordNewErrorGap } from '../vectorMemoryService';
import { recordEvaluationAndSyncProgress } from '../progressService';
import { calculateFaangScorecard } from '../../prompts/personas';
import { buildWeightedRubric } from './livePromptBuilder';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { LiveToolContext } from './liveToolDispatcher';

export async function handleEvaluationToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session, liveCoaching = false } = ctx;

  if (call.name !== 'submit_interview_evaluation') {
    return false;
  }

  // SOTA First-Turn Guard: Reject premature evaluation if candidate has not yet responded
  if (!session.hasCandidateResponded) {
    console.warn('🛡️ [First-Turn Guard] Blocked premature submit_interview_evaluation before candidate spoke. Re-prompting AI to speak question...');
    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              response: {
                error: 'Кандидат еще не отвечал на вопрос. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку на этапе первого приветствия. Пожалуйста, поприветствуйте кандидата голосом, четко зачитайте вопрос и передайте слово.'
              },
              id: call.id
            }
          ]
        }
      }));
    }
    return true;
  }

  const args = call.args || {};
  const score = typeof args.score === 'number' ? Math.max(0, Math.min(100, Math.round(args.score))) : 70;
  const isPassed = typeof args.isPassed === 'boolean' ? args.isPassed : score >= 70;
  const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
  const missingPoints = Array.isArray(args.missingPoints) ? args.missingPoints : [];
  const feedback = typeof args.spokenFeedback === 'string' ? args.spokenFeedback : 'Ответ принят.';
  const questionType = args.questionType || 'definitional';
  const speechCoaching = args.speechCoaching || null;

  const rawCriteriaBreakdown = Array.isArray(args.criteriaBreakdown) ? args.criteriaBreakdown : [];
  let rawDeductions = Array.isArray(args.deductions) ? args.deductions : [];
  const upgradeSnippet = typeof args.upgradeSnippet === 'string' ? args.upgradeSnippet : '';

  // Auto-Balancer & Fallback: If model did not supply criteriaBreakdown, build it from default rubric
  let criteriaBreakdown = rawCriteriaBreakdown;
  if (criteriaBreakdown.length === 0) {
    const defaultRubric = buildWeightedRubric(session.referenceAnswer || '', session.questionText || '');
    let remainingScore = score;
    criteriaBreakdown = defaultRubric.map((r, idx) => {
      let earned = 0;
      if (remainingScore >= r.weight) {
        earned = r.weight;
        remainingScore -= r.weight;
      } else {
        earned = remainingScore;
        remainingScore = 0;
      }
      const isFull = earned === r.weight;
      const isZero = earned === 0;
      return {
        id: r.id,
        title: r.title,
        maxPoints: r.weight,
        earnedPoints: earned,
        status: isFull ? 'covered' : (isZero ? 'missed' : 'partial'),
        probeAssisted: (session.probesCount || 0) > 0 && !isFull && earned > 0,
        evidence: isFull ? 'Критерий раскрыт в ответе' : undefined,
        gap: isFull ? undefined : (missingPoints[idx] || `Недостаточно полно раскрыты ${r.title.toLowerCase()}`)
      };
    });
  }

  // Auto-Balancer for deductions: if score < 100 and deductions is empty, derive deductions from criteria gaps
  const totalLostPoints = Math.max(0, 100 - score);
  let deductions = rawDeductions;
  if (totalLostPoints > 0 && deductions.length === 0) {
    const gapCriteria = criteriaBreakdown.filter((c: any) => (c.maxPoints - c.earnedPoints) > 0);
    if (gapCriteria.length > 0) {
      deductions = gapCriteria.map((c: any) => ({
        penalty: c.maxPoints - c.earnedPoints,
        criteria: c.title,
        reason: c.gap || `Неполный ответ по критерию «${c.title}»`
      }));
    } else if (missingPoints.length > 0) {
      const perPoint = Math.max(1, Math.round(totalLostPoints / missingPoints.length));
      deductions = missingPoints.map((mp: string, i: number) => ({
        penalty: i === missingPoints.length - 1 ? (totalLostPoints - perPoint * (missingPoints.length - 1)) : perPoint,
        criteria: 'Зоны роста',
        reason: mp
      }));
    } else {
      deductions = [{
        penalty: totalLostPoints,
        criteria: 'Подводные камни и глубина раскрытия',
        reason: 'Ответ не содержит разбора подводных камней, граничных условий или production best practices.'
      }];
    }
  }

  if (missingPoints.length === 0 && deductions.length > 0) {
    missingPoints.push(...deductions.map((d: any) => `${d.criteria}: ${d.reason} (-${d.penalty} б.)`));
  }

  const calculatedScorecard = calculateFaangScorecard({
    score,
    persona: session.persona || 'mentor',
    targetGrade: session.targetGrade || 'L5_SENIOR',
    positivePoints,
    missingPoints,
    questionType
  });

  const faangScorecard = args.faangScorecard ? {
    ...calculatedScorecard,
    ...args.faangScorecard,
    dimensionScores: {
      ...calculatedScorecard.dimensionScores,
      ...(args.faangScorecard.dimensionScores || {})
    }
  } : calculatedScorecard;

  let savedEvalId = '';
  if (session.questionId) {
    try {
      const mem = session.sessionId ? getOrCreateSessionMemory(session.sessionId, session.questionId || '') : null;
      const dialogueTranscript = mem && mem.turns && mem.turns.length > 0
        ? mem.turns.map(t => `${t.role === 'user' ? 'Кандидат' : 'Интервьюер'}: ${t.text}`).join('\n\n')
        : (session.turnTelemetryHistory && session.turnTelemetryHistory.length > 0
            ? session.turnTelemetryHistory.map(t => `Turn ${t.turnIndex} (${t.speaker}): duration ${t.speechDurationMs}ms`).join('\n')
            : 'Устный диалог в Gemini Live');

      const syncResult = recordEvaluationAndSyncProgress({
        userId: session.userId || 'default_user',
        questionId: session.questionId,
        topic: session.topic || 'General',
        mode: 'voice',
        score,
        isPassed,
        positivePoints,
        missingPoints,
        feedback,
        speechCoaching: {
          ...(speechCoaching || {}),
          questionType,
          faangScorecard,
          criteriaBreakdown,
          deductions,
          upgradeSnippet
        },
        turnTelemetry: session.turnTelemetryHistory || [],
        transcript: dialogueTranscript,
        userAnswer: dialogueTranscript
      });
      savedEvalId = syncResult.evalId;
      console.log(`💾 Live evaluation saved & progress synced to DB: ${savedEvalId} (Score: ${score}, Topic: ${syncResult.progress.topic}, Percentage: ${syncResult.progress.percentage}%)`);
    } catch (dbErr) {
      console.error('Error saving Live evaluation to DB:', dbErr);
    }

    try {
      const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(session.questionId) as any;
      const canonicalId = aliasRow ? aliasRow.canonical_id : session.questionId;
      const manifestRow = db.prepare('SELECT canonical_id FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId) as any;
      if (manifestRow) {
        const ledgerId = `prog_live_${canonicalId}_${session.userId || 'default_user'}_${Date.now()}`;
        const status = isPassed ? 'PASSED' : 'FAILED';
        db.prepare(`
          INSERT INTO user_progress_ledger (
            id, user_id, canonical_id, studio_stage, status, score, artifacts_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          ledgerId,
          session.userId || 'default_user',
          canonicalId,
          'STUDIO_3_DEFENSE',
          status,
          score,
          JSON.stringify({
            savedEvalId,
            feedback,
            positivePoints,
            missingPoints,
            faangScorecard,
            criteriaBreakdown,
            deductions
          })
        );
        console.log(`📊 [Ledger] Live evaluation persisted to user_progress_ledger: ${ledgerId} (${status}, score: ${score})`);
      }
    } catch (ledgerErr) {
      console.warn('⚠️ [Ledger] Could not persist live evaluation to user_progress_ledger:', ledgerErr);
    }
  }

  const probes = session.probesCount || 0;
  let assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse' = 'solo';
  if (session.isRetry) {
    assistanceLevel = isPassed ? 'assisted' : 'relapse';
  } else if (score >= 80 && probes <= 2 && !liveCoaching) {
    assistanceLevel = 'solo';
  } else if (score >= 70) {
    assistanceLevel = 'guided';
  } else if (liveCoaching || (score >= 60 && score < 70)) {
    assistanceLevel = isPassed ? 'assisted' : 'relapse';
  } else {
    assistanceLevel = 'relapse';
  }

  let decayResult: any = null;
  try {
    decayResult = await applyKnowledgeDecay({
      questionId: session.questionId,
      topic: session.topic || 'General',
      assistanceLevel,
      resolvedGapIds: session.relevantGapIds
    });
    console.log(`🧠 Knowledge decay applied (${assistanceLevel}):`, JSON.stringify(decayResult));
  } catch (decayErr) {
    console.error('Error applying knowledge decay:', decayErr);
  }

  if (!isPassed && missingPoints.length > 0) {
    try {
      void recordNewErrorGap({
        questionId: session.questionId,
        topic: session.topic || 'General',
        errorConcept: missingPoints[0],
        initialDeficit: 1.0
      });
    } catch (recErr) {
      console.warn('Could not record new gap:', recErr);
    }
  }

  const toolResponse = {
    toolResponse: {
      functionResponses: [
        {
          id: call.id,
          name: call.name,
          response: {
            result: {
              success: true,
              saved: true,
              score,
              isPassed,
              evaluationId: savedEvalId,
              message: 'Оценка сохранена в ведомость.',
              directive: 'Кратко подведи итог (1-2 предложения), поблагодари за ответ и назови вердикт. Не молчи.'
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

  const evaluationPayload = {
    id: savedEvalId,
    questionId: session.questionId,
    score,
    isPassed,
    positivePoints,
    missingPoints,
    feedback,
    spokenFeedback: feedback,
    questionType,
    speechCoaching,
    faangScorecard,
    criteriaBreakdown,
    deductions,
    upgradeSnippet,
    assistanceLevel,
    knowledgeUpdate: decayResult
  };

  if (clientSocket.readyState === WebSocket.OPEN) {
    clientSocket.send(JSON.stringify({
      type: 'evaluation_completed',
      evaluation: evaluationPayload,
      payload: evaluationPayload
    }));
  }

  console.log('✅ Evaluation delivered to client. Keeping session lifeline open for Q&A and transition.');
  return true;
}
</file>

<file path="backend/src/services/live/liveRefactoringToolDispatcher.ts">
import { LiveToolContext } from './liveToolDispatcher';

/**
 * liveRefactoringToolDispatcher.ts
 * Dispatches real-time code smell identifications from Gemini Live to client UI.
 * Single responsibility: Refactoring smell tool handling and WebSocket event emission.
 * Cognitive bounding limit: <= 350 lines (Rule 8).
 */
export function handleRefactoringSmellToolCall(ctx: LiveToolContext): boolean {
  const { call, clientSocket, geminiSocket } = ctx;
  const { smellId, justification } = call.args || {};

  // 1. Notify candidate's UI in real time via client WebSocket
  if (clientSocket && clientSocket.readyState === 1 /* OPEN */) {
    clientSocket.send(
      JSON.stringify({
        type: 'smell_discovered',
        smellId: smellId || 'unknown_smell',
        justification: justification || '',
        timestamp: Date.now()
      })
    );
  }

  // 2. Acknowledge tool response to Gemini Live stream (NOTE: missing 'name' in functionResponse!)
  geminiSocket.send(
    JSON.stringify({
      toolResponse: {
        functionResponses: [
          {
            response: {
              output: {
                success: true,
                message: `Запах '${smellId}' успешно зафиксирован в скоркорде ревью. Продолжай сократическое интервью.`
              }
            },
            id: call.id
          }
        ]
      }
    })
  );

  return true;
}
</file>

<file path="backend/src/services/live/liveSystemDesignToolDispatcher.ts">
import { WebSocket } from 'ws';
import { db } from '../db';
import { LiveToolContext } from './liveToolDispatcher';

export async function handleSystemDesignToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session } = ctx;

  if (call.name === 'inject_chaos_failure') {
    const args = call.args || {};
    const failureType = args.failure_type || 'ASYMMETRIC_NETWORK_PARTITION';
    const targetId = args.target_component_id || 'primary_db';
    const context = args.technical_context || 'Инъекция аппаратного или сетевого сбоя на узле.';

    console.log(`💥 Chaos Injected by Gemini Live: [${failureType}] on "${targetId}": ${context}`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'INJECTED',
                failureType,
                targetComponentId: targetId,
                message: `Сбой [${failureType}] успешно активирован на компоненте ${targetId}.`
              }
            }
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'chaos_injected',
        payload: {
          failureType,
          targetComponentId: targetId,
          technicalContext: context,
          timestamp: Date.now()
        }
      }));
    }
    return true;
  }

  if (call.name === 'record_candidate_observation') {
    const args = call.args || {};
    console.log(`👁️ Candidate Observation Recorded: [${args.signal}] ${args.dimension} -> ${args.demonstrated_level}`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'RECORDED',
                message: 'Наблюдение зафиксировано в протоколе комитета найма.'
              }
            }
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'candidate_observation_recorded',
        observation: args,
        timestamp: Date.now()
      }));
    }
    return true;
  }

  if (call.name === 'submit_hiring_committee_verdict') {
    // SOTA First-Turn Guard: Reject premature evaluation if candidate has not yet defended their architecture
    if (!session.hasCandidateResponded) {
      console.warn('🛡️ [First-Turn Guard] Blocked premature submit_hiring_committee_verdict before candidate spoke.');
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify({
          toolResponse: {
            functionResponses: [
              {
                response: {
                  error: 'Кандидат еще не защищал архитектуру. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выносить вердикт на этапе первого хода. Пожалуйста, поприветствуйте кандидата голосом, сформулируйте задачу и пригласите обсудить функциональные требования.'
                },
                id: call.id
              }
            ]
          }
        }));
      }
      return true;
    }

    const args = call.args || {};
    const targetLevel = args.target_level || 'L6';
    const calibratedLevel = args.calibrated_level || 'L5';
    const verdict = args.verdict || 'NO_HIRE';
    const scores = args.scores || { exploration: 3.0, architecture: 3.0, deep_dives: 2.5, operational_excellence: 2.8 };
    const defense = args.calibration_defense || 'Калибровочное заключение комитета по найму.';

    console.log(`⚖️ Hiring Committee Verdict Submitted: [${verdict}] Target: ${targetLevel} -> Calibrated: ${calibratedLevel}`);

    const submissionId = `sd_hc_${session.sessionId || Date.now()}`;
    const packet = {
      candidate_id: session.userId || 'candidate',
      interview_timestamp: new Date().toISOString(),
      target_level: targetLevel,
      calibrated_level: calibratedLevel,
      hiring_recommendation: verdict,
      scores,
      leveling_justification: defense
    };

    if (session.questionId) {
      try {
        db.prepare(`
          INSERT INTO system_design_submissions (id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          submissionId,
          session.questionId,
          session.userId || 'default_user',
          session.currentArchitectureMermaid || '',
          defense,
          JSON.stringify(packet)
        );
        console.log(`💾 Persisted Hiring Committee submission ${submissionId} for scenario ${session.questionId}`);
      } catch (dbErr) {
        console.warn('Could not persist hiring committee submission to db:', dbErr);
      }
    }

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'COMMITTED',
                verdict,
                calibratedLevel,
                message: 'Вердикт калибровочного комитета официально зарегистрирован.'
              }
            }
          }
        ]
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(toolResponse));
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'hiring_committee_verdict',
        submissionId,
        packet,
        timestamp: Date.now()
      }));
    }
    return true;
  }

  return false;
}
</file>

<file path="backend/src/services/live/liveHrToolDispatcher.ts">
import { WebSocket } from 'ws';
import { LiveToolContext } from './liveToolDispatcher';
import { HR_VOICE_EVENTS, HrScorecard } from '@interview-prep/shared';

export async function handleHrToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session } = ctx;

  // 1. Tool: advance_hr_phase
  if (call.name === 'advance_hr_phase') {
    const args = call.args || {};
    const fromPhase = args.fromPhase || 'unknown';
    const toPhase = args.toPhase || 'next_phase';
    const phaseSummary = args.phaseSummary || 'Фаза завершена.';

    console.log(`🧭 [HR_FSM] Phase transition requested: "${fromPhase}" -> "${toPhase}" (Summary: ${phaseSummary.slice(0, 80)}...)`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: `Фаза успешно переключена на ${toPhase}.`,
                directive: `Ты перешла к фазе ${toPhase}. Задай следующий вопрос кандидату естественным речевым потоком согласно твоей роли рекрутера.`
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

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_PHASE_TRANSITION,
          payload: {
            fromPhase,
            toPhase,
            phaseSummary,
            timestamp: Date.now()
          }
        })
      );
    }

    return true;
  }

  // 2. Tool: emit_hr_round_evaluation (Micro-Drill mode)
  if (call.name === 'emit_hr_round_evaluation') {
    const args = call.args || {};
    const questionId = args.questionId || session.questionId || 'hr_q0_elevator_pitch';
    const passed = Boolean(args.passed ?? ((args.overallScore || 0) >= 85));
    const overallScore = Math.max(0, Math.min(100, Math.round(Number(args.overallScore) || 75)));
    const substanceMatch = Math.max(0, Math.min(100, Math.round(Number(args.substanceMatch) || 75)));
    const lexicalDensity = Math.max(0, Math.min(100, Math.round(Number(args.lexicalDensity) || 75)));
    const pacingScore = Math.max(0, Math.min(100, Math.round(Number(args.pacingScore) || 75)));
    const deliveryConfidence = Math.max(0, Math.min(100, Math.round(Number(args.deliveryConfidence) || 75)));
    const missedAnchors = Array.isArray(args.missedAnchors) ? args.missedAnchors.map(String) : [];
    const actionableCritique = args.actionableCritique || 'Хороший ответ, продолжайте отработку.';
    const nextAction = args.nextAction === 'advance_next_question' ? 'advance_next_question' : 'repeat_drill';

    console.log(`🎯 [HR_DRILL_EVAL] Question: ${questionId} | Score: ${overallScore} | Passed: ${passed} | Next: ${nextAction}`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: 'Оценка зафиксирована в системе.',
                directive: `Озвучь кандидату краткий вердикт голосом (СТРОГО НЕ БОЛЕЕ 15-20 СЕКУНД!). Сфокусируйся на 1-2 главных ошибках или похвали за точность, если балл >= 85. Предложи повторить дубль или перейти дальше.`
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

    const scorecard: HrScorecard = {
      sessionId: session.sessionId || 'hr_session',
      turnId: `turn_${Date.now()}`,
      questionId,
      mode: 'rapid_fire_micro_drill',
      overallScore,
      passed,
      metrics: {
        substanceMatch,
        lexicalDensity,
        pacingScore,
        deliveryConfidence
      },
      turnDurationSec: 75,
      averageWpm: 125,
      fillerWordsSpotted: [],
      anchorsHit: [],
      anchorsMissed: missedAnchors,
      actionableCritique,
      nextAction
    };

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
          payload: scorecard
        })
      );
    }

    return true;
  }

  // 3. Tool: submit_hr_evaluation (Full Simulation mode)
  if (call.name === 'submit_hr_evaluation') {
    const args = call.args || {};
    const overallScore = Math.max(0, Math.min(100, Math.round(Number(args.overallScore) || 80)));
    const passed = overallScore >= 85;
    const substanceMatch = Math.max(0, Math.min(100, Math.round(Number(args.substanceMatch) || overallScore)));
    const lexicalDensity = Math.max(0, Math.min(100, Math.round(Number(args.lexicalDensity) || overallScore)));
    const pacingScore = Math.max(0, Math.min(100, Math.round(Number(args.pacingScore) || overallScore)));
    const deliveryConfidence = Math.max(0, Math.min(100, Math.round(Number(args.deliveryConfidence) || overallScore)));
    const spokenFeedback = args.spokenFeedback || 'Скрининг завершен.';
    const redFlags = Array.isArray(args.redFlags) ? args.redFlags.map(String) : [];
    const strengths = Array.isArray(args.strengths) ? args.strengths.map(String) : [];

    console.log(`📋 [HR_SIMULATION_SUMMARY] Full screening evaluated: ${overallScore}/100 (Passed: ${passed})`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              result: {
                status: 'SUCCESS',
                message: 'Сводный отчет по скринингу сформирован.',
                directive: `Поблагодари кандидата за созвон, озвучь итоговое впечатление в 1-2 предложениях и попрощайся.`
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

    const scorecard: HrScorecard = {
      sessionId: session.sessionId || 'hr_sim_session',
      turnId: `sim_turn_${Date.now()}`,
      questionId: 'full_screening_evaluation',
      mode: 'full_screening_simulation',
      overallScore,
      passed,
      metrics: {
        substanceMatch,
        lexicalDensity,
        pacingScore,
        deliveryConfidence
      },
      turnDurationSec: 900,
      averageWpm: 122,
      fillerWordsSpotted: [],
      anchorsHit: strengths,
      anchorsMissed: redFlags,
      actionableCritique: spokenFeedback,
      nextAction: 'session_completed'
    };

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
          payload: scorecard
        })
      );
    }

    return true;
  }

  return false;
}
</file>

<file path="backend/src/services/live/liveSessionTypes.ts">
import { WebSocket, RawData } from 'ws';
import { InterviewPersonaId, TargetGrade } from '../../prompts/personas';
import { TurnTelemetryEvent } from '@interview-prep/shared';

export function toRawBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

export interface CurrentTurnMetrics {
  turnIndex: number;
  candidateSpeechStartedAt?: number;
  candidateSpeechEndedAt?: number;
  vadPauseSettingMs: number;
  speechDurationMs: number;
  firstThoughtAt?: number;
  firstTextAt?: number;
  firstAudioAt?: number;
  audioBytesReceived: number;
  textChars: number;
  droppedEchoChunksCount: number;
  wasBargeIn: boolean;
  bargeInType?: 'tactile' | 'acoustic' | null;
  lastRttMs?: number | null;
}

export interface ProxySession {
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  isSetupComplete: boolean;
  frameQueue: Buffer[];
  sessionId?: string;
  questionId?: string;
  userId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  relevantGapIds?: string[];
  probesCount?: number;
  isRetry?: boolean;
  questionIndex?: number;
  totalQuestions?: number;
  hasCandidateResponded?: boolean;
  isOnHold?: boolean;
  lastActivityAt: number;
  heartbeatInterval?: NodeJS.Timeout | null;
  nudgeWatchdog?: NodeJS.Timeout | null;
  deadAirWatchdog?: NodeJS.Timeout | null;
  deadAirTimeoutMs?: number;
  currentAiTurnText?: string;
  persona?: InterviewPersonaId | string;
  targetGrade?: TargetGrade;
  isToolCallPending?: boolean;
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill';
  liveModel?: string;
  currentArchitectureMermaid?: string;
  currentGraphIr?: string;
  isUpstreamReconnecting?: boolean;
  reconnectAttempts?: number;
  reconnectTimer?: NodeJS.Timeout | null;
  toolCallSafetyTimeout?: NodeJS.Timeout | null;
  isTerminated?: boolean;
  challengeCategory?: string;
  challengeTrack?: string;
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  activeFilePath?: string;
  workspaceManifest?: any;
  strategy?: string;
  activeCodeArtifact?: any;
  currentTurnIndex?: number;
  currentTurnMetrics?: CurrentTurnMetrics | null;
  turnTelemetryHistory?: TurnTelemetryEvent[];
  vadPauseMs?: number;
  enableSilenceClarification?: boolean;
  debugStep?: number;
  lastRttMs?: number | null;
  sessionStartedAt?: number;
  academyCourse?: string;
  academyStep?: string;
  academyBridgeContext?: any;
  seniorReview?: any;
  hasTerminalError?: boolean;
  terminalErrorCode?: string;
  lastToolCallHash?: string;
  lastToolCallTime?: number;
  aiPlayoutEstimatedEndEpoch?: number;
  isAiGenerating?: boolean;
  currentTurnAudioBytes?: number;
  audioChunksCount?: number;
  lastTurnCommitTime?: number;
}
</file>

<file path="backend/src/services/live/liveAudioStreamRouter.ts (Call site excerpt)">
// Lines 300-316:
        // 3. Tool Call Cancellation
        if (parsed.toolCallCancellation?.ids) {
          LiveToolCallExecutor.handleCancellation(session, parsed.toolCallCancellation.ids);
        }

        // 4. Tool Calls Execution
        if (parsed.toolCall?.functionCalls) {
          isToolCallProcessed = true;
          await LiveToolCallExecutor.executeFunctionCalls({
            functionCalls: parsed.toolCall.functionCalls,
            clientSocket,
            geminiSocket,
            session,
            parsedHints,
            liveCoaching
          });
        }
</file>

<file path="backend/src/services/live/liveWsClientFrameHandler.ts (Manifest excerpt)">
// Lines 6-7, 111-125:
import { applyWorkspaceFileUpdate, matchWorkspaceFilePath, mergeWorkspaceManifests } from './liveToolDispatcher';
...
      if (parsed.type === 'workspace_file_update') {
        applyWorkspaceFileUpdate(session, parsed.path, parsed.content);
        return;
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
            if (manifest.activeFile && !matchWorkspaceFilePath(manifest.activeFile.path, found.path)) {
              if (!secondary.some((s: any) => matchWorkspaceFilePath(s.path, manifest.activeFile.path))) {
                secondary.push(manifest.activeFile);
              }
            }
            manifest.activeFile = { ...found };
            manifest.secondaryFiles = secondary.filter((s: any) => !matchWorkspaceFilePath(s.path, found.path));
            session.activeFilePath = found.path;
            session.codeSnippet = found.content;
          }
        }
        return;
      }
</file>
</source_context>

<constraints_and_invariants>
1. Cognitive Bounding Limit (Rule 8):
   - Новые файлы строго <= 350 строк.
   - Изменяемые файлы строго <= 400 строк.
2. Invariant 2.1 (First-Turn Tool Lockdown):
   - При `session.hasCandidateResponded === false` любые попытки вызвать оценочные инструменты (`submit_interview_evaluation`, `submit_hiring_committee_verdict`, `submit_hr_evaluation`, `emit_hr_round_evaluation`) ОБЯЗАНЫ отклоняться структурированной ошибкой `toolResponse` с указанием модели зачитать вопрос кандидату голосом.
3. Wire Protocol Integrity:
   - Все ответы `toolResponse.functionResponses` обязаны иметь правильные поля: `id`, `name`, `response: { result: ... }` (или `response: { error: ... }`), и `scheduling: 'WHEN_IDLE' | 'SILENT'`.
   - Запрещено использовать `response.output` без поля `result` или опускать `name`.
4. Decoupling & Seam Discipline:
   - Обработчики инструментов (`ToolHandlers`) НЕ должны импортировать `ws` или вызывать `geminiSocket.send` / `clientSocket.send`.
   - Они возвращают типизированный результат: `{ result?: any; error?: string; clientEvent?: { type: string; payload?: any; [k: string]: any }; scheduling?: 'WHEN_IDLE' | 'SILENT' }`.
   - Движок `LiveToolEngine` централизованно выполняет сокетную отправку.
5. Workspace Manifest Separation:
   - Функции `matchWorkspaceFilePath`, `applyWorkspaceFileUpdate`, `mergeWorkspaceManifests` должны находиться в `backend/src/services/live/workspaceManifestStore.ts` (или `workspaceManifestManager.ts`).
   - `liveWsClientFrameHandler.ts`, `liveWsChallengeResolver.ts` и инструмент `read_file` должны импортировать их оттуда.
6. Non-Goals:
   - Фронтенд (`frontend/`) и пакет общих типов (`shared/`) НЕ изменяются. Типы событий для клиента (`whiteboard_update`, `bug_solved`, `smell_discovered`, `evaluation_completed`, `chaos_injected`, `candidate_observation_recorded`, `hiring_committee_verdict`, `hr_phase_transition`, `hr_scorecard_ready`) должны отправляться в абсолютно идентичном формате.
</constraints_and_invariants>

<required_output_contract>
Верни ответ строго в формате инженерной спецификации, готовой для сохранения в `.ai/handoff/architect_response.md` и исполнения локальным CLI-агентом:

1. **Root Cause & Architecture Decision:** В чем фундаментальная причина проблемы и почему выбранная архитектура исключает техдолг.
2. **Assumptions & Blind Spots:** Явный список допущений о частях системы, которые не попали в этот промпт (CLI-агент обязан проверить каждый пункт по файловой системе перед стартом).
3. **Data Contracts & Interfaces:** Точные определения всех новых и изменяемых типов, схем и сигнатур (включая интерфейс `LiveToolDefinition`, `ToolExecutionContext`, `ToolExecutionResult`).
4. **Atomic Execution Plan:** Пошаговая инструкция для CLI-агента. Для каждого шага укажи:
   - Целевой файл (`path/to/file`).
   - Действие (`CREATE` / `MODIFY` / `DELETE`) и точная реализация.
   - Команда локальной верификации шага (конкретная команда запуска теста, линтера или компилятора).
</required_output_contract>
