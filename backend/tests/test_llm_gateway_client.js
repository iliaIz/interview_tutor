/**
 * test_llm_gateway_client.js
 * In-memory HttpTransportPort verification suite for LlmGatewayClient (Spec 49 / #183).
 */

const assert = require('assert');
const { LlmGatewayClient, LlmGatewayUnavailableError } = require('../dist/services/LlmGatewayClient');

function createJsonResponse(status, bodyObj) {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createSseStreamResponse(chunks, failAfterFirst = false) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(chunks[0]));
      await new Promise((r) => setTimeout(r, 5));
      if (failAfterFirst) {
        controller.error(new Error('mid_stream_tcp_reset'));
        return;
      }
      for (let i = 1; i < chunks.length; i++) {
        controller.enqueue(encoder.encode(chunks[i]));
      }
      controller.close();
    }
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

async function runTests() {
  console.log('🧪 Starting LlmGatewayClient HttpTransportPort Invariant Suite...');

  // 1. Retries 429/503 via Full-Jitter and repairs fenced JSON
  {
    let calls = 0;
    const client = new LlmGatewayClient({
      async postJson() {
        calls++;
        if (calls === 1) return createJsonResponse(429, { error: 'rate limit' });
        if (calls === 2) return createJsonResponse(503, { error: 'unavailable' });
        return createJsonResponse(200, {
          choices: [{ message: { content: '```json\n{"score":95,"verdict":"PASS"}\n```' } }]
        });
      }
    });
    const parsed = await client.completeJson({ userPrompt: 'test' });
    assert.strictEqual(calls, 3, 'Must retry 429 and 503 before succeeding');
    assert.deepStrictEqual(parsed, { score: 95, verdict: 'PASS' });
    console.log('  ✅ Test 1: completeJson Full-Jitter retry + fence repair verified.');
  }

  // 2. Host failover host.docker.internal -> localhost
  {
    const urls = [];
    const client = new LlmGatewayClient({
      async postJson(req) {
        urls.push(req.url);
        if (req.url.includes('host.docker.internal')) {
          throw new Error('connect ECONNREFUSED host.docker.internal');
        }
        return createJsonResponse(200, { choices: [{ message: { content: 'ok_local' } }] });
      }
    });
    const text = await client.completeText({ userPrompt: 'ping', maxRetries: 0 });
    assert.strictEqual(text, 'ok_local');
    assert.ok(urls[0].includes('host.docker.internal'));
    assert.ok(urls[1].includes('localhost'));
    console.log('  ✅ Test 2: Docker host.docker.internal -> localhost failover verified.');
  }

  // 3. streamChat pre-first-byte retry + split SSE delta parsing + mid-stream fail-fast
  {
    let preCalls = 0;
    const preRetryClient = new LlmGatewayClient({
      async postJson() {
        preCalls++;
        if (preCalls === 1) return createJsonResponse(503, { error: 'booting' });
        return createSseStreamResponse([
          'data: {"choices":[{"delta":{"content":"При"}}]}\n\ndata: {"choi',
          'ces":[{"delta":{"content":"вет!"}}]}\n\ndata: [DONE]\n\n'
        ]);
      }
    });
    const tokens = [];
    for await (const delta of preRetryClient.streamChat({ userPrompt: 'hi', maxRetries: 1 })) {
      tokens.push(delta);
    }
    assert.strictEqual(preCalls, 2, 'streamChat retries 503 strictly before body bytes start');
    assert.strictEqual(tokens.join(''), 'Привет!');

    let midCalls = 0;
    const midFailClient = new LlmGatewayClient({
      async postJson() {
        midCalls++;
        return createSseStreamResponse(['data: {"choices":[{"delta":{"content":"first"}}]}\n\n'], true);
      }
    });
    const received = [];
    let midErr = null;
    try {
      for await (const delta of midFailClient.streamChat({ userPrompt: 'hi', maxRetries: 2 })) {
        received.push(delta);
      }
    } catch (err) {
      midErr = err;
    }
    assert.strictEqual(midCalls, 1, 'Mid-stream error must NOT retry and replay deltas');
    assert.deepStrictEqual(received, ['first']);
    assert.ok(midErr);
    console.log('  ✅ Test 3: streamChat pre-byte retry & mid-stream fail-fast verified.');
  }

  // 4. AbortSignal aborts immediately without retry sleep
  {
    let attempts = 0;
    const controller = new AbortController();
    controller.abort();
    const client = new LlmGatewayClient({
      async postJson() { attempts++; return createJsonResponse(200, {}); }
    });
    let aborted = false;
    try {
      await client.completeText({ userPrompt: 'x', abortSignal: controller.signal, maxRetries: 2 });
    } catch (err) {
      aborted = err.name === 'AbortError';
    }
    assert.strictEqual(aborted, true);
    assert.strictEqual(attempts, 0);
    console.log('  ✅ Test 4: AbortSignal short-circuits retries immediately.');
  }

  // 5. synthesizeSpeech & embed (maxRetries: 0)
  {
    let embedCalls = 0;
    const client = new LlmGatewayClient({
      async postJson(req) {
        if (req.url.endsWith('/audio/speech')) {
          return new Response(Buffer.from('RIFF_WAV_DATA'), { status: 200 });
        }
        embedCalls++;
        return createJsonResponse(200, { data: [{ embedding: [0.25, 0.5, 0.75] }] });
      }
    });
    const buf = await client.synthesizeSpeech({ text: 'hello', voice: 'Kore' });
    assert.strictEqual(buf.toString(), 'RIFF_WAV_DATA');
    const vec = await client.embed({ input: 'java concurrency' });
    assert.strictEqual(vec.length, 3);
    assert.strictEqual(embedCalls, 1);

    // Zero retries on rate_limit_exceeded leaves typed LlmGatewayUnavailableError
    const errClient = new LlmGatewayClient({
      async postJson() { return createJsonResponse(429, { error: 'exhausted' }); }
    });
    let caught = null;
    try {
      await errClient.embed({ input: 'fail fast', maxRetries: 0 });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof LlmGatewayUnavailableError);
    assert.strictEqual(caught.reason, 'rate_limit_exceeded');
    console.log('  ✅ Test 5: synthesizeSpeech + embed & LlmGatewayUnavailableError verified.');
  }

  console.log('\n🎉 ALL LLM GATEWAY CLIENT PORT TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ LlmGatewayClient test suite failed:', err);
  process.exit(1);
});
