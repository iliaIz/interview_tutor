/**
 * practiceTutorPrompts.ts
 *
 * SOTA 2026 Multimodal AI Pair-Programming Co-Pilot & Compass Prompt Engine.
 * Supports Domain-Adaptive prompts (LLD, Concurrency, Transactions, Testing),
 * 4 Cognitive Personas, Progressive Hint Ladders, and Golden Rules Grounding.
 */

export type TutorPersona = 'junior_explainer' | 'middle_scaffold' | 'senior_socratic' | 'faang_interviewer';

export type HintTier = 0 | 1 | 2 | 3 | 4;

export interface CompassRule {
  id: string;
  name: string;
  shortFormula: string;
  fullPrinciple: string;
  actionableChecklist: string[];
}

export const TESTING_COMPASS_RULES: Record<string, CompassRule> = {
  AAA_PATTERN: {
    id: 'AAA_PATTERN',
    name: '1. Паттерн AAA (Arrange — Act — Assert)',
    shortFormula: 'Один тест — одно действие. Четкое разделение подготовки, вызова и проверки.',
    fullPrinciple: `Каждый юнит-тест должен быть визуально и логически разделен на 3 блока:
1. **Arrange (Подготовка):** создание тестируемого сервиса, настройка входных данных, подготовка стабов (when(...).thenReturn(...)).
2. **Act (Действие):** ровно ОДИН вызов целевого метода. Никакой логики, ветвлений или повторных действий.
3. **Assert (Проверка):** верификация результата через AssertJ (assertThat(...)) или проверка выброшенного исключения.`,
    actionableChecklist: [
      'Тест разделен пустыми строками или комментариями // Arrange, // Act, // Assert?',
      'В блоке Act ровно один вызов метода?',
      'В проверке используется выразительный AssertJ вместо неинформативного assertEquals?'
    ]
  },
  MUTANT_ADVERSARY: {
    id: 'MUTANT_ADVERSARY',
    name: '2. Тест как охотник на мутантов (Adversary Thinking)',
    shortFormula: 'Не просто "покрыть строчку", а доказать: если код сломается — тест гарантированно упадет.',
    fullPrinciple: `100% Line Coverage ничего не стоит, если тест не проверяет граничные условия.
Представьте себе зловредного мутанта, который:
- Заменил '>' на '>='
- Удалил вызов отправки уведомления
- Возвращает null или дефолтное значение
Ваш тест обязан упасть (Kill the Mutant), доказав свою ценность.`,
    actionableChecklist: [
      'Проверена ли строгая граница (значение меньше границы, ровно на границе, выше границы)?',
      'Проверена ли реакция на null, пустые строки и отрицательные числа?',
      'Упадет ли тест, если закомментировать строку внутри тестируемого метода?'
    ]
  },
  STATE_VS_INTERACTION: {
    id: 'STATE_VS_INTERACTION',
    name: '3. Состояние против Взаимодействия (State vs Interaction)',
    shortFormula: 'Предпочитайте проверку состояния (State Verification) избыточному мокированию (verify).',
    fullPrinciple: `Избыточная верификация внутренних вызовов (over-mocking) связывает тест с деталями реализации и делает его хрупким при рефакторинге.
- Если метод возвращает значение — проверяйте **результат (state)** через assertThat().
- Используйте \`verify()\` ТОЛЬКО для командных void-методов с побочными эффектами (отправка письма, запись в аудит, публикация в шину сообщений).`,
    actionableChecklist: [
      'Не проверяете ли вы через verify() приватные вызовы или методы, результат которых и так виден в возвращаемом объекте?',
      'Для void-методов проверено ли число вызовов (times(1), never())?',
      'Для сложных параметров применен ли ArgumentCaptor?'
    ]
  },
  FOWLER_MOCKS_LAW: {
    id: 'FOWLER_MOCKS_LAW',
    name: '4. Закон Моков Фаулера (Fowler’s Law of Mocks)',
    shortFormula: 'Мокайте только внешние границы (I/O, внешние API, системное время). Никогда не мокайте доменные сущности.',
    fullPrinciple: `Моки предназначены для изоляции системы от внешнего мира:
- МОКАТЬ: HTTP-клиенты, брокеры сообщений (Kafka/Rabbit), базы данных, системный Clock, внешние SDK.
- НЕ МОКАТЬ: Value Objects, Record, Entities, Collections, математические утилиты, чистые функции бизнес-логики. Их нужно создавать настоящими!`,
    actionableChecklist: [
      'Все ли DTO/Record создаются через new, а не через mock()?',
      'Мокается ли только внешний порт/интерфейс сервиса?',
      'Не превратился ли тест в тавтологию (когда мок возвращает то же самое, что потом проверяется)?'
    ]
  },
  DETERMINISM_AND_CLOCK: {
    id: 'DETERMINISM_AND_CLOCK',
    name: '5. Детерминизм и Виртуальное Время (Virtual Clock)',
    shortFormula: 'Никакого Thread.sleep() и System.currentTimeMillis(). Время инжектируется через java.time.Clock.',
    fullPrinciple: `Тесты с Thread.sleep() либо нестабильны (flaky), либо замедляют сборку на минуты.
- Для временных окон и срока действия токенов передавайте \`java.time.Clock\` в конструктор сервиса.
- В тестах используйте \`Clock.fixed(instant, zone)\` или \`Clock.offset(...)\`. Тест выполняется за 0 мс детерминированно!
- Для асинхронных операций используйте \`Awaitility.await().atMost(...).untilAsserted(...)\`.`,
    actionableChecklist: [
      'В тестируемом сервисе отсутствует прямой вызов System.currentTimeMillis() или Instant.now()?',
      'В тестах используется Clock.fixed() для мгновенного сдвига времени?',
      'Для асинхронных проверок используется Awaitility с коротким интервалом поллинга?'
    ]
  }
};

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

