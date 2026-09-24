import React from 'react';
import { TrendingDown, Clock, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { FsrsQueueItemDTO } from '../../types/fsrs';

interface FsrsQueueTabProps {
  forecastDays: number;
  setForecastDays: (days: number) => void;
  forecastPoint: { avgRetention: number; dueCount: number };
  fsrsQueue: FsrsQueueItemDTO[];
  onStartBlitzWithQuestions?: (questions: any[]) => void;
  onClose: () => void;
  handleQuickReview: (questionId: string, isPassed: boolean) => void;
  onSelectTopicForPractice?: (topic: string) => void;
}

export const FsrsQueueTab: React.FC<FsrsQueueTabProps> = ({
  forecastDays,
  setForecastDays,
  forecastPoint,
  fsrsQueue,
  onStartBlitzWithQuestions,
  onClose,
  handleQuickReview,
  onSelectTopicForPractice
}) => {
  return (
    <div className="space-y-4">
      {/* Interactive Retention Slider Forecast */}
      <div className="p-4.5 rounded-3xl bg-gradient-to-br from-white via-pastel-lavender/25 to-white border border-pastel-border/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-pastel-accentViolet" />
            <span className="font-extrabold text-xs text-pastel-text">
              Интерактивный прогноз кривой забывания (Эббингауз)
            </span>
          </div>
          <span className="text-xs font-bold text-pastel-accentViolet">
            {forecastDays === 0 ? 'Сегодня' : `Через ${forecastDays} дн.`} ➔ Удержание: {Math.round(forecastPoint.avgRetention * 100)}% ({forecastPoint.dueCount} дефицитов)
          </span>
        </div>

        {/* Slider Control */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pastel-accentViolet"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
            <span>Сегодня (0 дн)</span>
            <span>3 дня</span>
            <span>7 дней</span>
            <span>14 дней</span>
            <span>21 день</span>
            <span>30 дней</span>
          </div>
        </div>

        <p className="text-[11px] text-pastel-muted leading-relaxed">
          💡 При перемещении ползунка система в реальном времени пересчитывает вероятность удержания <strong className="text-pastel-text">R(t, S)</strong> для каждого вопроса. Если прекратить повторения, через 14 дней в красную зону упадет {forecastPoint.dueCount} тем.
        </p>
      </div>

      {/* Queue Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" />
            Вопросы к повторению сегодня (R &lt; 80% или наступил срок):
          </span>
          {fsrsQueue.length > 0 && onStartBlitzWithQuestions && (
            <button
              type="button"
              onClick={() => {
                onStartBlitzWithQuestions(fsrsQueue);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-extrabold hover:opacity-95 shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Повторить всё ({fsrsQueue.length})</span>
            </button>
          )}
        </div>

        {fsrsQueue.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-pastel-border/60 p-6 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-sm text-slate-800">Все карточки успешно закреплены!</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Алгоритм FSRS-5 следит за вашей памятью. Новые повторения появятся по мере естественного затухания.
            </p>
          </div>
        ) : (
          fsrsQueue.map((item) => (
            <div
              key={item.questionId}
              className="p-4 bg-white rounded-2xl border border-pastel-border/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:shadow-xs transition-shadow"
            >
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-pastel-card border border-pastel-border text-pastel-text">
                    {item.topic}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      item.retrievability < 0.6
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : item.retrievability < 0.8
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    R = {Math.round(item.retrievability * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    S: {item.stability}д • D: {item.difficulty}/10 • повторов: {item.reps}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 leading-snug">{item.question}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleQuickReview(item.questionId, true)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition cursor-pointer"
                  title="Отметить как помню (Good)"
                >
                  Помню ✓
                </button>

                {onSelectTopicForPractice && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTopicForPractice(item.topic);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold hover:opacity-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>Практика</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
