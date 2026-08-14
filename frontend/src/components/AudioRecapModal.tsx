import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  X, Headphones, Sparkles, Loader2, Music, CheckCircle2, AlertCircle, 
  ChevronDown, ChevronUp, User, Users, Settings2, Sliders, Volume2, VolumeX,
  BarChart3, Download, Clock, Cpu, Layers, FileText, Check, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RUSSIAN_VOICES = [
  { id: 'Kore', name: 'Kore (Светлана)', gender: 'Женский', desc: 'Уверенный, чёткий' },
  { id: 'Puck', name: 'Puck (Дмитрий)', gender: 'Мужской', desc: 'Живой, динамичный' },
  { id: 'Charon', name: 'Charon (Алексей)', gender: 'Мужской', desc: 'Глубокий, спокойный' },
  { id: 'Aoede', name: 'Aoede (Елена)', gender: 'Женский', desc: 'Выразительный, мягкий' },
  { id: 'Fenrir', name: 'Fenrir (Максим)', gender: 'Мужской', desc: 'Строгий, авторитетный' },
];

const DEFAULT_SYSTEM_PROMPT = `Ты — ведущий эксперт по IT-собеседованиям. Твоя задача — создавать качественные аудиопересказы вопросов и ответов на русском языке. Объясняй материал глубоко и доступно, используй жизненные аналогии из реальной backend-разработки, подсвечивай ключевые слова и подводные камни.`;

const DEFAULT_USER_PROMPT = `Сделай акцент на практическом применении в коммерческой разработке. Объясни, что именно кандидат должен ответить интервьюеру, чтобы показать высокий уровень знаний.`;

const DUO_TONE_PROMPTS: Record<string, string> = {
  Fun: 'Создай динамичный диалог двух IT-ведущих. Пусть они общаются непринужденно, с юмором, подшучивают над сложными багами, задают друг другу уточняющие вопросы и приводят смешные аналогии.',
  Informative: 'Создай познавательный диалог в формате "Ведущий + Эксперт". Ведущий задает практические вопросы от лица кандидата, а эксперт понятно и структурированно разжевывает суть с точки зрения собеседования.',
  Formal: 'Создай академическую дискуссию двух технических экспертов. Пусть они строго и аргументированно обсуждают формулировки, спецификации стандартов, архитектуру и потенциальные подводные камни.',
};

const SOLO_TONE_PROMPTS: Record<string, string> = {
  Fun: 'Проведи легкий и увлекательный монолог. Объясняй материал живо, с естественными интонациями, используй понятные жизненные метафоры из реального опыта backend-разработки.',
  Informative: 'Проведи понятный разбор от лица опытного IT-ментора. Объясни, что именно кандидат обязан ответить на собеседовании, выделяя ключевые концепции и формулировки.',
  Formal: 'Проведи академический доклад. Сфокусируйся на точных определениях, спецификациях стандартов и терминологии, излагай материал строго, глубоко и без лишней эмоциональности.',
};

