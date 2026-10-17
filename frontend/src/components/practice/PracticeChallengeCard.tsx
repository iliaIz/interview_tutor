import React from 'react';
import { CodingChallenge } from '../../types/practice';
import { getDifficultyColor } from './PracticeCatalogConstants';
import { CheckCircle2, Clock, ArrowRight } from 'lucide-react';

interface Props {
  challenge: CodingChallenge;
  isSelected: boolean;
  onSelect: () => void;
}

export const PracticeChallengeCard: React.FC<Props> = ({
  challenge: ch,
  isSelected,
  onSelect
}) => {
  const isCompleted = ch.status === 'COMPLETED';
  const isInProgress = ch.status === 'IN_PROGRESS' || ch.status === 'FAILED';

  const statusRailClass = isCompleted
    ? 'border-l-4 border-l-emerald-500 bg-emerald-50/20'
    : isInProgress
    ? 'border-l-4 border-l-amber-400 bg-amber-50/20'
    : 'border-l-4 border-l-transparent';

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative select-none ${statusRailClass} ${
        isSelected
          ? 'bg-white border-pastel-accentRose shadow-sm ring-2 ring-pastel-accentRose/30'
          : 'bg-white/80 hover:bg-white border-pastel-border/80 hover:border-pastel-accentRose/40 shadow-2xs'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs shrink-0">
              {ch.taskCode || ch.id}
            </kbd>

            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${getDifficultyColor(ch.difficulty)}`}>
              {ch.difficulty}
            </span>

            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-pastel-bg text-pastel-muted border border-pastel-border truncate max-w-[140px]">
              {ch.badge}
            </span>
          </div>

          {isCompleted ? (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{ch.lastScore || 100}б</span>
            </span>
          ) : isInProgress ? (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
              <span>В процессе</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono text-pastel-muted flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3 text-pastel-accentViolet" />
              <span>{ch.timeLimitMinutes}м</span>
            </span>
          )}
        </div>

        <h3 className={`font-bold text-xs sm:text-sm transition-colors ${isSelected ? 'text-pastel-accentRose' : 'text-pastel-text'}`}>
          {ch.title}
        </h3>

        <p className="text-xs text-pastel-muted line-clamp-2 mt-1 leading-snug">
          {ch.shortDescription}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-pastel-border/50 text-[11px]">
        <span className="text-pastel-muted font-mono text-[10px] truncate max-w-[200px]">
          🛠️ {ch.targetStack}
        </span>
        <span className="font-bold text-pastel-accentRose flex items-center gap-0.5 text-[10px]">
          <span>Обзор</span>
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};
