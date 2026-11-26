import { Response } from 'express';
import { TreeEditDistanceGuard } from '../services/sandbox/TreeEditDistanceGuard';

/**
 * practiceTutorStreaming.ts
 * Streaming SSE writer & AST solution guard for Socratic Tutor over LlmGatewayClient (Spec 49).
 */

export async function streamTutorSse(
  deltaStream: AsyncIterable<string>,
  res: Response,
  options: { targetSolutions: string[]; isSocratic: boolean }
): Promise<void> {
  // Pull first chunk BEFORE flushing HTTP 200 SSE headers so pre-stream 429/503 errors can return JSON status cleanly
  const iterator = deltaStream[Symbol.asyncIterator]();
  const firstStep = await iterator.next();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();

  const resWithFlush = res as unknown as { flush?: () => void };
  let accumulatedContent = '';

  const emitDelta = (delta: string) => {
    if (!delta) return;
    accumulatedContent += delta;
    res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    resWithFlush.flush?.();
  };

  if (!firstStep.done) {
    emitDelta(firstStep.value);
    while (true) {
      const step = await iterator.next();
      if (step.done) break;
      emitDelta(step.value);
    }
  }

  const finalGuard = TreeEditDistanceGuard.guardResponse(accumulatedContent, options.targetSolutions, {
    leakThreshold: 0.40,
    isSocraticEnforced: options.isSocratic
  });

  res.write(
    `data: ${JSON.stringify({
      done: true,
      leakDetected: finalGuard.leakDetected,
      maxSimilarity: finalGuard.maxSimilarity
    })}\n\n`
  );
  res.end();
}
