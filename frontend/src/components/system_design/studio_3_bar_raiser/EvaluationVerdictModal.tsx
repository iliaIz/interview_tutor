import React from 'react';
import { 
  Award, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, 
  ArrowRight, RotateCcw, X, BookOpen, Sparkles 
} from 'lucide-react';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { HiringCommitteePacket } from '../defense/HiringCommitteeVerdictModal';

export interface EvaluationVerdictModalProps {
  isOpen: boolean;
  packet: HiringCommitteePacket;
  scenarioTitle: string;
  onClose: () => void;
  onRetry?: () => void;
}

export const EvaluationVerdictModal: React.FC<EvaluationVerdictModalProps> = ({
  isOpen,
  packet,
  scenarioTitle,
  onClose,
  onRetry
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const isHire = ['STRONG_HIRE', 'HIRE', 'LEANING_HIRE'].includes(packet.hiring_recommendation);

  const getVerdictDetails = () => {
    switch (packet.hiring_recommendation) {
      case 'STRONG_HIRE':
        return { label: 'STRONG HIRE (L7 Principal)', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50', icon: CheckCircle2 };
      case 'HIRE':
        return { label: 'HIRE (Подтвержден L6 Staff)', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50', icon: CheckCircle2 };
      case 'LEANING_HIRE':
        return { label: 'LEANING HIRE (L5 Senior)', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/50', icon: CheckCircle2 };
      default:
        return { label: 'NO HIRE', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/50', icon: XCircle };
    }
  };

  const verdict = getVerdictDetails();
  const Icon = verdict.icon;

  const rubricRows = [
    { title: 'Scoping & Capacity (20%)', score: packet.scores.exploration },
    { title: 'Architecture & Flow (30%)', score: packet.scores.architecture },
    { title: 'Deep Dives & Chaos (30%)', score: packet.scores.deep_dives },
    { title: 'Operational TCO (20%)', score: packet.scores.operational_excellence }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                Официальный вердикт Bar-Raiser
              </div>
              <h3 className="text-sm font-bold text-white">{scenarioTitle}</h3>
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
          {/* Main Verdict Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${verdict.bg}`}>
            <div className="flex items-center gap-3">
              <Icon className="w-6 h-6 shrink-0" />
              <div>
                <div className="text-xs uppercase font-bold tracking-wider">Итоговая рекомендация</div>
                <div className="text-base font-extrabold">{verdict.label}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase opacity-75 font-semibold">Калиброванный уровень</div>
              <div className="text-base font-mono font-bold">{packet.calibrated_level}</div>
            </div>
          </div>

          {/* Rubric Breakdown */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-300">Оценки по 4 измерениям Bar-Raiser:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rubricRows.map((row) => (
                <div key={row.title} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-400">{row.title}</span>
                  <span className="font-mono text-xs font-bold text-purple-300">{row.score.toFixed(1)} / 4.0</span>
                </div>
              ))}
            </div>
          </div>

          {/* Justification Text */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="font-bold text-slate-300 block mb-1">Обоснование комитета (Justification):</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {packet.leveling_justification}
            </p>
          </div>

          {/* Recommended Katas */}
          <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-800/40 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2 text-purple-300 font-bold">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>Рекомендованные микро-каты для закрепления:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono">
                L3-PERF-HIKARICP-STARVATION
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono">
                L4-DIST-LOCK-FENCING
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono">
                L4-DIST-KAFKA-REBALANCE-LAG
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-t border-slate-800">
          {onRetry ? (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Пройти защиту повторно</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition cursor-pointer"
          >
            Принять и завершить
          </button>
        </div>
      </div>
    </div>
  );
};
