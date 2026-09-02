# 🧠 Этап 3: FSRS-5 Adaptive Memory Radar (Интервальное повторение на векторных дефицитах)

> **Статус:** Спецификация готова к реализации  
> **Цель:** Заменить линейное забывание на современный математический алгоритм **FSRS-5 (Free Spaced Repetition Scheduler)**, автоматически формирующий персонализированную очередь повторения на основе векторной близости ошибок.  
> **Трудозатраты:** 4–5 дней | **Влияние на продукт:** Фундаментальное (High Retention)  
> **Инфраструктурные требования:** Локальная SQLite таблица состояний карт + векторные эмбеддинги дефицитов.

---

## 1. Проблема и мотивация

Подготовка к Senior-собеседованию включает более 800 тем и вопросов. Человеческая память подчиняется **кривой забывания Эббингауза**:
- Через 48 часов после успешного прочтения темы без повторения забывается до **50% деталей** (например, точные различия между `Propagation.REQUIRES_NEW` и `NESTED`).
- Через 14 дней в памяти остается менее **20% глубоких деталей**.
- Ручной выбор «что сегодня повторить» не работает: кандидаты либо повторяют то, что и так хорошо знают (зона комфорта), либо тонут в хаосе.

В платформе уже заложен фундамент — векторная память ошибок (`candidate_error_vectors`) и [MemoryRadarDrawer.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/MemoryRadarDrawer.tsx). Третий этап превращает этот фундамент в **автоматическую адаптивную машину долговременной памяти**.

---

## 2. Математическая модель FSRS-5 (SOTA 2026)

FSRS-5 (Free Spaced Repetition Scheduler) — это современный алгоритм машинного обучения для интервального повторения, превосходящий классический Anki SM-2 по точности предсказания памяти на 25–35%.

```mermaid
graph TD
    Eval[Оценка ответа: Fail / Hard / Good / Easy] --> FSRS[🧠 Алгоритм FSRS-5]
    FSRS --> Calc[Вычисление стабильности S и сложности D]
    Calc --> Curve[Кривая удерживаемости R: e^(-t/S)]
    Curve --> VectorCluster[🔍 Векторный кластер дефицитов]
    VectorCluster --> Queue[⚡ Ежедневная умная очередь повторения]
    Queue --> Radar[📡 Интерактивный Memory Radar HUD]
```

### Ключевые переменные:
1. **$R$ (Retrievability / Вероятность воспроизведения):** Вероятность того, что кандидат сможет успешно ответить на вопрос в момент времени $t$:
   $$R(t, S) = \left(1 + 0.19 \times \frac{t}{S}\right)^{-0.5}$$
2. **$S$ (Stability / Стабильность):** Количество дней, за которое вероятность воспроизведения снижается со 100% до 90%.
3. **$D$ (Difficulty / Внутренняя сложность темы):** Шкала от 1 до 10 (например, основы IoC: $D \approx 2$, тонкости JMM и SafePoint: $D \approx 8.5$).

### Векторный эффект домино (Deficit Propagation):
Если кандидат совершает ошибку в вопросе по `@Transactional(propagation = REQUIRES_NEW)`:
- Система не просто снижает стабильность одного этого вопроса.
- Через косинусное сходство эмбеддингов в базе `candidate_error_vectors` находятся все родственные темы (самовызов методов через Spring Proxy, распространение исключений, сброс контекста в `@Async`).
- Всему тематическому кластеру мягко повышается приоритет в очереди повторения, предотвращая комплексный провал на собеседовании.

---

## 3. UI/UX Спецификация

1. **Ежедневный блок «Daily Smart Review» на главной странице ([StudioHeader.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/StudioHeader.tsx) / [TopicSelector.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/TopicSelector.tsx)):**
   - Компактный премиальный виджет:
     `⚡ 6 вопросов требуют закрепления сегодня (R < 80%)`.
   - Кнопка в 1 клик: `«Запустить блиц-повторение (5 мин)»`.

2. **Эволюция Memory Radar Drawer ([MemoryRadarDrawer.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/MemoryRadarDrawer.tsx)):**
   - Вместо простого списка ошибок отображается **тепловая карта устойчивости памяти**:
     - 🟢 **Свежие и надежные знания ($R > 90\%$):** 420 вопросов.
     - 🟡 **Зона риска забывания ($70\% \le R \le 90\%$):** 48 вопросов.
     - 🔴 **Критический дефицит ($R < 70\%$):** 12 вопросов (требуют повторения сегодня).
   - Интерактивный слайдер «Прогноз памяти»: кандидат может сдвинуть ползунок на «через 2 недели» и увидеть, какие домены покраснеют, если прекратить тренировки.

---

## 4. Изменения в кодовой базе

### Backend
- **[NEW] `backend/src/services/fsrsEngine.ts`**:
  - Математическая реализация формул FSRS-5 для 4 исходов (Again, Hard, Good, Easy).
  - Расчет даты следующего повторения `next_review_at`.
- **[MODIFY] `backend/src/services/progressService.ts`**:
  - Интеграция расчета FSRS при вызове `recordEvaluationAndSyncProgress`.
- **[MODIFY] `backend/src/services/db.ts`**:
  - Создание таблицы `fsrs_card_states`:
    ```sql
    CREATE TABLE IF NOT EXISTS fsrs_card_states (
      user_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      stability REAL DEFAULT 1.0,
      difficulty REAL DEFAULT 5.0,
      elapsed_days REAL DEFAULT 0.0,
      scheduled_days INTEGER DEFAULT 1,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      state INTEGER DEFAULT 0,
      last_review_at DATETIME,
      due_at DATETIME,
      PRIMARY KEY (user_id, question_id)
    );
    CREATE INDEX IF NOT EXISTS idx_fsrs_due ON fsrs_card_states(user_id, due_at);
    ```

### Frontend
- **[MODIFY] `frontend/src/components/MemoryRadarDrawer.tsx`**:
  - Отрисовка динамической кривой забывания и группировки по срочности повторения.
- **[MODIFY] `frontend/src/components/TopicSelector.tsx`**:
  - Интеграция баннера «Daily Smart Review».

---

## 5. Критерии приемки (Definition of Done)
- [ ] Ошибка в ответе корректно рассчитывает `due_at` по формуле FSRS-5.
- [ ] Виджет на главной странице честно показывает вопросы, у которых наступил срок повторения.
- [ ] Векторный кластер подтягивает родственные дефициты в аналитику.
- [ ] Вся база карточек пересчитывается без лагов в SQLite за < 10 мс.
