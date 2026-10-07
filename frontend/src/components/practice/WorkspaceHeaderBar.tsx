import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { FileCode, Lock, Clock, Compass, RotateCcw, Cloud, Check, Loader2, Laptop } from 'lucide-react';
import { AutosaveSyncStatus } from './useWorkspaceAutosave';
import { useIdeBridge } from './useIdeBridge';
import { IdeBridgeModal } from './IdeBridgeModal';

interface WorkspaceHeaderBarProps {
  lastSavedTime: string | null;
  syncStatus?: AutosaveSyncStatus;
  onResetWorkspace: () => void;
}

export const WorkspaceHeaderBar: React.FC<WorkspaceHeaderBarProps> = ({
  lastSavedTime,
  syncStatus = 'saved',
  onResetWorkspace
}) => {
  const {
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    setActiveWorkspaceFileIndex,
    practiceElapsedSeconds,
    activePracticeChallenge
  } = useAppStore();

  const { toggleCompass } = usePracticeTutorStore();

  const {
    status: ideStatus,
    workspaceDir,
    lastSyncTime: ideLastSyncTime,
    isModalOpen: isIdeModalOpen,
    setIsModalOpen: setIsIdeModalOpen,
    isDownloading: isIdeDownloading,
    downloadProjectZip
  } = useIdeBridge();

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1.5 gap-2 overflow-x-auto no-scrollbar">
      {/* File Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x py-0.5">
        {practiceWorkspaceFiles.map((file, idx) => {
          const isActive = activeWorkspaceFileIndex === idx;
          const fileName = file.path.split('/').pop() || file.path;

          return (
            <button
              key={file.path}
              type="button"
              onClick={() => setActiveWorkspaceFileIndex(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer shrink-0 min-h-[36px] ${
                isActive
                  ? 'bg-slate-800 text-pastel-accentRose border border-pastel-accentRose/40 font-bold shadow-2xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-pastel-accentRose' : 'text-slate-500'}`} />
              <span>{fileName}</span>
              {file.readOnly && (
                <span title="Read-only test contract" className="ml-0.5">
                  <Lock className="w-3 h-3 text-slate-500" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions, Compass & Timer */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs">
        <button
          type="button"
          onClick={() => setIsIdeModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition cursor-pointer text-[11px] font-medium border ${
            ideStatus === 'connected' || ideStatus === 'syncing'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : ideStatus === 'connecting'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
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

        <button
          type="button"
          onClick={() => toggleCompass()}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer text-[11px] font-medium"
          title="Открыть компас инженера (Ctrl + /)"
        >
          <Compass className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span className="hidden sm:inline">Compass</span>
          <kbd className="hidden md:inline px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-[9px] text-slate-400">Ctrl+/</kbd>
        </button>

        <button
          type="button"
          onClick={onResetWorkspace}
          className="flex items-center gap-1 px-2 py-1 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition cursor-pointer text-[11px]"
          title="Сбросить воркспейс к исходным файлам"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Сброс</span>
        </button>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-mono text-[11px]">
          <Clock className="w-3 h-3 text-pastel-accentRose animate-pulse" />
          <span>{formatTime(practiceElapsedSeconds)}</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[10px]">
          {syncStatus === 'saving' ? (
            <span className="flex items-center gap-1 text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Сохранение...</span>
            </span>
          ) : syncStatus === 'local_only' ? (
            <span className="flex items-center gap-1 text-amber-400/90" title="Сохранено в локальном кэше браузера">
              <Cloud className="w-3 h-3" />
              <span>Локальный кэш</span>
            </span>
          ) : syncStatus === 'dirty' ? (
            <span className="text-slate-500">
              Несохранено...
            </span>
          ) : lastSavedTime ? (
            <span className="flex items-center gap-1 text-slate-400" title="Синхронизировано с базой данных">
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
