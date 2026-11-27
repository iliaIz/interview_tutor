import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, Radio } from 'lucide-react';
import { CodingChallenge } from '../../../types/practice';
import { useAppStore } from '../../../store/useAppStore';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { ChallengeSpecPanel } from '../ChallengeSpecPanel';
import { WorkspaceEditor } from '../WorkspaceEditor';
import { PracticeEvaluationModal } from '../PracticeEvaluationModal';
import { PracticeCompassSheet } from '../compass/PracticeCompassSheet';
import { PracticeCopilotDock } from '../tutor/PracticeCopilotDock';
import { usePracticeVoice } from '../tutor/PracticeVoiceContext';
import { resolveTutorDomain } from '../tutor/TutorDomain';
import { PracticeArenaHeader } from './PracticeArenaHeader';
import { usePracticeFindingBridge } from './usePracticeFindingBridge';

export interface PracticeArenaWorkspaceProps {
  activePracticeChallenge: CodingChallenge;
}

export const PracticeArenaWorkspace: React.FC<PracticeArenaWorkspaceProps> = ({ activePracticeChallenge }) => {
  const {
    closePracticeChallenge,
    activePracticeReport,
    setActivePracticeReport,
    isPracticeReportModalOpen,
    setIsPracticeReportModalOpen,
    academyBreadcrumbContext,
    returnToAcademyStep,
    activeWhiteboardState,
    isWhiteboardOpen,
    setIsWhiteboardOpen,
    practiceElapsedSeconds,
    setPracticeElapsedSeconds
  } = useAppStore();

  const [mobileTab, setMobileTab] = useState<'spec' | 'editor'>('editor');
  const [isFocusMode, setIsFocusMode] = useState(false);

  const toggleCompass = usePracticeTutorStore((s) => s.toggleCompass);
  const toggleTutorDrawer = usePracticeTutorStore((s) => s.toggleOpen);
  const isTutorOpen = usePracticeTutorStore((s) => s.isOpen);
  const rightDockTab = usePracticeTutorStore((s) => s.rightDockTab);
  const setRightDockTab = usePracticeTutorStore((s) => s.setRightDockTab);
  const isCopilotStealth = usePracticeTutorStore((s) => s.isCopilotStealth);
  const exitStealthMode = usePracticeTutorStore((s) => s.exitStealthMode);

  const { isConnected: isVoiceConnected, isError: isVoiceError } = usePracticeVoice();
  const { handleStartVoiceDiscussion } = usePracticeFindingBridge();

  // Live visibility-aware 1s workspace timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        setPracticeElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activePracticeChallenge.id, setPracticeElapsedSeconds]);

  // Centralized Ctrl+/ shortcut registry for Practice domains
  useEffect(() => {
    const domain = resolveTutorDomain({
      category: activePracticeChallenge.category,
      track: activePracticeChallenge.track,
      title: activePracticeChallenge.title
    });
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        if (domain === 'refactoring' || domain === 'concurrency') {
          // Legacy sheets still own Ctrl+/ during T5 until T6/T7 migration
          return;
        }
        e.preventDefault();
        toggleCompass();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePracticeChallenge.category, activePracticeChallenge.track, activePracticeChallenge.title, toggleCompass]);

  const isDockVisible = isTutorOpen && !isCopilotStealth;
  const showStealthRestorePill = isCopilotStealth && (isVoiceConnected || isVoiceError);

  const handleSelectDockTab = (tab: 'tutor' | 'whiteboard') => {
    if (isDockVisible && rightDockTab === tab) {
      toggleTutorDrawer(false);
    } else {
      setRightDockTab(tab);
      toggleTutorDrawer(true);
    }
  };

  const dockHeaderSlot = showStealthRestorePill ? (
    <button
      type="button"
      onClick={() => exitStealthMode('tutor')}
      aria-label={isVoiceError ? 'Восстановить панель AI: ошибка связи' : 'Восстановить панель AI: в эфире'}
      className={`touch-target-44 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
        isVoiceError
          ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
      }`}
      title="Вернуть панель AI-Напарника из тихого режима"
    >
      <Radio className={`w-3.5 h-3.5 ${isVoiceError ? 'text-rose-700' : 'text-emerald-700'}`} />
      <span>{isVoiceError ? 'Ошибка связи' : 'AI в эфире'}</span>
    </button>
  ) : (
    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-pastel-border gap-0.5 shrink-0">
      <button
        type="button"
        onClick={() => handleSelectDockTab('tutor')}
        aria-label="Открыть AI-Напарника"
        title="AI-Напарник (Парное программирование & подсказки)"
        className={`touch-target-44 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
          isDockVisible && rightDockTab === 'tutor'
            ? 'bg-[#B5433E] text-white shadow-2xs'
            : 'text-slate-700 hover:text-slate-950'
        }`}
      >
        <Bot className="w-3.5 h-3.5 text-current" />
        <span className="hidden xl:inline">AI-Напарник</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelectDockTab('whiteboard')}
        aria-label="Открыть интерактивную доску ИИ"
        title="Интерактивная доска ИИ (код, диаграммы, diff)"
        className={`touch-target-44 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
          isDockVisible && rightDockTab === 'whiteboard'
            ? 'bg-slate-900 text-white shadow-2xs'
            : 'text-slate-700 hover:text-slate-950'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-current" />
        <span className="hidden xl:inline">Доска ИИ</span>
        {activeWhiteboardState?.code && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#B5433E]" />
        )}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-pastel-bg relative">
      <PracticeArenaHeader
        title={activePracticeChallenge.title}
        badge={activePracticeChallenge.badge}
        difficulty={activePracticeChallenge.difficulty}
        elapsedSeconds={practiceElapsedSeconds}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
        isWhiteboardOpen={isWhiteboardOpen}
        setIsWhiteboardOpen={setIsWhiteboardOpen}
        activeWhiteboardState={activeWhiteboardState}
        isTutorOpen={isTutorOpen}
        toggleTutorDrawer={toggleTutorDrawer}
        toggleCompass={toggleCompass}
        academyBreadcrumbContext={academyBreadcrumbContext}
        returnToAcademyStep={returnToAcademyStep}
        closePracticeChallenge={closePracticeChallenge}
        activePracticeReport={activePracticeReport}
        setIsPracticeReportModalOpen={setIsPracticeReportModalOpen}
        dockHeaderSlot={dockHeaderSlot}
      />

      {/* Main Split Workspace: Spec Panel + Editor + Docked Right Co-Pilot Rail */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        <div
          className={`h-full overflow-hidden shrink-0 border-r border-pastel-border transition-all duration-200 ${
            isFocusMode
              ? 'hidden'
              : mobileTab === 'spec'
              ? 'flex flex-col w-full md:w-[38%] 2xl:w-[30%] 2xl:max-w-[780px]'
              : 'hidden md:flex flex-col md:w-[38%] 2xl:w-[30%] 2xl:max-w-[780px]'
          }`}
        >
          <ChallengeSpecPanel />
        </div>

        <div
          className={`flex-1 min-w-0 h-full overflow-hidden ${
            isFocusMode
              ? 'flex flex-col w-full'
              : mobileTab === 'editor'
              ? 'flex flex-col'
              : 'hidden md:flex flex-col'
          }`}
        >
          <WorkspaceEditor />
        </div>

        <PracticeCopilotDock />
      </div>

      {/* Evaluation Results Modal */}
      <PracticeEvaluationModal
        isOpen={Boolean(isPracticeReportModalOpen && activePracticeReport)}
        onClose={() => setIsPracticeReportModalOpen(false)}
        result={activePracticeReport}
        onRetry={() => {
          setActivePracticeReport(null);
          setIsPracticeReportModalOpen(false);
        }}
        onStartVoiceDiscussion={handleStartVoiceDiscussion}
      />

      {/* Domain-Adaptive Practice Compass Overlay */}
      <PracticeCompassSheet />
    </div>
  );
};
