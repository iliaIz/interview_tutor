import React from 'react';
import { ArrowLeft, Mic, Loader2 } from 'lucide-react';

interface QuizHeaderProps {
  onBackToStudy: () => void;
  onGoToQuestionList: () => void;
  selectedTopicName: string;
  isVoiceReady: boolean;
  onOpenVoice: () => void;
}

export const QuizHeader: React.FC<QuizHeaderProps> = ({
  onBackToStudy,
  onGoToQuestionList,
  selectedTopicName,
  isVoiceReady,
  onOpenVoice
}) => {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToStudy}
            className="flex items-center gap-1.5 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition bg-white px-3 py-1.5 rounded-xl border border-pastel-border shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Карточки
          </button>
          <button
            onClick={onGoToQuestionList}
            className="text-xs font-medium text-pastel-muted hover:text-pastel-text transition px-2 py-1 cursor-pointer"
          >
            Список вопросов
          </button>
        </div>

        <span className="text-xs font-bold px-3 py-1 bg-pastel-rose text-pastel-accentRoseText rounded-full border border-pastel-accentRose/20">
          {selectedTopicName} — Проверка знания (ИИ)
        </span>

        <button
          onClick={onOpenVoice}
          disabled={!isVoiceReady}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm transition ${
            !isVoiceReady
              ? 'opacity-50 cursor-not-allowed bg-gray-400'
              : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-90 cursor-pointer'
          }`}
          title={!isVoiceReady ? "Инициализация AI Шлюза... Голосовой режим скоро станет доступен" : "Голосовой режим Live"}
        >
          {!isVoiceReady ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{!isVoiceReady ? 'AI Запуск...' : 'Голосовой режим Live'}</span>
        </button>
      </div>

      {/* Warmup alert if AI not ready */}
      {!isVoiceReady && (
        <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 shadow-xs">
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
          <div>
            <span className="font-semibold block">Инициализация AI Шлюза LiteLLM...</span>
            <p className="text-[11px] text-amber-800/80 mt-0.5">
              Модель оценки и голосовой режим станут доступны автоматически через несколько секунд.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
