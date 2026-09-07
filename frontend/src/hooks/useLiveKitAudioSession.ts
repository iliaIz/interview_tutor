import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ParticipantEvent,
  RemoteTrack,
  RemoteParticipant
} from 'livekit-client';
import { useInterviewConfig } from './useInterviewConfig';

export interface LiveAudioSessionParams {
  sessionType?: 'interview' | 'tutor' | 'system_design';
  tutorMode?: string;
  topic?: string;
  questionId?: string;
  scenarioId?: string;
  questionText?: string;
  referenceAnswer?: string;
  voice?: string;
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
  vadPauseMs?: number;
  liveModel?: string;
  tutorPersona?: string;
  persona?: string;
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  maxProbes?: number;
  deepDive?: boolean;
  liveCoaching?: boolean;
  customAnchors?: string[];
  customPrompt?: string;
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  hints?: string[];
  initialUserMessage?: string;
  sessionId?: string;
  isResumed?: boolean;
  ticket?: string;
}

export interface DialogueTurn {
  role: 'ai' | 'user' | 'system';
  text: string;
}

export interface UseLiveKitAudioSessionOptions {
  onSetupComplete?: () => void;
  onEvaluationCompleted?: (evaluation: any) => void;
  onBugSolved?: (payload: any) => void;
  onChaosInjected?: (payload: any) => void;
  onCandidateObservationRecorded?: (observation: any) => void;
  onHiringCommitteeVerdict?: (verdict: any) => void;
  onError?: (errorMsg: string) => void;
  onDisconnect?: () => void;
}

