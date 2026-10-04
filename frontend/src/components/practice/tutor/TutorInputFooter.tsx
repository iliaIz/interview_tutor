/**
 * TutorInputFooter.tsx
 * Input textarea footer for PracticeTutorDrawer.
 * Single Responsibility: text input, send/abort actions, and clear chat.
 */

import React from 'react';
import { Send, Square, Trash2 } from 'lucide-react';

interface Props {
  inputVal: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  onClear: () => void;
}

export const TutorInputFooter: React.FC<Props> = ({
  inputVal,
  isLoading,
  onInputChange,
  onSend,
  onAbort,
  onClear,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-3 border-t border-pastel-border/60 bg-white/80 shrink-0">
      <div className="relative flex items-end gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-pastel-accentRose focus-within:ring-2 focus-within:ring-pastel-accentRose/20 transition">
        <textarea
          value={inputVal}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Спросить напарника по коду или тесту... (Enter для отправки)"
          rows={2}
          className="flex-1 bg-transparent border-none resize-none text-xs text-slate-800 focus:outline-hidden p-1.5 leading-relaxed placeholder:text-slate-400"
        />

        <div className="flex items-center gap-1">
          {isLoading ? (
            <button
              onClick={onAbort}
              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer"
              title="Остановить генерацию"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!inputVal.trim()}
              className="w-8 h-8 rounded-xl bg-pastel-rose hover:bg-pastel-accentRose text-pastel-accentRoseText hover:text-white disabled:opacity-40 flex items-center justify-center transition cursor-pointer shadow-2xs"
              title="Отправить (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-400">
        <button
          onClick={onClear}
          className="flex items-center gap-1 hover:text-slate-600 transition cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          <span>Очистить чат</span>
        </button>
        <span>Shift + Enter для новой строки</span>
      </div>
    </div>
  );
};
