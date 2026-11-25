import React, { useState, useMemo } from 'react';
import { Bug, Code2, ArrowRight, Bot, Clock, Sparkles } from 'lucide-react';
import { CompanyCuratedChallengeItem } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';

interface CompanyChallengesTabProps {
  companyName: string;
  challenges: CompanyCuratedChallengeItem[];
  onNavigateToTask: (taskId: string, targetArena?: any) => void;
}

export const CompanyChallengesTab: React.FC<CompanyChallengesTabProps> = ({
  companyName,
  challenges,
  onNavigateToTask
}) => {
  const [filter, setFilter] = useState<'all' | 'code_review' | 'live_coding'>('all');

  const codeReviewCount = useMemo(() => challenges.filter((c) => c.category === 'code_review').length, [challenges]);
  const liveCodingCount = useMemo(() => challenges.filter((c) => c.category === 'live_coding').length, [challenges]);

  const filteredChallenges = useMemo(
    () => (filter === 'all' ? challenges : challenges.filter((c) => c.category === filter)),
    [challenges, filter]
  );

  const handleAskAiForChallenge = (c: CompanyCuratedChallengeItem) => {
    const store = usePracticeTutorStore.getState();
    store.toggleOpen(true);
    void store.sendMessage(
      `Я готовлюсь к собеседованию в ${companyName}. Разбираю задачу «${c.title}» (${c.id}).\n\n` +
      `Краткая суть: ${c.summary}\n` +
      `Ключевые аспекты: ${c.keyPoints.join(', ')}.\n\n` +
      `Дай мне сеньорные рекомендации: на что обратить внимание при решении в IDE и какие ловушки чаще всего упускают кандидаты?`
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-600" /> Практический полигон в IDE
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Всего: {challenges.length} задач ({codeReviewCount} Code Review + {liveCodingCount} Live Coding)
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Практика & Code Review: {companyName}
          </h3>
          <p className="text-xs text-slate-600">
            Все задачи запускаются напрямую в полноэкранной веб-IDE с автоматическим прогоном тестов JUnit 5, компилятором Java 21 и AI-ревью.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold shrink-0 self-start md:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Все ({challenges.length})
          </button>
          <button
            onClick={() => setFilter('code_review')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'code_review' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bug className="w-3.5 h-3.5" /> Code Review ({codeReviewCount})
          </button>
          <button
            onClick={() => setFilter('live_coding')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'live_coding' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Live Coding ({liveCodingCount})
          </button>
        </div>
      </div>

      {/* Grid of Challenges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredChallenges.map((c) => {
          const isCr = c.category === 'code_review';
          return (
            <div
              key={c.id}
              className={`p-5 rounded-3xl border transition-all shadow-xs flex flex-col justify-between space-y-4 ${
                isCr
                  ? 'bg-amber-50/20 hover:bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                  : 'bg-indigo-50/20 hover:bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-300'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono border ${
                        isCr
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      }`}
                    >
                      {c.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        c.difficulty === 'Senior'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {c.difficulty}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> ~{c.estimatedMinutes} мин
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 leading-snug">{c.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{c.summary}</p>

                {/* Bullets */}
                <div className="p-3 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 font-mono">
                    {isCr ? 'Ключевые дефекты в коде:' : 'Требования & Спецификация:'}
                  </span>
                  <ul className="space-y-0.5 text-[11px] text-slate-700 list-disc list-inside">
                    {c.keyPoints.map((kp, idx) => (
                      <li key={idx} className="leading-tight">{kp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                <button
                  onClick={() => handleAskAiForChallenge(c)}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Спросить подсказку у AI"
                >
                  <Bot className="w-3.5 h-3.5 text-amber-600" />
                  <span>AI Совет</span>
                </button>

                <button
                  onClick={() => onNavigateToTask(c.id, 'practice')}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 ${
                    isCr
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <span>{isCr ? 'Провести ревью в IDE' : 'Решать задачу в IDE'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
