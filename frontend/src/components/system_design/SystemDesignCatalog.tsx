import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignScenario } from '../../types/nextgen';
import { 
  Layers, Search, Filter, Database, Server, 
  ArrowRight, ShieldCheck, Cpu, Zap, Activity,
  Award, Clock, MessageSquare, ShieldAlert, CheckCircle2, Play,
  Calculator, X
} from 'lucide-react';
import { CapacityMathCoach } from './CapacityMathCoach';
import { MicroKataArena } from './katas/MicroKataArena';
import { MICRO_KATAS, MicroKata } from './katas/MicroKatasCatalog';
import { FadedScaffoldingArena } from './scaffolding/FadedScaffoldingArena';
import { FADED_ARCHETYPES, FadedArchetype } from './scaffolding/FadedScaffoldingCatalog';

export const SystemDesignCatalog: React.FC = () => {
  const { openSystemDesignScenario } = useAppStore();
  const [scenarios, setScenarios] = useState<SystemDesignScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'L0' | 'L2' | 'L3'>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isMathCoachOpen, setIsMathCoachOpen] = useState(false);
  const [activeMicroKataId, setActiveMicroKataId] = useState<string | null>(null);
  const [activeFadedArchetypeId, setActiveFadedArchetypeId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/system-design/scenarios', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setScenarios(data);
          if (data.length > 0 && !selectedScenarioId) {
            setSelectedScenarioId(data[0].id);
          }
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

  const filteredScenarios = useMemo(() => {
    return safeScenarios.filter(s => {
      const matchesLevel = selectedLevel === 'all' || s.level === selectedLevel;
      const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() || 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contextMarkdown.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLevel && matchesCat && matchesSearch;
    });
  }, [safeScenarios, selectedLevel, selectedCategory, searchQuery]);

  // Keep selectedScenarioId valid
  useEffect(() => {
    if (filteredScenarios.length > 0) {
      if (!selectedScenarioId || !filteredScenarios.some(s => s.id === selectedScenarioId)) {
        setSelectedScenarioId(filteredScenarios[0].id);
      }
    }
  }, [filteredScenarios, selectedScenarioId]);

  const activeScenario = useMemo(() => {
    return safeScenarios.find(s => s.id === selectedScenarioId) || filteredScenarios[0] || null;
  }, [safeScenarios, selectedScenarioId, filteredScenarios]);

  const filteredMicroKatas = useMemo(() => {
    if (!searchQuery.trim()) return MICRO_KATAS;
    const q = searchQuery.toLowerCase();
    return MICRO_KATAS.filter((k: MicroKata) => 
      k.title.toLowerCase().includes(q) ||
      k.subtitle.toLowerCase().includes(q) ||
      k.category.toLowerCase().includes(q) ||
      k.hardInvariantText.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredFadedArchetypes = useMemo(() => {
    if (!searchQuery.trim()) return FADED_ARCHETYPES;
    const q = searchQuery.toLowerCase();
    return FADED_ARCHETYPES.filter((a: FadedArchetype) => 
      a.title.toLowerCase().includes(q) ||
      a.subtitle.toLowerCase().includes(q) ||
      a.affectedDomain.toLowerCase().includes(q) ||
      a.diagnosisMarkdown.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      return;
    }

    if (filteredScenarios.length === 0) return;

    const currentIndex = filteredScenarios.findIndex(s => s.id === selectedScenarioId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(currentIndex + 1, filteredScenarios.length - 1);
      setSelectedScenarioId(filteredScenarios[nextIdx].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(currentIndex - 1, 0);
      setSelectedScenarioId(filteredScenarios[prevIdx].id);
    } else if (e.key === 'Enter' && activeScenario) {
      e.preventDefault();
      openSystemDesignScenario(activeScenario);
    }
  }, [filteredScenarios, selectedScenarioId, activeScenario, openSystemDesignScenario]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка каталога System Design...</p>
        </div>
      </div>
    );
  }

  if (activeMicroKataId) {
    return <MicroKataArena initialKataId={activeMicroKataId} onBack={() => setActiveMicroKataId(null)} />;
  }

  if (activeFadedArchetypeId) {
    return <FadedScaffoldingArena initialArchetypeId={activeFadedArchetypeId} onBack={() => setActiveFadedArchetypeId(null)} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 font-sans animate-fade-in pb-24">
      {/* 1. Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-pastel-accentViolet border border-purple-200">
                🏛️ High-Level Design Studio
              </span>
              <span className="text-xs text-pastel-muted font-mono font-bold">
                {scenarios.length} сценариев BigTech
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
              System Design & Архитектура Высоких Нагрузок
            </h1>
            <p className="text-xs sm:text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
              20 эталонных сценариев онсайтов в Яндекс, Т-Банк, Stripe, Uber: расчеты Back-of-the-Envelope, топологии Mermaid, разбор узких мест и сократический Staff AI.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-pastel-bg border border-pastel-border text-xs text-pastel-muted font-mono shrink-0">
            <span>Навигация:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↓</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">Enter</kbd>
          </div>
        </div>

        {/* Cognitive Ladder (L0 -> L1 -> L2 -> L3) */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 text-xs">
          <button
            type="button"
            onClick={() => setSelectedLevel('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              selectedLevel === 'all'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Все уровни ({scenarios.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedLevel('L0')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedLevel === 'L0'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>L0: Micro-Katas ({MICRO_KATAS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMathCoachOpen(true)}
            className="px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-2xs active:scale-95"
            title="Открыть тренажер прикидок на салфетке (Back-of-the-Envelope)"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>🧮 L1: Math Coach (Тренажер)</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedLevel('L2')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedLevel === 'L2'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>L2: Faded Scaffolding ({FADED_ARCHETYPES.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedLevel('L3')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedLevel === 'L3'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-violet-700 hover:bg-violet-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span>L3: Combat Arenas ({scenarios.length})</span>
          </button>
        </div>

        {/* 2. Search & Category Filters */}
        <div className="mt-3 pt-3 border-t border-pastel-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar touch-pan-x">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-pastel-text text-white shadow-xs'
                    : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                }`}
              >
                {cat === 'all' ? `Все сценарии (${scenarios.length})` : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по сценариям, RPS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:border-pastel-accentRose transition"
            />
          </div>
        </div>
      </div>

      {/* 3. COGNITIVE LEVEL VIEWS (SOTA 2026) */}
      {selectedLevel === 'L0' ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4">
            <div>
              <h2 className="text-base font-bold text-emerald-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Level 0: Алгоритмические Микро-Каты (In-Memory Core Primitives)</span>
              </h2>
              <p className="text-xs text-emerald-800/80 mt-0.5 leading-relaxed">
                8 фундаментальных распределенных примитивов с точными формулами, AssertJ assertions и интерактивными ползунками.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-white text-emerald-800 border border-emerald-200 font-bold shrink-0 self-start sm:self-auto shadow-2xs">
              {filteredMicroKatas.length} из 8 доступно
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMicroKatas.map((kata: MicroKata) => (
              <div 
                key={kata.id}
                className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3.5 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                      {kata.category}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {kata.difficulty} • #{kata.number}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-pastel-text group-hover:text-emerald-800 transition-colors">
                    {kata.title}
                  </h3>

                  <p className="text-xs text-pastel-muted leading-relaxed line-clamp-2">
                    {kata.subtitle}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 font-mono text-[11px] text-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Инвариант / Ограничение:</span>
                    <span className="font-semibold text-emerald-900 line-clamp-2">{kata.hardInvariantText}</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveMicroKataId(kata.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Запустить интерактивную кату</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : selectedLevel === 'L2' ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4">
            <div>
              <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Level 2: Faded Scaffolding (Инженерная починка сломанных топологий)</span>
              </h2>
              <p className="text-xs text-amber-800/80 mt-0.5 leading-relaxed">
                5 реальных инцидентов BigTech с падающими метриками и задержками. Исправьте схему на холсте, чтобы восстановить SLA.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-white text-amber-800 border border-amber-200 font-bold shrink-0 self-start sm:self-auto shadow-2xs">
              {filteredFadedArchetypes.length} из 5 доступно
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFadedArchetypes.map((arch: FadedArchetype) => (
              <div 
                key={arch.id}
                className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between space-y-3.5 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                      {arch.affectedDomain}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-rose-600">
                      {arch.incidentSeverity} • #{arch.number}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-pastel-text group-hover:text-amber-900 transition-colors">
                    {arch.title}
                  </h3>

                  <p className="text-xs text-pastel-muted leading-relaxed line-clamp-2">
                    {arch.subtitle}
                  </p>

                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 font-mono text-[11px] text-rose-800">
                    <span className="text-[10px] text-rose-500 block uppercase font-bold">Симптомы аварии:</span>
                    <span className="font-semibold">
                      {Object.entries(arch.simulatedFailureMetrics).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveFadedArchetypeId(arch.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Перейти в Scaffolding Arena & Устранить сбой</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : filteredScenarios.length === 0 ? (
        <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-12 text-center shadow-xs space-y-3 animate-fade-in">
          <Layers className="w-10 h-10 text-pastel-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-pastel-text">Сценарии не найдены</h3>
          <p className="text-xs text-pastel-muted max-w-sm mx-auto leading-relaxed">
            По запросу «<strong className="text-pastel-text">{searchQuery || selectedCategory}</strong>» ничего не найдено в каталоге архитектурных кейсов.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 rounded-xl bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRoseText text-xs font-bold border border-pastel-border transition cursor-pointer"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Master Scenarios List (5 cols / 42%) */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[750px] overflow-y-auto pr-1 no-scrollbar">
          {filteredScenarios.map((scenario) => {
            const isSelected = selectedScenarioId === scenario.id;

            return (
              <div
                key={scenario.id}
                onClick={() => setSelectedScenarioId(scenario.id)}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative select-none ${
                  isSelected
                    ? 'bg-white border-purple-400 shadow-sm ring-2 ring-purple-300/40'
                    : 'bg-white/80 hover:bg-white border-pastel-border/80 hover:border-purple-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                        scenario.level === 'L0'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : scenario.level === 'L2'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-purple-100 text-purple-800 border-purple-200'
                      }`}>
                        {scenario.level || 'L3'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-purple-50 text-pastel-accentViolet border border-purple-200/80 truncate">
                        {scenario.category}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1 shrink-0">
                      <Activity className="w-3 h-3 text-emerald-600" />
                      {scenario.trafficProfile.estimatedPeakRPS}
                    </span>
                  </div>

                  <h3 className={`font-bold text-xs sm:text-sm transition-colors ${isSelected ? 'text-purple-900' : 'text-pastel-text'}`}>
                    {scenario.title}
                  </h3>

                  <p className="text-xs text-pastel-muted line-clamp-2 mt-1 leading-snug">
                    {scenario.contextMarkdown.replace(/\\_/g, '_')}
                  </p>
                </div>

                {/* Footer SLA chips */}
                <div className="flex items-center justify-between pt-2 border-t border-pastel-border/50 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-pastel-muted text-[10px]">
                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                      SLA {scenario.trafficProfile.slaAvailability}
                    </span>
                    <span className="bg-pastel-bg text-pastel-text px-1.5 py-0.2 rounded border border-pastel-border">
                      DAU {scenario.trafficProfile.targetDAU}
                    </span>
                  </div>

                  <span className="font-bold text-pastel-accentViolet flex items-center gap-0.5 text-[10px]">
                    <span>Обзор</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Live Blueprint Inspector / Passport (7 cols / 58%) */}
        {activeScenario && (
          <div className="lg:col-span-7 bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 sticky top-20 self-start">
            {/* Header with Title & Category */}
            <div className="space-y-2 pb-4 border-b border-pastel-border/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-pastel-accentViolet border border-purple-200">
                  {activeScenario.category}
                </span>

                <span className="text-xs font-mono font-bold text-emerald-700 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  Целевой SLA: {activeScenario.trafficProfile.slaAvailability}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-pastel-text tracking-tight">
                {activeScenario.title}
              </h2>

              <p className="text-xs sm:text-sm text-pastel-muted leading-relaxed">
                {activeScenario.contextMarkdown.replace(/\\_/g, '_')}
              </p>
            </div>

            {/* Traffic Profile & SLA Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-pastel-text uppercase tracking-wider block">
                📊 Профиль Нагрузки & Архитектурные Требования:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                  <span className="text-pastel-muted block text-[10px]">Аудитория DAU</span>
                  <span className="font-bold text-pastel-text text-[11px] mt-0.5 block">{activeScenario.trafficProfile.targetDAU}</span>
                </div>
                <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                  <span className="text-pastel-muted block text-[10px]">Пиковый RPS</span>
                  <span className="font-bold text-blue-600 text-[11px] mt-0.5 block">{activeScenario.trafficProfile.estimatedPeakRPS}</span>
                </div>
                <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                  <span className="text-pastel-muted block text-[10px]">Хранение</span>
                  <span className="font-bold text-pastel-text text-[11px] mt-0.5 block">{activeScenario.trafficProfile.dailyStorageGrowth}</span>
                </div>
                <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                  <span className="text-pastel-muted block text-[10px]">Целевой SLA</span>
                  <span className="font-bold text-emerald-600 text-[11px] mt-0.5 block">{activeScenario.trafficProfile.slaAvailability}</span>
                </div>
              </div>
            </div>

            {/* Critical Pitfalls & SPOF Analysis */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/70 to-pastel-bg border border-amber-200/80 space-y-1.5 text-xs">
              <h4 className="font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Зоны системных сбоев (SPOF, Dual-Write, Backpressure)</span>
              </h4>
              <p className="text-slate-700 leading-relaxed font-sans line-clamp-3">
                {activeScenario.bottlenecksMarkdown.replace(/\\_/g, '_')}
              </p>
            </div>

            {/* Staff AI Teaser */}
            <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200/60 flex items-center gap-3 text-xs">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-pastel-accentViolet text-white flex items-center justify-center shrink-0 shadow-2xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-purple-950 block text-[11px]">Сократический Staff AI-интервьюер готов к сессии</span>
                <p className="text-purple-900/80 text-[11px] truncate">Анализ топологии Mermaid, расчеты Back-of-the-Envelope и защита архитектуры</p>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                onClick={() => openSystemDesignScenario(activeScenario)}
                className="w-full py-3 px-5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Открыть архитектурную арену (Enter)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )}

      {/* L1 Math Coach Modal Overlay */}
      {isMathCoachOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] overflow-y-auto">
            <div className="sticky top-4 right-4 z-10 flex justify-end pr-4 pt-2">
              <button
                type="button"
                onClick={() => setIsMathCoachOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-sm"
                title="Закрыть (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4">
              <CapacityMathCoach />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
