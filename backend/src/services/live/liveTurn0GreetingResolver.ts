import { getChallengeDomain } from '../../utils/challengeDomain';
import { getHrQuestion } from './hrContextResolver';
import {
  resolveGuidedSessionBeats,
  createInitialGuidedState,
  buildStepStatePayload,
  formatRungPromptDirective
} from './hrGuidedStepper';
import { ResolveTurn0GreetingOptions } from './liveSessionConfigTypes';

/**
 * Internal helper unifying Turn 0 greeting prompt construction for WebSocket and LiveKit sessions.
 * Accessed via LiveSessionBlueprintBuilder (Spec 45).
 */
export function resolveTurn0GreetingText(opts: ResolveTurn0GreetingOptions): string {
  const directMessage = opts.replayOverride ?? opts.initialUserMessage;
  if (directMessage) return directMessage;
  const qText = opts.questionText || '';
  const topic = opts.topic || '';
  const qIndex = opts.questionIndex ?? 0;
  const totalQ = opts.totalQuestions ?? 1;

  if (opts.sessionType === 'tutor') {
    if (qIndex > 0) {
      return `Мы переходим к следующему вопросу темы (вопрос ${qIndex + 1} из ${totalQ}): «${qText || topic}». В 1 короткой фразе предложи с чего начнем разбор: с базовых концепций или устройства под капотом. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 короткая фраза).`;
    }
    if (opts.tutorMode === 'bug_hunt') return `Привет! Я смотрю на задачу на экране «${opts.bugTitle || 'Code Review'}». Поприветствуй меня в 1 коротком предложении и спроси, в чем здесь ошибка. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    if (opts.tutorMode === 'deep_dive') return `Привет! Я изучаю вопрос «${qText || topic}». Поприветствуй меня в 1 предложении и предложи разобрать любые тонкости или устройство под капотом. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    if (opts.tutorMode === 'free_chat') return `Привет! Я разбираю тему «${qText || topic}». Поприветствуй меня в 1 коротком предложении и скажи, что готова ответить на любые вопросы и помочь разобраться. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    if (opts.tutorMode === 'socratic') return `Привет! Я готов разобрать вопрос «${qText || topic}». Задай мне первый наводящий вопрос. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    if (opts.tutorMode === 'eli5') return `Привет! Объясни мне суть вопроса «${qText || topic}» на простой жизненной аналогии. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    if (opts.tutorMode === 'practice_pair') {
      const title = opts.bugTitle || qText || topic;
      if (opts.seniorReview) {
        const score = Math.round(opts.seniorReview.overallScore);
        const f = opts.seniorReview.focusedFinding;
        return f
          ? `Привет! Я только что завершил Senior AI Review задачи «${title}» (оценка ${score}/100). Поприветствуй меня в 1-2 предложениях и сразу голосом озвучь замечание [${f.category}] в ${f.location}: «${f.description}». Спроси, с чего начнем устранение дефекта в коде. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1-2 емких предложения).`
          : `Привет! Я только что завершил Senior AI Review задачи «${title}» (оценка ${score}/100). Заключение: "${opts.seniorReview.summaryReview}". Поприветствуй меня в 1-2 предложениях и предложи голосом разобрать замечания по коду. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1-2 емких предложения).`;
      }
      const domain = getChallengeDomain({ category: opts.challengeCategory, track: opts.challengeTrack, slug: title });
      const domainGreetings: Record<string, string> = {
        lld: `Привет! Я готов к проектированию архитектуры задачи «${title}». Поприветствуй меня в 1 коротком предложении и спроси, с каких интерфейсов или доменной модели начнем проектирование. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`,
        transactions: `Привет! Я разбираю сценарий транзакций «${title}». Поприветствуй меня в 1 коротком предложении и предложи разобрать уровни изоляции и поведение БД. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`,
        concurrency: `Привет! Я разбираю многопоточную задачу «${title}». Поприветствуй меня в 1 коротком предложении и предложи обсудить виртуальные потоки Loom, гонки данных или блокировки. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`,
        refactoring: `Привет! Я рефакторю легаси-код задачи «${title}». Поприветствуй меня в 1 коротком предложении и спроси, с каких швов (Seams) или тестов начнем рефакторинг. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`,
        java21: `Привет! Я изучаю современные идиомы Java 21 LTS в задаче «${title}». Поприветствуй меня в 1 коротком предложении и предложи обсудить Pattern Matching, Records или sealed-типы. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`
      };
      return domainGreetings[domain] || `Привет! Я готов к разбору задачи «${title}». Поприветствуй меня в 1 коротком предложении и предложи обсудить граничные случаи или план решения. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    }
    return `Привет! Я изучаю вопрос «${qText || topic}». Поприветствуй меня в 1 короткой фразе. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
  }

  if (opts.sessionType === 'hr_tutor') {
    const activeQuestion = opts.hrQuestion || getHrQuestion(opts.questionId);
    if (opts.hrMode === 'guided_zero_start') {
      const beatOpts = { startBeatId: opts.startBeatId, beatScope: opts.beatScope };
      const beats = resolveGuidedSessionBeats(activeQuestion, beatOpts);
      const state = opts.hrGuidedState ?? createInitialGuidedState(activeQuestion, beatOpts);
      if (state && beats.length > 0) {
        const payload = buildStepStatePayload(state, beats, 'session_init');
        return formatRungPromptDirective(payload, 'turn0_greeting');
      }
      return `Привет! Мы начинаем пошаговую тренировку с нуля по вопросу «${activeQuestion?.canonicalQuestion || qText || 'Расскажите о себе'}». Поприветствуй кандидата и произнеси первую короткую фразу для повтора.`;
    }
    return `Привет! Мы начинаем живую репетицию вопроса «${activeQuestion?.canonicalQuestion || qText || 'Расскажите о себе'}». Коротко поприветствуй кандидата как тренер Ольга и дай команду начинать ответ. (ВАЖНО: сейчас Turn 0 — НЕ вызывай никаких инструментов!).`;
  }

  if (opts.sessionType === 'system_design') {
    return `Привет! Я готова к защите архитектуры по сценарию «${topic || qText || 'System Design'}». Поприветствуй меня в 1 коротком предложении и предложи начать с функциональных и нефункциональных требований. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
  }

  if (opts.isRetry) {
    return `Мы пробуем ответить на технический вопрос темы заново с чистого листа: "${qText || 'Вопрос темы'}". Коротко подбодри в 1 фразе и сразу задай этот вопрос слитным, связным речевым потоком без пауз. (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала). (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
  }
  return qIndex > 0
    ? `Мы продолжаем собеседование (вопрос ${qIndex + 1} из ${totalQ}). Короткой живой фразой подтверди прогресс и сразу четко зачитай следующий технический вопрос слитным речевым потоком: "${qText || 'Следующий вопрос темы'}". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала). (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`
    : `Привет! Я готова к собеседованию. Поздоровайся в 1 коротком предложении и сразу полностью зачитай технический вопрос единым речевым потоком без пауз: "${qText || 'Расскажи о себе и опыте в Java'}". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала). (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
}
