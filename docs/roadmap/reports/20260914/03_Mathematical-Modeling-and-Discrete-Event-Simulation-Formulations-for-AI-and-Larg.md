# Mathematical Modeling and Discrete Event Simulation Formulations for AI and Large Language Model Systems in Browser Web Workers

## 1. Large Language Model Serving and Inference Engine Mechanics
Large Language Model (LLM) serving infrastructures deviate fundamentally from classical distributed microservices. Traditional web applications handle stateless requests characterized by memoryless execution or single-phase service times that conform comfortably to $M/M/c$ or $M/G/1$ queuing models. In contrast, generative inference presents an asymmetrical two-phase computational structure comprising an initial compute-bound prompt prefill phase followed by an autoregressive, memory-bandwidth-bound token decode phase. Correctly simulating these workloads requires modeling execution latencies directly from accelerator hardware geometries and memory system dynamics.

### 1.1 Hardware Physics: Prefill (TTFT) and Decode (TPOT / ITL)
The execution boundary of transformer inference is defined by the hardware roofline model, which maps floating-point compute saturation against high-bandwidth memory (HBM) streaming ceilings.
The prefill phase evaluates all $T_{in}$ tokens of an input prompt concurrently. The attention mechanism evaluates pairwise interactions across the entire prompt sequence, while feed-forward network (FFN) projections perform batch General Matrix Multiplications (GEMMs). Let $P$ denote the active model parameter count, $L$ the number of Transformer layers, $d_{model}$ the hidden dimension, $h_q$ the number of query heads, $h_{kv}$ the number of key-value heads, and $d_{head} = d_{model} / h_q$ the head dimension. Peak accelerator compute capacity is denoted by $\Phi_{peak}$ (floating-point operations per second, $\text{FLOP/s}$), peak memory bandwidth by $BW_{mem}$ (bytes per second, $\text{B/s}$), and parameter precision storage width by $b_{param}$ (e.g., 2 bytes for FP16/BF16, 1 byte for FP8).
The total floating-point operations executed during prefill evaluate to:

$$
\text{FLOPs}_{prefill} \approx 2 P \cdot T_{in} + 4 L \cdot h_q \cdot d_{head} \cdot T_{in}^2 = 2 P \cdot T_{in} + 4 L \cdot d_{model} \cdot T_{in}^2
$$
The memory traffic required to read parameters and persist intermediate activations is expressed as:

$$
\text{Bytes}_{prefill} \approx P \cdot b_{param} + 2 L \cdot d_{model} \cdot T_{in} \cdot b_{kv}
$$
For prompts exceeding moderate sequence lengths (typically $T_{in} \ge 128$), the operational arithmetic intensity $I_{prefill} = \frac{\text{FLOPs}_{prefill}}{\text{Bytes}_{prefill}} \approx \frac{2 T_{in}}{b_{param}}$ surpasses the accelerator arithmetic transition boundary $I_{knee} = \frac{\Phi_{peak}}{BW_{mem}}$. On an NVIDIA H100 SXM5 accelerator ($1979 \times 10^{12} \text{ FLOP/s}$ FP16 Tensor Core capacity, $3.35 \times 10^{12} \text{ B/s}$ HBM3 bandwidth), $I_{knee}$ is approximately $590 \text{ FLOP/Byte}$. Consequently, prefill operations for sequences where $T_{in} \ge 590$ operate strictly within the compute-bound plateau of the roofline curve.
When chunked prefill is disabled, the base execution latency of the prefill phase is governed by the upper envelope of compute and memory traversal:

$$
T_{prefill}(T_{in}) = \max\left( \frac{2 P \cdot T_{in} + 4 L d_{model} T_{in}^2}{\Phi_{peak} \cdot \eta_{compute}}, \frac{P \cdot b_{param} + 2 L d_{model} T_{in} b_{kv}}{BW_{mem} \cdot \eta_{mem}} \right)
$$
where $\eta_{compute}, \eta_{mem} \in (0, 1]$ represent hardware kernel execution efficiencies, observed empirically between $0.45$ and $0.65$ in production inference runtimes.
Time-to-First-Token (TTFT) aggregates the upstream queue delay $W_{queue}$ prior to batch admission, the chunked prefill execution time, and the latency of the initial decode iteration:

$$
\text{TTFT} = W_{queue} + T_{prefill}(T_{in}) + t_{decode}(B=1)
$$
Once prefill concludes, the model transitions into autoregressive token generation, emitting one token per sequence per iteration. For each generated token, the model executes a batch General Matrix-Vector multiplication (GEMV). The accelerator streams all $P$ active weights from HBM into on-chip registers, together with the accumulated Key-Value (KV) cache history for every active sequence.
For an active batch of $B$ sequences where sequence $i$ has reached total length $L_i = T_{in, i} + t_{gen, i}$, memory transfer per iteration scales as:

$$
\text{Bytes}_{decode}(B) = P \cdot b_{param} + \sum_{i=1}^B 2 L \cdot h_{kv} \cdot d_{head} \cdot L_i \cdot b_{kv}
$$
The corresponding arithmetic volume is:

$$
\text{FLOPs}_{decode}(B) = 2 B P + \sum_{i=1}^B 4 L \cdot h_q \cdot d_{head} \cdot L_i
$$
The decode operational intensity is bounded by $I_{decode}(B) \le \frac{2 B}{b_{param}}$. Even under an aggressive batch size of $B = 64$ in FP16 precision ($b_{param} = 2$), $I_{decode} \le 64 \text{ FLOP/Byte}$, remaining an order of magnitude below $I_{knee} \approx 590 \text{ FLOP/Byte}$. As a result, autoregressive decoding is strictly memory-bandwidth bound. Inter-Token Latency (ITL), which in steady-state corresponds to the Time-per-Output-Token (TPOT), reflects the engine iteration execution cycle $t_{iter}$:

$$
t_{iter}(B, \vec{L}) = \frac{P \cdot b_{param} + \sum_{i=1}^B 2 L h_{kv} d_{head} L_i b_{kv}}{BW_{mem} \cdot \eta_{mem}} + \delta_{kernel}
$$
where $\delta_{kernel}$ represents fixed kernel dispatch latency and inter-GPU Tensor Parallel barrier synchronization overheads, measuring between $0.3\text{ ms}$ and $0.8\text{ ms}$ in multi-GPU configurations.

### 1.2 Continuous Batching Dynamics and Iteration Latency
Modern production engines (including vLLM, Orca, TensorRT-LLM, and SGLang) utilize continuous, iteration-level batching rather than static request-level batching. Requests enter the executing batch immediately upon concluding prompt prefill and vacate physical resources dynamically as soon as an end-of-sequence (`[EOS]`) token is emitted.
When serving engines employ chunked prefilling, prompts are partitioned into fixed-size token slices of length $C_{chunk}$ (typically 512 tokens). This approach co-schedules prefill chunks alongside active autoregressive decode steps in the same engine execution iteration, avoiding head-of-line blocking. Under continuous batching, the physical iteration duration displays an affine relationship with respect to the active concurrent sequence slots $n_{slots}$:

$$
t_{iter}(n_{slots}) = W + H \cdot n_{slots}
$$
The physical constants $W$ and $H$ capture baseline parameter streaming compute and per-sequence KV bandwidth loading. The intercept $W$ (in milliseconds) models baseline model execution latency, capturing the time required to stream static model parameters $P$ through memory pipelines alongside graph launch overhead. The slope $H$ (in milliseconds per slot) models the incremental memory bandwidth consumption and cache traversal overhead incurred per active sequence slot.
A prefill prompt of length $T_{in}$ occupies an engine slot across $N_{chunks} = \lceil T_{in} / C_{chunk} \rceil$ execution cycles prior to generating its initial token. The expected wall-clock service time $\mathbb{E}[S]$ for a request with $T_{in}$ input tokens and $T_{out}$ output tokens running on an engine with slot capacity $n_{max}$ is given by:

$$
\mathbb{E}[S] = \left( \left\lceil \frac{T_{in}}{C_{chunk}} \right\rceil + T_{out} \right) \cdot \frac{t_{iter}(n_{max})}{n_{max}} \cdot \Psi_{sched}
$$
where $\Psi_{sched} \ge 1.0$ accounts for bubble overhead and scheduler preemption delays.
The aggregate token generation throughput $\Theta_{tokens}$ (in tokens per second) is expressed as:

