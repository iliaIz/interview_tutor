/**
 * useTopicCatalog.ts
 * Headless controller for TopicSelector catalog, search, and batch preparation.
 * SLA: <= 180 lines (Rule 8 compliant).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { TopicCatalogEngine, DomainGroupSummary, DomainDefinition } from '../../services/topics/TopicCatalogEngine';
import { FsrsQueueItemDTO } from '../../types/fsrs';

export function useTopicCatalog() {
  const {
    startStudyWithQuestions,
    shuffleMap,
    topicsProgress,
    syncTopicProgress,
    resetTopicProgress,
    showToast
  } = useAppStore();

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'domains' | 'grid'>('domains');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const [isGlobalShuffle, setIsGlobalShuffle] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
        if (Array.isArray(data)) {
          data.forEach((t: any) => {
            syncTopicProgress(t.id, t.completedCount || 0, t.percentage || 0, t.total || 0);
          });
        }
      }
    } catch (e) {
      console.error('Error fetching topics:', e);
    } finally {
      setLoading(false);
    }
  }, [syncTopicProgress]);

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  const toggleDomainCollapse = useCallback((domainId: string) => {
    setCollapsedDomains((prev) => ({
      ...prev,
      [domainId]: !prev[domainId]
    }));
  }, []);

  const domainOptions = useMemo(() => {
    return TopicCatalogEngine.computeDomainOptions(topics);
  }, [topics]);

  const activeDomainMeta = useMemo(() => {
    return domainOptions.find((d) => d.id === selectedDomain) || domainOptions[0];
  }, [domainOptions, selectedDomain]);

  const filteredTopics = useMemo(() => {
    return TopicCatalogEngine.filterTopics(topics, selectedDomain, searchQuery);
  }, [topics, selectedDomain, searchQuery]);

  const groupedDomains: DomainGroupSummary[] = useMemo(() => {
    return TopicCatalogEngine.computeDomainGroups(filteredTopics, topicsProgress);
  }, [filteredTopics, topicsProgress]);

  const handleStartTopic = useCallback(async (topicId: string, topicName: string, reset: boolean = false) => {
    setStartingTopicId(topicId);

    if (reset) {
      resetTopicProgress(topicId);
      try {
        await fetch(`/api/topics/${topicId}/reset`, { method: 'POST' });
      } catch (e) {
        console.warn('Error resetting topic progress on backend:', e);
      }
    }

    try {
      const isShuffle = isGlobalShuffle || shuffleMap[topicId] || false;
      const res = await fetch(`/api/topics/${topicId}/questions`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const allQuestions = data.questions || [];

      if (!allQuestions || allQuestions.length === 0) {
        showToast({
          type: 'warning',
          title: 'Вопросы не найдены',
          message: `Для темы "${topicName}" пока нет доступных вопросов.`
        });
        return;
      }

      const progress = topicsProgress[topicId];
      const localCompletedSet = new Set<string>(progress?.completedIds || []);

      const batchPortion = TopicCatalogEngine.prepareBlitzBatch(allQuestions, localCompletedSet, {
        reset,
        isShuffle
      });

      startStudyWithQuestions(topicId, topicName, batchPortion);
    } catch (e: any) {
      console.error('Error starting topic batch:', e);
      showToast({
        type: 'error',
        title: 'Ошибка загрузки вопросов',
        message: e?.message || 'Не удалось загрузить вопросы по выбранной теме.'
      });
    } finally {
      setStartingTopicId(null);
    }
  }, [isGlobalShuffle, shuffleMap, topicsProgress, resetTopicProgress, showToast, startStudyWithQuestions]);

  const handleStartBlitzReview = useCallback((queueItems: FsrsQueueItemDTO[]) => {
    if (!queueItems || queueItems.length === 0) return;
    const questionsForStudy = TopicCatalogEngine.transformFsrsQueue(queueItems);
    startStudyWithQuestions('fsrs_blitz', '⚡ Блиц-повторение (FSRS-5)', questionsForStudy as any);
  }, [startStudyWithQuestions]);

  return {
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
    handleStartBlitzReview,
    refetch: fetchTopics
  };
}
