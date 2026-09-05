/**
 * 5 Canonical Faded Scaffolding Archetypes (Level 2)
 * Preconfigured broken industrial production incidents with simulated failure telemetry,
 * initial broken canvas topologies, and acceptable solution validation criteria.
 */

import { Node, Edge } from '@xyflow/react';

export interface FadedArchetype {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  incidentSeverity: 'P0 - CRITICAL' | 'P1 - HIGH';
  affectedDomain: string;
  diagnosisMarkdown: string;
  initialBrokenTopology: {
    nodes: Node[];
    edges: Edge[];
  };
  simulatedFailureMetrics: Record<string, number | string>;
  targetRequirements: string[];
  deadlySinsToCheck: string[];
  validationRules: {
    requiredNodeTypes: string[];
    forbiddenPatterns: Array<{
      sourceType: string;
      targetType: string;
      isSync?: boolean;
      description: string;
    }>;
    minComponentsCount: number;
  };
}

export const FADED_ARCHETYPES: FadedArchetype[] = [
  // --- ARCHETYPE 1: Flash Sale Row Lock Saturation ---
  {
    id: 'L2_ARCHETYPE_FLASH_SALE_ROW_LOCK_SATURATION',
    number: 1,
    title: 'Насыщение блокировок строк монолитной БД во время Flash Sale',
    subtitle: 'SELECT ... FOR UPDATE на горячем товаре и блокировка HikariCP при 50 000 RPS',
    incidentSeverity: 'P0 - CRITICAL',
    affectedDomain: 'E-Commerce / Inventory Checkout',
    diagnosisMarkdown: `
### Диагностика производственного инцидента
В период распродажи 50 000 RPS направляются на выкуп ограниченной серии товара (\`item_id = 42\`).
Каждый поток Spring Boot открывает транзакцию \`@Transactional\` и накладывает пессимистический замок:
\`SELECT quantity FROM inventory WHERE item_id = 42 FOR UPDATE\`
Внутри транзакции выполняется синхронный вызов к банку со средней задержкой 200 мс.
- Удержание строчного замка приводит к исчерпанию пула **HikariCP (100 коннектов) за 400 мс**.
- Блокируются потоки **Tomcat (200 потоков)**, сервис перестает отвечать на \`readinessProbe\`.
- Kubernetes перезапускает под **42 раза в час** (каскадный отказ).
    `,
    simulatedFailureMetrics: {
      inboundRps: '50,000 RPS',
      p99LatencyMs: '4,980.5 мс',
      errorRate: '78.4%',
      hikariActiveConnections: '100 / 100 (100% Saturation)',
      awaitingHikariThreads: 1840,
      dbRowLockWaiters: 4900,
      podRestartsHourly: 42
    },
    targetRequirements: [
      'Изолировать учет остатков от реляционной СУБД: внедрить атомарное бронирование в Redis (DECRBY / Lua-скрипт)',
      'Устранить синхронный вызов банка внутри строчной блокировки БД',
      'Организовать асинхронную фиксацию заказов через Transactional Outbox + Kafka'
    ],
    deadlySinsToCheck: [
      'Dual Writes без Outbox (-40 баллов)',
      'Пессимистическая блокировка строки при > 1000 RPS (-35 баллов)'
    ],
    initialBrokenTopology: {
      nodes: [
        {
          id: 'traffic_ingress',
          type: 'client',
          position: { x: 50, y: 200 },
          data: { label: 'Flash Sale Buyers (50k RPS)', nodeType: 'client' }
        },
        {
          id: 'monolith_backend',
          type: 'service',
          position: { x: 380, y: 200 },
          data: {
            label: 'Monolith Service (Tomcat 200 thr, Hikari 100)',
            nodeType: 'service',
            instances: 1,
            config: { replicas: 1, threadPool: 200 }
          }
        },
        {
          id: 'relational_db',
          type: 'database',
          position: { x: 720, y: 200 },
          data: {
            label: 'PostgreSQL Primary (Locked row item_id=42)',
            nodeType: 'database',
            instances: 1,
            config: { replicas: 1 }
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'traffic_ingress',
          target: 'monolith_backend',
          data: { protocol: 'HTTP/2', isAsync: false }
        },
        {
          id: 'e2',
          source: 'monolith_backend',
          target: 'relational_db',
          data: { protocol: 'JDBC', isAsync: false }
        }
      ]
    },
    validationRules: {
      requiredNodeTypes: ['cache', 'queue'],
      forbiddenPatterns: [
        {
          sourceType: 'client',
          targetType: 'database',
          description: 'Клиент не должен обращаться к БД напрямую'
        }
      ],
      minComponentsCount: 4
    }
  },

  // --- ARCHETYPE 2: Celebrity Fan-Out Skew ---
  {
    id: 'L2_ARCHETYPE_CELEBRITY_FAN_OUT_SKEW',
    number: 2,
    title: 'Celebrity Fan-Out Skew (Перекос веерной рассылки селебрити)',
    subtitle: 'Лавина 40 000 000 сетевых записей в Redis при публикации популярного автора',
    incidentSeverity: 'P0 - CRITICAL',
    affectedDomain: 'Social Feeds & News Feed Fan-out',
    diagnosisMarkdown: `
### Диагностика производственного инцидента
Платформа использует наивную модель Push (Fan-out-on-Write). При создании поста фоновый воркер делает:
\`LPUSH timeline:{follower_id} {post_id}\` для каждого подписчика автора.
Когда пост публикует автор с **40 000 000 подписчиков**:
- 1 событие порождает **$4 \\times 10^7$ сетевых вставок в Redis**.
- Очереди RabbitMQ переполняются 39.8 млн задач, задерживая доставку сообщений обычных пользователей на **3.5 часа**.
- Инстансы Redis утилизируют **99.8% памяти**, воркеры падают по OOMKilled.
    `,
    simulatedFailureMetrics: {
      celebrityFollowers: '40,000,000',
      queueUnacknowledged: '39,850,000 сообщений',
      fanoutLagMinutes: '215.0 минут',
      redisMemorySaturation: '99.8%',
      regularUserPostDelaySec: '12,900 сек (3.5 часа)',
      oomKillEvents: 14
    },
    targetRequirements: [
      'Внедрить гибридную модель Push/Pull: авторы с > 25 000 подписчиков переводятся на Pull-модель',
      'Для селебрити использовать хранилище постов (Cassandra/ScyllaDB с кластеризацией по post_time DESC)',
      'При чтении ленты агрегатор объединяет Push-кэш и посты селебрити через K-Way Merge Iterator'
    ],
    deadlySinsToCheck: [
      'Fan-out-on-Write для аккаунтов с миллионами подписчиков (-40 баллов)',
      'Переполнение Redis без разделения очередей (-30 баллов)'
    ],
    initialBrokenTopology: {
      nodes: [
        {
          id: 'timeline_service',
          type: 'service',
          position: { x: 80, y: 200 },
          data: { label: 'Timeline Post Service (Fan-Out on Write)', nodeType: 'service' }
        },
        {
          id: 'fanout_queue',
          type: 'queue',
          position: { x: 420, y: 200 },
          data: { label: 'RabbitMQ (40M Messages Queued)', nodeType: 'queue' }
        },
        {
          id: 'timeline_redis',
          type: 'cache',
          position: { x: 760, y: 200 },
          data: { label: 'Redis Standalone (LPUSH saturation)', nodeType: 'cache', instances: 1 }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'timeline_service',
          target: 'fanout_queue',
          data: { protocol: 'AMQP', isAsync: true }
        },
        {
          id: 'e2',
          source: 'fanout_queue',
          target: 'timeline_redis',
          data: { protocol: 'RESP', isAsync: false }
        }
      ]
    },
    validationRules: {
      requiredNodeTypes: ['service', 'cache', 'database'],
      forbiddenPatterns: [],
      minComponentsCount: 4
    }
  },

  // --- ARCHETYPE 3: Unbounded Memory Buffer Pod OOMKilled ---
  {
    id: 'L2_ARCHETYPE_UNBOUNDED_BUFFER_OOM_KILLED',
    number: 3,
    title: 'Падение пода по OOMKilled из-за неограниченного буфера памяти',
    subtitle: 'LinkedBlockingQueue(Integer.MAX_VALUE) при Compaction Stall в ClickHouse',
    incidentSeverity: 'P0 - CRITICAL',
    affectedDomain: 'High-Throughput Telemetry & Analytics Ingest',
    diagnosisMarkdown: `
### Диагностика производственного инцидента
Микросервис агрегирует телеметрию с частотой **200 000 событий в секунду** во внутреннюю память:
\`new LinkedBlockingQueue<Event>()\` (емкость по умолчанию \`Integer.MAX_VALUE\`).
Пакетная вставка в ClickHouse замедляется с 20 мс до **4 200 мс** из-за фонового уплотнения (MergeTree Compaction):
- Очередь накапливает миллионы объектов, занимая 4 ГБ Heap.
- Full GC забирает **76.5% процессорного времени**, приложение замирает.
- Ядро Linux уничтожает процесс сигналом **SIGKILL (Exit code 137 OOMKilled)** с безвозвратной утратой 8.42 млн событий.
    `,
    simulatedFailureMetrics: {
      incomingEventsRate: '200,000 events/sec',
      jvmHeapSaturation: '99.4%',
      gcPausePercentage: '76.5%',
      uncommittedInFlight: '8,420,000 events',
      clickhouseInsertLatency: '4,200 мс (Compaction Stall)',
      oomKillsCount: 8,
      unbufferedDataLoss: '8,420,000 events'
    },
    targetRequirements: [
      'Заменить LinkedBlockingQueue на ограниченный буфер ArrayBlockingQueue с backpressure (HTTP 429)',
      'Добавить локальный аварийный сброс на диск (RocksDB / NVMe Spillover Engine) при заполнении очереди > 80%',
      'Включить в ClickHouse async_insert для снятия нагрузки с клиентских пакетов'
    ],
    deadlySinsToCheck: [
      'Неограниченные очереди памяти без Backpressure (-35 баллов)',
      'Синхронная запись в аналитическое хранилище (-40 баллов)'
    ],
    initialBrokenTopology: {
      nodes: [
        {
          id: 'telemetry_ingest',
          type: 'service',
          position: { x: 120, y: 200 },
          data: {
            label: 'Ingest Service (Unbounded LinkedBlockingQueue)',
            nodeType: 'service',
            instances: 1
          }
        },
        {
          id: 'clickhouse_cluster',
          type: 'analytical-storage',
          position: { x: 620, y: 200 },
          data: {
            label: 'ClickHouse OLAP (Compaction Stalled 4200ms)',
            nodeType: 'analytical-storage'
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'telemetry_ingest',
          target: 'clickhouse_cluster',
          data: { protocol: 'NATIVE_TCP', isAsync: false } // Synchronous unbuffered write!
        }
      ]
    },
    validationRules: {
      requiredNodeTypes: ['service'],
      forbiddenPatterns: [
        {
          sourceType: 'service',
          targetType: 'analytical-storage',
          isSync: true,
          description: 'Запрещена синхронная прямая запись в аналитическое хранилище'
        }
      ],
      minComponentsCount: 3
    }
  },

  // --- ARCHETYPE 4: Synchronous 2PC Distributed Lock Bottleneck ---
  {
    id: 'L2_ARCHETYPE_SYNCHRONOUS_2PC_BOTTLENECK',
    number: 4,
    title: 'Узкое место синхронного распределенного двухфазного коммита (2PC)',
    subtitle: 'Каскадный дедлок пулов потоков при глобальном таймауте 60 секунд',
    incidentSeverity: 'P0 - CRITICAL',
    affectedDomain: 'FinTech / Multi-Service Order Checkout',
    diagnosisMarkdown: `
### Диагностика производственного инцидента
Оформление заказа связывает 4 микросервиса: Order, Payment, Inventory, Logistics через 2PC (XA RPC):
- В фазе Prepare каждый сервис блокирует строки своих СУБД.
- При аппаратной задержке в Logistics координатор блокируется до истечения таймаута **60 секунд**.
- За 1 минуту все удерживаемые строчные замки во всех СУБД блокируют параллельные транзакции.
- Доступность системы падает до **11.2%**, пулы потоков Tomcat полностью истощены.
    `,
    simulatedFailureMetrics: {
      globalTxRate: '120 RPS (Degraded)',
      p99LatencyMs: '58,900.0 мс',
      heldDatabaseLocks: 18400,
      deadlockRate: '34.2 / sec',
      blockedWorkerThreads: 800,
      systemAvailability: '11.2%'
    },
    targetRequirements: [
      'Отказаться от синхронного 2PC XA в пользу асинхронной оркестрируемой Saga (Temporal / Camunda / Kafka)',
      'Выделить компенсируемые шаги (Order, Inventory) с отменой через Tombstone',
      'Зафиксировать шаг Pivot (Payment), после которого откат невозможен (только Forward Recovery)'
    ],
    deadlySinsToCheck: [
      'Синхронный 2PC поверх распределенных микросервисов (-45 баллов)',
      'Удержание транзакционных замков через сетевые границы (-40 баллов)'
    ],
    initialBrokenTopology: {
      nodes: [
        {
          id: 'tx_coordinator',
          type: 'gateway',
          position: { x: 80, y: 200 },
          data: { label: '2PC Synchronous Coordinator (60s timeout)', nodeType: 'gateway' }
        },
        {
          id: 'order_service',
          type: 'service',
          position: { x: 420, y: 60 },
          data: { label: 'Order Service (XA Locked)', nodeType: 'service' }
        },
        {
          id: 'payment_service',
          type: 'service',
          position: { x: 420, y: 150 },
          data: { label: 'Payment Service (XA Locked)', nodeType: 'service' }
        },
        {
          id: 'inventory_service',
          type: 'service',
          position: { x: 420, y: 250 },
          data: { label: 'Inventory Service (XA Locked)', nodeType: 'service' }
        },
        {
          id: 'logistics_service',
          type: 'service',
          position: { x: 420, y: 350 },
          data: { label: 'Logistics Service (Network Stall)', nodeType: 'service' }
        }
      ],
      edges: [
        { id: 'e1', source: 'tx_coordinator', target: 'order_service', data: { protocol: 'XA_RPC', isAsync: false } },
        { id: 'e2', source: 'tx_coordinator', target: 'payment_service', data: { protocol: 'XA_RPC', isAsync: false } },
        { id: 'e3', source: 'tx_coordinator', target: 'inventory_service', data: { protocol: 'XA_RPC', isAsync: false } },
        { id: 'e4', source: 'tx_coordinator', target: 'logistics_service', data: { protocol: 'XA_RPC', isAsync: false } }
      ]
    },
    validationRules: {
      requiredNodeTypes: ['queue'],
      forbiddenPatterns: [
        {
          sourceType: 'gateway',
          targetType: 'service',
          isSync: true,
          description: 'Устраните синхронную 2PC координацию. Замените на шину событий Saga (Kafka/Queue).'
        }
      ],
      minComponentsCount: 4
    }
  },

  // --- ARCHETYPE 5: Cross-Region PACELC Replication Conflict ---
  {
    id: 'L2_ARCHETYPE_CROSS_REGION_REPLICATION_CONFLICT',
    number: 5,
    title: 'Конфликт репликации в Cross-Region Active-Active топологии',
    subtitle: 'Дрейф физических часов NTP (120 мс) и потеря денежных остатков при LWW',
    incidentSeverity: 'P0 - CRITICAL',
    affectedDomain: 'Global Multi-DC Banking & Wallets',
    diagnosisMarkdown: `
### Диагностика производственного инцидента
Хранилище развернуто в двух регионах (us-east-1 и eu-central-1) в Active-Active конфигурации с асинхронной репликацией.
Разрешение конфликтов базируется на физическом времени (Last-Write-Wins по NTP):
- Фазовый дрейф часов между дата-центрами достигает **120 мс** при сетевом RTT **85 мс**.
- Транзакция из региона с опережающими часами стирает более позднюю операцию второго региона.
- Фиксируется **1420 тихих перезаписей в минуту** и прямая утрата денежного баланса клиентов.
    `,
    simulatedFailureMetrics: {
      ntpClockSkewMs: '120.0 мс',
      observedNetworkRtt: '85.0 мс',
      silentDataOverwrites: '1,420 / мин',
      lostUpdatesPercentage: '4.8%',
      causalOrderingViolations: '95,000 / час',
      customerEscalations: 312
    },
    targetRequirements: [
      'Разделить данные по теореме PACELC: для баланса и денег выбрать строгую согласованность (PC/EC) через Raft Global Lease / Spanner TrueTime',
      'Для счетчиков и просмотров использовать бесконфликтные реплицируемые типы данных (CRDT PN-Counter / OR-Set)',
      'Категорически исключить Last-Write-Wins по System.currentTimeMillis()'
    ],
    deadlySinsToCheck: [
      'Разрешение конфликтов Last-Write-Wins через NTP (-50 баллов)',
      'Использование System.currentTimeMillis() в финансовом контуре (-45 баллов)'
    ],
    initialBrokenTopology: {
      nodes: [
        {
          id: 'db_master_us',
          type: 'database',
          position: { x: 120, y: 200 },
          data: { label: 'DB Master US (us-east-1, LWW NTP)', nodeType: 'database', instances: 1 }
        },
        {
          id: 'db_master_eu',
          type: 'database',
          position: { x: 620, y: 200 },
          data: { label: 'DB Master EU (eu-central-1, LWW NTP)', nodeType: 'database', instances: 1 }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'db_master_us',
          target: 'db_master_eu',
          data: { protocol: 'ASYNC_REPLICATION', isAsync: true }
        },
        {
          id: 'e2',
          source: 'db_master_eu',
          target: 'db_master_us',
          data: { protocol: 'ASYNC_REPLICATION', isAsync: true }
        }
      ]
    },
    validationRules: {
      requiredNodeTypes: ['database'],
      forbiddenPatterns: [],
      minComponentsCount: 3
    }
  }
];
