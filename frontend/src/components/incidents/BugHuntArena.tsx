import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, Radio, Sparkles } from 'lucide-react';
import { normalizeIncidentsContext } from '@interview-prep/shared/tutor';
import { useAppStore } from '../../store/useAppStore';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { useSelectionFocusStore } from '../../store/useSelectionFocusStore';
import { BugChallenge, BugChallengeCard } from '../BugChallengeCard';
import { TaskRecoveryCard } from '../TaskRecoveryCard';
import { MemoryRadarDrawer } from '../MemoryRadarDrawer';
import { PracticeCopilotDock, type PracticeCopilotCapabilities } from '../practice/tutor/PracticeCopilotDock';
import { usePracticeVoice } from '../practice/tutor/PracticeVoiceContext';
import { WorkbenchDragSplitter } from '../practice/arena/WorkbenchDragSplitter';
import { useWorkbenchViewport } from '../practice/arena/useWorkbenchViewport';
import { WORKBENCH_BOUNDS, computeTwoColumnWorkbenchTracks } from '../practice/arena/workbenchLayoutKernel';
import { BugHuntHeader, WorkoutPreset } from './bughunt/BugHuntHeader';
import { BugHuntLoaderCard } from './bughunt/BugHuntLoaderCard';
import { useBugHuntSession, DefectFocus, TechStackProfile } from './bughunt/useBugHuntSession';

export type { DefectFocus, TechStackProfile };
export type { BugChallenge };

