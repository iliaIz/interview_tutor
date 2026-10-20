/**
 * VoiceActiveView.tsx
 * Active live audio dialogue view with subtitles, visualizer, mic button, and tutor controls.
 * Bounded cognitive size: <= 150 lines.
 */

import React from 'react';
import { Send, Sparkles } from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { VoiceSubtitles } from './VoiceSubtitles';
import { VoiceMicButton } from './VoiceMicButton';
import { VoiceEngineState, DialogueTurnItem, NavigationActionEvent } from '../../audio/types';

export interface VoiceActiveViewProps {
  activeQuestionText: string;
  isPendingEvaluation: boolean;
  pendingNavigation?: NavigationActionEvent | null;
  initialSessionType?: 'interview' | 'tutor';
  isBatchMode: boolean;
  activeBatchIndex: number;
  totalQuestions: number;
  onNextQuestion?: () => void;
  onFinishTutor?: () => void;
  state: VoiceEngineState;
  isMuted: boolean;
  rmsDb: number;
  isDraining: boolean;
  isTransientFiltered?: boolean;
  statusMessage: string;
  dialogueTurns: DialogueTurnItem[];
  onCentralButtonClick: () => void;
  onToggleMute: () => void;
  textInput: string;
  setTextInput: (val: string) => void;
  onSendText: (e: React.FormEvent) => void;
}

export const VoiceActiveView: React.FC<VoiceActiveViewProps> = ({
  activeQuestionText,
  isPendingEvaluation,
  pendingNavigation,
  initialSessionType,
  isBatchMode,
  activeBatchIndex,
  totalQuestions,
  onNextQuestion,
  onFinishTutor,
  state,
  isMuted,
  rmsDb,
  isDraining,
  isTransientFiltered = false,
  statusMessage,
  dialogueTurns,
  onCentralButtonClick,
  onToggleMute,
  textInput,
  setTextInput,
  onSendText
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 py-2">
      <p className="text-xs sm:text-sm text-slate-600 font-medium mb-2 line-clamp-2 px-1">
        {activeQuestionText}
      </p>

      {/* Dual-Sided Handshake Evaluation Drain Notice */}
      {isPendingEvaluation && (
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 mb-2 rounded-xl bg-purple-100/90 text-purple-900 text-xs font-semibold animate-pulse shadow-xs">
          <Sparkles className="w-4 h-4 text-purple-600 animate-spin" />
          <span>🎙️ ИИ подводит итоги ответа... Дослушайте вердикт</span>
        </div>
      )}

      {/* Voice-Commanded Navigation Notice */}
      {pendingNavigation && !pendingNavigation.isBoundaryBlocked && (
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 mb-2 rounded-xl bg-violet-100/90 text-violet-900 text-xs font-semibold animate-pulse shadow-xs">
          <Sparkles className="w-4 h-4 text-violet-600 animate-spin" />
          <span>🎙️ Переход: Вопрос {(pendingNavigation.targetIndex ?? 0) + 1} из {totalQuestions}...</span>
        </div>
      )}

      {/* Socratic Tutor Toolbar */}
      {initialSessionType === 'tutor' && (
        <div className="flex items-center justify-between gap-2 py-1.5 px-3 mb-2 rounded-xl bg-rose-50/80 border border-rose-100/80 text-rose-800 text-xs shadow-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Сократовский тьютор</span>
          </div>
          <div className="flex items-center gap-2">
            {isBatchMode && activeBatchIndex + 1 < totalQuestions && onNextQuestion && (
              <button
                type="button"
                onClick={onNextQuestion}
                className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 font-medium hover:bg-rose-50 text-[11px] cursor-pointer transition-colors"
              >
                Следующий
              </button>
            )}
            {onFinishTutor && (
              <button
                type="button"
                onClick={onFinishTutor}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 text-white font-semibold text-[11px] cursor-pointer shadow-xs transition-all"
              >
                Завершить разбор
              </button>
            )}
          </div>
        </div>
      )}

      <VoiceVisualizer
        rmsDb={rmsDb}
        isActive={state === 'AI_SPEAKING' || state === 'LISTENING'}
        color={state === 'AI_SPEAKING' ? 'rose' : 'emerald'}
      />

      <VoiceSubtitles turns={dialogueTurns} statusMessage={statusMessage} />

      <VoiceMicButton
        state={state}
        isMuted={isMuted}
        rmsDb={rmsDb}
        isDraining={isDraining}
        isTransientFiltered={isTransientFiltered}
        onClick={onCentralButtonClick}
        onToggleMute={onToggleMute}
      />

      {/* Candidate Text Fallback */}
      <form onSubmit={onSendText} className="flex gap-2 pt-2 border-t border-slate-100">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Или напишите ответ текстом..."
          className="flex-1 bg-white/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
        <button
          type="submit"
          disabled={!textInput.trim()}
          className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs sm:text-sm font-medium hover:bg-slate-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
