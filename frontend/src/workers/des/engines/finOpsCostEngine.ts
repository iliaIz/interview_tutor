import type { TopologyNodePayload } from '../types/workerMessages.ts';

/**
 * Финансовый калькулятор облачной инфраструктуры (FinOps TCO).
 * Стандартизирован по тарифам облачных провайдеров BigTech (AWS, GCP, Azure) на сентябрь 2026 г.
 */
export class FinOpsCostEngine {
  // Базовые часовые ставки ($/час)
  private static readonly COST_PER_VCPU_HOUR = 0.035;       // ~$25.20 / месяц
  private static readonly COST_PER_RAM_GB_HOUR = 0.0045;     // ~$3.24 / месяц
  private static readonly COST_PER_H100_GPU_HOUR = 3.80;     // ~$2,736 / месяц
  private static readonly COST_PER_A100_GPU_HOUR = 2.20;     // ~$1,584 / месяц
  private static readonly COST_PER_IOPS_MONTH = 0.065;       // gp3 / io2 provisioned IOPS
  private static readonly COST_PER_WAN_EGRESS_GB = 0.045;    // средняя цена за egress traffic

  /**
   * Рассчитывает ежемесячную стоимость узла ($/мес) на основе его параметров и трафика.
   */
  public static calculateNodeMonthlyCost(node: TopologyNodePayload, actual_throughput_rps: number): number {
    const params = node.params || {};
    const type = node.type.toLowerCase();

    // 1. GPU Ноды (AI Инференс и кластеры обучения)
    if (type.includes('gpu') || type.includes('llm') || params.gpu_type) {
      const gpuCount = params.replicas || params.gpu_count || 1;
      const isH100 = (params.gpu_type || '').toUpperCase().includes('H100') || true;
      const ratePerHour = isH100 ? this.COST_PER_H100_GPU_HOUR : this.COST_PER_A100_GPU_HOUR;
      const monthlyGpuCost = gpuCount * ratePerHour * 730;
      // Хост CPU + RAM
      const hostCpuCost = 16 * this.COST_PER_VCPU_HOUR * 730;
      const hostRamCost = 128 * this.COST_PER_RAM_GB_HOUR * 730;
      return Math.round(monthlyGpuCost + hostCpuCost + hostRamCost);
    }

    // 2. Базы данных (RDBMS, NoSQL, NewSQL)
    if (type.includes('rdbms') || type.includes('db') || type.includes('postgres') || type.includes('mysql')) {
      const vcpu = params.cores || 8;
      const ramGb = params.ram_gb || vcpu * 4;
      const computeCost = (vcpu * this.COST_PER_VCPU_HOUR + ramGb * this.COST_PER_RAM_GB_HOUR) * 730;
      
      const iops = params.provisioned_iops || 3000;
      const iopsCost = iops * this.COST_PER_IOPS_MONTH;
      const storageCost = (params.storage_gb || 500) * 0.10;
      return Math.round(computeCost + iopsCost + storageCost);
    }

    // 3. Распределенный кэш (Redis, Memcached)
    if (type.includes('cache') || type.includes('redis')) {
      const ramGb = params.max_memory_gb || 32;
      const nodes = params.cluster_nodes_count || params.replicas || 2;
      const ramCost = nodes * ramGb * this.COST_PER_RAM_GB_HOUR * 730;
      const cpuCost = nodes * 4 * this.COST_PER_VCPU_HOUR * 730;
      return Math.round(ramCost + cpuCost);
    }

    // 4. Брокер сообщений (Kafka, RabbitMQ)
    if (type.includes('broker') || type.includes('kafka')) {
      const brokers = params.brokers_count || 3;
      const brokerCost = brokers * (8 * this.COST_PER_VCPU_HOUR + 32 * this.COST_PER_RAM_GB_HOUR) * 730;
      const diskCost = brokers * 1000 * 0.08; // 1TB NVMe per broker
      return Math.round(brokerCost + diskCost);
    }

    // 5. Микросервисы приложений (App Service)
    if (type.includes('app') || type.includes('service')) {
      const replicas = params.replicas || 2;
      const cores = params.cores || 4;
      const ramGb = params.ram_gb || cores * 2;
      return Math.round(replicas * (cores * this.COST_PER_VCPU_HOUR + ramGb * this.COST_PER_RAM_GB_HOUR) * 730);
    }

    // 6. Ingress / Load Balancer / Nginx
    if (type.includes('ingress') || type.includes('proxy') || type.includes('gateway') || type.includes('nginx')) {
      const baseAlbCost = 25.0; // Базовая аренда ALB/NLB
      // Egress Network WAN: ~$0.045 / GB
      // Средний размер ответа 15 КБ:
      const bytesPerSec = actual_throughput_rps * 15 * 1024;
      const gbPerMonth = (bytesPerSec * 86400 * 30.5) / (1024 * 1024 * 1024);
      const egressCost = gbPerMonth * this.COST_PER_WAN_EGRESS_GB;
      return Math.round(baseAlbCost + egressCost);
    }

    // Дефолтный сервис
    const replicas = params.replicas || 1;
    return Math.round(replicas * (4 * this.COST_PER_VCPU_HOUR + 8 * this.COST_PER_RAM_GB_HOUR) * 730);
  }
}
