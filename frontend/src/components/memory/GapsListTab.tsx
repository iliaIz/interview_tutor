import React from 'react';
import { CheckCircle2, Shield, ShieldCheck, RefreshCw, ArrowRight } from 'lucide-react';
import { CandidateGapDTO } from '../../services/memoryApi';

interface GapsListTabProps {
  activeTab: 'active' | 'verifying' | 'mastered';
  activeDeficits: CandidateGapDTO[];
  verifyingGaps: CandidateGapDTO[];
  masteredGaps: CandidateGapDTO[];
  onSelectTopicForPractice?: (topic: string) => void;
  onClose: () => void;
  handleResetGap: (gapId: string) => void;
}

export const GapsListTab: React.FC<GapsListTabProps> = ({
  activeTab,
  activeDeficits,
  verifyingGaps,
  masteredGaps,
  onSelectTopicForPractice,
  onClose,
  handleResetGap
}) => {
  if (activeTab === 'active') {
    return (
      <div className="space-y-3">
        {activeDeficits.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-slate-700">Нет активных дефицитов</p>
            <p className="text-xs text-slate-400 mt-1">Все выявленные пробелы закрыты.</p>
          </div>
        ) : (
          activeDeficits.map((gap) => (
            <div
              key={gap.id}
              className="p-4 bg-white rounded-2xl border border-rose-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    {gap.topic}
                  </span>
                  <span className="text-[11px] text-slate-400">Дефицит: {gap.deficitWeight.toFixed(1)}</span>
                </div>
                <p className="text-xs font-medium text-slate-800">«{gap.errorConcept}»</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                {onSelectTopicForPractice && (
                  <button
                    onClick={() => {
                      onSelectTopicForPractice(gap.topic);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-pastel-rose text-rose-800 text-xs font-semibold hover:bg-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Потренировать</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (activeTab === 'verifying') {
    return (
      <div className="space-y-3">
        {verifyingGaps.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-slate-700">Нет тем на калибровке</p>
          </div>
        ) : (
          verifyingGaps.map((gap) => (
            <div
              key={gap.id}
              className="p-4 bg-white rounded-2xl border border-amber-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    {gap.topic}
                  </span>
                  <span className="text-[11px] text-slate-400">Остаточный дефицит: {gap.deficitWeight.toFixed(1)}</span>
                </div>
                <p className="text-xs font-medium text-slate-800">«{gap.errorConcept}»</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Остался 1 уверенный самостоятельный ответ для статуса «Освоено».
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {masteredGaps.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Shield className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-80" />
          <p className="text-sm font-semibold text-slate-700">Освоенные концепты появятся здесь</p>
          <p className="text-xs text-slate-400 mt-1">
            Отвечайте на вопросы самостоятельно без хинтов для снятия уязвимостей.
          </p>
        </div>
      ) : (
        masteredGaps.map((gap) => (
          <div
            key={gap.id}
            className="p-4 bg-white rounded-2xl border border-purple-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  {gap.topic}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold">Уязвимость закрыта (0.0)</span>
              </div>
              <p className="text-xs font-medium text-slate-800">«{gap.errorConcept}»</p>
            </div>
            <button
              onClick={() => handleResetGap(gap.id)}
              className="px-3 py-1.5 rounded-xl border border-pastel-border text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
              title="Вернуть концепт на активный контроль для повторной тренировки"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Сбросить для проверки</span>
            </button>
          </div>
        ))
      )}
    </div>
  );
};
