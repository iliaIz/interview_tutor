import React from 'react';
import { CheckCircle2, AlertTriangle, Volume2, Sparkles } from 'lucide-react';
import { ScenarioEvaluationResult, TransactionScenario } from '../../types/transactionLab';

interface TransactionVerdictCardProps {
  evalResult: ScenarioEvaluationResult;
  scenario: TransactionScenario;
  onStartVoiceDefense?: (scenario: TransactionScenario, question: string) => void;
}

export const TransactionVerdictCard: React.FC<TransactionVerdictCardProps> = ({
  evalResult,
  scenario,
  onStartVoiceDefense
}) => {
  return (
    <div
      className={`p-5 rounded-2xl border shadow-md space-y-3 transition-all animate-fadeIn ${
        evalResult.isPassed
          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
          : 'bg-rose-50/90 border-rose-300 text-rose-950'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {evalResult.isPassed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <h4 className="font-extrabold text-sm">
            {evalResult.isPassed
              ? `Архитектурный тест пройден! (Оценка: ${evalResult.overallScore}/100)`
              : `Обнаружены архитектурные дефекты (Оценка: ${evalResult.overallScore}/100)`}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-white/80 border">
            {evalResult.isPassed ? 'READY FOR PRODUCTION' : 'NEEDS REVISION'}
          </span>

          {onStartVoiceDefense && (
            <button
              type="button"
              onClick={() => onStartVoiceDefense(scenario, scenario.probingQuestions?.[0]?.question || '')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pastel-rose text-pastel-accentRoseText text-xs font-bold border border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white transition cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Защитить у AI</span>
            </button>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed font-medium">{evalResult.summary}</p>

      {/* Per-Method Violations List */}
      <div className="space-y-2 pt-2 border-t border-black/10">
        {Object.values(evalResult.methodResults).map((mRes) => {
          if (mRes.violations.length === 0) return null;
          return (
            <div key={mRes.methodId} className="p-2.5 rounded-xl bg-white/80 border text-xs space-y-1">
              <div className="font-bold text-slate-800 font-mono">Метод: {mRes.methodId}</div>
              <ul className="list-disc list-inside space-y-0.5 text-rose-800">
                {mRes.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
              {mRes.tips.length > 0 && (
                <p className="text-[11px] text-slate-600 pt-1 italic">
                  💡 Совет: {mRes.tips[0]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
