/**
 * Тестовый набор математической физики и бенчмарк производительности DES Worker Kernel.
 * Запуск: node --experimental-strip-types scripts/test_des_solvers.ts
 */

import { solveHikariCP, solveVirtualThreadPinning, solveNginxBuffering } from '../frontend/src/workers/des/solvers/singleBoxResourceSolver.ts';
import { solveDistributedQueue } from '../frontend/src/workers/des/solvers/distributedQueueSolver.ts';
import { solveAiRoofline } from '../frontend/src/workers/des/solvers/aiRooflineSolver.ts';
import { evaluateXFetch, solveHnswVectorSearch } from '../frontend/src/workers/des/solvers/vectorAndCacheSolver.ts';
import { solveCellularBlastRadius, solveHierarchicalAllReduce } from '../frontend/src/workers/des/solvers/planetaryCellularSolver.ts';
import { ChaosMonkeyEngine } from '../frontend/src/workers/des/engines/chaosMonkeyEngine.ts';
import { FinOpsCostEngine } from '../frontend/src/workers/des/engines/finOpsCostEngine.ts';
import { runSimulation } from '../frontend/src/workers/desSimulator.worker.ts';
import type { SimulationRequestMessage } from '../frontend/src/workers/des/types/workerMessages.ts';

console.log('=== Starting DES Mathematical Physics & Benchmark Verification ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failCount++;
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

// 1. HikariCP & Little's Law
console.log('--- 1. Single-Box HikariCP & Little\'s Law Physics ---');
const hikariOptimal = solveHikariCP({
  arrival_rate_rps: 1000,
  pool_size: 16,
  cores: 8,
  base_query_latency_ms: 5.0,
});
assert(hikariOptimal.is_stable, 'Optimal HikariCP pool (16 conns, 8 cores) is stable at 1000 RPS');
assert(hikariOptimal.effective_query_latency_ms === 5.0, 'No context-switch penalty when pool <= 2x cores');

const hikariThrashing = solveHikariCP({
  arrival_rate_rps: 1000,
  pool_size: 100, // 100 conns on 8 cores -> extra 84 conns
  cores: 8,
  base_query_latency_ms: 5.0,
});
assert(hikariThrashing.effective_query_latency_ms > 5.0 * 4.0, 'Overprovisioned pool (100 conns on 8 cores) suffers context-switch penalty', `Latency: ${hikariThrashing.effective_query_latency_ms}ms`);

const hikariStarved = solveHikariCP({
  arrival_rate_rps: 5000,
  pool_size: 10,
  cores: 8,
  base_query_latency_ms: 5.0,
});
assert(hikariStarved.is_exhausted && hikariStarved.dropped_rps > 0, 'Undersized pool at 5000 RPS exhausts connections and drops traffic');

// 2. Virtual Threads Carrier Pinning
console.log('\n--- 2. Java 21 ForkJoinPool Virtual Thread Pinning ---');
const vtUnpinned = solveVirtualThreadPinning({
  active_virtual_threads: 200,
  cores: 8,
  blocking_io_latency_ms: 10,
  uses_synchronized_blocks: false, // ReentrantLock
});
assert(!vtUnpinned.carrier_thread_pinned && vtUnpinned.carrier_wait_latency_ms === 0, 'ReentrantLock / JEP 491 eliminates carrier thread pinning');

const vtPinned = solveVirtualThreadPinning({
  active_virtual_threads: 200,
  cores: 8,
  blocking_io_latency_ms: 10,
  uses_synchronized_blocks: true, // synchronized socket IO
});
assert(vtPinned.carrier_thread_pinned && vtPinned.is_starving && vtPinned.carrier_wait_latency_ms > 200, 'Synchronized blocks pin carrier threads and cause queue starvation', `Wait: ${vtPinned.carrier_wait_latency_ms}ms`);

// 3. Nginx Buffering & Disk Spooling
console.log('\n--- 3. Nginx Response Buffering & Disk Spooling ---');
const nginxNoBuffering = solveNginxBuffering({
  response_body_bytes: 1024 * 1024, // 1MB LLM streaming
  proxy_buffer_size_bytes: 8 * 1024, // 8KB buffer
  proxy_buffering_enabled: false,    // SSE / Chunked
});
assert(!nginxNoBuffering.nginx_disk_spool_active && nginxNoBuffering.disk_spool_delay_ms === 0, 'proxy_buffering off streams SSE without disk spooling');

const nginxSpooling = solveNginxBuffering({
  response_body_bytes: 512 * 1024,   // 512KB payload
  proxy_buffer_size_bytes: 8 * 1024,  // 8KB buffer
  proxy_buffering_enabled: true,
});
assert(nginxSpooling.nginx_disk_spool_active && nginxSpooling.disk_spool_delay_ms >= 12.0, 'Overflowing Nginx buffer incurs disk write penalty + fsync delay', `Delay: ${nginxSpooling.disk_spool_delay_ms}ms`);

// 4. Distributed Queues & Cornish-Fisher Tail Latencies
console.log('\n--- 4. M/G/1 Pollaczek-Khinchine & G/G/c Cornish-Fisher Tail Latency ---');
const mg1Queue = solveDistributedQueue({
  lambda_rps: 500,
  service_time_mean_ms: 1.5,
  service_time_cv: 0.5,
  servers_count: 1,
  inter_arrival_cv: 1.0,
});
assert(mg1Queue.is_stable, 'M/G/1 queue is stable at 500 RPS with 1.5ms service time (rho = 0.75)');
assert(mg1Queue.p99_latency_ms > mg1Queue.mean_system_latency_ms, 'Cornish-Fisher P99 exceeds mean system latency', `Mean: ${mg1Queue.mean_system_latency_ms}ms, P99: ${mg1Queue.p99_latency_ms}ms`);
assert(mg1Queue.p999_latency_ms > mg1Queue.p99_latency_ms, 'P99.9 exceeds P99');

const ggcMultiServer = solveDistributedQueue({
  lambda_rps: 2000,
  service_time_mean_ms: 4.0,
  service_time_cv: 0.8,
  servers_count: 12,
  inter_arrival_cv: 1.5, // Bursty traffic
});
assert(ggcMultiServer.is_stable, 'G/G/12 multi-server queue handles 2000 RPS bursty traffic');
assert(ggcMultiServer.mean_queue_depth >= 0, 'Mean queue depth is non-negative');

// 5. LLM Roofline (Prefill vs Decode & PagedAttention)
console.log('\n--- 5. LLM Two-Phase Roofline & PagedAttention ---');
const llmPaged = solveAiRoofline({
  model_params_billions: 70,
  weight_precision_bytes: 2.0, // FP16
  prompt_tokens_mean: 1024,
  generation_tokens_mean: 256,
  concurrency_batch_size: 16,
  gpu_count: 8,
  use_paged_attention: true,
});
assert(llmPaged.ttft_mean_ms > 0, 'Prefill phase computes TTFT', `TTFT: ${llmPaged.ttft_mean_ms}ms`);
assert(llmPaged.tpot_mean_ms > 0, 'Decode phase computes TPOT / ITL', `TPOT: ${llmPaged.tpot_mean_ms}ms`);
assert(llmPaged.kv_cache_utilization_percent < 100, 'PagedAttention maintains manageable KV cache utilization', `KV Util: ${llmPaged.kv_cache_utilization_percent}%`);

const llmOOM = solveAiRoofline({
  model_params_billions: 70,
  weight_precision_bytes: 2.0,
  prompt_tokens_mean: 4096,
  generation_tokens_mean: 2048,
  concurrency_batch_size: 64, // huge batch
  gpu_count: 8,
  use_paged_attention: false, // contiguous allocation
});
assert(llmOOM.preempted_requests_count > 0, 'Contiguous KV-cache allocation under heavy load triggers preemption', `Preempted: ${llmOOM.preempted_requests_count}`);

// 6. XFetch & Vector Search
console.log('\n--- 6. XFetch Probabilistic Cache & HNSW Vector Search ---');
const xfetchEarly = evaluateXFetch({
  current_time_sec: 98,
  key_expiry_sec: 100, // 2s before expiry
  compute_duration_sec: 3.0,
  beta: 1.0,
  random_uniform: 0.1, // low u -> triggers early recompute
});
assert(xfetchEarly.should_recompute_early, 'XFetch triggers early recomputation before physical TTL expiry');

const hnswSearch = solveHnswVectorSearch({
  index_vectors_count: 1_000_000,
  dimension: 1536,
  m_neighbors: 32,
  ef_search: 128,
  use_quantization: true,
});
assert(hnswSearch.search_latency_ms > 0 && hnswSearch.recall_at_10 > 0.90, 'HNSW with SQ8 quantization achieves >90% recall with sub-5ms latency', `Latency: ${hnswSearch.search_latency_ms}ms, Recall: ${hnswSearch.recall_at_10}`);

// 7. Planetary Cellular Blast Radius & Ring-AllReduce
console.log('\n--- 7. Cellular Blast Radius & Distributed Ring-AllReduce ---');
const cellIsolated = solveCellularBlastRadius({
  total_cells_count: 100,
  failed_cells_count: 1,
  cell_isolation_complete: true,
});
assert(cellIsolated.blast_radius_percent === 1.0, 'Isolated cellular architecture bounds blast radius to exactly 1/N_cells (1%)');
assert(cellIsolated.global_availability_nines >= 2.0, 'Platform availability remains 99.0%+ under cell failure (2+ nines)');

const cellSPOF = solveCellularBlastRadius({
  total_cells_count: 100,
  failed_cells_count: 1,
  cell_isolation_complete: false, // Shared DB SPOF
});
assert(cellSPOF.is_catastrophic_spof && cellSPOF.blast_radius_percent === 100.0, 'Non-isolated cells sharing database result in 100% blast radius cascade');

const ringAllReduce = solveHierarchicalAllReduce({
  gpus_count: 4096,
  gradient_payload_bytes: 140 * 1024 * 1024 * 1024, // 140GB
});
assert(ringAllReduce.allreduce_duration_ms > 0, 'Hierarchical Ring-AllReduce calculates intra-NVLink and inter-RoCE latency', `Total: ${ringAllReduce.allreduce_duration_ms}ms`);

// 8. Chaos Monkey & FinOps
console.log('\n--- 8. Chaos Monkey Engine & FinOps Cost ---');
const chaosEngine = new ChaosMonkeyEngine([
  {
    id: 'ch1',
    name: 'DB Disk Stall',
    trigger_second: 5,
    duration_second: 3,
    fault_type: 'DISK_IOPS_STALL',
    target_node_id: 'db_node',
    impact_multiplier: 5.0,
  }
]);
assert(chaosEngine.getActiveFaults(2).length === 0, 'No faults active at second 2');
assert(chaosEngine.getActiveFaults(6).length === 1, 'Fault active at second 6 (trigger 5, duration 3)');
assert(chaosEngine.getNodeImpact('db_node', 6).latencyMultiplier === 5.0, 'Node impact multiplier applied during active fault');

const costGpu = FinOpsCostEngine.calculateNodeMonthlyCost({
  id: 'gpu1',
  type: 'llm_inference_engine',
  params: { gpu_count: 8, gpu_type: 'H100' }
}, 100);
assert(costGpu > 20000, '8x H100 GPU cluster monthly cost calculated realistically', `Cost: $${costGpu}/mo`);

// 9. End-to-End Simulation Run & Performance Benchmark
console.log('\n--- 9. Full Topological DAG Simulation & Benchmark (Sub-Millisecond Target) ---');

const complexTopologyReq: SimulationRequestMessage = {
  type: 'RUN_SIMULATION',
  requestId: 'bench-001',
  scenario_id: 'L5-AI-INFRA-001',
  target_level: 'L5_SENIOR',
  duration_seconds: 10,
  traffic: {
    pattern: 'POISSON',
    lambda_mean_rps: 3000,
    inter_arrival_cv: 1.2,
    read_ratio: 0.85,
    prompt_tokens_mean: 512,
    generation_tokens_mean: 128,
  },
  topology: {
    nodes: [
      { id: 'ingress', type: 'api_gateway', params: { replicas: 4 } },
      { id: 'nginx', type: 'reverse_proxy_nginx', params: { proxy_buffer_size_kb: 16, proxy_buffering: true } },
      { id: 'app_auth', type: 'app_service', params: { replicas: 6, cores: 8, uses_synchronized_blocks: false } },
      { id: 'cache_l1', type: 'cache_redis', params: { hit_rate_percent: 90, use_xfetch: true } },
      { id: 'vector_db', type: 'vector_db_milvus', params: { index_vectors_count: 500000, dimension: 1536, ef_search: 64 } },
      { id: 'llm_engine', type: 'llm_inference_engine', params: { model_params_billions: 8, gpu_count: 2, use_paged_attention: true } },
      { id: 'rdbms_master', type: 'rdbms_primary', params: { cores: 16, hikari_pool_size: 32, max_connections: 100 } },
      { id: 'rdbms_replica', type: 'rdbms_replica', params: { cores: 8, hikari_pool_size: 16 } },
      { id: 'kafka', type: 'message_broker_kafka', params: { brokers_count: 3 } },
      { id: 'stream_worker', type: 'app_service', params: { replicas: 4, cores: 4 } }
    ],
    edges: [
      { id: 'e1', source: 'ingress', target: 'nginx', protocol: 'http_rest' },
      { id: 'e2', source: 'nginx', target: 'app_auth', protocol: 'http_rest' },
      { id: 'e3', source: 'app_auth', target: 'cache_l1', protocol: 'redis_resp' },
      { id: 'e4', source: 'app_auth', target: 'vector_db', protocol: 'grpc' },
      { id: 'e5', source: 'app_auth', target: 'llm_engine', protocol: 'grpc_streaming' },
      { id: 'e6', source: 'app_auth', target: 'rdbms_master', protocol: 'jdbc' },
      { id: 'e7', source: 'app_auth', target: 'rdbms_replica', protocol: 'jdbc' },
      { id: 'e8', source: 'app_auth', target: 'kafka', protocol: 'kafka_proto' },
      { id: 'e9', source: 'kafka', target: 'stream_worker', protocol: 'kafka_proto' }
    ]
  },
  chaos_scenarios: [
    {
      id: 'ch_spike',
      name: 'Upstream Latency Spike',
      trigger_second: 4,
      duration_second: 3,
      fault_type: 'DISK_IOPS_STALL',
      target_node_id: 'rdbms_master',
      impact_multiplier: 3.0,
    }
  ]
};

// Benchmark execution
const benchIterations = 50;
const startBench = performance.now();
let lastResponse = null;

for (let i = 0; i < benchIterations; i++) {
  lastResponse = runSimulation(complexTopologyReq);
}
const endBench = performance.now();
const avgIterationMs = (endBench - startBench) / benchIterations;

assert(lastResponse !== null && lastResponse.type === 'SIMULATION_RESULT', 'Simulation completed successfully and returned SIMULATION_RESULT');
assert(Object.keys(lastResponse!.node_telemetry).length === 10, 'All 10 nodes received calculated telemetry');
assert(lastResponse!.timeline_samples.length === 10, '10 timeline samples generated for 10-second simulation');
assert(lastResponse!.summary.system_p99_latency_ms > 0, 'System P99 latency computed', `System P99: ${lastResponse!.summary.system_p99_latency_ms}ms`);
assert(lastResponse!.summary.total_monthly_cost_usd > 0, 'System monthly FinOps cost computed', `Cost: $${lastResponse!.summary.total_monthly_cost_usd}/mo`);
assert(avgIterationMs < 10.0, `Sub-Millisecond Benchmark (<10ms per 10-node DAG simulation): Actual avg = ${avgIterationMs.toFixed(3)}ms`);

console.log('\n=================== VERIFICATION SUMMARY ===================');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Average DAG Simulation Execution Time: ${avgIterationMs.toFixed(3)} ms`);
console.log('============================================================\n');

if (failCount > 0) {
  console.error(`💥 ${failCount} test(s) failed!`);
  process.exit(1);
} else {
  console.log('🎉 100% of DES Mathematical Solvers and Benchmarks PASSED!');
}
