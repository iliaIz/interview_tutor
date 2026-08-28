import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Play,
  RotateCcw,
  Save,
  FileCode,
  Lock,
  Loader2,
  Check,
  Shield,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { GoldenMasterDiffViewer } from './GoldenMasterDiffViewer';

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const linePrefix = value.substring(lineStart, lineStart + 4);
        if (linePrefix === '    ') {
          const newValue = value.substring(0, lineStart) + value.substring(lineStart + 4);
          updateWorkspaceFileContent(activeWorkspaceFileIndex, newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4);
          }, 0);
        }
      } else {
        const newValue = value.substring(0, start) + '    ' + value.substring(end);
        updateWorkspaceFileContent(activeWorkspaceFileIndex, newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        }, 0);
      }
    }
  };

  const handleResetWorkspace = async () => {
    if (!activePracticeChallenge) return;
    if (!window.confirm('Сбросить весь воркспейс к начальному состоянию? Текущие изменения будут удалены.')) {
      return;
    }

    try {
      await fetch(`/api/practice/reset/${activePracticeChallenge.id}`, { method: 'POST' });
      // Reset local files to seed files
      activePracticeChallenge.workspaceFiles.forEach((file, idx) => {
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

  const lines = currentFile.content.split('\n');

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* File Tabs Header */}
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1.5 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {practiceWorkspaceFiles.map((file, idx) => {
            const isActive = activeWorkspaceFileIndex === idx;
            const fileName = file.path.split('/').pop() || file.path;

            return (
              <button
                key={file.path}
                onClick={() => setActiveWorkspaceFileIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-pastel-accentRose border border-pastel-accentRose/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-pastel-accentRose' : 'text-slate-500'}`} />
                <span>{fileName}</span>
                {file.readOnly && (
                  <span title="Read-only contract">
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

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers */}
        <div className="w-12 bg-slate-950 py-3 text-right pr-3 select-none text-slate-600 font-mono text-xs border-r border-slate-900 leading-6">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Text Area / Code Content */}
        <div className="flex-1 relative overflow-auto custom-scrollbar">
          <textarea
            value={currentFile.content}
            disabled={currentFile.readOnly}
            onChange={(e) => updateWorkspaceFileContent(activeWorkspaceFileIndex, e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className={`w-full h-full p-3 font-mono text-xs leading-6 bg-transparent text-slate-100 resize-none focus:outline-none custom-scrollbar ${
              currentFile.readOnly ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            style={{ tabSize: 4 }}
          />

          {currentFile.readOnly && (
            <div className="absolute top-3 right-3 bg-slate-800/90 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md border border-slate-700 pointer-events-none flex items-center gap-1">
              <Lock className="w-3 h-3" /> Контракт (Read-Only)
            </div>
          )}
        </div>
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
