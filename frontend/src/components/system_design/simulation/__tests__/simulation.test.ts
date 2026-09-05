import { AnalyticalPerformanceEngine } from '../AnalyticalPerformanceEngine';
import { ArchitectureTopologyLinter, LinterNode, LinterEdge } from '../ArchitectureTopologyLinter';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('🧪 Running AnalyticalPerformanceEngine & ArchitectureTopologyLinter test suite...');

// 1. Test Zipfian cache harmonic calculation
const totalCatalog = 100_000;
const cacheCap = 10_000;
const zipfAlpha = 1.3;
const hitRatio = AnalyticalPerformanceEngine.calculateCacheHitRatio(totalCatalog, cacheCap, zipfAlpha);
console.log(`Zipfian Hit Ratio for alpha=${zipfAlpha}: ${(hitRatio * 100).toFixed(2)}%`);
assert(hitRatio > 0.80 && hitRatio < 1.0, `Cache hit ratio must be > 80% under alpha=1.3 (got ${(hitRatio * 100).toFixed(2)}%)`);

// 2. Test USL Multiplier
const uslMulSingle = AnalyticalPerformanceEngine.calculateUslMultiplier(1, 0.05, 0.001);
assert(uslMulSingle === 1.0, 'USL for 1 instance must be 1.0');

const uslMul10 = AnalyticalPerformanceEngine.calculateUslMultiplier(10, 0.05, 0.001);
console.log(`USL Multiplier for N=10 (sigma=0.05, kappa=0.001): ${uslMul10.toFixed(2)}`);
assert(uslMul10 > 6.0 && uslMul10 < 10.0, 'USL for N=10 should reflect concurrency loss');

const uslOptimum = AnalyticalPerformanceEngine.calculateUslOptimalInstances(0.05, 0.001);
console.log(`USL Optimal Instances N*: ${uslOptimum}`);
assert(uslOptimum === 30, `USL optimal N* should be floor(sqrt((1-0.05)/0.001)) = 30 (got ${uslOptimum})`);

// 3. Test M/M/c/K finite buffer drop & queueing
const mmckMetrics = AnalyticalPerformanceEngine.evaluate({
  arrivalRate: 2000,
  serviceRate: 300,
  instances: 5, // total capacity 1500 < arrival 2000 -> saturated!
  bufferCapacity: 20
});

console.log(`M/M/c/K dropProbability: ${(mmckMetrics.dropProbability * 100).toFixed(2)}%, effectiveArrival: ${mmckMetrics.effectiveArrivalRate.toFixed(1)} req/s`);
assert(mmckMetrics.dropProbability > 0.15, 'M/M/c/K must shed load when arrival > service capacity');
assert(mmckMetrics.effectiveArrivalRate < 2000, 'Effective accepted rate must be lower than inbound arrival rate');

// 4. Test M/M/c stable infinite buffer
const mmcMetrics = AnalyticalPerformanceEngine.evaluate({
  arrivalRate: 800,
  serviceRate: 300,
  instances: 4 // total capacity 1200 > arrival 800 -> rho = 800 / 1200 = 0.666
});

console.log(`M/M/c utilization: ${(mmcMetrics.utilization * 100).toFixed(1)}%, p50: ${mmcMetrics.p50LatencyMs.toFixed(1)}ms, p99: ${mmcMetrics.p99LatencyMs.toFixed(1)}ms`);
assert(mmcMetrics.dropProbability === 0.0, 'Stable M/M/c must have zero drop');
assert(mmcMetrics.utilization < 0.70, 'Utilization should be ~66.7%');
assert(mmcMetrics.p50LatencyMs > 0 && mmcMetrics.p99LatencyMs > mmcMetrics.p50LatencyMs, 'P99 must be greater than P50');

// 5. Test Tarjan SPOF Detection
const nodes: LinterNode[] = [
  { id: 'client-1', type: 'client', data: { nodeType: 'client', instances: 1 } },
  { id: 'gateway-1', type: 'gateway', data: { nodeType: 'gateway', instances: 1 } }, // SPOF!
  { id: 'service-a', type: 'service', data: { nodeType: 'service', instances: 3 } },
  { id: 'db-1', type: 'database', data: { nodeType: 'database', instances: 1 } }, // SPOF!
];

const edges: LinterEdge[] = [
  { id: 'e1', source: 'client-1', target: 'gateway-1' },
  { id: 'e2', source: 'gateway-1', target: 'service-a' },
  { id: 'e3', source: 'service-a', target: 'db-1' }
];

const diagnostics = ArchitectureTopologyLinter.lint(nodes, edges);
console.log(`Linter diagnostics found: ${diagnostics.length}`);
diagnostics.forEach(d => console.log(`  [${d.severity.toUpperCase()}] ${d.ruleId}: ${d.message}`));

const hasGatewaySpof = diagnostics.some(d => d.ruleId === 'SPOF_NODE' && d.affectedNodeIds.includes('gateway-1'));
const hasDbSpof = diagnostics.some(d => d.ruleId === 'SPOF_NODE' && d.affectedNodeIds.includes('db-1'));
assert(hasGatewaySpof, 'Gateway with instances=1 must be flagged as SPOF_NODE');
assert(hasDbSpof, 'Database with instances=1 must be flagged as SPOF_NODE');

// 6. Test Cycle Detection
const cycleNodes: LinterNode[] = [
  { id: 'svc-A', type: 'service', data: { nodeType: 'service', instances: 2 } },
  { id: 'svc-B', type: 'service', data: { nodeType: 'service', instances: 2 } },
  { id: 'svc-C', type: 'service', data: { nodeType: 'service', instances: 2 } },
];
const cycleEdges: LinterEdge[] = [
  { id: 'ce1', source: 'svc-A', target: 'svc-B', data: { protocol: 'REST' } },
  { id: 'ce2', source: 'svc-B', target: 'svc-C', data: { protocol: 'REST' } },
  { id: 'ce3', source: 'svc-C', target: 'svc-A', data: { protocol: 'REST' } }, // Cycle!
];

const cycleDiagnostics = ArchitectureTopologyLinter.lint(cycleNodes, cycleEdges);
const hasCycleDiag = cycleDiagnostics.some(d => d.ruleId === 'SYNC_RPC_CYCLE');
console.log('Cycle test diagnostics:', cycleDiagnostics.map(d => d.ruleId));
assert(hasCycleDiag, 'Synchronous cycle svc-A -> svc-B -> svc-C -> svc-A must be flagged');

// 7. Test DIRECT_DB_INGRESS
const ingressNodes: LinterNode[] = [
  { id: 'client-bad', type: 'client', data: { nodeType: 'client' } },
  { id: 'db-direct', type: 'database', data: { nodeType: 'database' } }
];
const ingressEdges: LinterEdge[] = [
  { id: 'bad-edge', source: 'client-bad', target: 'db-direct' }
];
const ingressDiagnostics = ArchitectureTopologyLinter.lint(ingressNodes, ingressEdges);
const hasDirectIngress = ingressDiagnostics.some(d => d.ruleId === 'DIRECT_DB_INGRESS');
assert(hasDirectIngress, 'Direct client to DB call must be flagged as DIRECT_DB_INGRESS');

console.log('🎉 ALL 7 TEST SUITES PASSED FLAWLESSLY!');
