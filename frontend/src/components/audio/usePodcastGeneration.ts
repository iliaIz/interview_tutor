import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';

export interface UsePodcastGenerationOptions {
  isOpen: boolean;
  recapTarget: any;
  mode: 'duo' | 'solo';
  voice1: string;
  voice2: string;
  tone: string;
  length: string;
  systemPrompt: string;
  userPrompt: string;
}

export function usePodcastGeneration({
  isOpen,
  recapTarget,
  mode,
  voice1,
  voice2,
  tone,
  length,
  systemPrompt,
  userPrompt,
}: UsePodcastGenerationOptions) {
  const { setActiveAudioJob, showToast } = useAppStore();

  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('Инициализация...');
  const [progressData, setProgressData] = useState<any | null>(null);
  const [completedJobData, setCompletedJobData] = useState<any | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sseRetryCountRef = useRef(0);

  const stopPreview = useCallback(() => {
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current.src = '';
      sampleAudioRef.current = null;
    }
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    setPreviewingVoice(null);
  }, []);

  const handlePreviewVoice = async (voiceId: string) => {
    if (previewingVoice === voiceId) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewingVoice(voiceId);

    try {
      const audioUrl = `/api/podcast/sample-audio?voice=${encodeURIComponent(voiceId)}&t=${Date.now()}`;
      const res = await fetch(audioUrl);

      if (!res.ok) {
        let errDetail = 'Сбой сервера при генерации аудио';
        try {
          const errData = await res.json();
          errDetail = errData.error || errDetail;
        } catch {
          errDetail = await res.text();
        }
        setPreviewingVoice(null);
        showToast({
          type: 'error',
          title: `Ошибка воспроизведения голоса ${voiceId}`,
          message: 'Не удалось синтезировать образец речи через LiteLLM Gateway.',
          technicalDetails: `HTTP ${res.status}: ${errDetail}`
        });
        return;
      }

      const arrayBuf = await res.arrayBuffer();
      const blob = new Blob([arrayBuf], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrlRef.current = blobUrl;

      const audio = new Audio();
      audio.src = blobUrl;
      sampleAudioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoice(null);
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
          activeBlobUrlRef.current = null;
        }
      };

      audio.onerror = (e) => {
        console.error('TTS Audio Sample playback error:', e);
        setPreviewingVoice(null);
        showToast({
          type: 'error',
          title: 'Ошибка воспроизведения звука',
          message: `Браузер не смог воспроизвести аудиопоток для голоса ${voiceId}.`,
          technicalDetails: String(e)
        });
      };

      await audio.play();
    } catch (err: any) {
      console.error('Audio play failed:', err);
      setPreviewingVoice(null);
      showToast({
        type: 'error',
        title: `Сетевая ошибка при запросе голоса ${voiceId}`,
        message: err.message || 'Ошибка сети при обращении к серверу.',
        technicalDetails: err.stack || err.message
      });
    }
  };

  const connectSSE = useCallback((activeJobId: string) => {
    if (!activeJobId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/podcast/progress/${activeJobId}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      sseRetryCountRef.current = 0;
    };

    es.addEventListener('connected', () => {
      setStatus((prev) => (prev === 'idle' ? 'queued' : prev));
    });

    es.addEventListener('job_progress', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setStatus('processing');
        if (payload.data) {
          setProgressData(payload.data);
          if (payload.data.stageLabel) {
            setProgressMsg(payload.data.stageLabel);
          }
        }
      } catch (err) {
        console.error('SSE parse error job_progress:', err);
      }
    });

    es.addEventListener('job_completed', async (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setStatus('completed');
        setProgressMsg('Аудиопересказ успешно готов!');
        setCompletedJobData(payload);

        const res = await fetch(`/api/podcast/status/${activeJobId}`);
        if (res.ok) {
          const finalJob = await res.json();
          setCompletedJobData(finalJob);
          setActiveAudioJob({
            jobId: finalJob.job_id,
            audioUrl: `/api/podcast/audio/${finalJob.job_id}`,
            title: recapTarget?.title || 'Аудиопересказ вопросов',
            topic: recapTarget?.topicName,
            transcript: finalJob.transcript,
            metadata: finalJob.metadata,
          });
        }
      } catch (err) {
        console.error('SSE parse error job_completed:', err);
      }
      es.close();
    });

    es.addEventListener('job_error', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setStatus('failed');
        setErrorMessage(payload.error || 'Ошибка во время генерации аудиопересказа');
      } catch {
        setStatus('failed');
        setErrorMessage('Ошибка обработки задачи');
      }
      es.close();
    });

    es.onerror = () => {
      es.close();
      if (status !== 'completed' && status !== 'failed') {
        const baseDelay = 1000;
        const delay = Math.min(10000, baseDelay * 2 ** sseRetryCountRef.current) + Math.random() * 500;
        sseRetryCountRef.current += 1;

        sseRetryTimeoutRef.current = setTimeout(() => {
          connectSSE(activeJobId);
        }, delay);
      }
    };
  }, [recapTarget, setActiveAudioJob, status]);

  useEffect(() => {
    if (jobId && status !== 'completed' && status !== 'failed') {
      connectSSE(jobId);
    }
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (sseRetryTimeoutRef.current) clearTimeout(sseRetryTimeoutRef.current);
    };
  }, [jobId, connectSSE, status]);

  useEffect(() => {
    if (!isOpen) {
      stopPreview();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sseRetryTimeoutRef.current) {
        clearTimeout(sseRetryTimeoutRef.current);
        sseRetryTimeoutRef.current = null;
      }
      setStatus('idle');
      setJobId(null);
      setErrorMessage(null);
      setProgressData(null);
      setCompletedJobData(null);
    }
  }, [isOpen, stopPreview]);

  const handleStartGeneration = async () => {
    setStatus('queued');
    setErrorMessage(null);
    setProgressData({
      percentage: 5,
      stage: 'script',
      stageLabel: 'Инициализация генерации сценария...',
      currentStep: 0,
      totalSteps: 1
    });
    setProgressMsg('Инициализация генерации сценария...');

    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: recapTarget.questionIds,
          topicId: recapTarget.topicId,
          topicName: recapTarget.topicName,
          tone,
          length,
          language: 'Russian',
          mode,
          voice1,
          voice2: mode === 'duo' ? voice2 : undefined,
          systemPrompt,
          userPrompt,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Не удалось запустить генерацию');
      }

      const data = await res.json();
      setJobId(data.job_id);
    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setErrorMessage(err.message || 'Произошла ошибка при запуске генерации');
    }
  };

  return {
    status,
    setStatus,
    jobId,
    errorMessage,
    progressMsg,
    progressData,
    completedJobData,
    previewingVoice,
    handlePreviewVoice,
    handleStartGeneration,
  };
}
