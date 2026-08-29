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
  Info
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { WhiteboardState } from '../store/useAppStore';

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
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  if (!state || !state.code) return null;

  const isDiff = state.action === 'patch';
  const actionLabel =
    state.action === 'patch'
      ? '🔧 Diff / Изменения'
      : state.action === 'highlight'
      ? '🔍 Разбор строк'
      : '✨ Демонстрация ИИ';

  const handleCopy = () => {
    if (state.code) {
      navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          className={`fixed top-4 bottom-4 right-4 z-50 rounded-3xl bg-[#0B0C10]/95 backdrop-blur-2xl border border-pastel-accentViolet/30 shadow-2xl flex flex-col overflow-hidden text-slate-200 ${
            isExpanded ? 'w-[calc(100vw-2rem)] max-w-4xl' : 'w-full max-w-lg'
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#141220]/90 border-b border-[#2A243E] select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-xs shrink-0">
                <Code2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs text-white truncate">
                    {state.title || 'Интерактивная доска'}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pastel-accentViolet/20 text-pastel-accentViolet border border-pastel-accentViolet/30 shrink-0">
                    {actionLabel}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {state.language ? state.language.toUpperCase() : 'JAVA 21'} • Только демонстрация
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-[#1E1A2E] hover:bg-[#2A243E] text-slate-300 hover:text-white transition cursor-pointer border border-[#2A243E]"
                title="Скопировать весь код"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

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
          {state.explanation && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-pastel-accentViolet/10 via-[#141220] to-pastel-accentRose/10 border-b border-[#2A243E] flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-pastel-accentViolet shrink-0 mt-0.5" />
              <p className="text-[11px]">{state.explanation}</p>
            </div>
          )}

          {/* Highlight Lines Badge (if any) */}
          {state.highlightLines && state.highlightLines.length > 0 && (
            <div className="px-4 py-1.5 bg-[#12111E] border-b border-[#2A243E] flex items-center gap-2 text-[10px] text-amber-300">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Обратите внимание на строки: {state.highlightLines.join(', ')}</span>
            </div>
          )}

          {/* Code Viewer Body */}
          <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar">
            <CodeViewer
              code={state.code}
              language={state.language || 'java'}
              isDiff={isDiff}
              showLineNumbers={true}
              className="border-none shadow-none"
            />
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2 bg-[#141220]/90 border-t border-[#2A243E] flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Синхронизировано с голосом ИИ</span>
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
    </AnimatePresence>
  );
};

export default WhiteboardDrawer;
