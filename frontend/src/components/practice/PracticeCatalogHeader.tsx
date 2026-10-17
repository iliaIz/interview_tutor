import React from 'react';
import { ChallengeCategory } from '../../types/practice';
import {
  CATEGORIES,
  TESTING_ARCHETYPES,
  REFACTORING_ARCHETYPES,
  StatusFilter
} from './PracticeCatalogConstants';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Database,
  Bug,
  Code2,
  Sparkles
} from 'lucide-react';

interface Props {
  challengesCount: number;
  categoryStats: { total: number; completed: number; inProgress: number; notStarted: number; percent: number };
  selectedCategory: ChallengeCategory;
  onSelectCategory: (cat: ChallengeCategory) => void;
  selectedArchetype: string;
  onSelectArchetype: (arch: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
}

export const PracticeCatalogHeader: React.FC<Props> = ({
  challengesCount,
  categoryStats,
  selectedCategory,
  onSelectCategory,
  selectedArchetype,
  onSelectArchetype,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange
}) => {
  return (
    <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20">
              ⚡ Machine Coding & Code Review Studio
            </span>
            <span className="text-xs text-pastel-muted font-mono font-bold">
              {challengesCount} задач • Java 21 LTS
            </span>
            {categoryStats.total > 0 && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                Прогресс: {categoryStats.completed}/{categoryStats.total} ({categoryStats.percent}%)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
            Live-Coding, Katas & Code Review Arena
          </h1>
          <p className="text-xs sm:text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
            Рефактори легаси-код с устным аудитом запахов, исследуй транзакции Spring и проектируй LLD-архитектуру на Java 21 с Gemini Live.
          </p>
        </div>
      </div>

      {/* Quick Arena Switcher Cards (4 Flagships) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-pastel-border/60">
        <button
          type="button"
          onClick={() => onSelectCategory('refactoring_kata')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between group ${
            selectedCategory === 'refactoring_kata'
              ? 'bg-gradient-to-r from-amber-50 to-rose-50 border-amber-300 shadow-xs'
              : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-pastel-text block group-hover:text-amber-800 transition">
                Refactoring & Review
              </span>
              <span className="text-[11px] text-pastel-muted">26 кат L0–L3 • Голос</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-pastel-muted group-hover:text-amber-600 transition group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => onSelectCategory('spring_transactions')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between group ${
            selectedCategory === 'spring_transactions'
              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-xs'
              : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-pastel-text block group-hover:text-blue-700 transition">
                Transactions Lab
              </span>
              <span className="text-[11px] text-pastel-muted">16 сценариев L0–L3</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-pastel-muted group-hover:text-blue-600 transition group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => onSelectCategory('testing_mutation')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between group ${
            selectedCategory === 'testing_mutation'
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 shadow-xs'
              : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Bug className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-pastel-text block group-hover:text-emerald-700 transition">
                Testing & Mutation
              </span>
              <span className="text-[11px] text-pastel-muted">42 каты (L0–L3)</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-pastel-muted group-hover:text-emerald-600 transition group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => onSelectCategory('lld_bigtech')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between group ${
            selectedCategory === 'lld_bigtech' || selectedCategory === 'lld_fintech' || selectedCategory === 'lld_concurrency'
              ? 'bg-gradient-to-r from-purple-50 to-rose-50 border-purple-300 shadow-xs'
              : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-pastel-text block group-hover:text-purple-700 transition">
                Machine Coding LLD
              </span>
              <span className="text-[11px] text-pastel-muted">51 задача LLD</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-pastel-muted group-hover:text-purple-600 transition group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="mt-5 pt-4 border-t border-pastel-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar touch-pan-x">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-pastel-text text-white shadow-xs'
                    : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск (L2-REF-01, Loom, имя)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:border-pastel-accentRose transition"
          />
        </div>
      </div>

      {/* Status Filters */}
      <div className="mt-4 pt-3 border-t border-pastel-border/60 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar animate-fade-in">
        <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
          <Filter className="w-3 h-3 text-slate-400" />
          Статус:
        </span>
        <button
          onClick={() => onStatusFilterChange('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            statusFilter === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text border border-pastel-border/60'
          }`}
        >
          Все ({categoryStats.total})
        </button>
        <button
          onClick={() => onStatusFilterChange('completed')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-pastel-bg text-emerald-700 hover:bg-white border border-emerald-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Решенные ({categoryStats.completed})</span>
        </button>
        <button
          onClick={() => onStatusFilterChange('in_progress')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            statusFilter === 'in_progress' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-pastel-bg text-amber-700 hover:bg-white border border-amber-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>В процессе ({categoryStats.inProgress})</span>
        </button>
      </div>

      {/* Refactoring Levels */}
      {selectedCategory === 'refactoring_kata' && (
        <div className="mt-3 pt-3 border-t border-pastel-border/60 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar animate-fade-in">
          <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Shield className="w-3 h-3 text-amber-600" />
            Уровни:
          </span>
          {REFACTORING_ARCHETYPES.map((arch) => {
            const isSelected = selectedArchetype === arch.id;
            return (
              <button
                key={arch.id}
                onClick={() => onSelectArchetype(arch.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isSelected ? 'bg-amber-600 text-white shadow-xs' : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                }`}
              >
                <span>{arch.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Testing Archetypes */}
      {selectedCategory === 'testing_mutation' && (
        <div className="mt-3 pt-3 border-t border-pastel-border/60 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar animate-fade-in">
          <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-rose-500" />
            Архетипы:
          </span>
          {TESTING_ARCHETYPES.map((arch) => {
            const isSelected = selectedArchetype === arch.id;
            return (
              <button
                key={arch.id}
                onClick={() => onSelectArchetype(arch.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isSelected ? 'bg-rose-600 text-white shadow-xs' : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                }`}
              >
                <span>{arch.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
