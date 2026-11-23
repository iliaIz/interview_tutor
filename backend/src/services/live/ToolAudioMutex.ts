/**
 * ToolAudioMutex.ts
 *
 * Async Mutex gating microphone uplink frames during active tool executions.
 * Ported faithfully from gemini_live_reference/packages/core/src/tools/ToolAudioMutex.ts.
 * Prevents Google Multimodal Live API error:
 * "1008 Policy Violation: Operation is not implemented"
 * caused by streaming realtimeInput while upstream is awaiting a toolResponse.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

export class ToolAudioMutex {
  private readonly activeToolCalls = new Set<string>();

  /**
   * Acquires the mutex when a toolCall is received from upstream.
   * Gating begins immediately.
   */
  public acquire(toolCallId: string): void {
    if (toolCallId) {
      this.activeToolCalls.add(toolCallId);
    }
  }

  /**
   * Releases the mutex when a toolResponse is dispatched back to upstream.
   * Gating ends when all pending calls are resolved.
   */
  public release(toolCallId: string): void {
    if (toolCallId) {
      this.activeToolCalls.delete(toolCallId);
    }
  }

  /**
   * Cancels tool calls revoked by upstream during Barge-In (toolCallCancellation).
   */
  public cancel(ids: string[]): void {
    for (const id of ids) {
      this.activeToolCalls.delete(id);
    }
  }

  /**
   * Returns true if any tool call is currently executing and mic frames should be dropped.
   */
  public shouldGateMicAudio(): boolean {
    return this.activeToolCalls.size > 0;
  }

  /**
   * Returns the count of actively executing tools.
   */
  public get activeCount(): number {
    return this.activeToolCalls.size;
  }

  /**
   * Clears all locks (e.g. on session disconnect).
   */
  public reset(): void {
    this.activeToolCalls.clear();
  }
}
