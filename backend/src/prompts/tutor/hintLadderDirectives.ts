/**
 * hintLadderDirectives.ts
 *
 * Domain-adaptive Progressive Hint Ladder Directives for Socratic AI Tutor.
 * Cognitive bounding: <= 120 lines.
 */

interface DomainFlags {
  isLld: boolean;
  isTx: boolean;
  isConcurrency: boolean;
  isRefactoring: boolean;
  isJava21: boolean;
}

export function buildHintLadderDirective(domain: DomainFlags, hintTier?: number): string {
  if (hintTier === undefined) return '';

  if (domain.isLld) {
    switch (hintTier) {
      case 0:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (Синтаксис & Контракты).\nФокусируйся на сигнатурах методов, типах данных и Java 21 Records.';
      case 1:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Архитектурные границы).\nОбъясни, как применить паттерн Стратегия или разделить обязанности по SOLID.';
      case 2:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Потокобезопасность).\nУкажи на место возможной гонки данных (race condition) и подходящую структуру (ConcurrentHashMap, AtomicLong).';
      case 3:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Виртуальное Время & Детерминизм).\nПокажи, как инжектировать java.time.Clock для проверки временных окон за 0 мс.';
      case 4:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Изоморфный пример).\nПокажи аналогичный архитектурный шаблон из другой предметной области.';
    }
  }

  if (domain.isTx) {
    switch (hintTier) {
      case 0:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (Уровни Изоляции).\nРазбери транзакционные аномалии (READ COMMITTED vs REPEATABLE READ) и дефолтное поведение СУБД.';
      case 1:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Распространение @Transactional).\nОбъясни механику границ: REQUIRED vs REQUIRES_NEW и опасность исчерпания пула соединений HikariCP.';
      case 2:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Ловушка Self-Invocation).\nПоясни, почему внутренний вызов метода идет мимо CGLIB-прокси и как это исправить.';
      case 3:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Пессимистические блокировки & Дедлоки).\nПокажи, как использовать SELECT FOR UPDATE и упорядочить захват замков (lock ordering min->max).';
      case 4:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Transactional Outbox).\nПокажи шаблон гарантированной доставки событий без сетевых вызовов внутри транзакции.';
    }
  }

  if (domain.isConcurrency) {
    switch (hintTier) {
      case 0:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (JMM & Happens-Before).\nОбъясни барьеры памяти, видимость через volatile и безопасную публикацию объектов.';
      case 1:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Loom & Carrier Pinning).\nПоясни, почему synchronized в виртуальных потоках блокирует OS-поток, и предложи замену на ReentrantLock.';
      case 2:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Атомарный CAS & Неблокирующий стейт).\nПокажи, как избавиться от гонки данных через compareAndSet, AtomicReference или computeIfAbsent.';
      case 3:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Оптимистичные чтения с StampedLock).\nПокажи технику tryOptimisticRead() с последующей валидацией штампа без взаимных блокировок.';
      case 4:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Безблокировочные архитектуры).\nПокажи паттерн кольцевого буфера (LMAX Disruptor RingBuffer) с предварительным выделением памяти.';
    }
  }

  if (domain.isRefactoring) {
    switch (hintTier) {
      case 0:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (Швы по Физерсу).\nПокажи, как найти точку внедрения (Seam) для подстановки тестового дублера без правок класса.';
      case 1:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Characterization-тесты).\nОбъясни, как написать фиксирующий тест (Golden Master) для фиксации фактического поведения системы.';
      case 2:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Выделение метода и класса).\nПокажи пошаговую декомпозицию God Object через Extract Method и Extract Class.';
      case 3:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Замена условий полиморфизмом).\nПокажи, как заменить ветвящийся if-else/switch интерфейсом стратегии.';
      case 4:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Контрольный прогон).\nПродемонстрируй метод безопасной верификации инвариантов после рефакторинга.';
    }
  }

  if (domain.isJava21) {
    switch (hintTier) {
      case 0:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (Records & Деструктуризация).\nПокажи синтаксис Record Patterns и компактных конструкторов.';
      case 1:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Sealed-иерархии).\nПокажи, как запечатать иерархию (sealed, permits) для исчерпывающего контроля типов.';
      case 2:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Pattern Matching switch).\nПокажи исчерпывающий switch по sealed-типам без избыточного default.';
      case 3:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Guarded Patterns).\nПокажи сопоставление с условием when для лаконичной фильтрации.';
      case 4:
        return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Идиоматичный рефакторинг Java 21).\nПокажи трансформацию устаревшего императивного кода в современные конструкции Java 21.';
    }
  }

  // Testing & Mutation Katas (RIPR Model)
  switch (hintTier) {
    case 0:
      return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (Синтаксис и компиляция).\nФокусируйся на синтаксических ошибках, типах и импортах.';
    case 1:
      return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Reachability / Достижимость).\nОбъясни, какую ветку условия необходимо вызвать для достижения кода.';
    case 2:
      return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Infection / Заражение состояния).\nПоясни, какое состояние объекта искажается при наличии бага.';
    case 3:
      return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Propagation / Контрпример).\nНазови конкретный граничный входной параметр (контрпример).';
    case 4:
      return '\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Изоморфный пример).\nПокажи пример теста аналогичной задачи из другой сферы.';
    default:
      return '';
  }
}
