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
  Award,
  Activity,
  AlertTriangle,
  Server,
  GitPullRequest
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CodeViewer } from './CodeViewer';
import { useAppStore } from '../store/useAppStore';

export interface TechStackInfo {
  language: string;
  javaVersion: string;
  framework: string;
  keyLibraries: string[];
}

export interface ProductionContext {
  systemName: string;
  architectureType: string;
  incidentSymptoms: string;
  businessImpact: string;
  prReviewContext: string;
}

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
  techStack?: TechStackInfo;
  productionContext?: ProductionContext;
  createdAt?: string;
}

interface BugChallengeCardProps {
  challenge: BugChallenge;
  isSolved?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
  onGenerateVariation?: () => void;
  isGeneratingVariation?: boolean;
  variantNumber?: number;
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
  onGenerateVariation,
  isGeneratingVariation = false,
  variantNumber,
}) => {
  const [showSolution, setShowSolution] = useState(false);
  const [openHintIndex, setOpenHintIndex] = useState<number | null>(null);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
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
      {/* Top Banner in Pure Soft Luxury Pastel Style */}
      <div className="bg-gradient-to-br from-[#FFF5F8] via-[#FAF5FF] to-white rounded-2xl p-4 md:p-5 border border-pink-200/70 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 backdrop-blur-md">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100/90 text-rose-900 border border-rose-200/80 shadow-2xs">
              <Bug className="w-3.5 h-3.5 text-rose-700" />
              {challenge.categoryBadge || '⚡ Concurrency'}
            </span>

            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${
              challenge.difficultyBadge === 'Senior'
                ? 'bg-purple-100/90 text-[#4A1E6D] border-purple-200/80'
                : 'bg-emerald-100/90 text-emerald-950 border-emerald-200/80'
            }`}>
              {challenge.difficultyBadge || 'Middle'}
            </span>

            {variantNumber !== undefined && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-100/80 text-[#4A1E6D] border border-pink-200/70 shadow-2xs">
                Вариант {variantNumber}
              </span>
            )}

            {challenge.lastScore !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
                <Award className="w-3.5 h-3.5 text-amber-700" />
                Прошлый результат: {challenge.lastScore}/10
              </span>
            )}

            <span className="text-xs font-mono text-[#7E699B] font-semibold">
              {challenge.subtopic}
            </span>
          </div>

          <h2 className="text-base md:text-lg font-bold text-[#2D1B4E] leading-snug flex items-center gap-2">
            {challenge.title}
          </h2>
        </div>

        {/* Action Header: Generate Variation & Bookmark in Luxury White-Glass Style */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {onGenerateVariation && (
            <button
              onClick={onGenerateVariation}
              disabled={isGeneratingVariation}
              title="Сгенерировать другой пример кода по этой же подтеме"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-pink-200/80 bg-white hover:bg-pink-50/80 text-[#4A1E6D] transition-all shadow-2xs disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 text-pink-600 ${isGeneratingVariation ? 'animate-spin' : ''}`} />
              <span>{isGeneratingVariation ? 'Генерация...' : '🎲 Другой пример этого бага'}</span>
            </button>
          )}

          <button
            onClick={handleToggleBookmark}
            title={bookmarked ? 'Удалить из шпаргалки' : 'Сохранить инсайт в шпаргалку'}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-[0.98] ${
              bookmarked
                ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-xs'
                : 'bg-white hover:bg-pink-50/80 text-[#4A1E6D] border-pink-200/80'
            }`}
          >
            {bookmarked ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>В шпаргалке</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-pink-500" />
                <span>⭐ В шпаргалку</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tech Stack Version Badges */}
      {challenge.techStack && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] font-bold text-[#7E699B] mr-1">Стек:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-pink-100/80 text-[#4A1E6D] font-mono text-[11px] font-bold border border-pink-200/70 shadow-2xs">
            ☕ {challenge.techStack.javaVersion || challenge.techStack.language}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-purple-100/80 text-[#4A1E6D] font-mono text-[11px] font-bold border border-purple-200/70 shadow-2xs">
            🍃 {challenge.techStack.framework}
          </span>
          {challenge.techStack.keyLibraries?.slice(0, 3).map((lib, lIdx) => (
            <span
              key={lIdx}
              className="px-2 py-0.5 rounded-lg bg-white text-[#4A326D] font-mono text-[11px] font-medium border border-pink-200/60 shadow-2xs"
            >
              {lib}
            </span>
          ))}
        </div>
      )}

      {/* Collapsible Production Incident Lore Accordion */}
      {challenge.productionContext && (
        <div className="rounded-2xl border border-pink-200/80 bg-gradient-to-r from-[#FFF5F8] via-[#FAF5FF] to-white overflow-hidden shadow-2xs transition-all">
          <button
            onClick={() => setIsIncidentOpen(!isIncidentOpen)}
            className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-[#4A1E6D] hover:bg-pink-50/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-pink-600 animate-pulse" />
              <span>🏢 Производственный контекст & Телеметрия инцидента</span>
              <span className="text-[10px] font-mono font-normal text-[#7E699B] bg-white px-2 py-0.5 rounded-md border border-pink-200 shadow-2xs">
                {challenge.productionContext.systemName}
              </span>
            </div>
            {isIncidentOpen ? <ChevronUp className="w-4 h-4 text-pink-600" /> : <ChevronDown className="w-4 h-4 text-[#7E699B]" />}
          </button>

          <AnimatePresence>
            {isIncidentOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-4 pt-1 border-t border-pink-100 space-y-3 text-xs bg-white/70 font-sans"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#4A1E6D]">
                      <Server className="w-3.5 h-3.5 text-purple-700" />
                      <span>Архитектура системы:</span>
                    </div>
                    <p className="text-[#3B2556] leading-relaxed">
                      {challenge.productionContext.architectureType}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-950">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                      <span>Бизнес-радиус поражения:</span>
                    </div>
                    <p className="text-rose-900 leading-relaxed">
                      {challenge.productionContext.businessImpact}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <Activity className="w-3.5 h-3.5 text-amber-700" />
                    <span>Симптомы в телеметрии (Grafana / Sentry / Prometheus):</span>
                  </div>
                  <p className="text-amber-900 leading-relaxed">
                    {challenge.productionContext.incidentSymptoms}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#4A1E6D]">
                    <GitPullRequest className="w-3.5 h-3.5 text-pink-600" />
                    <span>Контекст Pull Request (почему код был написан именно так):</span>
                  </div>
                  <p className="text-[#3B2556] leading-relaxed">
                    {challenge.productionContext.prReviewContext}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Code Snippet with SOTA CodeViewer (Velvet Obsidian Gemstone) */}
      <CodeViewer
        code={challenge.codeSnippet}
        language={challenge.language}
        title={`${challenge.language.toUpperCase()} • Проблемный код`}
      />

      {/* Hints Accordion in Soft Pastel Style */}
      {challenge.hints && challenge.hints.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#4A1E6D] flex items-center gap-1.5 px-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Подсказки (раскрывайте по необходимости):</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {challenge.hints.map((hint, idx) => {
              const isOpen = openHintIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-pink-200/70 bg-white/90 backdrop-blur-sm overflow-hidden shadow-2xs transition-all"
                >
                  <button
                    onClick={() => setOpenHintIndex(isOpen ? null : idx)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-semibold text-[#2D1B4E] hover:bg-pink-50/50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-pink-100 text-[#4A1E6D] flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span>Подсказка {idx + 1} {idx === 0 ? '(Направление)' : idx === 1 ? '(Локализация)' : '(Решение)'}</span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-pink-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#7E699B]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-3 text-xs text-[#4A326D] leading-relaxed border-t border-pink-100 pt-2.5 bg-[#FFF9FB] font-sans"
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
          className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-xs ${
            showSolution
              ? 'bg-white text-[#2D1B4E] border-pink-200 hover:bg-pink-50/50'
              : 'bg-gradient-to-r from-emerald-100/90 to-teal-100/90 text-emerald-950 border-emerald-300 hover:opacity-95 hover:scale-[1.005]'
          }`}
        >
          {showSolution ? (
            <>
              <EyeOff className="w-4 h-4 text-pink-600" />
              <span>Скрыть правильное решение и объяснение</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-emerald-700" />
              <span>Показать правильное решение и Diff изменений</span>
            </>
          )}
        </button>

        {/* Revealed Solution Box in Clean Soft Style */}
        <AnimatePresence>
          {showSolution && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 p-5 rounded-2xl bg-gradient-to-b from-emerald-50/90 via-[#F7FCF9] to-white border border-emerald-200/90 space-y-4 text-slate-800 shadow-xs"
            >
              {/* Explanation of the Bug */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Суть ошибки и почему код ломается:</span>
                </div>
                <p className="text-xs md:text-sm text-[#2D1B4E] leading-relaxed pl-5 whitespace-pre-line font-sans font-normal">
                  {challenge.bugExplanation}
                </p>
              </div>

              {/* Solution View Switcher (Fixed Code vs Unified Diff) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2D1B4E]">
                    Исправленная реализация:
                  </span>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200/80 shadow-2xs">
                    <button
                      onClick={() => setSolutionViewMode('diff')}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        solutionViewMode === 'diff'
                          ? 'bg-[#4A1E6D] text-white shadow-xs'
                          : 'text-[#4A326D] hover:text-[#2D1B4E] hover:bg-pink-50'
                      }`}
                    >
                      <SplitSquareVertical className="w-3.5 h-3.5" />
                      <span>Diff изменений</span>
                    </button>
                    <button
                      onClick={() => setSolutionViewMode('fixed')}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        solutionViewMode === 'fixed'
                          ? 'bg-[#4A1E6D] text-white shadow-xs'
                          : 'text-[#4A326D] hover:text-[#2D1B4E] hover:bg-pink-50'
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
              <div className="p-4 rounded-xl bg-white border border-pink-200/70 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#4A1E6D]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>💡 Ключевые выводы для собеседования:</span>
                  </div>
                  <button
                    onClick={handleToggleBookmark}
                    className="text-[11px] font-bold text-pink-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" /> : <Bookmark className="w-3.5 h-3.5 text-pink-500" />}
                    <span>{bookmarked ? 'В шпаргалке' : 'Сохранить эти выводы'}</span>
                  </button>
                </div>

                <ul className="space-y-1.5 pl-4 list-disc text-xs text-[#4A326D] leading-relaxed font-sans">
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
