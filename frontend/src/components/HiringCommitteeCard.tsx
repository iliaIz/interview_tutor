import React from 'react';
import { 
  Award, ShieldAlert, CheckCircle2, AlertTriangle, 
  TrendingUp, Layers, Cpu, GraduationCap, Flame, Sparkles, AlertOctagon 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  FaangScorecardData, 
  InterviewPersonaId, 
  FAANG_PERSONAS, 
  TARGET_GRADES 
} from '../types/personas';

interface HiringCommitteeCardProps {
  scorecard: FaangScorecardData;
  personaId?: InterviewPersonaId;
}

export const HiringCommitteeCard: React.FC<HiringCommitteeCardProps> = ({
  scorecard,
  personaId = 'mentor'
}) => {
  const persona = FAANG_PERSONAS[personaId] || FAANG_PERSONAS.mentor;
  const targetGradeInfo = TARGET_GRADES[scorecard.targetGrade] || TARGET_GRADES.L5_SENIOR;
  const calibratedGradeInfo = TARGET_GRADES[scorecard.calibratedGrade] || targetGradeInfo;

  // Verdict Styling & Visual Stamp
  const getVerdictBadge = () => {
    switch (scorecard.verdict) {
      case 'STRONG_HIRE':
        return {
          title: 'STRONG HIRE',
          subtitle: 'Безусловный найм с повышением',
          bgStyle: 'from-emerald-500/15 via-teal-500/10 to-green-500/15 border-emerald-400 text-emerald-800',
          stampStyle: 'bg-emerald-600 text-white shadow-emerald-200 border-emerald-500',
          icon: Award
        };
      case 'HIRE':
        return {
          title: 'HIRE',
          subtitle: 'Уверенный стандартный оффер',
          bgStyle: 'from-green-500/15 via-emerald-500/10 to-teal-500/15 border-green-400 text-green-800',
          stampStyle: 'bg-green-600 text-white shadow-green-200 border-green-500',
          icon: CheckCircle2
        };
      case 'LEANING_HIRE':
        return {
          title: 'LEANING HIRE',
          subtitle: 'Склонение к найму с оговорками',
          bgStyle: 'from-blue-500/15 via-indigo-500/10 to-cyan-500/15 border-blue-400 text-blue-800',
          stampStyle: 'bg-blue-600 text-white shadow-blue-200 border-blue-500',
          icon: TrendingUp
        };
      case 'LEANING_NO_HIRE':
        return {
          title: 'LEANING NO HIRE',
          subtitle: 'Сомнения комитета, есть пробелы',
          bgStyle: 'from-amber-500/15 via-orange-500/10 to-yellow-500/15 border-amber-400 text-amber-800',
          stampStyle: 'bg-amber-600 text-white shadow-amber-200 border-amber-500',
          icon: AlertTriangle
        };
      case 'STRONG_NO_HIRE':
      default:
        return {
          title: 'STRONG NO HIRE',
          subtitle: 'Критические ошибки и пробелы',
          bgStyle: 'from-rose-500/15 via-red-500/10 to-pink-500/15 border-rose-400 text-rose-800',
          stampStyle: 'bg-rose-600 text-white shadow-rose-200 border-rose-500',
          icon: AlertOctagon
        };
    }
  };

  const verdictMeta = getVerdictBadge();
  const VerdictIcon = verdictMeta.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-5 rounded-3xl bg-gradient-to-br from-white/95 via-pastel-lavender/30 to-white/90 border border-pastel-border/80 shadow-sm space-y-4 text-left"
    >
      {/* Header: Persona identity + Official Stamp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pastel-border/50">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-2xs font-bold text-sm shrink-0"
            style={{ backgroundColor: persona.accentColor }}
          >
            {personaId === 'amazon_bar_raiser' ? '📦' : personaId === 'google_staff' ? '🔍' : personaId === 'yandex_core' ? '🔴' : '🎓'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-pastel-text">
                {persona.company} • Hiring Committee Packet
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-accentViolet/10 text-pastel-accentViolet border border-pastel-accentViolet/25">
                {persona.badge}
              </span>
            </div>
            <p className="text-[11px] text-pastel-muted">
              Калибровка грейда: <strong className="text-pastel-text">{targetGradeInfo.label}</strong>
              {scorecard.calibratedGrade !== scorecard.targetGrade && (
                <span> ➔ подтверждено: <strong className="text-emerald-700">{calibratedGradeInfo.label}</strong></span>
              )}
            </p>
          </div>
        </div>

        {/* Verdict Stamp */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className={`px-3 py-1.5 rounded-2xl border flex items-center gap-1.5 shadow-xs ${verdictMeta.stampStyle}`}>
            <VerdictIcon className="w-4 h-4" />
            <span className="font-extrabold tracking-wide text-xs">{verdictMeta.title}</span>
          </div>
        </div>
      </div>

      {/* Market Percentile Gauge */}
      <div className="p-3.5 rounded-2xl bg-white/80 border border-pastel-border/60 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-pastel-text flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" />
            Рынoчный персентиль кандидата
          </span>
          <span className="font-extrabold text-pastel-accentRose">
            Топ {100 - scorecard.percentile}% (Опережает {scorecard.percentile}% коллег)
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scorecard.percentile}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              scorecard.percentile >= 80 
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500' 
                : scorecard.percentile >= 60 
                ? 'bg-gradient-to-r from-blue-400 to-indigo-500' 
                : 'bg-gradient-to-r from-amber-400 to-rose-400'
            }`}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 font-medium px-0.5">
          <span>L4 Middle (0–40%)</span>
          <span>L5 Senior (41–80%)</span>
          <span>L6 Staff / Principal (81–100%)</span>
        </div>
      </div>

      {/* 4 Assessment Dimensions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* 1. Domain Depth */}
        <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-pastel-text flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-rose-500" />
              1. Domain Depth (JVM / Core)
            </span>
            <span className="font-extrabold text-xs text-rose-700">
              {scorecard.dimensionScores.domainDepth.score}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-rose-500 rounded-full" 
              style={{ width: `${scorecard.dimensionScores.domainDepth.score}%` }} 
            />
          </div>
          <p className="text-[10px] text-pastel-muted leading-tight">
            {scorecard.dimensionScores.domainDepth.comment || 'Глубина понимания механизмов JVM'}
          </p>
        </div>

        {/* 2. System Architecture & Scale */}
        <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-pastel-text flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              2. System Architecture & Scale
            </span>
            <span className="font-extrabold text-xs text-blue-700">
              {scorecard.dimensionScores.systemArchitecture.score}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full" 
              style={{ width: `${scorecard.dimensionScores.systemArchitecture.score}%` }} 
            />
          </div>
          <p className="text-[10px] text-pastel-muted leading-tight">
            {scorecard.dimensionScores.systemArchitecture.comment || 'Осознание компромиссов и точек отказа'}
          </p>
        </div>

        {/* 3. Communication & Structure (STAR/PREP) */}
        <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-pastel-text flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-purple-500" />
              3. Communication (STAR / PREP)
            </span>
            <span className="font-extrabold text-xs text-purple-700">
              {scorecard.dimensionScores.communicationStar.score}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 rounded-full" 
              style={{ width: `${scorecard.dimensionScores.communicationStar.score}%` }} 
            />
          </div>
          <p className="text-[10px] text-pastel-muted leading-tight">
            {scorecard.dimensionScores.communicationStar.comment || 'Структура ответа и аргументация'}
          </p>
        </div>

        {/* 4. Operational Excellence */}
        <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-pastel-text flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              4. Operational Excellence
            </span>
            <span className="font-extrabold text-xs text-amber-700">
              {scorecard.dimensionScores.operationalExcellence.score}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full" 
              style={{ width: `${scorecard.dimensionScores.operationalExcellence.score}%` }} 
            />
          </div>
          <p className="text-[10px] text-pastel-muted leading-tight">
            {scorecard.dimensionScores.operationalExcellence.comment || 'Учет аварий, отказов и мониторинга'}
          </p>
        </div>
      </div>

      {/* Strengths & Red Flags */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Strengths */}
        {scorecard.strengths && scorecard.strengths.length > 0 && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1">
            <span className="text-[11px] font-extrabold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Сильные стороны (Strengths):
            </span>
            <ul className="space-y-1 text-[11px] text-emerald-950">
              {scorecard.strengths.map((s, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags / Risk areas */}
        {scorecard.redFlags && scorecard.redFlags.length > 0 ? (
          <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-1">
            <span className="text-[11px] font-extrabold text-rose-800 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Зоны риска комитета (Red Flags):
            </span>
            <ul className="space-y-1 text-[11px] text-rose-950">
              {scorecard.redFlags.map((rf, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold shrink-0">•</span>
                  <span>{rf}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center gap-2 text-slate-500 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Критических сигналов (Red Flags) комитетом не зафиксировано.</span>
          </div>
        )}
      </div>

      {/* Official Recommendation Note */}
      {scorecard.hiringRecommendation && (
        <div className="p-3.5 rounded-2xl bg-white/95 border border-pastel-border flex items-start gap-2.5 text-xs text-pastel-text">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block text-pastel-text mb-0.5">
              Заключение комитета найма ({persona.company}):
            </span>
            <p className="text-pastel-muted leading-relaxed">
              {scorecard.hiringRecommendation}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