export const BugHuntArena: React.FC = () => {
  const activeTopicBugHunt = useAppStore((s) => s.activeTopicBugHunt);
  const closeTopicBugHunt = useAppStore((s) => s.closeTopicBugHunt);
  const academyBreadcrumbContext = useAppStore((s) => s.academyBreadcrumbContext);
  const returnToAcademyStep = useAppStore((s) => s.returnToAcademyStep);
  const activeWhiteboardState = useAppStore((s) => s.activeWhiteboardState);
  const clearCodeRevisions = useAppStore((s) => s.clearCodeRevisions);
  const setActiveBugHuntChallenge = useAppStore((s) => s.setActiveBugHuntChallenge);
  const bugHuntSolvedSignal = useAppStore((s) => s.bugHuntSolvedSignal);

  const isTutorOpen = usePracticeTutorStore((s) => s.isOpen);
  const isCopilotStealth = usePracticeTutorStore((s) => s.isCopilotStealth);
  const rightDockTab = usePracticeTutorStore((s) => s.rightDockTab);
  const isWhiteboardExpanded = usePracticeTutorStore((s) => s.isWhiteboardExpanded);
  const tutorWidthPx = usePracticeTutorStore((s) => s.tutorWidthPx);
  const whiteboardWidthPx = usePracticeTutorStore((s) => s.whiteboardWidthPx);
  const tutorRole = usePracticeTutorStore((s) => s.tutorRole);
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);
  const setRightDockTab = usePracticeTutorStore((s) => s.setRightDockTab);
  const exitStealthMode = usePracticeTutorStore((s) => s.exitStealthMode);
  const setPanelWidth = usePracticeTutorStore((s) => s.setPanelWidth);
  const initChallengeContext = usePracticeTutorStore((s) => s.initChallengeContext);
  const setActiveContext = usePracticeTutorStore((s) => s.setActiveContext);

  const activeFocus = useSelectionFocusStore((s) => s.activeFocus);
  const clearFocus = useSelectionFocusStore((s) => s.clearFocus);

  const { isConnected: isVoiceConnected, isError: isVoiceError, disconnect, sendTextMessage } = usePracticeVoice();
  const isVoiceConnectedRef = useRef(isVoiceConnected);
  isVoiceConnectedRef.current = isVoiceConnected;

  const topicId = activeTopicBugHunt?.topicId || 'core';
  const topicName = activeTopicBugHunt?.topicName || 'Java Core & Collections';

  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<WorkoutPreset>('exhaustive');
  const workspaceGridRef = useRef<HTMLDivElement | null>(null);
  const didAutoOpenRef = useRef(false);
  const lastChallengeIdRef = useRef<string | null>(null);
  const { containerWidth, isDesktopLg } = useWorkbenchViewport(workspaceGridRef);

  const {
    challenge,
    history,
    currentIndex,
    currentVariantNumber,
    isLoadingChallenge,
    isLoadingVariation,
    generationError,
    isSolved,
    sessionSolvedCount,
    fetchChallenge,
    handleGenerateVariation,
    handleNextChallenge,
    handlePreviousChallenge,
    markBugSolved
  } = useBugHuntSession({ topicId, topicName, activePreset });

  // Open Co-Pilot dock by default on desktop entry for immediate 2-column code review UX
  useEffect(() => {
    if (didAutoOpenRef.current) return;
    didAutoOpenRef.current = true;
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      toggleOpen(true);
    }
  }, [toggleOpen]);

  // Reset transient dialogue, voice, revisions, and selection focus when switching challenges
  useEffect(() => {
    const nextId = challenge?.id ?? null;
    if (lastChallengeIdRef.current !== nextId) {
      lastChallengeIdRef.current = nextId;
      if (isVoiceConnectedRef.current) disconnect();
      clearCodeRevisions();
      clearFocus();
      if (challenge) {
        initChallengeContext('testing', challenge.title, 'incidents');
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
          toggleOpen(true);
        }
      }
    }
    setActiveBugHuntChallenge(challenge ?? null);
  }, [challenge, disconnect, clearCodeRevisions, clearFocus, setActiveBugHuntChallenge, initChallengeContext, toggleOpen]);

  // Cleanup cross-arena state when leaving BugHuntArena
  useEffect(() => {
    return () => {
      setActiveBugHuntChallenge(null);
      clearCodeRevisions();
      clearFocus();
    };
  }, [setActiveBugHuntChallenge, clearCodeRevisions, clearFocus]);

  // Keep TutorActiveContext synchronized with active bug, line selection, and AI role
  useEffect(() => {
    if (!challenge) return;
    setActiveContext(
      normalizeIncidentsContext({
        bugId: challenge.id,
        title: challenge.title,
        topic: challenge.topicName || topicName,
        difficulty: challenge.difficultyBadge,
        buggyCode: challenge.codeSnippet,
        bugType: challenge.subtopic,
        incidentContext: challenge.productionContext?.incidentSymptoms,
        hintCost: challenge.hints?.[0],
        language: challenge.language,
        selectedCodeSnippet: activeFocus?.text,
        cursorLine: activeFocus?.startLine,
        tutorRole
      })
    );
  }, [challenge, topicName, activeFocus?.text, activeFocus?.startLine, tutorRole, setActiveContext]);

  // Synchronize solved verdict triggered either via Live Voice (mark_bug_solved) or REST verify-diagnosis
  useEffect(() => {
    if (bugHuntSolvedSignal && challenge?.id === bugHuntSolvedSignal.bugId && !isSolved) {
      markBugSolved();
    }
  }, [bugHuntSolvedSignal, challenge?.id, isSolved, markBugSolved]);

  const isDockVisible = isTutorOpen && !isCopilotStealth;
  const isDockInline = isDockVisible && isDesktopLg;

  const gridTracks = useMemo(
    () =>
      computeTwoColumnWorkbenchTracks({
        viewportWidth: containerWidth,
        isDockVisible: isDockInline,
        rightDockTab,
        isWhiteboardExpanded,
        tutorWidthPx,
        whiteboardWidthPx
      }),
    [containerWidth, isDockInline, rightDockTab, isWhiteboardExpanded, tutorWidthPx, whiteboardWidthPx]
  );

  const handleSelectDockTab = (tab: 'tutor' | 'whiteboard') => {
    if (isCopilotStealth) {
      exitStealthMode(tab);
      return;
    }
    if (isDockVisible && rightDockTab === tab) {
      toggleOpen(false);
    } else {
      setRightDockTab(tab);
      toggleOpen(true);
    }
  };

  const dockHeaderSlot = isCopilotStealth ? (
    <button
      type="button"
      onClick={() => exitStealthMode('tutor')}
      className={`touch-target-44 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs shrink-0 ${
        isVoiceError
          ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
          : isVoiceConnected
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
          : 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/40 hover:bg-[#B5433E] hover:text-white'
      }`}
      title="Вернуть панель AI-Напарника из тихого режима"
    >
      <Radio className="w-3.5 h-3.5" />
      <span>{isVoiceError ? 'Ошибка связи' : isVoiceConnected ? 'AI в эфире' : 'Вернуть AI'}</span>
    </button>
  ) : (
    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-pastel-border gap-0.5 shrink-0">
      <button
        type="button"
        onClick={() => handleSelectDockTab('tutor')}
        aria-label="Открыть AI-Напарника"
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
        aria-label="Открыть Доску ИИ"
        className={`touch-target-44 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
          isDockVisible && rightDockTab === 'whiteboard'
            ? 'bg-slate-900 text-white shadow-2xs'
            : 'text-slate-700 hover:text-slate-950'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-current" />
        <span className="hidden lg:inline">Доска</span>
        {activeWhiteboardState?.code && <span className="w-1.5 h-1.5 rounded-full bg-[#B5433E]" />}
      </button>
    </div>
  );

  const bugHuntCapabilities = useMemo<PracticeCopilotCapabilities>(
    () => ({
      canInsertToEditor: false,
      showIdeBridge: false,
      showPersonasAndHints: true,
      showBugRoleSwitcher: true,
      showVerifyDiagnosis: true,
      onVerifyDiagnosisSuccess: (solvedId) => {
        if (solvedId === challenge?.id && !isSolved) {
          markBugSolved();
        }
      }
    }),
    [challenge?.id, isSolved, markBugSolved]
  );

  const gridTemplateColumns = isDockInline
    ? `${gridTracks.primaryTrack} ${WORKBENCH_BOUNDS.SASH_WIDTH_PX}px var(--copilot-w)`
    : gridTracks.primaryTrack;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-pastel-bg text-pastel-text font-sans">
      <BugHuntHeader
        academyBreadcrumbContext={academyBreadcrumbContext}
        returnToAcademyStep={returnToAcademyStep}
        closeTopicBugHunt={closeTopicBugHunt}
        topicName={topicName}
        difficultyBadge={challenge?.difficultyBadge}
        activePreset={activePreset}
        onSelectPreset={(p) => {
          setActivePreset(p);
          void fetchChallenge(p);
        }}
        sessionSolvedCount={sessionSolvedCount}
        onOpenRadar={() => setIsRadarOpen(true)}
        dockHeaderSlot={dockHeaderSlot}
      />

      <div
        ref={workspaceGridRef}
        data-testid="bughunt-workbench-grid"
        style={
          isDesktopLg
            ? ({ '--copilot-w': gridTracks.copilotTrack, gridTemplateColumns } as React.CSSProperties)
            : undefined
        }
        className="flex-1 min-h-0 flex lg:grid overflow-hidden relative"
      >
        <div className="flex-1 min-w-0 h-full min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-5">
          <div className="max-w-4xl mx-auto space-y-5">
            {isLoadingChallenge ? (
              <BugHuntLoaderCard />
            ) : generationError ? (
              <div className="max-w-2xl mx-auto py-8">
                <TaskRecoveryCard
                  reason="challenge_generation_failed"
                  userMessage={generationError}
                  retryAfterSeconds={5}
                  availableBankCount={70}
                  onRetry={() => fetchChallenge()}
                  onSwitchToBank={() => closeTopicBugHunt()}
                  isRetrying={isLoadingChallenge}
                />
              </div>
            ) : challenge ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between px-4 py-2 bg-white/90 rounded-2xl border border-pastel-border/80 shadow-2xs text-pastel-text">
                  <button
                    type="button"
                    onClick={() => {
                      if (isVoiceConnected) disconnect();
                      handlePreviousChallenge();
                    }}
                    disabled={currentIndex <= 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-pastel-bg disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Предыдущий</span>
                  </button>
                  <span className="text-xs font-bold font-mono text-pastel-text bg-pastel-bg px-3.5 py-1 rounded-xl border border-pastel-border shadow-2xs">
                    Кейс {currentIndex + 1} из {history.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isVoiceConnected) disconnect();
                      handleNextChallenge();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-pastel-bg transition cursor-pointer"
                  >
                    <span>{currentIndex < history.length - 1 ? 'Следующий' : 'Новый кейс'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <BugChallengeCard
                  challenge={challenge}
                  isSolved={isSolved}
                  onRefresh={() => {
                    if (isVoiceConnected) disconnect();
                    handleNextChallenge();
                  }}
                  isLoading={isLoadingChallenge}
                  onGenerateVariation={() => {
                    if (isVoiceConnected) disconnect();
                    void handleGenerateVariation();
                  }}
                  isGeneratingVariation={isLoadingVariation}
                  variantNumber={currentVariantNumber}
                  onActionNotification={(actionText) => {
                    if (isVoiceConnected) {
                      sendTextMessage(actionText, actionText);
                    } else if (actionText.includes('подсказку')) {
                      setRightDockTab('tutor');
                      toggleOpen(true);
                    }
                  }}
                />
              </div>
            ) : null}
          </div>
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
            testId="bughunt-copilot-drag-splitter"
          />
        )}

        <PracticeCopilotDock capabilities={bugHuntCapabilities} />
      </div>

      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        onSelectTopicForPractice={() => {
          setIsRadarOpen(false);
          void fetchChallenge();
        }}
      />
    </div>
  );
};

export default BugHuntArena;
