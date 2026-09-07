import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  Sparkles,
  Mic,
  MicOff,
  Flame,
  ArrowRight,
  RotateCcw,
  Loader2,
  SlidersHorizontal,
  Target,
  Trophy,
  BookOpen,
  Volume2,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Cpu,
  Send,
  VolumeX,
  Zap,
  AlertTriangle,
  StopCircle,
  ArrowLeft,
  Activity
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useLiveAudioSession } from '../../hooks/useLiveAudioSession';
import { BugChallenge, BugChallengeCard } from '../BugChallengeCard';
import { TaskRecoveryCard } from '../TaskRecoveryCard';
import { CandidatePersonaHUD } from '../CandidatePersonaHUD';
import { MemoryRadarDrawer } from '../MemoryRadarDrawer';
import { triggerSuccessConfetti } from '../../utils/confetti';

export type WorkoutPreset = 'exhaustive' | 'senior_multi' | 'random';
export type DefectFocus = 'all' | 'streams' | 'concurrency' | 'testing' | 'memory' | 'spring_aop' | 'contracts';
export type TutorRole = 'bug_hunt' | 'free_chat';
export type TechStackProfile = 'modern_cloud' | 'fintech_transactional' | 'enterprise_migration' | 'reactive_streaming' | 'custom';

const PRESETS: { id: WorkoutPreset; name: string; icon: React.ComponentType<any>; badge: string; desc: string }[] = [
  {
    id: 'exhaustive',
    name: 'Полный охват',
    icon: Target,
    badge: '🎯 100% темы',
    desc: 'Методично перебирает все подтемы без повторов до полного закрытия темы'
  },
  {
    id: 'senior_multi',
    name: 'Senior Review',
    icon: Flame,
    badge: '🔥 2 бага',
    desc: 'Хардкорный режим: 2 скрытых дефекта в одном продакшен-классе'
  },
  {
    id: 'random',
    name: 'Разминка',
    icon: Sparkles,
    badge: '🎲 Рандом',
    desc: 'Бесконечный свободный поток задач для быстрой практики'
  }
];

const DEFECT_FOCUSES: { id: DefectFocus; name: string; iconStr: string }[] = [
  { id: 'all', name: 'Все категории', iconStr: '🌐' },
  { id: 'streams', name: 'Java Streams API & Collectors', iconStr: '🌊' },
  { id: 'concurrency', name: 'Многопоточность & Loom 21+', iconStr: '⚡' },
  { id: 'testing', name: 'Тестирование, Seams & Pitest', iconStr: '🧪' },
  { id: 'memory', name: 'Утечки памяти & Сложность O(N²)', iconStr: '💾' },
  { id: 'spring_aop', name: 'Spring AOP, Прокси & Транзакции', iconStr: '🍃' },
  { id: 'contracts', name: 'Контракты equals/hashCode & Мутации', iconStr: '📐' }
];

const LOADER_STEPS = [
  'Анализ AST-дерева и выявление дефектов...',
  'Синтез антипаттерна в бизнес-логике...',
  'Генерация селектора сложности и подсказок...',
  'Подготовка контекста для AI-Техлида...'
];

const EDUCATIONAL_TRIVIA = [
  'Virtual Threads не ускоряют CPU-bound вычисления, но устраняют блокировку OS Threads при I/O.',
  'Вызов @Transactional метода из того же класса обходит CGLIB/JDK динамический прокси.',
  'Мутация полей объекта после добавления в HashSet ломает контракт hashCode() и приводит к утечкам памяти.',
  'ConcurrentHashMap.computeIfAbsent атомарен per-key, но не должен вызывать тяжелые блокирующие операции внутри лямбды.'
];

