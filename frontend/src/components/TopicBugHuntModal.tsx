import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
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
  Play,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Layers,
  Cpu,
  Settings,
  Send,
  VolumeX,
  Keyboard,
  Zap,
  AlertTriangle,
  StopCircle
} from 'lucide-react';
import { useLiveAudioSession } from '../hooks/useLiveAudioSession';
import { BugChallenge, BugChallengeCard } from './BugChallengeCard';
import { triggerSuccessConfetti } from '../utils/confetti';
import { CandidatePersonaHUD } from './CandidatePersonaHUD';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';

export type WorkoutPreset = 'exhaustive' | 'senior_multi' | 'random';
export type DefectFocus = 'all' | 'concurrency' | 'memory' | 'spring_aop' | 'contracts';
export type TutorRole = 'bug_hunt' | 'free_chat';
export type TechStackProfile = 'modern_cloud' | 'fintech_transactional' | 'enterprise_migration' | 'reactive_streaming' | 'custom';

interface TopicBugHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
  topicName: string;
}

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

const TECH_STACK_PROFILES: { id: TechStackProfile; name: string; badge: string; desc: string; iconStr: string }[] = [
  {
    id: 'modern_cloud',
    name: 'Modern Cloud-Native',
    badge: '🚀 Loom & Boot 3.4+',
    desc: 'Java 21 LTS, Spring Boot 3.4.x, Virtual Threads (Project Loom), PostgreSQL 16, Hibernate 6.6+, Kafka 3.8',
    iconStr: '🚀'
  },
  {
    id: 'fintech_transactional',
    name: 'FinTech / Mission-Critical',
    badge: '💳 Outbox & ACID',
    desc: 'Java 21 LTS, Spring Boot 3.4.x, Transactional Outbox, Debezium CDC, Redisson 3.35 Fenced Locks, PostgreSQL 16',
    iconStr: '💳'
  },
  {
    id: 'enterprise_migration',
    name: 'Enterprise Migration',
    badge: '🏛️ Boot 2.7 ➔ 3.x / Jakarta',
    desc: 'Java 17 ➔ 21, Spring Boot 2.7.18 ➔ 3.4+, Jakarta EE (jakarta.*), Hibernate 5.6 ➔ 6.6 (SQM), Flyway 10',
    iconStr: '🏛️'
  },
  {
    id: 'reactive_streaming',
    name: 'Highload Reactive',
    badge: '⚡ WebFlux & Netty',
    desc: 'Java 21, Spring WebFlux, Project Reactor 3.6, Netty EventLoop, Spring Data R2DBC, Redis Reactive',
    iconStr: '⚡'
  },
  {
    id: 'custom',
    name: 'Свой стек & Промпт',
    badge: '🛠️ Кастомный',
    desc: 'Задайте точные версии технологий и дополнительные промпт-инструкции для генерации',
    iconStr: '🛠️'
  }
];

const DEFECT_FOCUSES: { id: DefectFocus; name: string; iconStr: string }[] = [
  { id: 'all', name: 'Все категории', iconStr: '🌐' },
  { id: 'concurrency', name: 'Многопоточность & Race Conditions', iconStr: '⚡' },
  { id: 'memory', name: 'Утечки памяти & Сложность O(N²)', iconStr: '💾' },
  { id: 'spring_aop', name: 'Spring AOP, Прокси & Транзакции', iconStr: '🍃' },
  { id: 'contracts', name: 'Контракты equals/hashCode & Мутации', iconStr: '📐' }
];

