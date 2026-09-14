# 🛠️ Stage 4 Specification: Multimodal Voice Bar-Raiser & Complete Migration

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.1.0-RECONCILED` (Полная синхронизация с отчётом B5 и жесткими инвариантами AGENTS.md)  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-01` (SSOT), Разделы 1 и 2 `AGENTS.md` (LiteLLM Proxy Invariant, Gemini Live Invariants).

---

## 1. Executive Summary & Architectural Integrity

### 1.1. Назначение этапа
1. Реализовать **Студию 3: Multimodal Bar-Raiser Defense Arena** — устную голосовую защиту архитектуры в реальном времени перед AI-интервьюером калибра Principal / Staff Engineer (Google L7 / Stripe Principal / Meta E7).
2. Интегрировать 5-фазный конечный автомат диалога (Report B5) и передачу контекста симулятора DES (Stage 2) в сессию Gemini Live через `LiteLLM_Proxy`.
3. Внедрить генерацию структурированного машиночитаемого вердикта по JSON-схеме Draft 2020-12 (Report B5) через инструмент `submit_interview_evaluation`.
4. Завершить полную ликвидацию технического долга: миграция записей прогресса в `user_progress_ledger`, удаление устаревших статических файлов (`MicroKatasCatalog.ts`, `FadedScaffoldingCatalog.ts`, `json/system_design_scenarios.json`) и проведение 100% E2E тестирования.

### 1.2. Соблюдение жестких инвариантов `AGENTS.md`
* **Инвариант 1 (LiteLLM Proxy Invariant):** Все голосовые и LLM-сессии маршрутизируются строго через `LiteLLM_Proxy`: `ws://host.docker.internal:4000/ws/live?model=${GEMINI_LIVE_MODEL}&token=${LITELLM_API_KEY}`. Прямые вызовы внешних API и хардкод ключей запрещены.
* **Инвариант 2.1 (First-Turn Tool Lockdown):** AI-интервьюер строго заблокирован от вызова функции `submit_interview_evaluation` на ходу 0 (приветствие). Бэкенд отслеживает флаг `hasCandidateResponded`. Если Gemini пытается вызвать инструмент до ответа кандидата, бэкенд возвращает ошибку в `toolResponse`, удерживая диалог.
* **Инвариант 2.2 (Dual-Sided Handshake):** Переход хода от AI к кандидату (`isAiSpeaking: false`, `isRecording: true`) симметрично разблокируется тем событием, которое завершится последним:
  1. Физическое исчерпание аудиобуфера в наушниках (`AudioPlayoutManager.onPlaybackFinished`).
  2. Получение сетевого маркера завершения генерации (`turnComplete: true`).
* **Инвариант 2.3 (Direct UTF-8 WebSocket Decoding):** Бинарные фреймы от Uvicorn / LiteLLM декодируются как UTF-8 строки и парсятся как JSON перед маршрутизацией.
* **Инвариант 2.4 (Non-Blocking Hardware Initialization):** Инициализация микрофона выполняется в фоновом промисе (`void initMicrophoneHardware()`), не блокируя старт сессии и воспроизведение приветствия.
* **Инвариант 2.5 (Tactile Barge-In):** Клик пользователя по кругу речи активирует 5-миллисекундное плавное затухание звука (de-click ramp) и мгновенно переключает аудиопоток на запись кандидата.

---

## 2. Конечный автомат диалога и интеграция Gemini Live (Report B5)

### 2.1. 5-Фазовый конечный автомат сессии Bar-Raiser

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STATE 0: PROBLEM & CLARIFICATION                      │
│  • Озвучивание лаконичной вводной задачи (max 45 слов).                      │
│  • Оценка инициативы: требует ли кандидат SLO, RPS и гарантий консистентности?│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Кандидат зафиксировал числа
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STATE 1: HIGH-LEVEL TOPOLOGY REVIEW                    │
│  • Проверка сквозного информационного потока: Ingress -> Service -> Storage. │
│  • Проверка отсутствия единых точек отказа (SPOF) и прямых связей в обход API│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Топологический каркас замкнут
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STATE 2: DEEP DIVE & BOTTLENECK PROBING                 │
│  • Сканирование графа симулятора DES: атака на самое уязвимое узкое место.  │
│  • Стадии 1 и 2 сократической лестницы: валидационный зонд и 10x нагрузка.  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Узел разобран до локов и структур
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 STATE 3: FAILURE STRESS TEST & CHAOS INJECTION              │
│  • Стадии 3 и 4 лестницы: состязательные сбои (split-brain, аппаратная порча)│
│  • Экономическое сжатие (Trade-off Squeeze): сокращение бюджета на 80%.     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 35-40 минут или все сбои пройдены
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   STATE 4: SYNTHESIS & VERDICT GENERATION                   │
│  • Прекращение устного диалога.                                             │
│  • Вызов инструмента submit_interview_evaluation с итоговым JSON отчётом.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Спецификация контракта оценки Bar-Raiser (JSON Schema Draft 2020-12)

