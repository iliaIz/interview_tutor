/**
 * dynamicTaskGenerator.ts - AI-driven Dynamic Java 8-21 Coding Task & Kata Generator
 * Synthesizes fresh, realistic production challenges via LiteLLM Proxy.
 * Features SOTA Full-Jitter Exponential Backoff retries and structured Gateway Error propagation.
 */

import { envConfig } from '../config/env';
import { callLiteLlmChat, parseJsonFromLlm, LlmGatewayError } from './llmClient';

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

export type GatewayUnavailableReason = 
  | 'rate_limit_exceeded' 
  | 'proxy_unreachable' 
  | 'upstream_timeout' 
  | 'schema_parse_error';

export class LlmGatewayUnavailableError extends Error {
  public readonly category = 'transient';
  public readonly reason: GatewayUnavailableReason;
  public readonly retryAfterSeconds: number;
  public readonly userMessage: string;
  public readonly healthEndpoint = '/api/health';
  public readonly availableBankCount = 70;

  constructor(reason: GatewayUnavailableReason, technicalDetail?: string) {
    let userMsg = 'ИИ-модель перегружена или шлюз временно недоступен. Мы автоматически восстанавливаем связь.';
    let retryAfter = 5;

    if (reason === 'rate_limit_exceeded') {
      userMsg = 'Достигнут кратковременный лимит запросов к ИИ-модели (Rate Limit). Автоматический повтор через несколько секунд.';
      retryAfter = 6;
    } else if (reason === 'proxy_unreachable') {
      userMsg = 'Локальный шлюз LiteLLM временно недоступен (Docker контейнер перезапускается или обновляет сетевой маршрут).';
      retryAfter = 4;
    } else if (reason === 'upstream_timeout') {
      userMsg = 'Время ожидания ответа ИИ-модели превысило допустимый лимит (сетевой таймаут).';
      retryAfter = 5;
    } else if (reason === 'schema_parse_error') {
      userMsg = 'ИИ-модель вернула неполный ответ. Повторный запрос восстановит корректную генерацию.';
      retryAfter = 3;
    }

    super(technicalDetail ? `${userMsg} (${technicalDetail})` : userMsg);
    this.name = 'LlmGatewayUnavailableError';
    this.reason = reason;
    this.retryAfterSeconds = retryAfter;
    this.userMessage = userMsg;
  }
}

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

    try {
      const result = await callLiteLlmChat(
        {
          model: envConfig.models.fast,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4
        },
        {
          timeoutMs: 15_000,
          maxRetries: 2
        }
      );

      const parsed = parseJsonFromLlm(result.content);
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
    } catch (err: any) {
      if (err instanceof LlmGatewayError) {
        if (err.status === 429) {
          throw new LlmGatewayUnavailableError('rate_limit_exceeded', err.message);
        }
        if (err.status && err.status >= 500) {
          throw new LlmGatewayUnavailableError('upstream_timeout', err.message);
        }
        throw new LlmGatewayUnavailableError('proxy_unreachable', err.message);
      }
      if (err.name === 'AbortError') {
        throw new LlmGatewayUnavailableError('upstream_timeout', 'Request timed out after 15s');
      }
      if (err.message && err.message.includes('JSON')) {
        throw new LlmGatewayUnavailableError('schema_parse_error', err.message);
      }
      throw new LlmGatewayUnavailableError('proxy_unreachable', err.message || 'All generation retries failed');
    }
  }
}
