import React from 'react';
import { 
  Flame, 
  RotateCcw, 
  Database, 
  WifiOff, 
  Clock, 
  Zap, 
  ShieldAlert 
} from 'lucide-react';
import { ChaosEventType, ChaosState } from '../../../../types/systemDesignCanvas';

interface ChaosMonkeyPanelProps {
  chaosState: ChaosState;
  onTriggerChaos: (type: ChaosEventType, targetNodeId?: string) => void;
}

export const ChaosMonkeyPanel: React.FC<ChaosMonkeyPanelProps> = ({
  chaosState,
  onTriggerChaos
}) => {
  const isChaosActive = Boolean(chaosState.activeChaos);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 flex items-center gap-2 select-none">
      <div className="flex items-center gap-1.5 px-2 py-1 text-rose-500 font-semibold text-xs border-r border-slate-200 dark:border-slate-800">
        <Flame className="w-4 h-4" />
        <span>Chaos Monkey</span>
      </div>

      {/* Chaos Actions */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onTriggerChaos('kill_primary')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            chaosState.activeChaos === 'kill_primary'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
          }`}
          title="Смоделировать падение мастера PostgreSQL и 12-секундный failover Patroni"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Убить Master DB</span>
        </button>

        <button
          type="button"
          onClick={() => onTriggerChaos('latency_spike')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            chaosState.activeChaos === 'latency_spike'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600'
          }`}
          title="Всплеск задержки downstream сервиса до 5,000мс (проверка Circuit Breaker)"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Задержка +5 сек</span>
        </button>

        <button
          type="button"
          onClick={() => onTriggerChaos('network_partition')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            chaosState.activeChaos === 'network_partition'
              ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600'
          }`}
          title="Разрыв сетевого линка между датацентрами"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Network Partition</span>
        </button>

        <button
          type="button"
          onClick={() => onTriggerChaos('black_friday')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            chaosState.activeChaos === 'black_friday'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600'
          }`}
          title="Скачок входящего трафика в 10 раз"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Black Friday (10x)</span>
        </button>
      </div>

      {/* Active Chaos Indicator & Reset */}
      {isChaosActive && (
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-mono font-medium text-rose-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>{chaosState.remainingSeconds}с</span>
          </div>

          {chaosState.circuitBreakerState && (
            <div className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              chaosState.circuitBreakerState === 'OPEN'
                ? 'bg-rose-500/20 text-rose-600 border-rose-500/40'
                : chaosState.circuitBreakerState === 'HALF_OPEN'
                ? 'bg-amber-500/20 text-amber-600 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40'
            }`}>
              <ShieldAlert className="w-3 h-3" />
              <span>CB: {chaosState.circuitBreakerState}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onTriggerChaos('reset_chaos')}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 transition-all"
            title="Остановить хаос"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
