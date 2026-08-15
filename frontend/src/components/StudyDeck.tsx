import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { ArrowLeft, ArrowRight, BookOpen, Brain, Sparkles, Copy, Check, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const StudyDeck: React.FC = () => {
  const {
    currentBatch,
    currentQuestionIndex,
    setQuestionIndex,
    setView,
    selectedTopicId,
    selectedTopicName,
    openRecapModal,
    openTopicQuestions
  } = useAppStore();
  const [copied, setCopied] = React.useState(false);

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
      title: `Порция из ${currentBatch.length} вопросов (${selectedTopicName || 'Тема'})`,
    });
  };

  const handleGoToQuestionsList = () => {
    if (selectedTopicId) {
      openTopicQuestions(selectedTopicId, selectedTopicName || 'Тема');
    } else {
      setView('topics');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={handleGoToQuestionsList}
            className="flex items-center gap-1.5 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition bg-white px-3 py-1.5 rounded-xl border border-pastel-border shadow-xs cursor-pointer"
            title="Вернуться к списку вопросов темы"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Список вопросов
          </button>

          <button
            onClick={() => setView('topics')}
            className="text-xs font-medium text-pastel-muted hover:text-pastel-text transition px-2 py-1 cursor-pointer"
            title="К разделам тем"
          >
            Все темы
          </button>
        </div>

        <span className="text-xs font-bold px-3.5 py-1 bg-pastel-lavender text-pastel-accentViolet rounded-full border border-pastel-accentViolet/20">
          {selectedTopicName} — Изучение карточек
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('quiz')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pastel-text text-white rounded-xl text-xs font-bold shadow-xs hover:bg-black transition cursor-pointer"
            title="Запустить ИИ-проверку знаний по этой выборке"
          >
            <Brain className="w-3.5 h-3.5 text-pastel-accentViolet" /> Квиз ({currentBatch.length})
          </button>

          <button
            onClick={handleRecapBatch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30 rounded-xl text-xs font-bold shadow-xs hover:bg-pastel-accentRose hover:text-white transition cursor-pointer"
            title="Сгенерировать аудиопересказ для всех карточек в этой порции"
          >
            <Headphones className="w-3.5 h-3.5" /> Аудио
          </button>
        </div>
      </div>

      {/* Main Card View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-pastel-border shadow-sm mb-6 relative"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-pastel-accentRose">
              <BookOpen className="w-4 h-4" /> Вопрос #{currentQ.num}
              <span className="px-2.5 py-0.5 rounded-md bg-pastel-rose text-pastel-accentRose font-mono text-[11px] border border-pastel-accentRose/20">
                {currentQ.id}
              </span>
            </div>

            <button
              onClick={handleRecapCurrentQuestion}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white transition"
              title="Сгенерировать аудиопересказ для этого вопроса"
            >
              <Headphones className="w-3.5 h-3.5" /> Озвучить вопрос
            </button>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-pastel-text mb-6 leading-snug">
            {currentQ.question}
          </h2>

          <div className="border-t border-pastel-border/60 pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-pastel-muted mb-4 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pastel-accentRose" /> Подробный эталонный ответ:
            </div>

            {/* Rich Markdown Answer Renderer */}
            <div className="prose prose-slate max-w-none text-sm md:text-base leading-relaxed text-pastel-text">
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
                    <div className="overflow-x-auto my-6 rounded-2xl border border-pastel-border shadow-sm">
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
                        <div className="relative group my-4 rounded-2xl overflow-hidden border border-slate-800 shadow-md">
                          <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-700">
                            <span>Code</span>
                            <button
                              onClick={() => handleCopyCode(codeStr)}
                              className="flex items-center gap-1 hover:text-white transition"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              {copied ? 'Скопировано' : 'Копировать'}
                            </button>
                          </div>
                          <pre className="bg-slate-900 text-slate-100 p-4 font-mono text-xs md:text-sm overflow-x-auto m-0 leading-relaxed">
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
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer Controls */}
      <div className="flex items-center justify-between">
        <button
          disabled={currentQuestionIndex === 0}
          onClick={() => setQuestionIndex(currentQuestionIndex - 1)}
          className="px-4 py-2.5 rounded-xl border border-pastel-border text-sm font-semibold text-pastel-muted hover:text-pastel-text disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 bg-white shadow-sm"
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
