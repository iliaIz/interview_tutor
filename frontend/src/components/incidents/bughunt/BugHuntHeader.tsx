import React from 'react';
import { ArrowLeft, Target, Flame, Sparkles, Trophy, Activity } from 'lucide-react';
import { ArenaSwitcherMenu } from '../../practice/arena/ArenaSwitcherMenu';

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
  dockHeaderSlot?: React.ReactNode;
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
  onOpenRadar,
  dockHeaderSlot
}) => {
  return (
    <header className="h-12 border-b border-pastel-border/80 bg-white/95 backdrop-blur-md px-2.5 sm:px-4 flex items-center justify-between gap-2 shrink-0 shadow-2xs z-20">
      {/* Cluster 1: Back Navigation, Cross-Arena Switcher & Topic Title */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        {academyBreadcrumbContext ? (
          <button
            type="button"
            onClick={returnToAcademyStep}
            className="touch-target-44 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-pastel-rose text-pastel-accentRoseText hover:bg-[#B5433E] hover:text-white border border-pastel-accentRose/40 text-xs font-bold transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Академия: Шаг #{academyBreadcrumbContext.stepNumber}</span>
            <span className="sm:hidden">Шаг #{academyBreadcrumbContext.stepNumber}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={closeTopicBugHunt}
            aria-label="Вернуться в каталог инцидентов"
            className="touch-target-44 flex items-center gap-1 px-2 py-1 rounded-xl text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg text-xs font-bold transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Каталог (70)</span>
          </button>
        )}

        <ArenaSwitcherMenu
          onBeforeNavigate={(id) => {
            if (id === 'incidents') {
              closeTopicBugHunt();
              return true;
            }
            return false;
          }}
        />

        <div className="h-4 w-px bg-pastel-border shrink-0 hidden sm:block" />

        <div className="flex items-center gap-1.5 min-w-0">
          <h1 className="font-bold text-xs sm:text-sm text-pastel-text truncate max-w-[120px] sm:max-w-[240px] lg:max-w-sm">
            {topicName}
          </h1>
          <span className="hidden xl:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30 shrink-0">
            {difficultyBadge || 'Senior'}
          </span>
        </div>
      </div>

      {/* Cluster 2: Presets, Solved Counter, Radar & Co-Pilot Slot */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="hidden md:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-pastel-border">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  isSelected ? 'bg-white text-pastel-text shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={p.desc}
              >
                <Icon className="w-3 h-3" />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {sessionSolvedCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs shrink-0">
            <Trophy className="w-3.5 h-3.5" />
            <span>{sessionSolvedCount}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenRadar}
          className="touch-target-44 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-white hover:bg-pastel-bg text-pastel-accentViolet border border-pastel-border text-xs font-bold shadow-2xs transition cursor-pointer shrink-0"
          title="Открыть радар слабых тем"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Радар</span>
        </button>

        {dockHeaderSlot}
      </div>
    </header>
  );
};
