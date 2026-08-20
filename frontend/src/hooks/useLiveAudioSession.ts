import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';

export interface LiveAudioSessionParams {
  sessionType?: 'interview' | 'tutor';
  tutorMode?: string;
  topic?: string;
  questionId?: string;
  questionText?: string;
  referenceAnswer?: string;
  voice?: string;
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
}

export interface DialogueTurn {
  role: 'ai' | 'user' | 'system';
  text: string;
}

export interface UseLiveAudioSessionOptions {
  onSetupComplete?: () => void;
  onEvaluationCompleted?: (evaluation: any) => void;
  onBugSolved?: (payload: any) => void;
  onError?: (errorMsg: string) => void;
  onDisconnect?: () => void;
}

export function useLiveAudioSession(options: UseLiveAudioSessionOptions = {}) {
  const { onSetupComplete, onEvaluationCompleted, onBugSolved, onError, onDisconnect } = options;

  // Session State
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
  const lastAiSpeechEndedAtRef = useRef<number>(0);
  const isCleaningUpRef = useRef(false);

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

    const query = new URLSearchParams();
    if (params.sessionType) query.set('sessionType', params.sessionType);
    if (params.tutorMode) query.set('tutorMode', params.tutorMode);
    if (params.topic) query.set('topic', params.topic);
    if (params.questionId) query.set('questionId', params.questionId);
    if (params.questionText) query.set('questionText', params.questionText);
    if (params.referenceAnswer) query.set('referenceAnswer', params.referenceAnswer);
    if (params.voice) query.set('voice', params.voice);
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
    if (params.hints && params.hints.length > 0) {
      query.set('hints', JSON.stringify(params.hints));
    }

    return `${protocol}//${hostWithPort}/ws/live?${query.toString()}`;
  };

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

      workletNode.port.onmessage = (event: MessageEvent) => {
        const { type, pcmBuffer } = event.data;
        if (type === 'AUDIO_FRAME') {
          const isAiCurrentlySpeaking =
            isAiSpeakingRef.current || (playoutManagerRef.current?.isPlaying() ?? false);
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
      isCleaningUpRef.current = false;
      setStatusMessage('Подключение к голосовому каналу...');

      // 1. Initialize & Resume AudioPlayoutManager directly within user gesture!
      let playoutManager = playoutManagerRef.current;
      if (!playoutManager) {
        playoutManager = new AudioPlayoutManager();
        playoutManagerRef.current = playoutManager;
      }
      await playoutManager.resume();

      setIsAiSpeaking(true);
      isAiSpeakingRef.current = true;
      setIsRecording(false);
      isRecordingRef.current = false;

      // 2. Open WebSocket
      const wsUrl = resolveWsUrl(params);
      console.log('⚡ Connecting Live Audio WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatusMessage('AI готовится к ответу...');
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
            setStatusMessage('🔊 AI говорит...');
            // Lazy warm-up mic in background without interrupting playback
            void initMicrophoneHardware();
            onSetupComplete?.();
            return;
          }

          if (data.type === 'evaluation_completed') {
            onEvaluationCompleted?.(data.evaluation);
            return;
          }

          if (data.type === 'bug_solved') {
            onBugSolved?.(data.payload);
            return;
          }

          if (data.error) {
            setStatusMessage(`❌ ${data.error}`);
            onError?.(data.error);
            return;
          }

          if (data.serverContent) {
            // Barge-in interruption
            if (data.serverContent.interrupted) {
              playoutManagerRef.current?.handleInterruption();
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              lastAiSpeechEndedAtRef.current = Date.now();
              setDialogueTurns((prev) => [
                ...prev,
                { role: 'system', text: '⚡ Речь прервана кандидатом (Barge-in).' }
              ]);
            }

            // Model Speech turn
            if (data.serverContent.modelTurn?.parts) {
              setIsAiSpeaking(true);
              isAiSpeakingRef.current = true;
              setIsRecording(false);
              isRecordingRef.current = false;
              setStatusMessage('🔊 AI говорит...');

              for (const part of data.serverContent.modelTurn.parts) {
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

            // Turn Completed -> AI finished speaking, pass turn to user with settling delay
            if (data.serverContent.turnComplete) {
              lastAiSpeechEndedAtRef.current = Date.now();
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;

              // Anti-echo settling delay (250ms) to allow audio buffer to drain
              setTimeout(() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isCleaningUpRef.current) {
                  setIsRecording(true);
                  isRecordingRef.current = true;
                  setStatusMessage('🎙️ Ваша очередь: говорите в микрофон...');
                  setDialogueTurns((prev) => [
                    ...prev,
                    { role: 'system', text: '🎙️ Ваша очередь: говорите в микрофон.' }
                  ]);
                }
              }, 250);
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

        // Drain Phase: Don't abruptly kill playback if audio is still playing
        if (playoutManagerRef.current?.isPlaying()) {
          setStatusMessage('Завершение воспроизведения...');
        } else {
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
          setStatusMessage('Сессия завершена');
        }

        onDisconnect?.();
      };

      ws.onerror = (err) => {
        console.error('Live Audio WS error:', err);
        setStatusMessage('Ошибка подключения к шлюзу');
        onError?.('Ошибка подключения к шлюзу');
      };
    } catch (err: any) {
      console.error('Failed to start Live Audio session:', err);
      setStatusMessage('Ошибка запуска аудиосессии');
      onError?.(err?.message || 'Ошибка запуска');
    }
  }, [onSetupComplete, onEvaluationCompleted, onBugSolved, onError, onDisconnect]);

  /**
   * Send text message or breakpoint directive into the live turn stream
   */
  const sendTextMessage = useCallback((text: string, displayText?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
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
    statusMessage,
    dialogueTurns,
    aiTranscript,
    startSession,
    disconnectSession,
    resetSessionStateOnly,
    sendTextMessage,
    toggleMic,
    setStatusMessage,
    setDialogueTurns,
    setAiTranscript,
    playoutManagerRef
  };
}
