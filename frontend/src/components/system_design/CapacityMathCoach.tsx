import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Zap,
  ArrowRight,
  TrendingUp,
  HardDrive,
  Cpu,
  Globe
} from 'lucide-react';

interface MathScenario {
  id: string;
  title: string;
  dau: number; // e.g. 50_000_000
  writesPerUser: number; // e.g. 2
  readsPerUser: number; // e.g. 20
  avgWriteBytes: number; // e.g. 500 bytes
  avgReadBytes: number; // e.g. 2048 bytes
  retentionYears: number; // e.g. 5
  description: string;
}

const PRESET_SCENARIOS: MathScenario[] = [
  {
    id: 'social-feed',
    title: 'Лента соцсети (Twitter / X-like)',
    dau: 100_000_000,
    writesPerUser: 2,
    readsPerUser: 50,
    avgWriteBytes: 300,
    avgReadBytes: 2500,
    retentionYears: 5,
    description: '100M DAU, 2 твита в день (300B), 50 просмотров ленты (2.5KB). Хранение 5 лет.'
  },
  {
    id: 'photo-sharing',
    title: 'Фотохостинг (Instagram / Pinterest)',
    dau: 50_000_000,
    writesPerUser: 1,
    readsPerUser: 30,
    avgWriteBytes: 200_000, // 200 KB image
    avgReadBytes: 200_000,
    retentionYears: 3,
    description: '50M DAU, 1 фото в день (200KB сжатое фото), 30 просмотров. Хранение 3 года.'
  },
  {
    id: 'url-shortener',
    title: 'Сервис сокращения ссылок (TinyURL / Bitly)',
    dau: 10_000_000,
    writesPerUser: 0.1, // 1 write per 10 users = 1M writes/day
    readsPerUser: 10, // 100M reads/day
    avgWriteBytes: 500,
    avgReadBytes: 100,
    retentionYears: 10,
    description: '10M DAU, 100M переходов в день, 1M новых ссылок (500B). Хранение 10 лет.'
  },
  {
    id: 'fintech-ledger',
    title: 'Двусторонняя бухгалтерская книга (Stripe / Т-Банк)',
    dau: 5_000_000,
    writesPerUser: 4, // 20M tx/day
    readsPerUser: 12,
    avgWriteBytes: 800,
    avgReadBytes: 1200,
    retentionYears: 7,
    description: '5M DAU, 20M финансовых транзакций в день (800B запись). Строгое хранение 7 лет.'
  }
];

interface CapacityMathCoachProps {
  onApplyCalculations?: (summary: string) => void;
}

