import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Toast: React.FC = () => {
  const { activeToast, hideToast } = useAppStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!activeToast) return;
    setCopied(false);

    // Auto-dismiss after 6 seconds if not an error, or 10 seconds if error
    const duration = activeToast.type === 'error' ? 10000 : 5000;
    const timer = setTimeout(() => {
      hideToast();
    }, duration);

    return () => clearTimeout(timer);
  }, [activeToast]);

  if (!activeToast) return null;

  const handleCopy = () => {
    const fullText = [
      activeToast.title,
      activeToast.message,
      activeToast.technicalDetails ? `Детали:\n${activeToast.technicalDetails}` : ''
    ].filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const getIcon = () => {
    switch (activeToast.type) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (activeToast.type) {
      case 'error':
        return 'border-red-200 bg-red-50/90 text-red-900';
      case 'success':
        return 'border-emerald-200 bg-emerald-50/90 text-emerald-900';
      case 'warning':
        return 'border-amber-200 bg-amber-50/90 text-amber-900';
      default:
        return 'border-blue-200 bg-blue-50/90 text-blue-900';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`pointer-events-auto shadow-xl rounded-2xl p-4 border backdrop-blur-md ${getBorderColor()}`}
        >
          <div className="flex items-start gap-3">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold tracking-tight leading-snug">{activeToast.title}</h4>
              {activeToast.message && (
                <p className="text-xs text-gray-700 mt-1 leading-relaxed break-words">{activeToast.message}</p>
              )}

              {activeToast.technicalDetails && (
                <div className="mt-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/80 hover:bg-white text-gray-700 border border-gray-200/80 shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Скопировано в буфер!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-gray-500" />
                          <span>Скопировать детали ошибки</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={hideToast}
              className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
