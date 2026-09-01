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
  Layers
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';

export interface CodeArtifactTimelineProps {
  className?: string;
  onSelectRevision?: (rev: CodeArtifactRevision) => void;
  showDiffToggle?: boolean;
}

export const CodeArtifactTimeline: React.FC<CodeArtifactTimelineProps> = ({
  className = '',
  onSelectRevision,
  showDiffToggle = true
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

  // Previous revision for diff comparison
  const prevRev = useMemo(() => {
    if (!activeRev || !codeRevisions) return null;
    const activeIdx = codeRevisions.findIndex((r) => r.id === activeRev.id);
    if (activeIdx > 0) {
      return codeRevisions[activeIdx - 1];
    }
    return null;
  }, [activeRev, codeRevisions]);

  // Unified diff generator between prevRev and activeRev
  const unifiedDiff = useMemo(() => {
    if (!prevRev || !activeRev) return '';
    const oldLines = prevRev.code.split('\n');
    const newLines = activeRev.code.split('\n');
    const diffLines: string[] = [];

    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length) {
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
    <div className={`space-y-3 ${className}`}>
      {/* Header Bar with Version Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 text-xs shadow-lg">
        {/* Left: Revisions Timeline Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pastel-accentViolet px-2 py-1 rounded-lg bg-pastel-accentViolet/10 mr-1 shrink-0">
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

      {/* Active Revision Info Banner */}
      {activeRev && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-pastel-lavender/30 rounded-xl border border-pastel-accentViolet/20 text-[11px] text-pastel-text">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-pastel-accentViolet shrink-0 font-mono">
              [v{activeRev.index}] {activeRev.title}
            </span>
            <span className="text-slate-400 truncate text-[10px]">
              • {new Date(activeRev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
            <Eye className="w-3 h-3 text-emerald-600" />
            <span>ИИ видит эту версию в контексте</span>
          </div>
        </div>
      )}

      {/* Code / Diff Body View */}
      {activeRev && (
        <div>
          {viewMode === 'diff' && prevRev ? (
            <CodeViewer
              code={unifiedDiff}
              language={activeRev.language}
              isDiff={true}
              title={`Дифф: v${prevRev.index} ➔ v${activeRev.index} (${activeRev.title})`}
              showLineNumbers={true}
            />
          ) : (
            <CodeViewer
              code={activeRev.code}
              language={activeRev.language}
              isDiff={false}
              title={`Версия ${activeRev.index}: ${activeRev.title}`}
              showLineNumbers={true}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default CodeArtifactTimeline;
