/**
 * concurrencyCompassRules.ts
 *
 * 5 Golden Rules of Multithreading & Project Loom (Concurrency Compass).
 */

import { CompassRule } from './testingCompassRules';

export const CONCURRENCY_COMPASS_RULES: Record<string, CompassRule> = {
  LOOM_CARRIER_PINNING: {
    id: 'LOOM_CARRIER_PINNING',
    name: '1. Loom: Защита от Carrier Pinning',
    shortFormula: 'Используйте ReentrantLock вместо synchronized для исключения пиннинга несущего OS-потока.',
    fullPrinciple: `Блок synchronized или нативный вызов внутри виртуального потока Loom привязывает (pins) его к несущему пулу ForkJoinPool.
Замена на ReentrantLock позволяет виртуальному потоку корректно освобождать carrier-поток во время блокирующих операций ввода-вывода.`,
    actionableChecklist: [
      'Заменены ли блоки synchronized на ReentrantLock в критических секциях с I/O?',
      'Отсутствует ли пиннинг при вызове блокирующего I/O в виртуальных потоках?',
      'Проверена ли работа сервиса флагом -Djdk.tracePinnedThreads=full?'
    ]
  },
  JMM_HAPPENS_BEFORE: {
    id: 'JMM_HAPPENS_BEFORE',
    name: '2. Видимость Памяти и JMM (Happens-Before)',
    shortFormula: 'Разделяемые флаги объявляйте volatile или финализируйте поля для безопасной публикации.',
    fullPrinciple: `Компилятор JIT и процессор имеют право переупорядочивать инструкции.
Чтение и запись обычных полей не гарантируют видимость между ядрами CPU.
Используйте volatile для флагов завершения, final для неизменяемых структур или AtomicReference.`,
    actionableChecklist: [
      'Объявлены ли разделяемые флаги состояния как volatile?',
      'Гарантирована ли безопасная публикация (final-поля в records/immutable классах)?',
      'Отсутствует ли проверка double-checked locking без volatile?'
    ]
  },
  ATOMIC_CAS_LOOPS: {
    id: 'ATOMIC_CAS_LOOPS',
    name: '3. Атомарное Изменение Стейта (CAS & ConcurrentHashMap)',
    shortFormula: 'Используйте compareAndSet в цикле или compute/merge вместо неатомарного get-then-put.',
    fullPrinciple: `Вызов map.get() с последующим map.put() создает окно для race condition даже в ConcurrentHashMap.
Используйте compute, computeIfAbsent или явные CAS-лупы с AtomicReference/VarHandle.`,
    actionableChecklist: [
      'Отсутствует ли составной Check-Then-Act поверх потокобезопасной коллекции?',
      'Используются ли атомарные методы compute/computeIfAbsent/merge?',
      'В CAS-цикле обновляется ли ссылка на новый иммутабельный снимок состояния?'
    ]
  },
  STAMPED_LOCK_OPTIMISTIC: {
    id: 'STAMPED_LOCK_OPTIMISTIC',
    name: '4. Оптимистичные Чтения с StampedLock',
    shortFormula: 'tryOptimisticRead() исключает contention при доминировании операций чтения над записью.',
    fullPrinciple: `ReentrantReadWriteLock страдает от write-starvation и накладных расходов на счетчики читателей.
StampedLock предоставляет tryOptimisticRead с валидацией штампа (validate), не блокируя писателей.`,
    actionableChecklist: [
      'Используется ли tryOptimisticRead с последующей проверкой validate(stamp)?',
      'Предусмотрен ли фоллбэк на readLock при невалидном штампе?',
      'Учитывается ли, что StampedLock не является реентерабельным?'
    ]
  },
  DISRUPTOR_LOCK_FREE: {
    id: 'DISRUPTOR_LOCK_FREE',
    name: '5. Безблокировочные Очереди (Disruptor & RingBuffer)',
    shortFormula: 'Кольцевой буфер с предвыделенной памятью и последовательным чтением дает максимальный throughput.',
    fullPrinciple: `Блокирующие очереди (BlockingQueue) создают contention на замках и провоцируют GC-аллокации узлов очереди.
RingBuffer паттерна LMAX Disruptor использует pre-allocated слоты и выравнивание кэш-линий (cache line padding).`,
    actionableChecklist: [
      'Исключены ли аллокации объектов в горячем цикле обработки сообщений?',
      'Защищены ли критические счетчики от False Sharing (выравнивание кэш-линий)?',
      'Используется ли паттерн Single-Writer, где это применимо?'
    ]
  }
};
