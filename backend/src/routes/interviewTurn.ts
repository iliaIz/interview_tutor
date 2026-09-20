import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../services/db';
import { envConfig } from '../config/env';
import { fetchWithFullJitterRetry } from '../utils/httpRetry';
import { transcribeWithDeepgram } from '../services/deepgramService';
import { synthesizeTTSBuffer, synthesizeTTSWithRetry } from '../services/podcast';
import { applyKnowledgeDecay, recordNewErrorGap } from '../services/vectorMemoryService';
import { getOrCreateSessionMemory } from '../services/geminiLiveProxy';
import { getAuthUserId } from '../middleware/auth';
import { recordEvaluationAndSyncProgress } from '../services/progressService';
import {
  InterviewPersonaId,
  TargetGrade,
  getPersonaPromptDirectives,
  calculateFaangScorecard
} from '../prompts/personas';
import {
  wrapUntrustedContext,
  PROMPT_INJECTION_DEFENSE_DIRECTIVE
} from '../prompts/core/sandboxDirectives';
import {
  TRIVIA_IMMUNITY_INVARIANT,
  CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES,
  StrictnessLevel,
  getStrictnessDirectives
} from '../prompts/core/antiSycophancy';

const VALID_VOICES = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'] as const;

function sanitizeVoice(v: unknown): string {
  return typeof v === 'string' && VALID_VOICES.includes(v as any) ? v : 'Kore';
}

export interface DeductionItem {
  criterionId?: string;
  reason: string;
  penalty: number;
}

export interface TurnReasoningResult {
  action: 'probe' | 'evaluate';
  replyText?: string;
  score?: number;
  isPassed?: boolean;
  deductions?: DeductionItem[];
  positivePoints?: string[];
  missingPoints?: string[];
  feedback?: string;
  spokenFeedback?: string;
  faangScorecard?: any;
}

/**
 * Returns safe, concise spoken text for TTS synthesis (<= 35-40 words).
 * Prevents runaway multi-paragraph essay playback in voice audio.
 */
export function getSafeSpokenText(reasoningResult: TurnReasoningResult): string {
  if (reasoningResult.action === 'probe') {
    return reasoningResult.replyText || 'Расскажи подробнее об этой части.';
  }
  if (reasoningResult.spokenFeedback && reasoningResult.spokenFeedback.trim().length > 0) {
    const trimmed = reasoningResult.spokenFeedback.trim();
    const words = trimmed.split(/\s+/);
    if (words.length <= 40) {
      return trimmed;
    }
    return words.slice(0, 38).join(' ') + '... Подробный разбор открыт на экране.';
  }
  const score = reasoningResult.score ?? 0;
  return `Спасибо за ответ! Я зафиксировал результаты и выставил оценку ${score} баллов. Подробный разбор открыт на экране.`;
}

