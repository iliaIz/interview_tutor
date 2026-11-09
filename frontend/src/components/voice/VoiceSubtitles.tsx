/**
 * VoiceSubtitles.tsx
 * Real-Time Conversational Dialogue & Subtitles Stream (SOTA Late 2026).
 * Single responsibility: auto-scrolling dialogue turn stream with soft luxury aesthetic.
 */

import React, { useEffect, useRef } from 'react';
import { Bot, User, Sparkles } from 'lucide-react';
import { DialogueTurnItem } from '../../audio/types';

export interface VoiceSubtitlesProps {
  turns: DialogueTurnItem[];
  statusMessage?: string;
}

export const VoiceSubtitles: React.FC<VoiceSubtitlesProps> = ({
  turns,
  statusMessage
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [turns, statusMessage]);

  return (
    <div className="flex flex-col flex-1 min-h-[160px] bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 overflow-hidden backdrop-blur-sm">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 scroll-smooth"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8 text-center">
            <Sparkles className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">Сессия готова. Начните диалог с ИИ-интервьюером.</p>
          </div>
        ) : (
          turns.map((turn) => {
            const isAi = turn.role === 'ai';
            const isSystem = turn.role === 'system';

            if (isSystem) {
              return (
                <div key={turn.id} className="text-center my-2">
                  <span className="inline-block px-3 py-1 bg-slate-200/60 text-slate-600 rounded-full text-xs font-medium">
                    {turn.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={turn.id}
                className={`flex items-start gap-2.5 ${isAi ? 'justify-start' : 'justify-end'}`}
              >
                {isAi && (
                  <div className="w-7 h-7 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isAi
                      ? 'bg-white border border-slate-200/80 text-slate-800'
                      : 'bg-emerald-600 text-white font-medium ml-auto'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{turn.text}</p>
                </div>
                {!isAi && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {statusMessage && (
        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="truncate">{statusMessage}</span>
        </div>
      )}
    </div>
  );
};
