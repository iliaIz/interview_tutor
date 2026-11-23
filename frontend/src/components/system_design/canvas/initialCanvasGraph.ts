import { Edge, Node } from '@xyflow/react';
import { ArchitectureNodeType } from '../../../types/systemDesignCanvas';

export const INITIAL_NODES: Node[] = [
  {
    id: 'node-client',
    type: 'client',
    position: { x: 50, y: 220 },
    data: {
      label: 'Web / Mobile Client',
      nodeType: 'client' as ArchitectureNodeType,
      config: { technology: 'Web / App Users' }
    }
  },
  {
    id: 'node-gateway',
    type: 'gateway',
    position: { x: 320, y: 220 },
    data: {
      label: 'API Gateway',
      nodeType: 'gateway' as ArchitectureNodeType,
      config: { technology: 'Spring Cloud Gateway', replicas: 2, maxRpsCapacity: 15000 }
    }
  },
  {
    id: 'node-service',
    type: 'service',
    position: { x: 600, y: 220 },
    data: {
      label: 'Core Service',
      nodeType: 'service' as ArchitectureNodeType,
      config: { technology: 'Spring Boot 3.3', replicas: 3, threadPool: 50, serviceRateMu: 300 }
    }
  },
  {
    id: 'node-cache',
    type: 'cache',
    position: { x: 880, y: 100 },
    data: {
      label: 'Redis Cache',
      nodeType: 'cache' as ArchitectureNodeType,
      config: { technology: 'Redis Cluster', replicas: 3, cacheHitRatio: 0.85 }
    }
  },
  {
    id: 'node-db',
    type: 'database',
    position: { x: 880, y: 340 },
    data: {
      label: 'PostgreSQL Primary',
      nodeType: 'database' as ArchitectureNodeType,
      config: { technology: 'PostgreSQL 16 (Patroni)', replicas: 2, poolSize: 50, readWriteRatio: 0.8 }
    }
  },
  {
    id: 'node-queue',
    type: 'queue',
    position: { x: 600, y: 440 },
    data: {
      label: 'Kafka Event Bus',
      nodeType: 'queue' as ArchitectureNodeType,
      config: { technology: 'Apache Kafka', partitions: 8 }
    }
  }
];

export const INITIAL_EDGES: Edge[] = [
  {
    id: 'edge-client-gw',
    source: 'node-client',
    target: 'node-gateway',
    type: 'flow',
    data: { config: { protocol: 'REST', isAsync: false, timeoutMs: 3000, trafficWeight: 1.0 } }
  },
  {
    id: 'edge-gw-service',
    source: 'node-gateway',
    target: 'node-service',
    type: 'flow',
    data: { config: { protocol: 'gRPC', isAsync: false, timeoutMs: 2000, trafficWeight: 1.0 } }
  },
  {
    id: 'edge-service-cache',
    source: 'node-service',
    target: 'node-cache',
    type: 'flow',
    data: { config: { protocol: 'Redis', isAsync: false, timeoutMs: 500, trafficWeight: 0.85 } }
  },
  {
    id: 'edge-service-db',
    source: 'node-service',
    target: 'node-db',
    type: 'flow',
    data: { config: { protocol: 'JDBC', isAsync: false, timeoutMs: 3000, trafficWeight: 0.15 } }
  },
  {
    id: 'edge-service-queue',
    source: 'node-service',
    target: 'node-queue',
    type: 'flow',
    data: { config: { protocol: 'Kafka', isAsync: true, timeoutMs: 5000, trafficWeight: 0.5 } }
  }
];
