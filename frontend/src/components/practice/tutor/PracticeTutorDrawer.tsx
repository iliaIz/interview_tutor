import React, { useState } from 'react';
import { usePracticeTutorStore, TutorPersona } from '../../../store/usePracticeTutorStore';
import { useAppStore, selectActiveWhiteboardArtifact } from '../../../store/useAppStore';
import { HintTiersDropdown } from './HintTiersDropdown';
import { TutorQuickActionChips } from './TutorQuickActionChips';
import { TutorMessageList } from './TutorMessageList';
import { TutorInputFooter } from './TutorInputFooter';
import { resolveTutorDomain } from './TutorDomain';
import { TRANSACTION_LAB_SCENARIOS } from '../../../data/transactionLabCatalog';
import { buildWorkspaceManifest } from '../../../utils/workspaceManifest';
import { X, MessageSquare, Mic, Bot } from 'lucide-react';

const PERSONA_LABELS: Record<TutorPersona, { name: string; badge: string }> = {
  junior_explainer: { name: 'Junior Explainer', badge: '🟢 L1: Начинающий' },
  middle_scaffold: { name: 'Middle Peer-Programmer', badge: '🟡 L2: Коллега' },
  senior_socratic: { name: 'Senior Socratic', badge: '🟣 L3: Сократ' },
  faang_interviewer: { name: 'FAANG Staff Interviewer', badge: '🔴 L4: Архитектор' },
};

