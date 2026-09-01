import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ProductionIncident } from '../../types/nextgen';
import { 
  Bug, Search, ShieldAlert, ArrowRight, Activity, 
  Terminal, Cpu, AlertTriangle, Flame
} from 'lucide-react';

export const IncidentTriageCatalog: React.FC = () => {
  const { openTriageIncident } = useAppStore();
  const [incidents, setIncidents] = useState<ProductionIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  useEffect(() => {
    fetch('/api/triage/challenges')
      .then(res => res.json())
      .then(data => {
        setIncidents(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load triage incidents:', err);
        setLoading(false);
      });
  }, []);

  const filteredIncidents = incidents.filter(inc => {
    const matchesSev = selectedSeverity === 'all' || inc.severity === selectedSeverity;
    const matchesSearch = !searchQuery || 
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSev && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка симулятора триажа инцидентов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-20">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                🧵 Production Forensics Lab
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {incidents.length} сценариев аварий JVM & HighLoad
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Триаж Прод-Аварий: Дампы, Логи & RCA
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              15 аутентичных расследований аварий: Thread Dumps (Deadlocks, Carrier Pinning), Heap Dumps (Metaspace, ThreadLocal), GC STW-паузы и PostgreSQL Saga Deadlocks.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по аварии (например, Deadlock, Loom Pinning, HikariCP, GC, Kafka)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 font-mono transition"
            />
          </div>

          <div className="flex items-center gap-2">
            {['all', 'CRITICAL', 'HIGH'].map(sev => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer shrink-0 ${
                  selectedSeverity === sev
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {sev === 'all' ? 'Все уровни' : sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIncidents.map(inc => (
          <div
            key={inc.id}
            onClick={() => openTriageIncident(inc)}
            className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-lg hover:shadow-amber-500/5 relative"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  {inc.category}
                </span>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border uppercase flex items-center gap-1 ${
                  inc.severity === 'CRITICAL'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <Flame className="w-3 h-3" />
                  <span>{inc.severity}</span>
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition line-clamp-2">
                {inc.title}
              </h3>

              <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                {inc.symptomsMarkdown}
              </p>

              {/* Metric Trigger Pill */}
              <div className="mt-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{inc.keyMetricTrigger}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] flex items-center gap-1.5 text-amber-400 font-bold group-hover:translate-x-0.5 transition">
                <span>Открыть консоль расследования</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
