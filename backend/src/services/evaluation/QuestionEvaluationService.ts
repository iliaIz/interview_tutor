import { llmGateway, LlmGatewayClient } from '../LlmGatewayClient';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from '../../prompts/core/sandboxDirectives';
import { ANTI_SYCOPHANCY_DIRECTIVES, EPISTEMIC_BENEVOLENCE_AXIOM } from '../../prompts/core/antiSycophancy';
import { calculateFaangScorecard } from '../../prompts/personas';
import { CandidateMemoryAggregate } from '../memory/CandidateMemoryAggregate';
import {
  QuestionEvaluationRepository,
  questionEvaluationRepository,
  normalizeUserId,
  TopicProgressSummary
} from './QuestionEvaluationRepository';

export interface EvalResult {
  score: number; isPassed: boolean; positivePoints: string[]; missingPoints: string[]; feedback: string;
}

export interface EvaluateTextAnswerInput {
  question: string; referenceAnswer: string; userAnswer: string;
  userGender?: 'female' | 'male' | 'neutral'; abortSignal?: AbortSignal;
}

export interface QuestionEvaluationRecordInput {
  userId?: string; questionId: string; topic?: string; questionText?: string; referenceAnswer?: string;
  userAnswer: string; mode?: 'text' | 'voice'; score: number; isPassed: boolean; feedback: string;
  positivePoints?: string[]; missingPoints: string[]; dialogueTranscript?: string; transcript?: string;
  audioMetrics?: any; turnTelemetry?: any; speechCoaching?: any; audioPath?: string | null;
  assistanceLevelOverride?: 'solo' | 'guided' | 'assisted' | 'relapse'; resolvedGapIds?: string[];
  faangScorecard?: Record<string, unknown> | null; systemDesignEvaluationId?: string;
}

export interface QuestionEvaluationPorts {
  llmGateway?: Pick<LlmGatewayClient, 'completeJson'>;
  memoryAggregate?: Pick<CandidateMemoryAggregate, 'recordReview' | 'updateFsrsCardState' | 'applyKnowledgeDecay' | 'recordNewErrorGap'>;
}

export interface QuestionEvaluationOutcomeResult {
  evalId: string; persisted: boolean; userId: string; progress: TopicProgressSummary;
  knowledgeUpdate: any; fsrsResult: any; recordedGapId: string | null; ledgerId: string | null;
}

export type FaangScorecard = ReturnType<typeof calculateFaangScorecard>;

const SCORECARD_KEYS = new Set([
  'verdict', 'calibratedGrade', 'percentile', 'dimensionScores', 'strengths', 'redFlags', 'hiringRecommendation'
]);

