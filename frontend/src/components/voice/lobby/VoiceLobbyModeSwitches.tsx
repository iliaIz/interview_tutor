import React from 'react';
import { Microscope, GraduationCap, Activity, Scale } from 'lucide-react';
import { InterviewConfig } from '../../../types/interviewConfig';

export interface VoiceLobbyModeSwitchesProps {
  interviewConfig: InterviewConfig;
  handleConfigChange: (config: InterviewConfig) => void;
  speechCoachingMode: 'adaptive' | 'always' | 'off';
  updateSpeechCoachingMode: (mode: 'adaptive' | 'always' | 'off') => void;
}

export const VoiceLobbyModeSwitches: React.FC<VoiceLobbyModeSwitchesProps> = ({
  interviewConfig,
  handleConfigChange,
  speechCoachingMode,
  updateSpeechCoachingMode
}) => {
  return (
    <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
      {/* Language Switcher (RU / EN) */}
      <div className="flex items-center gap-1 bg-white/90 p-1 rounded-2xl border border-pastel-border shadow-2xs">
        <button
          type="button"
          onClick={() => handleConfigChange({ ...interviewConfig, language: 'ru' })}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            interviewConfig.language !== 'en'
              ? 'bg-pastel-accentViolet text-white shadow-2xs'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          🇷🇺 RU
        </button>
        <button
          type="button"
          onClick={() => handleConfigChange({ ...interviewConfig, language: 'en' })}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            interviewConfig.language === 'en'
              ? 'bg-pastel-accentRose text-white shadow-2xs'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          🇬🇧 EN
        </button>
      </div>

      <button
        type="button"
        onClick={() => handleConfigChange({ ...interviewConfig, deepDive: !interviewConfig.deepDive })}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
          interviewConfig.deepDive
            ? 'bg-gradient-to-r from-pastel-accentRose/20 to-pastel-accentViolet/20 border-pastel-accentViolet text-pastel-accentViolet shadow-2xs'
            : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-400'
        }`}
        title="Кликните для переключения глубокого зондирования"
      >
        <Microscope className="w-3.5 h-3.5" />
        <span>🔬 Deep-Dive</span>
      </button>

      <button
        type="button"
        onClick={() => handleConfigChange({ ...interviewConfig, liveCoaching: !interviewConfig.liveCoaching })}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
          interviewConfig.liveCoaching
            ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs'
            : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-400'
        }`}
        title="Кликните для переключения обучения на лету"
      >
        <GraduationCap className="w-3.5 h-3.5" />
        <span>🎓 Обучение</span>
      </button>

      {/* Speech Coach Mode Selector */}
      <div className="flex items-center gap-1 bg-white/90 p-1 rounded-2xl border border-pastel-border shadow-2xs">
        <span className="text-[10px] font-bold text-pastel-muted pl-2 pr-1 flex items-center gap-1">
          <Activity className="w-3 h-3 text-pastel-accentRose" />
          Коучинг:
        </span>
        <button
          type="button"
          onClick={() => updateSpeechCoachingMode('adaptive')}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            speechCoachingMode === 'adaptive'
              ? 'bg-pastel-accentViolet text-white shadow-2xs'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
          title="Умный режим: STAR для опыта/аварий, PREP для компромиссов, Rule of 3 для теории"
        >
          ✨ Адаптивный
        </button>
        <button
          type="button"
          onClick={() => updateSpeechCoachingMode('always')}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            speechCoachingMode === 'always'
              ? 'bg-pastel-accentRose text-white shadow-2xs'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
          title="Принудительный STAR/PREP тренажер на всех вопросах"
        >
          🎯 Всегда STAR
        </button>
        <button
          type="button"
          onClick={() => updateSpeechCoachingMode('off')}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            speechCoachingMode === 'off'
              ? 'bg-slate-300 text-slate-700'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
          title="Отключить речевой анализ"
        >
          Выкл
        </button>
      </div>

      {/* 3-Tier Calibration Spectrum (Strictness Level) */}
      <div className="flex items-center gap-1 bg-white/90 p-1 rounded-2xl border border-pastel-border shadow-2xs">
        <span className="text-[10px] font-bold text-pastel-muted pl-2 pr-1 flex items-center gap-1">
          <Scale className="w-3 h-3 text-pastel-accentViolet" />
          Строгость:
        </span>
        <button
          type="button"
          onClick={() => handleConfigChange({ ...interviewConfig, strictness: 'learning' })}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            interviewConfig.strictness === 'learning'
              ? 'bg-emerald-500 text-white shadow-2xs font-extrabold'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
          title="🟢 Обучение: подсказки и поддержка без давления, акцент на понимание сути"
        >
          🟢 Обучение
        </button>
        <button
          type="button"
          onClick={() => handleConfigChange({ ...interviewConfig, strictness: 'standard' })}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            (!interviewConfig.strictness || interviewConfig.strictness === 'standard')
              ? 'bg-amber-500 text-white shadow-2xs font-extrabold'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
          title="🟡 Собеседование L5: объективная проверка без поддакивания, иммунитет к поверхностным оговоркам"
        >
          🟡 L5
        </button>
        <button
          type="button"
          onClick={() => handleConfigChange({ ...interviewConfig, strictness: 'hardcore' })}
          className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            interviewConfig.strictness === 'hardcore'
              ? 'bg-rose-500 text-white shadow-2xs font-extrabold'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
          title="🔴 Bar-Raiser L6: бескомпромиссная проверка крайних случаев, архитектурных компромиссов и контрактов"
        >
          🔴 L6 Bar-Raiser
        </button>
      </div>
    </div>
  );
};