function parseReasoningJson(raw: string, isTutorMode: boolean): TurnReasoningResult {
  if (!raw || !raw.trim()) {
    return {
      action: isTutorMode ? 'probe' : 'evaluate',
      replyText: 'Давайте продолжим обсуждение.',
      feedback: 'Ответ принят.'
    };
  }

  // 1. Direct parse attempt
  try {
    return JSON.parse(raw);
  } catch {}

  // 2. Strip markdown fences
  try {
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch {}

  // 3. Regex extract first JSON object {...}
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch {}

  // 4. Fallback structured response without crashing
  console.warn('Could not parse model reasoning output as JSON, using structured fallback:', raw.slice(0, 100));
  return {
    action: 'probe',
    replyText: raw.replace(/[{}"[\]]/g, '').trim() || 'Расскажите подробнее об этой части.'
  };
}

const router = Router();

// POST /api/interview/greeting - Synthesizes the initial greeting and question
router.post('/greeting', async (req: Request, res: Response) => {
  try {
    const {
      topic = 'Java Core',
      questionText,
      voice: rawVoice = 'Kore',
      userGender: rawUserGender = 'female',
      strategy = 'socratic_tutoring',
      sessionType: rawSessionType = 'interview',
      tutorMode: rawTutorMode = 'deep_dive',
      initialUserMessage = ''
    } = req.body;

    const voice = sanitizeVoice(rawVoice);
    const userGender = rawUserGender === 'male' || rawUserGender === 'neutral' ? rawUserGender : 'female';
    const sessionType = rawSessionType === 'tutor' ? 'tutor' : 'interview';
    const tutorMode = ['deep_dive', 'socratic', 'eli5', 'free_chat'].includes(rawTutorMode) ? rawTutorMode : 'deep_dive';

    if (!questionText) {
      return res.status(400).json({ error: 'questionText is required' });
    }

    const genderDirective = userGender === 'female'
      ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. Обращайся вежливо и поддерживающе, используя ЖЕНСКИЕ окончания в прошедшем времени («Ты готова», «Ты выбрала»).'
      : userGender === 'male'
      ? 'Кандидат — МУЖЧИНА. Обращайся вежливо и поддерживающе, используя МУЖСКИЕ окончания («Ты готов», «Ты выбрал»).'
      : 'Обращайся уважительно на «Вы».';

    let greetingPrompt = '';
    if (sessionType === 'tutor') {
      if (initialUserMessage) {
        greetingPrompt = `Ты доброжелательный Senior Java/Spring наставник по теме «${topic}».
${genderDirective}
Кандидат обратился к тебе с конкретным вопросом:
"${initialUserMessage}"

Ответь кандидату прямо, дружелюбно и емко (2-3 предложения), раскрывая суть вопроса под капотом.
Выдай ТОЛЬКО текст реплики для озвучивания, без кавычек и мета-тегов.`;
      } else {
        const modeLabel = tutorMode === 'deep_dive' ? 'под капотом (JVM, байткод, структуры данных)'
          : tutorMode === 'socratic' ? 'через наводящие вопросы'
          : tutorMode === 'eli5' ? 'на простых аналогиях'
          : 'в свободном диалоге';
        greetingPrompt = `Ты доброжелательный Senior Java/Spring наставник по теме «${topic}».
${genderDirective}
Твоя задача — поприветствовать кандидата одной короткой, естественной фразой (1-2 предложения) и предложить разобрать вопрос темы «${topic}» ${modeLabel}.
Вопрос: "${questionText}"
Выдай ТОЛЬКО текст реплики для озвучивания, без кавычек и мета-тегов.`;
      }
    } else {
      greetingPrompt = `Ты профессиональный и доброжелательный технический интервьюер.
${genderDirective}
Твоя задача — поприветствовать кандидата одной короткой, естественной живой фразой (максимум 1 предложение) и четко зачитать технический вопрос по теме «${topic}».

ВОПРОС ДЛЯ ОЗВУЧИВАНИЯ:
"${questionText}"

ВАЖНО:
- НЕ давай подсказок и не отвечай на вопрос.
- Выдай ТОЛЬКО текст реплики для озвучивания, без кавычек и мета-тегов.`;
    }

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.fast;

    const chatResponse = await fetchWithFullJitterRetry(
      endpointUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proxyApiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: greetingPrompt }],
          temperature: 0.3
        })
      },
      2,
      (req as any).signal
    );

    if ((req as any).signal?.aborted) {
      return res.status(499).end();
    }

    if (!chatResponse.ok) {
      throw new Error(`Proxy returned ${chatResponse.status}: ${await chatResponse.text()}`);
    }

    const chatData = await chatResponse.json();
    const greetingText = chatData.choices?.[0]?.message?.content?.trim() || `Привет! Давайте разберем следующий вопрос: ${questionText}`;

    if ((req as any).signal?.aborted) {
      return res.status(499).end();
    }

    // Synthesize TTS with retry
    const { buffer: ttsBuf } = await synthesizeTTSWithRetry(greetingText, voice);
    const audioBase64 = ttsBuf.toString('base64');

    return res.json({
      text: greetingText,
      audioBase64
    });
  } catch (err: any) {
    if ((req as any).signal?.aborted || err?.message === 'Request aborted by client') {
      return res.status(499).end();
    }
    console.error('Error in /api/interview/greeting:', err);
    return res.status(500).json({ error: err.message || 'Greeting synthesis failed' });
  }
});