export function useLiveKitAudioSession(options: UseLiveKitAudioSessionOptions = {}) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const { config: globalConfig } = useInterviewConfig();
  const globalConfigRef = useRef(globalConfig);
  useEffect(() => {
    globalConfigRef.current = globalConfig;
  }, [globalConfig]);

  // Session State
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [isPauseHolding, setIsPauseHolding] = useState<boolean>(false);
  const [rmsDb, setRmsDb] = useState<number>(-60);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Готов к началу диалога');
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurn[]>([]);
  const [aiTranscript, setAiTranscript] = useState<string>('');

  // Stable Refs
  const roomRef = useRef<Room | null>(null);
  const attachedAudioElementsRef = useRef<HTMLMediaElement[]>([]);
  const isAiSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isMutedRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const currentParamsRef = useRef<LiveAudioSessionParams>({});
  const audioLevelIntervalRef = useRef<any>(null);

  // Screen Wake Lock API for Mobile (Android/iOS)
  const acquireWakeLock = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {}
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) {}
  };

  const disconnectSession = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    // Detach and clean up all audio elements
    for (const el of attachedAudioElementsRef.current) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch (e) {}
    }
    attachedAudioElementsRef.current = [];

    // Disconnect LiveKit Room
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch (e) {
        console.warn('Error disconnecting LiveKit room:', e);
      }
      roomRef.current = null;
    }

    await releaseWakeLock();

    setIsConnected(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsUserSpeaking(false);
    setIsPauseHolding(false);
    setRmsDb(-60);
    setRttMs(null);
    setStatusMessage('Диалог завершен');

    optionsRef.current.onDisconnect?.();
  }, []);

  const resetSessionStateOnly = useCallback(() => {
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsUserSpeaking(false);
    setIsPauseHolding(false);
    setRmsDb(-60);
  }, []);

  const startSession = useCallback(async (params: LiveAudioSessionParams = {}) => {
    try {
      if (isConnected || roomRef.current) {
        await disconnectSession();
      }

      isCleaningUpRef.current = false;
      const cfg = globalConfigRef.current;

      const effectiveVoice = params.voice || cfg.voice || 'Kore';
      const effectiveGender = params.userGender || cfg.userGender || 'female';
      const effectiveTurnMode = params.turnMode || cfg.turnMode || 'auto';
      const effectiveLiveModel = params.liveModel || cfg.liveModel || 'gemini-live-v3';

      const effectiveParams: LiveAudioSessionParams = {
        ...params,
        voice: effectiveVoice,
        userGender: effectiveGender,
        turnMode: effectiveTurnMode,
        liveModel: effectiveLiveModel
      };
      currentParamsRef.current = effectiveParams;

      setStatusMessage('⚡ Подключение к сверхбыстрому WebRTC каналу...');
      void acquireWakeLock();

      // 1. Request LiveKit token from backend
      const tokenRes = await fetch('/api/voice/livekit-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: params.sessionId,
          sessionType: params.sessionType || 'interview',
          tutorMode: params.tutorMode,
          topic: params.topic,
          questionText: params.questionText,
          questionId: params.questionId,
          referenceAnswer: params.referenceAnswer,
          voiceName: effectiveVoice,
          userGender: effectiveGender,
          liveModel: effectiveLiveModel,
          strategy: params.strategy,
          persona: params.persona,
          bugTitle: params.bugTitle,
          bugExplanation: params.bugExplanation,
          codeSnippet: params.codeSnippet,
          hints: params.hints,
          initialUserMessage: params.initialUserMessage,
          questionIndex: params.questionIndex,
          totalQuestions: params.totalQuestions
        })
      });

      if (!tokenRes.ok) {
        const errJson = await tokenRes.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${tokenRes.status}: Failed to acquire voice token`);
      }

      const { token, livekitUrl } = await tokenRes.json();

      if (isCleaningUpRef.current) return;

      // Determine client URL (fallback to window.location.hostname:7880 if relative)
      let resolvedLiveKitUrl = livekitUrl;
      if (!resolvedLiveKitUrl || resolvedLiveKitUrl.includes('127.0.0.1') || resolvedLiveKitUrl.includes('localhost')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        resolvedLiveKitUrl = `${protocol}//${window.location.hostname}:7880`;
      }

      // 2. Initialize LiveKit Room with Hardware AEC
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      roomRef.current = room;

      // Event: Remote track subscribed (AI voice audio)
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.id = `livekit-audio-${track.sid}`;
          el.style.display = 'none';
          document.body.appendChild(el);
          attachedAudioElementsRef.current.push(el);

          // Listen to actual physical audio element playback
          el.onplaying = () => {
            setIsAiSpeaking(true);
            isAiSpeakingRef.current = true;
            setStatusMessage('🗣️ Напарник говорит...');
          };

          el.onended = () => {
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsRecording(true);
            isRecordingRef.current = true;
            setStatusMessage('🎙️ Ваша очередь: говорите в микрофон...');
          };

          el.play().catch((err) => {
            console.warn('LiveKit Audio element play() error:', err);
          });

          setStatusMessage('⚡ Напарник подключен, ожидание ответа...');
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => {
          el.pause();
          el.remove();
          const idx = attachedAudioElementsRef.current.indexOf(el);
          if (idx !== -1) attachedAudioElementsRef.current.splice(idx, 1);
        });
      });

      // Event: Active speakers changed
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const hasAiSpeaker = speakers.some((s) => s.identity !== room.localParticipant.identity);
        const hasUserSpeaker = speakers.some((s) => s.identity === room.localParticipant.identity);

        setIsAiSpeaking(hasAiSpeaker);
        isAiSpeakingRef.current = hasAiSpeaker;
        setIsUserSpeaking(hasUserSpeaker);

        if (hasAiSpeaker) {
          setStatusMessage('🗣️ Напарник говорит...');
        } else if (hasUserSpeaker) {
          setStatusMessage('🎙️ Вы говорите...');
        } else {
          setStatusMessage('👂 Ожидание ответа...');
        }
      });

      // Event: Remote participant disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        if (participant.identity !== room.localParticipant.identity) {
          console.warn('AI voice agent disconnected:', participant.identity);
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
          setIsRecording(true);
          isRecordingRef.current = true;
          setStatusMessage('⚠️ Связь с напарником прервана');
        }
      });

      // Event: Local participant speaking
      room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        setIsUserSpeaking(speaking);
      });

      // Event: Data received from AI agent
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);

          if (data.type === 'transcript') {
            const transcriptText = data.text || '';
            setIsAiSpeaking(true);
            isAiSpeakingRef.current = true;
            setAiTranscript((prev) => prev + transcriptText);
            setDialogueTurns((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'ai') {
                return [...prev.slice(0, -1), { role: 'ai', text: last.text + transcriptText }];
              }
              return [...prev, { role: 'ai', text: transcriptText }];
            });
          } else if (data.type === 'turnComplete') {
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsRecording(true);
            isRecordingRef.current = true;
            setStatusMessage('🎙️ Ваша очередь: говорите в микрофон...');
          } else if (data.type === 'interrupted') {
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsRecording(true);
            isRecordingRef.current = true;
            setStatusMessage('🎙️ Вы перебили напарника: говорите...');
          } else if (data.type === 'error') {
            console.error('AI voice agent error:', data.message);
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsRecording(true);
            isRecordingRef.current = true;
            setStatusMessage(`⚠️ Ошибка: ${data.message || 'Сбой генерации речи'}`);
          }
        } catch (e) {
          console.warn('Failed to parse incoming data packet:', e);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsAiSpeaking(false);
        setIsRecording(false);
        optionsRef.current.onDisconnect?.();
      });

      // 3. Connect to WebRTC Room
      await room.connect(resolvedLiveKitUrl, token);

      // 4. Enable Local Microphone with OS Hardware AEC
      await room.localParticipant.setMicrophoneEnabled(true);

      setIsConnected(true);
      setIsRecording(true);
      isRecordingRef.current = true;
      setStatusMessage('🟢 Канал связи активен: говорите в микрофон');

      // Periodic audio level polling for UI waveform & speech stall watchdog
      let consecutiveAiSpeechStallTicks = 0;
      audioLevelIntervalRef.current = setInterval(() => {
        if (room.localParticipant) {
          const level = room.localParticipant.audioLevel; // 0.0 to 1.0
          if (level > 0.001) {
            const db = Math.round(20 * Math.log10(level));
            setRmsDb(Math.max(-60, Math.min(0, db)));
          } else {
            setRmsDb(-60);
          }
        }

        // Anti-Stall Watchdog: If UI indicates AI is speaking, but no attached element is actually playing for >6s
        if (isAiSpeakingRef.current) {
          const isAnyAudioElementPlaying = attachedAudioElementsRef.current.some(
            (el) => !el.paused && !el.ended && el.currentTime > 0
          );
          if (!isAnyAudioElementPlaying) {
            consecutiveAiSpeechStallTicks++;
            if (consecutiveAiSpeechStallTicks > 75) { // ~6 seconds without playback
              console.warn('⚡ Watchdog: AI speech detected as completed/stalled. Unlocking candidate microphone.');
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              setIsRecording(true);
              isRecordingRef.current = true;
              setStatusMessage('🎙️ Ваша очередь: говорите в микрофон или напишите в чат...');
              consecutiveAiSpeechStallTicks = 0;
            }
          } else {
            consecutiveAiSpeechStallTicks = 0;
          }
        } else {
          consecutiveAiSpeechStallTicks = 0;
        }
      }, 80);

      optionsRef.current.onSetupComplete?.();
    } catch (err: any) {
      console.error('Error starting LiveKit audio session:', err);
      setStatusMessage(`Ошибка: ${err.message || 'Не удалось подключиться'}`);
      optionsRef.current.onError?.(err.message || 'Connection error');
      await disconnectSession();
    }
  }, [isConnected, disconnectSession]);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!roomRef.current || !text.trim()) return;

    setDialogueTurns((prev) => [...prev, { role: 'user', text: text.trim() }]);
    setStatusMessage('⏳ Отправка сообщения...');

    try {
      const payload = JSON.stringify({ type: 'text_turn', text: text.trim() });
      await roomRef.current.localParticipant.publishData(new TextEncoder().encode(payload), {
        reliable: true
      });
      setIsAiSpeaking(true);
      isAiSpeakingRef.current = true;
    } catch (e: any) {
      console.error('Failed to send text turn over data channel:', e);
    }
  }, []);

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
    setStatusMessage(newMuted ? '🔇 Микрофон отключен' : '🎙️ Микрофон включен');
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    toggleMic();
  }, [toggleMic]);

  const setMuted = useCallback(async (muted: boolean) => {
    if (!roomRef.current) return;
    setIsMuted(muted);
    isMutedRef.current = muted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!muted);
  }, []);

  const triggerEndTurn = useCallback(async () => {
    if (!roomRef.current) return;
    try {
      const payload = JSON.stringify({ type: 'barge_in' });
      await roomRef.current.localParticipant.publishData(new TextEncoder().encode(payload), {
        reliable: true
      });
    } catch (e) {}
  }, []);

  const finishManualTurn = useCallback(() => {
    triggerEndTurn();
  }, [triggerEndTurn]);

  const sendCanvasDelta = useCallback(async (payload: any) => {
    if (!roomRef.current) return;
    try {
      const msg = JSON.stringify({ type: 'canvas_delta', payload });
      await roomRef.current.localParticipant.publishData(new TextEncoder().encode(msg), {
        reliable: true
      });
    } catch (e) {}
  }, []);

  const playoutManagerCompatRef = useRef({
    handleInterruption: () => {
      triggerEndTurn();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      setIsRecording(true);
      isRecordingRef.current = true;
      setStatusMessage('🎙️ Речь напарника прервана, говорите...');
    },
    setMuted: (muted: boolean) => {
      setMuted(muted);
    },
    isPlaying: () => isAiSpeakingRef.current,
    resume: async () => {}
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, [disconnectSession]);

  return {
    isConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    rttMs,
    statusMessage,
    dialogueTurns,
    aiTranscript,
    startSession,
    disconnectSession,
    resetSessionStateOnly,
    sendTextMessage,
    sendCanvasDelta,
    toggleMic,
    toggleMute,
    setMuted,
    finishManualTurn,
    triggerEndTurn,
    setStatusMessage,
    setDialogueTurns,
    setAiTranscript,
    playoutManagerRef: playoutManagerCompatRef
  };
}
