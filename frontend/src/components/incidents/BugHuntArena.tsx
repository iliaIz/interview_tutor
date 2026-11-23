import React, { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { BugChallenge, BugChallengeCard } from '../BugChallengeCard';
import { TaskRecoveryCard } from '../TaskRecoveryCard';
import { MemoryRadarDrawer } from '../MemoryRadarDrawer';
import { BugHuntHeader, WorkoutPreset } from './bughunt/BugHuntHeader';
import { BugHuntVoiceMentor } from './bughunt/BugHuntVoiceMentor';
import { BugHuntLoaderCard } from './bughunt/BugHuntLoaderCard';
import { useBugHuntSession, DefectFocus, TechStackProfile } from './bughunt/useBugHuntSession';
import { useBugHuntVoiceBridge } from './bughunt/useBugHuntVoiceBridge';

export type { DefectFocus, TechStackProfile };
export type { BugChallenge };

export const BugHuntArena: React.FC = () => {
  const {
    activeTopicBugHunt,
    closeTopicBugHunt,
    academyBreadcrumbContext,
    returnToAcademyStep
  } = useAppStore();

  const topicId = activeTopicBugHunt?.topicId || 'core';
  const topicName = activeTopicBugHunt?.topicName || 'Java Core & Collections';

  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<WorkoutPreset>('exhaustive');

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
  } = useBugHuntSession({
    topicId,
    topicName,
    activePreset
  });

  const { controller, isConnected, disconnectSession } = useBugHuntVoiceBridge({
    topicName,
    challenge,
    onBugSolved: markBugSolved
  });

  const onNext = () => {
    if (isConnected) disconnectSession();
    handleNextChallenge();
  };

  const onPrev = () => {
    if (isConnected) disconnectSession();
    handlePreviousChallenge();
  };

  const onVariation = () => {
    if (isConnected) disconnectSession();
    void handleGenerateVariation();
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] bg-pastel-bg text-pastel-text overflow-hidden font-sans">
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
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 max-w-7xl 2xl:max-w-[2000px] w-full mx-auto">
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
          <div className="space-y-6">
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/90 rounded-2xl border border-pastel-border/80 shadow-2xs text-pastel-text">
              <button
                onClick={onPrev}
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
                onClick={onNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-pastel-bg transition cursor-pointer"
              >
                <span>{currentIndex < history.length - 1 ? 'Следующий' : 'Новый кейс'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <BugChallengeCard
              challenge={challenge}
              isSolved={isSolved}
              onRefresh={onNext}
              isLoading={isLoadingChallenge}
              onGenerateVariation={onVariation}
              isGeneratingVariation={isLoadingVariation}
              variantNumber={currentVariantNumber}
              onActionNotification={(_actionText) => {}}
            />

            <BugHuntVoiceMentor controller={controller} />
          </div>
        ) : null}
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
