/**
 * High-Performance JVM Thread Dump Streaming Parser & Tarjan SCC Deadlock Cycle Detector
 * Adheres to Pillar 5 SSOT (docs/architecture/specs/05_PRODUCTION_INCIDENT_TRIAGE.md)
 */

export type ThreadState = 'BLOCKED' | 'WAITING' | 'TIMED_WAITING' | 'RUNNABLE' | 'UNKNOWN';

export interface ParsedThread {
  name: string;
  tid: string;
  nid: string;
  state: ThreadState;
  poolGroup: string;
  lockWaiting?: string;
  lockHolding: string[];
  isDeadlocked?: boolean;
  deadlockCycleId?: number;
  stack: string[];
}

export interface DeadlockCycle {
  cycleId: number;
  threadNames: string[];
  lockIds: string[];
  explanation: string;
}

export interface ParsedThreadDump {
  threads: ParsedThread[];
  threadPools: Record<string, ParsedThread[]>;
  counts: {
    total: number;
    blocked: number;
    waiting: number;
    timedWaiting: number;
    runnable: number;
    deadlocked: number;
  };
  deadlockCycles: DeadlockCycle[];
  hasDeadlock: boolean;
  deadlockSnippet?: string;
}

/**
 * Extracts thread pool group name from thread name (e.g. "http-nio-8080-exec-1" -> "http-nio-8080-exec")
 */
