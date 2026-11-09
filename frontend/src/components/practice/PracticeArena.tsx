import React, { useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PracticeCatalog } from './PracticeCatalog';
import { ChallengeSpecPanel } from './ChallengeSpecPanel';
import { WorkspaceEditor } from './WorkspaceEditor';
import { PracticeEvaluationModal } from './PracticeEvaluationModal';
import { CodingChallenge } from '../../types/practice';
import { TransactionLabArena } from './TransactionLabArena';
import { WhiteboardDrawer } from '../WhiteboardDrawer';
import { ArrowLeft, BookOpen, Code, Trophy, Maximize2, Minimize2, Compass, Bot, Sparkles } from 'lucide-react';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { PracticeCompassSheet } from './compass/PracticeCompassSheet';
import { PracticeTutorDrawer } from './tutor/PracticeTutorDrawer';
import { PracticeVoiceProvider, usePracticeVoice } from './tutor/PracticeVoiceContext';
import { StudioErrorBoundary } from '../StudioErrorBoundary';

import { VoiceModal } from '../VoiceModal';
import { TransactionScenario } from '../../types/transactionLab';
import { resolveTutorDomain } from './tutor/TutorDomain';

const PracticeVoiceDefenseGate: React.FC<{ isVoiceDefenseOpen: boolean }> = ({ isVoiceDefenseOpen }) => {
  const { isConnected, disconnectSession } = usePracticeVoice();
  React.useEffect(() => {
    if (isVoiceDefenseOpen && isConnected) {
      disconnectSession();
    }
  }, [isVoiceDefenseOpen, isConnected, disconnectSession]);
  return null;
};

