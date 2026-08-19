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
  ArrowLeft,
  RotateCcw,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
  Target,
  Trophy,
  BookOpen,
  Volume2,
  FileText,
  Play,
  Award,
  Layers,
  ChevronRight,
  ChevronLeft,
  MessageSquare
} from 'lucide-react';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { BugChallenge, BugChallengeCard } from './BugChallengeCard';
import { triggerSuccessConfetti } from '../utils/confetti';

export type WorkoutPreset = 'exhaustive' | 'senior_multi' | 'random';
export type DefectFocus = 'all' | 'concurrency' | 'memory' | 'spring_aop' | 'contracts';
export type TutorRole = 'bug_hunt' | 'free_chat';

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

  // Session Linear History Stack & State
  const [history, setHistory] = useState<BugChallenge[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isLoadingVariation, setIsLoadingVariation] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [sessionSolvedCount, setSessionSolvedCount] = useState(0);
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const [isExhausted, setIsExhausted] = useState(false);

  // Active Challenge is derived from history[currentIndex]
  const challenge = currentIndex >= 0 && currentIndex < history.length ? history[currentIndex] : null;

  // Compute variant number for current challenge (e.g. 1st, 2nd variation of this subtopic)
  const currentVariantNumber = useMemo(() => {
    if (!challenge || currentIndex < 0) return 1;
    const sameSubtopicCount = history
      .slice(0, currentIndex + 1)
      .filter(c => c.subtopic === challenge.subtopic).length;
    return Math.max(1, sameSubtopicCount);
  }, [challenge, currentIndex, history]);

  // Audio / WebSocket State
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Нажми микрофон, чтобы обсудить задачу с AI');
  const [aiTranscript, setAiTranscript] = useState<string>('');

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Fetch saved bank on modal open
  useEffect(() => {
    if (isOpen) {
      setStage('lobby');
      setIsExhausted(false);
      setSessionSolvedCount(0);
      setSeenQuestionIds([]);
      setHistory([]);
      setCurrentIndex(-1);
      fetchSavedBank();
    } else {
      cleanupAudioSession();
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

  // Fetch or generate a brand new topic challenge
  const fetchNewChallenge = async (currentSeen: string[] = seenQuestionIds) => {
    setIsLoadingChallenge(true);
    setIsSolved(false);
    setAiTranscript('');

    // If source is saved bank
    if (sourceMode === 'bank') {
      if (filteredBank.length === 0) {
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
        body: JSON.stringify({
          topicId,
          topic: topicName,
          workoutPreset: activePreset,
          defectFocus,
          difficulty: activePreset === 'senior_multi' ? 'senior' : difficulty,
          excludeIds: activePreset === 'exhaustive' ? currentSeen : []
        })
      });

      if (!res.ok) throw new Error('Ошибка генерации задачи');
      const data: BugChallenge = await res.json();

      if (data.isTopicExhausted) {
        setIsExhausted(true);
        triggerSuccessConfetti();
      } else {
        setHistory(prev => [...prev, data]);
        setCurrentIndex(prev => prev + 1);
        if (data.sampledQuestionId && !currentSeen.includes(data.sampledQuestionId)) {
          setSeenQuestionIds(prev => [...prev, data.sampledQuestionId!]);
        }
      }
    } catch (error) {
      console.error('Error fetching challenge:', error);
      setStatusMessage('Ошибка загрузки задачи. Попробуйте еще раз.');
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  // Generate another variation of the SAME subtopic
  const handleGenerateVariation = async () => {
    if (!challenge) return;
    cleanupAudioSession();
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
          difficulty: activePreset === 'senior_multi' ? 'senior' : difficulty
        })
      });

      if (!res.ok) throw new Error('Ошибка генерации варианта задачи');
      const data: BugChallenge = await res.json();

      // Insert right after current challenge in linear history
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
      cleanupAudioSession();
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setIsSolved(Boolean(history[prevIdx]?.isSolved));
      setAiTranscript('');
    }
  };

  const handleNextChallenge = () => {
    cleanupAudioSession();
    setAiTranscript('');
    if (currentIndex < history.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setIsSolved(Boolean(history[nextIdx]?.isSolved));
    } else {
      void fetchNewChallenge();
    }
  };

  // Start workout from Lobby
  const handleStartWorkout = () => {
    setStage('workout');
    setHistory([]);
    setCurrentIndex(-1);
    fetchNewChallenge([]);
  };

  // Start Audio / WebSocket Session
  const startAudioSession = async () => {
    try {
      cleanupAudioSession();

      playoutManagerRef.current = new AudioPlayoutManager();
      void playoutManagerRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      inputAudioCtxRef.current = inputCtx;

      const host = window.location.host;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${host}/ws/live`;

      setStatusMessage('Подключение к AI...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatusMessage(
          tutorRole === 'bug_hunt'
            ? 'Слушаю вас... Объясните, где ошибка в коде.'
            : 'Слушаю вас... Задайте любой вопрос по этому коду.'
        );

        const setupMessage = {
          setup: {
            model: 'gemini-tts-live-v3',
            voiceName: 'Aoede',
            topic: topicName,
            sessionType: 'tutor',
            tutorMode: tutorRole,
            bugTitle: challenge?.title,
            bugExplanation: challenge?.bugExplanation,
            codeSnippet: challenge?.codeSnippet,
            hints: challenge?.hints,
            questionId: challenge?.id
          },
        };
        ws.send(JSON.stringify(setupMessage));

        // Start Recording Mic
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(2048, 1, 1);
        audioProcessorRef.current = processor;

        processor.onaudioprocess = (e: any) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          const base64Data = btoa(
            String.fromCharCode.apply(null, Array.from(new Uint8Array(pcm16.buffer)))
          );

          ws.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data,
                  },
                ],
              },
            })
          );
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
        setIsRecording(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'bug_solved') {
            setIsSolved(true);
            setSessionSolvedCount(prev => prev + 1);
            setStatusMessage(`🎉 ${msg.payload.feedback || 'Отлично! Баг найден!'}`);
            triggerSuccessConfetti();
          }

          if (msg.audio) {
            setIsAiSpeaking(true);
            playoutManagerRef.current?.enqueuePcmChunk(msg.audio);
          }

          if (msg.transcript) {
            setAiTranscript(prev => prev ? `${prev} ${msg.transcript}` : msg.transcript);
          }

          if (msg.type === 'ai_playback_finished') {
            setIsAiSpeaking(false);
          }
        } catch (e) {
          console.error('Error processing WS message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsRecording(false);
        setIsAiSpeaking(false);
        setStatusMessage('Сессия завершена');
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStatusMessage('Ошибка подключения к шлюзу');
      };

    } catch (err: any) {
      console.error('Audio Session Start Error:', err);
      setStatusMessage('Не удалось получить доступ к микрофону');
    }
  };

  const cleanupAudioSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (playoutManagerRef.current) {
      void playoutManagerRef.current.teardown();
      playoutManagerRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsAiSpeaking(false);
  };

  // Keyboard Shortcuts Listener in Workout Mode
  useEffect(() => {
    if (!isOpen || stage !== 'workout') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isConnected) {
          cleanupAudioSession();
        } else {
          startAudioSession();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-pastel-bg dark:bg-slate-900 border border-pastel-border w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
      >
        {/* Modal Top Bar */}
        <div className="px-5 py-4 bg-white/70 dark:bg-slate-800/70 border-b border-pastel-border flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-rose via-pastel-lavender to-pastel-accentRose/40 flex items-center justify-center shadow-sm">
              <Bug className="w-5 h-5 text-pastel-darkPurple" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                  Bug Hunt Arena
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pastel-lavender text-pastel-darkPurple border border-pastel-border">
                  2026 SOTA
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                Тема: <span className="font-semibold text-slate-700 dark:text-slate-200">{topicName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stage === 'workout' && (
              <button
                onClick={() => { cleanupAudioSession(); setStage('lobby'); }}
                className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl border border-pastel-border bg-white/50 dark:bg-slate-800/50 hover:bg-pastel-lavender/30 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Настройки лобби</span>
              </button>
            )}

            <button
              onClick={() => { cleanupAudioSession(); onClose(); }}
              className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
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
            <div className="max-w-2xl mx-auto space-y-6 py-2">
              {/* Source Mode Toggle: Fresh AI vs Saved Bank */}
              <div className="flex p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 border border-pastel-border/60">
                <button
                  onClick={() => setSourceMode('ai_fresh')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    sourceMode === 'ai_fresh'
                      ? 'bg-white dark:bg-slate-900 text-pastel-darkPurple dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-pastel-accentRose" />
                  <span>✨ Свежая AI-генерация</span>
                </button>

                <button
                  onClick={() => setSourceMode('bank')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    sourceMode === 'bank'
                      ? 'bg-white dark:bg-slate-900 text-pastel-darkPurple dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  <span>📚 Мой банк задач ({savedChallenges.length})</span>
                </button>
              </div>

              {/* View 1: Fresh AI Generator Configuration */}
              {sourceMode === 'ai_fresh' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Preset Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-pastel-accentRose" />
                      <span>Выберите режим тренировки:</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {PRESETS.map((p) => {
                        const Icon = p.icon;
                        const isSelected = activePreset === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setActivePreset(p.id)}
                            className={`p-4 rounded-2xl text-left border transition-all relative ${
                              isSelected
                                ? 'bg-gradient-to-b from-pastel-lavender/50 to-pastel-card border-pastel-accentRose/60 shadow-md ring-1 ring-pastel-accentRose/40'
                                : 'bg-white/60 dark:bg-slate-800/40 border-pastel-border hover:bg-pastel-lavender/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {p.name}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 border border-pastel-border font-bold">
                                {p.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                              {p.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Defect Focus Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                      <span>Категория дефектов (Фокус):</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DEFECT_FOCUSES.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setDefectFocus(f.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            defectFocus === f.id
                              ? 'bg-pastel-darkPurple text-white border-pastel-darkPurple shadow-xs'
                              : 'bg-white/70 dark:bg-slate-800/70 border-pastel-border text-slate-700 dark:text-slate-300 hover:bg-pastel-lavender/30'
                          }`}
                        >
                          <span className="mr-1.5">{f.iconStr}</span>
                          <span>{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* View 2: Saved Problem Bank (Replay) */}
              {sourceMode === 'bank' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        Персональный банк: {savedChallenges.length} кейсов
                      </h3>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Мгновенный запуск за 0 мс без ожидания генерации и без расхода токенов.
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {(['all', 'unsolved', 'solved'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setBankFilter(f)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            bankFilter === f
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white/80 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100'
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
                    <div className="p-8 text-center rounded-2xl border border-dashed border-pastel-border text-slate-500 dark:text-slate-400">
                      <p className="text-sm">В этой выборке пока нет сохраненных задач.</p>
                      <p className="text-xs mt-1">Переключитесь на «Свежую генерацию», чтобы создать новые кейсы.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {filteredBank.slice(0, 10).map((b, i) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-pastel-border flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-pastel-lavender text-pastel-darkPurple flex items-center justify-center font-bold text-[10px]">
                              {i + 1}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {b.title}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({b.categoryBadge || '⚡ Concurrency'})
                            </span>
                          </div>

                          {b.lastScore !== undefined && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
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
              <div className="pt-3">
                <button
                  onClick={handleStartWorkout}
                  disabled={sourceMode === 'bank' && filteredBank.length === 0}
                  className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-pastel-darkPurple via-purple-900 to-pastel-accentRose text-white shadow-lg shadow-purple-950/20 hover:shadow-purple-950/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    {sourceMode === 'bank'
                      ? `🚀 Начать повторение банка (${filteredBank.length} задач)`
                      : '🚀 Начать тренировку поиска багов'}
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
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-lg border border-amber-300">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    Тема полностью закрыта на 100%!
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                    Вы проработали все подразделы темы <span className="font-semibold">{topicName}</span> без единого повтора.
                  </p>
                  <button
                    onClick={() => { setSeenQuestionIds([]); setIsExhausted(false); fetchNewChallenge([]); }}
                    className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-pastel-accentRose text-white shadow-md hover:bg-pastel-accentRose/90 transition-all flex items-center justify-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Пройти тему заново</span>
                  </button>
                </div>
              ) : isLoadingChallenge ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-8 h-8 text-pastel-accentRose animate-spin" />
                  <p className="text-xs font-mono">Генерация продакшен-кейса с ошибкой через LiteLLM...</p>
                </div>
              ) : challenge ? (
                <div className="space-y-6">
                  {/* Session Navigation Bar (Back, Counter, Next) */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/70 dark:bg-slate-800/70 rounded-2xl border border-pastel-border shadow-2xs backdrop-blur-md">
                    <button
                      onClick={handlePreviousChallenge}
                      disabled={currentIndex <= 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-pastel-lavender/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Предыдущий</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-pastel-darkPurple dark:text-pastel-lavender bg-pastel-lavender/50 dark:bg-slate-900 px-3 py-1 rounded-xl border border-pastel-border">
                        Задача {currentIndex + 1} из {history.length}
                      </span>
                    </div>

                    <button
                      onClick={handleNextChallenge}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-pastel-lavender/40 transition-all"
                    >
                      <span>{currentIndex < history.length - 1 ? 'Следующий' : 'Новая подтема'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Challenge Code & Details */}
                  <BugChallengeCard
                    challenge={challenge}
                    isSolved={isSolved}
                    onRefresh={handleNextChallenge}
                    isLoading={isLoadingChallenge}
                    onGenerateVariation={handleGenerateVariation}
                    isGeneratingVariation={isLoadingVariation}
                    variantNumber={currentVariantNumber}
                  />

                  {/* AI Live Tutor Voice Station */}
                  <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-pastel-lavender/40 via-pastel-card to-pastel-rose/30 border border-pastel-border shadow-sm space-y-4 backdrop-blur-md">
                    {/* Voice Bar Header with Tutor Role Switcher */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pastel-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-pastel-accentRose" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          AI-Тьютор в реальном времени:
                        </span>
                      </div>

                      {/* AI Role Switcher (Code Review vs Freeform Chat) */}
                      <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-800 p-1 rounded-xl border border-pastel-border shadow-2xs self-start sm:self-auto">
                        <button
                          onClick={() => { setTutorRole('bug_hunt'); cleanupAudioSession(); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            tutorRole === 'bug_hunt'
                              ? 'bg-pastel-accentRose text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          <Bug className="w-3.5 h-3.5" />
                          <span>🐛 Код-ревью (Валидация)</span>
                        </button>

                        <button
                          onClick={() => { setTutorRole('free_chat'); cleanupAudioSession(); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            tutorRole === 'free_chat'
                              ? 'bg-pastel-accentRose text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>💬 Свободный диалог</span>
                        </button>
                      </div>
                    </div>

                    {/* Microphone & Status Line with Dynamic Pastel Audio Aura */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={isConnected ? cleanupAudioSession : startAudioSession}
                          className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
                            isConnected
                              ? 'bg-rose-500 text-white ring-4 ring-rose-500/20 animate-pulse'
                              : 'bg-pastel-accentRose text-white hover:bg-pastel-accentRose/90 hover:scale-105'
                          }`}
                          title={isConnected ? 'Остановить разговор' : 'Включить микрофон и обсудить голосом'}
                        >
                          {/* Pastel Breathing Aura during active speech */}
                          {isConnected && (
                            <span className="absolute inset-0 rounded-2xl bg-pastel-accentRose/40 animate-ping opacity-75 pointer-events-none" />
                          )}
                          {isConnected ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                              {isConnected
                                ? (isAiSpeaking ? 'AI говорит...' : 'Слушаю вас...')
                                : (tutorRole === 'bug_hunt' ? 'Обсудить с техлидом' : 'Свободный вопрос по коду')}
                            </span>
                            {isConnected && (
                              <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans">
                            {statusMessage}
                          </p>
                        </div>
                      </div>

                      {/* Next Challenge Action */}
                      <button
                        onClick={handleNextChallenge}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 border border-pastel-border hover:bg-pastel-lavender/40 transition-all flex items-center justify-center gap-1.5 text-slate-800 dark:text-slate-100 shadow-xs"
                      >
                        <span>{currentIndex < history.length - 1 ? 'Вперед по истории' : 'Следующая подтема'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Live Transcript Bubble */}
                    {aiTranscript && (
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-pastel-border/80 text-xs text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                        <span className="font-semibold text-pastel-darkPurple dark:text-pastel-lavender mr-1">
                          AI:
                        </span>
                        {aiTranscript}
                      </div>
                    )}
                  </div>

                  {/* Hotkeys helper bar */}
                  <div className="text-center text-[11px] font-mono text-slate-400 dark:text-slate-500 select-none">
                    [← / →] Навигация по задачам • [Пробел] Микрофон
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
export default TopicBugHuntModal;
