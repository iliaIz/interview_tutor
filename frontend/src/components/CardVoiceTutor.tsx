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
  MessageSquare,
  Sparkle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { BugChallenge, BugChallengeCard } from './BugChallengeCard';
import { triggerSuccessConfetti } from '../utils/confetti';
import { Question } from '../store/useAppStore';

export type TutorMode = 'deep_dive' | 'free_chat' | 'socratic' | 'eli5' | 'quick_qa' | 'bug_hunt';

interface CardVoiceTutorProps {
  question: Question;
  topicName: string;
}

const MODES: { id: TutorMode; name: string; icon: React.ComponentType<any>; badge: string; desc: string }[] = [
  {
    id: 'deep_dive',
    name: 'Под капот',
    icon: Microscope,
    badge: '🔬 JVM',
    desc: 'Разбор нюансов JVM, многопоточности, байткода и структур памяти'
  },
  {
    id: 'free_chat',
    name: 'Свободный диалог',
    icon: MessageSquare,
    badge: '💬 Без рамок',
    desc: 'Прямые, подробные ответы на любые вопросы без экзаменационных загадок'
  },
  {
    id: 'socratic',
    name: 'Сократ',
    icon: Brain,
    badge: '🏛 Вопросы',
    desc: 'Наводящие вопросы без готовых ответов для самостоятельного мышления'
  },
  {
    id: 'eli5',
    name: 'Простыми словами',
    icon: HelpCircle,
    badge: '💡 Быт',
    desc: 'Понятные ментальные модели и жизненные аналогии без занудства'
  },
  {
    id: 'quick_qa',
    name: 'Коротко',
    icon: Zap,
    badge: '⚡ Экспресс',
    desc: 'Четкий ответ за 15 секунд в двух предложениях'
  },
  {
    id: 'bug_hunt',
    name: 'Найти баг',
    icon: Bug,
    badge: '🐛 Ревью',
    desc: 'Генерация кода с ошибкой по теме вопроса и устное код-ревью'
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
    } catch (err: any) {
      console.error('Failed to init microphone worklet:', err);
      throw err;
    }
  };

  const startVoiceSession = async () => {
    try {
      setStatusMessage('Подключение к AI шлюзу...');

      // Playout Setup with gesture unlock (24kHz Web Audio + Speakerphone bridge)
      playoutManagerRef.current = new AudioPlayoutManager();
      await playoutManagerRef.current.resume();

      // Init microphone on the same unified AudioContext
      await initMicrophone();

      // WebSocket Connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsRecording(true);
        setStatusMessage('AI готов к диалогу. Говорите...');

        const setupPayload = {
          setup: {
            model: 'gemini-tts-live-v3',
            voiceName: 'Aoede',
            topic: topicName,
            sessionType: 'tutor',
            tutorMode: activeMode,
            questionText: question.question,
            referenceAnswer: question.answer,
            bugTitle: bugChallenge?.title,
            bugExplanation: bugChallenge?.bugExplanation,
            codeSnippet: bugChallenge?.codeSnippet,
            hints: bugChallenge?.hints,
            questionId: bugChallenge?.id || question.id
          }
        };

        ws.send(JSON.stringify(setupPayload));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'bug_solved') {
            setIsBugSolved(true);
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
          console.error('Error handling WebSocket message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStatusMessage('Ошибка подключения к шлюзу');
      };

      ws.onclose = () => {
        disconnectSession();
      };
    } catch (err: any) {
      console.error('Failed to start voice tutor session:', err);
      setStatusMessage('Ошибка запуска аудиосессии');
      disconnectSession();
    }
  };

  const disconnectSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch {}
      workletNodeRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current !== playoutManagerRef.current?.getContext()) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
    }
    inputAudioCtxRef.current = null;
    if (playoutManagerRef.current) {
      void playoutManagerRef.current.teardown();
      playoutManagerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsAiSpeaking(false);
    setStatusMessage('Сессия завершена');
  };

  const toggleVoiceSession = () => {
    if (isConnected) {
      disconnectSession();
    } else {
      void startVoiceSession();
    }
  };

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-br from-pastel-bg/80 via-white to-pastel-rose/20 border border-pastel-border/80 p-4 md:p-5 shadow-xs transition-all">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-xs md:text-sm text-pastel-text">
                Интерактивный AI-Тьютор
              </h3>
              <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-pastel-lavender text-pastel-accentViolet border border-pastel-accentViolet/20">
                Live Voice
              </span>
            </div>
            <p className="text-[11px] text-pastel-muted">Обсуди карточку голосом в комфортном темпе</p>
          </div>
        </div>

        {/* Action Toggle Button with Dynamic Pastel Audio Aura */}
        <button
          onClick={toggleVoiceSession}
          className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 ${
            isConnected
              ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
              : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95'
          }`}
        >
          {isConnected && (
            <span className="absolute inset-0 rounded-xl bg-rose-400/40 animate-ping opacity-75 pointer-events-none" />
          )}
          {isConnected ? (
            <>
              <MicOff className="w-3.5 h-3.5" /> Завершить диалог
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" /> Начать диалог
            </>
          )}
        </button>
      </div>

      {/* Horizontal Pill Chips for Modes */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-3 no-scrollbar">
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-pastel-text text-white shadow-xs font-bold'
                  : 'bg-white/80 text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
              }`}
              title={m.desc}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-pastel-accentRose' : 'text-pastel-muted'}`} />
              <span>{m.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                isActive ? 'bg-white/20 text-white' : 'bg-pastel-bg text-pastel-muted'
              }`}>
                {m.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode Description & Connection Status */}
      <div className="text-[11px] text-pastel-muted bg-white/70 rounded-xl px-3 py-1.5 border border-pastel-border/50 mb-3 flex items-center justify-between">
        <span className="truncate mr-2">{MODES.find((m) => m.id === activeMode)?.desc}</span>
        {isConnected && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {isAiSpeaking ? 'AI говорит...' : isRecording ? 'Слушаю вас...' : 'Канал активен'}
          </span>
        )}
      </div>

      {/* Dynamic Content: Bug Hunt Challenge or Voice Conversation Box */}
      {activeMode === 'bug_hunt' ? (
        <div className="space-y-3">
          {isLoadingBug ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-pastel-border">
              <Loader2 className="w-5 h-5 animate-spin text-pastel-accentRose mx-auto mb-2" />
              <p className="text-xs font-semibold text-pastel-muted">Генерируем кейс с ошибкой по этому вопросу...</p>
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
        /* Regular Tutor Voice Status Box */
        <div className="bg-white/90 rounded-2xl p-3.5 border border-pastel-border/70 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-pastel-text flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-pastel-accentViolet" />
              Статус диалога:
            </span>
            <span className="text-pastel-muted text-[11px]">{statusMessage}</span>
          </div>

          {/* AI Live Transcript Balloon */}
          {aiTranscript && (
            <div className="p-3 bg-pastel-lavender/30 rounded-xl border border-pastel-accentViolet/20 text-xs text-pastel-text leading-relaxed">
              <span className="font-bold text-pastel-accentViolet block mb-1 text-[11px]">Реплика AI-Тьютора:</span>
              <p className="m-0 text-xs">{aiTranscript}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default CardVoiceTutor;
