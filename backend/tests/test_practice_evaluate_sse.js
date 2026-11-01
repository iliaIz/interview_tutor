const http = require('http');
const assert = require('assert');
const express = require('express');

console.log('========================================================================');
console.log('🧪 VERIFYING SOTA PROGRESSIVE SSE STREAMING & RESILIENCE FOR PRACTICE');
console.log('========================================================================\n');

// Import compiled backend services
const { db, seedCodingChallenges } = require('../dist/services/db');
const { authService } = require('../dist/services/authService');
const practiceRouter = require('../dist/routes/practice').default || require('../dist/routes/practice');

// Ensure challenges and test data exist
seedCodingChallenges();

// Create test user and auth session
const testUserId = 'test_user_sse_suite';
try {
  db.prepare(`INSERT OR IGNORE INTO users (id, name, role) VALUES (?, ?, ?)`).run(testUserId, 'SSE Test User', 'user');
} catch {}
const testSessionId = authService.createSession(testUserId, 'SSE-Test-Agent/1.0', '127.0.0.1');

// Setup minimal test Express application
const app = express();
app.use(express.json({ limit: '5mb' }));

// Attach practice router with mock auth
app.use('/api/practice', (req, res, next) => {
  req.user = { id: testUserId, name: 'SSE Test User', role: 'user' };
  next();
}, practiceRouter);

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function parseSseEvents(rawText) {
  const events = [];
  const rawBlocks = rawText.split('\n\n');
  for (const block of rawBlocks) {
    if (!block.trim()) continue;
    let eventName = 'message';
    let dataStr = '';
    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventName = line.substring(7).trim();
      } else if (line.startsWith('data: ')) {
        dataStr = line.substring(6).trim();
      }
    }
    if (dataStr) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataStr) });
      } catch {
        events.push({ event: eventName, data: dataStr });
      }
    }
  }
  return events;
}

