import dotenv from 'dotenv';
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
  const apiKey = process.env.GEMINI_API_KEY;
  const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
  const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const endpointUrl = `${cleanProxyBase}/v1/chat/completions`;
  const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
  const modelName = process.env.GEMINI_TEXT_MODEL || 'gemini-v3';

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

  // Route strictly via LiteLLM Proxy
  try {
    console.log(`🤖 Evaluating text answer via LiteLLM Proxy (${endpointUrl}) using model [${modelName}]...`);
    const proxyRes = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyApiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
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
