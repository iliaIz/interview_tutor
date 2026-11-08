import React, { Suspense, lazy } from 'react';
import { useAppStore } from './store/useAppStore';
import { StudioHeader } from './components/StudioHeader';
import { AuthGateModal } from './components/auth/AuthGateModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { Toast } from './components/Toast';
import { StudioErrorBoundary } from './components/StudioErrorBoundary';
import { Heart, Loader2 } from 'lucide-react';

// Code Splitting & Dynamic Imports for Ultra-Fast Initial Render (180kB initial chunk)
const AcademyStudio = lazy(() => import('./components/academy/AcademyStudio').then(m => ({ default: m.AcademyStudio })));
const PracticeArena = lazy(() => import('./components/practice/PracticeArena').then(m => ({ default: m.PracticeArena })));
const SystemDesignCatalog = lazy(() => import('./components/system_design/SystemDesignCatalog').then(m => ({ default: m.SystemDesignCatalog })));
const SystemDesignArena = lazy(() => import('./components/system_design/SystemDesignArena').then(m => ({ default: m.SystemDesignArena })));
const MultiScaleCanvasHub = lazy(() => import('./components/system_design/MultiScaleCanvasHub').then(m => ({ default: m.MultiScaleCanvasHub })));
const IncidentTriageCatalog = lazy(() => import('./components/triage/IncidentTriageCatalog').then(m => ({ default: m.IncidentTriageCatalog })));
const IncidentTriageStudio = lazy(() => import('./components/triage/IncidentTriageStudio').then(m => ({ default: m.IncidentTriageStudio })));
const TopicSelector = lazy(() => import('./components/TopicSelector').then(m => ({ default: m.TopicSelector })));
const QuestionExplorer = lazy(() => import('./components/QuestionExplorer').then(m => ({ default: m.QuestionExplorer })));
const StudyDeck = lazy(() => import('./components/StudyDeck').then(m => ({ default: m.StudyDeck })));
const ExamQuiz = lazy(() => import('./components/ExamQuiz').then(m => ({ default: m.ExamQuiz })));
const BugHuntCatalog = lazy(() => import('./components/incidents/BugHuntCatalog').then(m => ({ default: m.BugHuntCatalog })));
const BugHuntArena = lazy(() => import('./components/incidents/BugHuntArena').then(m => ({ default: m.BugHuntArena })));
const InterviewReportModal = lazy(() => import('./components/InterviewReportModal').then(m => ({ default: m.InterviewReportModal })));
const AudioRecapModal = lazy(() => import('./components/AudioRecapModal').then(m => ({ default: m.AudioRecapModal })));
const ProfileEditModal = lazy(() => import('./components/auth/ProfileEditModal').then(m => ({ default: m.ProfileEditModal })));
const AdminInvitesModal = lazy(() => import('./components/auth/AdminInvitesModal').then(m => ({ default: m.AdminInvitesModal })));
const LiveVadDebugStudio = lazy(() => import('./components/debug/LiveVadDebugStudio').then(m => ({ default: m.LiveVadDebugStudio })));
const HrScreeningArena = lazy(() => import('./components/practice/hr').then(m => ({ default: m.HrScreeningArena })));
const CompanyPrepStudio = lazy(() => import('./components/companies/CompanyPrepStudio').then(m => ({ default: m.CompanyPrepStudio })));

const StudioSuspenseLoader: React.FC = () => (
  <div className="flex-1 min-h-[400px] flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-2.5 p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-pastel-border/60 shadow-xs animate-fade-in">
      <Loader2 className="w-6 h-6 animate-spin text-pastel-accentRose" />
      <span className="text-xs font-bold text-pastel-muted font-sans">Загрузка студии...</span>
    </div>
  </div>
);

import { useAuthStore } from './store/useAuthStore';

