import React, { useState, useEffect } from 'react';
import { ExpressRunbook, TargetArena } from '@interview-prep/shared';
import { Clock, Copy, Check, CheckSquare, Square, Zap, Flame, ArrowRight, Bot } from 'lucide-react';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';

interface CompanyRunbookTabProps {
  runbook: ExpressRunbook;
  onNavigateToTask: (taskId: string, targetArena?: TargetArena) => void;
  companyId?: string;
}

export const CompanyRunbookTab: React.FC<CompanyRunbookTabProps> = ({
  runbook,
  onNavigateToTask,
  companyId = 'raiffeisen_dgtl'
}) => {
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`company_runbook_checklist_${companyId}`);
      if (saved) setCheckedItems(JSON.parse(saved));
    } catch {}
  }, [companyId]);

  const toggleCheck = (idx: number) => {
    const updated = { ...checkedItems, [idx]: !checkedItems[idx] };
    setCheckedItems(updated);
    try {
      localStorage.setItem(`company_runbook_checklist_${companyId}`, JSON.stringify(updated));
    } catch {}
  };

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(runbook.pitchScriptMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRehearsePitchWithAi = () => {
    const store = usePracticeTutorStore.getState();
    store.toggleOpen(true);
    void store.sendMessage(
      `Послушай мой 4-минутный питч о себе как Product Engineer:\n\n"${runbook.pitchScriptMarkdown}"\n\nОцени его по критериям банка: метрики TTM, Pain Index, End-to-End Ownership, Zero-Downtime и предотвращение аварий на проде. Что усилить?`
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 4-Minute Elevator Pitch Section */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pastel-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                4-Минутный Скрипт Самопрезентации (Elevator Pitch)
              </h3>
              <p className="text-[11px] text-pastel-muted">
                Выверенная структура ответа на вопрос «Расскажите о себе» с акцентом на Product Engineering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleRehearsePitchWithAi}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Отправить скрипт AI-Напарнику для тренировки"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Отрепетируй с AI</span>
            </button>

            <button
              onClick={handleCopyPitch}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Скопировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-pastel-border/70 text-xs sm:text-sm text-slate-800 leading-relaxed italic font-serif">
          "{runbook.pitchScriptMarkdown}"
        </div>
      </div>

      {/* Must-Review Critical Tasks */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-900">
          <Flame className="w-5 h-5 text-rose-500" />
          <h4 className="text-sm font-extrabold">
            Критический минимум за 3 часа до собеседования (Must-Review Katas)
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {runbook.mustReviewTasks && runbook.mustReviewTasks.length > 0 ? (
            runbook.mustReviewTasks.map((task, i) => (
              <button
                key={task.taskId}
                onClick={() => onNavigateToTask(task.taskId, task.targetArena)}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-pastel-border/80 hover:border-indigo-200 text-left transition-all shadow-xs group flex flex-col justify-between space-y-2 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    {task.badge || `Задача ${i + 1}`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-pastel-muted group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 block leading-snug">{task.title}</span>
                  <span className="text-[10px] text-slate-700 font-mono block">{task.taskId}</span>
                </div>
              </button>
            ))
          ) : (
            runbook.mustReviewTaskIds.map((taskId, i) => (
              <button
                key={taskId}
                onClick={() => onNavigateToTask(taskId)}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-pastel-border/80 hover:border-indigo-200 text-left transition-all shadow-xs group flex flex-col justify-between space-y-2 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    Задача {i + 1}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-pastel-muted group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <span className="text-xs font-bold text-slate-800 font-mono">{taskId}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Pre-Flight Checklist */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-900">
          <Zap className="w-5 h-5 text-amber-500" />
          <h4 className="text-sm font-extrabold">Финальный чек-лист готовности к собеседованию</h4>
        </div>
        <div className="space-y-2">
          {runbook.checklist.map((item, idx) => {
            const isChecked = Boolean(checkedItems[idx]);
            return (
              <div
                key={idx}
                onClick={() => toggleCheck(idx)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                  isChecked
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 hover:bg-slate-100/70 border-pastel-border/80 text-slate-800'
                }`}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-pastel-muted shrink-0" />
                )}
                <span className={`text-xs ${isChecked ? 'line-through text-emerald-800/80 font-medium' : 'font-medium'}`}>
                  {item.replace(/^\[ \]\s*/, '')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
