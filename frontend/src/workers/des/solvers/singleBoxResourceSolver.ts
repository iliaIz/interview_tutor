/**
 * Солвер аппаратных ресурсов одиночного сервера (L3 / L4 Micro-Architecture).
 * Реализует физические законы: Little's Law, Context-Switching penalty в СУБД,
 * пиннинг carrier-потоков Java 21 (ForkJoinPool) и дисковый сброс буферов Nginx.
 */

export interface HikariSolverInput {
  arrival_rate_rps: number;
  pool_size: number;
  cores: number;
  base_query_latency_ms: number;
  connection_timeout_ms?: number;
}

export interface HikariSolverOutput {
  effective_query_latency_ms: number;
  pool_utilization: number;
  is_exhausted: boolean;
  connection_wait_ms: number;
  p99_latency_ms: number;
  dropped_rps: number;
  is_stable: boolean;
}

export function solveHikariCP(input: HikariSolverInput): HikariSolverOutput {
  const {
    arrival_rate_rps,
    pool_size,
    cores,
    base_query_latency_ms,
    connection_timeout_ms = 250,
  } = input;

  // 1. Деградация от переразмеренного пула (> 2x Cores)
  // Увеличение числа активных соединений свыше 2x ядер вызывает context-switch thrashing
  const alpha_cs = 0.04;
  const extra_conns = Math.max(0, pool_size - 2 * cores);
  const effective_query_latency_ms = base_query_latency_ms * (1 + alpha_cs * extra_conns);

  // 2. Предельная пропускная способность пула (Little's Law)
  // max_throughput = pool_size / (effective_latency_in_seconds)
  const service_rate_per_conn = 1000.0 / Math.max(0.1, effective_query_latency_ms);
  const max_pool_capacity_rps = pool_size * service_rate_per_conn;

  const utilization = Math.min(1.0, arrival_rate_rps / Math.max(1, max_pool_capacity_rps));
  const is_exhausted = arrival_rate_rps >= max_pool_capacity_rps * 0.95;

  let connection_wait_ms = 0;
  let dropped_rps = 0;

  if (arrival_rate_rps < max_pool_capacity_rps) {
    // M/M/c queueing approximation for connection acquisition wait
    const rho = utilization;
    if (rho > 0.01) {
      connection_wait_ms = (rho / (1 - rho * 0.98)) * (effective_query_latency_ms / pool_size);
    }
  } else {
    // Очередь переполнена, время ожидания превышает таймаут
    const overflow_rps = arrival_rate_rps - max_pool_capacity_rps;
    connection_wait_ms = connection_timeout_ms + (overflow_rps / max_pool_capacity_rps) * 100;
    dropped_rps = overflow_rps;
  }

  const is_stable = dropped_rps === 0 && connection_wait_ms < connection_timeout_ms;
  const total_mean_ms = effective_query_latency_ms + Math.min(connection_timeout_ms, connection_wait_ms);
  const p99_latency_ms = total_mean_ms * (is_stable ? 1.8 : 3.5);

  return {
    effective_query_latency_ms,
    pool_utilization: utilization * 100,
    is_exhausted,
    connection_wait_ms,
    p99_latency_ms,
    dropped_rps,
    is_stable,
  };
}

export interface VirtualThreadsSolverInput {
  active_virtual_threads: number;
  cores: number;
  blocking_io_latency_ms: number;
  uses_synchronized_blocks: boolean;
}

export interface VirtualThreadsSolverOutput {
  carrier_thread_pinned: boolean;
  carrier_wait_latency_ms: number;
  effective_p99_ms: number;
  is_starving: boolean;
}

export function solveVirtualThreadPinning(input: VirtualThreadsSolverInput): VirtualThreadsSolverOutput {
  const {
    active_virtual_threads,
    cores,
    blocking_io_latency_ms,
    uses_synchronized_blocks,
  } = input;

  if (!uses_synchronized_blocks) {
    // Java 21 с ReentrantLock или Java 24 (JEP 491) — carrier threads не пинятся
    return {
      carrier_thread_pinned: false,
      carrier_wait_latency_ms: 0,
      effective_p99_ms: blocking_io_latency_ms * 1.25,
      is_starving: false,
    };
  }

  // При наличии synchronized вокруг блокирующего IO, carrier-потоки ForkJoinPool пинятся
  const pinned_carriers = Math.min(cores, active_virtual_threads);
  const carrier_thread_pinned = pinned_carriers >= cores;

  let carrier_wait_latency_ms = 0;
  let is_starving = false;

  if (active_virtual_threads > cores) {
    // Остальные виртуальные потоки ждут освобождения carrier потока
    is_starving = true;
    const queued_threads = active_virtual_threads - cores;
    carrier_wait_latency_ms = (queued_threads / cores) * blocking_io_latency_ms;
  }

  const effective_p99_ms = (blocking_io_latency_ms + carrier_wait_latency_ms) * 2.2;

  return {
    carrier_thread_pinned,
    carrier_wait_latency_ms,
    effective_p99_ms,
    is_starving,
  };
}

export interface NginxBufferSolverInput {
  response_body_bytes: number;
  proxy_buffer_size_bytes: number;
  proxy_buffering_enabled: boolean;
  disk_write_bw_mb_s?: number; // default 150 MB/s under IO pressure
}

export interface NginxBufferSolverOutput {
  nginx_disk_spool_active: boolean;
  disk_spool_delay_ms: number;
  total_nginx_latency_ms: number;
}

export function solveNginxBuffering(input: NginxBufferSolverInput): NginxBufferSolverOutput {
  const {
    response_body_bytes,
    proxy_buffer_size_bytes,
    proxy_buffering_enabled,
    disk_write_bw_mb_s = 150,
  } = input;

  const base_network_ram_ms = 1.2;

  if (!proxy_buffering_enabled) {
    // proxy_buffering off: потоковая передача chunked/SSE напрямую без диска
    return {
      nginx_disk_spool_active: false,
      disk_spool_delay_ms: 0,
      total_nginx_latency_ms: base_network_ram_ms,
    };
  }

  if (response_body_bytes <= proxy_buffer_size_bytes) {
    return {
      nginx_disk_spool_active: false,
      disk_spool_delay_ms: 0,
      total_nginx_latency_ms: base_network_ram_ms,
    };
  }

  // Тело ответа превысило proxy_buffer_size -> сброс во временный файл на диск
  const overflow_bytes = response_body_bytes - proxy_buffer_size_bytes;
  const disk_write_bw_bytes_per_ms = (disk_write_bw_mb_s * 1024 * 1024) / 1000.0;
  const t_fs_sync = 12.0; // задержка fsync на SSD под нагрузкой
  const disk_spool_delay_ms = overflow_bytes / disk_write_bw_bytes_per_ms + t_fs_sync;

  return {
    nginx_disk_spool_active: true,
    disk_spool_delay_ms,
    total_nginx_latency_ms: base_network_ram_ms + disk_spool_delay_ms,
  };
}
