import { WebSocket } from 'ws';
import { updateBugChallengeStatus } from '../tutorService';
import { applyKnowledgeDecay } from '../vectorMemoryService';
import { TurnTelemetryEvent } from '@interview-prep/shared';
import { handleEvaluationToolCall } from './liveEvaluationToolDispatcher';
import { handleSystemDesignToolCall } from './liveSystemDesignToolDispatcher';

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
    const normalizedTarget = rawPath.replace(/\\/g, '/');
    const simpleTarget = normalizedTarget.split('/').pop() || normalizedTarget;

    const manifest = (session as any).workspaceManifest;
    let foundContent: string | null = null;

    if (manifest) {
      // 1. Check active file
      if (manifest.activeFile?.path) {
        const p = (manifest.activeFile.path || '').replace(/\\/g, '/');
        if (p === normalizedTarget || p.endsWith(normalizedTarget) || p.endsWith(`/${simpleTarget}`) || p === simpleTarget) {
          foundContent = manifest.activeFile.content;
        }
      }
      // 2. Check secondary files
      if (!foundContent && Array.isArray(manifest.secondaryFiles)) {
        const sec = manifest.secondaryFiles.find((f: any) => {
          const p = (f.path || '').replace(/\\/g, '/');
          return p === normalizedTarget || p.endsWith(normalizedTarget) || p.endsWith(`/${simpleTarget}`) || p === simpleTarget;
        });
        if (sec) foundContent = sec.content;
      }
      // 3. Check generic files array
      if (!foundContent && Array.isArray(manifest.files)) {
        const f = manifest.files.find((file: any) => {
          const p = (file.path || '').replace(/\\/g, '/');
          return p === normalizedTarget || p.endsWith(normalizedTarget) || p.endsWith(`/${simpleTarget}`) || p === simpleTarget;
        });
        if (f) foundContent = f.content;
      }
    }

    // 4. Fallback to session.codeSnippet
    if (!foundContent && (session as any).codeSnippet) {
      foundContent = (session as any).codeSnippet;
    }

    const fileContent = foundContent || `Файл "${rawPath}" не найден в структуре проекта.`;
    console.log(`📂 [READ_FILE] Gemini Live requested: "${rawPath}" (resolved: ${Boolean(foundContent)}, len: ${fileContent.length})`);

    const toolResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              output: {
                filePath: rawPath,
                content: fileContent
              },
              result: {
                filePath: rawPath,
                content: fileContent
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
