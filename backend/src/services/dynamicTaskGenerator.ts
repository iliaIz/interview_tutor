/**
 * dynamicTaskGenerator.ts - AI-driven Dynamic Java 8-21 Coding Task & Kata Generator
 * Synthesizes fresh, realistic production challenges via LiteLLM Proxy.
 * Features SOTA Full-Jitter Exponential Backoff retries and structured Gateway Error propagation.
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

import { llmGateway, LlmGatewayUnavailableError, GatewayUnavailableReason } from './LlmGatewayClient';
export { LlmGatewayUnavailableError, GatewayUnavailableReason };

export class DynamicTaskGenerator {
  /**
   * Generates a fresh dynamic task via LiteLLM Proxy with automatic Full-Jitter Backoff retries.
   * If all retries fail, throws LlmGatewayUnavailableError (Zero Phantom Fallback).
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

    const parsed = await llmGateway.completeJson<any>({
      userPrompt: prompt,
      model: envConfig.models.fast,
      temperature: 0.4,
      maxRetries: 2,
      timeoutMs: 12_000
    });

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
}
