import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Lightbulb, Eye, EyeOff, Bug, CheckCircle2, Sparkles, Terminal, Flame, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface BugChallenge {
  id: string;
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
}

interface BugChallengeCardProps {
  challenge: BugChallenge;
  isSolved?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const BugChallengeCard: React.FC<BugChallengeCardProps> = ({
  challenge,
  isSolved = false,
  onRefresh,
  isLoading = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [openHintIndex, setOpenHintIndex] = useState<number | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCodeWithLineNumbers = (code: string, isFix = false) => {
    const lines = code.trim().split('\n');
    return (
      <div className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-md">
        <div className="bg-slate-800/90 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span className="font-semibold text-slate-300">
              {isFix ? 'Исправленный код (Solution)' : `${challenge.language.toUpperCase()} • Code Snippet`}
            </span>
          </div>
          <button
            onClick={() => handleCopy(code)}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer text-[11px]"
            title="Скопировать код"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>

        <pre className="p-4 font-mono text-xs md:text-sm overflow-x-auto m-0 leading-relaxed text-slate-100 selection:bg-rose-500/30">
          <code>
            {lines.map((line, idx) => (
              <div key={idx} className="table-row hover:bg-slate-800/40 transition-colors">
                <span className="table-cell text-right pr-4 select-none text-slate-500 text-[11px] font-mono w-8">
                  {idx + 1}
                </span>
                <span className="table-cell">{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-pastel-border shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pastel-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-pastel-rose text-pastel-accentRose flex items-center justify-center font-bold shadow-2xs">
            <Bug className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-sm md:text-base text-pastel-text">
                {challenge.title}
              </h4>
              {challenge.categoryBadge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-lavender/70 text-pastel-accentViolet border border-pastel-accentViolet/20">
                  {challenge.categoryBadge}
                </span>
              )}
              {challenge.difficultyBadge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  challenge.difficultyBadge === 'Senior'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {challenge.difficultyBadge}
                </span>
              )}
              {isSolved && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Решено
                </span>
              )}
            </div>
            <span className="text-[11px] text-pastel-muted font-medium">
              Подтема: <strong className="text-pastel-text">{challenge.subtopic}</strong>
            </span>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs font-semibold text-pastel-accentViolet hover:text-pastel-accentRose transition flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pastel-lavender/40 border border-pastel-accentViolet/20 cursor-pointer disabled:opacity-50"
            title="Сгенерировать другой пример бага"
          >
            <Sparkles className="w-3 h-3" />
            <span>{isLoading ? 'Генерация...' : 'Другой баг'}</span>
          </button>
        )}
      </div>

      {/* Code Snippet with Line Numbers */}
      {renderCodeWithLineNumbers(challenge.codeSnippet, false)}

      {/* Hints Accordion */}
      {challenge.hints && challenge.hints.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-semibold text-pastel-muted flex items-center gap-1 mb-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Подсказки (если застрял):</span>
          </div>
          {challenge.hints.map((hint, idx) => {
            const isOpen = openHintIndex === idx;
            return (
              <div key={idx} className="border border-pastel-border/70 rounded-xl overflow-hidden bg-pastel-bg/50">
                <button
                  type="button"
                  onClick={() => setOpenHintIndex(isOpen ? null : idx)}
                  className="w-full px-3.5 py-2 flex items-center justify-between text-left text-xs font-semibold text-pastel-text hover:bg-pastel-rose/30 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-amber-500 font-bold">Уровень {idx + 1}:</span>
                    {idx === 0 ? 'Направление внимания' : 'Локализация строк и механика'}
                  </span>
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-pastel-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-pastel-muted" />}
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3.5 pb-2.5 pt-1 text-xs text-pastel-text/90 leading-relaxed bg-white border-t border-pastel-border/40"
                    >
                      {hint}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Solution Toggle & Explanation */}
      <div className="pt-2 border-t border-pastel-border/60">
        <button
          onClick={() => setShowSolution(!showSolution)}
          className="w-full py-2 px-4 rounded-xl border border-pastel-border text-xs font-bold text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          {showSolution ? <EyeOff className="w-3.5 h-3.5 text-pastel-accentRose" /> : <Eye className="w-3.5 h-3.5 text-pastel-accentViolet" />}
          <span>{showSolution ? 'Скрыть правильное решение' : 'Показать правильное решение и объяснение'}</span>
        </button>

        <AnimatePresence>
          {showSolution && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs md:text-sm space-y-3"
            >
              <div>
                <h5 className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Суть ошибки и почему код ломается:
                </h5>
                <p className="text-emerald-950/90 leading-relaxed whitespace-pre-line">
                  {challenge.bugExplanation}
                </p>
              </div>

              {challenge.fixedCode && (
                <div className="mt-2">
                  <span className="font-bold text-emerald-900 block mb-1.5 text-xs">
                    Исправленная реализация:
                  </span>
                  {renderCodeWithLineNumbers(challenge.fixedCode, true)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
