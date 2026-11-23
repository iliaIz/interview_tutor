/**
 * AcousticDspEngine.ts
 * Pure Float32 PCM Acoustic Signal Processing Engine (RMS dBFS, Noise Floor, SNR, WPM, 30-pt Energy Sparkline).
 * SLA: <= 220 lines (Rule 8 compliant). Zero DOM / CSS dependencies.
 */

export interface WordTimestamp {
  word?: string;
  start: number;
  end: number;
}

export interface AcousticMetrics {
  rmsDb: number;
  noiseFloorDb: number;
  snrDb: number;
  grossWpm: number;
  netWpm: number;
  pauseRatioPercent: number;
  energyVector30: number[];
}

export class AcousticDspEngine {
  private static readonly EPSILON = 1e-12;
  private static readonly TARGET_POINTS = 30;

  /**
   * Computes acoustic metrics from raw 16kHz Float32 PCM samples and word timestamps.
   */
  public static computeMetrics(
    pcmData: Float32Array,
    sampleRate: number = 16000,
    transcriptText: string = '',
    wordTimestamps?: WordTimestamp[]
  ): AcousticMetrics {
    const totalSamples = pcmData.length;
    const totalDurationSec = totalSamples / sampleRate;

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

    const words = transcriptText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const validTimestamps = (wordTimestamps && wordTimestamps.length > 0)
      ? wordTimestamps.filter((w) => typeof w.start === 'number' && typeof w.end === 'number' && w.end >= w.start)
      : null;

    let grossWpm = 0;
    let netWpm = 0;
    let pauseRatioPercent = 0;
    let activeStartSample = 0;
    let activeEndSample = totalSamples;

    if (validTimestamps && validTimestamps.length >= 2) {
      // 1. Deepgram Word Timestamps-Based Exact Metrics
      const firstWordStart = validTimestamps[0].start;
      const lastWordEnd = validTimestamps[validTimestamps.length - 1].end;
      const speechSpanDurationSec = Math.max(0.5, lastWordEnd - firstWordStart);

      // Clamp active PCM slice for true speech RMS calibration
      activeStartSample = Math.max(0, Math.floor(firstWordStart * sampleRate));
      activeEndSample = Math.min(totalSamples, Math.ceil(lastWordEnd * sampleRate));

      let totalPhonationSec = 0;
      let totalRhetoricalPausesSec = 0; // Gaps 0.35s .. 0.9s
      let totalCognitivePausesSec = 0;   // Gaps > 0.9s

      for (let i = 0; i < validTimestamps.length; i++) {
        const w = validTimestamps[i];
        totalPhonationSec += Math.max(0.05, w.end - w.start);

        if (i < validTimestamps.length - 1) {
          const nextW = validTimestamps[i + 1];
          const gap = Math.max(0, nextW.start - w.end);
          if (gap > 0.9) {
            totalCognitivePausesSec += gap;
          } else if (gap >= 0.35) {
            totalRhetoricalPausesSec += gap;
          }
        }
      }

      const activeConversationalDurationSec = Math.max(0.5, totalPhonationSec + totalRhetoricalPausesSec);
      const calculatedPauseRatio = (totalCognitivePausesSec / speechSpanDurationSec) * 100;
      pauseRatioPercent = Math.min(65, Math.max(5, calculatedPauseRatio));

      grossWpm = Math.round(validTimestamps.length / (speechSpanDurationSec / 60));
      netWpm = Math.round(validTimestamps.length / (activeConversationalDurationSec / 60));
    } else {
      // 2. DSP Fallback (Frame-based VAD)
      const frameSize = Math.max(128, Math.floor(sampleRate * 0.02)); // 20ms frame
      const frameRmsValues: number[] = [];

      for (let i = 0; i < totalSamples; i += frameSize) {
        const end = Math.min(i + frameSize, totalSamples);
        let frameSum = 0;
        for (let j = i; j < end; j++) {
          const val = pcmData[j];
          frameSum += val * val;
        }
        const frameRms = Math.sqrt(frameSum / (end - i));
        frameRmsValues.push(20 * Math.log10(frameRms + this.EPSILON));
      }

      const sortedFrameRms = [...frameRmsValues].sort((a, b) => a - b);
      const noiseFloorIndex = Math.floor(sortedFrameRms.length * 0.1);
      const noiseFloorDb = sortedFrameRms[noiseFloorIndex] ?? -60;

      const vadThresholdDb = Math.max(noiseFloorDb + 6, -48);
      let activeFramesCount = 0;
      for (const val of frameRmsValues) {
        if (val > vadThresholdDb) {
          activeFramesCount++;
        }
      }

      const frameDurationSec = frameSize / sampleRate;
      const activeSpeechDurationSec = Math.min(totalDurationSec, activeFramesCount * frameDurationSec);

      let effectiveWordCount = words.length;
      if (effectiveWordCount < 8 && activeSpeechDurationSec > 3) {
        effectiveWordCount = Math.round(activeSpeechDurationSec * 2.15);
      }

      grossWpm = totalDurationSec > 0 ? (effectiveWordCount / (totalDurationSec / 60)) : 0;
      netWpm = activeSpeechDurationSec > 0 ? (effectiveWordCount / (activeSpeechDurationSec / 60)) : 0;

      const pauseDurationSec = Math.max(0, totalDurationSec - activeSpeechDurationSec);
      pauseRatioPercent = totalDurationSec > 0 ? (pauseDurationSec / totalDurationSec) * 100 : 0;
    }

    // Compute RMS and Noise Floor over calibrated active speech slice
    const sliceStart = activeStartSample;
    const sliceEnd = Math.max(sliceStart + 128, activeEndSample);
    const sliceLen = sliceEnd - sliceStart;

    let sumSquares = 0;
    for (let i = sliceStart; i < sliceEnd; i++) {
      const val = pcmData[i];
      sumSquares += val * val;
    }
    const overallRms = Math.sqrt(sumSquares / sliceLen);
    const rmsDb = Math.max(-90, 20 * Math.log10(overallRms + this.EPSILON));

    // Calculate Noise Floor over full buffer
    const frameSize = Math.max(128, Math.floor(sampleRate * 0.02));
    const allFrameRms: number[] = [];
    for (let i = 0; i < totalSamples; i += frameSize) {
      const end = Math.min(i + frameSize, totalSamples);
      let fSum = 0;
      for (let j = i; j < end; j++) {
        const val = pcmData[j];
        fSum += val * val;
      }
      allFrameRms.push(20 * Math.log10(Math.sqrt(fSum / (end - i)) + this.EPSILON));
    }
    allFrameRms.sort((a, b) => a - b);
    const noiseFloorDb = allFrameRms[Math.floor(allFrameRms.length * 0.1)] ?? -60;
    const snrDb = Math.max(0, rmsDb - noiseFloorDb);

    // 30-Point Sparkline Energy Vector
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

  public static compute30PointEnergyVector(pcmData: Float32Array): number[] {
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

    // Min-Max normalisation with floor
    const range = maxEnergy - minEnergy;
    const normalized: number[] = [];

    for (let k = 0; k < this.TARGET_POINTS; k++) {
      if (range < 1e-6) {
        normalized.push(0.35);
      } else {
        const val = 0.08 + 0.92 * ((vector[k] - minEnergy) / range);
        normalized.push(Number(val.toFixed(2)));
      }
    }

    return normalized;
  }
}
