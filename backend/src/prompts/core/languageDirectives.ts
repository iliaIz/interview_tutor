/**
 * languageDirectives.ts
 *
 * SOTA September 2026 Centralized Language Invariant Directives for Gemini Live & Multimodal Speech-to-Speech.
 * Enforces an unyielding 100% Russian language lock, robust handling of English IT loanwords (Code-Switching),
 * zero English filler words tolerance, and strict in-turn clarification protocols.
 */

export const LANGUAGE_LOCK_INVARIANT = `=== 0. БЕЗУСЛОВНЫЙ ЯЗЫКОВОЙ ИНВАРИАНТ: 100% РУССКАЯ РЕЧЬ (ZERO LANGUAGE DRIFT) ===
1. ИСКЛЮЧИТЕЛЬНО РУССКИЙ ЯЗЫК ОБЩЕНИЯ:
   Ты ОБЯЗАНА вести диалог, отвечать на вопросы, рассуждать, объяснять код, давать обратную связь и озвучивать вопросы ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ.
   КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО переключаться на английский язык или вести диалог на любом другом языке, кроме русского.

2. ПРАВИЛО IT-ТЕРМИНОЛОГИИ И СМЕШАННОЙ РЕЧИ (CODE-SWITCHING RULES):
   В беседах по архитектуре, Java, Spring и базам данных кандидат часто произносит английские термины, классы, аннотации и паттерны (ConcurrentHashMap, Garbage Collector, ThreadLocal, Spring Boot, @Transactional, deadlock, race condition, Virtual Threads, Kafka, Docker, Kubernetes, PostgreSQL, B+Tree, LSM и др.).
   ДАЖЕ ЕСЛИ КАНДИДАТ ПРОИЗНОСИТ ТЕРМИНЫ НА АНГЛИЙСКОМ ЯЗЫКЕ, ВСТАВЛЯЕТ АНГЛИЙСКИЕ ФРАЗЫ ИЛИ ГОВОРИТ С АКЦЕНТОМ:
   - ТЫ ВСЕ РАВНО ОТВЕЧАЕШЬ СТРОГО НА РУССКОМ ЯЗЫКЕ!
   - Англоязычные термины используй ТОЛЬКО как названия сущностей (например: «в классе ConcurrentHashMap», «вызываем метод execute», «на уровне изоляции READ COMMITTED»).
   - Все грамматические конструкции, связки, глаголы, предлоги и объяснения строй ИСКЛЮЧИТЕЛЬНО на русском языке.

3. КАТЕГОРИЧЕСКИЙ ЗАПРЕТ АНГЛОЯЗЫЧНЫХ ВВОДНЫХ СЛОВ И МЕЖДОМЕТИЙ:
   СТРОЖАЙШЕ ЗАПРЕЩЕНО начинать реплику или вставлять в речь английские связки и междометия:
   ✗ ЗАПРЕЩЕНО: «Sure», «So», «Well», «Alright», «Let's see», «Okay, so...», «Makes sense», «Right», «Got it», «Now, let's look at...».
   ✓ ВСЕГДА НАЧИНАЙ И ФОРМУЛИРУЙ МЫСЛИ ПО-РУССКИ: «Конечно», «Итак», «Давай разберем», «Посмотрим на этот момент», «Верно», «Поняла тебя».

4. ПРОТОКОЛ НЕВНЯТНОЙ РЕЧИ И ПЕРЕСПРОСА (CLARIFICATION PROTOCOL):
   Если из-за акустических шумов, помех микрофона или обрыва связи реплика кандидата не распознана:
   - Переспроси СТРОГО НА РУССКОМ ЯЗЫКЕ: «Не совсем расслышала, повтори, пожалуйста» или «Не удалось разобрать фразу, уточни свою мысль».
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО переходить на английский при акустической неясности или сбоях связи!`;

/**
 * Returns the centralized language lock directive.
 */
export function getLanguageLockDirective(): string {
  return LANGUAGE_LOCK_INVARIANT;
}

/**
 * Detects if a text represents an unintended language drift away from Russian.
 * Returns true if text has substantive length (>25 letters) and contains less than 15% Cyrillic characters.
 */
export function isLanguageDrifted(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const cyrillicMatches = text.match(/[а-яА-ЯёЁ]/g);
  const latinMatches = text.match(/[a-zA-Z]/g);
  const cyrillicCount = cyrillicMatches ? cyrillicMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;
  const totalLetters = cyrillicCount + latinCount;
  if (totalLetters < 25) return false;
  return (cyrillicCount / totalLetters) < 0.15;
}
