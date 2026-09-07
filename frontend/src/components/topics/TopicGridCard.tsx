import React from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { getTopicIcon } from './topicIconRegistry';

interface TopicGridCardProps {
  topic: {
    id: string;
    name: string;
    description: string;
    total: number;
    category?: string;
    color: string;
    icon: string;
    percentage?: number;
  };
  percentage: number;
  isStarting: boolean;
  onOpenQuestions: (id: string, name: string) => void;
  onStartTopic: (id: string, name: string) => void;
}

export const TopicGridCard: React.FC<TopicGridCardProps> = ({
  topic: t,
  percentage,
  isStarting,
  onOpenQuestions,
  onStartTopic
}) => {
  const IconComponent = getTopicIcon(t.icon);

  return (
    <div className="bg-white/95 border border-pastel-border/80 hover:border-pastel-accentRose/40 rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-4 transition-all duration-200">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border/60">
            {t.category}
          </span>
          <span className="text-xs font-mono font-bold text-pastel-text">
            {percentage}%
          </span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div
            className="p-2.5 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${t.color}18`, color: t.color }}
          >
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-pastel-text truncate">{t.name}</h3>
            <p className="text-xs text-pastel-muted">{t.total} вопросов</p>
          </div>
        </div>

        <p className="text-xs text-pastel-muted line-clamp-2 leading-relaxed">
          {t.description}
        </p>
      </div>

      <div className="pt-3 border-t border-pastel-border/60 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenQuestions(t.id, t.name)}
          className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-pastel-bg text-pastel-text hover:bg-pastel-rose hover:text-pastel-accentRose border border-pastel-border transition cursor-pointer text-center"
        >
          Банк вопросов
        </button>

        <button
          onClick={() => onStartTopic(t.id, t.name)}
          disabled={isStarting}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition shadow-2xs cursor-pointer disabled:opacity-50"
        >
          {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          <span>Блиц</span>
        </button>
      </div>
    </div>
  );
};
