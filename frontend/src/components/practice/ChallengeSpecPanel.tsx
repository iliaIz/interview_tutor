import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Zap,
  Lock,
  Unlock
} from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';

export const ChallengeSpecPanel: React.FC = () => {
  const {
    activePracticeChallenge,
    activePracticePhase,
    setActivePracticePhase,
    practiceElapsedSeconds
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'spec' | 'phase2' | 'hints'>('spec');
  const [revealedHints, setRevealedHints] = useState<number[]>([]);

  if (!activePracticeChallenge) return null;

  const challenge = activePracticeChallenge;
  const phasedReq = challenge.phasedRequirements?.[0];
  const isPhase2Available = Boolean(phasedReq);
  const unlockMinutes = phasedReq?.unlockTimeMinutes || 45;
  const isPhase2TimeReached = practiceElapsedSeconds >= unlockMinutes * 60;

  const toggleHint = (index: number) => {
    if (revealedHints.includes(index)) {
      setRevealedHints(revealedHints.filter((h) => h !== index));
    } else {
      setRevealedHints([...revealedHints, index]);
    }
  };

  const defaultHints = [
    {
      title: 'Подсказка 1: Архитектурное направление',
      content: 'Используйте паттерны Strategy / Factory для разделения алгоритмов от бизнес-логики сервиса. Избегайте жесткой привязки к конкретным классам.'
    },
    {
      title: 'Подсказка 2: Потокобезопасность & JMM',
      content: 'Для высоких нагрузок избегайте synchronized на весь метод. Используйте ConcurrentHashMap.computeIfAbsent, AtomicLong или ReentrantLock для изоляции критических секций.'
    },
    {
      title: 'Подсказка 3: Совместимость с Virtual Threads (Loom)',
      content: 'Никогда не выполняйте блокирующий I/O (HTTP, БД, Thread.sleep) внутри блоков synchronized. Это приводит к carrier thread pinning.'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md border-r border-pastel-border/80 text-pastel-text">
      {/* Top Header info */}
      <div className="p-4 border-b border-pastel-border/60 bg-pastel-bg/50">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {challenge.taskNumber && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-900 text-pastel-accentRose border border-slate-700/60 shrink-0">
                #{String(challenge.taskNumber).padStart(2, '0')}
              </span>
            )}
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20 truncate">
              {challenge.badge}
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-card border border-pastel-border text-pastel-muted shrink-0">
            {challenge.difficulty}
          </span>
        </div>
        <h2 className="font-bold text-base text-pastel-text leading-snug">
          {challenge.title}
        </h2>
        <p className="text-[11px] text-pastel-muted mt-1 font-mono">
          🛠️ {challenge.targetStack}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-pastel-border/60 px-3 bg-white">
        <button
          onClick={() => setActiveTab('spec')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'spec'
              ? 'border-pastel-accentRose text-pastel-accentRose'
              : 'border-transparent text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Спецификация</span>
        </button>

        {isPhase2Available && (
          <button
            onClick={() => setActiveTab('phase2')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer relative ${
              activeTab === 'phase2'
                ? 'border-pastel-accentViolet text-pastel-accentViolet'
                : 'border-transparent text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Фаза 2 (OCP)</span>
            {activePracticePhase === 2 && (
              <span className="w-2 h-2 rounded-full bg-pastel-accentViolet animate-pulse ml-1" />
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('hints')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'hints'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Подсказки</span>
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed custom-scrollbar">
        {activeTab === 'spec' && (
          <div className="space-y-4">
            <div className="max-w-none text-pastel-text">
              <MarkdownRenderer content={challenge.instructionsMarkdown || challenge.scenarioMarkdown || ''} />
            </div>

            {/* Invariants and Scoring Rules */}
            <div className="p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border space-y-2">
              <h4 className="font-bold text-xs text-pastel-text flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Критерии оценки решения (Веса SOTA 2026):</span>
              </h4>
              <ul className="space-y-1 text-[11px] text-pastel-muted">
                <li>• Функциональная корректность & Бизнес-логика: <strong>{Math.round((challenge.scoringWeights?.functionalCorrectness ?? 0.4) * 100)}%</strong></li>
                <li>• Потокобезопасность & Ресурсы: <strong>{Math.round((challenge.scoringWeights?.concurrencySafety ?? 0.2) * 100)}%</strong></li>
                <li>• Архитектура, SOLID & Clean Code (OCP): <strong>{Math.round((challenge.scoringWeights?.architectureAndCleanCode ?? 0.2) * 100)}%</strong></li>
                <li>• Детерминированность & Тестируемость (Clock): <strong>{Math.round((challenge.scoringWeights?.modernIdioms ?? 0.1) * 100)}%</strong></li>
                <li>• Идиомы Java 21 (Records / Sealed): <strong>10%</strong></li>
              </ul>
            </div>
          </div>
        )}


        {activeTab === 'phase2' && isPhase2Available && phasedReq && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-950 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                  {phasedReq.title}
                </span>
                <button
                  onClick={() => setActivePracticePhase(activePracticePhase === 1 ? 2 : 1)}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                >
                  {activePracticePhase === 2 ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>{activePracticePhase === 2 ? 'Фаза 2 активна' : 'Активировать Фазу 2 вручную'}</span>
                </button>
              </div>
              <div className="text-xs leading-relaxed">
                <MarkdownRenderer content={phasedReq.descriptionMarkdown} compact={true} />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-pastel-border space-y-2">
              <h4 className="font-bold text-xs text-pastel-text">Добавленные контракты Фазы 2:</h4>
              {phasedReq.addedFiles.map((f, i) => (
                <div key={i} className="text-[11px] font-mono bg-pastel-bg p-2 rounded-xl border border-pastel-border/60">
                  📄 {f.path}
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

            {defaultHints.map((hint, idx) => {
              const isRevealed = revealedHints.includes(idx);

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-pastel-border/80 bg-white overflow-hidden shadow-2xs"
                >
                  <button
                    onClick={() => toggleHint(idx)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-pastel-bg/50 transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-pastel-text flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {hint.title}
                    </span>
                    {isRevealed ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                  </button>
                  {isRevealed && (
                    <div className="p-3 pt-0 text-[11px] text-pastel-muted leading-relaxed border-t border-pastel-border/40 bg-amber-50/20">
                      {hint.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
