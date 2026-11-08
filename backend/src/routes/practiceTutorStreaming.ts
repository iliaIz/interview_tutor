import { Response } from 'express';
import { envConfig } from '../config/env';
import { TreeEditDistanceGuard } from '../services/sandbox/TreeEditDistanceGuard';

/**
 * practiceTutorStreaming.ts
 * Streaming transport and LiteLLM Proxy connector for Socratic Tutor.
 * Decouples SSE reader, buffering, and AST solution guarding from express routes.
 * File length limit: <= 350 lines (Rule 8).
 */

export async function callLiteLlm(payload: any, abortSignal?: AbortSignal): Promise<globalThis.Response> {
  const endpointUrl = envConfig.proxy.chatUrl;
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${envConfig.proxy.apiKey}` },
    signal: abortSignal,
    body: JSON.stringify(payload)
  };
  try {
    return await fetch(endpointUrl, init);
  } catch (err: any) {
    if (endpointUrl.includes('host.docker.internal')) {
      const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
      console.log(`🔄 Retrying LiteLLM Proxy with local URL: ${localUrl}`);
      return await fetch(localUrl, init);
    }
    throw err;
  }
}

export async function streamTutorSse(
  upstreamRes: globalThis.Response,
  res: Response,
  options: { targetSolutions: string[]; isSocratic: boolean }
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();

  const reader = upstreamRes.body?.getReader();
  if (!reader) {
    res.write(`data: ${JSON.stringify({ error: 'No readable stream available' })}\n\n`);
    res.end();
    return;
  }

  const decoder = new TextDecoder('utf-8');
  let accumulatedContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      if (trimmed === 'data: [DONE]') continue;

      try {
        const json = JSON.parse(trimmed.slice(5).trim());
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) {
          accumulatedContent += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          const resWithFlush = res as unknown as { flush?: () => void };
          if (typeof resWithFlush.flush === 'function') resWithFlush.flush();
        }
      } catch {
        // ignore chunk parse errors
      }
    }
  }

  // Final Post-Stream AST check on accumulated text
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
