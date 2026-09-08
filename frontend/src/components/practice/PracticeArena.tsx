import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PracticeCatalog } from './PracticeCatalog';
import { ChallengeSpecPanel } from './ChallengeSpecPanel';
import { WorkspaceEditor } from './WorkspaceEditor';
import { PracticeEvaluationModal } from './PracticeEvaluationModal';
import { TransactionLabArena } from './TransactionLabArena';
import { ArrowLeft, BookOpen, Code, Trophy, Maximize2, Minimize2, Compass, Bot } from 'lucide-react';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { TestingCompassSheet } from './compass/TestingCompassSheet';
import { LLDCompassSheet } from './compass/LLDCompassSheet';
import { PracticeTutorDrawer } from './tutor/PracticeTutorDrawer';
import { getChallengeDomain } from '../../utils/challengeDomain';

export const PracticeArena: React.FC = () => {
  const {
    activePracticeChallenge,
    closePracticeChallenge,
    activePracticeReport,
    setActivePracticeReport,
    academyBreadcrumbContext,
    returnToAcademyStep,
    activeTransactionLabScenarioId,
    closeTransactionLab
  } = useAppStore();

  const [mobileTab, setMobileTab] = useState<'spec' | 'editor'>('editor');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const { toggleCompass, toggleOpen: toggleTutorDrawer, isOpen: isTutorOpen } = usePracticeTutorStore();

  if (activeTransactionLabScenarioId !== null) {
    return (
      <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden">
        <TransactionLabArena
          initialScenarioId={activeTransactionLabScenarioId}
          onBack={closeTransactionLab}
        />
      </div>
    );
  }

  if (!activePracticeChallenge) {
    return <PracticeCatalog />;
  }

  const domain = getChallengeDomain(activePracticeChallenge);
  const isLldChallenge = domain === 'lld';

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg relative">
      {/* Top Workspace Navigation Bar */}

      <div className="h-12 border-b border-pastel-border/80 bg-white/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-2xs gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {academyBreadcrumbContext ? (
            <button
              onClick={returnToAcademyStep}
              className="flex items-center gap-1 text-xs font-bold text-pastel-accentRose bg-pastel-rose hover:bg-pastel-accentRose hover:text-white px-2.5 py-1 rounded-xl border border-pastel-accentRose/30 transition cursor-pointer shrink-0"
              title="Вернуться к шагу курса в Академии"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">← Назад в Академию: Шаг #{academyBreadcrumbContext.stepNumber}</span>
              <span className="sm:hidden">← Шаг #{academyBreadcrumbContext.stepNumber}</span>
            </button>
          ) : (
            <button
              onClick={closePracticeChallenge}
              className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2 py-1.5 rounded-xl hover:bg-pastel-bg transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Каталог</span>
            </button>
          )}


          <div className="h-4 w-px bg-pastel-border shrink-0" />

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs text-pastel-text truncate max-w-[140px] sm:max-w-xs">
              {activePracticeChallenge.title}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20 hidden lg:inline shrink-0">
              {activePracticeChallenge.badge}
            </span>
          </div>
        </div>

        {/* Center: Mobile Tab Switcher (Android & Mobile Devices) */}
        <div className="flex md:hidden items-center bg-slate-100 p-0.5 rounded-xl border border-pastel-border shrink-0">
          <button
            onClick={() => setMobileTab('spec')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              mobileTab === 'spec'
                ? 'bg-white text-pastel-text shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Спека</span>
          </button>
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              mobileTab === 'editor'
                ? 'bg-white text-pastel-accentRose shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Код</span>
          </button>
        </div>

        {/* Right: Score, Status Badge & Desktop Focus Mode */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Compass & AI-Tutor Action Buttons */}
          <button
            onClick={() => toggleCompass()}
            title={
              isLldChallenge
                ? 'LLD Compass: 5 Золотых Заповедей Архитектора (Ctrl + /)'
                : 'Testing Compass: 5 Золотых Заповедей Инженера (Ctrl + /)'
            }
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
              isLldChallenge
                ? 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-600 hover:text-white'
                : 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Компас</span>
          </button>

          <button
            onClick={() => toggleTutorDrawer()}
            title="AI-Напарник (Парное программирование & подсказки)"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
              isTutorOpen
                ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                : 'bg-white text-slate-700 border-pastel-border hover:border-pastel-accentRose/50'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span className="hidden sm:inline">AI-Напарник</span>
          </button>

          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            title={isFocusMode ? "Показать спецификацию" : "Развернуть редактор на 100% ширины (Focus Mode)"}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
              isFocusMode
                ? 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/40 shadow-2xs'
                : 'bg-white text-pastel-text border-pastel-border hover:bg-pastel-bg'
            }`}
          >
            {isFocusMode ? <Minimize2 className="w-3.5 h-3.5 text-pastel-accentRoseText" /> : <Maximize2 className="w-3.5 h-3.5 text-pastel-muted" />}
            <span>{isFocusMode ? 'Показать спеку' : 'Focus Mode'}</span>
          </button>

          {activePracticeReport && (
            <button
              onClick={() => {}}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>{Math.round(activePracticeReport.scoreBreakdown.overallScore)}/100</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace: Left = Spec Panel, Right = Multi-File Editor */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Specification Sidebar */}
        <div
          className={`h-full overflow-hidden shrink-0 border-r border-pastel-border transition-all duration-200 ${
            isFocusMode
              ? 'hidden'
              : 'w-full md:w-[38%] 2xl:w-[30%] 2xl:max-w-[780px]'
          } ${mobileTab === 'spec' ? 'flex flex-col' : 'hidden md:flex flex-col'}`}
        >
          <ChallengeSpecPanel />
        </div>

        {/* Right Code Editor & Terminal (62%) */}
        <div
          className={`flex-1 h-full overflow-hidden ${
            mobileTab === 'editor' ? 'flex flex-col' : 'hidden md:flex flex-col'
          }`}
        >
          <WorkspaceEditor />
        </div>
      </div>

      {/* Evaluation Results Modal */}
      <PracticeEvaluationModal
        isOpen={Boolean(activePracticeReport)}
        onClose={() => setActivePracticeReport(null)}
        result={activePracticeReport}
        onRetry={() => setActivePracticeReport(null)}
      />

      {/* Context-Aware Compass Top Overlay (LLD vs Testing) */}
      {isLldChallenge ? <LLDCompassSheet /> : <TestingCompassSheet />}

      {/* Multimodal AI Pair-Programming Sidecar Drawer */}
      <PracticeTutorDrawer />
    </div>
  );
};