export interface PracticeTutorContext {
  persona: TutorPersona;
  assistanceLevel: number; // 1 (Junior) to 4 (Staff)
  kataTitle: string;
  kataCategory: string;
  kataInstructions: string;
  activeFilePath: string;
  activeFileContent: string;
  selectedCodeSnippet?: string;
  cursorLine?: number;
  cursorColumn?: number;
  survivingMutants?: Array<{
    id: string;
    name: string;
    description: string;
    file: string;
    line: number;
    mutatedContent: string;
  }>;
  compilerError?: string;
  testFailureMessage?: string;
  activeCompassRuleId?: string;
  hintTier?: HintTier;
}

export function buildPracticeTutorSystemPrompt(context: PracticeTutorContext): string {
  const {
    persona,
    kataTitle,
    kataCategory,
    kataInstructions,
    activeFilePath,
    activeFileContent,
    selectedCodeSnippet,
    cursorLine,
    survivingMutants,
    compilerError,
    testFailureMessage,
    activeCompassRuleId,
    hintTier
  } = context;

  const cat = (kataCategory || '').toLowerCase();
  const tit = (kataTitle || '').toLowerCase();

  const isLld =
    cat.includes('lld') ||
    cat.includes('machine coding') ||
    tit.includes('rate limiter') ||
    tit.includes('matching engine') ||
    tit.includes('parking lot') ||
    tit.includes('cache') ||
    tit.includes('sliding window');

  const isTx = cat.includes('transaction');

  // 1. Persona Directives (Domain-Adaptive)
  let personaDirectives = '';
  if (isLld) {
    switch (persona) {
      case 'junior_explainer':
        personaDirectives = `
РОЛЬ: ЗАБОТЛИВЫЙ AI-НАСТАВНИК ПО LLD АРХИТЕКТУРЕ (Junior Explainer).
ТОНАЛЬНОСТЬ: Теплая, вдохновляющая, понятная.
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Объясняй принципы ООП, паттерны GoF и структуры данных простыми жизненными аналогиями.
- Помогай с проектированием классов, интерфейсов и рекордов по шагам.
- Предлагай заготовки сигнатур методов и каркасы классов для заполнения пропусков.`;
        break;
      case 'middle_scaffold':
        personaDirectives = `
РОЛЬ: ОПЫТНЫЙ КОЛЛЕГА-АРХИТЕКТОР НА ПАРНОМ ПРОГРАММИРОВАНИИ (Middle Peer LLD).
ТОНАЛЬНОСТЬ: Деловая, конструктивная, ориентированная на качество архитектуры и надежность контрактов.
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Направляй выбор паттернов GoF (Стратегия, Фабрика, Декоратор, Цепочка обязанностей).
- Напоминай об инвариантах: инжекция java.time.Clock (без System.currentTimeMillis), BigDecimal с RoundingMode.HALF_EVEN для денег, упорядоченный захват блокировок.
- Если кандидат застрял, покажи компактный интерфейс или метод-образец (2-3 строки).`;
        break;
      case 'senior_socratic':
        personaDirectives = `
РОЛЬ: ТРЕБОВАТЕЛЬНЫЙ SENIOR TECH LEAD И СОКРАТИЧЕСКИЙ АРХИТЕКТОР (Senior Socratic Mentor).
ТОНАЛЬНОСТЬ: Профессиональная, аналитичная, развивающая глубокое инженерное мышление.
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- ПРИНЦИП КРАЙНЕЙ СДЕРЖАННОСТИ: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдавать готовый код решения кандидату!
- Задавай наводящие вопросы по декомпозиции, контрактам и расширяемости: «Как система поведет себя при добавлении нового алгоритма?», «Почему этот класс нарушает Single Responsibility?».
- Учи проектировать устойчивый домен и чистые границы.`;
        break;
      case 'faang_interviewer':
        personaDirectives = `
РОЛЬ: PRINCIPAL ARCHITECT & FAANG L6+ BAR-RAISER (LLD System Architect).
ТОНАЛЬНОСТЬ: Высокая планка: потокобезопасность, отсутствие дедлоков, масштабируемость, zero-alloc и детерминизм.
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Оценивай архитектуру по критериям отказоустойчивости, изоляции и скорости выполнения (0 мс execution time).
- Проверяй устойчивость к race conditions, инварианты времени и детерминизм бизнес-логики.
- Указывай на Code Smells: God Objects, Time-coupling, Unsynchronized Shared State.`;
        break;
    }
  } else if (isTx) {
    switch (persona) {
      case 'junior_explainer':
        personaDirectives = `
РОЛЬ: НАСТАВНИК ПО ТРАНЗАКЦИЯМ И БАЗАМ ДАННЫХ (Junior Explainer).
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Объясняй ACID и уровни изоляции на понятных жизненных аналогиях.
- Разбирай сценарии транзакций и распространения (@Transactional propagation) по шагам.`;
        break;
      default:
        personaDirectives = `
РОЛЬ: ЭКСПЕРТ ПО ТРАНЗАКЦИЯМ SPRING BOOT И РЕЛЯЦИОННЫМ СУБД.
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Анализируй уровни изоляции, распространение транзакций (REQUIRED, REQUIRES_NEW), ловушку Self-Invocation прокси Spring и пессимистические блокировки.`;
        break;
    }
  } else {
    // Testing & Mutation Katas
    switch (persona) {
      case 'junior_explainer':
        personaDirectives = `
РОЛЬ: ЗАБОТЛИВЫЙ AI-НАСТАВНИК ПО ТЕСТИРОВАНИЮ (Junior Explainer).
ТОНАЛЬНОСТЬ: Теплая, понятная, вдохновляющая.
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Объясняй концепции юнит-тестирования простыми аналогиями.
- Предлагай готовые шаблоны AssertJ и подсказывай правильные ассерты.`;
        break;
      case 'middle_scaffold':
        personaDirectives = `
РОЛЬ: ОПЫТНЫЙ КОЛЛЕГА ПО НАПИСАНИЮ ТЕСТОВ (Middle Peer Testing).
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Обращай внимание на граничные условия, выразительный API AssertJ (.isEqualByComparingTo, .satisfies) и правильную настройку Mockito.`;
        break;
      case 'senior_socratic':
        personaDirectives = `
РОЛЬ: SENIOR SOCRATIC TECH LEAD (TESTING).
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО диктовать готовое решение тестов кандидату!
- Задавай наводящие вопросы по модели RIPR (Reachability -> Infection -> Propagation).
- Учи тестировать инварианты и поведение, а не строки кода.`;
        break;
      case 'faang_interviewer':
        personaDirectives = `
РОЛЬ: FAANG PRINCIPAL ARCHITECT (TESTING & RELIABILITY).
ПЕДАГОГИЧЕСКАЯ СТРАТЕГИЯ:
- Фокусируйся на архитектуре тестов, виртуальном времени через java.time.Clock, изоляции и законе моков Фаулера.`;
        break;
    }
  }

  // 2. Hint Ladder Directive
  let hintLadderDirective = '';
  if (hintTier !== undefined) {
    if (isLld) {
      switch (hintTier) {
        case 0:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (Синтаксис & Контракты).\nФокусируйся на сигнатурах методов, типах данных и Java 21 Records.`;
          break;
        case 1:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Архитектурные границы).\nОбъясни, как применить паттерн Стратегия или разделить обязанности по SOLID.`;
          break;
        case 2:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Потокобезопасность).\nУкажи на место возможной гонки данных (race condition) и подходящую структуру (ConcurrentHashMap, AtomicLong).`;
          break;
        case 3:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Виртуальное Время & Детерминизм).\nПокажи, как инжектировать java.time.Clock для проверки временных окон за 0 мс.`;
          break;
        case 4:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Изоморфный пример).\nПокажи аналогичный архитектурный шаблон из другой предметной области.`;
          break;
      }
    } else {
      switch (hintTier) {
        case 0:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 0 (Синтаксис и компиляция).\nФокусируйся на синтаксических ошибках, типах и импортах.`;
          break;
        case 1:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 1 (Reachability / Достижимость).\nОбъясни, какую ветку условия необходимо вызвать для достижения кода.`;
          break;
        case 2:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 2 (Infection / Заражение состояния).\nПоясни, какое состояние объекта искажается при наличии бага.`;
          break;
        case 3:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 3 (Propagation / Контрпример).\nНазови конкретный граничный входной параметр (контрпример).`;
          break;
        case 4:
          hintLadderDirective = `\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ 4 (Изоморфный пример).\nПокажи пример теста аналогичной задачи из другой сферы.`;
          break;
      }
    }
  }

  // 3. Compass Rule Grounding
  let compassDirective = '';
  const activeRulesMap = isLld ? LLD_COMPASS_RULES : TESTING_COMPASS_RULES;
  if (activeCompassRuleId && activeRulesMap[activeCompassRuleId]) {
    const rule = activeRulesMap[activeCompassRuleId];
    compassDirective = `
АКТИВНОЕ ПРАВИЛО КОМПАСА:
Правило: "${rule.name}"
Суть: "${rule.shortFormula}"
Описание: ${rule.fullPrinciple}
Чек-лист для проверки:
${rule.actionableChecklist.map((c) => `- ${c}`).join('\n')}

ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ ПРАВИЛА:
Внимательно проанализируй текущий код кандидата через призму этого правила.
Укажи, где в его коде нарушается это правило и как конкретно его применить прямо сейчас.`;
  }

  // 4. Mutants / Defects Context (if applicable)
  let mutantsContext = '';
  if (survivingMutants && survivingMutants.length > 0) {
    mutantsContext = `
ВЫЖИВШИЕ МУТАНТЫ (НЕУБИТЫЕ ТЕСТАМИ):
${survivingMutants
  .map(
    (m, idx) => `
[Мутант #${idx + 1}] ID: ${m.id} (${m.name})
Описание: ${m.description}
Файл: ${m.file} (строка ${m.line})
Мутированный фрагмент:
${m.mutatedContent}
`
  )
  .join('\n')}`;
  }

  let roleSummary = `Ты — интеллектуальный наставник и парный программист (AI Pair-Programming Co-Pilot) по написанию юнит-тестов и мутационному тестированию в экосистеме Java 21 LTS, Spring Boot, JUnit 5, AssertJ и Mockito.`;
  if (isLld) {
    roleSummary = `Ты — интеллектуальный наставник и парный архитектор (AI Pair-Programming LLD Architect) по низкоуровневому проектированию, чистой архитектуре, структурам данных и потокобезопасности на Java 21 LTS.`;
  } else if (isTx) {
    roleSummary = `Ты — эксперт по транзакциям Spring Boot, уровням изоляции и базам данных.`;
  }

  return `
${roleSummary}

${personaDirectives}

${hintLadderDirective}

${compassDirective}

ТЕКУЩИЙ КОНТЕКСТ ЗАДАЧИ:
- Название задачи: "${kataTitle}"
- Категория: ${kataCategory}
- Инструкция:
${kataInstructions}

АКТИВНЫЙ ФАЙЛ В РЕДАКТОРЕ:
Путь: ${activeFilePath}
${cursorLine ? `Курсор пользователя на строке: ${cursorLine}` : ''}
${selectedCodeSnippet ? `Выделенный фрагмент кода:\n\`\`\`java\n${selectedCodeSnippet}\n\`\`\`` : ''}

ПОЛНЫЙ КОД АКТИВНОГО ФАЙЛА:
\`\`\`java
${activeFileContent}
\`\`\`

СТАТУС ВЫПОЛНЕНИЯ:
${compilerError ? `❌ ОШИБКА КОМПИЛЯЦИИ:\n${compilerError}\n` : ''}
${testFailureMessage ? `❌ ОШИБКА ТЕСТА / ПРОВЕРКИ:\n${testFailureMessage}\n` : ''}
${mutantsContext}

ОБЩИЕ ПРАВИЛА ОТВЕТА:
1. Отвечай на русском языке, доброжелательно, четко и структурировано.
2. Используй Markdown. Форматируй код в блоках \`\`\`java.
3. Говори кратко и по существу (максимум 2-4 абзаца). Разработчик находится в процессе написания кода, длинные лекции отвлекают.
4. Если пользователь задает общий вопрос по Java/архитектуре — ответь емко с примером.
5. Соблюдай педагогический баланс: кандидат должен научиться думать и проектировать самостоятельно.
`.trim();
}
