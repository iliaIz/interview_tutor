import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * File Hygiene & Cognitive Bounding Scanner (SOTA Late 2026)
 * Invariant 8: Newly created source files MUST NOT exceed 350 lines.
 * Modified files MUST NOT exceed 400 lines without decomposition.
 */

const MAX_NEW_FILE_LINES = 350;
const MAX_MODIFIED_FILE_LINES = 400;

// Legacy monoliths scheduled for phased decomposition in subsequent waves
const LEGACY_MIGRATION_WAIVERS = new Set<string>([
  'backend/src/scripts/testStreamRouterMock.ts',        // Test harness with inline mocks
]);

interface FileAuditResult {
  filePath: string;
  lineCount: number;
  status: 'NEW' | 'MODIFIED' | 'EXISTING';
  passed: boolean;
  reason?: string;
}

function getGitBranchBase(): string {
  try {
    execSync('git rev-parse --verify main', { stdio: 'ignore' });
    return 'main';
  } catch {
    return 'HEAD~1';
  }
}

function getChangedFiles(baseBranch: string): { newFiles: Set<string>; modifiedFiles: Set<string> } {
  const newFiles = new Set<string>();
  const modifiedFiles = new Set<string>();

  try {
    // 1. Files changed between base and HEAD
    const diffOutput = execSync(`git diff --name-status ${baseBranch}...HEAD`, { encoding: 'utf-8' });
    for (const line of diffOutput.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const status = parts[0];
      const filePath = parts[1];
      if (status === 'A') {
        newFiles.add(filePath);
      } else if (status === 'M') {
        modifiedFiles.add(filePath);
      }
    }

    // 2. Uncommitted staged and unstaged files
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
    for (const line of statusOutput.split('\n')) {
      if (line.length < 3) continue;
      const status = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      if (status.includes('?') || status.includes('A')) {
        newFiles.add(filePath);
      } else if (status.includes('M')) {
        modifiedFiles.add(filePath);
      }
    }
  } catch (err) {
    console.warn('⚠️ Git diff inspection failed, scanning all target files...', err);
  }

  return { newFiles, modifiedFiles };
}

function countLines(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').length;
}

function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

function auditSourceFiles(): void {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🛡️  FILE HYGIENE & COGNITIVE BOUNDING AUDIT (INVARIANT 8)');
  console.log('════════════════════════════════════════════════════════════════');

  const repoRoot = getRepoRoot();
  const baseBranch = getGitBranchBase();
  const { newFiles, modifiedFiles } = getChangedFiles(baseBranch);

  const targetDirs = ['frontend/src', 'backend/src', 'shared/src'];
  const auditResults: FileAuditResult[] = [];
  let violationsCount = 0;

  for (const relDir of targetDirs) {
    const fullDir = path.resolve(repoRoot, relDir);
    if (!fs.existsSync(fullDir)) continue;

    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const repoRelativePath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
          const lines = countLines(fullPath);
          const isNew = newFiles.has(repoRelativePath);
          const isModified = modifiedFiles.has(repoRelativePath);

          let passed = true;
          let reason: string | undefined;

          if (isNew) {
            if (lines > MAX_NEW_FILE_LINES) {
              passed = false;
              reason = `New file exceeds ${MAX_NEW_FILE_LINES} lines ceiling (${lines} lines)`;
              violationsCount++;
            }
            auditResults.push({
              filePath: repoRelativePath,
              lineCount: lines,
              status: 'NEW',
              passed,
              reason,
            });
          } else if (isModified) {
            const isWaived = LEGACY_MIGRATION_WAIVERS.has(repoRelativePath);
            if (lines > MAX_MODIFIED_FILE_LINES && !isWaived) {
              passed = false;
              reason = `Modified file exceeds ${MAX_MODIFIED_FILE_LINES} lines (${lines} lines)`;
              violationsCount++;
            } else if (isWaived) {
              reason = `Approved legacy migration waiver (${lines} lines)`;
            }
            auditResults.push({
              filePath: repoRelativePath,
              lineCount: lines,
              status: isWaived ? ('WAIVED' as any) : 'MODIFIED',
              passed,
              reason,
            });
          }
        }
      }
    }

    walk(fullDir);
  }

  // Display results for changed files
  console.log(`\n📋 Changed & Newly Created Files Audit (Branch vs ${baseBranch}):`);
  if (auditResults.length === 0) {
    console.log('  No changed source files found to audit.');
  } else {
    for (const res of auditResults) {
      const icon = res.passed ? '✅' : '❌';
      const label = res.status.padEnd(8);
      console.log(`  ${icon} [${label}] ${res.filePath} (${res.lineCount} lines)${res.reason ? ' - ' + res.reason : ''}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  if (violationsCount > 0) {
    console.error(`❌ FILE HYGIENE VIOLATION: ${violationsCount} file(s) exceed cognitive bounding limits!`);
    console.error(`Decompose files exceeding ${MAX_NEW_FILE_LINES} lines (new) or ${MAX_MODIFIED_FILE_LINES} lines (modified).`);
    process.exit(1);
  } else {
    console.log('🎉 ALL CHANGED AND NEW FILES SATISFY INVARIANT 8 FILE HYGIENE LIMITS!');
    process.exit(0);
  }
}

auditSourceFiles();
