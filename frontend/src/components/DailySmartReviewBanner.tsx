import React, { useEffect, useState } from 'react';
import { Zap, Clock, Brain, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchFsrsQueue } from '../services/fsrsApi';
import { FsrsQueueItemDTO } from '../types/fsrs';

interface DailySmartReviewBannerProps {
  onStartBlitz: (questions: FsrsQueueItemDTO[]) => void;
  onOpenRadar: () => void;
}

export const DailySmartReviewBanner: React.FC<DailySmartReviewBannerProps> = ({
  onStartBlitz,
  onOpenRadar
}) => {
  const [queue, setQueue] = useState<FsrsQueueItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);

  useEffect(() => {
    void loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await fetchFsrsQueue(10);
      setQueue(data.queue || []);
      setEstimatedMinutes(data.estimatedMinutes || Math.max(1, Math.round(data.queue.length * 1.5)));
    } catch (e) {
      console.warn('Failed to load FSRS queue for banner:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  // Extract unique topics that need review
  const urgentTopics = Array.from(new Set(queue.map((q) => q.topic))).slice(0, 3);

  if (queue.length === 0) {
    return (
      <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-white to-teal-500/10 border border-emerald-300/60 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-xs text-emerald-900 block">
              Память в идеальном состоянии! ✨
            </span>
            <p className="text-[11px] text-emerald-700">
              Все изученные темы надежно закреплены (удерживаемость R &gt; 80%). Новые повторения не требуются.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenRadar}
          className="px-3.5 py-1.5 rounded-xl bg-white/90 hover:bg-white text-emerald-800 border border-emerald-300 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Brain className="w-3.5 h-3.5 text-emerald-600" />
          <span>Радар памяти</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-white to-pastel-accentRose/15 border border-amber-300/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-left relative overflow-hidden"
    >
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shrink-0 animate-pulse">
          <Zap className="w-6 h-6 fill-white" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-sm text-pastel-text">
              Daily Smart Review (FSRS-5)
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              {queue.length} {queue.length === 1 ? 'вопрос' : queue.length < 5 ? 'вопроса' : 'вопросов'} на сегодня
            </span>
          </div>

          <p className="text-xs text-pastel-muted flex flex-wrap items-center gap-1.5">
            <span>Кривая забывания снизила удерживаемость ниже 80%.</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              ~{estimatedMinutes} мин на закрепление
            </span>
          </p>

          {/* Topic badges */}
          {urgentTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-pastel-sub font-medium">Темы:</span>
              {urgentTopics.map((topic, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/90 border border-pastel-border/80 text-pastel-text"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
        <button
          type="button"
          onClick={onOpenRadar}
          className="px-3 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-pastel-border text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
        >
          <Brain className="w-4 h-4 text-pastel-accentViolet" />
          <span className="hidden sm:inline">Радар</span>
        </button>

        <button
          type="button"
          onClick={() => onStartBlitz(queue)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-pastel-accentViolet text-white text-xs font-extrabold hover:opacity-95 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Блиц-повторение ({queue.length})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};
