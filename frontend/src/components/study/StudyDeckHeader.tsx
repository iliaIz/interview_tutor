import React from 'react';
import { Mic, Headphones } from 'lucide-react';

interface StudyDeckHeaderProps {
  selectedTopicId: string | null;
  topicTitle: string;
  currentIndex: number;
  totalBatch: number;
  onBackToTopics: () => void;
  onOpenTopicQuestions: () => void;
  onStartVoiceBlitz: () => void;
  onRecapBatch: () => void;
}

export const StudyDeckHeader: React.FC<StudyDeckHeaderProps> = ({
  selectedTopicId,
  topicTitle,
  currentIndex,
  totalBatch,
  onBackToTopics,
  onOpenTopicQuestions,
  onStartVoiceBlitz,
  onRecapBatch,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white/75 backdrop-blur-md px-4 py-3 rounded-2xl border border-pastel-border shadow-2xs">
      <div className="flex items-center gap-2">
        <button
          onClick={onBackToTopics}
          className="text-xs font-semibold text-pastel-muted hover:text-pastel-text transition flex items-center gap-1 cursor-pointer"
        >
          ← Темы
        </button>
        <span className="text-pastel-muted/50">•</span>
        <button
          onClick={() => {
            if (selectedTopicId) onOpenTopicQuestions();
          }}
          className="text-xs font-semibold text-pastel-accentViolet hover:underline transition"
        >
          {topicTitle}
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <span className="text-xs font-bold text-pastel-text bg-pastel-rose px-3 py-1 rounded-full border border-pastel-accentRose/20">
          Карточка {currentIndex + 1} из {totalBatch}
        </span>
        <button
          onClick={onStartVoiceBlitz}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition cursor-pointer shadow-2xs active:scale-95"
          title={`Пройти устное собеседование по всей группе (${totalBatch} вопр.) с итоговой оценкой`}
        >
          <Mic className="w-3 h-3" /> Собеседование порции ({totalBatch})
        </button>
        <button
          onClick={onRecapBatch}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-pastel-lavender/60 text-pastel-accentViolet border border-pastel-accentViolet/20 hover:bg-pastel-accentViolet hover:text-white transition cursor-pointer"
          title="AI-аудиопересказ всей текущей порции"
        >
          <Headphones className="w-3 h-3" /> Пересказ порции
        </button>
      </div>
    </div>
  );
};