export const CapacityMathCoach: React.FC<CapacityMathCoachProps> = ({ onApplyCalculations }) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(PRESET_SCENARIOS[0].id);
  const scenario = useMemo(() => {
    return PRESET_SCENARIOS.find((s) => s.id === activeScenarioId) || PRESET_SCENARIOS[0];
  }, [activeScenarioId]);

  // User input guesses for drill
  const [userPeakQps, setUserPeakQps] = useState<string>('');
  const [userStorageTb, setUserStorageTb] = useState<string>('');
  const [userHotRamGb, setUserHotRamGb] = useState<string>('');
  const [isEvaluated, setIsEvaluated] = useState(false);

  // Exact calculations based on standard interview approximations
  const mathResults = useMemo(() => {
    const totalWritesDay = scenario.dau * scenario.writesPerUser;
    const totalReadsDay = scenario.dau * scenario.readsPerUser;

    const avgWriteQps = Math.round(totalWritesDay / 86400);
    const peakWriteQps = avgWriteQps * 3;

    const avgReadQps = Math.round(totalReadsDay / 86400);
    const peakReadQps = avgReadQps * 3;

    const peakTotalQps = peakWriteQps + peakReadQps;

    // Daily storage (Bytes -> GB -> TB)
    const dailyWriteBytes = totalWritesDay * scenario.avgWriteBytes;
    const dailyStorageGb = dailyWriteBytes / (1024 * 1024 * 1024);
    const totalStorageTb = (dailyStorageGb * 365 * scenario.retentionYears * 1.2) / 1024; // +20% indexing/metadata

    // Hot RAM (80/20 rule: 20% of daily read data cached in RAM)
    const dailyReadBytes = totalReadsDay * scenario.avgReadBytes;
    const hotRamGb = (dailyReadBytes * 0.2) / (1024 * 1024 * 1024);

    // Network Bandwidth (Gbps)
    const peakBandwidthBytesPerSec =
      peakWriteQps * scenario.avgWriteBytes + peakReadQps * scenario.avgReadBytes;
    const networkGbps = (peakBandwidthBytesPerSec * 8) / 1_000_000_000;

    return {
      totalWritesDay,
      totalReadsDay,
      avgWriteQps,
      peakWriteQps,
      avgReadQps,
      peakReadQps,
      peakTotalQps,
      dailyStorageGb: Math.round(dailyStorageGb * 10) / 10,
      totalStorageTb: Math.round(totalStorageTb * 10) / 10,
      hotRamGb: Math.round(hotRamGb * 10) / 10,
      networkGbps: Math.round(networkGbps * 100) / 100
    };
  }, [scenario]);

  // Validation evaluation (+-25% tolerance window)
  const validation = useMemo(() => {
    if (!isEvaluated) return null;

    const qpsVal = parseFloat(userPeakQps);
    const storageVal = parseFloat(userStorageTb);
    const ramVal = parseFloat(userHotRamGb);

    const checkTolerance = (user: number, exact: number) => {
      if (isNaN(user) || user <= 0) return { passed: false, diffPercent: 100, msg: 'Не заполнено' };
      const diff = Math.abs(user - exact) / exact;
      const passed = diff <= 0.25;
      return {
        passed,
        diffPercent: Math.round(diff * 100),
        msg: passed ? 'Отлично (в окне ±25%)' : diff > 2 ? 'Ошибка на порядок (>200%)' : `Отклонение ${Math.round(diff * 100)}%`
      };
    };

    return {
      qps: checkTolerance(qpsVal, mathResults.peakTotalQps),
      storage: checkTolerance(storageVal, mathResults.totalStorageTb),
      ram: checkTolerance(ramVal, mathResults.hotRamGb)
    };
  }, [isEvaluated, userPeakQps, userStorageTb, userHotRamGb, mathResults]);

  const handleReset = () => {
    setUserPeakQps('');
    setUserStorageTb('');
    setUserHotRamGb('');
    setIsEvaluated(false);
  };

  return (
    <div className="p-4 sm:p-6 bg-white/95 rounded-3xl border border-pastel-border/80 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-200">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                L1 Math Coach: Прикидки на салфетке (Back-of-the-Envelope)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                Окно допуска &plusmn;25%
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Отработка математических расчетов QPS, дисков, RAM и сети за 60 секунд перед началом дизайна
            </p>
          </div>
        </div>

        {/* Preset Selector Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={activeScenarioId}
            onChange={(e) => {
              setActiveScenarioId(e.target.value);
              handleReset();
            }}
            className="text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {PRESET_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scenario Brief Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50/60 via-slate-50 to-indigo-50/40 border border-violet-200/60 text-xs text-slate-700 space-y-2">
        <div className="font-extrabold text-violet-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span>Условия задачи: {scenario.title}</span>
        </div>
        <p className="leading-relaxed">{scenario.description}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono">
          <div className="p-2 rounded-lg bg-white/80 border border-violet-100">
            <span className="text-slate-400 block">DAU:</span>
            <span className="font-bold text-slate-800">{(scenario.dau / 1_000_000).toFixed(0)}M пользователей</span>
          </div>
          <div className="p-2 rounded-lg bg-white/80 border border-violet-100">
            <span className="text-slate-400 block">Read / Write Ratio:</span>
            <span className="font-bold text-slate-800">{scenario.readsPerUser} : {scenario.writesPerUser}</span>
          </div>
          <div className="p-2 rounded-lg bg-white/80 border border-violet-100">
            <span className="text-slate-400 block">Write Payload:</span>
            <span className="font-bold text-slate-800">{scenario.avgWriteBytes} Bytes</span>
          </div>
          <div className="p-2 rounded-lg bg-white/80 border border-violet-100">
            <span className="text-slate-400 block">Retention:</span>
            <span className="font-bold text-slate-800">{scenario.retentionYears} лет</span>
          </div>
        </div>
      </div>

      {/* Interactive Drill: User Guess vs Exact Reference */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Peak QPS */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Пиковый суммарный QPS:
            </span>
            <span className="text-[10px] text-slate-400 font-mono">3x Average</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка (напр. 35000)"
              value={userPeakQps}
              onChange={(e) => setUserPeakQps(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold focus:ring-2 focus:ring-violet-400 outline-none"
            />
            {validation && (
              <div className={`text-[11px] font-bold flex items-center gap-1 mt-1 ${validation.qps.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                {validation.qps.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{validation.qps.msg}</span>
              </div>
            )}
          </div>
          {isEvaluated && (
            <div className="pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px]">Точный расчет:</span>
              <span className="font-bold text-indigo-900">{mathResults.peakTotalQps.toLocaleString()} QPS</span>
              <span className="text-[10px] text-slate-500 block">
                (Write: {mathResults.peakWriteQps.toLocaleString()} + Read: {mathResults.peakReadQps.toLocaleString()})
              </span>
            </div>
          )}
        </div>

        {/* Metric 2: Total Storage */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-violet-600" />
              Объем дисков за {scenario.retentionYears} лет (TB):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">+20% Metadata</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка в TB (напр. 150)"
              value={userStorageTb}
              onChange={(e) => setUserStorageTb(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold focus:ring-2 focus:ring-violet-400 outline-none"
            />
            {validation && (
              <div className={`text-[11px] font-bold flex items-center gap-1 mt-1 ${validation.storage.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                {validation.storage.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{validation.storage.msg}</span>
              </div>
            )}
          </div>
          {isEvaluated && (
            <div className="pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px]">Точный расчет:</span>
              <span className="font-bold text-violet-900">{mathResults.totalStorageTb.toLocaleString()} TB</span>
              <span className="text-[10px] text-slate-500 block">
                ({scenario.retentionYears} лет с учетом индексов и репликации)
              </span>
            </div>
          )}
        </div>

        {/* Metric 3: Hot RAM Cache */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-600" />
              Горячий кэш RAM (GB):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">80/20 Rule</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка в GB (напр. 64)"
              value={userHotRamGb}
              onChange={(e) => setUserHotRamGb(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold focus:ring-2 focus:ring-violet-400 outline-none"
            />
            {validation && (
              <div className={`text-[11px] font-bold flex items-center gap-1 mt-1 ${validation.ram.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                {validation.ram.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{validation.ram.msg}</span>
              </div>
            )}
          </div>
          {isEvaluated && (
            <div className="pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px]">Точный расчет:</span>
              <span className="font-bold text-emerald-900">{mathResults.hotRamGb.toLocaleString()} GB</span>
              <span className="text-[10px] text-slate-500 block">
                (20% суточного трафика чтения в Redis кластере)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleReset}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Сбросить</span>
        </button>

        <div className="flex items-center gap-2">
          {isEvaluated && onApplyCalculations && (
            <button
              type="button"
              onClick={() => {
                const summary = [
                  `- **Пиковый QPS**: ~${mathResults.peakTotalQps.toLocaleString()} (Запись: ${mathResults.peakWriteQps.toLocaleString()} QPS, Чтение: ${mathResults.peakReadQps.toLocaleString()} QPS)`,
                  `- **Хранение (на ${scenario.retentionYears} лет)**: ~${mathResults.totalStorageTb.toLocaleString()} TB (суточный прирост: ${mathResults.dailyStorageGb.toFixed(1)} GB)`,
                  `- **Горячий кэш RAM (80/20)**: ~${mathResults.hotRamGb.toLocaleString()} GB в Redis кластере`,
                  `- **Сетевая полоса пропускания**: ~${mathResults.networkGbps.toFixed(2)} Gbps (~${(mathResults.networkGbps / 8).toFixed(2)} GB/s)`
                ].join('\n');
                onApplyCalculations(summary);
              }}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Вставить в решение</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEvaluated(true)}
            className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Проверить мои прикидки</span>
          </button>
        </div>
      </div>

      {/* Quick Conversion Cheatsheet Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-700 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-violet-600" />
          <span>Шпаргалка степеней 2 и 10 для мгновенного счета:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">2¹⁰ ≈ 10³</span>
            <span>1 KB = 1000 Bytes (тысяча)</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">2²⁰ ≈ 10⁶</span>
            <span>1 MB = 1 000 000 (миллион)</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">2³⁰ ≈ 10⁹</span>
            <span>1 GB = 1 000 000 000 (миллиард)</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">86 400 сек</span>
            <span>≈ 10⁵ сек в сутках (~100k)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
