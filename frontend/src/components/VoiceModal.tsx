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
  Loader2,
  Settings2,
  GraduationCap,
  MessageSquare,
  ChevronDown,
  ChevronUp
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

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  onEvaluationComplete?: (result: EvaluationResult) => void;
}

export interface EvaluationResult {
  id?: string;
  score?: number;
  isPassed?: boolean;
  positivePoints?: string[];
  missingPoints?: string[];
  feedback?: string;
  spokenFeedback?: string;
  audioMetrics?: AcousticMetrics;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  questionId,
  topic = 'Java Core & Spring',
  currentQuestionText = 'Расскажите о вашем опыте в backend-разработке.',
  referenceAnswer = '',
  onEvaluationComplete,
}) => {
  // Modal Lifecycle Stages: 'lobby' (1 big button) -> 'active' (live session) -> 'verdict' (retry/close)
  const [stage, setStage] = useState<'lobby' | 'active' | 'verdict'>('lobby');

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

  // Refs for synchronous audio worklet synchronization
  const isRecordingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const userPcmChunksRef = useRef<Float32Array[]>([]);
  const transcriptRef = useRef<string>('');
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isEvaluationFinalizedRef = useRef(false);
  const dialogueTurnsRef = useRef<Array<{ role: 'ai' | 'user' | 'system'; text: string }>>([]);

  const handleConfigChange = (newConfig: InterviewConfig) => {
    setInterviewConfig(newConfig);
    saveActiveConfig(newConfig);
  };

  useEffect(() => {
    if (!isOpen) {
      teardownSession();
      setStage('lobby');
      return;
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
      teardownSession();
    };
  }, [isOpen, questionId, currentQuestionText]);

  // Keep dialogueTurnsRef in sync with state (needed in async finalizeEvaluation)
  useEffect(() => {
    dialogueTurnsRef.current = dialogueTurns;
  }, [dialogueTurns]);

  const teardownSession = () => {
    isEvaluationFinalizedRef.current = false;
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    stopMicrophone();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (playoutManagerRef.current) {
      playoutManagerRef.current.clearQueue();
      playoutManagerRef.current.teardown();
      playoutManagerRef.current = null;
    }
    setIsConnected(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    isRecordingRef.current = false;
  };

  /**
   * Start Live Interview Session
   * Called on direct user click on "Начать собеседование" button
   */
  const startLiveInterview = async () => {
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

    // 2. Connect to Backend Live WebSocket Proxy with active configuration
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = window.location.port === '8090' ? '8091' : window.location.port || '8091';
    
    const params = new URLSearchParams({
      questionId: questionId || '',
      topic,
      questionText: currentQuestionText || '',
      referenceAnswer: referenceAnswer || '',
      voice: interviewConfig.voice,
      strategy: interviewConfig.strategy,
      maxProbes: String(interviewConfig.maxProbes),
      customAnchors: JSON.stringify(interviewConfig.customAnchors || []),
      customPrompt: interviewConfig.customPromptOverride || ''
    });

    const wsUrl = `${protocol}//${host}:${port}/ws/live?${params.toString()}`;
    console.log('Connecting to Live WebSocket:', wsUrl);
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
          setDialogueTurns((prev) => [
            ...prev,
            { role: 'system', text: `✨ Интервьюер готов (${interviewConfig.voice})! Слушайте вопрос темы.` }
          ]);
          // Warm up microphone hardware without transmitting yet
          void initMicrophoneHardware();
        } else if (data.type === 'evaluation_completed') {
          const evalData: EvaluationResult = data.evaluation;
          finalizeEvaluation(evalData);
        } else if (data.error) {
          setDialogueTurns((prev) => [...prev, { role: 'system', text: `❌ Ошибка: ${data.error}` }]);
        } else if (data.serverContent) {
          // Barge-in interruption
          if (data.serverContent.interrupted) {
            playoutManagerRef.current?.handleInterruption();
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setDialogueTurns((prev) => [...prev, { role: 'system', text: '⚡ Речь прервана кандидатом (Barge-in).' }]);
          }

          // AI Speech turn
          if (data.serverContent.modelTurn?.parts) {
            setIsAiSpeaking(true);
            isAiSpeakingRef.current = true;
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
            console.log('AI Greeting turn completed. Activating candidate microphone...');
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsRecording(true);
            isRecordingRef.current = true;
            setDialogueTurns((prev) => [
              ...prev,
              { role: 'system', text: '🎙️ Ваша очередь: говорите в микрофон своими словами.' }
            ]);
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

  const initMicrophoneHardware = async () => {
    try {
      if (playoutManagerRef.current) {
        await playoutManagerRef.current.resume();
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

      // Load static Worklet
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

          // Accumulate for local acoustic metrics calculation
          const int16 = new Int16Array(pcmBuffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] < 0 ? int16[i] / 32768 : int16[i] / 32767;
          }
          userPcmChunksRef.current.push(float32);

          // Transmit full-duplex to Gemini Live whenever candidate recording is active
          const shouldTransmit =
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            isRecordingRef.current;

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

      // Keep graph alive in Safari with silent GainNode anchor
      const gainAnchor = audioCtx.createGain();
      gainAnchor.gain.value = 0.0;
      gainAnchorRef.current = gainAnchor;

      sourceNode.connect(workletNode);
      workletNode.connect(gainAnchor);
      gainAnchor.connect(audioCtx.destination);
    } catch (err: any) {
      console.warn('Microphone hardware init note:', err?.message || err);
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

  /**
   * Encode Float32 PCM chunks to Int16 PCM Buffer for Deepgram upload
   */
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
    // Convert Int16Array to base64
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const computeLocalAcoustics = (realWordCount?: number): AcousticMetrics => {
    const totalSamples = userPcmChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedPcm = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of userPcmChunksRef.current) {
      combinedPcm.set(chunk, offset);
      offset += chunk.length;
    }
    // Build a synthetic transcript of the right word-count length for WPM calculation
    const syntheticTranscript = realWordCount && realWordCount > 0
      ? Array(realWordCount).fill('слово').join(' ')
      : (transcriptRef.current || 'Ответ кандидата в голосовом режиме');

    return AcousticTelemetryService.analyzeAcoustics(combinedPcm, 16000, syntheticTranscript);
  };

  const finalizeEvaluation = async (evalData: EvaluationResult) => {
    if (isEvaluationFinalizedRef.current) return;
    isEvaluationFinalizedRef.current = true;

    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }

    stopMicrophone();
    playoutManagerRef.current?.clearQueue();

    // Show verdict card immediately with local acoustics
    const acousticsLocal = computeLocalAcoustics();
    const finalResult = { ...evalData, audioMetrics: acousticsLocal };
    setEvaluation(finalResult);
    setStage('verdict');
    setIsSubmitting(false);
    if ((finalResult.score ?? 0) >= 80) triggerSuccessConfetti();

    // ---- Deepgram STT in background ----
    // Only attempt if there's recorded audio
    if (userPcmChunksRef.current.length > 0) {
      setIsTranscribing(true);
      let deepgramText = '';
      let realWordCount = 0;
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
          if (deepgramText) setDeepgramTranscript(deepgramText);
        }
      } catch (err) {
        console.warn('Deepgram STT failed (non-critical):', err);
      } finally {
        setIsTranscribing(false);
      }

      // Recompute acoustics with real word count if we got one
      const acousticsFinal = realWordCount > 0
        ? computeLocalAcoustics(realWordCount)
        : acousticsLocal;

      if (realWordCount > 0) {
        setEvaluation(prev => prev ? { ...prev, audioMetrics: acousticsFinal } : prev);
      }

      // Build full dialogue transcript JSON for DB storage
      const currentTurns = dialogueTurnsRef.current;
      const fullDialogue = [
        ...currentTurns,
        ...(deepgramText ? [{ role: 'user' as const, text: `[Deepgram] ${deepgramText}` }] : [])
      ];
      const dialogueJson = JSON.stringify(fullDialogue);

      // Persist to backend /api/eval/save
      if (questionId) {
        try {
          await fetch('/api/eval/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId,
              topic,
              mode: 'voice',
              score: finalResult.score,
              isPassed: finalResult.isPassed,
              positivePoints: finalResult.positivePoints,
              missingPoints: finalResult.missingPoints,
              feedback: finalResult.feedback,
              userAnswer: deepgramText || 'Устный ответ через Gemini Live',
              transcript: dialogueJson,
              audioMetrics: acousticsFinal
            })
          });
        } catch (err) {
          console.error('Error saving evaluation to DB:', err);
        }
      }
    } else if (questionId) {
      // No audio recorded — still save with local data
      try {
        await fetch('/api/eval/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId, topic, mode: 'voice',
            score: finalResult.score, isPassed: finalResult.isPassed,
            positivePoints: finalResult.positivePoints,
            missingPoints: finalResult.missingPoints,
            feedback: finalResult.feedback,
            userAnswer: 'Устный ответ через Gemini Live',
            transcript: transcriptRef.current,
            audioMetrics: acousticsLocal
          })
        });
      } catch (err) {
        console.error('Error saving evaluation to DB:', err);
      }
    }

    if (onEvaluationComplete) onEvaluationComplete(finalResult);
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
                  text: 'Я закончила свой ответ. Пожалуйста, оцени мой ответ, дай краткий устный фидбек и вызови функцию submit_interview_evaluation.'
                }
              ]
            }
          ],
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(finishMsg));
    }

    // Safety fallback watchdog (25s) for extensive 3-minute multimodal answers
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(async () => {
      if (isEvaluationFinalizedRef.current) return;
      console.warn('Live toolCall timeout (25s). Executing instant fallback evaluation...');
      try {
        const res = await fetch('/api/eval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId,
            topic,
            question: currentQuestionText,
            referenceAnswer,
            userAnswer: transcriptRef.current || 'Устный ответ кандидата в Gemini Live'
          })
        });
        if (res.ok) {
          const fallbackData = await res.json();
          finalizeEvaluation(fallbackData);
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
    teardownSession();
    await startLiveInterview();
  };

  if (!isOpen || typeof document === 'undefined') return null;

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

        {/* Header */}
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
              <p className="text-[11px] text-pastel-muted">
                {stage === 'lobby'
                  ? 'Персональное голосовое собеседование с ИИ-ментором'
                  : stage === 'active'
                  ? 'Полнодуплексный голосовой диалог в реальном времени'
                  : 'Результаты и анализ устного ответа'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-pastel-bg text-pastel-muted hover:text-pastel-text flex items-center justify-center hover:bg-pastel-rose/40 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question Context Banner */}
        {currentQuestionText && (
          <div className="mt-3.5 p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/70 text-xs shadow-2xs shrink-0">
            <span className="font-bold text-pastel-accentViolet block mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
              Вопрос темы:
            </span>
            <p className="text-pastel-text leading-relaxed font-bold">{currentQuestionText}</p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 1: LOBBY (Prominent Start Screen + Settings Trigger)                */}
        {/* ========================================================================= */}
        {stage === 'lobby' && (
          <div className="my-6 flex flex-col items-center justify-center text-center space-y-5">
            {/* Friendly Mentor Avatar with Glow */}
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
                {interviewConfig.strategy === 'socratic_tutoring' 
                  ? 'Сократический ИИ-ментор готов' 
                  : 'ИИ-интервьюер готов к диалогу'}
              </h4>
              <p className="text-xs text-pastel-muted leading-relaxed">
                Интервьюер поздоровается голосом и зачитает вопрос. Вы можете отвечать, просить повторить вопрос или уточнить детали.
              </p>

              {/* Active Config Pill */}
              <div className="pt-1 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pastel-card border border-pastel-border text-[11px] font-semibold text-pastel-text shadow-2xs">
                  {interviewConfig.strategy === 'socratic_tutoring' ? (
                    <GraduationCap className="w-3.5 h-3.5 text-pastel-accentRose" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-pastel-accentViolet" />
                  )}
                  <span>
                    {interviewConfig.strategy === 'socratic_tutoring' ? 'Сократ' : 'Адаптивный'} • Голос {interviewConfig.voice} • До {interviewConfig.maxProbes} раундов
                  </span>
                </span>
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
                    <span>Начать собеседование</span>
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
            {/* Strategy & Interaction Banner */}
            <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-pastel-rose/50 border border-pastel-rose/80 text-[11px] text-pastel-text/85 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-pastel-accentRose text-sm">
                  {interviewConfig.strategy === 'socratic_tutoring' ? '🌸' : '🎯'}
                </span>
                <p className="leading-tight">
                  {interviewConfig.strategy === 'socratic_tutoring'
                    ? 'Сократический ментор: смело задавайте вопросы, просите подсказки или повторить формулировку.'
                    : 'Адаптивное зондирование: отвечайте своими словами, ИИ может задать до 3 точечных уточнений.'}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-pastel-border shrink-0 text-pastel-accentViolet">
                Голос: {interviewConfig.voice}
              </span>
            </div>

            {/* Live Audio Interaction Stage */}
            <div className="my-3.5 flex flex-col items-center justify-center shrink-0">
              <div className="relative flex items-center justify-center w-28 h-28">
                {/* Visualizer Pulsing Glow */}
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

              {/* Status Badge */}
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

            {/* Realtime Dialogue Scroll Area */}
            <div className="flex-1 min-h-[140px] max-h-[190px] overflow-y-auto p-3.5 rounded-2xl bg-pastel-card/50 border border-pastel-border/60 space-y-2.5 text-xs">
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

            {/* Bottom Actions for Active Stage */}
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
        {/* STAGE 3: VERDICT & RETRY                                                  */}
        {/* ========================================================================= */}
        {stage === 'verdict' && evaluation && (
          <div className="my-2 space-y-4 overflow-y-auto max-h-[65vh] pr-1">
            {/* Score Banner */}
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

            {/* Executive Vocal Coaching & Acoustic Profile Studio */}
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
                        <h4 className="font-bold text-xs text-pastel-text">
                          Голосовой коучинг и манера речи
                        </h4>
                        <p className="text-[10px] text-pastel-muted">
                          Анализ интонаций, темпа и уверенности ответа
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 border border-pastel-border text-pastel-accentViolet shadow-2xs">
                      ✨ AI Voice Studio
                    </span>
                  </div>

                  {/* 30-Point Sparkline Waveform (Equalizer) */}
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

                  {/* 3 Coaching Insight Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Volume & Delivery */}
                    <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs">{humanProfile.volume.iconEmoji}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.volume.badgeStyle}`}>
                            {humanProfile.volume.badge}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-pastel-text block">
                          {humanProfile.volume.title}
                        </span>
                        <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                          {humanProfile.volume.description}
                        </p>
                      </div>
                      <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                        Уровень: {humanProfile.volume.techValue}
                      </span>
                    </div>

                    {/* Pace & Rhythm */}
                    <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs">{humanProfile.pace.iconEmoji}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.pace.badgeStyle}`}>
                            {humanProfile.pace.badge}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-pastel-text block">
                          {humanProfile.pace.title}
                        </span>
                        <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                          {humanProfile.pace.description}
                        </p>
                      </div>
                      <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                        Скорость: {humanProfile.pace.techValue}
                      </span>
                    </div>

                    {/* Structure & Pauses */}
                    <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs">{humanProfile.structure.iconEmoji}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.structure.badgeStyle}`}>
                            {humanProfile.structure.badge}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-pastel-text block">
                          {humanProfile.structure.title}
                        </span>
                        <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                          {humanProfile.structure.description}
                        </p>
                      </div>
                      <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                        Структура: {humanProfile.structure.techValue}
                      </span>
                    </div>
                  </div>

                  {/* Mentor Coaching Praise Banner */}
                  <div className="p-2.5 rounded-2xl bg-white/95 border border-pastel-rose/80 text-[11px] text-pastel-text leading-relaxed flex items-center gap-2 shadow-2xs">
                    <span className="text-sm shrink-0">🌸</span>
                    <p className="font-medium text-pastel-text/90">
                      {humanProfile.mentorPraise}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Positive Points */}
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

            {/* Missing Points */}
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

            {/* Spoken Feedback Text */}
            {(evaluation.spokenFeedback || evaluation.feedback) && (
              <div className="p-3.5 rounded-2xl bg-pastel-card border border-pastel-border text-xs leading-relaxed text-pastel-text">
                <span className="font-bold text-pastel-accentViolet block mb-1">Резюме интервьюера:</span>
                <p>{evaluation.spokenFeedback || evaluation.feedback}</p>
              </div>
            )}

            {/* Dialogue Transcript Accordion */}
            {(deepgramTranscript || dialogueTurns.some(t => t.role === 'ai' && t.text.length > 5)) && (
              <div className="rounded-2xl border border-pastel-border/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsTranscriptOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-pastel-card/80 hover:bg-pastel-rose/30 transition-colors text-xs font-bold text-pastel-text cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-pastel-accentViolet" />
                    📜 Стенограмма интервью
                    {isTranscribing && (
                      <span className="flex items-center gap-1 text-[10px] text-pastel-accentViolet font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Deepgram распознаёт...
                      </span>
                    )}
                  </span>
                  {isTranscriptOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isTranscriptOpen && (
                  <div className="p-3 bg-white/70 space-y-2.5 max-h-60 overflow-y-auto">
                    {/* AI dialogue turns */}
                    {dialogueTurns
                      .filter(t => t.role === 'ai' || t.role === 'system')
                      .map((turn, i) => (
                        <div key={i} className={`flex gap-2 text-[11px] ${
                          turn.role === 'system' ? 'opacity-50' : ''
                        }`}>
                          <span className="text-sm shrink-0">{turn.role === 'ai' ? '🤖' : '⚙️'}</span>
                          <div>
                            <span className="font-bold text-pastel-accentViolet block text-[9px] mb-0.5">
                              {turn.role === 'ai' ? 'ИИ-Интервьюер' : 'Система'}
                            </span>
                            <p className="text-pastel-text/80 leading-relaxed">{turn.text}</p>
                          </div>
                        </div>
                      ))
                    }
                    {/* Deepgram-transcribed candidate answer */}
                    {deepgramTranscript && (
                      <div className="flex gap-2 text-[11px]">
                        <span className="text-sm shrink-0">👤</span>
                        <div>
                          <span className="font-bold text-emerald-700 block text-[9px] mb-0.5">
                            Ваш ответ (Deepgram Nova-3 · Русский)
                          </span>
                          <p className="text-pastel-text/90 leading-relaxed">{deepgramTranscript}</p>
                        </div>
                      </div>
                    )}
                    {isTranscribing && !deepgramTranscript && (
                      <div className="flex gap-2 text-[11px] text-pastel-muted">
                        <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5 shrink-0" />
                        <p>Deepgram Nova-3 распознаёт ваш ответ на русском языке...</p>
                      </div>
                    )}
                  </div>
                )}
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

      </motion.div>

      {/* Settings Drawer Modal - Rendered outside motion.div at root modal level to prevent transform trapping */}
      <VoiceSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={interviewConfig}
        onChangeConfig={handleConfigChange}
        questionText={currentQuestionText}
        referenceAnswer={referenceAnswer}
      />
    </div>,
    document.body
  );
};
