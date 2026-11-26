/**
 * TopologySimulationKernel.ts
 * Unified pure in-process System Design simulation and topology linting kernel (Spec 52).
 * Exposes stepContinuousSimulation, runDesScenario, and lintTopology without DOM/Worker globals.
 */

import {
  ArchitectureNodeConfig,
  ArchitectureNodeType,
  AntiPatternWarning,
  ChaosEventType,
  ChaosState,
  NodeHealthStatus,
  NodeLiveMetrics,
  EdgeLiveMetrics,
  SimulationTelemetryFrame
} from '../../../types/systemDesignCanvas';
import type { SimulationRequestMessage, SimulationResponseMessage } from '../../../workers/des/types/workerMessages';
import { runDesScenarioCore } from '../../../workers/des/desScenarioRunner';
import { AnalyticalPerformanceEngine } from './AnalyticalPerformanceEngine';
import {
  evaluateTopologyLint,
  SpofNodeAnalysis,
  GraphNodeLike,
  GraphEdgeLike
} from './linter/topologySpofLinter';

export type { SpofNodeAnalysis, GraphNodeLike, GraphEdgeLike };
export const lintTopology = evaluateTopologyLint;

export interface SimNodeInput {
  id: string;
  type: ArchitectureNodeType;
  label: string;
  config: ArchitectureNodeConfig;
}

export interface SimEdgeInput {
  id: string;
  source: string;
  target: string;
  protocol: string;
  isAsync: boolean;
  timeoutMs: number;
  trafficWeight?: number;
}

export interface ContinuousSimState {
  nodes: Map<string, SimNodeInput>;
  edges: SimEdgeInput[];
  inputRps: number;
  chaosState: ChaosState;
  chaosRemainingSec: number;
  halfOpenRemainingSec: number;
}

const CHAOS_DESCRIPTIONS: Record<ChaosEventType, string> = {
  kill_primary: '💥 PostgreSQL Master упал! Patroni выполняет failover и перевыборы лидера (12 сек).',
  network_partition: '🌐 Разрыв сети между ДЦ. Реплики недоступны, кворум нарушен.',
  latency_spike: '🐢 Downstream сервис отвечает с задержкой 5,000мс. Сработал Circuit Breaker (OPEN).',
  black_friday: '🔥 Black Friday! Входящий трафик подскочил в 10 раз.',
  reset_chaos: ''
};

export function createContinuousSimState(init?: { inputRps?: number }): ContinuousSimState {
  return {
    nodes: new Map(),
    edges: [],
    inputRps: Math.max(10, init?.inputRps ?? 1000),
    chaosState: { activeChaos: null, circuitBreakerState: 'CLOSED' },
    chaosRemainingSec: 0,
    halfOpenRemainingSec: 0
  };
}

export function updateContinuousTopology(
  state: ContinuousSimState,
  nodes: SimNodeInput[],
  edges: SimEdgeInput[],
  inputRps?: number
): void {
  state.nodes.clear();
  for (const n of nodes) state.nodes.set(n.id, n);
  state.edges = edges;
  if (inputRps !== undefined) state.inputRps = Math.max(10, inputRps);
}

export function triggerContinuousChaos(
  state: ContinuousSimState,
  chaosType: ChaosEventType,
  targetNodeId?: string
): void {
  if (chaosType === 'reset_chaos') {
    state.chaosState = { activeChaos: null, circuitBreakerState: 'CLOSED' };
    state.chaosRemainingSec = 0;
    state.halfOpenRemainingSec = 0;
    return;
  }
  const durationSec = chaosType === 'kill_primary' ? 12 : 15;
  state.chaosState = {
    activeChaos: chaosType,
    affectedNodeId: targetNodeId,
    remainingSeconds: durationSec,
    circuitBreakerState: chaosType === 'latency_spike' ? 'OPEN' : 'CLOSED',
    description: CHAOS_DESCRIPTIONS[chaosType] || ''
  };
  state.chaosRemainingSec = durationSec;
  state.halfOpenRemainingSec = 0;
}

function advanceChaosTimers(state: ContinuousSimState, dtSec: number): void {
  if (state.halfOpenRemainingSec > 0) {
    state.halfOpenRemainingSec = Math.max(0, state.halfOpenRemainingSec - dtSec);
    if (state.halfOpenRemainingSec === 0 && state.chaosState.circuitBreakerState === 'HALF_OPEN') {
      state.chaosState.circuitBreakerState = 'CLOSED';
    }
  }
  if (state.chaosState.activeChaos && state.chaosRemainingSec > 0) {
    state.chaosRemainingSec = Math.max(0, state.chaosRemainingSec - dtSec);
    state.chaosState.remainingSeconds = Math.ceil(state.chaosRemainingSec);
    if (state.chaosRemainingSec === 0) {
      if (state.chaosState.activeChaos === 'latency_spike') {
        state.chaosState.circuitBreakerState = 'HALF_OPEN';
        state.halfOpenRemainingSec = 3.0;
      }
      state.chaosState.activeChaos = null;
    }
  }
}

