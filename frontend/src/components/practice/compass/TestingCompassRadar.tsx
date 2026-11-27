import React, { useState, useMemo } from 'react';
import { Target, ShieldCheck, Zap, Activity, Info } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';

interface AxisMetric {
  id: string;
  name: string;
  label: string;
  value: number;
  displayValue: string;
  target: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  sotaPrinciple: string;
}

export const TestingCompassRadar: React.FC = () => {
  const latestMutationResult = useAppStore((s) => s.latestMutationResult);
  const latestSandboxResult = useAppStore((s) => s.latestSandboxResult);
  const [activeAxisId, setActiveAxisId] = useState<string>('MUTATION_SCORE');

  const hasLiveRun = Boolean(latestMutationResult || latestSandboxResult);

  const axisMetrics: AxisMetric[] = useMemo(() => {
    const mutationScore = latestMutationResult ? Math.round(latestMutationResult.mutationScore) : 0;
    const totalTests = latestSandboxResult
      ? latestSandboxResult.passedCount + latestSandboxResult.failedCount
      : 0;
    const testPassPct =
      latestSandboxResult && totalTests > 0
        ? Math.round((latestSandboxResult.passedCount / totalTests) * 100)
        : latestMutationResult?.baselinePassed
        ? 100
        : 0;
    const killedRatio =
      latestMutationResult && latestMutationResult.totalMutants > 0
        ? Math.round((latestMutationResult.killedCount / latestMutationResult.totalMutants) * 100)
        : 0;
    const execMs = latestMutationResult?.executionTimeMs ?? latestSandboxResult?.executionTimeMs ?? null;
    const speedScore = execMs === null ? 0 : execMs <= 500 ? 95 : execMs <= 2000 ? 75 : 50;

    return [
      {
        id: 'MUTATION_SCORE',
        name: 'Mutation Score',
        label: 'Мутационный скор',
        value: hasLiveRun ? mutationScore : 0,
        displayValue: latestMutationResult ? `${mutationScore}%` : 'Не запускался',
        target: `>= ${latestMutationResult?.requiredScore ?? 85}%`,
        icon: <ShieldCheck className="w-4 h-4 text-emerald-700" />,
        color: '#047857',
        description: 'Доля уничтоженных инъецированных дефектов байткода.',
        sotaPrinciple:
          'Главный маркер: 100% Line Coverage ничего не стоит, если тесты не падают при замене < на <=.'
      },
      {
        id: 'BASELINE_PASS',
        name: 'Baseline Tests',
        label: 'Эталонный прогон',
        value: hasLiveRun ? testPassPct : 0,
        displayValue: latestSandboxResult
          ? `${latestSandboxResult.passedCount}/${totalTests}`
          : latestMutationResult
          ? latestMutationResult.baselinePassed
            ? 'OK'
            : 'FAIL'
          : 'Не запускался',
        target: '100% зелёных',
        icon: <Target className="w-4 h-4 text-sky-700" />,
        color: '#0369a1',
        description: 'Текущий статус выполнения тестов на немодифицированном эталонном коде.',
        sotaPrinciple: 'Тесты обязаны проходить на корректной реализации до инъекции мутантов.'
      },
      {
        id: 'KILLED_MUTANTS',
        name: 'Killed Mutants',
        label: 'Убито мутантов',
        value: hasLiveRun ? killedRatio : 0,
        displayValue: latestMutationResult
          ? `${latestMutationResult.killedCount} / ${latestMutationResult.totalMutants}`
          : 'Не запускался',
        target: 'Все мутанты',
        icon: <Activity className="w-4 h-4 text-purple-700" />,
        color: '#6d28d9',
        description: 'Количество мутантов, выявленных вашими AssertJ-проверками.',
        sotaPrinciple: 'Исключает Potemkin-тесты: каждый тестовый метод обязан проверять строгий инвариант.'
      },
      {
        id: 'EXECUTION_SPEED',
        name: 'Execution Speed',
        label: 'Время прогона',
        value: hasLiveRun ? speedScore : 0,
        displayValue: execMs !== null ? `${execMs} мс` : 'Не запускался',
        target: '< 2000 мс',
        icon: <Zap className="w-4 h-4 text-amber-700" />,
        color: '#b45309',
        description: 'Фактическое время выполнения последнего прогона в песочнице JVM.',
        sotaPrinciple: 'Инъекция java.time.Clock и запрет Thread.sleep обеспечивают сверхбыстрый TDD-цикл.'
      }
    ];
  }, [hasLiveRun, latestMutationResult, latestSandboxResult]);

  const activeAxis = axisMetrics.find((m) => m.id === activeAxisId) || axisMetrics[0];

  const cx = 100;
  const cy = 100;
  const r = 70;

  const points = axisMetrics.map((axis, i) => {
    const angle = (i * Math.PI) / 2 - Math.PI / 2;
    const norm = (Math.max(0, Math.min(100, axis.value)) / 100) * r;
    return {
      x: cx + norm * Math.cos(angle),
      y: cy + norm * Math.sin(angle)
    };
  });

  const polygonPath = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="flex flex-col gap-3 mb-4">
      {!hasLiveRun && (
        <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Тесты ещё не запускались: выполните прогон в Java 21 Sandbox или Mutation Runner (Ctrl+Enter), чтобы увидеть живую телеметрию.
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center gap-5 p-4 sm:p-5 rounded-2xl bg-pastel-bg border border-pastel-border">
        {/* Radar SVG Graphic */}
        <div className="relative shrink-0 flex items-center justify-center w-44 h-44">
          <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible" aria-hidden="true">
            {[0.25, 0.5, 0.75, 1.0].map((step, idx) => (
              <polygon
                key={idx}
                points={`100,${100 - r * step} ${100 + r * step},100 100,${100 + r * step} ${100 - r * step},100`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray={step === 1 ? 'none' : '2,2'}
              />
            ))}
            <line x1="100" y1="25" x2="100" y2="175" stroke="#cbd5e1" strokeWidth="1" />
            <line x1="25" y1="100" x2="175" y2="100" stroke="#cbd5e1" strokeWidth="1" />

            {hasLiveRun && (
              <>
                <polygon
                  points={polygonPath}
                  fill="rgba(181, 67, 62, 0.2)"
                  stroke="#B5433E"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill={axisMetrics[idx].color}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                ))}
              </>
            )}
          </svg>

          <div className="absolute text-center pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-muted">
              {hasLiveRun ? 'Live' : 'Ожидание'}
            </span>
            <div className="text-xs font-extrabold text-pastel-text">Radar</div>
          </div>
        </div>

        {/* Interactive Axis Cards & Diagnostics */}
        <div className="flex-1 flex flex-col justify-between w-full">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {axisMetrics.map((axis) => {
              const isSelected = activeAxis.id === axis.id;
              return (
                <button
                  key={axis.id}
                  type="button"
                  onClick={() => setActiveAxisId(axis.id)}
                  className={`flex flex-col p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#B5433E] shadow-2xs ring-1 ring-[#B5433E]/30'
                      : 'bg-white/80 border-pastel-border hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] font-bold text-pastel-muted truncate">{axis.name}</span>
                    {axis.icon}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-pastel-text truncate">{axis.displayValue}</div>
                  <div className="text-[10px] font-medium text-pastel-muted">Цель: {axis.target}</div>
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-white border border-pastel-border flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-pastel-rose text-pastel-accentRoseText mt-0.5 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-bold text-pastel-text">{activeAxis.label}</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Стандарт: {activeAxis.target}
                </span>
              </div>
              <p className="text-pastel-muted mb-1 leading-snug">{activeAxis.description}</p>
              <p className="text-[11px] font-medium text-pastel-accentRoseText leading-snug">
                {activeAxis.sotaPrinciple}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