При завершении интервью Gemini Live вызывает инструмент `submit_interview_evaluation`:

```typescript
export interface BarRaiserEvaluationReport {
  session_id: string;
  candidate_id: string;
  timestamp_utc: string;
  grade_awarded: 'L3_JUNIOR' | 'L4_MIDLEVEL' | 'L5_SENIOR' | 'L6_STAFF' | 'L7_PRINCIPAL';
  calibration_confidence: 'HIGH' | 'MEDIUM' | 'LOW_INSUFFICIENT_SIGNALS';
  score_breakdown: {
    architecture_feasibility: {
      score: number; // 1-5
      rubric_level: 'BELOW_BAR' | 'AT_BAR' | 'ABOVE_BAR';
      evidence_summary: string;
    };
    scale_and_math: {
      score: number; // 1-5
      rubric_level: 'BELOW_BAR' | 'AT_BAR' | 'ABOVE_BAR';
      evidence_summary: string;
    };
    fault_tolerance: {
      score: number; // 1-5
      rubric_level: 'BELOW_BAR' | 'AT_BAR' | 'ABOVE_BAR';
      evidence_summary: string;
    };
    tradeoff_articulation: {
      score: number; // 1-5
      rubric_level: 'BELOW_BAR' | 'AT_BAR' | 'ABOVE_BAR';
      evidence_summary: string;
    };
  };
  critical_failures: Array<{
    failure_class: 
      | 'BUZZWORD_EVASION'
      | 'SINGLE_POINT_OF_FAILURE'
      | 'SPLIT_BRAIN_VULNERABILITY'
      | 'CASCADE_AMPLIFICATION'
      | 'UNBOUNDED_QUEUE_OOM'
      | 'MATH_INSANITY'
      | 'DUAL_WRITE_CORRUPTION'
      | 'DISTRIBUTED_LOCK_SAFETY_VIOLATION';
    component_affected: string;
    transcript_excerpt: string;
    architectural_risk: string;
  }>;
  architectural_strengths: string[];
  operational_readiness: {
    has_runbook_mindset: boolean;
    monitors_p99_tail: boolean;
    finops_awareness: boolean;
  };
  next_recommended_katas: Array<{
    kata_identifier: string;
    difficulty_tier: 'INTERMEDIATE' | 'ADVANCED' | 'STAFF_CHAOS';
    primary_competency_gap: string;
    scenario_prompt: string;
  }>;
}
```

---

## 4. Финальная миграция данных и полная ликвидация технического долга

### 4.1. Развертывание `user_progress_ledger`
* Запуск миграции SQLite с созданием индекса `(user_id, canonical_id, manifest_version)`.
* Миграционный скрипт `scripts/migrate_legacy_progress.py` выполняет бэкфилл старых попыток из таблицы `system_design_submissions`, сопоставляя старые числовые ID с новыми каноническими `canonical_id` через таблицу псевдонимов `system_design_aliases`.

### 4.2. Полное удаление устаревших каталогов (Deprecation & Cleanup)
После успешной проверки сидера и прогона интеграционных тестов из кодовой базы удаляются:
1. `frontend/src/components/system_design/katas/MicroKatasCatalog.ts` (1004 строки устаревшего дублирующего кода).
2. `frontend/src/components/system_design/scaffolding/FadedScaffoldingCatalog.ts` (446 строк устаревшего кода).
3. `json/system_design_scenarios.json` (старый некорректный JSON).

---

## 5. Definition of Done (DoD) для Stage 4

1. [ ] **LiteLLM Live WebSocket Integration:** Голосовая сессия Gemini Live стабильно поднимается по протоколу WebSocket через шлюз LiteLLM Proxy.
2. [ ] **First-Turn Lockdown Verified:** Автоматизированный интеграционный тест подтверждает блокировку вызова инструмента `submit_interview_evaluation` на ходу 0 при `hasCandidateResponded === false`.
3. [ ] **Dual-Sided Handshake & Barge-In:** На мобильных и десктопных устройствах подтверждено отсутствие эхо и корректная передача микрофона точно при завершении воспроизведения звука в наушниках.
4. [ ] **Structured JSON Evaluation:** AI генерирует вердикт, полностью валидный по JSON-схеме Draft 2020-12 из отчёта B5, с калибровкой грейда от L3 до L7.
5. [ ] **Legacy Catalog Deprecation:** Файлы `MicroKatasCatalog.ts`, `FadedScaffoldingCatalog.ts` и `system_design_scenarios.json` полностью удалены из репозитория.
6. [ ] **100% Green E2E Suite:** Полный сквозной прогон тестов приложения проходит без единой ошибки компиляции или битых маршрутов.
