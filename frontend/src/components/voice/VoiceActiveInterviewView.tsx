import React, { useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Zap,
  Clock,
  Send,
  WifiOff,
  Activity
} from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { DialogueTurn } from '../../types/voice';
import { InterviewConfig } from '../../types/interviewConfig';
import { SpeechClarityMetrics } from '../../services/AcousticTelemetryService';

export interface VoiceActiveInterviewViewProps {
  isSessionPaused: boolean;
  onToggleSessionPause: () => void;
  interviewConfig: InterviewConfig;
  isBatchMode: boolean;
  activeBatchIndex: number;
  totalQuestions: number;
  isConnectionLost: boolean;
  onManualReconnect: () => void;
  onReturnToLobby: () => void;
  isAiSpeaking: boolean;
  isThinking: boolean;
  isRecording: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  thinkingStage: 'idle' | 'processing' | 'delayed' | 'critical';
  rmsDb: number;
  onBargeIn: () => void;
  onEndTurn: () => void;
  onToggleMic: () => void;
  onInstantRestEvalFallback: () => void;
  speechCoachingMode: string;
  liveClarityMetrics: SpeechClarityMetrics | null;
  questionStructure: any;
  dialogueTurns: DialogueTurn[];
  inputText: string;
  setInputText: (val: string) => void;
  onSendCustomText: (val?: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isSubmitting: boolean;
  onSurrenderAndExplain: () => void;
  onRetryCleanly: () => void;
  onEndInterviewImmediately: () => void;
}

export const VoiceActiveInterviewView: React.FC<VoiceActiveInterviewViewProps> = ({
  isSessionPaused,
  onToggleSessionPause,
  interviewConfig,
  isBatchMode,
  activeBatchIndex,
  totalQuestions,
  isConnectionLost,
  onManualReconnect,
  onReturnToLobby,
  isAiSpeaking,
  isThinking,
  isRecording,
  isUserSpeaking,
  isPauseHolding,
  thinkingStage,
  rmsDb,
  onBargeIn,
  onEndTurn,
  onToggleMic,
  onInstantRestEvalFallback,
  speechCoachingMode,
  liveClarityMetrics,
  questionStructure,
  dialogueTurns,
  inputText,
  setInputText,
  onSendCustomText,
  isMuted,
  onToggleMute,
  isSubmitting,
  onSurrenderAndExplain,
  onRetryCleanly,
  onEndInterviewImmediately
}) => {
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendCustomText();
    }
  };

  return (
    <>
      {/* SOTA 2026 Voice Hold Overlay (Amber Frosted Glow) */}
      {isSessionPaused && (
        <div className="absolute inset-0 z-50 bg-amber-950/40 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center rounded-3xl animate-fade-in">
          <div className="bg-white/95 rounded-3xl p-6 sm:p-8 max-w-md shadow-2xl border border-amber-200/90 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-100/90 text-amber-700 flex items-center justify-center text-3xl shadow-inner animate-pulse">
              ⏸️
            </div>
            <h3 className="text-lg font-extrabold text-slate-800">
              Диалог на паузе
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Оценка не начисляется, сокет не разрывается. Сделайте глоток воды, соберитесь с мыслями и нажмите кнопку ниже, когда будете готовы продолжить.
            </p>
            <button
              type="button"
              onClick={onToggleSessionPause}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>▶️ Продолжить диалог</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono font-normal">Space</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode / Strategy Header Pill */}
      <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-pastel-rose/50 border border-pastel-rose/80 text-[11px] text-pastel-text/85 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-pastel-accentRose text-sm">
            {interviewConfig.strategy === 'socratic_tutoring' ? '🌸' : '🎯'}
          </span>
          <p className="leading-tight">
            {interviewConfig.strategy === 'socratic_tutoring'
              ? 'Сократический ментор: задавайте вопросы или просите подсказки.'
              : 'Адаптивное зондирование: отвечайте своими словами, ИИ уточнит детали.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isBatchMode && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-accentViolet text-white shadow-2xs">
              {activeBatchIndex + 1}/{totalQuestions}
            </span>
          )}
          {interviewConfig.deepDive && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 border border-pastel-accentViolet/40 text-pastel-accentViolet shadow-2xs">
              🔬 Deep-Dive
            </span>
          )}
          {interviewConfig.liveCoaching && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 shadow-2xs">
              🎓 Обучение
            </span>
          )}
        </div>
      </div>

      {/* Offline Recovery Card upon failed auto-resumes */}
      {isConnectionLost && (
        <div className="mt-2.5 p-4 rounded-2xl bg-white/95 border border-rose-200/90 shadow-md text-center max-w-md mx-auto animate-fade-in shrink-0">
          <div className="flex items-center justify-center gap-2 mb-1.5 text-rose-600 font-bold text-xs">
            <WifiOff className="w-4 h-4" />
            <span>Связь с голосовым каналом прервана</span>
          </div>
          <p className="text-[11px] text-pastel-sub mb-3 leading-relaxed">
            История вашего ответа и контекст сохранены. Вы можете возобновить диалог с сохраненного места.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onManualReconnect}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold text-xs shadow-xs hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Возобновить разговор</span>
            </button>
            <button
              type="button"
              onClick={onReturnToLobby}
              className="px-3 py-1.5 rounded-xl bg-pastel-card hover:bg-white border border-pastel-border text-pastel-sub hover:text-pastel-text text-xs font-semibold transition cursor-pointer"
            >
              В лобби
            </button>
          </div>
        </div>
      )}

      {/* Central Interactive Voice Ripple Circle */}
      <div className="my-3.5 flex flex-col items-center justify-center shrink-0">
        <div className="relative flex items-center justify-center">
          {isRecording && isUserSpeaking && (
            <div
              className="absolute rounded-full bg-emerald-400/30 animate-ping pointer-events-none"
              style={{
                width: `${115 + Math.min(45, Math.max(0, (rmsDb + 50) * 1.8))}px`,
                height: `${115 + Math.min(45, Math.max(0, (rmsDb + 50) * 1.8))}px`
              }}
            />
          )}
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
              isAiSpeaking
                ? 'bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet shadow-xl ring-4 ring-pink-200'
                : isThinking
                ? 'bg-gradient-to-tr from-amber-300 via-orange-400 to-amber-500 shadow-xl ring-4 ring-amber-200'
                : isRecording
                ? isUserSpeaking
                  ? 'bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-xl ring-4 ring-emerald-300 scale-105'
                  : 'bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-xl ring-4 ring-emerald-200'
                : 'bg-slate-100 border border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (isAiSpeaking) {
                  onBargeIn();
                } else if (isRecording) {
                  onEndTurn();
                } else {
                  onToggleMic();
                }
              }}
              className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center text-pastel-text shadow-inner transition hover:scale-105 active:scale-95 cursor-pointer"
              title={
                isAiSpeaking
                  ? 'Нажмите, чтобы перебить речь ИИ (Barge-in)'
                  : isRecording
                  ? 'Нажмите, чтобы передать ответ ИИ'
                  : 'Нажмите, чтобы включить микрофон'
              }
            >
              {isAiSpeaking ? (
                <>
                  <Volume2 className="w-8 h-8 text-pastel-accentRose animate-bounce" />
                  <span className="text-[10px] font-bold text-pastel-accentRose mt-1">ИИ говорит...</span>
                </>
              ) : isThinking ? (
                <>
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <span className="text-[10px] font-bold text-amber-600 mt-1">Осмысление...</span>
                </>
              ) : isRecording ? (
                <>
                  <Mic className={`w-8 h-8 ${isUserSpeaking ? 'text-emerald-500 scale-110' : 'text-emerald-600 animate-pulse'} transition-transform`} />
                  <span className="text-[10px] font-bold text-emerald-600 mt-1">
                    {isUserSpeaking ? 'Передать ответ ➔' : 'Говорите...'}
                  </span>
                </>
              ) : (
                <>
                  <MicOff className="w-8 h-8 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 mt-1">Включить</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* State description banner */}
        <div className="mt-2.5 text-center flex flex-col items-center gap-1.5">
          {isAiSpeaking ? (
            <span className="px-3 py-1 rounded-full bg-pastel-rose text-pastel-accentRose text-xs font-bold border border-pastel-accentRose/30 animate-pulse flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 animate-bounce" />
              <span>ИИ озвучивает ответ...</span>
            </span>
          ) : isThinking ? (
            <div className="flex flex-col items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 animate-pulse ${
                thinkingStage === 'critical'
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : thinkingStage === 'delayed'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {thinkingStage === 'critical'
                    ? 'Задержка ответа шлюза (высокая нагрузка)...'
                    : thinkingStage === 'delayed'
                    ? 'Связь со шлюзом: генерация ответа...'
                    : 'ИИ осмысливает ваш ответ...'}
                </span>
              </span>

              {thinkingStage === 'critical' && (
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-amber-50/90 border border-amber-200 animate-fadeIn">
                  <button
                    type="button"
                    onClick={onToggleMic}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-bold shadow-2xs cursor-pointer flex items-center gap-1"
                    title="Сбросить ожидание и продолжить говорить"
                  >
                    <Mic className="w-3 h-3 text-emerald-600" />
                    <span>Продолжить говорить</span>
                  </button>
                  <button
                    type="button"
                    onClick={onInstantRestEvalFallback}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shadow-2xs cursor-pointer flex items-center gap-1"
                    title="Мгновенно запросить оценку через быстрый REST"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Экспресс-оценка</span>
                  </button>
                </div>
              )}
            </div>
          ) : isRecording && isPauseHolding && interviewConfig.turnMode === 'auto' ? (
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-300 flex items-center gap-1.5 animate-pulse">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Слушаю паузу ({((interviewConfig.vadPauseMs ?? 1800) / 1000).toFixed(1)}с)...</span>
            </span>
          ) : isRecording ? (
            <div className="w-full flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  isUserSpeaking
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs animate-pulse'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                }`}>
                  <Mic className="w-3.5 h-3.5 animate-pulse" />
                  <span>{isUserSpeaking ? 'Слышу ваш голос: говорите...' : 'Ваша очередь: говорите в микрофон...'}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onEndTurn}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                title="Нажмите, когда закончите говорить: ИИ выслушает ответ"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Передать ответ ➔</span>
              </button>
            </div>
          ) : (
            <span className="px-3 py-1 rounded-full bg-pastel-card text-pastel-muted text-xs border border-pastel-border">
              Микрофон на паузе (нажмите на кружок)
            </span>
          )}

          {/* Live Speech Coaching Telemetry HUD */}
          {isRecording && speechCoachingMode !== 'off' && (
            <div className="w-full max-w-sm mx-auto mt-2 p-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-pastel-border/80 shadow-2xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-bold">
                  <Activity className="w-3.5 h-3.5 text-pastel-accentViolet" />
                  <span className="text-pastel-muted">Темп:</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg border text-[10px] transition-colors ${
                      !liveClarityMetrics || liveClarityMetrics.wpm === 0
                        ? 'bg-slate-50 text-slate-500 border-slate-200'
                        : liveClarityMetrics.wpm >= 115 && liveClarityMetrics.wpm <= 165
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse'
                        : liveClarityMetrics.wpm > 165
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    }`}
                  >
                    {liveClarityMetrics && liveClarityMetrics.wpm > 0
                      ? `${liveClarityMetrics.wpm} WPM`
                      : 'Замер темпа...'}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-bold">
                  <Sparkles className="w-3 h-3 text-pastel-accentRose" />
                  <span className="text-pastel-muted">Паразиты:</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg border text-[10px] transition-colors ${
                      !liveClarityMetrics || liveClarityMetrics.fillerWordsCount === 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                    }`}
                  >
                    {liveClarityMetrics
                      ? liveClarityMetrics.fillerWordsCount === 0
                        ? '0 (Чисто)'
                        : `${liveClarityMetrics.fillerWordsCount} (${liveClarityMetrics.detectedFillers[0]?.word})`
                      : '0 (Чисто)'}
                  </span>
                </div>
              </div>

              {questionStructure && (
                <div className="pt-1 border-t border-pastel-border/40 flex items-center justify-between text-[10px]">
                  <span className="text-pastel-muted font-medium flex items-center gap-1">
                    <span>💡 Формат:</span>
                    <span className="font-bold text-pastel-text">
                      {speechCoachingMode === 'always' ? 'STAR (Принудительно)' : questionStructure.title}
                    </span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${questionStructure.badgeStyle || ''}`}>
                    {speechCoachingMode === 'always' ? 'STAR' : questionStructure.recommendedFramework}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Realtime Dialogue Turns Display */}
      <div className="flex-1 min-h-[130px] max-h-[170px] overflow-y-auto p-3.5 rounded-2xl bg-pastel-card/50 border border-pastel-border/60 space-y-2.5 text-xs">
        {dialogueTurns.length === 0 ? (
          <div className="h-full flex items-center justify-center text-pastel-sub italic text-center">
            Диалог появится здесь в реальном времени...
          </div>
        ) : (
          dialogueTurns.map((turn, index) => (
            <div
              key={index}
              className={`flex gap-2 leading-relaxed ${
                turn.role === 'ai'
                  ? 'text-pastel-accentViolet font-medium'
                  : turn.role === 'user'
                  ? 'text-pastel-text font-semibold'
                  : 'text-pastel-sub italic text-[11px]'
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

      {/* Multimodal Text Input Dock */}
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/95 border border-pastel-border/90 shadow-2xs focus-within:ring-2 focus-within:ring-pastel-accentViolet/40 focus-within:border-pastel-accentViolet/70 transition-all">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isAiSpeaking && !isMuted}
            placeholder={isAiSpeaking ? 'ИИ говорит в наушники...' : '💬 Напишите ответ текстом (Enter для отправки)...'}
            className="flex-1 px-3 py-1.5 text-xs text-pastel-text bg-transparent placeholder:text-pastel-sub focus:outline-none disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => onSendCustomText()}
            disabled={!inputText.trim() || (isAiSpeaking && !isMuted)}
            className="p-2 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 active:scale-95 transition-all shadow-xs disabled:opacity-40 disabled:scale-100 cursor-pointer"
            title="Отправить ответ в диалог (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMuted
                ? 'bg-amber-100/90 border-amber-300 text-amber-800'
                : 'bg-pastel-bg/60 hover:bg-slate-100 border-pastel-border text-pastel-sub hover:text-pastel-accentViolet'
            }`}
            title={isMuted ? '🔇 Режим тишины включен' : '🔊 Режим звука включен'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={onSurrenderAndExplain}
          disabled={isSubmitting || isAiSpeaking}
          className="px-3 py-1.5 rounded-xl bg-amber-50/90 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
          title="Попросить ИИ дать Senior-объяснение"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>💡 Сдаюсь / Объяснить под капотом</span>
        </button>

        <button
          type="button"
          onClick={onRetryCleanly}
          disabled={isSubmitting}
          className="px-3 py-1.5 rounded-xl bg-pastel-lavender/70 hover:bg-pastel-lavender border border-pastel-accentViolet/30 text-pastel-accentViolet text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          title="Сбросить текущий ответ и начать заново"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>🔄 Заново</span>
        </button>

        <button
          type="button"
          onClick={onEndInterviewImmediately}
          disabled={isSubmitting}
          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold transition cursor-pointer"
        >
          Прервать
        </button>
      </div>
    </>
  );
};
