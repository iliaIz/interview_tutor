export type ArchitectureNodeType = 
  | 'client' 
  | 'gateway' 
  | 'service' 
  | 'database' 
  | 'cache' 
  | 'queue' 
  | 'blob_storage' 
  | 'circuit_breaker';

export type ProtocolType = 'REST' | 'gRPC' | 'Kafka' | 'JDBC' | 'Redis';

export type NodeHealthStatus = 'healthy' | 'warning' | 'critical' | 'failed' | 'recovering';

export interface ArchitectureNodeConfig {
  replicas?: number;
  maxRpsCapacity?: number;
  threadPool?: number;
  poolSize?: number; // e.g. HikariCP connection pool limit
  partitions?: number; // Kafka partitions count
  readWriteRatio?: number; // 0.8 = 80% reads
  baseLatencyMs?: number;
  serviceRateMu?: number; // requests per sec per server capacity
  cacheHitRatio?: number; // 0.85 = 85% hit rate
  technology?: string; // e.g. "Spring Cloud Gateway", "PostgreSQL Patroni", "Apache Kafka"
}

export interface NodeLiveMetrics {
  currentRps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  utilization: number; // 0.0 .. 1.0 (rho)
  queueLength: number;
  errorRate: number; // 0.0 .. 1.0
  health: NodeHealthStatus;
  activeConnections?: number;
  consumerLag?: number;
}

export interface ArchitectureEdgeConfig {
  protocol: ProtocolType;
  isAsync: boolean;
  timeoutMs: number;
  retryCount?: number;
  trafficWeight?: number; // 0.0 .. 1.0 (proportion of split)
}

export interface EdgeLiveMetrics {
  currentRps: number;
  latencyMs: number;
  particleSpeed: number;
  isCongested: boolean;
}

export type ChaosEventType = 
  | 'kill_primary' 
  | 'network_partition' 
  | 'latency_spike' 
  | 'black_friday' 
  | 'reset_chaos';

export interface ChaosState {
  activeChaos: ChaosEventType | null;
  affectedNodeId?: string;
  remainingSeconds?: number;
  circuitBreakerState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  description?: string;
}

export interface AntiPatternWarning {
  id: string;
  type: 'spof' | 'cyclic_dependency' | 'unbuffered_db_write' | 'cascading_timeout';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  affectedNodeIds: string[];
}

export interface SimulationTelemetryFrame {
  globalInputRps: number;
  globalProcessedRps: number;
  globalErrorRate: number;
  globalP99LatencyMs: number;
  nodeMetrics: Record<string, NodeLiveMetrics>;
  edgeMetrics: Record<string, EdgeLiveMetrics>;
  antiPatterns: AntiPatternWarning[];
  chaosState: ChaosState;
  timestamp: number;
}

export interface CanvasNodeData {
  label: string;
  nodeType: ArchitectureNodeType;
  config: ArchitectureNodeConfig;
  metrics?: NodeLiveMetrics;
  isChaosTarget?: boolean;
  isSpof?: boolean;
  spofReason?: string;
}

export interface CanvasEdgeData {
  config: ArchitectureEdgeConfig;
  metrics?: EdgeLiveMetrics;
}

export interface ArchitectureGraphPayload {
  nodes: Array<{
    id: string;
    type: ArchitectureNodeType;
    label: string;
    config: ArchitectureNodeConfig;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    config: ArchitectureEdgeConfig;
  }>;
  simulationMetrics?: SimulationTelemetryFrame;
  architectureMermaid?: string;
  graphIr?: string;
}

