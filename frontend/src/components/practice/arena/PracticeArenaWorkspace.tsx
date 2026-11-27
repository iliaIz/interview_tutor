import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { PracticeArenaHeader } from './PracticeArenaHeader';
import { usePracticeFindingBridge } from './usePracticeFindingBridge';
import { WorkbenchDragSplitter } from './WorkbenchDragSplitter';
import { useWorkbenchViewport } from './useWorkbenchViewport';
import { WORKBENCH_BOUNDS, computeWorkbenchGridTracks } from './workbenchLayoutKernel';

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
    practiceElapsedSeconds,
    setPracticeElapsedSeconds
  } = useAppStore();

  const [mobileTab, setMobileTab] = useState<'spec' | 'editor'>('editor');
  const workspaceGridRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth, isDesktopMd, isDesktopLg } = useWorkbenchViewport(workspaceGridRef);

  const toggleCompass = usePracticeTutorStore((s) => s.toggleCompass);
  const toggleTutorDrawer = usePracticeTutorStore((s) => s.toggleOpen);
  const isTutorOpen = usePracticeTutorStore((s) => s.isOpen);
  const rightDockTab = usePracticeTutorStore((s) => s.rightDockTab);
  const setRightDockTab = usePracticeTutorStore((s) => s.setRightDockTab);
  const isCopilotStealth = usePracticeTutorStore((s) => s.isCopilotStealth);
  const exitStealthMode = usePracticeTutorStore((s) => s.exitStealthMode);
  const isSpecCollapsed = usePracticeTutorStore((s) => s.isSpecCollapsed);
  const isWhiteboardExpanded = usePracticeTutorStore((s) => s.isWhiteboardExpanded);
  const specWidthPx = usePracticeTutorStore((s) => s.specWidthPx);
  const tutorWidthPx = usePracticeTutorStore((s) => s.tutorWidthPx);
  const whiteboardWidthPx = usePracticeTutorStore((s) => s.whiteboardWidthPx);
  const setSpecCollapsed = usePracticeTutorStore((s) => s.setSpecCollapsed);
  const setPanelWidth = usePracticeTutorStore((s) => s.setPanelWidth);

  const { isConnected: isVoiceConnected, isError: isVoiceError } = usePracticeVoice();
  const { handleStartVoiceDiscussion } = usePracticeFindingBridge();

  const isDockVisible = isTutorOpen && !isCopilotStealth;
  const isDockInline = isDockVisible && isDesktopLg;

  const gridTracks = useMemo(
    () =>
      computeWorkbenchGridTracks({
        viewportWidth: containerWidth,
        isSpecCollapsed,
        isDockVisible: isDockInline,
        rightDockTab,
        isWhiteboardExpanded,
        specWidthPx,
        tutorWidthPx,
        whiteboardWidthPx
      }),
    [
      containerWidth,
      isSpecCollapsed,
      isDockInline,
      rightDockTab,
      isWhiteboardExpanded,
      specWidthPx,
      tutorWidthPx,
      whiteboardWidthPx
    ]
  );

  const handleToggleSpecCollapsed = React.useCallback(() => {
    setSpecCollapsed(!gridTracks.effectiveSpecCollapsed, containerWidth);
  }, [setSpecCollapsed, gridTracks.effectiveSpecCollapsed, containerWidth]);

  // Live visibility-aware 1s workspace timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        setPracticeElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activePracticeChallenge.id, setPracticeElapsedSeconds]);

  // Centralized Ctrl+/ & Ctrl+B shortcut registry for Practice domains
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleCompass();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'b' || e.code === 'KeyB')) {
        e.preventDefault();
        setSpecCollapsed(!gridTracks.effectiveSpecCollapsed, containerWidth);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCompass, setSpecCollapsed, gridTracks.effectiveSpecCollapsed, containerWidth]);

  const showStealthRestorePill = isCopilotStealth;

  const handleSelectDockTab = (tab: 'tutor' | 'whiteboard') => {
    if (isCopilotStealth) {
      exitStealthMode(tab);
      return;
    }
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
      aria-label={
        isVoiceError
          ? 'Восстановить панель AI: ошибка связи'
          : isVoiceConnected
          ? 'Восстановить панель AI: в эфире'
          : 'Вернуть панель AI из тихого режима'
      }
      className={`touch-target-44 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs shrink-0 ${
        isVoiceError
          ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
          : isVoiceConnected
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
          : 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/40 hover:bg-[#B5433E] hover:text-white'
      }`}
      title="Вернуть панель AI-Напарника из тихого режима"
    >
      <Radio
        className={`w-3.5 h-3.5 ${
          isVoiceError
            ? 'text-rose-700'
            : isVoiceConnected
            ? 'text-emerald-700'
            : 'text-current'
        }`}
      />
      <span>{isVoiceError ? 'Ошибка связи' : isVoiceConnected ? 'AI в эфире' : 'Вернуть AI'}</span>
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
        <span className="hidden lg:inline">Напарник</span>
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
        <span className="hidden lg:inline">Доска</span>
        {activeWhiteboardState?.code && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#B5433E]" />
        )}
      </button>
    </div>
  );

  const gridTemplateColumns = useMemo(() => {
    if (isDockInline) {
      return gridTracks.effectiveSpecCollapsed
        ? `var(--spec-w) ${gridTracks.editorTrack} ${WORKBENCH_BOUNDS.SASH_WIDTH_PX}px var(--copilot-w)`
        : `var(--spec-w) ${WORKBENCH_BOUNDS.SASH_WIDTH_PX}px ${gridTracks.editorTrack} ${WORKBENCH_BOUNDS.SASH_WIDTH_PX}px var(--copilot-w)`;
    }
    return gridTracks.effectiveSpecCollapsed
      ? `var(--spec-w) ${gridTracks.editorTrack}`
      : `var(--spec-w) ${WORKBENCH_BOUNDS.SASH_WIDTH_PX}px ${gridTracks.editorTrack}`;
  }, [isDockInline, gridTracks.effectiveSpecCollapsed, gridTracks.editorTrack]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-pastel-bg relative">
      <PracticeArenaHeader
        title={activePracticeChallenge.title}
        badge={activePracticeChallenge.badge}
        difficulty={activePracticeChallenge.difficulty}
        elapsedSeconds={practiceElapsedSeconds}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        isSpecCollapsed={gridTracks.effectiveSpecCollapsed}
        onToggleSpecCollapsed={handleToggleSpecCollapsed}
        toggleCompass={toggleCompass}
        academyBreadcrumbContext={academyBreadcrumbContext}
        returnToAcademyStep={returnToAcademyStep}
        closePracticeChallenge={closePracticeChallenge}
        activePracticeReport={activePracticeReport}
        setIsPracticeReportModalOpen={setIsPracticeReportModalOpen}
        dockHeaderSlot={dockHeaderSlot}
      />

      {/* Adaptive Workbench Grid: Spec / Rail + Drag Sashes + CodeMirror Editor + Right Co-Pilot Dock */}
      <div
        ref={workspaceGridRef}
        data-testid="practice-workbench-grid"
        style={
          isDesktopMd
            ? ({
                '--spec-w': gridTracks.specTrack,
                '--copilot-w': gridTracks.copilotTrack,
                gridTemplateColumns
              } as React.CSSProperties)
            : undefined
        }
        className="flex-1 min-h-0 flex md:grid overflow-hidden relative"
      >
        <div
          className={`h-full min-h-0 overflow-hidden ${
            isDesktopMd
              ? 'flex flex-col'
              : mobileTab === 'spec'
                ? 'flex flex-col flex-1 w-full'
                : 'hidden'
          }`}
        >
          <ChallengeSpecPanel
            isCollapsed={isDesktopMd && gridTracks.effectiveSpecCollapsed}
            onToggleCollapse={handleToggleSpecCollapsed}
          />
        </div>

        {isDesktopMd && !gridTracks.effectiveSpecCollapsed && (
          <WorkbenchDragSplitter
            edge="left"
            label="Изменить ширину спецификации"
            minWidth={WORKBENCH_BOUNDS.MIN_SPEC_WIDTH_PX}
            maxWidth={gridTracks.maxSpecPx}
            currentWidth={gridTracks.resolvedSpecPx}
            onPreviewWidth={(px) => workspaceGridRef.current?.style.setProperty('--spec-w', `${px}px`)}
            onCommitWidth={(px) => setPanelWidth('spec', px, containerWidth)}
            onResetWidth={() => setPanelWidth('spec', WORKBENCH_BOUNDS.DEFAULT_SPEC_WIDTH_PX, containerWidth)}
            testId="spec-drag-splitter"
          />
        )}

        <div
          className={`min-w-0 h-full min-h-0 overflow-hidden ${
            isDesktopMd
              ? 'flex flex-col'
              : mobileTab === 'editor'
                ? 'flex flex-col flex-1 w-full'
                : 'hidden'
          }`}
        >
          <WorkspaceEditor />
        </div>

        {isDockInline && (
          <WorkbenchDragSplitter
            edge="right"
            label={rightDockTab === 'whiteboard' ? 'Изменить ширину Доски ИИ' : 'Изменить ширину AI-Напарника'}
            minWidth={WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX}
            maxWidth={gridTracks.maxCopilotPx}
            currentWidth={gridTracks.resolvedCopilotPx}
            onPreviewWidth={(px) => workspaceGridRef.current?.style.setProperty('--copilot-w', `${px}px`)}
            onCommitWidth={(px) => setPanelWidth(rightDockTab, px, containerWidth)}
            onResetWidth={() =>
              setPanelWidth(
                rightDockTab,
                rightDockTab === 'whiteboard'
                  ? WORKBENCH_BOUNDS.DEFAULT_WHITEBOARD_WIDTH_PX
                  : WORKBENCH_BOUNDS.DEFAULT_TUTOR_WIDTH_PX,
                containerWidth
              )
            }
            testId="copilot-drag-splitter"
          />
        )}

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
