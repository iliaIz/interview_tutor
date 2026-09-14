import { ChallengeManifest, InvariantRule, TransportNode, TransportEdge } from '../schemas/manifest';
import { evaluateCel } from './celEvaluator';

export interface InvariantViolation {
  ruleId: string;
  severity: 'ERROR' | 'WARNING';
  category: string;
  description: string;
  message: string;
  culpritNodeIds?: string[];
  culpritEdgeIds?: string[];
}

export interface InvariantValidationResult {
  isValid: boolean;
  violations: InvariantViolation[];
  passedRuleIds: string[];
}

export interface ValidationContext {
  manifest: ChallengeManifest;
  nodes: TransportNode[];
  edges: TransportEdge[];
  simulationResults?: {
    system_p99_latency_ms?: number;
    system_p999_latency_ms?: number;
    system_availability_nines?: number;
    total_monthly_cost_usd?: number;
    is_stable?: boolean;
    bottleneck_node_id?: string | null;
  };
}

/**
 * Изоморфный движок проверки архитектурных инвариантов.
 * Работает идентично на клиенте (подсветка холста) и на сервере (валидация сабмита в базу).
 */
export function validateInvariants(context: ValidationContext): InvariantValidationResult {
  const violations: InvariantViolation[] = [];
  const passedRuleIds: string[] = [];

  const rules = context.manifest.studio_2_simulation.invariants || [];
  const nodeMap = new Map<string, TransportNode>();
  for (const node of context.nodes) {
    nodeMap.set(node.id, node);
  }

  for (const rule of rules) {
    let violation: InvariantViolation | null = null;

    switch (rule.rule_type) {
      case 'CYCLE_DETECTION': {
        const cycle = detectCycles(context.nodes, context.edges);
        if (cycle.hasCycle) {
          violation = {
            ruleId: rule.id,
            severity: rule.severity,
            category: rule.category,
            description: rule.description,
            message: `Обнаружен циклический синхронный вызов между узлами: ${cycle.cyclePath.join(' -> ')}`,
            culpritNodeIds: cycle.cyclePath
          };
        }
        break;
      }

      case 'NO_DIRECT_ACCESS': {
        const fromType = rule.config.from_type;
        const toType = rule.config.to_type;
        const badEdges = context.edges.filter(edge => {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) return false;
          return src.type === fromType && tgt.type === toType;
        });

        if (badEdges.length > 0) {
          violation = {
            ruleId: rule.id,
            severity: rule.severity,
            category: rule.category,
            description: rule.description,
            message: `Запрещено прямое соединение от узлов типа '${fromType}' к узлам типа '${toType}' в обход шлюзов/сервисов.`,
            culpritEdgeIds: badEdges.map(e => e.id)
          };
        }
        break;
      }

      case 'MANDATORY_INTERMEDIARY': {
        const requiredType = rule.config.required_node_type;
        const hasRequiredType = context.nodes.some(n => n.type === requiredType);
        if (!hasRequiredType) {
          violation = {
            ruleId: rule.id,
            severity: rule.severity,
            category: rule.category,
            description: rule.description,
            message: `Топология обязана содержать хотя бы один промежуточный узел типа '${requiredType}'.`
          };
        }
        break;
      }

      case 'CEL_EXPRESSION': {
        const expr = rule.config.expression;
        if (expr) {
          const evalContext = {
            manifest: context.manifest,
            simulation: context.simulationResults || {
              system_p99_latency_ms: 0,
              total_monthly_cost_usd: 0,
              system_availability_nines: 100,
              is_stable: true
            },
            nodes: context.nodes,
            edges: context.edges
          };

          const celResult = evaluateCel(expr, evalContext);
          if (!celResult.success) {
            violation = {
              ruleId: rule.id,
              severity: rule.severity,
              category: rule.category,
              description: rule.description,
              message: `Ошибка выполнения CEL-предиката: ${celResult.error}`
            };
          } else if (celResult.value !== true) {
            violation = {
              ruleId: rule.id,
              severity: rule.severity,
              category: rule.category,
              description: rule.description,
              message: `Нарушено условие инварианта: ${rule.description}`
            };
          }
        }
        break;
      }
    }

    if (violation) {
      violations.push(violation);
    } else {
      passedRuleIds.push(rule.id);
    }
  }

  const hasErrors = violations.some(v => v.severity === 'ERROR');
  return {
    isValid: !hasErrors,
    violations,
    passedRuleIds
  };
}

/**
 * Алгоритм Кана для поиска циклов в синхронных ребрах графа.
 * Исключает асинхронные ребра и брокеры сообщений (Kafka, AMQP, Outbox),
 * легитимно используемые в событийно-ориентированных архитектурах (Saga).
 */
function detectCycles(nodes: TransportNode[], edges: TransportEdge[]): { hasCycle: boolean; cyclePath: string[] } {
  const syncProtocols = new Set(['http_rest', 'grpc', 'tcp_socket', 'db_protocol', 'nvlink_roce']);
  const asyncProtocols = new Set(['kafka_topic', 'amqp_queue', 'redis_stream', 'event_bridge', 'async_event', 'message_queue']);

  const nodeTypeMap = new Map<string, string>();
  for (const n of nodes) {
    nodeTypeMap.set(n.id, n.type);
  }

  const syncEdges = edges.filter(e => {
    if (e.is_async === true) return false;
    if ((e.config as any)?.isAsync === true) return false;
    const proto = (e.protocol || '').toLowerCase();
    if (asyncProtocols.has(proto)) return false;

    // Decoupled message queues or event streams do not form synchronous blocking RPC loops
    const srcType = nodeTypeMap.get(e.source);
    const tgtType = nodeTypeMap.get(e.target);
    if (srcType === 'message_queue' || tgtType === 'message_queue' || srcType === 'ebpf_stream_ingest') {
      return false;
    }

    return syncProtocols.has(proto) || !proto;
  });


  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of syncEdges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visitedCount++;
    for (const neighbor of adj.get(curr) || []) {
      const nextDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, nextDeg);
      if (nextDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  const hasCycle = visitedCount < nodes.length && syncEdges.length > 0;
  const cycleNodes = hasCycle ? Array.from(inDegree.entries()).filter(([_, deg]) => deg > 0).map(([id]) => id) : [];

  return {
    hasCycle,
    cyclePath: cycleNodes
  };
}

export const validateGraphInvariants = validateInvariants;
