/**
 * AcousticTelemetryService.ts
 * Deep facade for speech acoustics, clarity heuristics, and executive coaching profiles.
 * Delegates low-level math to AcousticDspEngine, NLP to SpeechClarityAnalyzer,
 * and pedagogical structure to QuestionFrameworkClassifier.
 * Cognitive Bounding SLA: <= 250 lines (Rule 8 compliant, down from 563 lines).
 */

import {
  AcousticDspEngine,
  AcousticMetrics,
  WordTimestamp
} from './audio/AcousticDspEngine';
import {
  SpeechClarityAnalyzer,
  SpeechClarityMetrics
} from './audio/SpeechClarityAnalyzer';
import {
  QuestionFrameworkClassifier,
  QuestionStructureFormat,
  QuestionCategoryType
} from './audio/QuestionFrameworkClassifier';

export type {
  AcousticMetrics,
  WordTimestamp,
  SpeechClarityMetrics,
  QuestionStructureFormat,
  QuestionCategoryType
};

export interface MetricCardInfo {
  title: string;
  description: string;
  badge: string;
  badgeStyle: string;
  techValue: string;
  iconEmoji: string;
}

export interface HumanizedAcousticProfile {
  volume: MetricCardInfo;
  pace: MetricCardInfo;
  structure: MetricCardInfo;
  clarity?: MetricCardInfo;
  mentorPraise: string;
}

export class AcousticTelemetryService {
  /**
   * Delegates pure acoustic computation to AcousticDspEngine.
   */
  public static computeMetrics(
    pcmData: Float32Array,
    sampleRate: number = 16000,
    transcriptText: string = '',
    wordTimestamps?: WordTimestamp[]
  ): AcousticMetrics {
    return AcousticDspEngine.computeMetrics(pcmData, sampleRate, transcriptText, wordTimestamps);
  }

  /**
   * Delegates verbal fluency and disfluencies evaluation to SpeechClarityAnalyzer.
   */
  public static analyzeSpeechClarity(
    transcriptText: string,
    grossWpm: number = 0
  ): SpeechClarityMetrics {
    return SpeechClarityAnalyzer.analyze(transcriptText, grossWpm);
  }

  /**
   * Delegates pedagogical structure classification to QuestionFrameworkClassifier.
   */
  public static classifyQuestionStructure(
    questionText: string,
    topic?: string
  ): QuestionStructureFormat {
    return QuestionFrameworkClassifier.classify(questionText, topic);
  }

