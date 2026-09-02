# **Interactive Architecture Canvas and Real-Time Load & Chaos Simulation Engines for System Design Interview Platforms**

Evaluating senior and staff-level software engineering candidates requires testing both high-level system decomposition and dynamic operational reasoning under real-world constraints1. While static diagramming solutions communicate structural intent, they cannot demonstrate how an architecture responds to production traffic dynamics, such as queue buildups, cascading timeouts, network partitions, or database failovers3. Modern assessment platforms must therefore evolve from passive vector drawing tools into active, browser-native discrete-event simulation environments2.  
This report provides an architectural and mathematical blueprint for building a browser-native System Design Studio using React 19, TypeScript, and Tailwind CSS5. It pairs an interactive node-graph canvas with a real-time discrete event traffic engine, automated structural topology heuristics, and a dynamic chaos injection framework2.

## **Comparative Evaluation of Browser Diagramming and Canvas Engines**

Selecting the foundational diagramming library dictates rendering performance, state synchronization ergonomics, and component extensibility7. The platform requires support for custom enterprise cloud components (e.g., API Gateways, Kafka clusters, Patroni PostgreSQL clusters), high-frequency animated traffic flows, and bi-directional JSON serialization2.

| Evaluation Criteria | @xyflow/react (React Flow v12+) | tldraw SDK (v4 / v5) | Excalidraw Embeddable | Cytoscape.js (Canvas / WebGL) |
| :---- | :---- | :---- | :---- | :---- |
| **Core Architecture & Rendering Pipeline** | Hybrid: SVG edges with absolute-positioned HTML/DOM node containers6. | Hybrid: Spatial R-tree index, reactive signal store, HTML/SVG canvas with viewport culling8. | Pure HTML5 Canvas rendering loop backed by an internal geometric scene graph3. | Imperative HTML5 Canvas with optional WebGL rendering backends11. |
| **React 19 Compatibility** | Native. Zero-dependency core supporting React 19 hooks and concurrent rendering features6. | Compatible via React wrappers; manages state via internal @tldraw/state signals8. | Compatible via the @excalidraw/excalidraw wrapper component3. | Imperative vanilla JavaScript requiring manual useRef lifecycle bridges12. |
| **60 FPS Limit (100+ Nodes)** | Maintains 60 FPS via hardware transforms and viewport node culling; sensitive to deep DOM trees6. | Sustains 60 FPS up to \~500 visible shapes; culled via spatial indices and debounced zoom8. | Sustains 60 FPS up to 1,000+ basic shapes; degrades with complex nested components3. | Exceeds 60 FPS beyond 5,000+ nodes; highly optimized for massive topologies11. |
| **Custom Node Composition** | Native React components styled directly with Tailwind CSS; isolated component state6. | Custom ShapeUtil classes rendering via HTMLContainer; requires registration schemas13. | Highly constrained; limited to hand-drawn geometric primitives without native JSX layouts3. | Complex; requires cytoscape-node-html-label plugins; lacks native JSX layout trees12. |
| **Edge & Particle Animation** | First-class custom edge SVG paths (BaseEdge) and imperative coordinate interpolation10. | Requires custom arrow binding models; curved particle interpolation is non-trivial13. | Hand-drawn aesthetic only; lacks programmatic edge-flow primitives3. | Supported via canvas overlays, but path mathematical hooks are low-level19. |
| **Graph Serialization & Port Semantics** | Native JSON (nodes, edges, viewport); native multi-handle connection ports6. | Flat record store snapshots; handles require custom directional binding logic8. | Custom binary/JSON schemas; lacks semantic connection port abstractions3. | Elements JSON schema; graph-centric, lacks visual UI and layout data natively11. |

### **Library Trade-Offs**

The @xyflow/react ecosystem is purpose-built for workflow builders and structured node graphs11. Because every node is an isolated React component, engineers can compose rich visual interfaces—such as interactive metrics sparklines, real-time load bars, and status pills—directly using Tailwind CSS6. React Flow decouples node rendering from viewport transformations by applying hardware-accelerated CSS transform: translate3d() to the container6. However, rendering animated particles as individual React DOM elements or SVG circles inside React Flow causes reconciliation overhead that destroys 60 FPS frame budgets under high traffic volumes7. The optimal architecture decouples particle rendering: React Flow manages the layout and handles, while an independent HTML5 Canvas layer is superimposed over the viewport5. This canvas reads edge coordinates directly from React Flow's store and updates particle trajectories inside a standalone requestAnimationFrame loop7.  
The tldraw SDK provides an infinite whiteboard experience with an internal reactive signal architecture (@tldraw/state)8. It maintains a spatial R-tree index that culls shapes outside the viewport using display: none, keeping rendering overhead low8. Custom shapes can render React nodes through HTMLContainer15. However, tldraw models connections as abstract shape bindings rather than deterministic, multi-port input/output handles13. Constructing an enterprise architectural component—such as an API Gateway with discrete routing ports or a Kafka topic with partitioned egress handles—requires implementing custom connection routing and handle-snapping logic from scratch13.  
Excalidraw is popular for freeform whiteboarding, but its programmatic embedding model treats the canvas as a continuous scene of geometric sketch paths3. It lacks first-class abstractions for semantic nodes, typed connection handles, structured property inspectors, and synchronized graph event listeners2. Adapting Excalidraw into a deterministic simulation engine requires building an entire shadow graph library alongside it.  
Cytoscape.js is an optimized graph analysis engine capable of processing tens of thousands of elements at 60 FPS11. It includes built-in graph algorithms like PageRank, shortest paths, and minimum cut11. Its primary drawback is its rendering abstraction: it renders directly to an internal HTML5 Canvas or WebGL context11. Rendering custom, interactive DOM elements (e.g., Tailwind buttons, configuration dropdowns, and live metric indicators) requires layering hacks like cytoscape-node-html-label, which degrade rendering performance and break clean React 19 event propagation12.  
The recommended design uses @xyflow/react for the UI layer paired with an imperative HTML5 Canvas overlay for particle rendering5. This combination delivers native React 19 declarative component composition, typed node handles, and standard JSON export schemas, while delegating high-frequency particle animations to a non-reconciled canvas pipeline6.

## **Browser-Native Discrete Event Simulation and Mathematical Queuing Formulations**

Simulating high-throughput architectures requires modeling how request volumes propagate across the topology, where queues form, and how latency distributions degrade under load2.

### **Queuing Theory Formulations**

Distributed service topologies can be modeled analytically as Open Jackson Networks22. In an Open Jackson Network with ![][image1] interconnected processing nodes, external requests arrive at node ![][image2] according to a Poisson process with rate ![][image3]22. The total arrival rate ![][image4] entering node ![][image2] satisfies the linear traffic equation:  
![][image5]  
where ![][image6] is the transition probability that a request departing node ![][image7] routes to node ![][image2]22. Once routing probabilities are resolved, each node behaves in steady-state as an independent multi-server queuing system (![][image8])22.  
For a component with ![][image9] concurrent processing threads or instances and an average service rate ![][image10] per server, the system utilization ![][image11] is:  
![][image12]  
Steady-state stability requires ![][image13]. If ![][image14], the arrival rate outpaces service capacity, queue length grows unbounded, and timeouts trigger cascading failures2.  
The probability that an arriving request finds all ![][image9] processing units busy and must wait in the queue is governed by the Erlang-C formula:  
![][image15]  
where ![][image16] represents the offered load in Erlangs24. Applying Little's Law (![][image17]), the total expected residence time ![][image18] (queue wait time plus execution service time) through the component is:  
![][image19]  
When a component enters saturation (![][image20]), the mean waiting time ![][image21] diverges asymptotically24. The simulation reflects this by scaling processing latency superlinearly, eventually causing upstream request dropouts2.

### **High-Percentile Latency Estimation**

System tail latency cannot be derived from arithmetic averages because end-to-end ![][image22] latency across dependent services is driven by extreme tail distributions24.  
Recording raw latencies in unbounded arrays triggers continuous memory allocations and browser garbage collection pauses that break 60 FPS rendering loops7. The engine instead uses bounded-memory streaming approximations25.  
The T-Digest algorithm maps floating-point samples to dynamic centroids with variable cluster sizes, providing high accuracy at the extreme edges of the distribution (![][image23])27. However, its centroid clustering process requires variable compute cycles during ingestion, introducing runtime jitter during high-throughput browser simulations27.  
The High Dynamic Range (HDR) Histogram (HdrHistogram) records integer values across logarithmic buckets using a pre-allocated array26. By pre-allocating memory for a specified dynamic range (e.g., 1 millisecond to 1 minute with 3 significant figures of precision), recording a latency sample takes constant ![][image24] time with zero runtime heap allocations26. The browser engine compiles HdrHistogram\_c via WebAssembly (or uses the optimized hdr-histogram-js library) to ingest hundreds of thousands of simulated latency samples per second without frame drops26.

TypeScript  
import { build, type Histogram } from "hdr-histogram-js";

export class NodeLatencyTracker {  
  private histogram: Histogram;

  constructor() {  
    this.histogram \= build({  
      lowestDiscernibleValue: 1,           // 1 millisecond  
      highestTrackableValue: 60\_000,      // 60 seconds  
      numberOfSignificantValueDigits: 3   // 0.1% resolution  
    });  
  }

  public record(latencyMs: number): void {  
    const clamped \= Math.max(1, Math.min(60\_000, Math.round(latencyMs)));  
    this.histogram.recordValue(clamped);  
  }

  public getPercentiles(): { p50: number; p95: number; p99: number; max: number } {  
    return {  
      p50: this.histogram.getValueAtPercentile(50),  
      p95: this.histogram.getValueAtPercentile(95),  
      p99: this.histogram.getValueAtPercentile(99),  
      max: this.histogram.maxValue  
    };  
  }

  public reset(): void {  
    this.histogram.reset();  
  }  
}

### **Browser Execution Architecture**

Executing discrete event simulations directly on the main thread causes heavy computational tasks to compete with UI rendering, dropping frame rates7. The execution pipeline is divided across three isolated tiers:  
The simulation engine operates within a dedicated Web Worker29. It maintains a virtual simulation clock and an event queue backed by a binary min-heap. Discrete events—such as request dispatches, cache lookups, database queries, and message publications—are processed based on virtual timestamps rather than wall-clock time, allowing the engine to simulate seconds of high-load traffic in a few milliseconds1.  
The worker periodically snapshots per-node metrics (throughput, queue depth, error rate, and latency percentiles) and transfers them to the main thread at a fixed 60 Hz rate using postMessage with transferable typed arrays (or a SharedArrayBuffer with Atomics), eliminating serialization overhead2.  
The main UI thread receives these metric snapshots and updates the HUD without triggering global React component tree re-renders2. An imperative HTML5 canvas overlay draws animated particle streams along the SVG paths computed by React Flow, varying particle speed and density based on the edge's current throughput3.

## **Graph Topology Heuristics and Automated Anti-Pattern Detection**

Evaluating candidates requires detecting architectural anti-patterns directly from the canvas topology and simulated metrics2. The graph is modeled as a directed multi-graph ![][image25], where ![][image26] represents infrastructure components and ![][image27] represents communication channels2.

### **Topological Traversal and Kahn's Algorithm**

Before evaluating dynamic metrics, the engine validates the graph's structural integrity using Kahn's algorithm for topological sorting2. This accomplishes two goals:

> 1. Cycle and Feedback Loop Isolation: Asynchronous loops (e.g., saga compensation or dead-letter retries) are identified and isolated from the synchronous request path2.  
> 2. Topological Ingress Accumulation: Requests Per Second (RPS) accumulate cleanly down the graph. If two API Gateways route traffic to the same microservice, Kahn's fan-in accumulation calculates the correct aggregated ingress load2.

TypeScript  
export interface GraphNode {  
  id: string;  
  type: string;  
  capacityRps: number;  
  readRatio?: number; // 0.0 to 1.0  
  instances: number;  
  metadata: Record\<string, any\>;  
}

export interface GraphEdge {  
  id: string;  
  source: string;  
  target: string;  
  isAsync: boolean;  
  routingRatio?: number; // Traffic split fraction (0.0 to 1.0)  
}

export function computeTopologicalTraffic(  
  nodes: Map\<string, GraphNode\>,  
  edges: GraphEdge\[\],  
  rootIngressRps: Map\<string, number\>  
): Map\<string, number\> {  
  const inDegree \= new Map\<string, number\>();  
  const incomingLoad \= new Map\<string, number\>();  
  const adjacency \= new Map\<string, GraphEdge\[\]\>();

  for (const nodeId of nodes.keys()) {  
    inDegree.set(nodeId, 0);  
    incomingLoad.set(nodeId, rootIngressRps.get(nodeId) ?? 0);  
    adjacency.set(nodeId, \[\]);  
  }

  for (const edge of edges) {  
    if (\!edge.isAsync) {  
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) \+ 1);  
      adjacency.get(edge.source)\!.push(edge);  
    }  
  }

  const queue: string\[\] \= \[\];  
  for (const \[nodeId, deg\] of inDegree.entries()) {  
    if (deg \=== 0) queue.push(nodeId);  
  }

  while (queue.length \> 0) {  
    const currentId \= queue.shift()\!;  
    const currentLoad \= incomingLoad.get(currentId)\!;  
    const currentNode \= nodes.get(currentId)\!;  
    const outgoing \= adjacency.get(currentId) ?? \[\];

    const effectiveLoad \= Math.min(  
      currentLoad,   
      currentNode.capacityRps \* currentNode.instances  
    );

    const totalRatio \= outgoing.reduce((sum, e) \=\> sum \+ (e.routingRatio ?? 1.0), 0);

    for (const edge of outgoing) {  
      const splitLoad \= totalRatio \> 0   
        ? effectiveLoad \* ((edge.routingRatio ?? 1.0) / totalRatio)   
        : 0;

      incomingLoad.set(edge.target, (incomingLoad.get(edge.target) ?? 0) \+ splitLoad);  
      const remainingDegree \= inDegree.get(edge.target)\! \- 1;  
      inDegree.set(edge.target, remainingDegree);  
      if (remainingDegree \=== 0) {  
        queue.push(edge.target);  
      }  
    }  
  }

  return incomingLoad;  
}

### **Static and Dynamic Anti-Pattern Rules**

The engine applies graph heuristics to detect common distributed system design flaws:  
Unshielded Relational Database (RDBMS) Under High Read Load: Relational databases bottleneck on disk I/O, lock contention, and connection pool limits under heavy read traffic2. The engine identifies paths connecting services directly to an RDBMS where read throughput exceeds safe thresholds (e.g., ![][image28] RPS) and no caching layer (such as Redis Cluster or Memcached) is present on the path2. Resolving this requires placing a distributed cache in front of the database using a cache-aside or read-through pattern to absorb read volume2.  
Kafka Partition and Consumer Group Mismatch: In Apache Kafka, each topic partition can only be consumed by one member of a consumer group at a time. If a candidate provisions more consumer instances than there are topic partitions (![][image29]), the extra consumer instances sit idle, wasting resources2. Conversely, if ingress throughput exceeds partition capacity (![][image30]), consumer lag accumulates2. The engine flags this mismatch and requires adjusting partitions to balance consumer capacity2.  
Single Point of Failure (SPOF) Detection via Tarjan’s Algorithm: A single point of failure is any node whose failure disconnects the active execution graph30. Treating the synchronous graph as an undirected graph, the engine runs Tarjan's low-link algorithm to identify articulation points and bridges30. During Depth-First Search traversal, discovery times (disc\[u\]) and lowest reachable ancestors (low\[u\]) are tracked31. A non-root node ![][image31] is an articulation point if it has a child ![][image32] where ![][image33]31. If such a node has only a single instance and no standby replicas, the engine flags an unmitigated SPOF2.  
Missing Circuit Breakers and Rate Limiters on External Dependencies: Outbound calls to external third-party services (such as payment gateways or notification APIs) are vulnerable to network latency and third-party rate limits2. The engine analyzes edges crossing the system boundary to external nodes. If an edge lacks an intermediary circuit breaker or rate limiter (such as Resilience4j or Envoy proxies), the platform flags a thread exhaustion risk2.

| Anti-Pattern Detected | Graph Algorithmic Primitive | Simulation Trigger Condition | Criticality |
| :---- | :---- | :---- | :---- |
| **Unshielded DB Read Storm** | Subgraph path traversal: Service ![][image34] RDBMS2. | ![][image35]2. | Critical (Cascading crash)2. |
| **Kafka Consumer Starvation** | Node property comparison: Consumer ![][image36] vs Topic ![][image37]. | ![][image38]2. | Warning (Resource waste)2. |
| **Architectural SPOF** | Tarjan's Articulation Points (DFS Low-Link)31. | ![][image39]30. | High (Zero redundancy)2. |
| **Unshielded Third-Party Call** | Edge boundary inspection. | ![][image40]2. | High (Thread exhaustion)2. |
| **Cascading Gateway Timeout** | Cumulative topological path latency ![][image41]. | ![][image42]22. | Critical (Gateway 504 errors)2. |

## **Chaos Monkey Engineering and Dynamic Fault Injection**

To test whether an architecture degrades gracefully or collapses completely, the platform integrates an active Chaos Monkey engine directly into the simulation loop3.

### **Component Lifecycle State Machine**

Every node on the canvas transitions through a defined finite state machine during execution:

* **HEALTHY**: The component processes incoming requests within nominal service bounds (![][image43])2.  
* **DEGRADED**: Utilization rises above nominal operating capacity (![][image44]). Service latency scales exponentially, driving up ![][image22] tail latency2.  
* **SATURATED**: Ingress load exceeds total capacity (![][image45]). Queues fill completely, dropped requests increase, and upstream services face timeout errors2.  
* **CRASHED**: Fault injection terminates the node, dropping active connections and halting request processing immediately4.  
* **FAILOVER**: Consensus mechanisms (such as Raft or Patroni DCS) elect an available replica to assume primary traffic1.  
* **RECOVERING**: The node restarts, replays write-ahead logs to catch up with the primary, and rejoins the active pool1.

### **PostgreSQL High Availability Failover Dynamics**

When an interviewer injects a "Primary DB Crash" fault, the engine models a Patroni/Raft failover sequence rather than merely severing canvas edges1.  
The primary database transitions to CRASHED, causing the Distributed Consensus Store (e.g., etcd) to miss heartbeats past the lease TTL4. Once the DCS revokes the leader lock, standby replicas check their Log Sequence Numbers (LSN) to identify the node with the lowest replication lag1. The standby with the lowest lag is promoted to primary, replays remaining WAL records, and switches to read-write mode1. Upstream connection pools detect failed sockets, invalidate connections to the old primary, and reconnect to the newly promoted instance20. During this failover window (typically 10 to 30 simulated seconds), unbuffered write requests fail with 500-series errors unless protected by retry queues or circuit breakers2.

### **Dynamic Circuit Breaker Simulation**

To prevent cascading thread pool exhaustion across microservices, the engine models client-side circuit breakers using a sliding window2:  
![][image46]  
In the CLOSED state, all traffic routes downstream while tracking latency and error codes4. If the failure rate exceeds a threshold ![][image47] (e.g., ![][image48]) over a sliding window, the breaker trips to OPEN. In the OPEN state, calls fail fast immediately, redirecting requests to a fallback path (such as returning cached stale data) while an internal recovery timer runs4. Once the timer expires, the breaker enters HALF-OPEN and permits a small number of probe requests through. If all probe requests succeed, the breaker returns to CLOSED; if any probe fails, it resets to OPEN4.

TypeScript  
export class CircuitBreaker {  
  public state: 'CLOSED' | 'OPEN' | 'HALF\_OPEN' \= 'CLOSED';  
  private failureCount \= 0;  
  private successCount \= 0;  
  private lastStateChange \= 0;

  constructor(  
    private readonly failureThreshold \= 0.5,  
    private readonly windowSize \= 20,  
    private readonly openDurationMs \= 5000  
  ) {}

