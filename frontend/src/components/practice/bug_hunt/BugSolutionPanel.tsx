/**
 * BugSolutionPanel.tsx
 * Pure presentation panel for Golden Master, Unified Diff, Fixed Code,
 * JUnit 5 test cases and key interview takeaways.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  SplitSquareVertical,
  Code2,
  Award,
  Sparkles,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CodeViewer } from '../../CodeViewer';
import { BugChallenge } from '../../../hooks/useBugChallengeInspection';

interface BugSolutionPanelProps {
  challenge: BugChallenge;
  unifiedDiffCode: string;
  takeaways: string[];
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onActionNotification?: (actionText: string) => void;
}

export const BugSolutionPanel: React.FC<BugSolutionPanelProps> = ({
  challenge,
  unifiedDiffCode,
  takeaways,
  bookmarked,
  onToggleBookmark,
  onActionNotification
}) => {
  const [showSolution, setShowSolution] = useState(false);
  const [solutionViewMode, setSolutionViewMode] = useState<'fixed' | 'diff' | 'test'>('diff');

  return (
    <div className="pt-2">
      <button
        onClick={() => {
          const nextShow = !showSolution;
          setShowSolution(nextShow);
          if (nextShow) {
            onActionNotification?.(
              `🔍 [ДЕЙСТВИЕ: Кандидат открыл блок эталонного решения (режим: ${
                solutionViewMode === 'diff' ? 'Diff изменений' : solutionViewMode === 'fixed' ? 'Код решения' : 'JUnit 5 Тест'
              })]`
            );
          }
        }}
        className={`w-full py-3 px-4 rounded-2xl border flex items-center justify-center gap-2 text-xs md:text-sm font-bold transition-all cursor-pointer shadow-2xs hover:scale-[1.005] active:scale-[0.995] ${
          showSolution
            ? 'bg-gradient-to-r from-[#4A1E6D] to-[#3B1754] text-white border-[#3B1754] shadow-xs'
            : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white hover:from-emerald-100 hover:to-teal-50 text-emerald-950 border-emerald-300'
        }`}
      >
        {showSolution ? (
          <>
            <EyeOff className="w-4 h-4" />
            <span>Скрыть эталонное решение</span>
          </>
        ) : (
          <>
            <Eye className="w-4 h-4 text-emerald-700" />
            <span>Показать эталонный Golden Master & Diff</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {showSolution && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            data-selection-zone="reference_answer"
            className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-[#F0FDF4] via-white to-[#F5F3FF] border border-emerald-200/80 shadow-xs space-y-4 overflow-hidden"
          >
            {/* Bug Explanation Card */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Суть ошибки и почему код ломается:</span>
              </div>
              <p className="text-xs md:text-sm text-[#2D1B4E] leading-relaxed pl-5 whitespace-pre-line font-sans font-normal">
                {challenge.bugExplanation}
              </p>
            </div>

            {/* Solution View Switcher (Fixed Code vs Unified Diff vs JUnit 5 Test) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-[#2D1B4E]">
                  Исправленная реализация:
                </span>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200/80 shadow-2xs">
                  <button
                    onClick={() => {
                      setSolutionViewMode('diff');
                      onActionNotification?.('🔍 [ДЕЙСТВИЕ: Кандидат переключился на вкладку Diff изменений решения]');
                    }}
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
                    onClick={() => {
                      setSolutionViewMode('fixed');
                      onActionNotification?.('🔍 [ДЕЙСТВИЕ: Кандидат переключился на вкладку Код эталонного решения]');
                    }}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      solutionViewMode === 'fixed'
                        ? 'bg-[#4A1E6D] text-white shadow-xs'
                        : 'text-[#4A326D] hover:text-[#2D1B4E] hover:bg-pink-50'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Код решения</span>
                  </button>
                  {challenge.testSuite && (
                    <button
                      onClick={() => {
                        setSolutionViewMode('test');
                        onActionNotification?.('🔍 [ДЕЙСТВИЕ: Кандидат переключился на вкладку Воспроизводящий JUnit 5 Тест]');
                      }}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        solutionViewMode === 'test'
                          ? 'bg-[#4A1E6D] text-white shadow-xs'
                          : 'text-[#4A326D] hover:text-[#2D1B4E] hover:bg-pink-50'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>JUnit 5 Тест</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SOTA CodeViewer with Unified Diff, Clean Fixed Code or JUnit 5 Test */}
              {solutionViewMode === 'diff' ? (
                <CodeViewer
                  code={unifiedDiffCode}
                  language={challenge.language}
                  isDiff={true}
                  title={`${challenge.language.toUpperCase()} • Unified Diff Решения`}
                />
              ) : solutionViewMode === 'fixed' ? (
                <CodeViewer
                  code={challenge.fixedCode}
                  language={challenge.language}
                  title={`${challenge.language.toUpperCase()} • Fixed Code`}
                />
              ) : (
                <CodeViewer
                  code={challenge.testSuite || '// Верификационный тест не задан'}
                  language="java"
                  title="JAVA • JUnit 5 / AssertJ / Awaitility Тест"
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
                  onClick={onToggleBookmark}
                  className="text-[11px] font-bold text-pink-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {bookmarked ? (
                    <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5 text-pink-500" />
                  )}
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
  );
};
