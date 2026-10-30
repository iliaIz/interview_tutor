import React, { useRef, useEffect } from 'react';
import { useAppStore, StudioTab } from '../../store/useAppStore';
import { Layers, Code2, Bug, Terminal, Zap, ChevronDown, Check, ArrowRight, UserCheck } from 'lucide-react';

interface ArenaItem {
  id: StudioTab;
  title: string;
  shortLabel: string;
  description: string;
  badge: string;
  levelBadge: string;
  icon: React.ComponentType<any>;
  theme: {
    iconColor: string;
    bgIcon: string;
    borderHover: string;
    activeBorder: string;
    activeBg: string;
    badgeStyle: string;
  };
}

const engineeringArenas: ArenaItem[] = [
  {
    id: 'system_design',
    title: 'System Design (HLD)',
    shortLabel: 'HLD',
    description: '26 канонических систем: Runtime Forensics → DES Topology → Bar-Raiser Defense',
    badge: '31 сценарий',
    levelBadge: 'L3–L7',
    icon: Layers,
    theme: {
      iconColor: 'text-purple-600',
      bgIcon: 'bg-purple-100 text-purple-700',
      borderHover: 'hover:border-purple-300 hover:bg-purple-50/50',
      activeBorder: 'border-purple-400',
      activeBg: 'bg-purple-50/80',
      badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200'
    }
  },
  {
    id: 'practice',
    title: 'Machine Coding (LLD)',
    shortLabel: 'Практика',
    description: 'Java 21, Concurrency, Virtual Clock Injection, BigDecimal, Deadlock-Free',
    badge: '93 задачи',
    levelBadge: 'L3–L6',
    icon: Code2,
    theme: {
      iconColor: 'text-amber-600',
      bgIcon: 'bg-amber-100 text-amber-700',
      borderHover: 'hover:border-amber-300 hover:bg-amber-50/50',
      activeBorder: 'border-amber-400',
      activeBg: 'bg-amber-50/80',
      badgeStyle: 'bg-amber-100 text-amber-900 border-amber-200'
    }
  },
  {
    id: 'incidents',
    title: 'Баг-Хант & Forensics',
    shortLabel: 'Баг-Хант',
    description: 'Поиск скрытых дефектов: Race conditions, утечки Heap/Metaspace, Carrier Pinning',
    badge: '70 кат',
    levelBadge: 'L4–L6',
    icon: Bug,
    theme: {
      iconColor: 'text-rose-600',
      bgIcon: 'bg-rose-100 text-rose-700',
      borderHover: 'hover:border-rose-300 hover:bg-rose-50/50',
      activeBorder: 'border-rose-400',
      activeBg: 'bg-rose-50/80',
      badgeStyle: 'bg-rose-100 text-rose-800 border-rose-200'
    }
  },
  {
    id: 'triage',
    title: 'Триаж Аварий (SRE)',
    shortLabel: 'Триаж',
    description: 'SRE-симулятор инцидентов: метрики Prometheus, логи, Linux-терминал, постмортемы',
    badge: '22 инцидента',
    levelBadge: 'L4–L6',
    icon: Terminal,
    theme: {
      iconColor: 'text-emerald-600',
      bgIcon: 'bg-emerald-100 text-emerald-700',
      borderHover: 'hover:border-emerald-300 hover:bg-emerald-50/50',
      activeBorder: 'border-emerald-400',
      activeBg: 'bg-emerald-50/80',
      badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
  },
  {
    id: 'hr_screening',
    title: 'HR-Скрининг & Питч',
    shortLabel: 'HR-Скрининг',
    description: 'Голосовой симулятор: 75с питч, софт-скиллы, НПД 422-ФЗ, анти-сикофантия',
    badge: '13 вопросов',
    levelBadge: 'L3–L6',
    icon: UserCheck,
    theme: {
      iconColor: 'text-pink-600',
      bgIcon: 'bg-pink-100 text-pink-700',
      borderHover: 'hover:border-pink-300 hover:bg-pink-50/50',
      activeBorder: 'border-pink-400',
      activeBg: 'bg-pink-50/80',
      badgeStyle: 'bg-pink-100 text-pink-800 border-pink-200'
    }
  }
];

export const ArenaMegaMenu: React.FC<{ isOpen: boolean; onToggle: () => void; onClose: () => void }> = ({
  isOpen,
  onToggle,
  onClose
}) => {
  const { currentStudioTab, setStudioTab } = useAppStore();
  const arenaMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (arenaMenuRef.current && !arenaMenuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const activeArena = engineeringArenas.find(a => a.id === currentStudioTab);
  const isArenaActive = Boolean(activeArena);

  return (
    <div className="relative" ref={arenaMenuRef}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation min-h-[32px] ${
          isArenaActive || isOpen
            ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
            : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
        }`}
        title="Инженерные полигоны: System Design, Machine Coding, Баг-Хант, Триаж Аварий"
      >
        {activeArena ? (
          <>
            <activeArena.icon className={`w-3.5 h-3.5 shrink-0 ${activeArena.theme.iconColor}`} />
            <span className="font-extrabold">{activeArena.shortLabel}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${activeArena.theme.badgeStyle}`}>
              {activeArena.badge.split(' ')[0]}
            </span>
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span className="hidden sm:inline">Инженерные Арены</span>
            <span className="sm:hidden">Арены</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30">
              5
            </span>
          </>
        )}

        <ChevronDown className={`w-3.5 h-3.5 text-pastel-muted transition-transform duration-200 ${
          isOpen ? 'rotate-180 text-pastel-text' : ''
        }`} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 top-full mt-2.5 w-[calc(100vw-1.5rem)] max-w-sm sm:max-w-md md:w-[520px] bg-white/95 backdrop-blur-2xl border border-pastel-border/90 rounded-3xl p-3 sm:p-4 shadow-2xl z-50 font-sans space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-500 to-rose-400 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-pastel-text">Инженерные Полигоны</div>
                <div className="text-[10px] text-pastel-muted hidden sm:block">Интерактивные тренажеры для подготовки к Hard Skills</div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border shrink-0">
              5 арен • 229 задач
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {engineeringArenas.map((arena) => {
              const Icon = arena.icon;
              const isSelected = currentStudioTab === arena.id;

              return (
                <button
                  key={arena.id}
                  onClick={() => {
                    setStudioTab(arena.id);
                    onClose();
                  }}
                  className={`flex flex-col text-left p-2.5 sm:p-3 rounded-2xl border transition-all duration-150 relative group cursor-pointer ${
                    isSelected
                      ? `${arena.theme.activeBg} ${arena.theme.activeBorder} shadow-sm`
                      : `bg-white/80 border-pastel-border/70 ${arena.theme.borderHover}`
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${arena.theme.bgIcon}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-xs text-pastel-text truncate">
                        {arena.title}
                      </span>
                    </div>

                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md border shrink-0 ${arena.theme.badgeStyle}`}>
                      {arena.levelBadge}
                    </span>
                  </div>

                  <p className="text-[10px] text-pastel-muted line-clamp-2 leading-relaxed mt-1.5 min-h-[28px]">
                    {arena.description}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-pastel-border/40 text-[10px] font-semibold text-slate-500">
                    <span className="text-pastel-muted group-hover:text-pastel-text transition">
                      {arena.badge}
                    </span>
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <span className="text-emerald-600 flex items-center gap-0.5 text-[10px] font-bold">
                          <Check className="w-3 h-3" />
                          Активна
                        </span>
                      )}
                      <ArrowRight className="w-3 h-3 text-pastel-muted group-hover:translate-x-0.5 group-hover:text-pastel-text transition" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
