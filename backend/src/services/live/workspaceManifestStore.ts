import { ProxySession } from './liveSessionTypes';

/**
 * workspaceManifestStore.ts
 * Чистые функции управления состоянием файлов рабочей области в памяти сессии.
 * Не содержит зависимостей от WebSocket, БД или диспетчеров инструментов.
 */

export function matchWorkspaceFilePath(candidatePath: string | undefined, targetPath: string): boolean {
  if (!candidatePath || !targetPath) return false;
  const c = candidatePath.replace(/\\/g, '/').trim();
  const t = targetPath.replace(/\\/g, '/').trim();
  if (c === t) return true;
  const cSimple = c.split('/').pop() || c;
  const tSimple = t.split('/').pop() || t;
  return cSimple === tSimple || c.endsWith(`/${tSimple}`) || t.endsWith(`/${cSimple}`);
}

export function applyWorkspaceFileUpdate(session: ProxySession, rawPath: string, content: string): void {
  const trimmedPath = (rawPath || '').trim();
  if (!trimmedPath || typeof content !== 'string') return;

  if (!session.workspaceManifest) {
    session.workspaceManifest = { files: [], secondaryFiles: [], projectTree: [] };
  }
  if (!Array.isArray(session.workspaceManifest.files)) {
    session.workspaceManifest.files = [];
  }
  if (!Array.isArray(session.workspaceManifest.secondaryFiles)) {
    session.workspaceManifest.secondaryFiles = [];
  }
  if (!Array.isArray(session.workspaceManifest.projectTree)) {
    session.workspaceManifest.projectTree = [];
  }

  // 1. Update in files array
  const existingFile = session.workspaceManifest.files.find((f: any) => matchWorkspaceFilePath(f.path, trimmedPath));
  if (existingFile) {
    existingFile.content = content;
  } else {
    session.workspaceManifest.files.push({ path: trimmedPath, content, isReadOnly: false });
  }

  // 2. Update in secondaryFiles array if present
  const secFile = session.workspaceManifest.secondaryFiles.find((f: any) => matchWorkspaceFilePath(f.path, trimmedPath));
  if (secFile) {
    secFile.content = content;
  }

  // 3. Update activeFile if it matches or if none set
  const isActive =
    matchWorkspaceFilePath(session.workspaceManifest.activeFile?.path, trimmedPath) ||
    !session.workspaceManifest.activeFile;
  if (isActive) {
    session.workspaceManifest.activeFile = {
      path: session.workspaceManifest.activeFile?.path || trimmedPath,
      content,
      isReadOnly: false
    };
    session.codeSnippet = content;
    session.activeFilePath = session.workspaceManifest.activeFile.path;
  }

  // 4. Ensure projectTree has the path
  if (!session.workspaceManifest.projectTree.some((p: string) => matchWorkspaceFilePath(p, trimmedPath))) {
    session.workspaceManifest.projectTree.push(trimmedPath);
  }

  console.log(`📝 [WORKSPACE_FILE_UPDATE] Updated in-memory file "${trimmedPath}" (${content.length} chars, active: ${isActive})`);
}

export function mergeWorkspaceManifests(baseManifest: any, incomingManifest: any): any {
  if (!baseManifest && !incomingManifest) {
    return { files: [], secondaryFiles: [], projectTree: [] };
  }
  if (!baseManifest) return incomingManifest;
  if (!incomingManifest) return baseManifest;

  const result = { ...baseManifest };
  const fileMap = new Map<string, any>();

  // Ingest base files
  if (Array.isArray(baseManifest.files)) {
    for (const f of baseManifest.files) {
      if (f?.path) fileMap.set(f.path, { ...f });
    }
  }
  if (baseManifest.activeFile?.path) {
    fileMap.set(baseManifest.activeFile.path, { ...baseManifest.activeFile });
  }
  if (Array.isArray(baseManifest.secondaryFiles)) {
    for (const f of baseManifest.secondaryFiles) {
      if (f?.path && !fileMap.has(f.path)) fileMap.set(f.path, { ...f });
    }
  }

  // Ingest incoming files (authoritative overrides for content)
  if (Array.isArray(incomingManifest.files)) {
    for (const f of incomingManifest.files) {
      if (f?.path) {
        const existingKey = Array.from(fileMap.keys()).find((k) => matchWorkspaceFilePath(k, f.path));
        fileMap.set(existingKey || f.path, { ...f });
      }
    }
  }
  if (incomingManifest.activeFile?.path) {
    const act = incomingManifest.activeFile;
    const existingKey = Array.from(fileMap.keys()).find((k) => matchWorkspaceFilePath(k, act.path));
    fileMap.set(existingKey || act.path, { ...act });
    result.activeFile = { ...(fileMap.get(existingKey || act.path) || act) };
  }
  if (Array.isArray(incomingManifest.secondaryFiles)) {
    for (const f of incomingManifest.secondaryFiles) {
      if (f?.path) {
        const existingKey = Array.from(fileMap.keys()).find((k) => matchWorkspaceFilePath(k, f.path));
        fileMap.set(existingKey || f.path, { ...f });
      }
    }
  }

  const allFiles = Array.from(fileMap.values());
  result.files = allFiles;
  result.fileCount = allFiles.length;
  result.projectTree = allFiles.map((f) => f.path);
  result.secondaryFiles = allFiles.filter(
    (f) => !matchWorkspaceFilePath(f.path, result.activeFile?.path)
  );

  return result;
}
