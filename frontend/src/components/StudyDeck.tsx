import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Sparkles,
  Copy,
  Check,
  Headphones,
  Award,
  Mic,
  Eye,
  EyeOff,
  Code2,
  Keyboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VoiceModal } from './VoiceModal';
import { CodeViewer } from './CodeViewer';
import { useInterviewConfig } from '../hooks/useInterviewConfig';

export const StudyDeck: React.FC = () => {
  const {
    currentBatch,
    currentQuestionIndex,
    setQuestionIndex,
    setView,
    selectedTopicId,
    selectedTopicName,
    openRecapModal,
    openTopicQuestions,
    evaluationsMap,
    openReportModal,
    setQuestionEvaluation,
    updateTopicProgress,
    openTransactionLab,
    setBatch,
    startQuizWithQuestions
  } = useAppStore();

  const [isAutoHealing, setIsAutoHealing] = useState(false);

  // SOTA 2026 Auto-Healing: If page reloads with empty batch but valid selectedTopicId, restore questions automatically
  useEffect(() => {
    if ((!currentBatch || currentBatch.length === 0) && selectedTopicId && !isAutoHealing) {
      setIsAutoHealing(true);
      fetch(`/api/topics/${selectedTopicId}/questions`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data) => {
          const allQuestions = data.questions || [];
          if (allQuestions.length > 0) {
            setBatch(allQuestions.slice(0, 10));
          }
        })
        .catch((err) => {
          console.warn('Auto-healing batch failed:', err);
        })
        .finally(() => {
          setIsAutoHealing(false);
        });
    }
  }, [currentBatch, selectedTopicId, isAutoHealing, setBatch]);
const TUTOR_MODES = [
  { id: 'deep_dive' as const, label: 'Под капотом', icon: '🔬', desc: 'Глубокий разбор JVM, байткода, concurrency и edge cases' },
  { id: 'socratic' as const, label: 'Сократ', icon: '💡', desc: 'Наводящие вопросы и совместный поиск решения' },
  { id: 'eli5' as const, label: 'На пальцах', icon: '👶', desc: 'Простые жизненные аналогии без сложного академического жаргона' },
  { id: 'free_chat' as const, label: 'Свободный', icon: '💬', desc: 'Ответы на любые ваши вопросы без рамок' }
];

