import dotenv from 'dotenv';
import { envConfig } from '../config/env';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
import { callLiteLlmChat, parseJsonFromLlm } from './llmClient';
dotenv.config();

export interface EvalResult {
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
}

export async function evaluateAnswerWithGemini(
  question: string,
  referenceAnswer: string,
  userAnswer: string,
  userGender: 'female' | 'male' | 'neutral' = 'female'
): Promise<EvalResult> {
  const modelName = envConfig.models.text;

  const genderDirective = userGender === 'female'
    ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. В поле feedback обязательно используй ЖЕНСКИЕ окончания в прошедшем времени («Ты отлично справилась», «Ты верно отметила», «Ты упустила»). Запрещено использовать мужской род.'
    : userGender === 'male'
    ? 'Кандидат — МУЖЧИНА. В поле feedback используй мужские окончания («Ты отлично справился», «Ты верно отметил»).'
    : 'Обращайся к кандидату уважительно на «Вы» («Вы отлично справились», «Вы верно отметили»).';

  const systemPrompt = `Ты профессиональный технический интервьюер по Java, Spring, Hibernate и Docker. 
Твоя задача — объективно оценить ответ кандидата на технический вопрос, сравнив его с эталонным ответом.
${genderDirective}

Оценивай по 100-балльной шкале (score).
Верни ответ СТРОГО в формате JSON без кавычек markdown:
{
  "score": number (0-100),
  "isPassed": boolean (true если score >= 70),
  "positivePoints": [список из 1-3 пунктов того, что отвечено верно],
  "missingPoints": [список из 1-3 важный терминов или деталей, которые кандидат упустил],
  "feedback": "Краткое (2-3 предложения) ободряющее или корректирующее резюме для кандидата на русском языке"
}`;

  const prompt = `Вопрос: ${question}

Эталонный ответ:
${referenceAnswer}

Ответ кандидата:
${userAnswer}`;

  // Route strictly via LiteLLM Proxy with Full-Jitter retry (AGENTS.md Invariant 1 & 5)
  try {
    console.log(`🤖 Evaluating text answer via LiteLLM Proxy using model [${modelName}] with thinking_budget=${REASONING_PRESETS.conceptualGrading.thinkingBudget}...`);
    const chatResult = await callLiteLlmChat({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: REASONING_PRESETS.conceptualGrading.temperature,
      max_tokens: REASONING_PRESETS.conceptualGrading.maxTokens,
      extra_body: buildReasoningExtraBody(REASONING_PRESETS.conceptualGrading)
    }, {
      timeoutMs: 45_000,
      maxRetries: 2
    });

    const parsed = parseJsonFromLlm(chatResult.content, {
      score: 70,
      isPassed: true,
      positivePoints: ['Ответ совпадает с основными мыслями темы'],
      missingPoints: [],
      feedback: 'Ответ принят!'
    });

    return {
      score: parsed.score ?? 70,
      isPassed: parsed.isPassed ?? ((parsed.score ?? 70) >= 70),
      positivePoints: parsed.positivePoints || ['Ответ совпадает с основными мыслями темы'],
      missingPoints: parsed.missingPoints || [],
      feedback: parsed.feedback || 'Ответ принят!'
    };
  } catch (err: any) {
    console.error(`LiteLLM Proxy evaluation error:`, err);
    throw new Error(`Ошибка оценки ответа через LiteLLM Proxy: ${err.message}`);
  }
}
