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
  userAnswer: string
): Promise<EvalResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }

  // Model fallback list
  const modelName = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

  const systemPrompt = `Ты профессиональный технический интервьюер по Java, Spring, Hibernate и Docker. 
Твоя задача — объективно оценить ответ кандидата на технический вопрос, сравнив его с эталонным ответом.

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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);

    return {
      score: parsed.score ?? 70,
      isPassed: parsed.isPassed ?? (parsed.score >= 70),
      positivePoints: parsed.positivePoints || ['Ответ совпадает с основными мыслями темы'],
      missingPoints: parsed.missingPoints || [],
      feedback: parsed.feedback || 'Ответ принят!'
    };
  } catch (error) {
    console.error('Error evaluating answer:', error);
    // Fallback heuristic evaluation
    const userWords = userAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const refWords = referenceAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matches = userWords.filter(w => refWords.includes(w));
    const matchRatio = refWords.length > 0 ? (matches.length / refWords.length) : 0.5;
    const score = Math.min(100, Math.max(30, Math.round(matchRatio * 150)));

    return {
      score,
      isPassed: score >= 65,
      positivePoints: ['Ответ содержит ключевые термины'],
      missingPoints: ['Рекомендуется свериться с полной формулировкой'],
      feedback: 'Оценка построена на эвристическом анализе терминов.'
    };
  }
}
