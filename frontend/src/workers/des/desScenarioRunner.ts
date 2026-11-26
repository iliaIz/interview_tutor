/**
 * desScenarioRunner.ts
 * Pure discrete-event simulation runner invoked by TopologySimulationKernel.
 * Zero Web Worker globals: executable directly in Node tests and worker hosts.
 */

import type {
  SimulationRequestMessage,
  SimulationResponseMessage,
  NodeTelemetry,
  TimelineSample
} from './types/workerMessages.ts';
import {
  solveHikariCP,
  solveVirtualThreadPinning,
  solveNginxBuffering
} from './solvers/singleBoxResourceSolver.ts';
import { solveDistributedQueue } from './solvers/distributedQueueSolver.ts';
import { solveAiRoofline } from './solvers/aiRooflineSolver.ts';
import { solveHnswVectorSearch, evaluateXFetch } from './solvers/vectorAndCacheSolver.ts';
import { solveCellularBlastRadius, solveHierarchicalAllReduce } from './solvers/planetaryCellularSolver.ts';
import { ChaosMonkeyEngine } from './engines/chaosMonkeyEngine.ts';
import { FinOpsCostEngine } from './engines/finOpsCostEngine.ts';
import { computeNodeArrivalRates } from './engines/trafficArrivalEngine.ts';

