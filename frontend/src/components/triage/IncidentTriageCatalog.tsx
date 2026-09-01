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
    fetch('/api/triage/challenges', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setIncidents(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load triage incidents:', err);
        setLoading(false);
      });
  }, []);

  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const filteredIncidents = safeIncidents.filter(inc => {
    const matchesSev = selectedSeverity === 'all' || inc.severity === selectedSeverity;
    const matchesSearch = !searchQuery || 
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSev && matchesSearch;
  });


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка симулятора триажа инцидентов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-20 font-sans">
      {/* Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                🧵 Production Forensics Lab
              </span>
              <span className="text-xs text-pastel-muted font-mono">
                {incidents.length} сценариев аварий JVM & HighLoad
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
              Триаж Прод-Аварий: Дампы, Логи & RCA
            </h1>
            <p className="text-sm text-pastel-muted mt-1 max-w-2xl">
              15 аутентичных расследований аварий: Thread Dumps (Deadlocks, Carrier Pinning), Heap Dumps (Metaspace, ThreadLocal), GC STW-паузы и PostgreSQL Saga Deadlocks.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 pt-5 border-t border-pastel-border/60 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по аварии (например, Deadlock, Loom Pinning, HikariCP, GC, Kafka)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-pastel-bg border border-pastel-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-pastel-text placeholder-pastel-muted/50 focus:outline-none focus:border-pastel-accentRose font-sans transition shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Severity Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x py-1">
        {['all', 'CRITICAL', 'HIGH', 'MEDIUM'].map(sev => (
          <button
            key={sev}
            onClick={() => setSelectedSeverity(sev)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              selectedSeverity === sev
                ? 'bg-white text-pastel-accentRose border border-pastel-accentRose/40 shadow-sm'
                : 'bg-white/70 text-pastel-muted hover:text-pastel-text border border-pastel-border'
            }`}
          >
            {sev === 'all' ? `Все аварии (${incidents.length})` : sev}
          </button>
        ))}
      </div>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredIncidents.map((incident) => {
          const isCrit = incident.severity === 'CRITICAL';
          const isHigh = incident.severity === 'HIGH';

          return (
            <div
              key={incident.id}
              onClick={() => openTriageIncident(incident)}
              className="bg-white/95 border border-pastel-border/80 hover:border-pastel-accentRose/50 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    isCrit 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : isHigh 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {incident.severity}
                  </span>
                  
                  <span className="text-[10px] font-mono text-pastel-muted font-bold flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-slate-500" />
                    <span>{incident.category}</span>
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-base text-pastel-text group-hover:text-pastel-accentRose transition-colors">
                    {incident.title}
                  </h3>
                  <p className="text-xs text-pastel-muted mt-1 line-clamp-2 leading-relaxed">
                    {incident.symptomsMarkdown}
                  </p>
                </div>

                {/* Subsystem & Environment Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
                    Триггер: {incident.keyMetricTrigger}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-pastel-bg text-pastel-muted border border-pastel-border">
                    {incident.category}
                  </span>
                </div>
              </div>


              <div className="mt-5 pt-3 border-t border-pastel-border/60 flex items-center justify-between text-xs font-bold text-pastel-muted group-hover:text-pastel-accentRose transition-colors">
                <span>Начать расследование аварии</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
