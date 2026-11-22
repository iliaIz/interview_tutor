import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BookOpen, Search, CheckCircle2, Circle, ChevronDown, ChevronUp, 
  Sparkles, Bot, ShieldAlert, Award, Filter, RefreshCw
} from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';

export interface CompanyQuestion {
  id: string;
  global_id?: string;
  num?: number;
  module?: string;
  topic: string;
  question: string;
  depthProbe?: string[];
  answer: string;
  redFlags?: string[];
  isMastered?: boolean;
  userScore?: number;
}

interface CompanyTheoryDeckTabProps {
  companyId: string;
  companyName: string;
  onMasteryUpdated?: () => void;
}

export const CompanyTheoryDeckTab: React.FC<CompanyTheoryDeckTabProps> = ({
  companyId,
  companyName,
  onMasteryUpdated
}) => {
  const [questions, setQuestions] = useState<CompanyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmastered' | 'mastered'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${companyId}/questions`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status}): не удалось загрузить вопросы`);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[CompanyTheoryDeckTab] Failed to load questions:', err);
      setError(err.message || 'Ошибка загрузки вопросов');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      const mod = q.module || q.topic;
      if (mod) set.add(mod);
    });
    return Array.from(set);
  }, [questions]);

  const masteredCount = useMemo(() => {
    return questions.filter((q) => q.isMastered).length;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const qText = `${q.question} ${q.topic} ${q.answer}`.toLowerCase();
      const matchesSearch = !searchQuery || qText.includes(searchQuery.toLowerCase());
      const matchesModule = selectedModule === 'all' || q.module === selectedModule || q.topic === selectedModule;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'mastered' && q.isMastered) ||
        (statusFilter === 'unmastered' && !q.isMastered);

      return matchesSearch && matchesModule && matchesStatus;
    });
  }, [questions, searchQuery, selectedModule, statusFilter]);

  const handleToggleMastery = async (q: CompanyQuestion) => {
    const nextMastered = !q.isMastered;
    setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, isMastered: nextMastered } : item)));
    try {
      await fetch(`/api/companies/${companyId}/questions/${encodeURIComponent(q.id)}/mastery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isMastered: nextMastered, score: nextMastered ? 100 : 0 })
      });
      onMasteryUpdated?.();
    } catch (err) {
      console.error('[CompanyTheoryDeckTab] Failed to persist mastery:', err);
    }
  };

  const handlePracticeWithAi = (q: CompanyQuestion) => {
    const store = usePracticeTutorStore.getState();
    store.toggleOpen(true);
    const probeStr = q.depthProbe && q.depthProbe.length > 0 ? `\n\nТочки углубления: ${q.depthProbe.join(', ')}` : '';
    void store.sendMessage(
      `Проведи со мной скрининг по вопросу из программы ${companyName}:\n\n` +
      `«${q.question}» (Тема: ${q.topic})${probeStr}\n\n` +
      `Оценивай глубину на уровне физики памяти (JMM, HotSpot, байткод). Если отвечу поверхностно — задай уточняющий вопрос.`
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3 font-sans">
        <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Загрузка теоретического дека...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2 font-sans">
        <p className="text-sm font-bold text-rose-800">{error}</p>
        <button onClick={() => void fetchQuestions()} className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs cursor-pointer">
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Progress & Stats Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-600" /> Физика & Архитектура Собеседования
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Освоено: {masteredCount} из {questions.length} ({Math.round((masteredCount / (questions.length || 1)) * 100)}%)
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Senior Theory Deck: {companyName}
          </h3>
          <p className="text-xs text-slate-600">
            27 ключевых вопросов физического уровня (JVM, JMM, Spring, PostgreSQL, Kafka, ЦФА) с разбором байткода и красных флагов
          </p>
        </div>

        {/* Meter */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 self-start md:self-auto shrink-0">
          <div className="text-right">
            <span className="block text-2xl font-black text-slate-900 font-mono">
              {Math.round((masteredCount / (questions.length || 1)) * 100)}%
            </span>
            <span className="text-[10px] uppercase font-bold text-emerald-700">Прогресс теории</span>
          </div>
          <div className="w-20 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${(masteredCount / (questions.length || 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по вопросу, теме или байткод-инвариантам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-pastel-border/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-2 bg-white border border-pastel-border/80 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Все модули ({questions.length})</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div className="flex items-center bg-white border border-pastel-border/80 rounded-xl p-0.5 text-xs font-semibold">
            {(['all', 'unmastered', 'mastered'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === st ? (st === 'mastered' ? 'bg-emerald-600 text-white' : st === 'unmastered' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-900 text-white') : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'Все' : st === 'unmastered' ? 'К изучению' : 'Освоено'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-3xl border border-slate-200/80 text-xs font-medium">
            Вопросы по заданным фильтрам не найдены.
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const isExpanded = expandedId === q.id;
            return (
              <div
                key={q.id}
                className={`border rounded-2xl transition-all shadow-xs overflow-hidden ${
                  q.isMastered
                    ? 'bg-emerald-50/20 border-emerald-200/80'
                    : 'bg-white border-pastel-border/80 hover:border-slate-300'
                }`}
              >
                {/* Header row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => void handleToggleMastery(q)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                      title={q.isMastered ? 'Снять отметку об освоении' : 'Отметить как освоенный'}
                    >
                      {q.isMastered ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {q.id}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {q.module || q.topic}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {q.question}
                      </h4>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handlePracticeWithAi(q)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400 text-slate-900 text-xs font-bold border border-amber-300/60 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Отрепетировать ответ с AI-интервьюером"
                    >
                      <Bot className="w-3.5 h-3.5 text-amber-700" />
                      <span>AI Скрининг</span>
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Скрыть' : 'Разбор'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-200/80 p-5 bg-slate-50/70 space-y-4 text-xs text-slate-800 animate-in fade-in duration-150">
                    {/* Depth Probe Tags */}
                    {q.depthProbe && q.depthProbe.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-700 uppercase font-mono flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-indigo-600" /> Точки углубления (Что спросит сеньор):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {q.depthProbe.map((dp, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900 text-[11px] font-mono shadow-xs"
                            >
                              {dp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Root cause physics answer */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 uppercase font-mono flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-rose-600" /> Физика & Канонический ответ:
                      </span>
                      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs leading-relaxed font-sans text-xs sm:text-sm">
                        <MarkdownRenderer content={q.answer} />
                      </div>
                    </div>

                    {/* Red Flags Alert */}
                    {q.redFlags && q.redFlags.length > 0 && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl space-y-1">
                        <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          <span>Красные флаги (Что гарантированно приведет к No Hire):</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-rose-800 text-[11px]">
                          {q.redFlags.map((rf, i) => (
                            <li key={i}>{rf}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
