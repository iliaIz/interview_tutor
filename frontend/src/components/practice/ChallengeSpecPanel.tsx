import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Sparkles,
  Zap,
  Lock,
  Unlock,
  ShieldAlert
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodingChallenge } from '../../types/practice';
import { RefactoringSmellChecklistPanel } from '../refactoring/RefactoringSmellChecklistPanel';

interface HintItem {
  title: string;
  content: string;
}

function buildDomainHints(challenge: CodingChallenge): HintItem[] {
  if (Array.isArray(challenge.hints) && challenge.hints.length > 0) {
    return challenge.hints.map((h, i) => ({
      title: `Подсказка ${i + 1}`,
      content: h
    }));
  }

  if (challenge.designPatternContext) {
    const dp = challenge.designPatternContext;
    return [
      {
        title: `Подсказка 1: Устранение запаха (${dp.antiPatternSmell.name})`,
        content: dp.antiPatternSmell.description
      },
      {
        title: `Подсказка 2: Целевой паттерн (${dp.targetPattern})`,
        content: dp.modernAlternativeTip || 'Разделите контракты на интерфейсы и инъектируйте зависимости через конструктор.'
      },
      {
        title: 'Подсказка 3: Защита контрактов',
        content: 'Все публичные сигнатуры, проверяемые существующими тестами, должны оставаться совместимыми во время рефакторинга.'
      }
    ];
  }

  if (challenge.challengeMode === 'write_the_tests' || challenge.track === 'testing_mutation') {
    return [
      {
        title: 'Подсказка 1: Граничные значения и эквивалентность',
        content: 'Проверьте нули, отрицательные значения, границы диапазонов (< vs <=) и null/empty входы, чтобы убивать мутантов границ.'
      },
      {
        title: 'Подсказка 2: Изоляция и детерминизм',
        content: 'Передавайте фиксированный java.time.Clock и проверяйте точные вызовы зависимостей и возвращаемые BigDecimal значения.'
      },
      {
        title: 'Подсказка 3: Антипаттерны AssertJ',
        content: 'Избегайте общих проверок isNotNull() без проверки полей. Каждый @Test должен проверять конкретный инвариант домена.'
      }
    ];
  }

  if (Array.isArray(challenge.smellsChecklist) && challenge.smellsChecklist.length > 0) {
    return challenge.smellsChecklist.slice(0, 3).map((s, idx) => ({
      title: `Подсказка ${idx + 1}: ${s.name}`,
      content: s.description
    }));
  }

  return [
    {
      title: 'Подсказка 1: Детерминизм и инварианты времени',
      content: 'Внедряйте java.time.Clock через конструктор и избегайте прямых вызовов Instant.now() или System.currentTimeMillis().'
    },
    {
      title: 'Подсказка 2: Финансовая точность и контракты',
      content: 'Используйте BigDecimal с RoundingMode.HALF_EVEN для денежных расчетов и не блокируйте поток I/O внутри synchronized.'
    },
    {
      title: 'Подсказка 3: Чистая структура модулей',
      content: 'Разделяйте публичные интерфейсы, доменную модель и детали хранения, сохраняя публичные контракты тестов.'
    }
  ];
}

function normalizeFourWeights(weights?: CodingChallenge['scoringWeights']): [number, number, number, number] {
  if (!weights) return [35, 25, 25, 15];
  const raw = [
    weights.functionalCorrectness ?? 0.35,
    weights.concurrencySafety ?? 0.25,
    weights.architectureAndCleanCode ?? 0.25,
    weights.modernIdioms ?? 0.15
  ];
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [35, 25, 25, 15];
  const p1 = Math.round((raw[0] / sum) * 100);
  const p2 = Math.round((raw[1] / sum) * 100);
  const p3 = Math.round((raw[2] / sum) * 100);
  const p4 = Math.max(0, 100 - p1 - p2 - p3);
  return [p1, p2, p3, p4];
}