const PracticeArenaWorkspace: React.FC<{ activePracticeChallenge: CodingChallenge }> = ({ activePracticeChallenge }) => {
  const {
    closePracticeChallenge,
    activePracticeReport,
    setActivePracticeReport,
    isPracticeReportModalOpen,
    setIsPracticeReportModalOpen,
    practiceWorkspaceFiles,
    setActiveWorkspaceFileIndex,
    academyBreadcrumbContext,
    returnToAcademyStep,
    activeWhiteboardState,
    isWhiteboardOpen,
    setIsWhiteboardOpen
  } = useAppStore();

  const { startPracticeSessionWithReview } = usePracticeVoice();

  const [mobileTab, setMobileTab] = useState<'spec' | 'editor'>('editor');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const {
    toggleCompass,
    toggleOpen: toggleTutorDrawer,
    isOpen: isTutorOpen
  } = usePracticeTutorStore();

  const handleStartVoiceDiscussion = useCallback((finding?: any) => {
    setIsPracticeReportModalOpen(false);

    if (finding?.location && typeof finding.location === 'string') {
      const match = finding.location.match(/([a-zA-Z0-9_]+)\.(java|[a-zA-Z0-9_]+)/);
      const targetClassOrFile = match ? match[1] : finding.location.split('.')[0];
      if (targetClassOrFile) {
        const foundIdx = practiceWorkspaceFiles.findIndex(
          (f) => f.path.includes(targetClassOrFile) || f.path.endsWith(`${targetClassOrFile}.java`)
        );
        if (foundIdx >= 0) {
          setActiveWorkspaceFileIndex(foundIdx);
        }
      }
    }

    void startPracticeSessionWithReview(finding);
  }, [practiceWorkspaceFiles, setActiveWorkspaceFileIndex, setIsPracticeReportModalOpen, startPracticeSessionWithReview]);

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg relative">
      {/* Top Workspace Navigation Bar */}
      <div className="h-12 border-b border-pastel-border/80 bg-white/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-2xs gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {academyBreadcrumbContext ? (
            <button
              onClick={returnToAcademyStep}
              className="flex items-center gap-1 text-xs font-bold text-pastel-accentRose bg-pastel-rose hover:bg-pastel-accentRose hover:text-white px-2.5 py-1 rounded-xl border border-pastel-accentRose/30 transition cursor-pointer shrink-0"
              title="Вернуться к шагу курса в Академии"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">← Назад в Академию: Шаг #{academyBreadcrumbContext.stepNumber}</span>
              <span className="sm:hidden">← Шаг #{academyBreadcrumbContext.stepNumber}</span>
            </button>
          ) : (
            <button
              onClick={closePracticeChallenge}
              className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2 py-1.5 rounded-xl hover:bg-pastel-bg transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Каталог</span>
            </button>
          )}

          <div className="h-4 w-px bg-pastel-border shrink-0" />

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs text-pastel-text truncate max-w-[140px] sm:max-w-xs">
              {activePracticeChallenge.title}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20 hidden lg:inline shrink-0">
              {activePracticeChallenge.badge}
            </span>
          </div>
        </div>

        {/* Center: Mobile Tab Switcher (Android & Mobile Devices) */}
        <div className="flex md:hidden items-center bg-slate-100 p-0.5 rounded-xl border border-pastel-border shrink-0">
          <button
            onClick={() => setMobileTab('spec')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              mobileTab === 'spec'
                ? 'bg-white text-pastel-text shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Спека</span>
          </button>
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              mobileTab === 'editor'
                ? 'bg-white text-pastel-accentRose shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Код</span>
          </button>
        </div>

        {/* Right: Score, Status Badge & Desktop Focus Mode */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Compass Action Button */}
          <button
            onClick={() => toggleCompass()}
            title="Компас Архитектуры & Тестирования (Ctrl + /)"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white transition cursor-pointer shadow-2xs"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Компас</span>
          </button>

          {/* AI Whiteboard Action Button */}
          <button
            onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
            title="Интерактивная доска ИИ (код, диаграммы, diff)"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
              isWhiteboardOpen
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white border-purple-600'
                : 'bg-white text-slate-700 border-pastel-border hover:border-purple-400'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isWhiteboardOpen ? 'text-white' : 'text-purple-600'}`} />
            <span className="hidden sm:inline">Доска ИИ</span>
            {activeWhiteboardState?.code && (
              <span className="w-2 h-2 rounded-full bg-pastel-accentRose animate-pulse" />
            )}
          </button>

          {/* AI-Tutor (Co-Pilot) Action Button */}
          <button
            onClick={() => toggleTutorDrawer()}
            title="AI-Напарник (Парное программирование & подсказки)"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
              isTutorOpen
                ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                : 'bg-white text-slate-700 border-pastel-border hover:border-pastel-accentRose/50'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span className="hidden sm:inline">AI-Напарник</span>
          </button>

          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            title={isFocusMode ? "Показать спецификацию" : "Развернуть редактор на 100% ширины (Focus Mode)"}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
              isFocusMode
                ? 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/40 shadow-2xs'
                : 'bg-white text-pastel-text border-pastel-border hover:bg-pastel-bg'
            }`}
          >
            {isFocusMode ? <Minimize2 className="w-3.5 h-3.5 text-pastel-accentRoseText" /> : <Maximize2 className="w-3.5 h-3.5 text-pastel-muted" />}
            <span>{isFocusMode ? 'Показать спеку' : 'Focus Mode'}</span>
          </button>

          {activePracticeReport && (
            <button
              onClick={() => setIsPracticeReportModalOpen(true)}
              title="Открыть отчет Senior AI Review"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold shadow-2xs cursor-pointer transition"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>{Math.round(activePracticeReport.scoreBreakdown.overallScore)}/100</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace: Left = Spec Panel, Right = Multi-File Editor */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Specification Sidebar */}
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

        {/* Right Code Editor & Terminal (100% in Focus Mode, 62% in Split View) */}
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

export const PracticeArena: React.FC = () => {
  const {
    activePracticeChallenge,
    closePracticeChallenge,
    activeTransactionLabScenarioId,
    closeTransactionLab
  } = useAppStore();

  const { initChallengeContext } = usePracticeTutorStore();

  React.useEffect(() => {
    if (activeTransactionLabScenarioId !== null) {
      initChallengeContext('transactions', 'Spring Transactions Lab');
    } else if (activePracticeChallenge) {
      const domain = resolveTutorDomain({
        category: activePracticeChallenge.category,
        track: activePracticeChallenge.track,
        title: activePracticeChallenge.title
      });
      initChallengeContext(domain, activePracticeChallenge.title);
    }
  }, [activePracticeChallenge?.id, activeTransactionLabScenarioId, initChallengeContext]);

  const [activeVoiceDefenseScenario, setActiveVoiceDefenseScenario] = useState<TransactionScenario | null>(null);
  const [voiceDefenseQuestion, setVoiceDefenseQuestion] = useState<string>('');
  const [isVoiceDefenseOpen, setIsVoiceDefenseOpen] = useState(false);

  const handleStartTransactionVoiceDefense = (scenario: TransactionScenario, question: string) => {
    setActiveVoiceDefenseScenario(scenario);
    setVoiceDefenseQuestion(question);
    setIsVoiceDefenseOpen(true);
  };

  if (activeTransactionLabScenarioId !== null) {
    return (
      <PracticeVoiceProvider>
        <PracticeVoiceDefenseGate isVoiceDefenseOpen={isVoiceDefenseOpen} />
        <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden">
          <TransactionLabArena
            initialScenarioId={activeTransactionLabScenarioId}
            onBack={closeTransactionLab}
            onStartVoiceDefense={handleStartTransactionVoiceDefense}
          />

          {isVoiceDefenseOpen && activeVoiceDefenseScenario && (
            <VoiceModal
              key={`tx_defense_${activeVoiceDefenseScenario.id}`}
              isOpen={isVoiceDefenseOpen}
              onClose={() => {
                setIsVoiceDefenseOpen(false);
                setActiveVoiceDefenseScenario(null);
              }}
              questionId={activeVoiceDefenseScenario.id}
              topic={`Spring Transactions: ${activeVoiceDefenseScenario.title}`}
              currentQuestionText={voiceDefenseQuestion || activeVoiceDefenseScenario.title}
              referenceAnswer={activeVoiceDefenseScenario.problemStatement}
              initialSessionType="tutor"
              initialTutorMode="practice_pair"
            />
          )}
        </div>
      </PracticeVoiceProvider>
    );
  }

  if (!activePracticeChallenge) {
    return <PracticeCatalog />;
  }

  return (
    <StudioErrorBoundary
      fallbackTitle="Ошибка рабочей области Арены"
      fallbackDescription="Не удалось отобразить файлы задачи или редактор. Вы можете вернуться к каталогу задач."
      onReset={closePracticeChallenge}
    >
      <PracticeVoiceProvider>
        <PracticeArenaWorkspace activePracticeChallenge={activePracticeChallenge} />
      </PracticeVoiceProvider>
    </StudioErrorBoundary>
  );
};

