# 🔬 Wave 5 Phase B: Content, Scenario Bank & Bar-Raiser Research Suite

> **Методология:** Multi-Faceted Research-Driven Architecture (MFRDA)  
> **Статус:** `READY_FOR_EXECUTION`  
> **Принцип:** Декомпозиция и изоляция контекста. Каждое исследование запускается как **отдельный, независимый Deep Research прогон**, чтобы избежать поверхностного усреднения, галлюцинаций и усечения токенов (The Single-Prompt Fallacy).

---

## 🧭 Навигация по специализированным трекам исследований

| Трек | Фокус исследования | Целевой артефакт в платформе |
| :--- | :--- | :--- |
| [**Track B1**](#track-b1-sota-open-source-ecosystem--curricula-benchmark) | **SOTA Open-Source Ecosystem & University Curricula Benchmark** | Реестр открытых репозиториев, задачников, академических курсов и лучших поучительных кейсов BigTech |
| [**Track B2**](#track-b2-junior-l3--middle-l4-scenario-bank) | **Junior (L3) & Middle (L4) Scenario Bank** (Single-Box, Concurrency & Composed Distributed) | 10 манифестов TypeBox с точной математикой очередей, кодом рантайма Java 21/Go, дефектами Faded Scaffolding и CEL-инвариантами |
| [**Track B3**](#track-b3-senior-l5-distributed--ai-serving-scenario-bank) | **Senior (L5) Distributed & Modern AI Systems Scenario Bank** | 10 манифестов TypeBox: Continuous Batching, PagedAttention, HNSW, Raft, CRDT, Kimura $P99$, Roofline |
| [**Track B4**](#track-b4-staff-l6l7-planetary--cell-based-infrastructure) | **Staff (L6/L7) Planetary, Cell-Based & FinOps Scenario Bank** | 6–8 манифестов TypeBox: клеточная архитектура (Zero Blast Radius), мульти-мастер Active-Active, планировщики GPU-флота, FinOps |
| [**Track B5**](#track-b5-principal-bar-raiser-socratic--adversarial-defense-engine) | **Principal Bar-Raiser Socratic & Adversarial Defense Engine** | Деревья вопросов для Gemini Live, стресс-тесты отказами, матрицы оценки грейдов L3–L7 |

---

## Track B1: SOTA Open-Source Ecosystem & Curricula Benchmark

```markdown
# UNCONSTRAINED DEEP RESEARCH PROMPT: Global SOTA Open-Source Ecosystem, University Curricula, and Production Post-Mortems Benchmark for System Design Education (September 2026 Benchmark)

### Context & Goal
We are building a next-generation interactive engineering assessment platform ("Multi-Scale Capability Arena"). The platform features:
1. Studio 1: Runtime & Forensics Workbench (Micro/Meso scale: Java 21/24 Virtual Threads, JMM, off-heap buffers, OS/Linux primitives).
2. Studio 2: Discrete-Event Simulation (DES) Canvas (Meso/Macro scale: Web Worker queue simulator using M/M/c, M/G/1 Pollaczek-Khinchine, Allen-Cunneen, Kimura P99, Roofline models for AI inference, and Chaos Monkey).
3. Studio 3: Socratic/Adversarial Multimodal Voice Bar-Raiser (Principal Engineer persona evaluating trade-offs, blast radius, and failure runbooks).

We need an exhaustive, critical benchmark of existing open-source repositories, university curricula, and real-world BigTech engineering post-mortems as of September 2026. We refuse to reinvent the wheel where high-quality open-source materials exist, but we must rigorously identify their limitations, licensing, and pedagogical blind spots.

---

### Core Research Mandate:

#### 1. Top Open-Source GitHub Repositories Deep Dive
- Identify and critically analyze the top 15–20 open-source GitHub repositories dedicated to System Design, Distributed Systems, and Modern AI/LLM Infrastructure (e.g., donnemartin/system-design-primer, karanpratapsingh/system-design, mehdihadeli/awesome-software-architecture, alirezadir/Production-Level-Deep-Learning, chidiwilliams/buzz, vllm-project/vllm, etc.).
- For each repository, provide:
  * Repository name, primary authors, and GitHub URL/stars.
  * Exact inventory of topics, micro-challenges, code examples, and architectural diagrams.
  * Content License (MIT, Apache 2.0, CC-BY-SA, All Rights Reserved).
  * Critical Architectural Audit: What are its fatal flaws or outdated assumptions in 2026? (e.g., relying on static 2D images, lacking queuing math, ignoring modern JVM/Go concurrency, omitting LLM serving/continuous batching/vector search).

#### 2. Academic Systems Curricula & Lab Projects Benchmark
- Analyze modern systems courses from top computer science institutions (Stanford CS149/CS249, CMU 15-445 Database Systems, CMU 15-721 Advanced Database Systems, MIT 6.824 Distributed Systems, UC Berkeley CS162).
- What are the canonical hands-on projects, assignments, and simulators used to teach students distributed consensus (Raft), storage engine internals (LSM vs B-Tree, buffer pool managers), and parallel memory architectures?
- Which of these pedagogical mechanisms can be translated into browser-native 5–15 minute interactive katas?

#### 3. High-Value Real-World Engineering Post-Mortems (2020–2026)
- Identify 10 canonical, deeply educational real-world engineering outages and architectural migrations published by Tier-1 engineering teams (Cloudflare, AWS, Stripe, Netflix, Meta, OpenAI, GitHub).
  * Examples: Cascading connection pool failures, DNS retry storms, Kafka rebalance storms, thundering herds on cache invalidation, Redis cluster split-brain, GPU cluster network partition during LLM training.
- For each post-mortem:
  * What was the core architectural defect?
  * What mathematical or physical invariant was violated?
  * How should this outage be formulated as an interactive troubleshooting scenario (Studio 1 or Studio 2)?

#### 4. Commercial Platform Landscape & Gap Analysis
- Perform a critical audit of modern commercial platforms (ByteByteGo, HelloInterview, Codemia, Exponent, NeetCode, Educative).
- Where do they succeed, and where is their architectural glass ceiling? (e.g., superficial text descriptions, lack of physical constraints, static non-reactive canvases, canned mock interviews).
- How does an interactive Discrete-Event Simulation and Live Voice Bar-Raiser provide a 10x pedagogical leap over these existing tools?

---

### Deliverables:
1. **The Definitive 2026 Open-Source Repository Inventory:** Markdown table detailing repository name, focus, license, strengths, and specific exercises suitable for adaptation.
2. **Academic Labs Translation Matrix:** List of 8–10 university-grade systems concepts and how to package them into browser-executable micro-challenges.
3. **The 10 Canonical Post-Mortem Scenario Candidates:** Detailed specifications of real-world outages ready to be mapped into interactive failure-injection katas.
4. **Synthesis & Ingestion Recommendations:** Actionable roadmap for how our platform should ingest, cite, and expand upon open-source materials while maintaining 100% intellectual property integrity.
```

---

## Track B2: Junior (L3) & Middle (L4) Scenario Bank

```markdown
# UNCONSTRAINED DEEP RESEARCH PROMPT: Granular Scenario Bank & Math Specifications for Junior (L3) and Middle (L4) Systems Architecture (September 2026 Benchmark)

### Context & Goal
We are engineering the concrete scenario manifests for Junior (L3) and Middle (L4) software engineers on our interactive platform ("Multi-Scale Capability Arena").
Each scenario runs across:
- Studio 1 (Runtime & Forensics): Code snippets, thread dumps, memory layout, DB query plans.
- Studio 2 (DES Canvas): Nodes, edges, traffic generator, queuing theory simulator (M/M/c, M/G/1), and invariant assertions.
- Studio 3 (Voice Bar-Raiser): Socratic questions on failure modes and trade-offs.

We need complete, mathematically verified, production-grade specifications for 10 canonical foundational scenarios (5 Junior, 5 Middle). No hand-waving or placeholders.

---

### Core Research Mandate:

Provide exhaustive, ready-to-implement specifications for the following 10 canonical archetypes:

#### Tier 1: Junior (L3) Foundation Scenarios
1. **HikariCP Connection Pool Exhaustion & Thread Starvation (Java 21):**
   - Context: Spring Boot 3 + PostgreSQL. In-process deadlock when worker threads block on sub-queries while pool is saturated. Virtual threads (JEP 444/491) vs synchronized block pinning.
2. **Cache-Aside Stampede & Invalidation Race:**
   - Context: Redis + relational database. Cache miss under sudden traffic spike causes thundering herd and database connection saturation. Probabilistic early expiration (XFetch) vs mutex locking.
3. **Database Indexing Trade-offs under High Write Volume:**
   - Context: 10k writes/sec vs 50k reads/sec. B-Tree write amplification vs LSM tree vs unindexed queries causing full sequential table scans.
4. **Token Bucket Rate Limiter with Local In-Memory Lock Contention:**
   - Context: Single-node reverse proxy rate limiting. AtomicInteger vs LongAdder vs synchronized lock under 100k concurrent client requests.
5. **Nginx Reverse Proxy Buffer Overflow & Upstream Load Shedding:**
   - Context: Slow downstream clients causing upstream reverse proxy buffer pool exhaustion and socket leak.

#### Tier 2: Middle (L4) Composed Distributed Systems Scenarios
6. **Distributed Unique ID Generator (Snowflake Architecture):**
   - Context: 64-bit ID generation across 32 worker nodes. Machine ID allocation, sequence rollover, and NTP clock drift handling (backward leap of 50ms).
7. **Idempotent Payment Processing with Transactional Outbox:**
   - Context: Microservice communicating with 3rd-party payment gateway (Stripe). Dual-write problem, idempotency key table with deduplication window, and Outbox CDC to message broker.
8. **Message Queue Consumer Lag & Dead-Letter Queue (DLQ) Backpressure:**
   - Context: Kafka/RabbitMQ pipeline where downstream database slows down. Consumer group rebalance storm, poison pill message poisoning, and backpressure rate adjustment.
9. **Distributed Lock with Fencing Tokens:**
   - Context: Mutual exclusion across distributed worker nodes. GC pause / network partition causing lease expiration while worker is writing; Martin Kleppmann fencing token pattern.
10. **Read-Heavy Social Feed with Hot Partition Fan-Out:**
    - Context: Celebrity/Influencer post with 10M followers. Fan-out-on-write vs Fan-out-on-read, Redis cluster hot key replication, and LRU memory eviction.

---

### Per-Scenario Specification Requirement:
For EACH of the 10 scenarios, provide:
1. **Canonical ID, Title, Level (L3 or L4), and Primary Engineering Domain.**
2. **Concrete Traffic Profile & Physical Constraints:**
   - Arrival rate $\lambda$ (reads/sec, writes/sec), Read:Write ratio, Peak multiplier.
   - Payload size (KB), Connection pool limits, CPU/Memory hardware limits.
   - Exact Target SLOs: Latency $P99$ (ms), Availability nines, Max budget ($/mo).
3. **Initial Faded Scaffolding Defect (Deliberate Bug):**
   - What exact flaw is present in the initial topology or configuration that students must identify and fix?
   - How does the system fail under simulation when this defect is active?
4. **Mathematical Modeling & Formula Parameters:**
   - Which queuing model governs the bottleneck? ($M/M/c$, $M/G/1$, or Erlang-C).
   - Numerical service time mean $\mu$ and variance $\sigma^2$.
5. **Declarative Validation Invariants (Common Expression Language - CEL):**
   - Provide 3–5 concrete CEL boolean expressions verifying structural connectivity and performance (e.g., `graph.nodes.exists(n, n.type == 'cache')`, `sim.p99_latency_ms <= 45.0`).
6. **Socratic Bar-Raiser Probing Questions:**
   - 3 provocative follow-up trade-off questions an interviewer should ask after the candidate fixes the defect.
```

---

## Track B3: Senior (L5) Distributed & AI Serving Scenario Bank

```markdown
# UNCONSTRAINED DEEP RESEARCH PROMPT: Granular Scenario Bank & Mathematical Formulations for Senior (L5) Distributed Systems & Modern AI Infrastructure (September 2026 Benchmark)

### Context & Goal
We are engineering the scenario manifests for Senior (L5) engineers on our interactive platform ("Multi-Scale Capability Arena").
At Senior level, the curriculum bridges high-scale partitioned distributed systems and modern AI serving infrastructure (vLLM, continuous batching, vector search, PagedAttention, Roofline modeling).

We need complete, mathematically verified, production-grade specifications for 10 canonical Senior scenarios (5 Distributed Systems, 5 AI/LLM Systems). No hand-waving or placeholders.

---

### Core Research Mandate:

Provide exhaustive, ready-to-implement specifications for the following 10 canonical archetypes:

#### Part 1: Senior (L5) Distributed Systems
1. **Multi-Region Active-Passive Transactional Ledger with Raft Consensus:**
   - Cross-datacenter consensus latency (50ms RTT), write leader bottlenecks, split-brain fence, asynchronous read replicas with bounded staleness.
2. **Real-Time Collaborative Document Editing (CRDT / OT Engine):**
   - Conflict-free replicated data types over WebSockets, state-based vs operation-based sync, vector clocks, and memory growth compaction.
3. **High-Throughput Time-Series Metrics Ingestion & Rollup Engine:**
   - Ingestion of 2M metrics/sec. In-memory ring buffer, LSM time-series compaction, downsampling rollups (1m, 1h, 1d), and query fan-out.
4. **Global Edge CDN with Dynamic Cache Purging & Geo-DNS Routing:**
   - Anycast routing, Cache-Control hierarchy, surrogate keys (Fastly/Cloudflare model), stale-while-revalidate, and origin shield.
5. **Distributed Schedulers & Ephemeral Task Queues (Borg/Temporal pattern):**
   - Deterministic event sourcing, heartbeats, worker leases, state machine replay, and cascading retry storm prevention.

#### Part 2: Senior (L5) Modern AI & LLM Infrastructure
6. **High-Throughput LLM Inference Gateway with Continuous Batching:**
   - vLLM / TensorRT-LLM architecture. Prefill phase (compute-bound) vs Decode phase (memory-bandwidth bound). Iteration-level scheduling, time-to-first-token (TTFT) vs inter-token latency (ITL).
7. **PagedAttention & KV-Cache Sharding under Context Length Surges:**
   - GPU VRAM allocation with virtual memory paging for KV-cache. Request preemption vs chunked prefill vs offloading to CPU RAM during 128k context spikes.
8. **Scalable Vector Database with Hybrid Search & Semantic Caching:**
   - HNSW graph memory sizing, IVF-PQ indexing, BM25 sparse keyword inverted index, Reciprocal Rank Fusion (RRF), and Redis semantic cache with cosine distance threshold.
9. **Multi-Modal Document Processing Pipeline with Token Budget Guardrails:**
   - Ingestion of millions of PDFs/images. OCR + Vision LLM extraction + embedding generation with worker pools, rate limiting, and sliding-window token budgets.
10. **Streaming Agentic Workflow Orchestrator with Tool-Calling Sandboxes:**
    - Cyclic multi-step agent graph (LangGraph / Temporal). Tool execution timeouts, speculative tool execution, context window pruning, and state persistence.

---

### Per-Scenario Specification Requirement:
For EACH of the 10 scenarios, provide:
1. **Canonical ID, Title, Level (L5), and Primary Engineering Domain.**
2. **Concrete Traffic Profile & Hardware Constraints:**
   - Arrival rate $\lambda$, Token arrival rate (prompt tokens vs completion tokens).
   - Hardware: CPU cores, RAM, GPU count, VRAM (e.g., 8x NVIDIA H100 80GB), HBM bandwidth (3.35 TB/s), PCIe bandwidth.
   - Target SLOs: TTFT $P99 < 800\text{ ms}$, ITL $P99 < 30\text{ ms}$, Availability $99.99\%$, Max monthly budget.
3. **Initial Faded Scaffolding Defect (Deliberate Architectural Flaw):**
   - What naive implementation or configuration is initially presented?
   - How does the system fail (e.g., GPU Out-Of-Memory, Head-of-Line blocking in static batching, HNSW recall collapse)?
4. **Mathematical Modeling & Formula Parameters:**
   - Roofline arithmetic intensity formulas, memory footprint equations ($2 \times \text{layers} \times \text{heads} \times \text{dim} \times \text{tokens} \times 2\text{ bytes}$), or Kimura $P99$ queue equations.
5. **Declarative Validation Invariants (CEL):**
   - 3–5 concrete CEL boolean expressions validating the candidate's solution.
6. **Socratic Bar-Raiser Probing Questions:**
   - 3 deep, trade-off-centric questions targeting architectural edge cases, tail latencies, and blast radius.
```

---

## Track B4: Staff (L6/L7) Planetary, Cell-Based & FinOps Infrastructure

```markdown
# UNCONSTRAINED DEEP RESEARCH PROMPT: Granular Scenario Bank & Formulations for Staff (L6) and Principal (L7) Planetary Systems, Cellular Architecture, and FinOps (September 2026 Benchmark)

### Context & Goal
We are engineering the scenario manifests for Staff (L6) and Principal (L7) architects on our interactive platform ("Multi-Scale Capability Arena").
At Staff/Principal level, technical evaluations do not focus on basic component connections. They focus on:
- Blast-radius isolation (Cellular Architecture).
- Cross-region active-active multi-primary consensus and conflict resolution.
- Multi-tenant planetary GPU cluster scheduling with heterogeneous hardware.
- FinOps, multi-million dollar infrastructure budgets, and bandwidth egress economics.
- Chaos engineering, split-brain immunity, and automated disaster recovery with RPO=0 / RTO < 30s.

We need complete, mathematically verified, production-grade specifications for 6 canonical Staff/Principal scenarios.

---

### Core Research Mandate:

Provide exhaustive, ready-to-implement specifications for the following 6 planetary-scale archetypes:

1. **Cellular Architecture for Planetary Payment Infrastructure (Zero Blast-Radius):**
   - AWS/Stripe cell model. Routing layer, partition keys (account/tenant hash), cell isolation boundaries, poison pill containment, and graceful degradation during complete cell loss.
2. **Global Active-Active Multi-Primary Database with Hybrid Logical Clocks:**
   - Google Spanner / CockroachDB model across 5 global regions. Raft leader placement, TrueTime / HLC drift bounds, distributed transactions (2PC + Raft), and cross-region WAN partition handling.
3. **Planetary Multi-Tenant GPU Cluster Scheduler (Borg for LLMs):**
   - 10,000+ GPU fleet orchestration. Gang scheduling for distributed training (PyTorch FSDP / Megatron-LM), continuous batching inference priority preemption, NVLink/InfiniBand locality packing, and KV-cache tiering across HBM, Host DRAM, and NVMe SSDs.
4. **FinOps & Bandwidth Cost Optimization for High-Scale Media Streaming:**
   - 500 Tbps global egress. Multi-CDN traffic steering (Citrix/Radar model), 95th-percentile transit billing optimization, P2P assisted delivery, and edge transcoding cost trade-offs.
5. **Autonomous Multi-Cloud Disaster Recovery with RPO=0 and RTO < 30s:**
   - Cross-cloud (AWS + GCP) active-active state machine. Consensus log mirroring, automated DNS failover with health-check hysteresis, split-brain fencing tokens, and data divergence reconciliation.
6. **Planetary Real-Time Ad Bidding Engine with Hard 20ms P99.9 Budget:**
   - Global RTB auction engine processing 10M QPS. Hedged requests with cancellation tokens, tie-breaker consensus, tail latency budgeting, and load shedding under network jitter.

---

### Per-Scenario Specification Requirement:
For EACH of the 6 scenarios, provide:
1. **Canonical ID, Title, Level (L6/L7), and Primary Architecture Domain.**
2. **Planetary Scale Targets & Financial Constraints:**
   - QPS/RPS ($10^5 \text{ to } 10^7$), Data volume (Petabytes/Exabytes), Global geographic distribution (3–5 continents).
   - FinOps Budget: Monthly infrastructure spend ($100\text{k to } $2\text{M/mo}), Cost per transaction target, Inter-AZ/WAN egress bandwidth cost formulas.
   - Target SLOs: $P99.9$ Latency budget, RPO (Recovery Point Objective), RTO (Recovery Time Objective), Zero-Blast-Radius limits (< 1% users affected by any single failure).
3. **Initial Faded Scaffolding Defect (Subtle Systemic Trap):**
   - What subtle architectural trap exists in the initial design? (e.g., Hidden cross-cell synchronous dependency, NTP clock step during financial settlement, cascading failover storm due to insufficient capacity reserve in peer cells).
4. **Mathematical & FinOps Formulations:**
   - Cellular blast radius calculations: $P(\text{total failure}) = 1 - (1 - P(\text{cell failure}))^N$ under correlated failures.
   - 95th-percentile billing cost curves and WAN transfer optimization math.
5. **Declarative Validation Invariants (CEL):**
   - 3–5 advanced CEL expressions validating failure isolation, cost thresholds, and consensus correctness.
6. **Bar-Raiser Executive Probing Matrix:**
   - 4 ruthless, Principal-level probing questions testing organizational risk, disaster recovery runbooks, and trade-offs that cannot be solved by simply adding more hardware.
```

---

## Track B5: Principal Bar-Raiser Socratic & Adversarial Defense Engine

```markdown
# UNCONSTRAINED DEEP RESEARCH PROMPT: SOTA Socratic Probing Architecture, Adversarial Stress-Testing, and Evaluation Rubrics for AI Bar-Raiser Interviewers (September 2026 Benchmark)

### Context & Goal
Our platform features Studio 3: a Multimodal Voice Bar-Raiser driven by Gemini Live over a bidirectional WebSocket.
The AI interviewer roleplays as a seasoned BigTech Principal / Bar-Raiser (Google L7, Meta E7, Stripe Principal, OpenAI Staff).

Current mock interview bots in the industry are universally recognized as superficial: they ask generic questions ("What database would you use?"), accept buzzwords without probing, and fail to pressure-test the candidate's design under catastrophic conditions.

We need the definitive pedagogical blueprint and conversation state machine for an uncompromising, Socratic, and adversarial AI Bar-Raiser.

---

### Core Research Mandate:

#### 1. Anatomy of an Elite BigTech Bar-Raiser Session (The L3–L7 Differential)
- How do Principal-level interviewers at Google, Meta, Stripe, and OpenAI actually conduct system design evaluations?
- What are the precise behavioral and technical markers that separate:
  * L3 (Junior): Follows instructions, knows basic components, struggles with failure modes.
  * L4 (Middle): Builds working 2-3 tier systems, understands caching and DB indexes, misses tail latencies and distributed edge cases.
  * L5 (Senior): Proactively discusses trade-offs (CAP/PACELC), tail latencies ($P99$), partitioning, and monitoring; handles single-node failure easily.
  * L6/L7 (Staff/Principal): Starts with business constraints and blast radius; thinks in cells, failure domains, and FinOps; questions requirements; designs resilient socio-technical architectures.

#### 2. The Socratic "Pressure-Testing" Methodology
- How does an elite interviewer systematically expose weak designs without being toxic or unhelpful?
- The 4-Stage Probing Ladder:
  1. *Validation Probe:* "Walk me through how data flows when request $X$ arrives."
  2. *Constraint Tightening:* "Your design handles 10k RPS. We just grew 50x overnight to 500k RPS. Where does your system catch fire first?"
  3. *Adversarial Fault Injection:* "The primary database in US-East-1 just experienced silent data corruption and your replica took 3 minutes to notice. What happened to in-flight orders?"
  4. *Economic/Trade-off Squeeze:* "Your solution requires 128x H100 GPUs and 10 Gbps cross-region WAN sync, costing $300k/month. The VP gives you a budget of $45k/month. What do you cut, and what guarantees do you abandon?"

#### 3. Conversation State Machine & Non-Deterministic Flow
- Formulate the turn-by-turn state machine for the AI Voice Interviewer:
  * State 0: Problem Presentation & Clarification Phase (Checking if candidate asks clarifying questions on SLOs, read/write ratio, scale).
  * State 1: High-Level Topology Review (Verifying foundational architecture before diving into deep components).
  * State 2: Deep Dive & Bottleneck Probe (Targeting the single weakest component identified on the Canvas).
  * State 3: Failure Mode & Chaos Challenge (Injecting a specific partition or hardware failure).
  * State 4: Synthesis & Final Verdict (Constructive feedback, grade placement L3–L7, and actionable gaps).

#### 4. Anti-Patterns & Buzzword Disqualification Grid
- Compile a comprehensive list of candidate buzzword evasions and the exact counter-questions the AI should deploy:
  * Candidate says: "We'll just put Kafka here." $\rightarrow$ Bar-Raiser: "Why Kafka instead of SQS or Redis Streams? How do you handle partition rebalancing during high traffic?"
  * Candidate says: "We'll use a distributed lock." $\rightarrow$ Bar-Raiser: "What happens when a 500ms GC pause causes the lock lease to expire while the worker is writing?"
  * Candidate says: "We'll just use Kubernetes auto-scaling." $\rightarrow$ Bar-Raiser: "A pod takes 45 seconds to pull the image and initialize. Your traffic spike arrives in 3 seconds. How does auto-scaling prevent a 503 storm?"

---

### Deliverables:
1. **The Turn-by-Turn Bar-Raiser Conversation State Machine:** State transitions, guard conditions, and Gemini system prompt directives.
2. **The 4-Tier Assessment Rubric:** Concrete scoring criteria for Junior (L3), Middle (L4), Senior (L5), and Staff (L6+) across: Architecture Feasibility, Scale & Math, Fault Tolerance, and Trade-off Articulation.
3. **The 25 Canonical Buzzword Traps & Socratic Counter-Probes:** Table of common candidate hand-waves and razor-sharp Socratic responses.
4. **Structured JSON Output Schema:** The exact schema the Voice Bar-Raiser must return upon interview conclusion (`grade_awarded`, `score_breakdown`, `critical_failures`, `next_recommended_katas`).
```
