/**
 * Аналитический солвер распределенных очередей и хвостовых квантилей (L4 / L5).
 * Реализует замкнутые формулы Поллачека-Хинчина (M/G/1), Аллена-Каннина (G/G/c),
 * аппроксимацию Кимуры и разложение Корниша-Фишера для P99/P99.9.
 */

export interface QueueSolverInput {
  lambda_rps: number;                 // Входящий поток (arrival rate)
  service_time_mean_ms: number;       // Среднее время обработки одним инстансом E[S]
  service_time_cv?: number;           // Коэффициент вариации времени обработки Cs (default 0.5)
  servers_count: number;              // Число параллельных реплик/потоков c
  inter_arrival_cv?: number;          // Коэффициент вариации межприбытия Ca (1.0 для Пуассона, >1 для пачек)
  max_queue_capacity?: number;        // Максимальная длина очереди буфера
}

export interface QueueSolverOutput {
  utilization_rho: number;            // Коэффициент загрузки системы rho
  mean_queue_wait_ms: number;         // Среднее время ожидания в очереди Wq
  mean_system_latency_ms: number;     // Среднее сквозное время в узле E[T] = Wq + E[S]
  p50_latency_ms: number;             // Медианная задержка
  p99_latency_ms: number;             // Хвостовая задержка P99
  p999_latency_ms: number;            // Хвостовая задержка P99.9
  mean_queue_depth: number;           // Средняя длина очереди Lq
  p99_queue_depth: number;            // Квантиль P99 длины очереди
  throughput_rps: number;             // Реализованная пропускная способность
  dropped_rps: number;                // Потери при насыщении буфера
  is_stable: boolean;                 // Стабильна ли система (rho < 1)
}

/**
 * Аппроксимация вероятности ожидания Эрланга-C (Erlang-C formula)
 */
function erlangCDelayProbability(c: number, rho: number): number {
  if (rho >= 1.0) return 1.0;
  if (c <= 1) return rho;

  // Sakasegawa approximation for multi-server wait probability
  const pw = Math.pow(rho, Math.sqrt(2 * (c + 1)) - 1);
  return Math.min(1.0, Math.max(0.0, pw));
}

export function solveDistributedQueue(input: QueueSolverInput): QueueSolverOutput {
  const {
    lambda_rps,
    service_time_mean_ms,
    service_time_cv = 0.5,
    servers_count,
    inter_arrival_cv = 1.0,
    max_queue_capacity = 10000,
  } = input;

  const c = Math.max(1, servers_count);
  const es_sec = service_time_mean_ms / 1000.0;
  const mu_per_server = 1.0 / Math.max(0.0001, es_sec);
  const total_capacity_rps = c * mu_per_server;

  const rho_raw = lambda_rps / Math.max(0.0001, total_capacity_rps);
  const is_stable = rho_raw < 0.98;

  let throughput_rps = lambda_rps;
  let dropped_rps = 0;
  let rho = rho_raw;

  if (rho_raw >= 1.0) {
    // Перегрузка: избыток сбрасывается или встает в ограниченный буфер
    throughput_rps = total_capacity_rps * 0.99;
    dropped_rps = lambda_rps - throughput_rps;
    rho = 0.99;
  }

  const ca2 = Math.pow(inter_arrival_cv, 2);
  const cs2 = Math.pow(service_time_cv, 2);

  let mean_queue_wait_sec = 0;

  if (c === 1) {
    // 1. Формула Поллачека-Хинчина для M/G/1
    mean_queue_wait_sec = (rho / (mu_per_server * (1.0 - rho))) * ((ca2 + cs2) / 2.0);
  } else {
    // 2. Аппроксимация Аллена-Каннина для G/G/c
    const pc = erlangCDelayProbability(c, rho);
    mean_queue_wait_sec = (pc / (c * mu_per_server * (1.0 - rho))) * ((ca2 + cs2) / 2.0);
  }

  const mean_queue_wait_ms = mean_queue_wait_sec * 1000.0;
  const mean_system_latency_ms = mean_queue_wait_ms + service_time_mean_ms;

  // Длина очереди по закону Литтла: Lq = lambda * Wq
  const mean_queue_depth = throughput_rps * mean_queue_wait_sec;

  // Дисперсия времени пребывания
  const sigma_service_ms = service_time_mean_ms * service_time_cv;
  const sigma_queue_ms = mean_queue_wait_ms * Math.sqrt(Math.max(0.2, (2 * rho - Math.pow(rho, 2) + ca2) / Math.max(0.1, 1 - rho)));
  const sigma_total_ms = Math.sqrt(Math.pow(sigma_service_ms, 2) + Math.pow(sigma_queue_ms, 2));

  // Асимметрия распределения gamma_1 для Корниша-Фишера
  const skewness = Math.min(6.0, Math.max(0.5, 2.0 * (inter_arrival_cv + service_time_cv) / Math.sqrt(c * Math.max(0.01, 1.0 - rho))));

  // Квантили стандартного нормального распределения: z_0.50 = 0, z_0.99 = 2.3263, z_0.999 = 3.0902
  const z99 = 2.3263;
  const z999 = 3.0902;

  // Разложение Корниша-Фишера
  const cf_adjustment_99 = (skewness / 6.0) * (Math.pow(z99, 2) - 1.0);
  const cf_adjustment_999 = (skewness / 6.0) * (Math.pow(z999, 2) - 1.0);

  const p50_latency_ms = Math.max(service_time_mean_ms * 0.8, mean_system_latency_ms - sigma_total_ms * 0.2);
  const p99_latency_ms = mean_system_latency_ms + sigma_total_ms * (z99 + cf_adjustment_99);
  const p999_latency_ms = mean_system_latency_ms + sigma_total_ms * (z999 + cf_adjustment_999);

  // Квантиль длины очереди
  const p99_queue_depth = Math.min(max_queue_capacity, Math.ceil(mean_queue_depth + Math.sqrt(mean_queue_depth + 1) * z99));

  return {
    utilization_rho: rho_raw,
    mean_queue_wait_ms,
    mean_system_latency_ms,
    p50_latency_ms,
    p99_latency_ms: is_stable ? p99_latency_ms : p99_latency_ms * 3.0,
    p999_latency_ms: is_stable ? p999_latency_ms : p999_latency_ms * 4.0,
    mean_queue_depth,
    p99_queue_depth,
    throughput_rps,
    dropped_rps,
    is_stable,
  };
}
