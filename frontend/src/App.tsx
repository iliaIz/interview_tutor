import React from 'react';
import { useAppStore } from './store/useAppStore';
import { StudioHeader } from './components/StudioHeader';
import { TopicSelector } from './components/TopicSelector';
import { QuestionExplorer } from './components/QuestionExplorer';
import { StudyDeck } from './components/StudyDeck';
import { ExamQuiz } from './components/ExamQuiz';
import { PracticeArena } from './components/practice/PracticeArena';
import { AudioRecapModal } from './components/AudioRecapModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { InterviewReportModal } from './components/InterviewReportModal';
import { TopicBugHuntModal } from './components/TopicBugHuntModal';
import { Toast } from './components/Toast';
import { Heart } from 'lucide-react';

export const App: React.FC = () => {
  const {
    currentStudioTab,
    currentView,
    systemHealth,
    checkHealth,
    activeReportModal,
    closeReportModal,
    activeTopicBugHunt,
    closeTopicBugHunt
  } = useAppStore();

  React.useEffect(() => {
    // Initial check
    checkHealth();

    // Polling interval depending on readiness
    let intervalId: any = null;
    const runPoller = () => {
      const pollMs = systemHealth.isAiReady ? 25000 : 2500;
      intervalId = setInterval(() => {
        checkHealth();
      }, pollMs);
    };

    runPoller();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [systemHealth.isAiReady]);

  return (
    <div className="min-h-screen flex flex-col bg-pastel-bg text-pastel-text relative pb-24 overflow-x-hidden selection:bg-pastel-rose selection:text-pastel-accentRose">
      {/* Floating Ambient Mesh Auras for High-End Luxury Feel */}
      <div className="fixed -top-28 -left-28 w-96 h-96 rounded-full bg-gradient-to-br from-pastel-accentRose/15 to-transparent blur-3xl pointer-events-none animate-aura-slow z-0" />
      <div className="fixed top-1/3 -right-28 w-[420px] h-[420px] rounded-full bg-gradient-to-bl from-pastel-accentViolet/15 via-pastel-lavender/30 to-transparent blur-3xl pointer-events-none animate-aura-reverse z-0" />
      <div className="fixed -bottom-20 left-1/3 w-[360px] h-[360px] rounded-full bg-gradient-to-tr from-pastel-peach/30 to-transparent blur-3xl pointer-events-none z-0" />

      {/* Studio Segmented Navigation Header */}
      <StudioHeader />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentStudioTab === 'practice' ? (
          <PracticeArena />
        ) : (
          <>
            {currentView === 'topics' && <TopicSelector />}
            {currentView === 'questions' && <QuestionExplorer />}
            {currentView === 'study' && <StudyDeck />}
            {currentView === 'quiz' && <ExamQuiz />}
          </>
        )}
      </main>

      {/* Audio Modal, Floating Player, Interview Report Modal & Toast Notification */}
      <AudioRecapModal />
      <AudioPlayerBar />
      <InterviewReportModal
        isOpen={Boolean(activeReportModal)}
        onClose={closeReportModal}
        report={activeReportModal}
      />
      <TopicBugHuntModal
        isOpen={Boolean(activeTopicBugHunt)}
        onClose={closeTopicBugHunt}
        topicId={activeTopicBugHunt?.topicId || ''}
        topicName={activeTopicBugHunt?.topicName || ''}
      />
      <Toast />

      {/* Footer */}
      {currentStudioTab !== 'practice' && (
        <footer className="border-t border-pastel-border/60 bg-white/60 backdrop-blur-md py-4 text-center text-xs text-pastel-muted">
          <p className="flex items-center justify-center gap-1">
            Создано с заботой <Heart className="w-3.5 h-3.5 text-pastel-accentRose fill-pastel-accentRose inline" /> для комфортной и уверенной подготовки к собеседованиям.
          </p>
        </footer>
      )}
    </div>
  );
};

export default App;
