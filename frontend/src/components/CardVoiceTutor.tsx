import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  Brain,
  Microscope,
  HelpCircle,
  Zap,
  Bug,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Terminal,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { BugChallenge, BugChallengeCard } from './BugChallengeCard';
import { triggerSuccessConfetti } from '../utils/confetti';
import { Question } from '../store/useAppStore';

export type TutorMode = 'deep_dive' | 'socratic' | 'eli5' | 'quick_qa' | 'bug_hunt';

interface CardVoiceTutorProps {
  question: Question;
  topicName: string;
}

const MODES: { id: TutorMode; name: string; icon: React.ComponentType<any>; badge: string; desc: string }[] = [
  {
    id: 'deep_dive',
    name: 'Под капот',
    icon: Microscope,
    badge: '🔬 Low-level',
    desc: 'Разбор JVM, многопоточности, памяти и нюансов реализации'
  },
  {
    id: 'socratic',
    name: 'Сократ',
    icon: Brain,
    badge: '🏛 Наставник',
    desc: 'Наводящие вопросы без готовых ответов'
  },
  {
    id: 'eli5',
    name: 'Простыми словами',
    icon: HelpCircle,
    badge: '💡 Аналогии',
    desc: 'Понятные ментальные модели и бытовые примеры'
  },
  {
    id: 'quick_qa',
    name: 'Коротко',
    icon: Zap,
    badge: '⚡ Экспресс',
    desc: 'Ответ в 2 предложениях без лишней воды'
  },
  {
    id: 'bug_hunt',
    name: 'Найти баг',
    icon: Bug,
    badge: '🐛 Code Review',
    desc: 'Генерация кода с ошибкой и устное ревью'
  }
];

