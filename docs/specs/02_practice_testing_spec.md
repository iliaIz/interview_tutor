# 02. Practice Arena: Unit Testing & Mutation Specification

## Назначение
Режим практического написания надежных тестов (JUnit 5, AssertJ, Mockito) и уничтожения мутантов через PIT Mutation Testing.

## Диалоговый движок
* **Транспорт**: 
  * Голосовой: WebSocket `/ws/live?sessionType=tutor&tutorMode=practice_pair`.
  * Текстовый: SSE `/api/practice-tutor/chat` и `/api/practice-tutor/hint`.
* **Роль ИИ**: Pair-Tester & Mutant Hunter.
* **Педагогическая модель**: Модель RIPR (Reachability -> Infection -> Propagation -> Reveal).
* **Лестница подсказок**: Hint Tiers 0..4 (Синтаксис -> Достижимость -> Заражение -> Контрпример -> Изоморфный пример).

## Активный Компас
* **Компонент**: `TestingCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей**:
  1. Паттерн AAA (Arrange — Act — Assert).
  2. Тест как охотник на мутантов (Adversary Thinking).
  3. Состояние против Взаимодействия (State vs Interaction, отказ от over-mocking).
  4. Закон Моков Фаулера (Мокать только внешние границы I/O).
  5. Детерминизм и Виртуальное Время (инжекция `Clock`, 0мс тесты).

## Инструменты и рабочее пространство
* **Инструменты модели**: `update_whiteboard` (демонстрация синтаксиса AssertJ / Mockito).
* **Формат доски в UI**: Вкладка над кодом `[ 🎨 Доска ИИ (vN) ]` с индикатором новизны и горячей клавишей `Alt+W`.
* **Mutation Radar**: Виджет отображения живых и убитых мутантов в реальном времени.
