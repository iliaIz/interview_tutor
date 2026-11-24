import { useState, useRef, useEffect, useCallback } from 'react';
import { HrMicroBeat } from '@interview-prep/shared';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../../../config/voiceDefaults';

export type StudyPlaybackRate = 0.9 | 1.0 | 1.15;

export function useStudyAudioPlayer(questionId: string, beats: HrMicroBeat[]) {
  const { config } = useInterviewConfig();
  const activeVoice = config.voice || VOICE_DEFAULTS.voice;

  const [variantMap, setVariantMap] = useState<Record<string, number>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<StudyPlaybackRate>(1.0);
  const [shadowPauseMode, setShadowPauseMode] = useState<boolean>(false);
  const [isPlaylistActive, setIsPlaylistActive] = useState<boolean>(false);
  const [pauseCountdownSec, setPauseCountdownSec] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pauseTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const playlistCancelRef = useRef<boolean>(false);

  const stopAllPlayback = useCallback(() => {
    playlistCancelRef.current = true;
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlayingKey(null);
    setLoadingKey(null);
    setIsPlaylistActive(false);
    setPauseCountdownSec(0);
  }, []);

  useEffect(() => {
    stopAllPlayback();
    setVariantMap({});
    setErrorMsg(null);
  }, [questionId, stopAllPlayback]);

  useEffect(() => () => stopAllPlayback(), [stopAllPlayback]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const playSingleBeat = useCallback(
    async (beat: HrMicroBeat, vIdx: number): Promise<boolean> => {
      const key = `${beat.id}:${vIdx}`;
      setErrorMsg(null);
      setLoadingKey(key);

      try {
        const url = `/api/hr/study-tts?questionId=${encodeURIComponent(questionId)}&beatId=${encodeURIComponent(beat.id)}&variantIdx=${vIdx}&voice=${encodeURIComponent(activeVoice)}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Синтез речи временно недоступен');
        }
        const blob = await res.blob();
        if (playlistCancelRef.current) {
          setLoadingKey(null);
          return false;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const objUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objUrl;

        const audio = new Audio(objUrl);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        setLoadingKey(null);
        setPlayingKey(key);

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error('Ошибка воспроизведения аудио'));
          audio.play().catch(reject);
        });
        setPlayingKey(null);
        return true;
      } catch (err: any) {
        setLoadingKey(null);
        setPlayingKey(null);
        setErrorMsg(err?.message || 'Не удалось озвучить фразу');
        return false;
      }
    },
    [questionId, activeVoice, playbackRate]
  );

  const handlePlayBeatClick = async (beat: HrMicroBeat) => {
    const vIdx = variantMap[beat.id] || 0;
    const key = `${beat.id}:${vIdx}`;
    if (playingKey === key || loadingKey === key) {
      stopAllPlayback();
      return;
    }
    stopAllPlayback();
    playlistCancelRef.current = false;
    await playSingleBeat(beat, vIdx);
  };

  const handlePlayAll = async () => {
    if (isPlaylistActive) {
      stopAllPlayback();
      return;
    }
    if (beats.length === 0) return;

    stopAllPlayback();
    playlistCancelRef.current = false;
    setIsPlaylistActive(true);

    for (let i = 0; i < beats.length; i++) {
      if (playlistCancelRef.current) break;
      const beat = beats[i];
      const vIdx = variantMap[beat.id] || 0;
      const ok = await playSingleBeat(beat, vIdx);
      if (!ok || playlistCancelRef.current) break;

      const waitMs = shadowPauseMode ? 3500 : 700;
      if (i < beats.length - 1) {
        if (shadowPauseMode) {
          setPauseCountdownSec(4);
          countdownIntervalRef.current = window.setInterval(() => {
            setPauseCountdownSec((prev) => Math.max(0, prev - 1));
          }, 900);
        }
        await new Promise<void>((resolve) => {
          pauseTimerRef.current = window.setTimeout(() => {
            if (countdownIntervalRef.current) {
              window.clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setPauseCountdownSec(0);
            resolve();
          }, waitMs);
        });
      }
    }

    setIsPlaylistActive(false);
    setPauseCountdownSec(0);
  };

  const handleNextVariant = (beat: HrMicroBeat) => {
    const cur = variantMap[beat.id] || 0;
    const next = (cur + 1) % Math.max(1, beat.spokenVariants.length);
    setVariantMap((prev) => ({ ...prev, [beat.id]: next }));
  };

  return {
    activeVoice,
    variantMap,
    playingKey,
    loadingKey,
    playbackRate,
    setPlaybackRate,
    shadowPauseMode,
    setShadowPauseMode,
    isPlaylistActive,
    pauseCountdownSec,
    errorMsg,
    handlePlayBeatClick,
    handlePlayAll,
    handleNextVariant
  };
}
