const http = require('http');
const assert = require('assert');
const express = require('express');

console.log('========================================================================');
console.log('🧪 SOTA INTEGRATED FAULT-INJECTION & RESILIENCE SUITE FOR LLD PRACTICE');
console.log('========================================================================\n');

// Import compiled backend modules
const { db, seedCodingChallenges } = require('../dist/services/db');
const { authService } = require('../dist/services/authService');
const { envConfig } = require('../dist/config/env');
const practiceRouter = require('../dist/routes/practice').default || require('../dist/routes/practice');

// Ensure challenges exist in test DB
seedCodingChallenges();

// Setup test user and session
const testUserId = 'fault_injection_user';
const testSessionId = authService.createSession(testUserId, 'Fault-Injection-Agent/1.0', '127.0.0.1');

// 1. Setup Mock LiteLLM Proxy with Chaos / Fault-Injection capabilities
function createMockLiteLlmGateway() {
  let requestCount = 0;
  let faultSequence = [];

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString('utf-8'); });
    req.on('end', () => {
      requestCount++;
      const currentFault = faultSequence.length > 0 ? faultSequence.shift() : 'ok';

      if (currentFault === '503') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'LiteLLM Gateway Overloaded (503 Service Unavailable)' } }));
        return;
      }

      if (currentFault === '429') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'LiteLLM Rate Limit Exceeded (429 Too Many Requests)' } }));
        return;
      }

      // Valid response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const mockAuditJson = {
        compilationStatus: { isCompilable: true, syntaxErrors: [] },
        virtualExecutionResult: {
          passCount: 1,
          failCount: 0,
          testCases: [{
            testName: 'DomainLogicTest',
            status: 'PASSED',
            inputData: 'sampleInput',
            expectedOutput: 'sampleOutput',
            actualVirtualOutput: 'sampleOutput'
          }]
        },
        concurrencyAnalysis: {
          hasRaceConditions: false,
          hasJmmVisibilityIssues: false,
          hasCarrierThreadPinning: false,
          findings: []
        },
        architecturalCompliance: {
          isSolidCompliant: true,
          springBootBestPracticesViolations: [],
          modernJava21IdiomAdoption: ['Idiomatic Java 21 Record and Pattern Matching']
        },
        scoreBreakdown: {
          correctnessScore: 95,
          concurrencyScore: 90,
          architectureScore: 90,
          modernIdiomsScore: 95,
          overallScore: 92,
          summaryReview: 'Решение высокого качества, код полностью соответствует стандартам Java 21 и потокобезопасности.'
        }
      };

      res.end(JSON.stringify({
        choices: [{
          message: {
            content: '```json\n' + JSON.stringify(mockAuditJson, null, 2) + '\n```'
          }
        }]
      }));
    });
  });

  return {
    server,
    setFaultSequence: (seq) => { faultSequence = [...seq]; },
    getRequestCount: () => requestCount,
    resetRequestCount: () => { requestCount = 0; }
  };
}

// 2. Setup Test Application
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/practice', (req, res, next) => {
  req.user = { id: testUserId, name: 'Fault Injection User', role: 'user' };
  next();
}, practiceRouter);

