import React, { useEffect, useRef, useState } from 'react';
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
  Check
} from 'lucide-react';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import {
  AcousticMetrics,
  AcousticTelemetryService,
} from '../services/AcousticTelemetryService';
import { triggerSuccessConfetti } from '../utils/confetti';
import { InterviewConfig, GeminiVoiceName } from '../types/interviewConfig';
import { getActiveConfig, saveActiveConfig } from '../services/profileStorage';
import { VoiceSettingsDrawer } from './VoiceSettingsDrawer';
import { Question } from '../store/useAppStore';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Single question mode (backward compatibility)
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  // Multi-question batch mode
  questionsBatch?: Question[];
  initialQuestionIndex?: number;
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
  onIndexChange,
  onBatchComplete,
  onEvaluationComplete,
}) => {
  const isBatchMode = Boolean(questionsBatch && questionsBatch.length > 0);
  const totalQuestions = isBatchMode && questionsBatch ? questionsBatch.length : 1;

  // Active Batch Index state
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(initialQuestionIndex);
  const [batchResults, setBatchResults] = useState<Record<string, EvaluationResult>>({});

  // Resolve current active question
  const currentQ: Question | null = isBatchMode && questionsBatch ? questionsBatch[activeBatchIndex] || questionsBatch[0] : null;
  const activeQuestionId = currentQ?.id || questionId || '';
  const activeTopic = currentQ?.topic || topic || 'Java & Spring Framework';
  const activeQuestionText = currentQ?.question || currentQuestionText || 'Расскажите о вашем опыте в backend-разработке.';
  const activeReferenceAnswer = currentQ?.answer || referenceAnswer || '';
  const activeQuestionNum = currentQ?.num ?? (activeBatchIndex + 1);

  // Modal Lifecycle Stages: 'lobby' -> 'active' -> 'transition' -> 'verdict' | 'grand_finale'
  const [stage, setStage] = useState<'lobby' | 'active' | 'transition' | 'verdict' | 'grand_finale'>('lobby');

  // Transition Countdown State
  const [countdown, setCountdown] = useState<number>(5);
  const [isTransitionPaused, setIsTransitionPaused] = useState<boolean>(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Interviewer Configuration & Settings Drawer
  const [interviewConfig, setInterviewConfig] = useState<InterviewConfig>(getActiveConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  // Refs for synchronous audio worklet synchronization
  const isRecordingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const lastAiSpeechEndedAtRef = useRef<number>(0);
  const userPcmChunksRef = useRef<Float32Array[]>([]);
  const transcriptRef = useRef<string>('');
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isEvaluationFinalizedRef = useRef(false);
  const dialogueTurnsRef = useRef<Array<{ role: 'ai' | 'user' | 'system'; text: string }>>([]);

  const handleConfigChange = (newConfig: InterviewConfig) => {
    setInterviewConfig(newConfig);
    saveActiveConfig(newConfig);
  };

  // Synchronize initialQuestionIndex when opened
  useEffect(() => {
    if (!isOpen) {
      teardownFullAudio();
      setStage('lobby');
      return;
    }

    setActiveBatchIndex(initialQuestionIndex);
    setBatchResults({});
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

    const isAutoAdvanceActive = interviewConfig.autoAdvance !== false && (interviewConfig.transitionDelay ?? 5) > 0;

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
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Question advance');
      } catch {}
      wsRef.current = null;
    }
    if (playoutManagerRef.current) {
      playoutManagerRef.current.clearQueue();
    }
    setIsConnected(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;
  };

  /**
   * Full teardown on modal close
   */
  const teardownFullAudio = () => {
    teardownWsAndBuffersOnly();
    stopMicrophone();
    if (playoutManagerRef.current) {
      playoutManagerRef.current.teardown();
      playoutManagerRef.current = null;
    }
  };

  /**
   * Connects to Live WebSocket Proxy with question-specific parameters
   */
  const connectLiveWebSocket = (qIndex: number, targetQ: { id: string; topic: string; question: string; answer: string }) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = window.location.port === '8090' ? '8091' : window.location.port || '8091';

    const params = new URLSearchParams({
      questionId: targetQ.id,
      topic: targetQ.topic,
      questionText: targetQ.question,
      referenceAnswer: targetQ.answer,
      voice: interviewConfig.voice,
      strategy: interviewConfig.strategy,
      maxProbes: String(interviewConfig.maxProbes),
      deepDive: String(!!interviewConfig.deepDive),
      liveCoaching: String(!!interviewConfig.liveCoaching),
      customAnchors: JSON.stringify(interviewConfig.customAnchors || []),
      customPrompt: interviewConfig.customPromptOverride || '',
      questionIndex: String(qIndex),
      totalQuestions: String(totalQuestions)
    });

    const wsUrl = `${protocol}//${host}:${port}/ws/live?${params.toString()}`;
    console.log(`Connecting to Live WebSocket (Q ${qIndex + 1}/${totalQuestions}):`, wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('✅ Live WebSocket connected to backend proxy');
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

        if (data.type === 'setupComplete') {
          const isSubsequent = qIndex > 0;
          setDialogueTurns((prev) => [
            ...prev,
            {
              role: 'system',
              text: isSubsequent
                ? `⚡ Вопрос ${qIndex + 1} из ${totalQuestions}: слушайте формулировку.`
                : `✨ Интервьюер готов (${interviewConfig.voice})! Слушайте вопрос.`
            }
          ]);
          // Warm up microphone hardware without transmitting yet
          void initMicrophoneHardware();
        } else if (data.type === 'evaluation_completed') {
          const evalData: EvaluationResult = data.evaluation;
          finalizeEvaluation(evalData, targetQ.id, qIndex);
        } else if (data.error) {
          setDialogueTurns((prev) => [...prev, { role: 'system', text: `❌ Ошибка: ${data.error}` }]);
        } else if (data.serverContent) {
          // Barge-in interruption
          if (data.serverContent.interrupted) {
            playoutManagerRef.current?.handleInterruption();
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            lastAiSpeechEndedAtRef.current = Date.now();
            setDialogueTurns((prev) => [...prev, { role: 'system', text: '⚡ Речь прервана кандидатом (Barge-in).' }]);
          }

          // AI Speech turn
          if (data.serverContent.modelTurn?.parts) {
            setIsAiSpeaking(true);
            isAiSpeakingRef.current = true;
            setIsRecording(false);
            isRecordingRef.current = false;

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
            console.log('AI turn completed. Scheduling candidate microphone activation...');
            lastAiSpeechEndedAtRef.current = Date.now();
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;

            // Allow 250ms for audio jitter buffer and room reverberation to settle before opening mic gate
            setTimeout(() => {
              if (!isEvaluationFinalizedRef.current) {
                setIsRecording(true);
                isRecordingRef.current = true;
                setDialogueTurns((prev) => [
                  ...prev,
                  { role: 'system', text: '🎙️ Ваша очередь: говорите в микрофон своими словами.' }
                ]);
              }
            }, 250);
          }
        }
      } catch (e) {
        console.error('Error handling Live WS message:', e);
      }
    };

    ws.onclose = (ev) => {
      console.log('Live WS closed:', ev.code, ev.reason);
      setIsConnected(false);
      setIsRecording(false);
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      isRecordingRef.current = false;
    };

    ws.onerror = (err) => {
      console.error('Live WS error:', err);
      setIsConnected(false);
    };
  };

  /**
   * Start Live Interview Session
   * Called on direct user click on "Начать собеседование" button
   */
  const startLiveInterview = async () => {
    setActiveBatchIndex(initialQuestionIndex);
    setBatchResults({});
    setStage('active');
    setEvaluation(null);
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;
    setIsRecording(false);
    isRecordingRef.current = false;
    setDialogueTurns([
      { role: 'system', text: '🎙️ Подключение к голосовому каналу... ИИ-интервьюер сейчас поздоровается и задаст вопрос.' }
    ]);
    userPcmChunksRef.current = [];
    transcriptRef.current = '';
    setIsSubmitting(false);

    // 1. Initialize & Resume AudioPlayoutManager directly within user gesture!
    const playoutManager = new AudioPlayoutManager();
    playoutManagerRef.current = playoutManager;
    await playoutManager.resume();

    // 2. Connect
    const targetQ = {
      id: activeQuestionId,
      topic: activeTopic,
      question: activeQuestionText,
      answer: activeReferenceAnswer
    };
    connectLiveWebSocket(initialQuestionIndex, targetQ);
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

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000, latencyHint: 'interactive' });
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
          }

          const isAiCurrentlySpeaking =
            isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false);
          const isReverbCooldownActive =
            Date.now() - lastAiSpeechEndedAtRef.current < 250;

          if (isRecordingRef.current && !isAiCurrentlySpeaking && !isReverbCooldownActive) {
            const int16 = new Int16Array(pcmBuffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] < 0 ? int16[i] / 32768 : int16[i] / 32767;
            }
            userPcmChunksRef.current.push(float32);
          }

          // Soft-Gating: NEVER transmit mic audio while AI is speaking (prevents speaker echo from triggering false Barge-In)
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
    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }
    setIsRecording(false);
    isRecordingRef.current = false;
    setRmsDb(-60);
  };

  const toggleMic = async () => {
    if (playoutManagerRef.current) {
      await playoutManagerRef.current.resume();
    }

    // If AI is currently speaking, clicking the mic allows the candidate to barge-in immediately
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
    wordTimestamps?: Array<{ word: string; start: number; end: number }>
  ): AcousticMetrics => {
    const totalSamples = userPcmChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedPcm = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of userPcmChunksRef.current) {
      combinedPcm.set(chunk, offset);
      offset += chunk.length;
    }
    const syntheticTranscript = realWordCount && realWordCount > 0
      ? Array(realWordCount).fill('слово').join(' ')
      : (transcriptRef.current || 'Ответ кандидата в голосовом режиме');

    return AcousticTelemetryService.analyzeAcoustics(
      combinedPcm,
      16000,
      syntheticTranscript,
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
    const finalResult: EvaluationResult = {
      ...evalData,
      id: evalData.id || evaluatedQuestionId,
      questionId: evaluatedQuestionId,
      audioMetrics: acousticsLocal
    };
    setEvaluation(finalResult);

    // Accumulate in batch results
    const updatedBatch = { ...batchResults, [evaluatedQuestionId]: finalResult };
    setBatchResults(updatedBatch);

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
      if (onBatchComplete) onBatchComplete(updatedBatch);
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

      const acousticsFinal = (wordTimestamps.length > 0 || realWordCount > 0)
        ? computeLocalAcoustics(realWordCount, wordTimestamps)
        : acousticsLocal;

      const enrichedResult: EvaluationResult = {
        ...finalResult,
        audioMetrics: acousticsFinal,
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
      const finishMsg = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Я закончила ответ. Не нужно ничего озвучивать, просто тихо вызови функцию submit_interview_evaluation с итоговой оценкой.'
                }
              ]
            }
          ],
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(finishMsg));
    }

    // Safety fallback watchdog (25s)
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(async () => {
      if (isEvaluationFinalizedRef.current) return;
      console.warn('Live toolCall timeout (25s). Executing instant fallback evaluation...');
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
    }, 25000);
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

  // Calculate Grand Finale stats
  const evaluatedKeys = Object.keys(batchResults);
  const totalEvaluated = evaluatedKeys.length;
  const avgScore = totalEvaluated > 0
    ? Math.round(evaluatedKeys.reduce((acc, k) => acc + (batchResults[k]?.score ?? 0), 0) / totalEvaluated)
    : 0;
  const passedCount = evaluatedKeys.filter((k) => batchResults[k]?.isPassed).length;

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-3 md:p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-3xl p-5 md:p-7 max-w-xl w-full border border-pastel-border shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Soft Ambient Glows */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

        {/* Header with Batch Progress Tracker */}
        <div className="flex items-center justify-between pb-3.5 border-b border-pastel-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-pastel-text text-base">Gemini Live Interviewer</h3>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-pastel-muted">
                {isBatchMode && (
                  <span className="font-bold text-pastel-accentViolet flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Вопрос {activeBatchIndex + 1} из {totalQuestions}
                  </span>
                )}
                <span>
                  {stage === 'lobby'
                    ? isBatchMode ? 'Непрерывное собеседование по порции' : 'Персональное собеседование'
                    : stage === 'active'
                    ? 'Голосовой диалог в реальном времени'
                    : stage === 'transition'
                    ? 'Автопереход к следующему вопросу'
                    : stage === 'grand_finale'
                    ? '🎉 Итоги всего собеседования'
                    : 'Результаты ответа'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-pastel-bg text-pastel-muted hover:text-pastel-text flex items-center justify-center hover:bg-pastel-rose/40 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Batch Progress Stepper Bar */}
        {isBatchMode && stage !== 'grand_finale' && (
          <div className="mt-3 flex items-center gap-1.5 shrink-0 px-1">
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

        {/* Question Context Banner */}
        {stage !== 'grand_finale' && activeQuestionText && (
          <div className="mt-3.5 p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/70 text-xs shadow-2xs shrink-0">
            <span className="font-bold text-pastel-accentViolet block mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
              {isBatchMode ? `Вопрос #${activeQuestionNum} (${activeBatchIndex + 1}/${totalQuestions}):` : 'Вопрос темы:'}
            </span>
            <p className="text-pastel-text leading-relaxed font-bold">{activeQuestionText}</p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 1: LOBBY                                                            */}
        {/* ========================================================================= */}
        {stage === 'lobby' && (
          <div className="my-6 flex flex-col items-center justify-center text-center space-y-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet p-1 shadow-xl flex items-center justify-center animate-pulse">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
                  {interviewConfig.strategy === 'socratic_tutoring' ? '🌸' : '👩‍💻'}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white shadow-xs">
                <Mic className="w-4 h-4" />
              </div>
            </div>

            <div className="max-w-md space-y-1.5 px-2">
              <h4 className="font-bold text-pastel-text text-base">
                {isBatchMode
                  ? `Готовы пройти серию из ${totalQuestions} вопросов?`
                  : interviewConfig.strategy === 'socratic_tutoring' 
                  ? 'Сократический ИИ-ментор готов' 
                  : 'ИИ-интервьюер готов к диалогу'}
              </h4>
              <p className="text-xs text-pastel-muted leading-relaxed">
                {isBatchMode
                  ? 'Режим "Без рук" (Hands-Free): ИИ последовательно задаст каждый вопрос темы, оценит ваши ответы и сам переведет к следующему.'
                  : 'Интервьюер поздоровается голосом и зачитает вопрос. Вы можете отвечать своими словами и уточнять детали.'}
              </p>

              {/* Active Config Pill & Quick Toggles */}
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pastel-card border border-pastel-border text-[11px] font-semibold text-pastel-text shadow-2xs">
                  {interviewConfig.strategy === 'socratic_tutoring' ? (
                    <GraduationCap className="w-3.5 h-3.5 text-pastel-accentRose" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-pastel-accentViolet" />
                  )}
                  <span>
                    {interviewConfig.strategy === 'socratic_tutoring' ? 'Сократ' : 'Адаптивный'} • {interviewConfig.voice}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => handleConfigChange({ ...interviewConfig, deepDive: !interviewConfig.deepDive })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                    interviewConfig.deepDive
                      ? 'bg-gradient-to-r from-pastel-accentRose/20 to-pastel-accentViolet/20 border-pastel-accentViolet text-pastel-accentViolet shadow-2xs'
                      : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                  title="Кликните для переключения глубокого зондирования"
                >
                  <Microscope className="w-3.5 h-3.5" />
                  <span>🔬 Deep-Dive</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfigChange({ ...interviewConfig, liveCoaching: !interviewConfig.liveCoaching })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                    interviewConfig.liveCoaching
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs'
                      : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                  title="Кликните для переключения обучения на лету"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>🎓 Обучение</span>
                </button>
              </div>
            </div>

            {/* Action Buttons: START + SETTINGS */}
            <div className="w-full max-w-sm space-y-2.5">
              <button
                type="button"
                onClick={startLiveInterview}
                disabled={!systemHealth.isAiReady}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-pink-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {!systemHealth.isAiReady ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Инициализация AI Шлюза...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>{isBatchMode ? `Начать собеседование (${totalQuestions} вопр.)` : 'Начать собеседование'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-pastel-card border border-pastel-border text-pastel-text text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Settings2 className="w-4 h-4 text-pastel-accentViolet" />
                <span>Настроить стратегию, голос и профили</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: ACTIVE LIVE SESSION                                              */}
        {/* ========================================================================= */}
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

            <div className="my-3.5 flex flex-col items-center justify-center shrink-0">
              <div className="relative flex items-center justify-center w-28 h-28">
                <motion.div
                  animate={{
                    scale: isRecording ? [1, 1.25, 1] : isAiSpeaking ? [1, 1.15, 1] : 1,
                    opacity: isRecording ? [0.3, 0.8, 0.3] : isAiSpeaking ? [0.4, 0.7, 0.4] : 0.15,
                  }}
                  transition={{ repeat: Infinity, duration: isRecording ? 1.2 : 1.8 }}
                  className={`absolute inset-0 rounded-full ${
                    isAiSpeaking
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                      : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet'
                  }`}
                />

                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={isSubmitting}
                  className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition transform ${
                    isRecording
                      ? 'bg-gradient-to-tr from-rose-500 to-pink-600 scale-105 shadow-rose-200'
                      : 'bg-gradient-to-tr from-slate-400 to-slate-500 hover:scale-105'
                  }`}
                >
                  {isRecording ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {isAiSpeaking ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-200 animate-pulse">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>ИИ говорит вслух...</span>
                  </span>
                ) : isRecording ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>Микрофон слушает вас ({Math.round(rmsDb)} dB)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-pastel-card text-pastel-muted text-xs border border-pastel-border">
                    Микрофон на паузе (нажмите на кружок)
                  </span>
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
                    <span className="shrink-0">
                      {turn.role === 'ai' ? '🤖' : turn.role === 'user' ? '👤' : 'ℹ️'}
                    </span>
                    <span>{turn.text}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-pastel-border/60 flex items-center gap-3 shrink-0">
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

        {/* ========================================================================= */}
        {/* STAGE 2.5: INTER-QUESTION TRANSITION (Supports Auto-Timer & Manual Mode)  */}
        {/* ========================================================================= */}
        {stage === 'transition' && evaluation && (() => {
          const isAutoAdvance = interviewConfig.autoAdvance !== false && (interviewConfig.transitionDelay ?? 5) > 0;
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
          <div className="my-2 space-y-4 overflow-y-auto max-h-[65vh] pr-1">
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                evaluation.isPassed
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg ${
                    evaluation.isPassed ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                >
                  {evaluation.score ?? 70}%
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    {evaluation.isPassed ? '🎉 Собеседование успешно пройдено!' : 'Требуется дополнительное повторение'}
                  </h4>
                  <p className="text-xs opacity-80">
                    Стратегия: {interviewConfig.strategy === 'socratic_tutoring' ? 'Сократический менторинг' : 'Адаптивное зондирование'}
                  </p>
                </div>
              </div>
            </div>

            {/* Vocal Coaching & Acoustic Profile */}
            {evaluation.audioMetrics && (() => {
              const humanProfile = AcousticTelemetryService.getHumanizedProfile(evaluation.audioMetrics);
              return (
                <div className="p-4 rounded-3xl bg-gradient-to-br from-pastel-rose/40 via-white to-pastel-lavender/40 border border-pastel-border/80 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-2xs">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-pastel-text">Голосовой коучинг и манера речи</h4>
                        <p className="text-[10px] text-pastel-muted">Анализ интонаций, темпа и уверенности ответа</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 border border-pastel-border text-pastel-accentViolet shadow-2xs">
                      ✨ AI Voice Studio
                    </span>
                  </div>

                  {evaluation.audioMetrics.energyVector30 && evaluation.audioMetrics.energyVector30.length > 0 && (
                    <div className="p-2.5 bg-white/85 rounded-2xl border border-pastel-border/60 flex items-end justify-between h-11 gap-1 shadow-2xs">
                      {evaluation.audioMetrics.energyVector30.map((val, idx) => (
                        <div
                          key={idx}
                          style={{ height: `${Math.max(12, val * 100)}%` }}
                          className={`w-full rounded-full transition-all duration-300 ${
                            val > 0.65
                              ? 'bg-gradient-to-t from-pastel-accentRose to-pink-400'
                              : val > 0.35
                              ? 'bg-gradient-to-t from-pastel-accentViolet to-indigo-300'
                              : 'bg-pastel-border/80'
                          }`}
                          title={`Энергия голоса: ${(val * 100).toFixed(0)}%`}
                        />
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs">{humanProfile.volume.iconEmoji}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.volume.badgeStyle}`}>
                            {humanProfile.volume.badge}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-pastel-text block">{humanProfile.volume.title}</span>
                        <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">{humanProfile.volume.description}</p>
                      </div>
                      <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                        Уровень: {humanProfile.volume.techValue}
                      </span>
                    </div>

                    <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs">{humanProfile.pace.iconEmoji}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.pace.badgeStyle}`}>
                            {humanProfile.pace.badge}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-pastel-text block">{humanProfile.pace.title}</span>
                        <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">{humanProfile.pace.description}</p>
                      </div>
                      <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                        Скорость: {humanProfile.pace.techValue}
                      </span>
                    </div>

                    <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs">{humanProfile.structure.iconEmoji}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.structure.badgeStyle}`}>
                            {humanProfile.structure.badge}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-pastel-text block">{humanProfile.structure.title}</span>
                        <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">{humanProfile.structure.description}</p>
                      </div>
                      <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                        Структура: {humanProfile.structure.techValue}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-white/95 border border-pastel-rose/80 text-[11px] text-pastel-text leading-relaxed flex items-center gap-2 shadow-2xs">
                    <span className="text-sm shrink-0">🌸</span>
                    <p className="font-medium text-pastel-text/90">{humanProfile.mentorPraise}</p>
                  </div>
                </div>
              );
            })()}

            {evaluation.positivePoints && evaluation.positivePoints.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 text-xs">
                <span className="font-bold text-emerald-700 flex items-center gap-1.5 mb-2">
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
                <span className="font-bold text-rose-700 flex items-center gap-1.5 mb-2">
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

            <div className="pt-3 border-t border-pastel-border/60 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ответить заново</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-6 rounded-2xl border border-pastel-border text-pastel-text text-xs font-semibold hover:bg-pastel-rose transition cursor-pointer"
              >
                Закрыть окно
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: GRAND FINALE (Cumulative Multi-Question Summary)                 */}
        {/* ========================================================================= */}
        {stage === 'grand_finale' && (
          <div className="my-2 space-y-4 overflow-y-auto max-h-[65vh] pr-1">
            {/* Grand Finale Hero Banner */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-pastel-accentRose/20 via-white to-pastel-accentViolet/20 border border-pastel-border shadow-md text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white text-3xl shadow-md mx-auto">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-black text-lg text-pastel-text">
                  🎉 Собеседование успешно завершено!
                </h4>
                <p className="text-xs text-pastel-muted mt-0.5">
                  Пройдено вопросов: {totalEvaluated} из {totalQuestions} • Тема: {activeTopic}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border shadow-2xs">
                  <span className="text-[10px] text-pastel-muted font-bold block">Средний балл</span>
                  <span className="text-xl font-black text-pastel-accentViolet">{avgScore}%</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border shadow-2xs">
                  <span className="text-[10px] text-pastel-muted font-bold block">Зачтено тем</span>
                  <span className="text-xl font-black text-emerald-600">{passedCount}/{totalEvaluated}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white/90 border border-pastel-border shadow-2xs">
                  <span className="text-[10px] text-pastel-muted font-bold block">Готовность к офферу</span>
                  <span className="text-xl font-black text-pastel-accentRose">
                    {avgScore >= 80 ? '🔥 Высокая' : avgScore >= 65 ? '👍 Средняя' : '📖 Требует базы'}
                  </span>
                </div>
              </div>
            </div>

            {/* List of Evaluated Questions with Accordions */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-pastel-text px-1">Детализация по вопросам темы:</h5>
              {questionsBatch?.map((q, idx) => {
                const res = batchResults[q.id];
                const isExpanded = expandedSummaryIds.has(q.id);
                return (
                  <div
                    key={q.id || idx}
                    className="rounded-2xl border border-pastel-border bg-white shadow-2xs overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSummaryExpand(q.id)}
                      className="w-full flex items-center justify-between p-3.5 text-left hover:bg-pastel-card/60 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 flex-1 pr-2">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                            res?.isPassed
                              ? 'bg-emerald-100 text-emerald-800'
                              : res
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {res?.score !== undefined ? `${res.score}%` : `#${q.num}`}
                        </div>
                        <div className="min-w-0">
                          <h6 className="font-bold text-xs text-pastel-text truncate">
                            Вопрос #{q.num}: {q.question}
                          </h6>
                          <p className="text-[10px] text-pastel-muted truncate">
                            {res ? (res.spokenFeedback || res.feedback) : 'Не оценивался'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {res?.isPassed ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Зачтено
                          </span>
                        ) : res ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Повторить
                          </span>
                        ) : null}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                      </div>
                    </button>

                    {isExpanded && res && (
                      <div className="p-3.5 pt-0 border-t border-pastel-border/50 bg-pastel-card/30 space-y-2 text-xs">
                        {res.positivePoints && res.positivePoints.length > 0 && (
                          <div className="text-emerald-900 text-[11px]">
                            <span className="font-bold text-emerald-700 block mb-1">Раскрыто:</span>
                            <ul className="list-disc list-inside space-y-0.5">
                              {res.positivePoints.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {res.missingPoints && res.missingPoints.length > 0 && (
                          <div className="text-rose-900 text-[11px]">
                            <span className="font-bold text-rose-700 block mb-1">Зоны роста:</span>
                            <ul className="list-disc list-inside space-y-0.5">
                              {res.missingPoints.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Final Actions */}
            <div className="pt-3 border-t border-pastel-border/60 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="py-3 px-5 rounded-2xl bg-white border border-pastel-border text-pastel-text text-xs font-semibold hover:bg-pastel-card transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Пройти заново</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Завершить и сохранить прогресс</span>
              </button>
            </div>
          </div>
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
    </div>,
    document.body
  );
};
