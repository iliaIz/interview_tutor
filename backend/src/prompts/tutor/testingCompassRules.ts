/**
 * testingCompassRules.ts
 *
 * 5 Golden Rules of Testing & Mutation Katas (Testing Compass).
 */

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
