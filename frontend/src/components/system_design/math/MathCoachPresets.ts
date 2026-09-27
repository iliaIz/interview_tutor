export type TutorMode = 'free_chat' | 'deep_dive' | 'eli5' | 'socratic';

export interface MathScenario {
  id: string;
  title: string;
  dau: number;
  writesPerUser: number;
  readsPerUser: number;
  avgWriteBytes: number;
  avgReadBytes: number;
  retentionYears: number;
  description: string;
}

export const TUTOR_MODES_CONFIG: Record<TutorMode, { label: string; icon: string; desc: string }> = {
  free_chat: {
    label: '💬 Просто тьютор',
    icon: '💬',
    desc: 'Доброжелательный ментор: ответы на любые вопросы, разбор формул и допущений'
  },
  deep_dive: {
    label: '🔬 Под капотом',
    icon: '🔬',
    desc: 'Физика вычислений: дисковый I/O, репликация 3x, Page Cache, Peak Factor'
  },
  eli5: {
    label: '👶 На пальцах',
    icon: '👶',
    desc: 'Простые житейские аналогии (очереди, склады, полки) без сложного жаргона'
  },
  socratic: {
    label: '💡 Сократ',
    icon: '💡',
    desc: 'Никаких готовых ответов: только наводящие вопросы на поиск ошибок в расчетах'
  }
};

export const PRESET_SCENARIOS: MathScenario[] = [
  {
    id: 'social-feed',
    title: 'Лента соцсети (Twitter / X-like)',
    dau: 100_000_000,
    writesPerUser: 2,
    readsPerUser: 50,
    avgWriteBytes: 300,
    avgReadBytes: 2500,
    retentionYears: 5,
    description: '100M DAU, 2 твита в день (300B), 50 просмотров ленты (2.5KB). Хранение 5 лет.'
  },
  {
    id: 'photo-sharing',
    title: 'Фотохостинг (Instagram / Pinterest)',
    dau: 50_000_000,
    writesPerUser: 1,
    readsPerUser: 30,
    avgWriteBytes: 200_000, // 200 KB image
    avgReadBytes: 200_000,
    retentionYears: 3,
    description: '50M DAU, 1 фото в день (200KB сжатое фото), 30 просмотров. Хранение 3 года.'
  },
  {
    id: 'url-shortener',
    title: 'Сервис сокращения ссылок (TinyURL / Bitly)',
    dau: 10_000_000,
    writesPerUser: 0.1, // 1 write per 10 users = 1M writes/day
    readsPerUser: 10, // 100M reads/day
    avgWriteBytes: 500,
    avgReadBytes: 100,
    retentionYears: 10,
    description: '10M DAU, 100M переходов в день, 1M новых ссылок (500B). Хранение 10 лет.'
  },
  {
    id: 'fintech-ledger',
    title: 'Двусторонняя бухгалтерская книга (Stripe / Т-Банк)',
    dau: 5_000_000,
    writesPerUser: 4, // 20M tx/day
    readsPerUser: 12,
    avgWriteBytes: 800,
    avgReadBytes: 1200,
    retentionYears: 7,
    description: '5M DAU, 20M финансовых транзакций в день (800B запись). Строгое хранение 7 лет.'
  }
];
