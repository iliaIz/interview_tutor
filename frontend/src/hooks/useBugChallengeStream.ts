import { useState, useRef, useCallback, useEffect } from 'react';
import type { BugChallenge } from '../components/BugChallengeCard';

export type BugStreamPhase =
  | 'idle'
  | 'connecting'
  | 'thinking'
  | 'assembling'
  | 'ready'
  | 'error';

export interface BugChallengeGenerateParams {
  questionId?: number | string;
  topicId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  workoutPreset?: string;
  defectFocus?: string;
  difficulty?: string;
  excludeIds?: Array<number | string>;
  techStackProfile?: string;
  customTechStack?: string;
  customInstructions?: string;
}

export interface UseBugChallengeStreamReturn {
  phase: BugStreamPhase;
  thoughts: string;
  isStreaming: boolean;
  error: string | null;
  isGatewayUnavailable: boolean;
  elapsedMs: number;
  ttftMs: number | null;
  startStream: (
    params: BugChallengeGenerateParams,
    onChallengeReady?: (challenge: BugChallenge) => void
  ) => Promise<BugChallenge | null>;
  abortStream: () => void;
  resetStreamState: () => void;
}

export function useBugChallengeStream(): UseBugChallengeStreamReturn {
  const [phase, setPhase] = useState<BugStreamPhase>('idle');
  const [thoughts, setThoughts] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isGatewayUnavailable, setIsGatewayUnavailable] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [ttftMs, setTtftMs] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopTimer();
    setPhase((prev) => (prev === 'ready' ? 'ready' : 'idle'));
  }, [stopTimer]);

  const resetStreamState = useCallback(() => {
    abortStream();
    setPhase('idle');
    setThoughts('');
    setError(null);
    setIsGatewayUnavailable(false);
    setElapsedMs(0);
    setTtftMs(null);
  }, [abortStream]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      stopTimer();
    };
  }, [stopTimer]);

  const startStream = useCallback(
    async (
      params: BugChallengeGenerateParams,
      onChallengeReady?: (challenge: BugChallenge) => void
    ): Promise<BugChallenge | null> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setPhase('connecting');
      setThoughts('');
      setError(null);
      setIsGatewayUnavailable(false);
      setElapsedMs(0);
      setTtftMs(null);

      startTimeRef.current = Date.now();
      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);

      let resolvedChallenge: BugChallenge | null = null;

      try {
        const res = await fetch('/api/tutor/bug-challenge/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
          },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify(params)
        });

        if (!res.ok || !res.body) {
          const errData = await res.json().catch(() => null);
          setIsGatewayUnavailable(Boolean(errData?.isGatewayUnavailable || res.status === 503));
          throw new Error(errData?.error || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const trimmedFrame = frame.trim();
            if (!trimmedFrame || trimmedFrame.startsWith(':')) {
              continue; // Heartbeat comment (: ping)
            }

            let eventName = 'message';
            const dataLines: string[] = [];

            for (const line of trimmedFrame.split('\n')) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
              }
            }

            if (dataLines.length === 0) continue;
            let payload: any;
            try {
              payload = JSON.parse(dataLines.join('\n'));
            } catch {
              continue;
            }

            if (eventName === 'phase_change') {
              if (payload.phase === 'thinking' || payload.phase === 'assembling') {
                setPhase(payload.phase);
              }
            } else if (eventName === 'thought_delta') {
              setTtftMs((prev) => prev ?? Date.now() - startTimeRef.current);
              setPhase((prev) => (prev === 'connecting' ? 'thinking' : prev));
              if (typeof payload.delta === 'string') {
                setThoughts((prev) => prev + payload.delta);
              }
            } else if (eventName === 'challenge_ready') {
              if (payload.challenge) {
                resolvedChallenge = payload.challenge as BugChallenge;
                if (typeof payload.meta?.ttftMs === 'number') {
                  setTtftMs(payload.meta.ttftMs);
                }
                setPhase('ready');
                onChallengeReady?.(resolvedChallenge);
              }
            } else if (eventName === 'error') {
              setIsGatewayUnavailable(Boolean(payload.isGatewayUnavailable));
              throw new Error(payload.error || 'Ошибка генерации кейса');
            }
          }
        }

        return resolvedChallenge;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return null;
        }
        setError(err?.message || 'Ошибка генерации кейса');
        setPhase('error');
        return null;
      } finally {
        stopTimer();
      }
    },
    [stopTimer]
  );

  const isStreaming = phase === 'connecting' || phase === 'thinking' || phase === 'assembling';

  return {
    phase,
    thoughts,
    isStreaming,
    error,
    isGatewayUnavailable,
    elapsedMs,
    ttftMs,
    startStream,
    abortStream,
    resetStreamState
  };
}
