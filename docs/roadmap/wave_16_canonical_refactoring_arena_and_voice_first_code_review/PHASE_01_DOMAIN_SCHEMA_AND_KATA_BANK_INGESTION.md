# Phase 1: Доменная модель `RefactoringChallengeManifest` и банк 24 канонических задач

> **Директория:** `docs/roadmap/wave_16_canonical_refactoring_arena_and_voice_first_code_review/`  
> **Целевой стандарт:** SOTA Late 2026 Type-Safe Schema Definition & Declarative Challenge Bank  
> **Шлюз:** `Gate 1: Schema & Bank Validated`

---

## 1. Проблема и цели этапа

В существующей кодовой базе задачи на кодинг хранятся в таблице `coding_challenges`, ориентированной на написание решений с нуля (Machine Coding / LeetCode-style) или точечные мутационные тесты (`testing_mutation`). 

У задач на рефакторинг принципиально иной жизненный цикл и структура данных:
- Наличие предзаданного **грязного кода** (Dirty Code) с несколькими файлами.
- Наличие **характеризационных тестов** (Pin-Down Tests), защищающих базовые инварианты.
- Наличие **структурированного чек-листа запахов кода** (Code Smells Checklist) для голосового и текстового трекинга.
- Наличие **пула сократических подсказок** и **углубляющих Bar-Raiser вопросов** для устной защиты.
- Наличие **правил статической верификации байткода и AST** (например, запрет `monitorenter`, запрет `double` в деньгах).

**Цель Фазы 1:** Разработать строгую Zod/TypeScript доменную модель `RefactoringChallengeManifest`, создать банк из 24 канонических задач (по 6 на грейд) на основе исследовательских отчетов и обеспечить их бесшовную гидратацию в базу данных SQLite.

---

## 2. Спецификация доменной схемы `RefactoringChallengeManifest`

Схема создается в `shared/src/schemas/refactoringManifest.ts` (с реэкспортом в `shared/src/index.ts`):

```typescript
import { z } from 'zod';

export const RefactoringGradeEnum = z.enum([
  'L0_JUNIOR',
  'L1_MIDDLE',
  'L2_SENIOR',
  'L3_STAFF'
]);

export const CodeSmellItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum([
    'CLEAN_CODE',
    'CONCURRENCY_JMM',
    'TRANSACTION_BOUNDARY',
    'ARCHITECTURAL_COUPLING',
    'RESOURCE_MANAGEMENT',
    'TYPE_SAFETY'
  ]),
  description: z.string(),
  targetLinesSnippet: z.string().optional(),
  voiceKeywords: z.array(z.string()), // Ключевые слова для голосового детектора (e.g. ["carrier pinning", "synchronized", "монитор"])
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR'])
});

export const BarRaiserQuestionSchema = z.object({
  id: z.string(),
  questionText: z.string(),
  voicePrompt: z.string(), // Короткий устный вопрос ИИ
  idealResponseSummary: z.string(), // Критерии эталонного ответа
  followUpDeepDives: z.array(z.string())
});

export const AstBytecodeConstraintSchema = z.object({
  disallowedBytecodeOpcodes: z.array(z.string()).default([]), // e.g. ["monitorenter", "monitorexit"]
  disallowedClassImports: z.array(z.string()).default([]), // e.g. ["java.lang.ThreadLocal", "javax.servlet.*"]
  disallowedPrimitivesInFields: z.array(z.string()).default([]), // e.g. ["double", "float"]
  requiredInjections: z.array(z.string()).default([]) // e.g. ["java.time.Clock"]
});

export const RefactoringChallengeManifestSchema = z.object({
  id: z.string().regex(/^[L][0-3]-REF-\d{2}$/),
  title: z.string(),
  grade: RefactoringGradeEnum,
  archetype: z.string(),
  estimatedMinutes: z.number().default(45),
  companyContext: z.string(),
  problemDescriptionMarkdown: z.string(),
  
  // Исходный репозиторий / файлы задачи
  initialFiles: z.record(z.string(), z.string()), // path -> content ("Dirty Code")
  pinDownTestFiles: z.record(z.string(), z.string()), // path -> testContent
  referenceSolutionFiles: z.record(z.string(), z.string()), // path -> cleanContent
  
  // Голосовой и сократический контур
  smellsChecklist: z.array(CodeSmellItemSchema),
  socraticProbes: z.array(z.object({
    triggerCondition: z.string(),
    spokenGuidance: z.string()
  })),
  barRaiserQuestions: z.array(BarRaiserQuestionSchema),
  
  // Ограничения автоматической песочницы (3-Gate)
  structuralConstraints: AstBytecodeConstraintSchema
});

export type RefactoringChallengeManifest = z.infer<typeof RefactoringChallengeManifestSchema>;
```

---

## 3. Банк 24 канонических задач (SSOT Bank)

Банк сохраняется в `json/refactoring_challenges.json`. Каждая задача наполняется непосредственно из 4 отчетов Deep Research:

