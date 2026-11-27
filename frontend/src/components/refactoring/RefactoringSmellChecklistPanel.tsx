import React, { useState, useEffect } from 'react';
import { CodingChallenge, CodeSmellItem, BarRaiserQuestion } from '../../types/practice';
import {
  ShieldAlert,
  CheckCircle2,
  Mic,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Building2,
  Clock,
  Code2
} from 'lucide-react';

interface Props {
  challenge: CodingChallenge;
}

export const RefactoringSmellChecklistPanel: React.FC<Props> = ({ challenge }) => {
  const smells: CodeSmellItem[] = challenge.smellsChecklist || [];
  const barRaiserQuestions: BarRaiserQuestion[] = challenge.barRaiserQuestions || [];

  // Track discovered status by smellId or smell name
  const [discoveredMap, setDiscoveredMap] = useState<Record<string, { discovered: boolean; justification?: string }>>({});
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // Listen to Gemini Live smell_discovered events
  useEffect(() => {
    const handleSmellDiscovered = (e: Event) => {
      const customEvent = e as CustomEvent<{ smellId?: string; justification?: string }>;
      const { smellId, justification } = customEvent.detail || {};
      if (!smellId) return;

      const normId = smellId.toLowerCase();
      // Match by ID, by exact name, or partial inclusion
      const matched = smells.find(
        (s) => s.id.toLowerCase() === normId || s.name.toLowerCase().includes(normId) || normId.includes(s.id.toLowerCase())
      );

      const targetKey = matched ? matched.id : smellId;
      setDiscoveredMap((prev) => ({
        ...prev,
        [targetKey]: {
          discovered: true,
          justification: justification || prev[targetKey]?.justification || 'Обнаружено в ходе устного обсуждения с ИИ'
        }
      }));
    };

    window.addEventListener('smell_discovered', handleSmellDiscovered);
    return () => window.removeEventListener('smell_discovered', handleSmellDiscovered);
  }, [smells]);

  const toggleManualCheck = (smellId: string) => {
    setDiscoveredMap((prev) => ({
      ...prev,
      [smellId]: {
        discovered: !prev[smellId]?.discovered,
        justification: prev[smellId]?.justification || 'Отмечено кандидатом вручную'
      }
    }));
  };

  const toggleQuestion = (qId: string) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const totalSmells = smells.length;
  const discoveredCount = smells.filter((s) => discoveredMap[s.id]?.discovered).length;
  const progressPercent = totalSmells > 0 ? Math.round((discoveredCount / totalSmells) * 100) : 0;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MAJOR':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-4 p-1 animate-fade-in text-pastel-text">
      {/* 1. Header Banner & Discovery Progress */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/80 via-rose-50/40 to-white border border-amber-200/70 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-pastel-text">Аудит запахов кода (Code Smells)</h3>
              <p className="text-[11px] text-pastel-muted">Называй запахи голосом ИИ-собеседующему для скоринга</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white text-slate-800 border border-pastel-border shadow-2xs">
            {discoveredCount} / {totalSmells} найдено
          </span>
        </div>

        {/* Meter */}
        <div className="space-y-1">
          <div className="w-full h-2 bg-amber-100/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-pastel-muted">
            <span>Покрытие аудита: {progressPercent}%</span>
            <span>{discoveredCount === totalSmells && totalSmells > 0 ? '🎉 Все запахи найдены!' : 'Продолжай устный аудит'}</span>
          </div>
        </div>
      </div>

      {/* 2. Smells Checklist */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-pastel-muted px-1">
          <span>Список дефектов и рисков архитектуры:</span>
          <span className="text-[10px] text-pastel-muted font-normal">Кликните для ручной отметки</span>
        </div>

        {smells.length === 0 ? (
          <div className="p-4 rounded-xl bg-pastel-bg/50 border border-dashed border-pastel-border text-center text-xs text-pastel-muted">
            Для данной задачи запахи кода проверяются динамически через AST-анализ.
          </div>
        ) : (
          smells.map((smell) => {
            const isDiscovered = Boolean(discoveredMap[smell.id]?.discovered);
            const justification = discoveredMap[smell.id]?.justification;

            return (
              <button
                key={smell.id}
                type="button"
                role="checkbox"
                aria-checked={isDiscovered}
                onClick={() => toggleManualCheck(smell.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer select-none space-y-2 ${
                  isDiscovered
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs ring-1 ring-emerald-200'
                    : 'bg-white hover:bg-slate-50/80 border-pastel-border shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isDiscovered
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      {isDiscovered && <CheckCircle2 className="w-3 h-3" />}
                    </span>
                    <span className="font-bold text-xs text-pastel-text">{smell.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getSeverityBadge(smell.severity)}`}>
                      {smell.severity}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {smell.category}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-pastel-muted leading-relaxed pl-6">
                  {smell.description}
                </p>

                {smell.targetLinesSnippet && (
                  <div className="ml-6 p-2 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[10px] overflow-x-auto">
                    <code>{smell.targetLinesSnippet}</code>
                  </div>
                )}

                {isDiscovered && justification && (
                  <div className="ml-6 p-2 rounded-xl bg-emerald-100/60 border border-emerald-300/80 text-[11px] text-emerald-950 flex items-start gap-1.5 animate-fade-in">
                    <Mic className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-emerald-950">Зафиксировано ИИ-собеседующим: </strong>
                      <span>{justification}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* 3. Bar-Raiser Oral Defense Prep Section */}
      {barRaiserQuestions.length > 0 && (
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-pastel-text px-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Вопросы устной защиты (Bar-Raiser Round):</span>
          </div>

          <div className="space-y-2">
            {barRaiserQuestions.map((q, idx) => {
              const isExpanded = Boolean(expandedQuestions[q.id]);

              return (
                <div
                  key={q.id || idx}
                  className="rounded-2xl border border-pastel-border bg-white overflow-hidden shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleQuestion(q.id)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-pastel-bg/50 transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-pastel-text flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span>{q.questionText}</span>
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-pastel-muted shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-pastel-muted shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-3 pt-0 border-t border-pastel-border/40 bg-purple-50/20 space-y-2 text-[11px] text-pastel-muted leading-relaxed">
                      <div>
                        <strong className="text-purple-950 font-bold block mb-0.5">Ожидаемый ответ & Компромиссы:</strong>
                        <p>{q.idealResponseSummary}</p>
                      </div>

                      {q.followUpDeepDives && q.followUpDeepDives.length > 0 && (
                        <div className="pt-1 border-t border-purple-100">
                          <strong className="text-purple-900 font-bold block mb-0.5">Темы углубления (Deep Dives):</strong>
                          <ul className="list-disc list-inside space-y-0.5">
                            {q.followUpDeepDives.map((dd, dIdx) => (
                              <li key={dIdx}>{dd}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
