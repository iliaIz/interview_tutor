import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Code,
  Trophy,
  PanelLeftClose,
  PanelLeftOpen,
  Compass,
  Clock
} from 'lucide-react';
import { ArenaSwitcherMenu } from './ArenaSwitcherMenu';

export interface PracticeArenaHeaderProps {
  title: string;
  badge: string;
  difficulty?: string;
  elapsedSeconds: number;
  mobileTab: 'spec' | 'editor';
  setMobileTab: (tab: 'spec' | 'editor') => void;
  isSpecCollapsed: boolean;
  onToggleSpecCollapsed: () => void;
  toggleCompass: () => void;
  academyBreadcrumbContext: any;
  returnToAcademyStep: () => void;
  closePracticeChallenge: () => void;
  activePracticeReport: any;
  setIsPracticeReportModalOpen: (v: boolean) => void;
  dockHeaderSlot?: React.ReactNode;
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const PracticeArenaHeader: React.FC<PracticeArenaHeaderProps> = ({
  title,
  badge,
  difficulty,
  elapsedSeconds,
  mobileTab,
  setMobileTab,
  isSpecCollapsed,
  onToggleSpecCollapsed,
  toggleCompass,
  academyBreadcrumbContext,
  returnToAcademyStep,
  closePracticeChallenge,
  activePracticeReport,
  setIsPracticeReportModalOpen,
  dockHeaderSlot
}) => {
  return (
    <header className="h-12 border-b border-pastel-border/80 bg-white/95 backdrop-blur-md px-2.5 sm:px-4 flex items-center justify-between shrink-0 z-20 shadow-2xs gap-2">
      {/* Cluster 1: Navigation + Arena Switcher + Sole Challenge <h1> */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        {academyBreadcrumbContext ? (
          <button
            type="button"
            onClick={returnToAcademyStep}
            className="touch-target-44 flex items-center gap-1 text-xs font-bold text-pastel-accentRoseText bg-pastel-rose hover:bg-[#B5433E] hover:text-white px-2.5 py-1 rounded-xl border border-pastel-accentRose/40 transition cursor-pointer shrink-0"
            title="Вернуться к шагу курса в Академии"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Академия: Шаг #{academyBreadcrumbContext.stepNumber}</span>
            <span className="sm:hidden">Шаг #{academyBreadcrumbContext.stepNumber}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={closePracticeChallenge}
            aria-label="Вернуться в каталог задач"
            className="touch-target-44 flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2 py-1 rounded-xl hover:bg-pastel-bg transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Каталог</span>
          </button>
        )}

        <ArenaSwitcherMenu
          onBeforeNavigate={(id) => {
            if (id === 'practice') {
              closePracticeChallenge();
              return true;
            }
            return false;
          }}
        />

        <div className="h-4 w-px bg-pastel-border shrink-0 hidden sm:block" />

        <div className="flex items-center gap-1.5 min-w-0">
          <h1 className="font-bold text-xs sm:text-sm text-pastel-text truncate max-w-[115px] sm:max-w-[240px] lg:max-w-sm">
            {title}
          </h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30 hidden xl:inline shrink-0">
            {badge}
          </span>
          {difficulty && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-bg border border-pastel-border text-pastel-muted hidden 2xl:inline shrink-0">
              {difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Cluster 2: Mobile Tab Switcher (WAI-ARIA tablist) */}
      <div
        role="tablist"
        aria-label="Переключение между спецификацией и кодом"
        className="flex md:hidden items-center bg-slate-100 p-0.5 rounded-xl border border-pastel-border shrink-0"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'spec'}
          onClick={() => setMobileTab('spec')}
          className={`touch-target-44 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            mobileTab === 'spec'
              ? 'bg-white text-pastel-text shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Спека</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'editor'}
          onClick={() => setMobileTab('editor')}
          className={`touch-target-44 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            mobileTab === 'editor'
              ? 'bg-white text-pastel-accentRoseText shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Код</span>
        </button>
      </div>

      {/* Cluster 3: Live Timer, Focus Mode, Compass, Co-Pilot Slot & Score */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl bg-pastel-bg border border-pastel-border text-pastel-text font-mono text-[11px] font-semibold"
          title="Активное время работы над задачей"
        >
          <Clock className="w-3 h-3 text-pastel-accentRoseText" />
          <span>{formatTimer(elapsedSeconds)}</span>
        </div>

        <button
          type="button"
          onClick={onToggleSpecCollapsed}
          aria-pressed={isSpecCollapsed}
          aria-label={isSpecCollapsed ? 'Показать спецификацию' : 'Свернуть спецификацию'}
          title={isSpecCollapsed ? 'Показать спецификацию (Ctrl+B)' : 'Свернуть спецификацию (Ctrl+B)'}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
            isSpecCollapsed
              ? 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/40 shadow-2xs'
              : 'bg-white text-pastel-text border-pastel-border hover:bg-pastel-bg'
          }`}
        >
          {isSpecCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5 text-pastel-accentRoseText" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5 text-pastel-muted" />
          )}
          <span className="hidden lg:inline">Спец.</span>
        </button>

        <button
          type="button"
          onClick={() => toggleCompass()}
          aria-label="Открыть компас архитектуры и тестирования"
          title="Компас Архитектуры & Тестирования (Ctrl + /)"
          className="touch-target-44 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/40 hover:bg-[#B5433E] hover:text-white transition cursor-pointer shadow-2xs"
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Компас</span>
        </button>

        {dockHeaderSlot}

        {activePracticeReport && (
          <button
            type="button"
            onClick={() => setIsPracticeReportModalOpen(true)}
            title="Открыть отчет Senior AI Review"
            className="touch-target-44 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold shadow-2xs cursor-pointer transition"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>{Math.round(activePracticeReport.scoreBreakdown.overallScore)}/100</span>
          </button>
        )}
      </div>
    </header>
  );
};
