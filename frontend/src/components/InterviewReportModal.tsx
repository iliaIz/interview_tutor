/**
 * InterviewReportModal.tsx
 * Executive Report Studio modal (SPEC-29).
 * Decomposed into ExecutiveReportPresenter, AcousticCoachingStudio, and InterviewTranscriptViewer.
 * SLA: <= 180 lines (Rule 8 compliant).
 */

import React, { useState, useEffect } from 'react';
import { X, Award, CheckCircle2, Sparkles, Mic, Keyboard, Heart, BookOpen } from 'lucide-react';
import { motion, animate } from 'framer-motion';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { triggerSuccessConfetti } from '../utils/confetti';
import { HiringCommitteeCard } from './HiringCommitteeCard';
import { ExecutiveReportPresenter } from '../services/reports/ExecutiveReportPresenter';
import { AcousticCoachingStudio } from './reports/AcousticCoachingStudio';
import { InterviewTranscriptViewer } from './reports/InterviewTranscriptViewer';

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
  audioMetrics?: any;
  clarityMetrics?: any;
  speechCoaching?: any;
  faangScorecard?: any;
  persona?: any;
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
  useBodyScrollLock(isOpen);

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

  const vm = ExecutiveReportPresenter.createViewModel(report);
  const strokeDashoffset = 283 - (283 * displayScore) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto modal-overscroll-contain font-sans">
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
                <h3 className="font-bold text-pastel-text text-base md:text-lg">Executive Report Studio</h3>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border shadow-2xs ${
                  vm.header.mode === 'voice'
                    ? 'bg-purple-50 text-pastel-accentViolet border-purple-200/80'
                    : 'bg-blue-50 text-blue-700 border-blue-200/80'
                }`}>
                  {vm.header.mode === 'voice' ? <Mic className="w-3 h-3 text-pastel-accentViolet" /> : <Keyboard className="w-3 h-3 text-blue-600" />}
                  {vm.header.mode === 'voice' ? 'Голосовой диалог' : 'Текстовый ответ'}
                </span>
              </div>
              <p className="text-[11px] text-pastel-muted font-medium mt-0.5">
                {vm.header.topic}
                {vm.header.formattedDate && ` • ${vm.header.formattedDate}`}
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
          {vm.questionText && (
            <div className="p-4 rounded-2xl bg-pastel-bg/80 border border-pastel-border/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-muted block mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-pastel-accentRose" /> Тематический вопрос:
              </span>
              <p className="text-pastel-text font-bold leading-relaxed">{vm.questionText}</p>
            </div>
          )}

          {/* Primary Score Hero Banner with Animated Radial Ring */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-pastel-rose/80 via-white to-pastel-lavender/80 border border-pastel-accentRose/30 shadow-xs flex items-center justify-between relative overflow-hidden">
            <div className="space-y-1 z-10">
              <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider block">Итоговый результат</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-black text-pastel-text tracking-tight">{displayScore}</span>
                <span className="text-sm font-bold text-pastel-muted">/ 100</span>
              </div>
              <div className="pt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${
                  vm.scoreBadge.isPassed ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {vm.scoreBadge.isPassed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
                  <span>{vm.scoreBadge.label}</span>
                </span>
              </div>
            </div>

            <div className="relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center shrink-0 z-10">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" className="text-gray-200/80 stroke-current" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50" cy="50" r="45"
                  className={vm.scoreBadge.isPassed ? 'text-emerald-500 stroke-current' : 'text-amber-500 stroke-current'}
                  strokeWidth="8"
                  strokeDasharray="283"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <Award className={`w-6 h-6 ${vm.scoreBadge.isPassed ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
            </div>
          </div>

          {/* Acoustic Voice Telemetry Profile */}
          {vm.acousticProfile && (
            <AcousticCoachingStudio
              metrics={vm.acousticProfile.metrics}
              humanProfile={vm.acousticProfile.humanProfile}
              rephrasedExample={vm.rephrasedExample}
              structureType={vm.structureType}
            />
          )}

          {/* FAANG Hiring Committee Packet */}
          {vm.faangScorecard && (
            <HiringCommitteeCard
              scorecard={vm.faangScorecard}
              personaId={vm.persona || 'mentor'}
            />
          )}

          {/* Feedback Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 shadow-2xs">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Что раскрыто отлично:
              </span>
              <ul className="space-y-1.5 text-xs text-emerald-950">
                {vm.positivePoints.map((pt, idx) => (
                  <li key={idx} className="flex items-start gap-1.5"><span className="text-emerald-500 font-bold">•</span><span>{pt}</span></li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-2xs">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" /> Зона роста и важные детали:
              </span>
              <ul className="space-y-1.5 text-xs text-amber-950">
                {vm.missingPoints.map((pt, idx) => (
                  <li key={idx} className="flex items-start gap-1.5"><span className="text-amber-500 font-bold">•</span><span>{pt}</span></li>
                ))}
              </ul>
            </div>
          </div>

          {/* Structured Transcript & Reference Answer */}
          <InterviewTranscriptViewer
            transcript={vm.transcript}
            userAnswer={report.userAnswer}
            referenceAnswer={vm.referenceAnswer}
          />
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
