import React, { useState, useEffect, useRef, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { useAppStore } from '../../store/useAppStore';
import {
  Play,
  RotateCcw,
  Save,
  FileCode,
  Lock,
  Loader2,
  Shield,
  Clock,
  Terminal,
  Cpu,
  Bug,
  AlertTriangle,
  Sparkles,
  Compass,
  Bot
} from 'lucide-react';
import { GoldenMasterDiffViewer } from './GoldenMasterDiffViewer';
import { SandboxTestConsole, SandboxExecutionResponse } from './SandboxTestConsole';
import { MutationExecutionResponse } from '../../types/practice';
import { evaluateAstRules } from '../../utils/astRules';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { CodeArtifactTimeline } from '../CodeArtifactTimeline';

// Bespoke Luxury Pastel Dark Theme for Java 21 CodeMirror 6
const luxuryPastelTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#121622', // Soft Velvet Dark (not harsh #020617)
    backgroundImage: '',
    foreground: '#e2e8f0', // Slate-200
    caret: '#f472b6', // Pastel Rose
    selection: '#26334d', // Soft Slate selection
    selectionMatch: '#1a233a',
    lineHighlight: 'rgba(244, 114, 182, 0.05)',
    gutterBackground: '#121622',
    gutterForeground: '#64748b',
    gutterBorder: '#1e2638'
  },
  styles: [
    { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
    { tag: [t.keyword, t.modifier], color: '#f472b6', fontWeight: 'bold' }, // Rose keywords (class, record, public, volatile)
    { tag: [t.typeName, t.className, t.definition(t.typeName)], color: '#38bdf8' }, // Sky-blue types (String, TokenBucket, Map)
    { tag: [t.string, t.special(t.string)], color: '#34d399' }, // Emerald strings & text blocks
    { tag: [t.number, t.bool, t.null], color: '#c084fc' }, // Violet literals (100, true, false, null)
    { tag: [t.variableName, t.propertyName], color: '#e2e8f0' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#67e8f9' }, // Cyan function names (tryAcquire, create)
    { tag: [t.annotation, t.meta], color: '#fb923c', fontStyle: 'italic' }, // Orange annotations (@Override, @Transactional)
    { tag: [t.operator, t.punctuation], color: '#94a3b8' }
  ]
});

