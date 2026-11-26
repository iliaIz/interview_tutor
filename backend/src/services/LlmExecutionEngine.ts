/**
 * LlmExecutionEngine.ts
 * Backwards-compatible static facade delegating to LlmGatewayClient (Spec 49 T1 Prefactor).
 */

import {
  LlmGatewayClient,
  LlmGatewayUnavailableError,
  llmGateway,
  ReasoningPresetKey,
  LlmExecutionOptions,
  GatewayUnavailableReason
} from './LlmGatewayClient';

export type { ReasoningPresetKey, LlmExecutionOptions, GatewayUnavailableReason };
export { LlmGatewayUnavailableError };

export class LlmExecutionEngine {
  public static async executeText(options: LlmExecutionOptions): Promise<string> {
    return llmGateway.completeText(options);
  }

  public static async executeJson<T = any>(options: LlmExecutionOptions): Promise<T> {
    return llmGateway.completeJson<T>(options);
  }

  public static parseJsonWithRepair<T = any>(raw: string): T {
    return LlmGatewayClient.parseJsonWithRepair<T>(raw);
  }
}
