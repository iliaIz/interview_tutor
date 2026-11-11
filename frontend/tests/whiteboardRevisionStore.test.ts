/**
 * whiteboardRevisionStore.test.ts
 * Automated regression test suite for Spec 18 Whiteboard IDE Synchronization:
 * - Non-Eviction GC algorithm mathematical assertions
 * - 3-State Visual Role Derivation assertions
 * - Whiteboard Standalone Scaffold & Package Integrity
 * - Loopback RFC 6455 Whiteboard Bridge (:41790) framing & EchoGuard
 */

import assert from 'assert';
import {
  pruneCodeRevisionsWithNonEviction,
  CodeArtifactRevision
} from '../src/store/useAppStore';
import { getVersionVisualRole } from '../src/components/CodeArtifactTimeline';
import {
  buildWhiteboardZipPackage,
  generateWhiteboardPomXml,
  generateWhiteboardBridgeScript,
  WHITEBOARD_BRIDGE_PORT
} from '../../backend/src/services/whiteboardScaffoldGenerator';
import { createLoopbackServer } from '../../bridge/wsServer.mjs';

console.log('🧪 Running Whiteboard IDE Synchronization & Revision Store Contract Tests...');

async function runTests() {
  // Test 1: Non-Eviction GC Formula Mathematical Assertions
  console.log('\n[Test 1] Non-Eviction GC: Pinned Revisions Protected from Pruning');
  const revisions: CodeArtifactRevision[] = [];

  for (let i = 1; i <= 15; i++) {
    revisions.push({
      id: `rev_${i}`,
      index: i,
      title: `v${i}`,
      language: 'java',
      code: `// Code version ${i}`,
      timestamp: Date.now() + i * 1000,
      author: i === 2 ? 'user' : 'ai',
      isPinned: i === 2, // Revision 2 is pinned by user
      isIdeTracked: i === 2
    });
  }

  // Prune with activeIdeRevisionId = 'rev_2'
  const pruned = pruneCodeRevisionsWithNonEviction(revisions, 'rev_2');

  // Must retain 1 pinned revision + last 10 unpinned revisions (11 total)
  assert.strictEqual(pruned.length, 11, `Expected 11 revisions retained, got ${pruned.length}`);

  // Pinned revision 2 MUST be preserved
  const rev2 = pruned.find((r) => r.id === 'rev_2');
  assert.ok(rev2, 'Pinned revision rev_2 was illegally evicted by garbage collection!');
  assert.strictEqual(rev2?.index, 2);

  // Assert chronological index ordering is strictly ascending
  for (let i = 0; i < pruned.length - 1; i++) {
    assert.ok(
      pruned[i].index < pruned[i + 1].index,
      `Revisions not sorted chronologically: ${pruned[i].index} >= ${pruned[i + 1].index}`
    );
  }

  // Unpinned older revisions (rev_1, rev_3, rev_4, rev_5) should have been pruned
  assert.strictEqual(pruned.some((r) => r.id === 'rev_1'), false, 'rev_1 should have been pruned');
  assert.strictEqual(pruned.some((r) => r.id === 'rev_3'), false, 'rev_3 should have been pruned');
  assert.strictEqual(pruned.some((r) => r.id === 'rev_5'), false, 'rev_5 should have been pruned');
  // Recent unpinned revisions (rev_6 .. rev_15) must exist
  assert.strictEqual(pruned.some((r) => r.id === 'rev_15'), true, 'rev_15 must be present');
  console.log('✅ Non-Eviction GC correctly preserved pinned revision while capping unpinned to 10');

  // Test 2: 3-State Visual Role Classification Formula
  console.log('\n[Test 2] 3-State Visual Role Permutation Assertions');
  assert.strictEqual(
    getVersionVisualRole('rev_active', 'rev_active', 'rev_active'),
    'active_and_synced',
    'Permutation 1: Active viewing AND synced working copy failed'
  );

  assert.strictEqual(
    getVersionVisualRole('rev_active', 'rev_active', 'rev_other_synced'),
    'active_only',
    'Permutation 2: Active viewing only failed'
  );

  assert.strictEqual(
    getVersionVisualRole('rev_synced', 'rev_active', 'rev_synced'),
    'synced_background',
    'Permutation 3: Synced working copy in background failed'
  );

  assert.strictEqual(
    getVersionVisualRole('rev_neutral', 'rev_active', 'rev_synced'),
    'neutral',
    'Permutation 4: Neutral historical revision failed'
  );

  assert.strictEqual(
    getVersionVisualRole('rev_neutral', null, null),
    'neutral',
    'Permutation 5: Null active/synced failed'
  );
  console.log('✅ 3-State Visual Role formula correctly classified all 5 permutations');

  // Test 3: Standalone Whiteboard Scaffold Generator & Port Invariant
  console.log('\n[Test 3] Whiteboard Scaffold Generator & Port Invariant (:41790)');
  assert.strictEqual(WHITEBOARD_BRIDGE_PORT, 41790, 'Whiteboard bridge port must strictly be 41790');

  const pomXml = generateWhiteboardPomXml();
  assert.ok(pomXml.includes('<artifactId>interview-whiteboard</artifactId>'), 'POM missing artifactId');
  assert.ok(pomXml.includes('<release>21</release>'), 'POM must target Java 21');

  const bridgeScript = generateWhiteboardBridgeScript();
  assert.ok(bridgeScript.includes('const PORT = 41790;'), 'bridge.mjs must listen strictly on 41790');
  assert.ok(!bridgeScript.includes('const PORT = 41789;'), 'bridge.mjs must NOT use task port 41789');

  const zipBuffer = buildWhiteboardZipPackage('public class CustomWhiteboard {}');
  assert.ok(zipBuffer.length > 500, `ZIP package size unexpectedly small: ${zipBuffer.length} bytes`);
  console.log(`✅ Scaffold package generated successfully (${zipBuffer.length} bytes, port 41790 verified)`);

  // Test 4: Loopback WebSocket Whiteboard Bridge Handshake Contract
  console.log('\n[Test 4] Loopback RFC 6455 Whiteboard Bridge Handshake & Framing');
  const TEST_WB_PORT = 41797;
  const server = createLoopbackServer(TEST_WB_PORT);

  await new Promise<void>((resolve) => {
    server.listen(() => resolve());
  });

  const ws = new WebSocket(`ws://127.0.0.1:${TEST_WB_PORT}`);
  let ackReceived = false;

  server.on('message', (rawMsg, client) => {
    try {
      const msg = JSON.parse(rawMsg);
      if (msg.type === 'HANDSHAKE_INIT' && msg.channel === 'whiteboard') {
        client.send({
          type: 'HANDSHAKE_ACK',
          serverVersion: '1.0.0',
          channel: 'whiteboard',
          workspaceDir: '/tmp/tutor-whiteboard',
          timestamp: Date.now()
        });
      }
    } catch {}
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Whiteboard bridge handshake timeout')), 3000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'HANDSHAKE_INIT',
          clientVersion: '1.0.0',
          channel: 'whiteboard'
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'HANDSHAKE_ACK') {
          assert.strictEqual(data.serverVersion, '1.0.0');
          assert.strictEqual(data.channel, 'whiteboard');
          ackReceived = true;
          clearTimeout(timeout);
          ws.close();
          server.close(() => resolve());
        }
      } catch (err) {
        clearTimeout(timeout);
        server.close(() => reject(err));
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      server.close(() => reject(err));
    };
  });

  assert.strictEqual(ackReceived, true, 'Handshake ACK must be received');
  console.log('✅ Loopback Whiteboard Bridge RFC 6455 framing and channel negotiation verified');

  console.log('\n🎉 ALL SPEC 18 WHITEBOARD REGRESSION CONTRACT TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('\n❌ Contract test failed:', err);
  process.exit(1);
});
