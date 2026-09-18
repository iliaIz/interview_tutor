import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectionFocusStore } from '../store/useSelectionFocusStore';
import { createDeicticFocusPrompt, setupGlobalSelectionListener } from '../services/DeicticGroundingManager';
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
import { InterviewConfig, GeminiVoiceName, LiveModelChoice } from '../types/interviewConfig';
import { VoiceSettingsDrawer } from './VoiceSettingsDrawer';
import { StudioErrorBoundary } from './StudioErrorBoundary';
import { getActiveConfig, saveActiveConfig } from '../services/profileStorage';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { Question, useAppStore, selectActiveWhiteboardArtifact } from '../store/useAppStore';
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
import { RubricScorecard } from './voice/RubricScorecard';
import { RubricCriterionResult, ScoreDeduction } from '../types/voice';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

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
    criteriaBreakdown?: RubricCriterionResult[];
    deductions?: ScoreDeduction[];
    upgradeSnippet?: string;
  };
  criteriaBreakdown?: RubricCriterionResult[];
  deductions?: ScoreDeduction[];
  upgradeSnippet?: string;
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
    setIsWhiteboardOpen,
    codeRevisions,
    activeRevisionId
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

  const { config: interviewConfig, setConfig: setInterviewConfig } = useInterviewConfig();
  const showToast = useAppStore((s) => s.showToast);
  const interviewConfigRef = useRef<InterviewConfig>(interviewConfig);
  useEffect(() => {
    interviewConfigRef.current = interviewConfig;
  }, [interviewConfig]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [fallbackModelSuggestion, setFallbackModelSuggestion] = useState<{
    originalModel: string;
    suggestedModel: LiveModelChoice;
    message: string;
  } | null>(null);
  const isNonRetryableErrorRef = useRef<boolean>(false);

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
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const gainAnchorRef = useRef<GainNode | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);
  const interactionStatusRef = useRef<'IDLE' | 'IN_PROGRESS'>('IDLE');

  // Mount tracking & In-flight request cancellation (SOTA 2026 Resilience)
  const isMountedRef = useRef<boolean>(true);
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortAllInFlightRequests();
    };
  }, []);

  const createManagedAbortSignal = () => {
    const controller = new AbortController();
    activeAbortControllersRef.current.add(controller);
    return {
      controller,
      signal: controller.signal,
      cleanup: () => {
        activeAbortControllersRef.current.delete(controller);
      }
    };
  };

  const abortAllInFlightRequests = () => {
    for (const controller of activeAbortControllersRef.current) {
      try { controller.abort(); } catch {}
    }
    activeAbortControllersRef.current.clear();
  };

  // Real-time Session State
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState<'idle' | 'processing' | 'delayed' | 'critical'>('idle');
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [isPauseHolding, setIsPauseHolding] = useState<boolean>(false);
  const [isSessionPaused, setIsSessionPaused] = useState<boolean>(false);
  const isSessionPausedRef = useRef<boolean>(false);
  const speechStartTimeRef = useRef<number | null>(null);
  const lastSyncedRevisionIdRef = useRef<string | null>(null);
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
    const saved = localStorage.getItem('interview_speech_coaching_mode');
    if (saved === 'adaptive' || saved === 'always' || saved === 'off') {
      return saved;
    }
    return 'adaptive';
  });
  const [liveClarityMetrics, setLiveClarityMetrics] = useState<SpeechClarityMetrics | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const speechRecognitionRef = useRef<{
    start(): void;
    stop(): void;
    abort(): void;
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
  } | null>(null);
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
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnWatchdogRef = useRef<NodeJS.Timeout[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isEvaluationFinalizedRef = useRef(false);
  const dialogueTurnsRef = useRef<Array<{ role: 'ai' | 'user' | 'system'; text: string }>>([]);
  const turnCountRef = useRef(0);
  const resumeAttemptsRef = useRef(0);
  const generationEpochRef = useRef<number>(0);
  const isTactileInterruptedRef = useRef<boolean>(false);

  const handleConfigChange = (newConfig: InterviewConfig) => {
    setInterviewConfig(newConfig);
    saveActiveConfig(newConfig);
  };

  // Screen Wake Lock API for Mobile (Android/iOS)
  const acquireWakeLock = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
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

  // SOTA 2026 Pre-Speech Deictic Grounding:
  // When activeRevisionId changes, stage it in pendingWhiteboardRevisionIdRef instead of sending WebSocket frames mid-speech.
  // This completely eliminates self-interruption (barge-in race) during AI speech generation.
  const pendingWhiteboardRevisionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeRevisionId && activeRevisionId !== lastSyncedRevisionIdRef.current) {
      pendingWhiteboardRevisionIdRef.current = activeRevisionId;
    }
  }, [activeRevisionId]);

  const injectActiveWhiteboardGroundingFrame = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const targetRevId = pendingWhiteboardRevisionIdRef.current || activeRevisionId;
    if (!targetRevId || targetRevId === lastSyncedRevisionIdRef.current) return;

    const currentRev = codeRevisions?.find((r) => r.id === targetRevId);
    if (!currentRev) return;

    lastSyncedRevisionIdRef.current = targetRevId;
    pendingWhiteboardRevisionIdRef.current = null;

    console.log(`📡 [Pre-Speech Grounding] Injecting screen context frame for revision "${currentRev.title}" (${currentRev.id})`);
    const deicticGroundingFrame = {
      type: 'screen_context_sync',
      deictic: true,
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: `📌 [КОНТЕКСТ ЭКРАНА: ВЕРСИЯ "${currentRev.title}"]:\n\`\`\`${currentRev.language || 'java'}\n${currentRev.code}\n\`\`\`\n(Системная директива: кандидат сейчас смотрит на эту ревизию кода на экране. Учитывай этот код как активный контекст при ответе).`
              }
            ]
          }
        ],
        turnComplete: false
      }
    };
    try {
      wsRef.current.send(JSON.stringify(deicticGroundingFrame));
    } catch (err) {
      console.warn('Failed to send deictic whiteboard grounding frame:', err);
    }
  }, [activeRevisionId, codeRevisions]);

  const getActiveArtifactPayload = useCallback(() => {
    const artifact = selectActiveWhiteboardArtifact(useAppStore.getState());
    if (!artifact) return undefined;
    return {
      id: artifact.id,
      title: artifact.title,
      language: artifact.language,
      code: artifact.code
    };
  }, []);

  // SOTA 2026 Deictic Grounding: Inject active selection context before user voice audio
  const isFocusInjectedInCurrentTurnRef = useRef(false);

  const injectActiveFocusGroundingFrame = useCallback(() => {
    if (isFocusInjectedInCurrentTurnRef.current) return;
    const focus = useSelectionFocusStore.getState().activeFocus;
    if (!focus || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    isFocusInjectedInCurrentTurnRef.current = true;
    const textPrompt = createDeicticFocusPrompt(focus);

    console.log('📡 [Deictic Grounding] Injected turn focus frame:', textPrompt);
    const focusFrame = {
      type: 'screen_context_sync',
      deictic: true,
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: textPrompt }]
          }
        ],
        turnComplete: false
      }
    };
    try {
      wsRef.current.send(JSON.stringify(focusFrame));
    } catch (e) {
      console.warn('Failed to send deictic grounding frame:', e);
    }
  }, []);

  // SOTA 2026 Deictic Grounding: Global mouseup listener for text selection in question/answer/code zones
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = setupGlobalSelectionListener();
    return () => cleanup();
  }, [isOpen]);

  // SOTA 2026 Auto-Healing Invariant: Prevent microphone from being stuck in pause during active session
  useEffect(() => {
    if (stage !== 'active') return;
    const interval = setInterval(() => {
      const isAiBusy =
        isAiSpeakingRef.current ||
        (playoutManagerRef.current?.isPlaying() ?? false) ||
        isThinkingRef.current;
      if (!isAiBusy && !isSessionPausedRef.current && !isMuted && !isRecordingRef.current) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isEvaluationFinalizedRef.current) {
          console.log('🎙️ [Auto-Healing] Restoring active recording state in dialogue session');
          setIsRecording(true);
          isRecordingRef.current = true;
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [stage, isMuted]);

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
      recognition.onend = () => {
        if (speechRecognitionRef.current === recognition) {
          speechRecognitionRef.current = null;
        }
      };
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

    // Tier 3: 10.0s - auto-fallback to REST /api/eval (Only for interview scoring, NEVER in tutor mode!)
    const t3 = setTimeout(() => {
      if (isThinkingRef.current && !isEvaluationFinalizedRef.current && sessionType !== 'tutor') {
        console.warn('⏱️ 10s Turn Watchdog expired. Triggering automated REST evaluation fallback...');
        void executeInstantRestEvalFallback();
      } else if (isThinkingRef.current && sessionType === 'tutor') {
        console.warn('⏱️ 10s Tutor Turn Watchdog expired. Sending sync ping to backend...');
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'sync_ping', timestamp: Date.now() }));
          } catch {}
        }
        // If after 14s still thinking in tutor mode, gently unfreeze thinking state to allow user to continue speaking
        setTimeout(() => {
          if (isThinkingRef.current && sessionType === 'tutor') {
            console.warn('⏱️ 14s Tutor Turn Watchdog hard recovery: unlocking microphone for candidate.');
            setIsThinking(false);
            isThinkingRef.current = false;
            setThinkingStage('idle');
            setIsRecording(true);
            isRecordingRef.current = true;
          }
        }, 4000);
      }
    }, 10000);

    turnWatchdogRef.current = [t1, t2, t3];
  };

  const handleClientBargeIn = (customPrompt?: string) => {
    const isPlaying = playoutManagerRef.current?.isPlaying() ?? false;
    if (isPlaying || isAiSpeakingRef.current || isThinkingRef.current) {
      console.log('🛑 [TACTILE_BARGE_IN] Candidate clicked Stop / Barge-In. Aborting AI generation & reclaiming mic.');

      generationEpochRef.current += 1;
      isTactileInterruptedRef.current = true;

      playoutManagerRef.current?.handleInterruption();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      setIsThinking(false);
      isThinkingRef.current = false;
      setThinkingStage('idle');
      clearAllTurnWatchdogs();
      lastAiSpeechEndedAtRef.current = Date.now();

      setIsRecording(true);
      isRecordingRef.current = true;
      hasSpokenInTurnRef.current = false;

      // Clean worklet state on Barge-In
      workletNodeRef.current?.port.postMessage({ type: 'RESET' });

      // Signal backend and upstream Gemini Live Proxy to abort the monologue
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // 1. Dedicated control frame for backend connection handler
          wsRef.current.send(JSON.stringify({
            type: 'barge_in',
            epoch: generationEpochRef.current
          }));

          // 2. Upstream abort turn frame
          wsRef.current.send(JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: customPrompt || '[КАНДИДАТ ПРЕРВАЛ РЕЧЬ (BARGE-IN)]: Передай слово кандидату.' }]
                }
              ],
              turnComplete: false
            }
          }));
        } catch (e) {
          console.warn('Failed to dispatch upstream barge-in frames:', e);
        }
      }
    }
  };

  const executeInstantRestEvalFallback = async () => {
    clearAllTurnWatchdogs();
    setIsThinking(false);
    isThinkingRef.current = false;

    // Zero Grading Invariant: Never trigger evaluation in Tutor mode!
    if (sessionType === 'tutor') {
      console.log('🛡️ Suppressed REST eval fallback in tutor mode (zero grading invariant).');
      setIsRecording(true);
      isRecordingRef.current = true;
      return;
    }

    setIsSubmitting(true);
    setDialogueTurns((prev) => [
      ...prev,
      { role: 'system', text: '⚡ Сеть голосового шлюза перегружена. Запущена мгновенная REST-оценка...' }
    ]);

    const { signal, cleanup } = createManagedAbortSignal();
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
        signal,
        body: JSON.stringify({
          questionId: targetQ.id || activeQuestionId,
          topic: targetQ.topic,
          question: targetQ.question,
          referenceAnswer: targetQ.answer,
          userAnswer: transcriptRef.current || 'Устный ответ кандидата в голосовом режиме'
        })
      });
      if (res.ok && isMountedRef.current) {
        const fallbackData = await res.json();
        if (isMountedRef.current) {
          finalizeEvaluation(fallbackData, targetQ.id || activeQuestionId, activeBatchIndex);
        }
      } else if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Fallback eval error:', e);
      }
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    } finally {
      cleanup();
    }
  };

  // Synchronize initialQuestionIndex & Checkpoint when opened
  useEffect(() => {
    if (!isOpen) {
      abortAllInFlightRequests();
      teardownFullAudio();
      setStage('lobby');
      return;
    }

    isMountedRef.current = true;
    setSessionType(initialSessionType || 'interview');
    setTutorMode(initialTutorMode || 'deep_dive');

    // Check for existing valid session checkpoint for this topic (interview mode only)
    if (
      initialSessionType !== 'tutor' &&
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
    setIsSessionPaused(false);
    isSessionPausedRef.current = false;

    return () => {
      abortAllInFlightRequests();
      teardownFullAudio();
    };
  }, [isOpen]);

  // SOTA 2026: Fast-Launch in 1 click when preflight confirmation is disabled (Tutor ALWAYS opens in calm Lobby)
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasAutoLaunchedRef.current = false;
      return;
    }
    const currentConfig = interviewConfigRef.current;
    // SOTA 2026: Tutor always opens in calm Lobby state so user can choose tutoring mode and review topic
    const effectiveSessionType = initialSessionType || sessionType;
    const shouldFastLaunch = !currentConfig.alwaysShowPreflight && effectiveSessionType !== 'tutor';

    if (stage === 'lobby' && shouldFastLaunch && !hasAutoLaunchedRef.current) {
      hasAutoLaunchedRef.current = true;
      const targetIdx = initialQuestionIndex !== undefined ? initialQuestionIndex : activeBatchIndex;
      void startLiveInterviewWithIndex(targetIdx);
    }
  }, [isOpen, stage, activeBatchIndex, initialQuestionIndex, customPromptOverride, sessionType, initialSessionType]);

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
    abortAllInFlightRequests();
    isEvaluationFinalizedRef.current = false;
    clearAllTurnWatchdogs();
    setIsPauseHolding(false);
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
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
    interactionStatusRef.current = 'IDLE';
    setIsConnected(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsThinking(false);
    isThinkingRef.current = false;
    setThinkingStage('idle');
    setIsUserSpeaking(false);
    setIsRecording(false);
    isRecordingRef.current = false;
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
      speechRecognitionRef.current = null;
    }
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

    isNonRetryableErrorRef.current = false;
    setFallbackModelSuggestion(null);

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
      strictness: interviewConfig.strictness || (localStorage.getItem('interview_strictness_level') as any) || 'standard',
      deepDive: String(!!interviewConfig.deepDive || (sessionType === 'tutor' && tutorMode === 'deep_dive')),
      liveCoaching: String(!!interviewConfig.liveCoaching || sessionType === 'tutor'),
      customAnchors: JSON.stringify(interviewConfig.customAnchors || []),
      customPrompt: customPromptOverride || interviewConfig.customPromptOverride || '',
      initialUserMessage: customPromptOverride || '',
      liveModel: interviewConfig.liveModel || (localStorage.getItem('interview_live_model') as any) || 'gemini-live-v3',
      questionIndex: String(qIndex),
      totalQuestions: String(totalQuestions),
      isRetry: String(!!isRetry),
      isResumed: String(!!isResumed),
      probesCount: String(turnCountRef.current)
    });

    // SOTA 2026: Pass canonical active code artifact and revisions summary on connection startup
    const activeArtifact = selectActiveWhiteboardArtifact(useAppStore.getState());
    if (activeArtifact) {
      params.set(
        'activeCodeArtifact',
        JSON.stringify({
          id: activeArtifact.id,
          title: activeArtifact.title,
          language: activeArtifact.language,
          code: activeArtifact.code
        })
      );
      lastSyncedRevisionIdRef.current = activeArtifact.id;
    }

    if (codeRevisions && codeRevisions.length > 0) {
      const revSummary = codeRevisions.map((r) => ({ id: r.id, title: r.title }));
      params.set('codeRevisionsSummary', JSON.stringify(revSummary));
    }

    // SOTA 2026: Prefetch One-Time WS Ticket for Zero-Trust Gemini Live Handshake
    const { signal: ticketSignal, cleanup: ticketCleanup } = createManagedAbortSignal();
    try {
      const ticketRes = await fetch('/api/auth/ws-ticket', {
        method: 'POST',
        credentials: 'include',
        signal: ticketSignal
      });
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        if (ticketData.ticket) {
          params.set('ticket', ticketData.ticket);
        }
      }
    } catch (e) {
      console.warn('Could not prefetch WS ticket, relying on cookie auth fallback:', e);
    } finally {
      ticketCleanup();
    }

    if (!isMountedRef.current || !isOpen) {
      console.log('Modal unmounted/closed while prefetching ticket. Aborting connection.');
      return;
    }

    const wsUrl = `${protocol}//${hostWithPort}/ws/live?${params.toString()}`;
    console.log(`Connecting to Live WebSocket (Q ${qIndex + 1}/${totalQuestions}, isRetry=${!!isRetry}, isResumed=${!!isResumed}, type=${sessionType}):`, wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;


    // Attach playback finished callback to playout manager for instant mic transition
    if (playoutManagerRef.current) {
      playoutManagerRef.current.onPlaybackFinished = () => {
        const isInteractionIdle = !interactionStatusRef.current || interactionStatusRef.current === 'IDLE';
        if (isServerTurnCompleteRef.current && isInteractionIdle && !isEvaluationFinalizedRef.current) {
          console.log('🔊 Audio playback finished in speakers (terminal turn). Instantly activating candidate microphone...');
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
          setIsThinking(false);
          isThinkingRef.current = false;
          clearAllTurnWatchdogs();
          lastAiSpeechEndedAtRef.current = Date.now();
          setIsRecording(true);
          isRecordingRef.current = true;
          hasSpokenInTurnRef.current = false;
          if (isFocusInjectedInCurrentTurnRef.current) {
            isFocusInjectedInCurrentTurnRef.current = false;
            useSelectionFocusStore.getState().clearFocus();
          }
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

        // Live tool execution notification from backend
        if (data.type === 'tool_executing') {
          console.log('🛠️ AI tool executing:', data.tools);
          setThinkingStage('processing');
          clearAllTurnWatchdogs();
          // Give generous breathing room for tool execution (15s before critical status)
          const t1 = setTimeout(() => {
            if (isThinkingRef.current) setThinkingStage('delayed');
          }, 8000);
          const t2 = setTimeout(() => {
            if (isThinkingRef.current) setThinkingStage('critical');
          }, 15000);
          turnWatchdogRef.current = [t1, t2];
          return;
        }

        // Upstream response delayed nudge (>5.5s)
        if (data.type === 'thinking_delay') {
          // If a tool was executed recently, don't rush into delayed stage
          setThinkingStage('delayed');
          return;
        }

        // Upstream reconnection events from backend Split-Socket resilience
        if (data.type === 'upstream_reconnecting') {
          console.log(`🔄 Upstream reconnecting (attempt ${data.attempt || 1}/${data.maxAttempts || 3})...`);
          setThinkingStage('delayed');
          return;
        }

        if (data.type === 'upstream_ready') {
          console.log('✅ Upstream reconnected and ready!');
          clearAllTurnWatchdogs();
          setThinkingStage('idle');
          setIsThinking(false);
          isThinkingRef.current = false;
          setIsRecording(true);
          isRecordingRef.current = true;
          return;
        }

        // Live Whiteboard sync from AI
        if (data.type === 'whiteboard_update') {
          const payload = data.payload;
          setWhiteboardState(payload);
          if (payload?.action !== 'clear') {
            setIsWhiteboardOpen(true);
          }
          // Whiteboard update received: AI is actively delivering data!
          clearAllTurnWatchdogs();
          setThinkingStage('processing');
          const t1 = setTimeout(() => {
            if (isThinkingRef.current) setThinkingStage('delayed');
          }, 8000);
          turnWatchdogRef.current = [t1];
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
          if (sessionType === 'tutor') {
            console.log('🛡️ Blocked evaluation_completed in tutor mode (zero grading invariant).');
            return;
          }
          const evalData: EvaluationResult = data.evaluation;
          // SOTA Guard: Suppress premature evaluation on Turn 0 if candidate hasn't spoken/submitted yet
          if (!hasSpokenInTurnRef.current && userPcmChunksRef.current.length === 0 && !isSubmitting) {
            console.warn('🛡️ Suppressed premature evaluation_completed on Turn 0 before candidate responded.');
            return;
          }
          finalizeEvaluation(evalData, targetQ.id, qIndex);
        } else if (data.error) {
          clearAllTurnWatchdogs();
          const errText = String(data.error);
          const isForbidden =
            data.errorCode === 'FORBIDDEN_MODEL_ACCESS' ||
            data.retryable === false ||
            errText.toLowerCase().includes('forbidden') ||
            errText.toLowerCase().includes('invalid or blocked virtual key');

          if (isForbidden) {
            isNonRetryableErrorRef.current = true;
            const currentModel = interviewConfig.liveModel || 'gemini-live-thinking-v3';
            const fallback = (data.suggestedFallbackModel as LiveModelChoice) || 'gemini-live-v3';
            setFallbackModelSuggestion({
              originalModel: currentModel,
              suggestedModel: fallback,
              message: `Модель «${currentModel}» недоступна в шлюзе. Переключитесь на «${fallback}» в один клик.`
            });
            setDialogueTurns((prev) => [
              ...prev,
              { role: 'system', text: `⚠️ Доступ к модели «${currentModel}» ограничен шлюзом. Предложено переключение на «${fallback}».` }
            ]);
            setIsRecording(false);
            isRecordingRef.current = false;
          } else {
            setDialogueTurns((prev) => [...prev, { role: 'system', text: `❌ Ошибка: ${data.error}` }]);
            setIsRecording(true);
            isRecordingRef.current = true;
          }

          setIsThinking(false);
          isThinkingRef.current = false;
          setThinkingStage('idle');
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
          setIsSubmitting(false);
        } else if (data.serverContent) {
          if (data.serverContent.interactionStatus) {
            interactionStatusRef.current = data.serverContent.interactionStatus;
          }

          // Barge-in interruption
          if (data.serverContent.interrupted) {
            const isTactile = isTactileInterruptedRef.current;
            const isUserLoudlySpeaking = isUserSpeaking && rmsDb > -26;
            const isPlaying = playoutManagerRef.current?.isPlaying() ?? false;

            // SOTA Protection: If candidate is not actively speaking loudly and audio is currently playing,
            // and this was NOT an explicit tactile button press, it's an echo-induced false interruption from Google Live. Suppress it!
            if (!isTactile && !isUserLoudlySpeaking && isPlaying) {
              console.warn('🛡️ Suppressed false server-side Barge-In interruption (acoustic echo). Continuing audio playout.');
              return;
            }

            isTactileInterruptedRef.current = false;
            interactionStatusRef.current = 'IDLE';
            playoutManagerRef.current?.handleInterruption();
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsThinking(false);
            isThinkingRef.current = false;
            setThinkingStage('idle');
            clearAllTurnWatchdogs();
            lastAiSpeechEndedAtRef.current = Date.now();
            setIsRecording(true);
            isRecordingRef.current = true;
            hasSpokenInTurnRef.current = false;
            setDialogueTurns((prev) => [...prev, { role: 'system', text: '⚡ Речь прервана кандидатом (Barge-in).' }]);
          }

          // AI Speech turn
          if (data.serverContent.modelTurn?.parts) {
            // SOTA Epoch Fencing: Drop any late in-flight model audio chunks arriving after tactile barge-in
            if (isTactileInterruptedRef.current) {
              console.log('🛡️ [BARGE_IN_EPOCH] Discarded late in-flight modelTurn chunk after tactile barge-in.');
              return;
            }

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
            setIsPauseHolding(false);
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            for (const part of data.serverContent.modelTurn.parts) {
              // SOTA 2026: Isolate reasoning thought parts from candidate audio playout
              if ((part as any).thought) {
                console.log('🧠 [THOUGHT_PART] Filtered reasoning thought token from audio playout in VoiceModal');
                continue;
              }

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
            isTactileInterruptedRef.current = false;
            const isInteractionIdle = !data.serverContent.interactionStatus || data.serverContent.interactionStatus === 'IDLE';

            if (isInteractionIdle) {
              interactionStatusRef.current = 'IDLE';
              isServerTurnCompleteRef.current = true;
              playoutManagerRef.current?.notifyTurnComplete();
              console.log('AI terminal turn completed on server. Waiting for AudioPlayoutManager queue to drain...');

              // Dual-Sided Handshake: If audio playout already finished or no audio was received, activate mic immediately
              if (!playoutManagerRef.current?.isPlaying() && !isEvaluationFinalizedRef.current) {
                console.log('🔊 Audio queue already drained on terminal turnComplete. Instantly activating candidate microphone...');
                setIsAiSpeaking(false);
                isAiSpeakingRef.current = false;
                setIsThinking(false);
                isThinkingRef.current = false;
                clearAllTurnWatchdogs();
                lastAiSpeechEndedAtRef.current = Date.now();
                setIsRecording(true);
                isRecordingRef.current = true;
                hasSpokenInTurnRef.current = false;
                if (isFocusInjectedInCurrentTurnRef.current) {
                  isFocusInjectedInCurrentTurnRef.current = false;
                  useSelectionFocusStore.getState().clearFocus();
                }
                setDialogueTurns((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.text.includes('Ваша очередь')) return prev;
                  return [
                    ...prev,
                    { role: 'system', text: '🎙️ Ваша очередь: говорите в микрофон своими словами.' }
                  ];
                });
              }
            } else {
              console.log(`⏳ Conversational filler completed, but interactionStatus=${data.serverContent.interactionStatus}. AI reasoning in progress...`);
              isServerTurnCompleteRef.current = false;
              setIsThinking(true);
              isThinkingRef.current = true;
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
      const targetQ = (questionsBatch && questionsBatch[activeBatchIndex]) || {
        id: activeQuestionId,
        topic: activeTopic,
        question: activeQuestionText,
        answer: activeReferenceAnswer
      };
      const isSessionActive = stage === 'active' && !isEvaluationFinalizedRef.current && !!targetQ.question;
      const isDeliberateAbort = ev.code === 1000 && ev.reason === 'client_abort';

      if (isSessionActive && !isDeliberateAbort && !isNonRetryableErrorRef.current) {
        if (resumeAttemptsRef.current < 5) {
          resumeAttemptsRef.current++;
          console.log(`🔄 Session dropped (code ${ev.code}). Auto-resuming attempt ${resumeAttemptsRef.current}/5 with state snapshot...`);

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

          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (isMountedRef.current && !isEvaluationFinalizedRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
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

      const { signal, cleanup } = createManagedAbortSignal();
      try {
        turnCountRef.current++;
        const res = await fetch('/api/interview/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
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
            strictness: interviewConfig.strictness || (localStorage.getItem('interview_strictness_level') as any) || 'standard',
            strategy: sessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
            deepDive: !!interviewConfig.deepDive,
            liveCoaching: !!interviewConfig.liveCoaching,
            voice: interviewConfig.voice,
            userGender: interviewConfig.userGender || 'female',
            activeCodeArtifact: getActiveArtifactPayload()
          })
        });

        if (!res.ok) throw new Error(`Turn API returned ${res.status}`);
        const data = await res.json();
        if (!isMountedRef.current) return;
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
   * Sends explicit text prompt turn to Live WebSocket or Manual Turn Engine (for prompt chips, typed questions, or earphone commute chat)
   */
  const sendTextMessage = async (text: string, displayText?: string) => {
    // 1. Tactile Barge-in: If AI is actively speaking, interrupt audio immediately
    if (isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false)) {
      playoutManagerRef.current?.handleInterruption();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
    }

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

    if (displayText) {
      setDialogueTurns((prev) => [...prev, { role: 'user', text: displayText }]);
    }

    // 2. Full-Duplex WebSocket Path
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      let promptToSend = text;
      const currentFocus = useSelectionFocusStore.getState().activeFocus;
      if (currentFocus) {
        if (currentFocus.zone === 'code') {
          const lineRange = currentFocus.startLine
            ? currentFocus.endLine && currentFocus.endLine !== currentFocus.startLine
              ? `строки ${currentFocus.startLine}-${currentFocus.endLine}`
              : `строка ${currentFocus.startLine}`
            : '';
          promptToSend = `[ФОКУС ВНИМАНИЯ КАНДИДАТА: фрагмент кода в открытой версии ${currentFocus.revisionTitle || `v${currentFocus.revisionIndex || ''}`}${lineRange ? ` (${lineRange})` : ''}]:\n\`\`\`${currentFocus.language || 'java'}\n${currentFocus.text}\n\`\`\`\n\nВопрос кандидата: ${text}`;
        } else if (currentFocus.zone === 'term') {
          promptToSend = `[ФОКУС ВНИМАНИЯ КАНДИДАТА: термин «${currentFocus.text}» в эталонном ответе]:\nВопрос кандидата: ${text}`;
        } else {
          promptToSend = `[ФОКУС ВНИМАНИЯ КАНДИДАТА: «${currentFocus.text}»]:\nВопрос кандидата: ${text}`;
        }
        useSelectionFocusStore.getState().clearFocus();
      }

      const turnFrame = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: promptToSend }]
            }
          ],
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(turnFrame));
      return;
    }

    // 3. Manual Mode REST Fallback (/api/interview/turn)
    const { signal, cleanup } = createManagedAbortSignal();
    try {
      const targetQ = questionsBatch?.[activeBatchIndex] || {
        id: activeQuestionId,
        topic: activeTopic,
        question: activeQuestionText,
        answer: activeReferenceAnswer
      };
      turnCountRef.current++;
      const res = await fetch('/api/interview/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          questionId: targetQ.id,
          topic: targetQ.topic,
          questionText: targetQ.question,
          referenceAnswer: targetQ.answer,
          userTranscript: text,
          history: dialogueTurnsRef.current.filter((t) => t.role !== 'system'),
          turnCount: turnCountRef.current,
          maxProbes: interviewConfig.maxProbes || 2,
          strictness: interviewConfig.strictness || (localStorage.getItem('interview_strictness_level') as any) || 'standard',
          strategy: sessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
          sessionType,
          deepDive: !!interviewConfig.deepDive,
          liveCoaching: !!interviewConfig.liveCoaching,
          voice: interviewConfig.voice,
          userGender: interviewConfig.userGender || 'female',
          activeCodeArtifact: getActiveArtifactPayload()
        })
      });

      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        clearAllTurnWatchdogs();
        setIsThinking(false);
        isThinkingRef.current = false;
        if (data.replyText) {
          setDialogueTurns((prev) => [...prev, { role: 'ai', text: data.replyText }]);
        }
        if (data.audioBase64 && playoutManagerRef.current) {
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
      } else {
        clearAllTurnWatchdogs();
        setIsThinking(false);
        isThinkingRef.current = false;
        setIsRecording(true);
        isRecordingRef.current = true;
      }
    } catch (manualErr) {
      console.error('Manual turn error in sendTextMessage:', manualErr);
      clearAllTurnWatchdogs();
      setIsThinking(false);
      isThinkingRef.current = false;
      setIsRecording(true);
      isRecordingRef.current = true;
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

    const isManual = sessionType !== 'tutor' && (interviewConfig.turnMode || 'manual') === 'manual';
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
    generationEpochRef.current += 1;
    isTactileInterruptedRef.current = false;
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

    // SOTA Priority: If Live WebSocket is open, send turnComplete frame immediately!
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      injectActiveWhiteboardGroundingFrame();
      if (!isFocusInjectedInCurrentTurnRef.current) {
        injectActiveFocusGroundingFrame();
      }
      const turnCompleteMsg = {
        clientContent: {
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(turnCompleteMsg));
      console.log('📤 Sent clientContent.turnComplete to Gemini Live');
      return;
    }

    // In Tutor mode, never fall back to REST interview turn
    if (sessionType === 'tutor') {
      console.warn('⚠️ WebSocket not open in Tutor mode during triggerEndTurn.');
      clearAllTurnWatchdogs();
      setIsThinking(false);
      isThinkingRef.current = false;
      setIsRecording(true);
      isRecordingRef.current = true;
      return;
    }

    const isManual = (interviewConfigRef.current.turnMode || 'manual') === 'manual';
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
      const base64Pcm = uint8ArrayToBase64(bytes);

      turnCountRef.current++;

      const { signal, cleanup } = createManagedAbortSignal();
      try {
        console.log(`📡 Sending candidate turn ${turnCountRef.current} to /api/interview/turn...`);
        const res = await fetch('/api/interview/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
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
            strictness: interviewConfig.strictness || (localStorage.getItem('interview_strictness_level') as any) || 'standard',
            strategy: interviewConfig.strategy,
            deepDive: !!interviewConfig.deepDive,
            liveCoaching: !!interviewConfig.liveCoaching,
            voice: interviewConfig.voice,
            userGender: interviewConfig.userGender || 'female',
            activeCodeArtifact: getActiveArtifactPayload()
          })
        });

        if (!res.ok) {
          throw new Error(`Turn API returned ${res.status}`);
        }

        const data = await res.json();
        if (!isMountedRef.current) return;
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

    const isManual = sessionType !== 'tutor' && (interviewConfigRef.current.turnMode || 'manual') === 'manual';
    if (isManual) {
      turnCountRef.current = 0;
      setIsConnected(true);

      const { signal, cleanup } = createManagedAbortSignal();
      try {
        console.log(`🎙️ Synthesizing greeting with Gemini TTS v3 via LiteLLM Proxy...`);
        const res = await fetch('/api/interview/greeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            topic: targetQ.topic,
            questionText: targetQ.question,
            voice: interviewConfig.voice,
            userGender: interviewConfig.userGender || 'female',
            strategy: interviewConfig.strategy,
            sessionType,
            tutorMode: '',
            initialUserMessage: customPromptOverride || ''
          })
        });

        if (!res.ok) throw new Error(`Greeting API failed with ${res.status}`);
        const data = await res.json();
        if (!isMountedRef.current) return;
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
   * SOTA 2026 Voice Hold State: Coffee Break / Technical Pause without evaluation
   */
  const toggleSessionPause = async () => {
    if (stage !== 'active') return;
    const nextState = !isSessionPaused;
    setIsSessionPaused(nextState);
    isSessionPausedRef.current = nextState;

    if (nextState) {
      // Pausing session:
      playoutManagerRef.current?.playHoldChime(true);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setIsPauseHolding(false);
      setIsUserSpeaking(false);
      setIsRecording(false);
      isRecordingRef.current = false;
      await playoutManagerRef.current?.suspend();

      // Protocol-Level Session Hold frame to backend
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'session_hold', paused: true }));
        } catch {}
      }

      setDialogueTurns((prev) => [
        ...prev,
        { role: 'system', text: '⏸️ Диалог временно приостановлен. Оценка не начисляется.' }
      ]);
    } else {
      // Resuming session:
      await playoutManagerRef.current?.resume();
      playoutManagerRef.current?.playHoldChime(false);
      setIsRecording(true);
      isRecordingRef.current = true;

      // Protocol-Level Session Resume frame to backend
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'session_hold', paused: false }));
        } catch {}
      }

      setDialogueTurns((prev) => [
        ...prev,
        { role: 'system', text: '▶️ Диалог возобновлен.' }
      ]);
    }
  };

  // Keyboard shortcuts: Spacebar toggle for Voice Hold & Escape for Barge-In
  useEffect(() => {
    if (!isOpen || stage !== 'active') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        void toggleSessionPause();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (isAiSpeakingRef.current || isThinkingRef.current || (playoutManagerRef.current?.isPlaying() ?? false)) {
          handleClientBargeIn();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, isSessionPaused]);

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

  /**
   * Switch to a specific question index within the active batch session (Tutor or Interview)
   */
  const handleSwitchQuestion = (targetIndex: number) => {
    if (!isBatchMode || !questionsBatch || targetIndex < 0 || targetIndex >= questionsBatch.length) {
      return;
    }
    if (targetIndex === activeBatchIndex) return;

    const targetQ = questionsBatch[targetIndex];
    setActiveBatchIndex(targetIndex);
    if (onIndexChange) onIndexChange(targetIndex);

    // If currently in lobby, simple instantaneous state update (0ms)
    if (stage === 'lobby') {
      return;
    }

    // If in active live speech mode, perform clean Hot Re-anchor
    teardownWsAndBuffersOnly();
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
      { role: 'system', text: `🔄 Переключение на вопрос #${targetQ.num || targetIndex + 1} (${targetIndex + 1} из ${totalQuestions})...` }
    ]);

    void acquireWakeLock();

    connectLiveWebSocket(targetIndex, {
      id: targetQ.id,
      topic: targetQ.topic,
      question: targetQ.question,
      answer: targetQ.answer
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

      // TECH-03 Guard: If modal was closed while browser prompt was active, release hardware tracks immediately
      if (!isMountedRef.current || !isOpen) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      mediaStreamRef.current = stream;

      const audioCtx =
        playoutManagerRef.current?.getContext() ||
        new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
      inputAudioCtxRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      await audioCtx.audioWorklet.addModule('/worklets/audio-capture-processor.js');

      if (!isMountedRef.current || !isOpen) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = sourceNode;
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor');
      workletNodeRef.current = workletNode;
      workletNode.port.postMessage({ type: 'RESET' });

      workletNode.port.onmessage = (event: MessageEvent) => {
        const { type, pcmBuffer, metrics } = event.data;
        if (type === 'AUDIO_FRAME') {
          const isAiCurrentlySpeaking =
            isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false);
          const isReverbCooldownActive =
            Date.now() - lastAiSpeechEndedAtRef.current < 450;
          const isSessionMutedOrPaused =
            isSessionPausedRef.current || !isRecordingRef.current;

          if (metrics && !isAiCurrentlySpeaking && !isReverbCooldownActive && !isSessionMutedOrPaused) {
            setRmsDb(metrics.rmsDb);

            // Dynamic VAD: respects adaptive noise floor from worklet or fallback -42dB
            const isSpeech = metrics.speechDetected || metrics.rmsDb > (metrics.noiseFloorDb ? metrics.noiseFloorDb + 7.5 : -42);

            if (!isThinkingRef.current) {
              if (isSpeech) {
                // SOTA Speech duration guard: 150ms accommodates short answers ("Да", "Нет", "Ок") while rejecting micro-clicks
                if (!speechStartTimeRef.current) {
                  speechStartTimeRef.current = Date.now();
                }
                const speechDuration = Date.now() - speechStartTimeRef.current;
                if (speechDuration >= 150) {
                  if (!hasSpokenInTurnRef.current) {
                    hasSpokenInTurnRef.current = true;
                    injectActiveWhiteboardGroundingFrame();
                    injectActiveFocusGroundingFrame();
                  }
                }
                setIsUserSpeaking(true);
                setIsPauseHolding(false);
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
                }
              } else {
                speechStartTimeRef.current = null;
                if (hasSpokenInTurnRef.current) {
                  setIsUserSpeaking(false);
                  const currentCfg = interviewConfigRef.current;
                  const turnMode = currentCfg.turnMode || (localStorage.getItem('interview_turn_mode') as any) || 'manual';
                  if (turnMode === 'auto') {
                    setIsPauseHolding(true);
                    if (!silenceTimerRef.current) {
                      const vadPauseMs = currentCfg.vadPauseMs ?? 1800;
                      silenceTimerRef.current = setTimeout(() => {
                        setIsPauseHolding(false);
                        silenceTimerRef.current = null;
                        if (isRecordingRef.current && !isAiSpeakingRef.current && !isThinkingRef.current && hasSpokenInTurnRef.current) {
                          console.log('🎙️ [AUTO-VAD] Silence threshold reached. Automatically committing candidate turn...');
                          void triggerEndTurn();
                        }
                      }, vadPauseMs);
                    }
                  }
                }
              }
            }
          } else if (isAiCurrentlySpeaking) {
            if (isUserSpeaking) setIsUserSpeaking(false);
          }

          if (isRecordingRef.current && !isAiCurrentlySpeaking && !isReverbCooldownActive && !isSessionPausedRef.current) {
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
          const isInteractionIdle = !interactionStatusRef.current || interactionStatusRef.current === 'IDLE';
          const shouldTransmit =
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            isRecordingRef.current &&
            !isAiCurrentlySpeaking &&
            !isThinkingRef.current &&
            !isReverbCooldownActive &&
            !isSessionPausedRef.current &&
            isInteractionIdle;

          if (shouldTransmit && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const base64Audio = uint8ArrayToBase64(new Uint8Array(pcmBuffer));

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
    } catch (e: any) {
      console.error('Error initializing microphone hardware:', e);
      if (isMountedRef.current) {
        showToast({
          type: 'warning',
          title: 'Микрофон недоступен',
          message: 'Браузер не предоставил доступ к микрофону. Проверьте разрешения или перейдите в письменный режим.'
        });
      }
    }
  };

  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      try {
        mediaStreamSourceRef.current.disconnect();
      } catch {}
      mediaStreamSourceRef.current = null;
    }
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.postMessage({ type: 'RESET' });
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

  const handleApplyFallbackModel = (targetModel: LiveModelChoice = 'gemini-live-v3') => {
    console.log(`🔄 Switching live model from ${interviewConfig.liveModel} to ${targetModel} via 1-Click Fallback`);
    setInterviewConfig({
      ...interviewConfig,
      liveModel: targetModel
    });
    try {
      localStorage.setItem('interview_live_model', targetModel);
    } catch {}
    setFallbackModelSuggestion(null);
    isNonRetryableErrorRef.current = false;
    resumeAttemptsRef.current = 0;
    showToast({
      type: 'info',
      title: 'Модель переключена',
      message: `Переключено на ${targetModel}. Запуск сессии...`
    });

    const targetQ = (questionsBatch && questionsBatch[activeBatchIndex]) || {
      id: activeQuestionId,
      topic: activeTopic,
      question: activeQuestionText,
      answer: activeReferenceAnswer
    };
    setTimeout(() => {
      if (isMountedRef.current) {
        void connectLiveWebSocket(activeBatchIndex, targetQ, false, false);
      }
    }, 100);
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

    // 2. If AI is currently speaking or thinking, clicking the mic allows the candidate to barge-in immediately
    if (isAiSpeakingRef.current || isThinkingRef.current || (playoutManagerRef.current?.isPlaying() ?? false)) {
      handleClientBargeIn();
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
    return uint8ArrayToBase64(bytes);
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
    // Zero Grading Invariant: Tutor never evaluates, scores, or switches to verdict
    if (sessionType === 'tutor') {
      console.log('🛡️ [Zero Grading Invariant] finalizeEvaluation suppressed in tutor mode');
      return;
    }
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
      const { signal: sttSignal, cleanup: sttCleanup } = createManagedAbortSignal();
      try {
        const pcmBase64 = encodePcmToInt16Base64();
        const sttRes = await fetch('/api/stt/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: sttSignal,
          body: JSON.stringify({ pcmBase64 })
        });
        if (sttRes.ok && isMountedRef.current) {
          const sttData = await sttRes.json();
          deepgramText = sttData.transcript || '';
          realWordCount = sttData.wordsCount || 0;
          wordTimestamps = sttData.words || [];
          if (deepgramText && isMountedRef.current) setDeepgramTranscript(deepgramText);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Deepgram STT failed (non-critical):', err);
        }
      } finally {
        sttCleanup();
        if (isMountedRef.current) {
          setIsTranscribing(false);
        }
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

      if (isMountedRef.current) {
        setEvaluation((prev) => (prev ? { ...prev, ...enrichedResult } : enrichedResult));
        setBatchResults((prev) => ({ ...prev, [evaluatedQuestionId]: enrichedResult }));
      }

      const currentTurns = dialogueTurnsRef.current;
      const fullDialogue = [
        ...currentTurns,
        ...(deepgramText ? [{ role: 'user' as const, text: `[Deepgram] ${deepgramText}` }] : [])
      ];

      // Save to SQLite
      if (evaluatedQuestionId) {
        const { signal: saveSignal, cleanup: saveCleanup } = createManagedAbortSignal();
        try {
          await fetch('/api/eval/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: saveSignal,
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
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            console.error('Error saving evaluation to DB:', err);
          }
        } finally {
          saveCleanup();
        }
      }
    }
  };

  const handleRequestVerdict = () => {
    // Zero Grading Invariant: Tutor never requests verdict
    if (sessionType === 'tutor') {
      console.log('🛡️ [Zero Grading Invariant] handleRequestVerdict suppressed in tutor mode');
      return;
    }
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
      fallbackTimeoutRef.current = null;
      if (isEvaluationFinalizedRef.current || !isMountedRef.current) return;
      console.warn('Live toolCall timeout (6.5s). Executing instant fallback evaluation...');
      const { signal: fallbackSignal, cleanup: fallbackCleanup } = createManagedAbortSignal();
      try {
        const res = await fetch('/api/eval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: fallbackSignal,
          body: JSON.stringify({
            questionId: activeQuestionId,
            topic: activeTopic,
            question: activeQuestionText,
            referenceAnswer: activeReferenceAnswer,
            userAnswer: transcriptRef.current || 'Устный ответ кандидата в Gemini Live'
          })
        });
        if (res.ok && isMountedRef.current) {
          const fallbackData = await res.json();
          if (isMountedRef.current) {
            finalizeEvaluation(fallbackData, activeQuestionId, activeBatchIndex);
          }
        } else if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      } catch (err) {
        console.error('Fallback eval error:', err);
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      } finally {
        fallbackCleanup();
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
    <StudioErrorBoundary
      fallbackTitle="Голосовой интерфейс восстанавливает сессию"
      fallbackDescription="Произошла непредвиденная ошибка в голосовом модуле. Вы можете закрыть окно и попробовать снова."
      onReset={onClose}
    >
      <div className="fixed inset-0 z-[9000] flex items-center justify-center p-1 sm:p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className={`bg-white rounded-3xl p-2.5 sm:p-6 border border-pastel-border shadow-2xl relative overflow-hidden flex flex-col my-auto transition-all duration-300 ${
          sessionType === 'tutor'
            ? 'max-w-5xl w-full h-[96dvh] sm:h-auto sm:max-h-[92vh]'
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
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => handleSwitchQuestion(idx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer focus:outline-none hover:opacity-90 active:scale-95 ${
                    isCurrent
                      ? 'flex-1 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet shadow-xs ring-2 ring-pastel-accentViolet/30'
                      : res
                      ? res.isPassed
                        ? 'w-5 bg-emerald-400 hover:bg-emerald-500'
                        : 'w-5 bg-rose-400 hover:bg-rose-500'
                      : 'w-4 bg-slate-200 hover:bg-slate-300'
                  }`}
                  title={`Перейти к вопросу #${q.num || idx + 1}: ${q.question.slice(0, 45)}...`}
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
              handleClientBargeIn();
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
            isSessionPaused={isSessionPaused}
            onToggleSessionPause={toggleSessionPause}
            onSwitchQuestion={handleSwitchQuestion}
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
                        onClick={() => void toggleSessionPause()}
                        className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>▶️ Продолжить диалог</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono font-normal">Space</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SOTA 2026 1-Click Fallback Recovery Banner */}
                {fallbackModelSuggestion && (
                  <div className="mt-2.5 mx-0.5 p-3.5 rounded-2xl bg-gradient-to-r from-rose-50/95 via-purple-50/95 to-amber-50/95 border border-rose-300/80 shadow-md shadow-rose-200/40 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">💡</span>
                      <div className="min-w-0">
                        <p className="font-bold text-rose-800">
                          Модель «{fallbackModelSuggestion.originalModel}» недоступна
                        </p>
                        <p className="text-slate-600 text-[11px] leading-snug">
                          Шлюз ограничил доступ к этой модели. Переключитесь на «{fallbackModelSuggestion.suggestedModel}» в один клик без потери темы.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyFallbackModel(fallbackModelSuggestion.suggestedModel)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-semibold text-xs shadow-sm shadow-rose-950/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      ⚡ Переключить на {fallbackModelSuggestion.suggestedModel}
                    </button>
                  </div>
                )}

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
                    <span>🔄 С чистого листа</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleSessionPause()}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-xl bg-amber-100/90 hover:bg-amber-200 border border-amber-300 text-amber-900 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Поставить диалог на паузу без оценки и без потери контекста (Space)"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-700" />
                    <span>⏸️ Пауза</span>
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

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-700 shadow-2xs">
                    {evaluation.score ?? 70}/100
                  </span>
                  {(evaluation.score ?? 70) < 100 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 shadow-2xs">
                      -{100 - (evaluation.score ?? 70)} б.
                    </span>
                  )}
                </div>
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

              {/* Explainable Rubric Scorecard (Criteria Ledger + Deductions + Upgrade Snippet) */}
              <RubricScorecard evaluation={evaluation} />

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
    </div>
    </StudioErrorBoundary>,
    document.body
  );
};
