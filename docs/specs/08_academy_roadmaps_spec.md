# 08. Academy Studio & Roadmaps Specification

> **Версия**: 2.0 (Сентябрь 2026)  
> **Статус**: Production Ready  
> **Роут**: `/` -> Студия: Вкладка `academy` / `roadmaps`

---

## 1. Назначение и концепция
Академия — центральный оркестратор образовательного пути инженера. Превращает разрозненные вопросы и задачи в структурированные карьерные треки (Career Tracks) и доменные специализации (Domain Tracks) с прозрачным прогрессом, контрольными точками (Milestones) и алгоритмом рекомендации следующего лучшего действия (Next Best Action).

---

## 2. Категории треков и структура данных
1. **Career Tracks (Карьерные грейды)**:
   * Junior -> Middle (L4).
   * Middle -> Senior (L5).
   * Senior -> Staff / Lead Architect (L6+).
2. **Domain Specializations (Предметные курсы)**:
   * HighLoad & Distributed Systems.
   * Spring Internals, AOP & Transaction Deep Dive.
   * Concurrency, Virtual Threads & Performance Optimization.
   * Enterprise Architecture & Security.

**Структура сущностей**:
* `AcademyCourse`: Метаданные курса, общая готовность (readiness %), список вех (`milestones`).
* `AcademyMilestone`: Крупный тематический модуль (например, «Многопоточность Java 21»).
* `AcademyStep`: Атомарный шаг с типом активности (`practice`, `theory`, `system_design`, `incident`, `quiz`), статусом выполнения и целевым роутом.

---

## 3. Сквозная бесшовная интеграция с аренами (Breadcrumbs)
* **Контекст перехода (`academyBreadcrumbContext`)**:
  При переходе из шага Академии в любую арену (`PracticeArena`, `BugHuntArena`, `SystemDesignArena`, `TransactionLabArena`) в состояние приложения записывается:
  ```json
  {
    "courseId": "java_senior_l5",
    "stepNumber": 14,
    "stepTitle": "Rate Limiter: Leaky Bucket Concurrency"
  }
  ```
* **Кнопка возврата в шапке арены**:
  Позволяет кандидату одним кликом вернуться в Академию ровно к тому шагу, на котором он остановился.
* **Автоматическая прокрутка и фокус**:
  При возвращении экран Академии плавно скроллится к элементу `#academy-step-{stepNumber}` с раскрытием соответствующего аккордеона Milestone.
* **Авто-отметка прогресса**:
  Успешное прохождение задачи (компиляция тестов / мутационный порог / вердикт Bar-Raiser) мгновенно отмечает шаг пройденным на сервере через `POST /api/roadmaps/:id/steps/:num/toggle`.

---

## 4. UI/UX стандарты (SOTA 2026)
* **NextBestActionCard**: Адаптивная рекомендательная карточка сверху, вычисляющая приоритетную задачу на основе радар-диаграммы пробелов.
* **AcademyReadinessRadar**: Радарная визуализация готовности кандидата к целевому грейду по 6 осям.
* **Аккордеоны вех (Milestone Accordion)**: Плавное раскрытие без скачков layout с поддержкой фильтрации (`Все`, `Только невыполненные`, `Практика`, `Архитектура`).
* **Модалка предпросмотра шага (`AcademyStepModal`)**: Чистый предпросмотр инвариантов и требований без блокировки основного интерфейса.
