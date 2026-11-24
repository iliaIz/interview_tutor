import React, { useState } from 'react';
import { 
  Sparkles, 
  Eye, 
  EyeOff, 
  Mic, 
  Timer, 
  Tag, 
  ShieldAlert, 
  ChevronRight, 
  ChevronLeft,
  Copy,
  Check,
  TrendingUp,
  Scale,
  Cpu,
  CircleDollarSign,
  Heart
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { HrStudyAudioBar } from './HrStudyAudioBar';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  metrics: TrendingUp,
  architecture: Cpu,
  legal: Scale,
  compensation: CircleDollarSign,
  motivation: Heart
};

import { HrSessionMode } from '@interview-prep/shared';

interface HrQuestionStudyDeckProps {
  onStartVoiceDrill: (overrideMode?: HrSessionMode) => void;
}

export const HrQuestionStudyDeck: React.FC<HrQuestionStudyDeckProps> = ({ onStartVoiceDrill }) => {
  const activeQuestion = useHrSimulatorStore((state) => state.activeQuestion);
  const nextQuestion = useHrSimulatorStore((state) => state.nextQuestion);
  const prevQuestion = useHrSimulatorStore((state) => state.prevQuestion);
  const questionsList = useHrSimulatorStore((state) => state.questionsList);
  const masteredBeatsByQuestion = useHrSimulatorStore((state) => state.masteredBeatsByQuestion);
  const selectedQuestionId = useHrSimulatorStore((state) => state.selectedQuestionId);

  const [showAnswer, setShowAnswer] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!activeQuestion) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Sparkles className="w-8 h-8 text-pastel-accentRose mb-2 animate-pulse" />
        <p className="text-sm">Загрузка каталога вопросов HR-скрининга...</p>
      </div>
    );
  }

  const currentIndex = questionsList.findIndex((q) => q.id === selectedQuestionId);
  const totalCount = questionsList.length || 1;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeQuestion.referenceAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 pb-8">
      {/* Top Breadcrumb & Navigation Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-pastel-muted uppercase tracking-wider px-2.5 py-1 bg-white rounded-lg border border-slate-200">
            Вопрос {currentIndex >= 0 ? currentIndex + 1 : 1} из {totalCount}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 bg-rose-50 text-pastel-accentRose rounded-lg border border-rose-100 flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            SLA: {activeQuestion.targetDurationSec.minSec}–{activeQuestion.targetDurationSec.maxSec}с
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={prevQuestion}
            disabled={currentIndex <= 0}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title="Предыдущий вопрос"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextQuestion}
            disabled={currentIndex >= totalCount - 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title="Следующий вопрос"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Flashcard Container */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-pastel-border shadow-sm relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pastel-rose/25 via-pastel-lavender/15 to-transparent rounded-full blur-2xl pointer-events-none -z-0" />

        <div className="relative z-10 space-y-5">
          {/* Canonical Question Title */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-pastel-muted mb-1 flex items-center gap-1.5">
              <span>Тема: {activeQuestion.title}</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 leading-snug">
              «{activeQuestion.canonicalQuestion}»
            </h2>
          </div>

          {/* Reference Answer Section */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-pastel-accentRose" />
                <span>Канонический эталонный ответ (SOTA):</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                  title="Скопировать эталонный ответ"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="text-xs font-semibold text-pastel-accentViolet hover:text-pastel-accentRose transition flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pastel-lavender/40 border border-pastel-accentViolet/20 cursor-pointer"
                >
                  {showAnswer ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Свернуть
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Показать ответ
                    </>
                  )}
                </button>
              </div>
            </div>

            {showAnswer && (
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-sm sm:text-base leading-relaxed text-slate-800 shadow-2xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeQuestion.referenceAnswer}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Required Anchors Section */}
          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-pastel-accentRose" />
              <span>Обязательные смысловые якоря (KWS Checklist):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(activeQuestion.requiredAnchors || []).map((anchor) => {
                const IconComponent = CATEGORY_ICONS[anchor.category] || Tag;
                return (
                  <div
                    key={anchor.id}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 truncate" title={anchor.label}>
                        {anchor.label}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {anchor.category} • вес: {anchor.weight}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Anti-Pattern Traps Section */}
          {activeQuestion.forbiddenPatterns && activeQuestion.forbiddenPatterns.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Капканы и анти-паттерны (Строго штрафуются ИИ):</span>
                </div>
                <div className="text-xs text-rose-700 mb-2">
                  Избегайте бытовых эвфемизмов и оправданий. Называние этих фраз немедленно срезает баллы по Lexical Density:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeQuestion.forbiddenPatterns.map((pat, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 text-xs font-mono"
                    >
                      «{pat}»
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Spec 40: Passive Study Audio Micro-Beats Bar */}
          <HrStudyAudioBar
            question={activeQuestion}
            masteredBeatIds={masteredBeatsByQuestion[activeQuestion.id] || []}
          />

          {/* Action Bridge: 1-Click to Voice Drill */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-pastel-rose/40 to-pastel-lavender/30 p-4 rounded-2xl border border-pastel-accentRose/20">
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-pastel-accentRose" />
                <span>Готовы закрепить ответ в речевой моторике?</span>
              </div>
              <div className="text-xs text-slate-600">
                Отработайте формулировки голосом без подглядывания. Тайминг ответа строго {activeQuestion.targetDurationSec.minSec}–{activeQuestion.targetDurationSec.maxSec} секунд.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => onStartVoiceDrill('guided_zero_start')}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                title="Пошаговый разбор с нуля: короткие блоки, эхо-повтор и постепенное снятие подсказок"
              >
                <Sparkles className="w-4 h-4" />
                <span>Учить с нуля (по шагам)</span>
              </button>
              <button
                onClick={() => onStartVoiceDrill()}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-pastel-accentRose hover:opacity-90 text-white font-bold text-xs shadow-md transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4 fill-white" />
                <span>Отработать вслух</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