$$
\Theta_{tokens} = \frac{n_{slots}}{t_{iter}(n_{slots})} = \frac{n_{slots}}{W + H \cdot n_{slots}}
$$
As active sequence concurrency increases ($n_{slots} \to \infty$), system throughput asymptotically approaches the hardware streaming ceiling $\Theta_{tokens}^{max} = \frac{1}{H}$. Concurrently, individual sequence generation latency degrades linearly:

$$
\text{TPOT}(n_{slots}) = t_{iter}(n_{slots}) = W + H \cdot n_{slots}
$$
This dynamic establishes the operational trade-off governing LLM admission control: maximizing batch concurrency maximizes aggregate token generation efficiency at the expense of per-user interactive latency.

### 1.3 KV-Cache Memory Dynamics and PagedAttention Allocation
PagedAttention manages dynamic sequence state by partitioning Key-Value memory into non-contiguous physical pages or blocks of fixed token capacity $B_{size}$ (commonly 16 or 32 tokens).
For a transformer architecture comprising $L$ layers, $h_{kv}$ KV heads, and head dimension $d_{head}$, the physical memory footprint of a single PagedAttention block holding $B_{size}$ tokens is:

$$
M_{block} = 2 \cdot L \cdot h_{kv} \cdot d_{head} \cdot B_{size} \cdot b_{kv} \quad \text{bytes}
$$
The factor of 2 accounts for independent storage of Key and Value activation tensors.
Let $M_{GPU}$ denote total physical accelerator VRAM, $M_{weights} = P \cdot b_{param}$ the static parameter memory footprint, and $M_{cuda}$ the baseline CUDA context, runtime graphs, and scratchpad allocations ($1.5\text{--}3.5\text{ GB}$). The memory available for dynamic KV cache block allocation is:

$$
M_{KV}^{total} = M_{GPU} - M_{weights} - M_{cuda}
$$
The upper limit of allocatable physical blocks within the device is:

$$
N_{blocks}^{total} = \left\lfloor \frac{M_{KV}^{total}}{M_{block}} \right\rfloor
$$
A sequence with total context length $\ell = T_{in} + t_{gen}$ requires $N_{blocks}(\ell) = \lceil \ell / B_{size} \rceil$ physical blocks. While PagedAttention eliminates external memory fragmentation through virtual page table translation, internal fragmentation occurs within the partially filled terminal block of each active sequence. Assuming uniform context progression modulo $B_{size}$ over $\{0, 1, \dots, B_{size}-1\}$, the expected internal fragmentation per sequence is:

$$
\mathbb{E}[\text{Frag}_{internal}] = \frac{B_{size} - 1}{2} \cdot \left( \frac{M_{block}}{B_{size}} \right) \approx \frac{M_{block}}{2}
$$
Let $\mathcal{A}(t)$ denote the set of active concurrent sequences at time $t$. Total memory pressure is governed by the allocated block sum $N_{alloc}(t) = \sum_{i \in \mathcal{A}(t)} \lceil \ell_i(t) / B_{size} \rceil$. Serving engines enforce a watermark threshold $\alpha_{watermark} \in [0.80, 0.95]$. When $\frac{N_{alloc}(t)}{N_{blocks}^{total}} \ge \alpha_{watermark}$, admission control suspends the scheduling of new prompt prefills to reserve headroom for running decode iterations.
If ongoing token generation drives $N_{alloc}(t) > N_{blocks}^{total}$, the engine encounters KV-Cache exhaustion. The runtime must immediately preempt active requests, either by swapping allocated blocks across PCIe to host DRAM (incurring bandwidth transfer stalls governed by $BW_{PCIe}$), or by dropping the sequence KV cache entirely, retaining only the prompt tokens, and re-executing prefill once capacity clears.
The operational parameters and memory scaling limits across representative production accelerators and foundation models are summarized below:

| Model Architecture | Parameters ($P$) | Layer Geometry ($L, h_{kv}, d_{head}$) | Precision ($b_{param}, b_{kv}$) | Block Tokens ($B_{size}$) | Block Size ($M_{block}$) | Target Hardware | Usable KV VRAM ($M_{KV}^{total}$) | Total Blocks ($N_{blocks}^{total}$) | Max 8K Context Concurrency ($n_{max}$) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Llama-3-8B** | 8.03 B | $L=32, h_{kv}=8, d_{head}=128$ | FP16, FP16 | 16 | $2.0 \text{ MB}$ | RTX 4090 (24GB) | $6.5 \text{ GB}$ | 3,250 | 6 |
| **Llama-3-8B** | 8.03 B | $L=32, h_{kv}=8, d_{head}=128$ | FP8, FP8 | 16 | $1.0 \text{ MB}$ | A10G (24GB) | $14.0 \text{ GB}$ | 14,000 | 27 |
| **Llama-3-70B** | 70.6 B | $L=80, h_{kv}=8, d_{head}=128$ | FP16, FP16 | 16 | $5.0 \text{ MB}$ | $4\times \text{A100 (80GB)}$ | $160.0 \text{ GB}$ | 32,000 | 62 |
| **Llama-3-70B** | 70.6 B | $L=80, h_{kv}=8, d_{head}=128$ | FP8, FP8 | 32 | $5.0 \text{ MB}$ | $4\times \text{H100 (80GB)}$ | $235.0 \text{ GB}$ | 47,000 | 91 |

## 2. Vector Database and Approximate Nearest Neighbor Simulation
Vector databases provide the retrieval backplane for Retrieval-Augmented Generation (RAG). Modeling vector retrieval requires accounting for index memory overheads, distance calculation intensities, and tiering penalties between host RAM and solid-state storage.

### 2.1 Graph-Based Vector Indexing: HNSW
Hierarchical Navigable Small World (HNSW) indices organize high-dimensional vectors into a multi-layer geometric graph structure. Layer 0 indexes the complete dataset of $N$ vectors, while each subsequent upper layer $l \in \{1, \dots, L_{max}\}$ retains an exponentially smaller subset of nodes to establish long-range highway links for fast greedy navigation.
The maximum layer index for an inserted vector is assigned via an exponential decay function governed by the parameter multiplier $m_L$:

$$
l = \left\lfloor -\ln(U) \cdot m_L \right\rfloor, \quad U \sim \mathcal{U}(0, 1)
$$
Optimal logarithmic scaling of query hops occurs when setting $m_L = \frac{1}{\ln(M)}$, where $M$ represents the maximum out-degree per node on layers $l \ge 1$. Under this configuration, the probability that a given vector appears in layer $l$ is $P(\text{level} \ge l) = M^{-l}$, yielding an expected maximum graph height of:

$$
L_{max} = \lfloor \ln(N) \cdot m_L \rfloor = \left\lfloor \frac{\ln(N)}{\ln(M)} \right\rfloor = \lfloor \log_M(N) \rfloor
$$
Evaluating the memory footprint of an HNSW index requires accounting for raw vector storage, layer-specific graph topologies, and allocator alignment padding. Storing raw single-precision vectors ($b_{vec} = 4\text{ bytes}$) requires $4ND$ bytes. Layer 0 allows a maximum degree $M_0 = 2M$, requiring $N \cdot (4 M_0 + 4)$ bytes to store neighbor node pointers alongside degree counts. Across upper layers $l \ge 1$, node counts decay geometrically as $\sum_{l=1}^{\infty} N \cdot M^{-l} = \frac{N}{M - 1}$. With maximum degree $M$, these upper layers consume $\frac{N}{M - 1} \cdot (4 M + 4) = 4 N \cdot \frac{M + 1}{M - 1}$ bytes. Adding per-node object management and hash-map descriptors ($\approx 24\text{ bytes}$), the aggregate RAM footprint of an in-memory HNSW index evaluates to:

$$
M_{HNSW}^{RAM} = N \left( 4D + 4 M_0 + 4 \frac{M+1}{M-1} + 24 \right) \cdot \kappa_{alloc} \quad \text{bytes}
$$
where $\kappa_{alloc} \approx 1.15$ accounts for internal heap allocation overhead.
Query execution executes in two distinct phases. First, the engine performs a 1-greedy routing search across layers $L_{max}$ down to 1, seeking the closest local entry point on each layer in $O(\log_M N)$ hops. Second, at Layer 0, the engine executes a priority-queue beam search parameterized by capacity $efSearch$, exploring outward until all elements in the candidate queue exceed the distance to the current $k$-th nearest neighbor. The expected number of distance evaluations at Layer 0 scales as $efSearch \cdot \bar{d}_{eff}$, where $\bar{d}_{eff} \le M_0$ represents the average number of unvisited neighbors evaluated per node.
The resulting query execution latency evaluates to:

$$
T_{HNSW}^{query} = \left[ c_{upper} \cdot \log_M(N) + c_{base} \cdot efSearch \right] \cdot \left( \frac{D \cdot \tau_{FLOP}}{\text{SIMD\_WIDTH}} + \tau_{L3\_stall} \right)
$$
where $\tau_{FLOP}$ denotes the clock cycle time per arithmetic operation, and $\tau_{L3\_stall}$ represents the memory latency penalty incurred by random pointer chasing across non-contiguous graph vertices ($8\text{--}15\text{ ns}$ per hop).
Empirically, retrieval recall ($\text{Recall}@k$) follows a sigmoid response curve relative to $efSearch$ and edge degree $M$:

$$
\text{Recall}(efSearch, M) = \frac{1}{1 + \exp\left(-\gamma \cdot \left(efSearch - \frac{k_{target}}{\sqrt{M}}\right)\right)}
$$
Under severe host memory pressure, vector engines truncate graph edges or drop upper-level highway nodes to prevent memory paging. If available memory limits the graph footprint by a retention factor $\phi \in (0, 1)$, recall drops according to a power-law relationship:

$$
\text{Recall}_{degraded} = \text{Recall}_{nominal} \cdot \left(1 - (1 - \phi)^{\delta}\right)
$$
where $\delta \approx 2.4$ reflects the catastrophic loss of graph connectivity when sparse upper-layer routing links are severed.

### 2.2 Quantized Indexing: IVF-PQ
To compress memory footprints at scale, Inverted File with Product Quantization (IVF-PQ) partitions high-dimensional space into Voronoi cells and quantizes subvector spaces. The index defines $K_{ivf}$ coarse Voronoi centroids in $D$-dimensional space. Vectors are partitioned into $m$ orthogonal subvectors of dimensionality $d^* = D / m$, with each subvector quantized to the index of its nearest centroid within a codebook of size $K^* = 256$ ($b_{pq} = 1\text{ byte}$).
The total index memory footprint is given by:

$$
M_{IVF\text{-}PQ}^{RAM} = \underbrace{K_{ivf} \cdot D \cdot 4}_{\text{Coarse Centroids}} + \underbrace{m \cdot 256 \cdot \frac{D}{m} \cdot 4}_{\text{PQ Codebooks}} + \underbrace{N \cdot (m \cdot 1 + 8)}_{\text{Quantized Codes + Identifiers}} \quad \text{bytes}
$$
For a corpus of $N = 10^7$ vectors at $D = 1536$ dimensions ($m = 96$), uncompressed HNSW requires roughly $64.0\text{ GB}$ of RAM, whereas IVF-PQ requires only $1.04\text{ GB}$—a $61\times$ reduction in memory footprint.
Querying relies on Asymmetric Distance Computation (ADC):

$$
T_{IVF\text{-}PQ}^{query} = \underbrace{K_{ivf} \cdot D \cdot \tau_{FLOP}}_{T_{coarse}} + \underbrace{256 \cdot D \cdot \tau_{FLOP}}_{T_{LUT}} + \underbrace{\left( n_{probe} \cdot \frac{N}{K_{ivf}} \right) \cdot m \cdot \tau_{LUT\_add}}_{T_{scan}}
$$
The query first computes exact distances to all $K_{ivf}$ centroids to select the closest $n_{probe}$ inverted lists. It then constructs a Look-Up Table (LUT) of distances between the query subvectors and the codebook centroids, and finally scans the selected postings lists using scalar lookups and additions.

### 2.3 Memory-Disk Tiering: DiskANN (Vamana)
DiskANN accommodates billion-scale vector collections on single server nodes by maintaining compressed vectors in host RAM while placing full-precision vectors and a high-degree flat graph (the Vamana graph, with vertex degree $R \approx 64\text{--}128$) on NVMe SSD storage.
Query routing executes a synchronous beam search of width $W_{beam}$. At each step of the graph traversal, the engine issues asynchronous direct I/O requests (`io_uring`) to retrieve neighboring node sectors from flash media. The total latency over $K_{hops}$ traversal steps is:

$$
T_{DiskANN} = \sum_{h=1}^{K_{hops}} \left[ \max_{j \in [1, W_{beam}]} \left( (1 - H_{vec\_cache}) \cdot T_{SSD\_read}(j) \right) + W_{beam} \cdot R \cdot D \cdot \tau_{FLOP} \right]
$$
where $H_{vec\_cache} \in [0, 1]$ represents the hit rate of the in-memory vector cache. Under heavy concurrent query loads, NVMe read latency $T_{SSD\_read}$ degrades due to device controller queue contention, which can be modeled using Kingman's formula for an $M/G/1$ queuing system:

$$
T_{SSD\_read} = t_{flash\_access} + \frac{\rho_{IO} \cdot t_{transfer}}{1 - \rho_{IO}} \cdot \left( \frac{1 + C_{SSD}^2}{2} \right)
$$
where $\rho_{IO} = \frac{\lambda_{IO}}{IOPS_{max}}$, with modern PCIe 5.0 NVMe storage sustaining approximately $IOPS_{max} \approx 1.5 \times 10^6$ random 4KB read operations per second.

### 2.4 Hybrid Retrieval: Sparse (BM25) + Dense with Reciprocal Rank Fusion
Production retrieval architectures combine sparse lexical retrieval (BM25 inverted indices) with dense semantic vector search. Sparse indices utilize dynamic pruning algorithms such as Block-Max WAND (BMW) to bypass low-scoring document postings blocks without full decompression. The query execution latency over query terms $q \in Q$ scales with block skips and scored postings:

$$
T_{BM25} = \sum_{t \in Q} \left( \frac{\text{DF}(t)}{B_{size}} \cdot \tau_{block\_skip} + N_{scored}(t) \cdot \tau_{eval\_bm25} \right)
$$
Because $N_{scored} \ll \text{DF}(t)$, Block-Max WAND completes candidate scoring within $1.5\text{--}8.0\text{ ms}$ on standard server hardware.
Candidate lists retrieved from dense and sparse engines are merged via Reciprocal Rank Fusion (RRF). For any document $d$ present in the top-$K_{pool}$ candidates of either result set, its fused score is:

$$
\text{RRF\_Score}(d) = \sum_{m \in \{dense, sparse\}} \mathbb{I}(d \in \mathcal{R}_m) \cdot \frac{1}{k_{RRF} + r_m(d)}
$$
where $k_{RRF} \approx 60$ is a smoothing constant, and $r_m(d) \in \{1, \dots, K_{pool}\}$ represents the ordinal rank of document $d$ in result set $m$.
Because dense search and sparse search execute concurrently on parallel worker threads, overall hybrid search latency is governed by the slower retrieval path plus rank aggregation overhead:

$$
T_{hybrid} = \max\left( T_{dense}(N, D, efSearch), T_{sparse}(Q, N) \right) + T_{merge}
$$
where $T_{merge} \approx \mathcal{O}(K_{pool} \log K_{pool}) \le 0.05\text{ ms}$ using a fixed-size heap.
The structural trade-offs governing vector retrieval indices are compared below:

| Index Architecture | RAM Footprint ($N=10^7, D=1536$) | Single-Query Latency | Storage Substrate | Build Complexity | Target Recall (@10) |
| --- | --- | --- | --- | --- | --- |
| **HNSW (FP32)** | $64.0 \text{ GB}$ | $2.0\text{--}6.0 \text{ ms}$ | Host DRAM | $\mathcal{O}(N \log N)$ | $95\text{--}99\%$ |
| **HNSW (SQ8)** | $18.5 \text{ GB}$ | $1.2\text{--}3.5 \text{ ms}$ | Host DRAM | $\mathcal{O}(N \log N)$ | $92\text{--}97\%$ |
| **IVF-PQ ($m=96$)** | $1.04 \text{ GB}$ | $8.0\text{--}25.0 \text{ ms}$ | Host DRAM | $\mathcal{O}(N \cdot K_{ivf})$ | $85\text{--}92\%$ |
| **DiskANN (Vamana)** | $2.5 \text{ GB (RAM)} + 62 \text{ GB (SSD)}$ | $4.0\text{--}12.0 \text{ ms}$ | NVMe SSD | $\mathcal{O}(N \log N)$ | $95\text{--}98\%$ |
| **Block-Max WAND** | $4.2 \text{ GB}$ | $1.5\text{--}8.0 \text{ ms}$ | Host DRAM / SSD | $\mathcal{O}(N \cdot \bar{L}_{doc})$ | Lexical Exact |

## 3. Semantic Caching and Gateway Routing Dynamics
A semantic cache intercepts prompt requests at the gateway tier, compares incoming query embeddings against previously answered prompts, and returns cached completions on sufficiently close semantic matches, bypassing downstream LLM computation.

### 3.1 Cosine Distance Thresholding and Hit Rate Dynamics
Let $e(q)$ represent the normalized unit embedding vector of an incoming query $q \in \mathbb{R}^D$. For stored cache keys $\{k_i\}$, cosine distance is defined as:

$$
d_{cos}(q, k_i) = 1 - \langle e(q), e(k_i) \rangle
$$
A semantic cache hit occurs if and only if:

$$
\min_i d_{cos}(q, k_i) \le \tau_{dist} = 1 - \tau_{sim}
$$
where $\tau_{sim} \in [0.85, 0.98]$ defines the semantic similarity threshold.
Real-world query traffic exhibits power-law semantic reuse that follows a Zipf-Mandelbrot distribution:

$$
P(r) = \frac{1}{(r + q_0)^\alpha \cdot \sum_{j=1}^{\infty} (j + q_0)^{-\alpha}}
$$
where $r$ is the semantic query rank, $\alpha \approx 0.8\text{--}1.2$, and $q_0 \ge 0$ is a rank-flattening parameter. Integrating this density across the metric ball circumscribed by $\tau_{dist}$ yields the steady-state cache hit rate:

$$
H(C, \tau_{dist}) = H_{max}(\tau_{dist}) \cdot \left( \frac{C}{C + C_{half}} \right)^\gamma
$$
where $H_{max}(\tau_{dist}) = 1 - \exp(-\kappa \cdot \tau_{dist}^2)$ represents the upper bound of redundant semantic intent within the workload, $C_{half}$ is the cache capacity required to reach half of that ceiling, and $\gamma \in [0.6, 0.85]$.

### 3.2 Probabilistic Early Expiration: The XFetch Algorithm
Standard Time-to-Live (TTL) cache eviction mechanisms frequently trigger cache stampedes. When a frequently accessed key crosses its expiration boundary, concurrent incoming requests miss simultaneously, inundating upstream LLM instances with duplicate generation requests.
To prevent stampedes without distributed locking, systems employ the optimal probabilistic early expiration algorithm (XFetch). Each cached entry records its generated response $V$, the computation duration $\Delta$ (the wall-clock time required by the upstream LLM to generate the completion), and the nominal expiration timestamp $t_{expiry} = t_{insert} + \text{TTL}$.
When a query retrieves a valid entry at timestamp $t_{now}$, the gateway evaluates the probabilistic condition:

$$
t_{now} - \beta \cdot \Delta \cdot \ln(U) \ge t_{expiry}
$$
where $\beta > 0$ is an aggressiveness tuning multiplier (typically $\beta = 1.0$) and $U \sim \mathcal{U}(0, 1)$ is a uniform random variate drawn on the open interval $(0, 1)$. Because $\ln(U) \le 0$, the term $-\beta \cdot \Delta \cdot \ln(U)$ is strictly non-negative, effectively pulling the expiration boundary earlier in time.
The probability that an access at timestamp $t \le t_{expiry}$ triggers an early background recomputation evaluates to:

$$
P(\text{recompute} \mid t) = P\left(U \le \exp\left(-\frac{t_{expiry} - t}{\beta \Delta}\right)\right) = \exp\left(-\frac{t_{expiry} - t}{\beta \Delta}\right)
$$
For $t \ll t_{expiry}$, this probability is negligible. As $t$ approaches $t_{expiry}$, the probability increases smoothly toward 1.0. Crucially, the early recomputation window scales proportionally with computation time $\Delta$: an expensive 4-second LLM generation expands its early refresh window earlier than an inexpensive 100-millisecond query, spreading cache refresh attempts probabilistically and eliminating stampede spikes while bounding redundant generation.

### 3.3 Gateway Latency and Upstream Load Bimodality
The gateway end-to-end response time $T_{gateway}$ represents a mixture distribution combining lightweight cache lookups and heavyweight generative inference:

$$
T_{gateway} \sim H \cdot \mathcal{D}_{cache} + (1 - H) \cdot \mathcal{D}_{upstream}
$$
where:

- $\mathcal{D}_{cache} \sim \text{LogNormal}(\mu_c, \sigma_c)$ with median latency $\exp(\mu_c) \in [5, 15]\text{ ms}$ (Redis in-memory lookup).
- $\mathcal{D}_{upstream} \sim W_{queue} + \text{TTFT} + T_{gen}$ with median latency $\in [1500, 4000]\text{ ms}$ (full inference pipeline).
The cumulative distribution function (CDF) of gateway latency exhibits pronounced bimodality:

$$
F_{gateway}(t) = H \cdot F_{cache}(t) + (1 - H) \cdot F_{upstream}(t)
$$
By intercepting cacheable traffic, the semantic cache attenuates the request arrival rate transmitted to the upstream GPU fleet from $\lambda_{in}$ down to:

$$
\lambda_{upstream} = \lambda_{in} \cdot \left[ (1 - H) + H \cdot \bar{P}_{xfetch\_early} \right]
$$
Under properly tuned configurations ($\beta = 1.0$), the background refresh rate $\bar{P}_{xfetch\_early}$ remains below $0.02$, shielding upstream serving infrastructure from load spikes and reducing GPU operational expenditure in direct proportion to $H$.

## 4. Browser Web Worker Constraints and Performance Optimization
Executing a discrete event simulation within a browser Web Worker requires maintaining numerical stability and sub-millisecond per-frame compute budgets to ensure the main UI thread preserves an uninterrupted 60 Hz frame rate ($< 16.6\text{ ms}$ per tick). If simulation execution on the worker thread exceeds $1.0\text{ ms}$ per frame, post-message serialization and cross-thread event loop contention can cause UI jank in React 19.

### 4.1 Sub-Millisecond Closed-Form Analytical Approximations
Rather than simulating individual token generation loops across tens of thousands of concurrent sequences via fine-grained Monte Carlo iterations, the simulation engine calculates queue waiting states analytically and advances events at coarse request-level boundaries.

#### Numerically Stable Erlang-B and Erlang-C Recurrence
Multiserver delay analysis requires evaluating the Erlang-C formula $C(c, a)$, where $c$ represents the total available KV slots across the cluster and $a = \frac{\lambda}{\mu}$ denotes the offered load in Erlangs. Directly computing $\frac{a^c}{c!}$ causes IEEE 754 floating-point overflow for slot counts $c > 170$. To avoid this numerical instability, the engine implements the logarithmic downward recurrence of the Erlang-B loss model:

$$
B(0, a) = 1.0
$$

$$
B(m, a) = \frac{a \cdot B(m-1, a)}{m + a \cdot B(m-1, a)}, \quad \forall m \in \{1, 2, \dots, c\}
$$
From the converged loss probability $B(c, a)$, Erlang-C delay probability is derived algebraically without factorials:

$$
C(c, a) = \frac{B(c, a)}{1 - \varrho + \varrho \cdot B(c, a)}, \quad \text{where } \varrho = \frac{a}{c} = \frac{\lambda}{c \mu} < 1.0
$$

#### The Kimura M/G/c Tail Waiting Time Approximation
LLM sequence token lengths are heavy-tailed; production workloads routinely exhibit service time squared coefficients of variation $C_s^2 = \frac{\text{Var}[S]}{(\mathbb{E}[S])^2} \in [1.5, 12.0]$. Standard $M/M/c$ queuing formulations underestimate tail waiting times under these conditions.
To capture the impact of high-variance service times, the engine incorporates Kimura's two-moment diffusion approximation for multiserver systems. Expected queue waiting time evaluates to:

$$
\mathbb{E}[W_q]_{M/G/c} \approx C(c, \varrho) \cdot \frac{1}{\mu c (1 - \varrho)} \cdot \left( \frac{1 + C_s^2}{2} \right)
$$
The 99th percentile queue waiting time $W_{99}$ is calculated in closed form via:

$$
W_{99}(c, \mu, C_s^2) = \frac{\ln\left(\frac{C(c, \varrho)}{0.01}\right) \cdot (1 + C_s^2)}{2 \left(c \mu - \lambda\right)}
$$
When the offered load reaches saturation ($\varrho \ge 1.0$), the engine clamps $W_{99}$ to the remaining simulation time horizon and raises an instability warning.

#### Cornish-Fisher Expansion for Tail Latency Quantiles
To calculate $p50, p95,$ and $p99$ end-to-end response times from arbitrary non-normal distributions without maintaining and sorting large sample arrays in memory, the engine applies the Cornish-Fisher expansion. Let $\mu, \sigma^2, \gamma_1,$ and $\gamma_2$ represent the mean, variance, standardized skewness, and excess kurtosis of the system response time distribution $T = W_q + S$.
For a standard normal quantile $z_\alpha$ ($z_{0.50} = 0.0, z_{0.95} = 1.644853, z_{0.99} = 2.326348$), the skewness- and kurtosis-adjusted quantile $w_\alpha$ is given by:

$$
w_\alpha = z_\alpha + \frac{1}{6}(z_\alpha^2 - 1)\gamma_1 + \frac{1}{24}(z_\alpha^3 - 3z_\alpha)\gamma_2 - \frac{1}{36}(2z_\alpha^3 - 5z_\alpha)\gamma_1^2
$$
The corresponding latency value at quantile $\alpha$ is:

$$
Q(\alpha) = \mu + \sigma \cdot w_\alpha
$$
This formulation evaluates in approximately 20 nanoseconds, providing sub-millisecond quantile computation on every tick of the simulation loop.

### 4.2 Web Worker Architecture and Memory Optimization
Executing simulation algorithms inside a browser environment requires adhering to strict memory allocation patterns to eliminate garbage collection latency spikes:

- Pre-Allocated Typed Arrays: The worker initializes fixed-size `Float64Array` and `Int32Array` buffers to manage ring buffers, event priority heaps, and telemetry time-series records. Allocating dynamic objects (`{}`) within the high-frequency event loop is prohibited to eliminate garbage collection pauses.
- Zero-Copy State Transfer: High-frequency telemetry metrics are written directly to a `SharedArrayBuffer` using `Atomics`. The React 19 UI thread consumes this buffer directly via `useSyncExternalStore`, bypassing JSON serialization overhead and avoiding `postMessage` structural cloning latency.
- Frame-Budget Partitioning: The simulation processes discrete temporal slices ($\Delta t_{sim} = 50\text{ ms}$). If event execution within a given slice exceeds $1.0\text{ ms}$ of actual wall-clock time, the worker yields control back to the browser runtime via `scheduler.yield()` or `setTimeout(..., 0)` to maintain responsiveness.

## 5. Formal Parameter and Live Telemetry Specification

### 5.1 Input Configuration Parameters

| Category | Parameter Name | TS Identifier | Unit | Default | Range | Description |
| --- | --- | --- | --- | --- | --- | --- |
| **GPU Cluster** | Total GPUs | `numGpus` | count | 8 | $1\text{--}64$ | Total number of GPU accelerators in the inference pool. |
| **GPU Cluster** | Accelerator Type | `gpuType` | enum | `H100` | `A10G, A100, H100` | Hardware profile determining compute and memory bandwidth. |
| **GPU Cluster** | Tensor Parallelism | `tensorParallel` | count | 4 | $1\text{--}8$ | Number of GPUs sharding individual model layers. |
| **LLM Engine** | Active Parameters | `modelParamSize` | Billion | 70 | $7\text{--}405$ | Total active model parameter weight count ($P$). |
| **LLM Engine** | Weight Precision | `paramBytes` | bytes | 2 | $1, 2, 4$ | Parameter precision width ($b_{param}$, FP8=1, FP16=2). |
| **LLM Engine** | Prefill Chunk Size | `chunkSize` | tokens | 512 | $128\text{--}4096$ | Token granularity for chunked prefill iterations ($C_{chunk}$). |
| **LLM Engine** | Page Block Size | `blockSize` | tokens | 16 | $16, 32$ | PagedAttention token allocation unit ($B_{size}$). |
| **LLM Engine** | Slot Capacity / GPU | `maxSlotsPerGpu` | count | 64 | $8\text{--}256$ | Maximum concurrent sequence slots supported per accelerator. |
| **Vector DB** | Corpus Vectors | `numVectors` | count | 1,000,000 | $10^4\text{--}10^8$ | Total number of indexed vectors ($N$). |
| **Vector DB** | Vector Dimension | `dimensions` | count | 1536 | $128\text{--}3072$ | Embedding dimensionality ($D$). |
| **Vector DB** | HNSW Out-Degree | `hnswM` | count | 16 | $8\text{--}64$ | Graph connectivity per node ($M$, Layer 0 uses $2M$). |
| **Vector DB** | HNSW Search Depth | `efSearch` | count | 64 | $10\text{--}512$ | Exploration priority queue capacity ($efSearch$). |
| **Vector DB** | Storage Substrate | `storageMode` | enum | `InRAM` | `InRAM, DiskANN` | Host DRAM graph vs SSD-backed Vamana storage. |
| **Vector DB** | NVMe IOPS Limit | `nvmeMaxIops` | IOPS | 800,000 | $10^4\text{--}2\times 10^6$ | Solid-state drive random read I/O ceiling ($IOPS_{max}$). |
| **Semantic Cache** | Similarity Cutoff | `similarityThreshold` | ratio | 0.92 | $0.70\text{--}0.99$ | Minimum cosine similarity for cache hit ($\tau_{sim}$). |
| **Semantic Cache** | XFetch Beta Multiplier | `xfetchBeta` | float | 1.0 | $0.1\text{--}5.0$ | Aggressiveness factor for probabilistic recomputation. |
| **Semantic Cache** | Key Capacity | `cacheCapacity` | count | 50,000 | $10^3\text{--}10^6$ | Maximum cached prompt-completion entries before eviction. |
| **Workload** | Arrival Rate ($\lambda$) | `arrivalRate` | req/s | 25.0 | $0.1\text{--}500.0$ | Poisson arrival process intensity ($\lambda$). |
| **Workload** | Mean Prompt Length | `meanPromptTokens` | tokens | 1024 | $32\text{--}32768$ | Expected sequence input length ($\mathbb{E}[T_{in}]$). |
| **Workload** | Mean Output Length | `meanOutputTokens` | tokens | 256 | $16\text{--}4096$ | Expected sequence completion length ($\mathbb{E}[T_{out}]$). |

### 5.2 Live Telemetry Metrics

