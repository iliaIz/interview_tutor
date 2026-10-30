import React from 'react';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  TrendingUp, 
  Cpu, 
  Scale, 
  CircleDollarSign,
  Heart,
  Tag
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  metrics: TrendingUp,
  architecture: Cpu,
  legal: Scale,
  compensation: CircleDollarSign,
  motivation: Heart
};

export const HrAnchorCardsGrid: React.FC = () => {
  const activeAnchors = useHrSimulatorStore((state) => state.anchorCards);

  if (!activeAnchors || activeAnchors.length === 0) {
    return (
      <div className="w-full text-center py-3 text-xs text-slate-400 italic">
        Опорные смысловые якоря не заданы для текущего вопроса
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-pastel-accentRose" />
          Смысловые якоря ответа (KWS HUD)
        </span>
        <span className="text-[11px] font-medium text-slate-400">
          {activeAnchors.filter((a) => a.status !== 'PENDING').length} / {activeAnchors.length} названо
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {activeAnchors.map((anchor) => {
          const IconComponent = CATEGORY_ICONS[anchor.category] || Tag;
          const isConfirmed = anchor.status === 'CONFIRMED_HIT';
          const isOptimistic = anchor.status === 'OPTIMISTIC_HIT';

          return (
            <div
              key={anchor.id}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 select-none ${
                isConfirmed
                  ? 'bg-emerald-50/90 border-emerald-400 shadow-xs ring-1 ring-emerald-200 text-emerald-950 scale-[1.01]'
                  : isOptimistic
                  ? 'bg-emerald-50/40 border-dashed border-emerald-400/80 text-emerald-900 animate-pulse'
                  : 'bg-white/90 border-slate-200 text-slate-600 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    isConfirmed
                      ? 'bg-emerald-100 text-emerald-700'
                      : isOptimistic
                      ? 'bg-emerald-100/60 text-emerald-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold truncate leading-tight">
                    {anchor.label}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize leading-none mt-0.5">
                    {anchor.category}
                  </div>
                </div>
              </div>

              <div className="shrink-0 ml-1">
                {isConfirmed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : isOptimistic ? (
                  <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
