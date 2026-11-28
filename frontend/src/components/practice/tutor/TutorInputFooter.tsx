/**
 * TutorInputFooter.tsx
 * Input textarea footer for PracticeTutorDrawer.
 * Single Responsibility: text input, send/abort actions, and clear chat.
 */

import React from 'react';
import { CheckCircle2, Loader2, MapPin, Send, Square, Trash2, X } from 'lucide-react';

export interface TutorInputSelectionChip {
  label: string;
  snippet?: string;
  onClear?: () => void;
}

interface Props {
  inputVal: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  onClear: () => void;
  placeholder?: string;
  showVerifyAction?: boolean;
  isVerifyingDiagnosis?: boolean;
  onVerifyDiagnosis?: () => void;
  selectionChip?: TutorInputSelectionChip | null;
}

export const TutorInputFooter: React.FC<Props> = ({
  inputVal,
  isLoading,
  onInputChange,
  onSend,
  onAbort,
  onClear,
  placeholder = 'Спросить напарника по коду или тесту... (Enter для отправки)',
  showVerifyAction = false,
  isVerifyingDiagnosis = false,
  onVerifyDiagnosis,
  selectionChip
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-3 border-t border-pastel-border/60 bg-white/80 shrink-0">
      {selectionChip && (
        <div className="mb-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-bold shrink-0">{selectionChip.label}</span>
            {selectionChip.snippet && (
              <span className="font-mono text-[10px] text-amber-800 truncate">{selectionChip.snippet}</span>
            )}
          </div>
          {selectionChip.onClear && (
            <button
              type="button"
              onClick={selectionChip.onClear}
              aria-label="Сбросить выделенную строку"
              className="p-0.5 rounded hover:bg-amber-100 text-amber-700 cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="relative flex items-end gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-pastel-accentRose focus-within:ring-2 focus-within:ring-pastel-accentRose/20 transition">
        <textarea
          value={inputVal}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 bg-transparent border-none resize-none text-xs text-slate-800 focus:outline-hidden p-1.5 leading-relaxed placeholder:text-slate-400"
        />

        <div className="flex items-center gap-1 shrink-0">
          {showVerifyAction && onVerifyDiagnosis && !isLoading && (
            <button
              type="button"
              onClick={onVerifyDiagnosis}
              disabled={!inputVal.trim() || isVerifyingDiagnosis}
              data-testid="verify-bug-diagnosis-btn"
              className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 flex items-center gap-1 text-[11px] font-bold transition cursor-pointer shadow-2xs"
              title="Отправить текст как финальный диагноз корневой причины"
            >
              {isVerifyingDiagnosis ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Проверить</span>
            </button>
          )}

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
        <span>{showVerifyAction ? 'Enter — обсудить • «Проверить» — сдать диагноз' : 'Shift + Enter для новой строки'}</span>
      </div>
    </div>
  );
};
