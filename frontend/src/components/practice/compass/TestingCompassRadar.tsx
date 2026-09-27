import React, { useState } from 'react';
import { Target, ShieldCheck, Zap, Activity, Info } from 'lucide-react';

interface AxisMetric {
  id: string;
  name: string;
  label: string;
  value: number; // 0 to 100 normalized
  displayValue: string;
  target: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  sotaPrinciple: string;
}

const AXIS_METRICS: AxisMetric[] = [
  {
    id: 'MUTATION_SCORE',
    name: 'Mutation Score',
    label: 'Мутационный скор',
    value: 88,
    displayValue: '88%',
    target: '>= 85%',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
    color: '#10b981',
    description: 'Доля уничтоженных инъецированных дефектов байткода.',
    sotaPrinciple: 'Главный маркер: 100% Line Coverage ничего не стоит, если тесты не падают при замене < на <=.'
  },
  {
    id: 'LINE_COVERAGE',
    name: 'Line Coverage',
    label: 'Покрытие строк',
    value: 94,
    displayValue: '94%',
    target: '>= 90%',
    icon: <Target className="w-4 h-4 text-sky-600" />,
    color: '#0284c7',
    description: 'Процент строк доменной логики, затронутых выполнением тестов.',
    sotaPrinciple: 'Базовый санитарный порог. Гарантирует отсутствие "мертвого" или непроверенного кода.'
  },
  {
    id: 'ASSERTION_DENSITY',
    name: 'Assertion Density',
    label: 'Плотность проверок',
    value: 85,
    displayValue: '2.4 / test',
    target: '>= 1.5 / test',
    icon: <Activity className="w-4 h-4 text-purple-600" />,
    color: '#8b5cf6',
    description: 'Среднее число утверждений (assertThat, verify) на один @Test метод.',
    sotaPrinciple: 'Исключает Potemkin-тесты: тестовый метод обязан содержать хотя бы одну строгую проверку контракта.'
  },
  {
    id: 'EXECUTION_SPEED',
    name: 'Execution Speed',
    label: 'Скорость прогона',
    value: 92,
    displayValue: '8.4 ms/mutant',
    target: '< 15 ms/mutant',
    icon: <Zap className="w-4 h-4 text-amber-600" />,
    color: '#f59e0b',
    description: 'Время выполнения одного мутационного прогона в горячем демоне JVM.',
    sotaPrinciple: 'Инъекция java.time.Clock и запрет Thread.sleep обеспечивают сверхбыстрый TDD-цикл.'
  }
];

export const TestingCompassRadar: React.FC = () => {
  const [activeAxis, setActiveAxis] = useState<AxisMetric>(AXIS_METRICS[0]);

  // Polar coordinates for SVG diamond radar (size: 200x200, center: 100, 100, radius: 75)
  const cx = 100;
  const cy = 100;
  const r = 70;

  // Axis positions: 0 = Top, 1 = Right, 2 = Bottom, 3 = Left
  const points = AXIS_METRICS.map((axis, i) => {
    const angle = (i * Math.PI) / 2 - Math.PI / 2;
    const norm = (axis.value / 100) * r;
    return {
      x: cx + norm * Math.cos(angle),
      y: cy + norm * Math.sin(angle)
    };
  });

  const polygonPath = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="flex flex-col lg:flex-row items-center gap-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#FFF0F5]/80 via-white to-purple-50/50 border border-rose-100/90 shadow-xs mb-4">
      {/* 1. Radar SVG Graphic */}
      <div className="relative shrink-0 flex items-center justify-center w-48 h-48">
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
          {/* Concentric diamond grid rings */}
          {[0.25, 0.5, 0.75, 1.0].map((step, idx) => (
            <polygon
              key={idx}
              points={`100,${100 - r * step} ${100 + r * step},100 100,${100 + r * step} ${100 - r * step},100`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray={step === 1 ? 'none' : '2,2'}
            />
          ))}

          {/* Axes lines */}
          <line x1="100" y1="25" x2="100" y2="175" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="25" y1="100" x2="175" y2="100" stroke="#cbd5e1" strokeWidth="1" />

          {/* Target polygon aura */}
          <polygon
            points={polygonPath}
            fill="rgba(244, 114, 182, 0.25)"
            stroke="#f472b6"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Data point anchors */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill={AXIS_METRICS[idx].color}
              stroke="#ffffff"
              strokeWidth="1.5"
              className="cursor-pointer transition-transform hover:scale-125"
              onClick={() => setActiveAxis(AXIS_METRICS[idx])}
            />
          ))}
        </svg>

        {/* Center label */}
        <div className="absolute text-center pointer-events-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">4-Axis</span>
          <div className="text-xs font-extrabold text-slate-700">Radar</div>
        </div>
      </div>

      {/* 2. Interactive Axis Cards & Diagnostics */}
      <div className="flex-1 flex flex-col justify-between w-full">
        {/* Metric Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {AXIS_METRICS.map((axis) => {
            const isSelected = activeAxis.id === axis.id;
            return (
              <button
                key={axis.id}
                type="button"
                onClick={() => setActiveAxis(axis)}
                className={`flex flex-col p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-rose-300 shadow-xs ring-2 ring-rose-100'
                    : 'bg-white/60 border-slate-200/80 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] font-bold text-slate-500 truncate">{axis.name}</span>
                  {axis.icon}
                </div>
                <div className="text-sm font-extrabold text-slate-800">{axis.displayValue}</div>
                <div className="text-[9px] font-medium text-slate-400">Цель: {axis.target}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Axis Deep Diagnostic Box */}
        <div className="p-3 rounded-xl bg-white/90 border border-rose-100 flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 mt-0.5 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-slate-800">{activeAxis.label}</span>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Целевой стандарт: {activeAxis.target}
              </span>
            </div>
            <p className="text-slate-600 mb-1 leading-snug">{activeAxis.description}</p>
            <p className="text-[11px] font-medium text-rose-700/90 italic leading-snug">
              💡 {activeAxis.sotaPrinciple}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