function extractPoolGroup(threadName: string): string {
  // Strip trailing numbers, IDs, and hashes
  const cleaned = threadName.replace(/[-_#\s]*\d+$/i, '').trim();
  if (cleaned.startsWith('VirtualThread')) return 'VirtualThreads';
  if (cleaned.toLowerCase().includes('hikari')) return 'HikariCP';
  if (cleaned.toLowerCase().includes('kafka')) return 'Kafka';
  if (cleaned.toLowerCase().includes('nio') || cleaned.toLowerCase().includes('http')) return 'HttpConnector';
  if (cleaned.toLowerCase().includes('schedul') || cleaned.toLowerCase().includes('timer')) return 'Schedulers';
  if (cleaned.toLowerCase().includes('gc') || cleaned.toLowerCase().includes('compiler')) return 'JVM-Internal';
  return cleaned || 'General';
}

/**
 * Tarjan's Strongly Connected Components (SCC) Deadlock Cycle Detector
 * Executes in O(|V| + |E|) sub-millisecond time.
 */
export function detectDeadlocksTarjan(threads: ParsedThread[]): DeadlockCycle[] {
  const adj = new Map<string, string[]>();

  // Helper to add directed edge u -> v
  const addEdge = (u: string, v: string) => {
    let list = adj.get(u);
    if (!list) {
      list = [];
      adj.set(u, list);
    }
    list.push(v);
  };

  for (const t of threads) {
    const threadKey = `T:${t.name}`;
    if (t.lockWaiting) {
      // Wait Edge: Thread is waiting to acquire lock
      addEdge(threadKey, `L:${t.lockWaiting}`);
    }
    for (const lock of t.lockHolding) {
      // Hold Edge: Lock is held by Thread
      addEdge(`L:${lock}`, threadKey);
    }
  }

  // Tarjan's algorithm variables
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  const strongConnect = (v: string) => {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adj.get(v) || [];
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      // A deadlock cycle must contain at least 2 nodes (e.g. 1 thread and 1 lock or multiple)
      if (scc.length > 1) {
        sccs.push(scc);
      }
    }
  };

  for (const v of adj.keys()) {
    if (!indices.has(v)) {
      strongConnect(v);
    }
  }

  const cycles: DeadlockCycle[] = [];
  let cycleCounter = 1;

  for (const scc of sccs) {
    const threadNames = scc.filter((n) => n.startsWith('T:')).map((n) => n.slice(2));
    const lockIds = scc.filter((n) => n.startsWith('L:')).map((n) => n.slice(2));

    if (threadNames.length >= 2) {
      const cycleId = cycleCounter++;
      for (const tName of threadNames) {
        const tObj = threads.find((t) => t.name === tName);
        if (tObj) {
          tObj.isDeadlocked = true;
          tObj.deadlockCycleId = cycleId;
        }
      }

      cycles.push({
        cycleId,
        threadNames,
        lockIds,
        explanation: `Циклическая взаимоблокировка (Deadlock #${cycleId}): ${threadNames.join(' ↔ ')} конкурируют за мониторы [${lockIds.join(', ')}].`
      });
    }
  }

  return cycles;
}

/**
 * Fast streaming line-by-line parser for JVM thread dumps
 */
export function parseThreadDumpFast(rawText: string): ParsedThreadDump {
  const threads: ParsedThread[] = [];
  const lines = rawText.split('\n');
  const n = lines.length;

  let currentThread: Partial<ParsedThread> | null = null;
  let currentStack: string[] = [];

  const lockHexRegex = /<(0x[0-9a-fA-F]+)>/;
  const tidRegex = /tid=(0x[0-9a-fA-F]+|\d+)/i;
  const nidRegex = /nid=(0x[0-9a-fA-F]+|\d+)/i;

  const finalizeCurrentThread = () => {
    if (currentThread && currentThread.name) {
      threads.push({
        name: currentThread.name,
        tid: currentThread.tid || '',
        nid: currentThread.nid || '',
        state: currentThread.state || 'UNKNOWN',
        poolGroup: extractPoolGroup(currentThread.name),
        lockWaiting: currentThread.lockWaiting,
        lockHolding: currentThread.lockHolding || [],
        stack: currentStack
      });
    }
    currentThread = null;
    currentStack = [];
  };

  for (let i = 0; i < n; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Thread Header line: e.g. "http-nio-8080-exec-1" #24 daemon prio=5 tid=0x00007f...
    if (trimmed.startsWith('"') && trimmed.includes('"')) {
      finalizeCurrentThread();

      const firstQuote = trimmed.indexOf('"');
      const secondQuote = trimmed.indexOf('"', firstQuote + 1);
      const name = trimmed.substring(firstQuote + 1, secondQuote);

      const tidMatch = trimmed.match(tidRegex);
      const nidMatch = trimmed.match(nidRegex);

      currentThread = {
        name,
        tid: tidMatch ? tidMatch[1] : '',
        nid: nidMatch ? nidMatch[1] : '',
        state: 'UNKNOWN',
        lockHolding: []
      };
      continue;
    }

    // 2. Thread State line: java.lang.Thread.State: BLOCKED (on object monitor)
    if (trimmed.startsWith('java.lang.Thread.State:')) {
      if (currentThread) {
        const statePart = trimmed.split(':')[1]?.trim().split(/\s+/)[0] || 'UNKNOWN';
        if (statePart === 'BLOCKED') currentThread.state = 'BLOCKED';
        else if (statePart === 'WAITING') currentThread.state = 'WAITING';
        else if (statePart === 'TIMED_WAITING') currentThread.state = 'TIMED_WAITING';
        else if (statePart === 'RUNNABLE') currentThread.state = 'RUNNABLE';
        else currentThread.state = 'UNKNOWN';
      }
      continue;
    }

    // 3. Stack trace & lock acquisition inspection
    if (currentThread && (trimmed.startsWith('at ') || trimmed.startsWith('- '))) {
      currentStack.push(trimmed);

      // Lock waiting check
      if (trimmed.includes('- waiting to lock') || trimmed.includes('- waiting on')) {
        const match = trimmed.match(lockHexRegex);
        if (match) currentThread.lockWaiting = match[1];
      }

      // Lock holding check
      if (trimmed.includes('- locked')) {
        const match = trimmed.match(lockHexRegex);
        if (match && !currentThread.lockHolding?.includes(match[1])) {
          currentThread.lockHolding?.push(match[1]);
        }
      }
    }
  }

  finalizeCurrentThread();

  // Run Tarjan cycle detection
  const deadlockCycles = detectDeadlocksTarjan(threads);

  // Group threads by pool
  const threadPools: Record<string, ParsedThread[]> = {};
  for (const t of threads) {
    if (!threadPools[t.poolGroup]) {
      threadPools[t.poolGroup] = [];
    }
    threadPools[t.poolGroup].push(t);
  }

  let deadlockSnippet: string | undefined;
  if (deadlockCycles.length > 0 || rawText.includes('Java-level deadlock')) {
    const match = rawText.match(/Found one Java-level deadlock:[\s\S]*?(?=\n\n\n|\n[A-Z]|$)/);
    deadlockSnippet = match ? match[0] : deadlockCycles.map((c) => c.explanation).join('\n');
  }

  return {
    threads,
    threadPools,
    counts: {
      total: threads.length,
      blocked: threads.filter((t) => t.state === 'BLOCKED').length,
      waiting: threads.filter((t) => t.state === 'WAITING').length,
      timedWaiting: threads.filter((t) => t.state === 'TIMED_WAITING').length,
      runnable: threads.filter((t) => t.state === 'RUNNABLE').length,
      deadlocked: threads.filter((t) => t.isDeadlocked).length
    },
    deadlockCycles,
    hasDeadlock: deadlockCycles.length > 0 || rawText.includes('Java-level deadlock'),
    deadlockSnippet
  };
}
