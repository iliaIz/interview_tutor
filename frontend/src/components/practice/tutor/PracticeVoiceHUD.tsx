import React, { useEffect } from 'react';
import { useLiveAudioSession } from '../../../hooks/useLiveAudioSession';
import { useAppStore } from '../../../store/useAppStore';
import { Mic, MicOff, Volume2, PhoneOff, Radio, Sparkles } from 'lucide-react';

interface PracticeVoiceHUDProps {
  onAiTranscriptUpdate?: (transcript: string) => void;
}

export const PracticeVoiceHUD: React.FC<PracticeVoiceHUDProps> = ({ onAiTranscriptUpdate }) => {
  const { activePracticeChallenge, practiceWorkspaceFiles, activeWorkspaceFileIndex } = useAppStore();
  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    statusMessage,
    aiTranscript,
    startSession,
    disconnectSession,
    toggleMic,
    playoutManagerRef
  } = useLiveAudioSession({
    onError: (err) => console.error('Live voice error:', err)
  });

  // Start live session when mounted
  useEffect(() => {
    const startLiveTutor = async () => {
      try {
        await startSession({
          sessionType: 'tutor',
          tutorMode: 'practice_pair',
          topic: 'Юнит-тестирование и мутации Java 21',
          bugTitle: activePracticeChallenge?.title || 'Практическая задача',
          bugExplanation: activePracticeChallenge?.instructionsMarkdown?.slice(0, 500) || '',
          codeSnippet: currentFile?.content || '',
          voice: 'Puck'
        });
      } catch (err) {
        console.error('Failed to start Live Tutor session:', err);
      }
    };

    startLiveTutor();

    return () => {
      disconnectSession();
    };
  }, []);

  useEffect(() => {
    if (aiTranscript && onAiTranscriptUpdate) {
      onAiTranscriptUpdate(aiTranscript);
    }
  }, [aiTranscript, onAiTranscriptUpdate]);

  // Tactile Barge-In: Click central button during AI speech to interrupt
  const handleTactileBargeIn = () => {
    if (isAiSpeaking && playoutManagerRef.current) {
      playoutManagerRef.current.handleInterruption();
    } else {
      toggleMic();
    }
  };

  return (
    <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-gradient-to-b from-[#FFF0F5]/80 via-white to-pastel-lavender/20 border border-pastel-accentRose/30 shadow-sm relative overflow-hidden">
      {/* Background Pulse Aura */}
      <div
        className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none ${
          isAiSpeaking
            ? 'bg-pastel-accentRose/30 opacity-100 animate-pulse'
            : isRecording
            ? 'bg-emerald-400/30 opacity-100'
            : 'bg-slate-300/20 opacity-40'
        }`}
      />

      {/* Header Info */}
      <div className="w-full flex items-center justify-between z-10 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-pastel-accentRose/20 text-[10px] font-bold text-pastel-accentRoseText shadow-2xs">
            <Radio className="w-3 h-3 text-pastel-accentRose animate-pulse" />
            <span>Gemini Live Multimodal</span>
          </div>
        </div>

        <button
          onClick={disconnectSession}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
          title="Завершить голосовую сессию"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Отключить</span>
        </button>
      </div>

      {/* Central Tactile Circle Button (Tactile Barge-In) */}
      <div className="relative my-4 flex flex-col items-center">
        <button
          onClick={handleTactileBargeIn}
          className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg cursor-pointer transform active:scale-95 ${
            isAiSpeaking
              ? 'bg-gradient-to-tr from-pink-500 to-rose-400 text-white ring-8 ring-rose-100 animate-pulse'
              : isRecording
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white ring-8 ring-emerald-100'
              : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-pastel-accentRose'
          }`}
          title={isAiSpeaking ? 'Нажмите, чтобы перебить ИИ (Barge-In)' : 'Нажмите, чтобы включить микрофон'}
        >
          {isAiSpeaking ? (
            <>
              <Volume2 className="w-8 h-8 animate-bounce" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Перебить</span>
            </>
          ) : isRecording ? (
            <>
              <Mic className="w-8 h-8 animate-pulse" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Слушаю</span>
            </>
          ) : (
            <>
              <MicOff className="w-8 h-8" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Пауза</span>
            </>
          )}
        </button>

        <span className="text-xs font-semibold text-slate-600 mt-3 text-center">
          {isAiSpeaking
            ? 'ИИ говорит вслух (нажмите, чтобы перебить)'
            : isRecording
            ? 'Говорите свободно, вас слышно'
            : isConnected
            ? statusMessage
            : 'Подключение к аудио-шлюзу...'}
        </span>
      </div>

      {/* Realtime Transcript Box */}
      {aiTranscript && (
        <div className="w-full mt-2 p-2.5 rounded-xl bg-white/90 border border-pastel-border/60 text-xs text-slate-700 max-h-24 overflow-y-auto leading-relaxed shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-pastel-accentRose mb-1">
            <Sparkles className="w-3 h-3" />
            <span>Речь ИИ:</span>
          </div>
          {aiTranscript}
        </div>
      )}
    </div>
  );
};
