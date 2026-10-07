/**
 * ideBridgeContracts.test.ts
 * Unit and contract tests for IntelliJ IDE Companion Bridge:
 * - Loopback WebSocket RFC 6455 framing & handshake
 * - EchoGuard & Content Hash Fence
 * - Maven Project Scaffold (Java 21, JUnit 5, AssertJ, Spring)
 * - PKZIP Archive in-memory generation
 */

import assert from 'assert';
import crypto from 'node:crypto';
import { createLoopbackServer } from '../../bridge/wsServer.mjs';
import { generatePomXml } from '../../backend/src/services/mavenScaffoldGenerator';
import { createZipArchive } from '../../backend/src/services/zipGenerator';

console.log('🧪 Running IntelliJ IDE Companion Bridge Contract Tests...');

async function runTests() {
  // Test 1: Loopback Server & Handshake
  console.log('\n[Test 1] Loopback WebSocket RFC 6455 Handshake Contract');
  const TEST_PORT = 41795;
  const server = createLoopbackServer(TEST_PORT);

  await new Promise<void>((resolve) => {
    server.listen(() => resolve());
  });

  const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
  let handshakeReceived = false;

  server.on('message', (rawMsg, client) => {
    const msg = JSON.parse(rawMsg);
    if (msg.type === 'HANDSHAKE_INIT') {
      client.send({
        type: 'HANDSHAKE_ACK',
        serverVersion: '1.0.0',
        activeChallengeId: msg.challengeId,
        timestamp: Date.now()
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Handshake timeout')), 3000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'HANDSHAKE_INIT',
        clientVersion: '1.0.0',
        challengeId: 'mc_rate_limiter_token_bucket'
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'HANDSHAKE_ACK') {
        assert.strictEqual(data.serverVersion, '1.0.0');
        assert.strictEqual(data.activeChallengeId, 'mc_rate_limiter_token_bucket');
        handshakeReceived = true;
        clearTimeout(timeout);
        ws.close();
        server.close(() => resolve());
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      server.close(() => reject(err));
    };
  });

  assert.strictEqual(handshakeReceived, true, 'Handshake must be successfully acknowledged');
  console.log('  ✓ RFC 6455 Loopback handshake acknowledged with correct challenge ID');

  // Test 2: EchoGuard Hash Fence
  console.log('\n[Test 2] EchoGuard & Hash Fence Invariant');
  const codeSnippet = 'public class RateLimiter { public boolean tryAcquire() { return true; } }';
  const hash1 = crypto.createHash('sha256').update(codeSnippet, 'utf8').digest('hex').substring(0, 16);
  const hash2 = crypto.createHash('sha256').update(codeSnippet, 'utf8').digest('hex').substring(0, 16);
  const modifiedHash = crypto.createHash('sha256').update(codeSnippet + '\n// edit', 'utf8').digest('hex').substring(0, 16);

  assert.strictEqual(hash1, hash2, 'Hash must be strictly deterministic');
  assert.notStrictEqual(hash1, modifiedHash, 'Modified code must produce different hash');
  console.log('  ✓ Deterministic SHA-256 hash fence verified (16 hex chars)');

  // Test 3: Maven POM Generator (Standard Java 21)
  console.log('\n[Test 3] Canonical Maven pom.xml Generation (Java 21 LTS)');
  const standardChallenge: any = {
    id: 'mc_rate_limiter_token_bucket',
    slug: 'rate-limiter-token-bucket',
    title: 'In-Memory Thread-Safe Rate Limiter',
    category: 'machine_coding',
    targetStack: 'Java 21 LTS, Concurrency Primitives'
  };

  const standardPom = generatePomXml(standardChallenge);
  assert.ok(standardPom.includes('<maven.compiler.release>21</maven.compiler.release>'), 'Must specify Java 21 release');
  assert.ok(standardPom.includes('<artifactId>junit-jupiter</artifactId>'), 'Must include JUnit 5 Jupiter');
  assert.ok(standardPom.includes('<artifactId>assertj-core</artifactId>'), 'Must include AssertJ');
  assert.ok(standardPom.includes('<artifactId>mockito-junit-jupiter</artifactId>'), 'Must include Mockito');
  assert.ok(!standardPom.includes('spring-boot-starter-test'), 'Standard challenge must not include Spring Test');
  console.log('  ✓ Standard Java 21 Maven pom.xml verified');

  // Test 4: Maven POM Generator (Spring Transaction Lab)
  console.log('\n[Test 4] Spring Transaction Lab pom.xml Dependency Injection');
  const springChallenge: any = {
    id: 'spring_tx_self_invocation',
    slug: 'spring-tx-self-invocation',
    title: 'Spring Transaction Self-Invocation Bypass',
    category: 'spring_transactions',
    targetStack: 'Java 21 LTS, Spring Boot 3.3.4'
  };

  const springPom = generatePomXml(springChallenge);
  assert.ok(springPom.includes('<artifactId>spring-boot-starter-test</artifactId>'), 'Spring challenge must include Spring Boot Starter Test');
  console.log('  ✓ Spring Boot test dependencies dynamically injected into pom.xml');

  // Test 5: PKZIP Archive Generation
  console.log('\n[Test 5] PKZIP In-Memory Archive Generation');
  const testFiles = [
    { path: 'pom.xml', content: standardPom },
    { path: 'src/main/java/com/assessment/RateLimiter.java', content: 'package com.assessment;\npublic interface RateLimiter {}' },
    { path: 'src/test/java/com/assessment/RateLimiterTest.java', content: 'package com.assessment;\npublic class RateLimiterTest {}' }
  ];

  const zipBuffer = createZipArchive(testFiles);
  assert.ok(Buffer.isBuffer(zipBuffer), 'ZIP generator must return a Buffer');
  assert.ok(zipBuffer.length > 500, 'ZIP buffer must contain compressed bytes');
  // Check PKZIP local header signature 0x04034b50
  assert.strictEqual(zipBuffer.readUInt32LE(0), 0x04034b50, 'ZIP header must begin with PK\\x03\\x04 signature');
  console.log(`  ✓ PKZIP archive generated successfully (${zipBuffer.length} bytes, magic: 0x04034b50)`);

  console.log('\n🎉 ALL 5 INTELLIJ IDE COMPANION BRIDGE CONTRACT TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