export const WorkspaceEditor: React.FC = () => {
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    setActiveWorkspaceFileIndex,
    updateWorkspaceFileContent,
    activePracticePhase,
    isPracticeEvaluating,
    setIsPracticeEvaluating,
    setActivePracticeReport,
    practiceElapsedSeconds,
    setPracticeElapsedSeconds,
    showToast,
    academyBreadcrumbContext,
    toggleAcademyStepProgress,
    activeWorkspaceView,
    setActiveWorkspaceView,
    hasUnseenWhiteboardUpdate,
    markWhiteboardSeen,
    activeWhiteboardState,
    codeRevisions
  } = useAppStore();

  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxExecutionResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  const liveAstViolations = useMemo(() => {
    if (!currentFile?.content) return [];
    return evaluateAstRules(currentFile.content).filter(r => r.isViolation);
  }, [currentFile?.content]);

  const { toggleCompass, toggleOpen: toggleTutorDrawer } = usePracticeTutorStore();

  // Global shortcut: Ctrl + / toggles Compass; Alt + W toggles Whiteboard; Esc exits Whiteboard
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleCompass();
      } else if (e.altKey && (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц')) {
        e.preventDefault();
        setActiveWorkspaceView(activeWorkspaceView === 'whiteboard' ? 'editor' : 'whiteboard');
      } else if (e.key === 'Escape' && activeWorkspaceView === 'whiteboard') {
        setActiveWorkspaceView('editor');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleCompass, activeWorkspaceView, setActiveWorkspaceView]);

  // Toast notification when AI writes to Whiteboard in background
  useEffect(() => {
    if (hasUnseenWhiteboardUpdate && activeWorkspaceView !== 'whiteboard') {
      showToast({
        type: 'info',
        title: '🎨 ИИ обновил доску',
        message: activeWhiteboardState?.title
          ? `«${activeWhiteboardState.title}» (нажмите Alt+W)`
          : 'Напарник оставил запись на доске (Alt+W)'
      });
    }
  }, [hasUnseenWhiteboardUpdate, activeWorkspaceView, activeWhiteboardState?.title, showToast]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setPracticeElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSaveDraft = async () => {
    if (!activePracticeChallenge) return;
    setIsSavingDraft(true);
    try {
      const res = await fetch('/api/practice/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challengeId: activePracticeChallenge.id,
          files: practiceWorkspaceFiles,
          activePhase: activePracticePhase,
          timeSpentSeconds: practiceElapsedSeconds
        })
      });
      if (res.ok) {
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.warn('Error saving practice draft:', e);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleCancelEvaluation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPracticeEvaluating(false);
  };

  const handleRunEvaluation = async () => {
    if (!activePracticeChallenge || isPracticeEvaluating) return;
    setIsPracticeEvaluating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/practice/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          challengeId: activePracticeChallenge.id,
          files: practiceWorkspaceFiles,
          activePhase: activePracticePhase,
          timeSpentSeconds: practiceElapsedSeconds
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setActivePracticeReport(data.evaluation);
      if (data.isPassed && academyBreadcrumbContext) {
        toggleAcademyStepProgress(
          academyBreadcrumbContext.courseId,
          academyBreadcrumbContext.stepNumber,
          true
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Evaluation cancelled by user.');
        return;
      }
      console.error('Evaluation error:', err);
      showToast({
        type: 'error',
        title: 'Ошибка проверки',
        message: err.message || 'Не удалось завершить оценку решения.'
      });
    } finally {
      setIsPracticeEvaluating(false);
      abortControllerRef.current = null;
    }
  };

  const handleResetWorkspace = async () => {
    if (!activePracticeChallenge) return;
    if (!window.confirm('Сбросить весь воркспейс к начальному состоянию? Текущие изменения будут удалены.')) {
      return;
    }

    try {
      await fetch(`/api/practice/reset/${activePracticeChallenge.id}`, { method: 'POST' });
      const initialFiles = activePracticeChallenge.workspaceFiles || activePracticeChallenge.phases?.[0]?.addedFiles || [];
      initialFiles.forEach((file, idx) => {
        updateWorkspaceFileContent(idx, file.content);
      });

      showToast({
        type: 'info',
        title: 'Воркспейс сброшен',
        message: 'Файлы возвращены к исходным шаблонам.'
      });
    } catch (e) {
      console.error('Error resetting workspace:', e);
    }
  };

  const [mutationResult, setMutationResult] = useState<MutationExecutionResponse | null>(null);

  const isWriteTheTestsMode = Boolean(
    activePracticeChallenge?.challengeMode === 'write_the_tests' ||
    activePracticeChallenge?.track === 'testing_mutation' ||
    (activePracticeChallenge?.mutants && activePracticeChallenge.mutants.length > 0)
  );

  const handleRunSandbox = async () => {
    if (!activePracticeChallenge || isSandboxRunning) return;
    setIsSandboxRunning(true);
    setSandboxResult(null);
    setMutationResult(null);

    try {
      if (isWriteTheTestsMode) {
        const res = await fetch('/api/sandbox/execute-mutation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            challengeId: activePracticeChallenge.id,
            files: practiceWorkspaceFiles,
            mutants: activePracticeChallenge.mutants || [],
            requiredScore: activePracticeChallenge.requiredMutationScore || 85
          })
        });

        const data: MutationExecutionResponse = await res.json();
        setMutationResult(data);

        if (data.passedThreshold) {
          showToast({
            type: 'success',
            title: 'Мутанты уничтожены! 🧬',
            message: `Mutation Score ${data.mutationScore.toFixed(1)}% (убито ${data.killedCount}/${data.totalMutants})`
          });
        } else if (!data.baselinePassed) {
          showToast({
            type: 'error',
            title: 'Baseline не пройден',
            message: data.error || 'Тесты кандидата упали на эталонном сервисе'
          });
        } else {
          showToast({
            type: 'warning',
            title: 'Мутанты выжили!',
            message: `Mutation Score ${data.mutationScore.toFixed(1)}% (требуется >= ${data.requiredScore}%)`
          });
        }
      } else {
        const res = await fetch('/api/sandbox/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            challengeId: activePracticeChallenge.id,
            files: practiceWorkspaceFiles,
            activePhase: activePracticePhase
          })
        });

        const data: SandboxExecutionResponse = await res.json();
        setSandboxResult(data);

        if (data.success) {
          showToast({
            type: 'success',
            title: 'Тесты пройдены!',
            message: `Все тесты (${data.passedCount}/${data.testResults.length}) выполнены за ${data.executionTimeMs}мс`
          });
        } else if (!data.isCompilable) {
          showToast({
            type: 'error',
            title: 'Ошибка компиляции',
            message: data.syntaxErrors?.[0]?.errorMessage || 'Проверьте синтаксис кода'
          });
        } else {
          showToast({
            type: 'warning',
            title: 'Тесты не пройдены',
            message: `Провалено ${data.failedCount} из ${data.testResults.length} тестов`
          });
        }
      }
    } catch (err: any) {
      console.error('Sandbox execution error:', err);
      showToast({
        type: 'error',
        title: 'Сетевая ошибка',
        message: err.message || 'Не удалось связаться с песочницей Java'
      });
    } finally {
      setIsSandboxRunning(false);
    }
  };

  if (!currentFile || !activePracticeChallenge) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* File Tabs Header with smooth mobile touch pan */}
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1.5 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x py-0.5">
          {practiceWorkspaceFiles.map((file, idx) => {
            const isActive = activeWorkspaceView === 'editor' && activeWorkspaceFileIndex === idx;
            const fileName = file.path.split('/').pop() || file.path;

            return (
              <button
                key={file.path}
                onClick={() => {
                  setActiveWorkspaceFileIndex(idx);
                  setActiveWorkspaceView('editor');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer shrink-0 min-h-[36px] ${
                  isActive
                    ? 'bg-slate-800 text-pastel-accentRose border border-pastel-accentRose/40 font-bold shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-pastel-accentRose' : 'text-slate-500'}`} />
                <span>{fileName}</span>
                {file.readOnly && (
                  <span title="Read-only test contract" className="ml-0.5">
                    <Lock className="w-3 h-3 text-slate-500" />
                  </span>
                )}
              </button>
            );
          })}

          {/* Integrated AI Whiteboard Tab */}
          <div className="h-5 w-px bg-slate-800 shrink-0 mx-1" />
          <button
            onClick={() => setActiveWorkspaceView(activeWorkspaceView === 'whiteboard' ? 'editor' : 'whiteboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer shrink-0 min-h-[36px] ${
              activeWorkspaceView === 'whiteboard'
                ? 'bg-gradient-to-r from-violet-900/80 via-purple-900/70 to-indigo-900/80 text-white border border-purple-400/50 font-bold shadow-md ring-1 ring-purple-400/30'
                : hasUnseenWhiteboardUpdate
                ? 'bg-amber-950/50 text-amber-300 border border-amber-500/50 hover:bg-amber-900/50 animate-pulse'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Интерактивная доска ИИ (нажмите или Alt + W)"
          >
            <Sparkles className={`w-3.5 h-3.5 ${hasUnseenWhiteboardUpdate ? 'text-amber-400 animate-spin' : activeWorkspaceView === 'whiteboard' ? 'text-purple-300' : 'text-slate-500'}`} />
            <span>Доска ИИ</span>
            {codeRevisions && codeRevisions.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeWorkspaceView === 'whiteboard' ? 'bg-purple-400/30 text-purple-200' : 'bg-slate-800 text-slate-400'
              }`}>
                v{codeRevisions.length}
              </span>
            )}
            {hasUnseenWhiteboardUpdate && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            <kbd className="hidden xl:inline text-[9px] px-1 rounded bg-slate-900/80 text-slate-400 font-mono">Alt+W</kbd>
          </button>
        </div>


        {/* Timer & Status in Header */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs">
          {/* Compass Quick Button */}
          <button
            onClick={() => toggleCompass()}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-pastel-accentRose border border-pastel-accentRose/30 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            title="Testing Compass (Ctrl + /)"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Компас</span>
            <kbd className="hidden lg:inline text-[9px] px-1 rounded bg-slate-900 text-slate-400 font-mono">Ctrl+/</kbd>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-pastel-accentRose animate-pulse" />
            <span>{formatTime(practiceElapsedSeconds)}</span>
          </div>

          {lastSavedTime && (
            <span className="text-[10px] text-slate-500 hidden md:inline">
              Сохранено в {lastSavedTime}
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace Area: Either Whiteboard Surface or Code Editor */}
      {activeWorkspaceView === 'whiteboard' ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#121622] text-slate-200 p-4 custom-scrollbar">
          {/* Whiteboard Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 rounded-2xl border border-purple-500/30 shadow-lg mb-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs text-white truncate">
                    {activeWhiteboardState?.title || 'Интерактивная доска напарника'}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                    {activeWhiteboardState?.action === 'patch'
                      ? '🔧 Diff / Изменения'
                      : activeWhiteboardState?.action === 'highlight'
                      ? '🔍 Разбор строк'
                      : '✨ Демонстрация ИИ'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {activeWhiteboardState?.language?.toUpperCase() || 'JAVA 21'} • Интерактивный артефакт в реальном времени
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveWorkspaceView('editor')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Вернуться к коду задачи (Esc или Alt+W)"
              >
                <span>← Вернуться к коду</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">Esc</kbd>
              </button>
            </div>
          </div>

          {/* Optional Explanation Callout */}
          {activeWhiteboardState?.explanation && (
            <div className="mb-3 px-4 py-2.5 bg-gradient-to-r from-purple-950/40 via-[#141220] to-indigo-950/40 border border-purple-500/30 rounded-2xl flex items-start gap-2 text-xs text-slate-300 leading-relaxed shadow-xs shrink-0">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <p className="text-[11px]">{activeWhiteboardState.explanation}</p>
            </div>
          )}

          {/* Highlight Lines Notification */}
          {activeWhiteboardState?.highlightLines && activeWhiteboardState.highlightLines.length > 0 && (
            <div className="mb-3 px-4 py-1.5 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-center gap-2 text-[10px] text-amber-300 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Фокус на строках: {activeWhiteboardState.highlightLines.join(', ')}</span>
            </div>
          )}

          {/* Code Artifact Revisions Timeline & Diff Viewer */}
          {codeRevisions && codeRevisions.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              <CodeArtifactTimeline showDiffToggle={true} />
            </div>
          ) : activeWhiteboardState?.code ? (
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              <CodeArtifactTimeline showDiffToggle={true} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500">
              <Sparkles className="w-10 h-10 text-purple-400/40 mb-3 animate-pulse" />
              <h4 className="text-sm font-bold text-slate-300 mb-1">Доска пока пуста</h4>
              <p className="text-xs max-w-md text-slate-400 mb-4">
                Спросите голосового напарника или попросите его показать пример: «Напиши на доске пример для этого класса» — и код появится здесь с историей ревизий и подсветкой diff.
              </p>
              <button
                onClick={() => setActiveWorkspaceView('editor')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Вернуться в редактор кода
              </button>
            </div>
          )}
        </div>
      ) : (
        /* CodeMirror 6 Editor Body with Ctrl+Enter shortcut */
        <div 
          className="flex-1 flex overflow-hidden relative font-mono text-xs"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleRunSandbox();
            }
          }}
        >
          <CodeMirror
            value={currentFile.content}
            height="100%"
            className="w-full h-full custom-codemirror-container"
            theme={luxuryPastelTheme}
            extensions={[java()]}
            readOnly={currentFile.readOnly}
            editable={!currentFile.readOnly}
            indentWithTab={true}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              history: true,
              foldGutter: true,
              drawSelection: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              defaultKeymap: true,
              searchKeymap: true,
              historyKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true
            }}
            onChange={(value) => {
              updateWorkspaceFileContent(activeWorkspaceFileIndex, value);
            }}
          />

          {currentFile.readOnly && (
            <div className="absolute top-3 right-5 bg-slate-900/90 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-md border border-slate-700 pointer-events-none flex items-center gap-1.5 shadow-md z-10">
              <Lock className="w-3 h-3 text-amber-400" /> Контракт (Read-Only)
            </div>
          )}
        </div>
      )}

      {/* Slide-Up In-Memory Sandbox Test Console (< 80ms) */}
      <SandboxTestConsole
        result={sandboxResult}
        mutationResult={mutationResult}
        isRunning={isSandboxRunning}
        onClose={() => {
          setSandboxResult(null);
          setMutationResult(null);
        }}
        requiredMutationScore={activePracticeChallenge.requiredMutationScore || 85}
      />

      {/* Action Footer Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {activePracticeChallenge.goldenMasterConfig?.enabled && (
            <button
              onClick={() => setIsDiffOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold transition border border-emerald-500/30 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Golden Master Diff</span>
            </button>
          )}

          <button
            onClick={handleSaveDraft}
            disabled={isSavingDraft || isPracticeEvaluating || isSandboxRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 cursor-pointer"
            title="Сохранить черновик"
          >
            {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Сохранить</span>
          </button>

          <button
            onClick={handleResetWorkspace}
            disabled={isPracticeEvaluating || isSandboxRunning}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            title="Сбросить воркспейс к начальному состоянию"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live AST Invariant Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
          {liveAstViolations.length === 0 ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Инварианты соблюдены (Clock, BigDecimal)</span>
            </span>
          ) : (
            <span
              className="text-amber-300 font-medium flex items-center gap-1.5 text-[11px]"
              title={liveAstViolations.map(v => v.text).join('\n')}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="max-w-[240px] truncate">{liveAstViolations[0].text}</span>
              {liveAstViolations.length > 1 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-[10px]">
                  +{liveAstViolations.length - 1}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Action Run Buttons (Sandbox & AI Review) */}
        <div className="flex items-center gap-2">
          {/* Fast In-Memory Java 21 Sandbox / Mutation Run Button */}
          <button
            type="button"
            onClick={handleRunSandbox}
            disabled={isSandboxRunning || isPracticeEvaluating}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-xs transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${
              isWriteTheTestsMode
                ? 'bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white shadow-rose-600/25'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
            }`}
            title={isWriteTheTestsMode ? 'Прогон тестов кандидата против мутантов байткода (Ctrl+Enter)' : 'Быстрый прогон JUnit 5 тестов в Java 21 Sandbox (Ctrl+Enter)'}
          >
            {isSandboxRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isWriteTheTestsMode ? (
              <Bug className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>
              {isSandboxRunning
                ? (isWriteTheTestsMode ? 'Анализ мутаций...' : 'Запуск тестов...')
                : (isWriteTheTestsMode ? '▶ Проверить на мутантах' : '▶ Тесты (Java 21)')}
            </span>
            <span className="hidden sm:inline text-[10px] opacity-75 font-mono">(Ctrl+↵)</span>
          </button>

          {/* Senior AI Review Button */}
          {isPracticeEvaluating ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEvaluation}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition border border-rose-500/30 cursor-pointer"
              >
                Отменить
              </button>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-800 border border-pastel-accentRose/40 text-slate-200 text-xs font-bold shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pastel-accentRose" />
                <span>Анализ Gemini 3.7...</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleRunEvaluation}
              disabled={isSandboxRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-xs hover:opacity-95 transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Senior AI Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Golden Master Diff Modal */}
      {activePracticeChallenge.goldenMasterConfig && (
        <GoldenMasterDiffViewer
          config={activePracticeChallenge.goldenMasterConfig}
          isOpen={isDiffOpen}
          onClose={() => setIsDiffOpen(false)}
        />
      )}
    </div>
  );
};
