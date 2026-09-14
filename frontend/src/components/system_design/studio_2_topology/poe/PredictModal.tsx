import React, { useState } from 'react';
import { Sparkles, HelpCircle, ArrowRight, X, AlertCircle } from 'lucide-react';
import { useBodyScrollLock } from '../../../../hooks/useBodyScrollLock';

export interface PredictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrediction: (hypothesisId: string) => void;
  scenarioTitle: string;
  targetRps: number;
}

export const PREDICT_HYPOTHESES = [
  {
    id: 'db_pool_starvation',
    title: 'Пул соединений БД HikariCP',
    description: 'Исчерпание соединений и context-switch thrashing при росте очереди ожидания.',
    targetType: 'database'
  },
  {
    id: 'gpu_kv_preemption',
    title: 'Память KV-кэша GPU (HBM)',
    description: 'Переполнение HBM видеопамяти, preemption генерации и деградация TPOT.',
    targetType: 'gpu'
  },
  {
    id: 'queue_consumer_lag',
    title: 'Буфер очереди сообщений',
    description: 'Остановка воркеров из-за ребалансировки и лавинообразный рост лага.',
    targetType: 'queue'
  },
  {
    id: 'gateway_syn_backlog',
    title: 'Ingress API Gateway',
    description: 'Переполнение syn-backlog сокетов и отбрасывание входящих TCP-соединений.',
    targetType: 'gateway'
  }
];

export const PredictModal: React.FC<PredictModalProps> = ({
  isOpen,
  onClose,
  onConfirmPrediction,
  scenarioTitle,
  targetRps
}) => {
  useBodyScrollLock(isOpen);
  const [selectedHypothesis, setSelectedHypothesis] = useState<string>(PREDICT_HYPOTHESES[0].id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                Шаг 1: Цикл Predict-Observe-Explain
              </div>
              <h3 className="text-sm font-bold text-white">Сформулируйте архитектурную гипотезу</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            В сценарии <strong className="text-purple-300">«{scenarioTitle}»</strong> подается пиковая нагрузка в{' '}
            <span className="font-mono text-emerald-400 font-bold">{targetRps.toLocaleString()} RPS</span>.
            Зафиксируйте прогноз: <em>какой компонент первым станет узким местом системы?</em>
          </p>

          <div className="flex flex-col gap-2.5">
            {PREDICT_HYPOTHESES.map((h) => {
              const isSelected = selectedHypothesis === h.id;
              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHypothesis(h.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-950/50 border-purple-500 shadow-md shadow-purple-950/50 ring-1 ring-purple-500/40'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-purple-200' : 'text-slate-200'}`}>
                      {h.title}
                    </span>
                    <input
                      type="radio"
                      name="hypothesis"
                      checked={isSelected}
                      onChange={() => setSelectedHypothesis(h.id)}
                      className="accent-purple-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    {h.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/80 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={() => onConfirmPrediction(selectedHypothesis)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition cursor-pointer"
          >
            <span>Зафиксировать прогноз и запустить</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
