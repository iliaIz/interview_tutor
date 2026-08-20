import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Coffee,
  Boxes,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Leaf,
  ArrowLeftRight,
  Archive,
  GitFork,
  Database,
  Table,
  Link as LinkIcon,
  Activity,
  Server,
  Globe,
  Radio,
  CheckCircle2,
  FileText,
  Code2,
  Network,
  FileCode,
  Palette,
  BookOpen,
  Play,
  RotateCcw,
  Shuffle,
  Headphones,
  Search,
  Check,
  ListChecks,
  ChevronRight,
  Bug,
  Crown,
  Trophy,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ICON_MAP: Record<string, any> = {
  'coffee': Coffee,
  'boxes': Boxes,
  'cpu': Cpu,
  'layers': Layers,
  'sparkles': Sparkles,
  'zap': Zap,
  'leaf': Leaf,
  'arrow-left-right': ArrowLeftRight,
  'archive': Archive,
  'git-fork': GitFork,
  'database': Database,
  'table': Table,
  'link': LinkIcon,
  'activity': Activity,
  'server': Server,
  'globe': Globe,
  'radio': Radio,
  'check-circle-2': CheckCircle2,
  'file-text': FileText,
  'code-2': Code2,
  'network': Network,
  'file-code': FileCode,
  'palette': Palette
};

const CATEGORIES = [
  'Все разделы',
  'Core Java & JVM',
  'Architecture & Concurrency',
  'Data & Storage',
  'Web & Enterprise',
  'Engineering & Tools',
  'Frontend Basics'
];

