import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  X, Headphones, Loader2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { safeJsonParse } from '../utils/safeJson';
import { 
  DEFAULT_SYSTEM_PROMPT, 
  DUO_TONE_PROMPTS, 
  SOLO_TONE_PROMPTS 
} from './podcast/podcastConstants';
import { PodcastVoiceConfig } from './podcast/PodcastVoiceConfig';
import { PodcastSseProgress } from './podcast/PodcastSseProgress';
import { PodcastPlayerAndTranscript } from './podcast/PodcastPlayerAndTranscript';

export const AudioRecapModal: React.FC = () => {
  const { isRecapModalOpen, closeRecapModal, recapTarget, setActiveAudioJob, showToast, systemHealth } = useAppStore();

  // Lock background body scroll on mobile & desktop when modal is active
  useBodyScrollLock(isRecapModalOpen);

  const [mode, setMode] = useState<'duo' | 'solo'>('duo');
  const [voice1, setVoice1] = useState<string>('Kore');
  const [voice2, setVoice2] = useState<string>('Puck');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sseRetryCountRef = useRef(0);

  const [tone, setTone] = useState<string>('Fun');
  const [length, setLength] = useState<string>('Medium (10-15 min)');
  
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState<string>(DUO_TONE_PROMPTS['Fun']);
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState<boolean>(false);

  // Status & Granular Progress State
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('Инициализация...');
  const [progressData, setProgressData] = useState<any | null>(null);
  const [completedJobData, setCompletedJobData] = useState<any | null>(null);
  const [showTelemetry, setShowTelemetry] = useState<boolean>(false);
  const [reportCopied, setReportCopied] = useState<boolean>(false);

  const handleToneChange = (newTone: string, targetMode: 'duo' | 'solo' = mode) => {
    setTone(newTone);
    const map = targetMode === 'duo' ? DUO_TONE_PROMPTS : SOLO_TONE_PROMPTS;
    if (map[newTone]) {
      setUserPrompt(map[newTone]);
    }
  };

  const handleModeChange = (newMode: 'duo' | 'solo') => {
    setMode(newMode);
    handleToneChange(tone, newMode);
  };

  const stopPreview = () => {
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
  };

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
        console.error(`[TTS Voice Preview Error] Voice: ${voiceId}, HTTP ${res.status}:`, errDetail);
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
          title: `Ошибка воспроизведения звука`,
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

  useEffect(() => {
    if (!isRecapModalOpen) {
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
      setShowTelemetry(false);
    }
  }, [isRecapModalOpen]);

  // Server-Sent Events (SSE) progress listener with reconnection
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
      const payload = safeJsonParse<any>(e.data, null);
      if (payload) {
        setStatus('processing');
        if (payload.data) {
          setProgressData(payload.data);
          if (payload.data.stageLabel) {
            setProgressMsg(payload.data.stageLabel);
          }
        }
      }
    });

    es.addEventListener('job_completed', async (e: MessageEvent) => {
      const payload = safeJsonParse<any>(e.data, null);
      if (payload) {
        setStatus('completed');
        setProgressMsg('Аудиопересказ успешно готов!');
        setCompletedJobData(payload);

        // Fetch final status to get full transcript & metadata
        try {
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
        } catch (fetchErr) {
          console.warn('Could not fetch final job metadata:', fetchErr);
        }
      }
      es.close();
    });

    es.addEventListener('job_error', (e: MessageEvent) => {
      const payload = safeJsonParse<any>(e.data, null);
      setStatus('failed');
      setErrorMessage(payload?.error || 'Ошибка во время генерации аудиопересказа');
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
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (sseRetryTimeoutRef.current) {
        clearTimeout(sseRetryTimeoutRef.current);
      }
    };
  }, [jobId, connectSSE, status]);

  if (!isRecapModalOpen || !recapTarget) return null;

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

  const generateMarkdownReport = (): string => {
    const job = completedJobData || {};
    const telemetry = progressData?.telemetry || job.metadata?.telemetry || {};
    const title = recapTarget?.title || 'Аудиопересказ темы';
    const topic = recapTarget?.topicName || 'Обзор темы';

    let md = `# Отчет о генерации аудиопересказа: ${title}\n\n`;
    md += `**Тема:** ${topic}  \n`;
    md += `**Дата:** ${new Date().toLocaleString('ru-RU')}  \n`;
    md += `**Идентификатор задачи (Job ID):** \`${jobId || 'N/A'}\`  \n\n`;
    
    md += `## 📊 Сводные метрики пайплайна (Opus 48kbps / SSE)\n\n`;
    md += `| Параметр | Значение |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Общее время генерации** | \`${telemetry.totalDurationSec || '—'} сек\` |\n`;
    md += `| **Время написания сценария (LLM)** | \`${telemetry.scriptDurationSec || '—'} сек\` |\n`;
    md += `| **Время синтеза речи (TTS)** | \`${telemetry.ttsDurationSec || '—'} сек\` |\n`;
    md += `| **Модель сценария** | \`${telemetry.modelsUsed?.scriptModel || 'gemini-v3'}\` |\n`;
    md += `| **Модель синтеза речи** | \`${telemetry.modelsUsed?.ttsModel || 'gemini-tts-v3'}\` |\n`;
    md += `| **Формат озвучки** | \`${mode === 'duo' ? 'Диалог двух ведущих' : 'Соло монолог'}\` |\n`;
    md += `| **Голоса дикторов** | \`${voice1}${mode === 'duo' ? ` + ${voice2}` : ''}\` |\n`;
    md += `| **Количество реплик** | \`${telemetry.steps?.length || progressData?.totalSteps || '—'}\` |\n`;
    md += `| **Оценка длительности аудио** | \`~${telemetry.audioDurationEstimateSec || '—'} сек\` |\n`;
    md += `| **Размер сжатого аудио (Opus)** | \`${telemetry.totalBytes ? `${Math.round(telemetry.totalBytes / 1024)} KB` : '—'}\` |\n\n`;

    if (telemetry.steps && telemetry.steps.length > 0) {
      md += `## ⏱️ Тайминг синтеза по репликам\n\n`;
      md += `| # | Диктор | Задержка | Текст реплики |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      telemetry.steps.forEach((s: any) => {
        md += `| ${s.index} | **${s.speaker}** | \`${s.durationMs}ms\` | ${s.text.replace(/\|/g, '-')} |\n`;
      });
      md += `\n`;
    }

    if (job.transcript) {
      md += `## 📜 Полный транскрипт диалога\n\n`;
      md += `${job.transcript}\n\n`;
    }

    md += `---\n*Сгенерировано платформой InterviewPrep AI с Gemini Live/TTS & Opus Streaming.*`;
    return md;
  };

  const handleDownloadReport = () => {
    const md = generateMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recap_report_${recapTarget?.topicName ? recapTarget.topicName.toLowerCase().replace(/\s+/g, '_') : 'podcast'}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    const md = generateMarkdownReport();
    navigator.clipboard.writeText(md).then(() => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2500);
    });
  };

  const currentPercent = progressData?.percentage ?? (status === 'queued' ? 5 : status === 'completed' ? 100 : 15);
  const telemetryObj = progressData?.telemetry || completedJobData?.metadata?.telemetry || {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/50 backdrop-blur-md overflow-y-auto modal-overscroll-contain">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-3xl bg-white/95 rounded-3xl p-5 md:p-8 shadow-2xl border border-pastel-rose/80 relative overflow-hidden my-auto max-h-[92dvh] flex flex-col modal-overscroll-contain"
        >
          {/* Ambient blurs */}
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-sm">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-pastel-text">
                  {status === 'idle' ? 'Настройки аудиопересказа' : 'Генерация аудиопересказа'}
                </h3>
                <p className="text-[11px] text-pastel-muted">
                  Gemini TTS Studio • Opus VoIP 48 kbps • SSE Поток
                </p>
              </div>
            </div>

            <button
              onClick={closeRecapModal}
              className="w-8 h-8 rounded-full bg-pastel-bg text-pastel-muted hover:text-pastel-text flex items-center justify-center hover:bg-pastel-rose/30 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-pastel-bg/80 p-2.5 rounded-xl border border-pastel-border/60 text-xs text-pastel-muted mb-3 shrink-0">
            <span className="font-semibold text-pastel-text">Материал:</span> {recapTarget.title}
          </div>

          {/* Warmup notice if AI Gateway is not ready */}
          {!systemHealth.isAiReady && status === 'idle' && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5 shadow-xs">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
              <div>
                <span className="font-semibold block">Инициализация AI Шлюза...</span>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  Сервер подключается к Google Gemini API. Кнопки станут активны через несколько секунд.
                </p>
              </div>
            </div>
          )}

          {/* VIEW 1: SETTINGS (IDLE) */}
          {status === 'idle' && (
            <PodcastVoiceConfig
              mode={mode}
              onModeChange={handleModeChange}
              voice1={voice1}
              setVoice1={setVoice1}
              voice2={voice2}
              setVoice2={setVoice2}
              previewingVoice={previewingVoice}
              onPreviewVoice={handlePreviewVoice}
              isAiReady={systemHealth.isAiReady}
              length={length}
              setLength={setLength}
              tone={tone}
              onToneChange={handleToneChange}
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              userPrompt={userPrompt}
              setUserPrompt={setUserPrompt}
              showAdvancedPrompts={showAdvancedPrompts}
              setShowAdvancedPrompts={setShowAdvancedPrompts}
              onStartGeneration={handleStartGeneration}
            />
          )}

          {/* VIEW 2: PROGRESS & TELEMETRY */}
          {(status === 'queued' || status === 'processing' || status === 'completed') && (
            <div className="py-4 flex-1 flex flex-col justify-between overflow-y-auto pr-1">
              <PodcastSseProgress
                status={status}
                progressMsg={progressMsg}
                currentPercent={currentPercent}
                progressData={progressData}
                telemetryObj={telemetryObj}
                showTelemetry={showTelemetry}
                setShowTelemetry={setShowTelemetry}
                reportCopied={reportCopied}
                handleCopyReport={handleCopyReport}
                handleDownloadReport={handleDownloadReport}
                voice1={voice1}
                voice2={voice2}
                mode={mode}
              />

              {status === 'completed' && (
                <PodcastPlayerAndTranscript
                  onDownloadReport={handleDownloadReport}
                  onClose={closeRecapModal}
                />
              )}
            </div>
          )}

          {/* VIEW 3: ERROR STATE */}
          {status === 'failed' && (
            <div className="py-6 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-pastel-text mb-1">Ошибка генерации</h4>
              <p className="text-xs text-rose-600 mb-6 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="px-5 py-2.5 bg-pastel-bg border border-pastel-border text-pastel-text font-bold text-xs rounded-xl hover:bg-pastel-card transition cursor-pointer"
              >
                Вернуться к настройкам
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
