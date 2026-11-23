export type SystemNodeType =
  | 'client'
  | 'gateway'
  | 'service'
  | 'message-queue'
  | 'queue'
  | 'cache'
  | 'database'
  | 'analytical-storage'
  | 'blob_storage'
  | 'circuit_breaker'
  | 'default';

export interface ArchitectureNodeData {
  nodeType?: string;
  type?: string;
  instances?: number;
  replicas?: number;
  label?: string;
  config?: any;
  [key: string]: any;
}

export interface ArchitectureEdgeData {
  protocol?: string;
  isAsync?: boolean;
  hasCircuitBreaker?: boolean;
  config?: any;
  [key: string]: any;
}

export interface LinterNode {
  id: string;
  type?: string;
  data?: ArchitectureNodeData;
}

export interface LinterEdge {
  id: string;
  source: string;
  target: string;
  data?: ArchitectureEdgeData;
}

export interface LintDiagnostic {
  ruleId:
    | 'SPOF_NODE'
    | 'SPOF_EDGE'
    | 'DIRECT_DB_INGRESS'
    | 'UNBUFFERED_ANALYTICAL_WRITE'
    | 'MISSING_CIRCUIT_BREAKER'
    | 'SYNC_RPC_CYCLE';
  severity: 'error' | 'warning';
  message: string;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
}

export interface BridgeResult {
  u: string;
  v: string;
  edgeId: string;
}

export interface SyncCycleResult {
  cyclePath: string[];
  edgeId: string;
}

export class ArchitectureTopologyGraph {
  public readonly nodes: LinterNode[];
  public readonly edges: LinterEdge[];
  public readonly nodeMap: Map<string, LinterNode>;
  private readonly undirectedAdj: Map<string, Array<{ neighbor: string; edgeId: string }>>;
  private readonly syncAdj: Map<string, Array<{ target: string; edgeId: string }>>;

  private cachedArticulationPoints: Set<string> | null = null;
  private cachedBridges: BridgeResult[] | null = null;
  private cachedSyncCycles: SyncCycleResult[] | null = null;