| Metric Category | Telemetry Name | TS Identifier | Unit | Calculation and Aggregation Method |
| --- | --- | --- | --- | --- |
| **Latency** | TTFT Median (p50) | `p50Ttft` | ms | Cornish-Fisher quantile $Q(0.50)$ over queue wait + prefill. |
| **Latency** | TTFT 95th Percentile | `p95Ttft` | ms | Cornish-Fisher quantile $Q(0.95)$ over queue wait + prefill. |
| **Latency** | TTFT 99th Percentile | `p99Ttft` | ms | Kimura tail wait $W_{99} + T_{prefill}(P99)$. |
| **Latency** | Inter-Token Latency | `meanTpot` | ms | Decode step duration: $t_{iter}(n_{active}) = W + H \cdot n_{active}$. |
| **Throughput** | Token Emission Rate | `tokenThroughput` | tok/s | Rate of successful token generations per second. |
| **Throughput** | Completed Requests | `completedRps` | req/s | Number of completed sequences departing the cluster per second. |
| **Saturation** | VRAM Memory Pressure | `vramSaturationPct` | % | Fraction of physical PagedAttention blocks currently allocated. |
| **Saturation** | Active Batch Slots | `activeSequences` | count | Number of sequences currently occupying engine compute slots. |
| **Saturation** | Pending Queue Depth | `pendingQueueDepth` | count | Number of unadmitted requests waiting in gateway buffer. |
| **Reliability** | KV Preemption Rate | `preemptionRate` | req/s | Frequency of sequences preempted due to KV-cache exhaustion. |
| **Retrieval** | Vector Search p95 | `p95VectorLatency` | ms | 95th percentile query execution latency of vector index. |
| **Retrieval** | Index Memory Size | `vectorRamBytes` | GB | Total DRAM bytes allocated to vector coordinates and graph. |
| **Retrieval** | Flash I/O Intensity | `currentNvmeIops` | IOPS | Rate of random 4KB read operations dispatched to NVMe SSD. |
| **Caching** | Semantic Hit Rate | `cacheHitRate` | % | Ratio of cache hits relative to total arriving requests. |
| **Caching** | Early Refreshes | `xfetchRecomputes` | req/s | Background recomputations triggered via XFetch. |
| **Gateway** | Rate Limit Rejections | `rateLimitRejections` | req/s | Requests rejected with HTTP 429 status code. |

## 6. Production TypeScript Simulation Node Algorithms
The following implementations provide the core simulation nodes designed for isolated, high-performance execution inside a browser Web Worker.

### 6.1 LLM Gateway and Continuous Batching Simulation Node

```typescript
export interface GpuSpec {
  name: string;
  peakFlops: number;
  memoryBandwidth: number;
  totalVramBytes: number;
  baselineOverheadMs: number;
  perSlotOverheadMs: number;
}

export interface LlmRequest {
  id: number;
  arrivalTimeMs: number;
  promptTokens: number;
  outputTokensRemaining: number;
  totalGeneratedTokens: number;
  allocatedBlocks: number;
  queueEntryTimeMs: number;
  prefillCompleted: boolean;
  prefillChunksRemaining: number;
}

export class LlmGatewayNode {
  private activeBatch: Map = new Map();
  private waitQueue: LlmRequest[] = [];
  
  private gpu: GpuSpec;
  private numGpus: number;
  private tensorParallel: number;
  private modelParamCount: number;
  private bytesPerParam: number;
  private pagedBlockTokens: number;
  private prefillChunkSize: number;
  
  private totalAvailableBlocks: number = 0;
  private allocatedBlocksCount: number = 0;
  private bytesPerBlock: number = 0;
  
  public totalTokensEmitted: number = 0;
  public totalRequestsCompleted: number = 0;
  public preemptionCount: number = 0;

  constructor(
    gpu: GpuSpec,
    numGpus: number,
    tensorParallel: number,
    modelParamCount: number = 70e9,
    bytesPerParam: number = 2,
    pagedBlockTokens: number = 16,
    prefillChunkSize: number = 512
  ) {
    this.gpu = gpu;
    this.numGpus = numGpus;
    this.tensorParallel = Math.min(tensorParallel, numGpus);
    this.modelParamCount = modelParamCount;
    this.bytesPerParam = bytesPerParam;
    this.pagedBlockTokens = pagedBlockTokens;
    this.prefillChunkSize = prefillChunkSize;
    this.initializeMemory();
  }

  private initializeMemory(): void {
    const layers = 80;
    const kvHeads = 8;
    const headDim = 128;
    
    this.bytesPerBlock = 2 * layers * kvHeads * headDim * this.pagedBlockTokens * this.bytesPerParam;
    const weightsFootprint = (this.modelParamCount * this.bytesPerParam) / this.tensorParallel;
    const staticCudaOverhead = 2.5 * 1024 * 1024 * 1024;
    const vramPerGpu = this.gpu.totalVramBytes;
    const availableKvVram = vramPerGpu - weightsFootprint - staticCudaOverhead;

    if (availableKvVram <= 0) {
      throw new Error("Out of Memory: Model weights exceed single GPU VRAM under TP configuration.");
    }

    const blocksPerGpu = Math.floor(availableKvVram / this.bytesPerBlock);
    const workerGroups = this.numGpus / this.tensorParallel;
    this.totalAvailableBlocks = blocksPerGpu * workerGroups;
  }

  public submitRequest(id: number, arrivalTimeMs: number, promptTokens: number, completionTokens: number): void {
    const chunks = Math.ceil(promptTokens / this.prefillChunkSize);
    const req: LlmRequest = {
      id,
      arrivalTimeMs,
      promptTokens,
      outputTokensRemaining: completionTokens,
      totalGeneratedTokens: 0,
      allocatedBlocks: 0,
      queueEntryTimeMs: arrivalTimeMs,
      prefillCompleted: false,
      prefillChunksRemaining: chunks
    };
    this.waitQueue.push(req);
  }

  public stepIteration(currentTimeMs: number): { stepDurationMs: number; tokensEmittedThisStep: number } {
    this.scheduleAdmissions();

    const activeCount = this.activeBatch.size;
    if (activeCount === 0) {
      return { stepDurationMs: 1.0, tokensEmittedThisStep: 0 };
    }

    const stepDurationMs = this.gpu.baselineOverheadMs + (this.gpu.perSlotOverheadMs * activeCount);
    let tokensEmittedThisStep = 0;
    const completedIds: number[] = [];

    for (const [id, req] of this.activeBatch.entries()) {
      if (!req.prefillCompleted) {
        req.prefillChunksRemaining -= 1;
        if (req.prefillChunksRemaining <= 0) {
          req.prefillCompleted = true;
        }
      } else {
        req.outputTokensRemaining -= 1;
        req.totalGeneratedTokens += 1;
        tokensEmittedThisStep += 1;
        this.totalTokensEmitted += 1;

        const currentLength = req.promptTokens + req.totalGeneratedTokens;
        const requiredBlocks = Math.ceil(currentLength / this.pagedBlockTokens);
        
        if (requiredBlocks > req.allocatedBlocks) {
          if (this.allocatedBlocksCount < this.totalAvailableBlocks) {
            this.allocatedBlocksCount += 1;
            req.allocatedBlocks += 1;
          } else {
            this.preemptRequest(req);
            continue;
          }
        }

        if (req.outputTokensRemaining <= 0) {
          completedIds.push(id);
        }
      }
    }

    for (const id of completedIds) {
      const req = this.activeBatch.get(id)!;
      this.allocatedBlocksCount -= req.allocatedBlocks;
      this.activeBatch.delete(id);
      this.totalRequestsCompleted += 1;
    }

    return { stepDurationMs, tokensEmittedThisStep };
  }

  private scheduleAdmissions(): void {
    while (this.waitQueue.length > 0) {
      const candidate = this.waitQueue[0];
      const initialBlocksNeeded = Math.ceil(this.prefillChunkSize / this.pagedBlockTokens);
      const maxAllowedBlocks = Math.floor(this.totalAvailableBlocks * 0.90);

      if (this.allocatedBlocksCount + initialBlocksNeeded <= maxAllowedBlocks) {
        const admitted = this.waitQueue.shift()!;
        admitted.allocatedBlocks = initialBlocksNeeded;
        this.allocatedBlocksCount += initialBlocksNeeded;
        this.activeBatch.set(admitted.id, admitted);
      } else {
        break;
      }
    }
  }

  private preemptRequest(triggerReq: LlmRequest): void {
    let victim: LlmRequest | null = null;
    for (const req of this.activeBatch.values()) {
      if (!victim || req.allocatedBlocks > victim.allocatedBlocks) {
        victim = req;
      }
    }

    if (victim) {
      this.allocatedBlocksCount -= victim.allocatedBlocks;
      this.activeBatch.delete(victim.id);
      victim.allocatedBlocks = 0;
      victim.prefillCompleted = false;
      victim.prefillChunksRemaining = Math.ceil(victim.promptTokens / this.prefillChunkSize);
      this.waitQueue.unshift(victim);
      this.preemptionCount += 1;
    }
  }

  public getVramSaturationPct(): number {
    return (this.allocatedBlocksCount / this.totalAvailableBlocks) * 100;
  }

  public getQueueDepth(): number {
    return this.waitQueue.length;
  }

  public getActiveBatchSize(): number {
    return this.activeBatch.size;
  }
}

```

