import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Brain, Shield, ShieldCheck, RefreshCw, Target, 
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Save
} from 'lucide-react';
import { 
  KnowledgeRadarDTO, UserProfileDTO, CandidateGapDTO,
  fetchKnowledgeRadar, fetchUserProfile, saveUserProfile, resetGapForPractice 
} from '../services/memoryApi';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface MemoryRadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopicForPractice?: (topic: string) => void;
}

export const MemoryRadarDrawer: React.FC<MemoryRadarDrawerProps> = ({
  isOpen,
  onClose,
  onSelectTopicForPractice
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
  const [activeTab, setActiveTab] = useState<'active' | 'verifying' | 'mastered' | 'profile'>('active');
  const [radar, setRadar] = useState<KnowledgeRadarDTO>({
    activeDeficits: [],
    verifyingGaps: [],
    masteredGaps: [],
    stats: { activeCount: 0, verifyingCount: 0, masteredCount: 0, totalGaps: 0 }
  });
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
    const [radarData, profileData] = await Promise.all([
      fetchKnowledgeRadar(),
      fetchUserProfile()
    ]);
    setRadar(radarData);
    setProfile(profileData);
  };

  const handleResetGap = async (gapId: string) => {
    await resetGapForPractice(gapId);
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

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-3xl max-h-[88dvh] flex flex-col bg-white rounded-3xl shadow-2xl border border-pastel-border overflow-hidden"
        >
          {/* 1. Header (Soft Luxury Pastel) */}
          <div className="p-5 sm:p-6 border-b border-pastel-border bg-gradient-to-r from-pastel-rose via-white to-pastel-lavender flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-md">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  Радар знаний и Семантическая память
                </h2>
                <p className="text-xs text-slate-500">
                  Scaffolded Knowledge Tracing: авто-затухание дефицита при самостоятельных ответах (-1.0)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Stats Bar */}
          <div className="grid grid-cols-4 border-b border-pastel-border bg-slate-50/50 text-center py-3 px-4 text-xs font-semibold">
            <div className="border-r border-pastel-border">
              <div className="text-rose-600 text-lg font-bold">{radar.stats.activeCount}</div>
              <div className="text-slate-500 text-[11px]">На контроле</div>
            </div>
            <div className="border-r border-pastel-border">
              <div className="text-amber-600 text-lg font-bold">{radar.stats.verifyingCount}</div>
              <div className="text-slate-500 text-[11px]">Калибровка</div>
            </div>
            <div className="border-r border-pastel-border">
              <div className="text-purple-600 text-lg font-bold">{radar.stats.masteredCount}</div>
              <div className="text-slate-500 text-[11px]">Освоено</div>
            </div>
            <div>
              <div className="text-slate-700 text-lg font-bold">{radar.stats.totalGaps}</div>
              <div className="text-slate-500 text-[11px]">Всего точек</div>
            </div>
          </div>

          {/* 3. Tab Buttons */}
          <div className="flex border-b border-pastel-border px-6 pt-2 bg-white gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'active'
                  ? 'border-rose-500 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🔴 Активные пробелы ({radar.activeDeficits.length})
            </button>
            <button
              onClick={() => setActiveTab('verifying')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'verifying'
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🟡 На проверке ({radar.verifyingGaps.length})
            </button>
            <button
              onClick={() => setActiveTab('mastered')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'mastered'
                  ? 'border-purple-500 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🛡️ Освоено ({radar.masteredGaps.length})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'profile'
                  ? 'border-pastel-accentViolet text-pastel-accentViolet'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚙️ Профиль кандидата
            </button>
          </div>

          {/* 4. Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-pastel-bg/40">
            {activeTab === 'active' && (
              <div className="space-y-3">
                {radar.activeDeficits.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Sparkles className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-slate-700">Нет активных уязвимостей!</p>
                    <p className="text-xs text-slate-400 mt-1">Все пройденные темы освоены на высоком уровне.</p>
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
                            className="px-3 py-1.5 rounded-xl bg-pastel-rose text-rose-800 text-xs font-semibold hover:bg-rose-200 transition-colors inline-flex items-center gap-1"
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
                        className="px-3 py-1.5 rounded-xl border border-pastel-border text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors inline-flex items-center gap-1 shrink-0"
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
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
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
