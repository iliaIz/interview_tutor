# 🛠️ Stage 4 Specification: Multimodal Voice Bar-Raiser & Complete Migration

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.0.0`  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-01` (SSOT), Разделы 1 и 2 `AGENTS.md` (LiteLLM Proxy Invariant, Gemini Live Invariants).

---

## 1. Executive Summary & Architectural Integrity

### 1.1. Назначение этапа
1. Реализовать **Студию 3: Multimodal Bar-Raiser Defense Arena** — устную голосовую защиту спроектированной системы в реальном времени перед требовательным AI-интервьюером (профиль Principal / Staff Engineer).
2. Подключить контекст топологии и телеметрии симулятора (Stage 2 & 3) к сессии Gemini Live через `LiteLLM_Proxy`.
3. Завершить финальную миграцию данных: перенос прогресса пользователей в `user_progress_ledger`, полное удаление устаревших статических каталогов (`MicroKatasCatalog.ts`, `FadedScaffoldingCatalog.ts`) и проведение 100% сквозного E2E тестирования.

### 1.2. Соблюдение жестких инвариантов `AGENTS.md`
* **Инвариант 1 (LiteLLM Proxy Only):** Все голосовые и LLM-взаимодействия строго маршрутизируются через `ws://host.docker.internal:4000/ws/live?model=${GEMINI_LIVE_MODEL}&token=${LITELLM_API_KEY}`. Прямые вызовы Google API запрещены.
* **Инвариант 2.1 (First-Turn Tool Lockdown):** AI-интервьюер строго заблокирован от вызова функции `submit_interview_evaluation` на ходу 0 (приветствие). Бэкенд контролирует `hasCandidateResponded === false` и отклоняет преждевременный вызов инструмента.
* **Инвариант 2.2 (Dual-Sided Handshake):** Переход хода от AI к кандидату (`isAiSpeaking: false`, `isRecording: true`) симметрично разблокируется тем событием, которое завершится последним: опустошение буфера `AudioPlayoutManager.onPlaybackFinished` или получение `turnComplete: true`.
* **Инвариант 2.5 (Tactile Barge-In):** Клик пользователя во время речи AI активирует плавное 5-миллисекундное затухание (de-click ramp) и мгновенно переключает аудиопоток на запись речи кандидата.

---

## 2. Архитектура интеграции Bar-Raiser с симулятором

```
┌──────────────────────────────────────┐
│  Студия 2: Холст топологии и DES     │
│  • Граф узлов и ребер                │
│  • P99 задержка, стоимость, узкие места│
│  • Результаты инъекций Chaos Monkey  │
└──────────────────┬───────────────────┘
                   │ Сериализация в System Prompt Context
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Бэкенд-сессия: backend/src/services/voiceBarRaiserSession.ts               │
│  • Формирование системного промпта Bar-Raiser с реальной телеметрией         │
│  • WebSocket проксирование в LiteLLM Gateway (ws://litellm-gateway:4000)   │
│  • Защита Turn 0: hasCandidateResponded guard                               │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │ Двунаправленный PCM аудиопоток (16kHz / 24kHz)
                   ▼
┌──────────────────────────────────────┐
│  Студия 3: Bar-Raiser Arena (Фронтенд)│
│  • AudioPlayoutManager (Dual Handshake)│
│  • Тактильный перехват (Barge-In)    │
│  • Карточка вердикта с радаром метрик│
└──────────────────────────────────────┘
```

### 2.1. Контекстная передача телеметрии в System Prompt
При входе в Студию 3 бэкенд формирует специализированный оверрайд промпта (`customPromptOverride`):