export function mergeFaangScorecard(
  rawScorecardOrCalculated: FaangScorecard | Record<string, any> | null | undefined,
  dimensionScoresOrRaw?: Record<string, any> | FaangScorecard | null
): FaangScorecard {
  let calculated: FaangScorecard;
  let override: Record<string, any> | null | undefined;
  if (
    dimensionScoresOrRaw && typeof dimensionScoresOrRaw === 'object' &&
    'hiringRecommendation' in dimensionScoresOrRaw && 'dimensionScores' in dimensionScoresOrRaw &&
    (!rawScorecardOrCalculated || !('hiringRecommendation' in rawScorecardOrCalculated))
  ) {
    calculated = dimensionScoresOrRaw as FaangScorecard;
    override = rawScorecardOrCalculated as Record<string, any> | null | undefined;
  } else {
    calculated = rawScorecardOrCalculated as FaangScorecard;
    override = dimensionScoresOrRaw as Record<string, any> | null | undefined;
  }

  if (!override || typeof override !== 'object') return calculated;

  const hasScorecardEnvelope = Object.keys(override).some((k) => SCORECARD_KEYS.has(k));
  const rawDims = hasScorecardEnvelope
    ? (override.dimensionScores && typeof override.dimensionScores === 'object' ? override.dimensionScores : null)
    : override;

  const mergedDimensions: any = { ...calculated.dimensionScores };
  if (rawDims) {
    for (const [key, val] of Object.entries(rawDims)) {
      const baseDim = mergedDimensions[key];
      if (typeof val === 'number' && baseDim && typeof baseDim === 'object') {
        mergedDimensions[key] = { ...baseDim, score: val };
      } else if (val && typeof val === 'object' && baseDim && typeof baseDim === 'object') {
        mergedDimensions[key] = { ...baseDim, ...val };
      } else if (val !== undefined) {
        mergedDimensions[key] = val;
      }
    }
  }

  return hasScorecardEnvelope
    ? { ...calculated, ...override, dimensionScores: mergedDimensions }
    : { ...calculated, dimensionScores: mergedDimensions };
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

export class QuestionEvaluationService {
  private readonly repo: QuestionEvaluationRepository;
  private readonly defaultPorts: QuestionEvaluationPorts;

  constructor(repo: QuestionEvaluationRepository = questionEvaluationRepository, defaultPorts: QuestionEvaluationPorts = {}) {
    this.repo = repo;
    this.defaultPorts = defaultPorts;
  }

  public async evaluateTextAnswer(input: EvaluateTextAnswerInput, ports?: QuestionEvaluationPorts): Promise<EvalResult> {
    const gateway = ports?.llmGateway ?? this.defaultPorts.llmGateway ?? llmGateway;
    const systemPrompt = buildEvaluateAnswerSystemPrompt(input.userGender || 'female');
    const userPrompt = `Вопрос: ${input.question}\n\nЭталонный ответ:\n${input.referenceAnswer}\n\nОтвет кандидата на рецензию:\n${wrapUntrustedContext('candidate_answer', input.userAnswer)}`;

    const parsed = await gateway.completeJson<any>({
      systemPrompt, userPrompt, presetKey: 'conceptualGrading', timeoutMs: 45_000, abortSignal: input.abortSignal
    });

    const rawScore = typeof parsed?.score === 'number' ? parsed.score : 0;
    const positivePoints = Array.isArray(parsed?.positivePoints) ? parsed.positivePoints : [];
    const missingPoints = Array.isArray(parsed?.missingPoints) ? parsed.missingPoints : [];
    const isPassed = typeof parsed?.isPassed === 'boolean' ? parsed.isPassed : rawScore >= 70;
    const feedback = typeof parsed?.feedback === 'string' && parsed.feedback.trim() ? parsed.feedback : 'Оценка ответа завершена.';
    return { score: rawScore, isPassed, positivePoints, missingPoints, feedback };
  }

  public async recordOutcome(input: QuestionEvaluationRecordInput, ports?: QuestionEvaluationPorts): Promise<QuestionEvaluationOutcomeResult> {
    const userId = normalizeUserId(input.userId);
    const positivePoints = Array.isArray(input.positivePoints) ? input.positivePoints : [];
    const missingPoints = Array.isArray(input.missingPoints) ? input.missingPoints : [];
    const transcript = input.transcript ?? input.dialogueTranscript;
    const userAnswer = input.userAnswer || input.dialogueTranscript || '';
    const speechCoaching = input.faangScorecard ? { ...(input.speechCoaching || {}), faangScorecard: input.faangScorecard } : input.speechCoaching;

    const { evalId, persisted, progress } = this.repo.recordEvaluationAndSyncProgress({
      userId, questionId: input.questionId, topic: input.topic || 'General', mode: input.mode || 'text',
      score: input.score, isPassed: input.isPassed, feedback: input.feedback, positivePoints, missingPoints,
      userAnswer, transcript, audioMetrics: input.audioMetrics, turnTelemetry: input.turnTelemetry,
      speechCoaching, audioPath: input.audioPath
    });

    const ledgerId = this.repo.recordSystemDesignDefenseLedgerIfMatched(input.questionId, userId, evalId, input.score, {
      isPassed: input.isPassed, feedback: input.feedback, positivePoints, missingPoints,
      faangScorecard: input.faangScorecard, systemDesignEvaluationId: input.systemDesignEvaluationId
    });

    const memory = ports?.memoryAggregate ?? this.defaultPorts.memoryAggregate ?? CandidateMemoryAggregate.getInstance();
    let fsrsResult: any = null;
    if (input.questionId) {
      try {
        fsrsResult = await memory.updateFsrsCardState({ userId, questionId: input.questionId, score: input.score, isPassed: input.isPassed });
      } catch (err) {
        console.warn('[QuestionEvaluationService] FSRS state update warning:', err);
      }
    }

    const assistanceLevel = input.assistanceLevelOverride ?? (input.isPassed ? (input.score >= 85 ? 'solo' : 'guided') : 'relapse');
    let knowledgeUpdate: any = null;
    if (input.questionId) {
      try {
        knowledgeUpdate = await memory.applyKnowledgeDecay({
          userId, questionId: input.questionId, topic: progress.topic, assistanceLevel, resolvedGapIds: input.resolvedGapIds
        });
      } catch (err) {
        console.warn('[QuestionEvaluationService] Knowledge decay warning:', err);
      }
    }

    let recordedGapId: string | null = null;
    if (!input.isPassed && missingPoints.length > 0) {
      try {
        recordedGapId = await memory.recordNewErrorGap({
          userId, questionId: input.questionId, topic: progress.topic, errorConcept: missingPoints[0], initialDeficit: 1.0
        });
      } catch (err) {
        console.warn('[QuestionEvaluationService] Error gap recording warning:', err);
      }
    }

    return { evalId, persisted, userId, progress, knowledgeUpdate, fsrsResult, recordedGapId, ledgerId };
  }

  public getLatestEvaluation(questionId: string, userId?: string) {
    return this.repo.getLatestEvaluation(questionId, userId);
  }

  public getTopicSummaries(topicId: string, userId?: string) {
    return this.repo.getTopicSummaries(topicId, userId);
  }

  public syncTopicProgress(userId: string | undefined, topicIdOrName: string, persistIfChanged = true) {
    return this.repo.syncTopicProgressFromEvaluations(userId, topicIdOrName, { persistIfChanged });
  }
}

export const questionEvaluationService = new QuestionEvaluationService();
