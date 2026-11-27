import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FileCode, Lock, Cloud, Check, Loader2, Laptop, ChevronDown } from 'lucide-react';
import { AutosaveSyncStatus } from './useWorkspaceAutosave';
import { useIdeBridge } from './useIdeBridge';
import { IdeBridgeModal } from './IdeBridgeModal';

interface WorkspaceHeaderBarProps {
  lastSavedTime: string | null;
  syncStatus?: AutosaveSyncStatus;
  manualSaveBanner?: boolean;
}

export const WorkspaceHeaderBar: React.FC<WorkspaceHeaderBarProps> = ({
  lastSavedTime,
  syncStatus = 'saved',
  manualSaveBanner = false
}) => {
  const {
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    setActiveWorkspaceFileIndex,
    activePracticeChallenge
  } = useAppStore();

  const [isFilesPopoverOpen, setIsFilesPopoverOpen] = useState(false);
  const filesPopoverRef = useRef<HTMLDivElement | null>(null);

  const {
    status: ideStatus,
    workspaceDir,
    lastSyncTime: ideLastSyncTime,
    isModalOpen: isIdeModalOpen,
    setIsModalOpen: setIsIdeModalOpen,
    isDownloading: isIdeDownloading,
    downloadProjectZip
  } = useIdeBridge();

  useEffect(() => {
    if (!isFilesPopoverOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (filesPopoverRef.current && !filesPopoverRef.current.contains(e.target as Node)) {
        setIsFilesPopoverOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilesPopoverOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isFilesPopoverOpen]);

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  return (
    <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1 gap-2 shrink-0">
      {/* Left: File Tabs (isolated horizontal scroll) + Explicit Overflow Switcher */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div
          role="tablist"
          aria-label="Файлы проекта"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mask-fade-end touch-pan-x py-0.5 flex-1 min-w-0 pr-6"
        >
          {practiceWorkspaceFiles.map((file, idx) => {
            const isActive = activeWorkspaceFileIndex === idx;
            const fileName = file.path.split('/').pop() || file.path;

            return (
              <button
                key={file.path}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveWorkspaceFileIndex(idx)}
                className={`touch-target-44 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition-colors cursor-pointer shrink-0 min-h-[32px] ${
                  isActive
                    ? 'bg-slate-800 text-rose-200 border border-pastel-accentRose/50 font-bold shadow-2xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-pastel-accentRose' : 'text-slate-400'}`} />
                <span>{fileName}</span>
                {file.readOnly && (
                  <span title="Read-only контракт" className="ml-0.5">
                    <Lock className="w-3 h-3 text-amber-300" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explicit File Overflow Switcher */}
        {practiceWorkspaceFiles.length > 1 && (
          <div className="relative shrink-0" ref={filesPopoverRef}>
            <button
              type="button"
              onClick={() => setIsFilesPopoverOpen((v) => !v)}
              aria-expanded={isFilesPopoverOpen}
              aria-haspopup="listbox"
              className="touch-target-44 flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold cursor-pointer transition"
              title="Показать все файлы проекта"
            >
              <span>Файлы ({practiceWorkspaceFiles.length})</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isFilesPopoverOpen && (
              <div
                role="listbox"
                aria-label="Список файлов проекта"
                className="absolute right-0 top-full mt-1.5 w-72 max-h-72 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 z-40"
              >
                {practiceWorkspaceFiles.map((file, idx) => {
                  const isActive = activeWorkspaceFileIndex === idx;
                  const fileName = file.path.split('/').pop() || file.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setActiveWorkspaceFileIndex(idx);
                        setIsFilesPopoverOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-mono flex items-center justify-between gap-2 cursor-pointer transition ${
                        isActive
                          ? 'bg-slate-800 text-rose-200 font-bold'
                          : 'text-slate-200 hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="truncate">{fileName}</span>
                      {file.readOnly && <Lock className="w-3 h-3 text-amber-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Read-Only indicator, IntelliJ Bridge & Autosave Status */}
      <div className="flex items-center gap-2 shrink-0 text-xs">
        {currentFile?.readOnly && (
          <span className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/35 text-[10px] font-bold">
            <Lock className="w-3 h-3 text-amber-300" />
            <span>Read-Only</span>
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsIdeModalOpen(true)}
          className={`touch-target-44 flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition cursor-pointer text-[11px] font-medium border ${
            ideStatus === 'connected' || ideStatus === 'syncing'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
              : ideStatus === 'connecting'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-slate-800 text-slate-200 hover:text-white border-slate-700 hover:bg-slate-700'
          }`}
          title="Решать в IntelliJ IDEA (Zero-Dependency Bridge)"
        >
          <Laptop className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {ideStatus === 'connected'
              ? 'IntelliJ: Подключена'
              : ideStatus === 'syncing'
              ? 'Синхронизация...'
              : 'В IntelliJ'}
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1 text-[10px]">
          {manualSaveBanner ? (
            <span className="flex items-center gap-1 text-emerald-300 font-semibold">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Сохранено (Ctrl+S)</span>
            </span>
          ) : syncStatus === 'saving' ? (
            <span className="flex items-center gap-1 text-amber-300">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Сохранение...</span>
            </span>
          ) : syncStatus === 'local_only' ? (
            <span className="flex items-center gap-1 text-amber-300" title="Сохранено в локальном кэше браузера">
              <Cloud className="w-3 h-3" />
              <span>Локальный кэш</span>
            </span>
          ) : syncStatus === 'dirty' ? (
            <span className="text-slate-300">Несохранено...</span>
          ) : lastSavedTime ? (
            <span className="flex items-center gap-1 text-slate-300" title="Синхронизировано с базой данных">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Сохранено {lastSavedTime}</span>
            </span>
          ) : null}
        </div>
      </div>

      <IdeBridgeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        status={ideStatus}
        workspaceDir={workspaceDir}
        lastSyncTime={ideLastSyncTime}
        isDownloading={isIdeDownloading}
        onDownloadZip={() => downloadProjectZip()}
        challengeTitle={activePracticeChallenge?.title}
      />
    </div>
  );
};
