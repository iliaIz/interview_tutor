/**
 * bridgeMjsTemplate.ts
 * Self-contained string template for bridge.mjs to ensure zero filesystem dependency in container.
 */

export const BRIDGE_MJS_TEMPLATE = `#!/usr/bin/env node
/**
 * bridge.mjs - Zero-Dependency IntelliJ Companion Bridge
 * Runs locally on Node.js 20/22. Watches files in IntelliJ project,
 * prevents echo loops, and synchronizes real-time code frames to Web AI Cockpit.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLoopbackServer } from './wsServer.mjs';

const PORT = 41789;
const PROJECT_DIR = process.cwd();
const SRC_DIR = path.join(PROJECT_DIR, 'src');

const IGNORED_PATTERNS = [
  /[\\\\/]\\.idea([\\\\/]|$)/,
  /[\\\\/]target([\\\\/]|$)/,
  /[\\\\/]\\.git([\\\\/]|$)/,
  /\\.DS_Store$/,
  /~$/,
  /\\.swp$/
];

// In-Flight Hashes for EchoGuard (TTL 1000ms)
const inFlightHashes = new Map();
const lastBroadcastHashes = new Map();

function pruneInFlightHashes() {
  const now = Date.now();
  for (const [hash, ts] of inFlightHashes.entries()) {
    if (now - ts > 1000) {
      inFlightHashes.delete(hash);
    }
  }
}

function calculateHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
}

function isIgnored(filePath) {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(filePath));
}

// Ensure src directory exists
if (!fs.existsSync(SRC_DIR)) {
  fs.mkdirSync(SRC_DIR, { recursive: true });
}

console.log('\\n======================================================');
console.log('  🚀 InterviewTutor IntelliJ Companion Bridge (v1.0.0)');
console.log('======================================================');
console.log(\`📁 Project Directory: \${PROJECT_DIR}\`);
console.log(\`🔍 Watching Folder:   \${SRC_DIR}\`);
console.log(\`🔌 Listening On:      ws://127.0.0.1:\${PORT}\`);
console.log('======================================================\\n');

const server = createLoopbackServer(PORT);

let activeClient = null;
let pendingFileChanges = new Map();

function handleDiskChange(filename) {
  if (!filename) return;
  const fullPath = path.isAbsolute(filename) ? filename : path.join(SRC_DIR, filename);
  const relativePath = path.relative(PROJECT_DIR, fullPath).replace(/\\\\/g, '/');

  if (isIgnored(relativePath)) return;

  if (pendingFileChanges.has(relativePath)) {
    clearTimeout(pendingFileChanges.get(relativePath));
  }

  const timeoutId = setTimeout(async () => {
    pendingFileChanges.delete(relativePath);
    pruneInFlightHashes();

    try {
      if (!fs.existsSync(fullPath)) return;
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) return;

      const content = await fs.promises.readFile(fullPath, 'utf8');
      const hash = calculateHash(content);

      if (inFlightHashes.has(hash)) return;
      if (lastBroadcastHashes.get(relativePath) === hash) return;

      lastBroadcastHashes.set(relativePath, hash);

      const payload = {
        type: 'FILE_UPDATED',
        origin: 'ide',
        path: relativePath,
        content,
        contentHash: hash,
        timestamp: Date.now()
      };

      server.broadcast(payload);
      console.log(\`[IDE -> Web] 📝 Synced: \${relativePath} (\${content.length} bytes, hash: \${hash})\`);
    } catch (err) {
      // Ignore transient file lock read errors
    }
  }, 120);

  pendingFileChanges.set(relativePath, timeoutId);
}

try {
  fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    handleDiskChange(filename);
  });
} catch (err) {
  console.warn(\`[Watcher Warning] Recursive watch fallback applied: \${err.message}\`);
}

server.on('connection', (client) => {
  activeClient = client;
  console.log('🟢 [Connected] Web AI Cockpit connected to bridge!');
});

server.on('disconnect', () => {
  activeClient = null;
  console.log('🟡 [Disconnected] Web AI Cockpit disconnected.');
});

server.on('message', async (rawMessage, client) => {
  try {
    const data = JSON.parse(rawMessage);

    if (data.type === 'HANDSHAKE_INIT') {
      console.log(\`🤝 [Handshake] Session initiated for challenge: \${data.challengeId || 'unknown'}\`);
      client.send({
        type: 'HANDSHAKE_ACK',
        serverVersion: '1.0.0',
        workspaceDir: PROJECT_DIR,
        activeChallengeId: data.challengeId,
        timestamp: Date.now()
      });
      return;
    }

    if (data.type === 'PING') {
      client.send({ type: 'PONG', timestamp: Date.now() });
      return;
    }

    if (data.type === 'FILE_UPDATED' && data.origin === 'web') {
      const fullPath = path.join(PROJECT_DIR, data.path);
      const hash = calculateHash(data.content);

      inFlightHashes.set(hash, Date.now());
      lastBroadcastHashes.set(data.path, hash);

      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, data.content, 'utf8');
      console.log(\`[Web -> IDE] 📥 Written to disk: \${data.path} (hash: \${hash})\`);
    }
  } catch (err) {
    console.error(\`[Error] Failed to process message: \${err.message}\`);
  }
});

server.listen(() => {
  console.log('✅ Bridge ready. Leave this terminal open and edit files in IntelliJ IDEA.\\n');
});

process.on('SIGINT', () => {
  console.log('\\nShutting down bridge...');
  server.close(() => process.exit(0));
});
`;
