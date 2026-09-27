import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Brain,
  ShieldCheck,
  Target,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import {
  KnowledgeRadarDTO,
  UserProfileDTO,
  fetchKnowledgeRadar,
  fetchUserProfile,
  saveUserProfile,
  resetGapForPractice
} from '../services/memoryApi';
import { fetchFsrsStats, fetchFsrsQueue, submitFsrsReview } from '../services/fsrsApi';
import { FsrsStatsDTO, FsrsQueueItemDTO } from '../types/fsrs';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { FsrsQueueTab } from './memory/FsrsQueueTab';
import { GapsListTab } from './memory/GapsListTab';
import { CandidateProfileTab } from './memory/CandidateProfileTab';

interface MemoryRadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopicForPractice?: (topic: string) => void;
  onStartBlitzWithQuestions?: (questions: any[]) => void;
}

export const MemoryRadarDrawer: React.FC<MemoryRadarDrawerProps> = ({
  isOpen,
  onClose,
  onSelectTopicForPractice,
  onStartBlitzWithQuestions
}) => {
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [activeTab, setActiveTab] = useState<'fsrs' | 'active' | 'verifying' | 'mastered' | 'profile'>('fsrs');
  const [forecastDays, setForecastDays] = useState<number>(0);

  const [radar, setRadar] = useState<KnowledgeRadarDTO>({
    activeDeficits: [],
    verifyingGaps: [],
    masteredGaps: [],
    stats: { activeCount: 0, verifyingCount: 0, masteredCount: 0, totalGaps: 0 }
  });

  const [fsrsStats, setFsrsStats] = useState<FsrsStatsDTO>({
    freshCount: 0,
    riskCount: 0,
    criticalCount: 0,
    totalTracked: 0,
    averageRetention: 1.0,
    retentionForecast: []
  });

  const [fsrsQueue, setFsrsQueue] = useState<FsrsQueueItemDTO[]>([]);
  const [, setIsLoadingFsrs] = useState(false);

  const [profile, setProfile] = useState<UserProfileDTO>({
    id: 'default_user',
    candidateName: 'Кандидат',
    targetSeniority: 'senior',
    primaryStack: 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka',
    preferredTone: 'rigorous',
    focusAreas: []
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoadingFsrs(true);
    try {
      const [radarData, profileData, statsData, queueData] = await Promise.all([
        fetchKnowledgeRadar(),
        fetchUserProfile(),
        fetchFsrsStats(),
        fetchFsrsQueue(20)
      ]);
      setRadar(radarData);
      setProfile(profileData);
      setFsrsStats(statsData);
      setFsrsQueue(queueData.queue || []);
    } catch (e) {
      console.warn('Error loading radar data:', e);
    } finally {
      setIsLoadingFsrs(false);
    }
  };

  const handleResetGap = async (gapId: string) => {
    await resetGapForPractice(gapId);
    await loadData();
  };

  const handleQuickReview = async (questionId: string, isPassed: boolean) => {
    await submitFsrsReview(questionId, isPassed ? 85 : 40, isPassed);
    await loadData();
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const updated = await saveUserProfile(profile);
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const forecastPoint = useMemo(() => {
    if (!fsrsStats.retentionForecast || fsrsStats.retentionForecast.length === 0) {
      return { avgRetention: fsrsStats.averageRetention, dueCount: fsrsStats.criticalCount };
    }
    const points = fsrsStats.retentionForecast;
    const exact = points.find((p) => p.day === forecastDays);
    if (exact) return exact;

    for (let i = 0; i < points.length - 1; i++) {
      if (forecastDays >= points[i].day && forecastDays <= points[i + 1].day) {
        const ratio = (forecastDays - points[i].day) / (points[i + 1].day - points[i].day);
        const avgR = points[i].avgRetention + ratio * (points[i + 1].avgRetention - points[i].avgRetention);
        const dueC = Math.round(points[i].dueCount + ratio * (points[i + 1].dueCount - points[i].dueCount));
        return { avgRetention: parseFloat(avgR.toFixed(2)), dueCount: dueC };
      }
    }
    return points[points.length - 1];
  }, [fsrsStats, forecastDays]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-4xl max-h-[90dvh] flex flex-col bg-white rounded-3xl shadow-2xl border border-pastel-border overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-pastel-border bg-gradient-to-r from-pastel-rose via-white to-pastel-lavender flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-md shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
                    Радар Памяти и Долговременное Удержание
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    FSRS-5 SOTA
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Моделирование кривой забывания Эббингауза, расчет стабильности S и векторное распространение дефицитов
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Top Metric Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-pastel-border bg-slate-50/60 text-center py-3 px-4 text-xs font-semibold gap-2 sm:gap-0">
            <div className="sm:border-r border-pastel-border/80">
              <div className="text-emerald-700 text-lg font-extrabold flex items-center justify-center gap-1">
                <span>{fsrsStats.freshCount}</span>
                <span className="text-[11px] font-medium opacity-80">(R &ge; 90%)</span>
              </div>
              <div className="text-slate-500 text-[11px]">Надежные знания</div>
            </div>
            <div className="sm:border-r border-pastel-border/80">
              <div className="text-amber-700 text-lg font-extrabold flex items-center justify-center gap-1">
                <span>{fsrsStats.riskCount}</span>
                <span className="text-[11px] font-medium opacity-80">(70-90%)</span>
              </div>
              <div className="text-slate-500 text-[11px]">Зона риска</div>
            </div>
            <div className="sm:border-r border-pastel-border/80">
              <div className="text-rose-700 text-lg font-extrabold flex items-center justify-center gap-1">
                <span>{fsrsStats.criticalCount}</span>
                <span className="text-[11px] font-medium opacity-80">(&lt; 70%)</span>
              </div>
              <div className="text-slate-500 text-[11px]">Критический дефицит</div>
            </div>
            <div>
              <div className="text-pastel-accentViolet text-lg font-extrabold">
                {Math.round(fsrsStats.averageRetention * 100)}%
              </div>
              <div className="text-slate-500 text-[11px]">Средняя удерживаемость</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-pastel-border px-5 gap-4 text-xs font-bold overflow-x-auto bg-white shrink-0">
            <button
              onClick={() => setActiveTab('fsrs')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'fsrs'
                  ? 'border-pastel-accentViolet text-pastel-accentViolet'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Очередь FSRS-5 ({fsrsQueue.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Активные ошибки ({radar.stats.activeCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('verifying')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'verifying'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Калибровка ({radar.stats.verifyingCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('mastered')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'mastered'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Освоено ({radar.stats.masteredCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-pastel-accentRose text-pastel-accentRose'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <span>Профиль кандидата</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/40 space-y-4 text-left">
            {activeTab === 'fsrs' && (
              <FsrsQueueTab
                forecastDays={forecastDays}
                setForecastDays={setForecastDays}
                forecastPoint={forecastPoint}
                fsrsQueue={fsrsQueue}
                onStartBlitzWithQuestions={onStartBlitzWithQuestions}
                onClose={onClose}
                handleQuickReview={handleQuickReview}
                onSelectTopicForPractice={onSelectTopicForPractice}
              />
            )}

            {(activeTab === 'active' || activeTab === 'verifying' || activeTab === 'mastered') && (
              <GapsListTab
                activeTab={activeTab}
                activeDeficits={radar.activeDeficits}
                verifyingGaps={radar.verifyingGaps}
                masteredGaps={radar.masteredGaps}
                onSelectTopicForPractice={onSelectTopicForPractice}
                onClose={onClose}
                handleResetGap={handleResetGap}
              />
            )}

            {activeTab === 'profile' && (
              <CandidateProfileTab
                profile={profile}
                setProfile={setProfile}
                onSaveProfile={handleSaveProfile}
                isSavingProfile={isSavingProfile}
                saveSuccess={saveSuccess}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
