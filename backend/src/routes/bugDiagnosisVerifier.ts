import { TutorActiveContext, TutorVerifyDiagnosisResponse } from '@interview-prep/shared';
import { envConfig } from '../config/env';
import { db } from '../services/db';
import { llmGateway } from '../services/LlmGatewayClient';
import { TreeEditDistanceGuard } from '../services/sandbox/TreeEditDistanceGuard';
import { createDefaultToolPersistencePort } from '../services/live/LiveToolExecutor';

/**
 * bugDiagnosisVerifier.ts
 * Spec 62 SSOT backend helper for SQLite Bug Hunt ground-truth hydration
 * and semantic root-cause verification (`POST /api/practice-tutor/verify-diagnosis`).
 * File length limit: <= 180 lines (Rule 8).
 */

export interface BugGroundTruthRow {
  id: string;
  title: string;
  topicId: string;
  topicName: string;
  language: string;
  codeSnippet: string;
  bugExplanation: string;
  fixedCode: string;
  isSolved: boolean;
}

export function getBugChallengeGroundTruth(bugId: string): BugGroundTruthRow | null {
  if (!bugId || !bugId.trim()) return null;
  try {
    const row = db
      .prepare(
        `SELECT id, title, topic_id, topic_name, language, code_snippet, bug_explanation, fixed_code, is_solved
         FROM bug_challenges WHERE id = ? LIMIT 1`
      )
      .get(bugId.trim()) as any;
    if (!row) return null;
    return {
      id: String(row.id),
      title: String(row.title || ''),
      topicId: String(row.topic_id || ''),
      topicName: String(row.topic_name || ''),
      language: String(row.language || 'java'),
      codeSnippet: String(row.code_snippet || ''),
      bugExplanation: String(row.bug_explanation || ''),
      fixedCode: String(row.fixed_code || ''),
      isSolved: Boolean(row.is_solved)
    };
  } catch (err) {
    console.warn('[bugDiagnosisVerifier] Failed to read bug_challenges ground truth:', err);
    return null;
  }
}

function extractDiagnosisVerdictJson(rawText: string): {
  verdict: 'solved' | 'partial' | 'incorrect';
  feedback: string;
} {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const tryParse = (str: string) => {
    const parsed = JSON.parse(str);
    const rawVerdict = String(parsed?.verdict || '').toLowerCase();
    const verdict: 'solved' | 'partial' | 'incorrect' =
      rawVerdict === 'solved' || rawVerdict === 'partial' || rawVerdict === 'incorrect'
        ? rawVerdict
        : parsed?.isCorrect === true
        ? 'solved'
        : 'partial';
    const feedback = typeof parsed?.feedback === 'string' && parsed.feedback.trim().length > 0
      ? parsed.feedback.trim()
      : cleaned;
    return { verdict, feedback };
  };

  try {
    return tryParse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return tryParse(match[0]);
      } catch {
        // Fallback conservatively without falsely granting solved
      }
    }
    return {
      verdict: 'partial',
      feedback: cleaned || 'Уточните точную строку сбоя и механику возникновения дефекта.'
    };
  }
}

export interface VerifyBugDiagnosisParams {
  bugId: string;
  diagnosis: string;
  context: TutorActiveContext;
  userId?: string;
  abortSignal?: AbortSignal;
}

export async function verifyBugDiagnosisOutcome(
  params: VerifyBugDiagnosisParams
): Promise<{ notFound: true } | { notFound: false; result: TutorVerifyDiagnosisResponse }> {
  const groundTruth = getBugChallengeGroundTruth(params.bugId);
  const code = groundTruth?.codeSnippet || params.context.activeCodeOrQuery || '';

  if (!groundTruth && !code.trim()) {
    return { notFound: true };
  }

  const systemPrompt = `Ты — Principal Java/Spring Engineer и строгий проверяющий корневых причин продакшен-инцидентов.
Оцени диагноз кандидата объективно и верни СТРОГО валидный JSON без пояснений вне JSON:
{
  "verdict": "solved" | "partial" | "incorrect",
  "feedback": "Краткий и точный технический разбор на русском (2-4 предложения)"
}

КРИТЕРИИ:
- "solved": кандидат точно назвал корневую причину дефекта и объяснил механику сбоя.
- "partial": кандидат верно указал метод/участок или побочный симптом, но не вскрыл первопричину.
- "incorrect": гипотеза ошибочна или касается косметического рефакторинга.
CRITICAL ANTI-SPOILER: Если verdict !== "solved", КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО приводить исправленный код (fixed_code) в feedback!`;

  const userPrompt = `ЗАДАЧА: ${groundTruth?.title || params.context.entityTitle}
ТЕМА: ${groundTruth?.topicName || params.context.domain}
БАЖНЫЙ КОД:
\`\`\`${groundTruth?.language || 'java'}
${code}
\`\`\`
${groundTruth?.bugExplanation ? `ЭТАЛОННАЯ ПРИЧИНА БАГА:\n${groundTruth.bugExplanation}\n` : ''}
${groundTruth?.fixedCode ? `ЭТАЛОННЫЙ ФИКС (НЕ СПОЙЛЕРИТЬ ПРИ ПРОВАЛЕ):\n${groundTruth.fixedCode}\n` : ''}
${params.context.cursorLine ? `ВЫДЕЛЕННАЯ КАНДИДАТОМ СТРОКА: ${params.context.cursorLine}\n` : ''}
${params.context.selectedCodeSnippet ? `ВЫДЕЛЕННЫЙ ФРАГМЕНТ:\n${params.context.selectedCodeSnippet}\n` : ''}
ДИАГНОЗ КАНДИДАТА:
"""
${params.diagnosis}
"""`;

  const rawResponse = await llmGateway.completeText({
    systemPrompt,
    userPrompt,
    model: envConfig.models.text,
    temperature: 0.1,
    maxTokens: 500,
    presetKey: 'deepIncidentSynthesis',
    abortSignal: params.abortSignal
  });

  const parsed = extractDiagnosisVerdictJson(rawResponse);
  let feedback = parsed.feedback;

  if (parsed.verdict !== 'solved' && groundTruth?.fixedCode) {
    const guarded = TreeEditDistanceGuard.guardResponse(feedback, [groundTruth.fixedCode], {
      leakThreshold: 0.40,
      isSocraticEnforced: true
    });
    feedback = guarded.redactedText;
  }

  let fsrsRecorded = false;
  if (parsed.verdict === 'solved' && groundTruth?.id) {
    await createDefaultToolPersistencePort().updateBugSolved({
      challengeId: groundTruth.id,
      status: 'solved',
      decayedTopic: groundTruth.topicName || params.context.domain || 'General',
      userId: params.userId || 'anonymous',
      isSolved: true,
      score: 100,
      feedback,
      assistanceLevel: 'solo'
    });
    fsrsRecorded = true;
  }

  return {
    notFound: false,
    result: {
      verdict: parsed.verdict,
      isCorrect: parsed.verdict === 'solved',
      feedback,
      revealedExplanation: parsed.verdict === 'solved' && groundTruth?.bugExplanation
        ? groundTruth.bugExplanation
        : undefined,
      fsrsRecorded
    }
  };
}
