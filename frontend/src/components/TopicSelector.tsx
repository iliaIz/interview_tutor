/**
 * TopicSelector.tsx
 * Orchestrator view for Knowledge Base Topic Selection (SPEC-29).
 * Decomposed into deep TopicCatalogEngine, useTopicCatalog hook, and presenter components.
 * SLA: <= 160 lines (Rule 8 compliant).
 */

import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { useTopicCatalog } from './topics/useTopicCatalog';
import { TopicCatalogToolbar } from './topics/TopicCatalogToolbar';
import { TopicDomainAccordionList } from './topics/TopicDomainAccordionList';
import { TopicCardGrid } from './topics/TopicCardGrid';
import { DailySmartReviewBanner } from './DailySmartReviewBanner';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';
import { Search } from 'lucide-react';

export const TopicSelector: React.FC = () => {
  const { openTopicQuestions, topicsProgress, topicAccessMap } = useAppStore();

  const {
    topics,
    loading,
    startingTopicId,
    viewMode,
    setViewMode,
    selectedDomain,
    setSelectedDomain,
    searchQuery,
    setSearchQuery,
    collapsedDomains,
    toggleDomainCollapse,
    isGlobalShuffle,
    setIsGlobalShuffle,
    isDropdownOpen,
    setIsDropdownOpen,
    isRadarOpen,
    setIsRadarOpen,
    domainOptions,
    activeDomainMeta,
    filteredTopics,
    groupedDomains,
    handleStartTopic,
    handleStartBlitzReview
  } = useTopicCatalog();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-sans">
        <div className="w-10 h-10 border-3 border-pastel-accentRose border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-mono text-pastel-muted">Загрузка Базы знаний...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in font-sans pb-24">
      {/* 0. Daily Smart Review Banner (FSRS-5 SOTA) */}
      <DailySmartReviewBanner
        onStartBlitz={handleStartBlitzReview}
        onOpenRadar={() => setIsRadarOpen(true)}
      />

      {/* 1. Omni-Toolbar */}
      <TopicCatalogToolbar
        totalTopics={topics.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedDomain={selectedDomain}
        setSelectedDomain={setSelectedDomain}
        domainOptions={domainOptions}
        activeDomainMeta={activeDomainMeta}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        isGlobalShuffle={isGlobalShuffle}
        setIsGlobalShuffle={setIsGlobalShuffle}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* 2. Topics Body */}
      {filteredTopics.length === 0 ? (
        <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-12 text-center shadow-xs space-y-3 animate-fade-in">
          <Search className="w-10 h-10 text-pastel-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-pastel-text">Темы не найдены</h3>
          <p className="text-xs text-pastel-muted max-w-sm mx-auto leading-relaxed">
            {searchQuery ? (
              <>По запросу «<strong className="text-pastel-text">{searchQuery}</strong>» ничего не найдено в разделе «{activeDomainMeta.title}».</>
            ) : (
              <>В выбранном разделе пока нет тем.</>
            )}
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDomain('all');
              }}
              className="px-4 py-2 rounded-xl bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRoseText text-xs font-bold border border-pastel-border transition cursor-pointer"
            >
              Сбросить фильтры (Esc)
            </button>
          </div>
        </div>
      ) : viewMode === 'domains' ? (
        <TopicDomainAccordionList
          groupedDomains={groupedDomains}
          collapsedDomains={collapsedDomains}
          toggleDomainCollapse={toggleDomainCollapse}
          topicsProgress={topicsProgress}
          topicAccessMap={topicAccessMap}
          startingTopicId={startingTopicId}
          onOpenQuestions={openTopicQuestions}
          onStartTopic={handleStartTopic}
        />
      ) : (
        <TopicCardGrid
          filteredTopics={filteredTopics}
          topicsProgress={topicsProgress}
          startingTopicId={startingTopicId}
          onOpenQuestions={openTopicQuestions}
          onStartTopic={handleStartTopic}
        />
      )}

      {/* Memory Radar Drawer (FSRS-5 SOTA) */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        onSelectTopicForPractice={(topic) => {
          setSelectedDomain('all');
          setSearchQuery(topic);
        }}
        onStartBlitzWithQuestions={handleStartBlitzReview}
      />
    </div>
  );
};
