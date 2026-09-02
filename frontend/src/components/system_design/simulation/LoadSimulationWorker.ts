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

interface WorkerNodeData {
  id: string;
  type: ArchitectureNodeType;
  label: string;
  config: ArchitectureNodeConfig;
}

interface WorkerEdgeData {
  id: string;
  source: string;
  target: string;
  protocol: string;
  isAsync: boolean;
  timeoutMs: number;
  trafficWeight?: number;
}

// Factorial helper with caching
const factorialCache: number[] = [1, 1];
function factorial(n: number): number {
  if (n < 0) return 1;
  if (factorialCache[n] !== undefined) return factorialCache[n];
  let res = factorialCache[factorialCache.length - 1];
  for (let i = factorialCache.length; i <= n; i++) {
    res *= i;
    factorialCache[i] = res;
  }
  return res;
}

/**
 * Erlang-C formula for M/M/c queueing systems
 * Calculates the probability that an arriving request must wait in queue
 */
function erlangC(c: number, rho: number): number {
  if (rho >= 1.0) return 1.0;
  if (c <= 0) return 1.0;
  const cRho = c * rho;
  
  // Sum term: sum_{k=0}^{c-1} (c*rho)^k / k!
  let sum = 0;
  for (let k = 0; k < c; k++) {
    sum += Math.pow(cRho, k) / factorial(k);
  }
  
  // Erlang numerator: (c*rho)^c / (c! * (1 - rho))
  const numerator = Math.pow(cRho, c) / (factorial(c) * (1 - rho));
  const pC = numerator / (sum + numerator);
  return Math.max(0, Math.min(1.0, isNaN(pC) ? 1.0 : pC));
}

/**
 * Pollaczek-Khinchine formula for M/G/1 database queues
 * Accounts for variance of service times (e.g. disk I/O, heavy joins)
 */
function pollaczekKhinchine(lambda: number, mu: number, variance: number): number {
  const rho = lambda / mu;
  if (rho >= 1.0) return 5000; // Saturated: high latency bound
  const wQ = (lambda * (variance + 1 / (mu * mu))) / (2 * (1 - rho));
  return Math.max(0, wQ);
}

class SimulationEngine {
  private nodes: Map<string, WorkerNodeData> = new Map();
  private edges: WorkerEdgeData[] = [];
  private baseInputRps = 1000;
  private isRunning = true;
  private timer: any = null;

  // Chaos Monkey state
  private chaosState: ChaosState = {
    activeChaos: null,
    circuitBreakerState: 'CLOSED'
  };
  private chaosTimer = 0;

  public updateTopology(nodes: WorkerNodeData[], edges: WorkerEdgeData[], inputRps?: number): void {
    this.nodes.clear();
    nodes.forEach(n => this.nodes.set(n.id, n));
    this.edges = edges;
    if (inputRps !== undefined) this.baseInputRps = inputRps;
  }

  public setInputRps(rps: number): void {
    this.baseInputRps = Math.max(10, rps);
  }

  public triggerChaos(type: ChaosEventType, targetNodeId?: string): void {
    if (type === 'reset_chaos') {
      this.chaosState = { activeChaos: null, circuitBreakerState: 'CLOSED' };
      this.chaosTimer = 0;
      return;
    }

    this.chaosState = {
      activeChaos: type,
      affectedNodeId: targetNodeId,
      remainingSeconds: type === 'kill_primary' ? 12 : 15,
      circuitBreakerState: type === 'latency_spike' ? 'OPEN' : 'CLOSED',
      description: this.getChaosDescription(type)
    };
    this.chaosTimer = this.chaosState.remainingSeconds || 10;
  }

  private getChaosDescription(type: ChaosEventType): string {
    switch (type) {
      case 'kill_primary':
        return '💥 PostgreSQL Master упал! Patroni выполняет failover и перевыборы лидера (12 сек).';
      case 'network_partition':
        return '🌐 Разрыв сети между ДЦ. Реплики недоступны, кворум нарушен.';
      case 'latency_spike':
        return '🐢 Downstream сервис отвечает с задержкой 5,000мс. Сработал Circuit Breaker (OPEN).';
      case 'black_friday':
        return '🔥 Black Friday! Входящий трафик подскочил в 10 раз.';
      default:
        return '';
    }
  }