export const CardVoiceTutor: React.FC<CardVoiceTutorProps> = ({ question, topicName }) => {
  const [activeMode, setActiveMode] = useState<TutorMode>('deep_dive');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Нажми микрофон, чтобы обсудить голосом');
  const [aiTranscript, setAiTranscript] = useState<string>('');
  
  // Bug Challenge State
  const [bugChallenge, setBugChallenge] = useState<BugChallenge | null>(null);
  const [isLoadingBug, setIsLoadingBug] = useState(false);
  const [isBugSolved, setIsBugSolved] = useState(false);

  // Audio & WS Refs
  const wsRef = useRef<WebSocket | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const isRecordingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);

  // Sync ref
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  // Clean up on unmount or question switch
  useEffect(() => {
    disconnectSession();
    setBugChallenge(null);
    setIsBugSolved(false);
    setAiTranscript('');
    setStatusMessage('Нажми микрофон, чтобы обсудить голосом');
  }, [question.id]);

  // Fetch Bug Challenge if mode switched to bug_hunt and not loaded yet
  const fetchBugChallenge = async () => {
    setIsLoadingBug(true);
    setIsBugSolved(false);
    try {
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          topic: topicName,
          questionText: question.question,
          referenceAnswer: question.answer
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBugChallenge(data);
      }
    } catch (e) {
      console.error('Error fetching bug challenge:', e);
    } finally {
      setIsLoadingBug(false);
    }
  };

  useEffect(() => {
    if (activeMode === 'bug_hunt' && !bugChallenge && !isLoadingBug) {
      void fetchBugChallenge();
    }
  }, [activeMode, question.id]);

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
      console.error('Error initializing microphone hardware in CardVoiceTutor:', e);
    }
  };

  const disconnectSession = () => {
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

  const toggleVoiceSession = async () => {
    if (isConnected) {
      disconnectSession();
      setStatusMessage('Сессия завершена. Нажми микрофон для нового вопроса.');
      return;
    }

    // Start Session
    setStatusMessage('Подключение к AI-тьютору...');
    setAiTranscript('');

    const playout = new AudioPlayoutManager();
    playoutManagerRef.current = playout;
    await playout.resume();
    await initMicrophone();

    const host = window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      sessionType: 'tutor',
      tutorMode: activeMode,
      questionId: question.id,
      topic: topicName,
      questionText: question.question,
      referenceAnswer: question.answer,
      voice: 'Kore'
    });

    if (activeMode === 'bug_hunt' && bugChallenge) {
      params.append('bugTitle', bugChallenge.title);
      params.append('bugExplanation', bugChallenge.bugExplanation);
      params.append('codeSnippet', bugChallenge.codeSnippet);
      params.append('hints', JSON.stringify(bugChallenge.hints));
    }

    const wsUrl = `${protocol}//${host}/ws/live?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('CardVoiceTutor WebSocket opened');
      setIsConnected(true);
      setStatusMessage('Тьютор подключается...');
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
          setStatusMessage('Тьютор готов! Слушайте ответ или задавайте вопрос.');
        } else if (data.type === 'bug_solved') {
          setIsBugSolved(true);
          triggerSuccessConfetti();
          setStatusMessage(`🎉 ${data.payload?.feedback || 'Баг найден верно!'}`);
        } else if (data.serverContent) {
          // Barge-in
          if (data.serverContent.interrupted) {
            playoutManagerRef.current?.handleInterruption();
            setIsAiSpeaking(false);
          }

          // Audio
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
              setStatusMessage('🎙️ Твоя очередь: говори в микрофон');
            }, 250);
          }
        }
      } catch (e) {
        console.error('Error handling tutor WS message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsRecording(false);
      setIsAiSpeaking(false);
    };

    ws.onerror = (e) => {
      console.error('Tutor WS error:', e);
      setStatusMessage('Ошибка подключения к голосовому шлюзу');
      setIsConnected(false);
    };
  };

  return (
    <div className="mt-8 rounded-3xl bg-gradient-to-br from-pastel-bg via-white to-pastel-rose/20 border border-pastel-border p-5 md:p-6 shadow-sm">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-pastel-text flex items-center gap-1.5">
              Интерактивный AI-Тьютор
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-lavender text-pastel-accentViolet border border-pastel-accentViolet/20">
                Voice & Code
              </span>
            </h3>
            <p className="text-[11px] text-pastel-muted">Задай вопрос голосом или потренируйся в ревью кода</p>
          </div>
        </div>

        {/* Action Toggle Button */}
        <button
          onClick={toggleVoiceSession}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
            isConnected
              ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
              : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95'
          }`}
        >
          {isConnected ? (
            <>
              <MicOff className="w-4 h-4" /> Завершить диалог
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" /> Начать обсуждение
            </>
          )}
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-5 p-1.5 bg-pastel-card/70 rounded-2xl border border-pastel-border/60">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                if (activeMode !== m.id) {
                  disconnectSession();
                  setActiveMode(m.id);
                }
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-pastel-text shadow-xs font-bold border border-pastel-border'
                  : 'text-pastel-muted hover:text-pastel-text hover:bg-white/50 font-medium'
              }`}
              title={m.desc}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-pastel-accentRose' : 'text-pastel-muted'}`} />
                <span className="text-xs">{m.name}</span>
              </div>
              <span className="text-[10px] text-pastel-muted opacity-80">{m.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Mode Description Banner */}
      <div className="text-xs text-pastel-muted bg-white/70 rounded-xl px-3.5 py-2 border border-pastel-border/50 mb-4 flex items-center justify-between">
        <span>{MODES.find((m) => m.id === activeMode)?.desc}</span>
        {isConnected && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {isAiSpeaking ? 'AI говорит...' : isRecording ? 'Слушаю вас...' : 'Канал активен'}
          </span>
        )}
      </div>

      {/* Dynamic Content: Bug Hunt Challenge or Voice Conversation Box */}
      {activeMode === 'bug_hunt' ? (
        <div className="space-y-3">
          {isLoadingBug ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-pastel-border">
              <Loader2 className="w-6 h-6 animate-spin text-pastel-accentRose mx-auto mb-2" />
              <p className="text-xs font-semibold text-pastel-muted">Генерируем кейс с багом по этому вопросу...</p>
            </div>
          ) : bugChallenge ? (
            <BugChallengeCard
              challenge={bugChallenge}
              isSolved={isBugSolved}
              onRefresh={fetchBugChallenge}
              isLoading={isLoadingBug}
            />
          ) : (
            <div className="p-4 text-center bg-white rounded-2xl border border-pastel-border text-xs text-pastel-muted">
              Не удалось загрузить задачу. Нажмите «Найти баг» еще раз.
            </div>
          )}
        </div>
      ) : (
        /* Regular Tutor Voice Card Status */
        <div className="bg-white rounded-2xl p-4 border border-pastel-border shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-pastel-text flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-pastel-accentViolet" />
              Статус диалога:
            </span>
            <span className="text-pastel-muted">{statusMessage}</span>
          </div>

          {/* AI Live Transcript Balloon */}
          {aiTranscript && (
            <div className="p-3 bg-pastel-lavender/30 rounded-xl border border-pastel-accentViolet/20 text-xs text-pastel-text leading-relaxed">
              <span className="font-bold text-pastel-accentViolet block mb-1">Реплика AI-Тьютора:</span>
              <p className="m-0">{aiTranscript}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
