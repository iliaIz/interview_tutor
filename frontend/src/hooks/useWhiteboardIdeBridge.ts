/**
 * useWhiteboardIdeBridge.ts
 * React hook connecting Web Whiteboard to the Local Zero-Dependency Whiteboard Companion Bridge
 * over Loopback WebSocket (ws://127.0.0.1:41790).
 * Completely isolated from Task Code Bridge on :41789.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

export type WhiteboardIdeStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing';

interface BridgeMessage {
  type: string;
  origin?: 'ide' | 'web';
  path?: string;
  content?: string;
  workspaceDir?: string;
  timestamp?: number;
}

export const WHITEBOARD_BRIDGE_URL = 'ws://127.0.0.1:41790';

export function useWhiteboardIdeBridge() {
  const [status, setStatus] = useState<WhiteboardIdeStatus>('disconnected');
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateIdeTrackedContent = useAppStore((s) => s.updateIdeTrackedContent);

  const handleFileFromIde = useCallback((filePath: string, newContent: string) => {
    // Only process Whiteboard files or fallback
    const normalized = filePath.replace(/\\/g, '/');
    if (!normalized.endsWith('Whiteboard.java') && !normalized.includes('Whiteboard')) {
      return;
    }

    updateIdeTrackedContent(newContent);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLastSyncTime(timeStr);
    setStatus('syncing');
    setTimeout(() => setStatus('connected'), 600);

    // Broadcast workspace_file_updated so active live voice sessions register Whiteboard.java in manifest
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workspace_file_updated', {
            detail: {
              path: 'Whiteboard.java',
              content: newContent,
              language: 'java'
            }
          })
        );
      }
    } catch {
      // Non-critical if voice session not active
    }
  }, [updateIdeTrackedContent]);

  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setStatus('connecting');
    try {
      const ws = new WebSocket(WHITEBOARD_BRIDGE_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        ws.send(
          JSON.stringify({
            type: 'HANDSHAKE_INIT',
            clientVersion: '1.0.0',
            channel: 'whiteboard',
            timestamp: Date.now()
          })
        );

        // Heartbeat ping
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

          if (
            data.type === 'FILE_UPDATED' &&
            data.origin === 'ide' &&
            data.path &&
            typeof data.content === 'string'
          ) {
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

        // Auto-reconnect probe
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3500);
      };

      ws.onerror = () => {
        // Socket error triggers onclose
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

  // Controlled Checkout: User explicitly pushes selected revision code to local disk
  const checkoutCode = useCallback((content: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'FILE_UPDATED',
          origin: 'web',
          path: 'src/main/java/Whiteboard.java',
          content
        })
      );
    }
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