export const App: React.FC = () => {
  const { currentUser, isAuthChecking, checkAuthSession } = useAuthStore();
  const {
    currentStudioTab,
    currentView,
    systemHealth,
    checkHealth,
    activeReportModal,
    closeReportModal,
    activeTopicBugHunt,
    closeTopicBugHunt,
    activeSystemDesignScenario,
    activeTriageIncident
  } = useAppStore();

  React.useEffect(() => {
    // Initial Auth & Health Check
    checkAuthSession();
    checkHealth();

    // SOTA 2026 Page Visibility Aware Poller (Saves battery & mobile cellular data)
    let intervalId: any = null;

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      const pollMs = systemHealth.isAiReady ? 30000 : 3000;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          checkHealth();
        }
      }, pollMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkHealth();
        startPolling();
      } else {
        if (intervalId) clearInterval(intervalId);
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [systemHealth.isAiReady]);

  // 1. Loading state during initial session verification (zero-flicker: skipped if cached user exists)
  if (isAuthChecking && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pastel-bg text-pastel-text font-sans">
        <div className="flex flex-col items-center gap-3 text-pastel-muted">
          <Loader2 className="w-8 h-8 animate-spin text-pastel-accentRose" />
          <span className="text-xs font-mono">Проверка сессии доступа...</span>
        </div>
      </div>
    );
  }

  // 2. Auth Gate Shield: If not authenticated, render ONLY the luxury Auth Gate Modal
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pastel-bg text-pastel-text relative overflow-hidden font-sans">
        <div className="fixed -top-28 -left-28 w-96 h-96 rounded-full bg-gradient-to-br from-pastel-accentRose/20 to-transparent blur-3xl pointer-events-none" />
        <div className="fixed top-1/3 -right-28 w-[420px] h-[420px] rounded-full bg-gradient-to-bl from-pastel-accentViolet/20 to-transparent blur-3xl pointer-events-none" />
        <div className="fixed -bottom-20 left-1/3 w-[360px] h-[360px] rounded-full bg-gradient-to-tr from-pastel-peach/30 to-transparent blur-3xl pointer-events-none" />
        <AuthGateModal />
        <Toast />
      </div>
    );
  }

  // 3. Authenticated: Render full studio with dynamic lazy suspense
  return (
    <div className="min-h-screen flex flex-col bg-pastel-bg text-pastel-text relative pb-24 overflow-x-hidden selection:bg-pastel-rose selection:text-pastel-accentRose font-sans">
      {/* Floating Ambient Mesh Auras for High-End Luxury Feel */}
      <div className="fixed -top-28 -left-28 w-96 h-96 rounded-full bg-gradient-to-br from-pastel-accentRose/15 to-transparent blur-3xl pointer-events-none animate-aura-slow z-0" />
      <div className="fixed top-1/3 -right-28 w-[420px] h-[420px] rounded-full bg-gradient-to-bl from-pastel-accentViolet/15 via-pastel-lavender/30 to-transparent blur-3xl pointer-events-none animate-aura-reverse z-0" />
      <div className="fixed -bottom-20 left-1/3 w-[360px] h-[360px] rounded-full bg-gradient-to-tr from-pastel-peach/30 to-transparent blur-3xl pointer-events-none z-0" />

      {/* Studio Segmented Navigation Header */}
      <StudioHeader />

      {/* Main Content Area wrapped in Resilient Error Boundary & Suspense */}
      <StudioErrorBoundary
        fallbackTitle="Студия временно восстанавливает отображение"
        fallbackDescription="Произошел сбой при отрисовке модуля. Вы можете повторить попытку или перейти в другой раздел."
      >
        <main className="flex-1 flex flex-col">
          <Suspense fallback={<StudioSuspenseLoader />}>
            {(currentStudioTab === 'academy' || currentStudioTab === 'roadmaps') && <AcademyStudio />}
            
            {currentStudioTab === 'practice' && <PracticeArena />}

            {currentStudioTab === 'hr_screening' && <HrScreeningArena />}

            {currentStudioTab === 'live_debug' && <LiveVadDebugStudio />}

            {currentStudioTab === 'companies' && <CompanyPrepStudio />}

            {currentStudioTab === 'incidents' && (
              activeTopicBugHunt ? <BugHuntArena /> : <BugHuntCatalog />
            )}

            {currentStudioTab === 'system_design' && (
              activeSystemDesignScenario ? (
                activeSystemDesignScenario.canonical_id || activeSystemDesignScenario.studio_2_simulation ? (
                  <MultiScaleCanvasHub />
                ) : (
                  <SystemDesignArena />
                )
              ) : (
                <SystemDesignCatalog />
              )
            )}

            {currentStudioTab === 'triage' && (
              activeTriageIncident ? <IncidentTriageStudio /> : <IncidentTriageCatalog />
            )}

            {currentStudioTab === 'theory' && (
              <>
                {currentView === 'topics' && <TopicSelector />}
                {currentView === 'questions' && <QuestionExplorer />}
                {currentView === 'study' && <StudyDeck />}
                {currentView === 'quiz' && <ExamQuiz />}
              </>
            )}
          </Suspense>
        </main>
      </StudioErrorBoundary>

      {/* Audio Modal, Floating Player, Interview Report Modal & Toast Notification */}
      <StudioErrorBoundary fallbackTitle="Ошибка отображения диалога">
        <Suspense fallback={null}>
          <AudioRecapModal />
          <InterviewReportModal
            isOpen={Boolean(activeReportModal)}
            onClose={closeReportModal}
            report={activeReportModal}
          />
          <ProfileEditModal />
          <AdminInvitesModal />
        </Suspense>
      </StudioErrorBoundary>

      <AudioPlayerBar />
      <Toast />

      {/* Footer */}
      {currentStudioTab !== 'practice' && 
       currentStudioTab !== 'hr_screening' && 
       !activeSystemDesignScenario && 
       !activeTriageIncident && 
       !(currentStudioTab === 'incidents' && activeTopicBugHunt) && (
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
