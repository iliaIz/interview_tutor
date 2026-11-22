/**
 * useWhiteboardIdeBridge.ts
 * React hook connecting Web Whiteboard to the Local Zero-Dependency Whiteboard Companion Bridge
 * over Loopback WebSocket (ws://127.0.0.1:41790) via IdeBridgeConnection (SPEC-25).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { IdeBridgeConnection, IdeBridgeStatus } from '../services/IdeBridgeConnection';

export type WhiteboardIdeStatus = IdeBridgeStatus;
export const WHITEBOARD_BRIDGE_URL = 'ws://127.0.0.1:41790';

export function useWhiteboardIdeBridge() {
  const [status, setStatus] = useState<WhiteboardIdeStatus>('disconnected');
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const bridgeRef = useRef<IdeBridgeConnection | null>(null);
  const updateIdeTrackedContent = useAppStore((s) => s.updateIdeTrackedContent);

  const handleFileFromIde = useCallback((filePath: string, newContent: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    if (!normalized.endsWith('Whiteboard.java') && !normalized.includes('Whiteboard')) {
      return;
    }

    updateIdeTrackedContent(newContent);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLastSyncTime(timeStr);

    IdeBridgeConnection.notifyWorkspaceFileUpdated({
      path: 'Whiteboard.java',
      content: newContent,
      language: 'java'
    });
  }, [updateIdeTrackedContent]);

  useEffect(() => {
    const bridge = new IdeBridgeConnection({
      port: 41790,
      channel: 'whiteboard',
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

  const checkoutCode = useCallback((content: string) => {
    bridgeRef.current?.sendFileUpdate('src/main/java/Whiteboard.java', content);
  }, []);

  const downloadWhiteboardZip = async () => {
    setIsDownloading(true);
    try {
      const activeState = useAppStore.getState().activeWhiteboardState;
      const query = activeState?.code ? `?code=${encodeURIComponent(activeState.code)}` : '';
      const res = await fetch(`/api/whiteboard/export-zip${query}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tutor-whiteboard.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download whiteboard zip:', err);
      alert('Не удалось скачать проект доски: ' + (err.message || 'Ошибка сервера'));
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
    checkoutCode,
    downloadWhiteboardZip
  };
}
