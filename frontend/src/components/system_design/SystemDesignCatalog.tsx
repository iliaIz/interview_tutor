import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignScenario } from '../../types/nextgen';
import { 
  Layers, Search, Filter, Database, Server, 
  ArrowRight, ShieldCheck, Cpu, Zap, Activity,
  Award, Clock, MessageSquare, ShieldAlert, CheckCircle2, Play,
  Calculator, X, Terminal, Radio, Sparkles
} from 'lucide-react';
import { CapacityMathCoach } from './CapacityMathCoach';

type LevelFilter = 'all' | 'L3' | 'L4' | 'L5_L7';

export const SystemDesignCatalog: React.FC = () => {
  const { openSystemDesignById, openSystemDesignScenario } = useAppStore();
  const [scenarios, setScenarios] = useState<SystemDesignScenario[]>([]);
  const [loading, setLoading] = useState(true);

  // Read initial deep-link query parameters
  const initialParams = useMemo(() => {
    if (typeof window === 'undefined') return { level: 'all' as LevelFilter, scenario: null };
    const params = new URLSearchParams(window.location.search);
    const rawLevel = params.get('level');
    const level: LevelFilter = (rawLevel === 'L3' || rawLevel === 'L4' || rawLevel === 'L5_L7' || rawLevel === 'all') 
      ? rawLevel 
      : 'all';
    return {
      level,
      scenario: params.get('scenario')
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<LevelFilter>(initialParams.level);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(initialParams.scenario);
  const [isMathCoachOpen, setIsMathCoachOpen] = useState(false);

  // Sync state changes to URL query parameters for deep linking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    
    if (selectedLevel !== 'all') {
      params.set('level', selectedLevel);
    } else {
      params.delete('level');
    }

    if (selectedScenarioId) {
      params.set('scenario', selectedScenarioId);
    } else {
      params.delete('scenario');
    }

    const newQuery = params.toString();
    const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [selectedLevel, selectedScenarioId]);

  // Load scenarios from SSOT canonical manifests
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
            setSelectedScenarioId(data[0].canonical_id || data[0].id || null);
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
  const categories = useMemo(() => {
    const cats = new Set<string>();
    safeScenarios.forEach(s => {
      if (s.archetype) cats.add(s.archetype);
      else if (s.category) cats.add(s.category);
    });
    return ['all', ...Array.from(cats)];
  }, [safeScenarios]);

  const levelCounts = useMemo(() => {
    return {
      all: safeScenarios.length,
      L3: safeScenarios.filter(s => s.target_level === 'L3_JUNIOR').length,
      L4: safeScenarios.filter(s => s.target_level === 'L4_MIDDLE').length,
      L5_L7: safeScenarios.filter(s => ['L5_SENIOR', 'L6_STAFF', 'L7_PRINCIPAL'].includes(s.target_level || '')).length,
    };
  }, [safeScenarios]);

  const filteredScenarios = useMemo(() => {
    return safeScenarios.filter(s => {
      // Level filter (strict target_level match)
      let matchesLevel = true;
      if (selectedLevel === 'L3') {
        matchesLevel = s.target_level === 'L3_JUNIOR';
      } else if (selectedLevel === 'L4') {
        matchesLevel = s.target_level === 'L4_MIDDLE';
      } else if (selectedLevel === 'L5_L7') {
        matchesLevel = ['L5_SENIOR', 'L6_STAFF', 'L7_PRINCIPAL'].includes(s.target_level || '');
      }

      // Category filter
      const matchesCat = selectedCategory === 'all' || s.archetype === selectedCategory || s.category === selectedCategory;

      // Search filter
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        s.title.toLowerCase().includes(q) ||
        (s.subtitle || '').toLowerCase().includes(q) ||
        (s.archetype || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.canonical_id || s.id || '').toLowerCase().includes(q) ||
        (s.problem_statement || s.contextMarkdown || '').toLowerCase().includes(q);

      return matchesLevel && matchesCat && matchesSearch;
    });
  }, [safeScenarios, selectedLevel, selectedCategory, searchQuery]);

  // Keep selectedScenarioId valid
  useEffect(() => {
    if (filteredScenarios.length > 0) {
      if (!selectedScenarioId || !filteredScenarios.some(s => (s.canonical_id || s.id) === selectedScenarioId)) {
        setSelectedScenarioId(filteredScenarios[0].canonical_id || filteredScenarios[0].id || null);
      }
    }
  }, [filteredScenarios, selectedScenarioId]);

  const activeScenario = useMemo(() => {
    return safeScenarios.find(s => (s.canonical_id || s.id) === selectedScenarioId) || filteredScenarios[0] || null;
  }, [safeScenarios, selectedScenarioId, filteredScenarios]);

  const handleLaunchScenario = useCallback((scenario: SystemDesignScenario) => {
    const id = scenario.canonical_id || scenario.id;
    if (id) {
      void openSystemDesignById(id);
    } else {
      openSystemDesignScenario(scenario);
    }
  }, [openSystemDesignById, openSystemDesignScenario]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      return;
    }

    if (filteredScenarios.length === 0) return;

    const currentIndex = filteredScenarios.findIndex(s => (s.canonical_id || s.id) === selectedScenarioId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(currentIndex + 1, filteredScenarios.length - 1);
      setSelectedScenarioId(filteredScenarios[nextIdx].canonical_id || filteredScenarios[nextIdx].id || null);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(currentIndex - 1, 0);
      setSelectedScenarioId(filteredScenarios[prevIdx].canonical_id || filteredScenarios[prevIdx].id || null);
    } else if (e.key === 'Enter' && activeScenario) {
      e.preventDefault();
      handleLaunchScenario(activeScenario);
    }
  }, [filteredScenarios, selectedScenarioId, activeScenario, handleLaunchScenario]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getLevelBadge = (level?: string) => {
    switch (level) {
      case 'L3_JUNIOR':
      case 'L0':
        return { label: 'L3 Junior', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'L4_MIDDLE':
      case 'L2':
        return { label: 'L4 Middle', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'L5_SENIOR':
        return { label: 'L5 Senior', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'L6_STAFF':
        return { label: 'L6 Staff', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'L7_PRINCIPAL':
        return { label: 'L7 Principal', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      default:
        return { label: level || 'L5', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const getPedagogicalModeBadge = (mode?: string) => {
    switch (mode) {
      case 'WORKED_EXAMPLE':
        return { label: '🎯 Разбор (Studio 1+2)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'FADED_COMPLETION':
        return { label: '🔧 Починка (Studio 2)', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'INDEPENDENT_DESIGN':
      default:
        return { label: '🏛️ Дизайн (Studio 2+3)', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка канонических манифестов System Design (SSOT)...</p>
        </div>
      </div>
    );
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
                🏛️ Multi-Scale Capability Arena (MSCA)
              </span>
              <span className="text-xs text-pastel-muted font-mono font-bold">
                {scenarios.length} канонических сценариев BigTech
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
              System Design & Архитектура Высоких Нагрузок
            </h1>
            <p className="text-xs sm:text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
              Единый SSOT-каталог: алгоритмические микро-каты (L3), инженерная починка сбоев (L4), комбат-арены распределенных систем (L5–L7) с симулятором нагрузки и защитой перед Staff Bar-Raiser.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsMathCoachOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xs hover:shadow-md transition active:scale-95 cursor-pointer"
              title="Открыть интерактивный тренажер Back-of-the-Envelope расчетов емкости"
            >
              <Calculator className="w-4 h-4" />
              <span>🧮 Math Coach: Расчеты на салфетке</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-md font-mono">10 кейсов</span>
            </button>

            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-pastel-bg border border-pastel-border text-xs text-pastel-muted font-mono shrink-0">
              <span>Навигация:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↓</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">Enter</kbd>
            </div>
          </div>
        </div>

        {/* Cognitive Ladder (Clean Level Taxonomy with Live Counters) */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 text-xs">
          <button
            type="button"
            onClick={() => setSelectedLevel('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedLevel === 'all'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Все сценарии</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedLevel === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/60 text-slate-600'
            }`}>
              {levelCounts.all}
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => setSelectedLevel('L3')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedLevel === 'L3'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>L3: Микро-примитивы</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedLevel === 'L3' ? 'bg-emerald-700/80 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {levelCounts.L3}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLevel('L4')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedLevel === 'L4'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>L4: Устранение сбоев</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedLevel === 'L4' ? 'bg-amber-700/80 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {levelCounts.L4}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLevel('L5_L7')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedLevel === 'L5_L7'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-violet-700 hover:bg-violet-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span>L5–L7: Combat Arenas (Senior & Staff)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedLevel === 'L5_L7' ? 'bg-violet-700/80 text-white' : 'bg-violet-100 text-violet-800'
            }`}>
              {levelCounts.L5_L7}
            </span>
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
                {cat === 'all' ? `Все архетипы (${scenarios.length})` : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по задачам, RPS, Kafka, Raft..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:border-pastel-accentRose transition"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Master-Detail Grid */}
      {filteredScenarios.length === 0 ? (
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
                setSelectedLevel('all');
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
          <div className="lg:col-span-5 space-y-2.5 max-h-[780px] overflow-y-auto pr-1 no-scrollbar">
            {filteredScenarios.map((scenario) => {
              const id = scenario.canonical_id || scenario.id || '';
              const isSelected = selectedScenarioId === id;
              const levelBadge = getLevelBadge(scenario.target_level || scenario.level);
              const modeBadge = getPedagogicalModeBadge(scenario.pedagogical_mode);

              const peakRps = scenario.studio_2_simulation?.traffic_profile?.lambda_mean_rps 
                ? `${scenario.studio_2_simulation.traffic_profile.lambda_mean_rps.toLocaleString()} RPS` 
                : (scenario.trafficProfile?.estimatedPeakRPS || 'N/A');

              const sla = scenario.studio_2_simulation?.slos?.availability_target_nines 
                ? `${scenario.studio_2_simulation.slos.availability_target_nines}%` 
                : (scenario.trafficProfile?.slaAvailability || '99.99%');

              const p99 = scenario.studio_2_simulation?.slos?.p99_latency_max_ms
                ? `p99 ≤ ${scenario.studio_2_simulation.slos.p99_latency_max_ms}мс`
                : 'SLA p99';

              return (
                <div
                  key={id}
                  onClick={() => setSelectedScenarioId(id)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative select-none ${
                    isSelected
                      ? 'bg-white border-purple-400 shadow-sm ring-2 ring-purple-300/40'
                      : 'bg-white/80 hover:bg-white border-pastel-border/80 hover:border-purple-300 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${levelBadge.bg}`}>
                          {levelBadge.label}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border truncate ${modeBadge.bg}`}>
                          {modeBadge.label}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1 shrink-0">
                        <Activity className="w-3 h-3 text-emerald-600" />
                        {peakRps}
                      </span>
                    </div>

                    <h3 className={`font-bold text-xs sm:text-sm transition-colors ${isSelected ? 'text-purple-900' : 'text-pastel-text'}`}>
                      {scenario.title}
                    </h3>

                    <p className="text-xs text-pastel-muted line-clamp-2 mt-1 leading-snug">
                      {(scenario.subtitle || scenario.problem_statement || scenario.contextMarkdown || '').replace(/\\_/g, '_')}
                    </p>
                  </div>

                  {/* Footer SLA chips */}
                  <div className="flex items-center justify-between pt-2 border-t border-pastel-border/50 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-pastel-muted text-[10px]">
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                        SLA {sla}
                      </span>
                      <span className="bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                        {p99}
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
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${getLevelBadge(activeScenario.target_level).bg}`}>
                      {getLevelBadge(activeScenario.target_level).label}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-pastel-accentViolet border border-purple-200">
                      {activeScenario.archetype || activeScenario.category || 'Distributed Systems'}
                    </span>
                  </div>

                  <span className="text-xs font-mono font-bold text-emerald-700 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    SLA: {activeScenario.studio_2_simulation?.slos?.availability_target_nines || 99.99}%
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-pastel-text tracking-tight">
                  {activeScenario.title}
                </h2>

                {activeScenario.subtitle && (
                  <p className="text-xs font-semibold text-purple-800">
                    {activeScenario.subtitle}
                  </p>
                )}

                <p className="text-xs sm:text-sm text-pastel-muted leading-relaxed">
                  {(activeScenario.problem_statement || activeScenario.contextMarkdown || '').replace(/\\_/g, '_')}
                </p>
              </div>

              {/* Traffic Profile & SLA Grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-pastel-text uppercase tracking-wider block">
                  📊 Профиль Нагрузки & Архитектурные Требования:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Входящий RPS</span>
                    <span className="font-bold text-blue-600 text-[11px] mt-0.5 block">
                      {activeScenario.studio_2_simulation?.traffic_profile?.lambda_mean_rps 
                        ? `${activeScenario.studio_2_simulation.traffic_profile.lambda_mean_rps.toLocaleString()}` 
                        : (activeScenario.trafficProfile?.estimatedPeakRPS || 'N/A')}
                    </span>
                  </div>
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Целевой p99</span>
                    <span className="font-bold text-emerald-600 text-[11px] mt-0.5 block">
                      {activeScenario.studio_2_simulation?.slos?.p99_latency_max_ms 
                        ? `≤ ${activeScenario.studio_2_simulation.slos.p99_latency_max_ms} мс` 
                        : '≤ 50 мс'}
                    </span>
                  </div>
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Паттерн</span>
                    <span className="font-bold text-pastel-text text-[11px] mt-0.5 block">
                      {activeScenario.studio_2_simulation?.traffic_profile?.pattern || 'POISSON'}
                    </span>
                  </div>
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Бюджет в месяц</span>
                    <span className="font-bold text-pastel-accentViolet text-[11px] mt-0.5 block">
                      {activeScenario.studio_2_simulation?.slos?.monthly_budget_max_usd 
                        ? `$${activeScenario.studio_2_simulation.slos.monthly_budget_max_usd.toLocaleString()}` 
                        : 'SLA'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Scale Studios Supported Indicators */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-pastel-text uppercase tracking-wider block">
                  🛠️ Доступные Режимы в MultiScaleCanvasHub:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    activeScenario.studio_1_runtime 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                  }`}>
                    <Terminal className="w-3.5 h-3.5 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">Студия 1: Runtime</span>
                      <span className="text-[10px]">{activeScenario.studio_1_runtime ? 'Forensics & Java 21' : 'Не требуется'}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border bg-blue-50 border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">Студия 2: Topology</span>
                      <span className="text-[10px]">DES Simulation & Invariants</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border bg-purple-50 border-purple-200 text-purple-900 text-xs flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">Студия 3: Defense</span>
                      <span className="text-[10px]">Voice Bar-Raiser</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleLaunchScenario(activeScenario)}
                  className="w-full py-3 px-5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Открыть Multi-Scale Studio (Enter)</span>
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
