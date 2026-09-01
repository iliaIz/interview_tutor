import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignScenario } from '../../types/nextgen';
import { 
  Layers, Search, Filter, Database, Server, 
  ArrowRight, ShieldCheck, Cpu, Zap, Activity
} from 'lucide-react';

export const SystemDesignCatalog: React.FC = () => {
  const { openSystemDesignScenario } = useAppStore();
  const [scenarios, setScenarios] = useState<SystemDesignScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetch('/api/system-design/scenarios')
      .then(res => res.json())
      .then(data => {
        setScenarios(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load system design scenarios:', err);
        setLoading(false);
      });
  }, []);

  const categories = ['all', ...Array.from(new Set(scenarios.map(s => s.category)))];

  const filteredScenarios = scenarios.filter(s => {
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка каталога System Design...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-20">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                🏛️ High-Level Design Studio
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {scenarios.length} сценариев BigTech
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              System Design & Архитектура Высоких Нагрузок
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              20 эталонных сценариев онсайтов в Яндекс, Т-Банк, Stripe, Uber: расчеты Back-of-the-Envelope, живые топологии Mermaid, разбор узких мест и сократический Staff AI.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по названию, стеку или домену (например, Payment, Kafka, Geo)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pastel-accentRose/60 font-mono transition"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x py-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              selectedCategory === cat
                ? 'bg-slate-800 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat === 'all' ? `Все сценарии (${scenarios.length})` : cat}
          </button>
        ))}
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScenarios.map(sc => (
          <div
            key={sc.id}
            onClick={() => openSystemDesignScenario(sc)}
            className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-lg hover:shadow-blue-500/5 relative"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {sc.category}
                </span>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                  {sc.difficulty}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition line-clamp-2">
                {sc.title}
              </h3>

              <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                {sc.contextMarkdown}
              </p>

              {/* Traffic Snapshot */}
              {sc.trafficProfile && (
                <div className="mt-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>⚡ Пиковый RPS:</span>
                    <span className="text-slate-200 font-bold">{sc.trafficProfile.estimatedPeakRPS}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>👥 Аудитория DAU:</span>
                    <span className="text-slate-200">{sc.trafficProfile.targetDAU}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] flex items-center gap-1.5 text-blue-400 font-bold group-hover:translate-x-0.5 transition">
                <span>Перейти к проектированию</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
