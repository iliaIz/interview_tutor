#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/generate_all_manifests.py
Generates the 26 Canonical Tri-Studio Manifests for InterviewPrep AI (Wave 05).
Strictly grounded in Phase B Deep Research Reports (B2, B3, B4).
"""

import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

MANIFESTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'scenarios', 'manifests')
os.makedirs(os.path.join(MANIFESTS_DIR, 'l3_junior'), exist_ok=True)
os.makedirs(os.path.join(MANIFESTS_DIR, 'l4_middle'), exist_ok=True)
os.makedirs(os.path.join(MANIFESTS_DIR, 'l5_senior'), exist_ok=True)
os.makedirs(os.path.join(MANIFESTS_DIR, 'l6_l7_staff'), exist_ok=True)

manifests = [
    # =========================================================================
    # TIER 1: JUNIOR (L3) FOUNDATION SCENARIOS (B2)
    # =========================================================================
    {
        "category_dir": "l3_junior",
        "canonical_id": "L3-PERF-HIKARICP-STARVATION",
        "legacy_aliases": ["hld-micro-01", "kata-01-consistent-hashing", "hikari-starvation", "incident-02-connection-leak"],
        "version": "1.0.0",
        "target_level": "L3_JUNIOR",
        "archetype": "PERFORMANCE_TUNING",
        "title": "HikariCP Connection Pool Exhaustion and Thread Starvation",
        "subtitle": "Sizing Database Connection Pools under Little's Law and Virtual Thread Pinning",
        "problem_statement": "A Spring Boot microservice running under 1,500 RPS begins dropping requests with HikariPool ConnectionTimeoutException (timeout=250ms). A developer attempted to fix the issue by increasing maximumPoolSize from 10 to 500, but database throughput plummeted by 70% due to CPU context-switch thrashing, and virtual threads began pinning carrier threads.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/service/OrderService.java",
                    "content": "@Service\npublic class OrderService {\n    @Autowired private DataSource dataSource;\n    @Autowired private RestTemplate restTemplate;\n\n    @Transactional\n    public OrderResult processOrder(OrderRequest request) {\n        // BUG: Holding JDBC connection across slow external network call\n        String fraudCheck = restTemplate.getForObject(\"http://fraud-service/check/\" + request.userId(), String.class);\n        try (Connection conn = dataSource.getConnection()) {\n            PreparedStatement ps = conn.prepareStatement(\"INSERT INTO orders (id, user_id, amount) VALUES (?, ?, ?)\");\n            ps.setString(1, request.id());\n            ps.setString(2, request.userId());\n            ps.setBigDecimal(3, request.amount());\n            ps.executeUpdate();\n        } catch (SQLException e) {\n            throw new RuntimeException(e);\n        }\n        return new OrderResult(request.id(), \"PROCESSED\");\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 8,
                "description": "JDBC connection acquired inside @Transactional boundary and held idle during external HTTP call, starving pool.",
                "bug_pattern": "CONNECTION_LEAK_IN_TRANSACTION"
            },
            "correct_fix_diff": "- @Transactional\n  public OrderResult processOrder(OrderRequest request) {\n-     String fraudCheck = restTemplate.getForObject(...);\n+ public OrderResult processOrder(OrderRequest request) {\n+     String fraudCheck = restTemplate.getForObject(...); // Outside DB transaction\n+     saveOrderTransactional(request);\n+ }",
            "ast_rule_invariants": ["no-io-inside-transactional", "enforce-clock-injection"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "ingress", "type": "api_gateway", "title": "API Gateway", "grid_position": {"col": 0, "row": 0}, "params": {"rate_limit_rps": 2000}},
                    {"id": "order_svc", "type": "app_service", "title": "Order Service (Java 21)", "grid_position": {"col": 1, "row": 0}, "params": {"hikari_pool_size": 10, "connection_timeout_ms": 250, "cores": 8}},
                    {"id": "postgres_db", "type": "rdbms_primary", "title": "PostgreSQL Primary", "grid_position": {"col": 2, "row": 0}, "params": {"max_connections": 100, "query_latency_mean_ms": 3.5}}
                ],
                "edges": [
                    {"id": "e1", "source": "ingress", "target": "order_svc", "protocol": "http_rest"},
                    {"id": "e2", "source": "order_svc", "target": "postgres_db", "protocol": "db_protocol"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 50.0,
                "availability_target_nines": 99.9,
                "monthly_budget_max_usd": 1500.0
            },
            "traffic_profile": {
                "pattern": "POISSON",
                "lambda_mean_rps": 1500.0,
                "inter_arrival_cv": 0.8,
                "read_ratio": 0.2
            },
            "chaos_scenarios": [
                {
                    "id": "chaos_db_stall",
                    "name": "Database Disk IO Stall",
                    "trigger_second": 5,
                    "duration_second": 3,
                    "fault_type": "DISK_IOPS_STALL",
                    "target_node_id": "postgres_db",
                    "impact_multiplier": 5.0
                }
            ],
            "invariants": [
                {
                    "id": "inv_pool_sizing",
                    "description": "Connection pool size must satisfy Little's Law without exceeding 2x CPU cores.",
                    "severity": "ERROR",
                    "category": "HARDWARE_RESOURCE",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {
                        "expression": "simulation.is_stable == True && simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms"
                    }
                },
                {
                    "id": "inv_no_direct_client_db",
                    "description": "Ingress cannot connect directly to RDBMS without app service.",
                    "severity": "ERROR",
                    "category": "TOPOLOGY_GRAPH",
                    "rule_type": "NO_DIRECT_ACCESS",
                    "config": {"from_type": "api_gateway", "to_type": "rdbms_primary"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Trace a JDBC connection lifecycle from HikariCP borrow to release. What exact state machine does a thread undergo when the pool is exhausted?",
                "stage_2_tightening": "Traffic jumps from 1,500 RPS to 10,000 RPS in 2 seconds. The database host has 16 physical cores. Why does setting maximumPoolSize=500 cause throughput collapse rather than scaling?",
                "stage_3_adversarial": "A slow third-party payment gateway takes 4.5 seconds to respond. How do you prevent thread starvation in the upstream web server without spinning up additional containers?",
                "stage_4_squeeze": "Your infrastructure bill shows $3,000/month for provisioned database IOPS. We must cut it by 60% without violating the 50ms P99 SLO."
            },
            "counter_probes": [
                {
                    "buzzword": "increase pool size",
                    "trigger_regex": "(?i)increase.*pool.*(size|to)|make.*pool.*bigger",
                    "counter_question": "According to Little's Law and PostgreSQL's process-per-connection model, what is the physical consequence of having 500 active OS processes contending for 16 CPU cores?",
                    "expected_staff_answer": "Context-switch thrashing, CPU cache invalidation, and lock contention on shared memory buffers degrade actual throughput. The optimal pool size is Cores * 2 + SpindleCount."
                },
                {
                    "buzzword": "virtual threads",
                    "trigger_regex": "(?i)virtual.*thread|project.*loom",
                    "counter_question": "If your JDBC driver or logging framework uses synchronized blocks around socket IO, what happens to the underlying ForkJoinPool carrier thread?",
                    "expected_staff_answer": "The carrier thread becomes pinned (synchronized blocks prevent unmounting in Java 21). When all carrier threads are pinned, all other virtual threads starve."
                }
            ]
        }
    },
    {
        "category_dir": "l3_junior",
        "canonical_id": "L3-PERF-CACHE-STAMPEDE",
        "legacy_aliases": ["hld-micro-02", "kata-02-cache-aside", "cache-stampede-xfetch"],
        "version": "1.0.0",
        "target_level": "L3_JUNIOR",
        "archetype": "CACHING_STRATEGY",
        "title": "Cache Stampede Prevention with Probabilistic Early Expiration (XFetch)",
        "subtitle": "Mitigating Thundering Herd via Optimal Probabilistic Recomputation vs Mutex Locks",
        "problem_statement": "An e-commerce product catalog caches hot inventory data in Redis with a 10-minute TTL. At peak traffic (5,000 RPS), the TTL of the top 5 product keys expires simultaneously. Thousands of concurrent requests experience cache misses and simultaneously hammer PostgreSQL, causing connection pool exhaustion and a cascading outage.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/cache/ProductCacheService.java",
                    "content": "@Service\npublic class ProductCacheService {\n    @Autowired private RedisTemplate<String, Product> redis;\n    @Autowired private ProductRepository db;\n\n    public Product getProduct(String id) {\n        // BUG: Standard naive Cache-Aside prone to thundering herd upon TTL expiry\n        Product cached = redis.opsForValue().get(\"product:\" + id);\n        if (cached == null) {\n            cached = db.findById(id).orElseThrow();\n            redis.opsForValue().set(\"product:\" + id, cached, Duration.ofMinutes(10));\n        }\n        return cached;\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 8,
                "description": "Synchronous cache miss fallback allows thundering herd to bypass cache simultaneously upon key expiration.",
                "bug_pattern": "CACHE_STAMPEDE_THUNDERING_HERD"
            },
            "correct_fix_diff": "- if (cached == null) {\n-     cached = db.findById(id).orElseThrow();\n-     redis.opsForValue().set(\"product:\" + id, cached, Duration.ofMinutes(10));\n+ // Implement XFetch probabilistic early expiration algorithm\n+ if (cached == null || shouldRecomputeEarly(cached.getDelta(), cached.getTtl(), 1.0)) {\n+     asyncRefreshCache(id);\n+ }",
            "ast_rule_invariants": ["no-raw-cache-aside-without-stampede-protection"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "ingress", "type": "api_gateway", "title": "API Gateway", "grid_position": {"col": 0, "row": 0}, "params": {"rate_limit_rps": 10000}},
                    {"id": "product_svc", "type": "app_service", "title": "Catalog Service", "grid_position": {"col": 1, "row": 0}, "params": {"xfetch_beta": 1.0}},
                    {"id": "redis", "type": "redis_cache", "title": "Redis Cluster", "grid_position": {"col": 2, "row": 0}, "params": {"hit_rate_baseline": 0.98, "ttl_seconds": 600, "xfetch_enabled": True}},
                    {"id": "postgres", "type": "rdbms_primary", "title": "PostgreSQL Primary", "grid_position": {"col": 2, "row": 1}, "params": {"max_iops": 3000, "capacity_rps": 600}}
                ],
                "edges": [
                    {"id": "e1", "source": "ingress", "target": "product_svc", "protocol": "http_rest"},
                    {"id": "e2", "source": "product_svc", "target": "redis", "protocol": "tcp_socket"},
                    {"id": "e3", "source": "product_svc", "target": "postgres", "protocol": "db_protocol"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 20.0,
                "availability_target_nines": 99.95,
                "monthly_budget_max_usd": 1200.0
            },
            "traffic_profile": {
                "pattern": "BURSTY",
                "lambda_mean_rps": 5000.0,
                "inter_arrival_cv": 1.5,
                "read_ratio": 0.95
            },
            "invariants": [
                {
                    "id": "inv_cache_stampede_protection",
                    "description": "Cache must implement probabilistic early refresh or mutex lock to prevent database saturation.",
                    "severity": "ERROR",
                    "category": "PERFORMANCE_SLO",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {
                        "expression": "simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms && simulation.is_stable == True"
                    }
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Explain the exact sequence of events when a cached item's TTL expires at 12:00:00.000 while 2,000 requests are in flight.",
                "stage_2_tightening": "We have 100,000 keys. If we use distributed locks in Redis (SETNX) to guard recomputation, what happens if the holder process pauses for 800ms during GC?",
                "stage_3_adversarial": "A flash sale starts. 50,000 users query the exact same newly added product which is NOT yet in the cache. How does your solution handle cold-start stampede?",
                "stage_4_squeeze": "We cannot afford an in-memory Redis cluster with replica auto-failover. How can we achieve stampede resilience using local JVM memory only?"
            },
            "counter_probes": [
                {
                    "buzzword": "distributed lock",
                    "trigger_regex": "(?i)distributed.*lock|redlock|setnx",
                    "counter_question": "If 5,000 concurrent threads block on a distributed Redis lock waiting for one worker to compute, what happens to your application server connection pool and thread queue?",
                    "expected_staff_answer": "Thread starvation and queue buildup occur. XFetch (probabilistic early expiration) or SingleFlight in-memory mutex avoids blocking readers while recomputation runs asynchronously."
                }
            ]
        }
    },
    {
        "category_dir": "l3_junior",
        "canonical_id": "L3-PERF-DB-INDEX-WRITEAMP",
        "legacy_aliases": ["hld-micro-03", "kata-03-db-sharding", "db-indexing-writeamp"],
        "version": "1.0.0",
        "target_level": "L3_JUNIOR",
        "archetype": "DATA_STORAGE",
        "title": "Database Indexing Trade-offs under High Write Volume",
        "subtitle": "B-Tree Fill Factor Tuning, Write Amplification Elimination & Covering Indexes",
        "problem_statement": "A financial transaction ingestion table handles 4,000 writes/sec and 200 reads/sec. Developers added 8 different indexes on the table to speed up ad-hoc operational queries. As a result, disk write IOPS spiked 7x, WAL generation overloaded replication, and insert latency degraded from 2ms to 45ms.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "sql",
            "source_files": [
                {
                    "path": "schema/V1__transactions_table.sql",
                    "content": "CREATE TABLE transactions (\n    id UUID PRIMARY KEY,\n    user_id BIGINT NOT NULL,\n    account_id BIGINT NOT NULL,\n    merchant_id BIGINT NOT NULL,\n    status VARCHAR(32) NOT NULL,\n    amount NUMERIC(15, 2) NOT NULL,\n    currency VARCHAR(3) NOT NULL,\n    created_at TIMESTAMP WITH TIME ZONE NOT NULL\n);\n\n-- BUG: Redundant and overlapping B-Tree indexes multiplying write cost by 8x\nCREATE INDEX idx_tx_user ON transactions(user_id);\nCREATE INDEX idx_tx_user_created ON transactions(user_id, created_at);\nCREATE INDEX idx_tx_account ON transactions(account_id);\nCREATE INDEX idx_tx_merchant ON transactions(merchant_id);\nCREATE INDEX idx_tx_status ON transactions(status); -- Low cardinality index\nCREATE INDEX idx_tx_created ON transactions(created_at);\nCREATE INDEX idx_tx_currency ON transactions(currency); -- 3 distinct values only\nCREATE INDEX idx_tx_amount ON transactions(amount);",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 14,
                "description": "Low-cardinality and overlapping indexes multiplying write amplification on every insert.",
                "bug_pattern": "INDEX_WRITE_AMPLIFICATION"
            },
            "correct_fix_diff": "- CREATE INDEX idx_tx_status ON transactions(status);\n- CREATE INDEX idx_tx_currency ON transactions(currency);\n- CREATE INDEX idx_tx_user ON transactions(user_id); -- Covered by (user_id, created_at)\n+ -- Keep only high-selectivity composite indexes\n+ CREATE INDEX idx_tx_user_created ON transactions(user_id, created_at DESC) INCLUDE (amount, status);",
            "ast_rule_invariants": ["no-low-cardinality-btree-index", "no-redundant-prefix-index"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "ingress", "type": "api_gateway", "title": "Ingress API", "grid_position": {"col": 0, "row": 0}, "params": {"rate_limit_rps": 6000}},
                    {"id": "tx_writer", "type": "worker_pool", "title": "Transaction Writer Pool", "grid_position": {"col": 1, "row": 0}, "params": {"workers": 16}},
                    {"id": "pg_primary", "type": "rdbms_primary", "title": "PostgreSQL Primary", "grid_position": {"col": 2, "row": 0}, "params": {"max_iops": 5000, "wal_buffer_mb": 64}}
                ],
                "edges": [
                    {"id": "e1", "source": "ingress", "target": "tx_writer", "protocol": "http_rest"},
                    {"id": "e2", "source": "tx_writer", "target": "pg_primary", "protocol": "db_protocol"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 15.0,
                "availability_target_nines": 99.95,
                "monthly_budget_max_usd": 2000.0
            },
            "traffic_profile": {
                "pattern": "POISSON",
                "lambda_mean_rps": 4000.0,
                "inter_arrival_cv": 0.5,
                "read_ratio": 0.05
            },
            "invariants": [
                {
                    "id": "inv_write_latency",
                    "description": "P99 insert latency must remain below 15ms under 4000 writes/sec.",
                    "severity": "ERROR",
                    "category": "PERFORMANCE_SLO",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {"expression": "simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Walk through what PostgreSQL's storage engine does on disk when a row is inserted into a table with 8 B-Tree indexes.",
                "stage_2_tightening": "If random UUIDv4 keys are used as the primary key, why does write throughput collapse once the table size exceeds available RAM?",
                "stage_3_adversarial": "We must support query by `status = 'PENDING'` (which is 0.1% of rows) and `created_at`. How do you index this with zero write amplification on completed rows?",
                "stage_4_squeeze": "Cloud provider disk IOPS limits are exceeded. How do you tune PostgreSQL fillfactor and HOT (Heap-Only Tuples) updates to reduce page splits?"
            },
            "counter_probes": [
                {
                    "buzzword": "add index",
                    "trigger_regex": "(?i)just.*add.*index|create.*index.*on.*status",
                    "counter_question": "Status has only 4 distinct values: PENDING, COMPLETED, FAILED, CANCELLED. Why will the PostgreSQL query planner ignore a standard B-Tree index on status for 99% of queries?",
                    "expected_staff_answer": "B-Tree indexes on low-cardinality columns have poor selectivity; a sequential scan or bitmap scan is cheaper. Partial index (WHERE status = 'PENDING') should be used instead."
                }
            ]
        }
    },
    {
        "category_dir": "l3_junior",
        "canonical_id": "L3-CONC-TOKENBUCKET-LOCK",
        "legacy_aliases": ["hld-micro-04", "kata-04-rate-limiter", "token-bucket-lock"],
        "version": "1.0.0",
        "target_level": "L3_JUNIOR",
        "archetype": "CONCURRENCY_CONTROL",
        "title": "Token Bucket Rate Limiter with Local In-Memory Lock Contention",
        "subtitle": "Eliminating Spinlock Degradation via Lock-Free Atomic CAS and Striped Counters",
        "problem_statement": "An in-memory rate limiter protecting an authentication endpoint under 25,000 RPS experiences severe CPU saturation. Thread profiling indicates 92% of CPU time is spent in thread parking and lock synchronization inside the TokenBucket.tryConsume() method.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/limiter/TokenBucket.java",
                    "content": "public class TokenBucket {\n    private final long capacity;\n    private final double refillRatePerNano;\n    private double tokens;\n    private long lastRefillTime;\n\n    public TokenBucket(long capacity, double refillRatePerSecond) {\n        this.capacity = capacity;\n        this.refillRatePerNano = refillRatePerSecond / 1e9;\n        this.tokens = capacity;\n        this.lastRefillTime = System.nanoTime();\n    }\n\n    // BUG: Synchronized keyword creates severe lock contention and thread parking across cores\n    public synchronized boolean tryConsume(int requested) {\n        long now = System.nanoTime();\n        double elapsed = now - lastRefillTime;\n        tokens = Math.min(capacity, tokens + elapsed * refillRatePerNano);\n        lastRefillTime = now;\n        if (tokens >= requested) {\n            tokens -= requested;\n            return True;\n        }\n        return false;\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 15,
                "description": "Coarse synchronized method serializes all worker threads, generating massive CPU cache line invalidations.",
                "bug_pattern": "COARSE_LOCK_CONTENTION"
            },
            "correct_fix_diff": "- public synchronized boolean tryConsume(int requested) {\n+ // Use AtomicReference with optimistic CAS loop or Striped64\n+ public boolean tryConsume(int requested) {\n+     while (True) {\n+         BucketState current = stateRef.get();\n+         BucketState next = calculateRefill(current, requested);\n+         if (stateRef.compareAndSet(current, next)) return next.isAllowed();\n+     }\n+ }",
            "ast_rule_invariants": ["no-synchronized-in-highload-path"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "ingress", "type": "api_gateway", "title": "API Gateway", "grid_position": {"col": 0, "row": 0}, "params": {"threads": 64}},
                    {"id": "limiter_service", "type": "app_service", "title": "Rate Limiter Filter", "grid_position": {"col": 1, "row": 0}, "params": {"algorithm": "CAS_LOCK_FREE", "capacity": 10000}}
                ],
                "edges": [
                    {"id": "e1", "source": "ingress", "target": "limiter_service", "protocol": "http_rest"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 2.0,
                "availability_target_nines": 99.99,
                "monthly_budget_max_usd": 500.0
            },
            "traffic_profile": {
                "pattern": "POISSON",
                "lambda_mean_rps": 25000.0,
                "inter_arrival_cv": 0.4,
                "read_ratio": 1.0
            },
            "invariants": [
                {
                    "id": "inv_limiter_overhead",
                    "description": "Limiter overhead at P99 must not exceed 2ms under 25k RPS.",
                    "severity": "ERROR",
                    "category": "PERFORMANCE_SLO",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {"expression": "simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Explain how MESI cache coherence protocol handles write invalidations when 64 CPU cores attempt to update a single AtomicLong counter simultaneously.",
                "stage_2_tightening": "If 100,000 requests/sec arrive and the CAS loop repeatedly fails due to high contention, what latency degradation occurs?",
                "stage_3_adversarial": "How does clock drift or an NTP step adjustment affect System.nanoTime() vs System.currentTimeMillis() in rate limiting?",
                "stage_4_squeeze": "We must distribute this rate limiter across 10 independent Kubernetes pods without centralized Redis to avoid network latency. How do you design local token quotas?"
            },
            "counter_probes": [
                {
                    "buzzword": "put it in redis",
                    "trigger_regex": "(?i)put.*in.*redis|use.*redis.*limiter",
                    "counter_question": "Each Redis call over the network introduces at least 0.5ms to 1.5ms of round-trip latency. If your total request SLA is 2ms, how can you afford a network round-trip for every single check?",
                    "expected_staff_answer": "Local in-memory token buckets with periodic asynchronous batch synchronization or token leasing from Redis should be used to avoid synchronous network overhead per request."
                }
            ]
        }
    },
    {
        "category_dir": "l3_junior",
        "canonical_id": "L3-NET-NGINX-BUFFERING",
        "legacy_aliases": ["hld-micro-05", "kata-05-lru-cache", "nginx-buffering"],
        "version": "1.0.0",
        "target_level": "L3_JUNIOR",
        "archetype": "NETWORK_INFRASTRUCTURE",
        "title": "Nginx Reverse Proxy Buffer Overflow and Upstream Load Shedding",
        "subtitle": "Client Body Buffer Tuning, Disk Spooling Penalties and Zero-Copy TCP Optimization",
        "problem_statement": "An API Gateway using Nginx in front of Python/Java microservices handles 2,000 RPS. When mobile clients on slow 3G connections request 2MB JSON reports, upstream app server workers remain blocked for 15+ seconds per client because proxy buffering was disabled to 'save memory', exhausting application worker threads.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "nginx",
            "source_files": [
                {
                    "path": "nginx/conf.d/gateway.conf",
                    "content": "upstream app_backend {\n    server 127.0.0.1:8080 max_fails=3 fail_timeout=10s;\n    keepalive 32;\n}\n\nserver {\n    listen 80;\n    server_name api.platform.com;\n\n    location /api/ {\n        proxy_pass http://app_backend;\n        \n        # BUG: Disabling proxy buffering forces upstream app servers to hold threads for slow clients\n        proxy_buffering off;\n        proxy_read_timeout 60s;\n        proxy_send_timeout 60s;\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 15,
                "description": "proxy_buffering off causes upstream app workers to be tied to client transmission speed (Slowloris effect).",
                "bug_pattern": "NGINX_BUFFERING_DISABLED_STARVATION"
            },
            "correct_fix_diff": "- proxy_buffering off;\n+ proxy_buffering on;\n+ proxy_buffer_size 16k;\n+ proxy_buffers 8 64k;\n+ proxy_busy_buffers_size 128k;\n+ proxy_max_temp_file_size 0; -- Avoid SSD write thrashing if RAM permits",
            "ast_rule_invariants": ["enforce-proxy-buffering-for-slow-clients"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "clients", "type": "dns", "title": "Global Mobile Clients", "grid_position": {"col": 0, "row": 0}, "params": {"slow_client_ratio": 0.4}},
                    {"id": "nginx", "type": "load_balancer", "title": "Nginx Edge Proxy", "grid_position": {"col": 1, "row": 0}, "params": {"proxy_buffering": True, "worker_connections": 10240}},
                    {"id": "app_upstream", "type": "app_service", "title": "App Server Pool", "grid_position": {"col": 2, "row": 0}, "params": {"max_workers": 64}}
                ],
                "edges": [
                    {"id": "e1", "source": "clients", "target": "nginx", "protocol": "tcp_socket"},
                    {"id": "e2", "source": "nginx", "target": "app_upstream", "protocol": "http_rest"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 40.0,
                "availability_target_nines": 99.9,
                "monthly_budget_max_usd": 800.0
            },
            "traffic_profile": {
                "pattern": "POISSON",
                "lambda_mean_rps": 2000.0,
                "inter_arrival_cv": 0.9,
                "read_ratio": 0.9
            },
            "invariants": [
                {
                    "id": "inv_upstream_worker_saturation",
                    "description": "Upstream application workers must not exceed 80% saturation due to slow client reads.",
                    "severity": "ERROR",
                    "category": "PERFORMANCE_SLO",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {"expression": "simulation.is_stable == True && simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Explain how epoll in Nginx decouples client socket reads from upstream keepalive TCP connections.",
                "stage_2_tightening": "If proxy_buffering is ON and the response size is 50MB, what does Nginx do when proxy_buffers are filled? What is the impact on NVMe drive lifespan?",
                "stage_3_adversarial": "An attacker sends HTTP POST requests with Content-Length 1000000 at 1 byte every 10 seconds. How does your reverse proxy protect the upstream services?",
                "stage_4_squeeze": "How do you configure zero-copy transfer (`sendfile` and `tcp_nopush`) for static assets to bypass user-space memory copies?"
            },
            "counter_probes": [
                {
                    "buzzword": "just scale pods",
                    "trigger_regex": "(?i)scale.*(pods|containers|instances)",
                    "counter_question": "If the issue is slow TCP window draining by client cellular networks, scaling upstream app pods costs $5,000/month in idle JVMs. Why not let Nginx buffer the payload in RAM in 2ms?",
                    "expected_staff_answer": "Proxy buffering allows the upstream application to complete in 2ms and return to the pool, while Nginx handles the slow 10-second client drain with negligible kernel memory."
                }
            ]
        }
    },

    # =========================================================================
    # TIER 2: MIDDLE (L4) COMPOSED DISTRIBUTED SYSTEMS SCENARIOS (B2)
    # =========================================================================
    {
        "category_dir": "l4_middle",
        "canonical_id": "L4-DIST-SNOWFLAKE-NTP",
        "legacy_aliases": ["hld-micro-06", "kata-06-bloom-filter", "snowflake-ntp"],
        "version": "1.0.0",
        "target_level": "L4_MIDDLE",
        "archetype": "DISTRIBUTED_ALGORITHMS",
        "title": "Distributed Unique ID Generator with NTP Clock Rollback Protection",
        "subtitle": "Twitter Snowflake Bit-Packing, Leap Seconds and Clock Backward Drift Mitigation",
        "problem_statement": "A distributed ID generator service produces 64-bit monotonically increasing identifiers across 32 nodes. During an NTP synchronization step-jump, the physical clock on node 14 rolls backward by 180 milliseconds. The service continues generating IDs, leading to duplicate primary keys and corrupted transactional ledgers.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/snowflake/SnowflakeIdGenerator.java",
                    "content": "public class SnowflakeIdGenerator {\n    private final long workerId;\n    private long sequence = 0L;\n    private long lastTimestamp = -1L;\n\n    public SnowflakeIdGenerator(long workerId) {\n        this.workerId = workerId;\n    }\n\n    public synchronized long nextId() {\n        long timestamp = System.currentTimeMillis();\n        \n        // BUG: Inadequate clock rollback handling. Throws runtime exception or generates duplicate if ignored\n        if (timestamp < lastTimestamp) {\n            throw new RuntimeException(\"Clock moved backwards! Refusing to generate id for \" + (lastTimestamp - timestamp) + \"ms\");\n        }\n\n        if (lastTimestamp == timestamp) {\n            sequence = (sequence + 1) & 4095;\n            if (sequence == 0) {\n                timestamp = tilNextMillis(lastTimestamp);\n            }\n        } else {\n            sequence = 0L;\n        }\n        lastTimestamp = timestamp;\n        return ((timestamp - 1288834974657L) << 22) | (workerId << 12) | sequence;\n    }\n\n    private long tilNextMillis(long lastTimestamp) {\n        long timestamp = System.currentTimeMillis();\n        while (timestamp <= lastTimestamp) {\n            timestamp = System.currentTimeMillis();\n        }\n        return timestamp;\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 13,
                "description": "Throwing an exception upon NTP clock rollback crashes the worker node rather than slewing or borrowing sequence tokens.",
                "bug_pattern": "CLOCK_ROLLBACK_CRASH"
            },
            "correct_fix_diff": "- if (timestamp < lastTimestamp) {\n-     throw new RuntimeException(...);\n+ long offset = lastTimestamp - timestamp;\n+ if (offset <= 5) { // Small drift: spin-wait\n+     timestamp = tilNextMillis(lastTimestamp);\n+ } else { // Borrow sequence or switch to fallback logical counter\n+     timestamp = handleBackwardClockDrift(lastTimestamp, offset);\n+ }",
            "ast_rule_invariants": ["enforce-monotonic-time-source"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "lb", "type": "load_balancer", "title": "Load Balancer", "grid_position": {"col": 0, "row": 0}, "params": {"algorithm": "round_robin"}},
                    {"id": "snowflake_node_1", "type": "worker_pool", "title": "Snowflake Node 1", "grid_position": {"col": 1, "row": 0}, "params": {"worker_id": 1, "ntp_slew": True}},
                    {"id": "snowflake_node_2", "type": "worker_pool", "title": "Snowflake Node 2", "grid_position": {"col": 1, "row": 1}, "params": {"worker_id": 2, "ntp_slew": True}},
                    {"id": "storage", "type": "rdbms_primary", "title": "Database Consumer", "grid_position": {"col": 2, "row": 0}, "params": {"require_unique_pk": True}}
                ],
                "edges": [
                    {"id": "e1", "source": "lb", "target": "snowflake_node_1", "protocol": "http_rest"},
                    {"id": "e2", "source": "lb", "target": "snowflake_node_2", "protocol": "http_rest"},
                    {"id": "e3", "source": "snowflake_node_1", "target": "storage", "protocol": "db_protocol"},
                    {"id": "e4", "source": "snowflake_node_2", "target": "storage", "protocol": "db_protocol"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 1.0,
                "availability_target_nines": 99.999,
                "monthly_budget_max_usd": 600.0
            },
            "traffic_profile": {
                "pattern": "POISSON",
                "lambda_mean_rps": 50000.0,
                "inter_arrival_cv": 0.3,
                "read_ratio": 1.0
            },
            "invariants": [
                {
                    "id": "inv_unique_ids",
                    "description": "Zero duplicate IDs must be generated even during physical clock rollbacks.",
                    "severity": "ERROR",
                    "category": "FAULT_TOLERANCE",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {"expression": "simulation.is_stable == True && simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Explain the 64-bit layout of a Snowflake ID: timestamp bits, datacenter/worker bits, and sequence bits. Why is 4096 sequence numbers per millisecond sufficient?",
                "stage_2_tightening": "During VM live migration in AWS/GCP, physical clocks can jump backwards by 200ms. If you spin-wait for 200ms on every thread, what happens to P99 latency and incoming TCP backlogs?",
                "stage_3_adversarial": "Two worker nodes are accidentally assigned the same `worker_id` by Kubernetes during a split-brain deployment. How do you detect and prevent collision?",
                "stage_4_squeeze": "Why not use UUIDv7 instead of maintaining a custom Snowflake cluster? Compare 128-bit index fragmentation in B-Trees with 64-bit Snowflake IDs."
            },
            "counter_probes": [
                {
                    "buzzword": "UUIDv4",
                    "trigger_regex": "(?i)use.*uuid|uuidv4",
                    "counter_question": "UUIDv4 is 128-bit and randomly distributed. What happens to database B-Tree index cache hit rate and page split frequency when inserting 1 billion rows with random UUIDs?",
                    "expected_staff_answer": "Random UUIDs cause massive random I/O and B-Tree page splits because new rows do not append to the right edge. 64-bit monotonically increasing Snowflake IDs append sequentially with 99%+ page fill factor."
                }
            ]
        }
    },
    {
        "category_dir": "l4_middle",
        "canonical_id": "L4-DIST-IDEMPOTENT-OUTBOX",
        "legacy_aliases": ["hld-micro-07", "kata-07-token-bucket", "idempotent-outbox", "incident-01-payment-deadlock"],
        "version": "1.0.0",
        "target_level": "L4_MIDDLE",
        "archetype": "DISTRIBUTED_TRANSACTIONS",
        "title": "Idempotent Payment Processing with Transactional Outbox Pattern",
        "subtitle": "Dual-Write Elimination, CDC Log Tailing via Debezium & Consumer Deduplication",
        "problem_statement": "An e-commerce order checkout service updates the order status in PostgreSQL and immediately makes an HTTP call to Stripe, followed by publishing an event to Kafka. When the application container is terminated by an OOM-killer between the database commit and Kafka publish, the order is marked paid but fulfillment events are lost forever.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/payment/CheckoutService.java",
                    "content": "@Service\npublic class CheckoutService {\n    @Autowired private OrderRepository orderRepo;\n    @Autowired private KafkaTemplate<String, OrderPaidEvent> kafka;\n\n    @Transactional\n    public void completeCheckout(String orderId) {\n        Order order = orderRepo.findById(orderId).orElseThrow();\n        order.setStatus(\"PAID\");\n        orderRepo.save(order);\n\n        // BUG: Dual-write hazard. If network fails or JVM dies right here, Kafka event is lost\n        kafka.send(\"order-paid-topic\", new OrderPaidEvent(orderId, order.getAmount()));\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 13,
                "description": "Publishing to Kafka inside or immediately after a relational transaction without an outbox table violates dual-write consistency.",
                "bug_pattern": "DUAL_WRITE_NON_ATOMIC"
            },
            "correct_fix_diff": "- kafka.send(\"order-paid-topic\", new OrderPaidEvent(...));\n+ // Persist outbox event in the same ACID transaction\n+ outboxRepo.save(new OutboxEvent(\"ORDER_PAID\", orderId, payload));\n+ // Debezium CDC or background transactional publisher picks it up",
            "ast_rule_invariants": ["no-direct-external-publish-in-transactional"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "gateway", "type": "api_gateway", "title": "Payment Ingress", "grid_position": {"col": 0, "row": 0}, "params": {"idempotency_enforced": True}},
                    {"id": "order_svc", "type": "app_service", "title": "Checkout Service", "grid_position": {"col": 1, "row": 0}, "params": {"outbox_pattern": True}},
                    {"id": "order_db", "type": "rdbms_primary", "title": "PostgreSQL (Orders + Outbox)", "grid_position": {"col": 2, "row": 0}, "params": {"cdc_enabled": True}},
                    {"id": "kafka", "type": "kafka_topic", "title": "Kafka: order-events", "grid_position": {"col": 3, "row": 0}, "params": {"partitions": 8, "replication_factor": 3}}
                ],
                "edges": [
                    {"id": "e1", "source": "gateway", "target": "order_svc", "protocol": "http_rest"},
                    {"id": "e2", "source": "order_svc", "target": "order_db", "protocol": "db_protocol"},
                    {"id": "e3", "source": "order_db", "target": "kafka", "protocol": "async_event"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 35.0,
                "availability_target_nines": 99.99,
                "monthly_budget_max_usd": 2500.0
            },
            "traffic_profile": {
                "pattern": "POISSON",
                "lambda_mean_rps": 800.0,
                "inter_arrival_cv": 0.7,
                "read_ratio": 0.1
            },
            "invariants": [
                {
                    "id": "inv_zero_dual_write",
                    "description": "Direct async event publish from app service to Kafka without outbox table is strictly forbidden.",
                    "severity": "ERROR",
                    "category": "FAULT_TOLERANCE",
                    "rule_type": "NO_DIRECT_ACCESS",
                    "config": {"from_type": "app_service", "to_type": "kafka_topic"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "What is the dual-write problem? Why cannot 2-Phase Commit (2PC) between PostgreSQL and Kafka solve it in high-throughput cloud environments?",
                "stage_2_tightening": "If you use a polling worker on the outbox table (`SELECT * FROM outbox WHERE sent = false FOR UPDATE SKIP LOCKED`), what is the polling delay and database CPU overhead at 5,000 writes/sec?",
                "stage_3_adversarial": "Kafka consumers receive the same `OrderPaid` event twice due to a network re-transmit. How does the downstream Inventory Service prevent double decrementing stock?",
                "stage_4_squeeze": "Outbox table accumulates 50 million processed records per week. Design a zero-downtime partitioning and pruning strategy that prevents table bloat."
            },
            "counter_probes": [
                {
                    "buzzword": "two-phase commit",
                    "trigger_regex": "(?i)2pc|two.*phase.*commit|xa.*transaction",
                    "counter_question": "XA transactions require all participants to hold locks while waiting for coordinator confirmation. What happens to database transaction latency when network latency fluctuates across cloud availability zones?",
                    "expected_staff_answer": "XA/2PC is blocking and introduces catastrophic latency amplification and lock contention. The Transactional Outbox pattern with eventual consistency and consumer idempotency is the industry standard."
                }
            ]
        }
    },
    {
        "category_dir": "l4_middle",
        "canonical_id": "L4-DIST-KAFKA-REBALANCE-LAG",
        "legacy_aliases": ["hld-micro-08", "kata-08-saga-orchestration", "kafka-rebalance-lag"],
        "version": "1.0.0",
        "target_level": "L4_MIDDLE",
        "archetype": "MESSAGING_STREAMING",
        "title": "Kafka Consumer Group Rebalance Lag & Static Membership",
        "subtitle": "Tuning Cooperative Sticky Assignors, Heartbeat Threads and max.poll.interval.ms",
        "problem_statement": "A telemetry processing pipeline consumes from 64 Kafka partitions using 16 worker pods. During a garbage collection pause of 35 seconds or slow database batch inserts, the consumer exceeds max.poll.interval.ms. The Kafka group coordinator considers the consumer dead and triggers an eager Stop-The-World rebalance, halting all 16 workers and compounding consumer lag exponentially.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/kafka/TelemetryConsumer.java",
                    "content": "@Component\npublic class TelemetryConsumer {\n    @Autowired private DatabaseService db;\n\n    @KafkaListener(topics = \"telemetry-events\", groupId = \"telemetry-processor\")\n    public void listen(List<ConsumerRecord<String, byte[]>> records, Acknowledgment ack) {\n        // BUG: Heavy synchronous database write inside poll loop blocks the consumer thread,\n        // causing max.poll.interval.ms (default 300s) to be exceeded during spikes\n        for (ConsumerRecord<String, byte[]> r : records) {\n            db.heavyPersist(r.value());\n        }\n        ack.acknowledge();\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 9,
                "description": "Synchronous record-by-record processing inside poll loop risks exceeding max.poll.interval.ms and triggering consumer rebalance.",
                "bug_pattern": "CONSUMER_HEAVY_PROCESSING_BLOCK"
            },
            "correct_fix_diff": "- for (ConsumerRecord<String, byte[]> r : records) {\n-     db.heavyPersist(r.value());\n+ // Batch insert and offload heavy processing to bounded worker pool\n+ db.batchPersistAsync(records).thenRun(ack::acknowledge);\n+ // Configure partition.assignment.strategy = CooperativeStickyAssignor\n+ // Configure group.instance.id for static membership",
            "ast_rule_invariants": ["no-synchronous-io-in-kafka-poll-thread"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "kafka", "type": "kafka_topic", "title": "Kafka Telemetry Topic", "grid_position": {"col": 0, "row": 0}, "params": {"partitions": 64, "producers_rps": 12000}},
                    {"id": "consumer_group", "type": "worker_pool", "title": "Consumer Group (16 Pods)", "grid_position": {"col": 1, "row": 0}, "params": {"assignor": "CooperativeSticky", "static_membership": True}},
                    {"id": "storage", "type": "lsm_key_value", "title": "Cassandra / ScyllaDB", "grid_position": {"col": 2, "row": 0}, "params": {"batch_write_rps": 15000}}
                ],
                "edges": [
                    {"id": "e1", "source": "kafka", "target": "consumer_group", "protocol": "async_event"},
                    {"id": "e2", "source": "consumer_group", "target": "storage", "protocol": "db_protocol"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 250.0,
                "availability_target_nines": 99.9,
                "monthly_budget_max_usd": 3000.0
            },
            "traffic_profile": {
                "pattern": "BURSTY",
                "lambda_mean_rps": 12000.0,
                "inter_arrival_cv": 1.2,
                "read_ratio": 0.0
            },
            "invariants": [
                {
                    "id": "inv_consumer_lag_bound",
                    "description": "Consumer lag must remain bounded without triggering stop-the-world eager rebalances.",
                    "severity": "ERROR",
                    "category": "PERFORMANCE_SLO",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {"expression": "simulation.is_stable == true"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Explain the difference between heartbeat thread (`session.timeout.ms`) and the polling thread (`max.poll.interval.ms`) in Kafka Consumer architecture.",
                "stage_2_tightening": "During rolling deployments in Kubernetes, 16 pods are restarted one by one. With default Eager Assignor, how many rebalances occur and what is the cumulative downtime?",
                "stage_3_adversarial": "A poison pill message causes consumer thread to crash repeatedly. How do you isolate this message to a Dead Letter Queue (DLQ) without losing partition ordering?",
                "stage_4_squeeze": "Network egress costs between Kafka brokers and consumers across AWS Availability Zones cost $10,000/month. How do you optimize partition rack awareness?"
            },
            "counter_probes": [
                {
                    "buzzword": "increase session timeout",
                    "trigger_regex": "(?i)increase.*(session.*timeout|poll.*interval)",
                    "counter_question": "If you increase `max.poll.interval.ms` to 30 minutes, what happens when a consumer node genuinely dies due to hardware power loss? How long does that partition sit unconsumed?",
                    "expected_staff_answer": "Increasing timeout delays failure detection of real dead nodes. The correct solution is static membership (group.instance.id) and offloading processing to bounded worker pools while keeping poll() loop active."
                }
            ]
        }
    },
    {
        "category_dir": "l4_middle",
        "canonical_id": "L4-DIST-LOCK-FENCING",
        "legacy_aliases": ["hld-faded-01", "faded-checkout", "lock-fencing-tokens"],
        "version": "1.0.0",
        "target_level": "L4_MIDDLE",
        "archetype": "DISTRIBUTED_CONSENSUS",
        "title": "Distributed Lock with Fencing Tokens vs Redlock Split-Brain",
        "subtitle": "Preventing Stale Writes under Asynchronous Network Delays and Stop-The-World GC",
        "problem_statement": "A distributed file processing system uses Redis distributed locks (Redlock algorithm with 10-second TTL) to ensure only one worker modifies a shared S3 object at a time. Worker A acquires the lock, but encounters a 15-second full GC pause. The lock expires in Redis and is acquired by Worker B. Worker A wakes up and writes its stale buffer to S3, overwriting Worker B's fresh updates.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/storage/ExclusiveFileUpdater.java",
                    "content": "@Service\npublic class ExclusiveFileUpdater {\n    @Autowired private RedissonClient redisson;\n    @Autowired private S3Client s3;\n\n    public void updateFile(String key, byte[] content) {\n        RLock lock = redisson.getLock(\"lock:\" + key);\n        lock.lock(10, TimeUnit.SECONDS);\n        try {\n            // BUG: Long GC pause or slow I/O can outlive the 10-second lock TTL\n            // No fencing token is sent to S3 to validate ownership\n            s3.putObject(PutObjectRequest.builder().bucket(\"data\").key(key).build(), RequestBody.fromBytes(content));\n        } finally {\n            if (lock.isHeldByCurrentThread()) {\n                lock.unlock();\n            }\n        }\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 11,
                "description": "Mutating shared external storage using leased lock without monotonically increasing fencing token.",
                "bug_pattern": "LEASE_EXPIRATION_RACE"
            },
            "correct_fix_diff": "- s3.putObject(...);\n+ // Acquire monotonically increasing fencing token from consensus store (Zookeeper/etcd)\n+ long fencingToken = lockService.acquireFencingToken(key);\n+ s3.putObject(b -> b.metadata(Map.of(\"fencing-token\", String.valueOf(fencingToken))));",
            "ast_rule_invariants": ["enforce-fencing-tokens-on-distributed-locks"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "worker_1", "type": "worker_pool", "title": "Worker Pod 1 (GC Pause)", "grid_position": {"col": 0, "row": 0}, "params": {"gc_pause_ms": 15000}},
                    {"id": "worker_2", "type": "worker_pool", "title": "Worker Pod 2", "grid_position": {"col": 0, "row": 1}, "params": {"gc_pause_ms": 0}},
                    {"id": "lock_mgr", "type": "redis_cache", "title": "Redis Lock Manager", "grid_position": {"col": 1, "row": 0}, "params": {"ttl_ms": 10000}},
                    {"id": "s3_storage", "type": "object_storage_s3", "title": "S3 Storage (Fencing Guarded)", "grid_position": {"col": 2, "row": 0}, "params": {"versioning": True}}
                ],
                "edges": [
                    {"id": "e1", "source": "worker_1", "target": "lock_mgr", "protocol": "tcp_socket"},
                    {"id": "e2", "source": "worker_2", "target": "lock_mgr", "protocol": "tcp_socket"},
                    {"id": "e3", "source": "worker_1", "target": "s3_storage", "protocol": "http_rest"},
                    {"id": "e4", "source": "worker_2", "target": "s3_storage", "protocol": "http_rest"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 50.0,
                "availability_target_nines": 99.99,
                "monthly_budget_max_usd": 1500.0
            },
            "traffic_profile": {
                "pattern": "BURSTY",
                "lambda_mean_rps": 500.0,
                "inter_arrival_cv": 1.0,
                "read_ratio": 0.5
            },
            "invariants": [
                {
                    "id": "inv_linearizable_updates",
                    "description": "Zero stale writes allowed: storage must reject writes with smaller fencing tokens than last committed.",
                    "severity": "ERROR",
                    "category": "FAULT_TOLERANCE",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {"expression": "simulation.is_stable == true"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Explain Martin Kleppmann's critique of the Redlock algorithm. Under what physical assumptions regarding clocks and network delays does Redlock fail?",
                "stage_2_tightening": "What is a fencing token? How does the storage engine enforce that Client A's write with token 33 is rejected after Client B wrote with token 34?",
                "stage_3_adversarial": "If the storage engine (e.g. standard file system) does NOT natively support atomic check-and-set or version precondition checks, how can you guarantee mutual exclusion?",
                "stage_4_squeeze": "Why not use an active-active transactional consensus database (CockroachDB / Spanner) instead of maintaining distributed locks?"
            },
            "counter_probes": [
                {
                    "buzzword": "redlock",
                    "trigger_regex": "(?i)redlock|redis.*quorum",
                    "counter_question": "Redlock relies on physical time elapsed across multiple Redis nodes. If one node's physical clock drifts forwards due to NTP jumps, can two clients hold the lock simultaneously?",
                    "expected_staff_answer": "Yes. Redlock depends on physical time assumptions. Without monotonic fencing tokens validated by the resource server, no asynchronous lock algorithm can guarantee safety under GC pauses."
                }
            ]
        }
    },
    {
        "category_dir": "l4_middle",
        "canonical_id": "L4-DIST-SOCIAL-FEED-FANOUT",
        "legacy_aliases": ["hld-faded-02", "faded-auction", "social-feed-fanout"],
        "version": "1.0.0",
        "target_level": "L4_MIDDLE",
        "archetype": "DATA_PARTITIONING",
        "title": "Read-Heavy Social Feed with Hot Partition Fan-Out",
        "subtitle": "Hybrid Fan-out-on-Write vs Fan-out-on-Read with Celebrity Partitioning",
        "problem_statement": "A social network platform with 100 million users generates user timelines. The system uses a pure Fan-Out-On-Write (push) model where every new post is copied into all followers' timeline lists in Redis. When a celebrity account with 40 million followers posts, the write pipeline spikes by 40 million insert operations, exhausting Redis memory and lagging normal users' feeds by 45 minutes.",
        "pedagogical_mode": "FADED_COMPLETION",
        "studio_1_runtime": {
            "language": "java21",
            "source_files": [
                {
                    "path": "src/main/java/com/platform/feed/FeedFanoutService.java",
                    "content": "@Service\npublic class FeedFanoutService {\n    @Autowired private FollowerRepository followerRepo;\n    @Autowired private RedisTemplate<String, String> redis;\n\n    public void fanoutPost(String authorId, String postId) {\n        // BUG: Pure fanout-on-write attempts to insert into millions of user lists synchronously\n        List<String> followerIds = followerRepo.findFollowerIds(authorId);\n        for (String followerId : followerIds) {\n            redis.opsForList().leftPush(\"feed:\" + followerId, postId);\n            redis.opsForList().trim(\"feed:\" + followerId, 0, 800);\n        }\n    }\n}",
                    "is_editable": True
                }
            ],
            "faded_bug": {
                "line_number": 8,
                "description": "Unconditional push fan-out for accounts with millions of followers creates massive write amplification and Redis starvation.",
                "bug_pattern": "CELEBRITY_FANOUT_WRITE_AMPLIFICATION"
            },
            "correct_fix_diff": "- List<String> followerIds = followerRepo.findFollowerIds(authorId);\n- for (String followerId : followerIds) { ... }\n+ // Hybrid model: if followers > 25,000, mark as Celebrity and fan-out on READ\n+ if (followerCount > CELEBRITY_THRESHOLD) {\n+     celebrityPostRepo.save(authorId, postId);\n+ } else {\n+     asyncWorkerPool.fanoutToFollowers(followerIds, postId);\n+ }",
            "ast_rule_invariants": ["no-unbounded-loop-in-transaction"]
        },
        "studio_2_simulation": {
            "topology": {
                "nodes": [
                    {"id": "ingress", "type": "api_gateway", "title": "API Gateway", "grid_position": {"col": 0, "row": 0}, "params": {"rate_limit_rps": 30000}},
                    {"id": "feed_svc", "type": "app_service", "title": "Hybrid Feed Engine", "grid_position": {"col": 1, "row": 0}, "params": {"celebrity_threshold": 25000}},
                    {"id": "redis_cluster", "type": "redis_cache", "title": "Timeline Redis Shards", "grid_position": {"col": 2, "row": 0}, "params": {"shards": 8, "max_memory_gb": 64}},
                    {"id": "post_store", "type": "nosql_document", "title": "Cassandra Posts Table", "grid_position": {"col": 2, "row": 1}, "params": {"read_repair": False}}
                ],
                "edges": [
                    {"id": "e1", "source": "ingress", "target": "feed_svc", "protocol": "http_rest"},
                    {"id": "e2", "source": "feed_svc", "target": "redis_cluster", "protocol": "tcp_socket"},
                    {"id": "e3", "source": "feed_svc", "target": "post_store", "protocol": "db_protocol"}
                ]
            },
            "slos": {
                "p99_latency_max_ms": 30.0,
                "availability_target_nines": 99.95,
                "monthly_budget_max_usd": 4000.0
            },
            "traffic_profile": {
                "pattern": "BURSTY",
                "lambda_mean_rps": 20000.0,
                "inter_arrival_cv": 1.4,
                "read_ratio": 0.98
            },
            "invariants": [
                {
                    "id": "inv_feed_p99_latency",
                    "description": "Feed retrieval P99 latency must not exceed 30ms even during celebrity post publish.",
                    "severity": "ERROR",
                    "category": "PERFORMANCE_SLO",
                    "rule_type": "CEL_EXPRESSION",
                    "config": {"expression": "simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms"}
                }
            ]
        },
        "studio_3_bar_raiser": {
            "probing_ladder": {
                "stage_1_validation": "Compare Fan-Out-On-Write (push) vs Fan-Out-On-Read (pull) models in terms of write latency, storage cost, and timeline assembly time.",
                "stage_2_tightening": "How does your hybrid engine merge a user's pre-computed Redis inbox with 15 followed celebrity timelines at request time in less than 20ms?",
                "stage_3_adversarial": "A user follows 2,000 celebrities. During a major sporting event, all 2,000 celebrities post concurrently. How do you prevent K-way merge degradation?",
                "stage_4_squeeze": "Inactive users (who haven't opened the app in 30 days) consume 80% of your Redis RAM in pre-computed feeds. Design a timeline eviction and cold-storage hydration tier."
            },
            "counter_probes": [
                {
                    "buzzword": "fan-out on write",
                    "trigger_regex": "(?i)fan.*out.*on.*write|push.*model.*only",
                    "counter_question": "When an account with 50M followers posts, you must execute 50M write operations. At 100,000 writes/sec, that takes 500 seconds. How do you explain an 8-minute delay for followers?",
                    "expected_staff_answer": "Push-only model collapses on asymmetric follow graphs. A hybrid architecture that treats accounts with >25k followers as pull-based and executes an in-memory merge at read time is mandatory."
                }
            ]
        }
    }
]

# Write JSON files for L3 and L4
for m in manifests:
    cat_dir = m.pop("category_dir")
    file_path = os.path.join(MANIFESTS_DIR, cat_dir, f"{m['canonical_id']}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
    print(f"✅ Generated {cat_dir}/{m['canonical_id']}.json")

print(f"Total Tier 1 & Tier 2 generated: {len(manifests)}")
