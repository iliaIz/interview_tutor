# Глубокий Аудит Подраздела: Refactoring Katas & Java 21 Idioms

> **Подразделы:** `refactoring_kata` и `java21_idioms` / [PracticeArena.tsx](file:///home/djelu/spring/frontend/src/components/practice/PracticeArena.tsx)  
> **Специализация:** Рефакторинг легаси-кода по Майклу Физерсу (Legacy Seams), Characterization Tests, паттерны Java 21 LTS  
> **Ключевые темы:** Gilded Rose, Trip Service, Pattern Matching, Record Patterns, Sealed Hierarchies, Sequenced Collections

---

## 1. Архитектурный профиль задач

Данные треки проверяют культуру работы с чужим и устаревшим кодом, а также владение выразительными конструкциями современного Java 21:
- **Refactoring Katas (Техники работы с легаси):**
  - Создание «швов» (Seams) для разрыва жестких зависимостей без изменения внешнего поведения.
  - Написание фиксирующих тестов (Characterization Tests / Golden Master).
  - Замена ветвящихся `switch`/`if-else` на полиморфизм и паттерн Стратегия.
  - Устранение запахов кода (Code Smells): God Class, Feature Envy, Long Method, Primitive Obsession.
- **Java 21 Idioms (Современные идиомы LTS):**
  - Исчерпывающий (Exhaustive) `switch` с `when`-гардами.
  - Деконструкция вложенных рекордов (`Record Patterns`).
  - Запечатанные иерархии типов (`sealed interfaces / permits`).
  - Строгие упорядоченные коллекции (`SequencedCollection`, `SequencedMap`).

---

## 2. Проверка соответствия AI-Напарника (Voice & Text)

### 2.1. Критический дефект маршрутизации доменов и промптов

В обоих подразделах зафиксированы расхождения между назначением задачи и поведением ИИ.

#### Случай 1: `refactoring_kata` (Каты рефакторинга)
- **Бэкенд:** В [backend/src/utils/challengeDomain.ts:25](file:///home/djelu/spring/backend/src/utils/challengeDomain.ts#L25) строка `refactoring_kata` мапится в домен `'lld'`.
- **Фронтенд:** В [PracticeVoiceContext.tsx:99-118](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx#L99-L118) условие проверки LLD проверяет только `category.includes('lld')` и `track.includes('lld')`. Для задачи с `track = 'refactoring_kata'` и `category = 'refactoring_kata'` проверка **не срабатывает**!
- **Результат:** Фронтенд передает на бэкенд `domain = 'testing'`.
- **Приветствие ИИ:** Кандидат открывает классический *Gilded Rose*, чтобы отрефакторить вложенные условия через полиморфизм, а голосовой напарник заявляет:
  > *«Привет! Я твоя напарница по тестированию. Внимательно смотрю на код и готова обсуждать граничные случаи. С чего начнем?»*

---

#### Случай 2: `java21_idioms` (Идиомы Java 21)
- **Бэкенд:** В [backend/src/utils/challengeDomain.ts](file:///home/djelu/spring/backend/src/utils/challengeDomain.ts) строка `java21_idioms` вообще отсутствует среди правил сопоставления и сваливается в дефолтный `return 'testing'`.
- **Фронтенд:** В `PracticeVoiceContext.tsx` также сваливается в дефолтный `domain = 'testing'`.
- **Результат:** Кандидат решает задачу на `Record Patterns` или `Sealed Interfaces`, а ИИ ведет себя как коуч по написанию юнит-тестов и мутаций!

---

### 2.2. Контекстный Компас (Ctrl + /): Ложное отображение мутационного радара

В [frontend/src/components/practice/compass/PracticeCompassSheet.tsx:21-49](file:///home/djelu/spring/frontend/src/components/practice/compass/PracticeCompassSheet.tsx#L21-L49):
```tsx
const isLld =
  category.includes('lld') ||
  track.includes('lld') ||
  category.includes('machine coding') ||
  title.includes('rate limiter') ||
  title.includes('matching engine') ||
  title.includes('parking lot') ||
  title.includes('cache') ||
  title.includes('sliding window');

if (isLld) return <LldCompassSheet />;
if (category.includes('transaction') || track.includes('transaction')) {
  return <TransactionCompassSheet ... />;
}

return <TestingCompassSheet />;
```

**Аномалия:**
- Ни `refactoring_kata`, ни `java21_idioms` не подпадают под `isLld` и `isTransaction`.
- Компас **принудительно рендерит `TestingCompassSheet`**!
- Кандидат в кате рефакторинга нажимает `Ctrl + /`, чтобы посмотреть правила создания «швов» и чистых границ, а видит:
  - Радар мутаций (Line Coverage, Branch Coverage, Mutation Score).
  - Правило RIPR (Reachability, Infection, Propagation).
  - Закон моков Фаулера.
  - Борьбу с зомби-мутантами.
- Это грубая смысловая ошибка, создающая ощущение рассинхронизированной системы.

---

### 2.3. Интерактивная доска (Whiteboard)
В задачах рефакторинга интерактивная доска является центральным инструментом: на ней наставник должен демонстрировать **до/после (Before/After)** — как монолитный блок кода декомпозируется в стратегию или sealed-иерархию.
Из-за отсутствия `onWhiteboardUpdate` в [PracticeVoiceContext.tsx](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx) этот функционал полностью выключен.

---

## 3. Рекомендации по устранению дефектов

1. **Добавить домены `refactoring` и `java21` в классификаторы:**
   - В [backend/src/utils/challengeDomain.ts](file:///home/djelu/spring/backend/src/utils/challengeDomain.ts) добавить детекцию `refactoring` и `java21`.
   - В [livePairPrompts.ts](file:///home/djelu/spring/backend/src/prompts/live/livePairPrompts.ts) и [practiceTutorPrompts.ts](file:///home/djelu/spring/backend/src/prompts/practiceTutorPrompts.ts) внедрить специализированные роли:
     - `REFACTORING COACH`: фокус на швах (Seams), фиксации поведения тестами (Golden Master), устранении запахов кода, декомпозиции методов, законе Деметры.
     - `JAVA 21 SPECIALIST`: фокус на Pattern Matching, Records, Sealed Types, Sequenced Collections.
2. **Исправить маршрутизацию Компаса в `PracticeCompassSheet.tsx`:**
   - Для `refactoring_kata` отображать правила архитектурного проектирования и чистого кода (`LldCompassSheet` либо специализированный `RefactoringCompassSheet`).
   - Для `java21_idioms` отображать правила современных идиом платформы Java 21 LTS.
3. **Включить передачу состояния доски и синхронизацию кода.**
