# 🛠️ Stage 2 Specification: Discrete-Event Simulation (DES) Web Worker Kernel

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.1.0-RECONCILED` (Полная синхронизация с математическими моделями B2, B3, B4)  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-02` (Decoupled Presentation & Transport), `INV-04` (Hardware-Grounded Physical Simulation).

---

## 1. Executive Summary & Hardware Physics

### 1.1. Назначение этапа
Реализовать многопоточное вычислительное ядро **дискретно-событийного симулятора (DES Engine)** в выделенном Web Worker (`frontend/src/workers/desSimulator.worker.ts`).
Ядро производит расчет очередей, сквозных задержек ($P50, P99, P99.9$), аппаратной утилизации и финансовой стоимости (FinOps) для всех 26 канонических сценариев (от односерверных микро-кат L3 до планетарных ячеистых систем L7).

### 1.2. Архитектурные требования
* **Zero Main-Thread Jitter (60 FPS UI):** 100% математических вычислений выполняются в Web Worker. Передача телеметрии в UI-поток осуществляется через `postMessage` (с поддержкой `Transferable ArrayBuffer` для временных рядов).
* **Субмиллисекундная итерация ($<0.5\text{ мс}$ на шаг):** Мгновенный отклик при перетаскивании ползунков параметров за счет замкнутых аналитических формул (Поллачек-Хинчин, Аллен-Каннин, аппроксимация Кимуры и разложение Корниша-Фишера).
* **Абсолютная физическая достоверность (INV-04):** Никаких случайных псевдозадержек через `Math.random() * 100`. Задержки рассчитываются строго по физическим характеристикам оборудования:
  * Для микро-уровня (L3/L4): переключение контекста ядер CPU ($\tau_{\text{cs}}$), пиннинг carrier-потоков Java 21, дисковый сброс буферов Nginx, Little's Law пулов соединений.
  * Для AI-инфраструктуры (L5): Roofline-модели FLOPs/BW, фрагментация страниц PagedAttention, время обхода графа HNSW, сходимость алгоритма XFetch.
  * Для планетарных систем (L6/L7): радиус поражения ячеек ($\frac{1}{N_{\text{cells}}}$), задержки all-reduce на NVLink/RoCE, дрейф физических часов HLC, пропускная способность zero-copy eBPF.

---

## 2. Архитектура модулей вычислительного ядра

```
frontend/src/workers/des/
├── desSimulator.worker.ts            # Точка входа воркера (message dispatcher)
├── solvers/
│   ├── singleBoxResourceSolver.ts    # L3/L4: HikariCP, Virtual Threads, Nginx Buffers, Token Bucket
│   ├── distributedQueueSolver.ts     # L4/L5: M/G/1, G/G/c, Kimura P99, Cornish-Fisher Quantiles
│   ├── aiRooflineSolver.ts           # L5: Prefill (FLOPs), Decode (HBM), Continuous Batching
│   ├── vectorAndCacheSolver.ts       # L5: HNSW ANN, Hybrid RRF, XFetch Probabilistic Cache
│   └── planetaryCellularSolver.ts    # L6/L7: Cell Blast-Radius, NVLink/RoCE, HLC Clock Drift, eBPF
├── engines/
│   ├── chaosMonkeyEngine.ts          # Инъекция сбоев (network partition, disk stall, leader failover)
│   └── finOpsCostEngine.ts           # Посекундный расчет TCO (vCPU, RAM, HBM, Egress WAN, IOPS)
└── types/
    └── workerMessages.ts             # Строго типизированные интерфейсы запросов и телеметрии
```

---

## 3. Математическая физика подсистем (B2, B3, B4)

### 3.1. Модуль `singleBoxResourceSolver.ts` (L3 / L4 Физика микро-уровня)

#### 1. Sizing пула соединений HikariCP (Формула Литтла и оверхед CPU)
* **Закон Литтла:** Необходимый базовый размер пула:
  $$C_{\text{opt}} = \lambda \cdot \mathbb{E}[S_{\text{db}}]$$
  где $\lambda$ — входящий RPS, $\mathbb{E}[S_{\text{db}}]$ — среднее время выполнения SQL-запроса.
* **Деградация при переразмеренном пуле ($C > 2 \times \text{CoreCount}$):**
  Увеличение числа активных потоков СУБД свыше физических ядер вызывает context-switch thrashing. Эффективное время обслуживания запроса деградирует:
  $$\mathbb{E}[S_{\text{db}}](C) = \mathbb{E}[S_{\text{db\_base}}] \cdot \left(1 + \alpha_{\text{cs}} \cdot \max(0, C - 2 \cdot N_{\text{cores}})\right)$$
  где $\alpha_{\text{cs}} \approx 0.04$ — коэффициент замедления на каждое лишнее соединение.

