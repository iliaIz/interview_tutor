/**
 * Солвер векторного поиска (HNSW, RRF) и вероятностного кэширования (XFetch).
 * Моделирует защиту от Cache Stampede и латентность эмбеддинг-индексации.
 */

export interface XFetchInput {
  current_time_sec: number;
  key_expiry_sec: number;
  compute_duration_sec: number;       // delta: время повторного расчета
  beta?: number;                      // параметр упреждения (default 1.0)
  random_uniform?: number;            // u ~ U(0, 1)
}

export interface XFetchOutput {
  should_recompute_early: boolean;
  delta_threshold_sec: number;
}

/**
 * Алгоритм XFetch (Vattani et al.):
 * Recompute <=> t - beta * delta * ln(u) > expiry
 */
export function evaluateXFetch(input: XFetchInput): XFetchOutput {
  const {
    current_time_sec,
    key_expiry_sec,
    compute_duration_sec,
    beta = 1.0,
    random_uniform = Math.random(),
  } = input;

  const u = Math.max(0.00001, Math.min(0.99999, random_uniform));
  const early_delta = -beta * compute_duration_sec * Math.log(u);
  const should_recompute_early = (current_time_sec + early_delta) > key_expiry_sec;

  return {
    should_recompute_early,
    delta_threshold_sec: early_delta,
  };
}

export interface HnswVectorSearchInput {
  index_vectors_count: number;        // N векторов в индексе (e.g. 1_000_000)
  dimension: number;                  // d (e.g. 1536 для OpenAI / text-embedding-3)
  m_neighbors: number;                // M (e.g. 16..64)
  ef_search: number;                  // размер окна поиска (e.g. 64..256)
  use_quantization: boolean;          // Scalar Quantization SQ8 vs FP32
}

export interface HnswVectorSearchOutput {
  search_latency_ms: number;
  distance_computations_count: number;
  recall_at_10: number;
  memory_footprint_mb: number;
}

export function solveHnswVectorSearch(input: HnswVectorSearchInput): HnswVectorSearchOutput {
  const {
    index_vectors_count,
    dimension,
    m_neighbors,
    ef_search,
    use_quantization,
  } = input;

  // Оценка числа вычислений расстояний в HNSW графе
  // ~ O(log(N) * M) на верхних слоях + ef_search * M на базовом слое 0
  const log_n = Math.log2(Math.max(10, index_vectors_count));
  const distance_computations_count = Math.round(log_n * m_neighbors + ef_search * m_neighbors * 0.45);

  // Время одного вычисления расстояния (AVX-512 / NEON):
  // FP32: ~ 0.2 наносекунды на измерение, SQ8: ~ 0.05 наносекунды
  const ns_per_dimension = use_quantization ? 0.06 : 0.22;
  const time_per_dist_ns = dimension * ns_per_dimension;
  const raw_search_time_ns = distance_computations_count * time_per_dist_ns;

  // Оверхед на обход указателей графа и аллокацию приоритетной очереди
  const queue_overhead_ms = 0.35 + (ef_search / 256.0) * 0.4;
  const search_latency_ms = (raw_search_time_ns / 1_000_000.0) + queue_overhead_ms;

  // Аппроксимация точности Recall@10 от ef_search
  const recall_at_10 = Math.min(0.995, 0.82 + 0.17 * (1.0 - Math.exp(-ef_search / 45.0)));

  // Потребление памяти под векторный индекс:
  // Веса векторов + граф связности: N * (d * bytes + M * 4 bytes)
  const bytes_per_dim = use_quantization ? 1 : 4;
  const bytes_per_vector = dimension * bytes_per_dim + m_neighbors * 4;
  const memory_footprint_mb = (index_vectors_count * bytes_per_vector) / (1024 * 1024);

  return {
    search_latency_ms,
    distance_computations_count,
    recall_at_10,
    memory_footprint_mb,
  };
}