### Уровень Junior (L0) — 6 задач
1. `L0-REF-01`: **Multi-Tier Shipping Rate Calculator** (Guard Clauses, Java 21 Exhaustive Switch, устранение вложенных if-else).
2. `L0-REF-02`: **User Account Lifecycle & Notification Manager** (Декомпозиция God Class по SRP, Constructor DI).
3. `L0-REF-03`: **FinTech KYC Onboarding Validator** (Primitive Obsession $\to$ Java 21 Records с компактными конструкторами и Value Objects).
4. `L0-REF-04`: **Trip Service Legacy Seam** (Subclass and Override Seam Майкла Физерса, разрыв связности со статическим синглтоном).
5. `L0-REF-05`: **Multi-Modal Freight Tariff Calculator** (Исчерпывающий паттерн-матчинг по Sealed Hierarchy).
6. `L0-REF-06`: **Compliance Audit Log Ingestion Service** (Устранение утечки файловых дескрипторов, `try-with-resources`).

### Уровень Middle (L1) — 6 задач
1. `L1-REF-01`: **E-Commerce Dynamic Discount & Promo Engine** (Strategy Pattern, Sealed Interfaces, устранение God Switch).
2. `L1-REF-02`: **Cross-Border Invoice Billing & Settlement** (Value Object `Money`, защитные копии, Banker's rounding `HALF_EVEN`).
3. `L1-REF-03`: **Order Fulfillment Orchestrator** (Выделение гексагональных портов, изоляция от WMS/SMTP, `@MockitoBean`).
4. `L1-REF-04`: **Legacy Compliance Audit & PDF Report Generator** (Внедрение `java.time.Clock`, шов через перегруженный конструктор).
5. `L1-REF-05`: **Perishable Dark-Store Dynamic Pricer** (Временные окна уценки, исключение плавающей точки, детерминированные тесты).
6. `L1-REF-06`: **Corporate Travel Expense Authorizer** (Цепочка обязанностей / Chain of Responsibility, исключение мутаций).

### Уровень Senior (L2) — 6 задач
1. `L2-REF-01`: **ConcurrentPaymentGatewayClient** (Устранение Carrier Thread Pinning в Project Loom, замена `synchronized` на `ReentrantLock`).
2. `L2-REF-02`: **TokenBucketRateLimiterAndSessionCache** (Оптимистичные блокировки `StampedLock`, Lock-Free CAS в кэше сессий).
3. `L2-REF-03`: **InventoryAllocationManager** (Устранение гонки Check-Then-Act в ConcurrentHashMap через `compute()`).
4. `L2-REF-04`: **DeadlockFreeTransferService** (Упорядочивание блокировок по глобальному ID, предотвращение дедлоков в переводах).
5. `L2-REF-05`: **OrderCheckoutHikariStarvation** (Сужение границ `@Transactional`, вынос блокирующего HTTP за пределы удержания соединения БД).
6. `L2-REF-06`: **SecurityContextThreadLocalLeak** (Устранение утечки памяти и подмены контекста, миграция на Java 21 `ScopedValue`).

### Уровень Staff / Principal (L3) — 6 задач
1. `L3-REF-01`: **OrderProcessingHexagonalDecoupling** (Очистка доменного ядра от JPA, HTTP и брокеров в гексагональную архитектуру).
2. `L3-REF-02`: **DualWritePaymentNotifierRefactoring** (Ликвидация Dual-Write через Transactional Outbox с `SKIP LOCKED` и Reaper-процессом).
3. `L3-REF-03`: **LegacySpring2EnterpriseGatewayMigration** (Миграция API-шлюза со Spring Boot 2.7 / Java 8 на Spring Boot 3.4+ / Java 21).
4. `L3-REF-04`: **CoreBankingLegacyConnectorACL** (Построение Anti-Corruption Layer для изоляции современного сервиса от SOAP/XML мейнфрейма).
5. `L3-REF-05`: **OrderPlacementOutboxMigration** (Миграция поллинга БД на CDC Outbox через Debezium Event Router SMT).
6. `L3-REF-06`: **ThirdPartyLogisticsTranslator** (Идемпотентный шлюз и полиглотный ACL для разнородных 3PL провайдеров).

---

## 4. Схема БД SQLite и скрипт гидратации

В `data/interview.db` создается таблица:

```sql
CREATE TABLE IF NOT EXISTS refactoring_challenges (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    grade TEXT NOT NULL,
    archetype TEXT NOT NULL,
    company_context TEXT NOT NULL,
    estimated_minutes INTEGER DEFAULT 45,
    manifest_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refactoring_grade ON refactoring_challenges(grade);
```

Скрипт миграции `scripts/ingest_refactoring_challenges.py`:
- Читает `json/refactoring_challenges.json`.
- Валидирует каждый манифест через Zod-схему (через runner или python pydantic эквивалент).
- Заполняет таблицу `refactoring_challenges` в идемпотентном режиме (`INSERT OR REPLACE`).

---

## 5. Критерии приемки и прохождение Шлюза 1 (Exit Gate 1)

- [ ] Файл `shared/src/schemas/refactoringManifest.ts` создан и экспортирован без ошибок TypeScript.
- [ ] Файл `json/refactoring_challenges.json` содержит ровно 24 валидных манифеста с полными исходниками на Java 21.
- [ ] Скрипт `scripts/ingest_refactoring_challenges.py` успешно выполняется и заполняет `data/interview.db`.
- [ ] Все 24 эталонных решения компилируются без ошибок компилятора `javac --release 21`.
