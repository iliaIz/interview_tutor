import React, { useRef } from 'react';
import { Volume2, VolumeX, Mic, MicOff, Bug, MessageSquare, Send } from 'lucide-react';

import { DialogueTurn } from '../../../audio/useLiveVoiceSession';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../../../config/voiceDefaults';

export type TutorRole = 'bug_hunt' | 'free_chat';

export interface BugHuntVoiceMentorController {
  tutorRole: TutorRole;
  onSelectTutorRole: (role: TutorRole) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isPauseHolding: boolean;
  isUserSpeaking: boolean;
  dialogueTurns: DialogueTurn[];
  inputText: string;
  setInputText: (text: string) => void;
  handleSendBugText: (textToSend?: string) => void;
  toggleMic: () => void;
  startBugVoiceSession: () => void;
}

export interface BugHuntVoiceMentorProps {
  controller?: BugHuntVoiceMentorController;
  tutorRole?: TutorRole;
  onSelectTutorRole?: (role: TutorRole) => void;
  isMuted?: boolean;
  toggleMute?: () => void;
  isConnected?: boolean;
  isAiSpeaking?: boolean;
  isRecording?: boolean;
  isPauseHolding?: boolean;
  isUserSpeaking?: boolean;
  dialogueTurns?: DialogueTurn[];
  inputText?: string;
  setInputText?: (text: string) => void;
  handleSendBugText?: (textToSend?: string) => void;
  toggleMic?: () => void;
  startBugVoiceSession?: () => void;
}

export const BugHuntVoiceMentor: React.FC<BugHuntVoiceMentorProps> = (props) => {
  const c = props.controller || (props as Required<BugHuntVoiceMentorProps>);
  const {
    tutorRole,
    onSelectTutorRole,
    isMuted,
    toggleMute,
    isConnected,
    isAiSpeaking,
    isRecording,
    isPauseHolding,
    isUserSpeaking,
    dialogueTurns,
    inputText,
    setInputText,
    handleSendBugText,
    toggleMic,
    startBugVoiceSession
  } = c;
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const { config: interviewConfig } = useInterviewConfig();
  const activeVoice = interviewConfig.voice || VOICE_DEFAULTS.voice;
  const isManualMode = (interviewConfig.turnMode || VOICE_DEFAULTS.turnMode) === 'manual';

  return (
    <div className="p-5 rounded-2xl bg-white/95 border border-pastel-border/80 shadow-2xs space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pastel-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-pastel-accentRose" />
          <span className="text-xs font-bold text-pastel-text">
            AI-Техлид в реальном времени ({activeVoice} • {isManualMode ? 'По кнопке' : 'Авто-VAD'}):
          </span>
          {isMuted ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
              🔇 Режим тишины
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              🎧 Озвучка в наушники
            </span>
          )}
        </div>

        {/* AI Role Switcher */}
        <div className="flex items-center gap-1 bg-pastel-bg p-1 rounded-xl border border-pastel-border">
          <button
            onClick={() => onSelectTutorRole('bug_hunt')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              tutorRole === 'bug_hunt' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <Bug className="w-3.5 h-3.5" />
            <span>🐛 Код-ревью</span>
          </button>

          <button
            onClick={() => onSelectTutorRole('free_chat')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              tutorRole === 'free_chat' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>💬 Свободный диалог</span>
          </button>
        </div>
      </div>

      {/* Dialogue Turns Container */}
      <div className="h-32 overflow-y-auto p-3 rounded-xl bg-pastel-bg/60 border border-pastel-border space-y-2 text-xs">
        {dialogueTurns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-pastel-muted italic text-center text-[11px] gap-1">
            <span>Напишите гипотезу бага в поле ниже или задайте вопрос техлиду...</span>
            <span className="text-[10px] opacity-75">Техлид проверит логику и даст обратную связь в наушники</span>
          </div>
        ) : (
          dialogueTurns.map((turn, index) => (
            <div
              key={index}
              className={`flex gap-1.5 leading-relaxed text-[11px] ${
                turn.role === 'ai' ? 'text-pastel-accentViolet font-medium' : 'text-pastel-text font-semibold'
              }`}
            >
              <span>{turn.role === 'ai' ? '🤖' : turn.role === 'system' ? '⚙️' : '👤'}</span>
              <span>{turn.text}</span>
            </div>
          ))
        )}
      </div>

      {/* Multimodal Input Dock */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-pastel-border shadow-2xs">
        <input
          ref={textInputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendBugText();
            }
          }}
          disabled={isAiSpeaking && !isMuted}
          placeholder={isAiSpeaking ? 'Техлид говорит в наушники...' : '💬 Опишите найденный баг или задайте вопрос (Enter)...'}
          className="flex-1 px-3 py-1.5 text-base sm:text-xs text-pastel-text bg-transparent placeholder:text-pastel-muted/60 focus:outline-none disabled:opacity-50"
        />

        <button
          onClick={() => handleSendBugText()}
          disabled={!inputText.trim() || (isAiSpeaking && !isMuted)}
          className="p-2 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition shadow-xs disabled:opacity-40 cursor-pointer"
          title="Отправить решение (Enter)"
        >
          <Send className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleMute}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            isMuted ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-pastel-bg text-pastel-text border-pastel-border hover:bg-white'
          }`}
          title={isMuted ? 'Включить голос' : 'Выключить голос (тишина)'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => {
            if (!isConnected) {
              void startBugVoiceSession();
            } else {
              toggleMic();
            }
          }}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            !isConnected
              ? 'bg-pastel-bg text-pastel-muted border-pastel-border hover:bg-white hover:text-pastel-text'
              : isRecording
              ? isPauseHolding
                ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                : isUserSpeaking
                ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                : 'bg-rose-500 text-white border-rose-600'
              : 'bg-pastel-bg text-pastel-text border-pastel-border hover:bg-white'
          }`}
          title={
            !isConnected
              ? 'Включить голосовое общение с техлидом'
              : isRecording
              ? isPauseHolding
                ? 'Пауза (Auto-VAD осмысливает)...'
                : isUserSpeaking
                ? 'Слушаю вас...'
                : 'Выключить микрофон'
              : 'Включить микрофон'
          }
        >
          {isRecording ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