export const TopicSelector: React.FC = () => {
  const {
    setView,
    setSelectedTopic,
    setBatch,
    startStudyWithQuestions,
    shuffleMap,
    toggleShuffle,
    topicsProgress,
    resetTopicProgress,
    openRecapModal,
    openTopicQuestions,
    openTopicBugHunt,
    showToast
  } = useAppStore();

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Все разделы');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
      }
    } catch (e) {
      console.error('Error fetching topics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchesCategory =
        selectedCategory === 'Все разделы' || t.category === selectedCategory;
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [topics, selectedCategory, searchQuery]);

  const handleStartTopic = async (topicId: string, topicName: string, reset: boolean = false) => {
    setStartingTopicId(topicId);

    if (reset) {
      resetTopicProgress(topicId);
      try {
        await fetch(`/api/topics/${topicId}/reset`, { method: 'POST' });
      } catch (e) {
        console.warn('Error resetting topic progress on backend:', e);
      }
    }

    try {
      const isShuffle = shuffleMap[topicId] || false;
      const res = await fetch(`/api/topics/${topicId}/questions`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const allQuestions = data.questions || [];

      if (!allQuestions || allQuestions.length === 0) {
        showToast({
          type: 'warning',
          title: 'Вопросы не найдены',
          message: `Для темы "${topicName}" пока нет доступных вопросов.`
        });
        return;
      }

      const progress = topicsProgress[topicId];
      const localCompletedSet = new Set(progress?.completedIds || []);

      let remainingQuestions = reset
        ? allQuestions
        : allQuestions.filter((q: any) => !q.isCompleted && !localCompletedSet.has(q.id));

      if (remainingQuestions.length === 0) {
        remainingQuestions = allQuestions;
      }

      if (isShuffle) {
        remainingQuestions = [...remainingQuestions].sort(() => Math.random() - 0.5);
      }

      const batchPortion = remainingQuestions.slice(0, 10);

      startStudyWithQuestions(topicId, topicName, batchPortion);
    } catch (e: any) {
      console.error('Error starting topic batch:', e);
      showToast({
        type: 'error',
        title: 'Ошибка загрузки вопросов',
        message: e?.message || 'Не удалось загрузить вопросы по выбранной теме.'
      });
    } finally {
      setStartingTopicId(null);
    }
  };

  const handleTopicRecap = (topicId: string, topicName: string) => {
    openRecapModal({
      topicId,
      topicName,
      title: `Полный пересказ темы: ${topicName}`,
    });
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 border-4 border-pastel-accentRose border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-pastel-muted">Загрузка каталога тем...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Welcome Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5" /> Премиальная база знаний Java & Spring
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-pastel-text">
          Выбери тему для подготовки
        </h2>
        <p className="text-sm text-pastel-muted leading-relaxed">
          Изучай эталонные ответы, тренируйся в устном AI-интервью и ищи скрытые баги в реальном коде.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-3.5 rounded-3xl border border-pastel-border shadow-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-pastel-text text-white shadow-2xs'
                  : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-pastel-card'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по темам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-2xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:ring-2 focus:ring-pastel-accentRose/40 transition"
          />
        </div>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {filteredTopics.map((t, idx) => {
            const IconComponent = ICON_MAP[t.icon] || Coffee;
            const progress = topicsProgress[t.id];
            const completedCount = progress?.completedCount !== undefined ? progress.completedCount : (t.completedCount || 0);
            const percentage = progress?.percentage !== undefined ? progress.percentage : (t.percentage || 0);
            const isShuffle = shuffleMap[t.id] || false;
            const isFullyMastered = percentage === 100;
            const isStarting = startingTopicId === t.id;

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                className={`rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
                  isFullyMastered
                    ? 'bg-gradient-to-br from-white via-amber-50/20 to-pastel-rose/25 ring-2 ring-amber-300/60 shadow-md shadow-amber-200/20 border-amber-200/80'
                    : 'bg-white/95 backdrop-blur-sm border-pastel-border shadow-xs hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top Row: Category tag + Progress badge */}
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border/60">
                      {t.category}
                    </span>

                    {/* Mini circular progress or Mastered Trophy */}
                    {isFullyMastered ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100/80 text-amber-900 border border-amber-300 text-[10px] font-bold shadow-2xs animate-pulse">
                        <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                        <span>Mastered</span>
                      </div>
                    ) : (
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="20"
                            cy="20"
                            r="15"
                            className="text-pastel-border"
                            strokeWidth="3.5"
                            fill="transparent"
                          />
                          <circle
                            cx="20"
                            cy="20"
                            r="15"
                            stroke={t.color || '#6C5CE7'}
                            strokeWidth="3.5"
                            fill="transparent"
                            strokeDasharray={94}
                            strokeDashoffset={94 - (94 * percentage) / 100}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />
                        </svg>
                        <span className="absolute text-[10px] font-bold text-pastel-text">{percentage}%</span>
                      </div>
                    )}
                  </div>

                  {/* Icon & Title - Clickable to open QuestionExplorer */}
                  <div
                    onClick={() => openTopicQuestions(t.id, t.name)}
                    className="flex items-center gap-3 mb-2 cursor-pointer group/title"
                  >
                    <div
                      className="p-2.5 rounded-2xl flex items-center justify-center shrink-0 group-hover/title:scale-105 transition-transform shadow-2xs"
                      style={{ backgroundColor: `${t.color}18`, color: t.color }}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-bold text-base text-pastel-text group-hover/title:text-pastel-accentRose transition-colors truncate">
                          {t.name}
                        </h3>
                        <ChevronRight className="w-4 h-4 text-pastel-muted opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <p className="text-xs text-pastel-muted">{t.total} вопросов</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-pastel-muted leading-relaxed line-clamp-2 mb-4">
                    {t.description}
                  </p>
                </div>

                <div>
                  {/* Progress Detail Bar */}
                  <div className={`mb-3.5 rounded-2xl p-2.5 flex items-center justify-between text-xs ${
                    isFullyMastered ? 'bg-amber-50/70 text-amber-900 border border-amber-200/60' : 'bg-pastel-bg/70 text-pastel-muted'
                  }`}>
                    <span>Пройдено: <strong className="text-pastel-text">{completedCount}</strong>/{t.total}</span>
                    <span className="font-bold text-pastel-accentViolet text-[11px]">
                      {isFullyMastered ? '✨ 100% Освоено' : percentage > 0 ? 'В процессе' : 'Не начато'}
                    </span>
                  </div>

                  {/* Shuffle Toggle */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-pastel-muted select-none hover:text-pastel-text transition-colors">
                      <input
                        type="checkbox"
                        checked={isShuffle}
                        onChange={() => toggleShuffle(t.id)}
                        className="w-3.5 h-3.5 rounded text-pastel-accentRose focus:ring-pastel-accentRose border-gray-300 transition cursor-pointer"
                      />
                      <Shuffle className="w-3 h-3" /> Случайный порядок
                    </label>
                  </div>

                  {/* Actions Grid */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartTopic(t.id, t.name, false)}
                        disabled={isStarting}
                        className={`flex-1 text-white py-2 px-3 rounded-2xl font-bold text-xs hover:opacity-95 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-75 ${
                          isFullyMastered
                            ? 'bg-gradient-to-r from-amber-500 via-rose-400 to-pastel-accentViolet shadow-amber-300/30'
                            : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet'
                        }`}
                        title="Быстрый старт: начать со следующей неизученной порции"
                      >
                        {isStarting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Загрузка...</span>
                          </>
                        ) : isFullyMastered ? (
                          <>
                            <Crown className="w-3.5 h-3.5" /> Закрепить тему
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {percentage > 0 ? 'Продолжить' : 'Быстрый старт'}
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => openTopicBugHunt(t.id, t.name)}
                        title="🐛 Тренажер багов & Code Review по теме"
                        className="p-2 rounded-2xl bg-pastel-rose text-pastel-accentRose hover:bg-pastel-accentRose hover:text-white border border-pastel-accentRose/20 transition flex items-center justify-center cursor-pointer group/bug shadow-2xs active:scale-95"
                      >
                        <Bug className="w-4 h-4 group-hover/bug:scale-110 transition-transform" />
                      </button>

                      {percentage > 0 && (
                        <button
                          onClick={() => handleStartTopic(t.id, t.name, true)}
                          disabled={isStarting}
                          title="Сбросить прогресс и начать сначала"
                          className="p-2 rounded-2xl border border-pastel-border text-pastel-muted hover:text-pastel-text hover:bg-pastel-rose transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Secondary button: Выбрать конкретные вопросы */}
                    <button
                      onClick={() => openTopicQuestions(t.id, t.name)}
                      className="w-full py-1.5 px-3 rounded-2xl bg-pastel-bg hover:bg-pastel-lavender/60 text-pastel-text border border-pastel-border/80 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
                      title="Открыть полный список вопросов с возможностью выбора"
                    >
                      <ListChecks className="w-3.5 h-3.5 text-pastel-accentViolet" />
                      <span>Выбрать вопросы ({t.total})</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
