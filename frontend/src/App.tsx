import React from 'react';
import { useAppStore } from './store/useAppStore';
import { TopicSelector } from './components/TopicSelector';
import { StudyDeck } from './components/StudyDeck';
import { ExamQuiz } from './components/ExamQuiz';
import { AudioRecapModal } from './components/AudioRecapModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { Toast } from './components/Toast';
import { Sparkles, Heart, Headphones } from 'lucide-react';

export const App: React.FC = () => {
  const { currentView } = useAppStore();

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

          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
            <Headphones className="w-3.5 h-3.5" /> Audio Recap Enabled
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