  constructor(nodes: LinterNode[], edges: LinterEdge[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.nodeMap = new Map<string, LinterNode>(nodes.map((n) => [n.id, n]));

    this.undirectedAdj = new Map();
    this.syncAdj = new Map();
    for (const node of nodes) {
      this.undirectedAdj.set(node.id, []);
      this.syncAdj.set(node.id, []);
    }

    for (const edge of edges) {
      if (this.undirectedAdj.has(edge.source) && this.undirectedAdj.has(edge.target)) {
        this.undirectedAdj.get(edge.source)!.push({ neighbor: edge.target, edgeId: edge.id });
        this.undirectedAdj.get(edge.target)!.push({ neighbor: edge.source, edgeId: edge.id });
      }

      if (this.isEdgeSync(edge) && this.syncAdj.has(edge.source)) {
        this.syncAdj.get(edge.source)!.push({ target: edge.target, edgeId: edge.id });
      }
    }
  }

  public getNode(id: string): LinterNode | undefined {
    return this.nodeMap.get(id);
  }

  public getNodeType(nodeOrId: LinterNode | string): string {
    const node = typeof nodeOrId === 'string' ? this.nodeMap.get(nodeOrId) : nodeOrId;
    if (!node) return 'service';

    const raw = (
      node.data?.nodeType ||
      node.data?.type ||
      node.type ||
      'service'
    ).toLowerCase();

    if (raw === 'queue' || raw === 'message-queue') return 'message-queue';
    if (raw === 'blob_storage' || raw === 'analytical-storage') return 'analytical-storage';
    if (raw === 'gateway') return 'gateway';
    if (raw === 'client') return 'client';
    if (raw === 'database') return 'database';
    if (raw === 'cache') return 'cache';
    return 'service';
  }

  public getNodeInstances(nodeOrId: LinterNode | string): number {
    const node = typeof nodeOrId === 'string' ? this.nodeMap.get(nodeOrId) : nodeOrId;
    if (!node) return 1;

    const val =
      node.data?.instances ??
      node.data?.replicas ??
      node.data?.config?.instances ??
      node.data?.config?.replicas ??
      1;
    return typeof val === 'number' && Number.isFinite(val) ? Math.max(1, val) : 1;
  }

  public isEdgeSync(edge: LinterEdge): boolean {
    if (edge.data?.isAsync === true || edge.data?.config?.isAsync === true) return false;
    const proto = (edge.data?.protocol || edge.data?.config?.protocol || '').toUpperCase();
    if (proto === 'KAFKA' || proto === 'AMQP' || proto === 'ASYNC' || proto === 'EVENT') return false;
    return true;
  }

  public hasCircuitBreaker(edge: LinterEdge): boolean {
    return Boolean(edge.data?.hasCircuitBreaker ?? edge.data?.config?.hasCircuitBreaker ?? false);
  }

  public getNeighborCount(nodeId: string): number {
    return this.undirectedAdj.get(nodeId)?.length || 0;
  }

  public getArticulationPointsAndBridges(): { articulationPoints: Set<string>; bridges: BridgeResult[] } {
    if (this.cachedArticulationPoints && this.cachedBridges) {
      return { articulationPoints: this.cachedArticulationPoints, bridges: this.cachedBridges };
    }

    const discoveryTime = new Map<string, number>();
    const lowLink = new Map<string, number>();
    const articulationPoints = new Set<string>();
    const bridges: BridgeResult[] = [];
    let timer = 0;

    const dfs = (u: string, parentEdgeId: string | null) => {
      timer++;
      discoveryTime.set(u, timer);
      lowLink.set(u, timer);
      let childrenCount = 0;

      for (const { neighbor: v, edgeId } of this.undirectedAdj.get(u) || []) {
        if (edgeId === parentEdgeId) continue;

        if (discoveryTime.has(v)) {
          lowLink.set(u, Math.min(lowLink.get(u)!, discoveryTime.get(v)!));
        } else {
          childrenCount++;
          dfs(v, edgeId);
          lowLink.set(u, Math.min(lowLink.get(u)!, lowLink.get(v)!));

          if (parentEdgeId !== null && lowLink.get(v)! >= discoveryTime.get(u)!) {
            articulationPoints.add(u);
          }

          if (lowLink.get(v)! > discoveryTime.get(u)!) {
            bridges.push({ u, v, edgeId });
          }
        }
      }

      if (parentEdgeId === null && childrenCount > 1) {
        articulationPoints.add(u);
      }
    };

    for (const node of this.nodes) {
      if (!discoveryTime.has(node.id)) {
        dfs(node.id, null);
      }
    }

    this.cachedArticulationPoints = articulationPoints;
    this.cachedBridges = bridges;
    return { articulationPoints, bridges };
  }

  public getSynchronousCycles(): SyncCycleResult[] {
    if (this.cachedSyncCycles) {
      return this.cachedSyncCycles;
    }

    const color = new Map<string, number>();
    for (const node of this.nodes) color.set(node.id, 0);

    const callStackNodes: string[] = [];
    const cycles: SyncCycleResult[] = [];

    const dfs = (u: string): boolean => {
      color.set(u, 1);
      callStackNodes.push(u);

      for (const { target: v, edgeId } of this.syncAdj.get(u) || []) {
        if (color.get(v) === 1) {
          const cycleStart = callStackNodes.indexOf(v);
          const cyclePath = callStackNodes.slice(cycleStart);
          cycles.push({ cyclePath, edgeId });
          return true;
        }

        if (color.get(v) === 0) {
          if (dfs(v)) return true;
        }
      }

      color.set(u, 2);
      callStackNodes.pop();
      return false;
    };

    for (const node of this.nodes) {
      if (color.get(node.id) === 0) {
        dfs(node.id);
      }
    }

    this.cachedSyncCycles = cycles;
    return cycles;
  }
}
