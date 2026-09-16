/**
 * lldCompassRules.ts
 *
 * 5 Golden Rules of Low-Level Design & Concurrency (LLD Compass).
 */

import { CompassRule } from './testingCompassRules';

export const LLD_COMPASS_RULES: Record<string, CompassRule> = {
  CLOCK_INJECTION: {
    id: 'CLOCK_INJECTION',
    name: '1. Инжекция Виртуального Времени (Clock)',
    shortFormula: 'Никаких System.currentTimeMillis() и Thread.sleep(). Время инжектируется через java.time.Clock.',
    fullPrinciple: `В сервисах с временными окнами (Rate Limiter, TTL Cache, Token Bucket, Sliding Window) запрещено напрямую опрашивать системные часы.
- \`Clock\` передается через конструктор сервиса.
- В unit-тестах используется \`Clock.fixed(instant, zone)\` или \`Clock.offset(...)\`. Тест выполняется за 0 мс детерминированно без Thread.sleep().`,
    actionableChecklist: [
      'В доменных классах отсутствует прямой вызов System.currentTimeMillis() и Instant.now()?',
      'Clock инжектируется через конструктор сервиса?',
      'Тесты проверяют истечение окон без реального Thread.sleep()?'
    ]
  },
  MONEY_PRECISION: {
    id: 'MONEY_PRECISION',
    name: '2. Финансовая Точность (BigDecimal)',
    shortFormula: 'Никаких double и float для денег. Строгий BigDecimal с явным масштабом и RoundingMode.HALF_EVEN.',
    fullPrinciple: `Числа с плавающей точкой IEEE-754 накапливают ошибки округления.
- Все балансы, цены, комиссии и курсы валют обязаны использовать \`BigDecimal\`.
- Сравнение выполняется через \`compareTo() == 0\` или \`.isEqualByComparingTo()\`.
- Деление выполняется с обязательным указанием масштаба (scale) и \`RoundingMode.HALF_EVEN\` (Banker’s rounding).`,
    actionableChecklist: [
      'В денежных структурах нет типов double и float?',
      'При делении всегда указан явный scale и RoundingMode.HALF_EVEN?',
      'Сравнение балансов использует compareTo() == 0?'
    ]
  },
  DEADLOCK_FREE_ORDERING: {
    id: 'DEADLOCK_FREE_ORDERING',
    name: '3. Иерархический Захват Блокировок (Lock Ordering)',
    shortFormula: 'При операциях между двумя ресурсами захватывайте замки строго по порядку ID: min(id1, id2) -> max(id1, id2).',
    fullPrinciple: `Если поток A переводит с аккаунта #1 на #2, а поток B — с #2 на #1, одновременный захват lock1 и lock2 вызывает циклический дедлок.
Сортировка ID перед захватом гарантирует глобальный порядок блокировок и предотвращает дедлоки.`,
    actionableChecklist: [
      'Ресурсы сортируются перед захватом: min(id1, id2), затем max(id1, id2)?',
      'Используется try-finally блок для гарантированного unlock()?',
      'Корректно обработан пограничный случай id1 == id2 (перевод самому себе)?'
    ]
  },
  SOLID_BOUNDARIES: {
    id: 'SOLID_BOUNDARIES',
    name: '4. Чистые Границы SOLID и GoF Паттерны',
    shortFormula: 'Проектируйте от интерфейсов и доменных инвариантов. Используйте Стратегию, Фабрику и Records.',
    fullPrinciple: `Бизнес-правила (стратегии списания, алгоритмы матчинга, фильтры) инкапсулируются в интерфейсы (Strategy Pattern).
Неизменяемые структуры и события объявляются через Java 21 Records. Классы компактны и соблюдают Single Responsibility.`,
    actionableChecklist: [
      'Выделены ли интерфейсы для вариативных алгоритмов (Strategy)?',
      'Являются ли DTO и события иммутабельными Java 21 Records?',
      'Отсутствуют ли God-объекты с сотнями строк смешанной ответственности?'
    ]
  },
  THREAD_SAFETY_AND_MEMORY: {
    id: 'THREAD_SAFETY_AND_MEMORY',
    name: '5. Потокобезопасность и Видимость Памяти',
    shortFormula: 'Используйте ConcurrentHashMap.compute(), AtomicLong, StampedLock и volatile.',
    fullPrinciple: `HashMap не потокобезопасен. Избегайте грубых synchronized на весь метод:
применяйте \`ConcurrentHashMap\` с атомарными операциями \`computeIfAbsent/compute\`, атомики (\`AtomicLong\`, \`AtomicReference\`) или \`StampedLock/ReentrantReadWriteLock\`.`,
    actionableChecklist: [
      'Используются ли потокобезопасные структуры данных (ConcurrentHashMap)?',
      'Атомарно ли изменение состояния (compute, compareAndSet)?',
      'Обеспечена ли видимость разделяемых флагов через volatile/Happens-Before?'
    ]
  }
};
