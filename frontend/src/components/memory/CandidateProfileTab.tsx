import React from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { UserProfileDTO } from '../../services/memoryApi';

interface CandidateProfileTabProps {
  profile: UserProfileDTO;
  setProfile: React.Dispatch<React.SetStateAction<UserProfileDTO>>;
  onSaveProfile: () => void;
  isSavingProfile: boolean;
  saveSuccess: boolean;
}

export const CandidateProfileTab: React.FC<CandidateProfileTabProps> = ({
  profile,
  setProfile,
  onSaveProfile,
  isSavingProfile,
  saveSuccess
}) => {
  return (
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
          onClick={onSaveProfile}
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
  );
};
