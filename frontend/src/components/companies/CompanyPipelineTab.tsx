import React from 'react';
import { CompanyPipelineStage } from '@interview-prep/shared';
import { 
  Mic, Code2, Bug, Database, Layers, ArrowRight, 
  CheckCircle2, Clock, Check, Sparkles, PackageCheck
} from 'lucide-react';
import { CompanyPreFlightBriefing } from './dossier/CompanyPreFlightBriefing';
import { AudioPlayoutManager } from '../../services/AudioPlayoutManager';

interface CompanyPipelineTabProps {
  stages: CompanyPipelineStage[];
  completedStageIds: Set<string>;
  onToggleStageComplete: (stageId: string) => void;
  onLaunchStageAction: (stage: CompanyPipelineStage) => void;
  companyReadinessIndex: number;
}

export const CompanyPipelineTab: React.FC<CompanyPipelineTabProps> = ({
  stages,
  completedStageIds,
  onToggleStageComplete,
  onLaunchStageAction,
  companyReadinessIndex
}) => {
  const getFormatIcon = (format: CompanyPipelineStage['format']) => {
    switch (format) {
      case 'voice_fit':
        return <Mic className="w-4 h-4 text-rose-600" />;
      case 'live_coding':
        return <Code2 className="w-4 h-4 text-indigo-600" />;
      case 'code_review':
        return <Bug className="w-4 h-4 text-amber-600" />;
      case 'sql_arena':
        return <Database className="w-4 h-4 text-emerald-600" />;
      case 'system_design':
        return <Layers className="w-4 h-4 text-purple-600" />;
      case 'take_home':
        return <PackageCheck className="w-4 h-4 text-teal-600" />;
    }
  };

  const getFormatBadge = (format: CompanyPipelineStage['format']) => {
    switch (format) {
      case 'voice_fit':
        return { label: '🎙️ Voice Fit / STAR', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'live_coding':
        return { label: '💻 Live Coding', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'code_review':
        return { label: '🐛 Code Review', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'sql_arena':
        return { label: '💾 PostgreSQL WASM', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'system_design':
        return { label: '🏛️ System Design', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'take_home':
        return { label: '🧦 Take-Home Lab', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Company Readiness Scorecard Banner */}
      <div className="p-5 rounded-3xl bg-white border border-pastel-border/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" /> Company Readiness Index (CRI)
            </span>
            <span className="text-xs text-pastel-muted font-mono">
              Пройдено: {completedStageIds.size} из {stages.length} этапов
            </span>
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">
            Готовность к техническому интервью в банк
          </h3>
          <p className="text-xs text-pastel-muted">
            Взвешенная оценка по всем 5 этапам отбора на роль Product Engineer
          </p>
        </div>

        {/* Circular / Pill Score Meter */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-pastel-border/70 self-start md:self-auto">
          <div className="text-right">
            <span className="block text-2xl font-black text-slate-900 font-mono">
              {companyReadinessIndex}%
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">
              {companyReadinessIndex >= 80 ? 'Senior Hire Bar' : companyReadinessIndex >= 50 ? 'In Training' : 'Baseline'}
            </span>
          </div>
          <div className="w-16 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${companyReadinessIndex}%` }}
            />
          </div>
        </div>
      </div>

      {/* 5-Stage Interactive Pipeline Cards */}
      <div className="space-y-3">
        {stages.map((stage) => {
          const isDone = completedStageIds.has(stage.id);
          const badge = getFormatBadge(stage.format);

          return (
            <div
              key={stage.id}
              className={`p-4 sm:p-5 rounded-3xl border transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isDone
                  ? 'bg-emerald-50/30 border-emerald-200/80'
                  : 'bg-white hover:border-indigo-200/80 border-pastel-border/80'
              }`}
            >
              {/* Stage Info */}
              <div className="flex items-start gap-3.5 max-w-2xl">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isDone ? <Check className="w-5 h-5 text-emerald-700 font-bold" /> : getFormatIcon(stage.format)}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] font-mono text-pastel-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" /> ~{stage.estimatedMinutes} мин
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">
                      Вес в CRI: {Math.round(stage.weight * 100)}%
                    </span>
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {stage.title}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {stage.description}
                  </p>
                  {stage.format === 'voice_fit' && (
                    <CompanyPreFlightBriefing />
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => onToggleStageComplete(stage.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                    isDone
                      ? 'bg-emerald-100/70 border-emerald-300 text-emerald-800 hover:bg-emerald-200/60'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  title={isDone ? 'Отметить как не пройденный' : 'Отметить этап как сданный'}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isDone ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span>{isDone ? 'Сдано' : 'Зачесть'}</span>
                </button>

                <button
                  onClick={() => {
                    AudioPlayoutManager.warmup();
                    onLaunchStageAction(stage);
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-indigo-600 transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                >
                  <span>Начать этап</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
