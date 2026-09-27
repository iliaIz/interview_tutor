import React, { useState } from 'react';
import {
  Mic,
  Brain,
  Award,
  Headphones,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeViewer } from '../CodeViewer';
import { Question } from '../../store/useAppStore';
import { TUTOR_MODES, TutorMode, getTutorModeLabel } from './studyTypes';

interface StudyFlashcardProps {
  currentQuestion: Question;
  currentIndex: number;
  activeEvaluation?: any;
  voiceModalTutorMode: TutorMode;
  onSelectTutorMode: (mode: TutorMode) => void;
  onOpenVoiceSession: (type: 'interview' | 'tutor', prompt?: string) => void;
  onOpenReportModal: (evalData: any) => void;
  onRecapQuestion: () => void;
  onOpenTransactionLab: (scenario: string) => void;
}

export const StudyFlashcard: React.FC<StudyFlashcardProps> = ({
  currentQuestion,
  activeEvaluation,
  voiceModalTutorMode,
  onSelectTutorMode,
  onOpenVoiceSession,
  onOpenReportModal,
  onRecapQuestion,
  onOpenTransactionLab,
}) => {
  const [showAnswer, setShowAnswer] = useState(true);
  const [quickQuestionText, setQuickQuestionText] = useState('');

  const handleLaunchTutor = (promptText?: string) => {
    const text = (promptText !== undefined ? promptText : quickQuestionText).trim();
    onOpenVoiceSession('tutor', text);
    setQuickQuestionText('');
  };

  const isTransactional =
    currentQuestion.question.toLowerCase().includes('транзакц') ||
    currentQuestion.question.includes('@Transactional');

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
        className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-6 md:p-8 border border-pastel-border shadow-sm relative overflow-hidden w-full min-w-0"
      >
        {/* Subtle Ambient Decorative Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pastel-rose/30 via-pastel-lavender/20 to-transparent rounded-full blur-2xl pointer-events-none -z-0" />

        <div className="relative z-10 w-full min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span className="text-xs font-bold text-pastel-muted uppercase tracking-wider">
              Вопрос #{currentQuestion.num}
            </span>

            {/* Action Buttons: Voice Interview, AI Tutor & Audio Recap */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => onOpenVoiceSession('interview')}
                className="flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
                title="Пройти устное собеседование по этому вопросу с оценкой"
              >
                <Mic className="w-3.5 h-3.5 shrink-0" />
                <span>Собеседование</span>
              </button>

              <button
                onClick={() => onOpenVoiceSession('tutor')}
                className="flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-pastel-lavender/80 text-pastel-accentViolet border border-pastel-accentViolet/30 hover:bg-pastel-accentViolet hover:text-white transition cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
                title="Обсудить голосом с AI-тьютором с доской (режим обучения)"
              >
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span>Тьютор <span className="hidden sm:inline">({getTutorModeLabel(voiceModalTutorMode)})</span></span>
              </button>

              {activeEvaluation && (
                <button
                  onClick={() => onOpenReportModal(activeEvaluation)}
                  className="flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition cursor-pointer active:scale-95 touch-manipulation"
                  title="Посмотреть отчет последнего ответа"
                >
                  <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Отчет ({activeEvaluation.score}/10)</span>
                </button>
              )}

              <button
                onClick={onRecapQuestion}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white transition cursor-pointer active:scale-95 touch-manipulation"
                title="Сгенерировать аудиоподкаст по этому вопросу"
              >
                <Headphones className="w-3.5 h-3.5 shrink-0" />
                <span>Подкаст</span>
              </button>
            </div>
          </div>

          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-pastel-text mb-3 sm:mb-5 leading-snug break-anywhere w-full">
            {currentQuestion.question}
          </h2>

          {/* Direct Bridge to Spring Transaction Playground */}
          {isTransactional && (
            <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="font-black text-xs sm:text-sm tracking-tight">
                    Интерактивный симулятор: Spring Transaction Playground (SOTA 2026)
                  </div>
                  <div className="text-[11px] text-violet-100 leading-snug">
                    Исследуйте физику @Transactional, дедлоки HikariCP и теорему Вулдриджа на живом верстаке.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenTransactionLab('self_invocation_bypass')}
                className="py-2 px-4 rounded-xl bg-white text-violet-900 font-extrabold text-xs shadow hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <span>🎯 Закрепить на практике</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Reference Answer Section with Collapsible Toggle for Self-Testing */}
          <div className="border-t border-pastel-border/60 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-pastel-muted flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-pastel-accentRose" /> Подробный эталонный ответ:
              </div>
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="text-xs font-semibold text-pastel-accentViolet hover:text-pastel-accentRose transition flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pastel-lavender/40 border border-pastel-accentViolet/20 cursor-pointer"
              >
                {showAnswer ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Свернуть ответ
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Показать ответ
                  </>
                )}
              </button>
            </div>

            {/* Rich Markdown Answer Renderer */}
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full min-w-0 text-sm md:text-base leading-relaxed text-pastel-text break-anywhere"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ children }: any) => (
                        <div className="my-3 w-full max-w-full min-w-0">{children}</div>
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-base font-bold text-pastel-accentViolet mt-5 mb-2 flex items-center gap-2" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-4 text-pastel-text/90 leading-relaxed break-anywhere" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong className="font-bold text-pastel-text" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc list-inside my-3 space-y-1.5 text-pastel-text/90 pl-1 break-anywhere" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal list-inside my-3 space-y-1.5 text-pastel-text/90 pl-1 break-anywhere" {...props} />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto scroll-touch-x my-4 sm:my-6 rounded-2xl border border-pastel-border shadow-2xs w-full max-w-full min-w-0">
                          <table className="w-full text-xs md:text-sm text-left border-collapse" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-pastel-rose/60 text-pastel-text font-bold uppercase text-[11px] tracking-wider border-b border-pastel-border" {...props} />
                      ),
                      th: ({ node, ...props }) => (
                        <th className="px-3 sm:px-4 py-2 sm:py-3 font-bold" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-pastel-border/50 align-top break-anywhere" {...props} />
                      ),
                      code: ({ node, inline, className, children, ...props }: any) => {
                        const codeStr = String(children).replace(/\n$/, '');
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1] : 'java';

                        if (!inline && (className || codeStr.includes('\n'))) {
                          return (
                            <div className="my-2.5 w-full max-w-full min-w-0">
                              <CodeViewer
                                code={codeStr}
                                language={lang}
                                title={`${lang.toUpperCase()} • Code Snippet`}
                              />
                            </div>
                          );
                        }
                        return (
                          <code className="px-1.5 py-0.5 rounded-md bg-pastel-lavender/60 text-pastel-accentViolet font-mono text-[11px] sm:text-xs font-semibold break-anywhere [word-break:break-word]" {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {currentQuestion.answer}
                  </ReactMarkdown>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Ask AI Tutor Bar with Visible Mode Chips */}
            <div className="mt-5 pt-4 border-t border-pastel-border/60 space-y-2 w-full min-w-0">
              <div className="flex items-center gap-1.5 overflow-x-auto scroll-touch-x no-scrollbar py-0.5 w-full min-w-0">
                <span className="text-[10px] font-bold text-pastel-muted uppercase tracking-wider shrink-0 mr-1">Режим:</span>
                {TUTOR_MODES.map((m) => {
                  const isSelected = voiceModalTutorMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectTutorMode(m.id)}
                      title={m.desc}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation ${
                        isSelected
                          ? 'bg-pastel-accentViolet text-white shadow-xs border border-pastel-accentViolet'
                          : 'bg-white/80 hover:bg-white text-pastel-muted hover:text-pastel-text border border-pastel-border'
                      }`}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-pastel-lavender/30 border border-pastel-accentViolet/20 shadow-2xs focus-within:ring-2 focus-within:ring-pastel-accentViolet/30 focus-within:border-pastel-accentViolet/50 transition-all w-full min-w-0">
                <Brain className="w-4 h-4 text-pastel-accentViolet ml-1.5 sm:ml-2 shrink-0" />
                <input
                  type="text"
                  value={quickQuestionText}
                  onChange={(e) => setQuickQuestionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickQuestionText.trim()) {
                      handleLaunchTutor(quickQuestionText.trim());
                    }
                  }}
                  placeholder={`💬 Спросить Тьютора [${getTutorModeLabel(voiceModalTutorMode)}]...`}
                  className="flex-1 min-w-0 px-2 py-1 text-xs text-pastel-text bg-transparent placeholder:text-pastel-sub focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleLaunchTutor(quickQuestionText.trim())}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 touch-manipulation"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Спросить</span>
                  <span className="hidden sm:inline">({getTutorModeLabel(voiceModalTutorMode)})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
