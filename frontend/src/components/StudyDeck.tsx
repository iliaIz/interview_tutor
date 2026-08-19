import React, { useState } from 'react';
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
  Code2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VoiceModal } from './VoiceModal';
import { CardVoiceTutor } from './CardVoiceTutor';

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
    updateTopicProgress
  } = useAppStore();
  const [copied, setCopied] = React.useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(true);

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

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-pastel-text bg-pastel-rose px-3 py-1 rounded-full border border-pastel-accentRose/20">
            Карточка {currentQuestionIndex + 1} из {currentBatch.length}
          </span>
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

              {/* Action Buttons: Voice Interview & Audio Recap */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsVoiceOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition cursor-pointer shadow-2xs active:scale-95"
                  title="Пройти устное собеседование по этому вопросу"
                >
                  <Mic className="w-3.5 h-3.5" /> Устный ответ AI
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
                          if (!inline && (className || codeStr.includes('\n'))) {
                            return (
                              <div className="relative group my-4 rounded-2xl overflow-hidden border border-[#2A243E] bg-[#161322] shadow-md">
                                <div className="bg-[#1d192e] px-4 py-2 flex items-center justify-between text-xs text-[#B3A9D4] font-mono border-b border-[#2A243E]">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 opacity-80">
                                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 inline-block"></span>
                                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block"></span>
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 inline-block"></span>
                                    </div>
                                    <span className="font-semibold text-slate-200 ml-1">Code Snippet</span>
                                  </div>
                                  <button
                                    onClick={() => handleCopyCode(codeStr)}
                                    className="flex items-center gap-1 text-[#9D93C4] hover:text-white transition cursor-pointer text-[11px] px-2 py-0.5 rounded-md hover:bg-white/10"
                                  >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                                  </button>
                                </div>
                                <pre className="p-4 font-mono text-xs md:text-sm overflow-x-auto m-0 leading-relaxed text-[#EAE6F8]">
                                  <code>{codeStr}</code>
                                </pre>
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
            </div>

            {/* Embedded AI Voice Tutor & Bug Review Widget */}
            <CardVoiceTutor
              question={currentQ}
              topicName={selectedTopicName || currentQ.topic}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer Controls */}
      <div className="flex items-center justify-between">
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
          <button
            onClick={() => setView('quiz')}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-md transform hover:scale-102 active:scale-98 cursor-pointer"
          >
            <Brain className="w-5 h-5" /> Проверка знаний ({currentBatch.length} вопр.)
          </button>
        )}
      </div>

      {/* Voice Modal with Continuous Batch Mode */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        questionId={currentQ.id}
        topic={selectedTopicName || currentQ.topic}
        currentQuestionText={currentQ.question}
        referenceAnswer={currentQ.answer}
        questionsBatch={currentBatch}
        initialQuestionIndex={currentQuestionIndex}
        onBatchComplete={(evaluations: Record<string, any>) => {
          Object.entries(evaluations).forEach(([qId, evalData]: [string, any]) => {
            const numScore = typeof evalData.score === 'number' ? evalData.score : parseFloat(String(evalData.score)) || 0;
            const isMastered = evalData.isPassed && numScore >= 8;
            setQuestionEvaluation(qId, evalData);
            if (selectedTopicId) {
              updateTopicProgress(selectedTopicId, qId, isMastered);
            }
          });
        }}
      />
    </div>
  );
};
