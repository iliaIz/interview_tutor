/**
 * Heuristic Single Point of Failure (SPOF) & High-Availability Analyzer
 * Identifies articulation points in architecture graphs where failure partitions the system.
 */

export interface SpofNodeAnalysis {
  isSpof: boolean;
  reason?: string;
  isArticulationPoint: boolean;
  hasRedundancy: boolean;
}

export interface GraphNodeLike {
  id: string;
  type?: string;
  data?: {
    nodeType?: string;
    config?: {
      replicas?: number;
      technology?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface GraphEdgeLike {
  source: string;
  target: string;
}

/**
 * Computes all SPOF nodes in the given architecture graph.
 * Returns a map of nodeId -> SpofNodeAnalysis.
 */
export function analyzeGraphSpof(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[]
): Map<string, SpofNodeAnalysis> {
  const result = new Map<string, SpofNodeAnalysis>();

  if (nodes.length <= 2) {
    for (const node of nodes) {
      result.set(node.id, {
        isSpof: false,
        isArticulationPoint: false,
        hasRedundancy: (node.data?.config?.replicas || 1) > 1
      });
    }
    return result;
  }

  // 1. Build adjacency list (undirected for partition/connectivity analysis)
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) {
    adj.set(n.id, new Set());
  }
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  // 2. Classify nodes: Ingress vs Storage
  const ingressNodes = new Set<string>();
  const storageNodes = new Set<string>();

  for (const n of nodes) {
    const nt = n.data?.nodeType || n.type || '';
    if (nt === 'client' || nt === 'gateway') {
      ingressNodes.add(n.id);
    }
    if (nt === 'database' || nt === 'blob_storage' || nt === 'queue') {
      storageNodes.add(n.id);
    }
  }

  // Helper: check if all ingress can reach at least one storage when excluding node `excludedId`
  const checkIngressToStorageReachability = (excludedId: string): boolean => {
    if (ingressNodes.size === 0 || storageNodes.size === 0) return true;

    for (const ingressId of ingressNodes) {
      if (ingressId === excludedId) continue;

      // BFS to find if this ingress can reach any storage node
      const visited = new Set<string>([excludedId, ingressId]);
      const queue: string[] = [ingressId];
      let canReachStorage = false;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (storageNodes.has(curr) && curr !== excludedId) {
          canReachStorage = true;
          break;
        }

        const neighbors = adj.get(curr) || new Set();
        for (const next of neighbors) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }

      if (!canReachStorage) {
        return false; // Traffic partitioned from storage!
      }
    }

    return true;
  };

  // 3. For each node, simulate failure (removal)
  for (const n of nodes) {
    const replicas = n.data?.config?.replicas ?? 1;
    const hasRedundancy = replicas > 1;

    // Ingress clients themselves are not internal SPOFs
    const nt = n.data?.nodeType || n.type || '';
    if (nt === 'client') {
      result.set(n.id, {
        isSpof: false,
        isArticulationPoint: false,
        hasRedundancy: true
      });
      continue;
    }

    const canReach = checkIngressToStorageReachability(n.id);
    const isArticulationPoint = !canReach;

    // It's a critical SPOF if failure partitions the system AND there is no multi-replica redundancy
    const isSpof = isArticulationPoint && !hasRedundancy;

    let reason: string | undefined;
    if (isSpof) {
      reason = `Узел «${n.data?.label || n.id}» не имеет репликации (${replicas}x) и является критическим звеном. Его отказ полностью изолирует клиентов от данных.`;
    } else if (isArticulationPoint && hasRedundancy) {
      reason = `Критический узел, но защищен пулом реплик (${replicas}x).`;
    }

    result.set(n.id, {
      isSpof,
      reason,
      isArticulationPoint,
      hasRedundancy
    });
  }

  return result;
}
