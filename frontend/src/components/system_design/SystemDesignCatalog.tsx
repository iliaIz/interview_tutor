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
    fetch('/api/system-design/scenarios', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setScenarios(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load system design scenarios:', err);
        setLoading(false);
      });
  }, []);

  const safeScenarios = Array.isArray(scenarios) ? scenarios : [];
  const categories = ['all', ...Array.from(new Set(safeScenarios.map(s => s.category)))];

  const filteredScenarios = safeScenarios.filter(s => {
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка каталога System Design...</p>
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
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-pastel-accentViolet border border-purple-200">
                🏛️ High-Level Design Studio
              </span>
              <span className="text-xs text-pastel-muted font-mono">
                {scenarios.length} сценариев BigTech
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
              System Design & Архитектура Высоких Нагрузок
            </h1>
            <p className="text-sm text-pastel-muted mt-1 max-w-2xl">
              20 эталонных сценариев онсайтов в Яндекс, Т-Банк, Stripe, Uber: расчеты Back-of-the-Envelope, живые топологии Mermaid, разбор узких мест и сократический Staff AI.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 pt-5 border-t border-pastel-border/60 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по названию, стеку или домену (например, Payment, Kafka, Geo)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-pastel-bg border border-pastel-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-pastel-text placeholder-pastel-muted/50 focus:outline-none focus:border-pastel-accentRose font-sans transition shadow-2xs"
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
                ? 'bg-white text-pastel-accentRose border border-pastel-accentRose/40 shadow-sm'
                : 'bg-white/70 text-pastel-muted hover:text-pastel-text border border-pastel-border'
            }`}
          >
            {cat === 'all' ? `Все сценарии (${scenarios.length})` : cat}
          </button>
        ))}
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredScenarios.map((scenario) => (
          <div
            key={scenario.id}
            onClick={() => openSystemDesignScenario(scenario)}
            className="bg-white/95 border border-pastel-border/80 hover:border-pastel-accentRose/50 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30">
                  {scenario.category}
                </span>
                <span className="text-[10px] font-mono text-pastel-muted font-bold flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-600" />
                  {scenario.trafficProfile.estimatedPeakRPS}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-base text-pastel-text group-hover:text-pastel-accentRose transition-colors">
                  {scenario.title}
                </h3>
                <p className="text-xs text-pastel-muted mt-1 line-clamp-2 leading-relaxed">
                  {scenario.contextMarkdown}
                </p>
              </div>

              {/* SLA & Scale Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                  SLA: {scenario.trafficProfile.slaAvailability}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-pastel-accentViolet border border-purple-200">
                  DAU: {scenario.trafficProfile.targetDAU}
                </span>
              </div>

            </div>

            <div className="mt-5 pt-3 border-t border-pastel-border/60 flex items-center justify-between text-xs font-bold text-pastel-muted group-hover:text-pastel-accentRose transition-colors">
              <span>Открыть архитектурную арену</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
