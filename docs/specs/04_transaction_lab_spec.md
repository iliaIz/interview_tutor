# 04. Transaction Lab Arena Specification

## Назначение
Интерактивная лаборатория транзакций Spring Framework: исследование уровней изоляции (READ COMMITTED, REPEATABLE READ, SERIALIZABLE), распространения транзакций (REQUIRED, REQUIRES_NEW), симуляция гонок и дедлоков в реляционных БД.

## Диалоговый движок
* **Транспорт**: WebSocket `/ws/live?sessionType=tutor&tutorMode=practice_pair` через `PracticeVoiceHUD`.
* **Роль ИИ**: Database & Transaction Specialist.
* **Фокус наставничества**: Поведение транзакций Spring, проксирование (Self-Invocation Pitfall), блокировки строк (SELECT FOR UPDATE) и аномалии (Dirty Read, Non-repeatable Read, Phantom Read).

## Активный Компас
* **Компонент**: `TransactionCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей Транзакций**:
  1. ACID & Уровни изоляции транзакций.
  2. Spring Transaction Propagation (REQUIRED vs REQUIRES_NEW).
  3. Ловушка Self-Invocation (Проксирование Spring и вызовы внутри одного бина).
  4. Пессимистические и оптимистические блокировки (`@Version`, PESSIMISTIC_WRITE).
  5. Управление таймаутами и защита от дедлоков в распределенных транзакциях.

## Инструменты и рабочее пространство
* **Инструменты модели**: `update_whiteboard` (примеры аннотаций `@Transactional`, блокировок и конфигураций).
* **Формат доски в UI**: Вкладка над SQL/Java рабочей областью `[ 🎨 Доска ИИ (vN) ]` (Alt+W).
* **Симулятор аномалий**: Интерактивная песочница с визуализацией потоков и коммитов в БД.