  /**
   * Transforms raw acoustic telemetry into human-readable, executive coaching insights
   * tailored with soft-luxury aesthetics for candidates and female tech professionals.
   */
  public static getHumanizedProfile(
    metrics: AcousticMetrics,
    clarityMetrics?: SpeechClarityMetrics
  ): HumanizedAcousticProfile {
    const { rmsDb, grossWpm, pauseRatioPercent } = metrics;

    // 1. Подача и громкость голоса
    let volume: MetricCardInfo;
    if (rmsDb > -22) {
      volume = {
        title: 'Уверенная подача',
        description: 'Голос звучит открыто, энергично и слышен отчетливо',
        badge: '✨ Выразительно',
        badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        techValue: `${Math.round(rmsDb)} dB`,
        iconEmoji: '🎙️'
      };
    } else if (rmsDb >= -38) {
      volume = {
        title: 'Комфортная громкость',
        description: 'Приятный студийный баланс, собеседнику комфортно слушать',
        badge: '🌸 Идеальный баланс',
        badgeStyle: 'bg-rose-50 text-pink-700 border-pink-200/80',
        techValue: `${Math.round(rmsDb)} dB`,
        iconEmoji: '🌸'
      };
    } else {
      volume = {
        title: 'Мягкий камерный тембр',
        description: 'Спокойный, мягкий голос. Для интервьюера будет здорово чуть ближе к микрофону',
        badge: '💡 Совет по микрофону',
        badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200/80',
        techValue: `${Math.round(rmsDb)} dB`,
        iconEmoji: '✨'
      };
    }

    // 2. Темп и ритм речи
    let pace: MetricCardInfo;
    if (grossWpm >= 105 && grossWpm <= 165) {
      pace = {
        title: 'Гармоничный ритм',
        description: 'Оптимальная скорость изложения: легко воспринимать технические тезисы',
        badge: '💎 Легко воспринимать',
        badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        techValue: `${Math.round(grossWpm)} слов/мин`,
        iconEmoji: '💎'
      };
    } else if (grossWpm > 165) {
      pace = {
        title: 'Динамичный темп',
        description: 'Живая и быстрая реакция, высокий темп мышления и энтузиазм',
        badge: '⚡ Высокая динамика',
        badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200/80',
        techValue: `${Math.round(grossWpm)} слов/мин`,
        iconEmoji: '⚡'
      };
    } else {
      pace = {
        title: 'Взвешенный темп',
        description: 'Размеренная и вдумчивая подача, каждый тезис четко сформулирован',
        badge: '🌿 Вдумчиво и спокойно',
        badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        techValue: `${Math.max(15, Math.round(grossWpm))} слов/мин`,
        iconEmoji: '🌿'
      };
    }

    // 3. Структурирование и смысловые паузы
    let structure: MetricCardInfo;
    if (pauseRatioPercent <= 30) {
      structure = {
        title: 'Непрерывная логика',
        description: 'Уверенное раскрытие темы без долгих заминок',
        badge: '🎯 Четкая нить ответа',
        badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        techValue: `${Math.round(pauseRatioPercent)}% пауз`,
        iconEmoji: '🎯'
      };
    } else if (pauseRatioPercent <= 58) {
      structure = {
        title: 'Профессиональные паузы',
        description: 'Естественные микро-паузы для расстановки смысловых акцентов',
        badge: '✨ Академическая подача',
        badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200/80',
        techValue: `${Math.round(pauseRatioPercent)}% пауз`,
        iconEmoji: '✨'
      };
    } else {
      structure = {
        title: 'Глубокие размышления',
        description: 'Осмысленные паузы на структурирование сложной архитектурной мысли',
        badge: '🧠 Аналитический фокус',
        badgeStyle: 'bg-pink-50 text-pink-700 border-pink-200/80',
        techValue: `${Math.round(pauseRatioPercent)}% пауз`,
        iconEmoji: '🧠'
      };
    }

    // 4. Чистота речи и слова-паразиты (если переданы)
    let clarity: MetricCardInfo | undefined = undefined;
    if (clarityMetrics) {
      if (clarityMetrics.clarityScorePercent >= 90) {
        clarity = {
          title: 'Кристальная чистота речи',
          description: clarityMetrics.fillerWordsCount === 0
            ? 'Речь звучит уверенно, без междометий и слов-паразитов'
            : `Минимум пауз-паразитов (${clarityMetrics.fillerWordsCount} за ответ)`,
          badge: '💎 Высокая четкость',
          badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          techValue: `${clarityMetrics.clarityScorePercent}% чистоты`,
          iconEmoji: '💎'
        };
      } else if (clarityMetrics.clarityScorePercent >= 75) {
        const topFillers = clarityMetrics.detectedFillers.slice(0, 3).map((f) => `«${f.word}»`).join(', ');
        clarity = {
          title: 'Умеренная чистота',
          description: `Зафиксировано ${clarityMetrics.fillerWordsCount} слов-паразитов (${topFillers}). Попробуйте заменять их короткой паузой.`,
          badge: '🌿 Естественная речь',
          badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200/80',
          techValue: `${clarityMetrics.clarityScorePercent}% чистоты`,
          iconEmoji: '🌿'
        };
      } else {
        const topFillers = clarityMetrics.detectedFillers.slice(0, 3).map((f) => `«${f.word}»`).join(', ');
        clarity = {
          title: 'Частые слова-паразиты',
          description: `Обнаружено ${clarityMetrics.fillerWordsCount} слов-паразитов (${topFillers}). Делайте вдох вместо «эээ/ну» — пауза звучит солидно!`,
          badge: '💡 Зона роста',
          badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200/80',
          techValue: `${clarityMetrics.clarityScorePercent}% чистоты`,
          iconEmoji: '💡'
        };
      }
    }

    // 5. Персональный комплимент ментора по подаче
    let mentorPraise = '✨ Ваша манера речи звучит профессионально и располагает к приятному, доверительному диалогу.';
    if (rmsDb >= -36 && pauseRatioPercent <= 45) {
      mentorPraise = '🌸 У вас гармоничный баланс громкости и уверенный тон: вы звучите спокойно и экспертно, что производит отличное впечатление на интервьюера!';
    } else if (grossWpm > 150) {
      mentorPraise = '⚡ Прекрасная динамика и быстрая речь: вы уверенно владеете терминологией и делитесь мыслями на одном дыхании.';
    } else {
      mentorPraise = '💎 Спокойный и вдумчивый тон ответа: приятно слушать кандидатов, которые говорят взвешенно и структурно.';
    }

    return {
      volume,
      pace,
      structure,
      clarity,
      mentorPraise
    };
  }
}
