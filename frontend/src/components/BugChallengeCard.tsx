import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Eye,
  EyeOff,
  Bug,
  CheckCircle2,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  SplitSquareVertical,
  Code2,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CodeViewer } from './CodeViewer';
import { useAppStore } from '../store/useAppStore';

export interface BugChallenge {
  id: string;
  topicId?: string;
  topicName?: string;
  title: string;
  subtopic: string;
  language: 'java' | 'sql' | 'kotlin';
  codeSnippet: string;
  bugExplanation: string;
  fixedCode: string;
  hints: string[];
  categoryBadge?: string;
  difficultyBadge?: string;
  sampledQuestionId?: string;
  isTopicExhausted?: boolean;
  remainingCount?: number;
  totalTopicQuestions?: number;
  isSolved?: boolean;
  lastScore?: number;
  lastFeedback?: string;
  keyTakeaways?: string[];
  createdAt?: string;
}

interface BugChallengeCardProps {
  challenge: BugChallenge;
  isSolved?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
}

/**
 * Clean Unified Diff generator for side-by-side / inline inspection
 */
function generateUnifiedDiff(original: string, fixed: string): string {
  const origLines = (original || '').trim().split('\n');
  const fixedLines = (fixed || '').trim().split('\n');
  const diff: string[] = [];

  let i = 0;
  let j = 0;

  while (i < origLines.length || j < fixedLines.length) {
    const oLine = origLines[i];
    const fLine = fixedLines[j];

    if (oLine === fLine) {
      if (oLine !== undefined) diff.push(' ' + oLine);
      i++;
      j++;
    } else {
      const nextMatchInFixed = fLine ? origLines.indexOf(fLine, i) : -1;
      const nextMatchInOrig = oLine ? fixedLines.indexOf(oLine, j) : -1;

      if (oLine !== undefined && (nextMatchInFixed !== -1 || j >= fixedLines.length)) {
        diff.push('-' + oLine);
        i++;
      } else if (fLine !== undefined && (nextMatchInOrig !== -1 || i >= origLines.length)) {
        diff.push('+' + fLine);
        j++;
      } else {
        if (oLine !== undefined) {
          diff.push('-' + oLine);
          i++;
        }
        if (fLine !== undefined) {
          diff.push('+' + fLine);
          j++;
        }
      }
    }
  }

  return diff.join('\n');
}

