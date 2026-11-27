import React, { useState } from 'react';
import { MutationExecutionResponse, MutantResult } from '../../types/practice';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Bug,
  Activity,
  Code,
  Sparkles,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizePracticeContext } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { useAppStore } from '../../store/useAppStore';
import { MutantDiffInspector } from './MutantDiffInspector';

interface MutationRadarWidgetProps {
  report: MutationExecutionResponse;
  requiredScore?: number;
}

export const MutationRadarWidget: React.FC<MutationRadarWidgetProps> = ({
  report,
  requiredScore = 85
}) => {
  const [expandedMutantId, setExpandedMutantId] = useState<string | null>(null);

  const isPassed = report.baselinePassed && report.mutationScore >= requiredScore;
  const scoreColor = isPassed
    ? 'from-emerald-500 to-teal-500 text-emerald-400'
    : report.mutationScore >= 50
    ? 'from-amber-500 to-yellow-500 text-amber-400'
    : 'from-rose-500 to-pink-500 text-rose-400';

  const sendMessage = usePracticeTutorStore((s) => s.sendMessage);
  const activePracticeChallenge = useAppStore((s) => s.activePracticeChallenge);
  const practiceWorkspaceFiles = useAppStore((s) => s.practiceWorkspaceFiles);
  const activeWorkspaceFileIndex = useAppStore((s) => s.activeWorkspaceFileIndex);
  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  const handleAskTutorAboutMutant = (mutant: MutantResult) => {
    const { persona, assistanceLevel } = usePracticeTutorStore.getState();
    void sendMessage(
      `Мутант "${mutant.name}" (${mutant.id}) выжил в файле ${mutant.file} на строке ${mutant.line}.\n` +
      `Объясни, почему текущие тесты его не поймали и какое граничное условие или проверку AssertJ нужно добавить?`,
      normalizePracticeContext({
        kataId: activePracticeChallenge?.id || 'kata',
        kataTitle: activePracticeChallenge?.title || 'Testing Kata',
        kataCategory: activePracticeChallenge?.category || 'Testing & Mutation',
        kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
        activeFilePath: currentFile?.path || 'src/test/java/Test.java',
        activeFileContent: currentFile?.content || '',
        survivingMutants: activePracticeChallenge?.mutants,
        persona,
        assistanceLevel
      })
    );
  };

  const toggleMutant = (id: string) => {
    setExpandedMutantId(prev => (prev === id ? null : id));
  };

  const formatBreachUnit = (count: number): string => {
    const abs = Math.abs(count) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return 'брешей';
    if (last === 1) return 'брешь';
    if (last >= 2 && last <= 4) return 'бреши';
    return 'брешей';
  };

  const formatErrorUnit = (count: number): string => {
    const abs = Math.abs(count) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return 'ошибок';
    if (last === 1) return 'ошибка';
    if (last >= 2 && last <= 4) return 'ошибки';
    return 'ошибок';
  };

  const formatKilledBy = (name: string): string => (name.endsWith(')') ? name : `${name}()`);

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-xl text-slate-200">
      {/* 1. Header Banner & Score Meter */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${isPassed ? 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30' : 'from-rose-500/20 to-pink-500/10 text-rose-400 border border-rose-500/30'}`}>
            <Bug className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-wide">
                Радар мутационного анализа (Live Mutation Radar)
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                {isPassed ? 'ПРОЙДЕНО' : 'ТРЕБУЕТСЯ ДОРАБОТКА'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Двухступенчатая проверка: Baseline Check → прогон против инъецированных дефектов
            </p>
          </div>
        </div>

        {/* Mutation Score Gauge Badge */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Mutation Score</div>
            <div className={`text-3xl font-extrabold tracking-tight bg-gradient-to-r ${scoreColor} bg-clip-text text-transparent`}>
              {report.mutationScore.toFixed(1)}%
            </div>
          </div>
          <div className="h-10 w-px bg-slate-800" />
          <div className="text-left">
            <div className="text-xs text-slate-400 uppercase font-semibold">Порог сдачи</div>
            <div className="text-sm font-bold text-slate-300">
              &ge; {requiredScore}%
            </div>
          </div>
        </div>
      </div>

      {/* 2. Baseline Check Status Banner */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-medium ${
        report.baselinePassed
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
      }`}>
        <div className="flex items-center gap-2">
          {report.baselinePassed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>
            {report.baselinePassed
              ? 'Baseline Check пройден: все ваши тесты успешно прошли на немодифицированном эталонном сервисе.'
              : 'Baseline Check не пройден: ваши тесты упали на исходном эталоне! Тесты обязаны быть зелеными на корректной реализации.'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{report.executionTimeMs} ms</span>
        </div>
      </div>

      {/* 3. Metrics Grid */}
      <div className={`grid grid-cols-2 ${(report.stillbornCount ?? 0) > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3`}>
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Всего мутантов</span>
          <span className="text-xl font-bold text-white mt-1">{report.totalMutants}</span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col justify-between">
          <span className="text-xs text-emerald-400/80 font-medium">Убито (Killed)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-emerald-400">{report.killedCount}</span>
            <span className="text-xs text-emerald-500/70">/ {report.totalMutants}</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 flex flex-col justify-between">
          <span className="text-xs text-rose-300 font-medium">Выжило (Survived)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-rose-400">{report.survivedCount}</span>
            <span className="text-xs text-rose-300/90">{formatBreachUnit(report.survivedCount)}</span>
          </div>
        </div>
        {(report.stillbornCount ?? 0) > 0 && (
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 flex flex-col justify-between">
            <span className="text-xs text-amber-300 font-medium">Синтаксис (Stillborn)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-amber-400">{report.stillbornCount}</span>
              <span className="text-xs text-amber-300/90">{formatErrorUnit(report.stillbornCount ?? 0)}</span>
            </div>
          </div>
        )}
        <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex flex-col justify-between">
          <span className="text-xs text-indigo-300 font-medium">Время прогона</span>
          <span className="text-xl font-bold text-indigo-300 mt-1">{report.executionTimeMs} <span className="text-xs font-normal">мс</span></span>
        </div>
      </div>

      {/* 4. Anti-Pattern Guard Warnings */}
      {report.qualityViolations && report.qualityViolations.length > 0 && (
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Антипаттерны тест-дизайна (AST Quality Warnings):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
            {report.qualityViolations.map((v, idx) => (
              <li key={idx}>
                <span className="font-semibold text-amber-300">[{v.rule}]</span> {v.message} (строка {v.lineNumber})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Live Mutants Breakdown List */}
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
          <span>СПИСОК МУТАНТОВ БАЙТКОДА ({report.mutantResults?.length || 0})</span>
          <span>Кликните на мутанта для деталей</span>
        </div>

        <div className="flex flex-col gap-2">
          {report.mutantResults?.map((mutant) => {
            const isKilled = mutant.status === 'KILLED';
            const isStillborn = mutant.status === 'STILLBORN';
            const mutantKey = mutant.id || mutant.mutantId;
            const isExpanded = expandedMutantId === mutantKey;

            return (
              <div
                key={mutantKey}
                className={`flex flex-col rounded-xl border transition-all p-3 ${
                  isKilled
                    ? 'bg-emerald-950/15 border-emerald-500/25 hover:border-emerald-500/40'
                    : isStillborn
                    ? 'bg-slate-900/30 border-slate-800 hover:border-slate-700 opacity-85'
                    : 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleMutant(mutantKey)}
                  className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isKilled ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        KILLED
                      </span>
                    ) : isStillborn ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700/40 text-slate-300 border border-slate-600/40 shrink-0" title="Не скомпилировался (Stillborn Mutant) - исключен из скора">
                        STILLBORN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shrink-0">
                        SURVIVED
                      </span>
                    )}

                    <span className="font-mono text-xs font-semibold text-white truncate">
                      {mutant.name}
                    </span>

                    {mutant.line > 0 && (
                      <span className="text-[11px] text-slate-300 font-mono shrink-0">
                        (строка {mutant.line})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isKilled && mutant.killedBy && (
                      <span className="hidden sm:inline text-xs text-emerald-300 font-mono">
                        убит: {formatKilledBy(mutant.killedBy)}
                      </span>
                    )}
                    {isStillborn && (
                      <span className="text-xs text-amber-300 font-medium">
                        Ошибка компиляции
                      </span>
                    )}
                    {!isKilled && !isStillborn && (
                      <span className="text-xs text-rose-300 font-medium">
                        Брешь в тестах
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-300" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      key={`mutant-detail-${mutantKey}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-2"
                    >
                      <MutantDiffInspector
                        mutant={mutant}
                        onAskTutor={handleAskTutorAboutMutant}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
