/// <reference lib="webworker" />

import type { SimulationRequestMessage } from './des/types/workerMessages.ts';
import { runDesScenario } from '../components/system_design/simulation/TopologySimulationKernel';

export const runSimulation = runDesScenario;

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (event: MessageEvent<SimulationRequestMessage>) => {
    try {
      const request = event.data;
      if (request && request.type === 'RUN_SIMULATION') {
        self.postMessage(runDesScenario(request));
      }
    } catch (err: any) {
      self.postMessage({
        type: 'SIMULATION_ERROR',
        requestId: event.data?.requestId || 'unknown',
        error: err?.message || String(err)
      });
    }
  };
}
