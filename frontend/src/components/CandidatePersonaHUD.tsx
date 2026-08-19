import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Shield, Brain, ChevronDown, Award, Target, BookOpen } from 'lucide-react';
import { CandidateGapDTO, UserProfileDTO, fetchUserProfile, fetchRelevantGaps } from '../services/memoryApi';

interface CandidatePersonaHUDProps {
  questionText?: string;
  topic?: string;
  questionId?: string;
  onOpenRadar?: () => void;
  className?: string;
}

export const CandidatePersonaHUD: React.FC<CandidatePersonaHUDProps> = ({
  questionText = '',
  topic = '',
  questionId = '',
  onOpenRadar,
  className = ''
}) => {
  const [profile, setProfile] = useState<UserProfileDTO | null>(null);
  const [relevantGaps, setRelevantGaps] = useState<CandidateGapDTO[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchUserProfile().then(setProfile);
  }, []);

  useEffect(() => {
    if (questionText || topic) {
      fetchRelevantGaps(questionText, topic, questionId).then(setRelevantGaps);
    }
  }, [questionText, topic, questionId]);

  const seniorityLabels: Record<string, { label: string; badge: string; color: string }> = {
    junior: { label: 'Junior Engineer', badge: '🌱 Junior', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    middle: { label: 'Middle Engineer', badge: '⚡ Middle', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    senior: { label: 'Senior Architect', badge: '💎 Senior', color: 'text-purple-700 bg-purple-50 border-purple-200' },
    lead: { label: 'Tech Lead / Staff', badge: '👑 Lead', color: 'text-amber-700 bg-amber-50 border-amber-200' }
  };

  const seniority = profile?.targetSeniority || 'senior';
  const seniorityMeta = seniorityLabels[seniority] || seniorityLabels.senior;
  const hasActiveGaps = relevantGaps.length > 0;

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Seniority Pill */}
        <button
          onClick={() => onOpenRadar?.()}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 hover:shadow-sm ${seniorityMeta.color}`}
          title="Нажмите, чтобы открыть радар знаний и настройки профиля"
        >
          <Target className="w-3.5 h-3.5" />
          <span>{seniorityMeta.badge}</span>
        </button>

        {/* Dynamic Vector Memory Indicator */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
            hasActiveGaps
              ? 'bg-rose-50/90 text-rose-800 border-rose-200/80 hover:bg-rose-100/90 shadow-sm'
              : 'bg-white/80 text-slate-600 border-pastel-border hover:bg-pastel-lavender/50'
          }`}
        >
          {hasActiveGaps ? (
            <>
              <Brain className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>Память ИИ: {relevantGaps.length} смежный пробел на контроле</span>
              <ChevronDown className={`w-3 h-3 text-rose-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Контекст чист (нет уязвимостей)</span>
            </>
          )}
        </button>
      </div>

      {/* Expandable Gaps Tooltip Card */}
      <AnimatePresence>
        {isExpanded && hasActiveGaps && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            className="absolute left-0 top-full mt-2 z-30 w-80 sm:w-96 bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-rose-200/70 text-left"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-100">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-800">Семантическая память Live-сессии</span>
              </div>
              <button
                onClick={() => onOpenRadar?.()}
                className="text-[11px] text-pastel-accentViolet hover:underline font-semibold"
              >
                Радар знаний →
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
              ИИ обнаружил семантическую связь текущего вопроса с вашими прошлыми неточностями. 
              Если ответите уверенно и без подсказок, вес дефицита снизится на <strong>-1.0</strong>.
            </p>

            <div className="space-y-2">
              {relevantGaps.map((gap, idx) => (
                <div key={gap.id || idx} className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-900 mb-1">
                    <span className="truncate max-w-[200px]">{gap.topic}</span>
                    <span className="text-[10px] bg-rose-200/60 px-1.5 py-0.5 rounded text-rose-800">
                      Сходство: {Math.round((gap.similarity ?? 0.8) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-snug">«{gap.errorConcept}»</p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Дефицит: {gap.deficitWeight.toFixed(1)}</span>
                    <span className="font-medium text-purple-700">
                      {gap.status === 'VERIFYING' ? '🟡 Калибровка' : '🔴 Активный пробел'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
