/**
 * AcousticCoachingStudio.tsx
 * Presenter for speech telemetry, 30-point waveform sparkline, and coaching metrics.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, GraduationCap } from 'lucide-react';
import { HumanizedAcousticProfile, AcousticMetrics } from '../../services/AcousticTelemetryService';

interface AcousticCoachingStudioProps {
  metrics: AcousticMetrics;
  humanProfile: HumanizedAcousticProfile;
  rephrasedExample?: string;
  structureType?: string;
}

export const AcousticCoachingStudio: React.FC<AcousticCoachingStudioProps> = ({
  metrics,
  humanProfile,
  rephrasedExample,
  structureType
}) => {
  return (
    <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-br from-pastel-rose/40 via-white to-pastel-lavender/40 border border-pastel-border/80 shadow-xs space-y-3.5 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-2xs">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs md:text-sm text-pastel-text">
              Голосовой коучинг и манера речи
            </h4>
            <p className="text-[10px] text-pastel-muted">
              Анализ интонаций, темпа, чистоты и структуры ответа
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 border border-pastel-border text-pastel-accentViolet shadow-2xs">
          ✨ AI Voice Studio
        </span>
      </div>

      {/* 30-Point Sparkline Waveform */}
      {metrics.energyVector30 && metrics.energyVector30.length > 0 && (
        <div className="p-3 bg-white/85 rounded-2xl border border-pastel-border/60 flex items-end justify-between h-12 gap-1 shadow-2xs">
          {metrics.energyVector30.map((val, idx) => (
            <motion.div
              key={idx}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(12, val * 100)}%` }}
              transition={{ duration: 0.35, delay: idx * 0.012 }}
              className={`w-full rounded-full transition-all ${
                val > 0.65
                  ? 'bg-gradient-to-t from-pastel-accentRose to-pink-400'
                  : val > 0.35
                  ? 'bg-gradient-to-t from-pastel-accentViolet to-indigo-300'
                  : 'bg-pastel-border/80'
              }`}
              title={`Сегмент ${idx + 1}: ${(val * 100).toFixed(0)}% энергии`}
            />
          ))}
        </div>
      )}

      {/* Coaching Metric Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${humanProfile.clarity ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-2.5 text-left`}>
        {/* Volume & Delivery */}
        <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs">{humanProfile.volume.iconEmoji}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.volume.badgeStyle}`}>
                {humanProfile.volume.badge}
              </span>
            </div>
            <span className="font-bold text-xs text-pastel-text block">
              {humanProfile.volume.title}
            </span>
            <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
              {humanProfile.volume.description}
            </p>
          </div>
          <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
            Уровень: {humanProfile.volume.techValue}
          </span>
        </div>

        {/* Pace & Rhythm */}
        <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs">{humanProfile.pace.iconEmoji}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.pace.badgeStyle}`}>
                {humanProfile.pace.badge}
              </span>
            </div>
            <span className="font-bold text-xs text-pastel-text block">
              {humanProfile.pace.title}
            </span>
            <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
              {humanProfile.pace.description}
            </p>
          </div>
          <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
            Скорость: {humanProfile.pace.techValue}
          </span>
        </div>

        {/* Structure & Pauses */}
        <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs">{humanProfile.structure.iconEmoji}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.structure.badgeStyle}`}>
                {humanProfile.structure.badge}
              </span>
            </div>
            <span className="font-bold text-xs text-pastel-text block">
              {humanProfile.structure.title}
            </span>
            <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
              {humanProfile.structure.description}
            </p>
          </div>
          <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
            Паузы: {humanProfile.structure.techValue}
          </span>
        </div>

        {/* Clarity & Filler Words */}
        {humanProfile.clarity && (
          <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs">{humanProfile.clarity.iconEmoji}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.clarity.badgeStyle}`}>
                  {humanProfile.clarity.badge}
                </span>
              </div>
              <span className="font-bold text-xs text-pastel-text block">
                {humanProfile.clarity.title}
              </span>
              <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">
                {humanProfile.clarity.description}
              </p>
            </div>
            <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
              Чистота: {humanProfile.clarity.techValue}
            </span>
          </div>
        )}
      </div>

      {/* Mentor Praise Banner */}
      <div className="p-3 rounded-2xl bg-white/95 border border-pastel-rose/80 text-xs text-pastel-text leading-relaxed flex items-center gap-2.5 shadow-2xs">
        <span className="text-base shrink-0">🌸</span>
        <p className="font-medium text-pastel-text/90">
          {humanProfile.mentorPraise}
        </p>
      </div>

      {/* STAR / PREP Rephrased Example */}
      {rephrasedExample && (
        <div className="p-4 bg-gradient-to-r from-pastel-accentViolet/10 via-white to-pastel-accentRose/10 rounded-2xl border border-pastel-accentViolet/35 shadow-2xs space-y-2 text-left animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs text-pastel-accentViolet">
              <GraduationCap className="w-4 h-4 text-pastel-accentRose" />
              <span>Совет тренера: Эталонный ответ по {structureType || 'структуре'}</span>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-pastel-accentViolet/15 text-pastel-accentViolet">
              Staff Engineer Style
            </span>
          </div>
          <p className="text-xs text-pastel-text leading-relaxed italic bg-white/75 p-3 rounded-xl border border-pastel-border/50">
            «{rephrasedExample}»
          </p>
        </div>
      )}
    </div>
  );
};
