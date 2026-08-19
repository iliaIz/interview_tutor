import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { BugChallenge, BugChallengeCard } from './BugChallengeCard';
import { triggerSuccessConfetti } from '../utils/confetti';

interface TopicBugHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
  topicName: string;
}

export const TopicBugHuntModal: React.FC<TopicBugHuntModalProps> = ({
  isOpen,
  onClose,
  topicId,
  topicName,
}) => {
  const [challenge, setChallenge] = useState<BugChallenge | null>(null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [sessionSolvedCount, setSessionSolvedCount] = useState(0);

  // Audio / WebSocket State
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Нажми микрофон, чтобы обсудить задачу с AI-техлидом');
  const [aiTranscript, setAiTranscript] = useState<string>('');

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const isRecordingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  const fetchChallenge = async () => {
    setIsLoadingChallenge(true);
    setIsSolved(false);
    setAiTranscript('');
    try {
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          topic: topicName
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChallenge(data);
      }
    } catch (e) {
      console.error('Error fetching topic bug challenge:', e);
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  useEffect(() => {
    if (isOpen && topicId) {
      void fetchChallenge();
    } else {
      disconnectVoice();
      setChallenge(null);
      setIsSolved(false);
      setSessionSolvedCount(0);
    }
  }, [isOpen, topicId]);

  const initMicrophone = async () => {
    try {
      if (mediaStreamRef.current && inputAudioCtxRef.current) return;
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
        const { type, pcmBuffer } = event.data;
        if (type === 'AUDIO_FRAME') {
          const isAiCurrentlySpeaking = isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false);
          const shouldTransmit =
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            isRecordingRef.current &&
            !isAiCurrentlySpeaking;

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
      sourceNode.connect(workletNode);
      workletNode.connect(gainAnchor);
      gainAnchor.connect(audioCtx.destination);
    } catch (e) {
      console.error('Error initializing microphone hardware in TopicBugHuntModal:', e);
    }
  };

  const disconnectVoice = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
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
    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }
    playoutManagerRef.current?.clearQueue();
    setIsConnected(false);
    setIsRecording(false);
    setIsAiSpeaking(false);
  };

  const toggleVoice = async () => {
    if (isConnected) {
      disconnectVoice();
      setStatusMessage('Голосовой канал отключен.');
      return;
    }

    if (!challenge) return;

    setStatusMessage('Подключение к голосовому каналу...');
    setAiTranscript('');

    const playout = new AudioPlayoutManager();
    playoutManagerRef.current = playout;
    await playout.resume();
    await initMicrophone();

    const host = window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      sessionType: 'tutor',
      tutorMode: 'bug_hunt',
      topic: topicName,
      bugTitle: challenge.title,
      bugExplanation: challenge.bugExplanation,
      codeSnippet: challenge.codeSnippet,
      hints: JSON.stringify(challenge.hints || []),
      voice: 'Kore'
    });

    const wsUrl = `${protocol}//${host}/ws/live?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setStatusMessage('AI-техлид готов...');
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
          setStatusMessage('Слушайте вводную от AI-техлида...');
        } else if (data.type === 'bug_solved') {
          setIsSolved(true);
          setSessionSolvedCount((prev) => prev + 1);
          triggerSuccessConfetti();
          setStatusMessage(`🎉 ${data.payload?.feedback || 'Баг найден верно! Можешь переходить к следующей задаче.'}`);
        } else if (data.serverContent) {
          if (data.serverContent.interrupted) {
            playoutManagerRef.current?.handleInterruption();
            setIsAiSpeaking(false);
          }

          if (data.serverContent.modelTurn?.parts) {
            setIsAiSpeaking(true);
            setIsRecording(false);
            for (const part of data.serverContent.modelTurn.parts) {
              if (part.text) {
                setAiTranscript((prev) => prev + part.text);
              }
              const pcmBase64 = part.inlineData?.data || part.inline_data?.data;
              if (pcmBase64) {
                playoutManagerRef.current?.enqueuePcmChunk(pcmBase64);
              }
            }
          }

          if (data.serverContent.turnComplete) {
            setIsAiSpeaking(false);
            setTimeout(() => {
              setIsRecording(true);
              setStatusMessage('🎙️ Твоя очередь: объясни голосом, в чем ошибка');
            }, 250);
          }
        }
      } catch (e) {
        console.error('Error handling TopicBugHunt WS message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsRecording(false);
      setIsAiSpeaking(false);
    };

    ws.onerror = (e) => {
      console.error('TopicBugHunt WS error:', e);
      setStatusMessage('Ошибка подключения к голосовому шлюзу');
      setIsConnected(false);
    };
  };

  const handleNextChallenge = async () => {
    disconnectVoice();
    await fetchChallenge();
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto bg-slate-950/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-pastel-bg rounded-3xl border border-pastel-border shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden relative"
        >
          {/* Top Bar */}
          <div className="p-4 md:p-6 border-b border-pastel-border/70 bg-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white flex items-center justify-center font-bold shadow-sm shadow-pastel-accentRose/20">
                <Bug className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base md:text-lg text-pastel-text">
                    {topicName} — Bug Hunt Arena
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
                    Тренажер
                  </span>
                </div>
                <p className="text-xs text-pastel-muted">
                  Бесконечная тренировка поиска неочевидных багов и устного код-ревью
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Streak Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs text-xs font-bold">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                <span>Решено: {sessionSolvedCount} 🔥</span>
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  disconnectVoice();
                  onClose();
                }}
                className="w-9 h-9 rounded-xl bg-pastel-card hover:bg-pastel-border text-pastel-muted hover:text-pastel-text transition flex items-center justify-center cursor-pointer border border-pastel-border"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4">
            {isLoadingChallenge ? (
              <div className="py-24 text-center bg-white rounded-3xl border border-pastel-border shadow-xs">
                <Loader2 className="w-8 h-8 animate-spin text-pastel-accentRose mx-auto mb-3" />
                <h4 className="font-bold text-pastel-text mb-1">Генерируем боевой кейс с багом...</h4>
                <p className="text-xs text-pastel-muted max-w-sm mx-auto">
                  Случайная выборка подтемы из базы «{topicName}» для максимального разнообразия практики.
                </p>
              </div>
            ) : challenge ? (
              <BugChallengeCard
                challenge={challenge}
                isSolved={isSolved}
                onRefresh={fetchChallenge}
                isLoading={isLoadingChallenge}
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-pastel-border text-xs text-pastel-muted">
                Не удалось загрузить задачу.
                <button
                  onClick={fetchChallenge}
                  className="mt-3 block mx-auto px-4 py-2 bg-pastel-accentRose text-white rounded-xl font-bold cursor-pointer"
                >
                  Попробовать снова
                </button>
              </div>
            )}

            {/* Voice Interaction Panel */}
            {challenge && (
              <div className="p-4 md:p-5 rounded-2xl bg-white border border-pastel-border shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleVoice}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        isConnected
                          ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
                          : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95'
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <MicOff className="w-4 h-4" /> Отключить микрофон
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" /> Обсудить с AI-техлидом голосом
                        </>
                      )}
                    </button>

                    <span className="text-xs font-semibold text-pastel-muted">
                      {statusMessage}
                    </span>
                  </div>

                  {/* Next Challenge Action */}
                  <button
                    onClick={handleNextChallenge}
                    disabled={isLoadingChallenge}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pastel-text text-white text-xs font-bold hover:bg-black transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <span>Следующая задача</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* AI Live Transcript */}
                {aiTranscript && (
                  <div className="p-3 bg-pastel-lavender/30 rounded-xl border border-pastel-accentViolet/20 text-xs text-pastel-text leading-relaxed">
                    <span className="font-bold text-pastel-accentViolet block mb-1">Реплика AI:</span>
                    <p className="m-0">{aiTranscript}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
