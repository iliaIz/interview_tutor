/**
 * buildSandbox.js
 *
 * Cross-platform Java sandbox runner compiler using @sources.txt argfile.
 * Recursively discovers all 109 runner and stub Java source files and compiles them into bin/.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (entry.endsWith('.java')) {
      results.push(fullPath);
    }
  }
  return results;
}

const backendDir = path.resolve(__dirname, '../..');
const runnerDir = path.join(backendDir, 'src/services/sandbox/runner');
const binDir = path.join(backendDir, 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const javaFiles = walk(runnerDir);
if (javaFiles.length === 0) {
  console.warn('⚠️ No Java files found to compile in:', runnerDir);
  process.exit(0);
}

const argFile = path.join(binDir, 'sources.txt');
fs.writeFileSync(argFile, javaFiles.join('\n'), 'utf8');

try {
  console.log(`Compiling ${javaFiles.length} Java sandbox files into bin/...`);
  execSync(`javac -d "${binDir}" @"${argFile}"`, { stdio: 'inherit' });
  console.log('✅ Java sandbox runner compiled successfully.');
} finally {
  try {
    fs.unlinkSync(argFile);
  } catch {}
}
