import React, { useState } from 'react';
import { 
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight, 
  X, MessageSquare, Send, ShieldCheck, ShieldAlert 
} from 'lucide-react';
import { useBodyScrollLock } from '../../../../hooks/useBodyScrollLock';
import { PREDICT_HYPOTHESES } from './PredictModal';
import type { SimulationResponseMessage } from '../../../../workers/des/types/workerMessages';

export interface SocraticExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  userHypothesisId: string | null;
  result: SimulationResponseMessage;
  scenarioTitle: string;
  onProceedToDefense?: () => void;
}

export const SocraticExplainModal: React.FC<SocraticExplainModalProps> = ({
  isOpen,
  onClose,
  userHypothesisId,
  result,
  scenarioTitle,
  onProceedToDefense
}) => {
  useBodyScrollLock(isOpen);
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  if (!isOpen) return null;

  const userHypothesis = PREDICT_HYPOTHESES.find(h => h.id === userHypothesisId);
  const summary = result.summary;
  const bottleneckNodeId = summary.bottleneck_node_id;
  const bottleneckTelemetry = bottleneckNodeId ? result.node_telemetry[bottleneckNodeId] : null;

  // Determine if user's prediction was accurate
  const isMatch = userHypothesis && bottleneckTelemetry && (
    (userHypothesis.targetType === 'database' && bottleneckTelemetry.hikari_pool_exhausted) ||
    (userHypothesis.targetType === 'gpu' && (bottleneckTelemetry.preempted_requests_count ?? 0) > 0) ||
    (userHypothesis.targetType === 'queue' && bottleneckTelemetry.queue_depth_p99 > 100) ||
    (userHypothesis.targetType === 'gateway' && bottleneckTelemetry.is_saturated)
  );

  const handleSendReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionAnswer.trim()) return;
    setFeedbackGiven(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                Шаг 3: Сократический разбор (Explain)
              </div>
              <h3 className="text-sm font-bold text-white">Сопоставление прогноза с реальностью симулятора</h3>
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
        <div className="p-6 overflow-y-auto flex flex-col gap-4">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* User Hypothesis */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                Ваш прогноз до симуляции
              </div>
              <div className="text-xs font-bold text-purple-300">
                {userHypothesis?.title || 'Не зафиксирован'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                {userHypothesis?.description}
              </p>
            </div>

            {/* Actual Result */}
            <div className={`p-4 rounded-2xl border ${
              isMatch
                ? 'bg-emerald-950/30 border-emerald-700/50'
                : 'bg-amber-950/30 border-amber-700/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Фактический Bottleneck
                </span>
                {isMatch ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Прогноз совпал
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Расхождение
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-white">
                Узел: <span className="font-mono text-purple-300">{bottleneckNodeId || 'Все узлы в пределах SLA'}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                {bottleneckTelemetry
                  ? `Утилизация ${Math.round(bottleneckTelemetry.utilization_percent)}%, P99: ${bottleneckTelemetry.latency_p99_ms.toFixed(1)} ms, очередь: ${Math.round(bottleneckTelemetry.queue_depth_p99)} req`
                  : 'Система выдержала нагрузку без деградации.'}
              </p>
            </div>
          </div>

          {/* Socratic Question Prompt */}
          <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-800/40 text-xs">
            <div className="flex items-center gap-2 font-bold text-purple-300 mb-1.5">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>Вопрос от AI Bar-Raiser:</span>
            </div>
            <p className="text-purple-100/90 leading-relaxed text-[11px]">
              {isMatch
                ? `Вы точно определили, что узким местом станет «${userHypothesis?.title}». Какое архитектурное решение (кэширование, партиционирование, асинхронный outbox) устранит эту деградацию с наименьшим TCO?`
                : `Вы прогнозировали отказ в «${userHypothesis?.title}», однако симулятор зафиксировал деградацию на узле «${bottleneckNodeId}» из-за лавинообразного роста очереди ($P99 = ${bottleneckTelemetry?.latency_p99_ms.toFixed(1)} ms). Почему первичное насыщение произошло именно здесь?`}
            </p>
          </div>

          {/* Reflection Input Form */}
          {!feedbackGiven ? (
            <form onSubmit={handleSendReflection} className="flex flex-col gap-2">
              <textarea
                value={reflectionAnswer}
                onChange={(e) => setReflectionAnswer(e.target.value)}
                placeholder="Сформулируйте ваше инженерное обоснование..."
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500 transition resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!reflectionAnswer.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
                >
                  <span>Отправить обоснование</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-700/50 text-emerald-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Обоснование зафиксировано в журнале подготовки к устной защите!</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
          >
            Закрыть
          </button>

          {onProceedToDefense && (
            <button
              onClick={onProceedToDefense}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/30 transition cursor-pointer"
            >
              <span>Перейти к устной защите (Студия 3)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
