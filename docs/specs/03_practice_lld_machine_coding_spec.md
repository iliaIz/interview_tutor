# 03. Practice Arena: LLD & Machine Coding Specification

## Назначение
Режим архитектурного проектирования низкоуровневого дизайна (Low-Level Design), паттернов GoF, чистой архитектуры и многопоточных сервисов (Rate Limiter, Idempotent Payment Processor, LRU Cache, Concurrency Lab).

## Диалоговый движок
* **Транспорт**: 
  * Голосовой: WebSocket `/ws/live?sessionType=tutor&tutorMode=practice_pair`.
  * Текстовый: SSE `/api/practice-tutor/chat`.
* **Роль ИИ**: Principal LLD Architect.
* **Фокус наставничества**: Декомпозиция классов, потокобезопасность, принципы SOLID, изоляция домена от инфраструктуры, соблюдение финансовых инвариантов.

## Активный Компас
* **Компонент**: `LLDCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей LLD**:
  1. **Time Virtualization Invariant**: Инжекция `java.time.Clock`, запрет `System.currentTimeMillis()`.
  2. **Financial Precision Invariant**: `BigDecimal` с явным масштабом и `HALF_EVEN` для денег и балансов; запрет `double`/`float`.
  3. **Deadlock-Free Concurrency**: Захват блокировок в строгом глобальном порядке `lock(min, max)`; `ConcurrentHashMap`, `AtomicLong`.
  4. **Interface Segregation & GoF Patterns**: Тонкие интерфейсы, паттерны Стратегия / Фабрика, разделение домена и I/O.
  5. **Fail-Fast & Invariant Defense**: Валидация входных аргументов, иммутабельность (`List.copyOf`, Record), доменные исключения.

## Инструменты и рабочее пространство
* **Инструменты модели**: `update_whiteboard` (демонстрация структуры интерфейсов, рекордов и паттернов).
* **Формат доски в UI**: Вкладка над кодом `[ 🎨 Доска ИИ (vN) ]` с кнопкой Side-by-Side Diff, таймлайном версий и горячей клавишей `Alt+W`.
* **AST-валидаторы**: Статическая верификация `enforce-clock-injection` и `no-double-in-money`.
