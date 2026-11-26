import { ProxySession } from './liveSessionTypes';

export interface FilePathMatchResult<T> {
  match: T | null;
  ambiguous: boolean;
  matches: T[];
}

export function normalizeWorkspacePath(rawPath: string | undefined): string {
  return (rawPath || '').replace(/\\/g, '/').trim().replace(/^\.\//, '').replace(/^\/+/, '');
}

function getPathBasename(normalizedPath: string): string {
  const idx = normalizedPath.lastIndexOf('/');
  return idx >= 0 ? normalizedPath.slice(idx + 1) : normalizedPath;
}

export function resolveWorkspaceFileMatch<T extends { path?: string }>(
  files: T[],
  targetPath: string
): FilePathMatchResult<T> {
  const normTarget = normalizeWorkspacePath(targetPath);
  if (!normTarget || !Array.isArray(files) || files.length === 0) {
    return { match: null, ambiguous: false, matches: [] };
  }

  const exact = files.filter((f) => normalizeWorkspacePath(f?.path) === normTarget);
  if (exact.length > 0) return { match: exact[0], ambiguous: false, matches: exact };

  if (normTarget.includes('/')) {
    const suffix = files.filter((f) => {
      const nc = normalizeWorkspacePath(f?.path);
      return Boolean(nc) && nc.endsWith(`/${normTarget}`);
    });
    if (suffix.length === 1) return { match: suffix[0], ambiguous: false, matches: suffix };
    if (suffix.length > 1) return { match: null, ambiguous: true, matches: suffix };
    return { match: null, ambiguous: false, matches: [] };
  }

  const byBasename = files.filter((f) => {
    const nc = normalizeWorkspacePath(f?.path);
    return Boolean(nc) && getPathBasename(nc) === normTarget;
  });
  if (byBasename.length === 1) return { match: byBasename[0], ambiguous: false, matches: byBasename };
  if (byBasename.length > 1) return { match: null, ambiguous: true, matches: byBasename };
  return { match: null, ambiguous: false, matches: [] };
}

export function matchWorkspaceFilePath(
  candidatePath: string | undefined,
  targetPath: string,
  allCandidatePaths?: string[]
): boolean {
  const normCand = normalizeWorkspacePath(candidatePath);
  const normTarget = normalizeWorkspacePath(targetPath);
  if (!normCand || !normTarget) return false;
  if (normCand === normTarget) return true;
  if (allCandidatePaths && allCandidatePaths.length > 0) {
    const res = resolveWorkspaceFileMatch(allCandidatePaths.map((p) => ({ path: p })), normTarget);
    return Boolean(res.match && normalizeWorkspacePath(res.match.path) === normCand);
  }
  if (normTarget.includes('/')) return normCand.endsWith(`/${normTarget}`);
  return getPathBasename(normCand) === normTarget;
}

export function buildManifestXml(active: any, allFiles: any[], secondary: any[]): string {
  if (!active?.path) return '';
  const isRo = (f: any) => Boolean(f?.isReadOnly ?? f?.readOnly);
  return [
    `<project_workspace active_file="${active.path}">`,
    `  <project_tree>`,
    ...allFiles.map((f: any) => `    <file path="${f.path}" />`),
    `  </project_tree>`,
    `  <active_file path="${active.path}" read_only="${isRo(active)}">`,
    active.content ?? '',
    `  </active_file>`,
    ...(secondary.length > 0
      ? [
          `  <secondary_files>`,
          ...secondary.flatMap((sec: any) => [
            `    <file path="${sec.path}" read_only="${isRo(sec)}">`,
            sec.content ?? '',
            `    </file>`
          ]),
          `  </secondary_files>`
        ]
      : []),
    `</project_workspace>`
  ].join('\n');
}

export function mergeWorkspaceManifests(baseManifest: any, incomingManifest: any): any {
  if (!baseManifest && !incomingManifest) return { files: [], secondaryFiles: [], projectTree: [], xmlManifest: '' };
  if (!baseManifest) {
    const m = { ...incomingManifest };
    m.xmlManifest = buildManifestXml(m.activeFile || m.files?.[0], m.files || [], m.secondaryFiles || []);
    return m;
  }
  if (!incomingManifest) return baseManifest;

  const result = { ...baseManifest };
  const fileMap = new Map<string, any>();
  const ingest = (entry: any) => {
    if (!entry?.path) return;
    const keys = Array.from(fileMap.keys()).map((k) => ({ path: k }));
    const hit = resolveWorkspaceFileMatch(keys, entry.path).match?.path;
    const prev = hit ? fileMap.get(hit) : undefined;
    fileMap.set(hit || entry.path, {
      ...prev,
      ...entry,
      path: hit || entry.path,
      isReadOnly: Boolean(entry.isReadOnly ?? entry.readOnly ?? prev?.isReadOnly)
    });
  };

  for (const f of baseManifest.files || []) ingest(f);
  if (baseManifest.activeFile?.path) ingest(baseManifest.activeFile);
  for (const f of baseManifest.secondaryFiles || []) ingest(f);
  for (const f of incomingManifest.files || []) ingest(f);
  if (incomingManifest.activeFile?.path) {
    ingest(incomingManifest.activeFile);
    const hit = resolveWorkspaceFileMatch(Array.from(fileMap.keys()).map((k) => ({ path: k })), incomingManifest.activeFile.path).match?.path;
    result.activeFile = { ...(fileMap.get(hit || incomingManifest.activeFile.path) || incomingManifest.activeFile) };
  }
  for (const f of incomingManifest.secondaryFiles || []) ingest(f);

  const allFiles = Array.from(fileMap.values());
  const activeNorm = normalizeWorkspacePath(result.activeFile?.path);
  result.files = allFiles;
  result.fileCount = allFiles.length;
  result.projectTree = allFiles.map((f) => f.path);
  result.secondaryFiles = allFiles.filter((f) => normalizeWorkspacePath(f.path) !== activeNorm);
  result.xmlManifest = buildManifestXml(result.activeFile || allFiles[0], allFiles, result.secondaryFiles);
  return result;
}

export function applyWorkspaceFileUpdate(
  session: ProxySession,
  rawPath: string,
  content: string,
  options: { markActive?: boolean; isReadOnly?: boolean; allowActivateIfEmpty?: boolean } = {}
): void {
  const trimmedPath = (rawPath || '').trim();
  if (!trimmedPath || typeof content !== 'string') return;

  if (!session.workspaceManifest) {
    session.workspaceManifest = { files: [], secondaryFiles: [], projectTree: [], xmlManifest: '' };
  }
  const m = session.workspaceManifest;
  if (!Array.isArray(m.files)) m.files = [];
  if (!Array.isArray(m.secondaryFiles)) m.secondaryFiles = [];
  if (!Array.isArray(m.projectTree)) m.projectTree = [];

  const existingFile = resolveWorkspaceFileMatch(m.files, trimmedPath).match;
  const resolvedPath = existingFile?.path || trimmedPath;
  const resolvedRo = Boolean(existingFile?.isReadOnly ?? existingFile?.readOnly ?? options.isReadOnly);

  if (existingFile) {
    existingFile.content = content;
  } else {
    m.files.push({ path: resolvedPath, content, isReadOnly: resolvedRo });
  }

  const secFile = resolveWorkspaceFileMatch(m.secondaryFiles, resolvedPath).match;
  if (secFile) secFile.content = content;

  const activeNorm = normalizeWorkspacePath(m.activeFile?.path);
  const matchesActive = Boolean(activeNorm && activeNorm === normalizeWorkspacePath(resolvedPath));
  const shouldActivate =
    options.markActive === true ||
    (options.markActive !== false && (matchesActive || (!m.activeFile && options.allowActivateIfEmpty !== false)));

  if (shouldActivate) {
    if (m.activeFile && normalizeWorkspacePath(m.activeFile.path) !== normalizeWorkspacePath(resolvedPath)) {
      if (!m.secondaryFiles.some((s: any) => normalizeWorkspacePath(s?.path) === activeNorm)) {
        m.secondaryFiles.push({ ...m.activeFile });
      }
    }
    m.activeFile = { path: resolvedPath, content, isReadOnly: resolvedRo };
    m.secondaryFiles = m.files.filter((f: any) => normalizeWorkspacePath(f.path) !== normalizeWorkspacePath(resolvedPath));
    session.codeSnippet = content;
    session.activeFilePath = resolvedPath;
  } else if (!secFile && (!activeNorm || activeNorm !== normalizeWorkspacePath(resolvedPath))) {
    m.secondaryFiles.push({ path: resolvedPath, content, isReadOnly: resolvedRo });
  }

  if (!m.projectTree.some((p: string) => normalizeWorkspacePath(p) === normalizeWorkspacePath(resolvedPath))) {
    m.projectTree.push(resolvedPath);
  }
  m.fileCount = m.files.length;
  m.xmlManifest = buildManifestXml(m.activeFile || m.files[0], m.files, m.secondaryFiles);
}

export function switchActiveWorkspaceFile(session: ProxySession, rawPath: string): void {
  const filePath = (rawPath || '').trim();
  const manifest = session.workspaceManifest;
  if (!filePath || !manifest) return;

  const allFiles: any[] = Array.isArray(manifest.files) ? manifest.files : [];
  const secondary: any[] = Array.isArray(manifest.secondaryFiles) ? manifest.secondaryFiles : [];
  const mergedPool = [
    ...allFiles,
    ...secondary.filter((s) => !allFiles.some((f) => normalizeWorkspacePath(f.path) === normalizeWorkspacePath(s.path)))
  ];
  const found = resolveWorkspaceFileMatch(mergedPool, filePath).match;
  if (!found) return;

  if (manifest.activeFile && normalizeWorkspacePath(manifest.activeFile.path) !== normalizeWorkspacePath(found.path)) {
    const prevNorm = normalizeWorkspacePath(manifest.activeFile.path);
    if (!secondary.some((s) => normalizeWorkspacePath(s?.path) === prevNorm)) {
      secondary.push({
        path: manifest.activeFile.path,
        content: manifest.activeFile.content,
        isReadOnly: Boolean(manifest.activeFile.isReadOnly ?? manifest.activeFile.readOnly)
      });
    }
  }
  manifest.activeFile = {
    path: found.path,
    content: found.content,
    isReadOnly: Boolean(found.isReadOnly ?? found.readOnly)
  };
  manifest.secondaryFiles = secondary.filter((s) => normalizeWorkspacePath(s?.path) !== normalizeWorkspacePath(found.path));
  const fullList = allFiles.length > 0 ? allFiles : [manifest.activeFile, ...manifest.secondaryFiles];
  manifest.xmlManifest = buildManifestXml(manifest.activeFile, fullList, manifest.secondaryFiles);
  session.codeSnippet = found.content;
  session.activeFilePath = found.path;
}