  public executeRequest(  
    currentTime: number,   
    downstreamCall: () \=\> boolean,   
    fallbackCall: () \=\> void  
  ): boolean {  
    if (this.state \=== 'OPEN') {  
      if (currentTime \- this.lastStateChange \> this.openDurationMs) {  
        this.state \= 'HALF\_OPEN';  
        this.lastStateChange \= currentTime;  
        this.successCount \= 0;  
      } else {  
        fallbackCall();  
        return false;  
      }  
    }

    const success \= downstreamCall();

    if (this.state \=== 'HALF\_OPEN') {  
      if (success) {  
        this.successCount++;  
        if (this.successCount \>= 5) {  
          this.state \= 'CLOSED';  
          this.lastStateChange \= currentTime;  
          this.failureCount \= 0;  
        }  
      } else {  
        this.state \= 'OPEN';  
        this.lastStateChange \= currentTime;  
      }  
    } else if (this.state \=== 'CLOSED') {  
      if (\!success) this.failureCount++;  
      if (this.failureCount / this.windowSize \>= this.failureThreshold) {  
        this.state \= 'OPEN';  
        this.lastStateChange \= currentTime;  
      }  
    }

    return success;  
  }  
}

## **State of the Art: Open-Source Systems and Industry Implementations**

The open-source ecosystem provides several benchmark tools that validate browser-native architecture simulation and analysis1.

### **Existing Implementations and Patterns**

The system-design-simulator (SystemForge) project provides a client-side architecture simulation engine built in TypeScript2. Its execution pipeline uses Kahn’s topological sort to aggregate fan-in traffic across wired connections, ignoring disconnected nodes2. It caps downstream throughput at actual node processing capacity, demonstrating how bottlenecks cause cascading throughput collapse across dependencies2. SystemForge scores candidate architectures across five categories (Scalability, Availability, Latency, Cost, and Trade-offs) using a 100-point rubric, while excluding asynchronous edges from latency calculations2.  
The sysarch-interactive project couples a drag-and-drop canvas with a custom physics engine running in a requestAnimationFrame loop9. It routes individual requests as visible particles along spline paths between nodes, dynamically updating node colors and queue gauges as candidates adjust capacity and RPS sliders9.  
The systemdesignsimulator.in / systemdesignsimulator.org platform features interactive modules for both high-level design and distributed database internals1. It offers two simulation modes: Trace Mode, which steps through single requests hop-by-hop and generates sequence diagrams, and Monte Carlo Mode, which fires thousands of requests to produce ![][image49], ![][image50], and ![][image22] latency distributions4. It also visualizes low-level mechanics like LSM-tree compaction, WAL flushes, and Raft consensus elections1.  
The FlowFrame platform (paperdraw.dev) defines architectures via a declarative domain-specific language (DSL)20. It parses canvas topologies into an AST, runs static semantic validation checks, and includes chaos injection toggles for cache-miss storms, network partitions, and node failures20.  
Historically, Netflix's Vizceral set the standard for microservice traffic visualization by using WebGL to render particle flows between service nodes35. It varied particle velocity and color to illustrate regional failovers and highlight elevated error rates across services35.

| Infrastructure Component | Verified Maximum Throughput | Nominal Service Latency |
| :---- | :---- | :---- |
| **Load Balancer (L4 / L7 Reverse Proxy)** | **![][image51]** \[cite: 2\] | ![][image52] \[cite: 2\] |
| **Edge Content Delivery Network (CDN)** | **![][image53]** \[cite: 2\] | ![][image54] \[cite: 2\] |
| **Distributed In-Memory Cache (Redis Cluster)** | **![][image55]** \[cite: 2\] | ![][image52] \[cite: 2\] |
| **Distributed Event Streaming (Kafka Broker)** | **![][image55]** \[cite: 2\] | ![][image56] \[cite: 2\] |
| **Distributed NoSQL (DynamoDB / Key-Value)** | **![][image57]** \[cite: 2\] | ![][image58] \[cite: 2\] |
| **Distributed Object Store (S3-compatible)** | **![][image59]** \[cite: 2\] | ![][image60] \[cite: 2\] |
| **Distributed Search Index (Elasticsearch)** | **![][image61]** \[cite: 2\] | ![][image62] \[cite: 2\] |
| **Relational Database (PostgreSQL OLTP)** | **![][image63]** \[cite: 2\] | ![][image64] \[cite: 2\] |

## **End-to-End System Blueprint and Production Canvas Architecture**

The studio's architecture integrates the @xyflow/react layout layer, an imperative HTML5 Canvas particle overlay, and a dedicated Web Worker simulation engine2.  
The main UI thread renders the React Flow canvas to manage nodes and handles6. An absolute-positioned HTML5 canvas sits directly over the node graph to render particle streams, reading handle positions from the React Flow store without triggering React re-renders9. The Web Worker processes traffic and queuing calculations in the background, emitting metric updates to the UI at 60 Hz2.

TypeScript  
import React, { useRef, useEffect, useState, useCallback } from 'react';  
import {   
  ReactFlow,   
  useNodesState,   
  useEdgesState,   
  type Node,   
  type Edge   
} from '@xyflow/react';  
import '@xyflow/react/dist/style.css';

interface TrafficParticle {  
  x: number;  
  y: number;  
  edgeId: string;  
  progress: number;  
  speed: number;  
  isError: boolean;  
}

export const ArchitectureStudioCanvas: React.FC \= () \=\> {  
  const \[nodes, setNodes, onNodesChange\] \= useNodesState(\[\]);  
  const \[edges, setEdges, onEdgesChange\] \= useEdgesState(\[\]);  
  const canvasRef \= useRef\<HTMLCanvasElement | null\>(null);  
  const workerRef \= useRef\<Worker | null\>(null);  
  const particlesRef \= useRef\<TrafficParticle\[\]\>(\[\]);

  useEffect(() \=\> {  
    workerRef.current \= new Worker(  
      new URL('./engine/simulation.worker.ts', import.meta.url),   
      { type: 'module' }  
    );

    workerRef.current.onmessage \= (e: MessageEvent) \=\> {  
      const { type, metrics } \= e.data;  
      if (type \=== 'METRICS\_SNAPSHOT') {  
        // Direct update to local HUD stores bypassing React Flow tree  
      }  
    };

    return () \=\> workerRef.current?.terminate();  
  }, \[\]);

  const triggerLoadSimulation \= useCallback((rps: number) \=\> {  
    workerRef.current?.postMessage({  
      type: 'SIMULATE\_TRAFFIC',  
      payload: { nodes, edges, ingressRps: rps }  
    });  
  }, \[nodes, edges\]);

  useEffect(() \=\> {  
    let frameId: number;  
    const canvas \= canvasRef.current;  
    if (\!canvas) return;  
    const ctx \= canvas.getContext('2d');  
    if (\!ctx) return;

    const render \= () \=\> {  
      ctx.clearRect(0, 0, canvas.width, canvas.height);  
      const particles \= particlesRef.current;

      for (let i \= particles.length \- 1; i \>= 0; i--) {  
        const p \= particles\[i\];  
        p.progress \+= p.speed;

        if (p.progress \>= 1.0) {  
          particles.splice(i, 1);  
          continue;  
        }

        ctx.beginPath();  
        ctx.arc(p.x, p.y, 3, 0, 2 \* Math.PI);  
        ctx.fillStyle \= p.isError ? '\#EF4444' : '\#10B981';  
        ctx.fill();  
      }  
      frameId \= requestAnimationFrame(render);  
    };

    frameId \= requestAnimationFrame(render);  
    return () \=\> cancelAnimationFrame(frameId);  
  }, \[\]);

  return (  
    \<div className\="relative w-full h-screen bg-slate-950"\>  
      \<ReactFlow  
        nodes\={nodes}  
        edges\={edges}  
        onNodesChange\={onNodesChange}  
        onEdgesChange\={onEdgesChange}  
        fitView  
      /\>  
      \<canvas  
        ref\={canvasRef}  
        className\="absolute inset-0 pointer-events-none z-10"  
      /\>  
    \</div\>  
  );  
};

### **Canvas Serialization Schema**

The canvas topology and component configurations serialize into a structured JSON schema, ensuring designs can be saved, shared, and evaluated consistently2:

JSON  
{  
  "$schema": "https://json-schema.org/draft/2020-12/schema",  
  "title": "SystemDesignStudioDocument",  
  "type": "object",  
  "required": \["version", "metadata", "nodes", "edges"\],  
  "properties": {  
    "version": { "type": "string", "enum": \["2026.1"\] },  
    "metadata": {  
      "type": "object",  
      "required": \["architectureName", "candidateSessionId"\],  
      "properties": {  
        "architectureName": { "type": "string" },  
        "candidateSessionId": { "type": "string" },  
        "targetRps": { "type": "number" }  
      }  
    },  
    "nodes": {  
      "type": "array",  
      "items": {  
        "type": "object",  
        "required": \["id", "type", "position", "data"\],  
        "properties": {  
          "id": { "type": "string" },  
          "type": {   
            "type": "string",   
            "enum": \[  
              "apiGateway",   
              "microservice",   
              "redisCluster",   
              "kafkaTopic",   
              "patroniPostgres",   
              "edgeCdn",   
              "circuitBreaker"  
            \]   
          },  
          "position": {  
            "type": "object",  
            "required": \["x", "y"\],  
            "properties": {  
              "x": { "type": "number" },  
              "y": { "type": "number" }  
            }  
          },  
          "data": {  
            "type": "object",  
            "required": \["label", "instances", "specs"\],  
            "properties": {  
              "label": { "type": "string" },  
              "instances": { "type": "integer", "default": 1 },  
              "specs": {  
                "type": "object",  
                "required": \["baseProcessingLatencyMs", "maxCapacityRps"\],  
                "properties": {  
                  "baseProcessingLatencyMs": { "type": "number" },  
                  "maxCapacityRps": { "type": "number" },  
                  "readRatio": { "type": "number", "minimum": 0, "maximum": 1 },  
                  "cacheHitRatio": { "type": "number", "minimum": 0, "maximum": 1 },  
                  "partitions": { "type": "integer" }  
                }  
              }  
            }  
          }  
        }  
      }  
    },  
    "edges": {  
      "type": "array",  
      "items": {  
        "type": "object",  
        "required": \["id", "source", "target", "data"\],  
        "properties": {  
          "id": { "type": "string" },  
          "source": { "type": "string" },  
          "target": { "type": "string" },  
          "sourceHandle": { "type": "string" },  
          "targetHandle": { "type": "string" },  
          "data": {  
            "type": "object",  
            "required": \["protocol", "isAsync"\],  
            "properties": {  
              "protocol": {   
                "type": "string",   
                "enum": \["HTTP\_REST", "GRPC", "KAFKA\_PRODUCE", "TCP\_SOCKET"\]   
              },  
              "isAsync": { "type": "boolean" },  
              "trafficWeight": { "type": "number", "default": 1.0 }  
            }  
          }  
        }  
      }  
    }  
  }  
}

## **Synthesis and Architectural Conclusions**

Transitioning from static diagramming to interactive discrete-event simulation transforms system design evaluations from memory-based exercises into practical engineering assessments1.

> 1. Canvas Layer Architecture: Implement @xyflow/react for the UI layer to leverage its native React 19 integration, typed multi-handle connection ports, and declarative Tailwind styling6. To maintain 60 FPS performance, decouple particle animations from React reconciliation by using a superimposed HTML5 Canvas layer5.  
> 2. Discrete Event Engine: Execute the traffic simulation inside a dedicated Web Worker to protect the main thread's frame budget29. Model service latency using Jackson Networks and ![][image8] queuing formulas, and track ![][image65] tail latencies with zero-allocation WebAssembly-backed HdrHistogram instances24.  
> 3. Structural Heuristics: Run Kahn's algorithm for traffic accumulation and Tarjan's low-link algorithm for articulation-point detection before initiating load tests2. This validates the architecture against common design flaws, such as missing caches, unbalanced Kafka partitions, and unprotected third-party integrations2.  
> 4. Chaos Monkey Validation: Combine structural graph scoring with dynamic fault injection2. Simulating primary database crashes and network partitions tests whether a candidate understands the operational realities of distributed systems, including consensus elections, replication lag, and client-side failover mechanics1.

#### **Источники**

