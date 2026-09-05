import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { NextBestStepRecommendation, TargetArenaType } from '../../types/nextgen';
import {
  Sparkles,
  ArrowRight,
  Clock,
  Compass,
  Database,
  Layers,
  Terminal,
  Bug,
  Code2,
  BookOpen,
  Headphones,
  CheckCircle2,
  Zap,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NextBestActionCardProps {
  courseId: string;
  courseTitle: string;
  onStepStarted?: () => void;
}

export const NextBestActionCard: React.FC<NextBestActionCardProps> = ({
  courseId,
  courseTitle,
  onStepStarted
}) => {
  const { launchAcademyStepTarget, openAcademyStepModal } = useAppStore();
  const [recommendation, setRecommendation] = useState<NextBestStepRecommendation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchRecommendation = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/roadmaps/next-best-step?courseId=${encodeURIComponent(courseId)}`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setRecommendation(data);
          }
        }
      } catch (err) {
        console.error('Failed to load next best step recommendation:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecommendation();
    return () => {
      isMounted = false;
    };
  }, [courseId]);

  if (loading || !recommendation || !recommendation.hasRecommendation || !recommendation.step) {
    return null;
  }

  const { step } = recommendation;
  const arena = step.targetArena || step.coreRequirements?.targetArena || 'theory';

  const getArenaBadge = (targetArena: TargetArenaType | string) => {
    switch (targetArena) {
      case 'transactions':
        return {
          label: 'Spring Transactions Lab',
          icon: Database,
          bg: 'bg-blue-50 text-blue-800 border-blue-200'
        };
      case 'system_design':
        return {
          label: 'System Design Arena',
          icon: Layers,
          bg: 'bg-purple-50 text-purple-800 border-purple-200'
        };
      case 'incident_triage':
        return {
          label: 'Incident Triage Studio',
          icon: Terminal,
          bg: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'testing_mutation':
        return {
          label: 'Mutation Testing Arena',
          icon: Bug,
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200'
        };
      case 'machine_coding':
        return {
          label: 'Machine Coding (LLD)',
          icon: Code2,
          bg: 'bg-rose-50 text-rose-800 border-rose-200'
        };
      case 'oral_interview':
        return {
          label: 'Gemini Live Mock Voice',
          icon: Headphones,
          bg: 'bg-teal-50 text-teal-800 border-teal-200'
        };
      default:
        return {
          label: 'База Знаний (Теория)',
          icon: BookOpen,
          bg: 'bg-slate-50 text-slate-800 border-slate-200'
        };
    }
  };

  const badge = getArenaBadge(arena);
  const ArenaIcon = badge.icon;

  const handleLaunch = () => {
    launchAcademyStepTarget(step, courseId, courseTitle);
    onStepStarted?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-white/95 via-pastel-rose/25 to-pastel-lavender/30 border border-pastel-accentRose/40 shadow-xl backdrop-blur-xl relative overflow-hidden"
    >
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-to-bl from-pastel-accentRose/20 to-transparent blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-gradient-to-tr from-pastel-accentViolet/15 to-transparent blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="space-y-2.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white flex items-center gap-1.5 shadow-xs">
              <Compass className="w-3.5 h-3.5 animate-spin-slow" />
              <span>NEXT BEST ACTION</span>
            </span>

            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${badge.bg}`}>
              <ArenaIcon className="w-3 h-3" />
              <span>{badge.label}</span>
            </span>

            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-lavender/60 text-pastel-accentViolet border border-pastel-accentViolet/20 flex items-center gap-1">
              <Clock className="w-3 h-3" /> ~{recommendation.estimatedMinutes || step.estimatedMinutes || 20} мин
            </span>

            {recommendation.domain && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                {recommendation.domain}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-pastel-text tracking-tight flex items-center gap-2">
              <span>Шаг #{step.stepNumber}: {step.title}</span>
            </h3>
            <p className="text-xs sm:text-sm text-pastel-text/80 font-medium line-clamp-2 mt-0.5">
              💡 {step.seniorBarConcept}
            </p>
          </div>

          {/* Pedagogical Rationale Box */}
          {recommendation.pedagogicalRationale && (
            <div className="p-3 rounded-2xl bg-white/80 border border-pastel-border/70 text-xs text-pastel-text/90 flex items-start gap-2 shadow-2xs">
              <Target className="w-4 h-4 text-pastel-accentRose shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-pastel-accentRose">Почему именно этот шаг: </span>
                <span>{recommendation.pedagogicalRationale}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="shrink-0 flex items-center md:flex-col justify-end gap-2">
          <button
            onClick={handleLaunch}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95 text-white shadow-md shadow-pastel-accentRose/30 transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation group w-full"
          >
            <span>Начать шаг</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => openAcademyStepModal(step)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-pastel-muted hover:text-pastel-text border border-pastel-border/80 transition cursor-pointer w-full text-center"
          >
            Детали программы
          </button>
        </div>
      </div>
    </motion.div>
  );
};
