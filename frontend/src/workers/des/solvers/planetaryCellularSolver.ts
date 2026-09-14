/**
 * Солвер планетарных систем и ячеистых архитектур (L6 / L7 Staff & Principal).
 * Моделирует радиус поражения ячеек (Cell Blast-Radius),
 * иерархический Ring-AllReduce на NVLink / RoCE и дрейф часов HLC.
 */

export interface CellularIsolationInput {
  total_cells_count: number;          // N_cells (e.g. 50..200)
  failed_cells_count: number;         // Число полностью деградировавших ячеек
  cell_isolation_complete: boolean;   // true: ячейка полностью автономна, false: общая БД
}

export interface CellularIsolationOutput {
  blast_radius_percent: number;       // Доля затронутых пользователей платформы
  global_availability_nines: number;  // Доступность платформы (e.g. 99.99%)
  is_catastrophic_spof: boolean;      // Произошел ли каскадный отказ всей системы
}

export function solveCellularBlastRadius(input: CellularIsolationInput): CellularIsolationOutput {
  const {
    total_cells_count,
    failed_cells_count,
    cell_isolation_complete,
  } = input;

  const N = Math.max(1, total_cells_count);

  if (!cell_isolation_complete) {
    // Антипаттерн: ячейки делят общую БД или брокер сообщений (SPOF)
    // Отказ общего ресурса обрушивает 100% системы
    return {
      blast_radius_percent: 100.0,
      global_availability_nines: 0.0,
      is_catastrophic_spof: true,
    };
  }

  // При строгой ячеистой изоляции радиус поражения строго 1 / N_cells
  const blast_radius_per_cell = 100.0 / N;
  const total_blast_radius = Math.min(100.0, blast_radius_per_cell * failed_cells_count);
  const availability_fraction = Math.max(0.0001, 1.0 - total_blast_radius / 100.0);

  // Перевод в "девятки": -log10(1 - availability)
  let nines = 2.0;
  if (availability_fraction >= 0.99999) nines = 5.0;
  else if (availability_fraction >= 0.9999) nines = 4.0;
  else if (availability_fraction >= 0.999) nines = 3.0;
  else if (availability_fraction >= 0.99) nines = 2.0;
  else nines = Math.max(0, -Math.log10(Math.max(0.00001, 1.0 - availability_fraction)));

  return {
    blast_radius_percent: total_blast_radius,
    global_availability_nines: nines,
    is_catastrophic_spof: false,
  };
}

export interface RingAllReduceInput {
  gpus_count: number;                 // Общее число GPU в кластере (e.g. 1024..10000)
  gpus_per_node?: number;             // Обычно 8 (DGX / HGX H100)
  gradient_payload_bytes: number;     // M: размер передаваемых градиентов (e.g. 70B * 2 = 140 GB)
  nvlink_bandwidth_gb_s?: number;     // Intra-node (default 900 GB/s)
  roce_bandwidth_gbps?: number;       // Inter-node (default 400 Gbps = 50 GB/s)
}

export interface RingAllReduceOutput {
  allreduce_duration_ms: number;
  intra_node_duration_ms: number;
  inter_node_duration_ms: number;
  network_bottleneck: 'INTRA_NVLINK' | 'INTER_ROCE';
}

/**
 * Расчет времени Ring-AllReduce для распределенного обучения:
 * T = 2 * ((N - 1) / N) * (M / BW) + 2 * (N - 1) * alpha
 */
export function solveHierarchicalAllReduce(input: RingAllReduceInput): RingAllReduceOutput {
  const {
    gpus_count,
    gpus_per_node = 8,
    gradient_payload_bytes,
    nvlink_bandwidth_gb_s = 900,
    roce_bandwidth_gbps = 400,
  } = input;

  const total_nodes = Math.max(1, Math.ceil(gpus_count / gpus_per_node));
  const M_bytes = gradient_payload_bytes;

  // 1. Внутри узла (8x GPU через NVLink NVSwitch):
  // Пропускная способность NVLink на GPU: 900 GB/s
  const nvlink_bw_bytes_sec = nvlink_bandwidth_gb_s * 1e9;
  const alpha_nvlink = 1e-6; // латентность пакета 1 мкс
  const t_intra_sec = 2.0 * ((gpus_per_node - 1) / gpus_per_node) * (M_bytes / nvlink_bw_bytes_sec) +
                      2.0 * (gpus_per_node - 1) * alpha_nvlink;

  // 2. Межузловая редукция (RoCE v2 / InfiniBand через Leaf-Spine сеть):
  // 400 Gbps = 50 GB/s
  const roce_bw_bytes_sec = (roce_bandwidth_gbps * 1e9) / 8.0;
  const alpha_roce = 4.5e-6; // латентность коммутатора 4.5 мкс

  let t_inter_sec = 0;
  if (total_nodes > 1) {
    t_inter_sec = 2.0 * ((total_nodes - 1) / total_nodes) * (M_bytes / roce_bw_bytes_sec) +
                  2.0 * (total_nodes - 1) * alpha_roce;
  }

  const intra_node_duration_ms = t_intra_sec * 1000.0;
  const inter_node_duration_ms = t_inter_sec * 1000.0;
  const allreduce_duration_ms = intra_node_duration_ms + inter_node_duration_ms;

  return {
    allreduce_duration_ms,
    intra_node_duration_ms,
    inter_node_duration_ms,
    network_bottleneck: inter_node_duration_ms > intra_node_duration_ms ? 'INTER_ROCE' : 'INTRA_NVLINK',
  };
}
