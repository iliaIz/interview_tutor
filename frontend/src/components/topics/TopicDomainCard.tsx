import React from 'react';
import { ChevronDown, Crown, Zap, Loader2, FolderTree } from 'lucide-react';
import { getTopicIcon } from './topicIconRegistry';

export interface TopicDomainItem {
  id: string;
  name: string;
  description: string;
  total: number;
  color: string;
  icon: string;
  percentage?: number;
}

export interface DomainGroup {
  id: string;
  title: string;
  icon: any;
  color: string;
  desc: string;
  topics: TopicDomainItem[];
  totalQuestions: number;
  totalCompleted: number;
  percentage: number;
}

interface TopicDomainCardProps {
  domain: DomainGroup;
  isCollapsed: boolean;
  onToggleCollapse: (domainId: string) => void;
  topicsProgress: Record<string, any>;
  startingTopicId: string | null;
  topicAccessMap?: Record<string, any>;
  onOpenTopicQuestions: (id: string, name: string) => void;
  onStartTopic: (id: string, name: string) => void;
}

export const TopicDomainCard: React.FC<TopicDomainCardProps> = ({
  domain,
  isCollapsed,
  onToggleCollapse,
  topicsProgress,
  startingTopicId,
  topicAccessMap,
  onOpenTopicQuestions,
  onStartTopic
}) => {
  const DomainIcon = domain.icon || FolderTree;

  return (
    <div className="bg-white/95 border border-pastel-border/80 rounded-3xl overflow-hidden shadow-xs transition-all duration-200">
      {/* Domain Header Banner */}
      <div
        onClick={() => onToggleCollapse(domain.id)}
        className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-gradient-to-r from-pastel-bg/60 via-white to-pastel-bg/40 cursor-pointer hover:bg-pastel-rose/20 transition select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs"
            style={{ backgroundColor: `${domain.color}20`, color: domain.color }}
          >
            <DomainIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-pastel-text truncate">
                {domain.title}
              </h2>
              <span className="text-[11px] font-mono font-bold px-2 py-0.2 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border">
                {domain.topics.length} тем
              </span>
            </div>
            <p className="text-xs text-pastel-muted truncate hidden sm:block">
              {domain.desc}
            </p>
          </div>
        </div>

        {/* Right Progress & Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-mono font-bold text-pastel-text">
              {domain.totalCompleted} / {domain.totalQuestions} вопр.
            </div>
            <div className="w-24 h-1.5 bg-pastel-border rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet rounded-full transition-all duration-500"
                style={{ width: `${domain.percentage}%` }}
              />
            </div>
          </div>

          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
            {domain.percentage}%
          </span>

          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-pastel-muted hover:text-pastel-text transition"
            aria-label="Свернуть домен"
          >
            <ChevronDown
              className={`w-4 h-4 transform transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Topics List Inside Domain */}
      {!isCollapsed && (
        <div className="divide-y divide-pastel-border/60 border-t border-pastel-border/60">
          {domain.topics.map((t) => {
            const IconComponent = getTopicIcon(t.icon);
            const progress = topicsProgress[t.id];
            const percentage = progress?.percentage !== undefined ? progress.percentage : (t.percentage || 0);
            const isStarting = startingTopicId === t.id;
            const isFullyMastered = percentage === 100;
            const accessMeta = topicAccessMap?.[t.id];

            return (
              <div
                key={t.id}
                className="p-3.5 sm:p-4 hover:bg-pastel-bg/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Topic Details */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div
                    onClick={() => onOpenTopicQuestions(t.id, t.name)}
                    className="p-2.5 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: `${t.color}18`, color: t.color }}
                    title="Открыть список вопросов"
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        onClick={() => onOpenTopicQuestions(t.id, t.name)}
                        className="font-bold text-xs sm:text-sm text-pastel-text hover:text-pastel-accentRose transition-colors cursor-pointer"
                      >
                        {t.name}
                      </span>

                      {isFullyMastered ? (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" /> Mastered
                        </span>
                      ) : percentage > 0 ? (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {percentage}%
                        </span>
                      ) : null}

                      {accessMeta?.lastAccessedAt && (
                        <span className="text-[9px] font-semibold text-pastel-accentViolet bg-pastel-lavender/50 px-1.5 py-0.2 rounded-full border border-pastel-accentViolet/20 hidden md:inline">
                          Недавно
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-pastel-muted truncate mt-0.5 max-w-xl">
                      {t.description}
                    </p>
                  </div>
                </div>

                {/* Action Buttons: 2 Clear CTAs */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => onOpenTopicQuestions(t.id, t.name)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRose border border-pastel-border transition cursor-pointer"
                    title="Просмотреть все вопросы по теме"
                  >
                    <span>{t.total} вопросов</span>
                  </button>

                  <button
                    onClick={() => onStartTopic(t.id, t.name)}
                    disabled={isStarting}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition shadow-2xs cursor-pointer disabled:opacity-50 active:scale-95 touch-manipulation"
                  >
                    {isStarting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    <span>Блиц (10)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
