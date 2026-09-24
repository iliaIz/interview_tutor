/**
 * L1 Capacity Math Engine (Back-of-the-Envelope Calculations)
 * Authoritative implementation adhering to Pillar 4 SSOT (docs/architecture/specs/04_SYSTEM_DESIGN_ARENA.md)
 */

export interface CapacityParameters {
  dau: number;
  writesPerUser: number;
  readsPerUser: number;
  avgWriteBytes: number;
  avgReadBytes: number;
  retentionYears: number;
  peakFactor?: number; // Default: 3.0
  replicationFactor?: number; // Default: 2 (e.g. 1 primary + 2 replicas = 3x total or 1.2x overhead)
}

export interface CapacityResults {
  totalWritesDay: number;
  totalReadsDay: number;
  avgWriteQps: number;
  peakWriteQps: number;
  avgReadQps: number;
  peakReadQps: number;
  peakTotalQps: number;
  dailyStorageGb: number;
  totalStorageTb: number;
  hotRamGb: number;
  networkGbps: number;
}

export interface ToleranceResult {
  passed: boolean;
  diffPercent: number;
  msg: string;
}

export interface ValidationSummary {
  qps: ToleranceResult;
  storage: ToleranceResult;
  ram: ToleranceResult;
  overallPassed: boolean;
}

const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GB = 1024 * 1024 * 1024;
const BYTES_PER_TB = 1024 * 1024 * 1024 * 1024;

/**
 * Computes deterministic throughput, storage, hot cache, and bandwidth approximations.
 */
export function calculateCapacity(params: CapacityParameters): CapacityResults {
  const peakFactor = params.peakFactor ?? 3.0;
  const replicationFactor = params.replicationFactor ?? 0.2; // 20% metadata/indexing overhead

  const totalWritesDay = params.dau * params.writesPerUser;
  const totalReadsDay = params.dau * params.readsPerUser;

  const avgWriteQps = Math.round(totalWritesDay / SECONDS_PER_DAY);
  const peakWriteQps = Math.round(avgWriteQps * peakFactor);

  const avgReadQps = Math.round(totalReadsDay / SECONDS_PER_DAY);
  const peakReadQps = Math.round(avgReadQps * peakFactor);

  const peakTotalQps = peakWriteQps + peakReadQps;

  // Daily Storage
  const dailyWriteBytes = totalWritesDay * params.avgWriteBytes;
  const dailyStorageGb = dailyWriteBytes / BYTES_PER_GB;

  // Multi-Year Storage with Replication & Indexing Overhead
  const totalStorageBytes = dailyWriteBytes * 365 * params.retentionYears * (1 + replicationFactor);
  const totalStorageTb = totalStorageBytes / BYTES_PER_TB;

  // Hot RAM: Pareto 80/20 Rule (20% of daily read volume cached in RAM)
  const dailyReadBytes = totalReadsDay * params.avgReadBytes;
  const hotRamGb = (dailyReadBytes * 0.2) / BYTES_PER_GB;

  // Network Bandwidth in Gbps (8 bits per byte)
  const peakBandwidthBytesPerSec =
    peakWriteQps * params.avgWriteBytes + peakReadQps * params.avgReadBytes;
  const networkGbps = (peakBandwidthBytesPerSec * 8) / 1_000_000_000;

  return {
    totalWritesDay,
    totalReadsDay,
    avgWriteQps,
    peakWriteQps,
    avgReadQps,
    peakReadQps,
    peakTotalQps,
    dailyStorageGb: Math.round(dailyStorageGb * 10) / 10,
    totalStorageTb: Math.round(totalStorageTb * 10) / 10,
    hotRamGb: Math.round(hotRamGb * 10) / 10,
    networkGbps: Math.round(networkGbps * 100) / 100
  };
}

/**
 * Validates candidate inputs against exact calculations within a ±25% tolerance window.
 */
export function validateCandidateCapacity(
  userInputs: { peakQps?: number | string; storageTb?: number | string; hotRamGb?: number | string },
  exactResults: CapacityResults
): ValidationSummary {
  const checkTolerance = (user: number, exact: number): ToleranceResult => {
    if (isNaN(user) || user <= 0) {
      return { passed: false, diffPercent: 100, msg: 'Не заполнено' };
    }
    const diff = Math.abs(user - exact) / exact;
    const passed = diff <= 0.25;
    return {
      passed,
      diffPercent: Math.round(diff * 100),
      msg: passed
        ? 'Отлично (в окне ±25%)'
        : diff > 2
        ? 'Ошибка на порядок (>200%)'
        : `Отклонение ${Math.round(diff * 100)}%`
    };
  };

  const qpsNum = typeof userInputs.peakQps === 'string' ? parseFloat(userInputs.peakQps) : (userInputs.peakQps ?? NaN);
  const storageNum = typeof userInputs.storageTb === 'string' ? parseFloat(userInputs.storageTb) : (userInputs.storageTb ?? NaN);
  const ramNum = typeof userInputs.hotRamGb === 'string' ? parseFloat(userInputs.hotRamGb) : (userInputs.hotRamGb ?? NaN);

  const qpsResult = checkTolerance(qpsNum, exactResults.peakTotalQps);
  const storageResult = checkTolerance(storageNum, exactResults.totalStorageTb);
  const ramResult = checkTolerance(ramNum, exactResults.hotRamGb);

  return {
    qps: qpsResult,
    storage: storageResult,
    ram: ramResult,
    overallPassed: qpsResult.passed && storageResult.passed && ramResult.passed
  };
}
