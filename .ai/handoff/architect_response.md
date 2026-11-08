# Архитектурная реорганизация движка инструментов Gemini Live

**Date**: November 1, 2026 at 02:33 AM
**Turns**: 1
**Source**: [Gemini Chat](https://gemini.google.com/app/e7c66f73a896c55b)

---

## Turn 1

### 🤖 ИИ Ассистент

# Архитектурная спецификация: Унификация пайплайна инструментов Gemini Live (`LiveToolEngine` & `workspaceManifestStore`)

## 1. Root Cause & Architecture Decision

### Фундаментальная причина проблемы (Root Cause)
Текущая реализация обработки вызовов инструментов (`toolCall.functionCalls`) страдает от антипаттерна **Shallow Pass-Through Module Chain** в сочетании с **Protocol Leakage**:

1. **Размытая ответственность слоев:** Вызов инструмента проходит через цепочку `liveAudioStreamRouter` → `LiveToolCallExecutor` → `liveToolDispatcher` → `live*ToolDispatcher`. При этом ни один из промежуточных слоев не инкапсулирует сериализацию протокола Gemini Live Bidi.
2. **Утечка сокетного транспорта в доменную логику:** Каждый из 5 файлов диспетчеров принимает сырые экземпляры `WebSocket` (`geminiSocket`, `clientSocket`) и вручную конструирует JSON-ответы `toolResponse.functionResponses`. Это привело к расхождению схем:
  - `liveRefactoringToolDispatcher.ts` пропускает обязательное поле `name`, использует нестандартный ключ `response.output` вместо `response.result`, не задает `scheduling` и отправляет фрейм без проверки `geminiSocket.readyState === WebSocket.OPEN`, что вызывает разрыв апстрим-соединения Gemini Live с кодами `1008` (Policy Violation) и `1011` (Internal Error).
  - `read_file` дублирует полезную нагрузку одновременно в `response.output` и `response.result`.
3. **Фрагментация инвариантов безопасности и идемпотентности:**
  - **Инвариант 2.1 (Turn 0 Tool Lockdown)** продублирован вручную в `liveEvaluationToolDispatcher.ts` и `liveSystemDesignToolDispatcher.ts` (причем в обоих случаях в ответе об ошибке пропущено поле `name` и `scheduling`), но полностью забыт в `liveHrToolDispatcher.ts` (`submit_hr_evaluation`, `emit_hr_round_evaluation`).
  - **Окно идемпотентности (Deduplication Window)** захардкожено условным оператором `if (call.name === 'update_whiteboard')` внутри `LiveToolCallExecutor.ts`.
4. **Нарушение связности (Low Cohesion) в `liveToolDispatcher.ts`:** Модуль диспетчеризации инструментов хранит функции управления состоянием файлов рабочей области (`matchWorkspaceFilePath`, `applyWorkspaceFileUpdate`, `mergeWorkspaceManifests`), заставляя транспортные обработчики клиентских фреймов (`liveWsClientFrameHandler.ts`, `liveWsChallengeResolver.ts`) зависеть от диспетчера инструментов.

### Архитектурное решение

1. **Глубокий модуль `LiveToolEngine` (`backend/src/services/live/LiveToolEngine.ts`):** Заменяет связку `LiveToolCallExecutor` + `liveToolDispatcher`. Движок полностью берет на себя:
  - Управление жизненным циклом выполнения (`session.isToolCallPending`, `toolCallSafetyTimeout`, сброс `nudgeWatchdog`, клиентские уведомления `tool_executing` / `tool_execution_complete`, обработка `toolCallCancellation`).
  - Декларативную проверку инвариантов до вызова обработчика: **Turn 0 Lockdown** (`isGatedOnTurn0`) и **Idempotency Window** (`dedupWindowMs`).
  - Единообразную сериализацию ответа в канонический формат Gemini Live Bidi (`id`, `name`, `response: { result }` или `response: { error }`, `scheduling: 'WHEN_IDLE' | 'SILENT'`) и отправку клиентских событий в `clientSocket`.
2. **Чистый шов обработчиков (`Pure Tool Handlers`):** Обработчики инструментов не имеют доступа к `WebSocket` и не импортируют пакет `ws`. Их контракт чист: `(args, ctx) => Promise<ToolExecutionResult> | ToolExecutionResult`.
3. **Изоляция манифеста рабочей области (`backend/src/services/live/workspaceManifestStore.ts`):** Все операции сопоставления путей, обновления файлов в памяти сессии и слияния манифестов выносятся в независимый модуль без зависимостей от сокетов, БД или инструментов.

## 2. Assumptions & Blind Spots (Чек-лист верификации перед стартом)
Перед внесением изменений CLI-агент обязан проверить следующие допущения в локальной файловой системе:

1. **Точки импорта в `liveWsChallengeResolver.ts` и `geminiLiveProxy.ts`:**
  - В промпте отсутствуют полные тела `backend/src/services/live/liveWsChallengeResolver.ts` и `backend/src/services/geminiLiveProxy.ts`.
  - *Действие:* Выполнить `grep -rn "liveToolDispatcher\|LiveToolCallExecutor\|liveRefactoringToolDispatcher" backend/src/` и убедиться, что все реэкспорты и импорты учтены.
2. **Существующие unit/integration тесты:**
  - В `backend/src/` или `backend/tests/` могут находиться тесты, импортирующие `LiveToolCallExecutor`, `handleLiveToolCall` или функции манифеста из `./liveToolDispatcher`.
  - *Действие:* Найти такие тесты через `grep -rn "liveToolDispatcher\|LiveToolCallExecutor" backend/` и обновить пути импорта на `LiveToolEngine` и `workspaceManifestStore`.
3. **Схемы деклараций инструментов (`liveToolDeclarations.ts`):**
  - Предполагается, что `liveToolDeclarations.ts` (366 строк) содержит только JSON-схемы для Gemini setup-сообщения и не импортирует диспетчеры.
  - *Действие:* Проверить импорты в `backend/src/services/live/liveToolDeclarations.ts`.

## 3. Data Contracts & Interfaces

### 3.1. Контракты движка инструментов (`backend/src/services/live/LiveToolEngine.ts`)

```typescript
import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';

export type ToolScheduling = 'WHEN_IDLE' | 'SILENT';

export interface GeminiFunctionCall {
  id: string;
  name: string;
  args?: Record<string, any>;
}

/**
 * Контекст, передаваемый в чистый обработчик инструмента.
 * Обработчик НЕ имеет доступа к WebSocket-инстансам.
 */
export interface ToolExecutionContext {
  callId: string;
  toolName: string;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

/**
 * Произвольное событие для отправки в браузер кандидата через clientSocket.
 * Сохраняет 100% обратную совместимость как с событиями с полем `payload`,
 * так и с плоскими событиями (`smell_discovered`, `hiring_committee_verdict`, `evaluation_completed`).
 */
export interface ClientWsEvent {
  type: string;
  payload?: any;
  [key: string]: any;
}

/**
 * Возвращаемое значение чистого обработчика инструмента.
 */
export interface ToolExecutionResult {
  result?: Record<string, any>;
  error?: string;
  clientEvent?: ClientWsEvent;
  scheduling?: ToolScheduling;
}

export type PureToolHandler = (
  args: Record<string, any>,
  ctx: ToolExecutionContext
) => Promise<ToolExecutionResult> | ToolExecutionResult;

/**
 * Декларативное описание инструмента в реестре LiveToolEngine.
 */
export interface LiveToolDefinition {
  name: string;
  handler: PureToolHandler;
  scheduling: ToolScheduling;
  /** Если true, вызов блокируется при !session.hasCandidateResponded (Invariant 2.1) */
  isGatedOnTurn0?: boolean;
  /** Кастомный текст ошибки для модели при нарушении Turn 0 Lockdown */
  turn0ErrorMessage?: string;
  /** Окно дедупликации идентичных вызовов (в мс) */
  dedupWindowMs?: number;
  /** Результат, возвращаемый модели при срабатывании дедупликации */
  dedupResponseResult?: Record<string, any>;
}

export interface ToolExecutorOptions {
  functionCalls: GeminiFunctionCall[];
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

```

### 3.2. Расширение состояния сессии (`backend/src/services/live/liveSessionTypes.ts`)
В интерфейс `ProxySession` добавляется типизированный кэш дедупликации (с сохранением `lastToolCallHash` и `lastToolCallTime` для обратной совместимости):

```typescript
  lastToolCallHash?: string;
  lastToolCallTime?: number;
  toolDedupCache?: Record<string, { hash: string; timestamp: number }>;

```

## 4. Atomic Execution Plan
Выполняй шаги строго последовательно. После каждого шага проверяй лимит строк (`wc -l`) и на финальном шаге — полную компиляцию TypeScript.

### Шаг 1: Предварительная разведка импортов
**Действие:** Проверить все вхождения старых модулей в кодовой базе.**Команда верификации:**

```bash
grep -rnE "liveToolDispatcher|LiveToolCallExecutor|liveRefactoringToolDispatcher|liveEvaluationToolDispatcher|liveHrToolDispatcher|liveSystemDesignToolDispatcher" backend/src/

```

### Шаг 2: Выделение доменного модуля манифеста рабочей области
**Целевой файл:** `backend/src/services/live/workspaceManifestStore.ts`**Действие:** `CREATE` (~135 строк, лимит ≤ 350 строк)

```typescript
import { ProxySession } from './liveSessionTypes';

/**
 * workspaceManifestStore.ts
 * Чистые функции управления состоянием файлов рабочей области в памяти сессии.
 * Не содержит зависимостей от WebSocket, БД или диспетчеров инструментов.
 */

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
  const isActive =
    matchWorkspaceFilePath(session.workspaceManifest.activeFile?.path, trimmedPath) ||
    !session.workspaceManifest.activeFile;
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

```
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/workspaceManifestStore.ts

```

### Шаг 3: Обновление типов сессии в `liveSessionTypes.ts`
**Целевой файл:** `backend/src/services/live/liveSessionTypes.ts`**Действие:** `MODIFY` (~111 строк, лимит ≤ 400 строк). Добавить поле `toolDedupCache?: Record<string, { hash: string; timestamp: number }>;` в `ProxySession` рядом с `lastToolCallTime?: number;`.
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/liveSessionTypes.ts

```

### Шаг 4: Создание чистых обработчиков базовых инструментов рабочей области и рефакторинга
**Целевой файл:** `backend/src/services/live/liveWorkspaceHandlers.ts`**Действие:** `CREATE` (~165 строк, лимит ≤ 350 строк). Инкапсулирует чистые обработчики для `update_whiteboard`, `read_file`, `mark_bug_solved` и `report_identified_smell` без единого импорта `ws`.

```typescript
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

```
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/liveWorkspaceHandlers.ts

```

### Шаг 5: Перевод `liveEvaluationToolDispatcher.ts` на чистый контракт без WebSocket
**Целевой файл:** `backend/src/services/live/liveEvaluationToolDispatcher.ts`**Действие:** `MODIFY` (~235 строк, лимит ≤ 400 строк). Удалить импорт `ws`, ручную проверку `!session.hasCandidateResponded` (перенесена в `LiveToolEngine`) и прямые вызовы `geminiSocket.send` / `clientSocket.send`.

```typescript
import { db } from '../db';
import { applyKnowledgeDecay, recordNewErrorGap } from '../vectorMemoryService';
import { recordEvaluationAndSyncProgress } from '../progressService';
import { calculateFaangScorecard } from '../../prompts/personas';
import { buildWeightedRubric } from './livePromptBuilder';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolEngine';

export async function handleSubmitInterviewEvaluation(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { session, liveCoaching } = ctx;

  const score = typeof args.score === 'number' ? Math.max(0, Math.min(100, Math.round(args.score))) : 70;
  const isPassed = typeof args.isPassed === 'boolean' ? args.isPassed : score >= 70;
  const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
  const missingPoints = Array.isArray(args.missingPoints) ? [...args.missingPoints] : [];
  const feedback = typeof args.spokenFeedback === 'string' ? args.spokenFeedback : 'Ответ принят.';
  const questionType = args.questionType || 'definitional';
  const speechCoaching = args.speechCoaching || null;

  const rawCriteriaBreakdown = Array.isArray(args.criteriaBreakdown) ? args.criteriaBreakdown : [];
  const rawDeductions = Array.isArray(args.deductions) ? args.deductions : [];
  const upgradeSnippet = typeof args.upgradeSnippet === 'string' ? args.upgradeSnippet : '';

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
    persona: (session.persona as any) || 'mentor',
    targetGrade: session.targetGrade || 'L5_SENIOR',
    positivePoints,
    missingPoints,
    questionType
  });

  const faangScorecard = args.faangScorecard
    ? {
        ...calculatedScorecard,
        ...args.faangScorecard,
        dimensionScores: {
          ...calculatedScorecard.dimensionScores,
          ...(args.faangScorecard.dimensionScores || {})
        }
      }
    : calculatedScorecard;

  let savedEvalId = '';
  if (session.questionId) {
    try {
      const mem = session.sessionId ? getOrCreateSessionMemory(session.sessionId, session.questionId || '') : null;
      const dialogueTranscript =
        mem && mem.turns && mem.turns.length > 0
          ? mem.turns.map((t) => `${t.role === 'user' ? 'Кандидат' : 'Интервьюер'}: ${t.text}`).join('\n\n')
          : session.turnTelemetryHistory && session.turnTelemetryHistory.length > 0
            ? session.turnTelemetryHistory.map((t) => `Turn ${t.turnIndex} (${t.speaker}): duration ${t.speechDurationMs}ms`).join('\n')
            : 'Устный диалог в Gemini Live';

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

  console.log('✅ Evaluation prepared for delivery to client. Keeping session lifeline open for Q&A and transition.');

  return {
    result: {
      success: true,
      saved: true,
      score,
      isPassed,
      evaluationId: savedEvalId,
      message: 'Оценка сохранена в ведомость.',
      directive: 'Кратко подведи итог (1-2 предложения), поблагодари за ответ и назови вердикт. Не молчи.'
    },
    clientEvent: {
      type: 'evaluation_completed',
      evaluation: evaluationPayload,
      payload: evaluationPayload
    },
    scheduling: 'WHEN_IDLE'
  };
}

```
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/liveEvaluationToolDispatcher.ts

```

### Шаг 6: Перевод `liveSystemDesignToolDispatcher.ts` на чистый контракт без WebSocket
**Целевой файл:** `backend/src/services/live/liveSystemDesignToolDispatcher.ts`**Действие:** `MODIFY` (~105 строк, лимит ≤ 400 строк). Удалить импорт `ws`, ручной Turn 0 Guard и вызовы сокетов. Экспортировать три чистых обработчика.

```typescript
import { db } from '../db';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolEngine';

export function handleInjectChaosFailure(
  args: Record<string, any>
): ToolExecutionResult {
  const failureType = args.failure_type || 'ASYMMETRIC_NETWORK_PARTITION';
  const targetId = args.target_component_id || 'primary_db';
  const context = args.technical_context || 'Инъекция аппаратного или сетевого сбоя на узле.';

  console.log(`💥 Chaos Injected by Gemini Live: [${failureType}] on "${targetId}": ${context}`);

  return {
    result: {
      status: 'INJECTED',
      failureType,
      targetComponentId: targetId,
      message: `Сбой [${failureType}] успешно активирован на компоненте ${targetId}.`
    },
    clientEvent: {
      type: 'chaos_injected',
      payload: {
        failureType,
        targetComponentId: targetId,
        technicalContext: context,
        timestamp: Date.now()
      }
    },
    scheduling: 'WHEN_IDLE'
  };
}

export function handleRecordCandidateObservation(
  args: Record<string, any>
): ToolExecutionResult {
  console.log(`👁️ Candidate Observation Recorded: [${args.signal}] ${args.dimension} -> ${args.demonstrated_level}`);

  return {
    result: {
      status: 'RECORDED',
      message: 'Наблюдение зафиксировано в протоколе комитета найма.'
    },
    clientEvent: {
      type: 'candidate_observation_recorded',
      observation: args,
      timestamp: Date.now()
    },
    scheduling: 'WHEN_IDLE'
  };
}

export function handleSubmitHiringCommitteeVerdict(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
  const targetLevel = args.target_level || 'L6';
  const calibratedLevel = args.calibrated_level || 'L5';
  const verdict = args.verdict || 'NO_HIRE';
  const scores = args.scores || {
    exploration: 3.0,
    architecture: 3.0,
    deep_dives: 2.5,
    operational_excellence: 2.8
  };
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

  return {
    result: {
      status: 'COMMITTED',
      verdict,
      calibratedLevel,
      message: 'Вердикт калибровочного комитета официально зарегистрирован.'
    },
    clientEvent: {
      type: 'hiring_committee_verdict',
      submissionId,
      packet,
      timestamp: Date.now()
    },
    scheduling: 'WHEN_IDLE'
  };
}

```
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/liveSystemDesignToolDispatcher.ts

```

### Шаг 7: Перевод `liveHrToolDispatcher.ts` на чистый контракт без WebSocket
**Целевой файл:** `backend/src/services/live/liveHrToolDispatcher.ts`**Действие:** `MODIFY` (~125 строк, лимит ≤ 400 строк). Удалить импорт `ws` и вызовы сокетов. Экспортировать три чистых обработчика (`handleAdvanceHrPhase`, `handleEmitHrRoundEvaluation`, `handleSubmitHrEvaluation`).

```typescript
import { HR_VOICE_EVENTS, HrScorecard } from '@interview-prep/shared';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolEngine';

export function handleAdvanceHrPhase(
  args: Record<string, any>
): ToolExecutionResult {
  const fromPhase = args.fromPhase || 'unknown';
  const toPhase = args.toPhase || 'next_phase';
  const phaseSummary = args.phaseSummary || 'Фаза завершена.';

  console.log(`🧭 [HR_FSM] Phase transition requested: "${fromPhase}" -> "${toPhase}" (Summary: ${phaseSummary.slice(0, 80)}...)`);

  return {
    result: {
      status: 'SUCCESS',
      message: `Фаза успешно переключена на ${toPhase}.`,
      directive: `Ты перешла к фазе ${toPhase}. Задай следующий вопрос кандидату естественным речевым потоком согласно твоей роли рекрутера.`
    },
    clientEvent: {
      type: HR_VOICE_EVENTS.HR_PHASE_TRANSITION,
      payload: {
        fromPhase,
        toPhase,
        phaseSummary,
        timestamp: Date.now()
      }
    },
    scheduling: 'SILENT'
  };
}

export function handleEmitHrRoundEvaluation(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
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

  return {
    result: {
      status: 'SUCCESS',
      message: 'Оценка зафиксирована в системе.',
      directive:
        'Озвучь кандидату краткий вердикт голосом (СТРОГО НЕ БОЛЕЕ 15-20 СЕКУНД!). Сфокусируйся на 1-2 главных ошибках или похвали за точность, если балл >= 85. Предложи повторить дубль или перейти дальше.'
    },
    clientEvent: {
      type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
      payload: scorecard
    },
    scheduling: 'SILENT'
  };
}

export function handleSubmitHrEvaluation(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
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

  return {
    result: {
      status: 'SUCCESS',
      message: 'Сводный отчет по скринингу сформирован.',
      directive: 'Поблагодари кандидата за созвон, озвучь итоговое впечатление в 1-2 предложениях и попрощайся.'
    },
    clientEvent: {
      type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
      payload: scorecard
    },
    scheduling: 'SILENT'
  };
}

```
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/liveHrToolDispatcher.ts

```

### Шаг 8: Создание глубокого модуля `LiveToolEngine.ts`
**Целевой файл:** `backend/src/services/live/LiveToolEngine.ts`**Действие:** `CREATE` (~245 строк, лимит ≤ 350 строк). Централизует реестр всех 11 инструментов с декларативными метаданными, Turn 0 Lockdown, идемпотентность, сериализацию протокола Gemini Live Bidi и отправку клиентских событий.

```typescript
import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import {
  handleUpdateWhiteboard,
  handleReadFile,
  handleMarkBugSolved,
  handleReportIdentifiedSmell
} from './liveWorkspaceHandlers';
import { handleSubmitInterviewEvaluation } from './liveEvaluationToolDispatcher';
import {
  handleInjectChaosFailure,
  handleRecordCandidateObservation,
  handleSubmitHiringCommitteeVerdict
} from './liveSystemDesignToolDispatcher';
import {
  handleAdvanceHrPhase,
  handleEmitHrRoundEvaluation,
  handleSubmitHrEvaluation
} from './liveHrToolDispatcher';

export type ToolScheduling = 'WHEN_IDLE' | 'SILENT';

export interface GeminiFunctionCall {
  id: string;
  name: string;
  args?: Record<string, any>;
}

export interface ToolExecutionContext {
  callId: string;
  toolName: string;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

export interface ClientWsEvent {
  type: string;
  payload?: any;
  [key: string]: any;
}

export interface ToolExecutionResult {
  result?: Record<string, any>;
  error?: string;
  clientEvent?: ClientWsEvent;
  scheduling?: ToolScheduling;
}

export type PureToolHandler = (
  args: Record<string, any>,
  ctx: ToolExecutionContext
) => Promise<ToolExecutionResult> | ToolExecutionResult;

export interface LiveToolDefinition {
  name: string;
  handler: PureToolHandler;
  scheduling: ToolScheduling;
  isGatedOnTurn0?: boolean;
  turn0ErrorMessage?: string;
  dedupWindowMs?: number;
  dedupResponseResult?: Record<string, any>;
}

export interface ToolExecutorOptions {
  functionCalls: GeminiFunctionCall[];
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  session: ProxySession;
  parsedHints: string[];
  liveCoaching: boolean;
}

const DEFAULT_TURN0_ERROR =
  'Кандидат еще не отвечал на вопрос. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку на этапе первого приветствия. Пожалуйста, поприветствуйте кандидата голосом, четко зачитайте вопрос и передайте слово.';

const SD_TURN0_ERROR =
  'Кандидат еще не защищал архитектуру. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выносить вердикт на этапе первого хода. Пожалуйста, поприветствуйте кандидата голосом, сформулируйте задачу и пригласите обсудить функциональные требования.';

const TOOL_DEFINITIONS: LiveToolDefinition[] = [
  {
    name: 'update_whiteboard',
    handler: handleUpdateWhiteboard,
    scheduling: 'WHEN_IDLE',
    dedupWindowMs: 3000,
    dedupResponseResult: {
      status: 'SUCCESS',
      message: 'Интерактивная доска уже обновлена.',
      directive:
        'Кратко (в 1-2 предложениях) поясни кандидату голосом показанный фрагмент. Не вызывай повторных инструментов.'
    }
  },
  {
    name: 'read_file',
    handler: handleReadFile,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'mark_bug_solved',
    handler: handleMarkBugSolved,
    scheduling: 'SILENT'
  },
  {
    name: 'report_identified_smell',
    handler: handleReportIdentifiedSmell,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'submit_interview_evaluation',
    handler: handleSubmitInterviewEvaluation,
    scheduling: 'WHEN_IDLE',
    isGatedOnTurn0: true,
    turn0ErrorMessage: DEFAULT_TURN0_ERROR
  },
  {
    name: 'inject_chaos_failure',
    handler: handleInjectChaosFailure,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'record_candidate_observation',
    handler: handleRecordCandidateObservation,
    scheduling: 'WHEN_IDLE'
  },
  {
    name: 'submit_hiring_committee_verdict',
    handler: handleSubmitHiringCommitteeVerdict,
    scheduling: 'WHEN_IDLE',
    isGatedOnTurn0: true,
    turn0ErrorMessage: SD_TURN0_ERROR
  },
  {
    name: 'advance_hr_phase',
    handler: handleAdvanceHrPhase,
    scheduling: 'SILENT'
  },
  {
    name: 'emit_hr_round_evaluation',
    handler: handleEmitHrRoundEvaluation,
    scheduling: 'SILENT',
    isGatedOnTurn0: true,
    turn0ErrorMessage: DEFAULT_TURN0_ERROR
  },
  {
    name: 'submit_hr_evaluation',
    handler: handleSubmitHrEvaluation,
    scheduling: 'SILENT',
    isGatedOnTurn0: true,
    turn0ErrorMessage: DEFAULT_TURN0_ERROR
  }
];

export const LIVE_TOOL_REGISTRY: ReadonlyMap<string, LiveToolDefinition> = new Map(
  TOOL_DEFINITIONS.map((def) => [def.name, def])
);

export class LiveToolEngine {
  private static sendGeminiToolResponse(
    geminiSocket: WebSocket,
    callId: string,
    toolName: string,
    payload: { result?: Record<string, any>; error?: string },
    scheduling: ToolScheduling = 'WHEN_IDLE'
  ): void {
    if (geminiSocket.readyState !== WebSocket.OPEN) return;

    const responseBody = payload.error
      ? { error: payload.error }
      : { result: payload.result ?? { status: 'SUCCESS' } };

    geminiSocket.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              id: callId,
              name: toolName,
              response: responseBody,
              scheduling
            }
          ]
        }
      })
    );
  }

  private static sendClientEvent(clientSocket: WebSocket, event: ClientWsEvent): void {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify(event));
    }
  }

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

    this.sendClientEvent(clientSocket, {
      type: 'tool_executing',
      tools: functionCalls.map((fc) => fc.name)
    });

    for (const call of functionCalls) {
      const definition = LIVE_TOOL_REGISTRY.get(call.name);

      if (!definition) {
        console.warn(`⚠️ Unhandled or unsupported tool call [${call.name}]. Emitting graceful negative toolResponse.`);
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          {
            result: {
              error: `Tool '${call.name}' is not supported in this session. Please explain verbally or use update_whiteboard.`
            }
          },
          'WHEN_IDLE'
        );
        continue;
      }

      // 1. Central Invariant 2.1: Turn 0 Tool Lockdown
      if (definition.isGatedOnTurn0 && !session.hasCandidateResponded) {
        console.warn(`🛡️ [First-Turn Guard] Blocked premature ${call.name} before candidate spoke.`);
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          { error: definition.turn0ErrorMessage || DEFAULT_TURN0_ERROR },
          'WHEN_IDLE'
        );
        continue;
      }

      // 2. Central Declarative Deduplication Window
      if (definition.dedupWindowMs && definition.dedupWindowMs > 0) {
        const callKey = JSON.stringify(call.args || {});
        const now = Date.now();
        if (!session.toolDedupCache) session.toolDedupCache = {};
        const cached = session.toolDedupCache[call.name];
        const isDuplicate =
          (cached && cached.hash === callKey && now - cached.timestamp < definition.dedupWindowMs) ||
          (call.name === 'update_whiteboard' &&
            session.lastToolCallHash === callKey &&
            now - (session.lastToolCallTime || 0) < definition.dedupWindowMs);

        if (isDuplicate) {
          console.log(`🔄 Suppressing duplicate ${call.name} call within ${definition.dedupWindowMs}ms`);
          this.sendGeminiToolResponse(
            geminiSocket,
            call.id,
            call.name,
            { result: definition.dedupResponseResult || { status: 'SUCCESS', deduplicated: true } },
            definition.scheduling
          );
          continue;
        }

        session.toolDedupCache[call.name] = { hash: callKey, timestamp: now };
        session.lastToolCallHash = callKey;
        session.lastToolCallTime = now;
      }

      // 3. Execute Pure Domain Handler
      try {
        const outcome = await definition.handler(call.args || {}, {
          callId: call.id,
          toolName: call.name,
          session,
          parsedHints,
          liveCoaching
        });

        const scheduling = outcome.scheduling || definition.scheduling || 'WHEN_IDLE';
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          { result: outcome.result, error: outcome.error },
          scheduling
        );

        if (outcome.clientEvent) {
          this.sendClientEvent(clientSocket, outcome.clientEvent);
        }
      } catch (toolErr) {
        const errorMessage = toolErr instanceof Error ? toolErr.message : 'Internal error';
        console.error(`❌ Error executing tool ${call.name}:`, toolErr);
        this.sendGeminiToolResponse(
          geminiSocket,
          call.id,
          call.name,
          { result: { error: `Tool execution failed: ${errorMessage}` } },
          'WHEN_IDLE'
        );
      }
    }

    session.isToolCallPending = false;
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
    this.sendClientEvent(clientSocket, {
      type: 'tool_execution_complete',
      tools: functionCalls.map((fc) => fc.name)
    });
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

```
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/LiveToolEngine.ts

```

### Шаг 9: Переключение точек вызова (`liveAudioStreamRouter.ts`, `liveWsClientFrameHandler.ts`, `liveWsChallengeResolver.ts`, `geminiLiveProxy.ts`)
**Действие:** `MODIFY`

1. **`backend/src/services/live/liveAudioStreamRouter.ts` (373 строки):**
  - Заменить импорт `import { LiveToolCallExecutor } from './LiveToolCallExecutor';` на:
    ```typescript
    import { LiveToolEngine } from './LiveToolEngine';
    
    ```
  - В блоках `3. Tool Call Cancellation` и `4. Tool Calls Execution` (строки ~300–316) заменить `LiveToolCallExecutor.handleCancellation` и `LiveToolCallExecutor.executeFunctionCalls` на `LiveToolEngine.handleCancellation` и `LiveToolEngine.executeFunctionCalls`.
2. **`backend/src/services/live/liveWsClientFrameHandler.ts` (395 строк):**
  - Заменить импорт:
    ```typescript
    import { applyWorkspaceFileUpdate, matchWorkspaceFilePath, mergeWorkspaceManifests } from './workspaceManifestStore';
    
    ```
3. **`backend/src/services/live/liveWsChallengeResolver.ts` (244 строки):**
  - Заменить импорт функций манифеста (`applyWorkspaceFileUpdate`, `matchWorkspaceFilePath`, `mergeWorkspaceManifests`) с `./liveToolDispatcher` на `./workspaceManifestStore`.
4. **`backend/src/services/geminiLiveProxy.ts` (56 строк):**
  - Проверить реэкспорты: если файл реэкспортировал символы из `./live/liveToolDispatcher` или `./live/LiveToolCallExecutor`, перенаправить их на `./live/workspaceManifestStore` и `./live/LiveToolEngine`.
**Команда локальной верификации:**

```bash
wc -l backend/src/services/live/liveAudioStreamRouter.ts backend/src/services/live/liveWsClientFrameHandler.ts backend/src/services/live/liveWsChallengeResolver.ts

```

### Шаг 10: Удаление устаревших транзитных модулей (Invariant 8 — Zero Parallel Reimplementations)
**Целевые файлы:**

- `backend/src/services/live/liveRefactoringToolDispatcher.ts` — `DELETE`
- `backend/src/services/live/liveToolDispatcher.ts` — `DELETE`
- `backend/src/services/live/LiveToolCallExecutor.ts` — `DELETE`
*(Примечание для CLI-агента: если на Шаге 1 обнаружены тестовые файлы в `backend/`, импортирующие `LiveToolCallExecutor` или `liveToolDispatcher`, обнови импорты в этих тестах на `LiveToolEngine` и `workspaceManifestStore` перед удалением файлов).*
**Команда выполнения и верификации отсутствия битых ссылок:**

```bash
rm -f backend/src/services/live/liveRefactoringToolDispatcher.ts \
      backend/src/services/live/liveToolDispatcher.ts \
      backend/src/services/live/LiveToolCallExecutor.ts
grep -rnE "liveToolDispatcher|LiveToolCallExecutor|liveRefactoringToolDispatcher" backend/src/ || echo "Clean: zero stale references"

```

### Шаг 11: Финальная верификация инвариантов, лимитов строк и сборки TypeScript
**Действие:** Проверить отсутствие импортов `ws` в обработчиках инструментов, соблюдение Rule 8 (новые файлы ≤ 350 строк, измененные ≤ 400 строк) и чистую компиляцию проекта.
**Команды финальной верификации:**

```bash
# 1. Проверка отсутствия импортов ws в чистых обработчиках и сторе манифеста
grep -rn "from 'ws'" \
  backend/src/services/live/workspaceManifestStore.ts \
  backend/src/services/live/liveWorkspaceHandlers.ts \
  backend/src/services/live/liveEvaluationToolDispatcher.ts \
  backend/src/services/live/liveSystemDesignToolDispatcher.ts \
  backend/src/services/live/liveHrToolDispatcher.ts || echo "Seam check PASSED: zero ws imports in handlers"

# 2. Проверка Cognitive Bounding Limit (Rule 8)
wc -l \
  backend/src/services/live/workspaceManifestStore.ts \
  backend/src/services/live/LiveToolEngine.ts \
  backend/src/services/live/liveWorkspaceHandlers.ts \
  backend/src/services/live/liveEvaluationToolDispatcher.ts \
  backend/src/services/live/liveSystemDesignToolDispatcher.ts \
  backend/src/services/live/liveHrToolDispatcher.ts \
  backend/src/services/live/liveSessionTypes.ts \
  backend/src/services/live/liveAudioStreamRouter.ts \
  backend/src/services/live/liveWsClientFrameHandler.ts \
  backend/src/services/live/liveWsChallengeResolver.ts

# 3. Проверка компиляции TypeScript без сборки Docker
cd backend && npm run build

```

---

*Exported from [Voyager](https://github.com/voyager-crew/voyager)*  
*Generated on November 1, 2026 at 02:33 AM*