/**
 * AcousticTelemetryService
 * Computes speech acoustics metrics:
 * - RMS dBFS and 10th percentile noise floor calibration
 * - Signal-to-Noise Ratio (SNR dB)
 * - Gross and Net Words Per Minute (WPM)
 * - Pause Ratio %
 * - 30-point normalized energy vector for sparkline waveform rendering
 */

export interface AcousticMetrics {
  rmsDb: number;
  noiseFloorDb: number;
  snrDb: number;
  grossWpm: number;
  netWpm: number;
  pauseRatioPercent: number;
  energyVector30: number[];
}

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
  mentorPraise: string;
}

export class AcousticTelemetryService {
  private static readonly EPSILON = 1e-12;
  private static readonly TARGET_POINTS = 30;

  /**
   * Transforms raw acoustic telemetry into human-readable, executive coaching insights
   * tailored with soft-luxury aesthetics for candidates and female tech professionals.
   */
  public static getHumanizedProfile(metrics: AcousticMetrics): HumanizedAcousticProfile {
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

    // 4. Персональный комплимент ментора по подаче
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
      mentorPraise
    };
  }

  /**
   * Analyze recorded PCM samples Float32 [-1.0, 1.0] and transcript text
   */
  public static analyzeAcoustics(
    pcmData: Float32Array,
    sampleRate: number,
    transcriptText: string
  ): AcousticMetrics {
    const totalSamples = pcmData.length;
    const totalDurationSec = totalSamples / sampleRate;

    const words = transcriptText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (totalSamples === 0 || totalDurationSec === 0) {
      return {
        rmsDb: -60,
        noiseFloorDb: -60,
        snrDb: 0,
        grossWpm: 0,
        netWpm: 0,
        pauseRatioPercent: 0,
        energyVector30: new Array(this.TARGET_POINTS).fill(0.1),
      };
    }

    // 1. Frame-based RMS and Noise Floor calibration
    const frameSize = Math.max(128, Math.floor(sampleRate * 0.02)); // 20ms frame
    const frameRmsValues: number[] = [];
    let sumSquares = 0;

    for (let i = 0; i < totalSamples; i += frameSize) {
      const end = Math.min(i + frameSize, totalSamples);
      let frameSum = 0;
      for (let j = i; j < end; j++) {
        const val = pcmData[j];
        frameSum += val * val;
        sumSquares += val * val;
      }
      const frameRms = Math.sqrt(frameSum / (end - i));
      frameRmsValues.push(20 * Math.log10(frameRms + this.EPSILON));
    }

    const overallRms = Math.sqrt(sumSquares / totalSamples);
    const rmsDb = Math.max(-90, 20 * Math.log10(overallRms + this.EPSILON));

    // Noise Floor estimation from 10th percentile
    const sortedFrameRms = [...frameRmsValues].sort((a, b) => a - b);
    const noiseFloorIndex = Math.floor(sortedFrameRms.length * 0.1);
    const noiseFloorDb = sortedFrameRms[noiseFloorIndex] ?? -60;
    const snrDb = Math.max(0, rmsDb - noiseFloorDb);

    // 2. VAD and Active Speech detection
    const vadThresholdDb = Math.max(noiseFloorDb + 10, -45);
    let activeFramesCount = 0;
    for (const val of frameRmsValues) {
      if (val > vadThresholdDb) {
        activeFramesCount++;
      }
    }

    const frameDurationSec = frameSize / sampleRate;
    const activeSpeechDurationSec = Math.min(
      totalDurationSec,
      activeFramesCount * frameDurationSec
    );

    // 3. Speech Pacing (WPM)
    // If exact transcript is provided from Deepgram, use real wordCount;
    // otherwise estimate based on active acoustic speech duration (2.15 words/sec Russian conversational average)
    let effectiveWordCount = words.length;
    if (effectiveWordCount < 8 && activeSpeechDurationSec > 3) {
      effectiveWordCount = Math.round(activeSpeechDurationSec * 2.15);
    }

    const grossWpm = totalDurationSec > 0 ? (effectiveWordCount / (totalDurationSec / 60)) : 0;
    const netWpm = activeSpeechDurationSec > 0 ? (effectiveWordCount / (activeSpeechDurationSec / 60)) : 0;

    // 4. Pause Ratio %
    const pauseDurationSec = Math.max(0, totalDurationSec - activeSpeechDurationSec);
    const pauseRatioPercent = totalDurationSec > 0 ? (pauseDurationSec / totalDurationSec) * 100 : 0;

    // 5. 30-Point Sparkline Energy Vector
    const energyVector30 = this.compute30PointEnergyVector(pcmData);

    return {
      rmsDb: Number(rmsDb.toFixed(1)),
      noiseFloorDb: Number(noiseFloorDb.toFixed(1)),
      snrDb: Number(snrDb.toFixed(1)),
      grossWpm: Number(grossWpm.toFixed(0)),
      netWpm: Number(netWpm.toFixed(0)),
      pauseRatioPercent: Number(pauseRatioPercent.toFixed(1)),
      energyVector30,
    };
  }

  private static compute30PointEnergyVector(pcmData: Float32Array): number[] {
    const vector = new Float64Array(this.TARGET_POINTS);
    const binSize = Math.floor(pcmData.length / this.TARGET_POINTS);

    if (binSize === 0) {
      return new Array(this.TARGET_POINTS).fill(0.1);
    }

    let minEnergy = Infinity;
    let maxEnergy = -Infinity;

    for (let k = 0; k < this.TARGET_POINTS; k++) {
      const start = k * binSize;
      const end = k === this.TARGET_POINTS - 1 ? pcmData.length : start + binSize;
      let sumSquares = 0;

      for (let j = start; j < end; j++) {
        const sample = pcmData[j];
        sumSquares += sample * sample;
      }

      const rms = Math.sqrt(sumSquares / (end - start));
      vector[k] = rms;

      if (rms < minEnergy) minEnergy = rms;
      if (rms > maxEnergy) maxEnergy = rms;
    }

    const range = maxEnergy - minEnergy;
    const normalized: number[] = [];

    for (let k = 0; k < this.TARGET_POINTS; k++) {
      if (range < this.EPSILON) {
        normalized.push(0.2);
      } else {
        const normVal = (vector[k] - minEnergy) / range;
        // Keep in [0.08, 1.0] for nice visual bar heights in sparkline
        normalized.push(Number((0.08 + normVal * 0.92).toFixed(3)));
      }
    }

    return normalized;
  }
}