export const BugChallengeCard: React.FC<BugChallengeCardProps> = ({
  challenge,
  isSolved = false,
  onRefresh,
  isLoading = false,
}) => {
  const [showSolution, setShowSolution] = useState(false);
  const [openHintIndex, setOpenHintIndex] = useState<number | null>(null);
  const [solutionViewMode, setSolutionViewMode] = useState<'fixed' | 'diff'>('diff');

  const { addCheatSheetBookmark, removeCheatSheetBookmark, isBookmarked } = useAppStore();
  const bookmarked = isBookmarked(challenge.id);

  // Compute unified diff string for solution inspection
  const unifiedDiffCode = useMemo(() => {
    return generateUnifiedDiff(challenge.codeSnippet, challenge.fixedCode);
  }, [challenge.codeSnippet, challenge.fixedCode]);

  // Extract or generate 3 key takeaways for cheat sheet synthesis
  const takeaways = useMemo(() => {
    if (challenge.keyTakeaways && challenge.keyTakeaways.length > 0) {
      return challenge.keyTakeaways;
    }
    const explanationLines = challenge.bugExplanation
      .split('\n')
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(l => l.length > 10);

    if (explanationLines.length >= 2) {
      return explanationLines.slice(0, 3);
    }

    return [
      `Суть дефекта: ${challenge.title} в подразделе ${challenge.subtopic}.`,
      `Риск: нарушение потокобезопасности или корректности данных под нагрузкой.`,
      `Архитектурное решение: применение thread-safe примитивов или правильных контрактов Spring.`
    ];
  }, [challenge]);

  const handleToggleBookmark = () => {
    if (bookmarked) {
      removeCheatSheetBookmark(challenge.id);
    } else {
      addCheatSheetBookmark({
        id: challenge.id,
        topicId: challenge.topicId,
        topicName: challenge.topicName,
        title: challenge.title,
        subtopic: challenge.subtopic,
        takeaways,
        codeSnippet: challenge.codeSnippet,
        fixedCode: challenge.fixedCode,
        categoryBadge: challenge.categoryBadge
      });
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Banner with Title, Category, Difficulty, and Past Score Badge */}
      <div className="bg-gradient-to-r from-pastel-card/90 via-pastel-lavender/30 to-pastel-card/90 rounded-2xl p-4 md:p-5 border border-pastel-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pastel-rose/70 text-pastel-darkPurple border border-pastel-accentRose/30">
              <Bug className="w-3.5 h-3.5" />
              {challenge.categoryBadge || '⚡ Concurrency'}
            </span>

            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              challenge.difficultyBadge === 'Senior'
                ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
            }`}>
              {challenge.difficultyBadge || 'Middle'}
            </span>

            {challenge.lastScore !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                <Award className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Прошлый результат: {challenge.lastScore}/10
              </span>
            )}

            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {challenge.subtopic}
            </span>
          </div>

          <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {challenge.title}
          </h2>
        </div>

        {/* Action Header: Bookmark & Refresh */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleToggleBookmark}
            title={bookmarked ? 'Удалить из шпаргалки' : 'Сохранить инсайт в шпаргалку'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              bookmarked
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 shadow-sm'
                : 'bg-white/80 text-slate-700 hover:bg-pastel-lavender/50 border-pastel-border dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {bookmarked ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>В шпаргалке</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                <span>⭐ В шпаргалку</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Snippet with SOTA CodeViewer */}
      <CodeViewer
        code={challenge.codeSnippet}
        language={challenge.language}
        title={`${challenge.language.toUpperCase()} • Проблемный код`}
      />

      {/* Hints Accordion */}
      {challenge.hints && challenge.hints.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 px-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Подсказки (раскрывайте по необходимости):</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {challenge.hints.map((hint, idx) => {
              const isOpen = openHintIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-pastel-border/80 bg-pastel-card/60 backdrop-blur-sm overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenHintIndex(isOpen ? null : idx)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-pastel-lavender/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-pastel-lavender text-pastel-darkPurple flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span>Подсказка {idx + 1} {idx === 0 ? '(Направление)' : '(Локализация)'}</span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-3.5 pb-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-pastel-border/40 pt-2 bg-white/40 dark:bg-slate-900/30 font-sans"
                      >
                        {hint}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Solution Reveal Button */}
      <div className="pt-1">
        <button
          onClick={() => setShowSolution(!showSolution)}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
            showSolution
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              : 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 shadow-sm'
          }`}
        >
          {showSolution ? (
            <>
              <EyeOff className="w-4 h-4" />
              <span>Скрыть правильное решение и объяснение</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Показать правильное решение и Diff изменений</span>
            </>
          )}
        </button>

        {/* Revealed Solution Box */}
        <AnimatePresence>
          {showSolution && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 p-4 md:p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 space-y-4 text-slate-800 dark:text-slate-200"
            >
              {/* Explanation of the Bug */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Суть ошибки и почему код ломается:</span>
                </div>
                <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-5 whitespace-pre-line font-sans">
                  {challenge.bugExplanation}
                </p>
              </div>

              {/* Solution View Switcher (Fixed Code vs Unified Diff) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Исправленная реализация:
                  </span>

                  <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-800 p-1 rounded-xl border border-pastel-border shadow-xs">
                    <button
                      onClick={() => setSolutionViewMode('diff')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        solutionViewMode === 'diff'
                          ? 'bg-pastel-accentRose text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <SplitSquareVertical className="w-3.5 h-3.5" />
                      <span>Diff изменений</span>
                    </button>
                    <button
                      onClick={() => setSolutionViewMode('fixed')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        solutionViewMode === 'fixed'
                          ? 'bg-pastel-accentRose text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Код решения</span>
                    </button>
                  </div>
                </div>

                {/* SOTA CodeViewer with Unified Diff or Clean Fixed Code */}
                {solutionViewMode === 'diff' ? (
                  <CodeViewer
                    code={unifiedDiffCode}
                    language={challenge.language}
                    isDiff={true}
                    title={`${challenge.language.toUpperCase()} • Unified Diff Решения`}
                  />
                ) : (
                  <CodeViewer
                    code={challenge.fixedCode}
                    language={challenge.language}
                    title={`${challenge.language.toUpperCase()} • Fixed Code`}
                  />
                )}
              </div>

              {/* Key Takeaways Card for Interview Prep */}
              <div className="p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-pastel-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-pastel-darkPurple dark:text-pastel-lavender">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>💡 Ключевые выводы для собеседования:</span>
                  </div>
                  <button
                    onClick={handleToggleBookmark}
                    className="text-[11px] font-medium text-pastel-accentRose hover:underline flex items-center gap-1"
                  >
                    {bookmarked ? <BookmarkCheck className="w-3 h-3 text-amber-600" /> : <Bookmark className="w-3 h-3" />}
                    <span>{bookmarked ? 'В шпаргалке' : 'Сохранить эти выводы'}</span>
                  </button>
                </div>

                <ul className="space-y-1 pl-4 list-disc text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  {takeaways.map((point, pIdx) => (
                    <li key={pIdx}>{point}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
export default BugChallengeCard;