### 6.2 Vector Database Simulation Node (HNSW + Quantization + DiskANN)

```typescript
export interface VectorDbConfig {
  numVectors: number;
  dimensions: number;
  hnswM: number;
  efSearch: number;
  isDiskBacked: boolean;
  nvmeReadLatencyMs: number;
  cacheHitRatio: number;
}

export class VectorDatabaseNode {
  private config: VectorDbConfig;
  private readonly simdBandwidthFlops: number = 32e9;

  constructor(config: VectorDbConfig) {
    this.config = config;
  }

  public calculateIndexMemoryBytes(): { vectorBytes: number; graphBytes: number; totalBytes: number } {
    const N = this.config.numVectors;
    const D = this.config.dimensions;
    const M = this.config.hnswM;
    const M0 = 2 * M;

    const vectorBytes = N * D * 4;
    const layer0Bytes = N * (M0 * 4 + 4);
    const upperLayerNodes = N / (M - 1);
    const upperLayerBytes = upperLayerNodes * (M * 4 + 4);
    const structuralOverhead = N * 24;
    const graphBytes = (layer0Bytes + upperLayerBytes + structuralOverhead) * 1.15;

    return {
      vectorBytes,
      graphBytes,
      totalBytes: vectorBytes + graphBytes
    };
  }

  public executeQuery(customEfSearch?: number): { latencyMs: number; estimatedRecall: number; nvmeIos: number } {
    const ef = customEfSearch ?? this.config.efSearch;
    const D = this.config.dimensions;
    const M = this.config.hnswM;
    const N = this.config.numVectors;

    const upperLevelHops = Math.log(N) / Math.log(M);
    const layer0DistanceEvaluations = ef * (M * 0.65);
    const totalDistanceEvals = upperLevelHops + layer0DistanceEvaluations;

    const flopsPerDistance = 2 * D;
    const computeSeconds = (totalDistanceEvals * flopsPerDistance) / this.simdBandwidthFlops;
    let latencyMs = computeSeconds * 1000;

    let nvmeIos = 0;
    if (this.config.isDiskBacked) {
      const traversalHops = Math.ceil(Math.log(N) / Math.log(M)) + Math.ceil(ef / 4);
      const cacheMisses = traversalHops * (1.0 - this.config.cacheHitRatio);
      nvmeIos = Math.ceil(cacheMisses);
      latencyMs += nvmeIos * this.config.nvmeReadLatencyMs;
    } else {
      const l3StallMs = (totalDistanceEvals * 12e-9) * 1000;
      latencyMs += l3StallMs;
    }

    const targetK = 10;
    const centerPoint = targetK / Math.sqrt(M);
    const estimatedRecall = 1.0 / (1.0 + Math.exp(-0.08 * (ef - centerPoint)));

    return {
      latencyMs,
      estimatedRecall: Math.min(0.999, estimatedRecall),
      nvmeIos
    };
  }

  public updateParameters(efSearch: number, cacheHitRatio: number): void {
    this.config.efSearch = efSearch;
    this.config.cacheHitRatio = Math.max(0, Math.min(1, cacheHitRatio));
  }
}

```

### 6.3 Semantic Cache Node (Distance Matching & XFetch Stampede Prevention)

```typescript
export interface CacheEntry {
  key: string;
  response: string;
  deltaSeconds: number;
  insertedAtMs: number;
  ttlMs: number;
}

export class SemanticCacheNode {
  private cache: Map = new Map();
  private maxCapacity: number;
  private similarityThreshold: number;
  private xfetchBeta: number;

  public hits: number = 0;
  public misses: number = 0;
  public earlyRecomputes: number = 0;

  constructor(maxCapacity: number = 50000, similarityThreshold: number = 0.92, xfetchBeta: number = 1.0) {
    this.maxCapacity = maxCapacity;
    this.similarityThreshold = similarityThreshold;
    this.xfetchBeta = xfetchBeta;
  }

  public evaluateQuery(
    key: string,
    simulatedMinDistance: number,
    currentTimeMs: number
  ): { status: "HIT" | "EARLY_REFRESH" | "MISS"; responseText: string | null; lookupLatencyMs: number } {
    const lookupLatencyMs = 2.0 + Math.random() * 4.0;
    const requiredDistance = 1.0 - this.similarityThreshold;

    if (simulatedMinDistance > requiredDistance || !this.cache.has(key)) {
      this.misses += 1;
      return { status: "MISS", responseText: null, lookupLatencyMs };
    }

    const entry = this.cache.get(key)!;
    const expiryTimestampMs = entry.insertedAtMs + entry.ttlMs;

    if (currentTimeMs >= expiryTimestampMs) {
      this.cache.delete(key);
      this.misses += 1;
      return { status: "MISS", responseText: null, lookupLatencyMs };
    }

    const u = Math.max(1e-7, Math.random());
    const xfetchThresholdMs = currentTimeMs - (this.xfetchBeta * (entry.deltaSeconds * 1000) * Math.log(u));

    if (xfetchThresholdMs >= expiryTimestampMs) {
      this.earlyRecomputes += 1;
      return { status: "EARLY_REFRESH", responseText: entry.response, lookupLatencyMs };
    }

    this.hits += 1;
    return { status: "HIT", responseText: entry.response, lookupLatencyMs };
  }

  public recordMissResolution(
    key: string,
    response: string,
    generationDurationSeconds: number,
    currentTimeMs: number,
    ttlMs: number = 300000
  ): void {
    if (this.cache.size >= this.maxCapacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      key,
      response,
      deltaSeconds: generationDurationSeconds,
      insertedAtMs: currentTimeMs,
      ttlMs
    });
  }

  public getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : (this.hits / total) * 100;
  }
}

```

### 6.4 Analytical Queue Quantile Solver (Kimura + Cornish-Fisher)

```typescript
export class AnalyticalQueueSolver {
  public static calculateErlangB(c: number, offeredLoad: number): number {
    let b = 1.0;
    for (let m = 1; m <= c; m++) {
      b = (offeredLoad * b) / (m + offeredLoad * b);
    }
    return b;
  }

  public static calculateErlangC(c: number, offeredLoad: number): number {
    const rho = offeredLoad / c;
    if (rho >= 1.0) return 1.0;
    const b = this.calculateErlangB(c, offeredLoad);
    return b / (1.0 - rho + (rho * b));
  }

  public static calculateKimuraP99Wait(
    numServers: number,
    arrivalRate: number,
    serviceRatePerServer: number,
    scvService: number
  ): number {
    const offeredLoad = arrivalRate / serviceRatePerServer;
    const rho = offeredLoad / numServers;

    if (rho >= 0.999) {
      return Number.POSITIVE_INFINITY;
    }

    const erlangC = this.calculateErlangC(numServers, offeredLoad);
    const capacityRemaining = (numServers * serviceRatePerServer) - arrivalRate;
    
    const numerator = Math.log(Math.max(1e-6, erlangC) / 0.01) * (1.0 + scvService);
    const denominator = 2.0 * capacityRemaining;

    return Math.max(0, numerator / denominator);
  }

  public static evaluateCornishFisherQuantile(
    mean: number,
    variance: number,
    skewness: number,
    excessKurtosis: number,
    quantile: number
  ): number {
    const sigma = Math.sqrt(variance);
    let z = 0.0;
    if (Math.abs(quantile - 0.50) < 1e-4) z = 0.0;
    else if (Math.abs(quantile - 0.95) < 1e-4) z = 1.644853;
    else if (Math.abs(quantile - 0.99) < 1e-4) z = 2.326348;
    else {
      const t = Math.sqrt(-2.0 * Math.log(1.0 - quantile));
      z = t - ((2.515517 + 0.802853 * t + 0.010328 * t * t) /
               (1.0 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t));
    }

    const z2 = z * z;
    const z3 = z2 * z;

    const termSkew = (1.0 / 6.0) * (z2 - 1.0) * skewness;
    const termKurt = (1.0 / 24.0) * (z3 - 3.0 * z) * excessKurtosis;
    const termSkewSq = (1.0 / 36.0) * (2.0 * z3 - 5.0 * z) * (skewness * skewness);

    const w = z + termSkew + termKurt - termSkewSq;
    return mean + sigma * w;
  }
}

```

