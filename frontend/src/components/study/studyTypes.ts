export type TutorMode = 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';

export interface TutorModeOption {
  id: TutorMode;
  label: string;
  icon: string;
  desc: string;
}

export const TUTOR_MODES: TutorModeOption[] = [
  { id: 'deep_dive', label: 'Под капотом', icon: '🔬', desc: 'Глубокий разбор JVM, байткода, concurrency и edge cases' },
  { id: 'socratic', label: 'Сократ', icon: '💡', desc: 'Наводящие вопросы и совместный поиск решения' },
  { id: 'eli5', label: 'На пальцах', icon: '👶', desc: 'Простые жизненные аналогии без сложного академического жаргона' },
  { id: 'free_chat', label: 'Свободный', icon: '💬', desc: 'Ответы на любые ваши вопросы без рамок' }
];

export const getTutorModeLabel = (mode: string): string => {
  const found = TUTOR_MODES.find(m => m.id === mode);
  return found ? found.label : 'Под капотом';
};
