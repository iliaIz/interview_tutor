import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { ArrowLeft, ArrowRight, BookOpen, Brain, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const StudyDeck: React.FC = () => {
  const { currentBatch, currentQuestionIndex, setQuestionIndex, setView, selectedTopicName } = useAppStore();

  if (!currentBatch || currentBatch.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-pastel-muted">Нет вопросов в выбранной порции.</p>
        <button
          onClick={() => setView('topics')}
          className="mt-4 px-4 py-2 bg-pastel-card border border-pastel-border rounded-xl text-sm font-semibold"
        >
          Вернуться к выбору тем
        </button>
      </div>
    );
  }

  const currentQ = currentBatch[currentQuestionIndex];
  const isLast = currentQuestionIndex === currentBatch.length - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setView('topics')}
          className="flex items-center gap-2 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition"
        >
          <ArrowLeft className="w-4 h-4" /> Выбор тем
        </button>

        <span className="text-xs font-bold px-3 py-1 bg-pastel-lavender text-pastel-accentViolet rounded-full border border-pastel-accentViolet/20">
          {selectedTopicName} — Изучение карточек
        </span>

        <span className="text-xs font-semibold text-pastel-muted">
          Карточка <strong className="text-pastel-text">{currentQuestionIndex + 1}</strong> из {currentBatch.length}
        </span>
      </div>

      {/* Main Card View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-pastel-border shadow-sm mb-6 relative"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-pastel-accentRose mb-3">
            <BookOpen className="w-4 h-4" /> Вопрос #{currentQ.num}
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-pastel-text mb-6 leading-snug">
            {currentQ.question}
          </h2>

          <div className="border-t border-pastel-border/60 pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-pastel-muted mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" /> Подробный ответ для изучения:
            </div>

            {/* Answer Display */}
            <div className="prose prose-slate max-w-none text-sm md:text-base leading-relaxed text-pastel-text space-y-4">
              {currentQ.answer.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('```')) {
                  const codeContent = paragraph.replace(/```[a-z]*/g, '').trim();
                  return (
                    <pre key={idx} className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs md:text-sm font-mono overflow-x-auto my-4 shadow-inner">
                      <code>{codeContent}</code>
                    </pre>
                  );
                }
                return <p key={idx} className="text-pastel-text/90">{paragraph}</p>;
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer Controls */}
      <div className="flex items-center justify-between">
        <button
          disabled={currentQuestionIndex === 0}
          onClick={() => setQuestionIndex(currentQuestionIndex - 1)}
          className="px-4 py-2.5 rounded-xl border border-pastel-border text-sm font-semibold text-pastel-muted hover:text-pastel-text disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 bg-white"
        >
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>

        {!isLast ? (
          <button
            onClick={() => setQuestionIndex(currentQuestionIndex + 1)}
            className="px-5 py-2.5 rounded-xl bg-pastel-accentRose text-white text-sm font-semibold hover:opacity-95 transition flex items-center gap-2 shadow-sm"
          >
            Следующая карточка <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setView('quiz')}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-md transform hover:scale-105"
          >
            <Brain className="w-5 h-5" /> Перейти к проверке знания ({currentBatch.length} вопросов)
          </button>
        )}
      </div>
    </div>
  );
};
