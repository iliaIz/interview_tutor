/**
 * VoiceTutorTheoryPanel.tsx
 * Encapsulated Study Material and Reference Theory panel for Voice Tutor.
 * Cognitive Bounding Limit: <= 200 lines.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Sparkles, ChevronLeft, ChevronRight, Volume2, Mic } from 'lucide-react';
import { CodeViewer } from '../CodeViewer';

export interface VoiceTutorTheoryPanelProps {
  isBatchMode: boolean;
  activeBatchIndex: number;
  totalQuestions: number;
  activeQuestionNum: number;
  activeTopic: string;
  activeQuestionText: string;
  activeReferenceAnswer?: string;
  onSwitchQuestion?: (newIndex: number) => void;
  activeFocus: any;
  setFocus: (focus: any) => void;
  clearFocus: () => void;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isUserSpeaking: boolean;
  onSwitchToTutorTab: () => void;
}

export const VoiceTutorTheoryPanel: React.FC<VoiceTutorTheoryPanelProps> = ({
  isBatchMode,
  activeBatchIndex,
  totalQuestions,
  activeQuestionNum,
  activeTopic,
  activeQuestionText,
  activeReferenceAnswer,
  onSwitchQuestion,
  activeFocus,
  setFocus,
  clearFocus,
  isAiSpeaking,
  isRecording,
  isUserSpeaking,
  onSwitchToTutorTab
}) => {
  return (
    <div className="flex flex-col min-h-0 bg-slate-50/70 rounded-2xl border border-pastel-border/80 p-2.5 sm:p-3.5 overflow-hidden flex-1">
      <div className="flex items-center justify-between pb-2 border-b border-pastel-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-pastel-accentViolet" />
          <span className="text-xs font-bold text-pastel-text">Изучаемый материал карточки</span>
        </div>
        <div className="flex items-center gap-2">
          {isBatchMode && totalQuestions > 1 && (
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-pastel-border shadow-2xs">
              <button
                type="button"
                disabled={activeBatchIndex <= 0}
                onClick={() => onSwitchQuestion?.(activeBatchIndex - 1)}
                className="p-1 rounded-md text-pastel-muted hover:text-pastel-text hover:bg-pastel-lavender/40 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
                title="Предыдущий вопрос (Alt+←)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-bold text-pastel-accentViolet font-mono px-1">
                {activeBatchIndex + 1} / {totalQuestions}
              </span>
              <button
                type="button"
                disabled={activeBatchIndex >= totalQuestions - 1}
                onClick={() => onSwitchQuestion?.(activeBatchIndex + 1)}
                className="p-1 rounded-md text-pastel-muted hover:text-pastel-text hover:bg-pastel-lavender/40 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
                title="Следующий вопрос (Alt+→)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="text-[10px] font-semibold text-pastel-muted bg-white px-2 py-0.5 rounded-full border border-pastel-border">
            {activeTopic}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1.5 pt-2.5 space-y-3">
        {/* Question Header Card */}
        <div data-selection-zone="question" className="p-3 rounded-xl bg-white border border-pastel-border/70 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-accentRose block mb-1">
            {isBatchMode ? `Вопрос #${activeQuestionNum} (${activeBatchIndex + 1}/${totalQuestions}):` : 'Вопрос:'}
          </span>
          <h4 className="font-bold text-pastel-text text-sm leading-snug break-anywhere">
            {activeQuestionText}
          </h4>
        </div>

        {/* Markdown Theory & Code */}
        <div data-selection-zone="reference_answer" className="p-3 sm:p-3.5 rounded-xl bg-white border border-pastel-border/70 shadow-2xs leading-relaxed text-pastel-text/90 break-anywhere">
          <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-muted flex items-center gap-1 mb-2">
            <Sparkles className="w-3 h-3 text-pastel-accentRose" />
            Подробный эталонный ответ:
          </span>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-pastel-accentViolet mt-3 mb-1" {...props} />,
              p: ({ node, ...props }) => <p className="mb-2 text-xs text-pastel-text/90 leading-relaxed break-anywhere" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1 text-xs text-pastel-text/90 pl-1 break-anywhere" {...props} />,
              table: ({ node, ...props }: any) => (
                <div className="overflow-x-auto scroll-touch-x my-2.5 rounded-xl border border-pastel-border shadow-2xs">
                  <table className="min-w-full text-xs text-left border-collapse" {...props} />
                </div>
              ),
              td: ({ node, ...props }: any) => (
                <td className="px-3 py-1.5 border-b border-pastel-border/50 align-top break-anywhere" {...props} />
              ),
              code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => {
                const codeStr = String(children).replace(/\n$/, '');
                const match = /language-(\w+)/.exec(className || '');
                const lang = match ? match[1] : 'java';
                if (!inline && (className || codeStr.includes('\n'))) {
                  return (
                    <div className="my-2">
                      <CodeViewer
                        code={codeStr}
                        language={lang}
                        title={`${lang.toUpperCase()} • Эталонный листинг`}
                      />
                    </div>
                  );
                }
                const isFocused = activeFocus?.text === codeStr;
                return (
                  <code
                    onClick={() => {
                      if (isFocused) {
                        clearFocus();
                      } else {
                        setFocus({
                          zone: 'term',
                          text: codeStr,
                          timestamp: Date.now()
                        });
                      }
                    }}
                    title="Нажмите, чтобы указать ИИ на этот термин"
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold cursor-pointer transition-all duration-150 break-anywhere [word-break:break-word] ${
                      isFocused
                        ? 'bg-pastel-accentViolet text-white ring-2 ring-pastel-accentViolet/50 shadow-2xs'
                        : 'bg-pastel-lavender/60 text-pastel-accentViolet hover:bg-pastel-lavender hover:ring-1 hover:ring-pastel-accentViolet/40'
                    }`}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
            }}
          >
            {activeReferenceAnswer || 'Эталонный ответ загружается...'}
          </ReactMarkdown>
        </div>
      </div>

      {/* Mobile Quick-Jump to Tutor HUD on Theory Tab */}
      <div className="lg:hidden mt-2 pt-2 border-t border-pastel-border/60 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-pastel-muted">
          {isAiSpeaking ? (
            <span className="flex items-center gap-1 text-pastel-accentRose font-bold animate-pulse">
              <Volume2 className="w-3.5 h-3.5" />
              <span>AI говорит...</span>
            </span>
          ) : isRecording ? (
            <span className="flex items-center gap-1 text-emerald-600 font-bold">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              <span>Микрофон активен</span>
            </span>
          ) : (
            <span>Голосовой режим доступен</span>
          )}
        </div>
        <button
          type="button"
          onClick={onSwitchToTutorTab}
          className="px-2.5 py-1 rounded-lg bg-pastel-accentViolet/10 text-pastel-accentViolet hover:bg-pastel-accentViolet hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1"
        >
          <span>К тьютору</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
