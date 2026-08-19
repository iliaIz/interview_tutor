import React from 'react';
import { useAppStore } from './store/useAppStore';
import { TopicSelector } from './components/TopicSelector';
import { QuestionExplorer } from './components/QuestionExplorer';
import { StudyDeck } from './components/StudyDeck';
import { ExamQuiz } from './components/ExamQuiz';
import { AudioRecapModal } from './components/AudioRecapModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { InterviewReportModal } from './components/InterviewReportModal';
import { TopicBugHuntModal } from './components/TopicBugHuntModal';
import { Toast } from './components/Toast';
import { Sparkles, Headphones, Loader2, AlertCircle, Heart } from 'lucide-react';

export const App: React.FC = () => {
  const {
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

  const renderHealthBadge = () => {
    if (systemHealth.isAiReady) {
      return (
        <div
          title={systemHealth.message || "AI Шлюз активен. Все модели (TEXT, LIVE, TTS) проверены в LiteLLM."}
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 shadow-2xs backdrop-blur-sm cursor-default"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Headphones className="w-3.5 h-3.5 text-emerald-600" />
          <span>AI Шлюз готов</span>
          {systemHealth.latencyMs && (
            <span className="text-[10px] opacity-70">({systemHealth.latencyMs}мс)</span>
          )}
        </div>
      );
    }

    if (systemHealth.status === 'warming_up' || systemHealth.status === 'checking') {
      return (
        <div
          title={systemHealth.error || "Проверка моделей в LiteLLM-Proxy (TEXT, LIVE, TTS)..."}
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs animate-pulse cursor-help"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span>{systemHealth.error ? 'Синхронизация моделей...' : 'Инициализация AI Шлюза...'}</span>
        </div>
      );
    }

    return (
      <div
        title={systemHealth.error || 'Проверьте запуск docker-compose в D:\\projects\\LiteLLM_Proxy'}
        className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs cursor-help"
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
        <span>AI Шлюз офлайн</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-pastel-bg text-pastel-text relative pb-24 overflow-x-hidden selection:bg-pastel-rose selection:text-pastel-accentRose">
      {/* Floating Ambient Mesh Auras for High-End Luxury Feel */}
      <div className="fixed -top-28 -left-28 w-96 h-96 rounded-full bg-gradient-to-br from-pastel-accentRose/15 to-transparent blur-3xl pointer-events-none animate-aura-slow z-0" />
      <div className="fixed top-1/3 -right-28 w-[420px] h-[420px] rounded-full bg-gradient-to-bl from-pastel-accentViolet/15 via-pastel-lavender/30 to-transparent blur-3xl pointer-events-none animate-aura-reverse z-0" />
      <div className="fixed -bottom-20 left-1/3 w-[360px] h-[360px] rounded-full bg-gradient-to-tr from-pastel-peach/30 to-transparent blur-3xl pointer-events-none z-0" />

      {/* Header Bar */}
      <header className="border-b border-pastel-border/70 bg-white/75 backdrop-blur-xl sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm shadow-pastel-accentRose/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base tracking-tight text-pastel-text">InterviewPrep AI</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">Studio</span>
              </div>
              <p className="text-[10px] text-pastel-muted font-medium">Твой личный ИИ-ментор по Java & Spring</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {renderHealthBadge()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'topics' && <TopicSelector />}
        {currentView === 'questions' && <QuestionExplorer />}
        {currentView === 'study' && <StudyDeck />}
        {currentView === 'quiz' && <ExamQuiz />}
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
      <footer className="border-t border-pastel-border/60 bg-white/60 backdrop-blur-md py-4 text-center text-xs text-pastel-muted">
        <p className="flex items-center justify-center gap-1">
          Создано с заботой <Heart className="w-3.5 h-3.5 text-pastel-accentRose fill-pastel-accentRose inline" /> для комфортной и уверенной подготовки к собеседованиям.
        </p>
      </footer>
    </div>
  );
};

export default App;
