# 🎓 Этап 11: Unified Academy Curriculum Backbone & Seamless Integration

> **Статус:** Проектирование (Сентябрь 2026)  
> **Цель:** Превратить Guided Academy Studio в единый сквозной дирижер подготовки кандидата. Бесшовно объединить все практические арены (Тестирование, Транзакции, System Design, LLD, Triage, Mock Interview) в персонализированные маршруты подготовки с адаптацией от FSRS-5 Vector Memory Radar.  
> **Трудозатраты:** 3–4 дня | **Приоритет:** P1  
> **Связанные документы:** [AcademyStudio.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/academy/AcademyStudio.tsx), [guided_roadmaps.json](file:///d:/projects/interview_projects/spring/backend/src/routes/guided_roadmaps.json)

---

## 1. Проблема изолированности модулей

Сейчас платформа обладает богатейшим арсеналом из 8 самостоятельных инструментов.
Однако пользователь чувствует себя потерянным («каталожная слепота»):
* Он не знает, в каком порядке проходить каты.
* Он только что завалил вопрос по транзакциям на устном интервью, но система не ведет его за руку в Spring Transactions Lab на конкретный сценарий.
* В роадмапе Академии [guided_roadmaps.json](file:///d:/projects/interview_projects/spring/backend/src/routes/guided_roadmaps.json) **до сих пор отсутствуют ссылки на новые 42 каты мутационного тестирования и 11 сценариев транзакций**.

---

## 2. Архитектура единого образовательного контура

```mermaid
flowchart TD
    subgraph Core ["🧠 Adaptive Cognitive Engine"]
        Radar["FSRS-5 Vector Memory Radar\n(Векторы слабых мест кандидата)"]
        Recommender["AI Next-Best-Action Recommender\n(Динамический выбор следующего шага)"]
        Radar --> Recommender
    end

    subgraph Academy ["🎓 Guided Academy Unified Tracks"]
        T1["🌱 Track: Middle Java/Spring Acceleration"]
        T2["⚡ Track: Senior BigTech L5 Full-Stack Sprint (25 шагов)"]
        T3["🏛️ Track: Staff/Principal Distributed Systems (L6/L7)"]
        
        Recommender --> T1 & T2 & T3
    end

    subgraph Arenas ["⚔️ Сквозные практические модули"]
        A_Voice["🎙️ Mock Voice Interview"]
        A_Test["🧪 Testing Arena (42 Katas)"]
        A_Tx["⚡ Spring Transactions Lab (16 Scenarios)"]
        A_Sys["📐 System Design Canvas (L0-L3)"]
        A_Tri["🚨 Incident Triage (Dumps & RCA)"]
        A_LLD["☕ Machine Coding (Java 21)"]
    end

    T2 --> A_Voice & A_Test & A_Tx & A_Sys & A_Tri & A_LLD
    
    A_Voice -- "Зафиксирована ошибка в концепциях" --> Radar
    A_Test -- "Пройдена ката L0-01" --> Radar
```

---

## 3. Обновление схемы роадмапов (`guided_roadmaps.json`)

В каждый шаг роадмапа внедряется типизированный селектор целевой арены:
```json
{
  "id": "step_07_spring_transactional_boundaries",
  "title": "Границы транзакций и CGLIB-прокси",
  "targetArena": "transactions",
  "targetScenarioId": "L0_02_self_invocation_bypass",
  "estimatedMinutes": 20,
  "requiredForGrade": "L5",
  "prerequisiteStepIds": ["step_06_spring_core_aop"]
}
```

Поддерживаемые типы `targetArena`:
* `oral_interview` (устный вопрос/диалог)
* `testing_mutation` (ката в Testing Arena)
* `transactions` (сценарий в Spring Transactions Lab)
* `system_design` (задача в System Design Arena)
* `incident_triage` (расследование в Triage Studio)
* `machine_coding` (LLD-задача)

---

## 4. Виджет «Next Best Step» на Главном экране
На Dashboard кандидата выводится персональная карточка следующего оптимального шага:
> *«На вчерашнем интервью с Amazon Bar-Raiser возникли сомнения при расчете пула соединений. Рекомендуемый шаг: Пройти сценарий [L3-01: HikariCP Pool Starvation Deadlock] в Spring Transactions Lab (15 минут)»*.

---

## 5. Критерии приемки (Definition of Done)
- [ ] Роадмап в `guided_roadmaps.json` актуализирован: все 6 практических арен интегрированы в единую цепочку шагов.
- [ ] Переход из Академии открывает нужную кату в целевой арене с предустановленным контекстом.
- [ ] Реактивный трекинг прогресса: решение каты в Testing Arena или Transactions Lab автоматически отмечает шаг в Академии как завершенный (`isCompleted = true`).
