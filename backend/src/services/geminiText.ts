import {
  EvalResult,
  buildEvaluateAnswerSystemPrompt,
  questionEvaluationService
} from './evaluation/QuestionEvaluationService';

export { EvalResult, buildEvaluateAnswerSystemPrompt };

export async function evaluateAnswerWithGemini(
  question: string,
  referenceAnswer: string,
  userAnswer: string,
  userGender: 'female' | 'male' | 'neutral' = 'female'
): Promise<EvalResult> {
  return questionEvaluationService.evaluateTextAnswer({
    question,
    referenceAnswer,
    userAnswer,
    userGender
  });
}
