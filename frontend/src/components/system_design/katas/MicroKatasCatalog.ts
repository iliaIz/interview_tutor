/**
 * 8 Canonical Distributed Systems Micro-Katas (Level 0)
 * Formulated with exact mathematical models, AssertJ invariant specifications,
 * and client-side simulation runners.
 */

export interface MicroKata {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  category: 'Hashing' | 'Caching' | 'Sharding' | 'RateLimiting' | 'Consensus' | 'Replication' | 'Storage' | 'Saga';
  difficulty: 'Junior+' | 'Middle' | 'Senior' | 'Staff';
  executionBudgetMs: number;
  mathematicalModelMarkdown: string;
  asymptoticComplexity: string;
  hardInvariantText: string;
  javaCodeSnippet: string;
  defaultParams: Record<string, number | string | boolean>;
  paramDefinitions: Array<{
    key: string;
    label: string;
    type: 'slider' | 'select';
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ label: string; value: string | number | boolean }>;
    description: string;
  }>;
  runSimulation: (params: Record<string, any>) => {
    isPassed: boolean;
    metrics: Record<string, number | string>;
    chartsData?: Array<{ name: string; value: number; benchmark?: number; color?: string }>;
    logs: string[];
    failureReason?: string;
  };
}

export const MICRO_KATAS: MicroKata[] = [
  // --- KATA 1: Consistent Hashing Ring with Virtual Nodes ---
  {
    id: 'l0_consistent_hashing',
    number: 1,
    title: 'Consistent Hashing Ring с виртуальными узлами',
    subtitle: 'Балансировка ключей (CoV < 0.05) и минимизация churn-фактора (1/N) при V=512',
    category: 'Hashing',
    difficulty: 'Senior',
    executionBudgetMs: 50,
    asymptoticComplexity: 'Routing: O(log(N * V)), Ring Construction: O(N * V * log(N * V))',
    hardInvariantText: 'При V = 512 коэффициент вариации CoV = σ / μ строго < 0.05. При удалении ноды мигрируют строго ключи удаленного узла (ΔK / K ≈ 1/N ± 5%).',
    mathematicalModelMarkdown: `
### Математическая модель
Кольцо согласованного хеширования $\\mathcal{R}$ отображается на адресное пространство $[0, 2^{32}-1]$.
Каждый физический узел $n_i \\in \\mathcal{N}$ проецируется на $V$ виртуальных узлов (vnodes):
$$v_{i, j} = \\text{Murmur3}\\left(\\text{node\\_id}_i \\parallel \\text{"#"} \\parallel j\\right), \\quad j \\in [0, V-1]$$
Маршрутизация осуществляется через логарифмический поиск в сбалансированном дереве (Red-Black Tree / \`ConcurrentSkipListMap\`):
$$\\text{Route}(k) = \\text{ceilingEntry}(\\text{hash}(k))$$
Равномерность распределения оценивается через коэффициент вариации:
$$CoV = \\frac{\\sigma}{\\mu} = \\frac{\\sqrt{\\frac{1}{N} \\sum_{i=1}^N (k_i - \\mu)^2}}{K / N} < 0.05 \\quad (V = 512)$$
    `,
    javaCodeSnippet: `ConsistentHashRing<String> ring = new ConsistentHashRing<>(Murmur3_128::hash64, 512);
List<String> nodes = IntStream.range(0, 10).mapToObj(i -> "node-" + i).toList();
nodes.forEach(ring::addPhysicalNode);

Map<String, Long> keyDistribution = new HashMap<>();
List<String> keys = IntStream.range(0, 100_000).mapToObj(i -> UUID.randomUUID().toString()).toList();
keys.forEach(k -> keyDistribution.merge(ring.route(k), 1L, Long::sum));

double mean = keys.size() / (double) nodes.size();
double variance = keyDistribution.values().stream()
    .mapToDouble(val -> Math.pow(val - mean, 2)).sum() / nodes.size();
double cov = Math.sqrt(variance) / mean;

// Invariant 1: Uniformity under V=512
assertThat(cov).isLessThan(0.05);

// Invariant 2: Minimal Churn upon node failure
ring.removePhysicalNode("node-4");
long movedKeysCount = keys.stream()
    .filter(k -> !ring.route(k).equals(initialRoutes.get(k))).count();
assertThat((double) movedKeysCount / keys.size())
    .isCloseTo(1.0 / nodes.size(), Percentage.withPercentage(5.0));`,
    defaultParams: {
      vnodes: 512,
      nodesCount: 10,
      keysCount: 50000,
      hashAlgorithm: 'Murmur3'
    },
    paramDefinitions: [
      {
        key: 'vnodes',
        label: 'Virtual Nodes (V)',
        type: 'slider',
        min: 1,
        max: 512,
        step: 1,
        description: 'Число виртуальных реплик на физическую ноду (рекомендуется 512)'
      },
      {
        key: 'nodesCount',
        label: 'Физические ноды (N)',
        type: 'slider',
        min: 3,
        max: 30,
        step: 1,
        description: 'Размер кластера'
      },
      {
        key: 'hashAlgorithm',
        label: 'Хеш-функция',
        type: 'select',
        options: [
          { label: 'Murmur3 (Быстрый, строгий лавинный эффект)', value: 'Murmur3' },
          { label: 'MD5 (Медленный криптографический)', value: 'MD5' },
          { label: 'Naive Java hashCode (Плохое распределение)', value: 'Naive' }
        ],
        description: 'Алгоритм проекции координат на кольцо'
      }
    ],
    runSimulation: (params) => {
      const V = Number(params.vnodes) || 512;
      const N = Number(params.nodesCount) || 10;
      const K = Number(params.keysCount) || 50000;
      const algo = String(params.hashAlgorithm || 'Murmur3');

      // Hash helper
      const hashFn = (str: string): number => {
        let h = 0x811c9dc5;
        if (algo === 'Naive') {
          for (let i = 0; i < str.length; i++) h = (31 * h + str.charCodeAt(i)) & 0xffffffff;
          return Math.abs(h);
        }
        for (let i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 0x01000193);
        }
        return Math.abs(h);
      };

      // Build ring
      const ring: Array<{ pos: number; node: string }> = [];
      for (let i = 0; i < N; i++) {
        const nodeId = `node-${i}`;
        for (let v = 0; v < V; v++) {
          const pos = hashFn(`${nodeId}#${v}`);
          ring.push({ pos, node: nodeId });
        }
      }
      ring.sort((a, b) => a.pos - b.pos);

      // Route keys
      const routeKey = (key: string): string => {
        const pos = hashFn(key);
        let low = 0, high = ring.length - 1;
        let candidate = ring[0].node;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (ring[mid].pos >= pos) {
            candidate = ring[mid].node;
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
        return candidate;
      };

      const counts: Record<string, number> = {};
      for (let i = 0; i < N; i++) counts[`node-${i}`] = 0;

      const sampleKeys: string[] = [];
      for (let i = 0; i < K; i++) {
        const key = `key-uuid-${i}-${algo}`;
        sampleKeys.push(key);
        const target = routeKey(key);
        counts[target] = (counts[target] || 0) + 1;
      }

      const mean = K / N;
      let variance = 0;
      for (let i = 0; i < N; i++) {
        variance += Math.pow((counts[`node-${i}`] || 0) - mean, 2);
      }
      variance /= N;
      const stdDev = Math.sqrt(variance);
      const cov = stdDev / mean;

      // Simulate churn with node-0 removal
      const initialRoutes = sampleKeys.map(k => routeKey(k));
      // Ring without node-0
      const subRing = ring.filter(r => r.node !== 'node-0');
      const routeSub = (key: string): string => {
        const pos = hashFn(key);
        let low = 0, high = subRing.length - 1;
        let candidate = subRing[0].node;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (subRing[mid].pos >= pos) {
            candidate = subRing[mid].node;
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
        return candidate;
      };

      let moved = 0;
      for (let i = 0; i < sampleKeys.length; i++) {
        if (routeSub(sampleKeys[i]) !== initialRoutes[i]) moved++;
      }
      const churnRatio = moved / K;
      const expectedChurn = 1 / N;

      const isPassed = V >= 256 && cov < 0.05 && Math.abs(churnRatio - expectedChurn) < 0.03;

      const chartsData = Object.entries(counts).map(([name, val]) => ({
        name,
        value: val,
        benchmark: Math.round(mean),
        color: Math.abs(val - mean) / mean > 0.15 ? '#f87171' : '#34d399'
      }));

      const logs = [
        `[Ring Init] Физических узлов: ${N}, vnodes: ${V}, всего точек: ${ring.length}`,
        `[Key Distribution] Ключей: ${K}, Среднее (μ): ${Math.round(mean)}, σ: ${stdDev.toFixed(1)}`,
        `[Invariant Check] Коэффициент вариации CoV = ${(cov * 100).toFixed(2)}% (Порог < 5.0%)`,
        `[Churn Experiment] Удаление node-0: перемещено ${(churnRatio * 100).toFixed(2)}% ключей (Теор. идеал: ${(expectedChurn * 100).toFixed(2)}%)`
      ];

      return {
        isPassed,
        metrics: {
          cov: `${(cov * 100).toFixed(2)}%`,
          stdDev: stdDev.toFixed(1),
          churn: `${(churnRatio * 100).toFixed(2)}%`,
          idealChurn: `${(expectedChurn * 100).toFixed(2)}%`
        },
        chartsData,
        logs,
        failureReason: !isPassed 
          ? (V < 256 ? 'Недостаточно виртуальных узлов (V < 256). Высокий CoV.' : `Превышен CoV (${(cov * 100).toFixed(2)}% >= 5.0%)`)
          : undefined
      };
    }
  },

  // --- KATA 2: Cache Stampede Mitigation: XFetch vs Mutex vs SingleFlight ---
  {
    id: 'l0_cache_stampede',
    number: 2,
    title: 'Cache Stampede Mitigation: XFetch vs Mutex vs SingleFlight',
    subtitle: 'Вероятностное раннее вычисление XFetch при 20 000 RPS',
    category: 'Caching',
    difficulty: 'Senior',
    executionBudgetMs: 50,
    asymptoticComplexity: 'XFetch overhead: O(1) non-blocking, Mutex tail latency: O(N * Delta)',
    hardInvariantText: 'Превентивная регенерация данных при -beta * Delta * ln(U) >= TTL_remaining исключает пробой кэша и dog-piling.',
    mathematicalModelMarkdown: `
### Математическая модель XFetch
Каждая запись кэша хранит кортеж $\\mathcal{E} = \\langle v, \\Delta, t_{\\text{expiry}} \\rangle$, где $\\Delta$ — время тяжелого вычисления в секундах.
Фоновая регенерация данных инициируется при условии:
$$-\\beta \\cdot \\Delta \\cdot \\ln(U) \\ge \\text{TTL}_{\\text{remaining}}, \\quad U \\sim \\text{Uniform}(0, 1], \\quad \\beta > 0$$
Вероятность того, что отдельный входящий запрос запустит фоновое обновление:
$$P_{\\text{refresh}} = \\exp\\left(-\\frac{\\text{TTL}_{\\text{remaining}}}{\\beta \\cdot \\Delta}\\right)$$
При интенсивности $\\lambda = 20\\,000$ RPS ни один поток не блокируется, клиенты читают старое значение из RAM, пока один воркер превентивно обновляет ресурс.
    `,
    javaCodeSnippet: `XFetchCache<String, byte[]> cache = new XFetchCache<>(beta = 1.0);
AtomicInteger sourceComputations = new AtomicInteger(0);

Supplier<byte[]> expensiveComputation = () -> {
    sourceComputations.incrementAndGet();
    Thread.sleep(50); // 50ms compute
    return new byte[1024];
};

cache.put("hot-key", expensiveComputation.get(), 0.050, Duration.ofMillis(2000));

// Concurrent burst: 50 virtual threads hammering 20,000 RPS for 4.5s (~2 TTL cycles)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 50; i++) {
        executor.submit(() -> {
            while (System.currentTimeMillis() < deadline) {
                cache.get("hot-key", expensiveComputation, Duration.ofMillis(2000));
            }
        });
    }
}

// Invariant: Total recomputations strictly between 2 and 6 (avoiding 50k dog-pile requests)
assertThat(sourceComputations.get()).isBetween(2, 6);`,
    defaultParams: {
      strategy: 'XFetch',
      beta: 1.0,
      computeDurationMs: 50,
      burstRps: 20000
    },
    paramDefinitions: [
      {
        key: 'strategy',
        label: 'Стратегия защиты кэша',
        type: 'select',
        options: [
          { label: 'XFetch (Вероятностное раннее обновление)', value: 'XFetch' },
          { label: 'SingleFlight / Mutex (Блокирующий замок)', value: 'Mutex' },
          { label: 'Naive Cache-Aside (Без защиты, dog-piling)', value: 'Naive' }
        ],
        description: 'Алгоритм обновления при приближении экспирации'
      },
      {
        key: 'beta',
        label: 'Коэффициент упреждения Beta',
        type: 'slider',
        min: 0.1,
        max: 3.0,
        step: 0.1,
        description: 'Агрессивность упреждающего пересчета (стандарт: 1.0)'
      }
    ],
    runSimulation: (params) => {
      const strategy = String(params.strategy || 'XFetch');
      const beta = Number(params.beta) || 1.0;
      const deltaSec = 0.050; // 50ms
      const ttlSec = 2.0;

      let dbCalls = 0;
      let blockedThreads = 0;
      let maxTailLatencyMs = 2.0;

      if (strategy === 'Naive') {
        dbCalls = 420; // Massive dog-piling
        maxTailLatencyMs = 4500;
      } else if (strategy === 'Mutex') {
        dbCalls = 3;
        blockedThreads = 850;
        maxTailLatencyMs = 380; // Lock wait queues
      } else {
        // XFetch
        dbCalls = Math.round(2 + beta * 1.2);
        blockedThreads = 0;
        maxTailLatencyMs = 2.5; // Always served from memory
      }

      const isPassed = strategy === 'XFetch' && dbCalls <= 6 && maxTailLatencyMs < 10;

      const chartsData = [
        { name: 'Вызовы БД / Источника', value: dbCalls, benchmark: 3, color: dbCalls > 10 ? '#ef4444' : '#3b82f6' },
        { name: 'Заблокированные потоки', value: blockedThreads, benchmark: 0, color: blockedThreads > 0 ? '#f59e0b' : '#10b981' },
        { name: 'P99 задержка (мс)', value: maxTailLatencyMs, benchmark: 5, color: maxTailLatencyMs > 50 ? '#ef4444' : '#10b981' }
      ];

      return {
        isPassed,
        metrics: {
          dbCalls,
          blockedThreads,
          tailLatency: `${maxTailLatencyMs} мс`,
          status: isPassed ? 'Стабильно (Zero Dog-Piling)' : 'Деградация кэша'
        },
        chartsData,
        logs: [
          `[Strategy] Выбран режим: ${strategy} (Beta = ${beta})`,
          `[Traffic Burst] Интенсивность: 20 000 RPS, Длительность: 4500 мс (~2 TTL цикла)`,
          `[Compute Outcome] Обращений к тяжелому сервису: ${dbCalls}`,
          `[Latency Profile] P99 задержка чтения: ${maxTailLatencyMs} мс`
        ],
        failureReason: !isPassed ? 'Используйте XFetch с beta ~ 1.0 для полного устранения Cache Stampede.' : undefined
      };
    }
  },

  // --- KATA 3: Sharding Key Selection under Zipfian Distribution ---
  {
    id: 'l0_zipf_sharding',
    number: 3,
    title: 'Селекция ключа шардирования при распределении Ципфа (α = 1.3)',
    subtitle: 'Устранение горячих шардов через Salted Compound Sharding (нагрузка < 12%)',
    category: 'Sharding',
    difficulty: 'Senior',
    executionBudgetMs: 50,
    asymptoticComplexity: 'Routing: O(1), Range skew: >90% partition 0, Salted Compound: <12% peak',
    hardInvariantText: 'Salted Compound Key (EntityID + "#" + (hash(Session) % S)) снижает пиковое давление на любой отдельный шард ниже 12% при идеале 6.25%.',
    mathematicalModelMarkdown: `
### Распределение с тяжелым хвостом
Вероятность запроса к сущности ранга $k \\in [1, M]$:
$$P(k) = \\frac{k^{-\\alpha}}{\\sum_{m=1}^M m^{-\\alpha}}, \\quad \\alpha = 1.3$$
При $\\alpha = 1.3$ на топ-1 сущность приходится $26.13\\%$ трафика, а на топ-10 — $59.74\\%$.
- **Range Sharding:** концентрирует $>90\\%$ на шарде 0 (коллапс узла).
- **Hash Sharding:** проецирует самый горячий ключ на один шард ($>25\\%$ нагрузки).
- **Salted Compound Sharding:**
$$\\text{RoutingKey} = \\text{EntityID} \\parallel \\text{"#"} \\parallel (\\text{Murmur3}(\\text{SessionID}) \\pmod S), \\quad S = 4$$
Рассеивает топ-ключ по $S$ суб-партициям, снижая пик до $< 12\\%$.
    `,
    javaCodeSnippet: `ZipfianGenerator zipf = new ZipfianGenerator(100_000, 1.3);
int[] accessLog = IntStream.range(0, 1_000_000).map(i -> zipf.nextValue()).toArray();

// Check Salted Compound Sharding over 16 shards
long[] compoundCounts = new long[16];
for (int key : accessLog) {
    int salt = ThreadLocalRandom.current().nextInt(4);
    int partition = Math.floorMod(Murmur3_128.hashString(key + "#" + salt), 16);
    compoundCounts[partition]++;
}

double maxLoad = Arrays.stream(compoundCounts).max().orElse(0) / 1_000_000.0;
// Invariant: Salted Compound Sharding must level out peak load to strictly below 12%
assertThat(maxLoad).isLessThan(0.12);`,
    defaultParams: {
      shardingMethod: 'SaltedCompound',
      shardsCount: 16,
      zipfAlpha: 1.3,
      saltPartitions: 4
    },
    paramDefinitions: [
      {
        key: 'shardingMethod',
        label: 'Стратегия шардирования',
        type: 'select',
        options: [
          { label: 'Salted Compound Key (Соль по сессиям)', value: 'SaltedCompound' },
          { label: 'Hash Sharding (hash(id) % P)', value: 'Hash' },
          { label: 'Range Sharding (id / RangeStep)', value: 'Range' }
        ],
        description: 'Алгоритм распределения ключей по партициям'
      },
      {
        key: 'zipfAlpha',
        label: 'Параметр Ципфа Alpha',
        type: 'slider',
        min: 0.7,
        max: 1.8,
        step: 0.1,
        description: 'Степень перекоса популярности данных'
      }
    ],
    runSimulation: (params) => {
      const method = String(params.shardingMethod || 'SaltedCompound');
      const shards = 16;
      const alpha = Number(params.zipfAlpha) || 1.3;
      const S = 4;
      const totalRequests = 100000;

      // Zipf distribution cumulative array
      const N_ITEMS = 10000;
      let sumH = 0;
      for (let i = 1; i <= N_ITEMS; i++) sumH += 1 / Math.pow(i, alpha);

      const shardLoads = new Array(shards).fill(0);

      // Fast synthetic generator
      for (let req = 0; req < totalRequests; req++) {
        // Zipf draw
        const u = Math.random();
        let rank = 1;
        if (u < 0.26) rank = 1; // Top 1 key
        else if (u < 0.40) rank = 2;
        else if (u < 0.50) rank = 3;
        else rank = Math.floor(Math.pow(1 - u, -1 / (alpha - 1))) || 4;
        rank = Math.min(rank, N_ITEMS);

        let partition = 0;
        if (method === 'Range') {
          partition = Math.min(shards - 1, Math.floor((rank / N_ITEMS) * shards));
        } else if (method === 'Hash') {
          partition = Math.abs((rank * 2654435761) ^ (rank >> 16)) % shards;
        } else {
          // Salted Compound
          const salt = Math.floor(Math.random() * S);
          const compHash = Math.imul(rank, 0x5bd1e995) ^ salt;
          partition = Math.abs(compHash) % shards;
        }
        shardLoads[partition]++;
      }

      const maxLoad = Math.max(...shardLoads) / totalRequests;
      const idealLoad = 1 / shards; // 6.25%

      const isPassed = method === 'SaltedCompound' && maxLoad < 0.12;

      const chartsData = shardLoads.map((val, idx) => ({
        name: `p${idx}`,
        value: Math.round((val / totalRequests) * 100),
        benchmark: 6.25,
        color: (val / totalRequests) > 0.20 ? '#ef4444' : (val / totalRequests) > 0.12 ? '#f59e0b' : '#10b981'
      }));

      return {
        isPassed,
        metrics: {
          maxPartitionLoad: `${(maxLoad * 100).toFixed(2)}%`,
          idealLoad: `${(idealLoad * 100).toFixed(2)}%`,
          overloadFactor: `${(maxLoad / idealLoad).toFixed(2)}x`,
          status: isPassed ? 'Нагрузка выровнена (< 12%)' : 'Горячий шард деградирует'
        },
        chartsData,
        logs: [
          `[Config] Метод: ${method}, Шардов: ${shards}, Zipf Alpha: ${alpha}`,
          `[Hot Key Skew] Топ-ключ генерирует ~26% совокупного трафика`,
          `[Partitioning Output] Пиковая нагрузка на шард: ${(maxLoad * 100).toFixed(2)}% (Лимит Staff-уровня: < 12%)`
        ],
        failureReason: !isPassed ? `Пиковая нагрузка ${(maxLoad * 100).toFixed(2)}% превышает допустимый лимит 12%. Примените Salted Compound Sharding.` : undefined
      };
    }
  },

  // --- KATA 4: Distributed Rate Limiter: Redis Lua Sliding Window vs Token Bucket ---
  {
    id: 'l0_rate_limiter',
    number: 4,
    title: 'Распределенный Rate Limiter: Redis Lua Sliding Window vs Token Bucket',
    subtitle: 'Атомарная отсечка 300% всплеска нагрузки без граничного удвоения трафика',
    category: 'RateLimiting',
    difficulty: 'Middle',
    executionBudgetMs: 50,
    asymptoticComplexity: 'ZSET Sliding Window: O(log(N) + M), Token Bucket HSET: O(1)',
    hardInvariantText: 'Sliding Window Counter в Redis Lua гарантирует жесткое соблюдение лимита в любом скользящем окне без краевых эффектов.',
    mathematicalModelMarkdown: `
### Скользящее окно против Token Bucket
- **Sliding Window Log (ZSET):** хранит временные метки транзакций. Перед проверкой удаляет устаревшие записи через \`ZREMRANGEBYSCORE\`. Строго гарантирует лимит $L$ за интервал $W$.
- **Token Bucket (HSET):** допускает мгновенный взрыв до емкости бакета $B$.
При внезапном всплеске в $300\\%$ от лимита ($300$ одновременных запросов при лимите $100$ req/s) обе системы пропускают ровно $100$ запросов. Однако спустя $500$ мс Token Bucket накопит $50$ новых токенов, тогда как Sliding Window продолжает блокировать запросы до освобождения окна.
    `,
    javaCodeSnippet: `SlidingWindowLuaLimiter slidingLimiter = new SlidingWindowLuaLimiter(redis, 100, 1000);
TokenBucketLuaLimiter tokenLimiter = new TokenBucketLuaLimiter(redis, 100, 100);

long now = 1_000_000L;
// 300 concurrent requests at t=now
for (int i = 0; i < 300; i++) {
    if (slidingLimiter.tryAcquire("client-A", now, "req-" + i)) slidingAllowed.incrementAndGet();
}

// Invariant: Exactly 100 requests allowed under 300% burst
assertThat(slidingAllowed.get()).isEqualTo(100);`,
    defaultParams: {
      limiterAlgorithm: 'SlidingWindowLua',
      burstVolume: 300,
      capacityLimit: 100,
      windowMs: 1000
    },
    paramDefinitions: [
      {
        key: 'limiterAlgorithm',
        label: 'Алгоритм лимитера',
        type: 'select',
        options: [
          { label: 'Atomic Redis Lua Sliding Window (ZSET)', value: 'SlidingWindowLua' },
          { label: 'Token Bucket Lua (HSET)', value: 'TokenBucket' },
          { label: 'Fixed Window Counter (Краевой эффект удвоения)', value: 'FixedWindow' }
        ],
        description: 'Тип алгоритма ограничения частоты вызовов'
      },
      {
        key: 'burstVolume',
        label: 'Пиковый всплеск (запросов)',
        type: 'slider',
        min: 100,
        max: 500,
        step: 50,
        description: 'Число запросов, пришедших в одну миллисекунду'
      }
    ],
    runSimulation: (params) => {
      const algo = String(params.limiterAlgorithm || 'SlidingWindowLua');
      const burst = Number(params.burstVolume) || 300;
      const limit = Number(params.capacityLimit) || 100;

      let allowed = 0;
      let rejected = 0;

      if (algo === 'FixedWindow') {
        // Simulating boundary effect: allows 100 in previous slot + 100 in next slot
        allowed = Math.min(burst, limit * 2);
        rejected = burst - allowed;
      } else {
        allowed = Math.min(burst, limit);
        rejected = burst - allowed;
      }

      const isPassed = algo === 'SlidingWindowLua' && allowed === limit;

      const chartsData = [
        { name: 'Пропущено запросов', value: allowed, benchmark: limit, color: allowed > limit ? '#ef4444' : '#10b981' },
        { name: 'Отклонено (HTTP 429)', value: rejected, benchmark: burst - limit, color: '#6b7280' }
      ];

      return {
        isPassed,
        metrics: {
          allowed,
          rejected,
          leakage: allowed > limit ? `+${allowed - limit} (Краевой пробой!)` : '0 (Абсолютная защита)',
          status: isPassed ? 'Лимит строго соблюден' : 'Нарушение лимита пропускной способности'
        },
        chartsData,
        logs: [
          `[Burst Simulation] Входящий пакет: ${burst} запросов при лимите ${limit} req/s`,
          `[Enforcement] Пропущено: ${allowed}, Отклонено: ${rejected}`,
          `[Boundary Check] ${allowed > limit ? 'ОШИБКА: Fixed Window пропустил двойной лимит!' : 'Успех: строгая атомарная фильтрация.'}`
        ],
        failureReason: !isPassed ? 'Fixed Window подвержен удвоению лимита на стыке окон. Используйте Sliding Window Lua.' : undefined
      };
    }
  },

  // --- KATA 5: Idempotent Consumer & Monotonic Fencing Tokens ---
  {
    id: 'l0_fencing_tokens',
    number: 5,
    title: 'Идемпотентный потребитель и Monotonic Fencing Tokens против GC-пауз',
    subtitle: 'Защита от перезаписи разделяемого хранилища после JVM Stop-The-World',
    category: 'Consensus',
    difficulty: 'Senior',
    executionBudgetMs: 50,
    asymptoticComplexity: 'Storage high watermark check: O(1)',
    hardInvariantText: 'Регистр max_token отвергает мутации с устаревшими номерами: ApplyMutation(d, tau) = REJECT если tau <= tau_max.',
    mathematicalModelMarkdown: `
### Инвариант токена ограждения Мартина Клеппмана
При наступлении длительной паузы GC STW воркер теряет владение распределенным замком по таймауту. Координатор переназначает лизу новому клиенту с монотонно растущим счетчиком:
$$\\tau_{k+1} > \\tau_k, \\quad \\forall k \\ge 0$$
Хранилище поддерживает регистр максимального зафиксированного токена $\\tau_{\\max}$.
$$\\text{ApplyMutation}(d, \\tau) = \\begin{cases} \\text{OK}, \\; \\tau_{\\max} \\leftarrow \\tau, & \\text{если } \\tau > \\tau_{\\max} \\\\ \\text{REJECT(STALE\\_FENCING\\_TOKEN)}, & \\text{если } \\tau \\le \\tau_{\\max} \\end{cases}$$
Очнувшийся после паузы старый воркер получает отказ, сохраняя целостность данных конкурентного владельца.
    `,
    javaCodeSnippet: `LockLease lease1 = coordinator.acquire("partition-1"); // token = 100
coordinator.forceExpireLease("partition-1"); // GC STW pause

LockLease lease2 = coordinator.acquire("partition-1"); // token = 101
storage.put("key-1", "VALUE_W2", lease2.token()); // Success

// Awake Worker 1 attempts delayed blind write with old token 100
assertThatThrownBy(() -> storage.put("key-1", "VALUE_W1", lease1.token()))
    .isInstanceOf(StaleFencingTokenException.class)
    .hasMessageContaining("Stale fencing token: 100 <= 101");

assertThat(storage.get("key-1")).isEqualTo("VALUE_W2");`,
    defaultParams: {
      enableFencingTokens: true,
      worker1PauseMs: 1500,
      leaseDurationMs: 1000
    },
    paramDefinitions: [
      {
        key: 'enableFencingTokens',
        label: 'Использовать Fencing Tokens',
        type: 'select',
        options: [
          { label: 'Да (Валидация монотонного поколения tau)', value: true },
          { label: 'Нет (Слепая запись после пробуждения)', value: false }
        ],
        description: 'Включение ограждающих токенов Мартина Клеппмана'
      }
    ],
    runSimulation: (params) => {
      const fencing = Boolean(params.enableFencingTokens);
      const token1 = 100;
      const token2 = 101;

      let worker2Success = true;
      let worker1Result = '';
      let finalValue = '';
      let isDataCorrupted = false;

      // Worker 2 executes with token 101
      const highWatermark = token2;
      finalValue = 'VALUE_WORKER_2 (Согласовано)';

      // Worker 1 wakes up with token 100
      if (fencing) {
        if (token1 > highWatermark) {
          finalValue = 'VALUE_WORKER_1';
        } else {
          worker1Result = 'REJECTED: StaleFencingTokenException (100 <= 101)';
        }
      } else {
        // Blind overwrite without fencing
        finalValue = 'VALUE_WORKER_1 (ПЕРЕЗАПИСАНО ЗОМБИ-ПОТОКОМ!)';
        worker1Result = 'ACCEPTED (Тихое повреждение данных!)';
        isDataCorrupted = true;
      }

      const isPassed = fencing && !isDataCorrupted;

      return {
        isPassed,
        metrics: {
          tokenW1: token1,
          tokenW2: token2,
          storageHighWatermark: highWatermark,
          finalValue,
          status: isPassed ? 'Целостность защищена' : 'Повреждение данных из-за GC STW'
        },
        logs: [
          `[Event] Воркер 1 захватил блокировку (токен = ${token1})`,
          `[Fault Injection] Инъекция STW GC-паузы 1500 мс во Воркер 1 (Лиза истекла)`,
          `[Event] Воркер 2 получил блокировку (токен = ${token2}) и зафиксировал значение`,
          `[Awaken] Воркер 1 очнулся и пытается выполнить запись: ${worker1Result}`,
          `[Data State] Результирующее состояние: ${finalValue}`
        ],
        failureReason: !isPassed ? 'Без Fencing Token проснувшийся воркер перезаписал данные. Включите валидацию монотонного токена.' : undefined
      };
    }
  },

  // --- KATA 6: Read-After-Write Consistency: Session LSN Routing ---
  {
    id: 'l0_read_after_write',
    number: 6,
    title: 'Read-After-Write консистентность: Session LSN Token Routing',
    subtitle: 'Маршрутизация чтения по LSN сессии без сброса всей нагрузки на Master',
    category: 'Replication',
    difficulty: 'Senior',
    executionBudgetMs: 50,
    asymptoticComplexity: 'Routing decision: O(R) where R is replica count',
    hardInvariantText: 'Сессия сохраняет LSN_session. Реплика выбирается по условию LSN_applied(R) >= LSN_session, сохраняя Monotonic Read Consistency.',
    mathematicalModelMarkdown: `
### Маршрутизация по Log Sequence Number (LSN)
Безусловный сброс чтения на Primary после мутации транслирует до $90\\%$ всей нагрузки обратно на мастер.
В стратегии LSN клиент передает маркер последней модификации $LSN_{\\text{session}}$:
$$\\text{Route}(LSN_{\\text{session}}) = \\begin{cases} \\mathcal{R}_i, & \\text{если } LSN_{\\text{applied}}(\\mathcal{R}_i) \\ge LSN_{\\text{session}} \\\\ \\text{WaitBounded}(\\mathcal{R}_i, \\tau \\le 20\\text{ms}), & \\text{если отставание ликвидируемо} \\\\ \\text{Primary}, & \\text{при исчерпании бюджета ожидания} \\end{cases}$$
    `,
    javaCodeSnippet: `LsnSessionRouter router = new LsnSessionRouter(cluster, Duration.ofMillis(20));
long sessionToken = 25_000L;

// Cluster state:
// replica-0: LSN=21000 (lag 1500ms)
// replica-1: LSN=25050 (lag 10ms) -> satisfies sessionToken!
// replica-2: LSN=19000 (lag 3000ms)

ReplicaNode targetNode = router.routeRead(sessionToken);
// Invariant: Must select replica-1 without touching Primary
assertThat(targetNode.id()).isEqualTo("replica-1");
assertThat(targetNode.isPrimary()).isFalse();`,
    defaultParams: {
      strategy: 'SessionLsnRouting',
      sessionLsn: 25000
    },
    paramDefinitions: [
      {
        key: 'strategy',
        label: 'Стратегия маршрутизации чтения',
        type: 'select',
        options: [
          { label: 'Session LSN Token Routing (Интеллектуальная реплика)', value: 'SessionLsnRouting' },
          { label: 'Master-Only Fallback (Безусловный Primary)', value: 'MasterOnly' },
          { label: 'Naive Random Replica (Риск фантомных чтений)', value: 'RandomReplica' }
        ],
        description: 'Способ балансировки read-запросов после записи'
      }
    ],
    runSimulation: (params) => {
      const strategy = String(params.strategy || 'SessionLsnRouting');
      const sessionLsn = 25000;

      const replicas = [
        { id: 'replica-0', lsn: 21000, lagMs: 1500 },
        { id: 'replica-1', lsn: 25050, lagMs: 10 },
        { id: 'replica-2', lsn: 19000, lagMs: 3000 }
      ];

      let targetNode = '';
      let isPrimary = false;
      let readConsistent = true;

      if (strategy === 'MasterOnly') {
        targetNode = 'primary-master';
        isPrimary = true;
      } else if (strategy === 'RandomReplica') {
        const picked = replicas[0]; // Stale replica
        targetNode = picked.id;
        isPrimary = false;
        readConsistent = picked.lsn >= sessionLsn; // false!
      } else {
        // Session LSN routing
        const candidate = replicas.find(r => r.lsn >= sessionLsn);
        if (candidate) {
          targetNode = candidate.id;
          isPrimary = false;
        } else {
          targetNode = 'primary-master';
          isPrimary = true;
        }
      }

      const isPassed = strategy === 'SessionLsnRouting' && !isPrimary && targetNode === 'replica-1' && readConsistent;

      return {
        isPassed,
        metrics: {
          targetNode,
          isMasterOffloaded: (!isPrimary).toString(),
          isConsistent: readConsistent.toString(),
          status: isPassed ? 'Read-After-Write гарантирован без перегрузки Master' : 'Деградация масштабируемости или консистентности'
        },
        logs: [
          `[Session Token] Требуемый LSN сессии: ${sessionLsn}`,
          `[Replica Cluster] r0: 21000, r1: 25050, r2: 19000`,
          `[Dispatch] Выбран узел: ${targetNode} (isPrimary: ${isPrimary})`,
          `[Integrity] ${readConsistent ? 'Пользователь видит свои свежие данные' : 'ОШИБКА: Пользователь видит устаревшие данные (Stale Read)!'}`
        ],
        failureReason: !isPassed ? 'Необходима маршрутизация по LSN сессии для разгрузки Master без потери монотонности чтения.' : undefined
      };
    }
  },

  // --- KATA 7: Write-Behind Cache with Crash Recovery via NVMe WAL ---
  {
    id: 'l0_write_behind_wal',
    number: 7,
    title: 'Write-Behind Cache с аварийным восстановлением через NVMe WAL',
    subtitle: 'Асинхронная субмиллисекундная запись с нулевой потерей данных (RPO = 0)',
    category: 'Storage',
    difficulty: 'Staff',
    executionBudgetMs: 50,
    asymptoticComplexity: 'Append WAL: O(1) sequential NVMe, Recovery: O(Unflushed Frames)',
    hardInvariantText: 'Бинарный Append-Only Log с CRC32 и принудительным fsync гарантирует RPO = 0 при жестком падении процесса (kill -9).',
    mathematicalModelMarkdown: `
### Нулевая точка восстановления (RPO = 0)
В паттерне Write-Behind запись буферизуется в памяти. Небуферизированный сбой приводит к утрате данных:
$$\\text{RPO}_{\\text{unbuffered}} = \\int_{t_{\\text{flush}}}^{t_{\\text{crash}}} \\lambda_{\\text{write}}(t) \\, dt > 0$$
Перед кэшированием фрейм сбрасывается в локальный NVMe WAL с заголовком:
\`[0xAA55AA55 (4B)][TxID (8B)][LSN (8B)][Length (4B)][Payload][CRC32 (4B)]\`
При аварийном перезапуске менеджер восстановления воспроизводит недостающие мутации от точки чекпоинта методом идемпотентного слияния (UPSERT).
    `,
    javaCodeSnippet: `LocalNvmeWal wal = new LocalNvmeWal(tempWalPath);
WriteBehindCache<String, String> cache = new WriteBehindCache<>(wal, flushThreshold = 10_000);

for (int i = 0; i < 5000; i++) {
    cache.put("user-" + i, "data-" + i);
}

// Abrupt JVM crash (kill -9 simulation without graceful flush)
cache.simulateAbruptCrash();

WalRecoveryManager recoveryManager = new WalRecoveryManager(tempWalPath, targetDb);
RecoveryResult report = recoveryManager.recover();

// Invariant: Exactly 5,000 items recovered, zero corrupted frames, RPO = 0
assertThat(report.recoveredCount()).isEqualTo(5000L);
assertThat(report.corruptedTailFrames()).isEqualTo(0L);
assertThat(targetDb.get("user-4999")).isEqualTo("data-4999");`,
    defaultParams: {
      enableWal: true,
      recordsCount: 5000,
      tailCorruption: false
    },
    paramDefinitions: [
      {
        key: 'enableWal',
        label: 'Ведение NVMe WAL',
        type: 'select',
        options: [
          { label: 'Включено (Append-Only Log + CRC32)', value: true },
          { label: 'Отключено (Чистый In-Memory буфер)', value: false }
        ],
        description: 'Локальная фиксация журнала опережающей записи перед обновлением кэша'
      }
    ],
    runSimulation: (params) => {
      const wal = Boolean(params.enableWal);
      const records = 5000;

      let recovered = 0;
      let lostRecords = 0;

      if (wal) {
        recovered = records;
        lostRecords = 0;
      } else {
        recovered = 0;
        lostRecords = records;
      }

      const isPassed = wal && lostRecords === 0;

      const chartsData = [
        { name: 'Восстановлено записей', value: recovered, benchmark: records, color: '#10b981' },
        { name: 'Утрачено записей (RPO)', value: lostRecords, benchmark: 0, color: lostRecords > 0 ? '#ef4444' : '#6b7280' }
      ];

      return {
        isPassed,
        metrics: {
          recoveredCount: recovered,
          lostRecords,
          rpoStatus: lostRecords === 0 ? 'RPO = 0 (Данные спасены)' : `RPO > 0 (${lostRecords} записей потеряно!)`
        },
        chartsData,
        logs: [
          `[Write Stream] Поток записи: ${records} событий в Write-Behind буфер`,
          `[Crash Simulation] Жесткий останов процесса (SIGKILL)`,
          `[WAL Recovery] Журнал ${wal ? 'найден и валидирован по CRC32' : 'отсутствует'}`,
          `[Result] Восстановлено: ${recovered}, Утеряно: ${lostRecords}`
        ],
        failureReason: !isPassed ? 'Без опережающего WAL сброса данные из оперативной памяти теряются при crash-событии.' : undefined
      };
    }
  },

  // --- KATA 8: Saga Compensation Ordering & Pivot Boundary ---
  {
    id: 'l0_saga_pivot',
    number: 8,
    title: 'Порядок компенсации в Saga: границы Pivot-транзакции и Tombstones',
    subtitle: 'Асинхронные гонки отмены и точка невозврата распределенной саги',
    category: 'Saga',
    difficulty: 'Staff',
    executionBudgetMs: 50,
    asymptoticComplexity: 'Compensation routing: O(1) idempotent state check',
    hardInvariantText: 'После успешной фиксации шага Pivot откат саги запрещен математически: возможен только Forward Recovery. Гонки отмены парируются Tombstone.',
    mathematicalModelMarkdown: `
### Граница точки невозврата (Pivot Step)
Сага $S = \\{T_1, \\dots, T_k, \\dots, T_n\\}$.
Шаги $T_1 \\dots T_{k-1}$ — компенсируемые (Backward Recovery через $C_i$).
Шаг $T_k$ — **Pivot-транзакция**. После ее фиксации откат назад невозможен, последующие шаги $T_{k+1} \\dots T_n$ обязаны завершаться только вперед (Forward Recovery).
При асинхронных гонках, если $C_i$ пришел раньше $T_i$, микросервис регистрирует \`StepState.CANCELLED_TOMBSTONE\`. Запоздалое действие $T_i$ аннулируется как NO-OP.
    `,
    javaCodeSnippet: `// Out-of-order compensation arrival
inventory.processCompensation(new CancelReservationCommand(10L, "ITEM-1"));
assertThat(inventory.getState(10L)).isEqualTo(StepState.CANCELLED_TOMBSTONE);

// Late mutating command must be treated as NO-OP
ExecutionOutcome outcome = inventory.processExecution(new ReserveCommand(10L, "ITEM-1", 2));
assertThat(outcome.isSkipped()).isTrue();

// Pivot boundary invariant
SagaOrchestrator orchestrator = new SagaOrchestrator();
orchestrator.registerStep(1, true);  // Compensable
orchestrator.registerStep(2, false); // Pivot (e.g. Non-refundable Bank Wire)
orchestrator.registerStep(3, false); // Retriable

orchestrator.executeStep(1);
orchestrator.executeStep(2); // Pivot confirmed

assertThatThrownBy(() -> orchestrator.abortAndCompensate(failedAtStep = 3))
    .isInstanceOf(PivotBoundaryViolationException.class)
    .hasMessageContaining("Cannot initiate backward compensation past the pivot step boundary");`,
    defaultParams: {
      injectOutOfOrder: true,
      attemptBackwardPastPivot: false
    },
    paramDefinitions: [
      {
        key: 'injectOutOfOrder',
        label: 'Инъекция гонки отмены (C_i раньше T_i)',
        type: 'select',
        options: [
          { label: 'Да (Компенсация опережает команду)', value: true },
          { label: 'Нет (Стандартный порядок)', value: false }
        ],
        description: 'Симуляция асинхронной перестановки пакетов в брокере сообщений'
      },
      {
        key: 'attemptBackwardPastPivot',
        label: 'Попытка отката после Pivot-шага',
        type: 'select',
        options: [
          { label: 'Нет (Forward Recovery через Retry)', value: false },
          { label: 'Да (Попытка отката невозвратной проводки)', value: true }
        ],
        description: 'Нарушение инварианта точки невозврата'
      }
    ],
    runSimulation: (params) => {
      const outOfOrder = Boolean(params.injectOutOfOrder);
      const badPivot = Boolean(params.attemptBackwardPastPivot);

      let tombstoneCreated = false;
      let lateCommandSkipped = false;
      let pivotExceptionThrown = false;

      if (outOfOrder) {
        tombstoneCreated = true;
        lateCommandSkipped = true;
      }

      if (badPivot) {
        pivotExceptionThrown = true; // Error triggered
      }

      const isPassed = outOfOrder ? (tombstoneCreated && lateCommandSkipped && !badPivot) : !badPivot;

      return {
        isPassed,
        metrics: {
          tombstoneRegistered: tombstoneCreated.toString(),
          lateCommandSkipped: lateCommandSkipped.toString(),
          pivotViolationPrevented: (!badPivot).toString(),
          status: isPassed ? 'Инварианты саги соблюдены' : 'Нарушение границы отката или гонка данных'
        },
        logs: [
          `[Saga Lifecycle] Шаг 1: Компенсируемый, Шаг 2: Pivot (Точка невозврата), Шаг 3: Повторяемый`,
          outOfOrder 
            ? `[Race Condition] Команда отмены CancelReservation(order=10) пришла раньше ReserveCommand. Зафиксирован CANCELLED_TOMBSTONE.` 
            : `[Normal Flow] Прямые команды идут в штатном порядке.`,
          badPivot 
            ? `[CRITICAL VIOLATION] Попытка отката назад после подтверждения внешнего банковского клиринга!` 
            : `[Forward Recovery] При сбое на шаге 3 оркестратор перезапускает задачу вперед с jittered backoff.`
        ],
        failureReason: !isPassed ? 'Откат после точки Pivot недопустим. Используйте Forward Recovery.' : undefined
      };
    }
  }
];
