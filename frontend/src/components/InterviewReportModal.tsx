import React, { useState } from 'react';
import { 
  X, Award, Volume2, Activity, Clock, CheckCircle2, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, BookOpen, Mic, Keyboard, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

  if (!isOpen || !report) return null;

  const getPaceDescriptor = (wpm: number) => {
    if (wpm < 90) return { label: 'Замедленный темп', color: 'text-amber-600 bg-amber-50' };
    if (wpm <= 155) return { label: 'Оптимальный темп', color: 'text-emerald-600 bg-emerald-50' };
    return { label: 'Ускоренный темп', color: 'text-blue-600 bg-blue-50' };
  };

  const getPauseDescriptor = (pauseRatio: number) => {
    if (pauseRatio < 10) return { label: 'Очень быстрая речь', color: 'text-blue-600 bg-blue-50' };
    if (pauseRatio <= 28) return { label: 'Уверенная подача', color: 'text-emerald-600 bg-emerald-50' };
    return { label: 'Частые паузы', color: 'text-amber-600 bg-amber-50' };
  };

  const paceInfo = report.audioMetrics ? getPaceDescriptor(report.audioMetrics.grossWpm) : null;
  const pauseInfo = report.audioMetrics ? getPauseDescriptor(report.audioMetrics.pauseRatioPercent) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 15 }}
        className="bg-white rounded-3xl max-w-2xl w-full border border-pastel-border shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header Bar */}
        <div className="p-6 pb-4 border-b border-pastel-border/60 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-pastel-lavender text-pastel-accentViolet rounded-2xl shadow-xs">
              <Award className="w-6 h-6" />
            </span>
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                Executive Interview Report
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  report.mode === 'voice' 
                    ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {report.mode === 'voice' ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
                  {report.mode === 'voice' ? 'Голосовой ответ' : 'Текстовый ответ'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {report.topic || 'Java & Spring Framework'}
                {report.createdAt && ` • ${new Date(report.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {/* Question Text Box */}
          {report.questionText && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Вопрос темы:
              </span>
              <p className="text-slate-800 font-medium leading-relaxed">{report.questionText}</p>
            </div>
          )}

          {/* Primary Score Hero Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-rose-500/10 border border-indigo-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Итоговый вердикт
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900">{report.score}</span>
                <span className="text-sm font-bold text-slate-400">/ 100</span>
                <span className={`ml-2 text-xs font-bold px-3 py-1 rounded-full ${
                  report.isPassed 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {report.isPassed ? '✓ Собеседование пройдено' : '⚠️ Требует повторения'}
                </span>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-slate-500 block">Порог прохождения: 70 баллов</span>
              <span className="text-[11px] text-slate-400 font-medium">Анализ Gemini Live Reasoning</span>
            </div>
          </div>

          {/* Acoustic Voice Telemetry Profile (If Voice Mode) */}
          {report.audioMetrics && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-purple-600" />
                  Акустический профиль речи кандидата
                </h4>
                <span className="text-[10px] font-semibold text-slate-400">AudioWorklet Telemetry</span>
              </div>

              {/* 30-Point Sparkline Waveform */}
              {report.audioMetrics.energyVector30 && report.audioMetrics.energyVector30.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-end justify-between h-14 gap-1">
                  {report.audioMetrics.energyVector30.map((val, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(10, val * 100)}%` }}
                      transition={{ duration: 0.4, delay: idx * 0.01 }}
                      className={`w-full rounded-full transition-all ${
                        val > 0.65 ? 'bg-purple-500' : val > 0.35 ? 'bg-indigo-400' : 'bg-slate-300'
                      }`}
                      title={`Фрейм ${idx + 1}: ${(val * 100).toFixed(0)}% энергии`}
                    />
                  ))}
                </div>
              )}

              {/* Acoustic Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">ГРОМКОСТЬ</span>
                  <span className="text-sm font-black text-slate-800">{report.audioMetrics.rmsDb} dB</span>
                  <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Оптимально</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">ШУМ / SNR</span>
                  <span className="text-sm font-black text-slate-800">+{report.audioMetrics.snrDb} dB</span>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Шум: {report.audioMetrics.noiseFloorDb} dB</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">ТЕМП РЕЧИ</span>
                  <span className="text-sm font-black text-slate-800">{report.audioMetrics.grossWpm} WPM</span>
                  <span className={`text-[10px] font-semibold block mt-0.5 px-1 py-0.2 rounded-md ${paceInfo?.color}`}>
                    {paceInfo?.label}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">ПАУЗЫ</span>
                  <span className="text-sm font-black text-slate-800">{report.audioMetrics.pauseRatioPercent}%</span>
                  <span className={`text-[10px] font-semibold block mt-0.5 px-1 py-0.2 rounded-md ${pauseInfo?.color}`}>
                    {pauseInfo?.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Section */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Резюме и рекомендации интервьюера:
            </span>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {report.feedback || 'Ответ принят и оценен.'}
            </p>
          </div>

          {/* Positive and Missing Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Positive */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Что отвечено точно:
              </span>
              {report.positivePoints.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-emerald-900">
                  {report.positivePoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700 italic">Ответ зачтен в базовом объеме.</p>
              )}
            </div>

            {/* Missing */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Упущенные термины / детали:
              </span>
              {report.missingPoints.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-amber-900">
                  {report.missingPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700 italic">Все ключевые концепции эталона раскрыты!</p>
              )}
            </div>
          </div>

          {/* Collapsible Transcript Dialogue */}
          {(report.transcript || report.userAnswer) && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowFullTranscript(!showFullTranscript)}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
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
                    className="p-4 bg-white text-xs text-slate-700 leading-relaxed space-y-2 border-t border-slate-100"
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
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowReferenceAnswer(!showReferenceAnswer)}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-500" />
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
                    className="p-4 bg-white text-xs text-slate-800 leading-relaxed border-t border-slate-100"
                  >
                    <pre className="whitespace-pre-wrap font-sans text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {report.referenceAnswer}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-pastel-border/60 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition"
          >
            Закрыть отчет
          </button>
        </div>
      </motion.div>
    </div>
  );
};