function topologicalSortNodes(nodes: Map<string, SimNodeInput>, edges: SimEdgeInput[]): { sortedOrder: string[]; hasCycle: boolean } {
  const inDegrees = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((_, id) => {
    inDegrees.set(id, 0);
    adj.set(id, []);
  });
  for (const edge of edges) {
    if (nodes.has(edge.source) && nodes.has(edge.target)) {
      inDegrees.set(edge.target, (inDegrees.get(edge.target) || 0) + 1);
      adj.get(edge.source)!.push(edge.target);
    }
  }
  const queue: string[] = [];
  inDegrees.forEach((deg, id) => { if (deg === 0) queue.push(id); });
  const sortedOrder: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    sortedOrder.push(u);
    for (const v of adj.get(u) || []) {
      const next = inDegrees.get(v)! - 1;
      inDegrees.set(v, next);
      if (next === 0) queue.push(v);
    }
  }
  return { sortedOrder, hasCycle: sortedOrder.length < nodes.size };
}

export function stepContinuousSimulation(state: ContinuousSimState, dtSec: number = 0.1): SimulationTelemetryFrame {
  advanceChaosTimers(state, dtSec);
  const effectiveInputRps = state.chaosState.activeChaos === 'black_friday' ? state.inputRps * 10 : state.inputRps;
  const { sortedOrder, hasCycle } = topologicalSortNodes(state.nodes, state.edges);

  const graphNodes: GraphNodeLike[] = Array.from(state.nodes.values()).map((n) => ({
    id: n.id, type: n.type, data: { nodeType: n.type, label: n.label, config: n.config }
  }));
  const { antiPatterns } = lintTopology(graphNodes, state.edges);

  const nodeIncomingRps = new Map<string, number>();
  const nodeMetrics: Record<string, NodeLiveMetrics> = {};
  const edgeMetrics: Record<string, EdgeLiveMetrics> = {};

  if (hasCycle && !antiPatterns.some((a) => a.type === 'cyclic_dependency')) {
    const cyclicNodeIds = Array.from(state.nodes.keys()).filter((id) => !sortedOrder.includes(id));
    antiPatterns.push({
      id: 'cyclic_dep',
      type: 'cyclic_dependency',
      severity: 'critical',
      title: 'Обнаружена циклическая зависимость (Deadlock Risk)',
      description: 'В топологии обнаружен синхронный цикл вызовов. Взаимные блокировки при масштабировании неизбежны.',
      affectedNodeIds: cyclicNodeIds
    });
    for (const id of cyclicNodeIds) {
      nodeMetrics[id] = { currentRps: 0, p50Ms: 5000, p95Ms: 5000, p99Ms: 5000, errorRate: 1.0, queueLength: 9999, utilization: 1.0, health: 'failed' };
    }
  }

  state.nodes.forEach((node, id) => nodeIncomingRps.set(id, node.type === 'client' ? effectiveInputRps : 0));
  const entryNodes = sortedOrder.filter((id) => state.nodes.get(id)?.type === 'client' || !state.edges.some((e) => e.target === id));
  if (entryNodes.length > 0 && !entryNodes.some((id) => state.nodes.get(id)?.type === 'client')) {
    const splitRps = effectiveInputRps / entryNodes.length;
    entryNodes.forEach((id) => nodeIncomingRps.set(id, splitRps));
  }

  for (const nodeId of sortedOrder) {
    const node = state.nodes.get(nodeId);
    if (!node) continue;
    const incomingRps = nodeIncomingRps.get(nodeId) || 0;
    const cfg = node.config || {};
    const replicas = cfg.replicas || 1;
    const c = Math.max(1, replicas * (node.type === 'service' ? (cfg.threadPool || 10) : 1));
    const mu = cfg.serviceRateMu || (node.type === 'cache' ? 2000 : node.type === 'database' ? 300 : 250);

    const evalRes = AnalyticalPerformanceEngine.evaluate({
      arrivalRate: incomingRps,
      serviceRate: mu,
      instances: c,
      bufferCapacity: cfg.threadPool ? cfg.threadPool * 2 : 50,
      usl: replicas > 1 ? { sigma: 0.03, kappa: 0.001 } : undefined,
      cache: node.type === 'cache'
        ? { totalCatalogSize: 100_000, cacheCapacity: 10_000, zipfAlpha: 1.3, readRatio: cfg.readWriteRatio ?? 0.85 }
        : undefined
    });

    let utilization = evalRes.utilization;
    let errorRate = evalRes.dropProbability;
    let queueLength = Math.round(evalRes.queueLength);
    const baseLatMs = cfg.baseLatencyMs || (node.type === 'cache' ? 2 : node.type === 'database' ? 15 : 10);
    let p50Ms = baseLatMs + evalRes.p50LatencyMs;
    let p95Ms = baseLatMs + (evalRes.p50LatencyMs + evalRes.p90LatencyMs) / 2;
    let p99Ms = baseLatMs + evalRes.p99LatencyMs;
    let health: NodeHealthStatus =
      errorRate > 0.50 || utilization >= 1.0 ? 'failed' :
      errorRate > 0.05 || utilization >= 0.85 ? 'critical' :
      utilization >= 0.70 ? 'warning' : 'healthy';

    const chaosHit = state.chaosState.affectedNodeId === nodeId || (state.chaosState.activeChaos === 'kill_primary' && node.type === 'database');
    if (chaosHit) {
      if (state.chaosState.activeChaos === 'kill_primary') {
        health = 'failed'; errorRate = 1.0; p50Ms = p95Ms = p99Ms = 5000; utilization = 1.0; queueLength = incomingRps * 10;
      } else if (state.chaosState.activeChaos === 'latency_spike') {
        health = 'critical'; p50Ms = p95Ms = p99Ms = 5000; utilization = 1.0;
        if (state.chaosState.circuitBreakerState === 'OPEN') errorRate = 0.50;
      } else if (state.chaosState.activeChaos === 'network_partition') {
        health = 'failed'; errorRate = 0.85; p50Ms = p95Ms = p99Ms = 2000;
      }
    }

    nodeMetrics[nodeId] = {
      currentRps: Math.round(incomingRps), p50Ms: Math.round(p50Ms), p95Ms, p99Ms,
      utilization: parseFloat(Math.min(1.0, utilization).toFixed(2)), queueLength,
      errorRate: parseFloat(errorRate.toFixed(3)), health,
      activeConnections: Math.min(cfg.poolSize || 50, Math.round(incomingRps * 0.05))
    };

    const outgoingEdges = state.edges.filter((e) => e.source === nodeId);
    if (outgoingEdges.length > 0) {
      let outgoingRps = incomingRps * (1 - errorRate);
      if (node.type === 'cache') {
        const hitRate = cfg.cacheHitRatio ?? evalRes.cacheHitRatio ?? 0.85;
        outgoingRps = cfg.cacheHitRatio === undefined && evalRes.downstreamDbArrivalRate !== undefined
          ? evalRes.downstreamDbArrivalRate * (1 - errorRate)
          : outgoingRps * (1 - hitRate);
      }
      const totalWeight = outgoingEdges.reduce((acc, e) => acc + (e.trafficWeight || 1.0), 0);
      for (const edge of outgoingEdges) {
        const weight = edge.trafficWeight || 1.0;
        const edgeRps = outgoingRps * (totalWeight > 0 ? weight / totalWeight : 1 / outgoingEdges.length);
        const targetNode = state.nodes.get(edge.target);
        if ((node.type === 'gateway' || node.type === 'client') && targetNode?.type === 'database' && edgeRps > 3500) {
          antiPatterns.push({
            id: `unbuffered_db_${edge.id}`, type: 'unbuffered_db_write', severity: 'critical',
            title: 'Unbuffered Database Writes (Direct High-Load Write)',
            description: `Прямой поток записи ${Math.round(edgeRps)} RPS из ${node.label} в БД без промежуточного брокера (Kafka/RabbitMQ).`,
            affectedNodeIds: [nodeId, edge.target]
          });
        }
        nodeIncomingRps.set(edge.target, (nodeIncomingRps.get(edge.target) || 0) + edgeRps);
        edgeMetrics[edge.id] = {
          currentRps: Math.round(edgeRps), latencyMs: Math.round(p50Ms * 0.3),
          particleSpeed: Math.max(0.8, Math.min(4.0, edgeRps / 500)), isCongested: utilization > 0.85
        };
      }
    }
  }

  for (const edge of state.edges) {
    if (!edgeMetrics[edge.id]) edgeMetrics[edge.id] = { currentRps: 0, latencyMs: 5000, particleSpeed: 0.5, isCongested: true };
  }

  let totalProcessed = 0; let totalErrors = 0; let maxP99 = 0;
  for (const m of Object.values(nodeMetrics)) {
    totalProcessed += m.currentRps; totalErrors += m.currentRps * m.errorRate;
    if (m.p99Ms > maxP99) maxP99 = m.p99Ms;
  }

  return {
    globalInputRps: Math.round(effectiveInputRps),
    globalProcessedRps: Math.round(totalProcessed),
    globalErrorRate: totalProcessed > 0 ? parseFloat((totalErrors / totalProcessed).toFixed(3)) : 0,
    globalP99LatencyMs: maxP99,
    nodeMetrics, edgeMetrics, antiPatterns, chaosState: { ...state.chaosState }, timestamp: Date.now()
  };
}

export function runDesScenario(request: SimulationRequestMessage): SimulationResponseMessage {
  return runDesScenarioCore(request);
}
