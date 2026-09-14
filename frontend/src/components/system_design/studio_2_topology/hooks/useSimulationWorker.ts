import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  SimulationRequestMessage,
  SimulationResponseMessage,
  NodeTelemetry,
  TimelineSample,
  TopologyNodePayload,
  TopologyEdgePayload
} from '../../../../workers/des/types/workerMessages';

export interface UseSimulationWorkerReturn {
  isRunning: boolean;
  result: SimulationResponseMessage | null;
  telemetry: Record<string, NodeTelemetry>;
  timeline: TimelineSample[];
  error: string | null;
  runSimulation: (manifest: any, options?: { overrideRps?: number; enableChaos?: boolean }) => Promise<SimulationResponseMessage | null>;
  stopSimulation: () => void;
  resetSimulation: () => void;
}

export function useSimulationWorker(): UseSimulationWorkerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResponseMessage | null>(null);
  const [telemetry, setTelemetry] = useState<Record<string, NodeTelemetry>>({});
  const [timeline, setTimeline] = useState<TimelineSample[]>([]);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const resolvePromiseRef = useRef<((val: SimulationResponseMessage | null) => void) | null>(null);

  // Initialize Worker
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('../../../../workers/desSimulator.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || !data.type) return;

        if (data.type === 'SIMULATION_RESULT') {
          const res = data as SimulationResponseMessage;
          if (res.requestId === activeRequestRef.current) {
            setResult(res);
            setTelemetry(res.node_telemetry || {});
            setTimeline(res.timeline_samples || []);
            setIsRunning(false);
            if (resolvePromiseRef.current) {
              resolvePromiseRef.current(res);
              resolvePromiseRef.current = null;
            }
          }
        } else if (data.type === 'SIMULATION_ERROR') {
          if (data.requestId === activeRequestRef.current) {
            setError(data.error || 'Simulation failed');
            setIsRunning(false);
            if (resolvePromiseRef.current) {
              resolvePromiseRef.current(null);
              resolvePromiseRef.current = null;
            }
          }
        }
      };

      worker.onerror = (err) => {
        console.error('DES Web Worker error:', err);
        setError('Worker encountered an unhandled error');
        setIsRunning(false);
        if (resolvePromiseRef.current) {
          resolvePromiseRef.current(null);
          resolvePromiseRef.current = null;
        }
      };

      workerRef.current = worker;
    } catch (e: any) {
      console.error('Failed to instantiate DES Worker:', e);
      setError('Worker initialization failed');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const runSimulation = useCallback((manifest: any, options?: { overrideRps?: number; enableChaos?: boolean }): Promise<SimulationResponseMessage | null> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        setError('Simulation worker not ready');
        resolve(null);
        return;
      }

      const simSpec = manifest?.studio_2_simulation || {};
      const topology = simSpec.topology || { nodes: [], edges: [] };
      const traffic = simSpec.traffic_profile || {};

      const nodes: TopologyNodePayload[] = (topology.nodes || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        params: n.params || {}
      }));

      const edges: TopologyEdgePayload[] = (topology.edges || []).map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: e.protocol || 'http_rest',
        bandwidth_limit_mbps: e.bandwidth_limit_mbps
      }));

      const lambdaRps = options?.overrideRps ?? (traffic.target_rps_peak || traffic.target_rps_mean || 1000);
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeRequestRef.current = requestId;
      resolvePromiseRef.current = resolve;

      const requestMsg: SimulationRequestMessage = {
        type: 'RUN_SIMULATION',
        requestId,
        scenario_id: manifest.canonical_id || manifest.id || 'unknown',
        target_level: manifest.target_level || 'L5_SENIOR',
        topology: { nodes, edges },
        traffic: {
          pattern: traffic.pattern || 'POISSON',
          lambda_mean_rps: lambdaRps,
          inter_arrival_cv: traffic.inter_arrival_cv || 1.0,
          read_ratio: traffic.read_ratio ?? 0.8,
          prompt_tokens_mean: traffic.prompt_tokens_mean,
          generation_tokens_mean: traffic.generation_tokens_mean
        },
        roofline: traffic.roofline_spec,
        duration_seconds: simSpec.simulation_duration_ticks || 60,
        enable_chaos: options?.enableChaos ?? false,
        chaos_scenarios: simSpec.failure_injection ? [simSpec.failure_injection] : []
      };

      setIsRunning(true);
      setError(null);
      workerRef.current.postMessage(requestMsg);
    });
  }, []);

  const stopSimulation = useCallback(() => {
    setIsRunning(false);
    activeRequestRef.current = null;
    if (resolvePromiseRef.current) {
      resolvePromiseRef.current(null);
      resolvePromiseRef.current = null;
    }
  }, []);

  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    setResult(null);
    setTelemetry({});
    setTimeline([]);
    setError(null);
    activeRequestRef.current = null;
  }, []);

  return {
    isRunning,
    result,
    telemetry,
    timeline,
    error,
    runSimulation,
    stopSimulation,
    resetSimulation
  };
}
