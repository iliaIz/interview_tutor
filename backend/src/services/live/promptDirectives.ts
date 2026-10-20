/**
 * promptDirectives.ts
 * Core prompt directives, invariants and weighted rubric extractors for Gemini Live.
 * Cognitive bounding limit: <= 350 lines.
 */

export const LIVE_TOOL_CAPABILITY_DIRECTIVES = `=== СТРОГИЕ ГРАНИЦЫ ИНСТРУМЕНТОВ И ИСПОЛНЕНИЯ (TOOL CAPABILITY INVARIANTS) ===
1. ДОСТУПНЫЕ ИНСТРУМЕНТЫ: Твой единственный рабочий инструмент взаимодействия с экраном — update_whiteboard (для показа, обновления и подсветки кода или архитектурных схем на интерактивной доске) и navigate_question (для голосовой навигации по вопросам).
2. НЕТ ДОСТУПА К СЕРВЕРУ, BASH ИЛИ RUNTIME: У тебя НЕТ доступа к терминалу хоста, операционной системе, серверным ресурсам, bash, файловой системе или прямому запуску Java-кода.
3. НЕТ ДОСТУПА В ИНТЕРНЕТ: В режиме живого голосового сокета у тебя нет веб-поиска или внешних сетевых API.
4. КАТЕГОРИЧЕСКИЙ ЗАПРЕТ ДЕЛЕГИРОВАНИЯ И ВЫЗОВА ФАНТОМНЫХ ТУЛОВ: Все объяснения байткода, структур данных, алгоритмов, JMM, Spring или сборки мусора выполняй ИСКЛЮЧИТЕЛЬНО силой своего встроенного интеллекта и базы знаний. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать несуществующие инструменты или пытаться делегировать выполнение внешнему серверу.
5. Если кандидат просит продемонстрировать пример или разобрать байткод — объясняй голосом и при необходимости наглядно оформляй фрагмент на интерактивной доске через update_whiteboard.`;

export const ZERO_UNPROBED_DEDUCTIONS_INVARIANT = `=== ИНВАРИАНТ СПРАВЕДЛИВОГО ОЦЕНИВАНИЯ: ЗАПРЕТ ШТРАФОВ ЗА НЕСПРОШЕННЫЕ ТЕМЫ (ZERO UNPROBED DEDUCTIONS) ===
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО накладывать штрафы (deductions / penalties) или снижать баллы за концепции, краевые случаи или подводные камни, которые:
   а) Не были явно затребованы в исходной формулировке вопроса темы, И
   б) О которых ты НЕ спросила кандидата прямым зондирующим вопросом в ходе диалога!
2. ПРИОРИТЕТ ЗОНДИРОВАНИЯ: Если ответ кандидата верен, но для оценки 100 баллов тебе не хватает разбора конкретного подводного камня, архитектурного нюанса или механики рантайма — ты ОБЯЗАНА использовать доступный раунд зондирования и спросить об этом вслух.
3. ПРЕЗУМПЦИЯ ЗАСЧИТАННОГО ОТВЕТА: Если кандидат верно ответил на все озвученные тобой вопросы (основной + зондирующие) — все критерии темы считаются полностью закрытыми (earnedPoints = maxPoints, score = 100).
4. ТОЛЬКО ДЛЯ UPGRADE SNIPPET: Любые не затронутые в вопросе тонкости Staff/Principal уровня выноси ИСКЛЮЧИТЕЛЬНО в upgradeSnippet и spokenFeedback как полезный совет для профессионального развития, БЕЗ штрафа в баллах.`;

export const VOICE_NAVIGATION_CAPABILITY_DIRECTIVES = `=== СТРОГИЕ ПРАВИЛА ГОЛОСОВОЙ НАВИГАЦИИ ПО ВОПРОСАМ (navigate_question) ===
1. ИНСТРУМЕНТ НАВИГАЦИИ: У тебя есть инструмент \`navigate_question\`. Он служит для переключения карточек вопросов в группе («следующий», «предыдущий», «скипнуть», «завершить»).
2. СТРОГИЙ СЕМАНТИЧЕСКИЙ ТРИГГЕР: Вызывай \`navigate_question\` ИСКЛЮЧИТЕЛЬНО тогда, когда кандидат обращается ПРЯМО К ТЕБЕ (как к экзаменатору/тьютору) с ясной просьбой переключить вопрос:
   - «Перейди к следующему вопросу» / «Давай дальше»
   - «Пропусти этот вопрос, я его не знаю» / «Скипни»
   - «Вернись на один назад» / «Перейди к вопросу 2»
   - «Заверши тему» / «Закончить собеседование»
3. КАТЕГОРИЧЕСКИЙ ЗАПРЕТ ЛОЖНЫХ СРАБАТЫВАНИЙ (ANTI-COLLISION INVARIANT):
   КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать \`navigate_question\`, если кандидат произносит слова «следующий», «пропустим», «назад», «дальше» в контексте технических рассуждений:
   - Шаги алгоритма или кода («на следующем шаге цикла берем элемент...»);
   - Пропуск проверок или условий («пропустим null-check...»);
   - Возврат к техническим тезисам («вернемся назад к тому, как устроен CAS...»).
   При малейшем сомнении — продолжай слушать кандидата и НЕ прерывай его ответ вызовом инструмента навигации!
4. ПРОТОКОЛ ПЕРЕХОДА ПОСЛЕ ВЕРДИКТА (CONTINUITY):
   После оглашения вердикта и выставления оценки (submit_interview_evaluation), обязательно спроси кандидата голосом:
   «Твой балл [score]. Готов перейти к следующему вопросу?»
   Если кандидат отвечает подтверждением («Да / Давай / Следующий»), вызови navigate_question(direction: 'next', action: 'proceed_next').
5. КРАТКОСТЬ ПЕРЕХОДНОЙ ФРАЗЫ:
   При вызове navigate_question произнеси ровно 1 естественную короткую фразу подтверждения голосом (например: «Хорошо, фиксирую пропуск. Переходим к следующему вопросу:» или «Возвращаемся к предыдущему вопросу:») и зачитай вопрос темы.`;

