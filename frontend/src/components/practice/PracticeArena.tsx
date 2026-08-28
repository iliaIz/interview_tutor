import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PracticeCatalog } from './PracticeCatalog';
import { ChallengeSpecPanel } from './ChallengeSpecPanel';
import { WorkspaceEditor } from './WorkspaceEditor';
import { PracticeEvaluationModal } from './PracticeEvaluationModal';
import { ArrowLeft, Headphones, Sparkles, Trophy } from 'lucide-react';

export const PracticeArena: React.FC = () => {
  const {
    activePracticeChallenge,
    closePracticeChallenge,
    activePracticeReport,
    setActivePracticeReport
  } = useAppStore();

  if (!activePracticeChallenge) {
    return <PracticeCatalog />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-pastel-bg relative">
      {/* Top Workspace Navigation Bar */}
      <div className="h-12 border-b border-pastel-border/80 bg-white/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={closePracticeChallenge}
            className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2.5 py-1.5 rounded-xl hover:bg-pastel-bg transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>В каталог задач</span>
          </button>

          <div className="h-4 w-px bg-pastel-border" />

          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-pastel-text">
              {activePracticeChallenge.title}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20 hidden sm:inline">
              {activePracticeChallenge.badge}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activePracticeReport && (
            <button
              onClick={() => {}}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Оценка: {Math.round(activePracticeReport.scoreBreakdown.overallScore)}/100</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace: Left = Spec Panel, Right = Multi-File Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Specification Sidebar (35%) */}
        <div className="w-full md:w-[38%] h-full overflow-hidden shrink-0 border-r border-pastel-border">
          <ChallengeSpecPanel />
        </div>

        {/* Right Code Editor & Terminal (65%) */}
        <div className="hidden md:flex flex-1 h-full overflow-hidden">
          <WorkspaceEditor />
        </div>
      </div>

      {/* Evaluation Results Modal */}
      <PracticeEvaluationModal
        isOpen={Boolean(activePracticeReport)}
        onClose={() => setActivePracticeReport(null)}
        result={activePracticeReport}
        onRetry={() => setActivePracticeReport(null)}
      />
    </div>
  );
};
