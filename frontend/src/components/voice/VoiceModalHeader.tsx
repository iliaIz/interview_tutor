/**
 * VoiceModalHeader.tsx
 * Modular header bar for VoiceModal: displays active topic, batch counter, code board trigger, and close button.
 * Cognitive bounding limit: <= 60 lines.
 */

import React from 'react';
import { X, Code2 } from 'lucide-react';

export interface VoiceModalHeaderProps {
  activeTopic: string;
  isBatchMode: boolean;
  activeBatchIndex: number;
  totalQuestions: number;
  isWhiteboardOpen: boolean;
  activeWhiteboardState: any;
  onToggleWhiteboard: () => void;
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
  onClose
}) => {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-rose-100/60 shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
        <h2 className="font-bold text-slate-800 text-sm sm:text-base tracking-tight truncate max-w-[260px] sm:max-w-md">
          {activeTopic}
        </h2>
        {isBatchMode && (
          <span className="px-2 py-0.5 rounded-full bg-rose-100/80 text-rose-700 text-xs font-semibold">
            {activeBatchIndex + 1} / {totalQuestions}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleWhiteboard}
          title="Интерактивная доска кода"
          className={`p-1.5 px-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
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
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
