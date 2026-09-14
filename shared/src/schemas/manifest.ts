import { Type, Static } from '@sinclair/typebox';

// 1. Семантические типы архитектурных узлов
export const SemanticNodeType = Type.Union([
  // Ingress & Routing
  Type.Literal('dns'),
  Type.Literal('load_balancer'),
  Type.Literal('api_gateway'),
  Type.Literal('cdn'),
  Type.Literal('cell_router'),
  // Compute Runtimes
  Type.Literal('app_service'),
  Type.Literal('microservice'),
  Type.Literal('worker_pool'),
  Type.Literal('gpu_inference_node'),
  Type.Literal('orchestrator_agent'),
  // Caching & In-Memory
  Type.Literal('redis_cache'),
  Type.Literal('memcached'),
  Type.Literal('semantic_cache'),
  // Data Storage
  Type.Literal('rdbms_primary'),
  Type.Literal('rdbms_replica'),
  Type.Literal('nosql_document'),
  Type.Literal('lsm_key_value'),
  Type.Literal('vector_database'),
  Type.Literal('object_storage_s3'),
  // Messaging & Streaming
  Type.Literal('kafka_topic'),
  Type.Literal('message_queue'),
  Type.Literal('ebpf_stream_ingest')
]);

// 2. Транспортный узел (декуплен от пиксельных координат React Flow)
export const TransportNodeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  type: SemanticNodeType,
  title: Type.String(),
  grid_position: Type.Object({
    col: Type.Integer({ minimum: 0 }),
    row: Type.Integer({ minimum: 0 })
  }),
  params: Type.Record(Type.String(), Type.Any()),
  is_locked: Type.Optional(Type.Boolean({ default: false }))
});

// 3. Транспортное ребро
export const TransportEdgeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  source: Type.String(),
  target: Type.String(),
  protocol: Type.Union([
    Type.Literal('http_rest'),
    Type.Literal('grpc'),
    Type.Literal('tcp_socket'),
    Type.Literal('async_event'),
    Type.Literal('db_protocol'),
    Type.Literal('nvlink_roce')
  ]),
  is_async: Type.Optional(Type.Boolean({ default: false })),
  config: Type.Optional(Type.Record(Type.String(), Type.Any())),
  is_locked: Type.Optional(Type.Boolean({ default: false }))
});

// 4. Правила валидации инвариантов (CEL & Graph Traversal)
export const InvariantRuleSchema = Type.Object({
  id: Type.String(),
  description: Type.String(),
  severity: Type.Union([Type.Literal('ERROR'), Type.Literal('WARNING')]),
  category: Type.Union([
    Type.Literal('TOPOLOGY_GRAPH'),
    Type.Literal('PERFORMANCE_SLO'),
    Type.Literal('FINANCIAL_BUDGET'),
    Type.Literal('FAULT_TOLERANCE'),
    Type.Literal('HARDWARE_RESOURCE')
  ]),
  rule_type: Type.Union([
    Type.Literal('NO_DIRECT_ACCESS'),       // запрет путей Client -> DB
    Type.Literal('CYCLE_DETECTION'),         // запрет циклических синхронных RPC
    Type.Literal('MANDATORY_INTERMEDIARY'),  // обязательный узел (кэш, очередь)
    Type.Literal('CEL_EXPRESSION')           // предикат на Common Expression Language
  ]),
  config: Type.Record(Type.String(), Type.Any())
});

// 5. Контракт Студии 1: Runtime & Forensics Workbench
export const Studio1RuntimeSchema = Type.Object({
  language: Type.Union([
    Type.Literal('java21'),
    Type.Literal('sql'),
    Type.Literal('nginx'),
    Type.Literal('typescript'),
    Type.Literal('python'),
    Type.Literal('go')
  ]),
  source_files: Type.Array(Type.Object({
    path: Type.String(),
    content: Type.String(),
    is_editable: Type.Boolean()
  })),
  faded_bug: Type.Optional(Type.Object({
    line_number: Type.Integer(),
    description: Type.String(),
    bug_pattern: Type.String()
  })),
  correct_fix_diff: Type.Optional(Type.String()),
  ast_rule_invariants: Type.Optional(Type.Array(Type.String()))
});

