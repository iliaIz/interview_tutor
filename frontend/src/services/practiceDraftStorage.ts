/**
 * practiceDraftStorage.ts
 * Tier 1 LocalStorage persistence for coding challenge workspace drafts.
 * Protects user code with zero latency (crash-proof, offline-safe).
 * Cognitive bounding limit: <= 200 lines (Rule 8 compliant).
 */

import { FileNode } from '../types/practice';

export interface PracticeLocalDraft {
  challengeId: string;
  files: FileNode[];
  activePhase: number;
  activeWorkspaceFileIndex: number;
  updatedAt: number; // Unix timestamp ms
  clientVersion: string;
}

const DRAFT_PREFIX = 'practice_draft:';
const INDEX_KEY = 'practice_drafts_index';
const MAX_LOCAL_DRAFTS = 15;
const CLIENT_VERSION = '2026.1';

function getIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function updateIndex(challengeId: string): void {
  try {
    let index = getIndex().filter((id) => id !== challengeId);
    index.unshift(challengeId);
    if (index.length > MAX_LOCAL_DRAFTS) {
      const evicted = index.slice(MAX_LOCAL_DRAFTS);
      for (const id of evicted) {
        localStorage.removeItem(`${DRAFT_PREFIX}${id}`);
      }
      index = index.slice(0, MAX_LOCAL_DRAFTS);
    }
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Non-critical index update failure
  }
}

export function saveLocalDraft(
  challengeId: string,
  files: FileNode[],
  activePhase: number = 1,
  activeWorkspaceFileIndex: number = 0
): boolean {
  if (!challengeId || !Array.isArray(files) || files.length === 0) return false;

  try {
    const draft: PracticeLocalDraft = {
      challengeId,
      files,
      activePhase,
      activeWorkspaceFileIndex,
      updatedAt: Date.now(),
      clientVersion: CLIENT_VERSION
    };

    localStorage.setItem(`${DRAFT_PREFIX}${challengeId}`, JSON.stringify(draft));
    updateIndex(challengeId);
    return true;
  } catch (e) {
    console.warn(`[practiceDraftStorage] Failed to save local draft for ${challengeId}:`, e);
    return false;
  }
}

export function getLocalDraft(challengeId: string): PracticeLocalDraft | null {
  if (!challengeId) return null;

  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${challengeId}`);
    if (!raw) return null;

    const draft = JSON.parse(raw) as PracticeLocalDraft;
    if (!draft || !Array.isArray(draft.files) || draft.files.length === 0) {
      return null;
    }

    return draft;
  } catch (e) {
    console.warn(`[practiceDraftStorage] Corrupted draft for ${challengeId}:`, e);
    return null;
  }
}

export function removeLocalDraft(challengeId: string): void {
  if (!challengeId) return;

  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${challengeId}`);
    const index = getIndex().filter((id) => id !== challengeId);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {}
}

export function hasLocalDraft(challengeId: string): boolean {
  if (!challengeId) return false;
  return Boolean(localStorage.getItem(`${DRAFT_PREFIX}${challengeId}`));
}
