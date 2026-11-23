/**
 * BugChallengeHeader.tsx
 * Pure presentation header for BugChallengeCard.
 * SLA: <= 150 lines (Rule 8 compliant).
 */

import React from 'react';
import { Bug, Award, Sparkles, Bookmark, BookmarkCheck } from 'lucide-react';
import { BugChallenge } from '../../hooks/useBugChallengeInspection';

interface BugChallengeHeaderProps {
  challenge: BugChallenge;
  variantNumber?: number;
  bookmarked: boolean;
  isGeneratingVariation?: boolean;
  onGenerateVariation?: () => void;
  onToggleBookmark: () => void;
}

export const BugChallengeHeader: React.FC<BugChallengeHeaderProps> = ({
  challenge,
  variantNumber,
  bookmarked,
  isGeneratingVariation = false,
  onGenerateVariation,
  onToggleBookmark
}) => {
  return (
    <div className="bg-gradient-to-br from-[#FFF5F8] via-[#FAF5FF] to-white rounded-2xl p-4 md:p-5 border border-pink-200/70 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 backdrop-blur-md">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100/90 text-rose-900 border border-rose-200/80 shadow-2xs">
            <Bug className="w-3.5 h-3.5 text-rose-700" />
            {challenge.categoryBadge || '⚡ Concurrency'}
          </span>

          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${
              challenge.difficultyBadge === 'Senior'
                ? 'bg-purple-100/90 text-[#4A1E6D] border-purple-200/80'
                : 'bg-emerald-100/90 text-emerald-950 border-emerald-200/80'
            }`}
          >
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
          onClick={onToggleBookmark}
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
  );
};
