/**
 * dynamicTaskGenerator.ts - AI-driven Dynamic Java 8-21 Coding Task & Kata Generator
 * Synthesizes fresh, realistic production challenges, buggy code, Golden Masters,
 * and JUnit 5 / Awaitility test suites based on the 70 SOTA archetypes.
 */

import { envConfig } from '../config/env';

export type TaskDomain = 'streams' | 'concurrency' | 'testing' | 'spring';
export type TaskDifficulty = 'middle' | 'senior' | 'lead';
export type TaskArchetype = 
  | 'CarrierThreadPinning'
  | 'StreamsBottleneck'
  | 'LegacySeamRefactoring'
  | 'SliceTestCreation'
  | 'LockFreeOptimization'
  | 'CustomGathererCollector'
  | 'PitestMutationChallenge';

export interface DynamicTaskRequest {
  domain: TaskDomain;
  difficulty?: TaskDifficulty;
  archetype?: TaskArchetype;
  scenarioTheme?: string;
}

export interface DynamicTaskResult {
  id: string;
  title: string;
  domain: TaskDomain;
  difficulty: TaskDifficulty;
  archetype: string;
  scenario: string;
  naiveCode: string;
  goldenMaster: string;
  testSuite: string;
  astRules: string[];
  evaluationCriteria: string[];
}