export const AudioRecapModal: React.FC = () => {
  const { isRecapModalOpen, closeRecapModal, recapTarget, setActiveAudioJob, showToast, systemHealth } = useAppStore();

  const [mode, setMode] = useState<'duo' | 'solo'>('duo');
  const [voice1, setVoice1] = useState<string>('Kore');
  const [voice2, setVoice2] = useState<string>('Puck');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

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
      setStatus('idle');
      setJobId(null);
      setErrorMessage(null);
      setProgressData(null);
      setCompletedJobData(null);
      setShowTelemetry(false);
    }
  }, [isRecapModalOpen]);

  // Poll status with high precision when jobId is set
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/podcast/status/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.progress) {
            setProgressData(data.progress);
            if (data.progress.stageLabel) {
              setProgressMsg(data.progress.stageLabel);
            }
          }

          if (data.status === 'QUEUED') {
            setStatus('queued');
          } else if (data.status === 'PROCESSING') {
            setStatus('processing');
          } else if (data.status === 'COMPLETED') {
            setStatus('completed');
            setCompletedJobData(data);
            setProgressMsg('Аудиопересказ успешно готов!');
            setActiveAudioJob({
              jobId: data.job_id,
              audioUrl: `/api/podcast/audio/${data.job_id}`,
              title: recapTarget?.title || 'Аудиопересказ вопросов',
              topic: recapTarget?.topicName,
              transcript: data.transcript,
              metadata: data.metadata,
            });
          } else if (data.status === 'FAILED') {
            setStatus('failed');
            setErrorMessage(data.error || 'Ошибка во время генерации аудиопересказа');
          }
        }
      } catch (err: any) {
        console.error('Error polling status:', err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [jobId, status, recapTarget, setActiveAudioJob]);

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
    
    md += `## 📊 Сводные метрики пайплайна\n\n`;
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
    md += `| **Размер WAV-файла** | \`${telemetry.totalBytes ? `${Math.round(telemetry.totalBytes / 1024)} KB` : '—'}\` |\n\n`;

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

    md += `---\n*Сгенерировано платформой InterviewPrep AI с Gemini 3.1 Flash TTS Engine & LiteLLM Proxy.*`;
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/50 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-3xl bg-white/95 rounded-3xl p-5 md:p-8 shadow-2xl border border-pastel-rose/80 relative overflow-hidden my-auto max-h-[92vh] flex flex-col"
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
                  Gemini 3.1 Flash TTS Studio • 24 kHz Нативный звук
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
                <span className="font-semibold block">Инициализация AI Шлюза LiteLLM...</span>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  Сервер подключается к Google Gemini API. Кнопки прослушивания и генерации станут активны автоматически через несколько секунд.
                </p>
              </div>
            </div>
          )}

          {/* ===================== VIEW 1: SETTINGS (IDLE) ===================== */}
          {status === 'idle' && (
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* 1. Format Mode */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-pastel-accentRose" /> Формат озвучки
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange('duo')}
                    className={`p-3 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 transition cursor-pointer ${
                      mode === 'duo'
                        ? 'bg-pastel-rose/80 text-pastel-accentRose border-pastel-accentRose/40 shadow-sm'
                        : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentRose/20'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-pastel-accentRose/10">
                      <Users className="w-4 h-4 text-pastel-accentRose" />
                    </div>
                    <div className="text-left">
                      <div>Диалог двух экспертов</div>
                      <div className="text-[10px] opacity-80 font-normal">2 диктора • Живая дискуссия</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange('solo')}
                    className={`p-3 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 transition cursor-pointer ${
                      mode === 'solo'
                        ? 'bg-pastel-lavender/80 text-pastel-accentViolet border-pastel-accentViolet/40 shadow-sm'
                        : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentViolet/20'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-pastel-accentViolet/10">
                      <User className="w-4 h-4 text-pastel-accentViolet" />
                    </div>
                    <div className="text-left">
                      <div>Соло пересказ</div>
                      <div className="text-[10px] opacity-80 font-normal">1 диктор • Структурированный разбор</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Voice Pickers */}
              <div className="bg-pastel-card/60 p-3 rounded-2xl border border-pastel-border/60 space-y-3">
                {mode === 'solo' ? (
                  <div>
                    <label className="block text-xs font-semibold text-pastel-text mb-1.5 flex items-center justify-between">
                      <span>Выберите диктора (Русский)</span>
                    </label>
                    <div className="flex items-center gap-2 min-w-0">
                      <select
                        value={voice1}
                        onChange={(e) => setVoice1(e.target.value)}
                        className="flex-1 min-w-0 w-full bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentRose outline-none truncate"
                      >
                        {RUSSIAN_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.gender}) — {v.desc}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!systemHealth.isAiReady}
                        onClick={() => handlePreviewVoice(voice1)}
                        className={`shrink-0 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                          !systemHealth.isAiReady
                            ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                            : previewingVoice === voice1
                            ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                            : 'bg-white text-pastel-accentRose border-pastel-accentRose/30 hover:bg-pastel-rose cursor-pointer'
                        }`}
                        title={!systemHealth.isAiReady ? "Инициализация AI Шлюза... Голос станет доступен через несколько секунд" : "Прослушать пример голоса"}
                      >
                        {!systemHealth.isAiReady ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : previewingVoice === voice1 ? (
                          <VolumeX className="w-4 h-4 animate-pulse" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{!systemHealth.isAiReady ? 'Запуск...' : 'Тест'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-pastel-text mb-1 flex items-center justify-between">
                        <span>Голос 1 (Ведущий)</span>
                      </label>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <select
                          value={voice1}
                          onChange={(e) => setVoice1(e.target.value)}
                          className="flex-1 min-w-0 w-full bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentRose outline-none truncate"
                        >
                          {RUSSIAN_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.gender}) — {v.desc}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!systemHealth.isAiReady}
                          onClick={() => handlePreviewVoice(voice1)}
                          className={`shrink-0 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                            !systemHealth.isAiReady
                              ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                              : previewingVoice === voice1
                              ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                              : 'bg-white text-pastel-accentRose border-pastel-accentRose/30 hover:bg-pastel-rose cursor-pointer'
                          }`}
                          title={!systemHealth.isAiReady ? "Инициализация AI Шлюза... Голос станет доступен через несколько секунд" : "Прослушать голос 1"}
                        >
                          {!systemHealth.isAiReady ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : previewingVoice === voice1 ? (
                            <VolumeX className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-pastel-text mb-1 flex items-center justify-between">
                        <span>Голос 2 (Соведущий)</span>
                      </label>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <select
                          value={voice2}
                          onChange={(e) => setVoice2(e.target.value)}
                          className="flex-1 min-w-0 w-full bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentViolet outline-none truncate"
                        >
                          {RUSSIAN_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.gender}) — {v.desc}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!systemHealth.isAiReady}
                          onClick={() => handlePreviewVoice(voice2)}
                          className={`shrink-0 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                            !systemHealth.isAiReady
                              ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                              : previewingVoice === voice2
                              ? 'bg-pastel-accentViolet text-white border-pastel-accentViolet'
                              : 'bg-white text-pastel-accentViolet border-pastel-accentViolet/30 hover:bg-pastel-lavender cursor-pointer'
                          }`}
                          title={!systemHealth.isAiReady ? "Инициализация AI Шлюза... Голос станет доступен через несколько секунд" : "Прослушать голос 2"}
                        >
                          {!systemHealth.isAiReady ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : previewingVoice === voice2 ? (
                            <VolumeX className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Duration Selector */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-1.5">Желаемая длительность</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Short (5-7 min)', label: '⚡ Краткий', desc: '5–7 минут' },
                    { id: 'Medium (10-15 min)', label: '☕ Средний', desc: '10–15 минут' },
                    { id: 'Long (20+ min)', label: '🎙️ Глубокий', desc: '20+ минут' },
                  ].map((l) => (
                    <button
                      type="button"
                      key={l.id}
                      onClick={() => setLength(l.id)}
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                        length === l.id
                          ? 'bg-pastel-lavender text-pastel-accentViolet border-pastel-accentViolet/40 shadow-sm'
                          : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentViolet/20'
                      }`}
                    >
                      <div>{l.label}</div>
                      <div className="text-[10px] font-normal opacity-75">{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Tone of Voice */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-1.5">Тон и подача</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Fun', label: '🔥 Непринужденный', desc: 'Живой, с юмором' },
                    { id: 'Informative', label: '💡 Экспертный', desc: 'Четко по делу' },
                    { id: 'Formal', label: '🎓 Академический', desc: 'Строго по стандартам' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => handleToneChange(t.id)}
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                        tone === t.id
                          ? 'bg-pastel-rose text-pastel-accentRose border-pastel-accentRose/40 shadow-sm'
                          : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentRose/20'
                      }`}
                    >
                      <div>{t.label}</div>
                      <div className="text-[10px] font-normal opacity-75">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Advanced Prompt Settings */}
              <div className="border-t border-pastel-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-pastel-muted hover:text-pastel-text py-1 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" /> Настройки системных промптов (Advanced)
                  </span>
                  {showAdvancedPrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedPrompts && (
                  <div className="mt-3 space-y-3 p-3 bg-white rounded-2xl border border-pastel-border shadow-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-pastel-muted mb-1">
                        Системный промпт роли (System Prompt)
                      </label>
                      <textarea
                        rows={3}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full text-xs p-2.5 bg-pastel-bg rounded-xl border border-pastel-border focus:border-pastel-accentRose outline-none text-pastel-text font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-pastel-muted mb-1">
                        Инструкция к пересказу (User Prompt / Фокус)
                      </label>
                      <textarea
                        rows={2}
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        className="w-full text-xs p-2.5 bg-pastel-bg rounded-xl border border-pastel-border focus:border-pastel-accentRose outline-none text-pastel-text"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
                        setUserPrompt(DEFAULT_USER_PROMPT);
                      }}
                      className="text-[10px] text-pastel-accentRose hover:underline cursor-pointer"
                    >
                      Сбросить промпты к дефолтным
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={!systemHealth.isAiReady}
                onClick={handleStartGeneration}
                className={`w-full py-3.5 px-4 font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition transform mt-2 ${
                  !systemHealth.isAiReady
                    ? 'opacity-60 cursor-not-allowed bg-gray-400 text-white'
                    : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 text-white shadow-pastel-accentRose/25 active:scale-[0.98] cursor-pointer'
                }`}
                title={!systemHealth.isAiReady ? "Инициализация AI Шлюза... Генерация станет доступна через несколько секунд" : "Запустить генерацию аудио"}
              >
                {!systemHealth.isAiReady ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Ожидание готовности AI Шлюза...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Запустить генерацию аудио</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ===================== VIEW 2: PROGRESS & TELEMETRY ===================== */}
          {(status === 'queued' || status === 'processing' || status === 'completed') && (
            <div className="py-4 flex-1 flex flex-col justify-between overflow-y-auto pr-1">
              <div className="space-y-5">
                {/* Header Status Block */}
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-pastel-lavender/80 text-pastel-accentViolet border border-pastel-accentViolet/20">
                    {status === 'completed' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Генерация успешно завершена</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-pastel-accentViolet" />
                        <span>Выполняется генерация подкаста</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-base md:text-lg font-bold text-pastel-text">
                    {progressMsg}
                  </h4>
                </div>

                {/* Rich Progress Bar */}
                <div className="bg-pastel-bg/80 p-4 rounded-2xl border border-pastel-border/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-pastel-muted flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-pastel-accentRose" />
                      Прогресс пайплайна:
                    </span>
                    <span className="font-bold text-sm text-pastel-accentViolet">
                      {currentPercent}%
                    </span>
                  </div>

                  {/* The Track */}
                  <div className="w-full h-3.5 bg-gray-200/80 rounded-full overflow-hidden p-0.5 shadow-inner relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${currentPercent}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-pastel-accentRose via-pink-400 to-pastel-accentViolet shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </motion.div>
                  </div>

                  {/* 3 Step Indicator Pills */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className={`p-2 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 transition ${
                      currentPercent >= 15 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-gray-400 border-gray-200'
                    }`}>
                      {currentPercent >= 15 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />}
                      <span className="truncate">1. Сценарий</span>
                    </div>

                    <div className={`p-2 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 transition ${
                      currentPercent >= 92 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : currentPercent > 15 ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse' : 'bg-white text-gray-400 border-gray-200'
                    }`}>
                      {currentPercent >= 92 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : currentPercent > 15 ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                      )}
                      <span className="truncate">
                        2. Синтез {progressData?.totalSteps ? `(${progressData.currentStep}/${progressData.totalSteps})` : ''}
                      </span>
                    </div>

                    <div className={`p-2 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 transition ${
                      currentPercent === 100 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : currentPercent >= 92 ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse' : 'bg-white text-gray-400 border-gray-200'
                    }`}>
                      {currentPercent === 100 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                      )}
                      <span className="truncate">3. Сборка трека</span>
                    </div>
                  </div>
                </div>

                {/* Live Speaker & Script Ticker (When generating) */}
                {progressData?.currentTextSnippet && status === 'processing' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-white border border-pastel-border/80 shadow-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-pastel-muted font-medium">
                      <span className="flex items-center gap-1.5 text-pastel-accentRose font-bold">
                        <Music className="w-3.5 h-3.5 animate-bounce" />
                        Сейчас озвучивается: {progressData.currentSpeaker}
                      </span>
                      <span>Шаг {progressData.currentStep} из {progressData.totalSteps}</span>
                    </div>
                    <p className="text-xs text-pastel-text italic font-medium leading-relaxed bg-pastel-bg/50 p-2.5 rounded-xl border border-pastel-border/40">
                      «{progressData.currentTextSnippet}»
                    </p>
                  </motion.div>
                )}

                {/* Telemetry Toggle & Expanded Panel */}
                <div className="border border-pastel-border/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <button
                    type="button"
                    onClick={() => setShowTelemetry(!showTelemetry)}
                    className="w-full p-3 flex items-center justify-between text-xs font-bold text-pastel-text bg-pastel-bg/40 hover:bg-pastel-bg/80 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-pastel-accentViolet">
                      <BarChart3 className="w-4 h-4" />
                      Статистика и телеметрия генерации
                    </span>
                    <div className="flex items-center gap-1 text-pastel-muted">
                      <span className="text-[11px] font-normal">
                        {showTelemetry ? 'Скрыть детали' : 'Показать метрики'}
                      </span>
                      {showTelemetry ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {showTelemetry && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 space-y-4 border-t border-pastel-border/60 text-xs"
                    >
                      {/* Metric Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-pastel-bg/60 border border-pastel-border/60">
                          <span className="text-[10px] text-pastel-muted flex items-center gap-1 mb-0.5">
                            <Clock className="w-3 h-3" /> Общее время
                          </span>
                          <span className="font-bold text-pastel-text">
                            {telemetryObj.totalDurationSec ? `${telemetryObj.totalDurationSec} с` : 'В процессе...'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-pastel-bg/60 border border-pastel-border/60">
                          <span className="text-[10px] text-pastel-muted flex items-center gap-1 mb-0.5">
                            <FileText className="w-3 h-3" /> Сценарий (LLM)
                          </span>
                          <span className="font-bold text-pastel-text">
                            {telemetryObj.scriptDurationSec ? `${telemetryObj.scriptDurationSec} с` : '...'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-pastel-bg/60 border border-pastel-border/60">
                          <span className="text-[10px] text-pastel-muted flex items-center gap-1 mb-0.5">
                            <Cpu className="w-3 h-3" /> Модели AI
                          </span>
                          <span className="font-bold text-pastel-accentViolet truncate block" title={telemetryObj.modelsUsed?.ttsModel || 'gemini-tts-v3'}>
                            {telemetryObj.modelsUsed?.ttsModel || 'gemini-tts-v3'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-pastel-bg/60 border border-pastel-border/60">
                          <span className="text-[10px] text-pastel-muted flex items-center gap-1 mb-0.5">
                            <Headphones className="w-3 h-3" /> Голоса
                          </span>
                          <span className="font-bold text-pastel-accentRose">
                            {voice1}{mode === 'duo' ? ` + ${voice2}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Export Report Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-pastel-border/40">
                        <span className="text-[11px] text-pastel-muted font-medium">
                          Экспорт отчета с таймингами и сценарием:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyReport}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-pastel-border hover:bg-pastel-bg text-pastel-text transition cursor-pointer shadow-2xs"
                          >
                            {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-pastel-muted" />}
                            <span>{reportCopied ? 'Скопировано!' : 'Скопировать .md'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadReport}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-pastel-lavender text-pastel-accentViolet border border-pastel-accentViolet/30 hover:bg-pastel-accentViolet hover:text-white transition cursor-pointer shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Скачать отчет (.md)</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Footer Actions when completed */}
              {status === 'completed' && (
                <div className="pt-4 border-t border-pastel-border/60 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    className="px-4 py-2.5 rounded-xl border border-pastel-border text-xs font-semibold text-pastel-text hover:bg-pastel-bg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-pastel-accentViolet" />
                    <span>Скачать отчет (.md)</span>
                  </button>

                  <button
                    type="button"
                    onClick={closeRecapModal}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer"
                  >
                    Готово / Слушать
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===================== VIEW 3: ERROR STATE ===================== */}
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