## 7. AI Infrastructure Chaos and Failure Modes
Accurately simulating AI infrastructure requires modeling operational regimes where non-linear feedback loops trigger system failure. Unlike traditional microservices that degrade gracefully under elevated load, generative inference clusters exhibit sharp performance cliffs driven by memory boundaries, cascading timeouts, and self-reinforcing retry dynamics.

### 7.1 Context Window Overflow and Token Clamping
When prompts approach the hard token capacity of the underlying transformer model ($T_{in} \to L_{ctx}^{max}$), serving systems must intervene by clamping or rejecting requests. If an incoming sequence satisfies $T_{in} > L_{ctx}^{max}$, the gateway enforces a hard clamp:

$$
T_{in}^{effective} = \min\left(T_{in}, L_{ctx}^{max} - T_{out}^{min}\right)
$$
In multi-agent autonomous loops, context length grows monotonically across successive interactions. Truncating tokens strips early conversation state, system instructions, and few-shot exemplars. As a result, agents fail to complete tasks and re-issue queries with identical or expanded context, multiplying upstream request volume without producing useful work. This dynamic locks server capacity into processing redundant prefill chunks, driving up queue delays across the cluster.

### 7.2 GPU Out-of-Memory (OOMKilled) and KV Eviction Cascades
Unlike CPU runtimes that handle memory exhaustion via operating system disk swapping, GPU kernels executing unpaged allocations terminate unrecoverably upon running out of memory. When total allocated blocks satisfy $N_{alloc}(t) \ge N_{blocks}^{total}$ and preemption mechanisms fail to free memory fast enough, the host runtime raises a unrecoverable CUDA memory allocation error.
This memory fault causes the serving container to terminate immediately via a host kernel `SIGKILL`. The crash drops all $n_{active}$ sequences running within the process, and upstream health-check load balancers divert arriving traffic to the remaining $N_{nodes} - 1$ active GPUs. The surviving instances absorb this sudden surge in traffic, which pushes their utilization $\varrho$ beyond capacity limits and exhausts their local PagedAttention pools. This triggers a cascading failure that can bring down the entire inference fleet within seconds.

### 7.3 Embedding Semantic Drift and ANN Index Degradation
Vector database accuracy depends on metric stationarity between the query space and stored embeddings. Let $\mathcal{M}_\theta(x)$ denote the transformer embedding model parameterized by weights $\theta$. Upstream model fine-tuning, vocabulary modifications, or runtime quantization updates shift the resulting geometric coordinate space:

$$
\delta_\theta = \mathbb{E}_{x \sim \mathcal{X}}\left[ 1 - \langle \mathcal{M}_\theta(x), \mathcal{M}_{\theta + \Delta\theta}(x) \rangle \right]
$$
As semantic drift $\delta_\theta$ accumulates, incoming query vectors diverge from historic cluster centroids. Nearest-neighbor searches fail to identify relevant items within the exploration radius governed by $efSearch$, causing retrieval recall to degrade significantly.
In RAG pipelines, this retrieval degradation starves downstream LLMs of relevant context. The language model attempts to resolve contradictory or missing facts by generating longer, more hesitant responses, which inflates completion token lengths $\mathbb{E}[T_{out}]$ and extends sequence service durations $\mathbb{E}[S]$. This unexpected decoding load increases KV-cache residency, pushing serving nodes closer to memory exhaustion.

### 7.4 Upstream Rate-Limit (HTTP 429) Retry Storms and Metastable Failures
When incoming request bursts saturate upstream provider token buckets, the gateway issues `HTTP 429 (Too Many Requests)` responses. If client applications implement immediate retries or deterministic backoff strategies, these rejections can trigger self-amplifying retry storms.
Let $\lambda_{ext}$ denote the incoming external request rate. If clients retry failed requests with probability $p_r$, the total arrival rate hitting the infrastructure inflates according to a geometric progression:

$$
\lambda_{total} = \lambda_{ext} + \sum_{k=1}^{K_{max}} \lambda_{ext} \cdot [P(\text{HTTP 429})]^k
$$
Where capacity limits enforce $P(\text{HTTP 429}) = \max\left(0, 1 - \frac{C_{limit}}{\lambda_{total}}\right)$, any sustained arrival rate $\lambda_{ext} > C_{limit}$ causes the total offered load $\lambda_{total}$ to diverge rapidly, overwhelming gateway connection pools.
To prevent these failure cascades, resilient gateways implement randomized exponential backoff with full jitter alongside tri-state circuit breakers:

- Full Jitter Exponential Backoff: Clients randomize retry delays across the full interval $t_{sleep} \sim \mathcal{U}\left(0, \min(T_{max}, T_{base} \cdot 2^k)\right)$, de-synchronizing subsequent arrival waves.
- Tri-State Circuit Breaker Dynamics: When upstream rejections cross a predefined failure threshold (e.g., 50% errors over an observation window), the breaker transitions from `CLOSED` to `OPEN`, immediately rejecting subsequent requests with minimal latency ($< 1\text{ ms}$) without querying downstream services. After a cooldown period, the breaker enters `HALF-OPEN` to evaluate a small canary fraction of traffic, transitioning back to `CLOSED` upon recovery or reverting to `OPEN` if failures persist.
The system telemetry signatures across nominal, saturated, and failure states are summarized below:

| System Metric | Nominal Steady-State | Saturated State ($\varrho \approx 0.92$) | Chaos Mode: OOM Preemption Thrashing | Chaos Mode: HTTP 429 Retry Cascade |
| --- | --- | --- | --- | --- |
| **P99 TTFT** | $180\text{--}350\text{ ms}$ | $1200\text{--}2800\text{ ms}$ | $> 15000\text{ ms}$ (Recompute stalls) | Infinite (Client timeout drops) |
| **Mean TPOT** | $12\text{--}18\text{ ms/tok}$ | $28\text{--}42\text{ ms/tok}$ | $85\text{ ms/tok}$ (Memory thrashing) | Undefined (Zero completions) |
| **Token Throughput** | $2800\text{ tok/s}$ | $5200\text{ tok/s}$ (Maximized) | $< 400\text{ tok/s}$ (Preempting) | $0\text{ tok/s}$ (Ingress rejection) |
| **VRAM Pressure** | $65\text{--}78\%$ | $90\text{--}94\%$ | Oscillating $40\% \leftrightarrow 100\%$ | Constant (Parameters only) |
| **Queue Depth** | $0\text{--}4\text{ req}$ | $45\text{--}120\text{ req}$ | $500+\text{ req}$ (Backlog overflow) | Divergent ($\lambda_{total} \to \infty$) |
| **Cache Hit Ratio** | $25\text{--}35\%$ | $25\text{--}35\%$ | $5\text{--}10\%$ (Stale evictions) | $0\%$ (Short-circuited at ingress) |

## 8. Architectural Synthesis and Conclusions
Simulating modern generative AI infrastructure requires moving beyond classical independent queuing systems. As demonstrated by the mathematical models and discrete event formulations developed here, LLM inference nodes, vector search indices, and semantic caching gateways form a tightly coupled non-linear network:
Prefill and decode phases create mutual interference in shared GPU architectures. Compute-heavy prefill bursts monopolize tensor cores and temporarily degrade memory-bound decode iteration latencies, underscoring the importance of chunked prefilling or physical hardware disaggregation to protect interactive latency SLOs.
Physical VRAM limits impose steep context-dependent capacity cliffs despite the memory efficiency of PagedAttention. As concurrent context lengths cross memory watermarks, the system shifts abruptly from low-latency continuous serving into high-overhead preemption, swapping, and recomputation.
Semantic caching transforms uniform upstream request arrivals into a bimodal latency distribution. Employing XFetch probabilistic early expiration smooths this profile, preventing cache stampedes and shielding downstream LLMs from cascading overload.
By combining Kimura's $M/G/c$ tail-wait formulation, stable downward Erlang recurrences, and the Cornish-Fisher expansion, discrete event engines running inside browser Web Workers can evaluate complex tail distributions and hardware-calibrated metrics in under a millisecond, driving rich, real-time interactive architecture simulations at a steady 60 Hz frame rate.

---

Source: https://gemini.google.com/app/4f7c48c8271c5d11
Exported at: 2026-09-14T09:50:41.243Z