function parseSseStream(rawText) {
  const events = [];
  const keepAliveCount = (rawText.match(/: keep-alive\n\n/g) || []).length;
  const rawBlocks = rawText.split('\n\n');

  for (const block of rawBlocks) {
    if (!block.trim() || block.startsWith(': keep-alive')) continue;
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
  return { events, keepAliveCount };
}

async function runFaultInjectionSuite() {
  const mockGateway = createMockLiteLlmGateway();
  await new Promise(resolve => mockGateway.server.listen(0, '127.0.0.1', resolve));
  const mockGatewayPort = mockGateway.server.address().port;
  const mockGatewayUrl = `http://127.0.0.1:${mockGatewayPort}/v1/chat/completions`;

  // Route backend traffic to our Chaos Mock Gateway
  envConfig.proxy.chatUrl = mockGatewayUrl;
  console.log(`🌐 Mock LiteLLM Proxy running on http://127.0.0.1:${mockGatewayPort}`);

  const testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(0, '127.0.0.1', resolve));
  const appPort = testServer.address().port;
  console.log(`📡 Practice backend running on http://127.0.0.1:${appPort}`);

  try {
    // -------------------------------------------------------------------------------------
    // SCENARIO 1: Transient 503 Recovery during Compilable Code Evaluation
    // -------------------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Transient 503 on Attempt 1 -> Transparent Recovery on Attempt 2 ---');
    mockGateway.resetRequestCount();
    mockGateway.setFaultSequence(['503', 'ok']); // 503 first, then ok

    const validSubmissionPayload = {
      challengeId: 'lab_java21_modern_idioms',
      files: [{
        path: 'src/main/java/OrderService.java',
        content: `
package com.assessment;
import java.util.List;

public class OrderService {
    public record OrderItem(String id, double price) {}
    public double calculateTotal(List<OrderItem> items) {
        return items.stream().mapToDouble(OrderItem::price).sum();
    }
}
`
      }],
      activePhase: 1,
      timeSpentSeconds: 45
    };

    const t0 = Date.now();
    const sseResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: appPort,
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
      req.write(JSON.stringify(validSubmissionPayload));
      req.end();
    });

    const durationMs = Date.now() - t0;
    console.log(`  Completed in ${durationMs}ms with status ${sseResponse.statusCode}`);
    assert.strictEqual(sseResponse.statusCode, 200, 'Must return 200 OK');

    const { events, keepAliveCount } = parseSseStream(sseResponse.body);
    console.log(`  Received ${events.length} SSE events and ${keepAliveCount} keep-alive frames.`);
    console.log(`  Events list:`, events.map(e => `${e.event}:${e.data?.stage || (e.data?.success ? 'success' : 'other')}`));

    // Assertions
    assert.strictEqual(mockGateway.getRequestCount(), 2, 'Must have made exactly 2 attempts to LiteLLM (1 retry)');
    
    const errorEvent = events.find(e => e.event === 'error');
    assert.strictEqual(errorEvent, undefined, 'Client must NOT receive an error event during transient 503 recovery');

    const completeEvent = events.find(e => e.event === 'complete');
    assert.ok(completeEvent, 'Must emit final complete event');
    assert.strictEqual(completeEvent.data.success, true);
    assert.strictEqual(completeEvent.data.evaluation.compilationStatus.isCompilable, true);
    assert.ok(completeEvent.data.evaluation.scoreBreakdown.overallScore >= 70);
    console.log('  ✅ Scenario 1 PASSED: Full-Jitter retry shielded client from 503 error completely!');

    // -------------------------------------------------------------------------------------
    // SCENARIO 2: Rate Limit 429 Recovery during Compilable Code Evaluation
    // -------------------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Transient 429 Rate Limit Recovery ---');
    mockGateway.resetRequestCount();
    mockGateway.setFaultSequence(['429', 'ok']); // 429 first, then ok

    const sseResponse429 = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: appPort,
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
      req.write(JSON.stringify(validSubmissionPayload));
      req.end();
    });

    const parsed429 = parseSseStream(sseResponse429.body);
    assert.strictEqual(mockGateway.getRequestCount(), 2, 'Must retry on 429');
    assert.ok(parsed429.events.some(e => e.event === 'complete'), 'Must complete successfully after 429 retry');
    console.log('  ✅ Scenario 2 PASSED: 429 Rate Limit successfully recovered with zero client impact!');

    // -------------------------------------------------------------------------------------
    // SCENARIO 3: Persistent 503 Failure Gracefully Propagated to Client
    // -------------------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Persistent 503 (Exhausted Retries) Propagates Gracefully ---');
    mockGateway.resetRequestCount();
    mockGateway.setFaultSequence(['503', '503', '503', '503']);

    const sseResponsePersistent = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: appPort,
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
      req.write(JSON.stringify(validSubmissionPayload));
      req.end();
    });

    const parsedPersistent = parseSseStream(sseResponsePersistent.body);
    assert.strictEqual(mockGateway.getRequestCount(), 3, 'Must attempt initial + 2 retries = 3 total before giving up');
    const persistentError = parsedPersistent.events.find(e => e.event === 'error');
    assert.ok(persistentError, 'Must emit structured error event when all retries fail');
    assert.ok(persistentError.data.error.includes('503'), 'Error message must reflect gateway status code');
    console.log('  ✅ Scenario 3 PASSED: Persistent failure exhausts 3 attempts and emits clean error event!');

    console.log('\n========================================================================');
    console.log('🎉 ALL INTEGRATED FAULT-INJECTION RESILIENCE SCENARIOS PASSED (3/3)!');
    console.log('========================================================================\n');
  } finally {
    testServer.close();
    mockGateway.server.close();
  }
}

runFaultInjectionSuite().catch(err => {
  console.error('❌ Fault injection suite failed:', err);
  process.exit(1);
});