```markdown
Вы — Principal Systems Architect (Staff Bar-Raiser) в Tier-1 технологической компании.
Кандидат только что завершил проектирование и дискретно-событийную симуляцию архитектуры.

ДАННЫЕ СПРОЕКТИРОВАННОЙ ТОПОЛОГИИ И СИМУЛЯЦИИ:
- Сценарий: {{scenario.title}} (Уровень: {{scenario.target_level}})
- Требуемый SLO: P99 < {{manifest.slos.p99_latency_max_ms}}ms | Достигнуто в симуляции: {{telemetry.system_p99_latency_ms}}ms
- Бюджет: ${{manifest.slos.monthly_budget_max_usd}} | Достигнуто: ${{telemetry.total_monthly_cost_usd}}
- Выявленное узкое место (Bottleneck): {{telemetry.bottleneck_node_id}}
- Поведение при Chaos-сбое: {{telemetry.chaos_resilience_summary}}

ПРАВИЛА ИНТЕРВЬЮ:
1. ХОД 0 (Приветствие): Озвучьте вводную и сразу укажите на самое слабое место симуляции. Задайте конкретный провокационный вопрос по архитектурным компромиссам. НЕ ВЫЗЫВАЙТЕ submit_interview_evaluation!
2. ОЦЕНИВАЙТЕ НЕ ШАБЛОНЫ, А ОПЕРАЦИОННУЮ УБЕЖДЕННОСТЬ: Спрашивайте про радиус поражения (blast radius), каскадные отказы и runbook деградации.
```

### 2.2. Рубрика оценки (Bar-Raiser 4-Dimensional Rubric)
После завершения минимум 3 раундов содержательного диалога AI вызывает тул `submit_interview_evaluation`:

```typescript
export interface BarRaiserEvaluation {
  overall_verdict: 'STRONG_HIRE' | 'HIRE' | 'LEANING_HIRE' | 'NO_HIRE';
  target_seniority_confirmed: 'L3_JUNIOR' | 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF';
  scores: {
    tradeoff_defensibility: number;      // 0-100 (Обоснованность компромиссов)
    blast_radius_isolation: number;     // 0-100 (Локализация аварий)
    queuing_mathematical_rigor: number; // 0-100 (Понимание математики очередей)
    operational_conviction: number;     // 0-100 (Убежденность и runbooks)
  };
  strengths: string[];
  growth_areas: string[];
  key_quote_critique: string;
  recommended_next_katas: string[];
}
```

---

## 3. Финальная миграция данных и зачистка технического долга

### 3.1. Развертывание таблицы `user_progress_ledger`
Выполняется миграция `backend/src/migrations/005_user_progress_ledger.sql`:
* Создание таблицы с уникальным индексом `(user_id, canonical_id, manifest_version)`.
* Миграционный скрипт `scripts/migrate_legacy_progress.py` сканирует старую таблицу `user_scenario_attempts` и маппит старые числовые ID на стабильные `canonical_id`.

### 3.2. Удаление устаревших каталогов (Deprecation Phase)
После подтверждения работоспособности SSOT и миграции базы данных полностью удаляются:
1. `frontend/src/components/system_design/katas/MicroKatasCatalog.ts` (1004 строки).
2. `frontend/src/components/system_design/scaffolding/FadedScaffoldingCatalog.ts` (446 строк).
3. `json/system_design_scenarios.json` (старый несогласованный каталог).

Компоненты `MicroKataArena.tsx` и `FadedScaffoldingArena.tsx` переключаются на загрузку данных из стора `useAppStore`, получающего манифесты по сети через `/api/scenarios`.

---

## 4. Definition of Done (DoD) для Stage 4

1. [ ] **LiteLLM Live WebSocket Integrity:** Сессия голосового AI поднимается без ошибок по защищенному протоколу через LiteLLM Proxy.
2. [ ] **First-Turn Lockdown Verified:** Автоматический тест подтверждает, что при попытке AI вызвать тул на ходу 0 бэкенд возвращает ошибку и удерживает диалог.
3. [ ] **Dual Handshake & Non-Blocking Audio:** На мобильных и десктопных браузерах исключено эхо, переключение микрофона происходит точно по завершении воспроизведения.
4. [ ] **Progress Ledger Synchronized:** Попытка прохождения сохраняется в `user_progress_ledger` с сохранением вектора выполненных инвариантов и баллов Bar-Raiser.
5. [ ] **Legacy Files Purged:** Устаревшие файлы `MicroKatasCatalog.ts`, `FadedScaffoldingCatalog.ts` и `system_design_scenarios.json` удалены из репозитория.
6. [ ] **100% Green E2E Suite:** Полный сквозной прогон тестов (`npm run test`, Cypress/Playwright) проходит успешно без единого сломанного маршрута или регрессии сборки.
