import React, { useState, useEffect } from 'react';
import { usePracticeVoice } from './PracticeVoiceContext';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import {
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
  MessageSquare,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AmbientVoicePill: React.FC = () => {
  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    isUserSpeaking,
    isPauseHolding,
    isError,
    lastError,
    statusMessage,
    disconnect,
    handleInteraction,
    subscribeAudioLevel
  } = usePracticeVoice();

  const rmsBarRef = React.useRef<HTMLDivElement>(null);
  const [dismissedError, setDismissedError] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setDismissedError(false);
    }
  }, [isConnected]);

  useEffect(() => {
    return subscribeAudioLevel((db) => {
      if (rmsBarRef.current) {
        rmsBarRef.current.style.width = `${Math.min(100, Math.max(15, ((db + 60) / 45) * 100))}%`;
      }
    });
  }, [subscribeAudioLevel]);

  const isOpen = usePracticeTutorStore((s) => s.isOpen);
  const isCopilotStealth = usePracticeTutorStore((s) => s.isCopilotStealth);
  const exitStealthMode = usePracticeTutorStore((s) => s.exitStealthMode);

  const currentStudioTab = useAppStore((s) => s.currentStudioTab);
  const activePracticeChallenge = useAppStore((s) => s.activePracticeChallenge);
  const activeTransactionLabScenarioId = useAppStore((s) => s.activeTransactionLabScenarioId);

  const isPracticeIdeActive =
    currentStudioTab === 'practice' &&
    activePracticeChallenge !== null &&
    activeTransactionLabScenarioId === null;

  // In Practice IDE, PracticeArenaHeader hosts the Stealth Restore Pill (zero floating pills over editor/CTA)
  if (isPracticeIdeActive || isCopilotStealth) return null;
  if ((!isConnected && (!isError || dismissedError)) || isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="ambient-voice-pill"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        drag
        dragConstraints={{ left: -350, right: 350, top: -450, bottom: 20 }}
        dragElastic={0.08}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 p-2 pr-3 bg-slate-900/95 backdrop-blur-xl border border-pastel-accentRose/40 shadow-2xl rounded-2xl text-slate-100 ring-1 ring-white/10 select-none cursor-grab active:cursor-grabbing"
      >
        <button
          type="button"
          onClick={handleInteraction}
          aria-label={isAiSpeaking ? 'Перебить ИИ' : 'Переключить микрофон'}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
            isAiSpeaking
              ? 'bg-[#B5433E] text-white ring-2 ring-rose-400/50'
              : isPauseHolding
              ? 'bg-amber-600 text-white'
              : isUserSpeaking
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/50'
              : isRecording
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
          title={
            isAiSpeaking
              ? 'Нажмите, чтобы перебить ИИ (Barge-In)'
              : 'Нажмите, чтобы переключить микрофон'
          }
        >
          {isAiSpeaking ? (
            <Volume2 className="w-4 h-4" />
          ) : isPauseHolding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isUserSpeaking ? (
            <Mic className="w-4 h-4" />
          ) : isRecording ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </button>

        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isError ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            <span className="font-bold text-[11px] text-white truncate max-w-[140px]">
              {isError ? 'Сбой голосовой связи' : 'AI-Напарник в эфире'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-300 truncate max-w-[140px]">
              {isError
                ? lastError || statusMessage || 'Откройте панель для повтора'
                : isAiSpeaking
                ? 'ИИ говорит вслух...'
                : isUserSpeaking
                ? 'Слушаю вас...'
                : isRecording
                ? 'Ожидание голоса'
                : statusMessage}
            </span>

            {isRecording && !isAiSpeaking && (
              <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  ref={rmsBarRef}
                  className={`h-full transition-all duration-75 rounded-full ${
                    isUserSpeaking ? 'bg-emerald-400' : 'bg-slate-500'
                  }`}
                  style={{ width: '15%' }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700/80" />

        <button
          type="button"
          onClick={() => exitStealthMode('tutor')}
          aria-label="Развернуть панель AI-Напарника"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer border border-slate-700/60"
          title="Развернуть панель чата и подсказок"
        >
          <MessageSquare className="w-4 h-4 text-pastel-accentRose" />
        </button>

        {isError && !isConnected ? (
          <button
            type="button"
            onClick={() => setDismissedError(true)}
            aria-label="Скрыть уведомление об ошибке голосовой связи"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer border border-slate-700/60"
            title="Скрыть ошибку"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={disconnect}
            aria-label="Завершить голосовой вызов"
            className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white transition cursor-pointer border border-rose-500/40"
            title="Завершить голосовой вызов"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
