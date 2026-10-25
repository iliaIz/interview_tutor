import React, { useState, useEffect, useRef } from 'react';
import type { BugStreamPhase } from '../../../hooks/useBugChallengeStream';

export interface BugHuntThoughtAccordionProps {
  phase: BugStreamPhase;
  thoughts: string;
  elapsedMs: number;
  ttftMs: number | null;
  onAbort?: () => void;
}

export const BugHuntThoughtAccordion: React.FC<BugHuntThoughtAccordionProps> = ({
  phase,
  thoughts,
  elapsedMs,
  ttftMs,
  onAbort
}) => {
  const isActive = phase === 'connecting' || phase === 'thinking' || phase === 'assembling';
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    } else if (phase === 'ready') {
      setIsOpen(false);
    }
  }, [isActive, phase]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [thoughts, isOpen]);

  if (phase === 'idle' || (phase === 'ready' && !thoughts.trim())) {
    return null;
  }

  const secondsText = (elapsedMs / 1000).toFixed(1);
  const phaseLabel =
    phase === 'connecting'
      ? 'Инициализация канала Gemini 3.8 Flash...'
      : phase === 'thinking'
        ? 'Фаза 1: Проектирование продакшн-инцидента (Live Reasoning)...'
        : phase === 'assembling'
          ? 'Фаза 2: Сборка и валидация JSON-схемы кода...'
          : phase === 'ready'
            ? 'Инженерный план инцидента сформирован'
            : 'Поток прерван';

  return (
    <div className="mb-4 rounded-xl border border-indigo-500/30 bg-slate-900/80 backdrop-blur-sm overflow-hidden transition-all duration-300">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsOpen((prev) => !prev);
        }}
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isActive ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
            </span>
          ) : (
            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium text-indigo-200 truncate">
            {phaseLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-2">
          {ttftMs !== null && (
            <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/20">
              TTFT {(ttftMs / 1000).toFixed(2)}с
            </span>
          )}
          <span className="text-xs font-mono text-slate-400">{secondsText}с</span>
          {isActive && onAbort && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAbort();
              }}
              className="text-xs px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors"
            >
              Стоп
            </button>
          )}
          <span className="text-xs text-slate-400">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-slate-800/80 px-4 py-3 bg-slate-950/60">
          <div
            ref={scrollContainerRef}
            className="max-h-48 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap pr-1"
          >
            {thoughts ? (
              <>
                {thoughts}
                {phase === 'thinking' && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-indigo-400 animate-pulse" />
                )}
              </>
            ) : (
              <span className="text-slate-500 italic">
                Ожидание первых токенов рассуждений от модели...
              </span>
            )}
          </div>

          {phase === 'assembling' && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center gap-2 text-xs text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>
                Рассуждения завершены. Буферизация, санитизация и проверка схемы BugChallenge...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
