/**
 * LoadSimulationWorker.ts
 * Thin Web Worker adapter delegating physics ticks to TopologySimulationKernel (Spec 52).
 */

import {
  createContinuousSimState,
  updateContinuousTopology,
  triggerContinuousChaos,
  stepContinuousSimulation
} from './TopologySimulationKernel';

const state = createContinuousSimState();
let isRunning = false;
let timer: ReturnType<typeof setInterval> | null = null;

function ensureLoop(): void {
  if (timer) return;
  isRunning = true;
  timer = setInterval(() => {
    if (isRunning) {
      const frame = stepContinuousSimulation(state, 0.1);
      self.postMessage({ type: 'TELEMETRY_FRAME', frame });
    }
  }, 100);
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data || {};
  switch (type) {
    case 'INIT':
    case 'UPDATE_TOPOLOGY':
      updateContinuousTopology(state, payload?.nodes || [], payload?.edges || [], payload?.inputRps);
      ensureLoop();
      break;
    case 'SET_INPUT_RPS':
      state.inputRps = Math.max(10, payload?.rps ?? state.inputRps);
      break;
    case 'TRIGGER_CHAOS':
      triggerContinuousChaos(state, payload?.chaosType, payload?.targetNodeId);
      break;
    case 'PAUSE':
      isRunning = false;
      break;
    case 'RESUME':
      isRunning = true;
      break;
    case 'DESTROY':
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      isRunning = false;
      break;
  }
};
