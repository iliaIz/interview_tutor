# 🛠️ Stage 2 Specification: Discrete-Event Simulation (DES) Web Worker Kernel

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.0.0`  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-02` (Decoupled Presentation & Transport), `INV-04` (Hardware-Grounded Physical Simulation).

---

## 1. Executive Summary & Hardware Physics

### 1.1. Назначение этапа
Реализовать изолированный, многопоточный **дискретно-событийный симулятор (DES Engine)** в выделенном Web Worker (`frontend/src/workers/desSimulator.worker.ts`).
Симулятор производит динамический расчёт задержек, очередей, пропускной способности и финансовой стоимости спроектированных топологий под стохастической нагрузкой в реальном времени.

### 1.2. Архитектурные требования
* **Zero Main-Thread Jitter (60 FPS UI):** 100% математических вычислений выполняются в Web Worker. Передача телеметрии в основной поток осуществляется через структурированные сообщения `postMessage` (с поддержкой `Transferable ArrayBuffer` для временных рядов).
* **Субмиллисекундная итерация ($<0.5\text{ мс}$):** Для мгновенного отклика UI при изменении ползунков параметров вместо эмпирического отслеживания миллионов отдельных событий симулятор использует замкнутые аналитические модели очередей и квантильные разложения.
* **Абсолютная физическая достоверность:** Запрещена генерация случайных псевдозадержек через `Math.random() * 100`. Каждая задержка вычисляется из характеристик оборудования (FLOPs, HBM Bandwidth, IOPS, сетевые RTT).

---

## 2. Математические модули вычислительного ядра

```
frontend/src/workers/des/
├── desSimulator.worker.ts        # Точка входа воркера (message dispatcher)
├── engines/
│   ├── llmRooflineEngine.ts      # Физика Prefill (FLOPs) и Decode (HBM)
│   ├── continuousBatching.ts     # Итерационный шедулер и PagedAttention
│   ├── vectorDbEngine.ts         # HNSW, IVF-PQ, DiskANN, Hybrid RRF
│   ├── semanticCacheEngine.ts    # Косинусное сходство и алгоритм XFetch
│   ├── analyticalQueueSolvers.ts # Erlang-C, M/G/1, G/G/c, Kimura, Cornish-Fisher
│   └── chaosMonkeyEngine.ts      # Инъекция сбоев (network drop, disk stall)
└── types/
    └── workerMessages.ts         # Типизированные контракты сообщений
```

### 2.1. Модуль `llmRooflineEngine.ts`: Двухфазный инференс LLM
Задержка инференса разделяется на две несимметричные фазы:

#### 1. Prefill Phase (Compute-Bound, расчёт TTFT)
Вычисление всех $T_{\text{in}}$ токенов входного промпта:
$$T_{\text{prefill}} = \max\left(\frac{2 \cdot P \cdot T_{\text{in}}}{\Phi_{\text{peak}}}, \frac{P \cdot b_{\text{param}}}{BW_{\text{mem}}}\right)$$
* $P$ — активное число параметров (например, $70 \times 10^9$).
* $\Phi_{\text{peak}}$ — пиковая производительность тензорных ядер (например, для H100 SXM5: $989 \times 10^{12}\text{ FLOP/s}$ FP16).
* $BW_{\text{mem}}$ — пропускная способность памяти HBM (H100: $3.35 \times 10^{12}\text{ Б/с}$).
* $b_{\text{param}}$ — размер веса (2 байта для FP16, 1 байт для FP8).

#### 2. Decode Phase (Memory-Bandwidth-Bound, расчёт TPOT / ITL)
Авторегрессионная генерация токена:
$$T_{\text{decode}} = \frac{P \cdot b_{\text{param}} + 2 \cdot b_{\text{kv}} \cdot L \cdot d_{\text{model}} \cdot S_{\text{ctx}}}{BW_{\text{mem}}}$$
* $L$ — число слоев Transformer (например, 80).
* $d_{\text{model}}$ — размер скрытого слоя (например, 8192).
* $S_{\text{ctx}}$ — суммарная длина контекста в KV-кэше.
* $b_{\text{kv}}$ — разрядность KV-кэша.

