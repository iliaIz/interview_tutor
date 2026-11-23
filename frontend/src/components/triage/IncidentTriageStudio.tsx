import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Activity, Flame } from 'lucide-react';
import { TriageCompassSheet } from './compass/TriageCompassSheet';
import { IncidentTriageTopBar } from './studio/IncidentTriageTopBar';
import { ThreadDumpVisualizer } from './studio/ThreadDumpVisualizer';
import { IncidentRcaTab } from './studio/IncidentRcaTab';
import { IncidentCommanderChatTab } from './studio/IncidentCommanderChatTab';
import { IncidentEvaluationModal } from './studio/IncidentEvaluationModal';
import { useIncidentInvestigation } from './hooks/useIncidentInvestigation';

export const IncidentTriageStudio: React.FC = () => {
  const {
    activeTriageIncident,
    closeTriageIncident,
    academyBreadcrumbContext,
    returnToAcademyStep
  } = useAppStore();

  const {
    activeTab,
    setActiveTab,
    isCompassOpen,
    setIsCompassOpen,
    phase,
    elapsedSeconds,
    handleMitigate,
    selectedMitigation,
    setSelectedMitigation,
    artifactViewMode,
    setArtifactViewMode,
    logSearchQuery,
    setLogSearchQuery,
    rcaHypothesis,
    setRcaHypothesis,
    preventionPlan,
    setPreventionPlan,
    isEvaluating,
    evaluationResult,
    setEvaluationResult,
    handleEvaluate,
    chatMessages,
    inputMessage,
    setInputMessage,
    isSendingMessage,
    handleSendMessage,
    handleAskTutorAboutRule,
    handleKeyDown
  } = useIncidentInvestigation();

  if (!activeTriageIncident) return null;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg text-pastel-text relative font-sans">
      {/* Top Bar */}
      <IncidentTriageTopBar
        title={activeTriageIncident.title}
        severity={activeTriageIncident.severity}
        academyBreadcrumbContext={academyBreadcrumbContext}
        returnToAcademyStep={returnToAcademyStep}
        closeTriageIncident={closeTriageIncident}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCompass={() => setIsCompassOpen(true)}
        onEvaluate={handleEvaluate}
        isEvaluating={isEvaluating}
        phase={phase}
        onMitigate={handleMitigate}
        elapsedSeconds={elapsedSeconds}
      />

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'symptoms' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  {activeTriageIncident.category}
                </span>
                <span className="text-xs font-mono font-bold text-rose-600 flex items-center gap-1">
                  <Flame className="w-4 h-4" />
                  <span>{activeTriageIncident.severity}</span>
                </span>
              </div>

              <h2 className="text-lg font-bold text-pastel-text">{activeTriageIncident.title}</h2>

              <div className="pt-2 border-t border-pastel-border/60">
                <span className="text-xs font-bold text-pastel-muted block mb-1">Симптомы сбоя и системное поведение:</span>
                <p className="text-xs text-pastel-text leading-relaxed whitespace-pre-line">
                  {activeTriageIncident.symptomsMarkdown}
                </p>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-pastel-bg border border-pastel-border text-xs font-mono text-pastel-text flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Триггер алерта: {activeTriageIncident.keyMetricTrigger}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'artifact' && (
          <div className="max-w-5xl 2xl:max-w-[2000px] mx-auto space-y-4">
            <ThreadDumpVisualizer
              rawArtifactText={activeTriageIncident.rawArtifactText || ''}
              artifactViewMode={artifactViewMode}
              setArtifactViewMode={setArtifactViewMode}
              logSearchQuery={logSearchQuery}
              setLogSearchQuery={setLogSearchQuery}
            />
          </div>
        )}

        {activeTab === 'rca' && (
          <IncidentRcaTab
            rcaHypothesis={rcaHypothesis}
            updateRcaHypothesis={setRcaHypothesis}
            preventionPlan={preventionPlan}
            updatePreventionPlan={setPreventionPlan}
            selectedMitigation={selectedMitigation}
            onSelectMitigation={setSelectedMitigation}
            onKeyDown={handleKeyDown}
          />
        )}

        {activeTab === 'incident_commander' && (
          <IncidentCommanderChatTab
            chatMessages={chatMessages}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            handleSendMessage={handleSendMessage}
            isSendingMessage={isSendingMessage}
            incidentTitle={activeTriageIncident.title}
          />
        )}
      </div>

      {/* Postmortem Evaluation Modal */}
      <IncidentEvaluationModal
        evaluationResult={evaluationResult}
        onClose={() => setEvaluationResult(null)}
      />

      {/* Triage Compass Modal Sheet (5 Golden SRE Rules) */}
      <TriageCompassSheet
        isOpen={isCompassOpen}
        onClose={() => setIsCompassOpen(false)}
        onAskTutorAboutRule={handleAskTutorAboutRule}
      />
    </div>
  );
};

export default IncidentTriageStudio;
