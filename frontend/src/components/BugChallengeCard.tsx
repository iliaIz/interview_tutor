/**
 * BugChallengeCard.tsx
 * Decomposed presenter coordinator for Bug Hunting Challenges.
 * Cognitive Bounding SLA: <= 180 lines (Rule 8 compliant, down from 609 lines).
 */

import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CodeViewer } from './CodeViewer';
import {
  BugChallenge,
  useBugChallengeInspection,
  TechStackInfo,
  ProductionContext
} from '../hooks/useBugChallengeInspection';
import { BugChallengeHeader } from './practice/bug_hunt/BugChallengeHeader';
import { BugIncidentAccordion } from './practice/bug_hunt/BugIncidentAccordion';
import { BugSolutionPanel } from './practice/bug_hunt/BugSolutionPanel';

export type { BugChallenge, TechStackInfo, ProductionContext };

export interface BugChallengeCardProps {
  challenge: BugChallenge;
  isSolved?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
  onGenerateVariation?: () => void;
  isGeneratingVariation?: boolean;
  variantNumber?: number;
  onActionNotification?: (actionText: string) => void;
}

export const BugChallengeCard: React.FC<BugChallengeCardProps> = ({
  challenge,
  isSolved = false,
  onRefresh,
  isLoading = false,
  onGenerateVariation,
  isGeneratingVariation = false,
  variantNumber,
  onActionNotification
}) => {
  const [openHintIndex, setOpenHintIndex] = useState<number | null>(null);

  const {
    astAnalysis,
    unifiedDiffCode,
    takeaways,
    bookmarked,
    handleToggleBookmark
  } = useBugChallengeInspection(challenge);

  return (
    <div className="w-full space-y-4">
      {/* 1. Header Banner */}
      <BugChallengeHeader
        challenge={challenge}
        variantNumber={variantNumber}
        bookmarked={bookmarked}
        isGeneratingVariation={isGeneratingVariation}
        onGenerateVariation={onGenerateVariation}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* 2. Tech Stack Version Badges */}
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

      {/* 3. AST Static Audit Indicator Bar */}
      <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
        {astAnalysis.map((item, aIdx) => (
          <span
            key={aIdx}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border shadow-2xs ${
              item.isViolation
                ? 'bg-rose-50 text-rose-900 border-rose-200/80'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200/80'
            }`}
          >
            {item.isViolation ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span>{item.text}</span>
          </span>
        ))}
      </div>

      {/* 4. Production Incident Lore Accordion */}
      {challenge.productionContext && (
        <BugIncidentAccordion productionContext={challenge.productionContext} />
      )}

      {/* 5. Problematic Code Snippet */}
      <CodeViewer
        code={challenge.codeSnippet}
        language={challenge.language}
        title={`${challenge.language.toUpperCase()} • Проблемный код`}
      />

      {/* 6. Hints Accordion */}
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
                    onClick={() => {
                      const nextOpen = isOpen ? null : idx;
                      setOpenHintIndex(nextOpen);
                      if (nextOpen !== null) {
                        onActionNotification?.(`💡 [ДЕЙСТВИЕ: Кандидат открыл на экране подсказку №${idx + 1}]: «${hint}»`);
                      }
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-semibold text-[#2D1B4E] hover:bg-pink-50/50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span>Подсказка #{idx + 1}</span>
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-pink-600" /> : <ChevronDown className="w-4 h-4 text-[#7E699B]" />}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        data-selection-zone="hint"
                        className="px-4 pb-3 pt-1 border-t border-pink-100 text-xs text-[#4A326D] bg-pink-50/30 leading-relaxed font-sans font-normal"
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

      {/* 7. Golden Master, Unified Diff & Key Takeaways Solution Panel */}
      <BugSolutionPanel
        challenge={challenge}
        unifiedDiffCode={unifiedDiffCode}
        takeaways={takeaways}
        bookmarked={bookmarked}
        onToggleBookmark={handleToggleBookmark}
        onActionNotification={onActionNotification}
      />
    </div>
  );
};

export default BugChallengeCard;
