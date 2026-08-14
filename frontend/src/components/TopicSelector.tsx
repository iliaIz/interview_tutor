import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Coffee,
  Boxes,
  Cpu,
  Layers,
  Sparkles,
  Zap,
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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ICON_MAP: Record<string, any> = {
  'coffee': Coffee,
  'boxes': Boxes,
  'cpu': Cpu,
  'layers': Layers,
  'sparkles': Sparkles,
  'zap': Zap,
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
    shuffleMap,
    toggleShuffle,
    topicsProgress,
    resetTopicProgress,
    openRecapModal
  } = useAppStore();

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    return topics.filter(t => {
      const matchesCategory =
        selectedCategory === 'Все разделы' || t.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [topics, selectedCategory, searchQuery]);

  const totalQuestions = useMemo(() => {
    return topics.reduce((acc, t) => acc + (t.total || 0), 0);
  }, [topics]);

  const handleStartTopic = async (topicId: string, topicName: string, isReset = false) => {
    if (isReset) {
      if (!confirm(`Вы уверены, что хотите сбросить прогресс по теме "${topicName}" и начать сначала?`)) {
        return;
      }
      await fetch(`/api/topics/${topicId}/reset`, { method: 'POST' });
      resetTopicProgress(topicId);
    }

    const isShuffle = shuffleMap[topicId] || false;
    const res = await fetch(`/api/topics/${topicId}/batch?size=5&shuffle=${isShuffle}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedTopic(topicId, topicName);
      setBatch(data.questions);
      setView('study');
    }
  };

  const handleTopicRecap = (topicId: string, topicName: string) => {
    openRecapModal({
      topicId,
      topicName,
      title: `Обзор ключевых вопросов: ${topicName}`,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-pastel-accentRose/30 border-t-pastel-accentRose rounded-full animate-spin"></div>
        <p className="mt-4 text-pastel-muted font-medium">Загрузка базы вопросов...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pastel-rose text-pastel-accentRose text-xs font-semibold uppercase tracking-wider mb-3 border border-pastel-accentRose/20 shadow-sm">
          <Sparkles className="w-4 h-4" /> Актуальная база знаний (694+ вопросов)
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-pastel-text tracking-tight mb-3">
          Подготовка к собеседованиям Java Developer
        </h1>
        <p className="text-pastel-muted max-w-2xl mx-auto text-sm md:text-base">
          22 тематических раздела, от Java Core и Многопоточности до SQL, Kafka и Reactive. Изучай карточки, слушай ИИ-подкасты и проходи экзаменационные квизы.
        </p>
      </div>

      {/* Controls: Search and Category Tabs */}
      <div className="mb-8 space-y-4">
        {/* Search Bar */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-pastel-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по теме или описанию..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-pastel-border text-sm text-pastel-text placeholder-pastel-muted focus:outline-none focus:ring-2 focus:ring-pastel-accentRose/30 focus:border-pastel-accentRose transition shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-pastel-muted hover:text-pastel-text bg-pastel-bg px-2 py-0.5 rounded-md"
            >
              Сброс
            </button>
          )}
        </div>

        {/* Categories Bar */}
        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
                  isActive
                    ? 'bg-pastel-accentViolet text-white border-pastel-accentViolet shadow-sm'
                    : 'bg-white text-pastel-muted border-pastel-border hover:text-pastel-text hover:bg-pastel-bg'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center justify-between mb-6 px-1 text-xs text-pastel-muted font-medium">
        <span>Показано разделов: <strong className="text-pastel-text">{filteredTopics.length}</strong> из {topics.length}</span>
        <span>Всего вопросов в базе: <strong className="text-pastel-text">{totalQuestions}</strong></span>
      </div>

      {/* Grid of Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredTopics.map((t, idx) => {
            const IconComponent = ICON_MAP[t.icon] || BookOpen;
            const isShuffle = shuffleMap[t.id] || false;
            const storedProgress = topicsProgress[t.id];
            const percentage = storedProgress?.percentage ?? t.percentage ?? 0;
            const completedCount = storedProgress?.completedCount ?? t.completedCount ?? 0;

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                className="bg-white rounded-2xl p-5 border border-pastel-border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
              >
                <div>
                  {/* Top Row: Category tag + Progress badge */}
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border/60">
                      {t.category}
                    </span>

                    {/* Mini circular progress */}
                    <div className="relative w-11 h-11 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="22"
                          cy="22"
                          r="17"
                          className="text-pastel-border"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r="17"
                          stroke={t.color || '#6C5CE7'}
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={107}
                          strokeDashoffset={107 - (107 * percentage) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-bold text-pastel-text">{percentage}%</span>
                    </div>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2.5 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${t.color}15`, color: t.color }}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-pastel-text group-hover:text-pastel-accentRose transition-colors">
                        {t.name}
                      </h3>
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
                  <div className="mb-4 bg-pastel-bg/70 rounded-xl p-2.5 flex items-center justify-between text-xs text-pastel-muted">
                    <span>Пройдено: <strong className="text-pastel-text">{completedCount}</strong>/{t.total}</span>
                    <span className="font-semibold text-pastel-accentViolet text-[11px]">
                      {percentage === 100 ? '🎉 Завершено' : percentage > 0 ? 'В процессе' : 'Не начато'}
                    </span>
                  </div>

                  {/* Shuffle Toggle */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-pastel-muted select-none hover:text-pastel-text transition-colors">
                      <input
                        type="checkbox"
                        checked={isShuffle}
                        onChange={() => toggleShuffle(t.id)}
                        className="w-3.5 h-3.5 rounded text-pastel-accentRose focus:ring-pastel-accentRose border-gray-300 transition"
                      />
                      <Shuffle className="w-3 h-3" /> Случайный порядок
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartTopic(t.id, t.name, false)}
                      className="flex-1 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white py-2 px-3 rounded-xl font-semibold text-xs hover:opacity-95 transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {percentage > 0 ? 'Продолжить' : 'Начать'}
                    </button>

                    <button
                      onClick={() => handleTopicRecap(t.id, t.name)}
                      title="AI-аудиопересказ всей темы"
                      className="p-2 rounded-xl bg-pastel-rose text-pastel-accentRose hover:bg-pastel-accentRose hover:text-white border border-pastel-accentRose/20 transition flex items-center justify-center"
                    >
                      <Headphones className="w-3.5 h-3.5" />
                    </button>

                    {percentage > 0 && (
                      <button
                        onClick={() => handleStartTopic(t.id, t.name, true)}
                        title="Сбросить прогресс"
                        className="p-2 rounded-xl border border-pastel-border text-pastel-muted hover:text-pastel-text hover:bg-pastel-rose transition flex items-center justify-center"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredTopics.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-pastel-border mt-4">
          <BookOpen className="w-10 h-10 text-pastel-muted mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-semibold text-pastel-text mb-1">Разделы не найдены</h3>
          <p className="text-xs text-pastel-muted">Попробуйте изменить поисковый запрос или выбрать другую категорию</p>
        </div>
      )}
    </div>
  );
};
