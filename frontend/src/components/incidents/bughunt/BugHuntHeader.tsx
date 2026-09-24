import React from 'react';
import { ArrowLeft, Target, Flame, Sparkles, Trophy, Activity } from 'lucide-react';

export type WorkoutPreset = 'exhaustive' | 'senior_multi' | 'random';

export const PRESETS: { id: WorkoutPreset; name: string; icon: React.ComponentType<any>; badge: string; desc: string }[] = [
  {
    id: 'exhaustive',
    name: 'Полный охват',
    icon: Target,
    badge: '🎯 100% темы',
    desc: 'Методично перебирает все подтемы без повторов до полного закрытия темы'
  },
  {
    id: 'senior_multi',
    name: 'Senior Review',
    icon: Flame,
    badge: '🔥 2 бага',
    desc: 'Хардкорный режим: 2 скрытых дефекта в одном продакшен-классе'
  },
  {
    id: 'random',
    name: 'Разминка',
    icon: Sparkles,
    badge: '🎲 Рандом',
    desc: 'Бесконечный свободный поток задач для быстрой практики'
  }
];

interface BugHuntHeaderProps {
  academyBreadcrumbContext?: any;
  returnToAcademyStep: () => void;
  closeTopicBugHunt: () => void;
  topicName: string;
  difficultyBadge?: string;
  activePreset: WorkoutPreset;
  onSelectPreset: (preset: WorkoutPreset) => void;
  sessionSolvedCount: number;
  onOpenRadar: () => void;
}

export const BugHuntHeader: React.FC<BugHuntHeaderProps> = ({
  academyBreadcrumbContext,
  returnToAcademyStep,
  closeTopicBugHunt,
  topicName,
  difficultyBadge,
  activePreset,
  onSelectPreset,
  sessionSolvedCount,
  onOpenRadar
}) => {
  return (
    <div className="h-14 border-b border-pastel-border/80 bg-white/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 shadow-2xs z-10">
      {/* Left: Back Buttons & Topic Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {academyBreadcrumbContext ? (
          <button
            onClick={returnToAcademyStep}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-rose/80 hover:bg-pastel-rose text-pastel-accentRose text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">← Назад в Академию: Шаг #{academyBreadcrumbContext.stepNumber}</span>
            <span className="sm:hidden">← Шаг #{academyBreadcrumbContext.stepNumber}</span>
          </button>
        ) : (
          <button
            onClick={closeTopicBugHunt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-bg hover:bg-pastel-rose/40 text-pastel-text text-xs font-bold transition border border-pastel-border shadow-2xs cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">← В каталог инцидентов (70)</span>
            <span className="sm:hidden">← Каталог</span>
          </button>
        )}

        <div className="h-4 w-px bg-pastel-border shrink-0 hidden md:block" />

        <div className="flex items-center gap-2 truncate">
          <span className="text-xs font-bold text-pastel-text truncate">{topicName}</span>
          <span className="hidden lg:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {difficultyBadge || 'Senior'}
          </span>
        </div>
      </div>

      {/* Right: Presets & Live Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Preset selector pills */}
        <div className="hidden md:flex items-center gap-1 bg-pastel-bg p-1 rounded-xl border border-pastel-border">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPreset(p.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isSelected ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                }`}
                title={p.desc}
              >
                <Icon className="w-3 h-3" />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Solved Counter */}
        {sessionSolvedCount > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
            <Trophy className="w-3.5 h-3.5" />
            <span>{sessionSolvedCount} решено</span>
          </div>
        )}

        {/* Memory Radar Trigger */}
        <button
          onClick={onOpenRadar}
          className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-pastel-bg hover:bg-white text-pastel-accentViolet border border-pastel-border text-xs font-bold shadow-2xs transition cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Радар</span>
        </button>
      </div>
    </div>
  );
};
