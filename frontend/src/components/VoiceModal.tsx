import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Volume2, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuestionText?: string;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({ isOpen, onClose, currentQuestionText }) => {
  const { showToast, systemHealth } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const playPcm24kChunk = (base64Data: string) => {
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioCtx = outputAudioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
    } catch (e) {
      console.error('Error playing PCM audio chunk:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Connect to WebSocket Proxy
    const wsUrl = `ws://${window.location.hostname}:8091/ws/live`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setTranscript((prev) => [...prev, '🤖 Интервьюер подключился к голосовой сессии (Gemini 3 Flash Live).']);

      if (currentQuestionText) {
        // Send initial text prompt to ask the question
        const initMsg = {
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [{ text: `Пожалуйста, зачитай мне вопрос и попроси ответить: "${currentQuestionText}"` }]
              }
            ],
            turnComplete: true
          }
        };
        ws.send(JSON.stringify(initMsg));
      }
    };

    ws.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          if (data.error) {
            setTranscript((prev) => [...prev, `❌ Ошибка: ${data.error}`]);
          } else if (data.serverContent?.modelTurn?.parts) {
            for (const part of data.serverContent.modelTurn.parts) {
              if (part.text) {
                setTranscript((prev) => [...prev, `🤖 Gemini: ${part.text}`]);
              }
              if (part.inlineData && part.inlineData.data) {
                playPcm24kChunk(part.inlineData.data);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsRecording(false);
    };

    return () => {
      stopMicrophone();
      if (wsRef.current) wsRef.current.close();
      if (outputAudioCtxRef.current) {
        outputAudioCtxRef.current.close();
        outputAudioCtxRef.current = null;
      }
      nextStartTimeRef.current = 0;
    };
  }, [isOpen, currentQuestionText]);

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setIsRecording(true);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!isRecording || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32Array to PCM Int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Send base64 PCM chunk
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
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
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err: any) {
      console.error('Error starting microphone:', err);
      showToast({
        type: 'error',
        title: 'Доступ к микрофону заблокирован',
        message: 'Браузер не смог получить доступ к микрофону. Проверьте разрешения в настройках браузера.',
        technicalDetails: err?.message || String(err)
      });
    }
  };

  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleMic = () => {
    if (isRecording) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full border border-pastel-border shadow-2xl relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-pastel-rose text-pastel-accentRose rounded-xl">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-pastel-text text-base">Gemini 3 Flash Live</h3>
              <p className="text-xs text-pastel-muted">Голосовое собеседование в реальном времени</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-pastel-muted hover:text-pastel-text rounded-full hover:bg-pastel-bg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warmup alert if AI not ready */}
        {!systemHealth.isAiReady && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 shadow-xs">
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <div>
              <span className="font-semibold block">Инициализация голосового AI Шлюза...</span>
              <p className="text-[11px] text-amber-800/80 mt-0.5">
                Канал Live WebSocket станет доступен автоматически через несколько секунд.
              </p>
            </div>
          </div>
        )}

        {/* Animated Waveform Indicator */}
        <div className="my-8 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center w-28 h-28">
            <motion.div
              animate={{
                scale: isRecording ? [1, 1.25, 1] : 1,
                opacity: isRecording ? [0.4, 0.8, 0.4] : 0.2
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 rounded-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet"
            />
            <button
              onClick={toggleMic}
              disabled={!systemHealth.isAiReady}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition transform ${
                !systemHealth.isAiReady
                  ? 'bg-gray-300 opacity-60 cursor-not-allowed'
                  : isRecording
                  ? 'bg-rose-500 hover:bg-rose-600 hover:scale-105 cursor-pointer'
                  : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:scale-105 cursor-pointer'
              }`}
              title={!systemHealth.isAiReady ? "Инициализация AI Шлюза..." : isRecording ? "Остановить запись" : "Начать запись"}
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
          <p className="mt-4 text-xs font-semibold text-pastel-muted">
            {!systemHealth.isAiReady
              ? '⏳ Ожидание подключения к AI Шлюзу...'
              : isRecording
              ? '🎙️ Запись активна. Говорите в микрофон...'
              : 'Нажмите на микрофон, чтобы начать говорить'}
          </p>
        </div>

        {/* Transcript Box */}
        <div className="bg-pastel-bg rounded-2xl p-4 h-40 overflow-y-auto border border-pastel-border/60 text-xs space-y-2 mb-6">
          {transcript.length === 0 ? (
            <p className="text-pastel-muted italic text-center py-8">Подключение к голосовому серверу...</p>
          ) : (
            transcript.map((line, i) => (
              <p key={i} className="text-pastel-text leading-relaxed">{line}</p>
            ))
          )}
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl border border-pastel-border text-pastel-text text-sm font-semibold hover:bg-pastel-rose transition"
        >
          Завершить голосовой режим
        </button>
      </motion.div>
    </div>
  );
};
