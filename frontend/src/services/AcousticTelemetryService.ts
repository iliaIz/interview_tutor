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

export class AcousticTelemetryService {
  private static readonly EPSILON = 1e-12;
  private static readonly TARGET_POINTS = 30;

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
    const wordCount = words.length;
    const grossWpm = totalDurationSec > 0 ? (wordCount / (totalDurationSec / 60)) : 0;
    const netWpm = activeSpeechDurationSec > 0 ? (wordCount / (activeSpeechDurationSec / 60)) : 0;

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
