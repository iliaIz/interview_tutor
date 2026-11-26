/**
 * CascadedTurnEngine.ts
 * Deep domain module for turn-based interview & tutoring evaluation (SPEC-27).
 * Encapsulates STT, Prompt Injection defense, Epistemic Triage, LLM reasoning via LlmExecutionEngine,
 * TTS speech clamping, and CandidateMemoryAggregate persistence.
 * Cognitive Bounding SLA: <= 350 lines (Rule 8).
 */

import { db } from '../db';
import { envConfig } from '../../config/env';
import { llmGateway } from '../LlmGatewayClient';
import { transcribeWithDeepgram } from '../deepgramService';
import { synthesizeTTSWithRetry } from '../podcast';
import { applyKnowledgeDecay, recordNewErrorGap } from '../vectorMemoryService';
import { getOrCreateSessionMemory } from '../geminiLiveProxy';
import { recordEvaluationAndSyncProgress } from '../progressService';
import {
  InterviewPersonaId,
  TargetGrade,
  getPersonaPromptDirectives,
  calculateFaangScorecard
} from '../../prompts/personas';
import {
  wrapUntrustedContext,
  PROMPT_INJECTION_DEFENSE_DIRECTIVE
} from '../../prompts/core/sandboxDirectives';
import {
  TRIVIA_IMMUNITY_INVARIANT,
  CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES,
  EPISTEMIC_BENEVOLENCE_AXIOM,
  EPISTEMIC_TRIAGE_DIRECTIVE,
  StrictnessLevel,
  getStrictnessDirectives
} from '../../prompts/core/antiSycophancy';
import { sanitizeVoice } from './GreetingSynthesisService';
import { DEFAULT_VOICE_NAME } from '../../config/liveDefaults';
import {
  DeductionItem,
  TurnReasoningResult,
  CascadedTurnInput,
  CascadedTurnResult,
  getSafeSpokenText
} from './turnInterviewTypes';

export {
  DeductionItem,
  TurnReasoningResult,
  CascadedTurnInput,
  CascadedTurnResult,
  getSafeSpokenText
};

