import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Volume2, Sparkles, Loader2, Award, CheckCircle2, AlertTriangle, Activity, RotateCcw, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { AcousticTelemetryService, AcousticMetrics } from '../services/AcousticTelemetryService';
import { triggerSuccessConfetti } from '../utils/confetti';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  onEvaluationComplete?: (evalData: any) => void;
}

interface EvaluationResult {
  id?: string;
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
  audioMetrics?: AcousticMetrics;
}

interface TurnMessage {
  role: 'user' | 'ai' | 'system';
  text: string;
}

type ModalStage = 'lobby' | 'active' | 'verdict';

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  questionId,
  topic = 'Java & Spring Framework',
  currentQuestionText,
  referenceAnswer,
  onEvaluationComplete
}) => {
  const { systemHealth, showToast } = useAppStore();

  const [stage, setStage] = useState<ModalStage>('lobby');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [rmsDb, setRmsDb] = useState<number>(-60);
  const [dialogueTurns, setDialogueTurns] = useState<TurnMessage[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const gainAnchorRef = useRef<GainNode | null>(null);
  const userPcmChunksRef = useRef<Float32Array[]>([]);
  const transcriptRef = useRef<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronous State Tracking Refs (Prevents closure staleness in AudioWorklet onmessage)
  const isRecordingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  // Auto scroll transcript box
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [dialogueTurns]);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      teardownSession();
      setStage('lobby');
      return;
    }

    setStage('lobby');
    setEvaluation(null);
    setDialogueTurns([]);
    userPcmChunksRef.current = [];
    transcriptRef.current = '';
    setIsSubmitting(false);

    return () => {
      teardownSession();
    };
  }, [isOpen, questionId, currentQuestionText]);

  const teardownSession = () => {
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

    // 2. Connect to Backend Live WebSocket Proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = window.location.port === '8090' ? '8091' : window.location.port || '8091';
    const wsUrl = `${protocol}//${host}:${port}/ws/live?questionId=${encodeURIComponent(questionId || '')}&topic=${encodeURIComponent(topic)}&questionText=${encodeURIComponent(currentQuestionText || '')}&referenceAnswer=${encodeURIComponent(referenceAnswer || '')}`;
    
    console.log('Connecting to Live WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('✅ Live WebSocket connected to backend proxy');
    };

    ws.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);

          if (data.type === 'setupComplete') {
            setDialogueTurns((prev) => [
              ...prev,
              { role: 'system', text: '✨ Интервьюер готов! Слушайте вопрос темы.' }
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
                if (part.inlineData?.data) {
                  playoutManagerRef.current?.enqueuePcmChunk(part.inlineData.data);
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
                { role: 'system', text: '🎙️ Теперь ваша очередь: микрофон включен, отвечайте своими словами.' }
              ]);
            }
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
      const audioCtx = new AudioCtx({ latencyHint: 'interactive' });
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

          // Transmit to Gemini Live ONLY when candidate recording is enabled AND AI is not currently speaking
          const shouldTransmit =
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            isRecordingRef.current &&
            !isAiSpeakingRef.current;

          if (shouldTransmit && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const bytes = new Uint8Array(pcmBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = btoa(binary);

            const realtimeInput = {
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Audio
                  }
                ]
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

  const computeLocalAcoustics = (): AcousticMetrics => {
    const totalSamples = userPcmChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedPcm = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of userPcmChunksRef.current) {
      combinedPcm.set(chunk, offset);
      offset += chunk.length;
    }

    return AcousticTelemetryService.analyzeAcoustics(
      combinedPcm,
      16000,
      transcriptRef.current || 'Ответ кандидата в голосовом режиме'
    );
  };

  const finalizeEvaluation = async (evalData: EvaluationResult) => {
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }

    const acoustics = computeLocalAcoustics();
    const finalResult = {
      ...evalData,
      audioMetrics: acoustics
    };

    setEvaluation(finalResult);
    setStage('verdict');
    setIsSubmitting(false);

    if ((finalResult.score ?? 0) >= 80) {
      triggerSuccessConfetti();
    }

    // Persist to backend /api/eval/save if questionId is provided
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
            userAnswer: 'Устный ответ через Gemini Live',
            transcript: transcriptRef.current,
            audioMetrics: acoustics
          })
        });
      } catch (err) {
        console.error('Error saving Live evaluation to DB:', err);
      }
    }

    if (onEvaluationComplete) {
      onEvaluationComplete(finalResult);
    }
  };

  const handleRequestVerdict = () => {
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
                  text: 'Я закончил свой ответ. Пожалуйста, оцени мой ответ, дай краткий устный фидбек и вызови функцию submit_interview_evaluation.'
                }
              ]
            }
          ],
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(finishMsg));
    }

    // Safety fallback (6.5s) if model is delayed or doesn't invoke toolCall
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(async () => {
      console.warn('Live toolCall timeout. Executing instant fallback evaluation...');
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
    }, 6500);
  };

  const handleRetry = async () => {
    teardownSession();
    await startLiveInterview();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className="bg-white/95 rounded-3xl p-5 md:p-7 max-w-xl w-full border border-pastel-rose/80 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] my-auto"
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
        {/* STAGE 1: LOBBY (Prominent Start Screen)                                   */}
        {/* ========================================================================= */}
        {stage === 'lobby' && (
          <div className="my-6 flex flex-col items-center justify-center text-center space-y-5">
            {/* Friendly Mentor Avatar with Glow */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet p-1 shadow-xl flex items-center justify-center animate-pulse">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
                  👩‍💻
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white shadow-xs">
                <Mic className="w-4 h-4" />
              </div>
            </div>

            <div className="max-w-md space-y-1.5 px-2">
              <h4 className="font-bold text-pastel-text text-base">ИИ-интервьюер готов к диалогу</h4>
              <p className="text-xs text-pastel-muted leading-relaxed">
                Нажмите кнопку ниже, чтобы начать. Интервьюер поприветствует вас голосом и зачитает вопрос вслух. Отвечайте спокойно своими словами.
              </p>
            </div>

            {/* ONE BIG PROMINENT CTA BUTTON */}
            <button
              type="button"
              onClick={startLiveInterview}
              disabled={!systemHealth.isAiReady}
              className="w-full max-w-sm py-4 px-6 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-pink-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: ACTIVE LIVE SESSION                                              */}
        {/* ========================================================================= */}
        {stage === 'active' && (
          <>
            {/* Supportive Ergonomic Note */}
            <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-pastel-rose/50 border border-pastel-rose/80 text-[11px] text-pastel-text/85 flex items-center gap-2 shrink-0">
              <span className="text-pastel-accentRose text-sm">✨</span>
              <p className="leading-tight">
                Говори спокойно своими словами. Если нужно подумать — делай паузы, ИИ внимательно дослушает тебя.
              </p>
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
                      ? 'bg-rose-500 hover:bg-rose-600 hover:scale-105 cursor-pointer shadow-rose-200'
                      : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:scale-105 cursor-pointer shadow-purple-200'
                  }`}
                  title={isRecording ? 'Остановить микрофон' : 'Включить микрофон'}
                >
                  {isRecording ? (
                    <Mic className="w-8 h-8 animate-pulse" />
                  ) : (
                    <MicOff className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Status and Audio Level Indicators */}
              <div className="mt-2.5 flex flex-col items-center gap-1 text-center">
                <div className="text-xs font-semibold text-pastel-muted flex items-center gap-1.5">
                  {isAiSpeaking ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      <span>ИИ говорит вопрос...</span>
                    </div>
                  ) : isRecording ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                      <Activity className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      <span className="font-bold">
                        {rmsDb > -34 
                          ? '✨ Отличная громкость и четкость' 
                          : rmsDb > -46 
                          ? '🎙️ Хорошая слышимость, продолжай' 
                          : '💬 Говорите в микрофон'}
                      </span>
                      <span className="text-[10px] opacity-75 font-mono">({rmsDb} dB)</span>
                    </div>
                  ) : (
                    <span className="text-pastel-muted">Нажмите на микрофон для ответа голосом</span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Dialogue Transcript Box */}
            <div
              ref={chatScrollRef}
              className="bg-pastel-bg/90 rounded-2xl p-3.5 flex-1 min-h-[90px] max-h-36 overflow-y-auto border border-pastel-border/60 text-xs space-y-2 mb-3"
            >
              {dialogueTurns.length === 0 ? (
                <p className="text-pastel-muted italic text-center py-4">Подключение к голосовому каналу...</p>
              ) : (
                dialogueTurns.map((turn, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                      turn.role === 'ai'
                        ? 'bg-white text-pastel-text border border-pastel-border/60 shadow-2xs'
                        : turn.role === 'user'
                        ? 'bg-pastel-lavender/70 text-pastel-accentViolet font-medium ml-4'
                        : 'text-[11px] text-pastel-muted italic text-center'
                    }`}
                  >
                    {turn.role === 'ai' && <span className="font-bold text-pastel-accentRose mr-1.5">Интервьюер:</span>}
                    {turn.role === 'user' && <span className="font-bold text-pastel-accentViolet mr-1.5">Вы:</span>}
                    {turn.text}
                  </div>
                ))
              )}
            </div>

            {/* Action Controls */}
            <div className="flex gap-2.5 pt-1 shrink-0">
              <button
                type="button"
                onClick={handleRequestVerdict}
                disabled={isSubmitting || !isConnected}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Формирование вердикта...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>Завершить ответ и получить оценку</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 rounded-2xl border border-pastel-border text-pastel-text text-xs font-semibold hover:bg-pastel-rose transition cursor-pointer"
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
          <div className="my-3.5 space-y-4 overflow-y-auto max-h-[65vh] pr-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-pastel-rose/70 via-white to-pastel-lavender/70 border border-pastel-accentRose/40 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${evaluation.isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-pastel-text">{evaluation.score}</span>
                      <span className="text-xs font-bold text-pastel-muted">/ 100</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${evaluation.isPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                        {evaluation.isPassed ? '✓ Сдано успешно' : '⚠️ Требует повторения'}
                      </span>
                    </div>
                    <p className="text-[11px] text-pastel-muted font-medium mt-0.5">Оценка сформирована ИИ-интервьюером в диалоге</p>
                  </div>
                </div>
              </div>

              {/* Acoustic Telemetry Pill */}
              {evaluation.audioMetrics && (
                <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-white/90 border border-pastel-border text-center text-xs">
                  <div>
                    <span className="text-[9px] text-pastel-muted font-semibold block">ГРОМКОСТЬ</span>
                    <span className="text-xs font-bold text-pastel-text">{evaluation.audioMetrics.rmsDb} dB</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-pastel-muted font-semibold block">ТЕМП РЕЧИ</span>
                    <span className="text-xs font-bold text-pastel-text">{evaluation.audioMetrics.grossWpm} WPM</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-pastel-muted font-semibold block">ПАУЗЫ</span>
                    <span className="text-xs font-bold text-pastel-text">{evaluation.audioMetrics.pauseRatioPercent}%</span>
                  </div>
                </div>
              )}

              {/* Positive Points */}
              {evaluation.positivePoints && evaluation.positivePoints.length > 0 && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Что вы ответили отлично:
                  </span>
                  <ul className="list-disc list-inside text-emerald-900/90 space-y-0.5 pl-1">
                    {evaluation.positivePoints.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Points */}
              {evaluation.missingPoints && evaluation.missingPoints.length > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Что стоит дополнить при ответе:
                  </span>
                  <ul className="list-disc list-inside text-amber-900/90 space-y-0.5 pl-1">
                    {evaluation.missingPoints.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feedback */}
              <div className="text-xs text-pastel-text leading-relaxed bg-white/80 p-3 rounded-xl border border-pastel-border/60">
                <span className="font-bold text-pastel-accentViolet block mb-1">Резюме ответа:</span>
                {evaluation.feedback}
              </div>
            </motion.div>

            {/* Verdict Action Buttons: 1-Click Retry and Close */}
            <div className="flex gap-2.5 pt-1 shrink-0">
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
    </div>
  );
};
