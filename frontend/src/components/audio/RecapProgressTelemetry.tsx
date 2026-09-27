import React, { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Layers,
  Music,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Cpu,
  Headphones,
  Check,
  Copy,
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import { buildMarkdownReport } from './audioRecapConfig';

interface RecapProgressTelemetryProps {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'idle';
  progressMsg: string;
  progressData: any;
  completedJobData: any;
  jobId: string | null;
  recapTarget: any;
  mode: 'duo' | 'solo';
  voice1: string;
  voice2?: string;
  onClose: () => void;
}

export const RecapProgressTelemetry: React.FC<RecapProgressTelemetryProps> = ({
  status,
  progressMsg,
  progressData,
  completedJobData,
  jobId,
  recapTarget,
  mode,
  voice1,
  voice2,
  onClose,
}) => {
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);

  const currentPercent =
    progressData?.percentage ?? (status === 'queued' ? 5 : status === 'completed' ? 100 : 15);
  const telemetryObj = progressData?.telemetry || completedJobData?.metadata?.telemetry || {};

  const handleCopyReport = () => {
    const md = buildMarkdownReport({
      job: completedJobData || {},
      telemetry: telemetryObj,
      title: recapTarget?.title || 'Аудиопересказ темы',
      topic: recapTarget?.topicName || 'Обзор темы',
      jobId,
      mode,
      voice1,
      voice2,
      totalSteps: progressData?.totalSteps,
    });
    navigator.clipboard.writeText(md).then(() => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2500);
    });
  };

  const handleDownloadReport = () => {
    const md = buildMarkdownReport({
      job: completedJobData || {},
      telemetry: telemetryObj,
      title: recapTarget?.title || 'Аудиопересказ темы',
      topic: recapTarget?.topicName || 'Обзор темы',
      jobId,
      mode,
      voice1,
      voice2,
      totalSteps: progressData?.totalSteps,
    });
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

  return (
    <div className="py-4 flex-1 flex flex-col justify-between overflow-y-auto pr-1">
      <div className="space-y-5">
        {/* Header Status Block */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-pastel-lavender/80 text-pastel-accentViolet border border-pastel-accentViolet/20">
            {status === 'completed' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Генерация успешно завершена (Opus 48k)</span>
              </>
            ) : (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pastel-accentViolet" />
                <span>Потоковая генерация через SSE</span>
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
              <span className="truncate">3. Склейка & Opus</span>
            </div>
          </div>
        </div>

        {/* Live Speaker & Script Ticker */}
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
                    {voice1}{mode === 'duo' && voice2 ? ` + ${voice2}` : ''}
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
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer"
          >
            Готово / Слушать в плеере
          </button>
        </div>
      )}
    </div>
  );
};
