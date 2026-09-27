import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { usePracticeVoice } from './tutor/PracticeVoiceContext';
import { FileCode, Lock, Clock, Compass, RotateCcw } from 'lucide-react';

interface WorkspaceHeaderBarProps {
  lastSavedTime: string | null;
  onResetWorkspace: () => void;
}

export const WorkspaceHeaderBar: React.FC<WorkspaceHeaderBarProps> = ({
  lastSavedTime,
  onResetWorkspace
}) => {
  const {
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    setActiveWorkspaceFileIndex,
    practiceElapsedSeconds
  } = useAppStore();

  const { toggleCompass } = usePracticeTutorStore();
  const { isConnected: isVoiceConnected, sendTextMessage, syncEditorCode } = usePracticeVoice();

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
              onClick={() => {
                setActiveWorkspaceFileIndex(idx);
                if (isVoiceConnected) {
                  sendTextMessage(
                    `📂 [СМЕНА АКТИВНОГО ФАЙЛА]: Кандидат переключился на файл «${fileName}» (${
                      file.readOnly ? 'только для чтения / контракт тестов' : 'редактируемый рабочий код'
                    }).`
                  );
                  syncEditorCode?.(file.content, fileName, 'java', true);
                }
              }}
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

        {lastSavedTime && (
          <span className="text-[10px] text-slate-500 hidden md:inline">
            Сохранено в {lastSavedTime}
          </span>
        )}
      </div>
    </div>
  );
};
