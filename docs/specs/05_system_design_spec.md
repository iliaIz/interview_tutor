# 05. System Design Arena Specification

## Назначение
Режим защиты распределенной архитектуры перед Bar-Raiser (масштабирование, шардирование, репликация, консенсус Raft/Paxos, выбор СУБД, расчет QPS и пропускной способности).

## Диалоговый движок
* **Транспорт**: WebSocket `/ws/live?sessionType=system_design`.
* **Роль ИИ**: FAANG Principal Architect & Bar-Raiser.
* **Стиль диалога**: Бескомпромиссный, скептический (Anti-Sycophancy Invariant), запрет похвалы без расчетов.

## Активный Компас
* **Компонент**: `SystemDesignCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей System Design**:
  1. Scope & Scale Calculations (QPS, IOPS, Network, Storage).
  2. Single Responsibility & Data Flow Integrity.
  3. Failure Modes & Cascading Failures Prevention.
  4. Storage Engines & Hardware Deep Dive (LSM vs B+Tree, WAF/RAF).
  5. Hiring Committee Calibration (L5 Senior vs L6 Staff vs L7 Principal).

## Инструменты модели
1. `record_candidate_observation`: Фиксация архитектурных сигналов и красных флагов.
2. `inject_chaos_failure`: Имитация сбоев узлов и асимметричных сетевых разделений.
3. `submit_hiring_committee_verdict`: Итоговая калибровка грейда.

## Рабочее пространство
* **Интерактивный холст**: Двухколоночный интерфейс со схемой графа компонентов и деиктическим контекстом (`[CANVAS_DEICTIC_CONTEXT]`).
