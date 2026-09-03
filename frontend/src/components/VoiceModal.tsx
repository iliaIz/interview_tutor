import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Brain,
  ShieldCheck,
  Zap,
  Activity,
  Play,
  Pause,
  Loader2,
  Settings2,
  GraduationCap,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Microscope,
  ArrowRight,
  Award,
  Layers,
  FastForward,
  Check,
  BookOpen,
  Send,
  VolumeX,
  Keyboard,
  Clock,
  Code2,
  WifiOff
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { CandidatePersonaHUD } from './CandidatePersonaHUD';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';
import { CodeViewer } from './CodeViewer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { WhiteboardDrawer } from './WhiteboardDrawer';
import {
  AcousticMetrics,
  AcousticTelemetryService,
  SpeechClarityMetrics,
  QuestionCategoryType,
  QuestionStructureFormat
} from '../services/AcousticTelemetryService';
import { triggerSuccessConfetti } from '../utils/confetti';
import { InterviewConfig, GeminiVoiceName } from '../types/interviewConfig';
import { VoiceSettingsDrawer } from './VoiceSettingsDrawer';
import { getActiveConfig, saveActiveConfig } from '../services/profileStorage';
import { Question, useAppStore } from '../store/useAppStore';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  InterviewPersonaId,
  TargetGrade,
  FaangScorecardData,
  FAANG_PERSONAS,
  TARGET_GRADES
} from '../types/personas';
import { PersonaSelector } from './PersonaSelector';
import { HiringCommitteeCard } from './HiringCommitteeCard';
import { VoiceLobbyView } from './voice/VoiceLobbyView';
import { VoiceVerdictView } from './voice/VoiceVerdictView';
import { VoiceGrandFinaleView } from './voice/VoiceGrandFinaleView';
import { VoiceTutorView } from './voice/VoiceTutorView';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Single question mode (backward compatibility)
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  // Batch series mode (hands-free sequence)
  questionsBatch?: Question[];
  initialQuestionIndex?: number;
  initialSessionType?: 'interview' | 'tutor';
  initialTutorMode?: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  customPromptOverride?: string;
  onIndexChange?: (newIndex: number) => void;
  onBatchComplete?: (results: Record<string, EvaluationResult>) => void;
  onEvaluationComplete?: (result: EvaluationResult) => void;
}