### 2.2. Модуль `continuousBatching.ts`: Пагинация PagedAttention
* **Лимит памяти KV-кэша:**
  $$M_{\text{available\_kv}} = M_{\text{HBM\_total}} - (P \cdot b_{\text{param}} + M_{\text{cuda\_runtime}})$$
* **Динамический размер батча $B_t$:**
  $$B_t = \min\left(B_{\text{max}}, \left\lfloor \frac{M_{\text{available\_kv}}}{2 \cdot b_{\text{kv}} \cdot L \cdot d_{\text{model}} \cdot \bar{S}_{\text{ctx}}} \right\rfloor\right)$$
* **Вытеснение (Preemption):** Если в момент времени $t$ требуемая память превышает $M_{\text{available\_kv}}$, запросы с наименьшим приоритетом переводятся в состояние `PREEMPTED`, их KV-блоки сбрасываются или выгружаются в host-память, а клиенту симулируется пауза (inter-token stall).

### 2.3. Модуль `vectorDbEngine.ts`: ANN-поиск и гибридное слияние
* **HNSW (Hierarchical Navigable Small World):**
  $$T_{\text{HNSW}} \approx T_{\text{hop}} \cdot M \cdot \ln(N) \cdot \frac{efSearch}{M}$$
  Точность поиска (Recall): $\text{Recall} \approx 1 - \exp(-\alpha \cdot efSearch^{\beta})$.
* **IVF-PQ (Inverted File + Product Quantization):**
  Моделирование задержки поиска центроидов $\mathcal{O}(k_{\text{centroids}} \cdot D)$ + асимметричное вычисление расстояний по таблице (ADC) с квантизационным шумом.
* **DiskANN (Vamana):**
  Учет задержек случайного чтения с NVMe SSD: $T_{\text{DiskANN}} = N_{\text{beam\_hops}} \times T_{\text{NVMe\_read}}$ ($T_{\text{NVMe\_read}} \approx 12\text{ мкс}$).
* **Reciprocal Rank Fusion (RRF):**
  $$RRF\_Score(d) = \sum_{m \in \{\text{dense}, \text{sparse}\}} \frac{1}{60 + r_m(d)}$$

### 2.4. Модуль `semanticCacheEngine.ts`: Семантическое кэширование и XFetch
* **Косинусное соответствие:** Попадание в кэш $\iff 1 - \cos(\vec{u}, \vec{v}) \le \tau$ (типичный $\tau = 0.08$–$0.12$).
* **Предотвращение Cache Stampede (XFetch Algorithm):**
  Упреждающее асинхронное перевычисление горячего ответа в фоне до наступления физического TTL:
  $$\text{Recompute} \iff t - \beta \cdot \delta \cdot \ln(\text{rand}()) > \text{expiry}$$
  где $\delta$ — задержка генерации ответа моделью, $\beta = 1.0$ — параметр упреждения.

### 2.5. Модуль `analyticalQueueSolvers.ts`: Замкнутые солверы очередей
Для обеспечения субмиллисекундного расчёта очередей симулятор вычисляет квантили через первые три момента распределения:
* **$M/G/1$ (Pollaczek-Khinchine):**
  $$W_q = \frac{\rho}{\mu(1-\rho)} \cdot \left(\frac{1 + C_s^2}{2}\right),\quad C_s^2 = \frac{\sigma_s^2}{(\mathbb{E}[S])^2}$$
* **$G/G/c$ (Allen-Cunneen):**
  $$W_q \approx \frac{P_c}{c\mu(1-\rho)} \cdot \left(\frac{C_a^2 + C_s^2}{2}\right)$$
* **Квантили $P99$ и $P99.9$ (Аппроксимация Кимуры и разложение Корниша-Фишера):**
  $$P_{99} \approx \mathbb{E}[T] + \sigma_T \cdot \left(z_{0.99} + \frac{\gamma_1}{6}(z_{0.99}^2 - 1)\right)$$
  где $z_{0.99} = 2.326$, $\gamma_1$ — коэффициент асимметрии (skewness) времени обслуживания.

