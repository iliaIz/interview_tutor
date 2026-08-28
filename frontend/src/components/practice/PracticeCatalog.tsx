import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CodingChallenge, ChallengeCategory } from '../../types/practice';
import {
  Code2,
  Cpu,
  Layers,
  Zap,
  Sparkles,
  Clock,
  CheckCircle2,
  Flame,
  ArrowRight,
  Shield,
  Search,
  Loader2,
  Crown,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES: { id: ChallengeCategory; name: string; icon: React.ComponentType<any> }[] = [
  { id: 'all', name: 'Все задачи', icon: Code2 },
  { id: 'machine_coding', name: 'Machine Coding (LLD)', icon: Layers },
  { id: 'refactoring_kata', name: 'Refactoring Katas', icon: Shield },
  { id: 'concurrency_lab', name: 'Concurrency Lab', icon: Zap },
  { id: 'java21_idioms', name: 'Java 21 Idioms', icon: Sparkles }
];

export const PracticeCatalog: React.FC = () => {
  const { openPracticeChallenge, showToast } = useAppStore();
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/practice/challenges');
      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
      }
    } catch (err) {
      console.error('Error fetching practice challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.targetStack.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [challenges, selectedCategory, searchQuery]);

  const handleStartChallenge = async (challengeId: string) => {
    setOpeningId(challengeId);
    try {
      const res = await fetch(`/api/practice/challenges/${challengeId}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      openPracticeChallenge(data.challenge, data.savedDraft);
    } catch (err: any) {
      console.error('Error loading challenge details:', err);
      showToast({
        type: 'error',
        title: 'Ошибка загрузки задачи',
        message: err?.message || 'Не удалось загрузить исходные файлы задачи.'
      });
    } finally {
      setOpeningId(null);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Lead':
        return 'bg-purple-100/80 text-purple-800 border-purple-300';
      case 'Senior':
        return 'bg-rose-100/80 text-rose-800 border-rose-300';
      case 'Middle':
        return 'bg-blue-100/80 text-blue-800 border-blue-300';
      default:
        return 'bg-emerald-100/80 text-emerald-800 border-emerald-300';
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-pastel-accentRose border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-pastel-muted">Загрузка каталога практических задач...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Welcome Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5" /> SOTA August 2026 Практический Тренажер
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-pastel-text">
          Live-Coding, Katas & Machine Coding Arena
        </h2>
        <p className="text-sm text-pastel-muted leading-relaxed">
          Проектируй LLD-архитектуру на Java 21, рефактори легаси-код через швы и тестируй виртуальные потоки Loom с мгновенным AI-ревью.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-3.5 rounded-3xl border border-pastel-border shadow-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-pastel-text text-white shadow-2xs'
                    : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-pastel-card'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по задачам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-2xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:ring-2 focus:ring-pastel-accentRose/40 transition"
          />
        </div>
      </div>

      {/* Challenges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {filteredChallenges.map((ch, idx) => {
            const isOpening = openingId === ch.id;
            const isCompleted = ch.isCompleted;

            return (
              <motion.div
                key={ch.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                className={`rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
                  isCompleted
                    ? 'bg-gradient-to-br from-white via-emerald-50/20 to-pastel-rose/20 ring-2 ring-emerald-300/60 shadow-md border-emerald-200/80'
                    : 'bg-white/95 backdrop-blur-sm border-pastel-border shadow-xs hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top Row: Category tag + Difficulty & Score */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border/60 truncate">
                      {ch.badge}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyColor(ch.difficulty)}`}>
                        {ch.difficulty}
                      </span>
                      {ch.lastScore !== undefined && ch.lastScore !== null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {ch.lastScore}/100
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-base text-pastel-text group-hover:text-pastel-accentRose transition-colors mb-2 leading-snug">
                    {ch.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-pastel-muted leading-relaxed line-clamp-3 mb-4">
                    {ch.shortDescription}
                  </p>
                </div>

                <div>
                  {/* Stack & Time Meta */}
                  <div className="rounded-2xl p-2.5 bg-pastel-bg/80 border border-pastel-border/60 text-xs mb-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-pastel-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-pastel-accentViolet" />
                        <span>Время: <strong>{ch.timeLimitMinutes} мин</strong></span>
                      </span>
                      <span className="font-medium text-pastel-accentRose">
                        {ch.category === 'machine_coding' ? 'Phase 1 + Phase 2' : 'Single Session'}
                      </span>
                    </div>

                    <div className="text-[10px] text-pastel-text/80 font-mono truncate">
                      🛠️ {ch.targetStack}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleStartChallenge(ch.id)}
                    disabled={isOpening}
                    className={`w-full text-white py-2.5 px-4 rounded-2xl font-bold text-xs hover:opacity-95 transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-75 ${
                      isCompleted
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                        : 'bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet'
                    }`}
                  >
                    {isOpening ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Инициализация воркспейса...</span>
                      </>
                    ) : isCompleted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Решить снова ({ch.lastScore} баллов)</span>
                      </>
                    ) : (
                      <>
                        <span>Открыть воркспейс</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
