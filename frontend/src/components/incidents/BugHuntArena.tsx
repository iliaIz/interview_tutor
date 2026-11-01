import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bug, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useLiveVoiceSession } from '../../audio/useLiveVoiceSession';
import { BugChallenge, BugChallengeCard } from '../BugChallengeCard';
import { TaskRecoveryCard } from '../TaskRecoveryCard';
import { MemoryRadarDrawer } from '../MemoryRadarDrawer';
import { triggerSuccessConfetti } from '../../utils/confetti';
import { BugHuntHeader, WorkoutPreset } from './bughunt/BugHuntHeader';
import { BugHuntVoiceMentor, TutorRole } from './bughunt/BugHuntVoiceMentor';

export type DefectFocus = 'all' | 'streams' | 'concurrency' | 'testing' | 'memory' | 'spring_aop' | 'contracts';
export type TechStackProfile = 'modern_cloud' | 'fintech_transactional' | 'enterprise_migration' | 'reactive_streaming' | 'custom';

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
  const [defectFocus] = useState<DefectFocus>('all');
  const [difficulty] = useState<'middle' | 'senior'>('middle');
  const [tutorRole, setTutorRole] = useState<TutorRole>('bug_hunt');
  const [techStackProfile] = useState<TechStackProfile>('modern_cloud');

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
  const challenge = currentIndex >= 0 && currentIndex < history.length ? history[currentIndex] : null;

  const currentVariantNumber = useMemo(() => {
    if (!challenge || currentIndex < 0) return 1;
    const sameSubtopicCount = history
      .slice(0, currentIndex + 1)
      .filter((c) => c.subtopic === challenge.subtopic).length;
    return Math.max(1, sameSubtopicCount);
  }, [challenge, currentIndex, history]);

  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  // Live Audio Hook (8-Property Seam)
  const {
    state: voiceState,
    metrics: voiceMetrics,
    statusMessage: voiceStatus,
    dialogueTurns,
    connect: startSession,
    disconnect: disconnectSession,
    toggleMic: toggleVoiceMic,
    handleInteraction
  } = useLiveVoiceSession({
    enableGlobalSelection: true,
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

  const isConnected = voiceState !== 'IDLE' && voiceState !== 'ERROR' && voiceState !== 'COMPLETED';
  const isAiSpeaking = voiceState === 'AI_SPEAKING';
  const isRecording = voiceState === 'LISTENING';
  const isUserSpeaking = voiceMetrics.vadActive;
  const isPauseHolding = voiceState === 'AI_THINKING' || voiceState === 'COMMITTING';
  const toggleMic = () => {
    setIsMuted((prev) => !prev);
    toggleVoiceMic();
  };
  const toggleMute = toggleMic;

  // Timer loop for loader and trivia
  useEffect(() => {
    if (!isLoadingChallenge && !isLoadingVariation) return;

    const secTimer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    const stepTimer = setInterval(() => setLoaderStepIndex((p) => (p + 1) % LOADER_STEPS.length), 3200);
    const triviaTimer = setInterval(() => setTriviaIndex((p) => (p + 1) % EDUCATIONAL_TRIVIA.length), 4500);

    return () => {
      clearInterval(secTimer);
      clearInterval(stepTimer);
      clearInterval(triviaTimer);
    };
  }, [isLoadingChallenge, isLoadingVariation]);

  const fetchChallenge = async (overridePreset?: WorkoutPreset) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoadingChallenge(true);
    setGenerationError(null);
    setIsSolved(false);

    const presetToUse = overridePreset || activePreset;

    try {
      const excludeIds = history.map((c) => c.id).filter(Boolean);
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          topicId,
          topic: topicName,
          workoutPreset: presetToUse,
          defectFocus: defectFocus !== 'all' ? defectFocus : undefined,
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
      setHistory((prev) => {
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

  useEffect(() => {
    void fetchChallenge();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [topicId]);

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

  const visitedChallengesRef = useRef<Set<string>>(new Set());

  const handleGenerateVariation = async () => {
    if (!challenge) return;
    if (isConnected) disconnectSession();
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

  const startBugVoiceSession = (targetChallenge?: BugChallenge | null) => {
    const ch = targetChallenge || challenge;
    if (!ch) return;

    const chId = ch.id;
    const isRevisit = visitedChallengesRef.current.has(chId);
    visitedChallengesRef.current.add(chId);

    const bridgeMessage = isRevisit
      ? `[ВОЗВРАТ К ПРЕДЫДУЩЕМУ КЕЙСУ «${ch.title}»]: Кандидат вернулся назад к этой задаче. Кратко (1 предложение в доброжелательной манере напарника) напомни, какую гипотезу мы обсуждали, и спроси, готов ли он продолжить.`
      : undefined;

    return startSession({
      sessionType: 'tutor',
      tutorMode: tutorRole,
      topic: topicName,
      bugTitle: ch.title || '',
      bugExplanation: ch.bugExplanation || '',
      codeSnippet: ch.codeSnippet || '',
      fixedCode: ch.fixedCode || '',
      unitTest: ch.testSuite || '',
      incidentContext: ch.productionContext ? {
        systemName: ch.productionContext.systemName,
        architectureType: ch.productionContext.architectureType,
        incidentSymptoms: ch.productionContext.incidentSymptoms,
        businessImpact: ch.productionContext.businessImpact,
        prReviewContext: ch.productionContext.prReviewContext
      } : undefined,
      hints: ch.hints || [],
      questionId: chId,
      sessionId: chId ? `session_bughunt_${chId}` : undefined,
      initialUserMessage: bridgeMessage
    });
  };

  const handleSendBugText = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    if (!isConnected) {
      void startBugVoiceSession();
    }
    setInputText('');
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] bg-pastel-bg text-pastel-text overflow-hidden font-sans">
      <BugHuntHeader
        academyBreadcrumbContext={academyBreadcrumbContext}
        returnToAcademyStep={returnToAcademyStep}
        closeTopicBugHunt={closeTopicBugHunt}
        topicName={topicName}
        difficultyBadge={challenge?.difficultyBadge}
        activePreset={activePreset}
        onSelectPreset={(p) => {
          setActivePreset(p);
          void fetchChallenge(p);
        }}
        sessionSolvedCount={sessionSolvedCount}
        onOpenRadar={() => setIsRadarOpen(true)}
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 max-w-7xl 2xl:max-w-[2000px] w-full mx-auto">
        {isLoadingChallenge ? (
          <div className="min-h-[420px] flex flex-col items-center justify-center p-6 bg-white/90 border border-pastel-border/80 rounded-3xl shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white shadow-md animate-pulse">
              <Bug className="w-6 h-6 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-pastel-text">{LOADER_STEPS[loaderStepIndex]}</h3>
              <p className="text-xs text-pastel-muted font-mono">Генерация аутентичного кейса ({elapsedSeconds}с)</p>
            </div>
            <div className="w-full max-w-md p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border text-left">
              <span className="text-[10px] font-bold text-pastel-accentRose uppercase tracking-wider block mb-1">
                💡 Инсайт по теме
              </span>
              <p className="text-xs text-pastel-text leading-snug">{EDUCATIONAL_TRIVIA[triviaIndex]}</p>
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

            <BugChallengeCard
              challenge={challenge}
              isSolved={isSolved}
              onRefresh={handleNextChallenge}
              isLoading={isLoadingChallenge}
              onGenerateVariation={handleGenerateVariation}
              isGeneratingVariation={isLoadingVariation}
              variantNumber={currentVariantNumber}
              onActionNotification={(_actionText) => {
                // Handled in voice session via continuous audio stream
              }}
            />

            <BugHuntVoiceMentor
              tutorRole={tutorRole}
              onSelectTutorRole={(r) => {
                setTutorRole(r);
                disconnectSession();
              }}
              isMuted={isMuted}
              toggleMute={toggleMute}
              isConnected={isConnected}
              isAiSpeaking={isAiSpeaking}
              isRecording={isRecording}
              isPauseHolding={isPauseHolding}
              isUserSpeaking={isUserSpeaking}
              dialogueTurns={dialogueTurns}
              inputText={inputText}
              setInputText={setInputText}
              handleSendBugText={handleSendBugText}
              toggleMic={toggleMic}
              startBugVoiceSession={startBugVoiceSession}
            />
          </div>
        ) : null}
      </div>
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        onSelectTopicForPractice={() => {
          setIsRadarOpen(false);
          void fetchChallenge();
        }}
      />
    </div>
  );
};
export default BugHuntArena;
