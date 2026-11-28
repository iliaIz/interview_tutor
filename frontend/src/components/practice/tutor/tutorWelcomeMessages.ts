/**
 * tutorWelcomeMessages.ts
 *
 * Domain-specific greeting generator for the Practice AI-Tutor text drawer.
 * Prevents prompt leakage from mutation testing into LLD, Transactions, and Concurrency.
 * Cognitive bounding limit: <= 80 lines.
 */

import { TutorDomain } from './TutorDomain';

export const DOMAIN_WELCOME_MESSAGES: Record<TutorDomain, string> = {
  lld: '👋 Привет! Я твой AI-напарник по низкоуровневому проектированию (LLD) и архитектуре на Java 21. Помогу спроектировать чистые контракты, применить паттерны GoF, защитить структуры данных от гонок и инжектировать виртуальный `Clock`. Чем помочь по текущей задаче?',
  transactions: '👋 Привет! Я твой AI-напарник по транзакциям Spring Boot и аномалиям БД. Помогу разобрать распространение `@Transactional`, обойти ловушку Self-Invocation прокси и защитить балансы от дедлоков. С какого сценария начнем?',
  concurrency: '👋 Привет! Я твой AI-напарник по многопоточности и Project Loom на Java 21. Помогу предотвратить пиннинг carrier-потоков, разобраться в модели JMM и устранить race conditions. Что планируешь реализовать?',
  refactoring: '👋 Привет! Я твой AI-напарник по рефакторингу легаси-кода. Помогу найти швы (Seams) по Майклу Физерсу, написать characterization-тесты и безопасно разбить God-класс. С какого участка кода начнем?',
  java21: '👋 Привет! Я твой AI-напарник по современным идиомам Java 21 LTS. Помогу переписать код на Pattern Matching для switch, запечатанные классы (sealed) и деконструкцию рекордов. Что разберем?',
  testing: '👋 Привет! Я твой AI-напарник по парному программированию и мутационному тестированию. Я могу объяснить устройство любого теста, подсказать граничные случаи по модели RIPR или проверить твой код по Тестинг-Компасу (`Ctrl + /`). Чем помочь?'
};

export function getDomainWelcomeMessage(
  domain: TutorDomain,
  challengeTitle?: string,
  arena?: string
): string {
  if (arena === 'incidents') {
    const label = challengeTitle?.trim() ? ` «${challengeTitle.trim()}»` : '';
    return `🕵️ Я твой Senior Code Reviewer по инциденту${label}. Выдели подозрительную строку в коде или опиши свою гипотезу о корневой причине бага — разберём без спойлеров и проверим диагноз.`;
  }
  const base = DOMAIN_WELCOME_MESSAGES[domain] || DOMAIN_WELCOME_MESSAGES.testing;
  if (challengeTitle && challengeTitle.trim().length > 0) {
    return base;
  }
  return base;
}
