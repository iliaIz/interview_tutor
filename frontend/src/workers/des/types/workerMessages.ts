/**
 * Типы и контракты взаимодействия с DES Web Worker.
 * Zero-Allocation, строго типизированные DTO.
 */

export type TargetLevel = 'L3_JUNIOR' | 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF' | 'L7_PRINCIPAL';

export type TrafficPattern = 'POISSON' | 'BURSTY' | 'DIURNAL';

export interface TopologyNodePayload {
  id: string;
  type: string;
  title?: string;
  params: Record<string, any>;
}

export interface TopologyEdgePayload {
  id: string;
  source: string;
  target: string;
  protocol: string;
  bandwidth_limit_mbps?: number;
}

export interface ChaosScenarioPayload {
  id: string;
  name: string;
  trigger_second: number;
  duration_second: number;
  fault_type: string;
  target_node_id?: string;
  target_edge_id?: string;
  impact_multiplier: number;
}

export interface SimulationRequestMessage {
  type: 'RUN_SIMULATION';
  requestId: string;
  scenario_id: string;
  target_level: TargetLevel;
  topology: {
    nodes: TopologyNodePayload[];
    edges: TopologyEdgePayload[];
  };
  traffic: {
    pattern: TrafficPattern;
    lambda_mean_rps: number;
    inter_arrival_cv: number;
    read_ratio: number;
    prompt_tokens_mean?: number;
    generation_tokens_mean?: number;
  };
  roofline?: {
    peak_flops_tflops?: number;
    memory_bandwidth_tb_s?: number;
    weight_bits?: number;
    kv_bits?: number;
  };
  duration_seconds: number;
  enable_chaos?: boolean;
  chaos_scenarios?: ChaosScenarioPayload[];
}

export interface NodeTelemetry {
  nodeId: string;
  nodeType: string;
  arrival_rate_rps: number;
  throughput_rps: number;
  queue_depth_mean: number;
  queue_depth_p99: number;
  latency_mean_ms: number;
  latency_p99_ms: number;
  latency_p999_ms: number;
  utilization_percent: number;
  cost_monthly_usd: number;
  dropped_requests_count: number;
  is_saturated: boolean;
  
  // Single-Box / Micro-Architecture (L3/L4)
  carrier_thread_pinned?: boolean;
  hikari_pool_exhausted?: boolean;
  connection_wait_latency_ms?: number;
  nginx_disk_spool_active?: boolean;
  token_bucket_dropped_rps?: number;

  // AI & GPU (L5)
  ttft_p99_ms?: number;
  tpot_p99_ms?: number;
  kv_cache_utilization_percent?: number;
  preempted_requests_count?: number;

  // Cache & Vector (L5)
  cache_hit_rate_percent?: number;
  xfetch_early_refreshes_count?: number;
  vector_search_latency_ms?: number;

  // Planetary Systems (L6/L7)
  cell_blast_radius_percent?: number;
  allreduce_sync_latency_ms?: number;
  hlc_drift_wait_ms?: number;
}

export interface TimelineSample {
  timestamp_second: number;
  p99_latency_ms: number;
  throughput_rps: number;
  error_rate: number;
  active_chaos_events: string[];
}

export interface SimulationResponseMessage {
  type: 'SIMULATION_RESULT';
  requestId: string;
  execution_duration_ms: number;
  summary: {
    system_p99_latency_ms: number;
    system_p999_latency_ms: number;
    system_availability_nines: number;
    total_monthly_cost_usd: number;
    is_stable: boolean;
    bottleneck_node_id: string | null;
    active_invariants_passed: string[];
    active_invariants_failed: string[];
  };
  node_telemetry: Record<string, NodeTelemetry>;
  timeline_samples: TimelineSample[];
}

export interface SimulationErrorMessage {
  type: 'SIMULATION_ERROR';
  requestId: string;
  error: string;
}

export type WorkerInMessage = SimulationRequestMessage;
export type WorkerOutMessage = SimulationResponseMessage | SimulationErrorMessage;
