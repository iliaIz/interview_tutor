import React, { useState } from 'react';
import { CodingChallenge } from '../../../types/practice';
import { useAppStore } from '../../../store/useAppStore';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { ChallengeSpecPanel } from '../ChallengeSpecPanel';
import { WorkspaceEditor } from '../WorkspaceEditor';
import { PracticeEvaluationModal } from '../PracticeEvaluationModal';
import { PracticeCompassSheet } from '../compass/PracticeCompassSheet';
import { WhiteboardDrawer } from '../../WhiteboardDrawer';
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
  const {
    toggleCompass,
    toggleOpen: toggleTutorDrawer,
    isOpen: isTutorOpen
  } = usePracticeTutorStore();

  const { handleStartVoiceDiscussion } = usePracticeFindingBridge();

  // Live visibility-aware 1s workspace timer
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        setPracticeElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activePracticeChallenge.id, setPracticeElapsedSeconds]);

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
      />

      {/* Main Split Workspace: Left = Spec Panel, Right = Multi-File Editor */}
      <div className="flex-1 flex overflow-hidden relative">
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
          className={`flex-1 h-full overflow-hidden ${
            isFocusMode
              ? 'flex flex-col w-full'
              : mobileTab === 'editor'
                ? 'flex flex-col'
                : 'hidden md:flex flex-col'
          }`}
        >
          <WorkspaceEditor />
        </div>
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

      {/* Interactive AI Whiteboard Drawer */}
      <WhiteboardDrawer
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        state={activeWhiteboardState}
      />
    </div>
  );
};
