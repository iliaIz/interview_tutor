import { useVoiceConfigStore } from '../store/useVoiceConfigStore';

/**
 * Thin React facade over useVoiceConfigStore (Spec 59).
 * Preserves { config, updateConfig, setConfig } without local state,
 * CustomEvent buses, or side effects inside React state updaters.
 */
export function useInterviewConfig() {
  const config = useVoiceConfigStore((s) => s.config);
  const updateConfig = useVoiceConfigStore((s) => s.updateConfig);
  const setConfig = useVoiceConfigStore((s) => s.setConfig);

  return {
    config,
    updateConfig,
    setConfig
  };
}