#### 2. Пиннинг виртуальных потоков Java 21 (ForkJoinPool Starvation)
* Если в методе используется блок `synchronized (lock) { ioOperation(); }`, виртуальный поток привязывается к несущему OS-потоку (carrier thread) пула `ForkJoinPool.commonPool()` (размер пула по умолчанию равен числу ядер $N_{\text{cores}}$).
* При $N_{\text{pinned}} \ge N_{\text{cores}}$ весь пул carrier-потоков блокируется. Время ожидания в очереди для остальных $M$ виртуальных потоков растет скачкообразно:
  $$W_{\text{carrier\_queue}} = \frac{M - N_{\text{cores}}}{N_{\text{cores}}} \cdot T_{\text{blocking\_io}}$$
  В симуляции отображается всплеск задержки до секунд и генерация события `VirtualThreadPinnedException`.
* Переключение на `ReentrantLock` или рантайм Java 24 (JEP 491) устраняет пиннинг ($W_{\text{carrier\_queue}} \approx 0$).

#### 3. Переполнение буферов Nginx (Disk Spooling Penalty)
* Если размер тела ответа $S_{\text{resp}} > \text{proxy\_buffer\_size}$, Nginx сбрасывает остаток во временный файл на диск (`proxy_temp_path`):
  $$T_{\text{nginx\_resp}} = \begin{cases} 
    T_{\text{network\_ram}}, & \text{если } S_{\text{resp}} \le \text{proxy\_buffer\_size} \\
    T_{\text{network\_ram}} + \frac{S_{\text{resp}} - \text{proxy\_buffer\_size}}{BW_{\text{disk\_write}}} + T_{\text{fs\_sync}}, & \text{если } S_{\text{resp}} > \text{proxy\_buffer\_size}
  \end{cases}$$
  где $T_{\text{fs\_sync}} \approx 12\text{ мс}$ (задержка обращения к SSD под нагрузкой).

---

### 3.2. Модуль `aiRooflineSolver.ts` и `vectorAndCacheSolver.ts` (L5 AI Инфраструктура)

#### 1. Двухфазный Roofline инференса LLM
* **Prefill Phase (Compute-Bound, расчет TTFT):**
  $$T_{\text{prefill}} = \max\left(\frac{2 \cdot P \cdot T_{\text{in}}}{\Phi_{\text{peak}}}, \frac{P \cdot b_{\text{param}}}{BW_{\text{mem}}}\right)$$
* **Decode Phase (Memory-Bandwidth-Bound, расчет TPOT / ITL):**
  $$T_{\text{decode}} = \frac{P \cdot b_{\text{param}} + 2 \cdot b_{\text{kv}} \cdot L \cdot d_{\text{model}} \cdot S_{\text{ctx}}}{BW_{\text{mem}}}$$
  где для H100 SXM5: $\Phi_{\text{peak}} = 989\text{ TFLOPS}$ (FP16), $BW_{\text{mem}} = 3.35\text{ ТБ/с}$.

#### 2. PagedAttention и непрерывный батчинг
* Посекундная симуляция памяти KV-кэша с блоками по 16 токенов.
* Внешняя фрагментация снижается с 60% (статический буфер) до $<4\%$ (PagedAttention).
* При исчерпании доступной HBM памяти активируется механизм `Preemption` (вытеснение запросов с наименьшим приоритетом с сохранением блоков в хост-памяти RAM через PCIe 5.0).

#### 3. Штампоустойчивость кэша: Алгоритм XFetch
* Упреждающее асинхронное перевычисление ключа в фоне до наступления физического TTL:
  $$\text{Recompute} \iff t - \beta \cdot \delta \cdot \ln(\text{rand}()) > \text{expiry}$$
  где $\delta$ — задержка генерации ответа LLM, $\beta = 1.0$ — параметр агрессивности упреждения.

---

### 3.3. Модуль `planetaryCellularSolver.ts` (L6 / L7 Планетарные системы)

#### 1. Ячеистая изоляция и радиус поражения (Cell Blast-Radius)
* В случае катастрофического сбоя внутри одной ячейки (например, порча страниц данных или каскадный отказ пула) доля затронутых пользователей платформы строго ограничена:
  $$\text{BlastRadius} = \frac{1}{N_{\text{cells}}}$$
