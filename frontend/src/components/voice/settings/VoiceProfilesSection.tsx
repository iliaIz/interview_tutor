import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import { InterviewConfig, InterviewProfile } from '../../../types/interviewConfig';

interface VoiceProfilesSectionProps {
  profiles: InterviewProfile[];
  config: InterviewConfig;
  onSelectProfile: (profile: InterviewProfile) => void;
  onSaveProfile: (name: string) => Promise<void>;
  onDeleteProfile: (e: React.MouseEvent, id: string) => Promise<void>;
}

export const VoiceProfilesSection: React.FC<VoiceProfilesSectionProps> = ({
  profiles,
  config,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile
}) => {
  const [showNewProfileInput, setShowNewProfileInput] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const handleSave = async () => {
    if (!newProfileName.trim()) return;
    await onSaveProfile(newProfileName.trim());
    setNewProfileName('');
    setShowNewProfileInput(false);
  };

  return (
    <div className="p-4 rounded-2xl border border-pastel-border bg-pastel-bg/50">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5 text-pastel-accentViolet" />
          <span>Профили настроек (Пресеты)</span>
        </label>
        {!showNewProfileInput && (
          <button
            type="button"
            onClick={() => setShowNewProfileInput(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-pastel-accentViolet hover:text-pastel-accentRose transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Сохранить текущие как новый</span>
          </button>
        )}
      </div>

      {showNewProfileInput && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 mb-3 bg-white rounded-2xl border border-pastel-border shadow-xs flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Название профиля (например, 'Строгий техдир')"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="flex-1 text-xs px-3 py-2 bg-pastel-bg rounded-xl border border-pastel-border outline-none focus:border-pastel-accentViolet text-slate-800"
          />
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-2 bg-pastel-accentViolet text-white rounded-xl text-xs font-semibold hover:opacity-90 transition cursor-pointer"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => setShowNewProfileInput(false)}
            className="px-2 py-2 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
          >
            Отмена
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {profiles.map((p) => {
          const isSelected =
            config.strategy === p.config.strategy &&
            config.voice === p.config.voice &&
            config.maxProbes === p.config.maxProbes;

          return (
            <div
              key={p.id}
              onClick={() => onSelectProfile(p)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative ${
                isSelected
                  ? 'bg-gradient-to-br from-pastel-rose/80 to-white border-pastel-accentViolet shadow-sm ring-1 ring-pastel-accentViolet/30'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800">{p.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pastel-accentViolet/10 text-pastel-accentViolet font-semibold">
                  {p.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {p.description}
              </p>
              {!p.isPreset && (
                <button
                  type="button"
                  onClick={(e) => onDeleteProfile(e, p.id)}
                  className="absolute bottom-2 right-2 text-slate-400 hover:text-red-500 transition p-1 cursor-pointer"
                  title="Удалить профиль"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
