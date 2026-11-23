import { useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { usePracticeVoice } from '../tutor/PracticeVoiceContext';

export const usePracticeFindingBridge = () => {
  const {
    practiceWorkspaceFiles,
    setActiveWorkspaceFileIndex,
    setIsPracticeReportModalOpen
  } = useAppStore();

  const { startPracticeSessionWithReview } = usePracticeVoice();

  const handleStartVoiceDiscussion = useCallback((finding?: any) => {
    setIsPracticeReportModalOpen(false);

    if (finding?.location && typeof finding.location === 'string') {
      const match = finding.location.match(/([a-zA-Z0-9_]+)\.(java|[a-zA-Z0-9_]+)/);
      const targetClassOrFile = match ? match[1] : finding.location.split('.')[0];
      if (targetClassOrFile) {
        const foundIdx = practiceWorkspaceFiles.findIndex(
          (f) => f.path.includes(targetClassOrFile) || f.path.endsWith(`${targetClassOrFile}.java`)
        );
        if (foundIdx >= 0) {
          setActiveWorkspaceFileIndex(foundIdx);
        }
      }
    }

    void startPracticeSessionWithReview(finding);
  }, [practiceWorkspaceFiles, setActiveWorkspaceFileIndex, setIsPracticeReportModalOpen, startPracticeSessionWithReview]);

  return { handleStartVoiceDiscussion };
};
