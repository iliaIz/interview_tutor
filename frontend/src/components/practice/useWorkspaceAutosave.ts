/**
 * useWorkspaceAutosave.ts
 * Multi-tier autosave engine for coding challenge workspaces (SOTA Late 2026).
 * Tier 1: LocalStorage instant draft (400ms debounce)
 * Tier 2: Periodic cloud sync (25s interval + 2s idle debounce)
 * Tier 3: Lifecycle event flush (visibilitychange, pagehide, and pre-sandbox test runs)
 * Cognitive bounding limit: <= 250 lines (Rule 8 compliant).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { FileNode } from '../../types/practice';
import { saveLocalDraft } from '../../services/practiceDraftStorage';

export type AutosaveSyncStatus = 'saved' | 'saving' | 'dirty' | 'local_only' | 'error';

interface UseWorkspaceAutosaveOptions {
  challengeId?: string;
  files: FileNode[];
  activePhase?: number;
  activeWorkspaceFileIndex?: number;
  timeSpentSeconds?: number;
  enabled?: boolean;
}

function computeWorkspaceHash(files: FileNode[]): string {
  if (!files || files.length === 0) return '';
  return files.map((f) => `${f.path}:${f.content.length}:${f.content.slice(0, 32)}`).join('|');
}

export function useWorkspaceAutosave({
  challengeId,
  files,
  activePhase = 1,
  activeWorkspaceFileIndex = 0,
  timeSpentSeconds = 0,
  enabled = true
}: UseWorkspaceAutosaveOptions) {
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<AutosaveSyncStatus>('saved');
  const [isSaving, setIsSaving] = useState(false);

  const lastSavedHashRef = useRef<string>('');
  const latestFilesRef = useRef<FileNode[]>(files);
  const activePhaseRef = useRef<number>(activePhase);
  const activeFileIndexRef = useRef<number>(activeWorkspaceFileIndex);
  const timeSpentRef = useRef<number>(timeSpentSeconds);
  const challengeIdRef = useRef<string | undefined>(challengeId);

  latestFilesRef.current = files;
  activePhaseRef.current = activePhase;
  activeFileIndexRef.current = activeWorkspaceFileIndex;
  timeSpentRef.current = timeSpentSeconds;
  challengeIdRef.current = challengeId;

  // Initialize baseline hash on challenge change
  useEffect(() => {
    if (challengeId) {
      lastSavedHashRef.current = computeWorkspaceHash(files);
      setSyncStatus('saved');
    }
  }, [challengeId]);

  const sendCloudDraft = useCallback(async (isKeepAlive: boolean = false): Promise<boolean> => {
    const cid = challengeIdRef.current;
    const currentFiles = latestFilesRef.current;
    if (!cid || !currentFiles || currentFiles.length === 0) return false;

    try {
      if (!isKeepAlive) setIsSaving(true);

      const payload = JSON.stringify({
        challengeId: cid,
        files: currentFiles,
        activePhase: activePhaseRef.current,
        timeSpentSeconds: timeSpentRef.current
      });

      const res = await fetch('/api/practice/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        keepalive: isKeepAlive,
        body: payload
      });

      if (res.ok) {
        lastSavedHashRef.current = computeWorkspaceHash(currentFiles);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSavedTime(timeStr);
        setSyncStatus('saved');
        return true;
      } else {
        setSyncStatus('local_only');
        return false;
      }
    } catch {
      setSyncStatus('local_only');
      return false;
    } finally {
      if (!isKeepAlive) setIsSaving(false);
    }
  }, []);

  const flushNow = useCallback(async (): Promise<void> => {
    const cid = challengeIdRef.current;
    const currentFiles = latestFilesRef.current;
    if (!cid || !currentFiles || currentFiles.length === 0) return;

    // Tier 1: Instant Local Flush
    saveLocalDraft(cid, currentFiles, activePhaseRef.current, activeFileIndexRef.current);

    // Tier 2: Cloud Sync
    await sendCloudDraft(false);
  }, [sendCloudDraft]);

  // Tier 1: Debounced Local Storage Save (400ms)
  useEffect(() => {
    if (!enabled || !challengeId || files.length === 0) return;

    const currentHash = computeWorkspaceHash(files);
    if (currentHash !== lastSavedHashRef.current) {
      setSyncStatus('dirty');
    }

    const timer = setTimeout(() => {
      saveLocalDraft(challengeId, files, activePhase, activeWorkspaceFileIndex);
    }, 400);

    return () => clearTimeout(timer);
  }, [files, challengeId, activePhase, activeWorkspaceFileIndex, enabled]);

  // Tier 2a: Idle Pause Cloud Sync (2000ms after user stops typing)
  useEffect(() => {
    if (!enabled || !challengeId || files.length === 0) return;

    const currentHash = computeWorkspaceHash(files);
    if (currentHash === lastSavedHashRef.current) return;

    const idleTimer = setTimeout(() => {
      void sendCloudDraft(false);
    }, 2000);

    return () => clearTimeout(idleTimer);
  }, [files, challengeId, enabled, sendCloudDraft]);

  // Tier 2b: Periodic Cloud Sync Interval (Every 25 seconds when dirty)
  useEffect(() => {
    if (!enabled || !challengeId) return;

    const interval = setInterval(() => {
      const currentHash = computeWorkspaceHash(latestFilesRef.current);
      if (currentHash !== lastSavedHashRef.current) {
        void sendCloudDraft(false);
      }
    }, 25_000);

    return () => clearInterval(interval);
  }, [challengeId, enabled, sendCloudDraft]);

  // Tier 3: Lifecycle event handlers (visibilitychange and pagehide)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const cid = challengeIdRef.current;
        const currentFiles = latestFilesRef.current;
        if (!cid || !currentFiles || currentFiles.length === 0) return;

        saveLocalDraft(cid, currentFiles, activePhaseRef.current, activeFileIndexRef.current);
        const currentHash = computeWorkspaceHash(currentFiles);
        if (currentHash !== lastSavedHashRef.current) {
          void sendCloudDraft(true);
        }
      }
    };

    const handlePageHide = () => {
      const cid = challengeIdRef.current;
      const currentFiles = latestFilesRef.current;
      if (!cid || !currentFiles || currentFiles.length === 0) return;

      saveLocalDraft(cid, currentFiles, activePhaseRef.current, activeFileIndexRef.current);
      const currentHash = computeWorkspaceHash(currentFiles);
      if (currentHash !== lastSavedHashRef.current) {
        void sendCloudDraft(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [enabled, sendCloudDraft]);

  const markClean = useCallback(() => {
    lastSavedHashRef.current = computeWorkspaceHash(latestFilesRef.current);
    setSyncStatus('saved');
  }, []);

  return {
    lastSavedTime,
    syncStatus,
    isSaving,
    flushNow,
    markClean
  };
}