export function runDesScenarioCore(req: SimulationRequestMessage): SimulationResponseMessage {
  const startTime = performance.now();
  const { topology, traffic, target_level, duration_seconds = 10, chaos_scenarios = [], enable_chaos = true } = req;

  const chaosEngine = new ChaosMonkeyEngine(enable_chaos ? chaos_scenarios : []);
  const arrivalRates = computeNodeArrivalRates(
    topology.nodes,
    topology.edges,
    traffic.lambda_mean_rps,
    traffic.read_ratio
  );

  const nodeTelemetryMap: Record<string, NodeTelemetry> = {};
  let totalCostMonthly = 0;
  let maxUtilization = 0;
  let bottleneckNodeId: string | null = null;
  let totalDroppedRps = 0;
  let criticalPathLatencyP99 = 0;
  let criticalPathLatencyP999 = 0;

  for (const node of topology.nodes) {
    const arrivalRps = Math.max(1, arrivalRates.get(node.id) || traffic.lambda_mean_rps);
    const params = node.params || {};
    const type = node.type.toLowerCase();

    let nodeLatencyMean = params.query_latency_mean_ms || params.service_time_ms || 5.0;
    let nodeLatencyP99 = nodeLatencyMean * 2.0;
    let nodeLatencyP999 = nodeLatencyMean * 3.0;
    let droppedRps = 0;
    let isSaturated = false;

    let carrierPinned = false;
    let hikariExhausted = false;
    let connectionWaitMs = 0;
    let nginxSpoolActive = false;
    let ttftP99: number | undefined;
    let tpotP99: number | undefined;
    let kvUtilization: number | undefined;
    let preemptionsCount: number | undefined;
    let cacheHitRate: number | undefined;
    let xfetchRefreshes: number | undefined;
    let vectorLatency: number | undefined;
    let cellBlastRadius: number | undefined;
    let allreduceLatency: number | undefined;

    if (type.includes('rdbms') || type.includes('db') || params.hikari_pool_size) {
      const hikariRes = solveHikariCP({
        arrival_rate_rps: arrivalRps,
        pool_size: params.hikari_pool_size || params.max_connections || 20,
        cores: params.cores || 8,
        base_query_latency_ms: params.query_latency_mean_ms || 3.5,
        connection_timeout_ms: params.connection_timeout_ms || 250
      });
      hikariExhausted = hikariRes.is_exhausted;
      connectionWaitMs = hikariRes.connection_wait_ms;
      droppedRps += hikariRes.dropped_rps;
      nodeLatencyMean = hikariRes.effective_query_latency_ms + connectionWaitMs;
      nodeLatencyP99 = hikariRes.p99_latency_ms;
      nodeLatencyP999 = hikariRes.p99_latency_ms * 1.5;
      isSaturated = !hikariRes.is_stable;
    }

    if (params.uses_synchronized_blocks !== undefined) {
      const vtRes = solveVirtualThreadPinning({
        active_virtual_threads: Math.round(arrivalRps * 0.15),
        cores: params.cores || 8,
        blocking_io_latency_ms: nodeLatencyMean,
        uses_synchronized_blocks: Boolean(params.uses_synchronized_blocks)
      });
      carrierPinned = vtRes.carrier_thread_pinned;
      if (vtRes.is_starving) {
        nodeLatencyMean += vtRes.carrier_wait_latency_ms;
        nodeLatencyP99 = vtRes.effective_p99_ms;
        nodeLatencyP999 = vtRes.effective_p99_ms * 1.6;
        isSaturated = true;
      }
    }

    if (type.includes('nginx') || type.includes('reverse_proxy') || params.proxy_buffer_size_kb) {
      const nginxRes = solveNginxBuffering({
        response_body_bytes: (params.response_body_size_kb || 64) * 1024,
        proxy_buffer_size_bytes: (params.proxy_buffer_size_kb || 8) * 1024,
        proxy_buffering_enabled: params.proxy_buffering !== false
      });
      nginxSpoolActive = nginxRes.nginx_disk_spool_active;
      nodeLatencyMean = nginxRes.total_nginx_latency_ms;
      nodeLatencyP99 = nodeLatencyMean * 2.2;
    }

    if (type.includes('gpu') || type.includes('llm') || params.model_params_billions) {
      const rooflineRes = solveAiRoofline({
        model_params_billions: params.model_params_billions || 70,
        weight_precision_bytes: params.weight_precision_bytes || 2.0,
        prompt_tokens_mean: traffic.prompt_tokens_mean || 512,
        generation_tokens_mean: traffic.generation_tokens_mean || 256,
        concurrency_batch_size: Math.max(1, Math.round(arrivalRps * 0.2)),
        gpu_count: params.gpu_count || params.replicas || 8,
        use_paged_attention: params.use_paged_attention !== false
      });
      ttftP99 = rooflineRes.ttft_mean_ms * 1.5;
      tpotP99 = rooflineRes.tpot_mean_ms * 1.3;
      kvUtilization = rooflineRes.kv_cache_utilization_percent;
      preemptionsCount = rooflineRes.preempted_requests_count;
      nodeLatencyMean = rooflineRes.total_generation_latency_ms;
      nodeLatencyP99 = rooflineRes.total_generation_latency_ms * 1.35;
      nodeLatencyP999 = rooflineRes.total_generation_latency_ms * 1.8;
      if (preemptionsCount > 0) isSaturated = true;
    }

    if (type.includes('cache') || type.includes('redis')) {
      cacheHitRate = params.hit_rate_percent || 92.0;
      if (params.use_xfetch) {
        const xfetchRes = evaluateXFetch({
          current_time_sec: 100,
          key_expiry_sec: 105,
          compute_duration_sec: 1.5,
          beta: 1.0
        });
        if (xfetchRes.should_recompute_early) {
          xfetchRefreshes = Math.round(arrivalRps * 0.05);
        }
      }
    }

    if (type.includes('vector') || params.dimension) {
      const vecRes = solveHnswVectorSearch({
        index_vectors_count: params.index_vectors_count || 1_000_000,
        dimension: params.dimension || 1536,
        m_neighbors: params.m_neighbors || 32,
        ef_search: params.ef_search || 128,
        use_quantization: Boolean(params.use_quantization)
      });
      vectorLatency = vecRes.search_latency_ms;
      nodeLatencyMean = vectorLatency;
      nodeLatencyP99 = vectorLatency * 1.6;
    }

    if (target_level === 'L6_STAFF' || target_level === 'L7_PRINCIPAL' || params.total_cells_count) {
      const cellRes = solveCellularBlastRadius({
        total_cells_count: params.total_cells_count || 100,
        failed_cells_count: params.failed_cells_count || 1,
        cell_isolation_complete: params.shared_database !== true
      });
      cellBlastRadius = cellRes.blast_radius_percent;
    }

    if (params.gradient_payload_bytes || params.allreduce) {
      const reduceRes = solveHierarchicalAllReduce({
        gpus_count: params.gpus_count || 1024,
        gradient_payload_bytes: params.gradient_payload_bytes || (140 * 1024 * 1024 * 1024)
      });
      allreduceLatency = reduceRes.allreduce_duration_ms;
    }

    const replicas = params.replicas || params.cores || 4;
    const queueRes = solveDistributedQueue({
      lambda_rps: arrivalRps,
      service_time_mean_ms: Math.max(0.2, nodeLatencyMean),
      service_time_cv: 0.5,
      servers_count: replicas,
      inter_arrival_cv: traffic.inter_arrival_cv
    });

    const throughputRps = queueRes.throughput_rps;
    droppedRps += queueRes.dropped_rps;
    const finalP99 = Math.max(nodeLatencyP99, queueRes.p99_latency_ms);
    const finalP999 = Math.max(nodeLatencyP999, queueRes.p999_latency_ms);

    const costMonthly = FinOpsCostEngine.calculateNodeMonthlyCost(node, throughputRps);
    totalCostMonthly += costMonthly;
    totalDroppedRps += droppedRps;
    criticalPathLatencyP99 += finalP99;
    criticalPathLatencyP999 += finalP999;

    const utilization = Math.min(100.0, queueRes.utilization_rho * 100.0);
    if (utilization > maxUtilization) {
      maxUtilization = utilization;
      bottleneckNodeId = node.id;
    }

    nodeTelemetryMap[node.id] = {
      nodeId: node.id,
      nodeType: node.type,
      arrival_rate_rps: Math.round(arrivalRps),
      throughput_rps: Math.round(throughputRps),
      queue_depth_mean: Math.round(queueRes.mean_queue_depth * 10) / 10,
      queue_depth_p99: queueRes.p99_queue_depth,
      latency_mean_ms: Math.round(nodeLatencyMean * 100) / 100,
      latency_p99_ms: Math.round(finalP99 * 100) / 100,
      latency_p999_ms: Math.round(finalP999 * 100) / 100,
      utilization_percent: Math.round(utilization * 10) / 10,
      cost_monthly_usd: costMonthly,
      dropped_requests_count: Math.round(droppedRps),
      is_saturated: isSaturated || !queueRes.is_stable,
      carrier_thread_pinned: carrierPinned,
      hikari_pool_exhausted: hikariExhausted,
      connection_wait_latency_ms: Math.round(connectionWaitMs * 10) / 10,
      nginx_disk_spool_active: nginxSpoolActive,
      ttft_p99_ms: ttftP99 ? Math.round(ttftP99 * 10) / 10 : undefined,
      tpot_p99_ms: tpotP99 ? Math.round(tpotP99 * 10) / 10 : undefined,
      kv_cache_utilization_percent: kvUtilization ? Math.round(kvUtilization * 10) / 10 : undefined,
      preempted_requests_count: preemptionsCount,
      cache_hit_rate_percent: cacheHitRate,
      xfetch_early_refreshes_count: xfetchRefreshes,
      vector_search_latency_ms: vectorLatency ? Math.round(vectorLatency * 100) / 100 : undefined,
      cell_blast_radius_percent: cellBlastRadius,
      allreduce_sync_latency_ms: allreduceLatency ? Math.round(allreduceLatency * 10) / 10 : undefined
    };
  }

  const timelineSamples: TimelineSample[] = [];
  const duration = Math.min(60, Math.max(5, duration_seconds));
  for (let sec = 1; sec <= duration; sec++) {
    const activeFaults = chaosEngine.getActiveFaults(sec);
    let faultLatencyMultiplier = 1.0;
    let faultDropAdder = 0.0;
    for (const fault of activeFaults) {
      faultLatencyMultiplier = Math.max(faultLatencyMultiplier, fault.impact_multiplier);
      if (fault.fault_type === 'NETWORK_PARTITION') faultDropAdder = 0.45;
    }
    const baseErrorRate = totalDroppedRps / Math.max(1, traffic.lambda_mean_rps);
    const secErrorRate = Math.min(1.0, baseErrorRate + faultDropAdder);
    timelineSamples.push({
      timestamp_second: sec,
      p99_latency_ms: Math.round(criticalPathLatencyP99 * faultLatencyMultiplier * 10) / 10,
      throughput_rps: Math.round(traffic.lambda_mean_rps * (1.0 - secErrorRate)),
      error_rate: Math.round(secErrorRate * 1000) / 1000,
      active_chaos_events: activeFaults.map(f => f.name)
    });
  }

  const globalErrorFraction = totalDroppedRps / Math.max(1, traffic.lambda_mean_rps);
  const availability = Math.max(0.0, 1.0 - globalErrorFraction);
  const availabilityNines =
    availability >= 0.99999 ? 5.0 :
    availability >= 0.9999 ? 4.0 :
    availability >= 0.999 ? 3.0 :
    availability >= 0.99 ? 2.0 :
    Math.max(0, -Math.log10(Math.max(0.00001, 1.0 - availability)));
  const isStable = globalErrorFraction < 0.01 && maxUtilization < 95.0;

  return {
    type: 'SIMULATION_RESULT',
    requestId: req.requestId,
    execution_duration_ms: Math.round((performance.now() - startTime) * 100) / 100,
    summary: {
      system_p99_latency_ms: Math.round(criticalPathLatencyP99 * 10) / 10,
      system_p999_latency_ms: Math.round(criticalPathLatencyP999 * 10) / 10,
      system_availability_nines: Math.round(availabilityNines * 10) / 10,
      total_monthly_cost_usd: totalCostMonthly,
      is_stable: isStable,
      bottleneck_node_id: bottleneckNodeId,
      active_invariants_passed: isStable ? ['inv_system_stability'] : [],
      active_invariants_failed: !isStable ? ['inv_system_stability'] : []
    },
    node_telemetry: nodeTelemetryMap,
    timeline_samples: timelineSamples
  };
}