// 6. Контракт Студии 2: Topology Canvas & DES Simulation
export const Studio2SimulationSchema = Type.Object({
  topology: Type.Object({
    nodes: Type.Array(TransportNodeSchema),
    edges: Type.Array(TransportEdgeSchema)
  }),
  slos: Type.Object({
    p99_latency_max_ms: Type.Number({ minimum: 0.1 }),
    availability_target_nines: Type.Number({ minimum: 90, maximum: 99.9999 }),
    monthly_budget_max_usd: Type.Number({ minimum: 0 })
  }),
  traffic_profile: Type.Object({
    pattern: Type.Union([Type.Literal('POISSON'), Type.Literal('BURSTY'), Type.Literal('DIURNAL')]),
    lambda_mean_rps: Type.Number({ minimum: 1 }),
    inter_arrival_cv: Type.Number({ minimum: 0.01 }),
    read_ratio: Type.Number({ minimum: 0, maximum: 1 }),
    prompt_tokens_mean: Type.Optional(Type.Number()),
    generation_tokens_mean: Type.Optional(Type.Number())
  }),
  roofline_params: Type.Optional(Type.Object({
    peak_flops_tflops: Type.Optional(Type.Number()),
    memory_bandwidth_tb_s: Type.Optional(Type.Number()),
    weight_bits: Type.Optional(Type.Number()),
    kv_bits: Type.Optional(Type.Number())
  })),
  chaos_scenarios: Type.Optional(Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    trigger_second: Type.Number(),
    duration_second: Type.Number(),
    fault_type: Type.String(),
    target_node_id: Type.Optional(Type.String()),
    target_edge_id: Type.Optional(Type.String()),
    impact_multiplier: Type.Number()
  }))),
  invariants: Type.Array(InvariantRuleSchema)
});

// 7. Контракт Студии 3: Multimodal Bar-Raiser Defense Arena
export const Studio3BarRaiserSchema = Type.Object({
  probing_ladder: Type.Object({
    stage_1_validation: Type.String(),
    stage_2_tightening: Type.String(),
    stage_3_adversarial: Type.String(),
    stage_4_squeeze: Type.String()
  }),
  counter_probes: Type.Array(Type.Object({
    buzzword: Type.String(),
    trigger_regex: Type.String(),
    counter_question: Type.String(),
    expected_staff_answer: Type.String()
  })),
  evaluation_rubric_override: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

// 8. Канонический Манифест Сценария (SSOT)
export const ChallengeManifestSchema = Type.Object({
  $schema: Type.Optional(Type.String()),
  canonical_id: Type.String({ pattern: '^[A-Za-z0-9_-]+$' }),
  legacy_aliases: Type.Array(Type.String()),
  version: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+$' }),
  target_level: Type.Union([
    Type.Literal('L3_JUNIOR'),
    Type.Literal('L4_MIDDLE'),
    Type.Literal('L5_SENIOR'),
    Type.Literal('L6_STAFF'),
    Type.Literal('L7_PRINCIPAL')
  ]),
  archetype: Type.String(),
  title: Type.String({ minLength: 5 }),
  subtitle: Type.String(),
  problem_statement: Type.String({ minLength: 20 }),
  pedagogical_mode: Type.Union([
    Type.Literal('WORKED_EXAMPLE'),
    Type.Literal('FADED_COMPLETION'),
    Type.Literal('INDEPENDENT_DESIGN')
  ]),
  studio_1_runtime: Type.Optional(Studio1RuntimeSchema),
  studio_2_simulation: Studio2SimulationSchema,
  studio_3_bar_raiser: Studio3BarRaiserSchema
});

// 9. Контракт Оценки Bar-Raiser (Studio 3 & POST /evaluate)
export const BarRaiserEvaluationReportSchema = Type.Object({
  evaluation_id: Type.String(),
  canonical_id: Type.String(),
  overall_score: Type.Number({ minimum: 1, maximum: 5 }),
  competency_scores: Type.Object({
    architecture_depth: Type.Number({ minimum: 1, maximum: 5 }),
    quantitative_rigor: Type.Number({ minimum: 1, maximum: 5 }),
    failure_mode_analysis: Type.Number({ minimum: 1, maximum: 5 }),
    production_readiness: Type.Number({ minimum: 1, maximum: 5 })
  }),
  critical_failures_detected: Type.Array(Type.String()),
  operational_readiness: Type.Union([
    Type.Literal('READY_FOR_PRODUCTION'),
    Type.Literal('NEEDS_REFINEMENT'),
    Type.Literal('CRITICAL_REDESIGN_REQUIRED')
  ]),
  recommendations: Type.Array(Type.String()),
  recommended_katas: Type.Array(Type.String()),
  timestamp: Type.String()
});

export type ChallengeManifest = Static<typeof ChallengeManifestSchema>;
export type SemanticNodeType = Static<typeof SemanticNodeType>;
export type TransportNode = Static<typeof TransportNodeSchema>;
export type TransportEdge = Static<typeof TransportEdgeSchema>;
export type InvariantRule = Static<typeof InvariantRuleSchema>;
export type Studio1Runtime = Static<typeof Studio1RuntimeSchema>;
export type Studio2Simulation = Static<typeof Studio2SimulationSchema>;
export type Studio3BarRaiser = Static<typeof Studio3BarRaiserSchema>;
export type BarRaiserEvaluationReport = Static<typeof BarRaiserEvaluationReportSchema>;

