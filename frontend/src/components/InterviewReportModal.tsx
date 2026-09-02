import React, { useState, useEffect } from 'react';
import { 
  X, Award, Activity, CheckCircle2, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, BookOpen, Mic, Keyboard, Sparkles, Heart, Brain, GraduationCap 
} from 'lucide-react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { AcousticTelemetryService, AcousticMetrics, SpeechClarityMetrics } from '../services/AcousticTelemetryService';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { triggerSuccessConfetti } from '../utils/confetti';
import { HiringCommitteeCard } from './HiringCommitteeCard';
import { FaangScorecardData, InterviewPersonaId } from '../types/personas';

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
  clarityMetrics?: SpeechClarityMetrics | null;
  questionType?: 'definitional' | 'tradeoff' | 'behavioral';
  speechCoaching?: {
    structureType?: 'STAR' | 'PREP' | 'RULE_OF_3' | 'UNSTRUCTURED';
    rephrasedExample?: string;
    faangScorecard?: FaangScorecardData;
  };
  faangScorecard?: FaangScorecardData;
  persona?: InterviewPersonaId;
  targetGrade?: string;
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
  // Lock background body scroll on mobile & desktop when modal is active
  useBodyScrollLock(isOpen);

  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showReferenceAnswer, setShowReferenceAnswer] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);

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

      if (report.score >= 80) {
        const timer = setTimeout(() => {
          triggerSuccessConfetti();
        }, 500);
        return () => {
          controls.stop();
          clearTimeout(timer);
        };
      }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto modal-overscroll-contain">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className="bg-white/95 rounded-3xl max-w-2xl w-full border border-pastel-rose/80 shadow-2xl relative overflow-hidden flex flex-col max-h-[92dvh] my-auto modal-overscroll-contain"
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
          {report.audioMetrics && (() => {
            const calculatedClarity = report.clarityMetrics || (
              report.transcript
                ? AcousticTelemetryService.analyzeSpeechClarity(report.transcript, report.audioMetrics.grossWpm)
                : undefined
            );
            const humanProfile = AcousticTelemetryService.getHumanizedProfile(report.audioMetrics, calculatedClarity);
            return (
              <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-br from-pastel-rose/40 via-white to-pastel-lavender/40 border border-pastel-border/80 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-2xs">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs md:text-sm text-pastel-text">
                        Голосовой коучинг и манера речи
                      </h4>
                      <p className="text-[10px] text-pastel-muted">
                        Анализ интонаций, темпа, чистоты и структуры ответа
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 border border-pastel-border text-pastel-accentViolet shadow-2xs">
                    ✨ AI Voice Studio
                  </span>
                </div>

                {/* 30-Point Sparkline Waveform */}
                {report.audioMetrics.energyVector30 && report.audioMetrics.energyVector30.length > 0 && (
                  <div className="p-3 bg-white/85 rounded-2xl border border-pastel-border/60 flex items-end justify-between h-12 gap-1 shadow-2xs">
                    {report.audioMetrics.energyVector30.map((val, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(12, val * 100)}%` }}
                        transition={{ duration: 0.35, delay: idx * 0.012 }}
                        className={`w-full rounded-full transition-all ${
                          val > 0.65 
                            ? 'bg-gradient-to-t from-pastel-accentRose to-pink-400' 
                            : val > 0.35 
                            ? 'bg-gradient-to-t from-pastel-accentViolet to-indigo-300' 
                            : 'bg-pastel-border/80'
                        }`}
                        title={`Сегмент ${idx + 1}: ${(val * 100).toFixed(0)}% энергии`}
                      />
                    ))}
                  </div>
                )}

                {/* Coaching Metric Cards */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${humanProfile.clarity ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-2.5 text-left`}>
                  {/* Volume & Delivery */}
                  <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs">{humanProfile.volume.iconEmoji}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.volume.badgeStyle}`}>
                          {humanProfile.volume.badge}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-pastel-text block">
                        {humanProfile.volume.title}
                      </span>
                      <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                        {humanProfile.volume.description}
                      </p>
                    </div>
                    <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                      Уровень: {humanProfile.volume.techValue}
                    </span>
                  </div>

                  {/* Pace & Rhythm */}
                  <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs">{humanProfile.pace.iconEmoji}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.pace.badgeStyle}`}>
                          {humanProfile.pace.badge}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-pastel-text block">
                        {humanProfile.pace.title}
                      </span>
                      <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                        {humanProfile.pace.description}
                      </p>
                    </div>
                    <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                      Скорость: {humanProfile.pace.techValue}
                    </span>
                  </div>

                  {/* Structure & Pauses */}
                  <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs">{humanProfile.structure.iconEmoji}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.structure.badgeStyle}`}>
                          {humanProfile.structure.badge}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-pastel-text block">
                        {humanProfile.structure.title}
                      </span>
                      <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                        {humanProfile.structure.description}
                      </p>
                    </div>
                    <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                      Паузы: {humanProfile.structure.techValue}
                    </span>
                  </div>

                  {/* Clarity & Filler Words */}
                  {humanProfile.clarity && (
                    <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs">{humanProfile.clarity.iconEmoji}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.clarity.badgeStyle}`}>
                            {humanProfile.clarity.badge}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-pastel-text block">
                          {humanProfile.clarity.title}
                        </span>
                        <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                          {humanProfile.clarity.description}
                        </p>
                      </div>
                      <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                        Чистота: {humanProfile.clarity.techValue}
                      </span>
                    </div>
                  )}
                </div>

                {/* Mentor Coaching Praise Banner */}
                <div className="p-3 rounded-2xl bg-white/95 border border-pastel-rose/80 text-xs text-pastel-text leading-relaxed flex items-center gap-2.5 shadow-2xs">
                  <span className="text-base shrink-0">🌸</span>
                  <p className="font-medium text-pastel-text/90">
                    {humanProfile.mentorPraise}
                  </p>
                </div>

                {/* Pedagogical STAR / PREP Rephrased Example */}
                {report.speechCoaching?.rephrasedExample && (
                  <div className="p-4 bg-gradient-to-r from-pastel-accentViolet/10 via-white to-pastel-accentRose/10 rounded-2xl border border-pastel-accentViolet/35 shadow-2xs space-y-2 text-left animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-pastel-accentViolet">
                        <GraduationCap className="w-4 h-4 text-pastel-accentRose" />
                        <span>Совет тренера: Эталонный ответ по {report.speechCoaching.structureType || 'структуре'}</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-pastel-accentViolet/15 text-pastel-accentViolet">
                        Staff Engineer Style
                      </span>
                    </div>
                    <p className="text-xs text-pastel-text leading-relaxed italic bg-white/75 p-3 rounded-xl border border-pastel-border/50">
                      «{report.speechCoaching.rephrasedExample}»
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* FAANG Hiring Committee Packet (Phase 2) */}
          {(report.faangScorecard || report.speechCoaching?.faangScorecard) && (
            <HiringCommitteeCard
              scorecard={report.faangScorecard || report.speechCoaching!.faangScorecard!}
              personaId={report.persona || 'mentor'}
            />
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

          {/* Semantic Knowledge Memory Status */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pastel-rose via-white to-pastel-lavender border border-pastel-border flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-2xs">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Семантическая память & Радар уязвимостей</span>
                <span className="text-[11px] text-slate-500">Автоматический трекинг дефицита знаний (-1.0 при solo ответе)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRadarOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-pastel-border text-xs font-bold text-pastel-accentViolet hover:bg-pastel-lavender/40 transition shadow-2xs cursor-pointer"
            >
              Радар знаний →
            </button>
          </div>

          {/* Collapsible Transcript Dialogue */}
          {(report.transcript || report.userAnswer) && (() => {
            // Try to parse transcript as JSON dialogue array
            let dialogueTurns: Array<{ role: string; text: string }> = [];
            let deepgramAnswer = '';
            let isStructured = false;

            if (report.transcript) {
              try {
                const parsed = JSON.parse(report.transcript);
                if (Array.isArray(parsed)) {
                  isStructured = true;
                  // Separate Deepgram answer from system/ai turns
                  dialogueTurns = parsed.filter(t => !t.text?.startsWith('[Deepgram]'));
                  const deepgramTurn = parsed.find(t => t.text?.startsWith('[Deepgram]'));
                  if (deepgramTurn) deepgramAnswer = deepgramTurn.text.replace('[Deepgram] ', '');
                }
              } catch { /* raw text fallback */ }
            }

            return (
              <div className="border border-pastel-border rounded-2xl overflow-hidden shadow-2xs">
                <button
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  className="w-full p-3.5 bg-pastel-bg/50 hover:bg-pastel-bg/90 flex items-center justify-between text-xs font-bold text-pastel-text transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-pastel-accentViolet" />
                    📜 Стенограмма диалога с интервьюером
                    {deepgramAnswer && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✨ Deepgram Nova-3
                      </span>
                    )}
                  </span>
                  {showFullTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {showFullTranscript && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-white border-t border-pastel-border/60 overflow-hidden"
                    >
                      <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                        {isStructured ? (
                          <>
                            {dialogueTurns
                              .filter(t => t.role === 'ai' || t.role === 'system')
                              .map((turn, i) => (
                                <div key={i} className={`flex gap-2.5 text-xs ${turn.role === 'system' ? 'opacity-40' : ''}`}>
                                  <span className="text-base shrink-0">{turn.role === 'ai' ? '🤖' : '⚙️'}</span>
                                  <div>
                                    <span className="font-bold text-pastel-accentViolet block text-[10px] mb-0.5">
                                      {turn.role === 'ai' ? 'ИИ-Интервьюер' : 'Система'}
                                    </span>
                                    <p className="text-pastel-text/80 leading-relaxed">{turn.text}</p>
                                  </div>
                                </div>
                              ))
                            }
                            {deepgramAnswer && (
                              <div className="flex gap-2.5 text-xs border-t border-pastel-border/50 pt-3 mt-3">
                                <span className="text-base shrink-0">👤</span>
                                <div>
                                  <span className="font-bold text-emerald-700 block text-[10px] mb-0.5">
                                    Ваш ответ — Deepgram Nova-3 · Русский
                                  </span>
                                  <p className="text-pastel-text/90 leading-relaxed">{deepgramAnswer}</p>
                                </div>
                              </div>
                            )}
                            {!deepgramAnswer && report.userAnswer && report.userAnswer !== 'Устный ответ через Gemini Live' && (
                              <div className="flex gap-2.5 text-xs border-t border-pastel-border/50 pt-3 mt-3">
                                <span className="text-base shrink-0">👤</span>
                                <div>
                                  <span className="font-bold text-pastel-sub block text-[10px] mb-0.5">Ответ кандидата</span>
                                  <p className="text-pastel-text/90 leading-relaxed">{report.userAnswer}</p>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          // Fallback: plain text
                          <p className="text-xs text-pastel-text leading-relaxed whitespace-pre-wrap font-sans">
                            {report.transcript || report.userAnswer}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}


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
                    <div className="mt-1">
                      <MarkdownRenderer content={report.referenceAnswer} />
                    </div>
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

      {/* Memory Radar Drawer */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
      />
    </div>
  );
};