export const TopicBugHuntModal: React.FC<TopicBugHuntModalProps> = ({
  isOpen,
  onClose,
  topicId,
  topicName,
}) => {
  // Modal Stage: 'lobby' (Zero Waste Setup) vs 'workout' (Active Arena)
  const [stage, setStage] = useState<'lobby' | 'workout'>('lobby');
  const [isRadarOpen, setIsRadarOpen] = useState(false);

  // Workout Source: 'ai_fresh' (Generate new) vs 'bank' (Replay saved from SQLite)
  const [sourceMode, setSourceMode] = useState<'ai_fresh' | 'bank'>('ai_fresh');
  const [savedChallenges, setSavedChallenges] = useState<BugChallenge[]>([]);
  const [bankFilter, setBankFilter] = useState<'all' | 'unsolved' | 'solved'>('all');
  const [bankIndex, setBankIndex] = useState(0);

  // Workout Configuration
  const [activePreset, setActivePreset] = useState<WorkoutPreset>('exhaustive');
  const [defectFocus, setDefectFocus] = useState<DefectFocus>('all');
  const [difficulty, setDifficulty] = useState<'middle' | 'senior'>('middle');
  const [tutorRole, setTutorRole] = useState<TutorRole>('bug_hunt');
  const [techStackProfile, setTechStackProfile] = useState<TechStackProfile>('modern_cloud');
  const [customTechStack, setCustomTechStack] = useState<string>('Java 21, Spring Boot 3.4, Kotlin, Kafka, Redis');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // User-Controlled Turbo-Prefetch Feature (0s Wait)
  const [isTurboPrefetchEnabled, setIsTurboPrefetchEnabled] = useState<boolean>(false);
  const prefetchedChallengeRef = useRef<BugChallenge | null>(null);
  const [isPrefetching, setIsPrefetching] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Session Linear History Stack & State
  const [history, setHistory] = useState<BugChallenge[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isLoadingVariation, setIsLoadingVariation] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [sessionSolvedCount, setSessionSolvedCount] = useState(0);
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const [isExhausted, setIsExhausted] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Honest Monotonic Elapsed Timer & Cognitive Stepper
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [loaderStepIndex, setLoaderStepIndex] = useState(0);
  const [triviaIndex, setTriviaIndex] = useState(0);

  const LOADER_STEPS = [
    '🔍 Анализ архитектурных спецификаций (Java 21 & Spring Boot 3.4)...',
    '⚡ Ментальное моделирование конкурентных гонок (Race Conditions & Loom)...',
    '📊 Синтез контекста инцидента и телеметрии Grafana/Sentry...',
    '🛡️ Многопроходная верификация эталонного фикса и калибровка подсказок...'
  ];

  const EDUCATIONAL_TRIVIA = [
    '💡 В Java 21 `synchronized` блокирует несущий поток (Carrier Thread) виртуального Loom-потока. В высоконагруженных микросервисах используйте `ReentrantLock`.',
    '💡 `@Transactional` в Spring по умолчанию не откатывает Checked исключения (`Exception`). Чтобы откатывать любые сбои, используйте `rollbackFor = Exception.class`.',
    '💡 В `ConcurrentHashMap` метод `computeIfAbsent()` гарантирует атомарность на уровне ключа, но вычисления внутри лямбды должны быть быстрыми и неблокирующими.',
    '💡 Паттерн Transactional Outbox решает проблему Dual-Write: запись бизнес-сущности и сообщения в очередь происходит в одной ACID-транзакции БД.',
    '💡 В Hibernate 6.6 генератор ID `SEQUENCE` с `allocationSize > 1` снижает количество сетевых round-trip запросов к PostgreSQL в разы.'
  ];

  // Monotonic timer for generation HUD & trivia cycling
  useEffect(() => {
    if (!isLoadingChallenge && !isLoadingVariation) {
      setElapsedSeconds(0);
      setLoaderStepIndex(0);
      setTriviaIndex(0);
      return;
    }
    const secTimer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    const stepTimer = setInterval(() => {
      setLoaderStepIndex((prev) => (prev + 1) % LOADER_STEPS.length);
    }, 3200);

    const triviaTimer = setInterval(() => {
      setTriviaIndex((prev) => (prev + 1) % EDUCATIONAL_TRIVIA.length);
    }, 4500);

    return () => {
      clearInterval(secTimer);
      clearInterval(stepTimer);
      clearInterval(triviaTimer);
    };
  }, [isLoadingChallenge, isLoadingVariation]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Active Challenge is derived from history[currentIndex]
  const challenge = currentIndex >= 0 && currentIndex < history.length ? history[currentIndex] : null;

  // Compute variant number for current challenge
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

  // Unified Live Audio Hook
  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    statusMessage,
    dialogueTurns,
    aiTranscript,
    startSession,
    disconnectSession,
    sendTextMessage,
    toggleMic,
    toggleMute,
    setStatusMessage,
    setAiTranscript
  } = useLiveAudioSession({
    onBugSolved: (payload) => {
      setIsSolved(true);
      setSessionSolvedCount((prev) => prev + 1);
      triggerSuccessConfetti();
    }
  });

  const toggleAudioSession = () => {
    if (isConnected) {
      disconnectSession();
    } else {
      void startSession({
        sessionType: 'tutor',
        tutorMode: tutorRole,
        topic: topicName || 'Java & Spring Framework',
        bugTitle: challenge?.title || '',
        bugExplanation: challenge?.bugExplanation || '',
        codeSnippet: challenge?.codeSnippet || '',
        hints: challenge?.hints || [],
        questionId: challenge?.id || '',
        voice: 'Aoede'
      });
    }
  };

  const handleSendBugText = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    if (!isConnected) {
      void startSession({
        sessionType: 'tutor',
        tutorMode: tutorRole,
        topic: topicName || 'Java & Spring Framework',
        bugTitle: challenge?.title || '',
        bugExplanation: challenge?.bugExplanation || '',
        codeSnippet: challenge?.codeSnippet || '',
        hints: challenge?.hints || [],
        questionId: challenge?.id || '',
        voice: 'Aoede'
      }).then(() => {
        setTimeout(() => {
          sendTextMessage(text, text);
        }, 500);
      });
    } else {
      sendTextMessage(text, text);
    }
    setInputText('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendBugText();
    }
  };

  // Fetch saved bank on modal open
  useEffect(() => {
    if (isOpen) {
      setStage('lobby');
      setIsExhausted(false);
      setSessionSolvedCount(0);
      setSeenQuestionIds([]);
      setHistory([]);
      setCurrentIndex(-1);
      prefetchedChallengeRef.current = null;
      fetchSavedBank();
    } else {
      disconnectSession();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [isOpen, topicId]);

  const fetchSavedBank = async () => {
    try {
      const res = await fetch(`/api/tutor/saved-challenges?topicId=${encodeURIComponent(topicId)}`);
      if (res.ok) {
        const data: BugChallenge[] = await res.json();
        setSavedChallenges(data);
      }
    } catch (e) {
      console.warn('Could not fetch saved bug challenges:', e);
    }
  };

  const filteredBank = savedChallenges.filter((c) => {
    if (bankFilter === 'unsolved') return !c.isSolved;
    if (bankFilter === 'solved') return Boolean(c.isSolved);
    return true;
  });

  // Background Speculative Prefetch Trigger (Only when enabled by User)
  const triggerBackgroundPrefetch = async (currentSeen: string[]) => {
    if (!isTurboPrefetchEnabled || sourceMode === 'bank' || isPrefetching) return;
    setIsPrefetching(true);

    try {
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          topic: topicName,
          workoutPreset: activePreset,
          defectFocus,
          difficulty: activePreset === 'senior_multi' ? 'senior' : difficulty,
          excludeIds: activePreset === 'exhaustive' ? currentSeen : [],
          techStackProfile,
          customTechStack: techStackProfile === 'custom' ? customTechStack : undefined,
          customInstructions: techStackProfile === 'custom' && customInstructions ? customInstructions : undefined
        })
      });

      if (res.ok) {
        const nextData: BugChallenge = await res.json();
        if (!nextData.isTopicExhausted) {
          prefetchedChallengeRef.current = nextData;
          console.log('⚡ [Turbo Prefetch] Challenge buffered for instant 0ms transition');
        }
      }
    } catch (e) {
      console.debug('Background prefetch deferred:', e);
    } finally {
      setIsPrefetching(false);
    }
  };

  // Fetch or generate a brand new topic challenge
  const fetchNewChallenge = async (currentSeen: string[] = seenQuestionIds) => {
    // Abort previous in-flight call if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setGenerationError(null);
    setIsLoadingChallenge(true);
    setIsSolved(false);
    setAiTranscript('');

    // If source is saved bank
    if (sourceMode === 'bank') {
      if (filteredBank.length === 0) {
        setGenerationError('В базе пока нет сохраненных задач по этой теме. Попробуйте сгенерировать новую.');
        setStatusMessage('В банке нет задач по выбранному фильтру.');
        setIsLoadingChallenge(false);
        return;
      }
      const targetIndex = bankIndex % filteredBank.length;
      const targetChallenge = filteredBank[targetIndex];
      setHistory(prev => [...prev, targetChallenge]);
      setCurrentIndex(prev => prev + 1);
      setBankIndex(prev => prev + 1);
      setIsLoadingChallenge(false);
      return;
    }

    // Fresh AI generation via LiteLLM
    try {
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          topicId,
          topic: topicName,
          workoutPreset: activePreset,
          defectFocus,
          difficulty: activePreset === 'senior_multi' ? 'senior' : difficulty,
          excludeIds: activePreset === 'exhaustive' ? currentSeen : [],
          techStackProfile,
          customTechStack: techStackProfile === 'custom' ? customTechStack : undefined,
          customInstructions: techStackProfile === 'custom' && customInstructions ? customInstructions : undefined
        })
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Ошибка сервера (${res.status}): ${errorText || 'Не удалось получить инцидент'}`);
      }
      const data: BugChallenge = await res.json();

      if (data.isTopicExhausted) {
        setIsExhausted(true);
        triggerSuccessConfetti();
      } else {
        setHistory(prev => [...prev, data]);
        setCurrentIndex(prev => prev + 1);
        const nextSeen = data.sampledQuestionId && !currentSeen.includes(data.sampledQuestionId)
          ? [...currentSeen, data.sampledQuestionId]
          : currentSeen;
        
        if (data.sampledQuestionId && !currentSeen.includes(data.sampledQuestionId)) {
          setSeenQuestionIds(nextSeen);
        }

        // Trigger speculative background prefetch for next task if user enabled Turbo
        if (isTurboPrefetchEnabled) {
          setTimeout(() => triggerBackgroundPrefetch(nextSeen), 1000);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Challenge generation aborted by user');
        return;
      }
      console.error('Error fetching challenge:', error);
      const msg = error?.message || 'Шлюз нейросети испытывает повышенную нагрузку. Попробуйте еще раз.';
      setGenerationError(msg);
      setStatusMessage('Ошибка загрузки задачи. Попробуйте еще раз.');
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  // Generate another variation of the SAME subtopic
  const handleGenerateVariation = async () => {
    if (!challenge) return;
    disconnectSession();
    setIsLoadingVariation(true);
    setAiTranscript('');

    try {
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          topic: topicName,
          questionId: challenge.sampledQuestionId,
          questionText: challenge.subtopic,
          workoutPreset: activePreset,
          defectFocus,
          difficulty: activePreset === 'senior_multi' ? 'senior' : difficulty,
          techStackProfile,
          customTechStack: techStackProfile === 'custom' ? customTechStack : undefined,
          customInstructions: techStackProfile === 'custom' && customInstructions ? customInstructions : undefined
        })
      });

      if (!res.ok) throw new Error('Ошибка генерации варианта задачи');
      const data: BugChallenge = await res.json();

      const updatedHistory = [
        ...history.slice(0, currentIndex + 1),
        data,
        ...history.slice(currentIndex + 1)
      ];
      setHistory(updatedHistory);
      setCurrentIndex(currentIndex + 1);
      setIsSolved(false);
    } catch (error) {
      console.error('Error generating variation:', error);
      setStatusMessage('Ошибка генерации варианта. Попробуйте еще раз.');
    } finally {
      setIsLoadingVariation(false);
    }
  };

  // Navigation Handlers (Back / Forward in Session Stack)
  const handlePreviousChallenge = () => {
    if (currentIndex > 0) {
      disconnectSession();
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setIsSolved(Boolean(history[prevIdx]?.isSolved));
      setAiTranscript('');
    }
  };

  const handleNextChallenge = () => {
    disconnectSession();
    setAiTranscript('');

    if (currentIndex < history.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setIsSolved(Boolean(history[nextIdx]?.isSolved));
      return;
    }

    // Check Turbo Prefetch Buffer (0ms Latency)
    if (prefetchedChallengeRef.current) {
      const buffered = prefetchedChallengeRef.current;
      prefetchedChallengeRef.current = null;
      setHistory(prev => [...prev, buffered]);
      setCurrentIndex(prev => prev + 1);
      setIsSolved(false);
      
      const nextSeen = buffered.sampledQuestionId && !seenQuestionIds.includes(buffered.sampledQuestionId)
        ? [...seenQuestionIds, buffered.sampledQuestionId]
        : seenQuestionIds;
      if (buffered.sampledQuestionId && !seenQuestionIds.includes(buffered.sampledQuestionId)) {
        setSeenQuestionIds(nextSeen);
      }

      if (isTurboPrefetchEnabled) {
        setTimeout(() => triggerBackgroundPrefetch(nextSeen), 1000);
      }
      return;
    }

    // Regular Fetch
    void fetchNewChallenge();
  };

  // Start workout from Lobby
  const handleStartWorkout = () => {
    setGenerationError(null);
    setStage('workout');
    setHistory([]);
    setCurrentIndex(-1);
    prefetchedChallengeRef.current = null;
    fetchNewChallenge([]);
  };

  const handleCancelGenerationAndOpenBank = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoadingChallenge(false);
    setSourceMode('bank');
    fetchNewChallenge();
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Keyboard Shortcuts Listener in Workout Mode
  useEffect(() => {
    if (!isOpen || stage !== 'workout') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isConnected) {
          disconnectSession();
        } else {
          toggleAudioSession();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextChallenge();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousChallenge();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, isConnected, currentIndex, history]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-[#1A0B2E]/40 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#FFF9FB] border border-pink-200/90 w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#2D1B4E]"
      >
        {/* Modal Top Bar in Pure Soft Luxury Glass */}
        <div className="px-6 py-4 bg-white/90 border-b border-pink-100/90 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-200 via-purple-200 to-rose-300 flex items-center justify-center shadow-xs text-[#4A1E6D]">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-bold text-[#2D1B4E]">
                  Bug Hunt Arena
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-[#4A1E6D] border border-pink-200/80 shadow-2xs">
                  2026 SOTA
                </span>
              </div>
              <p className="text-xs text-[#7E699B] font-sans">
                Тема: <span className="font-semibold text-[#4A1E6D]">{topicName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CandidatePersonaHUD
              questionText={challenge?.title || ''}
              topic={topicName}
              questionId={challenge?.id || ''}
              onOpenRadar={() => setIsRadarOpen(true)}
            />

            {stage === 'workout' && (
              <button
                onClick={() => { disconnectSession(); setStage('lobby'); }}
                className="flex items-center gap-1.5 text-xs text-[#4A326D] hover:text-[#2D1B4E] px-3.5 py-1.5 rounded-xl border border-pink-200 bg-white/80 hover:bg-pink-50/80 transition-colors shadow-2xs cursor-pointer font-semibold"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-pink-600" />
                <span>Настройки лобби</span>
              </button>
            )}

            <button
              onClick={() => { disconnectSession(); onClose(); }}
              className="w-9 h-9 rounded-xl hover:bg-pink-100/60 flex items-center justify-center text-[#7E699B] hover:text-[#2D1B4E] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* ========================================================= */}
          {/* STAGE 1: LOBBY (Workout Setup & Problem Bank) */}
          {/* ========================================================= */}
          {stage === 'lobby' && (
            <div className="max-w-3xl mx-auto space-y-6 py-2">
              {/* Source Mode Toggle: Fresh AI vs Saved Bank */}
              <div className="flex p-1.5 rounded-2xl bg-pink-100/70 border border-pink-200/60">
                <button
                  onClick={() => setSourceMode('ai_fresh')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceMode === 'ai_fresh'
                      ? 'bg-white text-[#2D1B4E] shadow-sm'
                      : 'text-[#7E699B] hover:text-[#2D1B4E]'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-pink-600" />
                  <span>✨ Свежая AI-генерация</span>
                </button>

                <button
                  onClick={() => setSourceMode('bank')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceMode === 'bank'
                      ? 'bg-white text-[#2D1B4E] shadow-sm'
                      : 'text-[#7E699B] hover:text-[#2D1B4E]'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>📚 Мой банк задач ({savedChallenges.length})</span>
                </button>
              </div>

              {/* View 1: Fresh AI Generator Configuration */}
              {sourceMode === 'ai_fresh' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Preset Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#4A1E6D] flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-pink-600" />
                      <span>1. Режим тренировки:</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {PRESETS.map((p) => {
                        const Icon = p.icon;
                        const isSelected = activePreset === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setActivePreset(p.id)}
                            className={`p-4 rounded-2xl text-left border transition-all relative cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-b from-purple-50 to-rose-50 border-pink-300 ring-2 ring-pink-300 shadow-sm'
                                : 'bg-white/80 border-pink-200/60 hover:bg-pink-50/50 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-[#2D1B4E]">
                                {p.name}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-pink-200 font-bold text-[#4A1E6D]">
                                {p.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#7E699B] leading-snug font-normal">
                              {p.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tech Stack Archetype Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#4A1E6D] flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-purple-600" />
                      <span>2. Технологический стек (Версии и инфраструктура):</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {TECH_STACK_PROFILES.map((st) => {
                        const isSelected = techStackProfile === st.id;
                        return (
                          <button
                            key={st.id}
                            onClick={() => setTechStackProfile(st.id)}
                            className={`p-3.5 rounded-2xl text-left border transition-all relative cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-br from-purple-50 via-rose-50 to-white border-pink-300 ring-2 ring-pink-300 shadow-sm'
                                : 'bg-white/80 border-pink-200/60 hover:bg-pink-50/50 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{st.iconStr}</span>
                                <span className="text-xs font-bold text-[#2D1B4E]">{st.name}</span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-pink-100/80 text-[#4A1E6D] border border-pink-200/60 font-bold">
                                {st.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#7E699B] leading-tight font-normal">
                              {st.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Tech Stack & Prompt Fields (Animated Expand) */}
                    <AnimatePresence>
                      {techStackProfile === 'custom' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 rounded-2xl bg-white/90 border border-pink-200/80 shadow-2xs space-y-3 pt-3"
                        >
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#4A1E6D] flex items-center gap-1">
                              <Settings className="w-3 h-3 text-pink-600" />
                              <span>Свой технологический стек (версии библиотек, БД, брокеры):</span>
                            </label>
                            <input
                              type="text"
                              value={customTechStack}
                              onChange={(e) => setCustomTechStack(e.target.value)}
                              placeholder="Например: Kotlin 2.0, Spring Boot 3.3, Coroutines, MongoDB, Kafka"
                              className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#FFF9FB] border border-pink-200 text-[#2D1B4E] placeholder:text-[#9D88B5] focus:outline-none focus:ring-2 focus:ring-pink-300"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#4A1E6D] flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>Дополнительные инструкции промпта (фокус тем или специфика собеседования):</span>
                            </label>
                            <textarea
                              value={customInstructions}
                              onChange={(e) => setCustomInstructions(e.target.value)}
                              rows={2}
                              placeholder="Например: Сделай упор на распределенные транзакции, идемпотентность в Kafka и дедлоки."
                              className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#FFF9FB] border border-pink-200 text-[#2D1B4E] placeholder:text-[#9D88B5] focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Defect Focus Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#4A1E6D] flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                      <span>3. Категория дефектов (Фокус):</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DEFECT_FOCUSES.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setDefectFocus(f.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            defectFocus === f.id
                              ? 'bg-[#4A1E6D] text-white border-[#4A1E6D] shadow-xs'
                              : 'bg-white/80 border-pink-200/60 text-[#4A326D] hover:bg-pink-100/50 shadow-2xs'
                          }`}
                        >
                          <span className="mr-1.5">{f.iconStr}</span>
                          <span>{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. User-Controlled Turbo Prefetching Switch */}
                  <div className="p-4 rounded-2xl bg-white/90 border border-pink-200/80 shadow-2xs flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#2D1B4E]">⚡ Турбо-переход: Фоновая предзагрузка</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            0с ожидания
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7E699B] leading-tight mt-0.5">
                          Генерирует следующую задачу в фоне во время решения текущей для мгновенного перехода. Расходует дополнительную квоту токенов.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTurboPrefetchEnabled(!isTurboPrefetchEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                        isTurboPrefetchEnabled ? 'bg-[#D94680]' : 'bg-slate-300'
                      }`}
                      title={isTurboPrefetchEnabled ? 'Турбо-предзагрузка включена' : 'Турбо-предзагрузка выключена (экономия токенов)'}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 left-0.5 ${
                          isTurboPrefetchEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* View 2: Saved Problem Bank (Replay) */}
              {sourceMode === 'bank' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950">
                        Персональный банк: {savedChallenges.length} кейсов
                      </h3>
                      <p className="text-xs text-emerald-800">
                        Мгновенный запуск за 0 мс без ожидания генерации и без расхода токенов.
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {(['all', 'unsolved', 'solved'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setBankFilter(f)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            bankFilter === f
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-emerald-950 hover:bg-emerald-100/80 border border-emerald-200'
                          }`}
                        >
                          {f === 'all' && `Все (${savedChallenges.length})`}
                          {f === 'unsolved' && `🔥 Ошибки (${savedChallenges.filter(c => !c.isSolved).length})`}
                          {f === 'solved' && `✨ Решено (${savedChallenges.filter(c => c.isSolved).length})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredBank.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-pink-200 bg-white/60 text-[#7E699B]">
                      <p className="text-sm font-semibold text-[#2D1B4E]">В этой выборке пока нет сохраненных задач.</p>
                      <p className="text-xs mt-1">Переключитесь на «Свежую генерацию», чтобы создать новые кейсы.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {filteredBank.slice(0, 10).map((b, i) => (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl bg-white border border-pink-200/70 flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-pink-100 text-[#4A1E6D] flex items-center justify-center font-bold text-[10px]">
                              {i + 1}
                            </span>
                            <span className="font-bold text-[#2D1B4E]">
                              {b.title}
                            </span>
                            <span className="text-[10px] text-[#7E699B] font-mono">
                              ({b.categoryBadge || '⚡ Concurrency'})
                            </span>
                          </div>

                          {b.lastScore !== undefined && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                              Оценка: {b.lastScore}/10
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Glowing Start Button */}
              <div className="pt-2">
                <button
                  onClick={handleStartWorkout}
                  disabled={sourceMode === 'bank' && filteredBank.length === 0}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#4A1E6D] via-[#7B2869] to-[#D94680] text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    {sourceMode === 'bank'
                      ? `🚀 Начать повторение банка (${filteredBank.length} задач)`
                      : `🚀 Начать симуляцию инцидента (${TECH_STACK_PROFILES.find(s => s.id === techStackProfile)?.name || 'Modern Cloud'})`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STAGE 2: WORKOUT ARENA (Active Challenge + Voice Tutor) */}
          {/* ========================================================= */}
          {stage === 'workout' && (
            <>
              {/* 100% Exhaustion Victory State */}
              {isExhausted ? (
                <div className="text-center py-10 space-y-4 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center shadow-lg border border-amber-300">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-[#2D1B4E]">
                    Тема полностью закрыта на 100%!
                  </h2>
                  <p className="text-xs text-[#7E699B] leading-relaxed font-sans">
                    Вы проработали все подразделы темы <span className="font-semibold text-[#4A1E6D]">{topicName}</span> без единого повтора.
                  </p>
                  <button
                    onClick={() => { setSeenQuestionIds([]); setIsExhausted(false); fetchNewChallenge([]); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#D94680] to-[#9333EA] text-white shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Пройти тему заново</span>
                  </button>
                </div>
              ) : isLoadingChallenge ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4 text-[#7E699B] max-w-lg mx-auto text-center animate-fade-in">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-pink-600 animate-spin" />
                    <span className="absolute inset-0 rounded-full bg-pink-400/20 animate-ping" />
                  </div>
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-pink-100 text-[#4A1E6D] border border-pink-200">
                        ⏳ {formatElapsed(elapsedSeconds)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-100/80 text-purple-950 border border-purple-200 shadow-2xs">
                        🧠 Deep Reasoning: 4096 токенов
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-[#4A1E6D] transition-all duration-300 min-h-[32px] flex items-center justify-center px-4">
                      {LOADER_STEPS[loaderStepIndex]}
                    </p>
                    <p className="text-[10px] text-[#9D88B5]">
                      Глубокий синтез инцидента через LiteLLM • Шаг {loaderStepIndex + 1} из {LOADER_STEPS.length}
                    </p>
                  </div>
                  {/* Step indicators */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {LOADER_STEPS.map((_, idx) => (
                      <span
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === loaderStepIndex
                            ? 'w-6 bg-gradient-to-r from-pink-500 to-purple-600'
                            : 'w-1.5 bg-pink-200'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Educational Micro-Trivia Card */}
                  <div className="w-full mt-2 p-3.5 rounded-2xl bg-white/90 border border-pink-200/80 shadow-xs text-left animate-fade-in transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-pink-700 uppercase tracking-wider flex items-center gap-1">
                        <span>💡 Инсайт по теме</span>
                      </span>
                      <span className="text-[9px] text-[#9D88B5] font-mono">
                        Инсайт {triviaIndex + 1} из {EDUCATIONAL_TRIVIA.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A1E6D] leading-snug font-normal">
                      {EDUCATIONAL_TRIVIA[triviaIndex]}
                    </p>
                  </div>

                  {/* Cancel and fallback to bank button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCancelGenerationAndOpenBank}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white/90 hover:bg-pink-50 border border-pink-200 text-[#4A1E6D] transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>✕ Прервать и открыть готовую задачу из базы</span>
                    </button>
                  </div>
                </div>
              ) : challenge ? (
                <div className="space-y-6">
                  {/* Session Navigation Bar (Back, Counter, Next) */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white/90 rounded-2xl border border-pink-200/70 shadow-xs backdrop-blur-md text-[#4A326D]">
                    <button
                      onClick={handlePreviousChallenge}
                      disabled={currentIndex <= 0}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#4A326D] hover:bg-pink-100/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Предыдущий</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-[#4A1E6D] bg-pink-100/80 px-3.5 py-1 rounded-xl border border-pink-200/80 shadow-2xs">
                        Задача {currentIndex + 1} из {history.length}
                      </span>
                      {isTurboPrefetchEnabled && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>Турбо 0с</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleNextChallenge}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#4A326D] hover:bg-pink-100/60 transition-all cursor-pointer"
                    >
                      <span>{currentIndex < history.length - 1 ? 'Следующий' : 'Новая подтема'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Challenge Code & Details with Tech Stack & Incident Lore */}
                  <BugChallengeCard
                    challenge={challenge}
                    isSolved={isSolved}
                    onRefresh={handleNextChallenge}
                    isLoading={isLoadingChallenge}
                    onGenerateVariation={handleGenerateVariation}
                    isGeneratingVariation={isLoadingVariation}
                    variantNumber={currentVariantNumber}
                  />

                  {/* AI Live Tutor & Code Review Multimodal Station */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/90 via-white to-pink-50/80 border border-pink-200/80 shadow-xs space-y-3.5 backdrop-blur-md">
                    {/* Header with Tutor Role Switcher & Audio Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-pink-600" />
                        <span className="text-xs font-bold text-[#2D1B4E]">
                          AI-Техлид в реальном времени (Aoede):
                        </span>
                        {isMuted ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            🔇 Режим тишины
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            🎧 Озвучка в наушники
                          </span>
                        )}
                      </div>

                      {/* AI Role Switcher (Code Review vs Freeform Chat) */}
                      <div className="flex items-center gap-1 bg-pink-100/70 p-1 rounded-xl border border-pink-200/50 self-start sm:self-auto shadow-2xs">
                        <button
                          type="button"
                          onClick={() => { setTutorRole('bug_hunt'); disconnectSession(); }}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            tutorRole === 'bug_hunt'
                              ? 'bg-white text-[#4A1E6D] shadow-xs'
                              : 'text-[#7E699B] hover:text-[#2D1B4E]'
                          }`}
                        >
                          <Bug className="w-3.5 h-3.5" />
                          <span>🐛 Код-ревью (Валидация)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setTutorRole('free_chat'); disconnectSession(); }}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            tutorRole === 'free_chat'
                              ? 'bg-white text-[#4A1E6D] shadow-xs'
                              : 'text-[#7E699B] hover:text-[#2D1B4E]'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>💬 Свободный диалог</span>
                        </button>
                      </div>
                    </div>

                    {/* Live Conversational Turns Box */}
                    <div className="h-32 overflow-y-auto p-3 rounded-xl bg-white/90 border border-pink-200/70 space-y-2 text-xs">
                      {dialogueTurns.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#9D88B5] italic text-center text-[11px] gap-1">
                          <span>Напишите гипотезу бага в поле ниже или включите микрофон...</span>
                          <span className="text-[10px] opacity-75">Техлид проверит логику и даст обратную связь в наушники</span>
                        </div>
                      ) : (
                        dialogueTurns.map((turn, index) => (
                          <div
                            key={index}
                            className={`flex gap-1.5 leading-relaxed text-[11px] ${
                              turn.role === 'ai'
                                ? 'text-[#4A1E6D] font-medium'
                                : turn.role === 'user'
                                ? 'text-[#2D1B4E] font-semibold'
                                : 'text-[#7E699B] italic text-[10px]'
                            }`}
                          >
                            <span className="shrink-0">
                              {turn.role === 'ai' ? '🤖' : turn.role === 'user' ? '👤' : 'ℹ️'}
                            </span>
                            <span>{turn.text}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Unified Multimodal Input Dock for Bug Hunt */}
                    <div className="space-y-2">
                      {/* Text Input Row with Glassmorphism */}
                      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/95 border border-pink-200/90 shadow-2xs focus-within:ring-2 focus-within:ring-pink-400/40 focus-within:border-pink-400/80 transition-all">
                        <input
                          ref={textInputRef}
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                          disabled={isAiSpeaking && !isMuted}
                          placeholder={isAiSpeaking ? 'Техлид говорит в наушники...' : '💬 Опишите найденный баг или задайте вопрос техлиду (Enter)...'}
                          className="flex-1 px-3 py-1.5 text-xs text-[#2D1B4E] bg-transparent placeholder:text-[#9D88B5] focus:outline-none disabled:opacity-50"
                        />

                        {/* Send Text Button */}
                        <button
                          type="button"
                          onClick={() => handleSendBugText()}
                          disabled={!inputText.trim() || (isAiSpeaking && !isMuted)}
                          className="p-2 rounded-xl bg-gradient-to-r from-[#D94680] to-[#9333EA] text-white hover:opacity-95 active:scale-95 transition-all shadow-xs disabled:opacity-40 disabled:scale-100 cursor-pointer"
                          title="Отправить решение или вопрос техлиду (Enter)"
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
                              : 'bg-pink-50/60 hover:bg-pink-100/80 border-pink-200 text-[#4A1E6D]'
                          }`}
                          title={isMuted ? '🔇 Режим тишины: озвучка выключена (только текст в чат). Нажмите, чтобы включить голос в наушники.' : '🔊 Озвучка в наушники включена. Нажмите для включения Режима тишины.'}
                        >
                          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>

                        {/* Microphone Toggle Button */}
                        <button
                          type="button"
                          onClick={toggleAudioSession}
                          className={`p-2 rounded-xl transition-all cursor-pointer ${
                            isConnected
                              ? 'bg-rose-500 text-white shadow-xs animate-pulse'
                              : 'bg-pink-100 text-[#4A1E6D] hover:bg-pink-200 border border-pink-200'
                          }`}
                          title={isConnected ? 'Выключить микрофон' : 'Включить микрофон для устного ответа'}
                        >
                          {isConnected ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Quick Bug Hunt Chips */}
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleSendBugText('Дай, пожалуйста, первую небольшую подсказку: в каком направлении искать дефект?')}
                          disabled={isAiSpeaking && !isMuted}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <span>💡 Подсказка 1</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendBugText('Подскажи, в каком методе или блоке кода кроется проблема?')}
                          disabled={isAiSpeaking && !isMuted}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <span>🔍 Где дефект?</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendBugText('Я нашел баг в этом коде. Давай я объясню, в чем суть дефекта и как его починить.')}
                          disabled={isAiSpeaking && !isMuted}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>⚡ Проверить решение</span>
                        </button>

                        {/* Navigation button */}
                        <button
                          type="button"
                          onClick={handleNextChallenge}
                          className="px-3 py-1 rounded-lg font-bold text-[10px] bg-white border border-pink-200/80 hover:bg-pink-50 transition-all flex items-center gap-1 text-[#4A1E6D] shadow-2xs cursor-pointer ml-auto"
                        >
                          <span>{currentIndex < history.length - 1 ? 'Вперед' : 'Следующая'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hotkeys helper bar */}
                  <div className="text-center text-[11px] font-mono text-[#9D88B5] select-none">
                    [← / →] Навигация по задачам • [Пробел] Микрофон
                  </div>
                </div>
              ) : (
                /* Explicit Recovery State Card - Zero Blank Screen Invariant */
                <div className="py-12 px-6 max-w-lg mx-auto text-center space-y-5 bg-white/95 rounded-3xl border border-rose-200/80 shadow-md backdrop-blur-md">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-100 to-amber-100 text-rose-600 mx-auto flex items-center justify-center shadow-xs border border-rose-200">
                    <AlertTriangle className="w-8 h-8" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-[#2D1B4E]">
                      Не удалось загрузить инцидент
                    </h3>
                    <p className="text-xs text-[#7E699B] leading-relaxed font-sans">
                      {generationError || 'Нейросеть испытывает повышенную нагрузку при генерации комплексного кейса для выбранного стека.'}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => fetchNewChallenge()}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#D94680] to-[#9333EA] text-white shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Повторить генерацию</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSourceMode('bank');
                        fetchNewChallenge();
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-pink-50 hover:bg-pink-100/80 border border-pink-200 text-[#4A1E6D] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Взять задачу из базы</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStage('lobby')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 border border-slate-200 text-[#4A1E6D] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Settings className="w-4 h-4" />
                      <span>В лобби</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Memory Radar Drawer */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
      />
    </div>,
    document.body
  );
};
export default TopicBugHuntModal;
