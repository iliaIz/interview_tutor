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
  Laptop,
  Download
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';

export type VersionVisualRole = 'active_and_synced' | 'active_only' | 'synced_background' | 'neutral';

export function getVersionVisualRole(
  revId: string,
  activeId: string | null | undefined,
  syncedId: string | null | undefined
): VersionVisualRole {
  const isActive = Boolean(activeId && revId === activeId);
  const isSynced = Boolean(syncedId && revId === syncedId);

  if (isActive && isSynced) return 'active_and_synced';
  if (isActive) return 'active_only';
  if (isSynced) return 'synced_background';
  return 'neutral';
}

export interface CodeArtifactTimelineProps {
  className?: string;
  onSelectRevision?: (rev: CodeArtifactRevision) => void;
  showDiffToggle?: boolean;
  onCheckoutToIde?: (rev: CodeArtifactRevision) => void;
  isIdeConnected?: boolean;
}

export const CodeArtifactTimeline: React.FC<CodeArtifactTimelineProps> = ({
  className = '',
  onSelectRevision,
  showDiffToggle = true,
  onCheckoutToIde,
  isIdeConnected = false
}) => {
  const {
    codeRevisions,
    activeRevisionId,
    activeIdeRevisionId,
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
            const role = getVersionVisualRole(rev.id, activeRev?.id, activeIdeRevisionId);
            const isSynced = rev.id === activeIdeRevisionId || Boolean(rev.isIdeTracked);
            const isActive = role === 'active_and_synced' || role === 'active_only';

            const roleClass =
              role === 'active_and_synced'
                ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold shadow-sm ring-2 ring-emerald-400'
                : role === 'active_only'
                ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold shadow-sm ring-1 ring-white/30'
                : role === 'synced_background'
                ? 'bg-emerald-950/60 text-emerald-300 border-2 border-emerald-500/80 shadow-xs font-semibold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60';

            return (
              <button
                key={rev.id}
                onClick={() => handleSelect(rev)}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-[11px] transition-all cursor-pointer shrink-0 ${roleClass}`}
                title={`Версия ${rev.index}: ${rev.title}${isSynced ? ' (Синхронизировано с IDE)' : ''}`}
              >
                <span>v{rev.index}</span>
                {isSynced ? (
                  <Laptop className={`w-3 h-3 ${isActive ? 'text-emerald-200' : 'text-emerald-400'}`} />
                ) : rev.author === 'ai' ? (
                  <Sparkles className={`w-3 h-3 ${isActive ? 'text-amber-200' : 'text-amber-400'}`} />
                ) : (
                  <User className={`w-3 h-3 ${isActive ? 'text-cyan-200' : 'text-cyan-400'}`} />
                )}
                {isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ) : role === 'synced_background' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Right: Actions (Checkout to IDE, Diff View & Copy) */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {activeRev && onCheckoutToIde && isIdeConnected && activeRev.id !== activeIdeRevisionId && (
            <button
              type="button"
              onClick={() => onCheckoutToIde(activeRev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition cursor-pointer"
              title="Загрузить эту версию в локальную IntelliJ IDEA (Whiteboard.java)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">В IDE</span>
            </button>
          )}
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
              revisionIndex={activeRev.index}
              revisionTitle={activeRev.title}
              revisionId={activeRev.id}
            />
          ) : (
            <CodeViewer
              code={activeRev.code}
              language={activeRev.language}
              isDiff={false}
              title={`Версия ${activeRev.index}: ${activeRev.title}`}
              showLineNumbers={true}
              revisionIndex={activeRev.index}
              revisionTitle={activeRev.title}
              revisionId={activeRev.id}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default CodeArtifactTimeline;
