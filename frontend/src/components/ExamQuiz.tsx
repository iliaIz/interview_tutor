import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { VoiceModal } from './VoiceModal';
import { ArrowLeft, ArrowRight, Brain, Mic, CheckCircle2, AlertTriangle, Sparkles, Send, RotateCcw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const ExamQuiz: React.FC = () => {
  const { currentBatch, currentQuestionIndex, setQuestionIndex, setView, selectedTopicName, selectedTopicId, updateTopicProgress, showToast, systemHealth } = useAppStore();

  const [userAnswer, setUserAnswer] = useState('');
  const [loadingEval, setLoadingEval] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  if (!currentBatch || currentBatch.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-pastel-muted">Порция вопросов не найдена.</p>
        <button onClick={() => setView('topics')} className="mt-4 px-4 py-2 bg-white border border-pastel-border rounded-xl text-sm font-semibold">
          К выбору тем
        </button>
      </div>
    );
  }

  const currentQ = currentBatch[currentQuestionIndex];
  const isLast = currentQuestionIndex === currentBatch.length - 1;

  const handleEvaluate = async () => {
    if (!userAnswer.trim()) {
      showToast({
        type: 'warning',
        title: 'Ответ пуст',
        message: 'Пожалуйста, введите ваш ответ или надиктуйте его голосом перед отправкой.'
      });
      return;
    }

    setLoadingEval(true);
    setEvalResult(null);

    try {
      const res = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQ.question,
          referenceAnswer: currentQ.answer,
          userAnswer
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvalResult(data);

        // Update progress in Zustand and server
        if (selectedTopicId) {
          updateTopicProgress(selectedTopicId, currentQ.id, data.isPassed);

          await fetch(`/api/topics/${selectedTopicId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              completedIds: [currentQ.id],
              masteredIds: data.isPassed ? [currentQ.id] : [],
              lastQuestionId: currentQ.id
            })
          });
        }
      } else {
        const errText = await res.text();
        console.error('Error evaluating answer:', errText);
        showToast({
          type: 'error',
          title: 'Ошибка оценки ИИ',
          message: 'Сервер оценки не смог обработать ответ.',
          technicalDetails: `HTTP ${res.status}: ${errText}`
        });
      }
    } catch (err: any) {
      console.error('Error evaluating answer:', err);
      showToast({
        type: 'error',
        title: 'Сбой подключения к серверу оценки',
        message: err?.message || 'Не удалось связаться с бэкендом оценки.',
        technicalDetails: err?.stack || String(err)
      });
    } finally {
      setLoadingEval(false);
    }
  };

  const handleNext = () => {
    setUserAnswer('');
    setEvalResult(null);
    if (!isLast) {
      setQuestionIndex(currentQuestionIndex + 1);
    } else {
      setView('topics');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setView('study')}
          className="flex items-center gap-2 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition"
        >
          <ArrowLeft className="w-4 h-4" /> Вернуться к изучению
        </button>

        <span className="text-xs font-bold px-3 py-1 bg-pastel-rose text-pastel-accentRose rounded-full border border-pastel-accentRose/20">
          {selectedTopicName} — Проверка знания (ИИ)
        </span>

        <button
          onClick={() => setIsVoiceOpen(true)}
          disabled={!systemHealth.isAiReady}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm transition ${
            !systemHealth.isAiReady
              ? 'opacity-50 cursor-not-allowed bg-gray-400'
              : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-90 cursor-pointer'
          }`}
          title={!systemHealth.isAiReady ? "Инициализация AI Шлюза... Голосовой режим скоро станет доступен" : "Голосовой режим Live"}
        >
          {!systemHealth.isAiReady ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{!systemHealth.isAiReady ? 'AI Запуск...' : 'Голосовой режим Live'}</span>
        </button>
      </div>

      {/* Warmup alert if AI not ready */}
      {!systemHealth.isAiReady && (
        <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 shadow-xs">
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
          <div>
            <span className="font-semibold block">Инициализация AI Шлюза LiteLLM...</span>
            <p className="text-[11px] text-amber-800/80 mt-0.5">
              Модель оценки и голосовой режим станут доступны автоматически через несколько секунд.
            </p>
          </div>
        </div>
      )}

      {/* Main Question Card */}
      <motion.div
        key={currentQ.id}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 border border-pastel-border shadow-sm mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-pastel-accentViolet flex items-center gap-1.5">
            <Brain className="w-4 h-4" /> Вопрос {currentQuestionIndex + 1} из {currentBatch.length}
          </span>
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-pastel-text mb-6 leading-snug">
          {currentQ.question}
        </h2>

        {/* Text Area Input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-pastel-muted uppercase tracking-wider mb-2">
            Сформулируйте ваш ответ своими словами:
          </label>
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={loadingEval || !!evalResult}
            rows={5}
            placeholder="Напишите всё, что вы помните по этой теме..."
            className="w-full p-4 rounded-2xl border border-pastel-border bg-pastel-bg/50 focus:bg-white focus:ring-2 focus:ring-pastel-accentViolet/30 focus:border-pastel-accentViolet outline-none text-sm transition resize-none"
          />
        </div>

        {/* Submit Button */}
        {!evalResult && (
          <button
            onClick={handleEvaluate}
            disabled={loadingEval || !userAnswer.trim() || !systemHealth.isAiReady}
            className={`w-full py-3.5 rounded-2xl text-white text-sm font-bold shadow-md transition flex items-center justify-center gap-2 ${
              !systemHealth.isAiReady
                ? 'opacity-60 cursor-not-allowed bg-gray-400'
                : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 disabled:opacity-50 cursor-pointer'
            }`}
            title={!systemHealth.isAiReady ? "Инициализация AI Шлюза..." : "Проверить ответ"}
          >
            {loadingEval ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Gemini 3.5 Flash Lite анализирует ответ...
              </>
            ) : !systemHealth.isAiReady ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ожидание готовности AI Шлюза...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Проверить ответ через ИИ
              </>
            )}
          </button>
        )}

        {/* AI Result Scorecard */}
        {evalResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-6 rounded-2xl border border-pastel-border bg-pastel-bg/60 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {evalResult.isPassed ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                )}
                <span className="font-bold text-base text-pastel-text">
                  {evalResult.isPassed ? 'Отличный ответ!' : 'Требует повторения'}
                </span>
              </div>
              <span className="text-xl font-extrabold text-pastel-accentViolet">
                {evalResult.score}%
              </span>
            </div>

            <p className="text-sm text-pastel-text leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-pastel-border/60">
              {evalResult.feedback}
            </p>

            {evalResult.positivePoints?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                  ✓ Что отвечено правильно:
                </h4>
                <ul className="list-disc list-inside text-xs text-pastel-text space-y-1">
                  {evalResult.positivePoints.map((pt: string, idx: number) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {evalResult.missingPoints?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
                  ⚠ Упущенные детали и термины:
                </h4>
                <ul className="list-disc list-inside text-xs text-pastel-text space-y-1">
                  {evalResult.missingPoints.map((pt: string, idx: number) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action to proceed */}
            <div className="pt-2">
              <button
                onClick={handleNext}
                className="w-full py-3 rounded-xl bg-pastel-text text-white font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isLast ? 'Завершить проверку темы 🎉' : 'Следующий вопрос'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Voice Modal */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        currentQuestionText={currentQ.question}
      />
    </div>
  );
};