### 2.6. Модуль `chaosMonkeyEngine.ts`: Инъекция сбоев
Поддерживает расписание сбоев из манифеста (`chaos_schedule`):
1. `PACKET_LOSS_SPIKE`: увеличение RTT ребра и рост коэффициента вариации прибытия $C_a$.
2. `RAFT_LEADER_ELECTION`: полная недоступность узла на $150$–$300\text{ мс}$ с последующим наплывом накопившейся очереди.
3. `DISK_IOPS_STALL`: деградация времени обслуживания узла хранилища в 10 раз.
4. `GPU_OOM_PREEMPTION`: принудительное переполнение памяти KV-кэша.

---

## 3. Контракты сообщений Web Worker (`types/workerMessages.ts`)

```typescript
export interface SimulationRequestMessage {
  type: 'RUN_SIMULATION';
  requestId: string;
  topology: {
    nodes: Array<{
      id: string;
      type: string;
      params: Record<string, any>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      protocol: string;
    }>;
  };
  traffic: {
    pattern: 'POISSON' | 'BURSTY';
    lambda_mean_rps: number;
    ca_coefficient: number;
    prompt_tokens_mean?: number;
    generation_tokens_mean?: number;
  };
  duration_seconds: number;
  enable_chaos?: boolean;
}

export interface NodeTelemetry {
  nodeId: string;
  arrival_rate_rps: number;
  throughput_rps: number;
  queue_depth_mean: number;
  queue_depth_p99: number;
  latency_mean_ms: number;
  latency_p99_ms: number;
  latency_p999_ms: number;
  utilization_percent: number;
  cost_monthly_usd: number;
  dropped_requests_count: number;
  // Специфично для LLM
  ttft_p99_ms?: number;
  tpot_p99_ms?: number;
  kv_cache_utilization_percent?: number;
  preempted_requests_count?: number;
  // Специфично для Cache
  cache_hit_rate_percent?: number;
  xfetch_early_refreshes_count?: number;
}

export interface SimulationResponseMessage {
  type: 'SIMULATION_RESULT';
  requestId: string;
  execution_duration_ms: number;
  summary: {
    system_p99_latency_ms: number;
    system_p999_latency_ms: number;
    system_availability_nines: number;
    total_monthly_cost_usd: number;
    is_stable: boolean;
    bottleneck_node_id: string | null;
  };
  node_telemetry: Record<string, NodeTelemetry>;
  timeline_samples: Array<{
    timestamp_second: number;
    p99_latency_ms: number;
    throughput_rps: number;
    active_chaos_events: string[];
  }>;
}
```

---

## 4. Definition of Done (DoD) для Stage 2

Этап считается завершенным **только** при выполнении следующих критериев:

1. [ ] **Worker Compilation:** Файл `frontend/src/workers/desSimulator.worker.ts` собирается Vite без ошибок и корректно инициализируется через `new Worker(new URL(...))`.
2. [ ] **Sub-Millisecond Execution Benchmark:** Время выполнения одной полной симуляции для графа из 15 узлов на 10 000 виртуальных запросов составляет $<10\text{ мс}$ в Web Worker.
3. [ ] **Mathematical Unit Tests:** Модульные тесты подтверждают совпадение расчётов:
   * Prefill/Decode задержек H100 с теоретическими аппаратными пределами.
   * Формул Поллачека-Хинчина и Аллена-Каннина с эталонными математическими таблицами.
   * XFetch сходимости с Monte-Carlo симуляцией stampede.
4. [ ] **Chaos Injection Verification:** Тест симуляции подтверждает скачок задержки $P99$ при разрыве линка Raft-лидера и возврат к норме после завершения сбоя.
5. [ ] **Zero Main-Thread Blocking:** Профайлер Chrome DevTools подтверждает отсутствие Long Tasks ($>50\text{ мс}$) в основном UI-потоке во время непрерывной симуляции.
