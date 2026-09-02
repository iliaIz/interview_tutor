import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  SimulationTelemetryFrame, 
  ChaosEventType 
} from '../../../types/systemDesignCanvas';

export interface UseSimulationWorkerOptions {
  initialInputRps?: number;
}

export function useSimulationWorker(options: UseSimulationWorkerOptions = {}) {
  const workerRef = useRef<Worker | null>(null);
  const [telemetry, setTelemetry] = useState<SimulationTelemetryFrame | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [inputRps, setInputRpsState] = useState<number>(options.initialInputRps || 1000);

  useEffect(() => {
    // Vite Web Worker instantiation
    const worker = new Worker(
      new URL('./LoadSimulationWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { type, frame } = event.data;
      if (type === 'TELEMETRY_FRAME') {
        setTelemetry(frame);
      }
    };

    return () => {
      worker.postMessage({ type: 'DESTROY' });
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const updateTopology = useCallback((nodes: any[], edges: any[], currentRps?: number) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: 'UPDATE_TOPOLOGY',
      payload: {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.data?.nodeType || n.type || 'service',
          label: n.data?.label || n.id,
          config: n.data?.config || {}
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          protocol: e.data?.config?.protocol || 'REST',
          isAsync: e.data?.config?.isAsync || false,
          timeoutMs: e.data?.config?.timeoutMs || 3000,
          trafficWeight: e.data?.config?.trafficWeight || 1.0
        })),
        inputRps: currentRps ?? inputRps
      }
    });
  }, [inputRps]);

  const setInputRps = useCallback((rps: number) => {
    setInputRpsState(rps);
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: 'SET_INPUT_RPS',
      payload: { rps }
    });
  }, []);

  const triggerChaos = useCallback((chaosType: ChaosEventType, targetNodeId?: string) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: 'TRIGGER_CHAOS',
      payload: { chaosType, targetNodeId }
    });
  }, []);

  const togglePause = useCallback(() => {
    if (!workerRef.current) return;
    if (isPaused) {
      workerRef.current.postMessage({ type: 'RESUME' });
      setIsPaused(false);
    } else {
      workerRef.current.postMessage({ type: 'PAUSE' });
      setIsPaused(true);
    }
  }, [isPaused]);

  return {
    telemetry,
    inputRps,
    setInputRps,
    updateTopology,
    triggerChaos,
    isPaused,
    togglePause
  };
}
