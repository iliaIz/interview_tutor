import React from 'react';
import { 
  Award, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, 
  Cpu, Database, Layers, ArrowRight, RotateCcw, X 
} from 'lucide-react';

export interface HiringCommitteePacket {
  candidate_id: string;
  interview_timestamp: string;
  target_level: 'L5' | 'L6' | 'L7' | string;
  calibrated_level: 'L4' | 'L5' | 'L6' | 'L7' | string;
  hiring_recommendation: 'STRONG_HIRE' | 'HIRE' | 'LEANING_HIRE' | 'LEANING_NO_HIRE' | 'STRONG_NO_HIRE' | 'NO_HIRE';
  scores: {
    exploration: number;
    architecture: number;
    deep_dives: number;
    operational_excellence: number;
  };
  leveling_justification: string;
}

interface HiringCommitteeVerdictModalProps {
  packet: HiringCommitteePacket;
  scenarioTitle: string;
  observations?: Array<{ dimension?: string; signal?: string; demonstrated_level?: string; evidence_transcript?: string }>;
  onClose: () => void;
  onRetry?: () => void;
}

export const HiringCommitteeVerdictModal: React.FC<HiringCommitteeVerdictModalProps> = ({
  packet,
  scenarioTitle,
  observations = [],
  onClose,
  onRetry
}) => {
  const isHire = ['STRONG_HIRE', 'HIRE', 'LEANING_HIRE'].includes(packet.hiring_recommendation);

  const getVerdictBadge = () => {
    switch (packet.hiring_recommendation) {
      case 'STRONG_HIRE':
        return { label: 'STRONG HIRE (L7 Principal)', bg: 'bg-emerald-500 text-white', icon: CheckCircle2 };
      case 'HIRE':
        return { label: 'HIRE (Подтвержден L6 Staff)', bg: 'bg-emerald-600 text-white', icon: CheckCircle2 };
      case 'LEANING_HIRE':
        return { label: 'LEANING HIRE (L5 Senior)', bg: 'bg-blue-600 text-white', icon: CheckCircle2 };
      case 'LEANING_NO_HIRE':
        return { label: 'LEANING NO HIRE', bg: 'bg-amber-500 text-white', icon: AlertTriangle };
      case 'STRONG_NO_HIRE':
      case 'NO_HIRE':
      default:
        return { label: 'NO HIRE', bg: 'bg-rose-500 text-white', icon: XCircle };
    }
  };

  const badge = getVerdictBadge();
  const Icon = badge.icon;

  const rubricDimensions = [
    {
      key: 'exploration',
      title: 'Problem Exploration & Scoping (20%)',
      score: packet.scores.exploration,
      minL5: 3.0,
      minL6: 3.5,
      minL7: 3.8,
      desc: 'Математический расчет QPS, IOPS, полосы пропускания и формулирование SLA'
    },
    {
      key: 'architecture',
      title: 'System Architecture & Data Flow (30%)',
      score: packet.scores.architecture,
      minL5: 3.0,
      minL6: 3.5,
      minL7: 3.8,
      desc: 'Сквозной путь данных, изоляция плоскости управления, выбор сетевых протоколов'
    },
    {
      key: 'deep_dives',
      title: 'Deep Dives & Edge Cases (30%)',
      score: packet.scores.deep_dives,
      minL5: 2.8,
      minL6: 3.4,
      minL7: 3.8,
      desc: 'LSM vs B+Tree, WAF/RAF, compaction stalls, консистентное хэширование, кворумы'
    },
    {
      key: 'operational_excellence',
      title: 'Operational Excellence & Conway (20%)',
      score: packet.scores.operational_excellence,
      minL5: 2.6,
      minL6: 3.2,
      minL7: 3.7,
      desc: 'Отказоустойчивость, FinOps / TCO, Graceful Degradation, закон Конвея'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto animate-fade-in font-sans">
      <div className="bg-white/95 dark:bg-slate-900/95 border border-pastel-accentRose/40 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[92dvh] overflow-y-auto space-y-6 shadow-2xl relative my-auto">
        
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 border-b border-pastel-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pastel-accentViolet text-white flex items-center justify-center shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                  Официальный протокол Комитета по найму (Hiring Committee)
                </span>
                <span className="text-[10px] font-mono text-pastel-muted">
                  SOTA BigTech Rubric 2026
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-pastel-text dark:text-white">
                Защита архитектуры: {scenarioTitle}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verdict & Calibrated Level Card */}
        <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isHire 
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' 
            : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${badge.bg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">
                Итоговый вердикт калибровки:
              </span>
              <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                {badge.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs">
            <span className="text-slate-500">Целевой: <strong className="text-slate-800 dark:text-slate-200">{packet.target_level}</strong></span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-purple-600 font-bold">Калиброван: {packet.calibrated_level}</span>
          </div>
        </div>

        {/* 4-Dimension Rubric Grid */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-pastel-accentViolet" />
            <span>Оценки по 4 каноническим измерениям BigTech (Шкала 1.0 - 4.0):</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
            {rubricDimensions.map((dim) => {
              const passL5 = dim.score >= dim.minL5;
              const passL6 = dim.score >= dim.minL6;
              const passL7 = dim.score >= dim.minL7;

              return (
                <div key={dim.key} className="bg-pastel-bg/80 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-pastel-border/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">
                      {dim.title}
                    </span>
                    <span className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-md ${
                      passL6 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : passL5
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {dim.score.toFixed(1)} / 4.0
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {dim.desc}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-slate-400">
                    <span>Пороги: L5 ≥ {dim.minL5} {passL5 ? '✓' : '✗'}</span>
                    <span>•</span>
                    <span>L6 ≥ {dim.minL6} {passL6 ? '✓' : '✗'}</span>
                    <span>•</span>
                    <span>L7 ≥ {dim.minL7} {passL7 ? '✓' : '✗'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leveling Justification from Bar-Raiser */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block font-mono">
            Официальное заключение Bar-Raiser (Leveling Justification):
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
            {packet.leveling_justification}
          </p>
        </div>

        {/* Observations Logged During Defense */}
        {observations.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Зафиксированные сигналы в ходе защиты ({observations.length}):
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {observations.map((obs, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                    obs.signal === 'STRONG_POSITIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : obs.signal === 'POSITIVE'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {obs.demonstrated_level || 'SIGNAL'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 leading-snug">
                    <strong className="text-slate-900 dark:text-white font-mono">{obs.dimension}:</strong> {obs.evidence_transcript}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Попробовать заново</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pastel-accentViolet text-white text-xs font-bold transition cursor-pointer shadow-md ml-auto"
          >
            Закрыть протокол
          </button>
        </div>

      </div>
    </div>
  );
};
