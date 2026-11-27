import React from 'react';
import {
  Code2,
  X,
  Sparkles,
  Maximize2,
  Minimize2,
  Check,
  Copy,
  Info,
  RotateCcw,
  Laptop
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { CodeArtifactTimeline } from './CodeArtifactTimeline';
import {
  WhiteboardState,
  useAppStore,
  selectActiveWhiteboardArtifact,
  CodeArtifactRevision
} from '../store/useAppStore';
import { usePracticeTutorStore } from '../store/usePracticeTutorStore';
import { useWhiteboardIdeBridge } from '../hooks/useWhiteboardIdeBridge';
import { WhiteboardIdeModal } from './WhiteboardIdeModal';

export interface WhiteboardPanelContentProps {
  state: WhiteboardState | null;
  onClose: () => void;
  mode?: 'drawer' | 'dock';
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSwitchToTutor?: () => void;
}

export const WhiteboardPanelContent: React.FC<WhiteboardPanelContentProps> = ({
  state,
  onClose,
  mode = 'drawer',
  isExpanded = false,
  onToggleExpand,
  onSwitchToTutor
}) => {
  const [copied, setCopied] = React.useState(false);

  const practiceWorkspaceFiles = useAppStore((s) => s.practiceWorkspaceFiles);
  const activeWorkspaceFileIndex = useAppStore((s) => s.activeWorkspaceFileIndex);
  const updateWorkspaceFileContent = useAppStore((s) => s.updateWorkspaceFileContent);
  const showToast = useAppStore((s) => s.showToast);
  const codeRevisions = useAppStore((s) => s.codeRevisions);
  const activeRevisionId = useAppStore((s) => s.activeRevisionId);
  const activeWhiteboardState = useAppStore((s) => s.activeWhiteboardState);
  const checkoutRevisionToIde = useAppStore((s) => s.checkoutRevisionToIde);
  const toggleTutorDrawer = usePracticeTutorStore((s) => s.toggleOpen);

  const activeArtifact = React.useMemo(
    () => selectActiveWhiteboardArtifact({ codeRevisions, activeRevisionId, activeWhiteboardState }),
    [codeRevisions, activeRevisionId, activeWhiteboardState]
  );

  const activeCode =
    typeof activeArtifact?.code === 'string'
      ? activeArtifact.code
      : typeof state?.code === 'string'
      ? state.code
      : '';
  const activeTitle = activeArtifact?.title || state?.title || 'Интерактивная доска ИИ';
  const activeLanguage = activeArtifact?.language || state?.language || 'java';
  const activeExplanation = activeArtifact?.explanation || state?.explanation;
  const activeHighlightLines = Array.isArray(activeArtifact?.highlightLines)
    ? activeArtifact.highlightLines
    : Array.isArray(state?.highlightLines)
    ? state.highlightLines
    : [];
  const activeAction = activeArtifact?.action || state?.action || 'write';

  const {
    status: ideStatus,
    workspaceDir: ideWorkspaceDir,
    lastSyncTime: ideLastSyncTime,
    isModalOpen: isIdeModalOpen,
    setIsModalOpen: setIsIdeModalOpen,
    isDownloading: isIdeDownloading,
    checkoutCode,
    downloadWhiteboardZip
  } = useWhiteboardIdeBridge();

  const handleCheckoutToIde = React.useCallback(
    (rev: CodeArtifactRevision) => {
      checkoutCode(rev.code);
      checkoutRevisionToIde(rev.id);
      showToast({
        type: 'success',
        title: 'Загружено в IDE',
        message: `Версия v${rev.index} успешно записана в Whiteboard.java`
      });
    },
    [checkoutCode, checkoutRevisionToIde, showToast]
  );

  const hasCode = Boolean(typeof activeCode === 'string' && activeCode.trim().length > 0);
  const hasRevisions = Boolean(Array.isArray(codeRevisions) && codeRevisions.length > 0);

  const actionLabel =
    activeAction === 'patch'
      ? 'Diff / Изменения'
      : activeAction === 'highlight'
      ? 'Разбор строк'
      : hasCode
      ? 'Демонстрация ИИ'
      : 'Интерактивная доска';

  const handleCopy = () => {
    if (activeCode) {
      navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsertIntoEditor = () => {
    if (activeCode && practiceWorkspaceFiles[activeWorkspaceFileIndex]) {
      const current = practiceWorkspaceFiles[activeWorkspaceFileIndex];
      updateWorkspaceFileContent(activeWorkspaceFileIndex, activeCode);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workspace_file_updated', {
            detail: { path: current.path, content: activeCode, language: 'java' }
          })
        );
      }
      showToast({
        type: 'success',
        title: 'Код перенесён',
        message: 'Код с доски вставлен в активный файл редактора'
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#121622] text-slate-200 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#181E2E] border-b border-[#2A344E] select-none gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#B5433E] flex items-center justify-center text-white shadow-xs shrink-0">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs text-white truncate">{activeTitle}</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pastel-accentViolet/20 text-purple-200 border border-pastel-accentViolet/40 shrink-0">
                {actionLabel}
              </span>
            </div>
            <p className="text-[10px] text-slate-300 truncate">
              {activeLanguage ? activeLanguage.toUpperCase() : 'JAVA 21'} • Артефакты и код AI-Напарника
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsIdeModalOpen(true)}
            className={`min-h-[28px] px-2 py-1 rounded-lg transition cursor-pointer border text-xs font-semibold flex items-center gap-1.5 ${
              ideStatus === 'connected' || ideStatus === 'syncing'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                : ideStatus === 'connecting'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-[#1E1A2E] hover:bg-[#2A243E] text-slate-200 hover:text-white border-[#2A243E]'
            }`}
            title="Подключить IntelliJ IDEA к доске (ws://127.0.0.1:41790)"
          >
            <Laptop className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span className="hidden sm:inline text-[11px]">
              {ideStatus === 'connected'
                ? 'IDE: Подключена'
                : ideStatus === 'syncing'
                ? 'Синхронизация...'
                : 'В IntelliJ'}
            </span>
          </button>

          {hasCode && practiceWorkspaceFiles.length > 0 && (
            <button
              type="button"
              onClick={handleInsertIntoEditor}
              className="min-h-[28px] px-2 py-1 rounded-lg bg-[#B5433E]/25 hover:bg-[#B5433E]/40 text-rose-200 hover:text-white transition cursor-pointer border border-[#B5433E]/50 text-xs font-bold flex items-center gap-1"
              title="Вставить код с доски в активный файл редактора"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Вставить</span>
            </button>
          )}

          {hasCode && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Скопировать код с доски"
              className="min-w-[28px] min-h-[28px] p-1.5 rounded-lg bg-[#1E1A2E] hover:bg-[#2A243E] text-slate-200 hover:text-white transition cursor-pointer border border-[#2A243E] flex items-center justify-center"
              title="Скопировать весь код"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {mode === 'drawer' && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={isExpanded ? 'Свернуть размер доски' : 'Развернуть доску'}
              className="min-w-[28px] min-h-[28px] p-1.5 rounded-lg bg-[#1E1A2E] hover:bg-[#2A243E] text-slate-200 hover:text-white transition cursor-pointer border border-[#2A243E] flex items-center justify-center"
              title={isExpanded ? 'Свернуть размер' : 'Развернуть на весь экран'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {mode === 'drawer' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть доску ИИ"
              className="min-w-[28px] min-h-[28px] p-1.5 rounded-lg bg-[#1E1A2E] hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 transition cursor-pointer border border-[#2A243E] flex items-center justify-center"
              title="Свернуть доску"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Optional Explanation Callout */}
      {activeExplanation && (
        <div className="px-4 py-2 bg-[#161B2B] border-b border-[#2A344E] flex items-start gap-2 text-xs text-slate-200 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-purple-300 shrink-0 mt-0.5" />
          <p className="text-[11px]">{activeExplanation}</p>
        </div>
      )}

      {/* Highlight Lines Badge */}
      {activeHighlightLines.length > 0 && (
        <div className="px-4 py-1.5 bg-[#12111E] border-b border-[#2A243E] flex items-center gap-2 text-[10px] text-amber-300">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Обратите внимание на строки: {activeHighlightLines.join(', ')}</span>
        </div>
      )}

      {/* Code Artifact History & Viewer Body */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3.5 custom-scrollbar space-y-3">
        {hasRevisions ? (
          <CodeArtifactTimeline
            showDiffToggle={true}
            onCheckoutToIde={handleCheckoutToIde}
            isIdeConnected={ideStatus === 'connected'}
          />
        ) : hasCode ? (
          <CodeViewer code={activeCode} language={activeLanguage} />
        ) : (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-100 mb-1">Доска пока пуста</h4>
            <p className="text-xs text-slate-300 max-w-sm leading-relaxed mb-4">
              Попросите AI-Напарника голосом или в чате показать архитектурный набросок, сигнатуру класса или diff-патч к вашему решению.
            </p>
            <button
              type="button"
              onClick={() => {
                if (onSwitchToTutor) {
                  onSwitchToTutor();
                } else {
                  toggleTutorDrawer(true);
                  onClose();
                }
              }}
              className="px-4 py-2 rounded-xl bg-[#B5433E] hover:bg-[#9B3B36] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              Открыть чат с AI-Напарником
            </button>
          </div>
        )}

        {hasCode && (
          <div className="text-[10px] text-slate-300 font-mono flex items-center justify-between pt-1">
            <span>Интерактивный артефакт ИИ</span>
            <span>Строк: {activeCode.split('\n').length}</span>
          </div>
        )}
      </div>

      {/* Footer Bar */}
      <div className="px-4 py-2 bg-[#141220] border-t border-[#2A243E] flex items-center justify-between text-[11px] text-slate-300">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Синхронизировано с AI-Напарником</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="touch-target-44 min-h-[28px] px-2.5 py-1 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800/70 transition cursor-pointer"
        >
          Свернуть панель
        </button>
      </div>

      <WhiteboardIdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        status={ideStatus}
        workspaceDir={ideWorkspaceDir}
        lastSyncTime={ideLastSyncTime}
        isDownloading={isIdeDownloading}
        onDownloadZip={downloadWhiteboardZip}
      />
    </div>
  );
};

export default WhiteboardPanelContent;
