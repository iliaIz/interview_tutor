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
  Clock
} from 'lucide-react';
import { GoldenMasterDiffViewer } from './GoldenMasterDiffViewer';

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
    showToast
  } = useAppStore();

  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

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

  if (!currentFile || !activePracticeChallenge) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* File Tabs Header with smooth mobile touch pan */}
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1.5 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x py-0.5">
          {practiceWorkspaceFiles.map((file, idx) => {
            const isActive = activeWorkspaceFileIndex === idx;
            const fileName = file.path.split('/').pop() || file.path;

            return (
              <button
                key={file.path}
                onClick={() => setActiveWorkspaceFileIndex(idx)}
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
        </div>


        {/* Timer & Status in Header */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
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

      {/* CodeMirror 6 Editor Body */}
      <div className="flex-1 flex overflow-hidden relative font-mono text-xs">
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
            disabled={isSavingDraft || isPracticeEvaluating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 cursor-pointer"
            title="Сохранить черновик"
          >
            {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Сохранить</span>
          </button>

          <button
            onClick={handleResetWorkspace}
            disabled={isPracticeEvaluating}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            title="Сбросить воркспейс к начальному состоянию"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Run / Cancel Evaluation Button */}
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
              <span>Анализ Gemini 3.7 Flash...</span>
            </div>
          </div>
        ) : (
          <button
            onClick={handleRunEvaluation}
            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-xs hover:opacity-95 transition shadow-md active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Запустить проверку (Senior AI Review)</span>
          </button>
        )}
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
