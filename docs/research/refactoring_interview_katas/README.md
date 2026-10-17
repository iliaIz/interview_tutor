# Навигатор по Deep Research исследованию задач на Рефакторинг (SOTA Late 2026)

> **Локация:** `docs/research/refactoring_interview_katas/`  
> **Цель:** Сбор и валидация эталонного банка реальных задач на Code Review & Refactoring с собеседований BigTech и FinTech.

---

## 🗂️ Структура подготовленных промптов

Для проведения глубокого исследования подготовлено 4 модульных промпта. Они разделены по грейдам и архитектурным доменам, чтобы исключить поверхностные ответы нейросетей и получить глубокий продакшен-код:

| Файл промпта | Целевой грейд | Фокус исследования | Примеры тем |
|---|---|---|---|
| [`00_master_source_mining_protocol.md`](00_master_source_mining_protocol.md) | **Все уровни** (Методология) | Мастер-протокол поиска открытых репозиториев, утечек с собеседований (Яндекс, Т-Банк, Озон, Amazon, Emily Bache, Martin Fowler, Habr, LeetCode Discuss). | Краулинг источников, фильтрация шума, стандарты включения. |
| [`01_junior_middle_clean_code_and_patterns.md`](01_junior_middle_clean_code_and_patterns.md) | **Junior (L0) & Middle (L1)** | Устранение запахов кода (Code Smells), замена вложенных `if-else`/`switch` на полиморфизм и Strategy, Primitive Obsession $\to$ Value Objects/Records, швы Майкла Физерса. | *DiscountCalculator*, *UserRegistrationDataClump*, *OrderOrchestrator*, *TripService*. |
| [`02_senior_concurrency_loom_transactions.md`](02_senior_concurrency_loom_transactions.md) | **Senior (L2)** | Concurrency, JMM, Project Loom Carrier Thread Pinning, гонки за баланс, дедлоки, сужение границ `@Transactional`, истощение пула HikariCP, Scoped Values. | *MultiAccountTransferLedger*, *TokenBucketRateLimiter*, *IdleInTxHikariStarvation*. |
| [`03_staff_enterprise_decoupling_and_legacy_migration.md`](03_staff_enterprise_decoupling_and_legacy_migration.md) | **Staff / Principal (L3)** | Архитектурный рефакторинг: выделение Hexagonal Architecture (Ports & Adapters), ликвидация Dual-Write через Transactional Outbox, миграция Spring Boot 2.x $\to$ 3.4 / Jakarta EE, Anti-Corruption Layer. | *MonolithHexagonalDecoupling*, *DualWriteToOutboxMigration*, *LegacyGatewayJakartaMigration*. |

---

## 🚀 Рекомендации по запуску Deep Research

1. **Рекомендуемые движки:**
   - **Gemini Advanced (с режимом Deep Research)** — идеально для глубокого многостраничного синтеза кода и следования строгим схемам.
   - **ChatGPT Pro (o3 / Deep Research)** — отлично ищет по инженерным блогам и закрытым дискуссиям.
   - **Perplexity Pro (Deep Research)** — отлично собирает ссылки на первоисточники и репозитории GitHub.
2. **Как запускать:**
   - Откройте соответствующий `.md` файл, скопируйте его содержимое целиком и вставьте в окно запроса Deep Research без сокращений.
   - Можно запускать каждый промпт отдельным исследованием — так каждый грейд будет проработан с максимальной детальностью (с полными классами кода и тестами JUnit 5).
3. **Что делать с полученными отчетами:**
   - Сохраните результаты в папку `docs/research/refactoring_interview_katas/reports/` (например, `report_01_junior_middle.md`, `report_02_senior.md`, `report_03_staff.md`) или просто скопируйте их текст в наш диалог.
   - На основе полученных отчетов мы отберем лучшие каты, конвертируем их в манифесты платформы и добавим в каталог Практики.