> 1. System Design Simulator \- Free Interactive Interview Prep, [https://systemdesignsimulator.org/](https://systemdesignsimulator.org/)  
> 2. GitHub \- vijaygupta18/system-design-simulator: Interactive System, [https://github.com/vijaygupta18/system-design-simulator](https://github.com/vijaygupta18/system-design-simulator)  
> 3. A complete animated system design learning platform covering LLD, [https://github.com/Sumit6258/System-Design](https://github.com/Sumit6258/System-Design)  
> 4. System Design Simulator — Visual Distributed Systems Playground, [https://www.systemdesignsimulator.in/](https://www.systemdesignsimulator.in/)  
> 5. System Design Simulator — Project by Yash Lunawat, [https://www.yashlunawat.com/projects/system-design-simulator](https://www.yashlunawat.com/projects/system-design-simulator)  
> 6. What's new? \- React Flow, [https://reactflow.dev/whats-new](https://reactflow.dev/whats-new)  
> 7. How to Build Process Flow Diagrams with Javascript (sop), [https://www.templateregistry.com/templates/process-flow-diagram-javascript](https://www.templateregistry.com/templates/process-flow-diagram-javascript)  
> 8. Performance • tldraw Docs, [https://tldraw.dev/sdk-features/performance](https://tldraw.dev/sdk-features/performance)  
> 9. SysArch Interactive \- GitHub, [https://github.com/pronzzz/sysarch-interactive](https://github.com/pronzzz/sysarch-interactive)  
> 10. Animating Edges \- React Flow, [https://reactflow.dev/examples/edges/animating-edges](https://reactflow.dev/examples/edges/animating-edges)  
> 11. vibenoodles — what to install, [https://vibenoodles.dev/](https://vibenoodles.dev/)  
> 12. A. Tytenko \- Web System with Graph UI for Exploratory Learning, [https://er.auk.edu.ua/bitstreams/8a9bb7a7-426a-4ed2-adb1-ad7df790845f/download](https://er.auk.edu.ua/bitstreams/8a9bb7a7-426a-4ed2-adb1-ad7df790845f/download)  
> 13. tldraw/apps/docs/content/releases/v4.3.0.mdx at main \- GitHub, [https://github.com/tldraw/tldraw/blob/main/apps/docs/content/releases/v4.3.0.mdx](https://github.com/tldraw/tldraw/blob/main/apps/docs/content/releases/v4.3.0.mdx)  
> 14. Overview \- React Flow, [https://reactflow.dev/examples](https://reactflow.dev/examples)  
> 15. Tldraw — AI Agent Skill \- Terminal Skills, [https://terminalskills.io/skills/tldraw](https://terminalskills.io/skills/tldraw)  
> 16. Whiteboard Features \- React Flow, [https://reactflow.dev/learn/advanced-use/whiteboard](https://reactflow.dev/learn/advanced-use/whiteboard)  
> 17. Content and Label on a Node \- Cytoscape \- Stack Overflow, [https://stackoverflow.com/questions/54115476/content-and-label-on-a-node-cytoscape](https://stackoverflow.com/questions/54115476/content-and-label-on-a-node-cytoscape)  
> 18. v5.0.0 • tldraw Docs, [https://tldraw.dev/releases/v5.0.0](https://tldraw.dev/releases/v5.0.0)  
> 19. Frontend / Fullstack / Manager — Making complex systems feel simple., [https://andrewbaldock.com/resume](https://andrewbaldock.com/resume)  
> 20. I built an interactive system design simulator where you can build, [https://www.reddit.com/r/softwarearchitecture/comments/1vjs0dh/i\_built\_an\_interactive\_system\_design\_simulator/](https://www.reddit.com/r/softwarearchitecture/comments/1vjs0dh/i_built_an_interactive_system_design_simulator/)  
> 21. starred/by-language.md at master · b0o/starred \- GitHub, [https://github.com/b0o/starred/blob/master/by-language.md](https://github.com/b0o/starred/blob/master/by-language.md)  
> 22. Using a Queuing Model to Analyze the Performance of Web Servers, [https://www.researchgate.net/publication/238677438\_Using\_a\_Queuing\_Model\_to\_Analyze\_the\_Performance\_of\_Web\_Servers](https://www.researchgate.net/publication/238677438_Using_a_Queuing_Model_to_Analyze_the_Performance_of_Web_Servers)  
> 23. Hybrid Orchestration of Edge AI and Microservices via Graph-based, [https://arxiv.org/html/2603.06669v1](https://arxiv.org/html/2603.06669v1)  
> 24. Delay Analysis in IoT Sensor Networks \- PMC \- NIH, [https://pmc.ncbi.nlm.nih.gov/articles/PMC8200081/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8200081/)  
> 25. How to Build Trace Aggregation \- OneUptime, [https://oneuptime.com/blog/post/2026-01-30-trace-aggregation/view](https://oneuptime.com/blog/post/2026-01-30-trace-aggregation/view)  
> 26. GitHub \- HdrHistogram/HdrHistogramJS: TypeScript port of, [https://github.com/HdrHistogram/HdrHistogramJS](https://github.com/HdrHistogram/HdrHistogramJS)  
> 27. Percentiles aggregation | Elasticsearch Reference, [https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-percentile-aggregation](https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-percentile-aggregation)  
> 28. t-digest overview | Tiger Data Docs, [https://www.tigerdata.com/docs/reference/toolkit/percentile-approximation/tdigest](https://www.tigerdata.com/docs/reference/toolkit/percentile-approximation/tdigest)  
> 29. discrete event simulation \- Glenn K. Lockwood, [https://www.glennklockwood.com/garden/discrete-event-simulation](https://www.glennklockwood.com/garden/discrete-event-simulation)  
> 30. A Tool for Learning and Quantifying Software Infrastructure Resiliency, [https://digitalcommons.dartmouth.edu/cgi/viewcontent.cgi?article=1071\&context=cs\_senior\_theses](https://digitalcommons.dartmouth.edu/cgi/viewcontent.cgi?article=1071&context=cs_senior_theses)  
> 31. Articulation Points and Bridges \- Scaler Topics, [https://www.scaler.com/topics/data-structures/articulation-points-and-bridges/](https://www.scaler.com/topics/data-structures/articulation-points-and-bridges/)  
> 32. Contrast-Security-OSS/cargo-cats \- GitHub, [https://github.com/Contrast-Security-OSS/cargo-cats](https://github.com/Contrast-Security-OSS/cargo-cats)  
> 33. Finding Single Point Of Failure(SPOF) | by Amrit Bhardwaj \- Medium, [https://medium.com/@amrit.bhardwaj99/finding-single-point-of-failure-spof-efeee7927234](https://medium.com/@amrit.bhardwaj99/finding-single-point-of-failure-spof-efeee7927234)  
> 34. I built a System Design Simulator – drag, simulate, and break your, [https://dev.to/pratapvhatkar/i-built-a-system-design-simulator-drag-simulate-and-break-your-own-architectures-in-minutes-1jl0](https://dev.to/pratapvhatkar/i-built-a-system-design-simulator-drag-simulate-and-break-your-own-architectures-in-minutes-1jl0)  
> 35. Vizceral Alternatives and Reviews \- LibHunt, [https://www.libhunt.com/r/vizceral](https://www.libhunt.com/r/vizceral)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAcCAYAAABlL09dAAABT0lEQVR4Xu3TvyuFURzH8a/8GERIFhkYFINkUAzKRJRSpPwMk8Jik6RMNpNSNquySimi/AUG5U/wT/i8O9/nes7t3Hune6fnU6/lnu89z3me7/eYFWlk2mTTnbqlqCJOk8zbfy3WpTVfRCjscqvyLdcWHpjKsDzKi4y6jqgikX25lDtpL1sjLbIlN3Ilza5i2ARHsiJP0htVhEzJjDzIdtlaMv3uQKbl08Ir59MjGzJmYX0yXk6HzTAnI/Iq41GF2aIMyLI8S1+8nE7dNuZ7gU35A3+c9bVBx8ZM0LlVn5pSKDh23S5rDlOw5hjHTrm30Iua4YSHjhMxHbdyJhMWJgGEhtI4JqNm6C4XA1kuLMwyc82pQbhxHxY+TdVwwj0LJ0OWXXmXodxv5MQqX55SeL03+ZUvxwkJnd+x8OAFR0N/HFeaq5xM3TYuUqRIo/MHCYI6xZkKPPYAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAcCAYAAACtQ6WLAAAAkElEQVR4XmNgGByAC4jZ0AWFoHgzEJejyTGwQLEnEAujyeEGIJVhUCyPLCEKxOlA7ALFS4BYgCjJQCDWAOIAKF4ExLwwSZC/OIC4H4pTYBIwoATE26FYB02OIQSI50MxKCDsgJgVJAEychoQx0IxyBR/iB4GBkYgLgTiaiguAGIeoiRBgIkB4jcQBoXvKIABAJvhEseHBe/dAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAbCAYAAACa9mScAAAA6UlEQVR4Xu3SywpBQRgH8M+lSKGUBVmIlLJQFi55ATlZKGRhx8LGQlaShctTeAdP5iH4f803ms5Fo2zU+devZr45zZy5EIUJY58I1GAouM01nTxkjL4ncdjAA56C22MZT8AastL3zQBOpD7i1VkHbpCT9uj9dUAW5L/KHLqwIjUZhxdIi6jUPqYJe5gZtRJchd/CnvxkkjrcoeIe+CZF2EFM+g04Ql9YhbczlXaK1C3ytU+EVZbQM/r8Xs6ktme1xSSpwysbNT6jA1SFvvbA8HlcSG1DpwVbcIQ+q8AUoO0ukvpD/arD/EVelAMYCdb96zoAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAbCAYAAABxwd+fAAABDElEQVR4Xu3SMWpCQRAG4IkWkYCEJI2EVIoQjEUIpBLBgKBgJXgELyBYKTbqCaxMG0hpYxeIWNum9Qhewv9nZ2F3QcmqTYg/fODbeW9Yd0fkX+QepqoHd3759zlZI+ZBfUM7qEUlqUbwAWm/HJ8yrOE1LMTmFmbQhYugFhV+zCZsxqZHpQEbMX/z4JTgHeZiDp4XYMPdEi8i4ax7qahPyIgZgS8xM2ZjR2QM1866l4o6uBG3WoWFKuh6EX6gps974zZhA9uEuYSJ4u8nGCieo5c8LOEtLGiasIJnqOsztdyXGJ48b2DX4LF+A1didjVUWfel2DxCX+XkiGF9gY7iwLrzFZ2U2nUU5/yZbAHHoyLluPH08gAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABOCAYAAACdbkoxAAAEy0lEQVR4Xu3dy6tuYxwH8Mf9kstxi4SDkDtncHBIHTmSAVEYCBlIMuIQyUTHwKGQ6wATA6lTBmTAQIkoEwOZmSgDA38Ez7e13vbaT+fd73rfvd+z9+HzqV/vWs+z3n1Zo1+/51YKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANMdUeOMGqc27af37QAAbLKjanxY45Om/fsaDzRtAABskj013u+vj65xW429K90AAGy2y2q80V/vqLG9xq0r3QAAbKZt/ecjpausnVhjZ/8JAMAWcEX/eWfpKm2R5A0AgC3g7hoHalxSuqrayTWeqvFVjV2D5wAAAAAAAAAAAGC9ssfa5ASDeQMAgEMgx1A9XOOfGi82fQeTBO/lGn/VuGh1FwAAy5L91ZKw/d12rCHJ2uNtIwDAVpK9yj6tcULbcZjKBrm/l+780PbQ92mur3FV21g9VLqfl+rdGKnstWHIFQDYEElY7mgbD1M58P35Mn5odC1J1L6pcW7bMcWNNX4pK3Pjzq/xY40rhw8BACzipBr7S5fsbFWntQ1ryP+ThC2VtvX6tXQnJYyR5/5o2pLw5d0CAKzbTzXubxs32J4aNw3ux1auYt6hxftKN5ftg9IlcIvKO8m7GeOjGm81bUkaHTYPAGyId/oYo90WYxjTkqNbSlf1ShzXt2Uodqx5E7asAs2QaH7fo03fPC4u4xO2H2o81l9nOPW60s2DGzsHDgBgqiQU75bViUnazqxx5KBtUbtrXDu4f6J0k/knJgncUM79HE7e3ze4fq7GBSuPrilDmkna8r8sIr/3zRpXN+15P0kKh74t06uGWdSRfeIm7xUAYLQkEKkCZUXlK2WlQpb7bJOxDFkU8Ex/Pa0i15q3wjaRvdn+LItVufK35ftJwoZbfySJbefU5XD5DL8e37RP5Pl8b5nvFQD4D0oC8XmNc/r7VIBSvUrFK6tGny2LJTqz5OcmCbqmdMOiB6uwtRZJ2PK3Z07Z2KRwKMnXcJXpb6Wbf3dejQtLN9x57KA/Cw52De4nspBjZ+mS4ZvLynsFABglCcZwy4kkOF/UOLvGq6VLSpbh6bJSZdo77FjDIglbhl0X+V60ixUO1HhpcH/v4Prr0iV035VuCPVg3itdkrrM9woA/M+8XePBslh1apZJspMEJnPnkiDO0s4Xm+Xjsrz9z7aVLgGbx5P95+S9AgCsW+ZibcSCg1aGCC8f3B8zuN4oZ5XVixpmuavGDW3jFPl7UyFLpWyMvMckmxkWndwv470CAGyYzPsaM2dtUakItnuhzZLtTLJoYIwsmMgw7u6mfZoc+3VPWU6lEgDgsJPK1Qtl9vBpkqfsr/Zl6bb8aLfsAABgCbJgIltwTDbnnSeWWfEDAAAAAAAAAADg/2d/mX5MVGTj3tfK6i1GAAA4RJKMjdnr7LMiYQMAOOQurXF76Y7dyia92UC3jVP6ZyVsAACbJEdH5dirWSRsAACbJEdH5UQFFTYAgC1qcrj8WjJk+nON19sOAACWZ3vpzu3c13YAALA15AzRHf0nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHP5F2o+eSwRqDfBAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAbCAYAAACJISRoAAABaUlEQVR4Xu2UvytFYRjHHz+TGJBFyTEoWZTya1DXJINNBoNkwYaiJAuKzSZlYrv/AYMSGZlsFrt/wvfb+z3d+x7vKc45nel+6tN97/uc8z6357nPa9YgB0vyMMVV2Re/kIVSknTJafgOd8wdSAetluwVjumdzCzALziZ2O+XD/ACtvjh/7Fn7iAeWM+ofLMcSTrlDbyE7X7YluUnnEvE/kwkX+B63X4THIfPks3nXiYq8htW4bW8hcdwSOaCvaCPcCARS4P/xlatWd645EG64Z28gh1+OAifOYIj+r4BF2WQUpJE5hpOt/xQcXAA2XA6m4iFGIbbcM1cD/h5oPWvnszAe/hhtSRP8MTSS8Zmz5tLdGbuGpqA57BXFgYHcldr/ljedZyfzDMUYtNcIh7KUk2ZuzhzX54xrDvLE5mbj324Yq6ENDPNkgk4rKdaEw5km9a5YN0prxrOR8WLFkQpSeJy9VhgFhoUwg8LDzwvgnGEFQAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAdCAYAAACT4f2eAAAAsUlEQVR4Xu3RoQrCUBTG8auIiEwExW7QMMEgYlLBoHFgNSz6Alaz2WYRwSwINh/AF/M7+Kn33HHHrYJ/+IXdc9jGZszvVoQaFZyZagl3ajozVQfGlHvH3Eo0pfd1pqBFOVjTAHaQkEqGcyrDHlakqpjvoxpwhRF5i+ECLfIWvCh/5WBeryO8bWHjHtpV6QgzPdK16QZdNWHycYewoBNEaoMFLz4ghTP17KFdHyZQp3+fnnggFb2Q86bHAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEoAAAAbCAYAAADbAhkjAAADnklEQVR4Xu2X26tNURSHh0vIJbcIkUOIUorcyuUot5QQuV/Og+SSayhJigeXvHggb0qKUkqKJKXkQfIiefEn+CMY3xlzWnPNc9bcM2fv3Tm1fvV1zl5rrj3HHnOM35xLpFatgazhyk5lWHyjxepQ1sQX+6INypWAU8rY0oiyhip7pRh/QNJJmK3sjy+qhii7pfieQ2JJrdJo5agU47eWb/cQ9xfFF/uiOlGZIoDljk/KF2V+aURZlPMb5aUyS+z5lA4qC+OLqkFiC7JF+am8VSaWRhRiLEn9rDxQpigjSyPKIqYL7m9T1em4qHxTVoU3nSY5jivPlWtiPyClnID3KefE5q1aoLnKSeWDWOU1EgvDAjVdxxxUyzux4EORkD2OTrGq2xQOqNBSZXt8MRAte0lZq3xVVpZvd4t2PCI233fJaydalJZvqihhVhRmKC/EqiYUwa1zEHBq9b1ILslPBUyFnlHmiLV9b8lnTuYnJlqeZ1KaoJyXar/DY5eIJX+xMrh8u1odymkHSXuo3JCirWgbvpSJ4aryRBnj7leJgM9K2uipODYGxr5WuoJ7Ux1UsY/rttgmkNIKqTb6ecpTMV/E5+5IXit3a7WyzYGuK4+kMEsmxSNIDJCkHH9iN90YX4xEkkgWczEncyOSQfsDFTRN8vyJ5+gMxsdi43mvrHef6QgsZMe/EQ1Ee/CQb6UusdVllflyEkhSSBbk+BMBU6G9Bezl/YlE8P1UMVUzQqwl8Et/YMS7cvyJ+Zg3rDr+h5tS7gTmZIEaLXi3GHhZGedAJAG/ICmHpThTcT3XnwiYXSoVBAkiUb418SD8cabYvHgJ+Hs5/kQF0yGhWHDf2tjGf6lOVKY6xHYIfpD/UZQ5W/UJKQ6K3MOXIMfI8TVMNSW8KTzr4Ed4CFv79OC6969GRk7C2TxISigWzXtc6qiS1GaxF9ZQVAtV4xOIvIk3MnK/M/JsHLCXXxQSsiy4ziH3t/Q011wj5xiC38axsWvDY2VXcJ1x7H7xfCWxmh/FAvul3HOMEnuNuC9W5ny+G4wFqu2ZmNHH8psCAfcmguI1BP4oP8Ran0rhuVtiFTRZ7IeBH8tfKstbRCy/g1ZpgfJK7L2T4uA3sgNmn6OaKVqp6t2ulcp5VUIkZbyY78aV1zb5YHMCbrZa9m7XCnHGwcSrTsWtFO2UelXqV/Ivou0M2B9rUu92/U6cqMNjRjuE5wBzDxjViapVq1atNuov8UCU8jDh6BMAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAbCAYAAACuj6WAAAAAiklEQVR4XmNgGAXkAH4o9gDiSCCWQZZkBOJgIJ4NxRpArAPEq6BsMAgE4o1ALAnFIBALxIeAWBHEkQLinUCcAZWEARYg5oBxLIH4MZTGCYhS5A7Eh4FYAU0cBYB8sR2IldDEOYG4EIhVQByQ96OAeBEDxFQQzgTiTgaoz5ABGxALQzEXmtwooBYAAGbJD5KQTUavAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAeCAYAAAAYa/93AAAA1UlEQVR4Xu3Svw7BYBQF8MviX4RERGIyGGwMSAwGg1itJiYxGQwWLB7CYjMyicEzeAYv45z2aMtAGpOkJ/lFcprb7/YLsyh/n5T0IRHoS5IJdE4GcoK8Ov4epaPOy0K2EFNXg7NU1HkJNZCGvYwC/RAOkg30zvRV6up4ygZW8pKu+QNFdXwj38xTiOtV9cxm5g8U1PXgBg0ZQ1nPwg0kYQd3WcMU5uqXMjHdHne+QFty5t4aEzf3W+h51dYydxUe5+34Kbx3Hs3V6GtCD/Df2Xwvo/ySBwlqJYa2/wsfAAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAcCAYAAAC3f0UFAAAAvElEQVR4Xu3QPwtBYRgF8MefJFFSNkqKxSCDwQews0mRDaPRIGWyKYOyGgwGKZNv5zzve7zeCN3Jck/9ltO5t/tckTD/ShRq0IcCvSVOM+hBEbZU9XYmgcZdmkOM3ZImj5EmC0dqskvAhvQBlzqcKc8uB1casDPpwI6S7PQFNyqzkwgsYE36vXqodkPSjUkGDrCnsdgjp/L8Qy6BxiW4QIXSkPIHflpwEvv71NeMYCX2CHfIp7Sh8VqG+ZU7DkIeZDv25s8AAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA/CAYAAABdEJRVAAACVklEQVR4Xu3dzatNURgH4OUjIgPfZIQRdcvIwERRulMDE2XmFlMDIpkwMREZyEwpE7qllJhSysDESP4a79s629l733vUzXH2Vs9Tvzp7rXXmq/XxrlIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+LNNkWuRI/0OAADGYymy3G8EAGBcvkSO9xsBABiPnLBd6jcCADAeryLPIzv7HQAADGtX5Emplw4+Rla63QAADO1Z5E5kS+RB5GW3GwCAId0tdYWtsSfyutTJGwAAI7DeebVs29xvBAAAAAAAAJivHZGrkcORW2XtubI8b7ZvRvZGtk6HAgAwb/m+540ynaR9jhz93VudiZybkbOR3dOhHXlGbSMBAGAd+URU1kRrfIucaH3/jZ8bzPn6NwAA2h5G7k1+5/Zmrrblqlvb08iHGVmNnJwOBQBg3t5Hrpc6SbsSOdDtBgBgaG9KvVTgDBkAwAjlRYP7Ze0WKAAAI5FlOWyBAgBQDkUuljpBTFm3LUuCNN/bi1U+AIBBNDXemkff87H3PC+Xk7c8O5f127ZFHk/6AQBYsKXI99Z3Ts5SU0okJ3S5JZs3VQEAGMDlyNd+Y3hX6ipbOh351OoDAGCBLpS69dm4Hdlfuq8pvC31pupKMwgAgMXJywX5mPxy5GbkYKmlRH5EHpW6ApdFe19Ejk3+AwDAwE6V+b1VCgDAP5Crank7FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP4DvwCb+ThGO9PPrQAAAABJRU5ErkJggg==>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAbCAYAAAA6aQxyAAABdklEQVR4Xu2WyysGURjGH5RyKbeUbKQkl4WF7CyJjSJSlIW1FVlgY2EjZW9pL6WUbETK0s7/w/N4jzpzyJyZphjOr371zbnMN8/53nPmAxKJP083bQkb60QtA7TTMbpD7+hItvvnaHLmsUCX6Tp9xi8I0EE36THtD/q+YxolArQ55+kq7cl2R6N5KgF5RAey3VEUDjBJz5zj7vqKDvuDctAKHzj1uciKhxQKMAh7WA3+mNAKC6NVzEMrrJXW2LK/Wkh0gAa6C6tRf6N10gt66K6/ooue0G1YrVdJdACdtdd0MWjXRN1gI2j3UfghWIgtVBvi/wSYoPf4PHCFPsL2RwxV74PoAFphvfH8E6OPXsJeJkXRffbpnrPsSRQVQBtWm1cPewo7++U5nYGVSFlUTlKlpRJTqcXcb4ne0hf6Sp/ctZzyxr3TS29g9d8MO1Vkoz+oAvSHTN+hEJWi+n+go0F7bViDnfU682vJLJ1DXG0mEolEIsMbWxk5RGk9wS4AAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAbCAYAAAA6aQxyAAABmElEQVR4Xu2WSytFURTHl0fkUR43JRMpyWNggJmUIiaKPIryAWQmiZGBARNDUnfAXLeUkolIGZr5Pvz/1j51zlGnvc/d7u2yf/Ub7Mc9d6991l77iAQCf55u2JLurCV+PYAeeAAHYV1qLC/tcBTuwSc4nBz2D3doA17ACVifHHZmCa7CLfguFQggoln0zy/hDGw05mVacgTQZlwU3dVCctgKLnoOXhsZFINzxTkAvv4r45hp38Gh+CQHmEqUb6MI18UtEKcABkQXy8nRD1pFg+FhKocOuAtPRQ+9LdYBsHrswzPYYCSd8BYem7YLffDIeGjarlgHwFp7D5dT/fwhH7Cd6s+iH56IvjWenzxnKOL/BDAOn+XnxDX4Kno+smAK8iJjCu6I5rwPrAPgDvPGi+dpLyyJXiZZdIkunCXX95VvFQAPLBfAxZ6LLoTeiNZyX58HLqzAR/gBP+GbadOp2LxvWNYeRPO/SXRHabmfAxWD+f8CR1L9tvDWnYSzFvJCY2n2yqZorc/74KoHMA8XpDq5HggEAjXOF5VBP0Pie/V7AAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAdCAYAAAAKGSQrAAABtklEQVR4Xu2YyytFURSHl7c88kqmIq8oAykyIUoGSimFJI8kRkoUxmJCGRgZKTOmIsb+Lr9fa+06Tt17nHJP1uGrr+6+++5Oaz/W2ueK+KAcbsDteId3uuAVbIh3eKYGXsCheId31iRnW7ASHsI7ydEWzF1QDGgJjsBrcX6uysxVk5+/fa6a4aLoTFAODnTA+kg7S+bNY9HVIv3wRhK2YAs8gqPw0eRA0g6f4aS1C8EHtKWwToclUmWGgAJ8Xvy7L3AmuDpj8N3stD4GGm0XYhBOpbBbh5UOzlqFaGbhslIWOsL9ew8brZ0lE3A6waK0wie4YJJq0UxzGn6UMXuiE1rMovAMvcIBk4TzNAt7zUJswpcUruiw0pLLoBgIg2JwIfPNwA/rW5bkZPHrYLLgtf7M3IH78EE03e+KJhN3sOA2maGOsBawMPMl7Z8fhpMaJpqTXxvpc8swPBENiGeeZcblcYgSrZ/MxkxcbuHKUK4SV4uEe6pbeD2jl6J1k+fqXPSe2hf5nSt6zDe4Lvo32S3cEn27cEkug2JSoCz+3HpM7aydfMdyy4E5Hu/wCldlzuTb8t/mE/gqTf5GRV1YAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEwAAAAbCAYAAADWHGlkAAAClUlEQVR4Xu2XzatNURjGH5conyEllCTyFQYUoQ4pRQbKBKkbBqIUSWGgGN+UEVMh5WPAACF3amAimZiY+yN4nvO+q7P2sva196l7zlHrV79uZ+2zzt77Xe9613uBQqEwwhyl1zOeorOj7w2aFfS+e4MurV7uspJeceNn30oX0YvJuDzcndmbG8YVh0aUgLUM2Hy62/1Kr9FlsBvOiL43DFa5H+i55JqYRde4L+kTuhq20GOwIE/QSbrJnauJsLk76FO6KxpvxCH3J91ZvTRUZrp36EO6oHq5i15UhmyMX1wLfpu+gQUvzdKD9EAy1oib7jtYdo0a++gP5BczDlgaVGXee/qFbnADi2Fbdk401gjdQDeSdzHculXHEvqCXkV9mbiFXiYJbTkFRPUvF7DjdHv0uTHr6Gd3vHqpEaqBId2b2KpWOAqSgqWgKXg50oApG1XIT9PvdJsrVBfPwLZ7a0LtkrmU/xeb6f4WrrVprTlCf8G2Z47z6GWSFuUS7ODaS3/7X6kgKVgKWl+E2pWrX1rZDp2XjA+aPfQBfQU7AHKZoUwKAVMxV3BEGjBtQ23Hvgj1S7UrV7/UC2nl6urGdNNxH9PlsNZCC6vnSjkB2yXahhdgNUxo12hcc6Xqmgp+X5SAtUTpqzQed2MUpLOwpm4qVA/etvCkTZsS3Vvb6qOrhlNsgTXXqrspYes9QvU0DO/42s3NbUzcrMYFX72JaoI657pTabqIgxW684Ce656b9k8hYJdR3REhYBNuOq8RHdhqf4OdPJNuyAKN6+bajoNGbc4n2Ima4xisBYqzSGykz/H36ac24xms2PfVd406Y7DaWlc3dV01KO3nFsL+j0xRRq2H/V7dbxYKhUKhUCgUCv8/fwBzDInKMNUuSAAAAABJRU5ErkJggg==>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAcCAYAAABlL09dAAABQklEQVR4Xu3UP0vDUBQF8GsrFqQKIqKD/xFBF8G5g0NB6FQR3EQHZ3FSpEPByUVcHASFQod+gQ7FzdXB1TnfRM8x58HLqzQppU458IMkj9x3cxNiluc/Mg+XcOu5gS1Yh+tg7QoWoQSnwdoxFEyZhFXowJMs6foU7MK7xRsQG+HNE7ACL1CXsgWZhmcPz10W4A0a4mfZ4q65CfWFnT3a34XZSQRNcWEhFmXxgeFNbZnRNc6Sj9+CO3GdbcKJjgeGhXvCOTJHsG/9YyrCmcUbp2Zshc8tWdi9GH4d95YsvAe137syhEU+ZNvi+W1ojU/TFXZ5AXNaSw3f/qewGxZ2L8ofE9equp4pFfgSfnr+/Pg0blNu4n+OqWHhb2EhPzyP5MBfyJIdeJVwfofwIPxHDJWxFZ6FNQnD/wV/TJQnT55R8wMfSEIg11GLiwAAAABJRU5ErkJggg==>

[image19]: <data:image/png;base64,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>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAbCAYAAADcQMc2AAABc0lEQVR4Xu2VSyuFQRjHH5cQFi7JZWcjt1jYsFOuSwspys4GO0lZ2VjY2CsbWUhJKaUs5GTvE/gIvoT/v3mm3nfiNPOeIe9pfvWr08yc6f3P5RmRRCIRQDPsdxvLTt2EYpABuApv4Em+u5wMwh24AK/ln4Vqgsuw0+3wpB1eSMFQHWK2egP2On21sg4n3UZPCoWaUfnHCf39AEeyg2qEl3xPzD2hIQSHGhYTgI5qm53kwA6KxDzcVVvzXVUJCtUAD+GZyrNPuuCdVJ9kDh4X8Fa9h1PiR1CoHvgI11QLd+wdbmfaYsBCcaTOwsZ894+kUNPwVUwIe58IK9WbmPsWCxaHfTiuhhAUijvxAodUwhec533LDooEdyZ7GkLwDsWiwOLAAOcq36cruCimiMSCc7Gc24XzpRtewgr8hB/wGZ7CNjVHH3wSs3otKifxPeeh8ANiLtS38D5V4JjTXmo2xbxFfJPqhiW4In9wJBKJRCLxm3wBaA07w2BJT7EAAAAASUVORK5CYII=>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAbCAYAAACN1PRVAAABpklEQVR4Xu2VTStFURSGl29JhBjI4ChJDJjKR5QiQ0rkIyNCCTNKzKQY4heYSKZG6paxqT/hR/C+rbXdfXfncs/p3Du6Tz2Du/Y5e+299l7nilTJiHZ4AE8DZ2ET3Azia2ZDzLvrsFH+IHyhrMlqYQ+8gzlzGLbAGtEJj+AnnIStJuG7A/ARLnrxf7mAr2ZXMLYNP+BQECdjcEV0YSXDZG9mrxfvEF35t+jOfFhmlpHPJIJnw9X7O+BqN0QnjEs2DeeCWEnEJesXLeGUaLJ5ixOe5b7o2SaGE3FCt4M6uAP7RJNzEVyQYwmOer8TwQR+Mk7ECYmfjMkpF8IFpWIcfpnsl0PRUpEIvsNL0bJSljg1FU3mSkVfRG+ag33H/svBLTNRX4X4yW5Fe8jhkj2J9lSxvmKD70l+96uw2Rv/pRs+m3zJh9f7AS4EcZ8ReAbr4Yx54o0XwJ0MmmGJeOsY50Rx8Plzyffhrsn+zByW6lr0KFiFKzPynsmUZdEPMvvv3kz1dSkV7nACHptlJYI3ot9M2lYwmjGRVDAZ/6nZk51msdtbJT0/BXlSoZ1GMagAAAAASUVORK5CYII=>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAbCAYAAACEP1QvAAACHElEQVR4Xu2VTUuUURTHTym9qJVWLjLUiVrkKiwUolpKGQiJblJsa+5KsI1SrSIiaBGK0KJ0U9TOoARbDLnuE/QR+hL9f3PObZ5nHidwICWYP/xg7n3uvefc83LHrKn/QAeC02JQdOQ/53TCfM3J2g+Nat+Mt4qFYFHcFm/Ftewic+emxEtxU7wWkzEPDYkD14JjMXdFvBNdMUY3xBfRE+Ne8V6cC3YtjK2LJ0FSSXwXV0VL8FysirZY0yk+ibtBQQPilmgPTokJMSQOxvirFY2n+RlzY4DhrPE0V7u3IkIxLR6Y3w7ui7PisXm4k/e1B5TEtnkNHApe2c43XwmOxHxFo+KimBcvAooLcSOcOS4eWvFW5PeX5R0aF59Fd4w5+4cV91bEgJbhQ21eiAAH0S4UFZULd8wPxaFyrEs6bB6xWXFezImP5rUA1EVOVOaGuBSgFELgNyIiQP/CBfOw01JZUSc4NyzOmIcdB7NO/tG+GqdVqFrylHKFQ9/Mc4j6zOsDUk3QDZuiP8aIDiAtR2NcElviclAQHlFY9DPwEt0zr870hFJ89DTgCLmjyslt9uW6Ln5a1RD7nlk1ajml8H4QjwKceWpe5UmEcDkYMTe8ZNUbJtG6b8yfX4qNs4nGjiLMhJzQp4ei3h8GVQ/cjtvXe6vZj7PknfzXFXnDeHqL91SEpSzGzD2ud+t/IvIBPCKE6K9haqqpphrRb3SuWPPhSknbAAAAAElFTkSuQmCC>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAbCAYAAAAJUhN7AAADzklEQVR4Xu2Yy4uOURzHfy653yKXUZgUuZUQJZeFSI0UuRSyEAsWNpINUuSSiJXIQiYLk0ukXIqaLJQFC1sbe38Ev49zfs2ZM+d9zuOdZ2Y251vf3uY8z/ucz3N+l3PeESkqKioatMapV3t3qEf1v/xPjHHN7uM7QyljMp4cUzs8U9Rr1DPjC02qLO4QCLgu9UP1Tu8L6mviJjbNUt9Rn1Lv8e5RbwruaUoxk/HkmIwnxzTW+5j6lrg5bqtP+/HGtEH9Rb0qGGOCm+oT/u/x4ia/oh5jN6nWqV+q5wdjTShmMp4ck/HkmPZ6v5e++6aru9U77KYmdF79TlwWhDopbrKp6iXqr+qj/e5wYJ/ERb5JpZjgyTEZTxXTBPU97/vqSX6cAN3wDhOopRapd4uDnOi9Tb1LPVncg5kgfhEENPC8xGb1Hz8Wiu/wXRajrmImeOowMXeOyXiqmMJ7wsVFl9RvpEb/JYr0ogPi0t/Kapm4l3msnqO+LANfBJEl38Tdv1z9XQYurmUKUHWUYuL5dZgsc6uYwsxtxcRi0stxKnPjeZMiO9arD4mLBjsqRhY9Soce81nd6a8hy54f4voem8gj9ZngHrRF/Vt9VT06upZSislUxWQ8OSbjyTHRt/Ez9Qw/Nlv9Vv1RPc+PtRST01+IBpkQHmWsX/GSbBbnxG0Mnd6Ms4taliAy5bl6u3qlN9/rldZZEivFZKpiMp4ck/HgKiY48F1xJ4QF4habYNXKXERUiA7HlFBkxy9xWYR4yYXqrd5zxZUgkSSiJnokOznnQkz/pATjdlGldpiMJ8dkPHWZyGwCRf+mzxL0uA+3VDsvUha35uLyq6VXXPmYgL4orgQojWnqfdK/FKy5n5W+0uUFOJyHpczzP6gXB2M5xUzWrqqYwmNSFZPx5JjoqZg5CA7ieNet3m835UR2cBgPJ1qhfuU/kR1p2GxM9C82nKX+b9tQnoo7bNsvHBaEPmfnQoDJLA73HPJTipngyDEZT47JeEImsvyF+rr0/Twmq/FP9Vo/Rt/mWWFVtJRFGyAezKaAH4grIRMPA5KIHfTuUW8M7kGHxe3AQLAZYTYcMs1kL/Ja0ptCigmeHJPx5JiMJ8UULjgBwlRKl/q4+okfq6WwtxExoovDsjZxnQiaLcKh+F6HuDLkE6eehYBNLW6KydpCrJApxYNiptRzqkQQaC20KDK/tug/lB+fwykWjI0ntSAjxdS4+G8RB+4jUrOPNCAyh1JOLR4lNxJMQyLKEnPE+K+UH4RYXDaaVHlSgiPBVFRUVFRUVFQ0zPoL/I7fI9ZsYyMAAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAbCAYAAADlJ3ZtAAACRklEQVR4Xu2Xz0tVQRTHTz8o7JdZhFhtSpJIFxIEBRJXJApXCkElSrUQghZROxF/IKFupJ1EhaIEodEiXEQrXQUtatG2jeCyPyK/X+fMe+Phzn1Xnz548D7w4eLMvPfOzJw5cxWpUR2cgoPqCdMXg+Me63NXHICtcBrOw4/wE+yCB1ULf2wStqhpNMLDthFcg88lva8kVREst5G+hiPweNB3EX6B/SonFDKghnBMPbwBx+EKPBsOUDiOqdNnO2JwZWbVIUmf5V34R20L2s/DD/oMOQIfwm74Cn6T9GDJZTgnbvUzYWAMkCtHz2zvLnAV/lIfBe094lLmUNBm4apnBcuJzcA7tsNyE67D+2qMMFi/5QyQgYbBp1EqWPIEDtvGEM7oDfwhbitojAT+V32wJ+Ei7NC/Y+QJNoFv4THTXuAc/A7fixsUHSgu7/6pt7SNP85KwVXPIk+wnHDmGL+1E+JOpT3lHuYx83lZbdD2igZ7Bf6EY7bDcA9u6JN6asHaDs9p+FmKiZ2Ws03iCrqvv2EN5hd/FVf4s8gbLA8rD22UXvgbtqshDHRB3I1WZ/oIJ8eJJqbdkidYlj9WJlaoKFypp3BV5Yc64Uu4JMV3ghisEs9so/JCXLX5K66KrIn7TtpcHLYFa6y9sqP4NLgOb8MLkh2kh5fKOynjNU9cOvLKLpX7ZcMJcvtsCu0ETpiHPOvK3jP4mjcKj6o7gTsyBS/Zjv0kgQ/U2OVi4XnhfwqJaa8IPu/z5DrhuLRyWRGqKtgaNfaTTXOWY4TKbKsUAAAAAElFTkSuQmCC>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAAAbCAYAAACOY/p9AAAD3klEQVR4Xu2Yy6tNURzHfx555f3qXolNEjci5ZVHRwkTMpBX5A4MhIQbJeQmCXmUvCaeAxMZGKEoUWZkIONThv4Ifh9rLWfddfY+d++zj3PuPe1PfeuevfY9Z63fa/3WEikoKGh/RqoOqGaEAwMM5od2q4YHY5kZYjVPdUn1XvVG9VS1WjVVddRqjP2fZsICe1Tr7Gfmul11JtBh1Vj7DjD38J353ngaOlUnpPp74sTvOUqqXWLmWjeFY5LplBY5ZrzqstUr1QrVUDtG+WBS71QnrVpBSXVaNcx7hgM2W/1SHVdNkL6GIIh4jq6rItUIbzwNvE9gXlV9sOpSTbHqUG1TfRYzTwfB1CuVYMoEi7vnCSeFzJXKj6JmwxzvqhaFA8oCqy+q7r5Df8FR56wmBWNZGKd6prplFefcg6rlwbNVqjuSscrgUdKPbJhpFQdRQUmLrJoNi30oxjgh06zeqi4EY2TOHjERW1fUejjnH7JyYJuJ9u/9Yt7zYeyJxAdVIiVVWYyna8GPs2i8nsnzDQJDnA0fWlg4eiEm40d5Y+wlx8QEYN7uiHJZFhMkLitwPLaL7OdlUm0f3rkoJkBSQSqSkpQoSlVe2JMoFa7uptFkqW0w9hN0RUw0xuGC5YGYUuOyir0RZ86xn/OAcc+rvqp2Wm0Qs9/yu3GZ7NMt1dmciEt/fzF5wBB0JEw4rdZLpQzE4Rt9bTAWwsJfi3E4EOGpo7QfXEZiq41WzJ+ASdMMEVSsIcymWFzNJM2ICB8+h63oKdVsq2aRxTEYiPWwLoKOOfttcx6SmgvmRAAATQaBFkcmx0SqT5KcYiyKZuCR6rlqljSmVmchi2NYfFlMq8+etLTPaD4I0rJUd1zYx3WxW1UrvTGfwjHSBo7B8I+l9j9w38MNQJo6ygRvi7ktSKuXqoX8cwK+YzBOLXDcbzElF8eE5ble+B42fvZjSmQcND00GkmlE8ewH/mH45qwgX1TbZLKlYyDv/eJOVGXvOetgKzuDh8GLFH9EOPsJAP6YKRe1Uep3bm5jT/pUDldzI3CjnDAA6elCe5/YHw6DFrm+1akJLop5iaXc0Bk328VZEt/EReJOSiznjTwXVzx/FStCcaA6L8h5vqF4Pwu1RnvxsimpBtvzlWc/Os64LJvUFIQWdQl8dHRKjhnsc8lLR5o1xdL9j2QFj/OMY0iErNlpMniQQfRTfu7JRzIiSvXUfC8kVDi+rtZGdR0iClneS4iQ6gMe6VxjUJIp+qaNHbOAxIMeUSyl6skqP+N+i6f0VY9UrvrbCv+lzEbiTvv+ReqbU/hmIKCgoKCgjr4A6WdrmGu+ZvIAAAAAElFTkSuQmCC>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAbCAYAAACa9mScAAAA70lEQVR4Xu3SPwvBQRgH8MefKCkkA5uU2CxMlOzKpCRmsZMo5VXYvACjweA1MJq9E77f7vnV73fIbzBIvvVZ7rm77p47kZ9LAiYwt7RdcyLQt+pjiDsTPrJJEFKwhouqQ8yZgAQgB1sYqrSYtZ4M4KzKVo2pwEjMhvQ0TbgpnsQdHptXyFjjD6nCVfU8FZEutKyxpynBSfHYTvKwgKhr7GXYqINa6VgYZlB0Jr1LEnZqI+Z1GmKu9rKRdriIi4kb8RpLMf/Idz6yCcNe0FFMM2vesr/wVYh/ZQohb9lfOmoPWavmO/yRVLAL//zzFbkDEekqPeKxk7EAAAAASUVORK5CYII=>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAcCAYAAABoMT8aAAABDElEQVR4XmNgGAXowBeKK4nAWUDMA9EGAYxAzA/FlkB8CYgLgFgYCWtBcQcQzwZiLrBOLMAdiB8AsSmaOAxIAXEVELOhS4BcAcK1QLyXAaIQBJiBWB5JHiSeDZVDAbxQvAiI+xkQNigBcQpMEQPEO+pIfDjQgOKzQDwBiB0ZIIG6jAHiLYKAYgMCoPgBECczQAwIBuK1QKwAV4UDwAIPhHcCsShUHBRVoOgEhQ0MgGJHHIkPBgJAvBqKkQOQHYhVoGxBKM6HiqMAmN9BOAFVCg5gXnRBlwABmN9BGD0BMTFAAnEeFAshSzoA8Q4gvgLEr6H4AFQMhkFy/xkgaQE5PYCBAwOFBoyCUTDwAAD5zjbGouXLiAAAAABJRU5ErkJggg==>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHoAAAAbCAYAAACz8ZsbAAAEo0lEQVR4Xu2Z24vVVRTHVymm5j2V0qjxFlaiqCSJKdONZLxjJXaBSQRv9ODtoYuIF6KStCLFSlDEG3hBEdRAXwYEfbCHCF96mXf/iFqf9tqd/fudc+a3f2cm5zizv/DhnNm//dvn91tr7bX32iOSlJSUlNQH9JjxsnJAOaGcUs4qbyqP/9ezb2qAMsrADl5DlJHB37EaasxSJkpt+9HGNaAf/WspZqxoJUf3A0ePUL4yvlXGB9eeVS4qH0klGPqinlKuG38qN5SbSofyUtCvSNinTfnVeEfZJM6uw4J+/N4huwb0o39r0Cd2rChxwxHlM2Ng9vK/WqL8ocwwmkGDpRuRXUMY/rLxm3JV2SnZoI/RJOW8MtlAOGyHstW+A99pCycP/bmXMVDMWFHCqTiXGTvOqKUXld+VtUYzaKbyvfKWuPeoFaBlhKN3G/VSaIw+Vk4qww2vleKCZ4w4O18TN0NDsWzgWG/jmLGi1Kp0Ku9mm6s0Xbkn7oehWcSMXiQuI8Ey5YlMj3jlHU2mG5TpUSxm2F7lqFTWVa/XxNkQW/qJQ1so+nMvzxA7VqF4CdaIW8qE3LW85isPpPkc7YXDgVn+o/KJ8mSmR7GYTdgDDipfiDMyKZINWYy8o+o5BxtiS77/bZ+h/P0ELbM1ZqxCkT5YixiU9a4rbRQ38EKjmcVMmCpuw7JF4nfM2GC94e8hXZI6Y9fDIkd75xY5GsYG37saq1A+HZMmuhIp7Li4dZwoi14XSuptcfuFF/IXuqHnxc3wDeLKJygr7MN6Wm//EqopHT1NuSvFjm5V/lIW59p7Wn5Ninr4AjUyqzk/IOVDWLpgn9j1MHZdfahrdHJ0Vn3W0X79+Vqyp0LrlBXiypWnxdWV9errnhYvmH/5MsI4OKyRDRm/3Wm8kmuPTd2IzSolkrenFyWTH8eXV5RJoVgWKZv8hjdmrCitUm4rs6USzZySvSpuzfxZ2SXVu07qvwvigoRa9j1xgcDnZmO7uHEpW/Ypq5U9UlmDfe27Rtkm7rfPSXlHs9ueaxxW3pfq543REmW5QcAgMsFpyW7GeM77xjxrCzVZuWSfgLiXQ47wgCT/Nwrvzf9db6woYWge/I5yzOAA4lPlilTOuOnHZyiijR97RpkirobFuf7BKdm+UVqUD8SlHlIWbexwaQOO9Pw9ZVI3z0MNTaC1GY3W0IjnI6iBKoNgJnD2SzaV88ydxodBuxfvQZ9fDNIrwUd1E85AsiUZlWtAv5/ETQjvwNixosVLzjEwNCXUl+JSOgZdKtVnq/mamhSHo14PoM4jQ/Dwn4ub6TgmrFnD06EyqRsnL5DqAOyOfMA9J258grjWrGF/A/nUG8pXKLxPi9R+TiYQwQ9kh7yNvWLGakhEToe41HxGnKPyyjua07V8KmJWMzvYENHGC30n7qVY96Hd+qIyju5NEZwQruWPpHAQhynUaj9IdaQxU08ZpGxEH06TfADQzjJAdiAl8S+2dnHrPocS/t9zpMY3DGp1+vZkLd3TIuUSvPAwNqj/u3DcaCmfJjha9XhhkHywhGLp4HfKni33hmq9X1JSUlJSUlJSUlJSv9U/O8Tmmw2YunsAAAAASUVORK5CYII=>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALUAAAAbCAYAAAA6Rc43AAAGDUlEQVR4Xu2a2Y/kUxTHv/Zl7DsZ5mcNsa+xT9sFE4wlCKYZ+77FvjRCGGtEbBFChAhe8CIIMSFEeBBvIvHmwR8xzifnnvnd/nV1V3VVdVfN1P0mn3T1797fUuece+6591dSUVFRUVFRUdFAtcR4IOMKY6OsfWfjzkafm4zNsj5F3Qk7Y2/I7Qv7pD5bGjc32q43FqT2ohYqQT04laCeIxGcxyR+Mf4yjsra1zd2MV5LXGxsa6yb9SnqTuvIgxZILquMpcY2crsj7LzM+DBxYurPuUUz6PTEcuMn40ljvax9U+OuxObZ8VERAbZB82CfdYOx0qiyYwT0hfJMzjNEoBe1ESOecgJ2kwc0gb1H1qcybk2MYobY2njYuFGeJfupjRPMgu+rThqbyJPIcRpNm/ckjHhHgox8tPGPcU3WZ8w4IzHKWiQf9DFrUYb1Kko7+FZ+TURyeUi+ninqQvuqXqwgaux3jc/ktR26LvWDImnHBEFIkBPs3SrWM/8ZZxonGL9paglYNAtRS2NICFHHYeTTVNfTZPRRrKfbKXYnVhh7afalArU0/G48YVxiPK2pJWBRh4p6OqbAEJ+/Ml6RZ+eopcNhOxkL0+ciF1tsBCe1cadlSdTS8I2xfzreqgScT4V/p/MxC9b9NHnrd2gU9TTZGEIEL3uhf8j3RZu19G3yhVO323psSwELsLVB3WbrqKXzehq1KgHnUgcYe2b/h3/Dxwy+PAYotz6VB/bQqQR1f1SCeohEacEisJWo56jreCGzd6OtFzF19XP3YJDi+XtZLLKOYe0CY5ObVq9rWDzOpRiA45p5E2BXeQk69OLL8HbwlGZDEitvnJXvnSKcRw14u3wE32O8ZVwgrymfSWwvzzjjxjnyUb/YuFc+A8A7qZ17MbiWy2eO8+TPd1WCZ7jIuNZ4XvUrZO4Rr47ZAmMNQMZhS+y+1J+6lD3fIxJXyq/FOfns1KnIrg9m5GuR2Qp7rUxUk5tWZ3EydvMnCWRNMuWE3D589yXyrArYD/9wfWxKIolz8M3LCRal2INFKm8r+TkEtg3/wu7Ge8aPxhvGQap9kmd3ziPD08YA2CLrh72b/uOZiD+e9RZ5/PSkMeN7eSb4U77qBoI0FwsWgrCp443H0meyFcY6PP3PcaAP5z8idwp7rgwI+mMciEzNF+RLV/JA44szO0RZRN+zU9/YfuT4c/L7QlzjQLlTYueAMopz2VEA+uJ4/m6Y+nQinv1xucN47l5mGZ6fhTg/Sfg3wULxstTOoPxE7p9V8oAiaCHENcbTZ2zxuuo3wwTwofLEMCHfMkScQxLCF0BQhh3zTB3+DR/n/kb5ObHJQEKJUgm/059kGL5r+o97c43t5PFBCTRQNYP6I9VGyYOaDEnm/dX4XD5CWwU1xscJDAAyK9mJ6+VBzfVQGKUyPpZPjRDivC+Mc42TEpX8+kBG+lteA3f62pkgI5MsaDYMUGGHEIMtyjqyK9n7avls2LRdrl6DmjbARzHzcZyYWJiORx8Uz4DtGcTfGT+rHngDU6dBTTY8JB3nR1J3a2pQny8vC96UL7gwzIvGyapf+LQK6q3k0+LBCcQWE/0phyJTM7AI+pgCyc70e1T9XSvMt/IApXyjrCCIAbvwnUkWzMBnyTNhu6Amw+OT6YKaNvrk52BnwH/4BB1pvCDfCJguqMnUY+lYpbpSgHkX0xZf6Ev5DgaZlcUkmYEvzHF4VV6zvSTPkNRPTEsE1ERimTyj7iAvGWL6ZCqjXqUGgx/k9xwzPkgwshk09AXuTTblTR9tzxqnGpfLjcb/QJ/D5PVmZJY1UQTG2/LFJnXz/arLIr4n9l5sPCXflSErhu3yUobAJ8tTpuGvRar9C9iyktv4Unl5RyL6Wu5zSgxYKn/ngc0n5LMy/cJ3Tf9xL2LkWLnv8tJqqEXtitEYfXxuKq9p6YdxWvWbSZwHBCh/8+P5MbIZcP2BZIM+KzIeNmw1OKlTOy2vEL9CzO3XFHZrdz36tHqWVuJe9Oe+7a5bNAKqVC/u+VxUtMarUgnqorVMTPFRP3c63RcVFRUVFRUVFfVP/wPp0x49/7nRzgAAAABJRU5ErkJggg==>

[image30]: <data:image/png;base64,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>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAcCAYAAABVo158AAAAtUlEQVR4Xu3RqwoCQRjF8VG8IQheEExegqDJLIjYrFp8BouYtIhgtPkAJsWmRQy+nudj/7O4cZvCHviFOcPHzsw6l+SXUpMFWl99XjpI+bIuW5niJmX2bH1GkS7+wFx6MsNVSi44wl52CGOTBTlhSW9DNuy/HElb3hjQdVn3EclQnqjSTeQlDYwly54byR124YwLzn+UJuzJw9hLXbCSjazlIQfYvwgTe8CSRkVydPaCXpJ/zgfoPSBADfLaNAAAAABJRU5ErkJggg==>

[image32]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAdCAYAAAB8I5agAAAAmklEQVR4XmNgGAX0BBJA7A7FAlAxOSB2hGJGqBgYEK1YBojTgTgCiquh4uVAvBmKhaBiDGFArATERVAMUwwyZBIUw2xj4GKA6FwFxbZI4olQzAYVAwN9IN4ExVJQMQUg9oViFECS4gAgngbFHFAxeyDWgWIUAFLcD8Ug9/EDcRwQs0AxCgCF82wojgXiQqgYTgAzRRBKj4JhBwDafxcVrhxqIAAAAABJRU5ErkJggg==>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIoAAAAbCAYAAACjvReCAAAFfklEQVR4Xu2Z2YsdRRSHj2tc0ShqVNTrEtEIcYkrKiTghiBR0QQTxElUEvcFBVccoqIirrihaEQwghowKKggCIKgiD764kvABx/8I/R8njrc0z3d9/bt7mscpz74MVR3V3fVqV9VnbojkslkMv8HrlF9pXpKtU/SOO5Joh5/FyptYufPUYe6vGMiLlA9rfpQdWLp3jShoaeULzbkUNWm8sVdxAGq21VbxQbBBw92Vy1T7Z/KfdEldkDdbJR/mQVjlP1U16p+lm4fn5QunW1qlD1UG1WXqPYs3esLzEB7XlC9lURMgUn4p+rRVO6LLrGDVkYBKrJvdfn4pHTpbFOjAAO5QvW6ao1q3+Lt3nhC5hplsWqz6mx/qCe6xA6yUUawm+o01auqDaqDirc7U2WUadEldjAVoxynulN1v2q52AyFg5OWiA0czx2vOiaUmVHkPYhrPEsdqOos28N5qgtVi9I16q0OZb82qVEcDHOS6kXVA0m8b1Iw2hWqG1THqmalaBTay9azSnWRVfkH8pWrkh4WW+XYGsl1HI854pnLpdj/utitVF0pxVWT7x0RytCrUQjoOrGZQlD4+K2qB8UadVjSbarfVI+IDcBdql9Vd4gZhYajn1RPipkFYmf5FrpZdb7qZbEBgLtVO1XnpDJ0MUqEAUHPiLX/8OLtWjDyF+kvbcEwP8hco2Dw78RiCFznW0w4BAPVG2Lv8Zh/Kjbp0NGqL8Xi4NTF7mLVc6obw73HVVvCc9CrUc5VfaM6IVzDGJ+rLg3XmAlk/Kw4QIfp2NWp7CvPfVI/K/gGIkiHqLbLsD5l3n9qKkNfRsHwiBnNANPncTA7d6iuK12v2nr2Vr2U7gEr62eqk5Oc9WKTinj8KDbgDvHlVOrxgKrYYQ7iEmNH3D8JZadXozDwDHhclgkAgaDzBAHBLWINomHMfAxGLoAxKCOW2kjsrL8LsaJQf5DucXJhlcIwTlejsDqy5L+StEKGW+o42E5+T38jVUbx63FFeU31R9LHYqu0x5jBxihLU7mOUbH7VoaTm2con57KTq9GoXN1RvFgeECo971YQzmOstWw8rAVYSI0SM86sbOOL5VuRGAVY9nFME5bo7BfbxAzMYltXI6bcr1U/5TQxChAG4gRwigYhlVmidgx+muxPo+iLnbkWzF2rCSMQ5xkkI0yhmwUo1ejMLjlRh+o+kBsMGOQ3UDPiyW3PEd5c1AcaKjqrL9/Jlwjf0CRSY1CMk67nhUz76TmiLCN7pTiSQaaGIXTEXlYhPh+JJa8M7C/SDEfA9rLO73dVbHzMZhJZZ909JmUYGUStDYKnWdFiB/H4Tg+DtIZYoZaFq45JHf8CumJLmX28suSylR11o3iWTuJHCaLgYemRiHvYOY+pDqqdK8ttIU8g9nrA0c735bxRqG/74nNcJ/lvGNWLIHFNCSjHIk90QYS6DjZqmLHN9+RYeyOFFtNZsRyFFZ5BK2MQgVM8lf6S9lfMhDrGEc6Ovu+6sx0rwwJ1DYZDkgsVw1SVWeBWcXxkGSTbw4Kd42mRpkWDCjGmBVrL+1kVWCiILaSs1Tviv10gDi5MGAk/fzcj0jwOTRQ339HYdXZqnoz6SbVY1Jc2etit1ZsohE7zLZF7Pcir+/vaGWUJtAJlu9RS3Z5eYzlqnp1nQX22MVSfxLZ1UYB+kRMPC7EiP6WV78IK8ReYv1C9LHued5XF/dRseN9Xsfb6DmLMzWjTINRnR3HJEbht4tVDcWz84EusYNslAqyUeYyr4zCMZPEi72cJK18KqqCIy1arbq3dG8h0SZ2/hx1qMs75gXspawMcT8dh+/b1Iv/RFtotImdP0cd6tblRv852nQ2G8VoE7t5a5RMJpPJZDKZOv4GdKsD2W4b6OkAAAAASUVORK5CYII=>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAWCAYAAADNX8xBAAAAZ0lEQVR4XmNgGAWjgCTAAsWs6BKkAiUojkKXIBXAXJQFxOJocmQBOSDOBWIedAlSAYZBIGeaALEjGTgJiBcBsTEQU88gcoEqEOcDMSe6BLGAHYoLGSiMNQ0ojkWXIBVQLWVTzaAhAgB1uQ3VLHRl9AAAAABJRU5ErkJggg==>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARoAAAAXCAYAAADUWoDQAAAHTElEQVR4Xu2c+a9dUxTHl7nmeQx5zxhKCA0hVF5rTKmZ1JiHppWKqWhSQ1SJmGpKTSExhJYYQggVhEgIESIifvFLEz/4wR/B+lh7vbu7797nTq13X7s/yTe97wzrnnPe2t+99t7nVaRSqVQqlUqlUqlUKn2wWdCRqsdUr6reUK1WnabafOLITYO9g7ZMdwR2Vh2r2iOIZ9cPcRz/HaRwDQeqpqu2TvbFpLGaOEm1tKAlqtmqbSeObrGDapG0n+PnzQraxk8IcA+XqN5XfRT0nGqGaoFq99ahlY2VnVQPBT2q2ivat7/qPdVV0jl5pzLcGw31eNUyaTWGtAHQYK5VPa46XXV30J1hX7fk4hAjjTOqekV1heoCsQ7giCCnFIvtpWvaTjWiWhX0uepQsfs9QLVQ9ZWYIcXQ4eyqukj1j9hxnINGxa4BrVEdZqf8B9d/r6xrQNurlqs+lfbn3MQWQZUpBD0UPYv3SrnEPEf1q+qodMckMk3Wb5VFpTBPNUe1WCz5cw3gBLGGuVv4mYaDnlJd6Ad1QS4OMeI4bFshVgk4J6reDKLBQykWcZquCbN5ISi9Vxryw6pvxKqplFPEjObqZPueQZ+IGST5tYvqHbFzUujIXpL259zEfGn/3sqQU43GqEZTjaaygcBUMBeGRp4gOSjTf1Zdnu6YRI4Wa0wMFXLmOAgkcc5oGF5R/tMA09Idc8KwMcBOlOIQI45zuNjw5ZjomFGxxo8Y1jTFIk7TNTUZDdwnZiY5gygZDTE97g/SGo4RPzZMh2u+Rdq/uwRm6sNVN9bKkDOmWiv5BIgh4X+S9qSabKhoThVrTHOD0knIfigZDQ2I3pcGmOLndNNgSnGIEccZE3vuPH/HGy3i2KZYuXuIaTKafisaqhevYKhq6LyoaqhuvhPrGNyMHD53W50yT0UMdFayrzKEMFR4UvWlar9kXwo959/SnlTDAklKhYOeEZsYZaKxX0qN1Bt52qiBc7wH70QpjhuNx+Fzk9HQqzfFIk7TNcVGE08G7yM2PPlMbFUoR85oqK7ODPpFbBjqzFL9IXaOi++8VLrvHDAsKjX+ZeL+jvC5MsTQ05BITaW1c4OY0cxMdwwhJPshYqtnN4olZK/0azSpKZQoxXGj8Ti5mLHRcH5TLM5Nz4+JjYY5OFaAGEo/ITZkY+6nhBvNGmnFWC12LopXxRwqowdVPwa54Twi3ZkN81NUNA6f2VYZYnw4lCZoipe9zONsyDEx73+Q5Oly6iCMiFU4C6V9TqWJTdFo4nvFrK8RG+rES9QxuYqmV8gnzG2t2GsFTWBEt4m92+RQid8qzcv4lUmGMpmyOk3QlDGxkvfsZPuGYFwGS1xn0KqmZDSl+RDwc+LjS5TiuNF4nDFpN4rYaDi2KVbuHmJKRgOdjKTT/hhWx65MNwYwCyrrTnFY8eRdrhS2sW+YVkQrETuqXpfWaoVP4l2nOl+sh2Cs/oGUl73XN97Q+gFzQbzZPOg8TamR+goPc1vMccUwX0KDjSc5S5Ti+GqKx8FgvpV1e3s6CCoNNFOaY7mJlK6pyWh8Xi41MKcXoyEuOZQbHvk1xEOiFO5xgeqgdIfYNvYhjqsMIbxjQSIzbKFhIt4SZtx7hupFsSSOX0X3SVfG4yTIMtXNYknExN4i1e1BxCXJHlBdrLpfWqU4STE7iEZxvepp6S5xY5gInqF6Nugyyb863wslowGezVvS/h4N5uardxj3Mimv2EAuDjHiOGlc8PPic0uxOK9pRbHJaHxoTbXEcdODxsL+Xo2GDouVotQMMApWqErPCXjXBiPJDX/ZxsQ16rSoUZkkqFIwl+9VLweRDDepPpTW3zhxHP/GkGgkM1UPCXiemLmQSPzCEZN8o2Kvn5OsTBCybZpYb8zEIPJqaVy6S1zgelja5l2aOdJq8IPA+xyU8QwV6c3R16q3VQeHY7jWJWLmSSNhaIb42VdASH6O+VN1ctiWkovD5zgO8MzeFfu9HKd6TazaiOeySrGIU1qVoZP5QvVXJH7mGYDH/F2sk/CqgQlizMcnc3+TdZ9PDoyGXKFDoTOYG0QVw72NTRyZx4dHJXzolBtaVYYITIAkRhgIJnCPWIOhQZ8r7QnLcXFZzefl0vqjOkRjoEIiUe8Sq3YwBr5vsdhqFnJ6GTphMjTi1AD/DzDTfcW+n39R2lMD918yGkjj8HMuDkMi//2kQzYnF2tQiMEfaPK7pqpA/UAH4G8xk0eYlSvNqxwj0jx0Zx/iuMoQU42mN9JGXWrY1WiMajSVLIzPmV9goniVmFGkpEbDXAAvUMUJzvAJI6GUZzvDgBViCTZPzJiQn9OL0Qw73BOl/GiyvVKpBHzJkTE4E7Rxr8NkLlqp+lhs2ZJelmMYg2MUPgZnXoHqiGP5e51xsQnm+WITl0uDOJae+Hmx/wOHSmCqw7wVc1Pro7KoVDZaMA7K3V6HJpiOy6GsbSqRmRzmmK1k42mYfk+VSqVSqVQqlUplyvIvdBOZRBbeKdsAAAAASUVORK5CYII=>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAXCAYAAADtNKTnAAABEElEQVR4Xu3SsWoCQRAG4BEDBjFNrEwRJCD4BMEUghA0lV1IZ6VEEIQkhWCrb2BhK9j7AOmsBFuxS2PvS/j/7iw3dxeusVN/+ODYHXa5mRU56zTVULUgY/YL8K18Tc/sH5NTL7CGP3g2+zfwoKbwAXmzH0oD2rCCMaTNXlb9wJ1Zj+WkQ1KK//ko7gAe9GRqiqovrjYWnkxf4m6rwA46pqam3sxaKGXFqTBs8gwWcK9rn4p1/4a9oKpZe4c91CXoRWI/2AviCH34/QsTcbezF4n9YC98P3xY3IWNuMfFXiT2w/9vNJwOp8QHWFKx8Da+vlcVDd8Jxz2XYIKh1GAprnlbNYLboOQYjnsQWbvmMnIAAwEo7xYRT94AAAAASUVORK5CYII=>

[image37]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAXCAYAAADtNKTnAAABEUlEQVR4XmNgGLaAEYgDoLgSDVtC1bADcSwUw+QKoHJwwAPFIE2XGCAKhIGYDSoPssgZijcBsTdUHitwB+IHQGyKJAYywBqIi6CYE0kOK6CKIdVAvBeIpaB8FgZIOIQAMRMU4wS8ULwIiPsZIGEB8nMJEGsiqcMLVKH4JBBnMEA07gDi+QyQACcKgMIChB8DcSsQpwNxLgMkfCwQyvADUFiAMCh67RgggakExMeAuBmImRFKsQNYWCCHBwiANIIMABkEMhAv0ADis1CcgCoF9soDBoj3QK4DYawAljZAGDl9gADMlTsZINEOi3o4cGCAxMAVIH4NxQeAuIwB4hV+IJ4OxM+B+D8Qn4bibIZRMFIAAOsKL9DdVn49AAAAAElFTkSuQmCC>

[image38]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKcAAAAXCAYAAABu3F+ZAAADk0lEQVR4Xu2a3Y9NVxiHX6X1VfFVBK2KUBLi2xih6TSC+GhStA0SQVCtr/homFJEiaAVIiJcSRouXLhx17gRF5LGnbiQuOm9f8Lv8a6Vs2bPEWfOdKIj75M8OXv2Xmfvc+b89lrvWueYBUEQBEHwnvKN/LVws+xfHB8rD1ba7JYfF22CoEcgZIuS/8gXsqU43k+Ok9flD8mR8oOiTRD0GMuT2+VjeUb2LY4PkofkkGTQEW7gD6s7g/+GCGf3iHD2EH3Ma0icYB5MAjqpaDNR7jNvi0FHhsvf5M9yaOVY0A3oCQ8k6SFb5b9yR9GmTa4o/g7q87n5zc0oQ10edJNp5jN0BCZIt+Q9OSLt+zG1CxpjjHlACSqBDZqEWvPLZOY7+VIus471ZtA1GOL3yIvJyRZlUcPkepOlIsyw/be8at5j5nozaI7ByZ/Ml+RiyG+AXG/SO2KGIO6ST80X3aPebJ7ce+YeNHrPBqFXpJ6sB7N1Zu0szE+pHAveDr1jWXdG7dkFuHv5tmdp9UCCdU7+sX9Z53qTdT0mUCyfXJLfmn/lucl8rZSvO3Gx+TIUQ9kJ8+u1m/fKnAMJ/jbzc/wuZ6f2Z+Uw+UvyhvmSDW15Td/LnfJP8+twk+Fp83PBQPNVB9odldPlheRdeUxeMX+NW+Ua8/e00JqHkojzYlkqBQ3SJh+aT3qemYcCB9SavIZlpSOVfUAIWdMj4PPNJ06EgIkUEFQ8L2fIJfKO+RBHj0LQeMy9y0rzoNKW1QLa04ZSI7fLz2Ef26vN4SY5Z7WwMxr8kdrtt9prmiWPy9HJ23KqnCm/Mr95uDa/JWiml+M53BjU51FTvgM+Sl62WjggB4ZQlZwyD081bGU4Wfi/KZ+b95aNhjNfq1wGgxzOT8zbUet9nZxrtXDm8wE9LLX3E3lffpH2NwrvYb35pCd4R0Q46xPh/B/BUMyySIYPh+E/13o5xMxOW61z2MpwUjsy3PMrp73mv45aIK8V7ZsJJ0GhVs3DOiXIp3JUsgznPPNaF1rk4bQd9EL4UJlUUHsyieDD5QOn5lpltcAwEfnMPCyP5Abz2pRtAo4nUzvqTerYHB7OTz24Nsk3Vu1yY3o+52wzrx2R5S6krnwgt8jx5jcIvdo689oyX5dzMGmhxmRCxWgwx3zSxg0V9HKYQDEJqbevuv9NsCpAr1adjOV9PGJ3fvVT73WW0Gvn67EdBEEQBL2EV7uMlb0+GBwfAAAAAElFTkSuQmCC>

[image39]: <data:image/png;base64,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>

[image40]: <data:image/png;base64,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>

[image41]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAXCAYAAACf+8ZRAAACcUlEQVR4Xu2Xz6tNURTHlx/5FeFJUUSS/Cg9hRFCSEoxUiJvICnxhJIkUZiQmfwYiIGJlBnKQCmZmEgmJsrQH8H389Y61z77nnvuu/c8r169b32695519nnfvfba6+xnNqnx00LxRLxtwGkxxcZR/LFj4ld8Qp2B6cFycUJ8Fq/EQHpTou3iSsJZ80StC9LYZbHah7WNgzURG9Fc8UB8DQbTYBctEo/E3jwQmiN2i5/ivLnhqWJGsF58EPfEYvOEIMadDO6KFUmspWXiffBaLCmHa8XYYTEtD4TWii/ieB4wN/pOXM+uY/BMsDSLtTQhTaNdwQ9xzSqWo0YsJ8tepcI0GzbXIfPSeWj+jEJbxMGgVsUmo+h/i6PlcN+i7t9YOZusDlwST61sms9zYn4wKnHjM/HJfKM0VW6a7jQUbDA3/FzMi/gesS2+9yTMYvqxeXdpIsxgqsgm5ZK2VybDpJgcNU4Z9VKaJVEelAlL1UQYxTCwipjCHKDCNL+ZCJOqEhPpmsDZ4o41L5FZ5u+Bl+Ybj+VPdcF8ox4wL5lOL7d94lR+MRUDj4id2fV+RTZ5cd2ycpdAtMLv5vuIzdmXMMysMd1p1r0K07TSrXnA3DRleDgPhOj/+Llh/0qqTfTqi9bbZqjr02hI3LbqZ9IpyHKn9sZ5ZLP5xFdlsZHaBR7eteATcVjijchZopM4YC3IL4bIXrc3MGZvipl5YMKZZhCnKej2gFQ85Kp5V/ifou73i43FBbJKdotMj0ZkdYd4IT6KlaXo2IsjKsY38aM4a3yz9v9IquA++JNw3+pLYyzEJqfft35wMOcV2i95351Urr9kzHN7RdoBjwAAAABJRU5ErkJggg==>

[image42]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK8AAAAXCAYAAAB9Cx9tAAADIElEQVR4Xu2b24tNcRTHl0tuuYQXuYRCbqFQioRIKUWJiJQ8TBThQUiKwoNJFLm8IE3KJeWB4kEpefEiefGiPPojWJ/5rV9+e599dmfP2SazW5/6dM7s39kzU/M966zf2ntEHMdxnMFnsnpffdOFPeowcZxBhtDtV3/aI1+XBXGkOks9aH5Sn6tT0hcZM8yT6pnEZeok9WjuOG7rP7P1vO123HEyjFdvq1/UFWanTFXvqlvyCxKCjnPVF2qfOlsdpQ6XcG6v+t5crI6TAOetUp+oa5LjjtPCTPWd+tKcll0uhXOPqyPyCwbBu2OmIaTCX1Rfm4Q5ZbO6KXesU8ZI+SeI0yA8vM6QZqP63Twv4aO7UwglrUARMbyP1AnJcdqJt+pnc2GyxkaSnnh0cqwKG9Sb6kpp/3s5DYKwxg3SL3VfdrkrLki2uvKzCOdZKQ7vLqnWexdB8Nno0c+vFw9x42EKgA/VjxI2UXWQD+9qCcE6oH4zl9sabcghad+GVIU3CuElxPzMgVZzZ4hAaAnvPQnTiG5hFhyrK23EMQlvknXqb5PnBJbgEuC6ofLSRtxSd5tjM69wGgNtA+0DQesWKmwMLxsxggr58NIq0DIUwZsIq/TiRbCRW2o+UHdkVp1GQFW6IvW0DnvVHxI+to/I3wDSPnAcD0vog9ms5ZmoXjXn59aqkFbfWIG9+jYMqtMeCbv2OogV9rFkN2Y8jxu2V+rWZK1OCG2+7/Xet2HEy8NcpiW8dc1KY3hPSPZ7puHtleJAzVNPS+iFq27kqPC0KYzqeOy25XD+Y5j14imp9ocum/PCIvWZtG7EmD48NYtGY1xKplKulTCxwE7CG8dkNyScW/a7OQ2A3vayWWXCwE05XGEjaO2gZ+W+hjyEbIHZrspznNkz9zhgGYQUCe4Saf89nYbh4XWGJNzLcM0eq9zXQPjOyb8dN02XcKk3hrybaYPTMKiyVNtOR2JUWHbu2Kd+UOekL6gZ5rGX1J1mlU8Fp8HE+xm+Sut/SBTJ6+JFheh1KW8Z6oC7xGJL4Dj9EAYuCrDrH6jpbY6O4zhOGX8AaFGMK+97iEgAAAAASUVORK5CYII=>

[image43]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAbCAYAAAA0wHIdAAAC/UlEQVR4Xu2X26tOQRiHX4ecz6fEhU0SuXCKKGrvcsqVIkVRiiRXDsnhQlFIpCQJRftCSaQUVyJXbvgHXLr0R/B7mnfas8da31r7+yQyv3pa3zdr5p2Zd955Z5ZZUVFRUa1Gi4VilZjkjETTxRoxR4zK3kVhE/v0Q3//rIqzWmq2uC2Oix3iodOf1KnSGOegOCsGxGlxQ0zxOjgOdlmwiX36Sev8FYqT6SQmclKc8d9oifNcLPayKq11jtpQW57HxBH/T3vAFjZjHfqj37oo/GNiSxwW18WC7F2uueKNhRWPmuEwwf1JeS4iClJHo35x0X/HOoNiaqwg7RavxaykrFGTnZ1in4Ut0Y1oB6fEFbFo+OtarRBfxOakLOas++JSUp5ri/PNQj3mMV5cFhssOJDfgK00D9LfZ7E8KeuodRaMwEr//0osSys1iMi5kNAUSbkY9A9/RqXOuicmJO9S4RjAUdj4JJ6K7RYcFW1Ecmd9F5uSslqxj3EMno3ejcaJjiYROUQQdbuNRtTkrHySVVoqnomvFhxwVUyzZmfl/VYqJjhySpqEY57oFPozLZwkJEdyU6+qGnRbZ613iD4WbJ64acEeOYsc1bOzSGokN5JcKiKMfUxCrBOOZiVx2Anr3WHd5qxxFsYAG5Ny7k+HxFsLzus5ZxVnjcBZ3GLf268V94qP1vlukyrPW93krnh1SBeOxYwLWrdwpIxHTj4PbD62cNjEqwPphTZRXEnol7odReN3Nvzkmi9eiANJWVth57xzzv+3VcyfVZfSl/5ETIrxXbMQVeRZFgqIpPSetdrLOSmrbFX1WSk6IbHT8S0Ldyt4IrZaQ+MWYluyPdkebNc29lioQQvjIEruOntsqH10Fp818UCiLEYR15YBC5fhO16OaA8EwQML9umHQ6ExqtKwZ4U43YC9/js10UIfOKyNxlrIX1wm+WYbyXcbY++z4CyedXNha5Or+qy+zjCRrz5YGFhRg0hsebIrqtE2Cx+tbXJJUVFRUVFR0X+tn4qShpBENo29AAAAAElFTkSuQmCC>

[image44]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAAAbCAYAAAC0n4dLAAAEaElEQVR4Xu2Z22tVRxSHV73VW2u9tEhFm0YrXhBvGCK0koA3CkJBERS0FKoiCuIFH9oHQcGKGGxFRaqQGFBavCAEtCCiBBRf7JNvPvbRP6JdHzOLszOeffbsc3ZIbOYHH/tk9j77zMy6zJqJSFJSUlJSkoxT5ikrPVOH3i7UDGW1Mkf5ILhnmqB8qSxTJgX3kpymKLPCxghhL+yGDbFlaSUHGB0aEQeYrVxUDipbPNeVrswzeRqv7FFOKt3KceW8Mj37kKpN6VV2K98pfcrSzP1WhGNtVA4rE4N774MIhvnKduWRuPmMEYH2rQd7YTdsWG/+c8VLjion/GdTu3JHXMQ20hpln9S+y/WA8qP/+0NPj7LDt6FO5ZYyM9NWVkTLNuWqskGa8PxhFnMR45CLxc0hTvxY4h0A22AjwF6I38SW2DQvEw/Rp8pDcd6T1SfiXrwraA9FZ0Pn6VJ+9p+XeJ6KS1GmNmVQWZ9pi9U05QflirJWRp/hyUg45K/+GisycZkMwHP9no8y7WTYAYlcSkjDfytfB+2sKdeUU0F7qG+Uf8Q9h2GI9tNKh7/f5XklzhFMZQdLjXHIQ4pbJJEeHiH6vVXZKa5fzYhxk41ayUhl5oSxM8/YCLI1G7YM5ztXPPyvv2ZlDsBgJgf3smLgGJ93vFRuK5ulZhwGA2GHbLCWKfLEc8eUM8oXnqpE9gDGudx/fiAuJceKZQjHsWzUSkYq4wBmnzwHeCuR2bXIAcKX1xPR+KfyRtwPn1U+9veKHKAow7CzoMAhsqyeqEKsnxgbrF82ZhyuSLYMXRLnPFVkoyodoJ5N6yrv4VgHWCcuS9D5z5QL4t5HZNsOoRUHQEQUkUWUARFH5DUrK5TOeegnsrqnUZ/oy/fixlzlMoRGxAGarQHYugDrcWemnQnaK24gFJhdnjwHiBmsickGIg7DEYHUBmVFcTQgrlgCE/2jn0V9snqk6lqkzJxUVgMkB6hpTDqAbQOzE4FskvI6Q7qEG/LuD/HOXuVzfw+ei1suTF8pL8TtIpoVBSHFIWs2kxcrtqNPpdY3E+cUg1J89mGqVwe04gxlHADxHEsWYAsTW3dsih0KZethuJdvV+77K+Jl95RfxEU+6yZgACI++91Vvt2KNmCSwoOgPyRyr1ogHO0nZb/U1vNGYuKeiPseoLnixsdJZVnZTuA3D/VKMzuBRg7AuDht5aBogW8zG2XtlGfPhmLw/eIGYVFxWdzRpL3EHIBOZCfZoh0DdEstIkLvY6m5K+60i9PDmxK5TalY9J3lg7H0eBh3n7i+RU9aHXEAZMfSpGWu/F2kheJ2UWRJirfXyl+eI/4ZcwD6bXNLX3FY+F2c3RgLBWo4/4WioxipwxN9lizO29vEOQDXPO8nc2B8GKl/BmWXPKtjOI7O63Oz4n1kgvCEdbhEJmXtb5PqxzKiIjvhWDGskOIIZv1/JtX9IyppmFW1A1AghUVT0hjSJnFpuchRkpKSkpKSkpKSkpKS/of6D/MRzh+LQnaSAAAAAElFTkSuQmCC>

[image45]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAbCAYAAADMIInqAAACMUlEQVR4Xu2XPUtcQRSGjxo0GsEvBNFCEkSMFhZ+VCIGlNgIERNBwR8gVkqQWFlYaCM2GgIpDGlFCQhiI0rAUiv/T3xfzhm4e3f37s7d1aw6Dzzsx8xlds6Zj7MigUCgwmk16+MNCVTDLjgIG2JtT46KD0A7XIc9sCrWlpZG2A/X4IXZl9EjP21wDy7Dj/AnnIh2eAiYnXl4AIdEM1AKM3AOLsIbs5gAMAGr8Ku9J+/gEXxrPih1oj/+Oxw3X2X08GNM/ALA1XgmmnlHs2gAFsyCvDGnRbPKJeULJz1pHooGhcHxxTcA7+Gt6HMOngE/4KaZCJcvO9MB+/wH9kY7ecLtwJXAvfhF/ALhGwD2/2evDhcArkr6OtKWAfcHJ8uB3GDuYR5GpdAEV+C26DItlnIGwJnzVuCBwYNjB9aYxO2fgksnB53mBvxm7315tADwnj2Fn2Lfc1AOvhT7PoluuCW6amiaM8ThG4DUZ8CLDwArpkvJHuQz/CuF709uIRZC3EIsQLjny4FvANw1GE2kSy6TmDeRbGC1Fd2nHfBYtBhJokV04rwyfcrVYkgKAG+ma9HD1eHOsnghdGKvNAseeJwAJ7srOhH6S/QeL1d568MsPId3ooca5WT53Yj1cQGIJ4iJ+y06BwZtX7Sq5DxyziW6bGpFM0pLLWf/JyzEeB6Miv6vSIT7/0r0gTRwsGH4oQhZEPFqrShYH/OuT/vDnnwApkT/PFTFGwKBQCAQeN7cAzuObCax3v9fAAAAAElFTkSuQmCC>

[image46]: <data:image/png;base64,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>

[image47]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAeCAYAAAD6t+QOAAAAdElEQVR4XmNgGAWDFjABsQYUO2LByjCFXEDcBsT/seDbUJwFxIwgxaFA7ATlgLAtENuBJLABkhRzMECtgIIMINZE4mMFvFDcCcSiaHIYABYafQwQT+MFAVDcxIDqLKyAJMX1UByLLoENgEIFhFnQJUbBcAEAnXYRfi73QjEAAAAASUVORK5CYII=>

[image48]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAYCAYAAACWTY9zAAACQUlEQVR4Xu2VPWsVURCGx8+g0ZgoQYwWVxERU/iBGgJaCAFBGwURlFhEEY3YiCIIgYCihRYhYELUQrENpAmopQhWkl+SH6Hvw8y5e+7e3GTVQot94WH3nN079z1nZs6a1fr32iiuiFkxHKxrecO1Q4yKTcGK6hZbSnME22n+R7m2iqPBXrG+9bFdF7fFZvE4eGhuBBH3oHgnjsVcR90Qy+Kr+BL8EE+sMEbAC+YBzwfj4qXYFu9sFx/FmRgfDu6YG2YXX4mnMbfSTrYIY9/NDb0PzlnrbuwX8+JANkfgR+JB3O8Sn60wxhgwkdQnJqzYwVX1XxtLwTqJd0gT6cp1SSya1yNwn2I1gpsxxvxdq1BbSckY9dQT5PnnnrqYMy/+XPxuybyWNohn5l2JRoKhGJ8WY1ahtpJY9Yx4LiaDD+J4PMcMpjoZo3E4FlC/mBYvxP2ABf9WCpNOma8sF133zby21jL2M66dVE4hC35j3qWNoLJIDSkizX9rjBReMze429zQPrHHvHGgq/l2iAn+/GRpPhkjrVVrrCzSBxyy6awjE3kcDEMjxk0lA1Pmp3V5HtOIK8dFb/MNF0E/mddWLhrhXjCYzRMnN3Y5aFsYxUhR0uq5LlpRY4jzayGuSewk5xiUO+2sFbuRP6u8Y4h2fm3+o1sBu5A6DRGcz8pbKz41V83rpbxbjPmckb6UwiQWynk4YL4pNAW01VgSH3GK9ESQpzUXO0tdQcPaP+JoVBwpT2ZiwZijfA4FtWrVqvUn+gWsQ19WhoHhMQAAAABJRU5ErkJggg==>

[image49]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAbCAYAAACEP1QvAAAB20lEQVR4Xu2Vy0tVURSHlw8yHz1UxMxRJFQgRIIDceQoRQLFkUU1CoImIdGwoiZSgTNp5mOkiJMES3DgxEED/6d+H3stz+PeG3SiboP7wcdl73M467Ef16zFf0637HWDNnlVduTmggF5T14pP6hCU4Pflmfuqfwuf8hXVgxOQg/lZ3nffxkzj5Ug+DeXwBtyRrbnXxLjcstS5cAvY+axEgRfdH/Fc7kuL/q4R37xeazhjpy1bE0H5ZKctKyyfHDmLlmxjRfcNfk2Nw+MV93C/rghH8mXctslw1H5xtJ6AcH5MH6y9MFNS4kDFUaV9YIzj7xzzpylD6/Ij26nP3tsKRmqvCmfulExG2pfDlnF4Az6/MGyG9CBA8s2T5k4ASRRKThcl1/lXRdi/bDLUoAwKo/gdKjRmvPue2uw5tDU4FOWzi9rh0BCx5Z2d7Rzz+VWgwi+4GNgqX7rqDEZGyuO0BNLH2E/MH4mx9xgXh5ZSjQoXzIUs+vzNZdMtGpHvnZJ5p28nL1m1yw7DVTKETy01LU8tPWF/CBvWWp5w+uVzGg5H4kdS7X14AgifxgTlhKvB0FG5LQcLj0rwC1G8Hzr/hm0/EQ+sFRxo6r/Ctzj2G/pzi7/S7Vo0eKP+QkJvFXI6MPvWgAAAABJRU5ErkJggg==>

[image50]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAbCAYAAACEP1QvAAACCklEQVR4Xu2Vz0uUURSGTxaJlZFmm4IaQaJAELECKZeRBUniRo3a1qJFCboxMtzppiiKdqkQBbaqRQUuBqWVf4r/hO8z51zn++ZXNEQizAsPzL3f/e4537nvuWPW0gHQoaBHDIoT+cclHRGnKuYYMw9Na9+C8+JsMC/uiI/ienaRdFr8ENvip/gtXotjQVOaFqtBZ8wNiRXRFWNE8K/mgT+LCdGeef7XItiaWAiSCmJTDGfmCP4oM/6jLotRcTxgAzK+KtpiTCkrg6f5BxVzBMcbJM37ddUr7oun5l8Hj8U58cK83Bhm3aqDF8SWuQeSCP5GLMX8J3NfJLPmdFtcEjNiOUiu5ItI5qR4Jj4EyTgjYsfyCXH+T6x8zgPil7gY5MRGtAybTgVJVOC76Dbf9G1wzzxhEirGunpKR8OamuvOim/mWQI6Kl4F/EapV+lx6DMv+614jq6IyViH6vllT/sanFZhwZkAkdCGGI/xeXN/QNqYbqCfL8QYEYCECjFOwfEUVImzwFi0BuDKh+K9la9QzEdPA4kcNndzaqukMcvfekPmyfQHOaXyfhFzAcm8NHd50jXxLrhpHvi56MisQSS7aG5cjMltx51Rs9UoM2Wh9On+rfWHgXA93DD/+qrNQlwsdAMJ19urJM6N4JzxfxclL4q75lk2zPRfCzcClwjlangXt9RSS81oF17wVE+U8iZpAAAAAElFTkSuQmCC>

[image51]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIkAAAAYCAYAAADOHt4vAAAFZklEQVR4Xu2Z/+vdUxzHX2wxG2aYfFncESGykTX50kfIsq1oUr6WUGP5MtkKSfkWskiSiLEixmRWvjTamqglfpD84he/7Qd/BK9Hr/PaPe/jnHvP+97Pxy57P+vRvfd9z3ndc17ndc55nXNFOnXq1KlTpwOiYwNHpF9U6lDlFOUCZW4gJ55ThrLUgVSprXE0X1mqHK8cknznmq0sVs5VDku+i1VjK6d5yrrANuVVZavymHJCVA5dEni0wD3Kov2lm2Ls7lN2KJ8rLwTo11oZ0ZdHihl4WPk2cHajRJ2OU15W7lWuVd4KTEVlcOp14TllKPtigHa4cramAm3EwN+pvKRcrTyubAjPY/WUzcotyvXKu8o50feo1lZOPeUTscGFw8Nz/IGt75RLwzPkE+w05QNlp3KmmF8AH/6o3B/wNsxSNoq10yceAQhvKm/IiEGyWlkj5qCfAm2DhM6uVx4J79HpgY/FZijilc88R5SlDlCfzyVb1Itt1WiZmJNZHRGD84pyw/4S9myTcmP0bLnyvrIggGps5UR9VoznxAYzDSr6eIfyg3JW8h0DysB+KRYcsW5X/gxcE571lO2SH78lYhOvC5JENQPbBUkLXSajB8lC5QuxrcF1TICBvTk8o2NblKO8kNjyDuyhDEDJlgeJ2xomnP+E8rzYMuxiW31dmROgr7vEch9XT9kj/dyg1lZOBN8fYoFX0sli2/zT0rQ/KEgYr78CbH2Ivnwv+d/C5w/JAQwS9u+fxWy4fF+lk0+KOfqp8DluKHX8t/ndki3qua0aUYdcJi1PoLrTYUr+2WeeU4ayUGsrlbf7a7HgL8nLESgETPo8FyRMLA8S2oGoy28x4S6UZgKO/7Hnq/NIGidIPKrTgfVOMttYJXygc0HCssmsLdnyuj5zh8kHOjewe8USQeBz2mevywyFWlupvF66euaE7d+kuaKVguRosaB9O8CJCxEAt4n5Eh/y+mngKsmfIltpJoMEODIOChKvX7LlddP6JQ0aWO8jDAoS6kKtrVRer6bN2PaJ4vJ+/668E94THGy7t4odd9PrCgJlqdgR+1fprzbYfiB8P7K6IOlruoLEc6l0JUjFtkBS6auSq7SS1IqAWBTgCMxRuxcXaKtxgqSUR3gnce7BmJN4wpvaT+XBtFma90Vtg+QMaSb8sc5TfpGmX1trnCDxEwnJlMtvb3dIP7HiFWfgFBenFaA+dkq2sBPbGiYfIGZonMCRY3igAn3lRHBxVIbZzJH08kCtrZywj0/vjp6dKnYyukLM9nKxLWVFVAa1DRJ+a63ktxTqczyO+9lag4LkRLGB2yT928JYNMrvO7yBfk9C0uT3IunnuJ7XLdnyBMzrDmsTwvkfSvNug706vhPJPYvred0aWznRB+6gOFJfFCA34P7kSmWV8pnYdXt6hzJKkDCRzk+/kObdT2txGfSVNJMcZhbPPOqY3dvEIrHUWAaNLP4msca+Flgj/cF2h7E/UoaynFYgPiLmbGEntlXTJpy+Uez+geBaF97HSzpii+PanCtyjo7vSTOBRLW2cqLN2P4m8JGyUiz5JHh4xT6nD14ZE6DsPrGkc7fyoAwWvmLS8F/Ns2JbD/4G/JT+1TAjukvKA4LoIA1ZJua8kgOZjaxcPSn/wZfaKmlYmxigk8T+G+E1txQjthECBOItJVatrZL8xnWx2CpCnvCM2G0oIvjiI3BbzZO+r9zHw/o0reIszn73r/xYpSaxTW1FjkU+wiUYpw8C5z+rSRyQSWxTW/1vgoRllQRtnKVwujWJbRpFbD3kJeSC5BKlJHzixYCQabfdg2dSk9imUUU/yCHS002nTp06dep0MOhvy9BbziPnA6gAAAAASUVORK5CYII=>

[image52]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAZCAYAAACsGgdbAAABaUlEQVR4Xu3VvytFcRjH8YdIfiWkJEkpYbAZFHWV4aYkKYVNmShlYnI3kw1ZGCyKxYakpEyy2fwBBn8E74/vc3JcHbqG24nzqVfd85wf9znne77fY5Yli7WgtriYtqSyyQYMYM1do+/TESnIJGYw7x4shU1GGXF/pskaDGMM/WhC3s2hExXo8m3V69/P/Ii2NYobmMW4hVdPElNqk1O4xS6W0O4mcIV1C020oYBtP0/qsIVBC+nGHlpdYkppUtEf7eMIjbG6mrrEsoWnqei6mpAdrgdn6PX9ygKaXWJ+2+RmUV1P4hy5WC1+XdG5O3jGiYWR+PYJRvmXTepaUYqbVDRxFi00qWY1/NF7nZhyNqlZrzU5it7jYwsrgSSmnE3KoYVPsKIJVsCo+5JpXODRveLOa0Ox4+LRDDzAk9PvvLvBC+6x6vRbNe2TFZxaWJa0TOlzrJv9cZ0sZ6pQjUoLN6xRyZIlS5a05Q1IBVFvNSoSdwAAAABJRU5ErkJggg==>

[image53]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHUAAAAZCAYAAAAPMmGdAAAE80lEQVR4Xu2Y68tnUxTHlyHGfVwTE49rLuV+jRczRVM0RYYGwxtkpCGScpkUKSmXhOQ6zQs1RKFcQokoiReSN/4AL/wRrM/stea3fuvZe//ObyTzPM63vp1z9tnne757r7X32fuIjBgxYsSI/xAHKvdPZXspD1fuk8oPUJ6jPM64Yvr2TlDGPepBntkdRJ2eRvRU8wOGarVwtPIR5fvKF5U7lPdI6buMy5QPN3incfWu2hMcr3xO+ZnxXeVm5YXK60K9QRiDOhtLLqi3Kv9Ufi0TwR+lmPCgEuSrla8r1ynvNj6jPMjqgCOUz9s96kGeWRPqDEHWcQ3oqHlyPz1PNa0WLjB+rlwvk6TheJvyE+VpVuYgaU5QvqP8QnmqFA8Qv5D+3SKT/j1K+ZbybLsGtO8S5fdSYjQXeOA7KcF827hWprP+ROV7ypPsmhfCB5X3h2vOKePcwTM8i8YQ1HRcI+rUPLmfnqeaVg3c+8Z4l0y3CRCQrVJGL0GBDgL7qvJTKcHM8IF0lV1fK6V+nkV4J+/eraBekQsTqLNdeXAqx8zHUqZqGkXmMhoiVknpwJtSeQs1HdeIOjVP7qfnqaaV4QnCKIGeOBlM578p7zA6ZgWV/v5L+ahd0xaSA88ZvOOGXDgLHlQy7xBjzErOn5B6JvHcT8rTlWcof7ayCG/g46m8hZqOa7hOy5P76XnKWjV4MjBVw9xuBwEjcCRXTLBZQSX5CKqPQEYsI/cpWbxeIS4r7XwweMHLUgRpJNymPM/ux07IjaOzMMPiwLOvFdRXZJi5mk70gA4ZXfPkfnqeslbNEwlBYjxt3Hv69i641lfGY1N5DqoPGhLlTeWhVs4aAC94df4uZS3Q+0Q0cZHyylTGdMW3BMFZQfVOq3Ug6D1fQ00nasAjw3kOqndKy1PWqnnyoHqSt+BaPxhZFMVyAsMCiHMC6dP+LbJ4x7Gf8nopq174hxTvv0qJ0T+GN4rpoReU5RrUBeW30q8D/Pscv+PA35FH6jxg2r1cyjedEbvv9O35MQZ1CQeVIU/g2OBGxOmntSgBdFZvUQK8gb1pLKKmEwPR8+R+ep6yVg1eh8USjNuViAUpwX/S6N/eeYPK5+7kXGhgVT1UZyc8eDkT4kgFHMlIMjOCLYE32leMLLwiyF6yeOheq6bjGlGn5sn99DzVtGpYI+WbCH0/yc+BB+wINih/UZ5rdMwb1I3KS3OhgYTM7eyC1ddjsnh/dI1MFkqAfdoHdgSMFN/L+cY+Xzvys8dI6ehnpcwUGTUd14g6WTc+1/NU06qB6e8hI3vIs5T3SUl+ftutl/LTZpNM3uWYN6gkF6tfVsYR7t9/pgwGv6JekjIF3G6k09kSOBC8WfmalFF8oxEjcWoiYNvtHvUg2qzq3BT16aQPpd3grOMaUafmyf30PNW0WiCwkNUqW5Y3pOwUtkj5rco5Gky7TgL+pZTVK1sr6pEMPaDPb9ltUv4pw7VSBtwLMv3bczBYXl+sPN/Y+igzopkOFowr4k0DncC3DD3YMkTytIIKok5LA0RPNT9gqFYP9MmZUjqb6ZeZZrXd4xqeYtfzgn7AI/4XjLyHY6tNexyY9jdLO3n2dDA6t0rZQ/Kz/yOj/3z434EO2SDln+ZSBqOeRRRT7L3GWdP5sgUNZyGxHDqAqfwwKVPkkpkm/w2MQR0xYsSIEcsNfwN3GFN/n/I5nwAAAABJRU5ErkJggg==>

[image54]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAZCAYAAACclhZ6AAACFUlEQVR4Xu2WvUsdURDFxyCYqGiMjYiKIogfhSSiKFHQShEsxBTxi0DASkGTFEEUEsQiKSzs4hdWYqWgjYIKglgFu2Djn+Afoecwc33rsnt9qOCT7IEf7M7e9+6cOzv3rkiiRE+mN+BVKJYNXodiVD7ICwczSc/aDBOqB1+NI1B7a4Ten4G/xj44BlugJDXs6dUHBsCQwaSjzNAkTZBtMCYZVpWg2o04M99CsYxWOmayjALRPrpLDaALtIJc0AQ+Ge/AC1AIesAgKNOf3Yhzce4J0RboBG+DA+LkM1MJlsFvYxqsg2Hxm+LEK2AXzIj+b42xA2bBF9G+6wUHoMqgOkTnyhGd5zMYtWde+cwUifYI/9AlXwoOQb8bFCNOfg4a7d5Vdw5siFaGKgZ7oNugvhusIFUdeOaVz0yU+Nr8MXgdJ5phkkw2qB+ihmiMcmY43q0+K3MhuoP+Au8lZcyr/8YM4x/l9mvmzEQlGpTPDHGKMkOj7DsaoaFLMGJxtwiRijPjkj4R3QhIMP6QytxlhudehV0zeZ6H3Dj4lUJiFWeGYvO3hGLlogdpOhvAfc3w+YebESJ1YEF08SIXkMnwVP9nXIFTizXbGE60KHoWEH41bIJx8W/Nk5J6PY5Fz5M1g71AeM04n3Oc+2SaBz/BKpgSnXMJtMkjiI3HihFW0FvmR9JL0deLVeDxkFbzJ0qUKFGijNA1HjNtp66f+kgAAAAASUVORK5CYII=>

[image55]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHUAAAAZCAYAAAAPMmGdAAAEuklEQVR4Xu2Y7atnUxTHlzF5fjYmMfFjEKNQjCFejCKlpsiYxuMbZCREk/IwTdGUpjwkSZ6SF8poFIoRaiJTmngxad74A7zwR7A+9lrzW7991z73nBt173W+9en3O/vss87ae+29z9pbZNSoUaNGLRKdYRxf3zCdoFypnGusmL39jyjjHvWAZxaiaKfLRvQp8wf1tdXSauU5Za/yhvKJ8phyYqxkul55tsHDxpojtac6T3lV2WfsUbYp1yh3hHqDNQY115IL6knKOuVp5Xvj0pkaIkcptynvKrcqjxq7pTzvOlN5ze5RD3hmY6jTR7UdtwGuzCf3p8unzFZLVxvfKJtkOmj4fUD5SrnEylwMmvOVj5VvlYul+AD4CweVx5WV9sxZygfKFXaNaN8G5YByfyjvJZy9U7lH+cWog3qB8qlyoV3zQtiuPBWu+U8Z/108w7PY6KPMjtuIdjKf3J8unzJbmbj3g/GIzLYJEZAdUmYvQQEXgX1b+VpKMGsRpD+VW+z6din161WEd/LuwUF13SjtoGL0I+XkqhxnvpSyZNMoRi6zIeo0KR14d1XeUmbHbUQ7mU/uT5dPma1aPkCYJeADpxbL+WHlIcM1X1Dp67+U5+2atjA48LkW77irLuyrVlBp4IuSjyR/hvqXKb9aWZQ3cGdV3lJmx224nZZPdRv62Mrkg4GlGup2uwgYgWNwxQE2X1AZfATVZyAzlpm7S+bmK6wIx9n/wao7xBU7oW4cz+AMyYGPvlZQ35J+zmV2og/YYURnPrk/XT7VtjKfaD/98LJx9OztI3JbnoucU5XXQT3FYKC8r5xq5eQA+IKvzu9ScoGuT8S8WmhQvdOyDkRdz2fK7EQbsCr8r4PqndLyqbaV+eRBZSa3ZjNyWz8bJEWxnMCQAPGfQPqyf6/M3WEcKyW32WP8IcX335T1od4gjUGdaqL8KN11kH+f43cc+TvqmTpELLs3SPmmM2OPmb3dT2NQp5rIMg9qKylB/kwrKUHewK5lLCqzEwOBnZZPdRv62MrkdUiWIG5XoiZSgv+S4d/eoUElO19bF5rIqvvamaO6Q6LI0hiRjMwotgTeaM8YyeyiGL2M4r57rcyO24h2Mp/cny6fMluZNkr5JoLvJzkc4JDGDwk2K4eUqwzX0KBuVa6rC03EpW5nb3UFlX3aZ/aLfGPPXs439vW1q372bCkd/YqU5KBWZsdtRDu13fhcl0+ZrUwsf88Ye5XLlSelLIMc221SflLuk+m7XEODyuAi+yUzjnL//TClt3Bwn5Qsy79HOEuZZ10Y5MTpHSkB32LgSFyaCBj7Ne5RD96UktW5U9Snkz6XdoNrO24j2sl8cn+6fMpstURggWyVLct7ys1Sjvj2239ssOw69Od3UrJXtlbUYzB0CfucDX8o5UwZblJeUF6X2WPPf10sXczoibEi3jTRCXzLrjVaDj0o7aCiaKdlA0WfMn9QX1tdYoauk9LZLL+sNGvsHtdwkV0PFf2Aj/g/MXgPv602LTqx6d4mC8zoFoGYnTukrG4c9n9h+OHD/050yGYpZ5pLWcx6kiiW2CeM+ZbzZSsaTiKxHDqApfx0KUvkklkm/wuNQR01atSoUctNfwOMUFTzyJQJ1AAAAABJRU5ErkJggg==>

[image56]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAZCAYAAACsGgdbAAABx0lEQVR4Xu2WSytEcRjGX3LJPaQkiZTYKHJJUZQykVgpZENWlLKilNnISjbIxiUbxcbKJalJWckn8AEsfAnP0/ue5j9nzJhIc+T86ldz3nN7zv86IiH/kBJY5KvlwCqY56tnjT8Rcg6+w5h5C5/hugQs5JNoOHoCh2Cue1G2Ych+fzFoeCHZtbRcdEymoxD2ibZ4G6yAEXMa1os+o8GOWefYd+HxuOiwmoLDsNRMYhLuwy1zE57CDucaPww5AR9F712EteYovIdroiFqYBTu2H20GG7DdlEa4QGsNpPoFv0KlxHRAE2+ugtfdAjPYJlTZ6g7uCTxHmFPPcA6sxlewRY7T2ZhpZkRrfBFdCikwgvJlndhS9zAQafGkHwen0t57x58gxeiPfFpC6YjUCE5Phiky1f3QvoDuHwV0l0x/CEJJ868aEiGZfd74zoBL8wuLDDd+k9aMl1IzvoZ5zzH8bnoSkAT4NKxIboFuoxJ5hPnOyHpscTfywkWhQNmEr2i44Mzmi7Aa9F1MBWcgUfw1eTviBkT3Wa5ta6Y/O1uvcvwUnRZ4jK1KvqxKddJwj8YPWanxLv9t+CmkS+69fKD2SshISEhQeMDXyxWLBigXdsAAAAASUVORK5CYII=>

[image57]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAEpElEQVR4Xu2Z+6umUxTHlxmR+11y6yAiSsYtRc1ElEvJZcpclMjMKE0jKaEpIeRSQq6NJiUxUooR6qQoiST5xS/zuz+C9Zm1lnedPXs/734Ppjmn51vf5j372c/32XvdnrWfERkxYsSIEYojlIcVYwcpj1ceXIwfrrxYeZpzxcLL3cg6aNR0GOM685jfQo9WC8y9Vvm+8l3lO8o3lZeI2SDjSOUDykcrfMS5Rnlo3ODAhncoP3F+pnxdeanyfuUJk6nTMTprCTlro/JP5bxyt/NHsUWEs1j4jcq3lTcotzifF9tEL2o6aJQ6bOBlv8485q92Bnq1aiA44RNizjk5XTtduUv5oNj+wwY49jjlbcq/lJvE1gnnnC+I2e+8vXcY1ok9ByeGI0mQJ5VfyCKc9Z3YQ3Y4iZAcoWcpP1Ke7X9jKPiwcpv/7kFNB42sA/nNWOgyn/sgGqBHq4bQh1+LOafEhcofxAwNM64WcxZ2K3GS8nMxGxIwx4qtkXtK8FwCbWZn1cQymLNTeVQxfqtYWlMye1DTQSPrxIbJlkBsGt7lYz1aNeDc7505IDJWKp9Vfuk8NV0bchYl+Q0xR58r5giyhzJYgmdslUU6i3Q/2pk3wG9SlkWU7w7u+0l5fjFeQ0sHjaxzgfJnHwuEEeB26deqgf1ibLh64aUFyPNy4Aw5K4KKYCPoyC6yjMC4zpnXy+9cwaaCSHxN+bSYIeB7Yi9ZkA1Vcxbvu6uK8RpaOmHg0AljtJzFy5ms6dGqgf397qQxaSHWATdXxrOzonxfr/xF7F0aWKP8QyZa8CvlnbJvMzIVl4t5PINI+lbsvdAyMqgZtoWWThg4dGqa+V54Yvo9pFUDziLzhrIPZGc9VhnfLZM1fOB8SawylMCOTzlp3kL3OVmEw0qwCTZD9LSMDKYZJqOlUxq4pvlfOushmRirNQdQcWJevCdB6NfKYC+oDJTxPWLJ8q8wOusAdBYpyEMvK8bDWdul/TIHLHxaOQm0dMLA+6vBuEbsnQaHDI5Tf3VelMZncRbnsvXloIMOk06zR2cvwikcQA+pjIcQ/9Ll0O1kEHHR+fSgpoNG1onWncgOEIm043BoTaVWDdnxO8Q6Ng7Idzv5zfN2KZ9x5i85sziLtpyPC7X3Uqwj73MQxygfl33PJDfJpMEAnE34VMK/ILqfOIRGq3+PWJd1hf9doqYTGqFT04378r09Wi2QvXBeuUF5u9jnnzPEnEBD8anyFGfGrM5ChwYu9hZg3QRb2LgLVypfFesA73USmbn15SGc5N8Sy7q1TtroHMHM2SPt1K/poFHqYKCdfp15rA+Dwthwr9YQzhTLrm/E9o0NPhTr0vJhlapDSeOLQ3Rzv4nNPSfNK4HGK2LO53gEbxHLpo9l+JzXBKlPNqxy5pKYQQYSWXPOFfmig5P7tNTOOmjUdCg9RD/rGvrW16M1BJxOw4IGz+L8s8nHKV/w5n9mzwbuxcmAPUCeMW1P+w1EZ3eHcwCCLOVz0bzYN1N4X56wXED54rRf/tfKUgLZ8KJYqaM8wrk8YbmA8tkqoUsJBBvllY6tPK4sG4zOGjFixIgR/wf+BgUwNdewoy+wAAAAAElFTkSuQmCC>

[image58]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAZCAYAAACsGgdbAAAB5klEQVR4Xu2VzSsFURjGX9/yGVKSbyVKlkohikjJRvKxQYmixIqVmw0piZANCxvFxk6SyErJxtYfYOGP4Hmc93RnxgyLq+6UeerXnXPOzNznzPtxRCL9U6WDWqUO5LiXw6HQm2wAW2BQGQeP+pviuC9pygQ74AgUKtQceAHNOk6qaJJf8Q5UK9QkeAdtOk66mI8ZjnEW2APnoMgx7xTv4Qa6QZOYCPQrY6BCTKpU6ZjzuV9PxsUx02sVjIAekKf4ikYrlVlwISZXg0STQ+ABHIAZUKYMgBuwIsZEKYiBbX2OsDA3QIsY1YBDUKL4qgB0Ktw5/9i+IEj8I+byKch3zNPUNZiXeOG1g1tQrtSDS3F/iAkxkQuK3jcNg1fQ6l1wyJpc88zzS1yBLsccTT6DRoXP7oM3MWnFSAR+wSCFyiTDwaT3Nm++9AOsS3Cv/M0k32HlNUmxcKbFmKRZht/mtUvsg+yHTNpshbImN0GaznmViElWPQ8LK+bxmZh6IC7xCGSFLokxYw0x3OyTvTr2UyImyQko1nVGKwY6FJe4OAp2QZ9ij8UpMa3JT6zAYzF5S3jNXkjuxWzwCSwqvOYc18iCmDbHtsQ2tSxmsz/2SS6wSCyBN/6R7AGSKmbD3pqIFClSpDDoE+k1V0QI0V5cAAAAAElFTkSuQmCC>

[image59]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAE3UlEQVR4Xu2Y/ctVRRDHpxfKrKi0RMviKUmyAgkxEDIeKQwyIyqNygQx7AVCelEQEUHEMrJAUnoTKYwQK4oglRRESBAxIqRf/OX5vT/C5uPOeOaeu/fcPYbx+HC+8IF7z9kzZ3dndnb2iHTq1KlTJ9PVyhzlfmNy7225SrlZuaJ2/Trlptq1EmF/rnKHcqVRF9e4T7t6f6JKbA0SbR9T9il7lK+Uz5WHpH+sNyhvKhsyrDcWKdf6Aybm9nnlR+MXZbcyT1mjTK2alqlz1mXiLJy0S3lRed/4Q3lOqg5j8KByRjmkHDGOS3JuqbD3pPKl8oTyhvKhwWS4eN8ndp92tB81XKW2ciLIYJMk50wL92YqPyhvSZpoQDj2FuVZ5ZzymqR+wojxkaT5mX3+iaSXJL0HJ7ojr1e2SJrTYmexKj5VZtl/JgDoyFnlYbuOwZ+Uw5IiY50RB1miu5UDyj32n3e9Z7xt/4HfXPNgoT3PATZQia2c3D4QcDinrgeUk5ImGqIekeSsV2rX0W3Kr8peSQFDNqKPPFMX7yXQip11n3Ja0rKcFK6TVv5W3rH/GNwszemoRAzwG+XGcO0ZgyCYItWAWS0uHzSQAVCJrZxw7gkjBkQUaf8DScEJt4d7Tc5ifj6T5Oh7pcpIpMG6eMdaaeEsjJM+SCex06RGUmHOWUTMNUYbYZ+lz2Ci0xk8EDQEj787RqNPAtCPUls5MclMNoz23upRbBcDp8lZHlQEG0HHXLHKCIzHjdhffrfZY7MiEmIapBPsIR8rG6WaOFIJub9EccJzE/yPssB+MxmDnEUWYNWU2MoJZ5M1gAwySN4PeD1zPTrL0/di5U9Jwe9aJGku3Rb8piyT/mKklWYYP0u1wSJS5KtSVX6kHiANNe0PUcOc5Q4a5iy4NfxuspUTzmLlNa0+FJ1FgNavH5KqD98ZBDOZoS72163GKansbpeLdBhLlqoQcIw7qkkM3Jf8MI0XZ5HafbIGtUHsfd7O90nk9nNpsFRkBtL4mDK/91aZOmf1atw6C8e8K2mvAtIaG59PBKXsKuk/v+CsYenEVVoUXOoCY6GkPQ2aJhyn/mU8GK63cRbnspfrF01UmFSaJXYuiIG/IFVF6PsPk7bcfjNBY9IfBW1WFqJjVEsULC6iFtyOl+5EtotIpBwHH1yJrZyi4/dKCkCKpJUGv3kfB+NtRswybZxFFb1B8vuS9yOOs1E4hpX0tfR/QuGwPGrtlihPW3tEoQHfSm+BweqjyvIqsi7OOHxyyR1k/cwTr7ldfy4+W2JrkAhEOKaskPS1Zp5ypyQnUFDwEWC6EdXWWdihZI8LAdHveMgfKg5uHOA8N0diaUsUbJJUwnLm8L2N6iamRk77YzJ46dNZ2nwhKU2xcinFIa4EJohKk/u0I3CYUPABl9pq0l2SVtdRZbWkse2XVKXFwypnSlIaXxy8mjsjqa1//ckJGzslOd/nbKmk1fS9NJ/z/pOYHAb3qFQlfi56CYBhS5s0Q4SOyOCPr6Qeop9VWt8ro0psNYkxULBgg3ctk/S5jeukL3jqQut24lmcjBgD8I5hY/rfRHTW97bLSaxSss0x5XeD6njCifRFqiwp+8erWA07JKU60iOMxAYTRRfzzXA8imAjvbJXx6PBhFLnrE6dOnXqdCn0Lwb9NmsMqD73AAAAAElFTkSuQmCC>

[image60]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAZCAYAAACclhZ6AAACSElEQVR4Xu2W3YuNURTGl48i5GtSktFI5ONCY0qE4kKkXIgLn4lyxWSGC00UIXHhQkk+cyVFFDcUasqV5NaNP8EfwfNrrT1nz+687xHiNL1P/Trn7Hefd+3nXXut/Zo1avTP1Ct6ysFCU8XcclCaJWaWg/9TE8rMRfGjgu9io1gpvojPwVsxKl6IhdYlmi5uiEtipOBufJIVzHwwNwEvxQnrsqzMF4NiSjE+T1wTC+I3Zs62LnenJosZxRiZwOCabCyZmRTMjnmdxD22iQ3mcQbE0WCdefw5Yqc4IBb738ZELGKfEmfEVtGfT+gkgh8zv1FSn7hvviWB7fdYHLJ6UwR+IF6L8+YLWxG8EhfEsHnd7RLvxNIAbTGPNc08znFxJK7ViicEt82D5mLbUSPcMC1+kXgv9qRJFSL4V7E2fqfsXhZPzGMiOuobsSNA5wIyiJZl12q1PXhm7dtwKbYNTQLKrZoLMyyybP90UQylHZDMMD89fTLzzbyDXhebrGWsVhPGDN3sSnDHvGXn2iz22/htlsy0W2iuOjOQ1M4MRqk7jGCIc+9wjOc1PU5k4nmQB0Bp0R/NGwHk43+SmU5mDool8Z3F7zVvHBwp0FZ95ouF0gyi+NcXY73mB+mvNIDfNcP1fWMzzFaJm+YPr/IBLhefAlpoKQLdMj8LYLd4Kk5afWs+ba3tMWp+njwKqAXgO+NcZ156Zbpq/mbyUAyZx7xn/npVK1K4OqgqfgqPlg3UUGWa/6KoXdZGFjgeOhZ/o0aNGjXqGv0Ec95xHPGoWkMAAAAASUVORK5CYII=>

[image61]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAEq0lEQVR4Xu2Y7atVRRSHlym9h1kWWSbXwugNIkRBULiSKEiBWBlWClH0BhGmCCIShFiJKUhJaiFKEFGGEaSSgl8SQpQQ8Utf/N4fYetpzbpnne3MPnOyxHvZP3i4586e/duzZ82smdkinTp16tQpaYrymPJ44tb+y2Oi/CnlgcQN/ZerFX3wyPlQxnXqldqDarxKou4zyjfK18pXyl7laWVSqIduV95VNmXYmFis3OQ3JNG3Lyg/Jn5W9ihzlTeVu3tV69QFa5wEiyB9oaxWPk6cU56XXoP5u1zZryxT3klsF3uJWuV88Gj68AK70nXqUX804ar1yumWxBax4Nwbrs1UDivviXU0IAI7TVmpXFbeEmsnjCR2KMeUR/65w/Sy2HMIogfyNuUj5agMEaypyufKw+l/OgBoyJ/K/FQ+W/leeahRb4OyLv2uUc4Hj+gD/KbMfanPfYAHqvHKyf3hhFhwmnpC+V2soyFqoViw1jTK0T3KL8oBsQFzp1gbuacpnstAqw7Wo8pZsWl5cygnrVxUPkj/07BDyh1jNUwrxKb1XY3yknI+eEQff2Fmi8tfGsgAqMYrJ4J7OhEHRNRk5RPleOL+cK0tWKTkL8UCPUcsEMwe0mBTPON9GSJYmJM+SCex0aRGUiHBopwpSyOaawcNJ9gEfZBKPnhEH392HI3eCfCh1HvlRCfT2TDaf6lPsV4cOG3B8kHFYGPQMbuYZQyMJYnYXn6TXq9KjARPg7GjcsH6S1nQKM+p5OMd7D7eGaVgkQWYNTVeORFssgaQQUrydsDbmfIYLE/fS5U/xAa/a7FYX7oX/Kq8KFduRobSjMRP0ltgS52Mch1bUsnHO9h9cp7xXpgefrd55USwmHltsw/FYG3OlB+TXhu+TewUywxNsb5uTZyRnu+n8i8DxpRlVwhvSG8XVOpkNKhjoko+zQ7Oef6XwSK1e2eV6iDWPq/n6yRy/1warBWZgTR+SZnXf6lOXbD6dd0Gi8CsF1urgPzLwkdHlBZzRMMHpRNXycc7+FptMBaJrWnQ1uEE9XziyVA+TLA4l73SLExih8lOs8ZnTLz4S9LbEfqukE5blX5jyC6H3U4UI853PjXK+eARfXzrzsh2MRLZjoO/XI1XTjHwB8QyCgfktQl+8zwOxtsSnmXQMMFiW75J8uuStyO+Z6sIDDPpoFz5CYXD8miqx9mETyX8RR5UP4R6gF8T22X5YbqpnI97uE/O1++L99Z4lcRAhFPKq2Jfa+YqD4oFgQ3FEeW+RNSwwcKHLXucCIh2x0P+QHFw4wDnuTkSt7Y8hJP8PrH0wowDttFxBFPnkpSnfs4Hj6YPHXQoXaceA4cOBX/hWq82zRKbXSeV18XOU9+J7dLiYfVGsZTGFwffzV0Qq+tff3LCY7dY8H0/8JzYbPpB2s95Vy3SAyNrJMG61hQDYNDUjj545HxIPYx+Zmnbt74arzYR9OliHjyL8w+f2yj373nPjtUeTtxLkBHvADxj0DtdMzE6h97hXEdilpJtTim/JdgdTziRvjjtxwV5vInZ8JlYqiM9wkisMFFEbofxLgYb6ZUdW/O4MmHUBatTp06dOv0f+hsTojkeGQvEuwAAAABJRU5ErkJggg==>

[image62]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAZCAYAAACclhZ6AAACB0lEQVR4Xu2WzyulURjHH0x+NTUZFpQUmgmzECJiilKkLCY2IxJbU4NCQoTFLEY0C5mGJdmyoaRmM4tpsptmM3+CP4Lvt+c5vF73XHLJK++nPt33nvPcc97n/LwiMTGPxmuYEy40Xpk1sACmXa2OHk86mZewCo6bx7DiSoTICzgEv5rtcAZOWF1k6IY9sM88kevJNMAd0VmjJAuuwQ8uKEq0mOFkuJTm4BeYYTo4k+swO1AWCXzJ5MIfcD5Q5hiABzA/XGG8g22wUbSdOjho1sJ00T3YCT/CYv3ZBRxIvssn0YFrFd2vN+JLhi/KF/Yl8xu+CVcY7JgDsS+6x9juW3MPzsIxWAi74BEsNcl7OC26pLk3h0X7vJG7JhOOD8OYf7DavnO06SLcFp0Z4vrpMMmUyRkk5YG6pDxkMomWIttjQu54d/0w3o0+Z+Y//CO6Z5vlMrGkPItkUjkAiC+G7QXbTJQME+W+YyJM6BT2W3nSC9uXjDuaV2Gm6eCm3hBN2EcqyfDeK7FnvkeP6MERvO8S4kuG8GjdleuX5jfY64I8pJIM64PtV8IV0cFLOIC8wQ/hX/MM/rKyeovhsTgJl8wyOGLP/Dvk47NcLo+fovfJlsm9QPnMctYzjvF0GS7ATTgq+k/lO2ySe4DTXGRyI/Iz6bq9B7JF++As5MktN39MTExMTCQ4BzUgcBN5IKg5AAAAAElFTkSuQmCC>

[image63]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAETUlEQVR4Xu2Y68tVRRSHlyZFN6jMiNJ4U5QugogUBAmKYRAJphmYFYRRGUQkEUREEBElXSAquiJIEOKFIFCjBL8ohBQR4pe++L0/otbTWquzzjh7O+etxPd1/+CBc2bP/PbsWTOz12yRQYMGDRpU6Drn8vKC6wplhXKzM3f8crOyDx41H8q4Tj3qd6nFq0vUXad8rXylfKl8pqxU5qR66CrlOeWVCi87a5XLooFrnvKwctD5TvlEWaU8rcwfVZ1MQ7Au8GDRiTuUncpR57axGtbxB5QvlPuVHc4usfatqvngUfrwAB/4depRf40TavWqickIr4kF54Z0baFyQHlebKABEdhrlU3Kn8ozYv2EKedd5Yiy7O8WpkfF7kMQI5BXKm8oh2XCYG1QNouZ/uyUwbpV2acs9v8MFLykvOi/W1TzwSP7AL8pC1/q0w7wQC1eNYU//CgWnFJ3Kj+JjQlk3SsWrMeLcrRAOaTsFpsw14j1kTaluC8TbaJghTDsChYd26NcXZRvFFvWbJ0tqvngkX3igVktoXho2OplLV41EdwTTp4QWZcobyvfOzela33BYkv+VCzQS8UCwephGyzFPV6Q/zhYPAxLlk6U745oUwa3pi4fPLLP7covXhaKQYDXpd2rJgaZwYY145fGlOvlidMXrJhUTDYmHauLVcbEuM/J/eU32+vE6gpWHqhasP5Q7inKa+ryiQEOnxiMrmDxcmbVtHjVRLBPOyQmXYp+wLOV8hys2L7XK7+KvUtDa5XfZeQFPyhb5OxkpFnTDVY5sF3q8okBDp+aZ24L16fffV41Eazac5bKwXq1Un5ERn34xnlfbGcoxfv1TeekjHzfkWkG7GIJFllvDFZXHcS7L+rFexKFf20bbBU7A9v4GeWu8UttGoI1rhkZrK6XOYo2fdtJqMsnBvh8JRirxd5p0DfgBPU3Z3kqnyRYnMu2lYUuMkwyzRafs9QVLIQhWQ7ZThYzLjKfFtV88Mg+kbozs0PMRNJxiIdr8aopB363WMbGAfkJh9/c74DylhMHYzRJsEjL+cJRey9FP/JzNqsvWJxN+FSSD6D5EBpnlSfFsqy7/X+pmk94hE/NN9rlti1eXWL1wjHlMbGPAquURWJBIKH4VrnRyZo0WPiQssezheh3PuQ36SGxzOaUjPbo414W+yk34ST/uVggH3FIo/MMps4Z6V76NR88Sh8GaI9fp95HYgMK8cCtXn26RWx1HVW2i52n9oplafmweqnYlsYXh8jmGC/qLkn1SuHxoVjwP3Y2iK2m/dJ/zvvXYntgZk05c/NFFyf3cy3t7INHzYeth9nPKu371tfi1SeCTsKCB/fi/MN3P8rje96D/9SeTLQlyIhnAO5xrmc6b2J2TivDuUDEKuVz0TGxHQaeyhVmi9i+OO3nF/JME6vhPbGtju0RpnKF2SL2dpjpYrKxvZKxlceVWaMhWIMGDRo06P/QX+qJN0uqHyuyAAAAAElFTkSuQmCC>

[image64]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAZCAYAAACsGgdbAAAB+UlEQVR4Xu2Vu0scURTGj8+ATzQI4iMuBIJBUVACERVWEJRACDZCki4QUigRrLQQRRBtLIQYRNDCRtRGFHwggsRS7OzS2Fn4R5jvyzmXmb07i8UKqzgf/GDm3Jm5557XiMR6psoH9UY7KEldfhx69E5WgTnw2RgAv8AXkBd6Lqf6ATo9WyX4DVo9e07EtDJq7z07IzgDujx7TkRnpsAV+GiwPpvAkmgpROmF6AH6wFvRyA8aLJkG0W+/snvaS/+/GYj33G8SDIN+UGakqRHsgztjD6yKbpBJdPIT+AOWwXdQa3wAJ2BC1Ika0aws2nuEGZwHbaJKiJbXSyNNjBw/dm7cikaWp+NaJnGjFbABykN2OnUMRiRovB5wCuqM12AXvLF16qto5tKyx4/8FI1EscEmOgLXIOkejJBzctqzMxKHkvounbwEzYbrhRuwLbp/ZASpJ+FkQnSjas9eIVojs5J5Vt7nJB1z8p2k2DjfRJ2ks0y/q+sUvRM9UdQfJgkWQIFnd8rGSTYlfxZOrONNCX4oKWIRb4EWz87oMQVDnj2sbJwk6xJk0M3lXiNN3eBAglNwXnFjdmdh6Lmw2IFr4K/Bazcnz0QnxAUYM3hNG9fIKNgRHUucLOOie2ackxQbpsPgqf0afWjx8EWiI44Hjiq3WLFixcq1/gGZsFp/o2DfkgAAAABJRU5ErkJggg==>

[image65]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAbCAYAAADf98keAAAEHklEQVR4Xu2XyasVVxCHKyaocR6icUBzERUnFBWDggqKGjEIigOO4ISoQRyeZmEShAhGRHHEIS7EEEQjgiCoASViQMjCTbZuBBcu8kdofVYV97xj973v4US0f/DxXp9u+vy6Tp2qc0UqVfqQ1ElZonTMb/yfhHmYoAxUPml9W3opnzmhDsoX8uqzuYYpq/LBdqibMlHpk99I1Mj7G1EVoBLxsgXKBecb5UfloJix0H7lmXNXuaP8q6yR5oZ4Zlw+2ESxGOuVI2K+jirbfRwxb+q/zPtr6WvlodgHxEdg4LCyKR5S/aTcdwjOSbFVbRYcjO72v+3RYoe5BvlYT+U3Za5f4z31j4q8v5Z+UG4rfZ3QFjEz3f26RRnltEdTlEX5YBN1Vs4455QuPv6pcsjhf7yn/kO591J9pSyU+sd/rsxWvlW6ik2MgaIArVX+UUb4dRog9ntbMoLs2ixWg9Kxsc58MR9kBp5miXU8fOAJ0gAhtvpNZbDfS/2Hcu+FIi23KsvE0hRIPT6QIF1S+is/S3GAWIVHUs+Y75QTzgHlF+WsMtTvF4miukNat3e2wmpnp3Jd2afUlBXKKbHCHzWxKIPwyzN4T/2Hcu+FInNI75ViEQcqPIoVoqixnx+IGQQUmUURjr3NCo93Qhj5Q+mdjKXi3fOysQ1Sn4vt8avUs5EP+kusG1FD4JpYB0X9lFtiTWKA2PtT/6jIe6GYlL1MxCPSUVBJPVKQ4FHUvhfLCqj5OJ2j2SpMV/5TZuQ3xFabjhMFFjE/dYEtFQV3XXJ/mvLU/+Ifjou9Z4hYwC5KPWOi04X/mrTd+0sReVaAIpkWSjLniViGIYyzVWCm8qVYdrBarBoZgrnhTogAPRfb87kIzDYp7nI1h0wID4g5//Z7oQ5iH8pcbFkWPK9L4b/Ie0NVAWoi9vJ9ZbSDeBlnGlKVFO4h9jspLdJRDPf48xEIzjMQarTFqIFT80EXCwR/Sv0jonawVZifGgN4o/sitifbcqlf4z31j3LvDUXWcIiizUarHaPc8L8oPp4PAkQLpqiP9GuOC3vFjIZZJqez5UWaNg27pPynQQSaDhbPzFKuiAUFkZXwWJnkY3P8mQgq3lP/KPdeqogkD9OSgQJ2XuwEHGIyVo5VgeXKVbFCmYpgc4QHjLaIbd/cCNsBOP8UKbIALov9NNionJbWRwbeC2T6An/mdx8L4T31X+a9UGn94RwCdI6itOMeqxRwXaToPqwaW5YOkmuNU9Zia2K1J+oPW6vRoZN7/Jwomw+l/su8vyLqz0P/+67Ex8T2Kftoas89Jz0CvHMdEzsscWKNVHzbYjHSWpaKzJ0stq0ig3iOIvteFF2JIhgHqrctjgJpQ0hFgNie4Qso7rTxj0adxQJRVOcqSRWgSpUqVWqTXgBkzMMoBELIfQAAAABJRU5ErkJggg==>