export class DynamicTaskGenerator {
  /**
   * Generates a fresh dynamic task via LiteLLM Proxy or returns curated fallback.
   */
  public static async generateTask(params: DynamicTaskRequest): Promise<DynamicTaskResult> {
    const {
      domain = 'streams',
      difficulty = 'senior',
      archetype = 'StreamsBottleneck',
      scenarioTheme = 'E-commerce & Highload Processing'
    } = params;

    const taskId = `DYN-${domain.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase()}`;

    const prompt = `Ты Principal Java Architect и автор задач для технического собеседования Senior/Lead инженеров.
Сгенерируй ОДНУ новую, глубокую практическую задачу по программированию на Java 21+ по следующим спецификациям:

ПАРАМЕТРЫ ЗАДАЧИ:
- Домен: ${domain} (Java Streams / Concurrency & Loom / Modern Testing / Spring Boot 3.4+)
- Уровень сложности: ${difficulty}
- Архетип дефекта: ${archetype}
- Бизнес-сценарий: ${scenarioTheme}

ТРЕБОВАНИЯ К СОДЕРЖАНИЮ:
1. "title": Короткое, звучное инженерное название задачи (на русском языке).
2. "scenario": Описание реального производственного контекста, почему наивный код падает в продакшене (OutOfMemoryError, Carrier Thread Pinning, Deadlock, Flaky test, NPE).
3. "naiveCode": Исходный код класса на Java с реалистичным архитектурным дефектом или антипаттерном.
4. "goldenMaster": Эталонное решение на Java 21+ (ReentrantLock / StampedLock / ScopedValue / mapMulti / teeing / @MockitoBean / @ServiceConnection), устраняющее дефект.
5. "testSuite": Параметризованный тест JUnit 5 / AssertJ / Awaitility, проверяющий исправление.
6. "astRules": Список из 2-3 ключевых синтаксических правил для проверки.
7. "evaluationCriteria": 3-4 конкретных пункта оценки.

ФОРМАТ ОТВЕТА — СТРОГО JSON БЕЗ КАВЫЧЕК MARKDOWN:
{
  "title": "Название",
  "scenario": "Контекст инцидента",
  "naiveCode": "Код с багом",
  "goldenMaster": "Эталонный код",
  "testSuite": "JUnit 5 тест",
  "astRules": ["no-synchronized-in-loom", "safe-collection-usage"],
  "evaluationCriteria": ["Исключение блокировок", "Zero-allocation", "Потокобезопасность"]
}`;

    try {
      const endpointUrl = envConfig.proxy.chatUrl;
      const proxyApiKey = envConfig.proxy.apiKey;
      const modelName = envConfig.models.fast;

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proxyApiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content?.trim() || '';
        const cleanedJson = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleanedJson);

        return {
          id: taskId,
          title: parsed.title || 'Dynamic Production Incident Kata',
          domain,
          difficulty,
          archetype: archetype || 'CustomIncident',
          scenario: parsed.scenario || 'Real-world production performance kata',
          naiveCode: parsed.naiveCode || '// Naive implementation',
          goldenMaster: parsed.goldenMaster || '// Golden Master solution',
          testSuite: parsed.testSuite || '// Verification test',
          astRules: parsed.astRules || ['no-antipatterns'],
          evaluationCriteria: parsed.evaluationCriteria || ['Correctness', 'Performance']
        };
      }
    } catch (err) {
      console.warn('DynamicTaskGenerator proxy generation fallback:', err);
    }

    // Fallback template based on domain
    return this.getFallbackTask(taskId, domain, difficulty, archetype);
  }

  private static getFallbackTask(
    id: string,
    domain: TaskDomain,
    difficulty: TaskDifficulty,
    archetype: TaskArchetype
  ): DynamicTaskResult {
    if (domain === 'concurrency') {
      return {
        id,
        title: 'Устранение Carrier Thread Pinning в платежном шлюзе',
        domain: 'concurrency',
        difficulty: 'senior',
        archetype: 'CarrierThreadPinning',
        scenario: 'При переходе на Virtual Threads (Java 21) метод `sendNotification` использует `synchronized` вокруг вызова HTTP клиента, что вызывает привязку Carrier Thread и отказ сервиса при 50 000 RPS.',
        naiveCode: `public class PaymentNotificationService {
    private final HttpClient client = HttpClient.newHttpClient();

    public synchronized void sendNotification(String url, String payload) throws Exception {
        // ОШИБКА: synchronized блокирует Carrier Thread во время сетевого вызова
        HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url)).POST(BodyPublishers.ofString(payload)).build();
        client.send(req, BodyHandlers.discarding());
    }
}`,
        goldenMaster: `public class PaymentNotificationService {
    private final HttpClient client = HttpClient.newHttpClient();
    private final ReentrantLock lock = new ReentrantLock();

    public void sendNotification(String url, String payload) throws Exception {
        lock.lock();
        try {
            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url)).POST(BodyPublishers.ofString(payload)).build();
            client.send(req, BodyHandlers.discarding());
        } finally {
            lock.unlock();
        }
    }
}`,
        testSuite: `@Test
void testVirtualThreadsNoPinning() throws Exception {
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        for (int i = 0; i < 1000; i++) {
            executor.submit(() -> service.sendNotification("http://mock", "ping"));
        }
    }
}`,
        astRules: ['carrier-thread-pinning', 'lock-try-finally'],
        evaluationCriteria: ['Замена synchronized на ReentrantLock', 'Блок try-finally для unlock', 'Отсутствие блокировок Carrier Threads']
      };
    }

    if (domain === 'testing') {
      return {
        id,
        title: 'Развязка Legacy-зависимостей через Subclass & Override Seam',
        domain: 'testing',
        difficulty: 'middle',
        archetype: 'LegacySeamRefactoring',
        scenario: 'Метод `processOrder` вызывает статический `LegacyBankSocket.charge()`. Необходимо изолировать сетевой вызов для unit-тестирования без изменения сигнатуры публичного метода.',
        naiveCode: `public class OrderService {
    public boolean processOrder(Order order) {
        // Статический сокет ломает unit-тесты
        return LegacyBankSocket.charge(order.userId(), order.amount());
    }
}`,
        goldenMaster: `public class OrderService {
    public boolean processOrder(Order order) {
        return executeCharge(order.userId(), order.amount());
    }

    protected boolean executeCharge(String userId, double amount) {
        return LegacyBankSocket.charge(userId, amount);
    }
}`,
        testSuite: `@Test
void testOrderServiceWithSeam() {
    OrderService service = new OrderService() {
        @Override
        protected boolean executeCharge(String userId, double amount) {
            return true;
        }
    };
    assertThat(service.processOrder(new Order("u1", 100))).isTrue();
}`,
        astRules: ['protected-seam-extraction', 'no-public-api-break'],
        evaluationCriteria: ['Выделение protected метода', 'Создание test-double подкласса в тесте', 'Сохранение сигнатуры публичного API']
      };
    }

    // Default: Streams domain
    return {
      id,
      title: 'Безопасный Map-коллектор с null-значениями и слиянием коллизий',
      domain: 'streams',
      difficulty: 'senior',
      archetype: 'StreamsBottleneck',
      scenario: 'Коллектор `Collectors.toMap` падает с NullPointerException при наличии null-значений в DTO из-за Map.merge. Напишите безопасный кастомный коллектор.',
      naiveCode: `public static Map<String, String> collectToMap(List<UserDTO> users) {
    // NPE при users с name == null!
    return users.stream().collect(Collectors.toMap(UserDTO::id, UserDTO::name));
}`,
      goldenMaster: `public static Map<String, String> collectToSafeMap(List<UserDTO> users) {
    return users.stream().collect(
        HashMap::new,
        (map, user) -> map.put(user.id(), user.name()),
        HashMap::putAll
    );
}`,
      testSuite: `@Test
void testSafeMapWithNulls() {
    List<UserDTO> list = List.of(new UserDTO("1", "Alice"), new UserDTO("2", null));
    Map<String, String> map = collectToSafeMap(list);
    assertThat(map).containsEntry("1", "Alice").containsEntry("2", null);
}`,
      astRules: ['safe-tomap-collision', 'null-safety'],
      evaluationCriteria: ['Поддержка null-значений', 'Корректная обработка коллизий ключей', 'Идемпотентный combiner']
    };
  }
}
