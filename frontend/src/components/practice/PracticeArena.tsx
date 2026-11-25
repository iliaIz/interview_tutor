import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PracticeCatalog } from './PracticeCatalog';
import { TransactionLabArena } from './TransactionLabArena';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { usePracticeVoice } from './tutor/PracticeVoiceContext';
import { StudioErrorBoundary } from '../StudioErrorBoundary';
import { VoiceModal } from '../VoiceModal';
import { TransactionScenario } from '../../types/transactionLab';
import { resolveTutorDomain } from './tutor/TutorDomain';
import { PracticeArenaWorkspace } from './arena/PracticeArenaWorkspace';

const PracticeVoiceDefenseGate: React.FC<{ isVoiceDefenseOpen: boolean }> = ({ isVoiceDefenseOpen }) => {
  const { isConnected, disconnect } = usePracticeVoice();
  React.useEffect(() => {
    if (isVoiceDefenseOpen && isConnected) {
      disconnect();
    }
  }, [isVoiceDefenseOpen, isConnected, disconnect]);
  return null;
};

export const PracticeArena: React.FC = () => {
  const {
    activePracticeChallenge,
    closePracticeChallenge,
    activeTransactionLabScenarioId,
    closeTransactionLab
  } = useAppStore();

  const { initChallengeContext } = usePracticeTutorStore();

  React.useEffect(() => {
    if (activeTransactionLabScenarioId !== null) {
      initChallengeContext('transactions', 'Spring Transactions Lab');
    } else if (activePracticeChallenge) {
      const domain = resolveTutorDomain({
        category: activePracticeChallenge.category,
        track: activePracticeChallenge.track,
        title: activePracticeChallenge.title
      });
      initChallengeContext(domain, activePracticeChallenge.title);
    }
  }, [activePracticeChallenge?.id, activeTransactionLabScenarioId, initChallengeContext]);

  const [activeVoiceDefenseScenario, setActiveVoiceDefenseScenario] = useState<TransactionScenario | null>(null);
  const [voiceDefenseQuestion, setVoiceDefenseQuestion] = useState<string>('');
  const [isVoiceDefenseOpen, setIsVoiceDefenseOpen] = useState(false);

  const handleStartTransactionVoiceDefense = (scenario: TransactionScenario, question: string) => {
    setActiveVoiceDefenseScenario(scenario);
    setVoiceDefenseQuestion(question);
    setIsVoiceDefenseOpen(true);
  };

  if (activeTransactionLabScenarioId !== null) {
    return (
      <>
        <PracticeVoiceDefenseGate isVoiceDefenseOpen={isVoiceDefenseOpen} />
        <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden">
          <TransactionLabArena
            initialScenarioId={activeTransactionLabScenarioId}
            onBack={closeTransactionLab}
            onStartVoiceDefense={handleStartTransactionVoiceDefense}
          />

          {isVoiceDefenseOpen && activeVoiceDefenseScenario && (
            <VoiceModal
              key={`tx_defense_${activeVoiceDefenseScenario.id}`}
              isOpen={isVoiceDefenseOpen}
              onClose={() => {
                setIsVoiceDefenseOpen(false);
                setActiveVoiceDefenseScenario(null);
              }}
              questionId={activeVoiceDefenseScenario.id}
              topic={`Spring Transactions: ${activeVoiceDefenseScenario.title}`}
              currentQuestionText={voiceDefenseQuestion || activeVoiceDefenseScenario.title}
              referenceAnswer={activeVoiceDefenseScenario.problemStatement}
              initialSessionType="tutor"
              initialTutorMode="practice_pair"
            />
          )}
        </div>
      </>
    );
  }

  if (!activePracticeChallenge) {
    return <PracticeCatalog />;
  }

  return (
    <StudioErrorBoundary
      fallbackTitle="Ошибка рабочей области Арены"
      fallbackDescription="Не удалось отобразить файлы задачи или редактор. Вы можете вернуться к каталогу задач."
      onReset={closePracticeChallenge}
    >
      <PracticeArenaWorkspace activePracticeChallenge={activePracticeChallenge} />
    </StudioErrorBoundary>
  );
};
