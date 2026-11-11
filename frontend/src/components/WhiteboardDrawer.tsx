import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2,
  X,
  Sparkles,
  Layers,
  ChevronRight,
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
import { WhiteboardState, useAppStore, selectActiveWhiteboardArtifact, CodeArtifactRevision } from '../store/useAppStore';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePracticeTutorStore } from '../store/usePracticeTutorStore';
import { useWhiteboardIdeBridge } from '../hooks/useWhiteboardIdeBridge';
import { WhiteboardIdeModal } from './WhiteboardIdeModal';

export interface WhiteboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  state: WhiteboardState | null;
}

export const WhiteboardDrawer: React.FC<WhiteboardDrawerProps> = ({
  isOpen,
  onClose,
  state
}) => {
  useBodyScrollLock(isOpen);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const practiceWorkspaceFiles = useAppStore((s) => s.practiceWorkspaceFiles);
  const activeWorkspaceFileIndex = useAppStore((s) => s.activeWorkspaceFileIndex);
  const updateWorkspaceFileContent = useAppStore((s) => s.updateWorkspaceFileContent);
  const showToast = useAppStore((s) => s.showToast);
  const codeRevisions = useAppStore((s) => s.codeRevisions);
  const activeRevisionId = useAppStore((s) => s.activeRevisionId);
  const activeWhiteboardState = useAppStore((s) => s.activeWhiteboardState);

  // SOTA 2026: Memoized derived artifact based on atomic selectors — prevents render loops in Zustand 5 / Strict Mode
  const activeArtifact = React.useMemo(
    () => selectActiveWhiteboardArtifact({ codeRevisions, activeRevisionId, activeWhiteboardState }),
    [codeRevisions, activeRevisionId, activeWhiteboardState]
  );

  const activeCode = typeof activeArtifact?.code === 'string'
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

  const checkoutRevisionToIde = useAppStore((s) => s.checkoutRevisionToIde);

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

  const { toggleOpen: toggleTutorDrawer } = usePracticeTutorStore();

  // Close on Escape key press
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const hasCode = Boolean(typeof activeCode === 'string' && activeCode.trim().length > 0);
  const hasRevisions = Boolean(Array.isArray(codeRevisions) && codeRevisions.length > 0);

  const isDiff = activeAction === 'patch';
  const actionLabel =
    activeAction === 'patch'
      ? '🔧 Diff / Изменения'
      : activeAction === 'highlight'
      ? '🔍 Разбор строк'
      : hasCode
      ? '✨ Демонстрация ИИ'
      : '✨ Интерактивная доска';

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
        window.dispatchEvent(new CustomEvent('workspace_file_updated', {
          detail: { path: current.path, content: activeCode, language: 'java' }
        }));
      }
      showToast({
        type: 'success',
        title: 'Код перенесён',
        message: 'Код с доски вставлен в активный файл редактора'
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className={`fixed z-50 bg-[#121622]/95 backdrop-blur-2xl border-t md:border border-pastel-accentViolet/30 shadow-2xl flex flex-col overflow-hidden text-slate-200 transition-all duration-300 inset-x-0 bottom-0 top-12 rounded-t-3xl md:inset-auto md:top-4 md:bottom-4 md:right-4 md:rounded-3xl ${
            isExpanded ? 'md:w-[calc(100vw-2rem)] md:max-w-4xl' : 'md:w-full md:max-w-lg'
          }`}
        >
          {/* Mobile Drag Handle */}
          <div className="md:hidden flex items-center justify-center pt-2.5 pb-1 select-none">
            <div className="w-10 h-1.5 rounded-full bg-slate-600/80" />
          </div>

          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#181E2E]/90 border-b border-[#2A344E] select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-xs shrink-0">
                <Code2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs text-white truncate">
                    {activeTitle}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pastel-accentViolet/20 text-pastel-accentViolet border border-pastel-accentViolet/30 shrink-0">
                    {actionLabel}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {activeLanguage ? activeLanguage.toUpperCase() : 'JAVA 21'} • Артефакты и код AI-Напарника
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsIdeModalOpen(true)}
                className={`p-1.5 px-2.5 rounded-lg transition cursor-pointer border text-xs font-semibold flex items-center gap-1.5 ${
                  ideStatus === 'connected' || ideStatus === 'syncing'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                    : ideStatus === 'connecting'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-[#1E1A2E] hover:bg-[#2A243E] text-slate-300 hover:text-white border-[#2A243E]'
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
                  className="p-1.5 px-2.5 rounded-lg bg-pastel-accentRose/20 hover:bg-pastel-accentRose/30 text-pastel-accentRose hover:text-white transition cursor-pointer border border-pastel-accentRose/40 text-xs font-bold flex items-center gap-1.5"
                  title="Вставить код с доски в активный файл редактора"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Вставить в код</span>
                </button>
              )}

              {hasCode && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-[#1E1A2E] hover:bg-[#2A243E] text-slate-300 hover:text-white transition cursor-pointer border border-[#2A243E]"
                  title="Скопировать весь код"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg bg-[#1E1A2E] hover:bg-[#2A243E] text-slate-300 hover:text-white transition cursor-pointer border border-[#2A243E]"
                title={isExpanded ? 'Свернуть размер' : 'Развернуть на весь экран'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-[#1E1A2E] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition cursor-pointer border border-[#2A243E]"
                title="Свернуть доску"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Optional Explanation Callout */}
          {activeExplanation && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-pastel-accentViolet/10 via-[#141220] to-pastel-accentRose/10 border-b border-[#2A243E] flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-pastel-accentViolet shrink-0 mt-0.5" />
              <p className="text-[11px]">{activeExplanation}</p>
            </div>
          )}

          {/* Highlight Lines Badge (if any) */}
          {activeHighlightLines && activeHighlightLines.length > 0 && (
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
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-100 mb-1">Доска пока пуста</h4>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
                  Попросите AI-Напарника голосом или в чате показать архитектурный набросок, сигнатуру класса или diff-патч к вашему решению.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    toggleTutorDrawer(true);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-pastel-accentRose text-white text-xs font-bold shadow-2xs hover:opacity-90 transition cursor-pointer"
                >
                  Открыть чат с AI-Напарником
                </button>
              </div>
            )}

            {hasCode && (
              <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1">
                <span>Интерактивный артефакт ИИ</span>
                <span>Строк: {typeof activeCode === 'string' ? activeCode.split('\n').length : 0}</span>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2 bg-[#141220]/90 border-t border-[#2A243E] flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Синхронизировано с AI-Напарником</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              Свернуть панель ➔
            </button>
          </div>
        </motion.div>
      )}

      <WhiteboardIdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        status={ideStatus}
        workspaceDir={ideWorkspaceDir}
        lastSyncTime={ideLastSyncTime}
        isDownloading={isIdeDownloading}
        onDownloadZip={downloadWhiteboardZip}
      />
    </AnimatePresence>
  );
};

export default WhiteboardDrawer;
