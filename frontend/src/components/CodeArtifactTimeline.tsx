import React, { useState, useMemo } from 'react';
import { useAppStore, CodeArtifactRevision } from '../store/useAppStore';
import {
  History,
  GitCommit,
  GitCompare,
  Copy,
  Check,
  Sparkles,
  User,
  Eye,
  FileCode,
  Layers,
  Zap
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';

export interface CodeArtifactTimelineProps {
  className?: string;
  onSelectRevision?: (rev: CodeArtifactRevision) => void;
  showDiffToggle?: boolean;
  embedded?: boolean;
  onApplyToWorkspace?: (code: string) => void;
  onClose?: () => void;
}

export const CodeArtifactTimeline: React.FC<CodeArtifactTimelineProps> = ({
  className = '',
  onSelectRevision,
  showDiffToggle = true,
  embedded = false,
  onApplyToWorkspace,
  onClose
}) => {
  const {
    codeRevisions,
    activeRevisionId,
    setActiveRevision
  } = useAppStore();

  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');
  const [copied, setCopied] = useState(false);

  // Active revision resolution
  const activeRev = useMemo(() => {
    if (!codeRevisions || codeRevisions.length === 0) return null;
    if (activeRevisionId) {
      const found = codeRevisions.find((r) => r.id === activeRevisionId);
      if (found) return found;
    }
    return codeRevisions[codeRevisions.length - 1];
  }, [codeRevisions, activeRevisionId]);

  // Previous revision for diffing
  const prevRev = useMemo(() => {
    if (!activeRev || !codeRevisions) return null;
    const currentIndex = codeRevisions.findIndex((r) => r.id === activeRev.id);
    if (currentIndex > 0) {
      return codeRevisions[currentIndex - 1];
    }
    return null;
  }, [activeRev, codeRevisions]);

  // Unified diff calculation
  const unifiedDiff = useMemo(() => {
    if (!prevRev || !activeRev) return '';
    const oldLines = prevRev.code.split('\n');
    const newLines = activeRev.code.split('\n');

    const diffLines: string[] = [];
    let i = 0;
    let j = 0;

    while (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diffLines.push(` ${oldLines[i]}`);
        i++;
        j++;
      } else {
        diffLines.push(`-${oldLines[i]}`);
        diffLines.push(`+${newLines[j]}`);
        i++;
        j++;
      }
    }

    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
          diffLines.push(` ${oldLines[i]}`);
          i++;
          j++;
        }
      } else if (i < oldLines.length) {
        diffLines.push(`-${oldLines[i]}`);
        i++;
      } else if (j < newLines.length) {
        diffLines.push(`+${newLines[j]}`);
        j++;
      }
    }
    return diffLines.join('\n');
  }, [prevRev, activeRev]);

  if (!codeRevisions || codeRevisions.length === 0) {
    return null;
  }

  const handleSelect = (rev: CodeArtifactRevision) => {
    setActiveRevision(rev.id);
    if (onSelectRevision) {
      onSelectRevision(rev);
    }
  };

  const handleCopy = () => {
    if (!activeRev) return;
    navigator.clipboard.writeText(activeRev.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={embedded ? `flex-1 h-full w-full flex flex-col overflow-hidden bg-[#121622] ${className}` : `space-y-3 ${className}`}>
      {/* Header Bar with Version Selector */}
      {embedded ? (
        /* Unified IDE Whiteboard Sub-Header (Single Compact Row) */
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#151a27] border-b border-[#1e2638] text-xs shrink-0 select-none">
          {/* Left: Revisions Timeline Pills + Active Title */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
              <span className="text-[11px] font-bold text-slate-300">Ревизии:</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {codeRevisions.map((rev) => {
                const isActive = activeRev?.id === rev.id;
                return (
                  <button
                    key={rev.id}
                    onClick={() => handleSelect(rev)}
                    className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[11px] transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold shadow-xs ring-1 ring-white/30'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                    }`}
                    title={`Версия ${rev.index}: ${rev.title}`}
                  >
                    <span>v{rev.index}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>

            {activeRev && (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400 truncate border-l border-slate-700/60 pl-2 min-w-0">
                <span className="font-semibold text-slate-200 truncate">
                  {activeRev.title}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  • {new Date(activeRev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}
          </div>

          {/* Right: Actions (Diff View & Copy & Apply & Close) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {showDiffToggle && prevRev && (
              <button
                onClick={() => setViewMode((prev) => (prev === 'code' ? 'diff' : 'code'))}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                  viewMode === 'diff'
                    ? 'bg-pastel-accentViolet text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
                title="Сравнить с предыдущей версией"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>{viewMode === 'diff' ? 'Код' : `Дифф (v${prevRev.index})`}</span>
              </button>
            )}

            {onApplyToWorkspace && activeRev && (
              <button
                onClick={() => onApplyToWorkspace(activeRev.code)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-pastel-accentRose text-white hover:opacity-90 transition cursor-pointer shadow-2xs"
                title="Вставить код с доски в текущий файл редактора"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Применить к коду</span>
              </button>
            )}

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Скопировать активный код"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold transition cursor-pointer"
                title="Вернуться к коду задачи (Esc или Alt+W)"
              >
                <span>К коду</span>
                <kbd className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-slate-400 font-mono">Esc</kbd>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Standalone / Modal Multi-row Header */
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 text-xs shadow-lg">
            {/* Left: Revisions Timeline Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pastel-accentViolet px-2 py-0.5 rounded-lg bg-pastel-accentViolet/10 mr-1 shrink-0">
                <History className="w-3.5 h-3.5" />
                <span>Версии ({codeRevisions.length}/10):</span>
              </span>

              {codeRevisions.map((rev) => {
                const isActive = activeRev?.id === rev.id;
                return (
                  <button
                    key={rev.id}
                    onClick={() => handleSelect(rev)}
                    className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-[11px] transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold shadow-sm ring-1 ring-white/30'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                    }`}
                    title={`Версия ${rev.index}: ${rev.title}`}
                  >
                    <span>v{rev.index}</span>
                    {rev.author === 'ai' ? (
                      <Sparkles className={`w-3 h-3 ${isActive ? 'text-amber-200' : 'text-amber-400'}`} />
                    ) : (
                      <User className={`w-3 h-3 ${isActive ? 'text-cyan-200' : 'text-cyan-400'}`} />
                    )}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: Actions (Diff View & Copy) */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {showDiffToggle && prevRev && (
                <button
                  onClick={() => setViewMode((prev) => (prev === 'code' ? 'diff' : 'code'))}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    viewMode === 'diff'
                      ? 'bg-pastel-accentViolet text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                  title="Сравнить с предыдущей версией"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>{viewMode === 'diff' ? 'Чистый код' : `Дифф с v${prevRev.index}`}</span>
                </button>
              )}

              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition cursor-pointer"
                title="Скопировать активный код"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Revision Info Banner (Modal/Standalone only) */}
          {activeRev && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-pastel-lavender/30 rounded-xl border border-pastel-accentViolet/20 text-[11px] text-pastel-text">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-pastel-accentViolet shrink-0 font-mono">
                  [v{activeRev.index}] {activeRev.title}
                </span>
                <span className="text-slate-500 truncate text-[10px]">
                  • {new Date(activeRev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40 shrink-0">
                <Eye className="w-3 h-3 text-emerald-400" />
                <span>В фокусе ИИ</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code / Diff Body View */}
      {activeRev && (
        <div className={embedded ? "flex-1 h-full w-full overflow-hidden" : ""}>
          <CodeViewer
            code={viewMode === 'diff' && prevRev ? unifiedDiff : activeRev.code}
            language={activeRev.language}
            isDiff={viewMode === 'diff' && Boolean(prevRev)}
            title={embedded ? undefined : (viewMode === 'diff' ? `Дифф: v${prevRev?.index} ➔ v${activeRev.index}` : `Версия ${activeRev.index}: ${activeRev.title}`)}
            showLineNumbers={true}
            embedded={embedded}
            revisionIndex={activeRev.index}
            revisionTitle={activeRev.title}
            revisionId={activeRev.id}
          />
        </div>
      )}
    </div>
  );
};

export default CodeArtifactTimeline;
