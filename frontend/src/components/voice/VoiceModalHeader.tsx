/**
 * VoiceModalHeader.tsx
 * Modular header bar for VoiceModal: displays active topic, batch counter, code board trigger, and close button.
 * Cognitive bounding limit: <= 60 lines.
 */

import React from 'react';
import { X, Code2, BookOpen } from 'lucide-react';

export interface VoiceModalHeaderProps {
  activeTopic: string;
  isBatchMode: boolean;
  activeBatchIndex: number;
  totalQuestions: number;
  isWhiteboardOpen: boolean;
  activeWhiteboardState: any;
  onToggleWhiteboard: () => void;
  isCribSheetOpen?: boolean;
  onToggleCribSheet?: () => void;
  onClose: () => void;
}

export const VoiceModalHeader: React.FC<VoiceModalHeaderProps> = ({
  activeTopic,
  isBatchMode,
  activeBatchIndex,
  totalQuestions,
  isWhiteboardOpen,
  activeWhiteboardState,
  onToggleWhiteboard,
  isCribSheetOpen = false,
  onToggleCribSheet,
  onClose
}) => {
  return (
    <div className="flex items-center justify-between gap-3 pb-3 border-b border-rose-100/60 shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping shrink-0" />
        <h2 className="font-bold text-slate-800 text-sm sm:text-base tracking-tight truncate max-w-[160px] sm:max-w-[280px] md:max-w-[380px]" title={activeTopic}>
          {activeTopic}
        </h2>
        {isBatchMode && (
          <span className="px-2 py-0.5 rounded-full bg-rose-100/80 text-rose-700 text-xs font-semibold shrink-0">
            {activeBatchIndex + 1} / {totalQuestions}
          </span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {onToggleCribSheet && (
          <button
            onClick={onToggleCribSheet}
            title="Шпаргалка и бриф к собеседованию"
            className={`p-1.5 px-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0 ${
              isCribSheetOpen
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">Шпаргалка</span>
          </button>
        )}
        <button
          onClick={onToggleWhiteboard}
          title="Интерактивная доска кода"
          className={`p-1.5 px-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0 ${
            isWhiteboardOpen || activeWhiteboardState
              ? 'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-200'
              : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-rose-50/70 hover:text-rose-600 hover:border-rose-200'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span className="hidden sm:inline">Доска кода</span>
          {activeWhiteboardState && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
        <button
          onClick={onClose}
          aria-label="Закрыть окно диалога"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-700 bg-white/95 border border-slate-200/90 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 shadow-xs transition-colors cursor-pointer"
        >
          <X className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>
    </div>
  );
};
