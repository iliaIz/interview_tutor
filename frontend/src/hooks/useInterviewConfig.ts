import { useState, useEffect, useCallback } from 'react';
import { InterviewConfig } from '../types/interviewConfig';
import { getActiveConfig, saveActiveConfig } from '../services/profileStorage';

/**
 * Custom hook providing a reactive, globally synchronized InterviewConfig.
 * Subscribes to window 'interview_config_updated' and 'storage' events
 * so any update in the header pill, settings drawer, or lobby immediately
 * synchronizes across all mounted components.
 */
export function useInterviewConfig() {
  const [config, setConfigState] = useState<InterviewConfig>(() => getActiveConfig());

  useEffect(() => {
    const handleUpdate = (e?: Event) => {
      const customEvent = e as CustomEvent<InterviewConfig> | undefined;
      if (customEvent?.detail) {
        setConfigState(customEvent.detail);
      } else {
        setConfigState(getActiveConfig());
      }
    };

    window.addEventListener('interview_config_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('interview_config_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updateConfig = useCallback((patch: Partial<InterviewConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      saveActiveConfig(next);
      return next;
    });
  }, []);

  const setConfig = useCallback((newConfig: InterviewConfig) => {
    setConfigState(newConfig);
    saveActiveConfig(newConfig);
  }, []);

  return {
    config,
    updateConfig,
    setConfig
  };
}
