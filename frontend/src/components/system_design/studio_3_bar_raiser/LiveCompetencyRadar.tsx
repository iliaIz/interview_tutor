import React from 'react';
import { Award, TrendingUp, ShieldCheck } from 'lucide-react';

export interface CompetencyScores {
  exploration: number; // 0 - 100
  architecture: number;
  deep_dives: number;
  operational_excellence: number;
}

export interface LiveCompetencyRadarProps {
  scores: CompetencyScores;
  targetLevel?: string;
}

export const LiveCompetencyRadar: React.FC<LiveCompetencyRadarProps> = ({
  scores,
  targetLevel = 'L6'
}) => {
  const size = 220;
  const center = size / 2;
  const radius = 75;

  // 4 axes: Top, Right, Bottom, Left
  // 0: Top (Exploration) -> (center, center - r)
  // 1: Right (Architecture) -> (center + r, center)
  // 2: Bottom (Deep Dives) -> (center, center + r)
  // 3: Left (Operational) -> (center - r, center)
  const getPoint = (valPercent: number, axisIndex: number) => {
    const r = (Math.max(10, Math.min(100, valPercent)) / 100) * radius;
    switch (axisIndex) {
      case 0: return `${center},${center - r}`;
      case 1: return `${center + r},${center}`;
      case 2: return `${center},${center + r}`;
      case 3: return `${center - r},${center}`;
      default: return `${center},${center}`;
    }
  };

  const candidatePolygon = [
    getPoint(scores.exploration, 0),
    getPoint(scores.architecture, 1),
    getPoint(scores.deep_dives, 2),
    getPoint(scores.operational_excellence, 3)
  ].join(' ');

  // Benchmark target polygon (e.g. 75% for L5, 85% for L6, 92% for L7)
  const benchmarkVal = targetLevel === 'L7' ? 92 : targetLevel === 'L6' ? 82 : 72;
  const benchmarkPolygon = [
    getPoint(benchmarkVal, 0),
    getPoint(benchmarkVal, 1),
    getPoint(benchmarkVal, 2),
    getPoint(benchmarkVal, 3)
  ].join(' ');

  const dimensions = [
    { name: 'Scoping & Capacity', val: scores.exploration, col: 'text-purple-300' },
    { name: 'Architecture Flow', val: scores.architecture, col: 'text-blue-300' },
    { name: 'Deep Dives & Chaos', val: scores.deep_dives, col: 'text-emerald-300' },
    { name: 'Operational TCO', val: scores.operational_excellence, col: 'text-amber-300' }
  ];

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between w-full pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-white">Bar-Raiser Competency Radar</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-purple-300 px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800">
          Target {targetLevel}
        </span>
      </div>

      {/* SVG Radar */}
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Web Circles / Diamonds */}
          <polygon
            points={`${center},${center - radius} ${center + radius},${center} ${center},${center + radius} ${center - radius},${center}`}
            fill="none"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <polygon
            points={`${center},${center - radius * 0.66} ${center + radius * 0.66},${center} ${center},${center + radius * 0.66} ${center - radius * 0.66},${center}`}
            fill="none"
            stroke="#334155"
            strokeWidth="1"
          />
          <polygon
            points={`${center},${center - radius * 0.33} ${center + radius * 0.33},${center} ${center},${center + radius * 0.33} ${center - radius * 0.33},${center}`}
            fill="none"
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Cross Axes */}
          <line x1={center} y1={center - radius - 5} x2={center} y2={center + radius + 5} stroke="#334155" strokeWidth="1" />
          <line x1={center - radius - 5} y1={center} x2={center + radius + 5} y2={center} stroke="#334155" strokeWidth="1" />

          {/* Benchmark Outline */}
          <polygon
            points={benchmarkPolygon}
            fill="none"
            stroke="#6366f1"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="opacity-60"
          />

          {/* Candidate Dynamic Polygon */}
          <polygon
            points={candidatePolygon}
            fill="rgba(168, 85, 247, 0.35)"
            stroke="#c084fc"
            strokeWidth="2.5"
            className="transition-all duration-700"
          />
        </svg>
      </div>

      {/* 4 Metrics Summary Pills */}
      <div className="grid grid-cols-2 gap-2 w-full text-[11px]">
        {dimensions.map((d) => (
          <div key={d.name} className="flex justify-between items-center p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 truncate mr-1">{d.name}:</span>
            <span className={`font-mono font-bold ${d.col}`}>{Math.round(d.val)}/100</span>
          </div>
        ))}
      </div>
    </div>
  );
};
