# 03. Practice Arena: LLD & Machine Coding Specification

> **Версия**: 2.0 (Сентябрь 2026)  
> **Статус**: Production Ready  
> **Роут**: `/` -> Студия: Вкладка `practice` (задачи с категорией `LLD & Machine Coding` или треком `lld_*`)

---

## 1. Назначение и концепция
Режим низкоуровневого проектирования (Low-Level Design / LLD) и Machine Coding на чистой Java 21: реализация продакшен-сервисов (Rate Limiter со скользящим окном, In-Memory Cache с LRU/TTL, Idempotent Payment Processor, Event Scheduler, Double-Entry Ledger).

---

## 2. Диалоговый движок и роли ИИ
* **Транспорт**:
  * **Голосовой**: WebSocket `/ws/live?sessionType=tutor&tutorMode=practice_pair&category=LLD+%26+Machine+Coding&track={track}`.
  * **Текстовый**: SSE `/api/practice-tutor/chat`.
* **Роль ИИ**: Principal LLD Architect.
* **Стиль диалога**: Архитектурно-строгий, сфокусированный на потокобезопасности, инжекции виртуального времени, банковской точности расчетов и отсутствии дедлоков.
* **Динамическое приветствие**: Здоровается исключительно в контексте архитектуры LLD (без упоминания мутантов или юнит-тестирования).

---

## 3. Активный Компас: LLD Compass
* **Компонент**: `LLDCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей Архитектора (Java 21)**:
  1. **Time Virtualization Invariant**: Инжекция `java.time.Clock` в конструктор, запрет `System.currentTimeMillis()` и `Instant.now()`. Тестирование за 0 мс через `Clock.fixed()`.
  2. **Financial Precision Invariant**: `BigDecimal` с явным масштабом и банковским округлением (`RoundingMode.HALF_EVEN`). Полный запрет `double`/`float` в деньгах.
  3. **Deadlock-Free Concurrency (Ordered Locking)**: Захват блокировок в глобальном строгом порядке: `lock(min(id1, id2)) -> lock(max(id1, id2))`. Использование `ConcurrentHashMap`, `AtomicLong`, `StampedLock`.
  4. **Interface Segregation & GoF Patterns**: Тонкие интерфейсы (ISP), паттерны Стратегия / Фабрика / Декоратор, Java 21 `record` для иммутабельных Value Objects и событий.
  5. **Fail-Fast & Invariant Defensive Guards**: Проверка инвариантов в конструкторе (`Objects.requireNonNull`), защита от утечки коллекций (`Collections.unmodifiableList`), выброс понятных доменных исключений.

---

## 4. Рабочее пространство (Non-Modal Integrated Standard)
* **Интегрированная вкладка Доски**: Вкладка **`[ 🎨 Доска ИИ (vN) ]`** над Monaco/CodeMirror редактором с горячей клавишей **`Alt + W`** (и `Esc` для выхода).
* **Синхронизация артефактов**: Когда голосовой напарник пишет на доске пример структуры классов или паттерна (`update_whiteboard`), код мгновенно появляется во вкладке с версионностью (`CodeArtifactTimeline`) и diff-просмотром.
* **Статические AST-проверки**: В реальном времени подсвечивают нарушения правил `enforce-clock-injection` и `no-double-in-money`.
