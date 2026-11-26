import React from 'react';
import { ShieldCheck, GraduationCap, Scale, Sparkles } from 'lucide-react';
import { InterviewConfig, StrictnessLevel } from '../../../types/interviewConfig';

interface VoiceStrategySectionProps {
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
}

export const VoiceStrategySection: React.FC<VoiceStrategySectionProps> = ({
  config,
  onChangeConfig
}) => {
  return (
    <>
      {/* Стратегия интервью */}
      <div>
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
          Стратегия интервью
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChangeConfig({ ...config, strategy: 'adaptive_probing' })}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              config.strategy === 'adaptive_probing'
                ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-pastel-accentViolet" />
              <span className="text-xs font-bold text-slate-800">Адаптивное зондирование</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Стандарт FAANG: объективная оценка без подсказок, проверка глубины и краевых случаев.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChangeConfig({ ...config, strategy: 'socratic_tutoring' })}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              config.strategy === 'socratic_tutoring'
                ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-pastel-accentRose" />
              <span className="text-xs font-bold text-slate-800">Сократический ментор</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Обучающий режим: поддержка, похвала за верные мысли и мягкие наводящие аналогии.
            </p>
          </button>
        </div>
      </div>

      {/* Калибровка строгости и объективности (Strictness Level) */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-pastel-accentViolet" />
            <span>Строгость и объективность оценки</span>
          </label>
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              config.strictness === 'learning'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : config.strictness === 'hardcore'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {config.strictness === 'learning'
              ? '🟢 Обучение'
              : config.strictness === 'hardcore'
              ? '🔴 L6 Bar-Raiser'
              : '🟡 L5 Собеседование'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Устраняет эффект потакания (sycophancy) и ложного согласия с ошибками кандидата.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {[
            {
              id: 'learning',
              label: '🟢 Обучение',
              subtitle: 'Мягкий ментор',
              desc: 'Подсказки без давления, дружелюбный тон, упор на понимание сути.'
            },
            {
              id: 'standard',
              label: '🟡 L5 Собеседование',
              subtitle: 'Стандарт FAANG',
              desc: 'Объективная проверка фактов и механики. Никакого поддакивания при ошибках.'
            },
            {
              id: 'hardcore',
              label: '🔴 L6 Bar-Raiser',
              subtitle: 'Максимальная планка',
              desc: 'Жесткий аудит архитектурных компромиссов, контрактов и краевых условий.'
            }
          ].map((level) => {
            const isSelected = (!config.strictness && level.id === 'standard') || config.strictness === level.id;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => onChangeConfig({ ...config, strictness: level.id as StrictnessLevel })}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? level.id === 'learning'
                      ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-400/40 shadow-xs'
                      : level.id === 'hardcore'
                      ? 'bg-rose-50/90 border-rose-400 ring-1 ring-rose-400/40 shadow-xs'
                      : 'bg-amber-50/90 border-amber-400 ring-1 ring-amber-400/40 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-800">{level.label}</div>
                  <div className="text-[10px] font-medium text-slate-500 mb-1">{level.subtitle}</div>
                  <div className="text-[10px] text-slate-500 leading-snug">{level.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Персонализация пола кандидата */}
      <div className="p-4 rounded-2xl border border-pastel-accentViolet/30 bg-gradient-to-r from-pastel-rose/30 to-pastel-lavender/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span>Обращение к вам (Пол кандидата)</span>
          </label>
          <span className="text-[10px] font-bold text-pastel-accentViolet bg-white/80 px-2.5 py-0.5 rounded-full border border-pastel-border shadow-2xs">
            {config.userGender === 'male' ? '👨 Мужской род' : config.userGender === 'neutral' ? '⚪ На «Вы»' : '👩 Женский род'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          ИИ будет строго согласовывать окончания глаголов и прилагательных при обращении к вам.
        </p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { id: 'female', label: '👩 Женский', hint: '«Ты сказала», «готова»' },
            { id: 'male', label: '👨 Мужской', hint: '«Ты сказал», «готов»' },
            { id: 'neutral', label: '⚪ На «Вы»', hint: '«Вы сказали», «готовы»' }
          ].map((g) => {
            const isSelected = (config.userGender || 'female') === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  const newGender = g.id as 'female' | 'male' | 'neutral';
                  onChangeConfig({ ...config, userGender: newGender });
                }}
                className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white border-transparent shadow-xs ring-1 ring-pastel-accentViolet/30'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="text-xs font-bold">{g.label}</div>
                <div className={`text-[9px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>{g.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Формат проверки знаний (Study Modality) */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pastel-accentViolet" />
            <span>Основной формат проверки знаний</span>
          </label>
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              (config.studyModality || 'voice') === 'voice'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {(config.studyModality || 'voice') === 'voice' ? '🎙️ Устный (Voice-First)' : '📝 Письменный (Text-First)'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Определяет, какой режим запускается в 1 клик при завершении карточек темы или блиц-повторении.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onChangeConfig({ ...config, studyModality: 'voice' })}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              (config.studyModality || 'voice') === 'voice'
                ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40 shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-slate-800">🎙️ Устный опрос (Hands-free)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              ✨ <strong>Рекомендуется</strong>: ИИ сразу зачитывает вопросы подряд и слушает вас голосом через Авто-VAD без кликов по экрану.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChangeConfig({ ...config, studyModality: 'text' })}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              config.studyModality === 'text'
                ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400/40 shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-blue-900">📝 Письменный квиз</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Пошаговые карточки с клавиатурой: вдумчивое чтение теории и детальный текстовый разбор ошибок после каждого вопроса.
            </p>
          </button>
        </div>
      </div>
    </>
  );
};
