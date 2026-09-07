import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { useInterviewConfig } from './useInterviewConfig';
import { useSelectionFocusStore } from '../store/useSelectionFocusStore';
import {
  DialogueTurn,
  LiveAudioSessionOptions,
  LiveAudioSessionState,
  WhiteboardUpdatePayload,
  VoiceEvaluationResult
} from '../types/voice';

export type { DialogueTurn, LiveAudioSessionOptions, LiveAudioSessionState };

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function useLiveAudioSession(
  options: LiveAudioSessionOptions = {}
): LiveAudioSessionState {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const { config: globalConfig } = useInterviewConfig();
  const globalConfigRef = useRef(globalConfig);
  useEffect(() => {
    globalConfigRef.current = globalConfig;
  }, [globalConfig]);

  // Connection & Activity State
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isPauseHolding, setIsPauseHolding] = useState(false);
  const [thinkingStage, setThinkingStage] = useState<'idle' | 'processing' | 'delayed' | 'critical'>('idle');

  // Metrics & Dialogue
  const [rmsDb, setRmsDb] = useState<number>(-60);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Готов к началу диалога');
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurn[]>([]);
  const [aiTranscript, setAiTranscript] = useState<string>('');

  // Stable Core Refs
  const wsRef = useRef<WebSocket | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Runtime Tracking Refs
  const isAiSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isMutedRef = useRef(false);
  const isSessionPausedRef = useRef(false);
  const isUserSpeakingRef = useRef(false);
  const lastAiSpeechEndedAtRef = useRef<number>(0);
  const isServerTurnCompleteRef = useRef(false);
  const speechStartTimeRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenInTurnRef = useRef(false);
  const isFocusInjectedRef = useRef(false);
  const turnWatchdogsRef = useRef<NodeJS.Timeout[]>([]);
  const wakeLockRef = useRef<any>(null);
  const currentParamsRef = useRef<LiveAudioSessionOptions>({});
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());

  // Raw Int16 PCM chunks buffer for background Deepgram STT
  const userPcmChunksRef = useRef<Uint8Array[]>([]);

  // Helpers for AbortSignal management
  const createManagedAbort = () => {
    const controller = new AbortController();
    activeAbortControllersRef.current.add(controller);
    return {
      controller,
      signal: controller.signal,
      cleanup: () => activeAbortControllersRef.current.delete(controller)
    };
  };

  const abortAllInFlight = () => {
    for (const c of activeAbortControllersRef.current) {
      try { c.abort(); } catch {}
    }
    activeAbortControllersRef.current.clear();
  };

  // Turn Watchdogs (SOTA 2026 Resilience)
  const clearAllWatchdogs = () => {
    turnWatchdogsRef.current.forEach(clearTimeout);
    turnWatchdogsRef.current = [];
    setThinkingStage('idle');
  };

  const startTurnWatchdog = () => {
    clearAllWatchdogs();
    setThinkingStage('processing');

    const t1 = setTimeout(() => {
      if (isThinkingRef.current) setThinkingStage('delayed');
    }, 3500);

    const t2 = setTimeout(() => {
      if (isThinkingRef.current) setThinkingStage('critical');
    }, 6500);

    const t3 = setTimeout(() => {
      if (isThinkingRef.current) {
        console.warn('⏱️ 10s Turn Watchdog: soft recovery.');
        setIsThinking(false);
        isThinkingRef.current = false;
        setThinkingStage('idle');
        setIsRecording(true);
        isRecordingRef.current = true;
      }
    }, 10000);

    turnWatchdogsRef.current = [t1, t2, t3];
  };

  // Screen WakeLock Management
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}
  };

  // Mobile VisibilityChange handler
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        if (playoutManagerRef.current) {
          await playoutManagerRef.current.resume();
        }
        if (isConnected && !wakeLockRef.current) {
          void acquireWakeLock();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', releaseWakeLock);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', releaseWakeLock);
      void releaseWakeLock();
    };
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortAllInFlight();
      clearAllWatchdogs();
      void stopSessionInternal();
    };
  }, []);

  // Complete candidate's turn & trigger AI processing
  const finishManualTurn = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsPauseHolding(false);
    hasSpokenInTurnRef.current = false;
    setIsUserSpeaking(false);
    isUserSpeakingRef.current = false;
    speechStartTimeRef.current = null;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ clientContent: { turnComplete: true } }));
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsThinking(true);
      isThinkingRef.current = true;
      startTurnWatchdog();
      setStatusMessage('⏳ ИИ осмысливает ответ...');
    }
  }, []);

  // Tactile Barge-In
  const handleBargeIn = useCallback((reason?: string) => {
    if (isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false)) {
      playoutManagerRef.current?.handleInterruption();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      lastAiSpeechEndedAtRef.current = Date.now();
      clearAllWatchdogs();
      setIsThinking(false);
      isThinkingRef.current = false;
      setIsRecording(true);
      isRecordingRef.current = true;
      hasSpokenInTurnRef.current = false;

      // Reset AudioWorklet internal buffer
      workletNodeRef.current?.port.postMessage({ type: 'RESET' });

      // Signal upstream Gemini Live Proxy to abort the monologue
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: reason || '[КАНДИДАТ ПРЕРВАЛ РЕЧЬ (BARGE-IN)]: Передай слово кандидату.' }]
                  }
                ],
                turnComplete: false
              }
            })
          );
        } catch (e) {
          console.warn('Failed to dispatch barge-in frame:', e);
        }
      }
    }
  }, []);

  // Initialize Microphone & AudioWorklet Node
  const initMicrophone = async () => {
    if (mediaStreamRef.current && workletNodeRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
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
          isMutedRef.current || isSessionPausedRef.current || !isRecordingRef.current;

        if (metrics && !isAiCurrentlySpeaking && !isReverbCooldownActive && !isSessionMutedOrPaused) {
          setRmsDb(metrics.rmsDb);

          const isSpeech =
            metrics.speechDetected ||
            metrics.rmsDb > (metrics.noiseFloorDb ? metrics.noiseFloorDb + 7.5 : -42);

          if (isSpeech) {
            if (!speechStartTimeRef.current) {
              speechStartTimeRef.current = Date.now();
            }
            const duration = Date.now() - speechStartTimeRef.current;
            if (duration >= 150) {
              if (!hasSpokenInTurnRef.current) {
                hasSpokenInTurnRef.current = true;
                if (!isFocusInjectedRef.current) {
                  isFocusInjectedRef.current = true;
                  const focus = useSelectionFocusStore.getState().activeFocus;
                  if (focus && wsRef.current?.readyState === WebSocket.OPEN) {
                    const prompt =
                      focus.zone === 'code'
                        ? `[ФОКУС ВНИМАНИЯ: ${focus.revisionTitle || 'код'}]:\n\`\`\`${focus.language || 'java'}\n${focus.text}\n\`\`\``
                        : `[ФОКУС ВНИМАНИЯ: «${focus.text}»]`;
                    wsRef.current.send(
                      JSON.stringify({
                        clientContent: { turns: [{ role: 'user', parts: [{ text: prompt }] }], turnComplete: false }
                      })
                    );
                    useSelectionFocusStore.getState().clearFocus();
                  }
                }
              }
            }
            setIsUserSpeaking(true);
            isUserSpeakingRef.current = true;
            setIsPauseHolding(false);
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else {
            speechStartTimeRef.current = null;
            if (isUserSpeakingRef.current && hasSpokenInTurnRef.current) {
              setIsPauseHolding(true);
              const turnMode = currentParamsRef.current.turnMode || globalConfigRef.current.turnMode || 'auto';
              if (turnMode === 'auto' && !silenceTimerRef.current) {
                const pauseMs = currentParamsRef.current.vadPauseMs || globalConfigRef.current.vadPauseMs || 1500;
                silenceTimerRef.current = setTimeout(() => {
                  finishManualTurn();
                }, pauseMs);
              }
            }
          }
        }

        // Stream PCM Little-Endian chunk to WebSocket and accumulate for background STT
        if (
          pcmBuffer &&
          wsRef.current?.readyState === WebSocket.OPEN &&
          !isAiCurrentlySpeaking &&
          !isReverbCooldownActive &&
          !isSessionMutedOrPaused
        ) {
          const uint8 = new Uint8Array(pcmBuffer);
          userPcmChunksRef.current.push(uint8);

          const base64Audio = uint8ArrayToBase64(uint8);
          wsRef.current.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Audio }]
              }
            })
          );
        }
      }
    };

    sourceNode.connect(workletNode);
  };

  // Internal Stop / Cleanup
  const stopSessionInternal = async () => {
    clearAllWatchdogs();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.postMessage({ type: 'RESET' });
        workletNodeRef.current.disconnect();
      } catch {}
      workletNodeRef.current = null;
    }

    if (mediaStreamSourceRef.current) {
      try { mediaStreamSourceRef.current.disconnect(); } catch {}
      mediaStreamSourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (playoutManagerRef.current) {
      playoutManagerRef.current.clearQueue();
    }

    await releaseWakeLock();
    setIsConnected(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsThinking(false);
    isThinkingRef.current = false;
    setIsUserSpeaking(false);
    isUserSpeakingRef.current = false;
    setIsPauseHolding(false);
  };

  // Start Live Audio Session
  const startSession = useCallback(
    async (overrideParams: Partial<LiveAudioSessionOptions> = {}) => {
      await stopSessionInternal();

      // Ambient Crosstalk Suppression: pause any running HTML5 audio players on the page
      document.querySelectorAll('audio').forEach((el) => {
        try { el.pause(); } catch {}
      });

      userPcmChunksRef.current = [];
      const merged: LiveAudioSessionOptions = {
        ...optionsRef.current,
        ...overrideParams
      };
      currentParamsRef.current = merged;

      // Initialize Audio Playout Manager
      const playout = new AudioPlayoutManager();
      playout.onPlaybackFinished = () => {
        if (isServerTurnCompleteRef.current) {
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
          setIsThinking(false);
          isThinkingRef.current = false;
          clearAllWatchdogs();
          lastAiSpeechEndedAtRef.current = Date.now();
          setIsRecording(true);
          isRecordingRef.current = true;
          hasSpokenInTurnRef.current = false;
          isFocusInjectedRef.current = false;
        }
      };
      playoutManagerRef.current = playout;
      await playout.resume();
      void acquireWakeLock();

      // Build WebSocket Query Parameters
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const params = new URLSearchParams({
        sessionType: merged.sessionType || 'interview',
        tutorMode: merged.tutorMode || 'deep_dive',
        topic: merged.topic || 'Java Spring Engineering',
        questionId: merged.questionId || '',
        questionText: merged.questionText || '',
        referenceAnswer: merged.referenceAnswer || '',
        voice: merged.voice || globalConfigRef.current.voice || 'Kore',
        userGender: merged.userGender || globalConfigRef.current.userGender || 'female',
        turnMode: merged.turnMode || globalConfigRef.current.turnMode || 'auto',
        strategy: merged.strategy || globalConfigRef.current.strategy || 'adaptive_probing',
        persona: merged.persona || merged.tutorPersona || globalConfigRef.current.persona || 'mentor',
        targetGrade: merged.targetGrade || globalConfigRef.current.targetGrade || 'L5_SENIOR',
        maxProbes: String(merged.maxProbes || globalConfigRef.current.maxProbes || 3),
        deepDive: String(!!merged.deepDive || (merged.sessionType === 'tutor' && merged.tutorMode === 'deep_dive')),
        liveCoaching: String(!!merged.liveCoaching || merged.sessionType === 'tutor'),
        questionIndex: String(merged.questionIndex ?? 0),
        totalQuestions: String(merged.totalQuestions ?? 1),
        isRetry: String(!!merged.isRetry),
        isResumed: String(!!merged.isResumed)
      });

      if (merged.bugTitle) params.set('bugTitle', merged.bugTitle);
      if (merged.bugExplanation) params.set('bugExplanation', merged.bugExplanation);
      if (merged.codeSnippet) params.set('codeSnippet', merged.codeSnippet);
      if (merged.hints) params.set('hints', JSON.stringify(merged.hints));
      if (merged.initialUserMessage) params.set('initialUserMessage', merged.initialUserMessage);
      if (merged.sessionId) params.set('sessionId', merged.sessionId);

      // SOTA 2026: Prefetch One-Time WS Ticket for Zero-Trust Handshake
      const { signal, cleanup } = createManagedAbort();
      try {
        const ticketRes = await fetch('/api/auth/ws-ticket', {
          method: 'POST',
          credentials: 'include',
          signal
        });
        if (ticketRes.ok) {
          const tData = await ticketRes.json();
          if (tData.ticket) params.set('ticket', tData.ticket);
        }
      } catch (e) {
        console.warn('Could not prefetch WS ticket, relying on cookie auth fallback:', e);
      } finally {
        cleanup();
      }

      const wsUrl = `${protocol}//${host}/ws/live?${params.toString()}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatusMessage('🎙️ Шлюз активен');
        void initMicrophone();
      };

      ws.onmessage = async (event) => {
        try {
          let textPayload = '';
          if (typeof event.data === 'string') textPayload = event.data;
          else if (event.data instanceof Blob) textPayload = await event.data.text();
          else if (event.data instanceof ArrayBuffer) textPayload = new TextDecoder().decode(event.data);

          if (!textPayload) return;
          const data = JSON.parse(textPayload);

          // Heartbeat Keepalive
          if (data.type === 'ping') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
            }
            return;
          }

          if (data.type === 'pong_ack') {
            if (typeof data.rtt === 'number') setRttMs(data.rtt);
            return;
          }

          if (data.type === 'tool_executing') {
            setThinkingStage('processing');
            clearAllWatchdogs();
            const t1 = setTimeout(() => { if (isThinkingRef.current) setThinkingStage('delayed'); }, 8000);
            turnWatchdogsRef.current = [t1];
            return;
          }

          // Tool Call Handlers
          if (data.type === 'whiteboard_update') {
            optionsRef.current.onWhiteboardUpdate?.(data.payload as WhiteboardUpdatePayload);
            return;
          }

          if (data.type === 'evaluation_completed' || data.type === 'evaluation_result') {
            clearAllWatchdogs();
            optionsRef.current.onEvaluationCompleted?.(data.payload as VoiceEvaluationResult);
            return;
          }

          if (data.type === 'bug_solved') {
            optionsRef.current.onBugSolved?.(data.payload);
            return;
          }

          if (data.type === 'chaos_injected') {
            optionsRef.current.onChaosInjected?.(data.payload);
            return;
          }

          if (data.type === 'candidate_observation') {
            optionsRef.current.onCandidateObservationRecorded?.(data.payload);
            return;
          }

          if (data.type === 'hiring_committee_verdict') {
            optionsRef.current.onHiringCommitteeVerdict?.(data.payload);
            return;
          }

          // Realtime Audio & Turn Taking from Gemini Live
          if (data.serverContent) {
            const { modelTurn, turnComplete, interrupted } = data.serverContent;

            if (interrupted) {
              playout.handleInterruption();
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              setIsRecording(true);
              isRecordingRef.current = true;
              return;
            }

            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                const pcmData = part.inlineData?.data || (part as any).inline_data?.data;
                if (pcmData) {
                  isServerTurnCompleteRef.current = false;
                  setIsAiSpeaking(true);
                  isAiSpeakingRef.current = true;
                  setIsThinking(false);
                  isThinkingRef.current = false;
                  clearAllWatchdogs();
                  playout.enqueuePcmChunk(pcmData);
                }
                if (part.text) {
                  setAiTranscript((prev) => prev + part.text);
                  setDialogueTurns((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'ai') {
                      return [...prev.slice(0, -1), { role: 'ai', text: last.text + part.text }];
                    }
                    return [...prev, { role: 'ai', text: part.text }];
                  });
                }
              }
            }

            if (turnComplete) {
              isServerTurnCompleteRef.current = true;
              playout.notifyTurnComplete();
              if (!playout.isPlaying()) {
                setIsAiSpeaking(false);
                isAiSpeakingRef.current = false;
                setIsThinking(false);
                isThinkingRef.current = false;
                clearAllWatchdogs();
                lastAiSpeechEndedAtRef.current = Date.now();
                setIsRecording(true);
                isRecordingRef.current = true;
                hasSpokenInTurnRef.current = false;
                isFocusInjectedRef.current = false;
              }
            }
          }
        } catch (err) {
          console.error('WebSocket parse error:', err);
        }
      };

      ws.onerror = (e) => {
        optionsRef.current.onError?.('Ошибка шлюза аудиосессии');
      };

      ws.onclose = () => {
        setIsConnected(false);
        optionsRef.current.onDisconnect?.();
      };
    },
    []
  );

  // Stop Session Public API
  const stopSession = useCallback(async () => {
    await stopSessionInternal();
  }, []);

  // Toggle Mute / Mic
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      return next;
    });
  }, []);

  // Pause / Resume Session
  const pauseSession = useCallback(() => {
    setIsSessionPaused(true);
    isSessionPausedRef.current = true;
    if (playoutManagerRef.current) void playoutManagerRef.current.suspend();
  }, []);

  const resumeSession = useCallback(() => {
    setIsSessionPaused(false);
    isSessionPausedRef.current = false;
    if (playoutManagerRef.current) playoutManagerRef.current.resume();
  }, []);

  // Send Text Message into Voice Dialogue
  const sendTextMessage = useCallback(async (text: string, displayText?: string) => {
    handleBargeIn('Кандидат отправил текстовую реплику');
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsThinking(true);
    isThinkingRef.current = true;
    startTurnWatchdog();

    if (displayText || text) {
      setDialogueTurns((prev) => [...prev, { role: 'user', text: displayText || text }]);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text }] }],
            turnComplete: true
          }
        })
      );
    }
  }, [handleBargeIn]);

  // Inject Code Revision Context Frame (Silent Grounding)
  const injectCodeRevisionGrounding = useCallback((title: string, code: string, language = 'java') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: `📌 [КОНТЕКСТ ЭКРАНА: ВЕРСИЯ "${title}"]:\n\`\`\`${language}\n${code}\n\`\`\`\n(Системная директива: кандидат сейчас смотрит на эту ревизию кода на экране. Учитывай код в следующем ответе).`
                  }
                ]
              }
            ],
            turnComplete: false
          }
        })
      );
    }
  }, []);

  // Send Canvas Delta (System Design)
  const sendCanvasDelta = useCallback((payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: `[SYSTEM DESIGN CANVAS UPDATE]: Кандидат обновил схему архитектуры:\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
                  }
                ]
              }
            ],
            turnComplete: false
          }
        })
      );
    }
  }, []);

  // Get Recorded PCM Base64 for Deepgram STT
  const getRecordedPcmBase64 = useCallback((): string => {
    if (userPcmChunksRef.current.length === 0) return '';
    const totalLength = userPcmChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of userPcmChunksRef.current) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return uint8ArrayToBase64(combined);
  }, []);

  const clearRecordedPcm = useCallback(() => {
    userPcmChunksRef.current = [];
  }, []);

  return {
    isConnected,
    isAiSpeaking,
    isRecording,
    isThinking,
    isMuted,
    isSessionPaused,
    isUserSpeaking,
    isPauseHolding,
    thinkingStage,
    rmsDb,
    rttMs,
    statusMessage,
    dialogueTurns,
    aiTranscript,
    startSession,
    stopSession,
    disconnectSession: stopSession,
    toggleMic: toggleMute,
    toggleMute,
    pauseSession,
    resumeSession,
    handleBargeIn,
    finishManualTurn,
    sendTextMessage,
    injectCodeRevisionGrounding,
    sendCanvasDelta,
    getRecordedPcmBase64,
    clearRecordedPcm,
    playoutManagerRef
  };
}