* При $N_{\text{cells}} = 100$ глобальная доступность платформы сохраняется на уровне $99.0\%$ даже при 100% уничтожении отдельной ячейки.

#### 2. Задержка All-Reduce на кластерах 10 000 GPU (Ring-AllReduce)
* Время синхронизации градиентов распределенного обучения через сетевую иерархию:
  $$T_{\text{AllReduce}} = 2 \cdot \left(\frac{N-1}{N}\right) \cdot \frac{M}{BW_{\text{effective}}} + 2 \cdot (N-1) \cdot \alpha$$
  где внутри узла используется NVLink ($900\text{ ГБ/с}$), а между стойками — InfiniBand / RoCE ($400\text{ Гбит/с}$).

---

### 3.4. Модуль `distributedQueueSolver.ts`: Замкнутые солверы очередей

* **$M/G/1$ (Pollaczek-Khinchine):**
  $$W_q = \frac{\rho}{\mu(1-\rho)} \cdot \left(\frac{1 + C_s^2}{2}\right),\quad C_s^2 = \frac{\sigma_s^2}{(\mathbb{E}[S])^2}$$
* **$G/G/c$ (Allen-Cunneen):**
  $$W_q \approx \frac{P_c}{c\mu(1-\rho)} \cdot \left(\frac{C_a^2 + C_s^2}{2}\right)$$
* **Аналитический расчет хвостовых задержек $P99$ и $P99.9$ (Аппроксимация Кимуры и Корниш-Фишер):**
  $$P_{99} \approx \mathbb{E}[T] + \sigma_T \cdot \left(z_{0.99} + \frac{\gamma_1}{6}(z_{0.99}^2 - 1)\right)$$
  где $z_{0.99} = 2.326$, $\gamma_1$ — асимметрия распределения (skewness).

---

## 4. Контракты сообщений Web Worker (`types/workerMessages.ts`)

```typescript
export interface SimulationRequestMessage {
  type: 'RUN_SIMULATION';
  requestId: string;
  scenario_id: string;
  target_level: 'L3_JUNIOR' | 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF' | 'L7_PRINCIPAL';
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
    pattern: 'POISSON' | 'BURSTY' | 'DIURNAL';
    lambda_mean_rps: number;
    inter_arrival_cv: number;
    read_ratio: number;
    prompt_tokens_mean?: number;
    generation_tokens_mean?: number;
  };
  roofline?: {
    peak_flops_tflops?: number;
    memory_bandwidth_tb_s?: number;
    weight_bits?: number;
    kv_bits?: number;
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
  // Специфично для LLM & GPU
  ttft_p99_ms?: number;
  tpot_p99_ms?: number;
  kv_cache_utilization_percent?: number;
  preempted_requests_count?: number;
  // Специфично для Cache
  cache_hit_rate_percent?: number;
  xfetch_early_refreshes_count?: number;
  // Специфично для Single-Box Runtime
  carrier_thread_pinned?: boolean;
  hikari_pool_exhausted?: boolean;
  nginx_disk_spool_active?: boolean;
  // Специфично для Planetary Systems
  cell_blast_radius_percent?: number;
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
    active_invariants_passed: string[];
    active_invariants_failed: string[];
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

## 5. Definition of Done (DoD) для Stage 2

1. [ ] **Worker Compilation:** Файл `frontend/src/workers/desSimulator.worker.ts` собирается бандлером Vite без ошибок TypeScript.
2. [ ] **Sub-Millisecond Benchmark:** Полный расчет графа из 15 узлов на 10 000 запросов занимает $<10\text{ мс}$ в Web Worker.
3. [ ] **Mathematical Test Suite:**
   * Проверка совпадения формул Поллачека-Хинчина и Аллена-Каннина с эталонными математическими расчетами ($R^2 > 0.999$).
   * Проверка Roofline модели: Prefill масштабируется линейно с $T_{\text{in}}$, Decode масштабируется обратно пропорционально $BW_{\text{mem}}$.
   * Проверка Little's Law и деградации пула HikariCP при превышении $2 \times \text{Cores}$.
   * Проверка сходимости XFetch с вероятностной моделью раннего вытеснения.
4. [ ] **Chaos Injection Verification:** Симуляция фиксирует разрыв сетевого линка, временный всплеск $P99$ и автоматическое восстановление после завершения фазы сбоя.
5. [ ] **Zero Main-Thread Blocking:** Профайлер подтверждает отсутствие Long Tasks ($>50\text{ мс}$) в UI-потоке браузера.
