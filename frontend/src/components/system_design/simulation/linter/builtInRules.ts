import { ArchitectureTopologyGraph, LintDiagnostic } from './ArchitectureTopologyGraph';
import { TopologyRule } from './TopologyRule';

export class SpofRule implements TopologyRule {
  public readonly id = 'SPOF_NODE';

  public evaluate(graph: ArchitectureTopologyGraph): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { articulationPoints, bridges } = graph.getArticulationPointsAndBridges();

    // 1. Articulation points with instances <= 1
    for (const nodeId of articulationPoints) {
      const node = graph.getNode(nodeId);
      if (!node) continue;
      const instances = graph.getNodeInstances(node);
      const nodeType = graph.getNodeType(node);

      if (nodeType === 'client') continue;

      if (instances <= 1) {
        diagnostics.push({
          ruleId: 'SPOF_NODE',
          severity: 'error',
          message: `Единая точка отказа (SPOF): Компонент "${nodeId}" является критической точкой сочленения топологии при факторе репликации = ${instances}.`,
          affectedNodeIds: [nodeId],
          affectedEdgeIds: [],
        });
      }
    }

    // 2. Unreplicated databases / storages
    for (const node of graph.nodes) {
      const nodeType = graph.getNodeType(node);
      if (nodeType === 'database' || nodeType === 'analytical-storage') {
        const instances = graph.getNodeInstances(node);
        const hasEdges = graph.getNeighborCount(node.id) > 0;
        const alreadyFlagged = diagnostics.some(d => d.ruleId === 'SPOF_NODE' && d.affectedNodeIds.includes(node.id));
        if (instances <= 1 && hasEdges && !alreadyFlagged) {
          diagnostics.push({
            ruleId: 'SPOF_NODE',
            severity: 'error',
            message: `Единая точка отказа (SPOF): Хранилище "${node.id}" не имеет репликации (фактор отказоустойчивости = ${instances}). При отказе узла данные и сервис недоступны.`,
            affectedNodeIds: [node.id],
            affectedEdgeIds: [],
          });
        }
      }
    }

    // 3. Spof Edges (Bridges)
    for (const bridge of bridges) {
      diagnostics.push({
        ruleId: 'SPOF_EDGE',
        severity: 'warning',
        message: `Критический мост связности: Разрыв канала между "${bridge.u}" и "${bridge.v}" изолирует сегменты инфраструктуры.`,
        affectedNodeIds: [bridge.u, bridge.v],
        affectedEdgeIds: [bridge.edgeId],
      });
    }

    return diagnostics;
  }
}

export class SyncRpcCycleRule implements TopologyRule {
  public readonly id = 'SYNC_RPC_CYCLE';

  public evaluate(graph: ArchitectureTopologyGraph): LintDiagnostic[] {
    const cycles = graph.getSynchronousCycles();
    return cycles.map(({ cyclePath, edgeId }) => {
      const v = cyclePath[0];
      return {
        ruleId: 'SYNC_RPC_CYCLE',
        severity: 'error',
        message: `Синхронный распределенный цикл: Вызовы по цепочке [${cyclePath.join(' -> ')} -> ${v}] создают риск взаимной блокировки потоков (Deadlock).`,
        affectedNodeIds: cyclePath,
        affectedEdgeIds: [edgeId],
      };
    });
  }
}

export class PerimeterRules implements TopologyRule {
  public readonly id = 'DIRECT_DB_INGRESS';

  public evaluate(graph: ArchitectureTopologyGraph): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    for (const edge of graph.edges) {
      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      if (!source || !target) continue;

      const sourceNodeType = graph.getNodeType(source);
      const targetNodeType = graph.getNodeType(target);
      const isSync = graph.isEdgeSync(edge);
      const hasBreaker = graph.hasCircuitBreaker(edge);

      // Rule: DIRECT_DB_INGRESS
      if (
        sourceNodeType === 'client' &&
        (targetNodeType === 'database' || targetNodeType === 'analytical-storage')
      ) {
        diagnostics.push({
          ruleId: 'DIRECT_DB_INGRESS',
          severity: 'error',
          message: `Нарушение периметра: Клиент "${source.id}" обращается напрямую к хранилищу "${target.id}" без API Gateway или сервисного слоя.`,
          affectedNodeIds: [source.id, target.id],
          affectedEdgeIds: [edge.id],
        });
      }

      // Rule: UNBUFFERED_ANALYTICAL_WRITE
      if (
        isSync &&
        targetNodeType === 'analytical-storage' &&
        sourceNodeType === 'service'
      ) {
        diagnostics.push({
          ruleId: 'UNBUFFERED_ANALYTICAL_WRITE',
          severity: 'error',
          message: `Небуферизованная запись: Сервис "${source.id}" синхронно пишет в аналитическое хранилище "${target.id}". Требуется буфер сообщений (Kafka/Queue).`,
          affectedNodeIds: [source.id, target.id],
          affectedEdgeIds: [edge.id],
        });
      }

      // Rule: MISSING_CIRCUIT_BREAKER
      if (
        sourceNodeType === 'service' &&
        targetNodeType === 'service' &&
        isSync &&
        !hasBreaker
      ) {
        diagnostics.push({
          ruleId: 'MISSING_CIRCUIT_BREAKER',
          severity: 'warning',
          message: `Каскадный риск: Синхронный вызов "${source.id}" -> "${target.id}" не защищен Circuit Breaker. При деградации下游 сервиса пул потоков будет исчерпан.`,
          affectedNodeIds: [source.id, target.id],
          affectedEdgeIds: [edge.id],
        });
      }
    }

    return diagnostics;
  }
}

export const BUILT_IN_TOPOLOGY_RULES: TopologyRule[] = [
  new SpofRule(),
  new SyncRpcCycleRule(),
  new PerimeterRules()
];