export const ChallengeSpecPanel: React.FC = () => {
  const {
    activePracticeChallenge,
    activePracticePhase,
    setActivePracticePhase
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'spec' | 'phase2' | 'hints' | 'smells'>('spec');
  const [revealedHints, setRevealedHints] = useState<number[]>([]);

  useEffect(() => {
    setActiveTab('spec');
    setRevealedHints([]);
  }, [activePracticeChallenge?.id]);

  const derivedHints = useMemo(
    () => (activePracticeChallenge ? buildDomainHints(activePracticeChallenge) : []),
    [activePracticeChallenge]
  );

  if (!activePracticeChallenge) return null;

  const challenge = activePracticeChallenge;
  const isRefactoring =
    challenge.category === 'refactoring_kata' ||
    Boolean(challenge.smellsChecklist && challenge.smellsChecklist.length > 0);
  const phasedReq = challenge.phasedRequirements?.[0];
  const isPhase2Available = Boolean(phasedReq);
  const [wFunc, wConc, wArch, wIdiom] = normalizeFourWeights(challenge.scoringWeights);

  const toggleHint = (index: number) => {
    setRevealedHints((prev) =>
      prev.includes(index) ? prev.filter((h) => h !== index) : [...prev, index]
    );
  };

  const handleOpenPhase2Tab = () => {
    setActiveTab('phase2');
    if (activePracticePhase !== 2) {
      setActivePracticePhase(2);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md border-r border-pastel-border/80 text-pastel-text">
      {/* Compact Stack Metadata Strip (Title & Badge live in PracticeArenaHeader) */}
      <div className="px-4 py-2 border-b border-pastel-border/60 bg-pastel-bg/60 flex items-center justify-between gap-2 text-[11px] text-pastel-muted font-mono shrink-0">
        <span className="truncate">{challenge.targetStack}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-pastel-border text-pastel-text shrink-0 font-sans">
          {challenge.difficulty}
        </span>
      </div>

      {/* WAI-ARIA Tablist */}
      <div
        role="tablist"
        aria-label="Разделы спецификации задачи"
        className="flex items-center border-b border-pastel-border/60 px-2 bg-white overflow-x-auto no-scrollbar shrink-0"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'spec'}
          onClick={() => setActiveTab('spec')}
          className={`touch-target-44 flex items-center gap-1.5 py-2 px-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'spec'
              ? 'border-[#B5433E] text-pastel-accentRoseText'
              : 'border-transparent text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Спецификация</span>
        </button>

        {isPhase2Available && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'phase2'}
            onClick={handleOpenPhase2Tab}
            className={`touch-target-44 flex items-center gap-1.5 py-2 px-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer relative shrink-0 ${
              activeTab === 'phase2'
                ? 'border-pastel-accentViolet text-pastel-accentViolet'
                : 'border-transparent text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Фаза 2 (OCP)</span>
            {activePracticePhase === 2 && (
              <span className="w-2 h-2 rounded-full bg-pastel-accentViolet ml-0.5" />
            )}
          </button>
        )}

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'hints'}
          onClick={() => setActiveTab('hints')}
          className={`touch-target-44 flex items-center gap-1.5 py-2 px-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'hints'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Подсказки</span>
        </button>

        {isRefactoring && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'smells'}
            onClick={() => setActiveTab('smells')}
            className={`touch-target-44 flex items-center gap-1.5 py-2 px-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'smells'
                ? 'border-amber-600 text-amber-800 font-extrabold'
                : 'border-transparent text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
            <span>Аудит запахов</span>
            {challenge.smellsChecklist && challenge.smellsChecklist.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
                {challenge.smellsChecklist.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab Content Area */}
      <div
        role="tabpanel"
        className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed custom-scrollbar"
      >
        {activeTab === 'spec' && (
          <div className="space-y-4">
            {challenge.designPatternContext && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                    Целевой паттерн: {challenge.designPatternContext.targetPattern}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                    {challenge.designPatternContext.categoryTier === 'modern_alternatives'
                      ? 'Java 21'
                      : challenge.designPatternContext.categoryTier === 'anti_patterns'
                      ? 'Anti-Pattern'
                      : 'Spring GoF'}
                  </span>
                </div>
                <div className="text-[11px] text-indigo-950 font-medium">
                  <span className="font-bold text-rose-800">Устраняемый запах: </span>
                  {challenge.designPatternContext.antiPatternSmell.name} —{' '}
                  {challenge.designPatternContext.antiPatternSmell.description}
                </div>
                {challenge.designPatternContext.modernAlternativeTip && (
                  <div className="text-[11px] text-emerald-900 bg-emerald-50/90 p-2 rounded-xl border border-emerald-200/80">
                    <span className="font-bold">SOTA 2026 Идиома: </span>
                    {challenge.designPatternContext.modernAlternativeTip}
                  </div>
                )}
              </div>
            )}

            <div className="spec-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {challenge.instructionsMarkdown || challenge.scenarioMarkdown || ''}
              </ReactMarkdown>
            </div>

            {/* Normalized 4-Axis Scoring Weights (Strictly 100%) */}
            <div className="p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border space-y-2">
              <h2 className="font-bold text-xs text-pastel-text flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Критерии оценки решения (100%):</span>
              </h2>
              <ul className="space-y-1 text-[11px] text-pastel-muted">
                <li>• Функциональная корректность &amp; Бизнес-логика: <strong>{wFunc}%</strong></li>
                <li>• Потокобезопасность &amp; Ресурсы: <strong>{wConc}%</strong></li>
                <li>• Архитектура, SOLID &amp; Clean Code (OCP): <strong>{wArch}%</strong></li>
                <li>• Идиомы Java 21, Clock &amp; Тестируемость: <strong>{wIdiom}%</strong></li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'phase2' && isPhase2Available && phasedReq && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-950 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-950">
                  {phasedReq.title}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePracticePhase(activePracticePhase === 1 ? 2 : 1)}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-800 hover:text-purple-950 underline cursor-pointer"
                >
                  {activePracticePhase === 2 ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>{activePracticePhase === 2 ? 'Фаза 2 активна' : 'Активировать Фазу 2'}</span>
                </button>
              </div>
              <p className="text-xs leading-relaxed">{phasedReq.descriptionMarkdown}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-pastel-border space-y-2">
              <h3 className="font-bold text-xs text-pastel-text">Добавленные контракты Фазы 2:</h3>
              {phasedReq.addedFiles.map((f, i) => (
                <div key={i} className="text-[11px] font-mono bg-pastel-bg p-2 rounded-xl border border-pastel-border/60">
                  {f.path}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'hints' && (
          <div className="space-y-3">
            <p className="text-[11px] text-pastel-muted">
              Раскрывайте подсказки пошагово, если застряли. Каждая подсказка приближает к эталонной архитектуре:
            </p>

            {derivedHints.map((hint, idx) => {
              const isRevealed = revealedHints.includes(idx);

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-pastel-border/80 bg-white overflow-hidden shadow-2xs"
                >
                  <button
                    type="button"
                    aria-expanded={isRevealed}
                    onClick={() => toggleHint(idx)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-pastel-bg/50 transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-pastel-text flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{hint.title}</span>
                    </span>
                    {isRevealed ? (
                      <ChevronUp className="w-4 h-4 text-pastel-muted shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-pastel-muted shrink-0" />
                    )}
                  </button>
                  {isRevealed && (
                    <div className="p-3 pt-2 text-[11px] text-pastel-text leading-relaxed border-t border-pastel-border/40 bg-amber-50/40">
                      {hint.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'smells' && isRefactoring && (
          <RefactoringSmellChecklistPanel challenge={challenge} />
        )}
      </div>
    </div>
  );
};
