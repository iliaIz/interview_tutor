import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Database,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { TransactionScenario, TransactionAnnotationConfig } from '../../types/transactionLab';

interface TransactionTimelineScrubberProps {
  scenario: TransactionScenario;
  userConfigs: Record<string, TransactionAnnotationConfig>;
  activeMethodId?: string;
  onSelectMethod?: (methodId: string) => void;
}

export const TransactionTimelineScrubber: React.FC<TransactionTimelineScrubberProps> = ({
  scenario,
  userConfigs,
  activeMethodId,
  onSelectMethod
}) => {
  const [currentMs, setCurrentMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const maxMs = 100;

  // Auto-play timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentMs((prev) => {
          if (prev >= maxMs) {
            setIsPlaying(false);
            return maxMs;
          }
          return prev + 5;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const allMethods = scenario.services.flatMap((s) =>
    s.methods.map((m) => ({ ...m, serviceName: s.className }))
  );
  const parentMethod = allMethods[0];
  const childMethods = allMethods.slice(1);
  const parentConfig = parentMethod ? userConfigs[parentMethod.id] || { propagation: 'NONE' } : null;

  // Detect special conditions
  const isSelfInvocation = Boolean(
    scenario.id.includes('self') ||
    scenario.title.toLowerCase().includes('self-invocation') ||
    childMethods.some((m) => m.serviceName === parentMethod?.serviceName)
  );

  const hasRequiresNew = childMethods.some(
    (m) => userConfigs[m.id]?.propagation === 'REQUIRES_NEW'
  );
  const hasNested = childMethods.some(
    (m) => userConfigs[m.id]?.propagation === 'NESTED'
  );

  return (
    <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs space-y-4">
      {/* 1. Header & Scrubber Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-200/60">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800 tracking-wide uppercase">
              Интерактивный Timeline Scrubber & Concurrency Swimlanes
            </h4>
            <p className="text-[11px] text-slate-500">
              Пошаговая визуализация перехвата Spring AOP, удержания сокетов и детекция обхода прокси
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Пауза' : 'Воспроизвести'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentMs((m) => Math.min(maxMs, m + 10))}
            disabled={currentMs >= maxMs}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 transition cursor-pointer"
            title="Шаг вперед (+10мс)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentMs(0);
            }}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Сбросить таймлайн"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
            {currentMs} ms
          </span>
        </div>
      </div>

      {/* 2. Self-Invocation AOP Detour Alert Banner */}
      {isSelfInvocation && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/90 text-xs flex items-start gap-2.5 text-rose-800 animate-in fade-in duration-300">
          <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold flex items-center gap-2">
              <span>⚠️ ОБХОД SPRING AOP ПРОКСИ (Self-Invocation Trap)</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-200 text-rose-900 font-extrabold uppercase">
                invokevirtual bypass
              </span>
            </div>
            <p className="text-[11px] text-rose-700 mt-0.5 leading-snug">
              Метод вызывается через <code className="font-mono font-bold bg-white/60 px-1 rounded">this.method()</code> внутри того же бина. Вызов идет напрямую к Java-объекту, минуя CGLIB Proxy и TransactionInterceptor. Аннотация <code>@Transactional</code> на вызываемом методе полностью игнорируется!
            </p>
          </div>
        </div>
      )}

      {/* 3. Multi-Threaded Swimlane Tracks */}
      <div className="space-y-3 font-mono text-xs">
        {/* Track 1: Parent Execution [http-exec-1] */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] mb-1.5 font-sans">
            <span className="font-bold text-slate-700">Thread 1: [http-exec-1] — Родительский метод</span>
            <span className="text-[10px] font-mono text-slate-500">
              {parentMethod?.serviceName}.{parentMethod?.name}()
            </span>
          </div>

          <div className="relative h-9 rounded-lg bg-slate-200/70 overflow-hidden flex items-center p-1">
            {/* Scrubber pointer line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-violet-600 z-20 shadow-md transition-all duration-75"
              style={{ left: `${currentMs}%` }}
            />

            {/* Stage 1: Tx Start & Connection #1 */}
            <div
              className={`h-full rounded flex items-center px-2 text-[10px] text-white font-bold transition-all ${
                currentMs >= 5 ? 'bg-emerald-600 shadow-xs' : 'bg-slate-400 opacity-60'
              }`}
              style={{ width: '35%' }}
            >
              <Database className="w-3 h-3 mr-1" />
              <span>[TX_START] Conn #1</span>
            </div>

            {/* Stage 2: Suspended during RequiresNew or Normal execution */}
            {hasRequiresNew ? (
              <div
                className={`h-full rounded mx-1 flex items-center justify-center text-[10px] font-bold transition-all ${
                  currentMs >= 35 && currentMs <= 80
                    ? 'bg-amber-300 text-amber-950 border border-amber-500 animate-pulse'
                    : 'bg-slate-300 text-slate-500'
                }`}
                style={{ width: '40%' }}
              >
                <AlertTriangle className="w-3 h-3 mr-1 text-amber-700" />
                <span>SUSPENDED (Удержание Conn #1)</span>
              </div>
            ) : (
              <div
                className={`h-full rounded mx-1 flex items-center px-2 text-[10px] font-bold text-white transition-all ${
                  currentMs >= 35 ? 'bg-emerald-500' : 'bg-slate-300 text-slate-500'
                }`}
                style={{ width: '40%' }}
              >
                <span>Active Business Logic</span>
              </div>
            )}

            {/* Stage 3: Tx Commit */}
            <div
              className={`h-full rounded flex items-center justify-center text-[10px] text-white font-bold transition-all ${
                currentMs >= 85 ? 'bg-emerald-700' : 'bg-slate-400 opacity-60'
              }`}
              style={{ width: '25%' }}
            >
              <span>[TX_COMMIT]</span>
            </div>
          </div>
        </div>

        {/* Track 2: Nested / Child Execution */}
        {childMethods.map((child) => {
          const cfg = userConfigs[child.id] || { propagation: 'NONE' };
          const isReqNew = cfg.propagation === 'REQUIRES_NEW';
          const isNest = cfg.propagation === 'NESTED';

          return (
            <div key={child.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-sans">
                <span className="font-bold text-slate-700">
                  {isReqNew ? 'Вложенный поток / Контекст 2: [HikariCP Conn #2]' : 'Дочерний контекст (В рамках Conn #1)'}
                </span>
                <span className="text-[10px] font-mono text-indigo-600 font-bold">
                  {child.serviceName}.{child.name}() [{cfg.propagation}]
                </span>
              </div>

              <div className="relative h-9 rounded-lg bg-slate-200/70 overflow-hidden flex items-center p-1">
                {/* Scrubber pointer line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-violet-600 z-20 shadow-md transition-all duration-75"
                  style={{ left: `${currentMs}%` }}
                />

                {/* Idle lead-in */}
                <div style={{ width: '35%' }} className="h-full" />

                {/* Active Child Window */}
                <div
                  className={`h-full rounded mx-1 flex items-center justify-between px-2 text-[10px] font-bold transition-all ${
                    currentMs >= 35 && currentMs <= 80
                      ? isReqNew
                        ? 'bg-rose-500 text-white shadow-xs'
                        : isNest
                        ? 'bg-amber-500 text-white'
                        : 'bg-indigo-600 text-white'
                      : 'bg-slate-300 text-slate-500'
                  }`}
                  style={{ width: '40%' }}
                >
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>
                      {isReqNew ? 'New Socket Conn #2' : isNest ? 'Savepoint sp_1' : 'Join Conn #1'}
                    </span>
                  </div>
                  <span>{currentMs >= 80 ? 'Done' : 'Running'}</span>
                </div>

                {/* Trailing */}
                <div style={{ width: '25%' }} className="h-full" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
