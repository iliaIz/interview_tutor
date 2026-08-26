export type InterviewStrategy = 'adaptive_probing' | 'socratic_tutoring';
export type GeminiVoiceName = 'Kore' | 'Aoede' | 'Puck' | 'Fenrir' | 'Charon';

export interface VoiceOption {
  id: GeminiVoiceName;
  name: string;
  gender: 'Женский' | 'Мужской';
  style: string;
  description: string;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore (Кора)',
    gender: 'Женский',
    style: 'Теплый, мягкий и поддерживающий',
    description: 'Идеален для доброжелательного менторства и спокойного диалога'
  },
  {
    id: 'Aoede',
    name: 'Aoede (Аэда)',
    gender: 'Женский',
    style: 'Уверенный, четкий и аналитический',
    description: 'Идеален для строгого технического собеседования и скрининга'
  },
  {
    id: 'Puck',
    name: 'Puck (Пак)',
    gender: 'Мужской',
    style: 'Энергичный, живой и открытый',
    description: 'Создает динамичную атмосферу современного стартап-интервью'
  },
  {
    id: 'Fenrir',
    name: 'Fenrir (Фенрир)',
    gender: 'Мужской',
    style: 'Глубокий, авторитетный и весомый',
    description: 'Отлично подходит для архитектурных и Senior/Lead сессий'
  },
  {
    id: 'Charon',
    name: 'Charon (Харон)',
    gender: 'Мужской',
    style: 'Спокойный, рассудительный и вдумчивый',
    description: 'Идеален для академических разборов и фундаментальных тем'
  }
];

export interface InterviewConfig {
  strategy: InterviewStrategy;
  voice: GeminiVoiceName;
  maxProbes: number; // 1..5
  deepDive?: boolean; // 🔬 Глубокое зондирование (под капот, смежные темы, стресс-тест)
  liveCoaching?: boolean; // 🎓 Разбор ошибок и объяснение правильного ответа на лету
  customPromptOverride?: string;
  customAnchors?: string[];
  autoAdvance?: boolean; // ⚡ Автоматический переход к следующему вопросу
  transitionDelay?: number; // ⏱️ Задержка автоперехода в секундах (3, 5, 10, 15, 0 = только вручную)
  vadPauseMs?: number; // ⏱️ Длительность паузы тишины VAD в мс (1200..2500, по умолчанию 1800)
}

export interface InterviewProfile {
  id: string;
  name: string;
  badge: string;
  description: string;
  isPreset?: boolean;
  config: InterviewConfig;
}