// POST /api/interview/turn - Cascaded Turn-Based Interview Engine (STT -> Gemini Fast Reasoning -> Gemini TTS v3)
router.post('/turn', async (req: Request, res: Response) => {
  try {
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
      liveCoaching = true,
      voice: rawVoice = 'Kore',
      userGender: rawUserGender = 'female',
      activeCodeArtifact,
      persona = 'mentor',
      targetGrade = 'L5_SENIOR',
      sessionType: rawSessionType = 'interview',
      strictness: rawStrictness = 'standard'
    } = req.body;

    const voice = sanitizeVoice(rawVoice);
    const userGender = rawUserGender === 'male' || rawUserGender === 'neutral' ? rawUserGender : 'female';
    const sessionType = rawSessionType === 'tutor' ? 'tutor' : 'interview';
    const strictness: StrictnessLevel = ['learning', 'standard', 'hardcore'].includes(rawStrictness)
      ? (rawStrictness as StrictnessLevel)
      : (sessionType === 'tutor' ? 'learning' : 'standard');
    const strictnessDirective = getStrictnessDirectives(strictness);

    if (!questionText) {
      return res.status(400).json({ error: 'questionText is required' });
    }

    // 1. STT Phase: Transcribe candidate's speech if text not provided
    let candidateText = (rawTranscript || '').trim();
    if (!candidateText && (audioBase64 || pcmBase64)) {
      const pcmBuffer = Buffer.from(audioBase64 || pcmBase64, 'base64');
      if (pcmBuffer.length > 0) {
        try {
          const sttResult = await transcribeWithDeepgram(pcmBuffer, 16000);
          candidateText = sttResult.transcript.trim();
        } catch (sttErr) {
          console.warn('STT failed in /api/interview/turn, using fallback:', sttErr);
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

    // 2. Reasoning Phase: Evaluate transcript with Gemini Fast
    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    // Use gemini-fast for sub-500ms deterministic Socratic reasoning
    const modelName = envConfig.models.fast;

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
Ты доброжелательный Senior наставник по теме «${topic}».
Кандидат задает вопросы, разбирается в тонкостях темы или просит подсказку.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку или завершать сессию (action: "evaluate").
ВСЕГДА выбирай action: "probe" и давай прямой, емкий, полезный ответ или наводящую подсказку кандидату голосом (2-3 предложения).
Если кандидат ошибся — не соглашайся из вежливости («вы правы»), а мягко покажи физику процесса под капотом.`
      : `ПРАВИЛА ПРИНЯТИЯ РЕШЕНИЯ (СОБЕСЕДОВАНИЕ):
1. Если кандидат сдается («не знаю», «сдаюсь», «объясни») ИЛИ если текущий раунд ${turnCount} >= ${maxProbes} ИЛИ ответ кандидата уже достаточно полон:
   -> Выбери action: "evaluate".
2. Если ответ кандидата раскрывает только часть критериев, есть неточности или включен Deep Dive, и раундов ${turnCount} < ${maxProbes}:
   -> Выбери action: "probe" и сформулируй ОДИН четкий, глубокий наводящий вопрос (2-3 предложения), развивающий тему в манере твоей персоны (${personaDirectives.personaTitle}).
   -> Если кандидат допустил фактическую или механическую ошибку: сформулируй точечный вопрос именно по этой механике без соглашательских фраз («вы правы», «отлично»).
   -> Помни о TRIVIA IMMUNITY: не снижай оценку и не придирайся, если кандидат объясняет своими словами и не помнит точных длинных названий пропертей или классов.`;

    const systemPrompt = `Ты ${personaDirectives.personaTitle} по теме «${topic}».
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

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
Deep Dive: ${deepDive ? 'Включен (углубляйся во внутреннее устройство, JVM, байткод, пограничные случаи)' : 'Выключен'}.
Текущий раунд: ${turnCount}${isTutorMode ? ' (без лимита)' : ` из ${maxProbes}`}.

${decisionRules}

ФОРМАТ ВЫХОДА — СТРОГО JSON БЕЗ КАВЫЧЕК MARKDOWN:
Если action == "probe":
{
  "action": "probe",
  "replyText": "Короткий полезный ответ или наводящий вопрос кандидату голосом (2-3 предложения, без фальшивых кивков)"
}

Если action == "evaluate":
{
  "action": "evaluate",
  "score": number (0-100),
  "isPassed": boolean (score >= 70),
  "deductions": [
    { "criterionId": "string", "reason": "Конкретная фактическая ошибка или пропуск физики процесса", "penalty": number }
  ],
  "positivePoints": [список из 1-3 пунктов того, что отвечено верно],
  "missingPoints": [список из 1-3 упущенных нюансов или терминов],
  "feedback": "Подробный текстовый фидбек на 2-3 предложения с обоснованием вычетов",
  "spokenFeedback": "Краткое устное объективное резюме для озвучки голосом (1-2 предложения, строго до 35 слов, например: Спасибо за ответ. Я сопоставил факты с критериями и сформировал оценку в калибровочном отчете.)",
  "faangScorecard": {
    "verdict": "STRONG_HIRE | HIRE | LEANING_HIRE | LEANING_NO_HIRE | STRONG_NO_HIRE",
    "calibratedGrade": "L4_MIDDLE | L5_SENIOR | L6_STAFF",
    "dimensionScores": {
      "domainDepth": number (0-100),
      "systemArchitecture": number (0-100),
      "communicationStar": number (0-100),
      "operationalExcellence": number (0-100)
    }
  }
}

МАТЕМАТИЧЕСКАЯ КАЛИБРОВКА БАЛЛОВ (ZERO-PHANTOM-DEDUCTIONS):
- Стартовая оценка = 100 баллов.
- Любое снижение балла ОБЯЗАНО быть отражено в массиве "deductions".
- Сумма штрафов sum(penalty) обязана быть строго равна: 100 - score. Запрещено штрафовать без явного указания причины в deductions.`;

    const wrappedCandidateText = wrapUntrustedContext('candidate_transcript', candidateText);

    const conversationTurns = [
      { role: 'system', content: systemPrompt },
      ...history.map((h: any) => ({
        role: h.role === 'ai' ? 'assistant' : 'user',
        content: h.role === 'ai' ? h.text : wrapUntrustedContext('candidate_transcript', h.text)
      })),
      { role: 'user', content: wrappedCandidateText }
    ];

    const proxyRes = await fetchWithFullJitterRetry(
      endpointUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxyApiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: conversationTurns,
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: 'json_object' }
        })
      },
      2,
      (req as any).signal
    );

    if ((req as any).signal?.aborted) {
      return res.status(499).end();
    }

    if (!proxyRes.ok) {
      const errTxt = await proxyRes.text();
      throw new Error(`LiteLLM reasoning error (${proxyRes.status}): ${errTxt}`);
    }

    const proxyData = await proxyRes.json();
    const rawContent = proxyData.choices?.[0]?.message?.content || '{}';
    const reasoningResult = parseReasoningJson(rawContent, isTutorMode);

    if ((req as any).signal?.aborted) {
      return res.status(499).end();
    }

    // 3. Audio Synthesis Phase: Synthesize response via Gemini TTS v3 with safe clamped speech
    const textToVoice = getSafeSpokenText(reasoningResult);

    const { buffer: ttsBuf } = await synthesizeTTSWithRetry(textToVoice, voice);
    const audioBase64Out = ttsBuf.toString('base64');

    if (sessionId && textToVoice) {
      const mem = getOrCreateSessionMemory(sessionId, questionId);
      mem.turns.push({ role: 'model', text: textToVoice });
      mem.lastSpeaker = 'model';
      mem.updatedAt = Date.now();
    }

    // 4. Persistence (if evaluate)
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

      if (reasoningResult.faangScorecard && reasoningResult.faangScorecard.dimensionScores) {
        faangScorecard = {
          ...calculatedScorecard,
          ...reasoningResult.faangScorecard,
          dimensionScores: {
            ...calculatedScorecard.dimensionScores,
            ...reasoningResult.faangScorecard.dimensionScores
          }
        };
      } else {
        faangScorecard = calculatedScorecard;
      }
    }

    if (reasoningResult.action === 'evaluate' && questionId && topic) {
      try {
        const questionExists = db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId);
        if (questionExists) {
          const userId = getAuthUserId(req);
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
        console.warn('Failed to persist evaluation to SQLite:', dbErr);
      }
    }

    res.json({
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
    });
  } catch (err: any) {
    if ((req as any).signal?.aborted || err?.message === 'Request aborted by client') {
      return res.status(499).end();
    }
    console.error('Error in /api/interview/turn:', err);
    res.status(500).json({ error: err.message || 'Interview turn processing failed' });
  }
});

export default router;
