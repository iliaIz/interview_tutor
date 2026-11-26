/**
 * topologySimulationKernel.test.ts
 * Pure in-process contract tests for TopologySimulationKernel (Spec 52 / #189).
 */

import assert from 'assert';
import {
  createContinuousSimState,
  updateContinuousTopology,
  triggerContinuousChaos,
  stepContinuousSimulation,
  lintTopology,
  runDesScenario
} from '../src/components/system_design/simulation/TopologySimulationKernel';

console.log('🧪 Running TopologySimulationKernel in-process contract tests...');

// Test 1: Cache miss physics honors engineEval.cacheHitRatio & explicit 0 override
{
  const stateDefaultCache = createContinuousSimState({ inputRps: 1000 });
  updateContinuousTopology(
    stateDefaultCache,
    [
      { id: 'c1', type: 'client', label: 'Client', config: { serviceRateMu: 5000 } },
      { id: 'cache1', type: 'cache', label: 'Redis', config: { readWriteRatio: 0.9, replicas: 2 } },
      { id: 'db1', type: 'database', label: 'Postgres', config: { replicas: 2, serviceRateMu: 5000 } }
    ],
    [
      { id: 'e1', source: 'c1', target: 'cache1', protocol: 'REST', isAsync: false, timeoutMs: 1000 },
      { id: 'e2', source: 'cache1', target: 'db1', protocol: 'JDBC', isAsync: false, timeoutMs: 1000 }
    ]
  );
  const frameZipf = stepContinuousSimulation(stateDefaultCache, 0.1);
  const dbWithZipf = frameZipf.nodeMetrics['db1'].currentRps;
  assert(dbWithZipf < 250 && dbWithZipf > 50, `Expected Zipfian cache miss + write RPS (<250), got ${dbWithZipf}`);

  // Explicit 0% cache hit ratio must NOT coerce via `|| 0.85` fallback
  const stateZeroCache = createContinuousSimState({ inputRps: 1000 });
  updateContinuousTopology(
    stateZeroCache,
    [
      { id: 'c1', type: 'client', label: 'Client', config: { serviceRateMu: 5000 } },
      { id: 'cache1', type: 'cache', label: 'Redis', config: { cacheHitRatio: 0, replicas: 2 } },
      { id: 'db1', type: 'database', label: 'Postgres', config: { replicas: 2, serviceRateMu: 5000 } }
    ],
    [
      { id: 'e1', source: 'c1', target: 'cache1', protocol: 'REST', isAsync: false, timeoutMs: 1000 },
      { id: 'e2', source: 'cache1', target: 'db1', protocol: 'JDBC', isAsync: false, timeoutMs: 1000 }
    ]
  );
  const frameZero = stepContinuousSimulation(stateZeroCache, 0.1);
  assert.strictEqual(frameZero.nodeMetrics['db1'].currentRps, 1000, 'Explicit cacheHitRatio=0 must pass 100% traffic to DB');
  console.log('  ✅ Test 1 Passed: Zipfian engineEval.cacheHitRatio & zero-hit cache propagation exact.');
}

// Test 2: Deterministic chaos recovery without timers & cyclic deadlock safety
{
  const state = createContinuousSimState({ inputRps: 500 });
  updateContinuousTopology(
    state,
    [
      { id: 's1', type: 'service', label: 'Auth', config: {} },
      { id: 's2', type: 'service', label: 'Billing', config: {} }
    ],
    [
      { id: 'e1', source: 's1', target: 's2', protocol: 'gRPC', isAsync: false, timeoutMs: 1000 },
      { id: 'e2', source: 's2', target: 's1', protocol: 'gRPC', isAsync: false, timeoutMs: 1000 }
    ]
  );
  triggerContinuousChaos(state, 'latency_spike', 's1');
  const openFrame = stepContinuousSimulation(state, 1.0);
  assert.strictEqual(openFrame.chaosState.circuitBreakerState, 'OPEN');
  assert(openFrame.antiPatterns.some((a) => a.type === 'cyclic_dependency'), 'Cyclic graph detects cycle safely');

  const halfOpenFrame = stepContinuousSimulation(state, 15.0);
  assert.strictEqual(halfOpenFrame.chaosState.circuitBreakerState, 'HALF_OPEN', '15s expiry enters HALF_OPEN');
  const closedFrame = stepContinuousSimulation(state, 3.5);
  assert.strictEqual(closedFrame.chaosState.circuitBreakerState, 'CLOSED', '3s half-open recovers to CLOSED');
  console.log('  ✅ Test 2 Passed: Deterministic chaos FSM transitions & cyclic graph protection.');
}

// Test 3: lintTopology detects single-replica bottleneck SPOF vs multi-replica HA
{
  const { spofMap } = lintTopology(
    [
      { id: 'gw', type: 'gateway', data: { label: 'Gateway', config: { replicas: 1 } } },
      { id: 'svc', type: 'service', data: { label: 'Core', config: { replicas: 3 } } },
      { id: 'db', type: 'database', data: { label: 'DB', config: { replicas: 1 } } }
    ],
    [
      { source: 'gw', target: 'svc' },
      { source: 'svc', target: 'db' }
    ]
  );
  assert.strictEqual(spofMap.get('gw')?.isSpof, true, '1-replica ingress bottleneck flagged as SPOF');
  assert.strictEqual(spofMap.get('svc')?.isSpof, false, '3-replica articulation node not flagged as SPOF');
  assert.strictEqual(spofMap.get('db')?.isSpof, true, '1-replica sole database flagged as SPOF');
  console.log('  ✅ Test 3 Passed: lintTopology accurately identifies single-replica SPOFs.');
}

// Test 4: runDesScenario computes discrete-event scenario without Worker globals
{
  const desRes = runDesScenario({
    type: 'RUN_SIMULATION',
    requestId: 'req_kernel_01',
    topology: {
      nodes: [
        { id: 'api', type: 'service', label: 'Order API', params: { replicas: 4, service_time_ms: 8 } },
        { id: 'pg', type: 'rdbms', label: 'Orders DB', params: { hikari_pool_size: 20, cores: 8, query_latency_mean_ms: 4 } }
      ],
      edges: [{ source: 'api', target: 'pg', protocol: 'JDBC' }]
    },
    traffic: { lambda_mean_rps: 800, read_ratio: 0.8, inter_arrival_cv: 1.0 },
    duration_seconds: 5,
    enable_chaos: false
  } as any);
  assert.strictEqual(desRes.type, 'SIMULATION_RESULT');
  assert.strictEqual(desRes.timeline_samples.length, 5);
  assert(desRes.node_telemetry['pg'] !== undefined, 'DB telemetry computed in-process');
  console.log('  ✅ Test 4 Passed: runDesScenario executes deterministically in Node.');
}

console.log('🎉 ALL TOPOLOGY SIMULATION KERNEL TESTS PASSED!');
