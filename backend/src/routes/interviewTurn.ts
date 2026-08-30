import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../services/db';
import { envConfig } from '../config/env';
import { transcribeWithDeepgram } from '../services/deepgramService';
import { synthesizeTTSBuffer } from '../services/podcast';
import { applyKnowledgeDecay, recordNewErrorGap } from '../services/vectorMemoryService';
import { getOrCreateSessionMemory } from '../services/geminiLiveProxy';

const router = Router();

// POST /api/interview/greeting - Synthesizes the initial greeting and question
router.post('/greeting', async (req: Request, res: Response) => {
  try {
    const {
      topic = 'Java Core',
      questionText,
      voice = 'Kore',
      userGender = 'female',
      strategy = 'socratic_tutoring'
    } = req.body;

    if (!questionText) {
      return res.status(400).json({ error: 'questionText is required' });
    }

    const genderDirective = userGender === 'female'
      ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. Обращайся вежливо и поддерживающе, используя ЖЕНСКИЕ окончания в прошедшем времени («Ты готова», «Ты выбрала»).'
      : userGender === 'male'
      ? 'Кандидат — МУЖЧИНА. Обращайся вежливо и поддерживающе, используя МУЖСКИЕ окончания («Ты готов», «Ты выбрал»).'
      : 'Обращайся уважительно на «Вы».';

    const greetingPrompt = `Ты профессиональный и доброжелательный технический интервьюер.
${genderDirective}
Твоя задача — поприветствовать кандидата одной короткой, естественной живой фразой (максимум 1 предложение) и четко зачитать технический вопрос по теме «${topic}».

ВОПРОС ДЛЯ ОЗВУЧИВАНИЯ:
"${questionText}"

ВАЖНО:
- НЕ давай подсказок и не отвечай на вопрос.
- Выдай ТОЛЬКО текст реплики для озвучивания, без кавычек и мета-тегов.`;

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.fast;

    const chatResponse = await fetch(endpointUrl, {
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
    });

    if (!chatResponse.ok) {
      throw new Error(`Proxy returned ${chatResponse.status}: ${await chatResponse.text()}`);
    }

    const chatData = await chatResponse.json();
    const greetingText = chatData.choices?.[0]?.message?.content?.trim() || `Привет! Давайте разберем следующий вопрос: ${questionText}`;

    // Synthesize TTS
    const ttsBuf = await synthesizeTTSBuffer(greetingText, voice);
    const audioBase64 = ttsBuf.toString('base64');

    return res.json({
      text: greetingText,
      audioBase64
    });
  } catch (err: any) {
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
      voice = 'Kore',
      userGender = 'female'
    } = req.body;

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

    const genderDirective = userGender === 'female'
      ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. В feedback и репликах строго используй ЖЕНСКИЕ окончания в прошедшем времени («Ты отлично раскрыла», «Ты верно отметила», «Ты упустила»).'
      : userGender === 'male'
      ? 'Кандидат — МУЖЧИНА. В feedback используй мужские окончания («Ты отлично раскрыл», «Ты верно отметил»).'
      : 'Обращайся уважительно на «Вы».';

    const systemPrompt = `Ты Senior/Lead технический интервьюер и ментор по теме «${topic}».
${genderDirective}

КОНТЕКСТ ВОПРОСА:
Вопрос: "${questionText}"
Эталонный ответ:
"""${referenceAnswer}"""

РЕЖИМ РАБОТЫ:
Стратегия: ${strategy} (Сократический диалог).
Deep Dive: ${deepDive ? 'Включен (углубляйся во внутреннее устройство, JVM, байткод, пограничные случаи)' : 'Выключен'}.
Текущий раунд уточнений: ${turnCount} из ${maxProbes}.

ПРАВИЛА ПРИНЯТИЯ РЕШЕНИЯ:
1. Если кандидат сдается («не знаю», «сдаюсь», «объясни») ИЛИ если текущий раунд ${turnCount} >= ${maxProbes} ИЛИ ответ кандидата уже достаточно полон:
   -> Выбери action: "evaluate".
2. Если ответ кандидата раскрывает только часть критериев, есть неточности или включен Deep Dive, и раундов ${turnCount} < ${maxProbes}:
   -> Выбери action: "probe" и сформулируй ОДИН четкий, глубокий наводящий вопрос (2-3 предложения), развивающий тему.

ФОРМАТ ВЫХОДА — СТРОГО JSON БЕЗ КАВЫЧЕК MARKDOWN:
Если action == "probe":
{
  "action": "probe",
  "replyText": "Короткий наводящий вопрос кандидату голосом (2-3 предложения)"
}

Если action == "evaluate":
{
  "action": "evaluate",
  "score": number (0-100),
  "isPassed": boolean (score >= 70),
  "positivePoints": [список из 1-3 пунктов того, что отвечено верно],
  "missingPoints": [список из 1-3 упущенных нюансов или терминов],
  "feedback": "Подробный текстовый фидбек на 2-3 предложения",
  "spokenFeedback": "Краткое устное теплое резюме для озвучки голосом (1-2 предложения, например: Отлично, ты хорошо разобралась в теме! Сейчас сформирую итоговую оценку.)"
}`;

    const conversationTurns = [
      { role: 'system', content: systemPrompt },
      ...history.map((h: any) => ({
        role: h.role === 'ai' ? 'assistant' : 'user',
        content: h.text
      })),
      { role: 'user', content: candidateText }
    ];

    const proxyRes = await fetch(endpointUrl, {
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
    });

    if (!proxyRes.ok) {
      const errTxt = await proxyRes.text();
      throw new Error(`LiteLLM reasoning error (${proxyRes.status}): ${errTxt}`);
    }

    const proxyData = await proxyRes.json();
    const rawContent = proxyData.choices?.[0]?.message?.content || '{}';
    let reasoningResult: any = {};
    try {
      reasoningResult = JSON.parse(rawContent);
    } catch {
      const clean = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      reasoningResult = JSON.parse(clean);
    }

    // 3. Audio Synthesis Phase: Synthesize response via Gemini TTS v3
    let textToVoice = '';
    if (reasoningResult.action === 'probe') {
      textToVoice = reasoningResult.replyText || 'Расскажи подробнее об этой части.';
    } else {
      textToVoice = reasoningResult.spokenFeedback || reasoningResult.feedback || 'Спасибо за ответ! Оценка сформирована.';
    }

    const ttsBuf = await synthesizeTTSBuffer(textToVoice, voice);
    const audioBase64Out = ttsBuf.toString('base64');

    if (sessionId && textToVoice) {
      const mem = getOrCreateSessionMemory(sessionId, questionId);
      mem.turns.push({ role: 'model', text: textToVoice });
      mem.lastSpeaker = 'model';
      mem.updatedAt = Date.now();
    }

    // 4. Persistence (if evaluate)
    let decayResult = null;
    if (reasoningResult.action === 'evaluate' && questionId && topic) {
      try {
        const questionExists = db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId);
        if (questionExists) {
          const evalId = crypto.randomBytes(16).toString('hex');
          const stmt = db.prepare(`
            INSERT INTO question_evaluations (
              id, question_id, topic, mode, score, is_passed,
              positive_points, missing_points, feedback, user_answer,
              transcript, audio_metrics, created_at, updated_at
            ) VALUES (
              @id, @question_id, @topic, @mode, @score, @is_passed,
              @positive_points, @missing_points, @feedback, @user_answer,
              @transcript, @audio_metrics, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `);

          stmt.run({
            id: evalId,
            question_id: questionId,
            topic,
            mode: 'voice',
            score: reasoningResult.score || 0,
            is_passed: reasoningResult.isPassed ? 1 : 0,
            positive_points: JSON.stringify(reasoningResult.positivePoints || []),
            missing_points: JSON.stringify(reasoningResult.missingPoints || []),
            feedback: reasoningResult.feedback || '',
            user_answer: candidateText,
            transcript: candidateText,
            audio_metrics: JSON.stringify({ strategy, voice, cascaded: true })
          });

          try {
            decayResult = await applyKnowledgeDecay({
              questionId,
              topic,
              assistanceLevel: reasoningResult.isPassed ? (reasoningResult.score >= 85 ? 'solo' : 'guided') : 'relapse'
            });
          } catch {}

          if (!reasoningResult.isPassed && reasoningResult.missingPoints?.length > 0) {
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
        positivePoints: reasoningResult.positivePoints || [],
        missingPoints: reasoningResult.missingPoints || [],
        feedback: reasoningResult.feedback || '',
        spokenFeedback: reasoningResult.spokenFeedback || ''
      } : null,
      audioBase64: audioBase64Out,
      knowledgeUpdate: decayResult
    });
  } catch (err: any) {
    console.error('Error in /api/interview/turn:', err);
    res.status(500).json({ error: err.message || 'Interview turn processing failed' });
  }
});

export default router;
