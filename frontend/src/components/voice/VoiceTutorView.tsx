import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpen, Sparkles, Mic, MicOff, Volume2, VolumeX, Play, Pause, Square,
  Settings2, Loader2, Clock, Zap, Send, RotateCcw, CheckCircle2, Target, X,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { CodeViewer } from '../CodeViewer';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { DialogueTurn } from '../../hooks/useLiveAudioSession';
import { useSelectionFocusStore } from '../../store/useSelectionFocusStore';
import { InterviewConfig } from '../../types/interviewConfig';

export interface VoiceTutorViewProps {
  stage: 'lobby' | 'active';
  activeTopic: string;
  activeQuestionNum: number;
  activeBatchIndex: number;
  totalQuestions: number;
  isBatchMode: boolean;
  activeQuestionText: string;
  activeReferenceAnswer?: string;
  tutorMode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  setTutorMode: (mode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat') => void;
  startLiveInterview: () => void;
  systemHealth: { isAiReady: boolean };
  setIsSettingsOpen: (open: boolean) => void;
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
  onSwitchQuestion?: (newIndex: number) => void;
}

export const VoiceTutorView: React.FC<VoiceTutorViewProps> = ({
  stage,
  activeTopic,
  activeQuestionNum,
  activeBatchIndex,
  totalQuestions,
  isBatchMode,
  activeQuestionText,
  activeReferenceAnswer,
  tutorMode,
  setTutorMode,
  startLiveInterview,
  systemHealth,
  setIsSettingsOpen,
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
  onSwitchQuestion
}) => {
  const { activeFocus, setFocus, clearFocus } = useSelectionFocusStore();
  const [mobileActiveTab, setMobileActiveTab] = React.useState<'theory' | 'tutor'>('theory');

  // Keyboard navigation between questions (Alt+ArrowLeft / Alt+ArrowRight)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!onSwitchQuestion || !isBatchMode || totalQuestions <= 1) return;
      if (e.altKey && e.key === 'ArrowLeft' && activeBatchIndex > 0) {
        e.preventDefault();
        onSwitchQuestion(activeBatchIndex - 1);
      } else if (e.altKey && e.key === 'ArrowRight' && activeBatchIndex < totalQuestions - 1) {
        e.preventDefault();
        onSwitchQuestion(activeBatchIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSwitchQuestion, isBatchMode, totalQuestions, activeBatchIndex]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden my-2">
      {/* Mobile Segmented Navigation Tabs (< lg) */}
      <div className="lg:hidden flex items-center p-1 rounded-2xl bg-slate-100/90 border border-pastel-border/80 mb-2 shrink-0">
        <button
          type="button"
          onClick={() => setMobileActiveTab('theory')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileActiveTab === 'theory'
              ? 'bg-white text-pastel-accentViolet shadow-xs border border-pastel-accentViolet/20'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Материал и ответ</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveTab('tutor')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
            mobileActiveTab === 'tutor'
              ? 'bg-white text-pastel-accentRose shadow-xs border border-pastel-accentRose/20'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>AI-Тьютор</span>
          {(isAiSpeaking || isUserSpeaking || isRecording) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
          )}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left Panel: Study Material & Reference Theory */}
        <div className={`lg:col-span-7 flex flex-col min-h-0 bg-slate-50/70 rounded-2xl border border-pastel-border/80 p-2.5 sm:p-3.5 overflow-hidden ${
          mobileActiveTab === 'theory' ? 'flex-1 flex' : 'hidden lg:flex'
        }`}>
        <div className="flex items-center justify-between pb-2 border-b border-pastel-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-pastel-accentViolet" />
            <span className="text-xs font-bold text-pastel-text">Изучаемый материал карточки</span>
          </div>
          <div className="flex items-center gap-2">
            {isBatchMode && totalQuestions > 1 && (
              <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-pastel-border shadow-2xs">
                <button
                  type="button"
                  disabled={activeBatchIndex <= 0}
                  onClick={() => onSwitchQuestion?.(activeBatchIndex - 1)}
                  className="p-1 rounded-md text-pastel-muted hover:text-pastel-text hover:bg-pastel-lavender/40 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Предыдущий вопрос (Alt+←)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold text-pastel-accentViolet font-mono px-1">
                  {activeBatchIndex + 1} / {totalQuestions}
                </span>
                <button
                  type="button"
                  disabled={activeBatchIndex >= totalQuestions - 1}
                  onClick={() => onSwitchQuestion?.(activeBatchIndex + 1)}
                  className="p-1 rounded-md text-pastel-muted hover:text-pastel-text hover:bg-pastel-lavender/40 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Следующий вопрос (Alt+→)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <span className="text-[10px] font-semibold text-pastel-muted bg-white px-2 py-0.5 rounded-full border border-pastel-border">
              {activeTopic}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1.5 pt-2.5 space-y-3">
          {/* Question Header Card */}
          <div data-selection-zone="question" className="p-3 rounded-xl bg-white border border-pastel-border/70 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-accentRose block mb-1">
              {isBatchMode ? `Вопрос #${activeQuestionNum} (${activeBatchIndex + 1}/${totalQuestions}):` : 'Вопрос:'}
            </span>
            <h4 className="font-bold text-pastel-text text-sm leading-snug break-anywhere">
              {activeQuestionText}
            </h4>
          </div>

          {/* Markdown Theory & Code */}
          <div data-selection-zone="reference_answer" className="p-3 sm:p-3.5 rounded-xl bg-white border border-pastel-border/70 shadow-2xs leading-relaxed text-pastel-text/90 break-anywhere">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-muted flex items-center gap-1 mb-2">
              <Sparkles className="w-3 h-3 text-pastel-accentRose" />
              Подробный эталонный ответ:
            </span>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-pastel-accentViolet mt-3 mb-1" {...props} />,
                p: ({ node, ...props }) => <p className="mb-2 text-xs text-pastel-text/90 leading-relaxed break-anywhere" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1 text-xs text-pastel-text/90 pl-1 break-anywhere" {...props} />,
                table: ({ node, ...props }: any) => (
                  <div className="overflow-x-auto scroll-touch-x my-2.5 rounded-xl border border-pastel-border shadow-2xs">
                    <table className="min-w-full text-xs text-left border-collapse" {...props} />
                  </div>
                ),
                td: ({ node, ...props }: any) => (
                  <td className="px-3 py-1.5 border-b border-pastel-border/50 align-top break-anywhere" {...props} />
                ),
                code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => {
                  const codeStr = String(children).replace(/\n$/, '');
                  const match = /language-(\w+)/.exec(className || '');
                  const lang = match ? match[1] : 'java';
                  if (!inline && (className || codeStr.includes('\n'))) {
                    return (
                      <div className="my-2">
                        <CodeViewer
                          code={codeStr}
                          language={lang}
                          title={`${lang.toUpperCase()} • Эталонный листинг`}
                        />
                      </div>
                    );
                  }
                  const isFocused = activeFocus?.text === codeStr;
                  return (
                    <code
                      onClick={() => {
                        if (isFocused) {
                          clearFocus();
                        } else {
                          setFocus({
                            zone: 'term',
                            text: codeStr,
                            timestamp: Date.now()
                          });
                        }
                      }}
                      title="Нажмите, чтобы указать ИИ на этот термин"
                      className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold cursor-pointer transition-all duration-150 break-anywhere [word-break:break-word] ${
                        isFocused
                          ? 'bg-pastel-accentViolet text-white ring-2 ring-pastel-accentViolet/50 shadow-2xs'
                          : 'bg-pastel-lavender/60 text-pastel-accentViolet hover:bg-pastel-lavender hover:ring-1 hover:ring-pastel-accentViolet/40'
                      }`}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
              }}
            >
              {activeReferenceAnswer || 'Эталонный ответ загружается...'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Mobile Quick-Jump to Tutor HUD on Theory Tab */}
        <div className="lg:hidden mt-2 pt-2 border-t border-pastel-border/60 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-pastel-muted">
            {isAiSpeaking ? (
              <span className="flex items-center gap-1 text-pastel-accentRose font-bold animate-pulse">
                <Volume2 className="w-3.5 h-3.5" />
                <span>AI говорит...</span>
              </span>
            ) : isRecording ? (
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <Mic className="w-3.5 h-3.5 animate-pulse" />
                <span>Микрофон активен</span>
              </span>
            ) : (
              <span>Голосовой режим доступен</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileActiveTab('tutor')}
            className="px-2.5 py-1 rounded-lg bg-pastel-accentViolet/10 text-pastel-accentViolet hover:bg-pastel-accentViolet hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1"
          >
            <span>К тьютору</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right Panel: Voice Tutor HUD */}
      <div className={`lg:col-span-5 flex flex-col min-h-0 justify-between ${
        mobileActiveTab === 'tutor' ? 'flex-1 flex' : 'hidden lg:flex'
      }`}>
        {stage === 'lobby' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet p-1 shadow-xl flex items-center justify-center animate-pulse">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
                  🧠
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-xs">
                <Mic className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-pastel-text text-sm">
                Голосовой AI-Тьютор готов к разбору
              </h4>
              <p className="text-xs text-pastel-muted leading-relaxed max-w-xs">
                Задавайте любые вопросы по коду и теории слева. ИИ детально объяснит физику процессов под капотом.
              </p>
            </div>

            {/* Mode Selector Pills */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {[
                { id: 'deep_dive' as const, label: '🔬 Под капот' },
                { id: 'socratic' as const, label: '🤔 Сократ' },
                { id: 'eli5' as const, label: '💡 ELI5' },
                { id: 'free_chat' as const, label: '💬 Свободный' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTutorMode(m.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                    tutorMode === m.id
                      ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white border-transparent shadow-xs'
                      : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Action Button */}
            <div className="w-full max-w-xs space-y-2 pt-2">
              <button
                type="button"
                onClick={startLiveInterview}
                disabled={!systemHealth.isAiReady}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {!systemHealth.isAiReady ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Инициализация AI Шлюза...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Начать голосовой разбор</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="w-full py-2 px-3 rounded-2xl bg-white hover:bg-pastel-card border border-pastel-border text-pastel-text text-[11px] font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:border-pastel-accentViolet/50 group"
              >
                <Settings2 className="w-3.5 h-3.5 text-pastel-accentViolet group-hover:rotate-45 transition-transform" />
                <span>⚙️ Все настройки (Голос: {interviewConfig.voice || 'Kore'})</span>
              </button>
            </div>
          </div>
        )}

        {stage === 'active' && (
          <div className="flex-1 flex flex-col min-h-0 justify-between relative">
            {/* SOTA 2026 Voice Hold Overlay (Amber Frosted Glow) */}
            {isSessionPaused && (
              <div className="absolute inset-0 z-40 bg-amber-950/40 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center rounded-3xl animate-fade-in">
                <div className="bg-white/95 rounded-2xl p-5 max-w-xs shadow-2xl border border-amber-200/90 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shadow-inner animate-pulse">
                    ⏸️
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Диалог на паузе
                  </h3>
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
                <span className="text-[10px] text-pastel-accentViolet font-bold shrink-0">
                  {interviewConfig.voice}
                </span>
              </div>

              {/* SOTA 2026 Deictic Grounding Focus Badge */}
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

              {/* Unified Media Control Cluster (SOTA 2026 Ergonomics): [ ⏸️ Пауза ] - ( 🎙️ Сфера ) - [ ⏹️ Стоп ] */}
              <div className="my-2 flex flex-col items-center justify-center shrink-0">
                <div className="flex items-center justify-center gap-3 sm:gap-5">
                  
                  {/* Left: Pause / Resume Button */}
                  {onToggleSessionPause && (
                    <button
                      type="button"
                      onClick={onToggleSessionPause}
                      title={isSessionPaused ? "Продолжить диалог (Пробел)" : "Пауза в диалоге (Пробел)"}
                      className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 touch-manipulation ${
                        isSessionPaused
                          ? 'bg-amber-500 text-white border-amber-600 ring-4 ring-amber-200 shadow-md animate-pulse'
                          : 'bg-white hover:bg-amber-50/60 text-slate-700 border-pastel-border hover:border-amber-300'
                      }`}
                    >
                      {isSessionPaused ? (
                        <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                      ) : (
                        <Pause className="w-5 h-5 text-slate-600" />
                      )}
                      <span className={`text-[9px] font-bold mt-0.5 ${isSessionPaused ? 'text-white' : 'text-slate-600'}`}>
                        {isSessionPaused ? 'Пуск' : 'Пауза'}
                      </span>
                    </button>
                  )}

                  {/* Center: Mic Pulse Sphere & Dynamic VAD VU-Meter */}
                  <div className="relative flex items-center justify-center">
                    {/* Dynamic Acoustic Ripple when user is actively speaking */}
                    {isRecording && isUserSpeaking && (
                      <div
                        className="absolute rounded-full bg-emerald-400/30 animate-ping pointer-events-none"
                        style={{
                          width: `${84 + Math.min(36, Math.max(0, (rmsDb + 50) * 1.5))}px`,
                          height: `${84 + Math.min(36, Math.max(0, (rmsDb + 50) * 1.5))}px`
                        }}
                      />
                    )}
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
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
                          if (isAiSpeaking || isThinking) {
                            onInterruption();
                          } else {
                            toggleMic();
                          }
                        }}
                        className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center text-pastel-text shadow-inner transition hover:scale-105 active:scale-95 cursor-pointer touch-manipulation"
                        title={
                          isAiSpeaking || isThinking
                            ? 'Нажмите, чтобы остановить ИИ (Barge-in)'
                            : isRecording
                            ? 'Нажмите, чтобы отключить микрофон'
                            : 'Нажмите, чтобы включить микрофон'
                        }
                      >
                        {isAiSpeaking ? (
                          <Volume2 className="w-6 h-6 text-pastel-accentRose animate-bounce" />
                        ) : isThinking ? (
                          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                        ) : isRecording ? (
                          <Mic className={`w-6 h-6 ${isUserSpeaking ? 'text-emerald-500 scale-110' : 'text-emerald-600 animate-pulse'} transition-transform`} />
                        ) : (
                          <MicOff className="w-6 h-6 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right: Stop / Barge-in Button */}
                  <button
                    type="button"
                    onClick={onInterruption}
                    disabled={!isAiSpeaking && !isThinking}
                    title={isAiSpeaking ? "Прервать ответ ИИ (Esc)" : isThinking ? "Остановить генерацию (Esc)" : "ИИ не говорит"}
                    className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border transition-all duration-200 shadow-2xs touch-manipulation ${
                      isAiSpeaking || isThinking
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-300 ring-2 ring-rose-200 cursor-pointer active:scale-95'
                        : 'bg-slate-50 text-slate-300 border-slate-200 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Square className={`w-4 h-4 sm:w-5 sm:h-5 ${isAiSpeaking || isThinking ? 'fill-rose-500 text-rose-500 animate-pulse' : ''}`} />
                    <span className="text-[9px] font-bold mt-0.5">Стоп</span>
                  </button>

                </div>

                <div className="mt-1.5 text-center flex flex-col items-center gap-1">
                  {isAiSpeaking ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose text-[10px] font-bold border border-pastel-accentRose/30 animate-pulse flex items-center gap-1">
                      <Volume2 className="w-3 h-3 animate-bounce" />
                      <span>ИИ отвечает вслух...</span>
                    </span>
                  ) : isThinking ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 animate-pulse ${
                        thinkingStage === 'critical'
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : thinkingStage === 'delayed'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-amber-50 text-amber-700 border-amber-300'
                      }`}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>
                          {thinkingStage === 'critical'
                            ? 'Задержка ответа шлюза...'
                            : thinkingStage === 'delayed'
                            ? 'Связь со шлюзом: генерация схемы...'
                            : 'ИИ осмысливает ответ и готовит пояснение...'}
                        </span>
                      </span>
                      {(thinkingStage === 'critical' || thinkingStage === 'delayed') && (
                        <button
                          type="button"
                          onClick={toggleMic}
                          className="px-2 py-0.5 rounded-full bg-white hover:bg-slate-100 border border-slate-300 text-[9px] font-bold text-slate-700 shadow-2xs cursor-pointer flex items-center gap-1"
                          title="Сбросить ожидание и продолжить говорить"
                        >
                          <Mic className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Продолжить говорить</span>
                        </button>
                      )}
                    </div>
                  ) : isRecording && isUserSpeaking ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold border border-emerald-600 shadow-xs flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>Слышу вас: говорите...</span>
                    </span>
                  ) : isRecording && isPauseHolding ? (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Слушаю паузу ({((interviewConfig.vadPauseMs ?? 1800) / 1000).toFixed(1)}с)...</span>
                      </span>
                      <button
                        type="button"
                        onClick={triggerEndTurn}
                        className="px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 text-[9px] font-bold transition border border-amber-300 flex items-center gap-0.5 cursor-pointer shadow-2xs"
                        title="Отправить реплику сразу, не дожидаясь окончания автопаузы"
                      >
                        <Zap className="w-2.5 h-2.5 text-amber-700 fill-current" />
                        <span>Отправить сейчас</span>
                      </button>
                    </div>
                  ) : isRecording ? (
                    interviewConfig.turnMode === 'auto' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-300 flex items-center gap-1">
                          <Mic className="w-3 h-3 text-emerald-600 animate-pulse" />
                          <span>Говорите (Авто-VAD)...</span>
                        </span>
                        <button
                          type="button"
                          onClick={triggerEndTurn}
                          className="px-2 py-0.5 rounded-full bg-pastel-card hover:bg-emerald-50 text-pastel-sub hover:text-emerald-700 text-[9px] font-medium transition border border-pastel-border flex items-center gap-0.5 cursor-pointer"
                          title="Отправить реплику сразу, не дожидаясь автопаузы"
                        >
                          <Zap className="w-2.5 h-2.5 text-emerald-600 fill-current" />
                          <span>Готово</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 flex items-center gap-1">
                          <Mic className="w-3 h-3 text-blue-600" />
                          <span>По очереди:</span>
                        </span>
                        <button
                          type="button"
                          onClick={triggerEndTurn}
                          className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-xs flex items-center gap-1 cursor-pointer animate-pulse"
                          title="Завершить реплику и отправить ответ ИИ"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>Готово ➔</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-pastel-card text-pastel-muted text-[10px] border border-pastel-border flex items-center gap-1">
                      <MicOff className="w-3 h-3 text-slate-400" />
                      <span>Микрофон отключен (нажмите на кружок)</span>
                    </span>
                  )}
                </div>
              </div>

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
                        turn.role === 'ai'
                          ? 'text-pastel-accentViolet font-medium'
                          : turn.role === 'user'
                          ? 'text-pastel-text font-semibold'
                          : 'text-pastel-sub italic text-[10px]'
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

              {/* Unified Multimodal Input Dock (Text & Earphones/Silent Mode) */}
              <div className="mt-2.5 space-y-2">
                {/* Text Input Row with Glassmorphism */}
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

                  {/* Send Text Button */}
                  <button
                    type="button"
                    onClick={() => handleSendCustomText()}
                    disabled={!inputText.trim()}
                    className="p-2 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 active:scale-95 transition-all shadow-xs disabled:opacity-40 disabled:scale-100 cursor-pointer"
                    title="Отправить вопрос в диалог (Enter)"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>

                  {/* Earphones / Silent Mode (Mute) Toggle */}
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isMuted
                        ? 'bg-amber-100/90 border-amber-300 text-amber-800'
                        : 'bg-pastel-bg/60 hover:bg-slate-100 border-pastel-border text-pastel-sub hover:text-pastel-accentViolet'
                    }`}
                    title={isMuted ? '🔇 Режим тишины: озвучка выключена (только текст в чат). Нажмите, чтобы включить голос в наушники.' : '🔊 Озвучка в наушники включена. Нажмите для включения Режима тишины.'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Dynamic Contextual Chips (Always Active with Immediate Barge-in) */}
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSendCustomText('Расскажи подробно, как это устроено в памяти JVM и какие структуры задействованы.')}
                    className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <span>💡 В памяти JVM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendCustomText('Объясни, как это работает под капотом в Spring Framework.')}
                    className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <span>⚙️ В Spring</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendCustomText('Какие главные ошибки и подводные камни допускают на практике по этой теме?')}
                    className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <span>⚠️ Ошибки</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendCustomText('Объясни эту концепцию максимально просто, как для начинающего (ELI5).')}
                    className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <span>👶 ELI5</span>
                  </button>

                  <button
                    type="button"
                    onClick={retryCurrentQuestionCleanly}
                    className="px-2 py-1 rounded-lg bg-pastel-card hover:bg-pastel-card/80 border border-pastel-border text-pastel-muted text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Сбросить историю и начать сначала"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>🔄</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Buttons */}
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
        )}
      </div>
      </div>
    </div>
  );
};
