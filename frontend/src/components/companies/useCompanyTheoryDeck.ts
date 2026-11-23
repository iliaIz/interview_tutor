/**
 * useCompanyTheoryDeck.ts
 * Headless controller for Company Theory Deck state, filtering, and mastery persistence.
 * SLA: <= 180 lines (Rule 8 compliant).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CompanyQuestionSummary, CompanyTrackContextAdapter } from '../../services/CompanyTrackContextAdapter';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { CompanyProfile } from '@interview-prep/shared';

export interface UseCompanyTheoryDeckOptions {
  companyProfile: CompanyProfile;
  onMasteryUpdated?: () => void;
}

export function useCompanyTheoryDeck({ companyProfile, onMasteryUpdated }: UseCompanyTheoryDeckOptions) {
  const [questions, setQuestions] = useState<CompanyQuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmastered' | 'mastered'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Active Live Voice Session on a specific question
  const [activeVoiceSession, setActiveVoiceSession] = useState<{
    question: CompanyQuestionSummary;
    mode: 'tutor' | 'interview';
  } | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${companyProfile.id}/questions`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status}): не удалось загрузить вопросы`);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[useCompanyTheoryDeck] Failed to load questions:', err);
      setError(err.message || 'Ошибка загрузки вопросов');
    } finally {
      setLoading(false);
    }
  }, [companyProfile.id]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      const mod = q.module || q.topic;
      if (mod) set.add(mod);
    });
    return Array.from(set);
  }, [questions]);

  const masteredCount = useMemo(() => {
    return questions.filter((q) => q.isMastered).length;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const qText = `${q.question} ${q.topic} ${q.answer}`.toLowerCase();
      const matchesSearch = !searchQuery || qText.includes(searchQuery.toLowerCase());
      const matchesModule = selectedModule === 'all' || q.module === selectedModule || q.topic === selectedModule;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'mastered' && q.isMastered) ||
        (statusFilter === 'unmastered' && !q.isMastered);

      return matchesSearch && matchesModule && matchesStatus;
    });
  }, [questions, searchQuery, selectedModule, statusFilter]);

  const handleToggleMastery = useCallback(async (q: CompanyQuestionSummary) => {
    const nextMastered = !q.isMastered;
    setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, isMastered: nextMastered } : item)));
    try {
      await fetch(`/api/companies/${companyProfile.id}/questions/${encodeURIComponent(q.id)}/mastery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isMastered: nextMastered, score: nextMastered ? 100 : 0 })
      });
      onMasteryUpdated?.();
    } catch (err) {
      console.error('[useCompanyTheoryDeck] Failed to persist mastery:', err);
    }
  }, [companyProfile.id, onMasteryUpdated]);

  /**
   * Opens Copilot Drawer with normalized question context WITHOUT auto-sending prompt.
   * Enforces Zero-Auto-Send Invariant.
   */
  const handleOpenCopilotDrawer = useCallback((q: CompanyQuestionSummary) => {
    const store = usePracticeTutorStore.getState();
    const context = CompanyTrackContextAdapter.createTheoryQuestionContext(companyProfile, q);
    store.setActiveContext(context);
    store.toggleOpen(true);
  }, [companyProfile]);

  /**
   * Launches Gemini Live Voice modal for question in Tutor or Interview mode.
   */
  const handleStartVoice = useCallback((q: CompanyQuestionSummary, mode: 'tutor' | 'interview') => {
    setActiveVoiceSession({ question: q, mode });
  }, []);

  const handleCloseVoice = useCallback(() => {
    setActiveVoiceSession(null);
  }, []);

  return {
    questions,
    filteredQuestions,
    modules,
    masteredCount,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    selectedModule,
    setSelectedModule,
    statusFilter,
    setStatusFilter,
    expandedId,
    setExpandedId,
    activeVoiceSession,
    handleToggleMastery,
    handleOpenCopilotDrawer,
    handleStartVoice,
    handleCloseVoice,
    refetch: fetchQuestions
  };
}
