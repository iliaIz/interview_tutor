import dotenv from 'dotenv';
import { llmGateway } from './LlmGatewayClient';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from '../prompts/core/sandboxDirectives';
import { ANTI_SYCOPHANCY_DIRECTIVES, EPISTEMIC_BENEVOLENCE_AXIOM } from '../prompts/core/antiSycophancy';
dotenv.config();

export interface EvalResult {
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
}

export function buildEvaluateAnswerSystemPrompt(userGender: 'female' | 'male' | 'neutral' = 'female'): string {
  const genderDirective = userGender === 'female'
    ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. В поле feedback обязательно используй ЖЕНСКИЕ окончания в прошедшем времени («Ты верно отметила», «Ты упустила»). Запрещено использовать мужской род.'
    : userGender === 'male'
    ? 'Кандидат — МУЖЧИНА. В поле feedback используй мужские окончания («Ты верно отметил», «Ты упустил»).'
    : 'Обращайся к кандидату уважительно на «Вы» («Вы верно отметили», «Вы упустили»).';

  return `Ты профессиональный технический интервьюер по Java, Spring, Hibernate и Docker.
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}
${ANTI_SYCOPHANCY_DIRECTIVES}

Твоя задача — объективно и строго оценить ответ кандидата на технический вопрос, сравнив его с эталонным ответом.
${genderDirective}

${EPISTEMIC_BENEVOLENCE_AXIOM}

ПРАВИЛА ОЦЕНКИ И ПРОТОКОЛ ZERO-PHANTOM-DEDUCTIONS:
1. Базовая оценка — 100 баллов. Итоговый score рассчитывается СТРОГО методом вычитания штрафов за конкретные упущенные концепции или фактические ошибки.
2. Запрещено снимать баллы без явного указания причины в массиве missingPoints (никаких «фантомных штрафов»). Если missingPoints пуст, score ОБЯЗАН быть равен 100.
3. Каждый пункт в missingPoints ОБЯЗАН заканчиваться точным весом штрафа в квадратных скобках, например: "Не раскрыт механизм разрешения коллизий и перестроения бакетов в Red-Black Tree при превышении TREEIFY_THRESHOLD [-25 баллов]". Математическая сумма всех штрафов из missingPoints должна в точности равняться (100 - score).
4. Запрещено повышать балл за уверенный тон, общие фразы или воду, если отсутствуют точные технические факты, названия механизмов и термины.
5. Если ответ неверный, поверхностный или содержит грубые технические ошибки, score ОБЯЗАН быть < 70 (isPassed: false). Если верных технических тезисов нет вовсе, массив positivePoints ДОЛЖЕН быть пустым [].

Верни ответ СТРОГО в формате JSON без кавычек markdown:
{
  "score": number (0-100, строго 100 минус сумма штрафов из missingPoints),
  "isPassed": boolean (true если score >= 70, иначе false),
  "positivePoints": [список от 0 до 3 пунктов: конкретные технические факты, которые кандидат назвал верно; пустой массив [], если точных фактов нет],
  "missingPoints": [список от 0 до 4 пунктов: упущенные ключевые механизмы или ошибки с обязательным указанием штрафа "[-X баллов]"],
  "feedback": "Сухое, объективное техническое резюме (2-3 предложения) на русском языке без приветствий и комплиментов: прямой вердикт по глубине понимания темы и главная точка отказа в ответе"
}`;
}

export async function evaluateAnswerWithGemini(
  question: string,
  referenceAnswer: string,
  userAnswer: string,
  userGender: 'female' | 'male' | 'neutral' = 'female'
): Promise<EvalResult> {
  const systemPrompt = buildEvaluateAnswerSystemPrompt(userGender);
  const prompt = `Вопрос: ${question}

Эталонный ответ:
${referenceAnswer}

Ответ кандидата на рецензию:
${wrapUntrustedContext('candidate_answer', userAnswer)}`;

  try {
    const parsed = await llmGateway.completeJson<any>({
      systemPrompt,
      userPrompt: prompt,
      presetKey: 'conceptualGrading',
      timeoutMs: 45_000
    });

    const rawScore = typeof parsed.score === 'number' ? parsed.score : 0;
    const positivePoints = Array.isArray(parsed.positivePoints) ? parsed.positivePoints : [];
    const missingPoints = Array.isArray(parsed.missingPoints) ? parsed.missingPoints : [];
    const isPassed = typeof parsed.isPassed === 'boolean' ? parsed.isPassed : (rawScore >= 70);
    const feedback = typeof parsed.feedback === 'string' && parsed.feedback.trim() ? parsed.feedback : 'Оценка ответа завершена.';

    return {
      score: rawScore,
      isPassed,
      positivePoints,
      missingPoints,
      feedback
    };
  } catch (err: any) {
    console.error(`LiteLLM Proxy evaluation error:`, err);
    throw new Error(`Ошибка оценки ответа через LiteLLM Proxy: ${err.message}`);
  }
}
