import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Brain, Shield, ShieldCheck, RefreshCw, Target, 
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Save,
  Clock, Zap, Activity, Flame, TrendingDown, Layers, ChevronRight
} from 'lucide-react';
import { 
  KnowledgeRadarDTO, UserProfileDTO, CandidateGapDTO,
  fetchKnowledgeRadar, fetchUserProfile, saveUserProfile, resetGapForPractice 
} from '../services/memoryApi';
import { fetchFsrsStats, fetchFsrsQueue, submitFsrsReview } from '../services/fsrsApi';
import { FsrsStatsDTO, FsrsQueueItemDTO } from '../types/fsrs';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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

  // Close on Escape key press
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
  const [isLoadingFsrs, setIsLoadingFsrs] = useState(false);

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

  // Interpolated forecast values based on slider
  const forecastPoint = useMemo(() => {
    if (!fsrsStats.retentionForecast || fsrsStats.retentionForecast.length === 0) {
      return { avgRetention: fsrsStats.averageRetention, dueCount: fsrsStats.criticalCount };
    }
    // Find closest or interpolated point
    const points = fsrsStats.retentionForecast;
    const exact = points.find((p) => p.day === forecastDays);
    if (exact) return exact;

    // Linear interpolation between nearest days
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
          {/* 1. Header (Soft Luxury Pastel) */}
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

          {/* 2. Top Metric Bar (FSRS Stats) */}
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

          {/* 3. Navigation Tabs */}
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

          {/* 4. Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/40 space-y-4 text-left">
            {/* TAB: FSRS-5 Adaptive Machine */}
            {activeTab === 'fsrs' && (
              <div className="space-y-4">
                {/* Interactive Retention Slider Forecast */}
                <div className="p-4.5 rounded-3xl bg-gradient-to-br from-white via-pastel-lavender/25 to-white border border-pastel-border/80 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-pastel-accentViolet" />
                      <span className="font-extrabold text-xs text-pastel-text">
                        Интерактивный прогноз кривой забывания (Эббингауз)
                      </span>
                    </div>
                    <span className="text-xs font-bold text-pastel-accentViolet">
                      {forecastDays === 0 ? 'Сегодня' : `Через ${forecastDays} дн.`} ➔ Удержание: {Math.round(forecastPoint.avgRetention * 100)}% ({forecastPoint.dueCount} дефицитов)
                    </span>
                  </div>

                  {/* Slider Control */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={forecastDays}
                      onChange={(e) => setForecastDays(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pastel-accentViolet"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
                      <span>Сегодня (0 дн)</span>
                      <span>3 дня</span>
                      <span>7 дней</span>
                      <span>14 дней</span>
                      <span>21 день</span>
                      <span>30 дней</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-pastel-muted leading-relaxed">
                    💡 При перемещении ползунка система в реальном времени пересчитывает вероятность удержания <strong className="text-pastel-text">R(t, S)</strong> для каждого вопроса. Если прекратить повторения, через 14 дней в красную зону упадет {forecastPoint.dueCount} тем.
                  </p>
                </div>

                {/* Queue Cards */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Вопросы к повторению сегодня (R &lt; 80% или наступил срок):
                    </span>
                    {fsrsQueue.length > 0 && onStartBlitzWithQuestions && (
                      <button
                        type="button"
                        onClick={() => {
                          onStartBlitzWithQuestions(fsrsQueue);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-extrabold hover:opacity-95 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Повторить всё ({fsrsQueue.length})</span>
                      </button>
                    )}
                  </div>

                  {fsrsQueue.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-pastel-border/60 p-6 space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                      <h4 className="font-bold text-sm text-slate-800">Все карточки успешно закреплены!</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Алгоритм FSRS-5 следит за вашей памятью. Новые повторения появятся по мере естественного затухания.
                      </p>
                    </div>
                  ) : (
                    fsrsQueue.map((item) => (
                      <div
                        key={item.questionId}
                        className="p-4 bg-white rounded-2xl border border-pastel-border/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:shadow-xs transition-shadow"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-pastel-card border border-pastel-border text-pastel-text">
                              {item.topic}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              item.retrievability < 0.60
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : item.retrievability < 0.80
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                              R = {Math.round(item.retrievability * 100)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              S: {item.stability}д • D: {item.difficulty}/10 • повторов: {item.reps}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 leading-snug">
                            {item.question}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleQuickReview(item.questionId, true)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition cursor-pointer"
                            title="Отметить как помню (Good)"
                          >
                            Помню ✓
                          </button>

                          {onSelectTopicForPractice && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTopicForPractice(item.topic);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold hover:opacity-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <span>Практика</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: Active Deficits */}
            {activeTab === 'active' && (
              <div className="space-y-3">
                {radar.activeDeficits.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-slate-700">Нет активных дефицитов</p>
                    <p className="text-xs text-slate-400 mt-1">Все выявленные пробелы закрыты.</p>
                  </div>
                ) : (
                  radar.activeDeficits.map((gap) => (
                    <div key={gap.id} className="p-4 bg-white rounded-2xl border border-rose-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                            {gap.topic}
                          </span>
                          <span className="text-[11px] text-slate-400">Дефицит: {gap.deficitWeight.toFixed(1)}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">«{gap.errorConcept}»</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        {onSelectTopicForPractice && (
                          <button
                            onClick={() => {
                              onSelectTopicForPractice(gap.topic);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-pastel-rose text-rose-800 text-xs font-semibold hover:bg-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Потренировать</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: Verifying */}
            {activeTab === 'verifying' && (
              <div className="space-y-3">
                {radar.verifyingGaps.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-slate-700">Нет тем на калибровке</p>
                  </div>
                ) : (
                  radar.verifyingGaps.map((gap) => (
                    <div key={gap.id} className="p-4 bg-white rounded-2xl border border-amber-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                            {gap.topic}
                          </span>
                          <span className="text-[11px] text-slate-400">Остаточный дефицит: {gap.deficitWeight.toFixed(1)}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">«{gap.errorConcept}»</p>
                        <p className="text-[11px] text-slate-500 mt-1">Остался 1 уверенный самостоятельный ответ для статуса «Освоено».</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: Mastered */}
            {activeTab === 'mastered' && (
              <div className="space-y-3">
                {radar.masteredGaps.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Shield className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-slate-700">Освоенные концепты появятся здесь</p>
                    <p className="text-xs text-slate-400 mt-1">Отвечайте на вопросы самостоятельно без хинтов для снятия уязвимостей.</p>
                  </div>
                ) : (
                  radar.masteredGaps.map((gap) => (
                    <div key={gap.id} className="p-4 bg-white rounded-2xl border border-purple-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                            {gap.topic}
                          </span>
                          <span className="text-[11px] text-emerald-600 font-semibold">Уязвимость закрыта (0.0)</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">«{gap.errorConcept}»</p>
                      </div>
                      <button
                        onClick={() => handleResetGap(gap.id)}
                        className="px-3 py-1.5 rounded-xl border border-pastel-border text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Вернуть концепт на активный контроль для повторной тренировки"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        <span>Сбросить для проверки</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: Candidate Profile */}
            {activeTab === 'profile' && (
              <div className="space-y-4 max-w-xl mx-auto bg-white p-6 rounded-2xl border border-pastel-border shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Имя кандидата</label>
                  <input
                    type="text"
                    value={profile.candidateName}
                    onChange={(e) => setProfile({ ...profile, candidateName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-pastel-border text-xs focus:outline-none focus:border-pastel-accentViolet"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Целевой грейд (Seniority)</label>
                  <select
                    value={profile.targetSeniority}
                    onChange={(e) => setProfile({ ...profile, targetSeniority: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-pastel-border text-xs focus:outline-none focus:border-pastel-accentViolet bg-white"
                  >
                    <option value="junior">🌱 Junior (Базовые концепты, базовый синтаксис)</option>
                    <option value="middle">⚡ Middle (Жизненный цикл бинов, транзакции, API)</option>
                    <option value="senior">💎 Senior (Многопоточность, JMM, AOP под капотом, Kafka)</option>
                    <option value="lead">👑 Tech Lead / Staff (Архитектура, отказоустойчивость, SLA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Основной технологический стек</label>
                  <input
                    type="text"
                    value={profile.primaryStack}
                    onChange={(e) => setProfile({ ...profile, primaryStack: e.target.value })}
                    placeholder="Java 21, Spring Boot 3.3, PostgreSQL, Kafka, Redis"
                    className="w-full px-3 py-2 rounded-xl border border-pastel-border text-xs focus:outline-none focus:border-pastel-accentViolet"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Стиль общения интервьюера</label>
                  <select
                    value={profile.preferredTone}
                    onChange={(e) => setProfile({ ...profile, preferredTone: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-pastel-border text-xs focus:outline-none focus:border-pastel-accentViolet bg-white"
                  >
                    <option value="rigorous">🛡️ Строгий и объективный (FAANG Standard)</option>
                    <option value="supportive">🌸 Поддерживающий ментор (Socratic Scaffolding)</option>
                    <option value="academic">🎓 Академический разбор (Deep Dive Internals)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold shadow-md hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingProfile ? 'Сохранение...' : 'Сохранить настройки'}</span>
                  </button>

                  {saveSuccess && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Настройки обновлены
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