export const PracticeTutorDrawer: React.FC = () => {
  const {
    isOpen,
    toggleOpen,
    toggleCompass,
    modality,
    setModality,
    persona,
    setPersona,
    assistanceLevel,
    setAssistanceLevel,
    messages,
    isLoading,
    currentStreamingText,
    sendMessage,
    requestHint,
    abortGeneration,
    clearMessages,
  } = usePracticeTutorStore();

  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    activeTransactionLabScenarioId,
    latestSandboxResult,
    latestMutationResult,
    latestTxEvaluation,
    academyBreadcrumbContext,
    activeTopicBugHunt,
    activeBugChallenge,
  } = useAppStore();

  const [inputVal, setInputVal] = useState('');

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  if (!isOpen) return null;

  const txScenario = activeTransactionLabScenarioId
    ? (TRANSACTION_LAB_SCENARIOS.find((s) => s.id === activeTransactionLabScenarioId) || TRANSACTION_LAB_SCENARIOS[0])
    : null;

  const domain = resolveTutorDomain({
    category: activePracticeChallenge?.category || '',
    track: activePracticeChallenge?.track || '',
    title: activePracticeChallenge?.title || '',
    hasActiveTxScenario: !!activeTransactionLabScenarioId,
  });

  // Format real-time compiler errors
  let compilerError: string | undefined = undefined;
  if (latestSandboxResult && !latestSandboxResult.isCompilable) {
    if (latestSandboxResult.syntaxErrors && latestSandboxResult.syntaxErrors.length > 0) {
      compilerError = latestSandboxResult.syntaxErrors
        .map((e) => `Строка ${e.lineNumber}: ${e.errorMessage}`)
        .join('\n');
    } else if (latestSandboxResult.error) {
      compilerError = latestSandboxResult.error;
    }
  }

  // Collect failure context
  const failureParts: string[] = [];
  if (latestSandboxResult) {
    const failedTests = latestSandboxResult.testResults?.filter((t) => t.status !== 'PASSED') || [];
    if (failedTests.length > 0) {
      failureParts.push(
        `Упавшие тесты (${failedTests.length}/${latestSandboxResult.testResults.length}):\n` +
          failedTests.map((t) => `• [${t.testName}] ${t.failureReason || 'провален'}`).join('\n')
      );
    }
    if (latestSandboxResult.concurrencyHarness?.deadlockDetected)
      failureParts.push('⚠️ КРИТИЧЕСКАЯ ОШИБКА: Обнаружен взаимный дедлок потоков (Deadlock Detected).');
    if (latestSandboxResult.concurrencyHarness?.raceConditionDetected)
      failureParts.push('⚠️ ВНИМАНИЕ: Обнаружено состояние гонки данных (Race Condition Detected).');
  }
  if (latestMutationResult) {
    if (!latestMutationResult.baselinePassed) {
      failureParts.push(`⚠️ Baseline упал: ${latestMutationResult.error || 'Тесты не прошли даже на исходном сервисе'}`);
    } else if (!latestMutationResult.passedThreshold) {
      failureParts.push(
        `⚠️ Мутации выжили: скор ${latestMutationResult.mutationScore.toFixed(0)}% (требуется >= ${latestMutationResult.requiredScore}%). Выжило мутантов: ${latestMutationResult.survivedCount} из ${latestMutationResult.totalMutants}.`
      );
    }
  }
  if (latestTxEvaluation && !latestTxEvaluation.isPassed) {
    failureParts.push(
      `⚠️ Архитектурные дефекты транзакций (Оценка: ${latestTxEvaluation.overallScore}/100):\n${latestTxEvaluation.summary}`
    );
    const methodViolations = Object.values(latestTxEvaluation.methodResults || {}).flatMap((m) =>
      m.violations.map((v) => `• Метод ${m.methodId}: ${v}`)
    );
    if (methodViolations.length > 0) failureParts.push(methodViolations.join('\n'));
  }

  const isBugHunt = !!activeBugChallenge;

  const currentContext = {
    kataId: activeBugChallenge?.id || txScenario?.id || activePracticeChallenge?.id || 'kata',
    kataTitle:
      activeBugChallenge?.title ||
      txScenario?.title ||
      activePracticeChallenge?.title ||
      (domain === 'lld' ? 'LLD Architecture Challenge'
        : domain === 'transactions' ? 'Spring Transactions Challenge'
        : 'Testing Kata'),
    kataCategory:
      activeBugChallenge
        ? (activeTopicBugHunt?.topicName || 'Bug Hunt')
        : txScenario
        ? 'Spring Transactions'
        : activePracticeChallenge?.category ||
          (domain === 'lld' ? 'Low-Level Design (LLD)'
            : domain === 'transactions' ? 'Transactions'
            : 'Testing Kata'),
    kataInstructions:
      activeBugChallenge
        ? [activeBugChallenge.description, activeBugChallenge.productionContext?.incidentSymptoms ? `Симптомы инцидента: ${activeBugChallenge.productionContext.incidentSymptoms}` : ''].filter(Boolean).join('\n\n')
        : txScenario?.problemStatement ||
          activePracticeChallenge?.instructionsMarkdown ||
          activePracticeChallenge?.scenarioMarkdown ||
          activePracticeChallenge?.shortDescription ||
          '',
    activeFilePath:
      activeBugChallenge
        ? 'ProductionDefect.java'
        : txScenario
        ? `${txScenario.services[0]?.className}.java`
        : currentFile?.path || (domain === 'lld' ? 'src/main/java/Service.java' : 'src/test/java/Test.java'),
    activeFileContent:
      activeBugChallenge
        ? activeBugChallenge.codeSnippet
        : txScenario
        ? txScenario.services
            .map((s) => `// ${s.className}\n` + s.methods.map((m) => m.codeSnippet).join('\n\n'))
            .join('\n\n')
        : currentFile?.content || '',
    survivingMutants: activePracticeChallenge?.mutants,
    compilerError,
    testFailureMessage: failureParts.length > 0 ? failureParts.join('\n\n') : undefined,
    activeWhiteboardSnippet: (() => {
      const wb = selectActiveWhiteboardArtifact(useAppStore.getState());
      if (wb?.code && wb.code.trim().length > 0)
        return { title: wb.title, code: wb.code, language: wb.language };
      return undefined;
    })(),
    workspaceManifest: buildWorkspaceManifest(practiceWorkspaceFiles, activeWorkspaceFileIndex),
    academyBridgeContext: academyBreadcrumbContext ? {
      courseId: academyBreadcrumbContext.courseId,
      stepId: `step-${academyBreadcrumbContext.stepNumber}`,
      moduleTitle: academyBreadcrumbContext.moduleTitle || academyBreadcrumbContext.stepTitle,
      learningObjective: academyBreadcrumbContext.learningObjective,
      targetConcepts: academyBreadcrumbContext.targetConcepts
    } : undefined,
  };

  const handleSend = () => {
    if (!inputVal.trim() || isLoading) return;
    const text = inputVal;
    setInputVal('');
    sendMessage(text, currentContext);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-white/95 backdrop-blur-2xl border-l border-pastel-accentRose/30 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-4 py-3 border-b border-pastel-border/70 bg-gradient-to-r from-[#FFF0F5] via-white to-pastel-lavender/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pastel-accentRose/10 border border-pastel-accentRose/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-pastel-accentRose" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-800">AI-Напарник (Co-Pilot)</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-pastel-accentRoseText border border-pastel-accentRose/20">
                {PERSONA_LABELS[persona].badge}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Парное программирование & Socratic Tutor</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setModality('text')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                modality === 'text' ? 'bg-white text-pastel-text shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Текстовый диалог со стримингом"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Текст</span>
            </button>
            <button
              onClick={() => setModality('voice')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                modality === 'voice' ? 'bg-white text-pastel-accentRose shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Голосовой диалог Gemini Live"
            >
              <Mic className="w-3 h-3" />
              <span>Голос</span>
            </button>
          </div>
          <button
            onClick={() => toggleOpen(false)}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scaffolding Persona & Assistance Level Controls */}
      <div className="px-4 py-2 border-b border-pastel-border/50 bg-slate-50/50 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Степень подсказок:</span>
          <span className="text-[11px] font-semibold text-slate-600">{PERSONA_LABELS[persona].name}</span>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setAssistanceLevel(lvl)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center ${
                assistanceLevel === lvl
                  ? 'bg-pastel-accentRose text-white border-pastel-accentRose shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-pastel-accentRose/40'
              }`}
            >
              {lvl === 1 ? 'Junior' : lvl === 2 ? 'Middle' : lvl === 3 ? 'Senior' : 'FAANG'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Chips Bar */}
      <div className="px-3 py-2 border-b border-pastel-border/40 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
        <HintTiersDropdown domain={domain} onSelectTier={(tier) => requestHint(tier, currentContext)} />
        <TutorQuickActionChips
          domain={domain}
          isBugHunt={isBugHunt}
          onSendMessage={(text) => sendMessage(text, currentContext)}
          onOpenCompass={() => toggleCompass(true)}
        />
      </div>

      <TutorMessageList
        modality={modality}
        messages={messages}
        isLoading={isLoading}
        currentStreamingText={currentStreamingText}
        onFallbackToText={() => setModality('text')}
      />

      <TutorInputFooter
        inputVal={inputVal}
        isLoading={isLoading}
        onInputChange={setInputVal}
        onSend={handleSend}
        onAbort={abortGeneration}
        onClear={clearMessages}
      />
    </div>
  );
};
