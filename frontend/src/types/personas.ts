import { GeminiVoiceName } from './interviewConfig';

export type InterviewPersonaId = 'mentor' | 'amazon_bar_raiser' | 'google_staff' | 'yandex_core';

export type TargetGrade = 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF';

export type FaangVerdict = 
  | 'STRONG_HIRE' 
  | 'HIRE' 
  | 'LEANING_HIRE' 
  | 'LEANING_NO_HIRE' 
  | 'STRONG_NO_HIRE';

export interface PersonaConfig {
  id: InterviewPersonaId;
  name: string;
  company: string;
  role: string;
  badge: string;
  icon: string; // Lucide icon name or emoji
  accentColor: string;
  bgGradient: string;
  recommendedVoice: GeminiVoiceName;
  focusAreas: string[];
  evaluationStyle: string;
  signatureQuote: string;
  rubricFocus: string;
}

export const FAANG_PERSONAS: Record<InterviewPersonaId, PersonaConfig> = {
  mentor: {
    id: 'mentor',
    name: 'Сократический ментор',
    company: 'InterviewPrep Academy',
    role: 'Обучающий технический наставник',
    badge: '🎓 Ментор',
    icon: 'GraduationCap',
    accentColor: '#8B5CF6',
    bgGradient: 'from-purple-500/15 via-violet-500/10 to-transparent',
    recommendedVoice: 'Aoede',
    focusAreas: ['Постепенное раскрытие темы', 'Наводящие вопросы', 'Поддержка при ошибках'],
    evaluationStyle: 'Доброжелательный, стимулирующий мышление, без стресса',
    signatureQuote: '«Давайте разберем, что произойдет шаг за шагом...»',
    rubricFocus: 'Умение рассуждать от первых принципов и усваивать подсказки'
  },
  amazon_bar_raiser: {
    id: 'amazon_bar_raiser',
    name: 'Amazon Bar-Raiser',
    company: 'Amazon',
    role: 'Principal Bar-Raiser & Culture Keeper',
    badge: '📦 Bar-Raiser',
    icon: 'ShieldAlert',
    accentColor: '#F59E0B',
    bgGradient: 'from-amber-500/15 via-orange-500/10 to-transparent',
    recommendedVoice: 'Puck',
    focusAreas: ['Customer Obsession', 'Ownership & 5 Whys', 'Frugality & Cloud Costs', 'Fail-over & Post-Mortem'],
    evaluationStyle: 'Настойчивый, копает в глубину причин, требует метрики и подтверждение надежности',
    signatureQuote: '«Как вы измерили влияние на клиента и что предотвратит рецидив сбоя?»',
    rubricFocus: 'Личная ответственность за отказ, метрики эффективности затрат и масштабируемость'
  },
  google_staff: {
    id: 'google_staff',
    name: 'Google Staff Architect',
    company: 'Google / Meta',
    role: 'Staff Infrastructure Architect (L6)',
    badge: '🔍 Staff Architect',
    icon: 'Layers',
    accentColor: '#3B82F6',
    bgGradient: 'from-blue-500/15 via-indigo-500/10 to-transparent',
    recommendedVoice: 'Charon',
    focusAreas: ['Trade-offs & CAP Theorem', 'Big-O худшего случая', 'Network Partition & Sharding', 'Graceful Degradation'],
    evaluationStyle: 'Аналитичный, математически строгий, проверяет поведение под экстремальной нагрузкой',
    signatureQuote: '«Какую сторону теоремы CAP вы жертвуете и какова асимптотика в худшем случае?»',
    rubricFocus: 'Осознанные архитектурные компромиссы, отсутствие скрытых точек отказа и алгоритмическая строгость'
  },
  yandex_core: {
    id: 'yandex_core',
    name: 'Yandex Core Team',
    company: 'Yandex / Tinkoff',
    role: 'JVM Runtime & Concurrency Lead',
    badge: '🔴 JVM Core',
    icon: 'Cpu',
    accentColor: '#EF4444',
    bgGradient: 'from-rose-500/15 via-red-500/10 to-transparent',
    recommendedVoice: 'Fenrir',
    focusAreas: ['HotSpot & Memory Layout', 'JMM Happens-Before & CAS', 'Escape Analysis & TLAB', 'GC Pauses (ZGC/G1)'],
    evaluationStyle: 'Академичный, бескомпромиссный к поверхностным знаниям, смотрит «под капот» JVM',
    signatureQuote: '«Где аллоцируется объект — в куче или на стеке, и почему здесь не нужен lock?»',
    rubricFocus: 'Глубокое понимание рантайма Java, механизма барьеров памяти и lock-free алгоритмов'
  }
};

export const TARGET_GRADES: Record<TargetGrade, { label: string; exp: string; badge: string; description: string }> = {
  L4_MIDDLE: {
    label: 'Middle+ (L4)',
    exp: '2–4 года',
    badge: 'L4 Middle+',
    description: 'Уверенное владение стандартными библиотеками, фреймворком и базовыми паттернами'
  },
  L5_SENIOR: {
    label: 'Senior (L5)',
    exp: '5–8 лет',
    badge: 'L5 Senior',
    description: 'Глубокое понимание внутреннего устройства, trade-offs, проектирование под нагрузку'
  },
  L6_STAFF: {
    label: 'Staff / Lead (L6+)',
    exp: '8+ лет',
    badge: 'L6 Staff / Lead',
    description: 'Системное видение, операционная стоимость, отказоустойчивость и организационные риски'
  }
};

export interface FaangDimensionScores {
  domainDepth: { score: number; comment?: string };
  systemArchitecture: { score: number; comment?: string };
  communicationStar: { score: number; comment?: string };
  operationalExcellence: { score: number; comment?: string };
}

export interface FaangScorecardData {
  verdict: FaangVerdict;
  targetGrade: TargetGrade;
  calibratedGrade: TargetGrade;
  percentile: number; // 0..100
  dimensionScores: FaangDimensionScores;
  strengths: string[];
  redFlags: string[];
  hiringRecommendation: string;
}
