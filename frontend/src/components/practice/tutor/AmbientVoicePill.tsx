import React from 'react';
import { usePracticeVoice } from './PracticeVoiceContext';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import {
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
  Radio,
  Sparkles,
  MessageSquare,
  Bot,
  Loader2,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AmbientVoicePill: React.FC = () => {
  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    statusMessage,
    disconnectSession,
    handleCentralButtonClick
  } = usePracticeVoice();

  const { isOpen, toggleOpen } = usePracticeTutorStore();

  // Only show floating pill if voice session is active and side drawer is closed
  if (!isConnected || isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 p-2 pr-3 bg-slate-900/95 backdrop-blur-xl border border-pastel-accentRose/40 shadow-2xl rounded-2xl text-slate-100 ring-1 ring-white/10"
      >
        {/* Dynamic Glowing Status Circle Button */}
        <button
          onClick={handleCentralButtonClick}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
            isAiSpeaking
              ? 'bg-gradient-to-tr from-pink-500 to-rose-400 text-white animate-pulse ring-2 ring-rose-400/50'
              : isPauseHolding
              ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white animate-pulse'
              : isUserSpeaking
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-2 ring-emerald-400/50 scale-105'
              : isRecording
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title={
            isAiSpeaking
              ? 'Нажмите, чтобы перебить ИИ (Barge-In)'
              : 'Нажмите, чтобы переключить микрофон'
          }
        >
          {isAiSpeaking ? (
            <Volume2 className="w-4 h-4 animate-bounce" />
          ) : isPauseHolding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isUserSpeaking ? (
            <Mic className="w-4 h-4 animate-pulse" />
          ) : isRecording ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </button>

        {/* Status Info and Audio Wave */}
        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-[11px] text-white truncate max-w-[130px]">
              AI-Напарник в эфире
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
              {isAiSpeaking
                ? 'ИИ говорит вслух...'
                : isUserSpeaking
                ? 'Слушаю вас...'
                : isRecording
                ? 'Ожидание голоса'
                : statusMessage}
            </span>

            {/* Micro Wave Indicator */}
            {isRecording && !isAiSpeaking && (
              <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 rounded-full ${
                    isUserSpeaking ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(15, ((rmsDb + 60) / 45) * 100))}%`
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700/80" />

        {/* Open Chat Drawer Button */}
        <button
          onClick={() => toggleOpen(true)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700/60"
          title="Развернуть боковую панель чата и подсказок"
        >
          <MessageSquare className="w-4 h-4 text-pastel-accentRose" />
        </button>

        {/* Disconnect Voice Button */}
        <button
          onClick={disconnectSession}
          className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition cursor-pointer border border-rose-500/30"
          title="Завершить голосовой вызов"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
