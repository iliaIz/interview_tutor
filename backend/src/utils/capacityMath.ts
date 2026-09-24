/**
 * L1 Capacity Math Engine (Back-of-the-Envelope Calculations)
 * Authoritative backend implementation adhering to Pillar 4 SSOT
 */

export interface CapacityParameters {
  dau: number;
  writesPerUser: number;
  readsPerUser: number;
  avgWriteBytes: number;
  avgReadBytes: number;
  retentionYears: number;
  peakFactor?: number;
  replicationFactor?: number;
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

const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GB = 1024 * 1024 * 1024;
const BYTES_PER_TB = 1024 * 1024 * 1024 * 1024;

export function calculateCapacity(params: CapacityParameters): CapacityResults {
  const peakFactor = params.peakFactor ?? 3.0;
  const replicationFactor = params.replicationFactor ?? 0.2;

  const totalWritesDay = params.dau * params.writesPerUser;
  const totalReadsDay = params.dau * params.readsPerUser;

  const avgWriteQps = Math.round(totalWritesDay / SECONDS_PER_DAY);
  const peakWriteQps = Math.round(avgWriteQps * peakFactor);

  const avgReadQps = Math.round(totalReadsDay / SECONDS_PER_DAY);
  const peakReadQps = Math.round(avgReadQps * peakFactor);

  const peakTotalQps = peakWriteQps + peakReadQps;

  const dailyWriteBytes = totalWritesDay * params.avgWriteBytes;
  const dailyStorageGb = dailyWriteBytes / BYTES_PER_GB;

  const totalStorageBytes = dailyWriteBytes * 365 * params.retentionYears * (1 + replicationFactor);
  const totalStorageTb = totalStorageBytes / BYTES_PER_TB;

  const dailyReadBytes = totalReadsDay * params.avgReadBytes;
  const hotRamGb = (dailyReadBytes * 0.2) / BYTES_PER_GB;

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