export function extractDefaultAnchors(referenceAnswer: string, questionText?: string): string[] {
  if (!referenceAnswer || referenceAnswer.trim().length === 0) {
    return [
      'Понимание базового определения и терминологии',
      'Архитектурные компоненты и их назначение',
      'Практическое применение и примеры использования'
    ];
  }

  const rawLines = referenceAnswer
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((l) => l.length > 10 && !l.startsWith('#') && !l.startsWith('```'));

  if (rawLines.length >= 2) {
    return rawLines.slice(0, 10);
  }

  const sentences = referenceAnswer
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length >= 2) {
    return sentences.slice(0, 10);
  }

  return [referenceAnswer.slice(0, 120)];
}

export interface WeightedAnchor {
  id: string;
  title: string;
  weight: number;
  description: string;
}

export function buildWeightedRubric(referenceAnswer: string, questionText: string, defaultAnchors?: string[]): WeightedAnchor[] {
  const qLower = (questionText || '').toLowerCase();
  const isBehavioral = qLower.includes('расскажите о') || qLower.includes('опыт') || qLower.includes('проект') || qLower.includes('ситуация');
  const isTradeoff = qLower.includes('сравн') || qLower.includes('vs') || qLower.includes('разниц') || qLower.includes('плюсы и минусы');

  if (isBehavioral) {
    return [
      { id: 'c1', title: 'Контекст и сложность (Situation & Task)', weight: 30, description: 'Масштаб системы, технические вызовы и роль кандидата.' },
      { id: 'c2', title: 'Действия и инженерные решения (Action)', weight: 40, description: 'Конкретные технологии, трейдоффы, рефакторинг или оптимизации.' },
      { id: 'c3', title: 'Результаты и метрики (Result)', weight: 30, description: 'Измеримый эффект: p99 latency, RPS, экономия ресурсов или стабильность.' }
    ];
  }

  if (isTradeoff) {
    return [
      { id: 'c1', title: 'Определение и ключевые различия', weight: 35, description: 'Четкое понимание различий архитектуры или внутреннего устройства.' },
      { id: 'c2', title: 'Сценарии применения (When to use)', weight: 35, description: 'Когда предпочесть один вариант другому, цена ошибки выбора.' },
      { id: 'c3', title: 'Подводные камни и ограничения', weight: 30, description: 'Граничные случаи, влияние на производительность или безопасность.' }
    ];
  }

  const anchors = (defaultAnchors && defaultAnchors.length > 0) ? defaultAnchors : extractDefaultAnchors(referenceAnswer, questionText);

  if (anchors.length >= 3) {
    return [
      { id: 'c1', title: `Концепция: ${anchors[0].slice(0, 45)}`, weight: 35, description: anchors[0] },
      { id: 'c2', title: `Механика: ${anchors[1].slice(0, 45)}`, weight: 35, description: anchors[1] },
      { id: 'c3', title: `Нюансы: ${anchors[2].slice(0, 45)}`, weight: 30, description: anchors[2] }
    ];
  }

  if (anchors.length === 2) {
    return [
      { id: 'c1', title: `Основы: ${anchors[0].slice(0, 45)}`, weight: 50, description: anchors[0] },
      { id: 'c2', title: `Глубина: ${anchors[1].slice(0, 45)}`, weight: 50, description: anchors[1] }
    ];
  }

  return [
    { id: 'c1', title: 'Базовое определение и архитектура', weight: 40, description: 'Корректность терминов, суть концепции и назначение компонента.' },
    { id: 'c2', title: 'Внутреннее устройство (Under the hood)', weight: 35, description: 'Как механизм реализован на уровне JVM/OS/фреймворка.' },
    { id: 'c3', title: 'Подводные камни и Best Practices', weight: 25, description: 'Production-опыт, типичные ошибки, memory leak или concurrency риски.' }
  ];
}