export class CascadedTurnEngine {
  public static async executeTurn(input: CascadedTurnInput): Promise<CascadedTurnResult> {
    const {
      sessionId,
      questionId,
      topic = 'Java Core',
      questionText,
      referenceAnswer = '',
      userTranscript: rawTranscript,
      audioBase64,
      pcmBase64,
      history = [],
      turnCount = 1,
      maxProbes = 2,
      strategy = 'socratic_tutoring',
      deepDive = true,
      voice: rawVoice = DEFAULT_VOICE_NAME,
      userGender: rawUserGender = 'female',
      activeCodeArtifact,
      persona = 'mentor',
      targetGrade = 'L5_SENIOR',
      sessionType: rawSessionType = 'interview',
      rawStrictness = 'standard',
      userId = 'default_user',
      abortSignal
    } = input as any;

    const voice = sanitizeVoice(rawVoice);
    const userGender = rawUserGender === 'male' || rawUserGender === 'neutral' ? rawUserGender : 'female';
    const sessionType = rawSessionType === 'tutor' ? 'tutor' : 'interview';
    const strictness: StrictnessLevel = ['learning', 'standard', 'hardcore'].includes(rawStrictness)
      ? (rawStrictness as StrictnessLevel)
      : (sessionType === 'tutor' ? 'learning' : 'standard');
    const strictnessDirective = getStrictnessDirectives(strictness);

    // 1. STT Phase: Transcribe candidate's speech if text not provided
    let candidateText = (rawTranscript || '').trim();
    if (!candidateText && (audioBase64 || pcmBase64)) {
      const pcmBuffer = Buffer.from(audioBase64 || pcmBase64, 'base64');
      if (pcmBuffer.length > 0) {
        try {
          const sttResult = await transcribeWithDeepgram(pcmBuffer, 16000);
          candidateText = sttResult.transcript.trim();
        } catch (sttErr) {
          console.warn('STT failed in CascadedTurnEngine, using fallback:', sttErr);
        }
      }
    }
    if (!candidateText) {
      candidateText = '(Кандидат завершил ответ без звука)';
    }

    if (sessionId && candidateText) {
      const mem = getOrCreateSessionMemory(sessionId, questionId);
      mem.turns.push({ role: 'user', text: candidateText });
      mem.lastSpeaker = 'user';
      mem.updatedAt = Date.now();
    }

    // 2. Reasoning Phase: Build prompts and execute LLM reasoning
    const personaDirectives = getPersonaPromptDirectives({
      persona: persona as InterviewPersonaId,
      targetGrade: targetGrade as TargetGrade,
      topic
    });

    const genderDirective = userGender === 'female'
      ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. В feedback и репликах строго используй ЖЕНСКИЕ окончания в прошедшем времени («Ты отлично раскрыла», «Ты верно отметила», «Ты упустила»).'
      : userGender === 'male'
      ? 'Кандидат — МУЖЧИНА. В feedback используй мужские окончания («Ты отлично раскрыл», «Ты верно отметил»).'
      : 'Обращайся уважительно на «Вы».';

    const activeCodeSection = activeCodeArtifact?.code
      ? `\nАКТИВНЫЙ КОД НА ЭКРАНЕ КАНДИДАТА (${activeCodeArtifact.title || 'Сниппет'}):\n${wrapUntrustedContext('active_code_artifact', activeCodeArtifact.code)}\n`
      : '';

    const isTutorMode = sessionType === 'tutor';

    const decisionRules = isTutorMode
      ? `РЕЖИМ: ОБУЧАЮЩИЙ ТЬЮТОР (TUTOR MODE).
Ты объективный и доброжелательный Senior наставник по теме «${topic}».
Категорически запрещено выставлять оценку или завершать сессию (action: "evaluate").
ВСЕГДА выбирай action: "probe" и давай прямой, емкий ответ или подсказку (строго 2-3 предложения, до 25-35 слов).`
      : `ПРАВИЛА ПРИНЯТИЯ РЕШЕНИЯ (СОБЕСЕДОВАНИЕ):
1. Если кандидат сдается ИЛИ текущий раунд ${turnCount} >= ${maxProbes} ИЛИ ответ достаточно полон:
   -> Выбери action: "evaluate".
2. Если ответ раскрывает только часть критериев или есть неточности, и раундов ${turnCount} < ${maxProbes}:
   -> Выбери action: "probe" и сформулируй ОДИН четкий наводящий вопрос (2-3 предложения).
   -> Помни о TRIVIA IMMUNITY: не снижай оценку, если кандидат объясняет своими словами.`;

    const systemPrompt = `Ты ${personaDirectives.personaTitle} по теме «${topic}».
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

${EPISTEMIC_BENEVOLENCE_AXIOM}

${EPISTEMIC_TRIAGE_DIRECTIVE}

${TRIVIA_IMMUNITY_INVARIANT}

${CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES}

${strictnessDirective}

${personaDirectives.roleDirective}
${personaDirectives.gradeExpectationDirective}
${personaDirectives.evaluationRubricDirective}
${genderDirective}

КОНТЕКСТ ВОПРОСА:
Вопрос: "${questionText}"
Эталонный ответ:
"""${referenceAnswer}"""
${activeCodeSection}
РЕЖИМ РАБОТЫ:
Стратегия: ${strategy}.
Deep Dive: ${deepDive ? 'Включен' : 'Выключен'}.
Текущий раунд: ${turnCount}${isTutorMode ? ' (без лимита)' : ` из ${maxProbes}`}.

${decisionRules}

ФОРМАТ ВЫХОДА — СТРОГО JSON:
Если action == "probe":
{ "action": "probe", "replyText": "..." }
Если action == "evaluate":
{
  "action": "evaluate", "score": number, "isPassed": boolean,
  "deductions": [{ "criterionId": "string", "reason": "...", "penalty": number }],
  "positivePoints": [...], "missingPoints": [...], "feedback": "...", "spokenFeedback": "...",
  "faangScorecard": { "verdict": "...", "calibratedGrade": "...", "dimensionScores": { "domainDepth": 80, ... } }
}
МАТЕМАТИЧЕСКАЯ КАЛИБРОВКА: Сумма штрафов sum(penalty) обязана быть строго равна: 100 - score.`;

    const wrappedCandidateText = wrapUntrustedContext('candidate_transcript', candidateText);
    const conversationTurns: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.map((h: any) => ({
        role: (h.role === 'ai' || h.speaker === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: (h.role === 'ai' || h.speaker === 'ai') ? h.text : wrapUntrustedContext('candidate_transcript', h.text)
      })),
      { role: 'user', content: wrappedCandidateText }
    ];

    const reasoningResult = await llmGateway.completeJson<TurnReasoningResult>({
      messages: conversationTurns,
      model: envConfig.models.fast,
      temperature: 0.3,
      maxTokens: 800,
      abortSignal
    });

    // 3. Audio Synthesis Phase
    const textToVoice = getSafeSpokenText(reasoningResult);
    const { buffer: ttsBuf } = await synthesizeTTSWithRetry(textToVoice, voice);
    const audioBase64Out = ttsBuf.toString('base64');

    if (sessionId && textToVoice) {
      const mem = getOrCreateSessionMemory(sessionId, questionId);
      mem.turns.push({ role: 'model', text: textToVoice });
      mem.lastSpeaker = 'model';
      mem.updatedAt = Date.now();
    }

    // 4. Persistence Phase
    let decayResult = null;
    let progressSummary = null;
    let faangScorecard = null;

    if (reasoningResult.action === 'evaluate') {
      const calculatedScorecard = calculateFaangScorecard({
        score: reasoningResult.score || 0,
        persona: (persona as InterviewPersonaId) || 'mentor',
        targetGrade: (targetGrade as TargetGrade) || 'L5_SENIOR',
        positivePoints: reasoningResult.positivePoints || [],
        missingPoints: reasoningResult.missingPoints || []
      });

      faangScorecard = (reasoningResult.faangScorecard && reasoningResult.faangScorecard.dimensionScores)
        ? {
            ...calculatedScorecard,
            ...reasoningResult.faangScorecard,
            dimensionScores: {
              ...calculatedScorecard.dimensionScores,
              ...reasoningResult.faangScorecard.dimensionScores
            }
          }
        : calculatedScorecard;

      if (questionId && topic) {
        try {
          const questionExists = db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId);
          if (questionExists) {
            const syncResult = recordEvaluationAndSyncProgress({
              userId,
              questionId,
              topic,
              mode: 'voice',
              score: reasoningResult.score || 0,
              isPassed: !!reasoningResult.isPassed,
              positivePoints: reasoningResult.positivePoints || [],
              missingPoints: reasoningResult.missingPoints || [],
              feedback: reasoningResult.feedback || '',
              speechCoaching: { faangScorecard },
              userAnswer: candidateText,
              transcript: candidateText,
              audioMetrics: { strategy, voice, cascaded: true, persona, targetGrade }
            });
            progressSummary = syncResult.progress;

            try {
              decayResult = await applyKnowledgeDecay({
                questionId,
                topic,
                assistanceLevel: reasoningResult.isPassed ? ((reasoningResult.score ?? 0) >= 85 ? 'solo' : 'guided') : 'relapse'
              });
            } catch {}

            if (!reasoningResult.isPassed && reasoningResult.missingPoints && reasoningResult.missingPoints.length > 0) {
              try {
                void recordNewErrorGap({
                  questionId,
                  topic,
                  errorConcept: reasoningResult.missingPoints[0],
                  initialDeficit: 1.0
                });
              } catch {}
            }
          }
        } catch (dbErr) {
          console.warn('Failed to persist evaluation to SQLite in CascadedTurnEngine:', dbErr);
        }
      }
    }

    return {
      action: reasoningResult.action || 'evaluate',
      transcript: candidateText,
      replyText: reasoningResult.replyText || null,
      evaluation: reasoningResult.action === 'evaluate' ? {
        score: reasoningResult.score || 0,
        isPassed: !!reasoningResult.isPassed,
        deductions: reasoningResult.deductions || [],
        positivePoints: reasoningResult.positivePoints || [],
        missingPoints: reasoningResult.missingPoints || [],
        feedback: reasoningResult.feedback || '',
        spokenFeedback: reasoningResult.spokenFeedback || '',
        faangScorecard
      } : null,
      audioBase64: audioBase64Out,
      knowledgeUpdate: decayResult,
      progress: progressSummary
    };
  }
}