export interface EvaluationResult {
  id?: string;
  questionId?: string;
  score?: number;
  isPassed?: boolean;
  positivePoints?: string[];
  missingPoints?: string[];
  feedback?: string;
  spokenFeedback?: string;
  audioMetrics?: AcousticMetrics;
  clarityMetrics?: SpeechClarityMetrics;
  questionType?: 'definitional' | 'tradeoff' | 'behavioral';
  speechCoaching?: {
    structureType?: 'STAR' | 'PREP' | 'RULE_OF_3' | 'UNSTRUCTURED';
    rephrasedExample?: string;
  };
  faangScorecard?: FaangScorecardData;
  userAnswer?: string;
  transcript?: string;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  questionId,
  topic = 'Java Core & Spring',
  currentQuestionText = 'Расскажите о вашем опыте в backend-разработке.',
  referenceAnswer = '',
  questionsBatch,
  initialQuestionIndex = 0,
  initialSessionType = 'interview',
  initialTutorMode = 'deep_dive',
  customPromptOverride,
  onIndexChange,
  onBatchComplete,
  onEvaluationComplete,
}) => {
  const isBatchMode = Boolean(questionsBatch && questionsBatch.length > 0);
  const totalQuestions = isBatchMode && questionsBatch ? questionsBatch.length : 1;

  // Lock background body scroll on mobile & desktop when modal is active
  useBodyScrollLock(isOpen);

  // Store hooks for Session Checkpointing and AI Whiteboard
  const {
    activeBatchSession,
    saveBatchSessionCheckpoint,
    clearBatchSession,
    activeWhiteboardState,
    setWhiteboardState,
    isWhiteboardOpen,
    setIsWhiteboardOpen
  } = useAppStore();

  // Session Type State ('interview' | 'tutor')
  const [sessionType, setSessionType] = useState<'interview' | 'tutor'>(initialSessionType);
  const [tutorMode, setTutorMode] = useState<'deep_dive' | 'socratic' | 'eli5' | 'free_chat'>(initialTutorMode);

  // Active Batch Index state & Stale-Closure Resistant Refs
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(initialQuestionIndex);
  const [batchResults, setBatchResults] = useState<Record<string, EvaluationResult>>({});
  const batchResultsRef = useRef<Record<string, EvaluationResult>>({});
  const sessionIdRef = useRef<string>('');

  // Resolve current active question
  const currentQ: Question | null = isBatchMode && questionsBatch ? questionsBatch[activeBatchIndex] || questionsBatch[0] : null;
  const activeQuestionId = currentQ?.id || questionId || '';
  const activeTopic = currentQ?.topic || topic || 'Java Core & Spring';
  const activeQuestionText = currentQ?.question || currentQuestionText || 'Расскажите о вашем опыте в backend-разработке.';
  const activeReferenceAnswer = currentQ?.answer || referenceAnswer || '';
  const activeQuestionNum = currentQ?.num ?? (activeBatchIndex + 1);

  // Modal Lifecycle Stages: 'lobby' -> 'active' -> 'transition' -> 'verdict' | 'grand_finale'
  const [stage, setStage] = useState<'lobby' | 'active' | 'transition' | 'verdict' | 'grand_finale'>('lobby');

  const [countdown, setCountdown] = useState<number>(5);
  const [isTransitionPaused, setIsTransitionPaused] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [interviewConfig, setInterviewConfig] = useState<InterviewConfig>(getActiveConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);

  // Pause ambient audio (e.g. AudioPlayerBar) upon opening VoiceModal to prevent crosstalk
  useEffect(() => {
    if (isOpen) {
      document.querySelectorAll('audio').forEach((el) => {
        try { el.pause(); } catch {}
      });
    }
  }, [isOpen]);

  // Live WebSocket & Audio Nodes
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const gainAnchorRef = useRef<GainNode | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);

  // Real-time Session State
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState<'idle' | 'processing' | 'delayed' | 'critical'>('idle');
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [isPauseHolding, setIsPauseHolding] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isConnectionLost, setIsConnectionLost] = useState(false);
  const [rmsDb, setRmsDb] = useState<number>(-60);
  const [dialogueTurns, setDialogueTurns] = useState<
    Array<{ role: 'ai' | 'user' | 'system'; text: string }>
  >([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [systemHealth, setSystemHealth] = useState<{ isAiReady: boolean }>({ isAiReady: true });
  const [deepgramTranscript, setDeepgramTranscript] = useState<string>('');
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Accordion expansion in Grand Finale
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<string>>(new Set());

  // Speech & Behavioral AI Coaching State (STAR / PREP / Pacing)
  const [speechCoachingMode, setSpeechCoachingMode] = useState<'adaptive' | 'always' | 'off'>(() => {
    return (localStorage.getItem('interview_speech_coaching_mode') as any) || 'adaptive';
  });
  const [liveClarityMetrics, setLiveClarityMetrics] = useState<SpeechClarityMetrics | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const speechRecognitionRef = useRef<any>(null);
  const turnStartTimeRef = useRef<number>(Date.now());

  const questionStructure: QuestionStructureFormat = useMemo(() => {
    return AcousticTelemetryService.classifyQuestionStructure(activeQuestionText, activeTopic);
  }, [activeQuestionText, activeTopic]);

  const updateSpeechCoachingMode = (mode: 'adaptive' | 'always' | 'off') => {
    setSpeechCoachingMode(mode);
    try {
      localStorage.setItem('interview_speech_coaching_mode', mode);
    } catch {}
  };

  // Multimodal Text Input & Earphone/Silent Mute Mode
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    playoutManagerRef.current?.setMuted(nextMuted);
  };

  const handleSendCustomText = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;
    sendTextMessage(text, text);
    setInputText('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCustomText();
    }
  };

  // Refs for synchronous audio worklet synchronization & Watchdogs
  const isRecordingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isServerTurnCompleteRef = useRef(false);
  const hasSpokenInTurnRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAiSpeechEndedAtRef = useRef<number>(0);
  const userPcmChunksRef = useRef<Float32Array[]>([]);
  const transcriptRef = useRef<string>('');
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const turnWatchdogRef = useRef<NodeJS.Timeout[]>([]);
  const wakeLockRef = useRef<any>(null);
  const isEvaluationFinalizedRef = useRef(false);
  const dialogueTurnsRef = useRef<Array<{ role: 'ai' | 'user' | 'system'; text: string }>>([]);
  const turnCountRef = useRef(0);
  const resumeAttemptsRef = useRef(0);

  const handleConfigChange = (newConfig: InterviewConfig) => {
    setInterviewConfig(newConfig);
    saveActiveConfig(newConfig);
  };

  // Screen Wake Lock API for Mobile (Android/iOS)
  const acquireWakeLock = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('📱 Screen WakeLock acquired (preventing Android sleep)');
      }
    } catch (e) {
      console.warn('WakeLock acquisition skipped:', e);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('📱 Screen WakeLock released');
      }
    } catch (e) {}
  };

  // VisibilityChange listener (auto-resume AudioContext on returning from background/notification)
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        if (playoutManagerRef.current) {
          await playoutManagerRef.current.resume();
        }
        if (stage === 'active' && !wakeLockRef.current) {
          void acquireWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', releaseWakeLock);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', releaseWakeLock);
      void releaseWakeLock();
    };
  }, [isOpen, stage]);

  // Live Speech Recognition for Real-time Acoustic & Clarity HUD
  useEffect(() => {
    if (!isRecording || speechCoachingMode === 'off') {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
        speechRecognitionRef.current = null;
      }
      return;
    }

    turnStartTimeRef.current = Date.now();
    setLiveTranscript('');
    setLiveClarityMetrics(null);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      const targetLang = interviewConfig.language === 'en' ? 'en-US' : 'ru-RU';
      recognition.lang = targetLang;

      recognition.onresult = (event: any) => {
        let fullInterim = '';
        for (let i = 0; i < event.results.length; i++) {
          fullInterim += event.results[i][0].transcript + ' ';
        }
        const trimmed = fullInterim.trim();
        setLiveTranscript(trimmed);

        const elapsedSec = Math.max(1, (Date.now() - turnStartTimeRef.current) / 1000);
        const words = trimmed.split(/\s+/).filter(Boolean).length;
        const liveWpm = Math.round((words / elapsedSec) * 60);

        const metrics = AcousticTelemetryService.analyzeSpeechClarity(trimmed, liveWpm);
        setLiveClarityMetrics(metrics);
      };

      recognition.onerror = () => {};
      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition not available or failed to start:', e);
    }

    return () => {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
        speechRecognitionRef.current = null;
      }
    };
  }, [isRecording, speechCoachingMode]);

  // Turn Watchdog Management
  const clearAllTurnWatchdogs = () => {
    turnWatchdogRef.current.forEach((t) => clearTimeout(t));
    turnWatchdogRef.current = [];
    setThinkingStage('idle');
  };

  const startTurnWatchdog = () => {
    clearAllTurnWatchdogs();
    setThinkingStage('processing');
    playoutManagerRef.current?.playThinkingAuraTone();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }

    // Tier 1: 3.5s - status update to 'delayed'
    const t1 = setTimeout(() => {
      if (isThinkingRef.current) {
        setThinkingStage('delayed');
      }
    }, 3500);

    // Tier 2: 6.5s - status update to 'critical' (shows recovery bar)
    const t2 = setTimeout(() => {
      if (isThinkingRef.current) {
        setThinkingStage('critical');
      }
    }, 6500);

    // Tier 3: 10.0s - auto-fallback to REST /api/eval
    const t3 = setTimeout(() => {
      if (isThinkingRef.current && !isEvaluationFinalizedRef.current) {
        console.warn('⏱️ 10s Turn Watchdog expired. Triggering automated REST evaluation fallback...');
        void executeInstantRestEvalFallback();
      }
    }, 10000);

    turnWatchdogRef.current = [t1, t2, t3];
  };

  const executeInstantRestEvalFallback = async () => {
    clearAllTurnWatchdogs();
    setIsThinking(false);
    isThinkingRef.current = false;
    setIsSubmitting(true);
    setDialogueTurns((prev) => [
      ...prev,
      { role: 'system', text: '⚡ Сеть голосового шлюза перегружена. Запущена мгновенная REST-оценка...' }
    ]);

    try {
      const targetQ = questionsBatch?.[activeBatchIndex] || {
        id: activeQuestionId,
        topic: activeTopic,
        question: activeQuestionText,
        answer: activeReferenceAnswer
      };

      const res = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: targetQ.id || activeQuestionId,
          topic: targetQ.topic,
          question: targetQ.question,
          referenceAnswer: targetQ.answer,
          userAnswer: transcriptRef.current || 'Устный ответ кандидата в голосовом режиме'
        })
      });
      if (res.ok) {
        const fallbackData = await res.json();
        finalizeEvaluation(fallbackData, targetQ.id || activeQuestionId, activeBatchIndex);
      } else {
        setIsSubmitting(false);
      }
    } catch (e) {
      console.error('Fallback eval error:', e);
      setIsSubmitting(false);
    }
  };

  // Synchronize initialQuestionIndex & Checkpoint when opened
  useEffect(() => {
    if (!isOpen) {
      teardownFullAudio();
      setStage('lobby');
      return;
    }

    setSessionType(initialSessionType || 'interview');
    setTutorMode(initialTutorMode || 'deep_dive');

    // Check for existing valid session checkpoint for this topic
    if (
      isBatchMode &&
      activeBatchSession &&
      !activeBatchSession.isComplete &&
      (activeBatchSession.topicName === activeTopic || !activeBatchSession.topicName) &&
      Object.keys(activeBatchSession.results || {}).length > 0
    ) {
      sessionIdRef.current = activeBatchSession.sessionId;
      batchResultsRef.current = { ...activeBatchSession.results };
      setBatchResults(activeBatchSession.results);
      setActiveBatchIndex(Math.min(activeBatchSession.currentIndex, totalQuestions - 1));
    } else {
      sessionIdRef.current = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      batchResultsRef.current = {};
      setBatchResults({});
      setActiveBatchIndex(initialQuestionIndex);
    }

    setStage('lobby');
    setEvaluation(null);
    setDialogueTurns([]);
    dialogueTurnsRef.current = [];
    setDeepgramTranscript('');
    setIsTranscriptOpen(false);
    setIsTranscribing(false);
    userPcmChunksRef.current = [];
    transcriptRef.current = '';
    isEvaluationFinalizedRef.current = false;
    setIsSubmitting(false);

    return () => {
      teardownFullAudio();
    };
  }, [isOpen]);

  // SOTA 2026: Fast-Launch in 1 click when preflight confirmation is disabled
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasAutoLaunchedRef.current = false;
      return;
    }
    const currentConfig = getActiveConfig();
    if (stage === 'lobby' && !currentConfig.alwaysShowPreflight && !hasAutoLaunchedRef.current) {
      hasAutoLaunchedRef.current = true;
      void startLiveInterviewWithIndex(activeBatchIndex);
    }
  }, [isOpen, stage, activeBatchIndex]);

  // Keep dialogueTurnsRef in sync with state
  useEffect(() => {
    dialogueTurnsRef.current = dialogueTurns;
  }, [dialogueTurns]);

  // Handle Transition Countdown Timer (respects autoAdvance and transitionDelay config)
  useEffect(() => {
    if (stage !== 'transition') {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const isAutoAdvanceActive = interviewConfig.autoAdvance === true && (interviewConfig.transitionDelay ?? 5) > 0;

    if (!isAutoAdvanceActive || isTransitionPaused) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          advanceToNextQuestion(activeBatchIndex + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [stage, isTransitionPaused, activeBatchIndex, interviewConfig.autoAdvance, interviewConfig.transitionDelay]);

  /**
   * Teardown only the WebSocket and playout buffers (ephemeral clean slate).
   * Keeps AudioContext and mic hardware alive for smooth hands-free transition.
   */
  const teardownWsAndBuffersOnly = () => {
    isEvaluationFinalizedRef.current = false;
    clearAllTurnWatchdogs();
    setIsPauseHolding(false);
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    hasSpokenInTurnRef.current = false;
    isServerTurnCompleteRef.current = false;
    setIsConnected(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsThinking(false);
    isThinkingRef.current = false;
    setThinkingStage('idle');
    setIsUserSpeaking(false);
    setIsRecording(false);
    isRecordingRef.current = false;
    if (playoutManagerRef.current) {
      playoutManagerRef.current.clearQueue();
    }
  };

  /**
   * Full teardown on modal close
   */
  const teardownFullAudio = () => {
    teardownWsAndBuffersOnly();
    void releaseWakeLock();
    stopMicrophone();
    if (playoutManagerRef.current) {
      playoutManagerRef.current.teardown();
      playoutManagerRef.current = null;
    }
  };

  /**
   * Connects to Live WebSocket Proxy with question-specific parameters
   */
  const connectLiveWebSocket = async (
    qIndex: number,
    targetQ: { id: string; topic: string; question: string; answer: string },
    isRetry?: boolean,
    isResumed?: boolean
  ) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    let hostWithPort = window.location.host;
    if (window.location.port === '8090') {
      hostWithPort = `${window.location.hostname}:8091`;
    }

    const params = new URLSearchParams({
      sessionId: sessionIdRef.current,
      questionId: targetQ.id,
      topic: targetQ.topic,
      questionText: targetQ.question,
      referenceAnswer: targetQ.answer,
      sessionType,
      tutorMode: sessionType === 'tutor' ? tutorMode : '',
      voice: interviewConfig.voice,
      userGender: interviewConfig.userGender || (localStorage.getItem('interview_user_gender') as any) || 'female',
      turnMode: interviewConfig.turnMode || (localStorage.getItem('interview_turn_mode') as any) || 'manual',
      strategy: sessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
      persona: interviewConfig.persona || 'mentor',
      targetGrade: interviewConfig.targetGrade || 'L5_SENIOR',
      maxProbes: String(interviewConfig.maxProbes),
      deepDive: String(!!interviewConfig.deepDive || (sessionType === 'tutor' && tutorMode === 'deep_dive')),
      liveCoaching: String(!!interviewConfig.liveCoaching || sessionType === 'tutor'),
      customAnchors: JSON.stringify(interviewConfig.customAnchors || []),
      customPrompt: customPromptOverride || interviewConfig.customPromptOverride || '',
      liveModel: interviewConfig.liveModel || 'gemini-live-v2',
      questionIndex: String(qIndex),
      totalQuestions: String(totalQuestions),
      isRetry: String(!!isRetry),
      isResumed: String(!!isResumed),
      probesCount: String(turnCountRef.current)
    });

    // SOTA 2026: Prefetch One-Time WS Ticket for Zero-Trust Gemini Live Handshake
    try {
      const ticketRes = await fetch('/api/auth/ws-ticket', {
        method: 'POST',
        credentials: 'include'
      });
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        if (ticketData.ticket) {
          params.set('ticket', ticketData.ticket);
        }
      }
    } catch (e) {
      console.warn('Could not prefetch WS ticket, relying on cookie auth fallback:', e);
    }

    const wsUrl = `${protocol}//${hostWithPort}/ws/live?${params.toString()}`;
    console.log(`Connecting to Live WebSocket (Q ${qIndex + 1}/${totalQuestions}, isRetry=${!!isRetry}, isResumed=${!!isResumed}, type=${sessionType}):`, wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;


    // Attach playback finished callback to playout manager for instant mic transition
    if (playoutManagerRef.current) {
      playoutManagerRef.current.onPlaybackFinished = () => {
        if (isServerTurnCompleteRef.current && !isEvaluationFinalizedRef.current) {
          console.log('🔊 Audio playback finished in speakers. Instantly activating candidate microphone...');
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
          setIsThinking(false);
          isThinkingRef.current = false;
          clearAllTurnWatchdogs();
          lastAiSpeechEndedAtRef.current = Date.now();
          setIsRecording(true);
          isRecordingRef.current = true;
          hasSpokenInTurnRef.current = false;
          setDialogueTurns((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.text.includes('Ваша очередь')) return prev;
            return [
              ...prev,
              { role: 'system', text: '🎙️ Ваша очередь: говорите в микрофон своими словами.' }
            ];
          });
        }
      };
    }

    ws.onopen = () => {
      setIsConnected(true);
      console.log('✅ Live WebSocket connected to backend proxy');

      // First-Frame Resumption Sync: pass structured turns as JSON frame (zero risk of HTTP 414 URI Too Long)
      if (isResumed) {
        const turnsToSync = dialogueTurnsRef.current
          .filter((t) => t.role === 'user' || t.role === 'ai')
          .map((t) => ({ role: t.role, text: t.text }));
        if (turnsToSync.length > 0) {
          console.log(`📤 Sending first-frame resume_sync to backend (${turnsToSync.length} turns)...`);
          ws.send(JSON.stringify({
            type: 'resume_sync',
            sessionId: sessionIdRef.current,
            turns: turnsToSync
          }));
        }
      }
    };

    ws.onmessage = async (event) => {
      try {
        let textPayload = '';
        if (typeof event.data === 'string') {
          textPayload = event.data;
        } else if (event.data instanceof Blob) {
          textPayload = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          textPayload = new TextDecoder().decode(event.data);
        }

        if (!textPayload) return;
        const data = JSON.parse(textPayload);

        // Keepalive Heartbeat response
        if (data.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
          }
          return;
        }

        // Live RTT Telemetry update from backend
        if (data.type === 'pong_ack') {
          if (typeof data.rtt === 'number') {
            setRttMs(data.rtt);
          }
          return;
        }

        // Upstream response delayed nudge (>5.5s)
        if (data.type === 'thinking_delay') {
      setThinkingStage('delayed');
          return;
        }

        // Live Whiteboard sync from AI
        if (data.type === 'whiteboard_update') {
          const payload = data.payload;
          setWhiteboardState(payload);
          if (payload?.action !== 'clear') {
            setIsWhiteboardOpen(true);
          }
          return;
        }

        if (data.type === 'setupComplete') {
          resumeAttemptsRef.current = 0;
          setIsConnectionLost(false);
          const isSubsequent = qIndex > 0;
          if (isResumed) {
            setDialogueTurns((prev) => [
              ...prev,
              {
                role: 'system',
                text: '⚡ Контекст сохранен: продолжаем диалог с места паузы.'
              }
            ]);
            if (data.silent) {
              console.log('🤫 Silent Resumption confirmed by server: activating candidate microphone.');
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              setIsThinking(false);
              isThinkingRef.current = false;
              setIsRecording(true);
              isRecordingRef.current = true;
            }
          } else if (sessionType === 'tutor') {
            setDialogueTurns((prev) => [
              ...prev,
              {
                role: 'system',
                text: tutorMode === 'deep_dive'
                  ? `🧠 AI-Тьютор (${interviewConfig.voice}) готов разобрать устройство под капотом!`
                  : tutorMode === 'socratic'
                  ? `🤔 Сократический ментор (${interviewConfig.voice}) готов задавать наводящие вопросы!`
                  : tutorMode === 'eli5'
                  ? `💡 ELI5-Тьютор (${interviewConfig.voice}) готов объяснить суть на жизненной аналогии!`
                  : `✨ AI-Ментор (${interviewConfig.voice}) готов ответить на любые ваши вопросы!`
              }
            ]);
          } else {
            setDialogueTurns((prev) => [
              ...prev,
              {
                role: 'system',
                text: isRetry
                  ? `🔄 Повторный ответ с чистого листа: слушайте вопрос.`
                  : isSubsequent
                  ? `⚡ Вопрос ${qIndex + 1} из ${totalQuestions}: слушайте формулировку.`
                  : `✨ Интервьюер готов (${interviewConfig.voice})! Слушайте вопрос.`
              }
            ]);
          }
          // Warm up microphone hardware if not yet ready
          void initMicrophoneHardware();
        } else if (data.type === 'evaluation_completed') {
          clearAllTurnWatchdogs();
          const evalData: EvaluationResult = data.evaluation;
          // SOTA Guard: Suppress premature evaluation on Turn 0 if candidate hasn't spoken/submitted yet
          if (!hasSpokenInTurnRef.current && userPcmChunksRef.current.length === 0 && !isSubmitting) {
            console.warn('🛡️ Suppressed premature evaluation_completed on Turn 0 before candidate responded.');
            return;
          }
          finalizeEvaluation(evalData, targetQ.id, qIndex);
        } else if (data.error) {
          clearAllTurnWatchdogs();
          setDialogueTurns((prev) => [...prev, { role: 'system', text: `❌ Ошибка: ${data.error}` }]);
        } else if (data.serverContent) {
          // Barge-in interruption
          if (data.serverContent.interrupted) {
            const isUserLoudlySpeaking = isUserSpeaking && rmsDb > -26;
            const isPlaying = playoutManagerRef.current?.isPlaying() ?? false;

            // SOTA Protection: If candidate is not actively speaking loudly and audio is currently playing,
            // this is an echo-induced false interruption from Google Live. Suppress it!
            if (!isUserLoudlySpeaking && isPlaying) {
              console.warn('🛡️ Suppressed false server-side Barge-In interruption (acoustic echo). Continuing audio playout.');
              return;
            }

            playoutManagerRef.current?.handleInterruption();
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsThinking(false);
            isThinkingRef.current = false;
            clearAllTurnWatchdogs();
            lastAiSpeechEndedAtRef.current = Date.now();
            setIsRecording(true);
            isRecordingRef.current = true;
            hasSpokenInTurnRef.current = false;
            setDialogueTurns((prev) => [...prev, { role: 'system', text: '⚡ Речь прервана кандидатом (Barge-in).' }]);
          }

          // AI Speech turn
          if (data.serverContent.modelTurn?.parts) {
            // SOTA Double-Lock Protection: In manual mode, if candidate is recording and has not committed turn,
            // suppress unprompted server modelTurn.
            const isManualMode = (interviewConfig.turnMode || localStorage.getItem('interview_turn_mode')) !== 'auto';
            if (isManualMode && isRecordingRef.current && !isThinkingRef.current) {
              console.warn('🛡️ Suppressed unprompted server modelTurn during candidate manual reflection.');
              return;
            }

            clearAllTurnWatchdogs();
            isServerTurnCompleteRef.current = false;
            setIsAiSpeaking(true);
            isAiSpeakingRef.current = true;
            setIsRecording(false);
            isRecordingRef.current = false;
            setIsThinking(false);
            isThinkingRef.current = false;
            setIsUserSpeaking(false);
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            for (const part of data.serverContent.modelTurn.parts) {
              if (part.text) {
                transcriptRef.current += ` AI: ${part.text}`;
                setDialogueTurns((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'ai') {
                    return [...prev.slice(0, -1), { role: 'ai', text: last.text + part.text }];
                  }
                  return [...prev, { role: 'ai', text: part.text }];
                });
              }
              const pcmBase64 = part.inlineData?.data || part.inline_data?.data;
              if (pcmBase64) {
                playoutManagerRef.current?.enqueuePcmChunk(pcmBase64);
              }
            }
          }

          if (data.serverContent.turnComplete) {
            isServerTurnCompleteRef.current = true;
            console.log('AI turn completed on server. Waiting for AudioPlayoutManager queue to drain...');

            // Dual-Sided Handshake: If audio playout already finished or no audio was received, activate mic immediately
            if (!playoutManagerRef.current?.isPlaying() && !isEvaluationFinalizedRef.current) {
              console.log('🔊 Audio queue already drained on turnComplete. Instantly activating candidate microphone...');
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              setIsThinking(false);
              isThinkingRef.current = false;
              clearAllTurnWatchdogs();
              lastAiSpeechEndedAtRef.current = Date.now();
              setIsRecording(true);
              isRecordingRef.current = true;
              hasSpokenInTurnRef.current = false;
              setDialogueTurns((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.text.includes('Ваша очередь')) return prev;
                return [
                  ...prev,
                  { role: 'system', text: '🎙️ Ваша очередь: говорите в микрофон своими словами.' }
                ];
              });
            }
          }
        }
      } catch (e) {
        console.error('Error handling Live WS message:', e);
      }
    };

    ws.onclose = (ev) => {
      console.log('Live WS closed:', ev.code, ev.reason);
      clearAllTurnWatchdogs();
      setIsPauseHolding(false);
      setIsConnected(false);
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      setIsThinking(false);
      isThinkingRef.current = false;
      setThinkingStage('idle');
      setIsUserSpeaking(false);

      // SOTA Auto-Resumption: Seamless reconnection with compacted context on Google/network timeouts
      const targetQ = questionsBatch?.[activeBatchIndex];
      const isSessionActive = stage === 'active' && !isEvaluationFinalizedRef.current && !!targetQ;
      const isDeliberateAbort = ev.code === 1000 && ev.reason === 'client_abort';

      if (isSessionActive && !isDeliberateAbort) {
        if (resumeAttemptsRef.current < 3) {
          resumeAttemptsRef.current++;
          console.log(`🔄 Session dropped (code ${ev.code}). Auto-resuming attempt ${resumeAttemptsRef.current}/3 with state snapshot...`);

          // Compile state snapshot from dialogueTurnsRef (Strict Question-Boundary Isolation & Splicing up to 3000 chars)
          const turns = dialogueTurnsRef.current.filter((t) => t.role === 'user' || t.role === 'ai');
          const userTurns = turns.filter((t) => t.role === 'user');
          const aiTurns = turns.filter((t) => t.role === 'ai');
          const lastCandidateTurn = userTurns[userTurns.length - 1]?.text || '';
          const lastAiTurn = aiTurns[aiTurns.length - 1]?.text || '';
          setDialogueTurns((prev) => [
            ...prev,
            { role: 'system', text: '🔄 Соединение обновлено, контекст сохранен. Продолжаем...' }
          ]);

          setTimeout(() => {
            if (!isEvaluationFinalizedRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
              connectLiveWebSocket(activeBatchIndex, targetQ, false, true);
            }
          }, 500);
        } else {
          console.warn('⚠️ Auto-resumption attempts exhausted (3/3). Displaying Recovery Card.');
          setIsConnectionLost(true);
        }
      }
    };

    ws.onerror = (err) => {
      console.error('Live WS error:', err);
      clearAllTurnWatchdogs();
      setIsConnected(false);
    };
  };

  /**
   * Action: Manual Reconnect when offline / auto-resume exhausted
   */
  const handleManualReconnect = () => {
    const targetQ = questionsBatch?.[activeBatchIndex];
    if (!targetQ) return;
    resumeAttemptsRef.current = 0;
    setIsConnectionLost(false);

    connectLiveWebSocket(activeBatchIndex, targetQ, false, true);
  };

  /**
   * White Flag Action: Explicitly surrender and ask the AI interviewer for an under-the-hood explanation
   */
  const handleSurrenderAndExplain = async () => {
    const surrenderText = 'Я пока не знаю ответа на этот вопрос. Пожалуйста, зафиксируй это и объясни мне подробно, как это устроено под капотом и как правильно отвечать на собеседовании.';
    const isManual = (interviewConfig.turnMode || 'manual') === 'manual';

    if (isManual) {
      setDialogueTurns((prev) => [
        ...prev,
        { role: 'user', text: '💡 [Запрос разбора]: Я пока не знаю этого. Объясни, пожалуйста, как это устроено под капотом и как правильно отвечать.' }
      ]);
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsThinking(true);
      isThinkingRef.current = true;
      startTurnWatchdog();

      try {
        turnCountRef.current++;
        const res = await fetch('/api/interview/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            questionId: activeQuestionId,
            topic: activeTopic,
            questionText: activeQuestionText,
            referenceAnswer: activeReferenceAnswer,
            history: [
              ...dialogueTurns.filter((t) => t.role !== 'system'),
              { role: 'user', text: surrenderText }
            ],
            turnCount: turnCountRef.current,
            maxProbes: interviewConfig.maxProbes || 2,
            strategy: sessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
            deepDive: !!interviewConfig.deepDive,
            liveCoaching: !!interviewConfig.liveCoaching,
            voice: interviewConfig.voice,
            userGender: interviewConfig.userGender || 'female'
          })
        });

        if (!res.ok) throw new Error(`Turn API returned ${res.status}`);
        const data = await res.json();
        clearAllTurnWatchdogs();

        if (data.replyText) {
          setDialogueTurns((prev) => [...prev, { role: 'ai', text: data.replyText }]);
        }
        setIsThinking(false);
        isThinkingRef.current = false;

        if (playoutManagerRef.current && data.audioBase64) {
          setIsAiSpeaking(true);
          isAiSpeakingRef.current = true;
          playoutManagerRef.current.onPlaybackFinished = () => {
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsRecording(true);
            isRecordingRef.current = true;
          };
          void playoutManagerRef.current.playBase64Audio(data.audioBase64);
        } else {
          setIsRecording(true);
          isRecordingRef.current = true;
        }
      } catch (err) {
        console.error('Manual surrender error:', err);
        clearAllTurnWatchdogs();
        setIsThinking(false);
        isThinkingRef.current = false;
        setIsRecording(true);
        isRecordingRef.current = true;
      }
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const explainFrame = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: surrenderText
              }
            ]
          }
        ],
        turnComplete: true
      }
    };
    wsRef.current.send(JSON.stringify(explainFrame));
    setDialogueTurns((prev) => [
      ...prev,
      { role: 'user', text: '💡 [Запрос разбора]: Я пока не знаю этого. Объясни, пожалуйста, как это устроено под капотом и как правильно отвечать.' }
    ]);
  };

  /**
   * Sends explicit text prompt turn to Live WebSocket (for prompt chips, typed questions, or earphone commute chat)
   */
  const sendTextMessage = (text: string, displayText?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Reset VAD timer and speech flags on manual text turn
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsPauseHolding(false);
    hasSpokenInTurnRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsThinking(true);
    isThinkingRef.current = true;
    isServerTurnCompleteRef.current = false;
    startTurnWatchdog();

    const turnFrame = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }]
          }
        ],
        turnComplete: true
      }
    };
    wsRef.current.send(JSON.stringify(turnFrame));
    if (displayText) {
      setDialogueTurns((prev) => [...prev, { role: 'user', text: displayText }]);
    }
  };

  /**
   * Active Recall Retry: Cleanly reset current question turns and reconnect with isRetry: true
   */
  const retryCurrentQuestionCleanly = () => {
    const targetQ = questionsBatch?.[activeBatchIndex];
    if (!targetQ) return;
    teardownWsAndBuffersOnly();
    setDialogueTurns([]);
    dialogueTurnsRef.current = [];
    setDeepgramTranscript('');
    userPcmChunksRef.current = [];
    transcriptRef.current = '';
    isEvaluationFinalizedRef.current = false;
    setEvaluation(null);
    setStage('active');

    const isManual = (interviewConfig.turnMode || 'manual') === 'manual';
    if (isManual) {
      void startLiveInterview();
    } else {
      connectLiveWebSocket(activeBatchIndex, targetQ, true);
    }
  };

  /**
   * Completes candidate's current speaking turn and triggers AI response
   */
  const triggerEndTurn = async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(25); } catch {}
    }
    setIsPauseHolding(false);
    if (!isRecordingRef.current || isAiSpeakingRef.current || isThinkingRef.current) return;

    hasSpokenInTurnRef.current = false;
    setIsUserSpeaking(false);
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsThinking(true);
    isThinkingRef.current = true;
    startTurnWatchdog();

    const isManual = (interviewConfig.turnMode || 'manual') === 'manual';
    if (isManual) {
      // 1. Convert Float32 audio chunks to 16kHz Int16 PCM Base64
      let totalSamples = 0;
      for (const chunk of userPcmChunksRef.current) {
        totalSamples += chunk.length;
      }
      const mergedInt16 = new Int16Array(totalSamples);
      let offset = 0;
      for (const chunk of userPcmChunksRef.current) {
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          mergedInt16[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
      }
      const bytes = new Uint8Array(mergedInt16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Pcm = btoa(binary);

      turnCountRef.current++;

      try {
        console.log(`📡 Sending candidate turn ${turnCountRef.current} to /api/interview/turn...`);
        const res = await fetch('/api/interview/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            questionId: activeQuestionId,
            topic: activeTopic,
            questionText: activeQuestionText,
            referenceAnswer: activeReferenceAnswer,
            pcmBase64: base64Pcm,
            history: dialogueTurns.filter((t) => t.role !== 'system'),
            turnCount: turnCountRef.current,
            maxProbes: interviewConfig.maxProbes || 2,
            strategy: sessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
            deepDive: !!interviewConfig.deepDive,
            liveCoaching: !!interviewConfig.liveCoaching,
            voice: interviewConfig.voice,
            userGender: interviewConfig.userGender || 'female'
          })
        });

        if (!res.ok) {
          throw new Error(`Turn API returned ${res.status}`);
        }

        const data = await res.json();
        clearAllTurnWatchdogs();

        if (data.transcript) {
          setDialogueTurns((prev) => [...prev, { role: 'user', text: data.transcript }]);
        }

        if (data.action === 'probe') {
          if (data.replyText) {
            setDialogueTurns((prev) => [...prev, { role: 'ai', text: data.replyText }]);
          }
          setIsThinking(false);
          isThinkingRef.current = false;
          setIsAiSpeaking(true);
          isAiSpeakingRef.current = true;

          if (playoutManagerRef.current) {
            playoutManagerRef.current.onPlaybackFinished = () => {
              console.log('🔊 Probing audio finished. Activating candidate microphone...');
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              setIsThinking(false);
              isThinkingRef.current = false;
              lastAiSpeechEndedAtRef.current = Date.now();
              setIsRecording(true);
              isRecordingRef.current = true;
              userPcmChunksRef.current = [];
              setDialogueTurns((prev) => [
                ...prev,
                { role: 'system', text: '🎙️ Ваша очередь: ответьте на уточняющий вопрос.' }
              ]);
            };

            if (data.audioBase64) {
              void playoutManagerRef.current.playBase64Audio(data.audioBase64);
            }
          }
        } else {
          // action === 'evaluate'
          if (data.evaluation) {
            setEvaluation(data.evaluation);
            if (data.evaluation.spokenFeedback || data.evaluation.feedback) {
              setDialogueTurns((prev) => [
                ...prev,
                { role: 'ai', text: data.evaluation.spokenFeedback || data.evaluation.feedback }
              ]);
            }
          }
          setIsThinking(false);
          isThinkingRef.current = false;
          setIsAiSpeaking(true);
          isAiSpeakingRef.current = true;

          if (playoutManagerRef.current && data.audioBase64) {
            playoutManagerRef.current.onPlaybackFinished = () => {
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              setStage('verdict');
            };
            void playoutManagerRef.current.playBase64Audio(data.audioBase64);
          } else {
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setStage('verdict');
          }
        }
      } catch (turnErr) {
        console.error('Manual turn error:', turnErr);
        clearAllTurnWatchdogs();
        setIsThinking(false);
        isThinkingRef.current = false;
        setIsRecording(true);
        isRecordingRef.current = true;
      }
      return;
    }

    // Auto-VAD Mode: Check if WebSocket is open
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not open on triggerEndTurn. Falling back to instant REST evaluation...');
      void executeInstantRestEvalFallback();
      return;
    }

    const turnCompleteMsg = {
      clientContent: {
        turnComplete: true
      }
    };
    wsRef.current.send(JSON.stringify(turnCompleteMsg));
    console.log('📤 Sent clientContent.turnComplete to Gemini Live');
  };

  const canResumeSession = Boolean(
    isBatchMode &&
    activeBatchSession &&
    !activeBatchSession.isComplete &&
    (activeBatchSession.topicName === activeTopic || !activeBatchSession.topicName) &&
    Object.keys(activeBatchSession.results || {}).length > 0
  );

  const handleResumeSession = async () => {
    if (!activeBatchSession) return;
    sessionIdRef.current = activeBatchSession.sessionId;
    batchResultsRef.current = { ...activeBatchSession.results };
    setBatchResults(activeBatchSession.results);
    const targetIdx = Math.min(activeBatchSession.currentIndex, totalQuestions - 1);
    setActiveBatchIndex(targetIdx);
    if (onIndexChange) onIndexChange(targetIdx);
    await startLiveInterviewWithIndex(targetIdx);
  };

  const handleStartFresh = async () => {
    clearBatchSession();
    sessionIdRef.current = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    batchResultsRef.current = {};
    setBatchResults({});
    setActiveBatchIndex(initialQuestionIndex);
    if (onIndexChange) onIndexChange(initialQuestionIndex);
    await startLiveInterviewWithIndex(initialQuestionIndex);
  };

  /**
   * Start Live Interview Session with specific question index
   */
  const startLiveInterviewWithIndex = async (targetIndex: number) => {
    setActiveBatchIndex(targetIndex);
    setStage('active');
    setEvaluation(null);
    setIsConnectionLost(false);
    resumeAttemptsRef.current = 0;
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsThinking(false);
    isThinkingRef.current = false;
    setIsUserSpeaking(false);
    hasSpokenInTurnRef.current = false;
    isServerTurnCompleteRef.current = false;
    setDialogueTurns([
      { role: 'system', text: `🎙️ Подключение к голосовому каналу... (Вопрос ${targetIndex + 1} из ${totalQuestions})` }
    ]);
    userPcmChunksRef.current = [];
    transcriptRef.current = '';
    isEvaluationFinalizedRef.current = false;
    setIsSubmitting(false);

    if (!sessionIdRef.current) {
      sessionIdRef.current = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    // 0. Acquire Screen Wake Lock for mobile devices
    void acquireWakeLock();

    // 1. Initialize & Resume AudioPlayoutManager directly within user gesture!
    const playoutManager = new AudioPlayoutManager();
    playoutManagerRef.current = playoutManager;
    await playoutManager.resume();

    // 2. Pre-warm microphone hardware asynchronously in background (non-blocking)
    void initMicrophoneHardware();

    const targetQ = questionsBatch?.[targetIndex] || {
      id: activeQuestionId,
      topic: activeTopic,
      question: activeQuestionText,
      answer: activeReferenceAnswer
    };

    const isManual = (interviewConfig.turnMode || 'manual') === 'manual';
    if (isManual) {
      turnCountRef.current = 0;
      setIsConnected(true);

      try {
        console.log(`🎙️ Synthesizing greeting with Gemini TTS v3 via LiteLLM Proxy...`);
        const res = await fetch('/api/interview/greeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: targetQ.topic,
            questionText: targetQ.question,
            voice: interviewConfig.voice,
            userGender: interviewConfig.userGender || 'female',
            strategy: sessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy
          })
        });

        if (!res.ok) throw new Error(`Greeting API failed with ${res.status}`);
        const data = await res.json();
        const greeting = data.greetingText || data.text;

        if (greeting) {
          setDialogueTurns([{ role: 'ai', text: greeting }]);
        }

        if (playoutManagerRef.current) {
          playoutManagerRef.current.onPlaybackFinished = () => {
            console.log('🔊 Audio greeting finished. Activating candidate microphone...');
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsThinking(false);
            isThinkingRef.current = false;
            lastAiSpeechEndedAtRef.current = Date.now();
            setIsRecording(true);
            isRecordingRef.current = true;
            userPcmChunksRef.current = [];
            setDialogueTurns((prev) => [
              ...prev,
              { role: 'system', text: '🎙️ Ваша очередь: говорите в микрофон своими словами.' }
            ]);
          };

          if (data.audioBase64) {
            void playoutManagerRef.current.playBase64Audio(data.audioBase64);
          }
        }
      } catch (err) {
        console.error('Manual greeting error:', err);
        setIsAiSpeaking(false);
        isAiSpeakingRef.current = false;
        setIsRecording(true);
        isRecordingRef.current = true;
      }
      return;
    }

    // 3. Connect Live WebSocket immediately for Auto-VAD mode
    connectLiveWebSocket(targetIndex, targetQ);
  };

  /**
   * Start Live Interview Session
   * Called on direct user click on "Начать собеседование" button
   */
  const startLiveInterview = async () => {
    await startLiveInterviewWithIndex(activeBatchIndex);
  };

  /**
   * SOTA 2026 In-Flight Steering: Dynamically change Tutor Mode mid-flight without breaking audio session
   */
  const handleSteerTutorMode = (newMode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat') => {
    setTutorMode(newMode);
    try {
      localStorage.setItem('interview_tutor_mode', newMode);
    } catch {}

    const modeDirectives: Record<string, string> = {
      socratic: 'Теперь не объясняй сам подробно, а задавай мне наводящие вопросы и веди сократический диалог.',
      eli5: 'Объясняй на простых жизненных аналогиях, без сложного академического жаргона, максимально доходчиво.',
      deep_dive: 'Веди глубокий технический разбор под капотом: устройство JVM, байткод, структуры данных, concurrency и крайние случаи.',
      free_chat: 'Свободный диалог: отвечай на любые вопросы кандидата в естественной манере.'
    };

    const labelMap: Record<string, string> = {
      deep_dive: '🔬 Под капотом',
      socratic: '💡 Сократ',
      eli5: '👶 На пальцах',
      free_chat: '💬 Свободный'
    };

    const directive = `[СИСТЕМНАЯ ДИРЕКТИВА: СМЕНА РЕЖИМА]: Смени стиль ведения диалога на режим "${newMode}". ${modeDirectives[newMode] || ''}`;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: 'user',
              parts: [{ text: directive }]
            }],
            turnComplete: true
          }
        }));
      } catch (e) {
        console.warn('Failed to send in-flight steering directive:', e);
      }
    }

    setDialogueTurns((prev) => [
      ...prev,
      { role: 'system', text: `🔄 Стиль наставника изменён на: ${labelMap[newMode] || newMode}` }
    ]);
  };

  /**
   * Advance to the next question in the batch seamlessly (Hands-Free Reconnect)
   */
  const advanceToNextQuestion = (nextIndex: number) => {
    if (!isBatchMode || !questionsBatch || nextIndex >= questionsBatch.length) {
      setStage('grand_finale');
      triggerSuccessConfetti();
      return;
    }

    // Teardown previous ephemeral WS connection and buffers
    teardownWsAndBuffersOnly();

    const nextQ = questionsBatch[nextIndex];
    setActiveBatchIndex(nextIndex);
    if (onIndexChange) onIndexChange(nextIndex);

    setEvaluation(null);
    setDialogueTurns([]);
    dialogueTurnsRef.current = [];
    setDeepgramTranscript('');
    setIsTranscriptOpen(false);
    setIsTranscribing(false);
    userPcmChunksRef.current = [];
    transcriptRef.current = '';
    isEvaluationFinalizedRef.current = false;
    setIsSubmitting(false);

    setStage('active');
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;

    setDialogueTurns([
      { role: 'system', text: `🎙️ Переход к вопросу ${nextIndex + 1} из ${totalQuestions}...` }
    ]);

    // Keep screen awake during batch progression
    void acquireWakeLock();

    // Connect fresh socket with question-specific anchors & context bridge
    connectLiveWebSocket(nextIndex, {
      id: nextQ.id,
      topic: nextQ.topic,
      question: nextQ.question,
      answer: nextQ.answer
    });
  };

  const initMicrophoneHardware = async () => {
    try {
      if (playoutManagerRef.current) {
        await playoutManagerRef.current.resume();
      }

      if (inputAudioCtxRef.current && mediaStreamRef.current) {
        if (inputAudioCtxRef.current.state === 'suspended') {
          await inputAudioCtxRef.current.resume();
        }
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      mediaStreamRef.current = stream;

      const audioCtx =
        playoutManagerRef.current?.getContext() ||
        new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
      inputAudioCtxRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      await audioCtx.audioWorklet.addModule('/worklets/audio-capture-processor.js');

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event: MessageEvent) => {
        const { type, pcmBuffer, metrics } = event.data;
        if (type === 'AUDIO_FRAME') {
          if (metrics) {
            setRmsDb(metrics.rmsDb);

            // Dynamic VAD: respects adaptive noise floor from worklet or fallback -42dB
            const isSpeech = metrics.speechDetected || metrics.rmsDb > (metrics.noiseFloorDb ? metrics.noiseFloorDb + 7.5 : -42);

            if (isRecordingRef.current && !isAiSpeakingRef.current && !isThinkingRef.current) {
              if (isSpeech) {
                hasSpokenInTurnRef.current = true;
                setIsUserSpeaking(true);
                setIsPauseHolding(false);
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
                }
              } else if (hasSpokenInTurnRef.current) {
                setIsUserSpeaking(false);
                const turnMode = interviewConfig.turnMode || (localStorage.getItem('interview_turn_mode') as any) || 'manual';
                if (turnMode === 'auto') {
                  setIsPauseHolding(true);
                  if (!silenceTimerRef.current) {
                    const vadPauseMs = interviewConfig.vadPauseMs ?? 1800;
                    silenceTimerRef.current = setTimeout(() => {
                      console.log(`🔇 Silence detected after candidate speech (${(vadPauseMs / 1000).toFixed(1)}s). Auto-triggering turnComplete...`);
                      setIsPauseHolding(false);
                      triggerEndTurn();
                    }, vadPauseMs);
                  }
                }
              }
            }
          }

          const isAiCurrentlySpeaking =
            isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false);
          const isReverbCooldownActive =
            Date.now() - lastAiSpeechEndedAtRef.current < 450;

          if (isRecordingRef.current && !isAiCurrentlySpeaking && !isReverbCooldownActive) {
            const int16 = new Int16Array(pcmBuffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] < 0 ? int16[i] / 32768 : int16[i] / 32767;
            }
            userPcmChunksRef.current.push(float32);
          }

          // Continuous Smooth Realtime Streaming (SOTA 2026 Invariant):
          // Stream standard 100ms PCM chunks while candidate is recording and AI is not speaking.
          // In 'manual' mode, turnComplete is withheld until candidate clicks "Передать ответ ➔".
          const shouldTransmit =
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            isRecordingRef.current &&
            !isAiCurrentlySpeaking &&
            !isReverbCooldownActive;

          if (shouldTransmit && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const bytes = new Uint8Array(pcmBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = btoa(binary);

            const realtimeInput = {
              realtime_input: {
                audio: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Audio
                }
              }
            };
            wsRef.current.send(JSON.stringify(realtimeInput));
          }
        }
      };

      const gainAnchor = audioCtx.createGain();
      gainAnchor.gain.value = 0.0;
      gainAnchorRef.current = gainAnchor;

      sourceNode.connect(workletNode);
      workletNode.connect(gainAnchor);
      gainAnchor.connect(audioCtx.destination);
    } catch (e) {
      console.error('Error initializing microphone hardware:', e);
    }
  };

  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch {}
      workletNodeRef.current = null;
    }
    if (gainAnchorRef.current) {
      try {
        gainAnchorRef.current.disconnect();
      } catch {}
      gainAnchorRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current !== playoutManagerRef.current?.getContext()) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
    }
    inputAudioCtxRef.current = null;
    setIsRecording(false);
    isRecordingRef.current = false;
    setRmsDb(-60);
  };

  const toggleMic = async () => {
    if (playoutManagerRef.current) {
      await playoutManagerRef.current.resume();
    }

    // 1. Unstuck Mic Action: If AI is currently thinking/stalled, clicking mic resets thinking and opens mic immediately
    if (isThinkingRef.current) {
      console.log('🎙️ User clicked mic during thinking. Unstucking thinking state and opening mic...');
      clearAllTurnWatchdogs();
      setIsThinking(false);
      isThinkingRef.current = false;
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      setIsRecording(true);
      isRecordingRef.current = true;
      setDialogueTurns((prev) => [
        ...prev,
        { role: 'system', text: '🎙️ Ожидание ответа сброшено. Продолжайте говорить.' }
      ]);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(15); } catch {}
      }
      return;
    }

    // 2. If AI is currently speaking, clicking the mic allows the candidate to barge-in immediately
    if (isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false)) {
      playoutManagerRef.current?.handleInterruption();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      lastAiSpeechEndedAtRef.current = 0;
    }

    if (isRecording) {
      setIsRecording(false);
      isRecordingRef.current = false;
    } else {
      if (!mediaStreamRef.current) {
        await initMicrophoneHardware();
      }
      setIsRecording(true);
      isRecordingRef.current = true;

      // Auto-Healing: Ensure WebSocket is open when candidate enables microphone!
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('🔄 Auto-healing WebSocket on mic activation...');
        const targetQ = questionsBatch?.[activeBatchIndex] || {
          id: activeQuestionId,
          topic: activeTopic,
          question: activeQuestionText,
          answer: activeReferenceAnswer
        };
        connectLiveWebSocket(activeBatchIndex, targetQ);
      }
    }
  };

  const encodePcmToInt16Base64 = (): string => {
    const totalSamples = userPcmChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    const combined = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of userPcmChunksRef.current) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    const int16 = new Int16Array(combined.length);
    for (let i = 0; i < combined.length; i++) {
      const clamped = Math.max(-1, Math.min(1, combined[i]));
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const computeLocalAcoustics = (
    realWordCount?: number,
    wordTimestamps?: Array<{ word: string; start: number; end: number }>,
    actualTranscript?: string
  ): AcousticMetrics => {
    const totalSamples = userPcmChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedPcm = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of userPcmChunksRef.current) {
      combinedPcm.set(chunk, offset);
      offset += chunk.length;
    }
    const transcriptToUse = (actualTranscript && actualTranscript.trim().length > 0)
      ? actualTranscript.trim()
      : (transcriptRef.current && transcriptRef.current.trim().length > 0)
      ? transcriptRef.current.trim()
      : 'Ответ кандидата в голосовом режиме';

    return AcousticTelemetryService.analyzeAcoustics(
      combinedPcm,
      16000,
      transcriptToUse,
      wordTimestamps
    );
  };

  const finalizeEvaluation = async (evalData: EvaluationResult, evaluatedQuestionId: string, qIndex: number) => {
    if (isEvaluationFinalizedRef.current) return;
    isEvaluationFinalizedRef.current = true;

    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }

    setIsRecording(false);
    isRecordingRef.current = false;
    playoutManagerRef.current?.clearQueue();

    const acousticsLocal = computeLocalAcoustics();
    const initialClarity = liveClarityMetrics || AcousticTelemetryService.analyzeSpeechClarity(transcriptRef.current, acousticsLocal.grossWpm);
    const finalResult: EvaluationResult = {
      ...evalData,
      id: evalData.id || evaluatedQuestionId,
      questionId: evaluatedQuestionId,
      audioMetrics: acousticsLocal,
      clarityMetrics: initialClarity,
      questionType: evalData.questionType || questionStructure.category,
      speechCoaching: evalData.speechCoaching
    };
    setEvaluation(finalResult);

    // Atomically accumulate in ref and functional state (immune to stale closures)
    batchResultsRef.current[evaluatedQuestionId] = finalResult;
    setBatchResults((prev) => ({ ...prev, [evaluatedQuestionId]: finalResult }));

    // Persist session checkpoint in Zustand & LocalStorage
    if (sessionIdRef.current) {
      saveBatchSessionCheckpoint(sessionIdRef.current, {
        topicId: activeTopic,
        topicName: activeTopic,
        questions: questionsBatch || [],
        currentIndex: qIndex + 1,
        results: { ...batchResultsRef.current },
        isComplete: !isBatchMode || qIndex >= totalQuestions - 1
      });
    }

    setIsSubmitting(false);

    // Check if we should auto-advance or show single verdict or grand finale
    const hasMoreQuestions = isBatchMode && qIndex < totalQuestions - 1;

    if (hasMoreQuestions) {
      setCountdown(interviewConfig.transitionDelay ?? 5);
      setIsTransitionPaused(false);
      setStage('transition');
    } else if (isBatchMode && qIndex === totalQuestions - 1) {
      setStage('grand_finale');
      triggerSuccessConfetti();
      if (onBatchComplete) onBatchComplete({ ...batchResultsRef.current });
    } else {
      setStage('verdict');
      if ((finalResult.score ?? 0) >= 80) triggerSuccessConfetti();
    }

    if (onEvaluationComplete) onEvaluationComplete(finalResult);

    // Deepgram background transcribe
    if (userPcmChunksRef.current.length > 0) {
      setIsTranscribing(true);
      let deepgramText = '';
      let realWordCount = 0;
      let wordTimestamps: Array<{ word: string; start: number; end: number }> = [];
      try {
        const pcmBase64 = encodePcmToInt16Base64();
        const sttRes = await fetch('/api/stt/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pcmBase64 })
        });
        if (sttRes.ok) {
          const sttData = await sttRes.json();
          deepgramText = sttData.transcript || '';
          realWordCount = sttData.wordsCount || 0;
          wordTimestamps = sttData.words || [];
          if (deepgramText) setDeepgramTranscript(deepgramText);
        }
      } catch (err) {
        console.warn('Deepgram STT failed (non-critical):', err);
      } finally {
        setIsTranscribing(false);
      }

      const acousticsFinal = (wordTimestamps.length > 0 || realWordCount > 0 || deepgramText)
        ? computeLocalAcoustics(realWordCount, wordTimestamps, deepgramText)
        : acousticsLocal;

      const clarityFinal = deepgramText
        ? AcousticTelemetryService.analyzeSpeechClarity(deepgramText, acousticsFinal.grossWpm)
        : initialClarity;

      const enrichedResult: EvaluationResult = {
        ...finalResult,
        audioMetrics: acousticsFinal,
        clarityMetrics: clarityFinal,
        userAnswer: deepgramText || 'Устный ответ через Gemini Live'
      };

      setEvaluation((prev) => (prev ? { ...prev, ...enrichedResult } : enrichedResult));
      setBatchResults((prev) => ({ ...prev, [evaluatedQuestionId]: enrichedResult }));

      const currentTurns = dialogueTurnsRef.current;
      const fullDialogue = [
        ...currentTurns,
        ...(deepgramText ? [{ role: 'user' as const, text: `[Deepgram] ${deepgramText}` }] : [])
      ];

      // Save to SQLite
      if (evaluatedQuestionId) {
        try {
          await fetch('/api/eval/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: evaluatedQuestionId,
              topic: activeTopic,
              mode: 'voice',
              score: finalResult.score,
              isPassed: finalResult.isPassed,
              positivePoints: finalResult.positivePoints,
              missingPoints: finalResult.missingPoints,
              feedback: finalResult.feedback,
              userAnswer: deepgramText || 'Устный ответ через Gemini Live',
              transcript: JSON.stringify(fullDialogue),
              audioMetrics: acousticsFinal
            })
          });
        } catch (err) {
          console.error('Error saving evaluation to DB:', err);
        }
      }
    }
  };

  const handleRequestVerdict = () => {
    if (isEvaluationFinalizedRef.current) return;
    setIsSubmitting(true);
    setIsRecording(false);
    isRecordingRef.current = false;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const userGender = interviewConfig.userGender || (localStorage.getItem('interview_user_gender') as any) || 'female';
      const verdictPrompt = userGender === 'male'
        ? 'Я закончил ответ. Не нужно ничего озвучивать, просто тихо вызови функцию submit_interview_evaluation с итоговой оценкой.'
        : userGender === 'female'
        ? 'Я закончила ответ. Не нужно ничего озвучивать, просто тихо вызови функцию submit_interview_evaluation с итоговой оценкой.'
        : 'Ответ завершен. Не нужно ничего озвучивать, просто тихо вызовите функцию submit_interview_evaluation с итоговой оценкой.';

      const finishMsg = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: verdictPrompt
                }
              ]
            }
          ],
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(finishMsg));
    }

    // Safety fallback watchdog (6.5s as mandated by AGENTS.md)
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(async () => {
      if (isEvaluationFinalizedRef.current) return;
      console.warn('Live toolCall timeout (6.5s). Executing instant fallback evaluation...');
      try {
        const res = await fetch('/api/eval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: activeQuestionId,
            topic: activeTopic,
            question: activeQuestionText,
            referenceAnswer: activeReferenceAnswer,
            userAnswer: transcriptRef.current || 'Устный ответ кандидата в Gemini Live'
          })
        });
        if (res.ok) {
          const fallbackData = await res.json();
          finalizeEvaluation(fallbackData, activeQuestionId, activeBatchIndex);
        } else {
          setIsSubmitting(false);
        }
      } catch (err) {
        console.error('Fallback eval error:', err);
        setIsSubmitting(false);
      }
    }, 6500);
  };

  const handleRetry = async () => {
    teardownWsAndBuffersOnly();
    await startLiveInterview();
  };

  const toggleSummaryExpand = (id: string) => {
    setExpandedSummaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isOpen || typeof document === 'undefined') return null;

  // Calculate Grand Finale stats with complete resilience (Zustand + Ref + State)
  const allResults: Record<string, EvaluationResult> = {
    ...(activeBatchSession?.results || {}),
    ...batchResultsRef.current,
    ...batchResults
  };
  const evaluatedKeys = Object.keys(allResults);
  const totalEvaluated = evaluatedKeys.length;
  const avgScore = totalEvaluated > 0
    ? Math.round(evaluatedKeys.reduce((acc, k) => acc + (allResults[k]?.score ?? 0), 0) / totalEvaluated)
    : 0;
  const passedCount = evaluatedKeys.filter((k) => allResults[k]?.isPassed).length;

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto modal-overscroll-contain">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className={`bg-white rounded-3xl p-3.5 sm:p-6 border border-pastel-border shadow-2xl relative overflow-hidden flex flex-col my-auto transition-all duration-300 modal-overscroll-contain ${
          sessionType === 'tutor'
            ? 'max-w-5xl w-full max-h-[96dvh] sm:max-h-[92vh]'
            : 'max-w-xl w-full max-h-[96dvh] sm:max-h-[92vh]'
        }`}
      >
        {/* Soft Ambient Glows */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

        {/* Header with Batch Progress Tracker */}
        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-pastel-border/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-bold text-pastel-text text-xs sm:text-base truncate">
                  {sessionType === 'tutor' ? 'AI-Тьютор • Deep Dive' : 'Gemini Live Interviewer'}
                </h3>
                <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-pastel-muted truncate">
                {isBatchMode && (
                  <span className="font-bold text-pastel-accentViolet flex items-center gap-1 shrink-0">
                    <Layers className="w-3 h-3" />
                    {activeBatchIndex + 1}/{totalQuestions}
                  </span>
                )}
                <span className="truncate">
                  {stage === 'lobby'
                    ? sessionType === 'tutor'
                      ? 'Лобби ментора'
                      : 'Лобби'
                    : stage === 'active'
                    ? sessionType === 'tutor'
                      ? 'Диалог с наставником'
                      : 'Live диалог'
                    : stage === 'transition'
                    ? 'Автопереход'
                    : stage === 'grand_finale'
                    ? '🎉 Итоги'
                    : 'Результаты'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {rttMs !== null && (
              <div className="hidden md:flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-card border border-pastel-border text-pastel-sub shadow-2xs" title="Задержка сети (RTT)">
                <span className={`w-1.5 h-1.5 rounded-full ${rttMs < 120 ? 'bg-emerald-500' : rttMs < 350 ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span>{rttMs} ms</span>
              </div>
            )}

            {/* Whiteboard Sidecar Toggle */}
            <button
              type="button"
              onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full border transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer shadow-2xs touch-manipulation ${
                activeWhiteboardState?.code
                  ? 'bg-pastel-accentViolet/20 border-pastel-accentViolet text-pastel-accentViolet shadow-xs'
                  : 'bg-pastel-card hover:bg-pastel-card/80 border-pastel-border text-pastel-sub hover:text-pastel-text'
              }`}
              title={activeWhiteboardState?.code ? 'Открыть интерактивную доску ИИ с кодом' : 'Интерактивная доска ИИ'}
            >
              <Code2 className="w-3.5 h-3.5" />
              {activeWhiteboardState?.code && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className="hidden md:inline">Доска</span>
            </button>

            {/* Candidate Persona HUD with Responsive Disclosure */}
            <CandidatePersonaHUD
              questionText={activeQuestionText}
              topic={activeTopic}
              questionId={activeQuestionId}
              onOpenRadar={() => setIsRadarOpen(true)}
            />

            {/* Guaranteed Escape Hatch - Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-pastel-bg/90 hover:bg-rose-100 text-pastel-sub hover:text-rose-600 flex items-center justify-center transition active:scale-95 cursor-pointer touch-manipulation shrink-0 border border-pastel-border/60 shadow-2xs ml-0.5"
              aria-label="Закрыть окно собеседования"
              title="Закрыть (Esc)"
            >
              <X className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Batch Progress Stepper Bar */}
        {isBatchMode && stage !== 'grand_finale' && (
          <div className="mt-2.5 flex items-center gap-1.5 shrink-0 px-1">
            {questionsBatch?.map((q, idx) => {
              const res = batchResults[q.id];
              const isCurrent = idx === activeBatchIndex;
              return (
                <div
                  key={q.id || idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? 'flex-1 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet shadow-2xs'
                      : res
                      ? res.isPassed
                        ? 'w-4 bg-emerald-400'
                        : 'w-4 bg-rose-400'
                      : 'w-3 bg-slate-200'
                  }`}
                  title={`Вопрос #${q.num}: ${q.question.slice(0, 35)}...`}
                />
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TUTOR MODE: TWO-COLUMN SPLIT-SCREEN WORKSPACE                             */}
        {/* ========================================================================= */}
        {sessionType === 'tutor' && (stage === 'lobby' || stage === 'active') ? (
          <VoiceTutorView
            stage={stage}
            activeTopic={activeTopic}
            activeQuestionNum={activeQuestionNum}
            activeBatchIndex={activeBatchIndex}
            totalQuestions={totalQuestions}
            isBatchMode={isBatchMode}
            activeQuestionText={activeQuestionText}
            activeReferenceAnswer={activeReferenceAnswer}
            tutorMode={tutorMode}
            setTutorMode={handleSteerTutorMode}
            startLiveInterview={startLiveInterview}
            systemHealth={systemHealth}
            setIsSettingsOpen={setIsSettingsOpen}
            interviewConfig={interviewConfig}
            isAiSpeaking={isAiSpeaking}
            isThinking={isThinking}
            thinkingStage={thinkingStage}
            isRecording={isRecording}
            isUserSpeaking={isUserSpeaking}
            isPauseHolding={isPauseHolding}
            rmsDb={rmsDb}
            onInterruption={() => {
              playoutManagerRef.current?.handleInterruption();
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              setIsRecording(true);
              isRecordingRef.current = true;
              lastAiSpeechEndedAtRef.current = Date.now();
            }}
            triggerEndTurn={triggerEndTurn}
            toggleMic={() => void toggleMic()}
            dialogueTurns={dialogueTurns}
            inputText={inputText}
            setInputText={setInputText}
            handleInputKeyDown={handleInputKeyDown}
            handleSendCustomText={handleSendCustomText}
            isMuted={isMuted}
            toggleMute={toggleMute}
            retryCurrentQuestionCleanly={retryCurrentQuestionCleanly}
            onClose={onClose}
            onSwitchToInterview={() => {
              teardownWsAndBuffersOnly();
              setSessionType('interview');
              void startLiveInterview();
            }}
            textInputRef={textInputRef}
          />
        ) : (
          /* ========================================================================= */
          /* INTERVIEW MODE: FOCUSED SINGLE-COLUMN MODAL                               */
          /* ========================================================================= */
          <>
            {/* Question Context Banner */}
            {stage !== 'grand_finale' && activeQuestionText && (
              <div className="mt-3.5 p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/70 text-xs shadow-2xs shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-pastel-accentViolet flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
                    {isBatchMode ? `Вопрос #${activeQuestionNum} (${activeBatchIndex + 1}/${totalQuestions}):` : 'Вопрос темы:'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold shadow-2xs ${questionStructure.badgeStyle}`}>
                    {questionStructure.title}
                  </span>
                </div>
                <p className="text-pastel-text leading-relaxed font-bold">{activeQuestionText}</p>
                {questionStructure.description && (
                  <p className="text-[10px] text-pastel-muted mt-1 leading-snug">
                    {questionStructure.description}
                  </p>
                )}
              </div>
            )}

            {/* STAGE 1: LOBBY */}
            {stage === 'lobby' && (
              <VoiceLobbyView
                interviewConfig={interviewConfig}
                handleConfigChange={handleConfigChange}
                isBatchMode={isBatchMode}
                totalQuestions={totalQuestions}
                speechCoachingMode={speechCoachingMode}
                updateSpeechCoachingMode={updateSpeechCoachingMode}
                canResumeSession={canResumeSession}
                activeBatchSession={activeBatchSession}
                handleResumeSession={handleResumeSession}
                handleStartFresh={handleStartFresh}
                startLiveInterview={startLiveInterview}
                systemHealth={systemHealth}
                setIsSettingsOpen={setIsSettingsOpen}
              />
            )}

            {/* STAGE 2: ACTIVE LIVE SESSION */}
            {stage === 'active' && (
              <>
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

                {/* Offline Recovery Card upon 3 failed auto-resumes */}
                {isConnectionLost && (
                  <div className="mt-2.5 p-4 rounded-2xl bg-white/95 border border-rose-200/90 shadow-md text-center max-w-md mx-auto animate-fade-in shrink-0">
                    <div className="flex items-center justify-center gap-2 mb-1.5 text-rose-600 font-bold text-xs">
                      <WifiOff className="w-4 h-4" />
                      <span>Связь с голосовым каналом прервана</span>
                    </div>
                    <p className="text-[11px] text-pastel-sub mb-3 leading-relaxed">
                      История вашего ответа и контекст текущего вопроса сохранены. Вы можете возобновить диалог с сохраненного места.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleManualReconnect}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold text-xs shadow-xs hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Возобновить разговор</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          teardownFullAudio();
                          setStage('lobby');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-pastel-card hover:bg-white border border-pastel-border text-pastel-sub hover:text-pastel-text text-xs font-semibold transition cursor-pointer"
                      >
                        В лобби
                      </button>
                    </div>
                  </div>
                )}

                <div className="my-3.5 flex flex-col items-center justify-center shrink-0">
                  <div className="relative flex items-center justify-center">
                    {/* Dynamic Acoustic Ripple when user is actively speaking */}
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
                            playoutManagerRef.current?.handleInterruption();
                            setIsAiSpeaking(false);
                            isAiSpeakingRef.current = false;
                            setIsRecording(true);
                            isRecordingRef.current = true;
                            lastAiSpeechEndedAtRef.current = Date.now();
                          } else if (isRecording) {
                            // In active recording: clicking the central circle transmits the answer!
                            triggerEndTurn();
                          } else {
                            // Resume recording & auto-heal socket
                            void toggleMic();
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
                              onClick={toggleMic}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-bold shadow-2xs cursor-pointer flex items-center gap-1"
                              title="Сбросить ожидание и продолжить говорить"
                            >
                              <Mic className="w-3 h-3 text-emerald-600" />
                              <span>Продолжить говорить</span>
                            </button>
                            <button
                              type="button"
                              onClick={executeInstantRestEvalFallback}
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
                          onClick={triggerEndTurn}
                          className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                          title="Нажмите, когда закончите говорить: ИИ выслушает ответ, задаст уточнение при необходимости или подведет итог"
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
                          {/* Live WPM Chip */}
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

                          {/* Live Filler Words Disfluency Chip */}
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

                        {/* Expected Question Structure Pill */}
                        <div className="pt-1 border-t border-pastel-border/40 flex items-center justify-between text-[10px]">
                          <span className="text-pastel-muted font-medium flex items-center gap-1">
                            <span>💡 Формат:</span>
                            <span className="font-bold text-pastel-text">
                              {speechCoachingMode === 'always' ? 'STAR (Принудительно)' : questionStructure.title}
                            </span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${questionStructure.badgeStyle}`}>
                            {speechCoachingMode === 'always' ? 'STAR' : questionStructure.recommendedFramework}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

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

                {/* Unified Multimodal Input Dock for Interview Mode (Text & Earphones/Silent Mode) */}
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

                    {/* Send Text Button */}
                    <button
                      type="button"
                      onClick={() => handleSendCustomText()}
                      disabled={!inputText.trim() || (isAiSpeaking && !isMuted)}
                      className="p-2 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 active:scale-95 transition-all shadow-xs disabled:opacity-40 disabled:scale-100 cursor-pointer"
                      title="Отправить ответ в диалог (Enter)"
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
                </div>

                {/* Action Bar */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSurrenderAndExplain}
                    disabled={isSubmitting || isAiSpeaking}
                    className="px-3 py-1.5 rounded-xl bg-amber-50/90 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                    title="Попросить ИИ зафиксировать пробел и дать емкое Senior-объяснение под капотом"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>💡 Сдаюсь / Объяснить под капотом</span>
                  </button>

                  <button
                    type="button"
                    onClick={retryCurrentQuestionCleanly}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-xl bg-pastel-lavender/70 hover:bg-pastel-lavender border border-pastel-accentViolet/30 text-pastel-accentViolet text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Сбросить историю реплик и попробовать ответить заново с чистого листа"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>🔄 Ответить заново с нуля</span>
                  </button>
                </div>

                {/* Bottom Controls */}
                <div className="mt-3 pt-3 border-t border-pastel-border/60 flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleRequestVerdict}
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Формирование вердикта...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Завершить ответ и получить оценку</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 px-5 rounded-2xl border border-pastel-border text-pastel-sub text-xs font-semibold hover:bg-pastel-rose transition cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2.5: INTER-QUESTION TRANSITION (Supports Auto-Timer & Manual Mode)  */}
        {/* ========================================================================= */}
        {stage === 'transition' && evaluation && (() => {
          const isAutoAdvance = interviewConfig.autoAdvance === true && (interviewConfig.transitionDelay ?? 5) > 0;
          const nextQuestionNum = questionsBatch?.[activeBatchIndex + 1]?.num ?? (activeBatchIndex + 2);
          const totalDelay = interviewConfig.transitionDelay ?? 5;

          return (
            <div className="my-3 space-y-3.5 overflow-y-auto max-h-[66vh] pr-1">
              {/* Score Banner */}
              <div
                className={`p-4 rounded-3xl border flex items-center justify-between shadow-xs ${
                  evaluation.isPassed
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/90 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-xs ${
                      evaluation.isPassed ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  >
                    {evaluation.score ?? 70}%
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">
                      {evaluation.isPassed ? '🎉 Вопрос успешно зачтен!' : 'Требуется дополнительное повторение'}
                    </h4>
                    <p className="text-xs opacity-80">
                      Вопрос {activeBatchIndex + 1} из {totalQuestions} пройден
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-700 shadow-2xs">
                  {evaluation.score ?? 70}/100
                </span>
              </div>

              {/* Transition Control Card (Auto-Timer vs Manual Mode) */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-pastel-lavender/60 via-white to-pastel-rose/40 border border-pastel-border shadow-md space-y-3 text-center">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-pastel-accentViolet">
                    <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
                    <span>Следующий: Вопрос #{nextQuestionNum} из {totalQuestions}</span>
                  </div>

                  {/* Mode Selector Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextAuto = !isAutoAdvance;
                      handleConfigChange({
                        ...interviewConfig,
                        autoAdvance: nextAuto,
                        transitionDelay: nextAuto ? (interviewConfig.transitionDelay || 5) : 0
                      });
                    }}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-pastel-border text-slate-700 hover:bg-pastel-card transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="Переключить между автоматическим и ручным переходом к вопросу"
                  >
                    <span>{isAutoAdvance ? '⚡ Автопереход: ВКЛ' : '✋ Ручной режим (без таймера)'}</span>
                  </button>
                </div>

                {isAutoAdvance ? (
                  <div className="space-y-2 py-1">
                    <div className="text-2xl font-black text-pastel-text">
                      {isTransitionPaused ? '⏸️ Таймер на паузе' : `Переход через ${countdown} сек...`}
                    </div>

                    {!isTransitionPaused && (
                      <div className="w-full bg-pastel-border/60 h-2 rounded-full overflow-hidden p-0.5 max-w-md mx-auto">
                        <motion.div
                          initial={{ width: '100%' }}
                          animate={{ width: `${(countdown / totalDelay) * 100}%` }}
                          transition={{ duration: 1, ease: 'linear' }}
                          className="h-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet rounded-full"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-1">
                    <p className="text-xs text-pastel-muted">
                      Время не ограничено. Спокойно изучите разбор ответа ниже и нажмите кнопку, когда будете готовы.
                    </p>
                  </div>
                )}

                {/* Transition Action Buttons */}
                <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => advanceToNextQuestion(activeBatchIndex + 1)}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold text-xs shadow-sm hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Перейти к вопросу #{nextQuestionNum} ➔</span>
                  </button>

                  <button
                    type="button"
                    onClick={retryCurrentQuestionCleanly}
                    className="py-2.5 px-4 rounded-xl bg-white border border-pastel-border text-pastel-accentViolet font-bold text-xs hover:bg-pastel-lavender/30 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Пересдать этот же вопрос заново с чистого листа"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>🔄 Ответить заново</span>
                  </button>

                  {isAutoAdvance && (
                    <button
                      type="button"
                      onClick={() => setIsTransitionPaused((p) => !p)}
                      className="py-2.5 px-4 rounded-xl bg-white border border-pastel-border text-pastel-text font-semibold text-xs hover:bg-pastel-card transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      {isTransitionPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5 text-emerald-600 fill-current" />
                          <span>Возобновить отсчет</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5 text-amber-600" />
                          <span>Пауза таймера</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setStage('grand_finale');
                      triggerSuccessConfetti();
                    }}
                    className="py-2.5 px-3.5 rounded-xl text-pastel-muted hover:text-pastel-text text-xs transition cursor-pointer"
                  >
                    Завершить интервью
                  </button>
                </div>
              </div>

              {/* Detailed Feedback on Transition Screen */}
              {evaluation.positivePoints && evaluation.positivePoints.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 text-xs">
                  <span className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Что раскрыто глубоко и точно:
                  </span>
                  <ul className="space-y-1 text-emerald-900 list-disc list-inside">
                    {evaluation.positivePoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.missingPoints && evaluation.missingPoints.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200/60 text-xs">
                  <span className="font-bold text-rose-700 flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Упущенные якоря и зоны роста:
                  </span>
                  <ul className="space-y-1 text-rose-900 list-disc list-inside">
                    {evaluation.missingPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(evaluation.spokenFeedback || evaluation.feedback) && (
                <div className="p-3.5 rounded-2xl bg-pastel-card border border-pastel-border text-xs leading-relaxed text-pastel-text">
                  <span className="font-bold text-pastel-accentViolet block mb-1">Резюме интервьюера:</span>
                  <p>{evaluation.spokenFeedback || evaluation.feedback}</p>
                </div>
              )}

              {/* Expandable Dialogue Transcript */}
              {(deepgramTranscript || dialogueTurns.some((t) => t.role === 'ai' && t.text.length > 5)) && (
                <div className="rounded-2xl border border-pastel-border/70 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setIsTranscriptOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-pastel-card/80 hover:bg-pastel-rose/30 transition-colors text-xs font-bold text-pastel-text cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-pastel-accentViolet" />
                      📜 Стенограмма ответа (Deepgram Nova-3)
                    </span>
                    {isTranscriptOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isTranscriptOpen && (
                    <div className="p-3 bg-white/70 space-y-2 max-h-48 overflow-y-auto">
                      {deepgramTranscript && (
                        <div className="text-[11px] text-pastel-text/90">
                          <span className="font-bold text-emerald-700 block text-[9px] mb-0.5">
                            Ваш ответ:
                          </span>
                          <p>{deepgramTranscript}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* STAGE 3: SINGLE VERDICT & RETRY                                           */}
        {/* ========================================================================= */}
        {stage === 'verdict' && evaluation && (
          <VoiceVerdictView
            evaluation={evaluation}
            interviewConfig={interviewConfig}
            retryCurrentQuestionCleanly={retryCurrentQuestionCleanly}
            onClose={onClose}
          />
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: GRAND FINALE (Cumulative Multi-Question Summary)                 */}
        {/* ========================================================================= */}
        {stage === 'grand_finale' && (
          <VoiceGrandFinaleView
            totalEvaluated={totalEvaluated}
            totalQuestions={totalQuestions}
            activeTopic={activeTopic}
            avgScore={avgScore}
            passedCount={passedCount}
            questionsBatch={questionsBatch}
            allResults={allResults}
            handleRetry={handleRetry}
            onClose={onClose}
          />
        )}
      </motion.div>

      {/* Settings Drawer Modal */}
      <VoiceSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={interviewConfig}
        onChangeConfig={handleConfigChange}
        questionText={activeQuestionText}
        referenceAnswer={activeReferenceAnswer}
      />

      {/* Memory Radar Drawer */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
      />

      {/* Interactive AI Whiteboard Drawer */}
      <WhiteboardDrawer
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        state={activeWhiteboardState}
      />
    </div>,
    document.body
  );
};
