import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Globe,
  MessageSquare,
  Send,
  Bot,
  User,
  ChevronDown,
  RefreshCw,
  Lightbulb
} from 'lucide-react';

export type TutorMode = 'free_chat' | 'deep_dive' | 'eli5' | 'socratic';

const TUTOR_MODES_CONFIG: Record<TutorMode, { label: string; icon: string; desc: string }> = {
  free_chat: {
    label: '💬 Просто тьютор',
    icon: '💬',
    desc: 'Доброжелательный ментор: ответы на любые вопросы, разбор формул и допущений'
  },
  deep_dive: {
    label: '🔬 Под капотом',
    icon: '🔬',
    desc: 'Физика вычислений: дисковый I/O, репликация 3x, Page Cache, Peak Factor'
  },
  eli5: {
    label: '👶 На пальцах',
    icon: '👶',
    desc: 'Простые житейские аналогии (очереди, склады, полки) без сложного жаргона'
  },
  socratic: {
    label: '💡 Сократ',
    icon: '💡',
    desc: 'Никаких готовых ответов: только наводящие вопросы на поиск ошибок в расчетах'
  }
};

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

  // AI Tutor State & Multi-mode Steering
  const [isTutorOpen, setIsTutorOpen] = useState(true);
  const [tutorMode, setTutorMode] = useState<TutorMode>('free_chat');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `👋 Привет! Я твой AI-тьютор по расчетам масштабирования для сценария «${scenario.title}». Не понимаешь, откуда берутся формулы или коэффициенты? Выбирай режим и задавай любой вопрос!`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    if (isTutorOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTutorOpen]);

  const handleSendTutorMessage = async (textOverride?: string) => {
    const textToSend = (textOverride || inputMessage).trim();
    if (!textToSend || isSending) return;

    if (!textOverride) setInputMessage('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: textToSend }];
    setChatMessages(newHistory);
    setIsSending(true);

    try {
      const res = await fetch('/api/system-design/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contextType: 'math_coach',
          mode: tutorMode,
          userMessage: textToSend,
          conversationHistory: newHistory.slice(-6),
          mathContext: {
            scenarioTitle: scenario.title,
            dau: scenario.dau,
            writesPerUser: scenario.writesPerUser,
            readsPerUser: scenario.readsPerUser,
            avgWriteBytes: scenario.avgWriteBytes,
            avgReadBytes: scenario.avgReadBytes,
            retentionYears: scenario.retentionYears,
            calculatedMetrics: {
              writeRps: userPeakQps ? `${userPeakQps} QPS` : `~${mathResults.peakWriteQps} QPS`,
              readRps: `~${mathResults.peakReadQps} QPS`,
              writeBandwidth: `${(mathResults.peakWriteQps * scenario.avgWriteBytes * 8 / 1_000_000).toFixed(1)} Mbps`,
              readBandwidth: `${(mathResults.peakReadQps * scenario.avgReadBytes * 8 / 1_000_000).toFixed(1)} Mbps`,
              storage: userStorageTb ? `${userStorageTb} TB` : `~${mathResults.totalStorageTb} TB`,
              cacheRam: userHotRamGb ? `${userHotRamGb} GB` : `~${mathResults.hotRamGb} GB`
            }
          }
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `⚠️ Не удалось связаться с AI-тьютором: ${err.message || 'Ошибка сети'}. Попробуйте снова через несколько секунд.` 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-white/95 rounded-3xl border border-pastel-border/80 shadow-sm space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-200">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Math Coach: Прикидки на салфетке (Back-of-the-Envelope)
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

      {/* Scenario Brief Bar */}
      <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-violet-600" />
            Дано в условиях задачи:
          </span>
          <p className="text-xs text-violet-800 font-medium leading-relaxed">
            {scenario.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 font-bold text-violet-900">
            DAU: {(scenario.dau / 1_000_000).toFixed(0)}M
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 font-bold text-violet-900">
            Запись: {scenario.writesPerUser} / день
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 font-bold text-violet-900">
            Чтение: {scenario.readsPerUser} / день
          </span>
        </div>
      </div>

      {/* 3 Core Estimation Exercises Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Peak QPS */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              Пиковый Total RPS / QPS:
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Peak = 3x Avg</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка (напр. 3500)"
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
              <span className="font-bold text-violet-900">~{mathResults.peakTotalQps.toLocaleString()} QPS</span>
              <span className="text-[10px] text-slate-500 block">
                (Запись: {mathResults.peakWriteQps.toLocaleString()} + Чтение: {mathResults.peakReadQps.toLocaleString()})
              </span>
            </div>
          )}
        </div>

        {/* Metric 2: Storage Volume */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              Хранилище на {scenario.retentionYears} лет (TB):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">+20% Index/Repl</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка в TB (напр. 120)"
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
              <span className="font-bold text-indigo-900">~{mathResults.totalStorageTb.toLocaleString()} TB</span>
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
              <span className="font-bold text-emerald-950">~{mathResults.hotRamGb.toLocaleString()} GB</span>
              <span className="text-[10px] text-slate-500 block">
                (20% суточного трафика чтения в Redis кластере)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons & Tutor Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTutorOpen(!isTutorOpen)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isTutorOpen
                ? 'bg-violet-100 text-violet-800 border border-violet-300 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
            <span>AI-Наставник по расчетам</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-violet-200/80 font-mono text-violet-900 font-bold">
              4 режима
            </span>
          </button>
        </div>

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

      {/* Embedded Contextual AI Tutor Section (4 Modes) */}
      {isTutorOpen && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-slate-50 to-violet-50/30 border border-violet-200/80 shadow-sm space-y-4 animate-in fade-in zoom-in-98 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-violet-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-xs shadow-xs font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span>Контекстный AI-Тьютор</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white border border-violet-200 text-violet-700 font-bold">
                    Math Coach
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500">
                  {TUTOR_MODES_CONFIG[tutorMode].desc}
                </p>
              </div>
            </div>

            {/* 4 Modes Switcher Pills */}
            <div className="flex items-center bg-white p-1 rounded-2xl border border-violet-200 shadow-2xs gap-1 overflow-x-auto no-scrollbar">
              {(Object.keys(TUTOR_MODES_CONFIG) as TutorMode[]).map((modeKey) => {
                const cfg = TUTOR_MODES_CONFIG[modeKey];
                const isSelected = tutorMode === modeKey;
                return (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => setTutorMode(modeKey)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px]">
            <span className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              Спросить быстро:
            </span>
            <button
              type="button"
              onClick={() => handleSendTutorMessage('Объясни на простых пальцах формулу перевода суточного трафика в QPS.')}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
            >
              👶 Как считать QPS на пальцах?
            </button>
            <button
              type="button"
              onClick={() => handleSendTutorMessage('Зачем умножать средний QPS на 2 или 3 для расчета пиковой нагрузки? Откуда берется Peak Factor?')}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
            >
              🔬 Откуда берется Peak Factor (2x–3x)?
            </button>
            <button
              type="button"
              onClick={() => handleSendTutorMessage('Как правильно посчитать объем оперативной памяти под кэш по закону Парето 80/20?')}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
            >
              📐 Как считать память под кэш (80/20)?
            </button>
            <button
              type="button"
              onClick={() => handleSendTutorMessage('Посмотри мои введенные прикидки в инпуты выше и укажи, где я ошибся или что упустил.')}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
            >
              💡 Проверь мои текущие расчеты
            </button>
          </div>

          {/* Chat Messages List */}
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 no-scrollbar text-xs">
            {chatMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-2xl max-w-xl text-xs leading-relaxed whitespace-pre-line ${
                      isUser
                        ? 'bg-violet-600 text-white font-medium rounded-tr-xs'
                        : 'bg-white border border-violet-100 text-slate-800 shadow-2xs rounded-tl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {isUser && (
                    <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}
            {isSending && (
              <div className="flex items-center gap-2 text-violet-600 text-xs font-bold pl-8 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>AI-тьютор формулирует ответ в режиме «{TUTOR_MODES_CONFIG[tutorMode].label}»...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder={`Задай вопрос по расчету («${TUTOR_MODES_CONFIG[tutorMode].label}»)...`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSendTutorMessage();
                }
              }}
              className="flex-1 p-2.5 px-3.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              type="button"
              onClick={() => void handleSendTutorMessage()}
              disabled={isSending || !inputMessage.trim()}
              className="p-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Отправить</span>
            </button>
          </div>
        </div>
      )}

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