export const BugHuntArena: React.FC = () => {
  const { 
    activeTopicBugHunt, 
    closeTopicBugHunt,
    academyBreadcrumbContext,
    returnToAcademyStep,
    toggleAcademyStepProgress
  } = useAppStore();

  const topicId = activeTopicBugHunt?.topicId || 'core';
  const topicName = activeTopicBugHunt?.topicName || 'Java Core & Collections';

  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<WorkoutPreset>('exhaustive');
  const [defectFocus, setDefectFocus] = useState<DefectFocus>('all');
  const [difficulty, setDifficulty] = useState<'middle' | 'senior'>('middle');
  const [tutorRole, setTutorRole] = useState<TutorRole>('bug_hunt');
  const [techStackProfile, setTechStackProfile] = useState<TechStackProfile>('modern_cloud');

  // Challenge history & navigation state
  const [history, setHistory] = useState<BugChallenge[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isLoadingVariation, setIsLoadingVariation] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [sessionSolvedCount, setSessionSolvedCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loaderStepIndex, setLoaderStepIndex] = useState(0);
  const [triviaIndex, setTriviaIndex] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const prefetchControllerRef = useRef<AbortController | null>(null);
  const prefetchedNextChallengeRef = useRef<BugChallenge | null>(null);

  // Derivation of active challenge
  const challenge = currentIndex >= 0 && currentIndex < history.length ? history[currentIndex] : null;

  // Variant number computation
  const currentVariantNumber = useMemo(() => {
    if (!challenge || currentIndex < 0) return 1;
    const sameSubtopicCount = history
      .slice(0, currentIndex + 1)
      .filter(c => c.subtopic === challenge.subtopic).length;
    return Math.max(1, sameSubtopicCount);
  }, [challenge, currentIndex, history]);

  // Multimodal Text Input & Earphone/Silent Mute State
  const [inputText, setInputText] = useState('');
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // Live Audio Hook
  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    dialogueTurns,
    startSession,
    disconnectSession,
    sendTextMessage,
    toggleMic,
    toggleMute
  } = useLiveAudioSession({
    onBugSolved: () => {
      setIsSolved(true);
      setSessionSolvedCount((prev) => prev + 1);
      setHistory((prev) => prev.map((c, i) => (i === currentIndex ? { ...c, isSolved: true } : c)));
      triggerSuccessConfetti();
      if (academyBreadcrumbContext) {
        toggleAcademyStepProgress(
          academyBreadcrumbContext.courseId,
          academyBreadcrumbContext.stepNumber,
          true
        );
      }
    }
  });

  // Timer loop for loader and trivia
  useEffect(() => {
    if (!isLoadingChallenge && !isLoadingVariation) return;

    const secTimer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    const stepTimer = setInterval(() => setLoaderStepIndex(p => (p + 1) % LOADER_STEPS.length), 3200);
    const triviaTimer = setInterval(() => setTriviaIndex(p => (p + 1) % EDUCATIONAL_TRIVIA.length), 4500);

    return () => {
      clearInterval(secTimer);
      clearInterval(stepTimer);
      clearInterval(triviaTimer);
    };
  }, [isLoadingChallenge, isLoadingVariation]);

  // Fetch initial challenge upon mount
  useEffect(() => {
    void fetchChallenge();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (prefetchControllerRef.current) prefetchControllerRef.current.abort();
    };
  }, [topicId]);

  const fetchChallenge = async (overridePreset?: WorkoutPreset, overrideFocus?: DefectFocus) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoadingChallenge(true);
    setGenerationError(null);
    setIsSolved(false);

    const presetToUse = overridePreset || activePreset;
    const focusToUse = overrideFocus || defectFocus;

    try {
      const excludeIds = history.map(c => c.id).filter(Boolean);
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          topicId,
          topic: topicName,
          workoutPreset: presetToUse,
          defectFocus: focusToUse !== 'all' ? focusToUse : undefined,
          difficulty,
          techStackProfile,
          excludeIds
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${res.status}`);
      }

      const newChallenge: BugChallenge = await res.json();
      setHistory(prev => {
        const nextHistory = [...prev, newChallenge];
        setCurrentIndex(nextHistory.length - 1);
        return nextHistory;
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setGenerationError(err.message || 'Ошибка генерации кейса');
      }
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  const handleNextChallenge = () => {
    if (isConnected) disconnectSession();
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsSolved(Boolean(history[currentIndex + 1].isSolved));
    } else {
      void fetchChallenge();
    }
  };

  const handlePreviousChallenge = () => {
    if (isConnected) disconnectSession();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsSolved(Boolean(history[currentIndex - 1].isSolved));
    }
  };

  const handleGenerateVariation = async () => {
    if (!challenge) return;
    setIsLoadingVariation(true);
    try {
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topicId,
          topic: topicName,
          workoutPreset: activePreset,
          difficulty,
          techStackProfile,
          subtopicOverride: challenge.subtopic
        })
      });
      if (res.ok) {
        const variation: BugChallenge = await res.json();
        setHistory((prev) => {
          const nextHistory = [...prev, variation];
          setCurrentIndex(nextHistory.length - 1);
          return nextHistory;
        });
        setIsSolved(false);
      }
    } catch (e) {
      console.error('Variation generation failed:', e);
    } finally {
      setIsLoadingVariation(false);
    }
  };

  const startBugVoiceSession = () => {
    return startSession({
      sessionType: 'tutor',
      tutorMode: tutorRole,
      topic: topicName,
      bugTitle: challenge?.title || '',
      bugExplanation: challenge?.bugExplanation || '',
      codeSnippet: challenge?.codeSnippet || '',
      hints: challenge?.hints || [],
      questionId: challenge?.id || ''
    });
  };

  const handleSendBugText = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    if (!isConnected) {
      void startBugVoiceSession();
    }

    sendTextMessage(text);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] bg-pastel-bg text-pastel-text overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="h-14 border-b border-pastel-border/80 bg-white/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 shadow-2xs z-10">
        {/* Left: Back Buttons & Topic Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {academyBreadcrumbContext ? (
            <button
              onClick={returnToAcademyStep}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-rose/80 hover:bg-pastel-rose text-pastel-accentRose text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">← Назад в Академию: Шаг #{academyBreadcrumbContext.stepNumber}</span>
              <span className="sm:hidden">← Шаг #{academyBreadcrumbContext.stepNumber}</span>
            </button>
          ) : (
            <button
              onClick={closeTopicBugHunt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-bg hover:bg-pastel-rose/40 text-pastel-text text-xs font-bold transition border border-pastel-border shadow-2xs cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">← В каталог инцидентов (70)</span>
              <span className="sm:hidden">← Каталог</span>
            </button>
          )}

          <div className="h-4 w-px bg-pastel-border shrink-0 hidden md:block" />

          <div className="flex items-center gap-2 truncate">
            <span className="text-xs font-bold text-pastel-text truncate">{topicName}</span>
            <span className="hidden lg:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {challenge?.difficultyBadge || 'Senior'}
            </span>
          </div>
        </div>

        {/* Right: Presets & Live Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Preset selector pills */}
          <div className="hidden md:flex items-center gap-1 bg-pastel-bg p-1 rounded-xl border border-pastel-border">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              const isSelected = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePreset(p.id);
                    void fetchChallenge(p.id);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isSelected ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                  }`}
                  title={p.desc}
                >
                  <Icon className="w-3 h-3" />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Solved Counter */}
          {sessionSolvedCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
              <Trophy className="w-3.5 h-3.5" />
              <span>{sessionSolvedCount} решено</span>
            </div>
          )}

          {/* Memory Radar Trigger */}
          <button
            onClick={() => setIsRadarOpen(true)}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-pastel-bg hover:bg-white text-pastel-accentViolet border border-pastel-border text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Радар</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 max-w-7xl 2xl:max-w-[2000px] w-full mx-auto">
        {isLoadingChallenge ? (
          <div className="min-h-[420px] flex flex-col items-center justify-center p-6 bg-white/90 border border-pastel-border/80 rounded-3xl shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white shadow-md animate-pulse">
              <Bug className="w-6 h-6 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-pastel-text">
                {LOADER_STEPS[loaderStepIndex]}
              </h3>
              <p className="text-xs text-pastel-muted font-mono">
                Генерация аутентичного кейса ({elapsedSeconds}с)
              </p>
            </div>

            <div className="w-full max-w-md p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border text-left">
              <span className="text-[10px] font-bold text-pastel-accentRose uppercase tracking-wider block mb-1">
                💡 Инсайт по теме
              </span>
              <p className="text-xs text-pastel-text leading-snug">
                {EDUCATIONAL_TRIVIA[triviaIndex]}
              </p>
            </div>
          </div>
        ) : generationError ? (
          <div className="max-w-2xl mx-auto py-8">
            <TaskRecoveryCard
              reason="challenge_generation_failed"
              userMessage={generationError}
              retryAfterSeconds={5}
              availableBankCount={70}
              onRetry={() => fetchChallenge()}
              onSwitchToBank={() => closeTopicBugHunt()}
              isRetrying={isLoadingChallenge}
            />
          </div>
        ) : challenge ? (
          <div className="space-y-6">
            {/* Session Navigation Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/90 rounded-2xl border border-pastel-border/80 shadow-2xs text-pastel-text">
              <button
                onClick={handlePreviousChallenge}
                disabled={currentIndex <= 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-pastel-bg disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Предыдущий</span>
              </button>

              <span className="text-xs font-bold font-mono text-pastel-text bg-pastel-bg px-3.5 py-1 rounded-xl border border-pastel-border shadow-2xs">
                Кейс {currentIndex + 1} из {history.length}
              </span>

              <button
                onClick={handleNextChallenge}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-pastel-bg transition cursor-pointer"
              >
                <span>{currentIndex < history.length - 1 ? 'Следующий' : 'Новый кейс'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Challenge Code & Interactive Inspector */}
            <BugChallengeCard
              challenge={challenge}
              isSolved={isSolved}
              onRefresh={handleNextChallenge}
              isLoading={isLoadingChallenge}
              onGenerateVariation={handleGenerateVariation}
              isGeneratingVariation={isLoadingVariation}
              variantNumber={currentVariantNumber}
            />

            {/* Socratic AI Voice Mentor Station */}
            <div className="p-5 rounded-2xl bg-white/95 border border-pastel-border/80 shadow-2xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pastel-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-pastel-accentRose" />
                  <span className="text-xs font-bold text-pastel-text">
                    AI-Техлид в реальном времени (Aoede):
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
                    onClick={() => { setTutorRole('bug_hunt'); disconnectSession(); }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      tutorRole === 'bug_hunt' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5" />
                    <span>🐛 Код-ревью</span>
                  </button>

                  <button
                    onClick={() => { setTutorRole('free_chat'); disconnectSession(); }}
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
                      <span>{turn.role === 'ai' ? '🤖' : '👤'}</span>
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
                    isMuted
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-pastel-bg text-pastel-text border-pastel-border hover:bg-white'
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
          </div>
        ) : null}
      </div>

      {/* Memory Radar Drawer */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        onSelectTopicForPractice={(topic) => {
          setIsRadarOpen(false);
          void fetchChallenge();
        }}
      />
    </div>
  );
};

export default BugHuntArena;
