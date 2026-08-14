import React from 'react';
import { useAppStore } from './store/useAppStore';
import { TopicSelector } from './components/TopicSelector';
import { StudyDeck } from './components/StudyDeck';
import { ExamQuiz } from './components/ExamQuiz';
import { AudioRecapModal } from './components/AudioRecapModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { Toast } from './components/Toast';
import { Sparkles, Heart, Headphones, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const { currentView, systemHealth, checkHealth } = useAppStore();

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
          title="AI Шлюз активен. Синтез речи Gemini 3.1 Flash TTS и оценка ответов готовы к работе."
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs cursor-default"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Headphones className="w-3.5 h-3.5" />
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
          title="LiteLLM Gateway и контейнеры запускаются. Голосовые функции станут активны автоматически через несколько секунд..."
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs animate-pulse cursor-help"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span>Инициализация AI Шлюза...</span>
        </div>
      );
    }

    return (
      <div
        title={systemHealth.error || 'Проверьте запуск docker-compose в D:\\projects\\LiteLLM_Proxy'}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-xs cursor-help"
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
        <span>AI Шлюз офлайн</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-pastel-bg text-pastel-text relative pb-24">
      {/* Header Bar */}
      <header className="border-b border-pastel-border/60 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-pastel-text">InterviewPrep AI</h1>
              <p className="text-[10px] text-pastel-muted font-medium">Java • Spring • Hibernate • Docker</p>
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
        {currentView === 'study' && <StudyDeck />}
        {currentView === 'quiz' && <ExamQuiz />}
      </main>

      {/* Audio Modal, Floating Player & Toast Notification */}
      <AudioRecapModal />
      <AudioPlayerBar />
      <Toast />

      {/* Footer */}
      <footer className="border-t border-pastel-border/60 bg-white py-4 text-center text-xs text-pastel-muted">
        <p>© 2026 InterviewPrep AI Platform. Gemini 3 TTS Engine & LiteLLM Proxy.</p>
      </footer>
    </div>
  );
};

export default App;
