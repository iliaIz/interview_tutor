import React from 'react';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { 
  Award, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Ban, 
  BarChart3, 
  Sparkles 
} from 'lucide-react';

interface HrScorecardModalProps {
  onRetry?: () => void;
}

export const HrScorecardModal: React.FC<HrScorecardModalProps> = ({ onRetry }) => {
  const isScorecardOpen = useHrSimulatorStore((state) => state.isScorecardOpen);
  const latestScorecard = useHrSimulatorStore((state) => state.latestScorecard);
  const closeScorecard = useHrSimulatorStore((state) => state.closeScorecard);
  const resetForRetry = useHrSimulatorStore((state) => state.resetForRetry);

  if (!isScorecardOpen || !latestScorecard) {
    return null;
  }

  const {
    overallScore,
    passed,
    metrics,
    anchorsHit,
    anchorsMissed,
    fillerWordsSpotted,
    actionableCritique
  } = latestScorecard;

  const handleRetryClick = () => {
    resetForRetry();
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-[#FFF0F5] to-white">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Результаты HR-скрининга
              </h2>
              <p className="text-xs text-slate-500">
                4-осевая объективная анти-сикофантская оценка
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {overallScore} / 100 баллов • {passed ? 'ПРОЙДЕНО' : 'НЕ СДАНО'}
            </div>
            <button
              onClick={closeScorecard}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* 4-Axis Breakdown */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-pastel-accentRose" />
              Метрики оценки (Вес 30 / 25 / 25 / 20)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <AxisScoreBar label="Факты и цифры (30%)" score={metrics.substanceMatch} />
              <AxisScoreBar label="Лексическая плотность (25%)" score={metrics.lexicalDensity} />
              <AxisScoreBar label="Тайминг SLA 60–80с (25%)" score={metrics.pacingScore} />
              <AxisScoreBar label="Уверенность и подача (20%)" score={metrics.deliveryConfidence} />
            </div>
          </div>

          {/* Actionable Critique */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
              Вердикт и рекомендации
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              {actionableCritique}
            </p>
          </div>

          {/* Highlights & Missing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
              <div className="font-bold text-emerald-800 mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Успешно озвучено
              </div>
              {anchorsHit.length > 0 ? (
                <ul className="space-y-1 text-emerald-900">
                  {anchorsHit.map((h: string, i: number) => (
                    <li key={i} className="truncate">• {h}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-400 italic">Нет совпадений</div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/60">
              <div className="font-bold text-rose-800 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Пропущено или не раскрыто
              </div>
              {anchorsMissed.length > 0 ? (
                <ul className="space-y-1 text-rose-900">
                  {anchorsMissed.map((m: string, i: number) => (
                    <li key={i} className="truncate">• {m}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-emerald-700">Все ключевые якоря раскрыты!</div>
              )}
            </div>
          </div>

          {/* Filler Words */}
          {fillerWordsSpotted.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
              <div className="font-bold text-amber-800 mb-1 flex items-center gap-1">
                <Ban className="w-3.5 h-3.5 text-amber-600" /> Выявлены слова-паразиты
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {fillerWordsSpotted.map((p: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-white text-amber-800 font-medium border border-amber-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={closeScorecard}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
          >
            Закрыть
          </button>
          <button
            onClick={handleRetryClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-pastel-accentRose hover:opacity-90 shadow-sm transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Тренировать снова</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const AxisScoreBar: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const isHigh = score >= 80;
  const isMid = score >= 60 && score < 80;

  return (
    <div className="p-2 rounded-lg bg-white border border-slate-200">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-medium text-slate-600 truncate">{label}</span>
        <span className="font-mono font-bold text-slate-800">{score}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isHigh ? 'bg-emerald-500' : isMid ? 'bg-amber-500' : 'bg-rose-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
};
