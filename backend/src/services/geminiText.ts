import dotenv from 'dotenv';
import { envConfig } from '../config/env';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from '../prompts/core/sandboxDirectives';
import { ANTI_SYCOPHANCY_DIRECTIVES } from '../prompts/core/antiSycophancy';
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
  const endpointUrl = envConfig.proxy.chatUrl;
  const proxyApiKey = envConfig.proxy.apiKey;
  const modelName = envConfig.models.text;

  const genderDirective = userGender === 'female'
    ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. В поле feedback обязательно используй ЖЕНСКИЕ окончания в прошедшем времени («Ты отлично справилась», «Ты верно отметила», «Ты упустила»). Запрещено использовать мужской род.'
    : userGender === 'male'
    ? 'Кандидат — МУЖЧИНА. В поле feedback используй мужские окончания («Ты отлично справился», «Ты верно отметил»).'
    : 'Обращайся к кандидату уважительно на «Вы» («Вы отлично справились», «Вы верно отметили»).';

  const systemPrompt = `Ты профессиональный технический интервьюер по Java, Spring, Hibernate и Docker. 
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}
${ANTI_SYCOPHANCY_DIRECTIVES}

Твоя задача — объективно оценить ответ кандидата на технический вопрос, сравнив его с эталонным ответом.
${genderDirective}

ПРАВИЛА ОЦЕНКИ И КАЛИБРОВКИ:
1. Оценивай строго по 100-балльной шкале (score).
2. Запрещено повышать балл за уверенный тон, если отсутствуют технические факты и термины.
3. Если ответ неверен или содержит грубые ошибки, score ОБЯЗАН быть < 70 (isPassed: false).

Верни ответ СТРОГО в формате JSON без кавычек markdown:
{
  "score": number (0-100),
  "isPassed": boolean (true если score >= 70),
  "positivePoints": [список из 1-3 пунктов того, что отвечено верно],
  "missingPoints": [список из 1-3 важных терминов или деталей, которые кандидат упустил],
  "feedback": "Краткое (2-3 предложения) ободряющее или корректирующее резюме для кандидата на русском языке"
}`;

  const prompt = `Вопрос: ${question}

Эталонный ответ:
${referenceAnswer}

Ответ кандидата на рецензию:
${wrapUntrustedContext('candidate_answer', userAnswer)}`;

  // Route strictly via LiteLLM Proxy
  try {
    console.log(`🤖 Evaluating text answer via LiteLLM Proxy (${endpointUrl}) using model [${modelName}] with thinking_budget=${REASONING_PRESETS.conceptualGrading.thinkingBudget}...`);
    const proxyRes = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyApiKey}`,
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: REASONING_PRESETS.conceptualGrading.temperature,
        max_tokens: REASONING_PRESETS.conceptualGrading.maxTokens,
        extra_body: buildReasoningExtraBody(REASONING_PRESETS.conceptualGrading)
      })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      const rawText = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawText);

      return {
        score: parsed.score ?? 70,
        isPassed: parsed.isPassed ?? (parsed.score >= 70),
        positivePoints: parsed.positivePoints || ['Ответ совпадает с основными мыслями темы'],
        missingPoints: parsed.missingPoints || [],
        feedback: parsed.feedback || 'Ответ принят!'
      };
    } else {
      const errText = await proxyRes.text();
      throw new Error(`LiteLLM Proxy (${proxyRes.status}): ${errText}`);
    }
  } catch (err: any) {
    console.error(`LiteLLM Proxy evaluation error:`, err);
    throw new Error(`Ошибка оценки ответа через LiteLLM Proxy: ${err.message}`);
  }
}
