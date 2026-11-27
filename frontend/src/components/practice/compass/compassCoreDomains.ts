/**
 * compassCoreDomains.ts
 * Declarative rule catalogs for LLD, Testing, and Refactoring Compass domains.
 * Zero DOM/React imports; strictly <= 350 lines (Rule 8).
 */

import type { CompassDomainConfig } from './compassDomains';

export const LLD_COMPASS_CONFIG: CompassDomainConfig = {
  domain: 'lld',
  title: 'LLD Компас: 5 Заповедей Архитектуры',
  subtitle: 'Детерминизм времени, финансовая строгость, lock ordering и чистые границы SOLID',
  badge: 'Java 21 LTS',
  rules: [
    {
      id: 'CLOCK_INJECTION',
      number: '01',
      title: 'Инжекция виртуального времени (Clock)',
      badge: 'Детерминизм 0 мс',
      shortFormula: 'Никаких System.currentTimeMillis() и Thread.sleep(). Время инжектируется через java.time.Clock.',
      fullPrinciple:
        'В Rate Limiter, TTL Cache и Token Bucket запрещено напрямую опрашивать системные часы. Тесты проверяют временные окна через Clock.fixed() и Clock.offset() за 0 мс.',
      checklist: [
        'В доменных классах отсутствуют System.currentTimeMillis() и Instant.now()?',
        'Clock инжектируется через конструктор сервиса?',
        'Тесты проверяют таймауты без Thread.sleep()?'
      ]
    },
    {
      id: 'MONEY_PRECISION',
      number: '02',
      title: 'Финансовая точность (BigDecimal)',
      badge: 'Финансовая строгость',
      shortFormula: 'Никаких double и float для денег. BigDecimal с явным scale и RoundingMode.HALF_EVEN.',
      fullPrinciple:
        'IEEE-754 накапливает ошибки округления. Все суммы и балансы используют BigDecimal. Сравнение выполняется через compareTo() == 0.',
      checklist: [
        'В денежных структурах отсутствуют double и float?',
        'При делении указаны scale и RoundingMode.HALF_EVEN?',
        'Сравнение сумм использует compareTo() == 0?'
      ]
    },
    {
      id: 'DEADLOCK_FREE_ORDERING',
      number: '03',
      title: 'Иерархический захват блокировок',
      badge: 'Без дедлоков',
      shortFormula:
        'При операциях между двумя ресурсами захватывайте замки строго по порядку: min(id1, id2) -> max(id1, id2).',
      fullPrinciple:
        'Сортировка идентификаторов до захвата блокировок полностью исключает циклические взаимные блокировки при встречных переводах.',
      checklist: [
        'Блокировки сортируются по ID перед захватом?',
        'Используется try-finally для гарантированного unlock()?',
        'Обработан граничный случай id1 == id2?'
      ]
    },
    {
      id: 'SOLID_BOUNDARIES',
      number: '04',
      title: 'Чистые границы SOLID и GoF',
      badge: 'Чистая архитектура',
      shortFormula: 'Проектируйте от интерфейсов и инвариантов. Используйте Strategy, Factory и Java 21 Records.',
      fullPrinciple:
        'Вариативные бизнес-правила инкапсулируются за интерфейсами, а события и DTO объявляются иммутабельными Records.',
      checklist: [
        'Выделены интерфейсы для сменных стратегий?',
        'DTO и события объявлены как иммутабельные Records?',
        'Отсутствуют God-объекты со смешанной ответственностью?'
      ]
    },
    {
      id: 'THREAD_SAFETY_AND_MEMORY',
      number: '05',
      title: 'Потокобезопасность и JMM',
      badge: 'Java Memory Model',
      shortFormula: 'Используйте ConcurrentHashMap.compute(), AtomicLong, StampedLock и volatile.',
      fullPrinciple:
        'Избегайте грубых synchronized на весь метод: применяйте атомарные computeIfAbsent/compute, атомики или StampedLock.',
      checklist: [
        'Используются потокобезопасные структуры данных?',
        'Изменение состояния выполняется атомарно?',
        'Разделяемые флаги защищены Happens-Before?'
      ]
    }
  ]
};

