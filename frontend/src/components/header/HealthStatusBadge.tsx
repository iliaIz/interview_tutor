import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Headphones, Loader2, AlertCircle, Server, Activity, CheckCircle2, X } from 'lucide-react';

/**
 * HealthStatusBadge & Interactive Diagnostic Popover (SOTA Late 2026).
 * Cognitive bounding limit: <= 350 lines.
 */
export const HealthStatusBadge: React.FC = () => {
  const { systemHealth } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const shortSha = (import.meta.env.VITE_GIT_COMMIT_SHA as string)?.slice(0, 7) || systemHealth?.commitSha || 'dev';

  let badge = null;
  if (systemHealth.isAiReady) {
    badge = (
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 shadow-2xs backdrop-blur-sm cursor-pointer shrink-0 transition active:scale-95 touch-manipulation"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <Headphones className="w-3.5 h-3.5 text-emerald-600" />
        <span className="hidden xl:inline text-[11px]">AI Шлюз</span>
        {systemHealth.latencyMs && (
          <span className="text-[10px] opacity-70 hidden sm:inline">({systemHealth.latencyMs}мс)</span>
        )}
      </div>
    );
  } else if (systemHealth.status === 'warming_up' || systemHealth.status === 'checking') {
    badge = (
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 shadow-2xs animate-pulse cursor-pointer shrink-0 transition active:scale-95 touch-manipulation"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
        <span className="hidden xl:inline text-[11px]">{systemHealth.error ? 'Синхронизация...' : 'Запуск AI...'}</span>
      </div>
    );
  } else {
    badge = (
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs cursor-pointer shrink-0 transition active:scale-95 touch-manipulation"
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
        <span className="hidden xl:inline text-[11px]">AI Офлайн</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      {badge}

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-xl border border-pastel-border/90 rounded-3xl p-4 shadow-2xl z-50 font-sans space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-pastel-accentRose" />
              <h4 className="text-xs font-bold text-pastel-text">LiteLLM AI Gateway Status</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-pastel-muted hover:text-pastel-text rounded-lg hover:bg-pastel-bg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-pastel-bg/80 border border-pastel-border">
              <span className="text-pastel-muted flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-pastel-accentViolet" />
                <span>Шлюз LiteLLM</span>
              </span>
              <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{systemHealth.latencyMs ? `${systemHealth.latencyMs} мс` : 'Ready'}</span>
              </span>
            </div>

            {shortSha && (
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-pastel-bg/60 border border-pastel-border/70 text-[11px]">
                <span className="text-pastel-muted flex items-center gap-1.5 font-sans">
                  <Activity className="w-3 h-3 text-pastel-accentRose" />
                  <span>Версия сборки</span>
                </span>
                <span className="font-mono font-bold text-slate-700">{shortSha}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                <span className="text-slate-600">Text: Smart</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                <span className="text-slate-600">Live: Multimodal</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                <span className="text-slate-600">TTS: v3 Audio</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                <span className="text-slate-600">Embeddings</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            </div>

            <p className="text-[10px] text-pastel-muted leading-relaxed pt-1">
              Все запросы маршрутизируются через отказоустойчивый LiteLLM Proxy с двухслойным Circuit Breaker.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
