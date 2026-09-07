import React from 'react';
import { Question } from '../../store/useAppStore';
import { 
  Brain, Mic, Send, Loader2, CheckCircle2, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { motion } from 'framer-motion';

interface QuizQuestionCardProps {
  currentQ: Question;
  currentIndex: number;
  totalQuestions: number;
  userAnswer: string;
  setUserAnswer: (ans: string) => void;
  loadingEval: boolean;
  isAiReady: boolean;
  evalResult: any;
  onEvaluate: () => void;
  onOpenVoice: () => void;
  onNext: () => void;
  isLast: boolean;
}

export const QuizQuestionCard: React.FC<QuizQuestionCardProps> = ({
  currentQ,
  currentIndex,
  totalQuestions,
  userAnswer,
  setUserAnswer,
  loadingEval,
  isAiReady,
  evalResult,
  onEvaluate,
  onOpenVoice,
  onNext,
  isLast
}) => {
  return (
    <motion.div
      key={currentQ.id}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 md:p-8 border border-pastel-border shadow-sm mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-pastel-accentViolet flex items-center gap-1.5">
          <Brain className="w-4 h-4" /> Вопрос {currentIndex + 1} из {totalQuestions}
        </span>
        <span className="text-[11px] font-bold px-2 py-0.5 bg-pastel-lavender/60 text-pastel-accentViolet rounded-md">
          #{currentQ.num}
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
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              if (userAnswer.trim() && !loadingEval && isAiReady) {
                onEvaluate();
              }
            }
          }}
          disabled={loadingEval || !!evalResult}
          rows={5}
          placeholder="Напишите всё, что вы помните по этой теме... (Ctrl+Enter для быстрой отправки)"
          className="w-full p-4 rounded-2xl border border-pastel-border bg-pastel-bg/50 focus:bg-white focus:ring-2 focus:ring-pastel-accentViolet/30 focus:border-pastel-accentViolet outline-none text-sm transition resize-none"
        />
      </div>

      {/* Quick Voice / Tutor Action Bar */}
      {!evalResult && (
        <div className="mb-4 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={onOpenVoice}
            className="px-3 py-1.5 rounded-xl bg-pastel-lavender/60 hover:bg-pastel-lavender border border-pastel-accentViolet/20 text-pastel-accentViolet font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Mic className="w-3.5 h-3.5 text-pastel-accentViolet" />
            <span>🎙️ Ответить устно / Пройти собеседование</span>
          </button>

          <div className="flex items-center gap-2 text-[11px] text-pastel-muted font-mono">
            <span className="hidden sm:inline">
              <kbd className="px-1.5 py-0.5 rounded bg-pastel-bg border border-pastel-border text-[10px] text-pastel-text">Ctrl+Enter</kbd>
            </span>
            <span>{userAnswer.length} символов</span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {!evalResult && (
        <button
          onClick={onEvaluate}
          disabled={loadingEval || !userAnswer.trim() || !isAiReady}
          className={`w-full py-3.5 rounded-2xl text-white text-sm font-bold shadow-md transition flex items-center justify-center gap-2 ${
            !isAiReady
              ? 'opacity-60 cursor-not-allowed bg-gray-400'
              : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 disabled:opacity-50 cursor-pointer'
          }`}
          title={!isAiReady ? "Инициализация AI Шлюза..." : "Проверить ответ"}
        >
          {loadingEval ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Gemini анализирует ответ...
            </>
          ) : !isAiReady ? (
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
              onClick={onNext}
              className="w-full py-3 rounded-xl bg-pastel-text text-white font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isLast ? 'Завершить проверку и посмотреть итоги 🎉' : 'Следующий вопрос'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
