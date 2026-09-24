import React from 'react';
import { Activity, Cpu, Database, Layers, Terminal } from 'lucide-react';

interface AcademyReadinessRadarProps {
  rank?: string;
  percentage: number;
  pillars?: {
    concurrency?: number;
    databases?: number;
    systemDesign?: number;
    forensics?: number;
  };
}

export const AcademyReadinessRadar: React.FC<AcademyReadinessRadarProps> = ({
  rank,
  percentage,
  pillars
}) => {
  const concurrency = pillars?.concurrency ?? percentage;
  const databases = pillars?.databases ?? percentage;
  const systemDesign = pillars?.systemDesign ?? percentage;
  const forensics = pillars?.forensics ?? percentage;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white/80 border border-pastel-border/80 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-pastel-text flex items-center gap-2">
            <Activity className="w-4 h-4 text-pastel-accentRose" />
            <span>Senior Readiness Matrix (4 Столпа Компетенций)</span>
          </h3>
          <p className="text-xs text-pastel-muted">
            Объективный скоринг готовности к реальным собеседованиям в BigTech
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-pastel-lavender text-pastel-accentViolet border border-pastel-accentViolet/20 self-start sm:self-auto">
          Ранг: {rank || '🌱 Начало подготовки'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        {/* Pillar 1: Concurrency */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" /> JMM & Loom
            </span>
            <span>{concurrency}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${concurrency}%` }}
            />
          </div>
        </div>

        {/* Pillar 2: Databases & Transactions */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-500" /> Базы & ACID
            </span>
            <span>{databases}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${databases}%` }}
            />
          </div>
        </div>

        {/* Pillar 3: System Design */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-500" /> System Design
            </span>
            <span>{systemDesign}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${systemDesign}%` }}
            />
          </div>
        </div>

        {/* Pillar 4: Forensics */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-rose-500" /> Триаж Дампов
            </span>
            <span>{forensics}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all duration-500"
              style={{ width: `${forensics}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