export const TESTING_COMPASS_CONFIG: CompassDomainConfig = {
  domain: 'testing',
  title: 'Testing Compass: 5 Заповедей Тестирования',
  subtitle: 'Мутационная стойкость, граничные инварианты и закон моков Фаулера',
  badge: 'Mutation & RIPR',
  hasTestingRadar: true,
  rules: [
    {
      id: 'AAA_PATTERN',
      number: '01',
      title: 'Паттерн AAA (Arrange — Act — Assert)',
      badge: 'Структура',
      shortFormula: 'Один тест — одно действие. Четкое разделение подготовки, вызова и проверки.',
      fullPrinciple:
        'Arrange готовит параметры и стабы, Act делает один вызов, Assert проверяет контракт выразительным AssertJ.',
      checklist: [
        'Тест разделен на 3 логических блока?',
        'В блоке Act ровно один целевой вызов?',
        'Используется выразительный AssertJ?'
      ]
    },
    {
      id: 'MUTANT_ADVERSARY',
      number: '02',
      title: 'Тест как охотник на мутантов',
      badge: 'Mutation Score',
      shortFormula: 'Доказать: если оператор < заменится на <= или логика сломается — тест упадёт.',
      fullPrinciple:
        '100% Line Coverage не защищает от регрессий без граничных утверждений по всем веткам.',
      checklist: [
        'Проверена строгая граница (меньше, равно, больше)?',
        'Проверены null, пустые коллекции и исключения?',
        'Тест падает при удалении побочного эффекта?'
      ]
    },
    {
      id: 'STATE_VS_INTERACTION',
      number: '03',
      title: 'Состояние против взаимодействия',
      badge: 'Устойчивость',
      shortFormula: 'Предпочитайте проверку возвращаемого состояния избыточному verify().',
      fullPrinciple:
        'Избыточные verify() привязывают тесты к деталям реализации; оставьте их только для внешних void-команд.',
      checklist: [
        'Не проверяются ли внутренние вызовы вместо результата?',
        'Для void-команд проверено точное число вызовов?',
        'Для сложных DTO использован ArgumentCaptor?'
      ]
    },
    {
      id: 'FOWLER_MOCKS_LAW',
      number: '04',
      title: 'Закон моков Фаулера',
      badge: 'Границы изоляции',
      shortFormula: 'Мокайте только внешние границы (I/O, API, Clock). Не мокайте доменную модель.',
      fullPrinciple:
        'Value Objects, Record и доменные сущности создаются настоящими через new; моки изолируют только внешние порты.',
      checklist: [
        'DTO и Record создаются через new?',
        'Мокаются только внешние зависимости и порты?',
        'Тест не проверяет то, что сам вернул из стаба?'
      ]
    },
    {
      id: 'DETERMINISM_AND_CLOCK',
      number: '05',
      title: 'Детерминизм и виртуальное время',
      badge: '0 мс тесты',
      shortFormula: 'Никакого Thread.sleep(). Используйте Clock.fixed() и Awaitility.',
      fullPrinciple:
        'Тесты со sleep() нестабильны в CI. Инжекция Clock дает мгновенный и детерминированный сдвиг времени.',
      checklist: [
        'В тестах нет Thread.sleep()?',
        'Временные окна проверяются через Clock.fixed()?',
        'Асинхронность проверяется через Awaitility?'
      ]
    }
  ]
};

export const REFACTORING_COMPASS_CONFIG: CompassDomainConfig = {
  domain: 'refactoring',
  title: 'Refactoring Компас: 5 Заповедей Легаси',
  subtitle: 'Швы Фезерса, Characterization Tests и безопасная ликвидация запахов кода',
  badge: 'Michael Feathers',
  rules: [
    {
      id: 'FEATHERS_SEAMS',
      number: '01',
      title: 'Швы по Фезерсу (Legacy Seams)',
      badge: 'Working with Legacy',
      shortFormula: 'Найдите место изменения поведения без переписывания публичного контракта класса.',
      fullPrinciple:
        'Шов позволяет подставить тестовый дублер вместо жесткой зависимости на синглтон, БД или статическую фабрику.',
      checklist: [
        'Выявлен шов для изоляции внешней зависимости?',
        'Подстановка дублера не ломает внешний контракт?',
        'Сохранены сигнатуры публичных методов?'
      ]
    },
    {
      id: 'CHARACTERIZATION_TESTS',
      number: '02',
      title: 'Фиксирующие тесты (Golden Master)',
      badge: 'Защитная сеть',
      shortFormula: 'Зафиксируйте фактическое поведение системы тестами ДО начала рефакторинга.',
      fullPrinciple:
        'Characterization Tests документируют текущее поведение со всеми граничными случаями и ловят регрессии на каждом шаге.',
      checklist: [
        'Изменяемый метод покрыт характеризующими тестами?',
        'Зафиксирован эталон Golden Master до правок?',
        'Все тесты зеленые перед первым шагом рефакторинга?'
      ]
    },
    {
      id: 'SUBCLASS_AND_OVERRIDE',
      number: '03',
      title: 'Subclass and Override Method',
      badge: 'Изоляция без DI',
      shortFormula: 'Выделите тяжелый вызов (БД, сеть, время) в protected метод и переопределите в тесте.',
      fullPrinciple:
        'Если легаси-класс создает зависимости через new или static, вынос вызова в protected метод открывает путь к юнит-тестам.',
      checklist: [
        'Неудобный вызов вынесен в protected метод?',
        'В тесте используется локальный наследник-заглушка?',
        'Юнит-тест больше не требует сети или БД?'
      ]
    },
    {
      id: 'REPLACE_CONDITIONAL_WITH_POLYMORPHISM',
      number: '04',
      title: 'Замена ветвлений полиморфизмом',
      badge: 'OCP',
      shortFormula: 'Заменяйте длинные if-else и switch на Strategy или Java 21 Pattern Matching.',
      fullPrinciple:
        'Каскады условий по кодам типов нарушают Open-Closed Principle. Выносите ветки в стратегии или sealed switch.',
      checklist: [
        'Выделен единый интерфейс или sealed-иерархия?',
        'Устранена глубокая вложенность if-else?',
        'Switch проверяет все кейсы исчерпывающе?'
      ]
    },
    {
      id: 'SMELL_REMEDIATION',
      number: '05',
      title: 'Ликвидация запахов и Закон Деметры',
      badge: 'Clean Code',
      shortFormula: 'Декомпозируйте God Objects и применяйте Tell, Don’t Ask вместо цепочек геттеров.',
      fullPrinciple:
        'Убирайте Feature Envy, Data Clump и дублирование, распределяя логику к владельцам данных.',
      checklist: [
        'Устранены цепочки вызовов вида a.getB().getC()?',
        'Классы разделены по Single Responsibility?',
        'Скрыты внутренние изменяемые коллекции?'
      ]
    }
  ]
};
