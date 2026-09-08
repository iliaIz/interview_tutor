# 05. System Design Arena Specification

> **Версия**: 2.0 (Сентябрь 2026)  
> **Статус**: Production Ready  
> **Роут**: `/` -> Студия: Вкладка `system_design` -> Вход в `SystemDesignArena`

---

## 1. Назначение и концепция
Режим защиты распределенной архитектуры перед Bar-Raiser (масштабирование, шардирование, репликация, консенсус Raft/Paxos, выбор СУБД, расчет QPS и пропускной способности) на грейды L5 Senior, L6 Staff и L7 Principal.

---

## 2. Диалоговый движок и протокол WebSocket
* **Транспорт**: WebSocket `/ws/live?sessionType=system_design` через `LiteLLM_Proxy`.
* **Модель по умолчанию**: `${GEMINI_LIVE_MODEL}` (`gemini-live-v3`).
* **Роль ИИ**: FAANG Principal Architect & Bar-Raiser.
* **Стиль диалога**: Бескомпромиссный, скептический (Anti-Sycophancy Invariant). Модель обязана оспаривать необоснованные решения кандидата и требовать количественных расчетов.
* **Деиктический контекст графа**: Клиент передает текущую топологию холста через `[CANVAS_DEICTIC_CONTEXT]`.

---

## 3. Активный Компас: System Design Compass
* **Компонент**: `SystemDesignCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей System Design**:
  1. **Scope & Scale Calculations**: Расчет QPS (пик vs средний), сетевого канала (Gbps), дискового пространства и памяти кеша.
  2. **Single Responsibility & Data Flow Integrity**: Разделение сервисов по границам Bounded Context; детерминированный поток данных.
  3. **Failure Modes & Cascading Failures Prevention**: Защита от каскадных сбоев через Circuit Breaker, Rate Limiter, Bulkhead и Fallbacks.
  4. **Storage Engines & Hardware Deep Dive**: Обоснованный выбор движков хранения (LSM-Tree для высоких записей, B+Tree для транзакций, WAF/RAF).
  5. **Hiring Committee Calibration**: Критерии калибровки для уровней L5 Senior vs L6 Staff vs L7 Principal.

---

## 4. Инструменты модели (Model Tools)
1. `record_candidate_observation`: Фиксация архитектурных сигналов кандидата по шкале компетенций.
2. `inject_chaos_failure`: Имитация сбоев узлов (отказ БД, разрыв сети, переполнение очереди Kafka).
3. `submit_hiring_committee_verdict`: Итоговая калибровка грейда с генерацией официального отчета для Hiring Committee.

---

## 5. Интерактивные рабочие поверхности
* **Интерактивный 2D Холст (Cytoscape Canvas)**: Перетаскивание компонентов (LB, Gateway, Services, Kafka, Redis, DB), связывание ребрами с выбором протоколов (gRPC, REST, Kafka, TCP).
* **Capacity Math Coach**: Интерактивный калькулятор масштаба с расчетом памяти, диска и пропускной способности.
* **HiringCommitteeVerdictModal**: Итоговый пакет комитета найма с радарной диаграммой компетенций.
