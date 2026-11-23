/**
 * CompanyTheoryDeckTab.tsx
 * Orchestrator view for Company Curated Theory Deck (SPEC-27 & SPEC-29).
 * Decomposed into deep headless hook and focused presenter components.
 * SLA: <= 180 lines (Rule 8 compliant).
 */

import React from 'react';
import { CompanyProfile } from '@interview-prep/shared';
import { useCompanyTheoryDeck } from './useCompanyTheoryDeck';
import { CompanyTheoryHeader } from './CompanyTheoryHeader';
import { CompanyQuestionItem } from './CompanyQuestionItem';
import { VoiceModal } from '../VoiceModal';
import { CompanyTrackContextAdapter } from '../../services/CompanyTrackContextAdapter';
import { RefreshCw } from 'lucide-react';
import { AudioPlayoutManager } from '../../services/AudioPlayoutManager';

interface CompanyTheoryDeckTabProps {
  companyId: string;
  companyName: string;
  companyProfile?: CompanyProfile;
  onMasteryUpdated?: () => void;
}

export const CompanyTheoryDeckTab: React.FC<CompanyTheoryDeckTabProps> = ({
  companyId,
  companyName,
  companyProfile,
  onMasteryUpdated
}) => {
  const profile: CompanyProfile = companyProfile || {
    id: companyId,
    name: companyName,
    brandColor: '#EF3124',
    logoBadge: '🅰️',
    tagline: 'Technical Interview Preparation',
    culture: {
      engineeringParadigm: 'Product Engineer',
      metricsFocus: [],
      redFlags: [],
      greenFlags: []
    },
    expressRunbook: {
      pitchScriptMarkdown: '',
      mustReviewTaskIds: [],
      mustReviewTasks: [],
      checklist: []
    },
    stages: [],
    competencies: []
  };

  const {
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
    refetch
  } = useCompanyTheoryDeck({
    companyProfile: profile,
    onMasteryUpdated
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3 font-sans">
        <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Загрузка теоретического дека...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2 font-sans">
        <p className="text-sm font-bold text-rose-800">{error}</p>
        <button
          onClick={() => void refetch()}
          className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  const voiceProps = activeVoiceSession
    ? CompanyTrackContextAdapter.createVoiceSessionProps(profile, activeVoiceSession.question, activeVoiceSession.mode)
    : null;

  return (
    <div className="space-y-6 font-sans">
      <CompanyTheoryHeader
        companyName={companyName}
        totalCount={questions.length}
        masteredCount={masteredCount}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedModule={selectedModule}
        setSelectedModule={setSelectedModule}
        modules={modules}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* Questions List */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-3xl border border-slate-200/80 text-xs font-medium">
            Вопросы по заданным фильтрам не найдены.
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <CompanyQuestionItem
              key={q.id}
              question={q}
              isExpanded={expandedId === q.id}
              onToggleExpand={() => setExpandedId(expandedId === q.id ? null : q.id)}
              onToggleMastery={() => void handleToggleMastery(q)}
              onStartVoiceTutor={() => {
                AudioPlayoutManager.warmup();
                handleStartVoice(q, 'tutor');
              }}
              onStartVoiceScreening={() => {
                AudioPlayoutManager.warmup();
                handleStartVoice(q, 'interview');
              }}
              onOpenCopilotDrawer={() => handleOpenCopilotDrawer(q)}
            />
          ))
        )}
      </div>

      {/* Live Voice Modal for Question */}
      {activeVoiceSession && voiceProps && (
        <VoiceModal
          isOpen={Boolean(activeVoiceSession)}
          onClose={handleCloseVoice}
          topic={voiceProps.topic}
          currentQuestionText={voiceProps.currentQuestionText}
          referenceAnswer={voiceProps.referenceAnswer}
          initialSessionType={voiceProps.initialSessionType}
          initialTutorMode={voiceProps.initialTutorMode}
          customPromptOverride={voiceProps.customPromptOverride}
          vadPauseMs={800}
        />
      )}
    </div>
  );
};
