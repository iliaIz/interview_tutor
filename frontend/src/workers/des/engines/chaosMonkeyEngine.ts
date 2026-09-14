import type { ChaosScenarioPayload } from '../types/workerMessages.ts';

export interface ActiveFaultState {
  scenarioId: string;
  name: string;
  fault_type: string;
  target_node_id?: string;
  target_edge_id?: string;
  impact_multiplier: number;
}

export class ChaosMonkeyEngine {
  private scenarios: ChaosScenarioPayload[];

  constructor(scenarios: ChaosScenarioPayload[] = []) {
    this.scenarios = scenarios;
  }

  /**
   * Возвращает список активных сбоев для конкретной секунды симуляции.
   */
  public getActiveFaults(current_second: number): ActiveFaultState[] {
    const active: ActiveFaultState[] = [];

    for (const sc of this.scenarios) {
      const start = sc.trigger_second;
      const end = sc.trigger_second + sc.duration_second;
      if (current_second >= start && current_second < end) {
        active.push({
          scenarioId: sc.id,
          name: sc.name,
          fault_type: sc.fault_type,
          target_node_id: sc.target_node_id,
          target_edge_id: sc.target_edge_id,
          impact_multiplier: sc.impact_multiplier || 2.0,
        });
      }
    }

    return active;
  }

  /**
   * Проверяет, затронут ли узел активным сбоем, и возвращает коэффициент модификации задержки.
   */
  public getNodeImpact(nodeId: string, current_second: number): { isFailing: boolean; latencyMultiplier: number; isOffline: boolean } {
    const active = this.getActiveFaults(current_second);
    let latencyMultiplier = 1.0;
    let isOffline = false;
    let isFailing = false;

    for (const fault of active) {
      if (fault.target_node_id === nodeId) {
        isFailing = true;
        if (fault.fault_type === 'NODE_CRASH_FAILOVER') {
          isOffline = true;
        } else if (fault.fault_type === 'DISK_IOPS_STALL' || fault.fault_type === 'SLOW_UPSTREAM_HTTP') {
          latencyMultiplier = Math.max(latencyMultiplier, fault.impact_multiplier);
        }
      }
    }

    return { isFailing, latencyMultiplier, isOffline };
  }

  /**
   * Проверяет, затронута ли связь активным сбоем (например, Network Partition).
   */
  public getEdgeImpact(edgeId: string, current_second: number): { isPartitioned: boolean; packetDropRate: number } {
    const active = this.getActiveFaults(current_second);
    let isPartitioned = false;
    let packetDropRate = 0.0;

    for (const fault of active) {
      if (fault.target_edge_id === edgeId) {
        if (fault.fault_type === 'NETWORK_PARTITION') {
          isPartitioned = true;
          packetDropRate = 1.0;
        } else if (fault.fault_type === 'PACKET_LOSS_SPIKE') {
          packetDropRate = Math.min(1.0, fault.impact_multiplier * 0.1);
        }
      }
    }

    return { isPartitioned, packetDropRate };
  }
}
