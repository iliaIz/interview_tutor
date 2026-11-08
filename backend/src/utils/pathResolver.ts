import path from 'path';
import fs from 'fs';

/**
 * Robust cross-environment path resolver for JSON catalog files.
 * Correctly locates catalog files across:
 * - Docker production runtime (/app/dist/routes -> /app/json)
 * - Local TypeScript dev execution via ts-node (backend/src/routes -> json)
 * - Compiled Node execution from repo root (backend/dist/routes -> json)
 * - Container and subfolder executions
 */
export function resolveJsonCatalogPath(filename: string): string {
  const candidates = [
    // 1. Docker /app root or current working directory
    path.resolve(process.cwd(), 'json', filename),
    path.resolve(process.cwd(), '../json', filename),
    // 2. Relative to compiled dist directory (dist/routes -> dist -> backend/app -> json)
    path.resolve(__dirname, '../../json', filename),
    // 3. Relative to source directory (src/routes -> src -> backend -> root -> json)
    path.resolve(__dirname, '../../../json', filename),
    path.resolve(__dirname, '../../../../json', filename),
    // 4. Absolute Linux container paths
    path.join('/app/json', filename),
    path.join('/json', filename)
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore filesystem permission check errors and try next candidate
    }
  }

  // If none exist, return primary path for descriptive error logging
  return candidates[0];
}
