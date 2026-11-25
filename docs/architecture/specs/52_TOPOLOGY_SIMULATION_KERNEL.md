# Spec 52: Pure `in-process` `TopologySimulationKernel` & Thin Worker Hosts

> **Governing Glossary:** `TopologySimulationKernel` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md)  
> **Domain Classification:** `Client-Single-Session` · `Public` · Pure queueing math & graph analysis (`<5ms` tick/scenario)

---

## 1. Intent & Workload Envelope
Eliminate parallel simulation duplication across `LoadSimulationWorker.ts` (550L — breaching Rule 8's 400L limit and containing 95L dead math exports + a live `cacheHitRatio` bug at line 440 ignoring `engineEval.cacheHitRatio`), `desSimulator.worker.ts` (367L), and `spofAnalyzer.ts` (151L) by consolidating queueing equations, Zipfian cache miss propagation, DAG traffic flow, chaos faults, and Tarjan/DFS topology linting into one `in-process` module: `TopologySimulationKernel`. Shrink both Web Workers to ~30L message-framing hosts so both modes run deterministically in Node without Worker mocks.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT merge or delete either active UI caller (`useArchitectureCanvasState.ts` continuous telemetry canvas or `TopologyCanvas.tsx` DES scenario studio); both worker hooks remain compatible for their React callers.
- Do NOT alter UI JSX layouts, React Flow node schemas, or cytoscape styling.
- Keep every newly created file `<= 350` lines (split internal pure helpers under `simulation/kernel/` only if needed, keeping public entry strictly at `TopologySimulationKernel`).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** Pure functions `stepContinuousSimulation`, `runDesScenario`, and `lintTopology` exported by `TopologySimulationKernel` (`in-process`).
- **Real / Substitutable Dependencies:** Zero I/O, zero `self.onmessage`, zero `Worker` DOM globals (`in-process` direct calls).
- **Verification Commands (CI):** `npx tsx tests/topologySimulationKernel.test.ts && npm run test:audio-contracts && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface ContinuousSimState {
  nodes: Map<string, SimNodeConfig>;
  edges: SimEdgeConfig[];
  inputRps: number;
  activeChaos: ActiveChaosState | null;
  tickCount: number;
  maxQueueDepthReached: number;
}

export function createContinuousSimState(init?: { inputRps?: number }): ContinuousSimState;
export function stepContinuousSimulation(state: ContinuousSimState): SimulationTelemetryFrame;
export function runDesScenario(request: SimulationRequestMessage): SimulationResponseMessage;
export function lintTopology(nodes: LinterNodeInput[], edges: LinterEdgeInput[]): {
  antiPatterns: TopologyAntiPattern[];
  spofNodes: SpofNodeAnalysis[];
};
```
- **Worker Hosts (`<= 50`L each):**
  - `LoadSimulationWorker.ts`: listens for `UPDATE_TOPOLOGY` / `SET_INPUT_RPS` / `TRIGGER_CHAOS` / `PAUSE` / `RESUME` / `DESTROY`, delegates tick computation to `stepContinuousSimulation(state)`, posts `TELEMETRY_FRAME`.
  - `desSimulator.worker.ts`: listens for `RUN_SIMULATION`, delegates directly to `runDesScenario(msg)`, posts `SIMULATION_RESULT` / `SIMULATION_ERROR`.
- **Deleted Modules:** Delete `frontend/src/utils/spofAnalyzer.ts` (`useCanvasSPOF.ts` calls `lintTopology`), and delete dead standalone math exports at top of `LoadSimulationWorker.ts` (`erlangB`, `erlangC`, `allenCunneenQueueWaitMs`, `pollaczekKhinchine` consolidated once inside `TopologySimulationKernel`).
- **Physics Bug Fix:** Cache outgoing RPS uses computed `const hitRate = engineEval.cacheHitRatio ?? config.cacheHitRatio ?? 0.85` consistently across both simulators.

---

## 5. Storage & Zero-Downtime Migration Contract
- Pure client `in-process` computation; zero persistence or backend contract impact. Existing `useSimulationWorker.ts` hooks keep exact React return types and message payloads.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `TopologyNode[]` / `TopologyEdge[]` graph (cyclic or DAG) and non-negative `inputRps`.
- `{C}` Topological sort / cyclic BFS traffic distribution + M/M/c/K, Allen-Cunneen, Zipfian cache miss propagation (applying computed `engineEval.cacheHitRatio`), chaos degradation, and Tarjan SPOF / unbuffered DB write detection.
- `{Q}` Finite `SimulationTelemetryFrame` / `SimulationResponseMessage` and `SpofNodeAnalysis[]` returned deterministically; raising cache hit ratio reduces downstream DB incoming RPS proportionally; cyclic graphs terminate cleanly without infinite recursion.
