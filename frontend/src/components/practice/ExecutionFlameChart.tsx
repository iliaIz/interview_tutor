import React from 'react';
import { Layers, Database, ShieldAlert, CheckCircle2, AlertTriangle, ArrowDownRight } from 'lucide-react';
import { TransactionScenario, TransactionAnnotationConfig } from '../../types/transactionLab';

interface ExecutionFlameChartProps {
  scenario: TransactionScenario;
  userConfigs: Record<string, TransactionAnnotationConfig>;
  activeMethodId?: string;
  onSelectMethod?: (methodId: string) => void;
}

export const ExecutionFlameChart: React.FC<ExecutionFlameChartProps> = ({
  scenario,
  userConfigs,
  activeMethodId,
  onSelectMethod
}) => {
  // Extract all methods across services in sequence
  const allMethods = scenario.services.flatMap((s) =>
    s.methods.map((m) => ({ ...m, serviceName: s.className }))
  );

  const parentMethod = allMethods[0];
  const childMethods = allMethods.slice(1);
  const parentConfig = parentMethod ? userConfigs[parentMethod.id] || { propagation: 'NONE' } : null;

  // Detect if any child method has REQUIRES_NEW
  const hasRequiresNew = childMethods.some(
    (m) => userConfigs[m.id]?.propagation === 'REQUIRES_NEW'
  );
  // Detect if any child has NESTED
  const hasNested = childMethods.some(
    (m) => userConfigs[m.id]?.propagation === 'NESTED'
  );

  return (
    <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-600" />
          <h4 className="font-extrabold text-xs text-slate-800 tracking-wide uppercase">
            Двухконтурный Execution Flame Chart (Spring AOP vs JDBC Сокет)
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded border border-dashed border-violet-500 bg-violet-50" />
            Логический Spring AOP
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-2xs" />
            Физический JDBC Сокет
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-400" />
            Suspended (Простой сокета)
          </span>
        </div>
      </div>

      {/* Flame Chart Visualization Canvas */}
      <div className="space-y-3 pt-1">
        {/* Level 1: Parent Method Execution */}
        {parentMethod && parentConfig && (
          <div
            onClick={() => onSelectMethod?.(parentMethod.id)}
            className={`p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer relative ${
              activeMethodId === parentMethod.id
                ? 'border-violet-500 bg-violet-50/50 shadow-xs'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
            }`}
          >
            {/* Outer AOP Bar Header */}
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                <span className="text-violet-600 font-bold">{parentMethod.serviceName}.</span>
                <span>{parentMethod.name}()</span>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-bold">
                  {parentConfig.propagation}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Thread: [http-exec-1]
              </span>
            </div>

            {/* Inner Physical JDBC Connection Bar */}
            {parentConfig.propagation !== 'NONE' ? (
              <div className="relative h-7 rounded-lg overflow-hidden flex items-center shadow-inner border border-emerald-600/30">
                {/* Active segment before child call */}
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center px-3 text-[10px] text-white font-bold tracking-wide"
                  style={{ width: hasRequiresNew ? '35%' : '100%' }}
                >
                  <Database className="w-3 h-3 mr-1 shrink-0" />
                  <span>JDBC Connection #1 (ACTIVE)</span>
                </div>

                {/* If child has REQUIRES_NEW: parent is Suspended / Held Idle in HikariCP! */}
                {hasRequiresNew && (
                  <div
                    className="h-full bg-amber-200 border-x border-amber-400 flex items-center px-3 text-[10px] text-amber-900 font-bold animate-pulse"
                    style={{
                      width: '45%',
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(245, 158, 11, 0.15) 10px, rgba(245, 158, 11, 0.15) 20px)'
                    }}
                    title="Родительская транзакция приостановлена (SUSPENDED). Соединение удерживается в памяти пула!"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1 text-amber-700 shrink-0" />
                    <span>SUSPENDED (Удержание сокета #1)</span>
                  </div>
                )}

                {/* Final resume segment */}
                {hasRequiresNew && (
                  <div
                    className="h-full bg-emerald-600 flex items-center px-2 text-[9px] text-white font-bold"
                    style={{ width: '20%' }}
                  >
                    <span>RESUME & COMMIT</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-6 rounded-lg bg-slate-200/80 flex items-center px-3 text-[10px] text-slate-600 italic">
                Без удержания физического соединения базы данных (propagation = NONE)
              </div>
            )}
          </div>
        )}

        {/* Level 2: Child Method Execution */}
        {childMethods.map((child) => {
          const childConfig = userConfigs[child.id] || { propagation: 'NONE' };
          const isRequiresNew = childConfig.propagation === 'REQUIRES_NEW';
          const isNested = childConfig.propagation === 'NESTED';

          return (
            <div
              key={child.id}
              onClick={() => onSelectMethod?.(child.id)}
              className={`ml-6 sm:ml-10 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer relative ${
                activeMethodId === child.id
                  ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
              }`}
            >
              <div className="absolute -left-5 top-1/2 -translate-y-1/2 text-slate-400">
                <ArrowDownRight className="w-4 h-4" />
              </div>

              {/* Child Header */}
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                  <span className="text-indigo-600 font-bold">{child.serviceName}.</span>
                  <span>{child.name}()</span>
                  <span
                    className={`text-[10px] font-sans px-2 py-0.5 rounded-full font-bold ${
                      isRequiresNew
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : isNested
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {childConfig.propagation}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {isRequiresNew ? 'Запрос НОВОГО сокета из пула!' : 'В рамках текущего соединения'}
                </span>
              </div>

              {/* Child Physical Connection Bar */}
              <div className="relative h-7 rounded-lg overflow-hidden flex items-center shadow-inner">
                {isRequiresNew ? (
                  <div className="w-full h-full bg-gradient-to-r from-rose-500 to-amber-600 flex items-center justify-between px-3 text-[10px] text-white font-bold border border-rose-600">
                    <div className="flex items-center gap-1.5">
                      <Database className="w-3 h-3" />
                      <span>JDBC Connection #2 (ВТОРОЙ СОКЕТ ИЗ ПУЛА HIKARI)</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-black/25">
                      Независимый Commit/Rollback
                    </span>
                  </div>
                ) : isNested ? (
                  <div className="w-full h-full bg-gradient-to-r from-amber-500 to-yellow-600 flex items-center justify-between px-3 text-[10px] text-white font-bold border border-amber-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rotate-45 bg-white shrink-0" />
                      <span>JDBC Savepoint `sp_loyalty_1` (Одно соединение #1)</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-black/25">
                      Откат только до Savepoint
                    </span>
                  </div>
                ) : childConfig.propagation === 'NONE' ? (
                  <div className="w-full h-full bg-slate-200 flex items-center px-3 text-[10px] text-slate-600 italic">
                    Без транзакции
                  </div>
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-between px-3 text-[10px] text-white font-bold">
                    <div className="flex items-center gap-1.5">
                      <Database className="w-3 h-3" />
                      <span>Участие в родительском Connection #1 (REQUIRED)</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-black/25">
                      Сквозной коммит
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
