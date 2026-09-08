# 04. Transaction Lab Arena Specification

> **Версия**: 2.0 (Сентябрь 2026)  
> **Статус**: Production Ready  
> **Роут**: `/` -> Студия: Вкладка `practice` -> Вход в `TransactionLabArena`

---

## 1. Назначение и концепция
Интерактивная лаборатория транзакций Spring Framework: исследование уровней изоляции транзакций (READ COMMITTED, REPEATABLE READ, SERIALIZABLE), типов распространения (`REQUIRED`, `REQUIRES_NEW`, `NESTED`, `MANDATORY`), проксирования CGLIB, дедлоков и аномалий многопоточного доступа.

---

## 2. Диалоговый движок и роли ИИ
* **Транспорт**: WebSocket `/ws/live?sessionType=tutor&tutorMode=practice_pair&category=Transaction+Lab&track=tx_lab` через `PracticeVoiceHUD`.
* **Роль ИИ**: Database & Transaction Specialist.
* **Стиль диалога**: Глубокий, направленный на понимание подкапотных процессов пула соединений HikariCP, блокировок InnoDB/PostgreSQL и жизненного цикла CGLIB-прокси.
* **Динамическое приветствие**: Напарник приветствует кандидатов вопросами о границах транзакций, захвате коннектов и поведении аннотации `@Transactional`.

---

## 3. Активный Компас: Transaction Compass
* **Компонент**: `TransactionCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей Транзакций**:
  1. **Жизненный цикл CGLIB-прокси и ловушка Self-Invocation**: Вызов `this.innerMethod()` минует прокси и аннотацию `@Transactional`.
  2. **Матрица распространения (Propagation Matrix)**: `REQUIRED` делит одно соединение, `REQUIRES_NEW` блокирует текущее и берет второе из HikariCP (риск исчерпания пула).
  3. **Уровни изоляции и аномалии БД**: Различие между Dirty Read, Non-Repeatable Read, Phantom Read и Write Skew.
  4. **Пессимистические и оптимистические блокировки**: `@Version` против `SELECT ... FOR UPDATE` (PESSIMISTIC_WRITE).
  5. **Правила отката (Rollback Rules)**: По умолчанию Spring откатывает только на `RuntimeException` и `Error`. Для checked-исключений обязателен `rollbackFor = Exception.class`.

---

## 4. Рабочее пространство и симуляторы
* **Архитектурный редактор сервисов**: Интерактивные чипы аннотаций `@Transactional` прямо в коде сервисов с мгновенной сменой propagation, isolation, readOnly и timeout.
* **HikariPoolSlotMeter**: Визуализатор слотов пула соединений в реальном времени под нагрузкой.
* **ExecutionFlameChart**: Флеймграф выполнения транзакционных границ с замером времени удержания соединения.
* **Интегрированная Доска ИИ**: Поддержка вкладки Доски с горячей клавишей `Alt + W` для схем и примеров от напарника.