  public start(): void {
    if (this.timer) return;
    this.isRunning = true;
    this.timer = setInterval(() => {
      if (this.isRunning) {
        this.stepSimulation();
      }
    }, 100);
  }

  public pause(): void {
    this.isRunning = false;
  }

  public resume(): void {
    this.isRunning = true;
  }

  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Topologically orders nodes using Kahn's Algorithm and detects cycles
   */
  private analyzeTopology(): { sortedOrder: string[]; hasCycle: boolean; inDegrees: Map<string, number> } {
    const inDegrees = new Map<string, number>();
    const adj = new Map<string, string[]>();

    this.nodes.forEach((_, id) => {
      inDegrees.set(id, 0);
      adj.set(id, []);
    });

    for (const edge of this.edges) {
      if (this.nodes.has(edge.source) && this.nodes.has(edge.target)) {
        inDegrees.set(edge.target, (inDegrees.get(edge.target) || 0) + 1);
        adj.get(edge.source)!.push(edge.target);
      }
    }

    const queue: string[] = [];
    inDegrees.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const sortedOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      sortedOrder.push(u);
      for (const v of adj.get(u) || []) {
        inDegrees.set(v, inDegrees.get(v)! - 1);
        if (inDegrees.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    const hasCycle = sortedOrder.length < this.nodes.size;
    return { sortedOrder, hasCycle, inDegrees };
  }

  /**
   * Performs 1 DES step and produces a telemetry frame
   */
  private stepSimulation(): void {
    // 1. Manage Chaos countdown
    if (this.chaosState.activeChaos && this.chaosTimer > 0) {
      this.chaosTimer -= 0.1;
      this.chaosState.remainingSeconds = Math.max(0, Math.ceil(this.chaosTimer));
      if (this.chaosTimer <= 0) {
        // Auto-recover
        if (this.chaosState.activeChaos === 'latency_spike') {
          this.chaosState.circuitBreakerState = 'HALF_OPEN';
          setTimeout(() => {
            if (this.chaosState.circuitBreakerState === 'HALF_OPEN') {
              this.chaosState.circuitBreakerState = 'CLOSED';
            }
          }, 3000);
        }
        this.chaosState.activeChaos = null;
      }
    }

    const effectiveInputRps = this.chaosState.activeChaos === 'black_friday' 
      ? this.baseInputRps * 10 
      : this.baseInputRps;

    const { sortedOrder, hasCycle } = this.analyzeTopology();

    const nodeIncomingRps = new Map<string, number>();
    const nodeMetrics: Record<string, NodeLiveMetrics> = {};
    const edgeMetrics: Record<string, EdgeLiveMetrics> = {};
    const antiPatterns: AntiPatternWarning[] = [];

    // Check for Cyclic Dependency Anti-pattern
    if (hasCycle) {
      antiPatterns.push({
        id: 'cyclic_dep',
        type: 'cyclic_dependency',
        severity: 'critical',
        title: 'Обнаружена циклическая зависимость (Deadlock Risk)',
        description: 'В топологии обнаружен синхронный цикл вызовов. Взаимные блокировки при масштабировании неизбежны.',
        affectedNodeIds: Array.from(this.nodes.keys()).filter(id => !sortedOrder.includes(id))
      });
    }

    // Seed input traffic from client / entry nodes
    this.nodes.forEach((node, id) => {
      if (node.type === 'client') {
        nodeIncomingRps.set(id, effectiveInputRps);
      } else {
        nodeIncomingRps.set(id, 0);
      }
    });

    // If no client node exists, inject into roots
    const entryNodes = sortedOrder.filter(id => {
      const isClient = this.nodes.get(id)?.type === 'client';
      const hasNoIncoming = !this.edges.some(e => e.target === id);
      return isClient || hasNoIncoming;
    });

    if (entryNodes.length > 0 && !entryNodes.some(id => this.nodes.get(id)?.type === 'client')) {
      const splitRps = effectiveInputRps / entryNodes.length;
      entryNodes.forEach(id => nodeIncomingRps.set(id, splitRps));
    }

    // Process each node in topological order
    for (const nodeId of sortedOrder) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      const incomingRps = nodeIncomingRps.get(nodeId) || 0;
      const config = node.config || {};
      const replicas = config.replicas || 1;
      const threadPool = config.threadPool || 10;
      const c = Math.max(1, replicas * (node.type === 'service' ? threadPool : 1));
      const mu = config.serviceRateMu || (node.type === 'cache' ? 2000 : node.type === 'database' ? 300 : 250);
      const capacity = c * mu;

      let utilization = capacity > 0 ? incomingRps / capacity : 0;
      let errorRate = 0;
      let queueLength = 0;
      let baseLatMs = config.baseLatencyMs || (node.type === 'cache' ? 2 : node.type === 'database' ? 15 : 10);
      let p50Ms = baseLatMs;
      let health: NodeHealthStatus = 'healthy';

      // Chaos impact on this node
      const isAffectedByChaos = this.chaosState.affectedNodeId === nodeId || 
        (this.chaosState.activeChaos === 'kill_primary' && node.type === 'database');

      if (isAffectedByChaos) {
        if (this.chaosState.activeChaos === 'kill_primary') {
          health = 'failed';
          errorRate = 1.0;
          p50Ms = 5000;
          utilization = 1.0;
          queueLength = incomingRps * 10;
        } else if (this.chaosState.activeChaos === 'latency_spike') {
          health = 'critical';
          p50Ms = 5000;
          utilization = 1.0;
          if (this.chaosState.circuitBreakerState === 'OPEN') {
            errorRate = 0.50; // Fallback responses
          }
        } else if (this.chaosState.activeChaos === 'network_partition') {
          health = 'failed';
          errorRate = 0.85;
          p50Ms = 2000;
        }
      } else {
        // Normal Queueing Theory calculation
        if (utilization >= 1.0) {
          health = 'critical';
          errorRate = Math.min(0.95, (incomingRps - capacity) / incomingRps);
          queueLength = Math.round((incomingRps - capacity) * 1.5);
          p50Ms = baseLatMs + 800 * (utilization - 0.9);
        } else if (utilization >= 0.80) {
          health = 'warning';
          const pC = erlangC(c, utilization);
          const wQ = (pC / (capacity - incomingRps)) * 1000; // ms
          p50Ms = baseLatMs + wQ;
          queueLength = Math.round(incomingRps * (wQ / 1000));
        } else {
          health = 'healthy';
          if (node.type === 'database') {
            const variance = Math.pow(1 / mu, 2) * 1.5;
            const wQ = pollaczekKhinchine(incomingRps, mu, variance) * 1000;
            p50Ms = baseLatMs + wQ;
          } else {
            const pC = erlangC(c, Math.max(0.05, utilization));
            p50Ms = baseLatMs + (pC * 5);
          }
          queueLength = Math.max(0, Math.round(incomingRps * 0.02 * utilization));
        }
      }

      // Check for SPOF anti-pattern
      if (replicas <= 1 && incomingRps > 500 && node.type !== 'client' && node.type !== 'circuit_breaker') {
        antiPatterns.push({
          id: `spof_${nodeId}`,
          type: 'spof',
          severity: 'warning',
          title: `SPOF: Узел «${node.label}» не имеет реплик`,
          description: `Узел обрабатывает ${Math.round(incomingRps)} RPS в единственном экземпляре. При падении система будет недоступна.`,
          affectedNodeIds: [nodeId]
        });
      }

      const p95Ms = Math.round(p50Ms * (1 + 1.2 * utilization));
      const p99Ms = Math.round(p50Ms * (1 + 2.5 * utilization));

      nodeMetrics[nodeId] = {
        currentRps: Math.round(incomingRps),
        p50Ms: Math.round(p50Ms),
        p95Ms,
        p99Ms,
        utilization: parseFloat(Math.min(1.0, utilization).toFixed(2)),
        queueLength,
        errorRate: parseFloat(errorRate.toFixed(3)),
        health,
        activeConnections: Math.min(config.poolSize || 50, Math.round(incomingRps * 0.05))
      };

      // Propagate traffic to outgoing edges
      const outgoingEdges = this.edges.filter(e => e.source === nodeId);
      if (outgoingEdges.length > 0) {
        // Successful outgoing traffic (filtered by error rate)
        let outgoingRps = incomingRps * (1 - errorRate);

        // If Cache, subtract hit ratio
        if (node.type === 'cache') {
          const hitRate = config.cacheHitRatio || 0.85;
          outgoingRps = outgoingRps * (1 - hitRate); // Only cache misses propagate to DB!
        }

        const totalWeight = outgoingEdges.reduce((acc, e) => acc + (e.trafficWeight || 1.0), 0);

        for (const edge of outgoingEdges) {
          const weight = edge.trafficWeight || 1.0;
          const portion = totalWeight > 0 ? weight / totalWeight : 1 / outgoingEdges.length;
          const edgeRps = outgoingRps * portion;

          // Check Unbuffered DB Write Anti-Pattern
          const targetNode = this.nodes.get(edge.target);
          if (
            (node.type === 'gateway' || node.type === 'client') &&
            targetNode?.type === 'database' &&
            edgeRps > 3500
          ) {
            antiPatterns.push({
              id: `unbuffered_db_${edge.id}`,
              type: 'unbuffered_db_write',
              severity: 'critical',
              title: 'Unbuffered Database Writes (Direct High-Load Write)',
              description: `Прямой поток записи ${Math.round(edgeRps)} RPS из ${node.label} в БД без промежуточного брокера (Kafka/RabbitMQ).`,
              affectedNodeIds: [nodeId, edge.target]
            });
          }

          const currentTargetRps = nodeIncomingRps.get(edge.target) || 0;
          nodeIncomingRps.set(edge.target, currentTargetRps + edgeRps);

          edgeMetrics[edge.id] = {
            currentRps: Math.round(edgeRps),
            latencyMs: Math.round(p50Ms * 0.3),
            particleSpeed: Math.max(0.8, Math.min(4.0, edgeRps / 500)),
            isCongested: utilization > 0.85
          };
        }
      }
    }

    // Global Aggregate Metrics
    let totalProcessed = 0;
    let totalErrors = 0;
    let maxP99 = 0;

    Object.values(nodeMetrics).forEach(m => {
      totalProcessed += m.currentRps;
      totalErrors += m.currentRps * m.errorRate;
      if (m.p99Ms > maxP99) maxP99 = m.p99Ms;
    });

    const globalErrorRate = totalProcessed > 0 ? parseFloat((totalErrors / totalProcessed).toFixed(3)) : 0;

    const frame: SimulationTelemetryFrame = {
      globalInputRps: Math.round(effectiveInputRps),
      globalProcessedRps: Math.round(totalProcessed),
      globalErrorRate,
      globalP99LatencyMs: maxP99,
      nodeMetrics,
      edgeMetrics,
      antiPatterns,
      chaosState: { ...this.chaosState },
      timestamp: Date.now()
    };

    // Broadcast frame to React UI
    self.postMessage({ type: 'TELEMETRY_FRAME', frame });
  }
}

const engine = new SimulationEngine();

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT':
    case 'UPDATE_TOPOLOGY':
      engine.updateTopology(payload.nodes || [], payload.edges || [], payload.inputRps);
      engine.start();
      break;
    case 'SET_INPUT_RPS':
      engine.setInputRps(payload.rps);
      break;
    case 'TRIGGER_CHAOS':
      engine.triggerChaos(payload.chaosType, payload.targetNodeId);
      break;
    case 'PAUSE':
      engine.pause();
      break;
    case 'RESUME':
      engine.resume();
      break;
    case 'DESTROY':
      engine.destroy();
      break;
  }
};
