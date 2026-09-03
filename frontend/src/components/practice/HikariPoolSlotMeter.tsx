import React, { useMemo } from 'react';
import { Database, AlertOctagon, Activity, Cpu, Server, ShieldCheck, Zap } from 'lucide-react';
import { TransactionScenario, TransactionAnnotationConfig } from '../../types/transactionLab';

interface HikariPoolSlotMeterProps {
  scenario: TransactionScenario;
  userConfigs: Record<string, TransactionAnnotationConfig>;
  threads: number;
  onThreadsChange: (threads: number) => void;
}

export const HikariPoolSlotMeter: React.FC<HikariPoolSlotMeterProps> = ({
  scenario,
  userConfigs,
  threads,
  onThreadsChange
}) => {
  const poolCapacity = scenario.simulatedLoad.poolCapacity; // e.g., 10

  // Calculate nesting depth D:
  // If any child method uses REQUIRES_NEW while parent uses REQUIRED => D = 2
  const hasNestedRequiresNew = useMemo(() => {
    const allMethods = scenario.services.flatMap((s) => s.methods);
    if (allMethods.length < 2) return false;
    const parent = allMethods[0];
    const children = allMethods.slice(1);
    const parentConfig = userConfigs[parent.id];
    const hasParentTx = parentConfig?.propagation === 'REQUIRED' || parentConfig?.propagation === 'REQUIRES_NEW';
    const childHasRequiresNew = children.some(
      (c) => userConfigs[c.id]?.propagation === 'REQUIRES_NEW'
    );
    return hasParentTx && childHasRequiresNew;
  }, [scenario, userConfigs]);

  const depthD = hasNestedRequiresNew ? 2 : 1;

  // Brett Wooldridge Deadlock Condition: P <= T * (D - 1)
  const isDeadlockHazard = useMemo(() => {
    if (depthD <= 1) return false;
    return poolCapacity <= threads * (depthD - 1);
  }, [poolCapacity, threads, depthD]);

  const safePoolSize = threads * (depthD - 1) + 1;

  // Generate 10 slot states
  const slots = useMemo(() => {
    const list: Array<{ id: number; status: 'idle' | 'active' | 'suspended' | 'starved' }> = [];
    for (let i = 0; i < poolCapacity; i++) {
      if (isDeadlockHazard) {
        // Under deadlock: all slots in pool are occupied by parent threads waiting for child connection!
        list.push({ id: i, status: i % 2 === 0 ? 'suspended' : 'active' });
      } else {
        const requiredSlots = Math.min(poolCapacity, threads * depthD);
        if (i < requiredSlots) {
          if (hasNestedRequiresNew && i < Math.floor(requiredSlots / 2)) {
            list.push({ id: i, status: 'suspended' });
          } else {
            list.push({ id: i, status: 'active' });
          }
        } else {
          list.push({ id: i, status: 'idle' });
        }
      }
    }
    return list;
  }, [poolCapacity, threads, depthD, isDeadlockHazard, hasNestedRequiresNew]);

  return (
    <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <h4 className="font-extrabold text-xs text-slate-800 tracking-wide uppercase">
            HikariCP ConcurrentBag (Обойма Слотов Пула)
          </h4>
        </div>
        <div className="text-[11px] font-mono font-bold text-slate-600">
          Размер пула: <span className="text-emerald-700">{poolCapacity} соединений</span>
        </div>
      </div>

      {/* Slots Visual Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {slots.map((slot) => {
          let bg = 'bg-emerald-50 text-emerald-700 border-emerald-300';
          let label = 'IDLE';
          if (slot.status === 'active') {
            bg = 'bg-gradient-to-br from-indigo-500 to-teal-500 text-white border-teal-600 animate-pulse';
            label = 'ACTIVE';
          } else if (slot.status === 'suspended') {
            bg = 'bg-amber-400 text-amber-950 border-amber-500 font-extrabold animate-pulse';
            label = 'HELD';
          }

          return (
            <div
              key={slot.id}
              className={`h-14 rounded-xl border flex flex-col items-center justify-center p-1 text-center shadow-2xs transition-all ${bg}`}
              title={`Слот #${slot.id + 1}: ${label}`}
            >
              <span className="text-[10px] font-mono opacity-80">#{slot.id + 1}</span>
              <span className="text-[9px] font-bold tracking-tight">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Interactive Concurrency Slider */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            Входящая нагрузка (Параллельные запросы T):
          </span>
          <span className="font-mono font-extrabold text-indigo-700 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200">
            {threads} параллельных потоков
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          value={threads}
          onChange={(e) => onThreadsChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>1 поток (Low Load)</span>
          <span>10 потоков</span>
          <span>20 потоков</span>
          <span>30 потоков (High Load)</span>
        </div>
      </div>

      {/* Live Wooldridge's Formula & Diagnostic Callout */}
      {isDeadlockHazard ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs space-y-2 animate-pulse">
          <div className="flex items-center gap-2 font-bold text-rose-700">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>КАТАСТРОФА: Дедлок пула HikariCP по теореме Бретта Вулдриджа!</span>
          </div>
          <div className="font-mono text-[11px] bg-white/80 p-2 rounded-lg border border-rose-200">
            Формула дедлока: P ({poolCapacity}) &le; T ({threads}) &times; (D - 1 = {depthD - 1}) &rarr; <span className="font-bold text-rose-700">DEADLOCK CONFIRMED</span>
            <br />
            Для безопасной работы требуется размер пула: P &ge; {safePoolSize}
          </div>

          {/* 3-Layer Telemetry Triage */}
          <div className="pt-2 border-t border-rose-200 text-[11px] space-y-1 font-mono">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Cpu className="w-3 h-3 text-indigo-600" />
              <span>JVM Thread Dump: {threads} threads TIMED_WAITING on ConcurrentBag.borrow()</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <Activity className="w-3 h-3 text-rose-600" />
              <span>HikariCP JMX: active={poolCapacity}, idle=0, pending={threads} (EXHAUSTION)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <Server className="w-3 h-3 text-emerald-600" />
              <span>PostgreSQL / MySQL: {poolCapacity} sessions idle in transaction (CPU load 0.1%)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Пул соединений стабилен: запас емкости достаточен</span>
          </div>
          <p className="text-[11px] text-emerald-800">
            Условие Вулдриджа соблюдено: глубина соединений D = {depthD}, очередь ожидания 0 мс.
          </p>
        </div>
      )}
    </div>
  );
};
