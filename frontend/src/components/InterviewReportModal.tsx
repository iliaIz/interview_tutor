import React, { useState, useEffect } from 'react';
import { 
  X, Award, Activity, CheckCircle2, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, BookOpen, Mic, Keyboard, Sparkles, Heart 
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { AcousticMetrics } from '../services/AcousticTelemetryService';

export interface InterviewReportData {
  id?: string;
  questionId: string;
  questionText?: string;
  referenceAnswer?: string;
  topic?: string;
  mode: 'voice' | 'text';
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
  userAnswer?: string;
  transcript?: string;
  audioMetrics?: AcousticMetrics | null;
  createdAt?: string;
}

interface InterviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: InterviewReportData | null;
}

export const InterviewReportModal: React.FC<InterviewReportModalProps> = ({
  isOpen,
  onClose,
  report
}) => {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showReferenceAnswer, setShowReferenceAnswer] = useState(false);

  // Animated Count-Up Score
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (isOpen && report) {
      setDisplayScore(0);
      const controls = animate(0, report.score, {
        duration: 1.2,
        ease: 'easeOut',
        onUpdate: (latest) => setDisplayScore(Math.round(latest)),
      });
      return () => controls.stop();
    }
  }, [isOpen, report?.score]);

  if (!isOpen || !report) return null;

  const getPaceDescriptor = (wpm: number) => {
    if (wpm < 90) return { label: 'Задумчивый темп', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    if (wpm <= 155) return { label: 'Оптимальный темп ✨', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    return { label: 'Энергичный темп', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
  };

  const getPauseDescriptor = (pauseRatio: number) => {
    if (pauseRatio < 10) return { label: 'Слитная речь', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    if (pauseRatio <= 28) return { label: 'Уверенная подача ✨', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    return { label: 'Осмысленные паузы', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  };

  const paceInfo = report.audioMetrics ? getPaceDescriptor(report.audioMetrics.grossWpm) : null;
  const pauseInfo = report.audioMetrics ? getPauseDescriptor(report.audioMetrics.pauseRatioPercent) : null;

  const strokeDashoffset = 283 - (283 * displayScore) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className="bg-white/95 rounded-3xl max-w-2xl w-full border border-pastel-rose/80 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Soft Ambient Mesh Auras */}
        <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-gradient-to-br from-pastel-accentRose/20 to-transparent blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-gradient-to-tr from-pastel-accentViolet/20 to-transparent blur-2xl pointer-events-none" />

        {/* Header Bar */}
        <div className="p-5 md:p-6 pb-4 border-b border-pastel-border/60 flex items-center justify-between bg-gradient-to-r from-pastel-bg/60 via-white to-pastel-rose/30 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white rounded-2xl flex items-center justify-center shadow-sm shadow-pastel-accentRose/25">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-pastel-text text-base md:text-lg">
                  Executive Report Studio
                </h3>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border shadow-2xs ${
                  report.mode === 'voice' 
                    ? 'bg-purple-50 text-pastel-accentViolet border-purple-200/80' 
                    : 'bg-blue-50 text-blue-700 border-blue-200/80'
                }`}>
                  {report.mode === 'voice' ? <Mic className="w-3 h-3 text-pastel-accentViolet" /> : <Keyboard className="w-3 h-3 text-blue-600" />}
                  {report.mode === 'voice' ? 'Голосовой диалог' : 'Текстовый ответ'}
                </span>
              </div>
              <p className="text-[11px] text-pastel-muted font-medium mt-0.5">
                {report.topic || 'Java & Spring Framework'}
                {report.createdAt && ` • ${new Date(report.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-pastel-bg text-pastel-muted hover:text-pastel-text flex items-center justify-center hover:bg-pastel-rose/40 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4 text-xs md:text-sm flex-1 relative z-10 pr-2">
          {/* Question Text Box */}
          {report.questionText && (
            <div className="p-4 rounded-2xl bg-pastel-bg/80 border border-pastel-border/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-muted block mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-pastel-accentRose" /> Тематический вопрос:
              </span>
              <p className="text-pastel-text font-bold leading-relaxed">{report.questionText}</p>
            </div>
          )}

          {/* Primary Score Hero Banner with Animated Radial Ring */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-pastel-rose/80 via-white to-pastel-lavender/80 border border-pastel-accentRose/30 shadow-xs flex items-center justify-between relative overflow-hidden">
            <div className="space-y-1 z-10">
              <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider block">
                Итоговый результат
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-black text-pastel-text tracking-tight">
                  {displayScore}
                </span>
                <span className="text-sm font-bold text-pastel-muted">/ 100</span>
              </div>
              <div className="pt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${
                  report.isPassed 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {report.isPassed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Отличный ответ • Зачтено 🎉</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Хорошая попытка • Зона роста</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Radial SVG Progress Gauge */}
            <div className="relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center shrink-0 z-10">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="text-gray-200/80 stroke-current"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className={report.isPassed ? 'text-emerald-500 stroke-current' : 'text-amber-500 stroke-current'}
                  strokeWidth="8"
                  strokeDasharray="283"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <Award className={`w-6 h-6 ${report.isPassed ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
            </div>
          </div>

          {/* Acoustic Voice Telemetry Profile (If Voice Mode) */}
          {report.audioMetrics && (
            <div className="p-4 md:p-5 rounded-2xl bg-white border border-pastel-border/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-pastel-text uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-pastel-accentViolet" />
                  Акустический профиль речи и уверенности
                </h4>
                <span className="text-[10px] font-semibold text-pastel-muted">Gemini Live Telemetry</span>
              </div>

              {/* 30-Point Sparkline Waveform */}
              {report.audioMetrics.energyVector30 && report.audioMetrics.energyVector30.length > 0 && (
                <div className="p-3 bg-pastel-bg/60 rounded-xl border border-pastel-border/60 flex items-end justify-between h-14 gap-1">
                  {report.audioMetrics.energyVector30.map((val, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(10, val * 100)}%` }}
                      transition={{ duration: 0.35, delay: idx * 0.012 }}
                      className={`w-full rounded-full transition-all ${
                        val > 0.65 
                          ? 'bg-gradient-to-t from-pastel-accentRose to-pink-400' 
                          : val > 0.35 
                          ? 'bg-gradient-to-t from-pastel-accentViolet to-indigo-300' 
                          : 'bg-gray-200'
                      }`}
                      title={`Сегмент ${idx + 1}: ${(val * 100).toFixed(0)}% энергии`}
                    />
                  ))}
                </div>
              )}

              {/* Acoustic Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-pastel-bg/50 border border-pastel-border/50">
                  <span className="text-[10px] text-pastel-muted font-bold block mb-0.5">ГРОМКОСТЬ</span>
                  <span className="text-xs md:text-sm font-black text-pastel-text">{report.audioMetrics.rmsDb} dB</span>
                  <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">✨ Четко</span>
                </div>

                <div className="p-2.5 rounded-xl bg-pastel-bg/50 border border-pastel-border/50">
                  <span className="text-[10px] text-pastel-muted font-bold block mb-0.5">ЧИСТОТА / SNR</span>
                  <span className="text-xs md:text-sm font-black text-pastel-text">+{report.audioMetrics.snrDb} dB</span>
                  <span className="text-[10px] text-pastel-muted font-semibold block mt-0.5">Шум: {report.audioMetrics.noiseFloorDb} dB</span>
                </div>

                <div className="p-2.5 rounded-xl bg-pastel-bg/50 border border-pastel-border/50">
                  <span className="text-[10px] text-pastel-muted font-bold block mb-0.5">ТЕМП РЕЧИ</span>
                  <span className="text-xs md:text-sm font-black text-pastel-text">{report.audioMetrics.grossWpm} WPM</span>
                  <span className={`text-[9px] font-semibold block mt-0.5 px-1 rounded-md border ${paceInfo?.color}`}>
                    {paceInfo?.label}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-pastel-bg/50 border border-pastel-border/50">
                  <span className="text-[10px] text-pastel-muted font-bold block mb-0.5">ПАУЗЫ</span>
                  <span className="text-xs md:text-sm font-black text-pastel-text">{report.audioMetrics.pauseRatioPercent}%</span>
                  <span className={`text-[9px] font-semibold block mt-0.5 px-1 rounded-md border ${pauseInfo?.color}`}>
                    {pauseInfo?.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Supportive Feedback Section */}
          <div className="p-4 rounded-2xl bg-pastel-lavender/60 border border-pastel-accentViolet/20 space-y-1.5">
            <span className="text-xs font-bold text-pastel-accentViolet flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pastel-accentViolet" />
              Поддерживающий комментарий ментора:
            </span>
            <p className="text-xs text-pastel-text leading-relaxed font-medium">
              {report.feedback || 'Ответ внимательно проанализирован и сохранен в прогресс.'}
            </p>
          </div>

          {/* Positive and Missing Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Positive Points */}
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 shadow-2xs">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Что раскрыто отлично:
              </span>
              {report.positivePoints && report.positivePoints.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-emerald-950">
                  {report.positivePoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-800 italic">Ответ зачтен в базовом объеме.</p>
              )}
            </div>

            {/* Missing Points / Growth Zone */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-2xs">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Зона роста и важные детали:
              </span>
              {report.missingPoints && report.missingPoints.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-amber-950">
                  {report.missingPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-800 italic">✨ Все ключевые термины и концепции раскрыты!</p>
              )}
            </div>
          </div>

          {/* Collapsible Transcript Dialogue */}
          {(report.transcript || report.userAnswer) && (
            <div className="border border-pastel-border rounded-2xl overflow-hidden shadow-2xs">
              <button
                onClick={() => setShowFullTranscript(!showFullTranscript)}
                className="w-full p-3.5 bg-pastel-bg/50 hover:bg-pastel-bg/90 flex items-center justify-between text-xs font-bold text-pastel-text transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pastel-accentViolet" />
                  Стенограмма диалога с интервьюером
                </span>
                {showFullTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {showFullTranscript && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-4 bg-white text-xs text-pastel-text leading-relaxed space-y-2 border-t border-pastel-border/60"
                  >
                    {report.transcript ? (
                      <pre className="whitespace-pre-wrap font-sans text-xs">{report.transcript}</pre>
                    ) : (
                      <p>{report.userAnswer}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapsible Reference Model Answer */}
          {report.referenceAnswer && (
            <div className="border border-pastel-border rounded-2xl overflow-hidden shadow-2xs">
              <button
                onClick={() => setShowReferenceAnswer(!showReferenceAnswer)}
                className="w-full p-3.5 bg-pastel-bg/50 hover:bg-pastel-bg/90 flex items-center justify-between text-xs font-bold text-pastel-text transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-pastel-accentRose" />
                  Эталонный ответ из базы знаний
                </span>
                {showReferenceAnswer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {showReferenceAnswer && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-4 bg-white text-xs text-pastel-text leading-relaxed border-t border-pastel-border/60"
                  >
                    <pre className="whitespace-pre-wrap font-sans text-xs bg-pastel-bg/60 p-3 rounded-xl border border-pastel-border/60">
                      {report.referenceAnswer}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-pastel-border/60 bg-pastel-bg/40 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-pastel-muted flex items-center gap-1 font-medium">
            <span>Продолжай в том же духе</span>
            <Heart className="w-3 h-3 text-pastel-accentRose fill-pastel-accentRose inline" />
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-pastel-text text-white font-semibold text-xs hover:opacity-90 transition cursor-pointer shadow-xs"
          >
            Закрыть отчет
          </button>
        </div>
      </motion.div>
    </div>
  );
};
