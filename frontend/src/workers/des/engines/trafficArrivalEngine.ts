import type {
  TopologyNodePayload,
  TopologyEdgePayload
} from '../types/workerMessages.ts';

/**
 * Распространяет поток входящих запросов lambda через граф топологии (BFS / Topological Order).
 */
export function computeNodeArrivalRates(
  nodes: TopologyNodePayload[],
  edges: TopologyEdgePayload[],
  globalLambdaRps: number,
  readRatio: number
): Map<string, number> {
  const arrivalMap = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const adj = new Map<string, Array<{ target: string; protocol: string }>>();

  for (const n of nodes) {
    arrivalMap.set(n.id, 0);
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges) {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    adj.get(e.source)?.push({ target: e.target, protocol: e.protocol });
  }

  // Находим корневые узлы (Ingress / Client)
  const queue: string[] = [];
  for (const n of nodes) {
    const deg = inDegree.get(n.id) || 0;
    const isIngress = n.type.includes('ingress') || n.type.includes('client') || deg === 0;
    if (isIngress) {
      arrivalMap.set(n.id, globalLambdaRps);
      queue.push(n.id);
    }
  }

  // Распространяем трафик вниз по графу
  const visited = new Set<string>();
  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);

    const currLambda = arrivalMap.get(currId) || globalLambdaRps;
    const targets = adj.get(currId) || [];

    if (targets.length === 0) continue;

    // Распределяем трафик между получателями
    for (const edge of targets) {
      let flowShare = currLambda / targets.length;
      
      // Чтение vs Запись для кэша и реплик БД
      if (edge.protocol.includes('cache') || edge.target.includes('cache')) {
        flowShare = currLambda * readRatio;
      } else if (edge.protocol.includes('replica') || edge.target.includes('replica')) {
        flowShare = currLambda * readRatio * 0.5;
      }

      const prev = arrivalMap.get(edge.target) || 0;
      arrivalMap.set(edge.target, prev + flowShare);

      if (!visited.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return arrivalMap;
}
