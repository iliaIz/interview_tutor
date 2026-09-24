import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Ambient Network Status Banner (SOTA Late 2026).
 * Non-blocking, slim top bar showing connection liveness.
 * Auto-retries in background without unmounting or interrupting active arenas.
 * Cognitive bounding limit: <= 350 lines.
 */
export const AmbientNetworkBanner: React.FC = () => {
  const { systemHealth, checkHealth } = useAppStore();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void checkHealth();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkHealth]);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    try {
      await checkHealth();
    } finally {
      setTimeout(() => setIsRetrying(false), 600);
    }
  };

  const isGatewayDown = systemHealth.status === 'unreachable';
  if (isOnline && !isGatewayDown) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-rose-500/90 via-pink-600/90 to-amber-500/90 text-white text-xs py-1.5 px-3 sm:px-4 shadow-md backdrop-blur-md flex items-center justify-between gap-2 z-50 animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2 min-w-0">
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse text-rose-100" />
            <span className="font-semibold truncate">
              Отсутствует подключение к интернету. Проверьте сеть.
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-200 animate-bounce" />
            <span className="font-semibold truncate">
              Связь с AI-шлюзом временно потеряна. Фоновое переподключение...
            </span>
          </>
        )}
      </div>

      <button
        onClick={handleManualRetry}
        disabled={isRetrying}
        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-[11px] font-bold tracking-wide transition shrink-0 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Повторить</span>
      </button>
    </div>
  );
};
