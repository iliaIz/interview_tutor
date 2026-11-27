import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Sparkles, BookOpen, Brain } from 'lucide-react';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';
import { fetchFsrsQueue } from '../services/fsrsApi';
import { GlobalAudioControlPill } from './voice/GlobalAudioControlPill';
import { AmbientNetworkBanner } from './header/AmbientNetworkBanner';
import { HealthStatusBadge } from './header/HealthStatusBadge';
import { ArenaMegaMenu } from './header/ArenaMegaMenu';
import { UserProfileMenu } from './header/UserProfileMenu';

/**
 * StudioHeader (SOTA Late 2026).
 * Decomposed into modular components: AmbientNetworkBanner, ArenaMegaMenu,
 * HealthStatusBadge, and UserProfileMenu.
 * Cognitive bounding limit: <= 350 lines.
 */
export const StudioHeader: React.FC = () => {
  const { 
    currentStudioTab, 
    setStudioTab, 
    academyBreadcrumbContext,
    returnToAcademyStep
  } = useAppStore();

  const [isArenaMenuOpen, setIsArenaMenuOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [dueCount, setDueCount] = useState<number>(0);

  useEffect(() => {
    void fetchFsrsQueue(5).then((data) => {
      setDueCount(data.count || 0);
    }).catch(() => {});
  }, []);

  return (
    <header className="border-b border-pastel-border/70 bg-white/85 backdrop-blur-xl sticky top-0 z-40 shadow-xs font-sans">
      {/* Ambient Non-Blocking Network Banner */}
      <AmbientNetworkBanner />

      <div className="max-w-[1700px] w-full mx-auto px-2 sm:px-4 py-1.5 md:py-0 min-h-14 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm shadow-pastel-accentRose/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="font-bold text-xs sm:text-base tracking-tight text-pastel-text">InterviewPrep</h1>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20">AI</span>
            </div>
            <p className="text-[10px] text-pastel-muted font-medium hidden 2xl:block">Твой личный ИИ-ментор по Java & Spring</p>
          </div>
        </div>

        {/* Nav Tabs Bar (overflow-visible so ArenaMegaMenu dropdown is never clipped) */}
        <div className="w-full md:w-auto md:flex-1 min-w-0 md:mx-2 relative flex justify-center order-3 md:order-2">
          <nav
            aria-label="Основные разделы студии"
            className="w-full md:w-auto flex items-center justify-between md:justify-center bg-pastel-bg/90 p-0.5 sm:p-1 rounded-2xl border border-pastel-border shadow-2xs gap-0.5 sm:gap-1 overflow-visible"
          >
            {/* 1. Академия */}
            <button
              type="button"
              onClick={() => {
                setStudioTab('academy');
                setIsArenaMenuOpen(false);
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation min-h-[32px] whitespace-nowrap ${
                currentStudioTab === 'academy' || currentStudioTab === 'roadmaps'
                  ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                  : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${
                currentStudioTab === 'academy' || currentStudioTab === 'roadmaps'
                  ? 'text-pastel-accentRoseText'
                  : 'text-pastel-muted'
              }`} />
              <span>Академия</span>
              <span className="hidden xl:inline text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30">
                8
              </span>
            </button>

            {/* 2. База знаний (Теория) */}
            <button
              type="button"
              onClick={() => {
                setStudioTab('theory');
                setIsArenaMenuOpen(false);
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation min-h-[32px] whitespace-nowrap ${
                currentStudioTab === 'theory'
                  ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                  : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
              }`}
            >
              <BookOpen className={`w-3.5 h-3.5 shrink-0 ${
                currentStudioTab === 'theory' ? 'text-pastel-accentRoseText' : 'text-pastel-muted'
              }`} />
              <span className="hidden sm:inline">База знаний</span>
              <span className="sm:hidden">Теория</span>
              <span className="hidden xl:inline text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30">
                816
              </span>
            </button>

            {/* 3. Инженерные Арены & Треки компаний (Mega-Menu) */}
            <ArenaMegaMenu
              isOpen={isArenaMenuOpen}
              onToggle={() => setIsArenaMenuOpen(!isArenaMenuOpen)}
              onClose={() => setIsArenaMenuOpen(false)}
            />
          </nav>
        </div>

        {/* Breadcrumb Bridge, Health Status & User Profile Badge */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 order-2 md:order-3">
          {academyBreadcrumbContext && currentStudioTab !== 'academy' && (
            <button
              onClick={returnToAcademyStep}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/40 hover:bg-pastel-accentRose hover:text-white transition shadow-xs cursor-pointer shrink-0"
              title="Вернуться к текущему шагу в Академии"
            >
              <span className="hidden sm:inline">← Академия: Шаг #{academyBreadcrumbContext.stepNumber}</span>
              <span className="sm:hidden">← #{academyBreadcrumbContext.stepNumber}</span>
            </button>
          )}

          {/* FSRS-5 Memory Radar Quick Action */}
          <button
            onClick={() => setIsRadarOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-pastel-card hover:bg-pastel-rose/60 text-pastel-text border border-pastel-border shadow-2xs cursor-pointer transition active:scale-95 shrink-0"
            title="Открыть Радар Памяти FSRS-5"
          >
            <Brain className="w-3.5 h-3.5 text-pastel-accentViolet" />
            <span className="hidden xl:inline text-[11px]">Память</span>
            {dueCount > 0 && (
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-500 text-white animate-pulse">
                {dueCount}
              </span>
            )}
          </button>
 
          {/* Global Audio Control & Ambient Status */}
          <GlobalAudioControlPill />

          {/* Health Status Badge & Touch Popover */}
          <HealthStatusBadge />

          {/* User Profile Menu */}
          <UserProfileMenu />
        </div>
      </div>

      {/* Memory Radar Drawer */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
      />
    </header>
  );
};
