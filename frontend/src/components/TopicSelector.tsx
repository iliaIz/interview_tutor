import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Coffee, Leaf, Database, Container, Play, RotateCcw, Shuffle, Sparkles, BookOpen, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';

const ICON_MAP: Record<string, any> = {
  coffee: Coffee,
  leaf: Leaf,
  database: Database,
  container: Container
};

export const TopicSelector: React.FC = () => {
  const { setView, setSelectedTopic, setBatch, shuffleMap, toggleShuffle, topicsProgress, resetTopicProgress, openRecapModal } = useAppStore();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      title: `Обзорный подкаст: ${topicName}`,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-pastel-accentRose/30 border-t-pastel-accentRose rounded-full animate-spin"></div>
        <p className="mt-4 text-pastel-muted font-medium">Загрузка карточек тем...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pastel-rose text-pastel-accentRose text-xs font-semibold uppercase tracking-wider mb-3 border border-pastel-accentRose/20">
          <Sparkles className="w-4 h-4" /> Твоя персональная платформа
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-pastel-text tracking-tight mb-3">
          Подготовка к техническим собеседованиям
        </h1>
        <p className="text-pastel-muted max-w-xl mx-auto text-sm md:text-base">
          Выбери тему для изучения. Начни с прочтения карточек, послушай AI-аудиопересказ, а затем проверь знания.
        </p>
      </div>

      {/* Grid of Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {topics.map((t, idx) => {
          const IconComponent = ICON_MAP[t.icon] || BookOpen;
          const isShuffle = shuffleMap[t.id] || false;
          const storedProgress = topicsProgress[t.id];
          const percentage = storedProgress?.percentage ?? t.percentage ?? 0;
          const completedCount = storedProgress?.completedCount ?? t.completedCount ?? 0;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl p-6 border border-pastel-border shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="p-3 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${t.color}15`, color: t.color }}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-pastel-text">{t.name}</h3>
                    <p className="text-xs text-pastel-muted">{t.total} вопросов в базе</p>
                  </div>
                </div>

                {/* Progress Circle */}
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      className="text-pastel-border"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      stroke={t.color}
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray={138}
                      strokeDashoffset={138 - (138 * percentage) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold text-pastel-text">{percentage}%</span>
                </div>
              </div>

              {/* Progress Detail */}
              <div className="mb-5 bg-pastel-bg/60 rounded-xl p-3 flex items-center justify-between text-xs text-pastel-muted">
                <span>Пройдено вопросов: <strong className="text-pastel-text">{completedCount}</strong> из {t.total}</span>
                <span className="font-semibold text-pastel-accentViolet">
                  {percentage === 100 ? '🎉 Освоено полностью' : percentage > 0 ? 'В процессе' : 'Не начато'}
                </span>
              </div>

              {/* Shuffle Checkbox */}
              <div className="flex items-center justify-between mb-5 px-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-pastel-muted select-none hover:text-pastel-text transition-colors">
                  <input
                    type="checkbox"
                    checked={isShuffle}
                    onChange={() => toggleShuffle(t.id)}
                    className="w-4 h-4 rounded text-pastel-accentRose focus:ring-pastel-accentRose border-gray-300 transition"
                  />
                  <Shuffle className="w-3.5 h-3.5" /> Шафл (случайный порядок вопросов)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartTopic(t.id, t.name, false)}
                  className="flex-1 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white py-2.5 px-4 rounded-xl font-semibold text-sm hover:opacity-95 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {percentage > 0 ? 'Продолжить' : 'Начать обучение'}
                </button>

                <button
                  onClick={() => handleTopicRecap(t.id, t.name)}
                  title="Аудиопересказ всей темы"
                  className="p-2.5 rounded-xl bg-pastel-rose text-pastel-accentRose hover:bg-pastel-accentRose hover:text-white border border-pastel-accentRose/20 transition flex items-center justify-center"
                >
                  <Headphones className="w-4 h-4" />
                </button>

                {percentage > 0 && (
                  <button
                    onClick={() => handleStartTopic(t.id, t.name, true)}
                    title="Сбросить прогресс и начать сначала"
                    className="p-2.5 rounded-xl border border-pastel-border text-pastel-muted hover:text-pastel-text hover:bg-pastel-rose transition flex items-center justify-center"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
