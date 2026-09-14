/**
 * Солвер аппаратного Roofline-анализа инференса LLM (L5 AI Infrastructure).
 * Реализует двухфазную модель:
 * - Prefill Phase (Compute-Bound FLOPs, расчет TTFT)
 * - Decode Phase (Memory-Bandwidth-Bound HBM, расчет TPOT / ITL)
 * - PagedAttention KV-Cache фрагментация и вытеснение (Preemption).
 */

export interface AiRooflineInput {
  model_params_billions?: number;     // e.g. 70 for 70B, 8 for 8B (default 70)
  weight_precision_bytes?: number;    // FP16 = 2.0, FP8 = 1.0, INT4 = 0.5 (default 2.0)
  kv_precision_bytes?: number;        // FP16 = 2.0, FP8 = 1.0 (default 2.0)
  prompt_tokens_mean: number;         // T_in (default 512)
  generation_tokens_mean: number;     // T_out (default 256)
  concurrency_batch_size: number;     // B (число параллельных стримов)
  gpu_count: number;                  // Число GPU в тензорном параллелизме (TP)
  peak_flops_tflops?: number;         // e.g. 989 for H100 SXM5 FP16
  memory_bandwidth_tb_s?: number;     // e.g. 3.35 for H100 SXM5 HBM3
  vram_per_gpu_gb?: number;           // e.g. 80 for H100 80GB
  use_paged_attention?: boolean;      // true: fragmentation < 4%, false: 60%
}

export interface AiRooflineOutput {
  ttft_mean_ms: number;               // Time to First Token (Prefill)
  tpot_mean_ms: number;               // Time Per Output Token (Inter-Token Latency)
  total_generation_latency_ms: number;// TTFT + T_out * TPOT
  effective_tokens_per_sec: number;   // Глобальная генерация кластера tok/s
  kv_cache_total_gb: number;          // Потребление памяти под KV-кэш
  kv_cache_utilization_percent: number;// % утилизации доступной VRAM
  preempted_requests_count: number;   // Число вытесненных запросов при OOM
  hbm_bandwidth_utilization_percent: number;
  compute_flops_utilization_percent: number;
  is_memory_bound: boolean;
}

export function solveAiRoofline(input: AiRooflineInput): AiRooflineOutput {
  const {
    model_params_billions = 70,
    weight_precision_bytes = 2.0,
    kv_precision_bytes = 2.0,
    prompt_tokens_mean,
    generation_tokens_mean,
    concurrency_batch_size,
    gpu_count,
    peak_flops_tflops = 989.0,        // H100 SXM5
    memory_bandwidth_tb_s = 3.35,     // H100 SXM5 HBM3
    vram_per_gpu_gb = 80.0,
    use_paged_attention = true,
  } = input;

  const B = Math.max(1, concurrency_batch_size);
  const TP = Math.max(1, gpu_count);
  const total_vram_gb = vram_per_gpu_gb * TP;

  // Модель LLaMA 70B / 8B архитектурные константы
  const P = model_params_billions * 1e9;
  const L = model_params_billions >= 65 ? 80 : 32;
  const d_model = model_params_billions >= 65 ? 8192 : 4096;

  // Память под статические веса
  const weights_memory_gb = (P * weight_precision_bytes) / (1024 * 1024 * 1024);
  const available_kv_vram_gb = Math.max(1.0, total_vram_gb - weights_memory_gb);

  // Память KV кэша на один токен контекста: 2 (K+V) * layers * d_model * precision
  const kv_bytes_per_token = 2.0 * L * d_model * kv_precision_bytes;
  const avg_context_tokens = prompt_tokens_mean + generation_tokens_mean / 2.0;

  // Фрагментация памяти (PagedAttention vs Contiguous allocation)
  const fragmentation_overhead = use_paged_attention ? 1.04 : 1.60;
  const single_stream_kv_gb = (avg_context_tokens * kv_bytes_per_token * fragmentation_overhead) / (1024 * 1024 * 1024);
  const kv_cache_total_gb = single_stream_kv_gb * B;

  const kv_cache_utilization_percent = Math.min(150.0, (kv_cache_total_gb / available_kv_vram_gb) * 100.0);

  // Вытеснение при превышении VRAM (Preemption)
  let preempted_requests_count = 0;
  let effective_active_batch = B;
  if (kv_cache_total_gb > available_kv_vram_gb) {
    const supported_streams = Math.floor(available_kv_vram_gb / single_stream_kv_gb);
    preempted_requests_count = Math.max(0, B - supported_streams);
    effective_active_batch = Math.max(1, supported_streams);
  }

  // Аппаратные лимиты кластера с учетом тензорного параллелизма
  // Эффективность TP масштабирования (коммуникация All-Reduce NVLink)
  const tp_efficiency = TP === 1 ? 1.0 : (TP <= 8 ? 0.92 : 0.78);
  const total_peak_flops = peak_flops_tflops * 1e12 * TP * tp_efficiency;
  const total_mem_bw_bytes_sec = memory_bandwidth_tb_s * 1e12 * TP * tp_efficiency;

  // ==========================================
  // 1. Prefill Phase (расчет TTFT)
  // Compute: 2 * P * prompt_tokens FLOPs
  // Memory: веса считываются 1 раз для всего батча префилла
  // ==========================================
  const prefill_flops = 2.0 * P * prompt_tokens_mean * effective_active_batch;
  const t_prefill_compute_sec = prefill_flops / total_peak_flops;
  const t_prefill_memory_sec = (P * weight_precision_bytes) / total_mem_bw_bytes_sec;
  const ttft_sec = Math.max(t_prefill_compute_sec, t_prefill_memory_sec);
  const ttft_mean_ms = ttft_sec * 1000.0;

  // ==========================================
  // 2. Decode Phase (расчет TPOT / ITL)
  // На каждый сгенерированный токен считываются ВСЕ веса модели + текущий KV-кэш
  // При непрерывном батчинге чтение весов амортизируется между B запросами
  // ==========================================
  const weights_read_per_token_bytes = (P * weight_precision_bytes) / effective_active_batch;
  const kv_read_per_token_bytes = avg_context_tokens * kv_bytes_per_token;
  const total_bytes_per_decode_step = (weights_read_per_token_bytes + kv_read_per_token_bytes) * effective_active_batch;

  const tpot_sec = total_bytes_per_decode_step / total_mem_bw_bytes_sec;
  const tpot_mean_ms = Math.max(4.0, tpot_sec * 1000.0);

  const total_generation_latency_ms = ttft_mean_ms + generation_tokens_mean * tpot_mean_ms;
  const effective_tokens_per_sec = (effective_active_batch * 1000.0) / tpot_mean_ms;

  const hbm_bandwidth_utilization_percent = Math.min(100.0, (total_bytes_per_decode_step / (total_mem_bw_bytes_sec * tpot_sec)) * 100.0);
  const compute_flops_utilization_percent = Math.min(100.0, (prefill_flops / (total_peak_flops * ttft_sec)) * 100.0);

  return {
    ttft_mean_ms,
    tpot_mean_ms,
    total_generation_latency_ms,
    effective_tokens_per_sec,
    kv_cache_total_gb,
    kv_cache_utilization_percent,
    preempted_requests_count,
    hbm_bandwidth_utilization_percent,
    compute_flops_utilization_percent,
    is_memory_bound: true,
  };
}
