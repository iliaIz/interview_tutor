/**
 * useIdeBridge.ts
 * React hook connecting Web AI Cockpit to the Local Zero-Dependency IntelliJ Companion Bridge
 * over Loopback WebSocket (ws://127.0.0.1:41789) via IdeBridgeConnection (SPEC-25).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { IdeBridgeConnection, IdeBridgeStatus } from '../../services/IdeBridgeConnection';

export type { IdeBridgeStatus };

export function useIdeBridge() {
  const [status, setStatus] = useState<IdeBridgeStatus>('disconnected');
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const bridgeRef = useRef<IdeBridgeConnection | null>(null);

  const {
    activePracticeChallenge,
    updateWorkspaceFileContent,
    setActiveWorkspaceFileIndex
  } = useAppStore();

  const handleFileFromIde = useCallback((filePath: string, newContent: string) => {
    const currentFiles = useAppStore.getState().practiceWorkspaceFiles;
    const normalizedTarget = filePath.replace(/\\/g, '/');
    const idx = currentFiles.findIndex((f) => {
      const normalizedPath = f.path.replace(/\\/g, '/');
      return (
        normalizedPath === normalizedTarget ||
        normalizedPath.endsWith(normalizedTarget) ||
        normalizedTarget.endsWith(normalizedPath)
      );
    });

    if (idx !== -1) {
      const existing = currentFiles[idx];
      if (existing.content !== newContent) {
        updateWorkspaceFileContent(idx, newContent);
        setActiveWorkspaceFileIndex(idx);

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        setLastSyncTime(timeStr);

        IdeBridgeConnection.notifyWorkspaceFileUpdated({
          path: existing.path,
          content: newContent,
          language: 'java'
        });
      }
    }
  }, [updateWorkspaceFileContent, setActiveWorkspaceFileIndex]);

  useEffect(() => {
    const bridge = new IdeBridgeConnection({
      port: 41789,
      channel: 'task',
      onFileUpdated: handleFileFromIde,
      onStatusChange: setStatus,
      onWorkspaceDirChange: setWorkspaceDir
    });

    bridgeRef.current = bridge;
    bridge.connect();

    return () => {
      bridge.disconnect();
      bridgeRef.current = null;
    };
  }, [handleFileFromIde]);

  const downloadProjectZip = async (challengeId?: string) => {
    const id = challengeId || activePracticeChallenge?.id;
    if (!id) return;

    setIsDownloading(true);
    try {
      const res = await fetch(`/api/practice/${encodeURIComponent(id)}/export-zip`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `challenge-${activePracticeChallenge?.slug || id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download project zip:', err);
      alert('Не удалось скачать проект: ' + (err.message || 'Ошибка сервера'));
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    status,
    workspaceDir,
    lastSyncTime,
    isModalOpen,
    setIsModalOpen,
    isDownloading,
    downloadProjectZip
  };
}