const getTutorModeLabel = (mode: string) => {
  const found = TUTOR_MODES.find(m => m.id === mode);
  return found ? found.label : 'Под капотом';
};

  const { config } = useInterviewConfig();
  const studyModality = config.studyModality || 'voice';

  const [copied, setCopied] = React.useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceInitialIndex, setVoiceInitialIndex] = useState<number>(0);
  const [voiceModalSessionType, setVoiceModalSessionType] = useState<'interview' | 'tutor'>('interview');
  const [voiceModalTutorMode, setVoiceModalTutorMode] = useState<'deep_dive' | 'socratic' | 'eli5' | 'free_chat'>(() => {
    return (localStorage.getItem('interview_tutor_mode') as any) || 'deep_dive';
  });
  const [showAnswer, setShowAnswer] = useState(true);
  const [quickQuestionText, setQuickQuestionText] = useState('');
  const [customPromptForTutor, setCustomPromptForTutor] = useState('');

  const handleStartVoiceBlitz = () => {
    setVoiceInitialIndex(0);
    setVoiceModalSessionType('interview');
    setCustomPromptForTutor('');
    setIsVoiceOpen(true);
  };

  const handleStartTextQuiz = () => {
    if (!currentBatch || currentBatch.length === 0) return;
    const currentQ = currentBatch[currentQuestionIndex] || currentBatch[0];
    startQuizWithQuestions(
      selectedTopicId || currentQ.topic,
      selectedTopicName || currentQ.topic,
      currentBatch
    );
  };

  const handleSelectTutorMode = (mode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat') => {
    setVoiceModalTutorMode(mode);
    try {
      localStorage.setItem('interview_tutor_mode', mode);
    } catch {}
  };

  const handleLaunchTutorWithPrompt = (prompt?: string) => {
    const text = (prompt !== undefined ? prompt : quickQuestionText).trim();
    setVoiceInitialIndex(currentQuestionIndex);
    setCustomPromptForTutor(text);
    setVoiceModalSessionType('tutor');
    setIsVoiceOpen(true);
    setQuickQuestionText('');
  };

  // Global Keyboard Arrow Navigation (← Previous / Next →)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (isVoiceOpen) return;
      if (e.key === 'ArrowRight' && currentBatch && currentQuestionIndex < currentBatch.length - 1) {
        e.preventDefault();
        setQuestionIndex(currentQuestionIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentQuestionIndex > 0) {
        e.preventDefault();
        setQuestionIndex(currentQuestionIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestionIndex, currentBatch, isVoiceOpen, setQuestionIndex]);

  if (isAutoHealing) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-pastel-accentViolet border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-pastel-muted">Восстановление изучаемой темы...</p>
      </div>
    );
  }

  if (!currentBatch || currentBatch.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-pastel-muted">Нет вопросов в выбранной порции.</p>
        <button
          onClick={() => setView('topics')}
          className="mt-4 px-4 py-2 bg-pastel-card border border-pastel-border rounded-xl text-sm font-semibold cursor-pointer"
        >
          Вернуться к выбору тем
        </button>
      </div>
    );
  }

  const currentQ = currentBatch[currentQuestionIndex];
  const isLast = currentQuestionIndex === currentBatch.length - 1;

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRecapCurrentQuestion = () => {
    openRecapModal({
      questionIds: [currentQ.id],
      topicName: selectedTopicName || currentQ.topic,
      title: `Вопрос #${currentQ.num}: ${currentQ.question.slice(0, 40)}...`,
    });
  };

  const handleRecapBatch = () => {
    openRecapModal({
      questionIds: currentBatch.map((q) => q.id),
      topicName: selectedTopicName || currentQ.topic,
      title: `Порция: ${selectedTopicName || currentQ.topic} (${currentBatch.length} вопр.)`,
    });
  };

  const activeEvaluation = evaluationsMap[currentQ.id];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Breadcrumb & Continuous Batch Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/75 backdrop-blur-md px-4 py-3 rounded-2xl border border-pastel-border shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('topics')}
            className="text-xs font-semibold text-pastel-muted hover:text-pastel-text transition flex items-center gap-1 cursor-pointer"
          >
            ← Темы
          </button>
          <span className="text-pastel-muted/50">•</span>
          <button
            onClick={() => {
              if (selectedTopicId) openTopicQuestions(selectedTopicId, selectedTopicName || currentQ.topic);
            }}
            className="text-xs font-semibold text-pastel-accentViolet hover:underline transition"
          >
            {selectedTopicName || currentQ.topic}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-xs font-bold text-pastel-text bg-pastel-rose px-3 py-1 rounded-full border border-pastel-accentRose/20">
            Карточка {currentQuestionIndex + 1} из {currentBatch.length}
          </span>
          <button
            onClick={handleStartVoiceBlitz}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition cursor-pointer shadow-2xs active:scale-95"
            title={`Пройти устное собеседование по всей группе (${currentBatch.length} вопр.) с итоговой оценкой`}
          >
            <Mic className="w-3 h-3" /> Собеседование порции ({currentBatch.length})
          </button>
          <button
            onClick={handleRecapBatch}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-pastel-lavender/60 text-pastel-accentViolet border border-pastel-accentViolet/20 hover:bg-pastel-accentViolet hover:text-white transition cursor-pointer"
            title="AI-аудиопересказ всей текущей порции"
          >
            <Headphones className="w-3 h-3" /> Пересказ порции
          </button>
        </div>
      </div>

      {/* Main Flashcard with Elegant Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-pastel-border shadow-sm relative overflow-hidden"
        >
          {/* Subtle Ambient Decorative Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pastel-rose/30 via-pastel-lavender/20 to-transparent rounded-full blur-2xl pointer-events-none -z-0" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <span className="text-xs font-bold text-pastel-muted uppercase tracking-wider">
                Вопрос #{currentQ.num}
              </span>

              {/* Action Buttons: Voice Interview, AI Tutor & Audio Recap */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setVoiceInitialIndex(currentQuestionIndex);
                    setVoiceModalSessionType('interview');
                    setIsVoiceOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition cursor-pointer shadow-2xs active:scale-95"
                  title="Пройти устное собеседование по этому вопросу с оценкой"
                >
                  <Mic className="w-3.5 h-3.5" /> Собеседование
                </button>

                <button
                  onClick={() => {
                    setVoiceInitialIndex(currentQuestionIndex);
                    setVoiceModalSessionType('tutor');
                    setIsVoiceOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-pastel-lavender/80 text-pastel-accentViolet border border-pastel-accentViolet/30 hover:bg-pastel-accentViolet hover:text-white transition cursor-pointer shadow-2xs active:scale-95"
                  title="Обсудить вопрос голосом с AI-тьютором без оценок (режим обучения)"
                >
                  <Brain className="w-3.5 h-3.5" /> Тьютор ({getTutorModeLabel(voiceModalTutorMode)})
                </button>

                {activeEvaluation && (
                  <button
                    onClick={() => openReportModal(activeEvaluation)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                    title="Посмотреть отчет последнего ответа"
                  >
                    <Award className="w-3.5 h-3.5 text-emerald-600" /> Отчет ({activeEvaluation.score}/10)
                  </button>
                )}

                <button
                  onClick={handleRecapCurrentQuestion}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white transition cursor-pointer"
                  title="Сгенерировать аудиопересказ для этого вопроса"
                >
                  <Headphones className="w-3.5 h-3.5" /> Озвучить
                </button>
              </div>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-pastel-text mb-5 leading-snug">
              {currentQ.question}
            </h2>

            {/* Direct Bridge to Spring Transaction Playground (SOTA 2026 Workbench) */}
            {(currentQ.question.toLowerCase().includes('транзакц') || currentQ.question.includes('@Transactional')) && (
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
                  onClick={() => openTransactionLab('self_invocation_bypass')}
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
                    className="prose prose-slate max-w-none text-sm md:text-base leading-relaxed text-pastel-text overflow-hidden"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h3: ({ node, ...props }) => (
                          <h3 className="text-base font-bold text-pastel-accentViolet mt-5 mb-2 flex items-center gap-2" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="mb-4 text-pastel-text/90 leading-relaxed" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong className="font-bold text-pastel-text" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc list-inside my-3 space-y-1.5 text-pastel-text/90 pl-1" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal list-inside my-3 space-y-1.5 text-pastel-text/90 pl-1" {...props} />
                        ),
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-6 rounded-2xl border border-pastel-border shadow-2xs">
                            <table className="w-full text-xs md:text-sm text-left border-collapse" {...props} />
                          </div>
                        ),
                        thead: ({ node, ...props }) => (
                          <thead className="bg-pastel-rose/60 text-pastel-text font-bold uppercase text-[11px] tracking-wider border-b border-pastel-border" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                          <th className="px-4 py-3 font-bold" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="px-4 py-3 border-b border-pastel-border/50 align-top" {...props} />
                        ),
                        code: ({ node, inline, className, children, ...props }: any) => {
                          const codeStr = String(children).replace(/\n$/, '');
                          const match = /language-(\w+)/.exec(className || '');
                          const lang = match ? match[1] : 'java';

                          if (!inline && (className || codeStr.includes('\n'))) {
                            return (
                              <div className="my-4">
                                <CodeViewer
                                  code={codeStr}
                                  language={lang}
                                  title={`${lang.toUpperCase()} • Code Snippet`}
                                />
                              </div>
                            );
                          }
                          return (
                            <code className="px-1.5 py-0.5 rounded-md bg-pastel-lavender/60 text-pastel-accentViolet font-mono text-xs font-semibold" {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {currentQ.answer}
                    </ReactMarkdown>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick Ask AI Tutor Bar with Visible Mode Chips */}
              <div className="mt-5 pt-4 border-t border-pastel-border/60 space-y-2">
                {/* Contextual Mode Micro-Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[10px] font-bold text-pastel-muted uppercase tracking-wider shrink-0 mr-1">Режим:</span>
                  {TUTOR_MODES.map((m) => {
                    const isSelected = voiceModalTutorMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectTutorMode(m.id)}
                        title={m.desc}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
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

                <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-pastel-lavender/30 border border-pastel-accentViolet/20 shadow-2xs focus-within:ring-2 focus-within:ring-pastel-accentViolet/30 focus-within:border-pastel-accentViolet/50 transition-all">
                  <Brain className="w-4 h-4 text-pastel-accentViolet ml-2 shrink-0" />
                  <input
                    type="text"
                    value={quickQuestionText}
                    onChange={(e) => setQuickQuestionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickQuestionText.trim()) {
                        handleLaunchTutorWithPrompt(quickQuestionText.trim());
                      }
                    }}
                    placeholder={`💬 Спросить Тьютора [${getTutorModeLabel(voiceModalTutorMode)}] текстом или в наушники...`}
                    className="flex-1 px-2 py-1 text-xs text-pastel-text bg-transparent placeholder:text-pastel-sub focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleLaunchTutorWithPrompt(quickQuestionText.trim())}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Спросить ({getTutorModeLabel(voiceModalTutorMode)})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Sticky Reader Bar with Keyboard Hints for continuous reading */}
      <div className="sticky bottom-4 z-30 flex items-center justify-between bg-white/95 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-pastel-border shadow-lg">
        <div className="flex items-center gap-2">
          <button
            disabled={currentQuestionIndex === 0}
            onClick={() => setQuestionIndex(currentQuestionIndex - 1)}
            className="px-3 py-1.5 rounded-xl border border-pastel-border text-xs font-bold text-pastel-muted hover:text-pastel-text disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1.5 bg-pastel-bg/80 cursor-pointer active:scale-95"
            title="Предыдущая карточка (клавиша ←)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Назад</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] bg-white rounded border border-pastel-border font-mono">←</kbd>
          </button>

          <span className="text-xs font-bold text-pastel-text font-mono px-2">
            #{currentQ.num} ({currentQuestionIndex + 1}/{currentBatch.length})
          </span>

          <button
            disabled={isLast}
            onClick={() => setQuestionIndex(currentQuestionIndex + 1)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            title="Следующая карточка (клавиша →)"
          >
            <span className="hidden sm:inline">Вперед</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] bg-white/20 rounded border border-white/30 font-mono text-white">→</kbd>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartVoiceBlitz}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-lavender/70 hover:bg-pastel-accentViolet text-pastel-accentViolet hover:text-white text-xs font-bold transition border border-pastel-accentViolet/20 cursor-pointer shadow-2xs active:scale-95"
            title={`Пройти устное собеседование по всей группе (${currentBatch.length} вопр.) с итоговой оценкой`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Собеседование группы ({currentBatch.length})</span>
          </button>
        </div>

        <div className="text-[11px] font-medium text-pastel-muted hidden sm:flex items-center gap-1.5">
          <span>Навигация:</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-pastel-bg rounded border border-pastel-border font-mono">←</kbd>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-pastel-bg rounded border border-pastel-border font-mono">→</kbd>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          disabled={currentQuestionIndex === 0}
          onClick={() => setQuestionIndex(currentQuestionIndex - 1)}
          className="px-4 py-2.5 rounded-2xl border border-pastel-border text-sm font-semibold text-pastel-muted hover:text-pastel-text disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 bg-white shadow-2xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>

        {!isLast ? (
          <button
            onClick={() => setQuestionIndex(currentQuestionIndex + 1)}
            className="px-5 py-2.5 rounded-2xl bg-pastel-accentRose text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-2xs cursor-pointer active:scale-95"
          >
            Следующая карточка <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {studyModality === 'voice' ? (
              <>
                <button
                  type="button"
                  onClick={handleStartTextQuiz}
                  title="Пройти пошаговую проверку письменно с клавиатуры"
                  className="px-4 py-3 rounded-2xl border border-pastel-border bg-white text-pastel-muted hover:text-pastel-text text-xs font-bold hover:bg-pastel-bg/60 transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <BookOpen className="w-4 h-4 text-pastel-muted" />
                  <span>Письменно</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartVoiceBlitz}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-md transform hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Mic className="w-5 h-5 animate-pulse" />
                  <span>Голосовой блиц ({currentBatch.length} вопр.)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStartVoiceBlitz}
                  title="Пройти устный опрос с Gemini Live (Авто-VAD)"
                  className="px-4 py-3 rounded-2xl border border-pastel-border bg-white text-pastel-muted hover:text-pastel-text text-xs font-bold hover:bg-pastel-bg/60 transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <Mic className="w-4 h-4 text-pastel-accentViolet" />
                  <span>Устно</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartTextQuiz}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-md transform hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Brain className="w-5 h-5" />
                  <span>Проверка знаний ({currentBatch.length} вопр.)</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Voice Modal with Continuous Batch Mode */}
      {isVoiceOpen && (
        <VoiceModal
          key={`voice_modal_${voiceModalSessionType}_${voiceInitialIndex}_${currentQ.id}`}
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          questionId={currentQ.id}
          topic={selectedTopicName || currentQ.topic}
          currentQuestionText={currentQ.question}
          referenceAnswer={currentQ.answer}
          questionsBatch={currentBatch}
          initialQuestionIndex={voiceInitialIndex}
          onIndexChange={(newIdx) => setQuestionIndex(newIdx)}
          initialSessionType={voiceModalSessionType}
          initialTutorMode={voiceModalTutorMode}
          customPromptOverride={customPromptForTutor}
          onBatchComplete={(evaluations: Record<string, any>) => {
            Object.entries(evaluations).forEach(([qId, evalData]: [string, any]) => {
              const numScore = typeof evalData.score === 'number' ? evalData.score : parseFloat(String(evalData.score)) || 0;
              const isMastered = evalData.isPassed && numScore >= 8;
              setQuestionEvaluation(qId, evalData);
              if (selectedTopicId) {
                updateTopicProgress(selectedTopicId, qId, isMastered, currentBatch.length);
              }
            });
          }}
        />
      )}
    </div>
  );
};
