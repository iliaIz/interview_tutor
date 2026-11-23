/**
 * VoiceTutorActiveHUD.tsx
 * Active interactive HUD for Voice Tutor: media cluster, turns box, text dock.
 * Cognitive Bounding Limit: <= 250 lines (Rule 8 compliant).
 */

import React from 'react';
import { Send, RotateCcw, CheckCircle2, Target, X, Volume2, VolumeX } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { DialogueTurn } from '../../audio/useLiveVoiceSession';
import { InterviewConfig } from '../../types/interviewConfig';
import { VoiceTutorMediaCluster } from './VoiceTutorMediaCluster';

export interface VoiceTutorActiveHUDProps {
  tutorMode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  setTutorMode: (mode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat') => void;
  interviewConfig: InterviewConfig;
  isAiSpeaking: boolean;
  isThinking: boolean;
  thinkingStage: 'critical' | 'delayed' | 'idle' | 'processing';
  isRecording: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  rmsDb: number;
  onInterruption: () => void;
  triggerEndTurn: () => void;
  toggleMic: () => void;
  dialogueTurns: DialogueTurn[];
  inputText: string;
  setInputText: (text: string) => void;
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSendCustomText: (text?: string) => void;
  isMuted: boolean;
  toggleMute: () => void;
  retryCurrentQuestionCleanly: () => void;
  onClose: () => void;
  onSwitchToInterview: () => void;
  textInputRef: React.RefObject<HTMLInputElement>;
  isSessionPaused?: boolean;
  onToggleSessionPause?: () => void;
  activeFocus: any;
  clearFocus: () => void;
}

export const VoiceTutorActiveHUD: React.FC<VoiceTutorActiveHUDProps> = ({
  tutorMode,
  setTutorMode,
  interviewConfig,
  isAiSpeaking,
  isThinking,
  thinkingStage,
  isRecording,
  isUserSpeaking,
  isPauseHolding,
  rmsDb,
  onInterruption,
  triggerEndTurn,
  toggleMic,
  dialogueTurns,
  inputText,
  setInputText,
  handleInputKeyDown,
  handleSendCustomText,
  isMuted,
  toggleMute,
  retryCurrentQuestionCleanly,
  onClose,
  onSwitchToInterview,
  textInputRef,
  isSessionPaused,
  onToggleSessionPause,
  activeFocus,
  clearFocus
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 justify-between relative">
      {isSessionPaused && (
        <div className="absolute inset-0 z-40 bg-amber-950/40 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center rounded-3xl animate-fade-in">
          <div className="bg-white/95 rounded-2xl p-5 max-w-xs shadow-2xl border border-amber-200/90 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shadow-inner animate-pulse">
              ⏸️
            </div>
            <h3 className="text-sm font-extrabold text-slate-800">Диалог на паузе</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Оценка не начисляется, соединение активно. Сделайте перерыв или подумайте над вопросом.
            </p>
            <button
              type="button"
              onClick={onToggleSessionPause}
              className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-xs shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>▶️ Продолжить</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">Space</span>
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="px-2.5 py-1.5 rounded-xl bg-pastel-rose/50 border border-pastel-rose/80 text-[10px] text-pastel-text/85 flex items-center justify-between shrink-0 mb-2 gap-1 flex-wrap">
          <div className="flex items-center gap-1 font-semibold">
            <span className="shrink-0">🧠 Режим:</span>
            <div className="flex items-center gap-0.5 bg-white/80 p-0.5 rounded-lg border border-pastel-border/60">
              {[
                { id: 'deep_dive' as const, label: '🔬 Под капотом' },
                { id: 'socratic' as const, label: '💡 Сократ' },
                { id: 'eli5' as const, label: '👶 На пальцах' },
                { id: 'free_chat' as const, label: '💬 Свободный' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTutorMode(m.id)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                    tutorMode === m.id
                      ? 'bg-pastel-accentViolet text-white shadow-2xs'
                      : 'text-pastel-muted hover:text-pastel-text hover:bg-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-[10px] text-pastel-accentViolet font-bold shrink-0">{interviewConfig.voice}</span>
        </div>

        {activeFocus && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-2 rounded-xl bg-pastel-accentViolet/10 border border-pastel-accentViolet/30 text-[11px] text-pastel-accentViolet font-medium animate-fadeIn">
            <div className="flex items-center gap-1.5 truncate">
              <Target className="w-3.5 h-3.5 shrink-0 text-pastel-accentViolet animate-pulse" />
              <span className="font-bold shrink-0">Фокус ИИ:</span>
              <span className="truncate font-mono text-[10px] text-pastel-text">
                {activeFocus.zone === 'code'
                  ? `${activeFocus.revisionTitle || 'Код'}, стр. ${activeFocus.startLine}${activeFocus.endLine && activeFocus.endLine !== activeFocus.startLine ? `-${activeFocus.endLine}` : ''}`
                  : `«${activeFocus.text.slice(0, 35)}${activeFocus.text.length > 35 ? '...' : ''}»`}
              </span>
            </div>
            <button
              type="button"
              onClick={clearFocus}
              title="Снять фокус внимания"
              className="p-1 rounded-md hover:bg-pastel-accentViolet/20 text-pastel-accentViolet/80 hover:text-pastel-accentViolet cursor-pointer transition shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Media Control Cluster */}
        <VoiceTutorMediaCluster
          isSessionPaused={isSessionPaused}
          onToggleSessionPause={onToggleSessionPause}
          isAiSpeaking={isAiSpeaking}
          isThinking={isThinking}
          thinkingStage={thinkingStage}
          isRecording={isRecording}
          isUserSpeaking={isUserSpeaking}
          isPauseHolding={isPauseHolding}
          rmsDb={rmsDb}
          onInterruption={onInterruption}
          toggleMic={toggleMic}
          triggerEndTurn={triggerEndTurn}
          interviewConfig={interviewConfig}
        />

        {/* Live Turns Box */}
        <div className="h-32 overflow-y-auto p-2.5 rounded-xl bg-pastel-card/50 border border-pastel-border/60 space-y-1.5 text-xs">
          {dialogueTurns.length === 0 ? (
            <div className="h-full flex items-center justify-center text-pastel-sub italic text-center text-[11px]">
              Диалог появится здесь...
            </div>
          ) : (
            dialogueTurns.map((turn, index) => (
              <div
                key={index}
                className={`flex gap-1.5 leading-relaxed text-[11px] ${
                  turn.role === 'ai' ? 'text-pastel-accentViolet font-medium' : turn.role === 'user' ? 'text-pastel-text font-semibold' : 'text-pastel-sub italic text-[10px]'
                }`}
              >
                <span className="shrink-0 pt-0.5">
                  {turn.role === 'ai' ? '🤖' : turn.role === 'user' ? '👤' : 'ℹ️'}
                </span>
                <div className="flex-1 min-w-0">
                  <MarkdownRenderer content={turn.text} compact />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Text Input Row & Quick Chips */}
        <div className="mt-2.5 space-y-2">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/95 border border-pastel-border/90 shadow-2xs focus-within:ring-2 focus-within:ring-pastel-accentViolet/40 focus-within:border-pastel-accentViolet/70 transition-all">
            <input
              ref={textInputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="💬 Напишите вопрос или мысль (Enter)..."
              className="flex-1 px-3 py-1.5 text-xs text-pastel-text bg-transparent placeholder:text-pastel-sub focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSendCustomText()}
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 active:scale-95 transition-all shadow-xs disabled:opacity-40 disabled:scale-100 cursor-pointer"
              title="Отправить вопрос в диалог (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isMuted ? 'bg-amber-100/90 border-amber-300 text-amber-800' : 'bg-pastel-bg/60 hover:bg-slate-100 border-pastel-border text-pastel-sub hover:text-pastel-accentViolet'
              }`}
              title={isMuted ? '🔇 Режим тишины включен' : '🔊 Озвучка включена'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => handleSendCustomText('Расскажи подробно, как это устроено в памяти JVM и какие структуры задействованы.')}
              className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-[10px] font-bold transition cursor-pointer active:scale-95"
            >
              <span>💡 В памяти JVM</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendCustomText('Объясни, как это работает под капотом в Spring Framework.')}
              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold transition cursor-pointer active:scale-95"
            >
              <span>⚙️ В Spring</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendCustomText('Какие главные ошибки и подводные камни допускают на практике по этой теме?')}
              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-bold transition cursor-pointer active:scale-95"
            >
              <span>⚠️ Ошибки</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendCustomText('Объясни эту концепцию максимально просто, как для начинающего (ELI5).')}
              className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[10px] font-bold transition cursor-pointer active:scale-95"
            >
              <span>👶 ELI5</span>
            </button>
            <button
              type="button"
              onClick={retryCurrentQuestionCleanly}
              className="px-2 py-1 rounded-lg bg-pastel-card hover:bg-pastel-card/80 border border-pastel-border text-pastel-muted text-[10px] font-bold transition cursor-pointer active:scale-95"
              title="Сбросить историю и начать сначала"
            >
              <RotateCcw className="w-3 h-3" />
              <span>🔄</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-pastel-border/60 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Завершить разбор темы</span>
        </button>
        <button
          type="button"
          onClick={onSwitchToInterview}
          className="py-2.5 px-3 rounded-xl border border-pastel-accentViolet/40 text-pastel-accentViolet text-[11px] font-semibold hover:bg-pastel-lavender/40 transition cursor-pointer"
        >
          🎙️ Собеседование
        </button>
      </div>
    </div>
  );
};
