import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, BookOpen, Brain, Headphones, X } from 'lucide-react';

interface QuestionBatchActionDockProps {
  selectedCount: number;
  activeAudioJob: boolean;
  onStartVoice: () => void;
  onStartStudy: () => void;
  onStartQuiz: () => void;
  onStartRecap: () => void;
  onClearSelection: () => void;
}

export const QuestionBatchActionDock: React.FC<QuestionBatchActionDockProps> = ({
  selectedCount,
  activeAudioJob,
  onStartVoice,
  onStartStudy,
  onStartQuiz,
  onStartRecap,
  onClearSelection
}) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`fixed ${activeAudioJob ? 'bottom-24' : 'bottom-6'} inset-x-0 mx-auto max-w-2xl px-4 z-40 transition-all duration-300`}
        >
          <div className="pastel-glass rounded-2xl p-3 shadow-2xl border border-white/80 flex flex-wrap items-center justify-between gap-3 backdrop-blur-xl bg-white/95">
            {/* Selected Count Indicator */}
            <div className="flex items-center gap-2 pl-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pastel-accentRose animate-pulse"></span>
              <span className="text-xs font-bold text-pastel-text">
                Выбрано: <strong className="text-pastel-accentRoseText text-sm">{selectedCount}</strong> вопр.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Voice Interview Selected */}
              <button
                onClick={onStartVoice}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-95 transition transform hover:scale-105 cursor-pointer"
                title="Запустить непрерывное голосовое собеседование по выбранным вопросам"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Собеседование ({selectedCount})</span>
              </button>

              {/* Study Selected */}
              <button
                onClick={onStartStudy}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-pastel-border text-pastel-text rounded-xl text-xs font-bold shadow-xs hover:bg-pastel-card transition transform hover:scale-105 cursor-pointer"
                title="Начать изучение выбранных карточек"
              >
                <BookOpen className="w-3.5 h-3.5 text-pastel-accentRoseText" />
                <span>Изучать ({selectedCount})</span>
              </button>

              {/* AI Quiz Selected */}
              <button
                onClick={onStartQuiz}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-pastel-text text-white rounded-xl text-xs font-bold shadow-sm hover:bg-black transition transform hover:scale-105 cursor-pointer"
                title="Запустить проверку знаний с ИИ по выбранным вопросам"
              >
                <Brain className="w-3.5 h-3.5 text-pastel-accentViolet" />
                <span>Квиз ({selectedCount})</span>
              </button>

              {/* Audio Podcast Selected */}
              <button
                onClick={onStartRecap}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/40 rounded-xl text-xs font-bold hover:bg-pastel-accentRose hover:text-white transition cursor-pointer"
                title="Сгенерировать аудиоподкаст по выбранным вопросам"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Аудио</span>
              </button>

              {/* Clear Selection */}
              <button
                onClick={onClearSelection}
                className="p-2 text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg rounded-xl transition cursor-pointer"
                title="Снять выбор (Escape)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
