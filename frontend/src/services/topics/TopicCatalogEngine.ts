/**
 * TopicCatalogEngine.ts
 * Deep domain module encapsulating topic catalog calculations, domain aggregations,
 * and deterministic FSRS blitz batch slicing.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import { FolderTree, Coffee, Zap, Database, Server, Activity, Palette } from 'lucide-react';
import { FsrsQueueItemDTO } from '../../types/fsrs';

export interface DomainDefinition {
  id: string;
  title: string;
  icon: any;
  color: string;
  desc: string;
}

export const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  { id: 'all', title: 'Все разделы', icon: FolderTree, color: '#6366F1', desc: 'Все 24 инженерные темы' },
  { id: 'Core Java & JVM', title: 'Core Java & JVM Internals', icon: Coffee, color: '#E08E89', desc: 'Синтаксис, память, ООП, Collections, Generics & JVM' },
  { id: 'Architecture & Concurrency', title: 'Architecture, Concurrency & Loom', icon: Zap, color: '#8B78E6', desc: 'JMM, Threads, Locks, Virtual Threads & Patterns' },
  { id: 'Data & Storage', title: 'Databases, Storage & ACID', icon: Database, color: '#5A9E96', desc: 'PostgreSQL, SQL, Hibernate, JPA, Транзакции & Redis' },
  { id: 'Web & Enterprise', title: 'Spring Enterprise & Architecture', icon: Server, color: '#4F8A8B', desc: 'Spring Boot, IoC, Spring Data, Security & Microservices' },
  { id: 'Engineering & Tools', title: 'Engineering, Testing & Forensics', icon: Activity, color: '#D97706', desc: 'Kafka, CI/CD, Docker, Тестирование & JFR Profiling' },
  { id: 'Frontend Basics', title: 'Frontend & Web Foundations', icon: Palette, color: '#E67E22', desc: 'Основы HTML, семантика, формы, CSS, Flexbox & Grid' }
];

export interface DomainGroupSummary extends DomainDefinition {
  topics: any[];
  totalQuestions: number;
  totalCompleted: number;
  percentage: number;
}

export class TopicCatalogEngine {
  /**
   * Filters topics by domain category and search query.
   */
  static filterTopics(topics: any[], selectedDomain: string, searchQuery: string): any[] {
    const q = searchQuery.trim().toLowerCase();
    return topics.filter((t) => {
      const matchesDomain = selectedDomain === 'all' || t.category === selectedDomain;
      const matchesSearch =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q);
      return matchesDomain && matchesSearch;
    });
  }

  /**
   * Computes available domain filter options with real topic counts.
   */
  static computeDomainOptions(topics: any[]): Array<DomainDefinition & { count: number }> {
    return DOMAIN_DEFINITIONS.map((def) => {
      const count = def.id === 'all'
        ? topics.length
        : topics.filter((t) => t.category === def.id).length;
      return { ...def, count };
    }).filter((d) => d.id === 'all' || d.count > 0);
  }

  /**
   * Aggregates topics into structured domain hubs with completion progress.
   */
  static computeDomainGroups(
    filteredTopics: any[],
    topicsProgress: Record<string, any>
  ): DomainGroupSummary[] {
    const map = new Map<string, any[]>();
    DOMAIN_DEFINITIONS.filter((d) => d.id !== 'all').forEach((d) => map.set(d.id, []));

    filteredTopics.forEach((t) => {
      const cat = t.category || 'Other';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(t);
    });

    return Array.from(map.entries())
      .map(([domainId, topicList]) => {
        const meta = DOMAIN_DEFINITIONS.find((d) => d.id === domainId) || {
          id: domainId,
          title: domainId,
          icon: FolderTree,
          color: '#8B78E6',
          desc: 'Специализированные темы подготовки'
        };

        const totalQuestions = topicList.reduce((acc, t) => acc + (t.total || 0), 0);
        const totalCompleted = topicList.reduce((acc, t) => {
          const p = topicsProgress[t.id];
          return acc + (p?.completedCount !== undefined ? p.completedCount : (t.completedCount || 0));
        }, 0);
        const percentage = totalQuestions > 0 ? Math.round((totalCompleted / totalQuestions) * 100) : 0;

        return {
          ...meta,
          topics: topicList,
          totalQuestions,
          totalCompleted,
          percentage
        };
      })
      .filter((d) => d.topics.length > 0);
  }

  /**
   * Slices an unmastered blitz batch (max 10 items) with fallback to all questions.
   */
  static prepareBlitzBatch(
    allQuestions: any[],
    completedIds: Set<string>,
    options: { reset?: boolean; isShuffle?: boolean } = {}
  ): any[] {
    if (!Array.isArray(allQuestions) || allQuestions.length === 0) return [];

    let remaining = options.reset
      ? allQuestions
      : allQuestions.filter((q) => !q.isCompleted && !completedIds.has(q.id));

    if (remaining.length === 0) {
      remaining = allQuestions;
    }

    if (options.isShuffle) {
      remaining = [...remaining].sort(() => Math.random() - 0.5);
    }

    return remaining.slice(0, 10);
  }

  /**
   * Transforms FSRS queue items into uniform study batch.
   */
  static transformFsrsQueue(queueItems: FsrsQueueItemDTO[]): any[] {
    return queueItems.map((q, idx) => ({
      id: q.questionId,
      topic: q.topic,
      question: q.question,
      answer: q.answer,
      num: idx + 1
    }));
  }
}
