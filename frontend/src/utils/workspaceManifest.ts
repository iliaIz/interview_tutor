/**
 * workspaceManifest.ts
 *
 * SOTA Late 2026 Multi-File Workspace Aggregator for Machine Coding & LLD.
 * Assembles project tree and secondary file contents into a structured manifest
 * to eliminate single-file blindness in AI pair-programming and voice defense.
 * Cognitive bounding limit: <= 120 lines.
 */

import { FileNode } from '../types/practice';

export interface ProjectWorkspaceManifest {
  activeFile: {
    path: string;
    content: string;
    isReadOnly: boolean;
  };
  fileCount: number;
  projectTree: string[];
  secondaryFiles: Array<{
    path: string;
    content: string;
    isReadOnly: boolean;
  }>;
  xmlManifest: string;
}

export function buildWorkspaceManifest(
  files: FileNode[],
  activeFileIndex: number = 0,
  maxSecondaryFiles: number = 6
): ProjectWorkspaceManifest {
  const visibleFiles = (files || []).filter((f) => !f.hidden);
  const safeIndex =
    activeFileIndex >= 0 && activeFileIndex < visibleFiles.length ? activeFileIndex : 0;
  const active = visibleFiles[safeIndex] || {
    path: 'src/main/java/Solution.java',
    content: '',
    readOnly: false,
    hidden: false
  };

  const projectTree = visibleFiles.map((f) => f.path);
  const secondary = visibleFiles
    .filter((f, idx) => idx !== safeIndex)
    .slice(0, maxSecondaryFiles)
    .map((f) => ({
      path: f.path,
      content: f.content,
      isReadOnly: Boolean(f.readOnly)
    }));

  const xmlParts: string[] = [
    `<project_workspace active_file="${active.path}">`,
    `  <project_tree>`,
    ...projectTree.map((p) => `    <file path="${p}" />`),
    `  </project_tree>`,
    `  <active_file path="${active.path}" read_only="${Boolean(active.readOnly)}">`,
    active.content,
    `  </active_file>`
  ];

  if (secondary.length > 0) {
    xmlParts.push(`  <secondary_files>`);
    for (const sec of secondary) {
      xmlParts.push(
        `    <file path="${sec.path}" read_only="${sec.isReadOnly}">`,
        sec.content,
        `    </file>`
      );
    }
    xmlParts.push(`  </secondary_files>`);
  }

  xmlParts.push(`</project_workspace>`);

  return {
    activeFile: {
      path: active.path,
      content: active.content,
      isReadOnly: Boolean(active.readOnly)
    },
    fileCount: visibleFiles.length,
    projectTree,
    secondaryFiles: secondary,
    xmlManifest: xmlParts.join('\n')
  };
}
