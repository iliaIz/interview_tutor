import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Volume2, Sparkles, Loader2, Award, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
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

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  questionId,
  topic = 'Java & Spring',
  currentQuestionText,
  referenceAnswer,
  onEvaluationComplete
}) => {
  const { showToast, systemHealth } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [rmsDb, setRmsDb] = useState(-60);
  const [dialogueTurns, setDialogueTurns] = useState<Array<{ role: 'ai' | 'user' | 'system'; text: string }>>([]);
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

  // Auto scroll transcript box
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [dialogueTurns]);

  useEffect(() => {
    if (!isOpen) return;

    setEvaluation(null);
    setDialogueTurns([]);
    userPcmChunksRef.current = [];
    transcriptRef.current = '';

    // Initialize Playout Manager
    const playoutManager = new AudioPlayoutManager();
    playoutManagerRef.current = playoutManager;

    // Connect to Backend Live WebSocket Proxy
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8091/ws/live?questionId=${encodeURIComponent(questionId || '')}&topic=${encodeURIComponent(topic)}&questionText=${encodeURIComponent(currentQuestionText || '')}&referenceAnswer=${encodeURIComponent(referenceAnswer || '')}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setDialogueTurns([
        { role: 'system', text: '🎙️ Голосовой канал Gemini Live подключен. Ожидание готовности...' }
      ]);
    };

    ws.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);

          if (data.type === 'setupComplete') {
            setDialogueTurns((prev) => [
              ...prev,
              { role: 'system', text: '⚡ Интервьюер готов! Нажмите микрофон и отвечайте на вопрос.' }
            ]);

            if (currentQuestionText) {
              const initMsg = {
                clientContent: {
                  turns: [
                    {
                      role: 'user',
                      parts: [{ text: `Привет! Зачитай мне, пожалуйста, вопрос: "${currentQuestionText}" и выслушай мой ответ.` }]
                    }
                  ],
                  turnComplete: true
                }
              };
              ws.send(JSON.stringify(initMsg));
            }
          } else if (data.type === 'evaluation_completed') {
            // Function Calling completed
            const evalData: EvaluationResult = data.evaluation;
            finalizeEvaluation(evalData);
          } else if (data.error) {
            setDialogueTurns((prev) => [...prev, { role: 'system', text: `❌ Ошибка: ${data.error}` }]);
          } else if (data.serverContent) {
            // Check for Barge-in interruption
            if (data.serverContent.interrupted) {
              playoutManager.handleInterruption();
              setIsAiSpeaking(false);
              setDialogueTurns((prev) => [...prev, { role: 'system', text: '⚡ Речь прервана кандидатом (Barge-in).' }]);
            }

            // AI Speech turn
            if (data.serverContent.modelTurn?.parts) {
              setIsAiSpeaking(true);
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
                  playoutManager.enqueuePcmChunk(part.inlineData.data);
                }
              }
            }

            if (data.serverContent.turnComplete) {
              setIsAiSpeaking(false);
            }
          }
        }
      } catch (e) {
        console.error('Error handling Live WS message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsRecording(false);
      setIsAiSpeaking(false);
    };

    ws.onerror = (err) => {
      console.error('Live WS error:', err);
      setIsConnected(false);
    };

    return () => {
      stopMicrophone();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (playoutManagerRef.current) {
        playoutManagerRef.current.teardown();
        playoutManagerRef.current = null;
      }
    };
  }, [isOpen, questionId, currentQuestionText, referenceAnswer, topic]);

  const startMicrophone = async () => {
    try {
      if (playoutManagerRef.current) {
        await playoutManagerRef.current.resume();
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

          // Accumulate Float32 samples for post-answer acoustic telemetry
          const int16 = new Int16Array(pcmBuffer);
          const f32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            const s = int16[i];
            f32[i] = s < 0 ? s / 32768 : s / 32767;
          }
          userPcmChunksRef.current.push(f32);

          // Stream base64 to WebSocket
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const bytes = new Uint8Array(pcmBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
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

      setIsRecording(true);
    } catch (err: any) {
      console.error('Error starting microphone:', err);
      showToast({
        type: 'error',
        title: 'Доступ к микрофону заблокирован',
        message: 'Браузер не смог получить доступ к микрофону. Проверьте разрешения в настройках.',
        technicalDetails: err?.message || String(err)
      });
    }
  };

  const stopMicrophone = () => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (gainAnchorRef.current) {
      gainAnchorRef.current.disconnect();
      gainAnchorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }
    setIsRecording(false);
    setRmsDb(-60);
  };

  const toggleMic = () => {
    if (isRecording) {
      stopMicrophone();
    } else {
      startMicrophone();
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
    const acoustics = computeLocalAcoustics();
    const finalResult = {
      ...evalData,
      audioMetrics: acoustics
    };

    setEvaluation(finalResult);
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
            transcript: dialogueTurns.map((d) => `${d.role.toUpperCase()}: ${d.text}`).join('\n\n'),
            audioMetrics: acoustics
          })
        });
      } catch (err) {
        console.error('Error auto-persisting evaluation:', err);
      }
    }

    if (onEvaluationComplete) {
      onEvaluationComplete(finalResult);
    }
  };

  const handleRequestVerdict = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsSubmitting(true);
      stopMicrophone();

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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full border border-pastel-border shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pastel-border/60">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-pastel-rose text-pastel-accentRose rounded-2xl shadow-xs">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-pastel-text text-base flex items-center gap-2">
                Gemini Live Interviewer
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Full-Duplex Bidi
                </span>
              </h3>
              <p className="text-xs text-pastel-muted truncate max-w-sm">{topic}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-pastel-muted hover:text-pastel-text rounded-full hover:bg-pastel-bg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Soft Ambient Glows */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

        {/* Question Context Banner */}
        {currentQuestionText && (
          <div className="mt-4 p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/70 text-xs shadow-2xs">
            <span className="font-bold text-pastel-accentViolet block mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
              Вопрос темы:
            </span>
            <p className="text-pastel-text leading-relaxed font-bold">{currentQuestionText}</p>
          </div>
        )}

        {/* Supportive Ergonomic Note */}
        {!evaluation && (
          <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-pastel-rose/50 border border-pastel-rose/80 text-[11px] text-pastel-text/80 flex items-center gap-2">
            <span className="text-pastel-accentRose text-sm">✨</span>
            <p className="leading-tight">
              Говори спокойно своими словами. Если нужно собраться с мыслями — делай паузы, ИИ внимательно дослушает тебя.
            </p>
          </div>
        )}

        {/* Evaluation Card View if Completed */}
        <AnimatePresence>
          {evaluation ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="my-4 p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 border border-indigo-100 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${evaluation.isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-800">{evaluation.score}</span>
                      <span className="text-xs font-bold text-slate-400">/ 100</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${evaluation.isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {evaluation.isPassed ? 'Сдано успешно' : 'Требует повторения'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Оценка сформирована ИИ-интервьюером в диалоге</p>
                  </div>
                </div>
              </div>

              {/* Acoustic Telemetry Pill */}
              {evaluation.audioMetrics && (
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white/80 border border-slate-200/60 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">ГРОМКОСТЬ</span>
                    <span className="text-xs font-bold text-slate-700">{evaluation.audioMetrics.rmsDb} dB</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">ТЕМП РЕЧИ</span>
                    <span className="text-xs font-bold text-slate-700">{evaluation.audioMetrics.grossWpm} WPM</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">ПАУЗЫ</span>
                    <span className="text-xs font-bold text-slate-700">{evaluation.audioMetrics.pauseRatioPercent}%</span>
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="text-xs text-slate-700 leading-relaxed bg-white/60 p-3 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-900 block mb-1">Резюме ответа:</span>
                {evaluation.feedback}
              </div>

              {/* Positive / Missing Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {evaluation.positivePoints.length > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Отвечено верно:
                    </span>
                    <ul className="space-y-1 text-[11px] text-emerald-900">
                      {evaluation.positivePoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span>•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {evaluation.missingPoints.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100">
                    <span className="font-bold text-amber-800 flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Упущенные детали:
                    </span>
                    <ul className="space-y-1 text-[11px] text-amber-900">
                      {evaluation.missingPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span>•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Live Audio Interaction Stage */
            <div className="my-6 flex flex-col items-center justify-center">
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
                  onClick={toggleMic}
                  disabled={!systemHealth.isAiReady || isSubmitting}
                  className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition transform ${
                    !systemHealth.isAiReady
                      ? 'bg-gray-300 opacity-60 cursor-not-allowed'
                      : isRecording
                      ? 'bg-rose-500 hover:bg-rose-600 hover:scale-105 cursor-pointer shadow-rose-200'
                      : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:scale-105 cursor-pointer shadow-purple-200'
                  }`}
                  title={isRecording ? 'Остановить микрофон' : 'Включить микрофон'}
                >
                  {!systemHealth.isAiReady ? (
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                  ) : isRecording ? (
                    <Mic className="w-8 h-8 animate-pulse" />
                  ) : (
                    <MicOff className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Status and Audio Level Indicators */}
              <div className="mt-4 flex flex-col items-center gap-1.5 text-center">
                <div className="text-xs font-semibold text-pastel-muted flex items-center gap-1.5">
                  {isAiSpeaking ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      <span>ИИ говорит... (вы можете перебить голосом в любой момент)</span>
                    </div>
                  ) : isRecording ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                      <Activity className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      <span className="font-bold">
                        {rmsDb > -34 
                          ? '✨ Отличная громкость и четкость' 
                          : rmsDb > -46 
                          ? '🎙️ Хорошая слышимость, продолжай' 
                          : '💬 Говори чуть ближе к микрофону'}
                      </span>
                      <span className="text-[10px] opacity-75 font-mono">({rmsDb} dB)</span>
                    </div>
                  ) : (
                    <span className="text-pastel-muted">Нажмите на микрофон для ответа голосом</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Live Dialogue Transcript Box */}
        <div
          ref={chatScrollRef}
          className="bg-pastel-bg/90 rounded-2xl p-4 flex-1 min-h-[120px] max-h-48 overflow-y-auto border border-pastel-border/60 text-xs space-y-2.5 mb-4"
        >
          {dialogueTurns.length === 0 ? (
            <p className="text-pastel-muted italic text-center py-6">Подключение к голосовому каналу...</p>
          ) : (
            dialogueTurns.map((turn, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  turn.role === 'ai'
                    ? 'bg-white text-pastel-text border border-pastel-border/60 shadow-2xs'
                    : turn.role === 'user'
                    ? 'bg-pastel-lavender/60 text-pastel-accentViolet font-medium ml-4'
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
        <div className="flex gap-3 pt-2">
          {!evaluation && (
            <button
              onClick={handleRequestVerdict}
              disabled={isSubmitting || !isConnected}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Формирование вердикта...
                </>
              ) : (
                <>
                  <Award className="w-4 h-4" />
                  Завершить ответ и получить оценку
                </>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className={`py-3 px-5 rounded-2xl border border-pastel-border text-pastel-text text-xs font-semibold hover:bg-pastel-rose transition ${
              evaluation ? 'w-full' : ''
            }`}
          >
            {evaluation ? 'Закрыть окно' : 'Отмена'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
