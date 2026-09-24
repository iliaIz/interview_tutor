import React from 'react';
import { ArrowLeft, ArrowRight, Mic, BookOpen, Brain } from 'lucide-react';

interface StudyReaderBarProps {
  currentIndex: number;
  totalBatch: number;
  questionNum: number;
  isLast: boolean;
  studyModality: 'voice' | 'text';
  onPrev: () => void;
  onNext: () => void;
  onStartVoiceBlitz: () => void;
  onStartTextQuiz: () => void;
}

export const StudyReaderBar: React.FC<StudyReaderBarProps> = ({
  currentIndex,
  totalBatch,
  questionNum,
  isLast,
  studyModality,
  onPrev,
  onNext,
  onStartVoiceBlitz,
  onStartTextQuiz,
}) => {
  return (
    <>
      {/* Sticky Reader Bar with Keyboard Hints for continuous reading */}
      <div className="sticky bottom-4 z-30 flex items-center justify-between bg-white/95 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-pastel-border shadow-lg">
        <div className="flex items-center gap-2">
          <button
            disabled={currentIndex === 0}
            onClick={onPrev}
            className="px-3 py-1.5 rounded-xl border border-pastel-border text-xs font-bold text-pastel-muted hover:text-pastel-text disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1.5 bg-pastel-bg/80 cursor-pointer active:scale-95"
            title="Предыдущая карточка (клавиша ←)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Назад</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] bg-white rounded border border-pastel-border font-mono">←</kbd>
          </button>

          <span className="text-xs font-bold text-pastel-text font-mono px-2">
            #{questionNum} ({currentIndex + 1}/{totalBatch})
          </span>

          <button
            disabled={isLast}
            onClick={onNext}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            title="Следующая карточка (клавиша →)"
          >
            <span className="hidden sm:inline">Вперед</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] bg-white/20 rounded border border-white/30 font-mono text-white">→</kbd>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartVoiceBlitz}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-lavender/70 hover:bg-pastel-accentViolet text-pastel-accentViolet hover:text-white text-xs font-bold transition border border-pastel-accentViolet/20 cursor-pointer shadow-2xs active:scale-95"
            title={`Пройти устное собеседование по всей группе (${totalBatch} вопр.) с итоговой оценкой`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Собеседование группы ({totalBatch})</span>
          </button>
        </div>

        <div className="text-[11px] font-medium text-pastel-muted hidden sm:flex items-center gap-1.5">
          <span>Навигация:</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-pastel-bg rounded border border-pastel-border font-mono">←</kbd>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-pastel-bg rounded border border-pastel-border font-mono">→</kbd>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          disabled={currentIndex === 0}
          onClick={onPrev}
          className="px-4 py-2.5 rounded-2xl border border-pastel-border text-sm font-semibold text-pastel-muted hover:text-pastel-text disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 bg-white shadow-2xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>

        {!isLast ? (
          <button
            onClick={onNext}
            className="px-5 py-2.5 rounded-2xl bg-pastel-accentRose text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-2xs cursor-pointer active:scale-95"
          >
            Следующая карточка <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {studyModality === 'voice' ? (
              <>
                <button
                  type="button"
                  onClick={onStartTextQuiz}
                  title="Пройти пошаговую проверку письменно с клавиатуры"
                  className="px-4 py-3 rounded-2xl border border-pastel-border bg-white text-pastel-muted hover:text-pastel-text text-xs font-bold hover:bg-pastel-bg/60 transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <BookOpen className="w-4 h-4 text-pastel-muted" />
                  <span>Письменно</span>
                </button>
                <button
                  type="button"
                  onClick={onStartVoiceBlitz}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-md transform hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Mic className="w-5 h-5 animate-pulse" />
                  <span>Голосовой блиц ({totalBatch} вопр.)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onStartVoiceBlitz}
                  title="Пройти устный опрос с Gemini Live (Авто-VAD)"
                  className="px-4 py-3 rounded-2xl border border-pastel-border bg-white text-pastel-muted hover:text-pastel-text text-xs font-bold hover:bg-pastel-bg/60 transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <Mic className="w-4 h-4 text-pastel-accentViolet" />
                  <span>Устно</span>
                </button>
                <button
                  type="button"
                  onClick={onStartTextQuiz}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-sm font-bold hover:opacity-95 transition flex items-center gap-2 shadow-md transform hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Brain className="w-5 h-5" />
                  <span>Проверка знаний ({totalBatch} вопр.)</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};
