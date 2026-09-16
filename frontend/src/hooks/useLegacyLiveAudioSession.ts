import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { useInterviewConfig } from './useInterviewConfig';
import { useAppStore } from '../store/useAppStore';

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
  challengeCategory?: string;
  challengeTrack?: string;
  challengeDomain?: string;
  activeCodeArtifact?: { id?: string; title?: string; language?: string; code?: string };
  codeRevisionsSummary?: Array<{ id: string; title: string }>;
}

export interface DialogueTurn {
  role: 'ai' | 'user' | 'system';
  text: string;
}

export interface UseLiveAudioSessionOptions {
  onSetupComplete?: () => void;
  onEvaluationCompleted?: (evaluation: any) => void;
  onBugSolved?: (payload: any) => void;
  onChaosInjected?: (payload: any) => void;
  onCandidateObservationRecorded?: (observation: any) => void;
  onHiringCommitteeVerdict?: (verdict: any) => void;
  onWhiteboardUpdate?: (payload: any) => void;
  onError?: (errorMsg: string) => void;
  onDisconnect?: () => void;
}

export function useLiveAudioSession(options: UseLiveAudioSessionOptions = {}) {
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
  const wsRef = useRef<WebSocket | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const isAiSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isMutedRef = useRef(false);
  const lastAiSpeechEndedAtRef = useRef<number>(0);
  const isCleaningUpRef = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const currentParamsRef = useRef<LiveAudioSessionParams>({});
  const isServerTurnCompleteRef = useRef(false);
  const interactionStatusRef = useRef<'IDLE' | 'IN_PROGRESS'>('IDLE');
  const pendingTextMessageRef = useRef<string | null>(null);
  const resumeAttemptsRef = useRef<number>(0);

  // VAD & Turn Taking Refs
  const speechStartTimeRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const hasSpokenInTurnRef = useRef<boolean>(false);
  const isUserSpeakingRef = useRef<boolean>(false);

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

  // Auto-resume audio on visibility change
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        if (playoutManagerRef.current) {
          await playoutManagerRef.current.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      void releaseWakeLock();
    };
  }, []);

  // Sync ref flags
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  /**
   * Safe URL and Port Resolution (handles production Nginx proxy & direct backend mapping)
   */
  const resolveWsUrl = (params: LiveAudioSessionParams): string => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let hostWithPort = window.location.host;
    if (window.location.port === '8090') {
      hostWithPort = `${window.location.hostname}:8091`;
    }

    const cfg = globalConfigRef.current;
    const effectiveVoice = params.voice || cfg.voice || 'Kore';
    const effectiveGender = params.userGender || cfg.userGender || 'female';
    const effectiveTurnMode = params.turnMode || cfg.turnMode || 'auto';
    const effectiveLiveModel = params.liveModel || cfg.liveModel || 'gemini-live-v3';
    const effectiveVadPauseMs = params.vadPauseMs ?? cfg.vadPauseMs ?? 1800;

    const query = new URLSearchParams();
    if (params.sessionType) query.set('sessionType', params.sessionType);
    if (params.tutorMode) query.set('tutorMode', params.tutorMode);
    if (params.topic) query.set('topic', params.topic);
    if (params.questionId) query.set('questionId', params.questionId);
    if (params.questionText) query.set('questionText', params.questionText);
    if (params.referenceAnswer) query.set('referenceAnswer', params.referenceAnswer);
    query.set('voice', effectiveVoice);
    query.set('userGender', effectiveGender);
    query.set('turnMode', effectiveTurnMode);
    query.set('liveModel', effectiveLiveModel);
    query.set('vadPauseMs', String(effectiveVadPauseMs));

    if (params.strategy) query.set('strategy', params.strategy);
    if (params.maxProbes !== undefined) query.set('maxProbes', String(params.maxProbes));
    if (params.deepDive !== undefined) query.set('deepDive', String(params.deepDive));
    if (params.liveCoaching !== undefined) query.set('liveCoaching', String(params.liveCoaching));
    if (params.customAnchors && params.customAnchors.length > 0) {
      query.set('customAnchors', JSON.stringify(params.customAnchors));
    }
    if (params.customPrompt) query.set('customPrompt', params.customPrompt);
    if (params.questionIndex !== undefined) query.set('questionIndex', String(params.questionIndex));
    if (params.totalQuestions !== undefined) query.set('totalQuestions', String(params.totalQuestions));
    if (params.isRetry !== undefined) query.set('isRetry', String(params.isRetry));
    if (params.bugTitle) query.set('bugTitle', params.bugTitle);
    if (params.bugExplanation) query.set('bugExplanation', params.bugExplanation);
    if (params.codeSnippet) query.set('codeSnippet', params.codeSnippet);
    if (params.activeCodeArtifact) {
      query.set('activeCodeArtifact', JSON.stringify(params.activeCodeArtifact));
    }
    if (params.codeRevisionsSummary && params.codeRevisionsSummary.length > 0) {
      query.set('codeRevisionsSummary', JSON.stringify(params.codeRevisionsSummary));
    }
    if (params.hints && params.hints.length > 0) {
      query.set('hints', JSON.stringify(params.hints));
    }
    if (params.initialUserMessage) {
      query.set('initialUserMessage', params.initialUserMessage);
    }
    if (params.sessionId) {
      query.set('sessionId', params.sessionId);
    }
    if (params.isResumed !== undefined) query.set('isResumed', String(params.isResumed));
    if (params.ticket) query.set('ticket', params.ticket);
    if (params.challengeCategory) query.set('challengeCategory', params.challengeCategory);
    if (params.challengeTrack) query.set('challengeTrack', params.challengeTrack);
    if (params.challengeDomain) query.set('challengeDomain', params.challengeDomain);
    if (params.tutorPersona) query.set('persona', params.tutorPersona);
    else if (params.persona) query.set('persona', params.persona);

    return `${protocol}//${hostWithPort}/ws/live?${query.toString()}`;
  };

  /**
   * Completes candidate's current speaking turn and triggers AI response over WebSocket
   */
  const triggerEndTurn = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
    setIsPauseHolding(false);
    hasSpokenInTurnRef.current = false;
    setIsUserSpeaking(false);
    isUserSpeakingRef.current = false;
    speechStartTimeRef.current = null;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const turnCompleteMsg = {
        clientContent: {
          turnComplete: true
        }
      };
      wsRef.current.send(JSON.stringify(turnCompleteMsg));
      console.log('📤 Sent clientContent.turnComplete to Gemini Live');
      setStatusMessage('⏳ ИИ осмысливает ответ...');
    }
  }, []);

  /**
   * Lazy Microphone Hardware Initialization (Runs asynchronously upon setupComplete)
   */
  const initMicrophoneHardware = async () => {
    try {
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
            isMutedRef.current || !isRecordingRef.current;

          // Dynamic VAD metrics from AudioWorklet
          if (metrics && !isAiCurrentlySpeaking && !isReverbCooldownActive && !isSessionMutedOrPaused) {
            setRmsDb(metrics.rmsDb);

            const isSpeech =
              metrics.speechDetected ||
              metrics.rmsDb > (metrics.noiseFloorDb ? metrics.noiseFloorDb + 7.5 : -42);

            if (isSpeech) {
              if (!speechStartTimeRef.current) {
                speechStartTimeRef.current = Date.now();
              }
              const speechDuration = Date.now() - speechStartTimeRef.current;
              if (speechDuration >= 150) {
                hasSpokenInTurnRef.current = true;
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
              if (hasSpokenInTurnRef.current) {
                setIsUserSpeaking(false);
                isUserSpeakingRef.current = false;
                const turnMode = currentParamsRef.current.turnMode || 'auto';
                if (turnMode === 'auto') {
                  setIsPauseHolding(true);
                  if (!silenceTimerRef.current) {
                    const vadPauseMs = currentParamsRef.current.vadPauseMs ?? 1800;
                    silenceTimerRef.current = setTimeout(() => {
                      setIsPauseHolding(false);
                      silenceTimerRef.current = null;
                    }, vadPauseMs);
                  }
                }
              }
            }
          } else if (isAiCurrentlySpeaking) {
            if (isUserSpeakingRef.current) {
              setIsUserSpeaking(false);
              isUserSpeakingRef.current = false;
            }
          }

          // Continuous Smooth Realtime Streaming (SOTA 2026 Invariant):
          // Stream standard 100ms PCM chunks while candidate is recording and AI is not speaking.
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

      const gainAnchor = audioCtx.createGain();
      gainAnchor.gain.value = 0.0;
      sourceNode.connect(workletNode);
      workletNode.connect(gainAnchor);
      gainAnchor.connect(audioCtx.destination);
    } catch (err: any) {
      console.warn('Microphone hardware init warning:', err);
    }
  };

  /**
   * Start Live Audio Session (Directly triggered inside user gesture)
   */
  const startSession = useCallback(async (params: LiveAudioSessionParams) => {
    try {
      const cfg = globalConfigRef.current;
      const effectiveVoice = params.voice || cfg.voice || 'Kore';
      const effectiveGender = params.userGender || cfg.userGender || 'female';
      const effectiveTurnMode = params.turnMode || cfg.turnMode || 'auto';
      const effectiveLiveModel = params.liveModel || cfg.liveModel || 'gemini-live-v3';
      const effectiveVadPauseMs = params.vadPauseMs ?? cfg.vadPauseMs ?? 1800;

      const effectiveParams: LiveAudioSessionParams = {
        ...params,
        voice: effectiveVoice,
        userGender: effectiveGender,
        turnMode: effectiveTurnMode,
        liveModel: effectiveLiveModel,
        vadPauseMs: effectiveVadPauseMs
      };
      currentParamsRef.current = effectiveParams;
      isCleaningUpRef.current = false;
      setStatusMessage('Подключение к голосовому каналу...');

      // 0. Acquire Screen Wake Lock for mobile devices
      void acquireWakeLock();

      // Zero-Trust WebSocket Ticket prefetch with graceful cookie fallback
      let ticketParam = '';
      try {
        const ticketRes = await fetch('/api/auth/ws-ticket', {
          method: 'POST',
          credentials: 'include'
        });
        if (ticketRes.ok) {
          const ticketData = await ticketRes.json();
          if (ticketData.ticket) {
            ticketParam = ticketData.ticket;
            effectiveParams.ticket = ticketParam;
            currentParamsRef.current = effectiveParams;
          }
        }
      } catch (e) {
        console.warn('Could not prefetch WS ticket in useLiveAudioSession, relying on cookie auth:', e);
      }

      if (isCleaningUpRef.current) return;

      // 1. Initialize & Resume AudioPlayoutManager directly within user gesture!
      let playoutManager = playoutManagerRef.current;
      if (!playoutManager) {
        playoutManager = new AudioPlayoutManager();
        playoutManagerRef.current = playoutManager;
      }
      playoutManager.setMuted(isMutedRef.current);
      playoutManager.onPlaybackFinished = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isCleaningUpRef.current) {
          const isInteractionIdle = !interactionStatusRef.current || interactionStatusRef.current === 'IDLE';
          // Dual-Sided Handshake: only transition to recording when terminal server turnComplete has arrived
          if (isServerTurnCompleteRef.current && isInteractionIdle) {
            setIsAiSpeaking(false);
            isAiSpeakingRef.current = false;
            setIsRecording(true);
            isRecordingRef.current = true;
            setStatusMessage('🎙️ Ваша очередь: говорите в микрофон или напишите в чат...');
          }
        }
      };
      await playoutManager.resume();

      setIsAiSpeaking(true);
      isAiSpeakingRef.current = true;
      setIsRecording(false);
      isRecordingRef.current = false;
      isServerTurnCompleteRef.current = false;

      if (params.initialUserMessage) {
        setDialogueTurns([{ role: 'user', text: params.initialUserMessage }]);
      } else {
        setDialogueTurns([]);
      }

      // 2. Open WebSocket
      const wsUrl = resolveWsUrl(effectiveParams);
      console.log('⚡ Connecting Live Audio WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatusMessage('AI готовится к ответу...');

        // Drain pending text message queued while WebSocket was connecting
        if (pendingTextMessageRef.current) {
          const queued = pendingTextMessageRef.current;
          pendingTextMessageRef.current = null;
          const turnFrame = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: queued }]
                }
              ],
              turnComplete: true
            }
          };
          ws.send(JSON.stringify(turnFrame));
        }
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

          // Heartbeat keepalive handling
          if (data.type === 'ping') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
            }
            return;
          }

          if (data.type === 'pong_ack') {
            if (typeof data.rtt === 'number') {
              setRttMs(data.rtt);
            }
            return;
          }

          if (data.type === 'thinking_delay') {
            setStatusMessage('⏳ ИИ генерирует развернутый ответ (задержка upstream)...');
            return;
          }

          if (data.type === 'upstream_reconnecting') {
            setStatusMessage(`🔄 Синхронизация связи со шлюзом (попытка ${data.attempt || 1}/${data.maxAttempts || 3})...`);
            return;
          }

          if (data.type === 'upstream_ready') {
            setStatusMessage('🎙️ Связь восстановлена: говорите в микрофон...');
            setIsRecording(true);
            isRecordingRef.current = true;
            return;
          }

          if (data.type === 'setupComplete') {
            resumeAttemptsRef.current = 0;
            setStatusMessage('🔊 AI говорит...');
            // Lazy warm-up mic in background without interrupting playback
            void initMicrophoneHardware();
            optionsRef.current.onSetupComplete?.();
            return;
          }

          if (data.type === 'evaluation_completed') {
            optionsRef.current.onEvaluationCompleted?.(data.evaluation);
            return;
          }

          if (data.type === 'bug_solved') {
            optionsRef.current.onBugSolved?.(data.payload);
            return;
          }

          if (data.type === 'chaos_injected') {
            optionsRef.current.onChaosInjected?.(data);
            return;
          }

          if (data.type === 'candidate_observation_recorded') {
            optionsRef.current.onCandidateObservationRecorded?.(data.observation);
            return;
          }

          if (data.type === 'hiring_committee_verdict') {
            optionsRef.current.onHiringCommitteeVerdict?.(data);
            return;
          }

          if (data.type === 'whiteboard_update') {
            useAppStore.getState().setWhiteboardState(data.payload);
            optionsRef.current.onWhiteboardUpdate?.(data.payload);
            return;
          }

          if (data.error) {
            setStatusMessage(`❌ ${data.error}`);
            optionsRef.current.onError?.(data.error);
            return;
          }

          if (data.serverContent) {
            if (data.serverContent.interactionStatus) {
              interactionStatusRef.current = data.serverContent.interactionStatus;
            }

            // Barge-in interruption
            if (data.serverContent.interrupted) {
              const isPlaying = playoutManagerRef.current?.isPlaying() ?? false;
              if (isPlaying && !isRecordingRef.current) {
                console.warn('🛡️ Suppressed false server-side Barge-In interruption in session hook.');
                return;
              }
              interactionStatusRef.current = 'IDLE';
              playoutManagerRef.current?.handleInterruption();
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              isServerTurnCompleteRef.current = false;
              lastAiSpeechEndedAtRef.current = Date.now();
              setDialogueTurns((prev) => [
                ...prev,
                { role: 'system', text: '⚡ Речь прервана кандидатом (Barge-in).' }
              ]);
            }

            // Model Speech turn
            if (data.serverContent.modelTurn?.parts) {
              isServerTurnCompleteRef.current = false;
              // SOTA Protection: In manual mode, if candidate is recording and has not committed turn, suppress modelTurn
              const isManualMode = (currentParamsRef.current.turnMode || 'auto') === 'manual';
              if (isManualMode && isRecordingRef.current) {
                console.warn('🛡️ Suppressed unprompted server modelTurn during candidate manual reflection.');
                return;
              }

              setIsAiSpeaking(true);
              isAiSpeakingRef.current = true;
              setIsRecording(false);
              isRecordingRef.current = false;
              setIsUserSpeaking(false);
              isUserSpeakingRef.current = false;
              setIsPauseHolding(false);
              hasSpokenInTurnRef.current = false;
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
              setStatusMessage('🔊 AI говорит...');

              for (const part of data.serverContent.modelTurn.parts) {
                // SOTA 2026: Isolate reasoning thought parts from candidate audio playout
                if ((part as any).thought) {
                  console.log('🧠 [THOUGHT_PART] Filtered reasoning thought token from audio playout in session hook');
                  continue;
                }

                if (part.text) {
                  setAiTranscript((prev) => (prev ? `${prev} ${part.text}` : part.text));
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

            // Turn Completed on server -> Wait for AudioPlayoutManager queue to drain or activate mic immediately
            if (data.serverContent.turnComplete) {
              const isInteractionIdle = !data.serverContent.interactionStatus || data.serverContent.interactionStatus === 'IDLE';

              if (isInteractionIdle) {
                interactionStatusRef.current = 'IDLE';
                isServerTurnCompleteRef.current = true;
                playoutManagerRef.current?.notifyTurnComplete();
                lastAiSpeechEndedAtRef.current = Date.now();
                hasSpokenInTurnRef.current = false;
                setIsPauseHolding(false);
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
                }
                console.log('AI terminal turn complete on server. Waiting for AudioPlayoutManager to drain in useLiveAudioSession...');

                if (!playoutManagerRef.current?.isPlaying() && !isCleaningUpRef.current) {
                  setIsAiSpeaking(false);
                  isAiSpeakingRef.current = false;
                  setIsRecording(true);
                  isRecordingRef.current = true;
                  setStatusMessage('🎙️ Ваша очередь: говорите в микрофон или напишите в чат...');
                }
              } else {
                console.log(`⏳ Conversational filler complete in hook, but interactionStatus=${data.serverContent.interactionStatus}. Reasoning continues...`);
                isServerTurnCompleteRef.current = false;
                setStatusMessage('🧠 AI рассуждает (Extended Thinking)...');
              }
            }
          }
        } catch (e) {
          console.error('Error handling WebSocket message in useLiveAudioSession:', e);
        }
      };

      ws.onclose = (ev) => {
        console.log('Live Audio WS closed:', ev.code, ev.reason);
        setIsConnected(false);
        setIsRecording(false);
        isRecordingRef.current = false;

        // Auto-reconnect if dropped unexpectedly (e.g. transient network drop)
        const isDeliberate = isCleaningUpRef.current || (ev.code === 1000 && ev.reason === 'client_abort');
        if (!isDeliberate && currentParamsRef.current && resumeAttemptsRef.current < 3) {
          resumeAttemptsRef.current++;
          setStatusMessage(`🔄 Переподключение к шлюзу (попытка ${resumeAttemptsRef.current}/3)...`);
          setTimeout(() => {
            if (!isCleaningUpRef.current && currentParamsRef.current) {
              const resumeParams: LiveAudioSessionParams = {
                ...currentParamsRef.current,
                isResumed: true
              };
              void startSession(resumeParams);
            }
          }, 800);
          return;
        }

        // Drain Phase: Don't abruptly kill playback if audio is still playing
        if (playoutManagerRef.current?.isPlaying()) {
          setStatusMessage('Завершение воспроизведения...');
        } else {
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
          setStatusMessage('Сессия завершена');
        }

        optionsRef.current.onDisconnect?.();
      };

      ws.onerror = (err) => {
        console.error('Live Audio WS error:', err);
        setStatusMessage('Ошибка подключения к шлюзу');
        optionsRef.current.onError?.('Ошибка подключения к шлюзу');
      };
    } catch (err: any) {
      console.error('Failed to start Live Audio session:', err);
      setStatusMessage('Ошибка запуска аудиосессии');
      optionsRef.current.onError?.(err?.message || 'Ошибка запуска');
    }
  }, []);

  /**
   * Send text message or breakpoint directive into the live turn stream
   */
  const sendTextMessage = useCallback((text: string, displayText?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('Live Audio WS is connecting, queueing pending text message...');
      pendingTextMessageRef.current = text;
      if (displayText) {
        setDialogueTurns((prev) => [...prev, { role: 'user', text: displayText }]);
      }
      return;
    }
    const turnFrame = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }]
          }
        ],
        turnComplete: true
      }
    };
    wsRef.current.send(JSON.stringify(turnFrame));
    if (displayText) {
      setDialogueTurns((prev) => [...prev, { role: 'user', text: displayText }]);
    }
  }, []);

  /**
   * Clean Disconnect with resource teardown
   */
  const disconnectSession = useCallback(() => {
    isCleaningUpRef.current = true;
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'User disconnect');
      } catch {}
      wsRef.current = null;
    }
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch {}
      workletNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (playoutManagerRef.current) {
      void playoutManagerRef.current.teardown();
      playoutManagerRef.current = null;
    }
    inputAudioCtxRef.current = null;
    void releaseWakeLock();

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    speechStartTimeRef.current = null;
    hasSpokenInTurnRef.current = false;
    setIsUserSpeaking(false);
    isUserSpeakingRef.current = false;
    setIsPauseHolding(false);

    setIsConnected(false);
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setStatusMessage('Сессия завершена');
  }, []);

  /**
   * Ephemeral Reset (retains AudioContext for quick retries / next questions)
   */
  const resetSessionStateOnly = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    speechStartTimeRef.current = null;
    hasSpokenInTurnRef.current = false;
    setIsUserSpeaking(false);
    isUserSpeakingRef.current = false;
    setIsPauseHolding(false);

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Question advance');
      } catch {}
      wsRef.current = null;
    }
    if (playoutManagerRef.current) {
      playoutManagerRef.current.clearQueue();
    }
    setDialogueTurns([]);
    setAiTranscript('');
    setIsConnected(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;
  }, []);

  /**
   * Manual Microphone Mute/Unmute Toggle
   */
  const toggleMic = useCallback(() => {
    setIsRecording((prev) => {
      const next = !prev;
      isRecordingRef.current = next;
      return next;
    });
  }, []);

  /**
   * Earphones / Silent Mute Output Toggle
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      playoutManagerRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
    isMutedRef.current = muted;
    playoutManagerRef.current?.setMuted(muted);
  }, []);

  /**
   * Finish Candidate Turn in Manual Mode (Trigger AI evaluation with haptic feedback)
   */
  const finishManualTurn = useCallback(() => {
    triggerEndTurn();
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;
    setStatusMessage('⏳ ИИ осмысливает ответ и формирует оценку...');
  }, [triggerEndTurn]);

  /**
   * Send Multimodal Deictic Canvas Delta to Live Audio Session
   */
  const sendCanvasDelta = useCallback((payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'canvas_delta',
        payload
      }));
    }
  }, []);

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
    playoutManagerRef
  };
}