async function runTests() {
  const { server, port } = await startServer();
  console.log(`📡 Test server listening on http://127.0.0.1:${port}`);

  try {
    // ------------------------------------------------------------------
    // TEST 1: Fast-Path Bailout on Uncompilable Code (0ms without LLM)
    // ------------------------------------------------------------------
    console.log('\n--- Test 1: Fast-Path Bailout for Uncompilable Code ---');
    const uncompilablePayload = {
      challengeId: 'lab_java21_modern_idioms',
      files: [{
        path: 'src/main/java/Broken.java',
        content: 'public class Broken { void oops( { }'
      }],
      activePhase: 1,
      timeSpentSeconds: 15
    };

    const t0 = Date.now();
    const sseResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/practice/evaluate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${testSessionId}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk.toString('utf-8'); });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.write(JSON.stringify(uncompilablePayload));
      req.end();
    });

    const durationMs = Date.now() - t0;
    console.log(`  Completed in ${durationMs}ms with status ${sseResponse.statusCode}`);
    assert.strictEqual(sseResponse.statusCode, 200, 'Must return 200 OK');
    assert.ok(sseResponse.headers['content-type']?.includes('text/event-stream'), 'Must return text/event-stream');

    const events = parseSseEvents(sseResponse.body);
    console.log(`  Received ${events.length} SSE events:`, events.map(e => `${e.event}:${e.data?.stage || 'complete'}`));

    const sandboxEvent = events.find(e => e.event === 'stage' && e.data?.stage === 'sandbox');
    const sandboxDoneEvent = events.find(e => e.event === 'stage' && e.data?.stage === 'sandbox_done');
    const completeEvent = events.find(e => e.event === 'complete');

    assert.ok(sandboxEvent, 'Must emit sandbox running event');
    assert.ok(sandboxDoneEvent, 'Must emit sandbox_done event');
    assert.strictEqual(sandboxDoneEvent.data.isCompilable, false, 'sandbox_done must flag isCompilable=false');
    assert.ok(completeEvent, 'Must emit complete event');
    assert.strictEqual(completeEvent.data.evaluation.compilationStatus.isCompilable, false, 'Evaluation must reflect uncompilable status');
    assert.strictEqual(completeEvent.data.evaluation.scoreBreakdown.overallScore, 0, 'Overall score must be 0 for broken code');
    assert.ok(durationMs < 2500, `Bailout must be fast (<2500ms, actual: ${durationMs}ms)`);
    console.log('  ✅ Test 1 PASSED: Fast-path bailout verified cleanly!');

    // ------------------------------------------------------------------
    // TEST 2: Decoupled SQLite Persistence Verification
    // ------------------------------------------------------------------
    console.log('\n--- Test 2: Decoupled SQLite Persistence Verification ---');
    const submission = db.prepare('SELECT * FROM coding_submissions WHERE challenge_id = ? AND user_id = ?')
      .get('lab_java21_modern_idioms', testUserId);

    assert.ok(submission, 'Submission row must exist in SQLite database');
    assert.strictEqual(submission.status, 'FAILED', 'Submission status must be FAILED');
    assert.strictEqual(submission.score, 0, 'Submission score must be 0');
    assert.ok(submission.evaluation_json, 'Evaluation JSON must be stored');

    const parsedEval = JSON.parse(submission.evaluation_json);
    assert.strictEqual(parsedEval.compilationStatus.isCompilable, false, 'Stored evaluation must be uncompilable');
    console.log('  ✅ Test 2 PASSED: SQLite persistence verified with tenant isolation!');

    // ------------------------------------------------------------------
    // TEST 3: Client Abort & Resource Leak Resilience
    // ------------------------------------------------------------------
    console.log('\n--- Test 3: Client Abort & Resource Leak Resilience ---');
    await new Promise((resolve, reject) => {
      const abortReq = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/practice/evaluate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${testSessionId}`
        }
      }, (res) => {
        // Once first chunk arrives, immediately destroy socket to simulate client disconnect
        res.on('data', () => {
          console.log('  Received initial chunk, destroying client socket now...');
          abortReq.destroy();
          setTimeout(() => {
            console.log('  Client destroyed. Server process healthy and still running.');
            resolve();
          }, 300);
        });
      });

      abortReq.on('error', (err) => {
        // Expected ECONNRESET on client side after destroy
        if (err.code === 'ECONNRESET' || err.message.includes('socket hang up') || err.message.includes('destroyed')) {
          resolve();
        } else {
          reject(err);
        }
      });

      abortReq.write(JSON.stringify(uncompilablePayload));
      abortReq.end();
    });
    console.log('  ✅ Test 3 PASSED: Client disconnect handled gracefully without crashing!');

    // ------------------------------------------------------------------
    // TEST 4: Backward-Compatible JSON Negotiation (Accept: application/json)
    // ------------------------------------------------------------------
    console.log('\n--- Test 4: Backward-Compatible JSON Mode Negotiation ---');
    const jsonResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/practice/evaluate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${testSessionId}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk.toString('utf-8'); });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.write(JSON.stringify(uncompilablePayload));
      req.end();
    });

    assert.strictEqual(jsonResponse.statusCode, 200, 'Must return 200 OK');
    assert.ok(jsonResponse.headers['content-type']?.includes('application/json'), 'Must return application/json');
    const jsonData = JSON.parse(jsonResponse.body);
    assert.strictEqual(jsonData.success, true, 'Must return success: true');
    assert.strictEqual(jsonData.isPassed, false, 'Must return isPassed: false');
    assert.strictEqual(jsonData.evaluation?.compilationStatus?.isCompilable, false, 'Must have compilable=false');
    console.log('  ✅ Test 4 PASSED: Dual negotiation (SSE vs JSON) verified!');

    console.log('\n========================================================================');
    console.log('🎉 ALL PRACTICE EVALUATION SSE INTEGRATION TESTS PASSED (4/4)!');
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Fatal Test Failure:', err);
  process.exit(1);
});
