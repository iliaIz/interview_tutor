/**
 * useIdeBridge.ts
 * React hook connecting Web AI Cockpit to the Local Zero-Dependency IntelliJ Companion Bridge
 * over Loopback WebSocket (ws://127.0.0.1:41789).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { createCodeFrame } from '../../services/DeicticGroundingManager';

export type IdeBridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing';

interface BridgeMessage {
  type: string;
  origin?: 'ide' | 'web';
  path?: string;
  content?: string;
  challengeId?: string;
  workspaceDir?: string;
  timestamp?: number;
}

export function useIdeBridge() {
  const [status, setStatus] = useState<IdeBridgeStatus>('disconnected');
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    updateWorkspaceFileContent,
    setActiveWorkspaceFileIndex
  } = useAppStore();

  const handleFileFromIde = useCallback((filePath: string, newContent: string) => {
    const currentFiles = useAppStore.getState().practiceWorkspaceFiles;
    
    // Find corresponding file by exact path or normalized suffix
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
        setStatus('syncing');
        setTimeout(() => setStatus('connected'), 600);

        // Notify Gemini Live with real-time code frame
        try {
          const frame = createCodeFrame(newContent, existing.path, 'java');
          // Global event bus dispatch for active live voice sessions
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gemini_live_code_frame', { detail: frame }));
          }
        } catch {
          // Non-critical if voice session not active
        }
      }
    }
  }, [updateWorkspaceFileContent, setActiveWorkspaceFileIndex]);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus('connecting');
    try {
      const ws = new WebSocket('ws://127.0.0.1:41789');
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        const challengeId = useAppStore.getState().activePracticeChallenge?.id || 'default';
        ws.send(JSON.stringify({
          type: 'HANDSHAKE_INIT',
          clientVersion: '1.0.0',
          challengeId,
          timestamp: Date.now()
        }));

        // Heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data: BridgeMessage = JSON.parse(event.data);

          if (data.type === 'HANDSHAKE_ACK') {
            setStatus('connected');
            if (data.workspaceDir) {
              setWorkspaceDir(data.workspaceDir);
            }
          }

          if (data.type === 'FILE_UPDATED' && data.origin === 'ide' && data.path && data.content !== undefined) {
            handleFileFromIde(data.path, data.content);
          }
        } catch {
          // Ignore unparseable frames
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        setWorkspaceDir(null);
        socketRef.current = null;
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Auto-reconnect probe after 3.5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3500);
      };

      ws.onerror = () => {
        // Socket error immediately triggers onclose
      };
    } catch {
      setStatus('disconnected');
    }
  }, [handleFileFromIde]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

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
