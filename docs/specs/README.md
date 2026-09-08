# Матрица архитектурных возможностей разделов (Arena Capabilities Matrix)

Настоящая спецификация является **единственным источником правды (Single Source of Truth)** для всех разделов платформы InterviewPrep AI по состоянию на сентябрь 2026 года.

---

## 1. Сводная матрица возможностей

| Раздел / Сценарий | Доменная роль ИИ | Активный Компас | Доступные инструменты (Tools) | Формат Доски (Whiteboard) | Роут и транспорт |
|---|---|---|---|---|---|
| **01. Mock Interview** | FAANG Interviewer (Калибровка L4–L6) | *Не применяется* | `update_whiteboard`, `submit_interview_evaluation` | Встроенная правая панель (Docked Split Stage) | `/ws/live` + `/api/interview` |
| **02. Practice: Testing** | Pair-Tester & Mutant Hunter | `TestingCompassSheet` (AAA, Фаулер, RIPR) | `update_whiteboard` | Вкладка над кодом `[ Доска ИИ (vN) ]` (Alt+W) | `/ws/live` + `/api/practice-tutor` |
| **03. Practice: LLD** | Principal LLD Architect | `LLDCompassSheet` (Clock, BigDecimal, Deadlock-Free) | `update_whiteboard`, AST-валидаторы | Вкладка над кодом `[ Доска ИИ (vN) ]` (Alt+W) | `/ws/live` + `/api/practice-tutor` |
| **04. Transaction Lab** | Database & Transaction Specialist | `TransactionCompassSheet` (ACID, Пропагация) | `update_whiteboard`, симулятор аномалий | Вкладка над SQL/Java кодом `[ Доска ИИ ]` (Alt+W) | `/ws/live` + `/api/practice-tutor` |
| **05. System Design** | Bar-Raiser & Principal Architect | `SystemDesignCompassSheet` (Scale, Failure Modes) | `record_candidate_observation`, `inject_chaos_failure`, `submit_hiring_committee_verdict` | Интерактивный 2D/3D холст архитектуры | `/ws/live` + `/api/system-design` |
| **06. Incident Triage** | SRE Incident Commander | `TriageCompassSheet` (Golden Signals, Blast Radius) | `investigate_telemetry`, `trigger_mitigation` | Интерактивные логи, трассировки и метрики | `/ws/live` + `/api/triage` |

---

## 2. Глобальные архитектурные инварианты (2026 SOTA)

1. **Запрет модальных оверлеев для рабочего кода (Non-Modal Artifact Rule)**:
   Никаких выезжающих поверх рабочей области модалок. Код и примеры от ИИ живут во вкладках рабочей области или в постоянных docked-панелях с поддержкой горячей клавиши `Alt+W`.
2. **Атомарность ходов голосового диалога (Atomic Turn Invariant)**:
   При отправке реплики кнопка немедленно блокируется в состоянии `isThinking`. Микрофон разблокируется строго после завершения физического воспроизведения звука в наушниках (`playout.onPlaybackFinished`) и завершения всех вызванных инструментов.
3. **Сквозная телеметрия ходов (Turn Lifecycle Telemetry)**:
   Все переходы между клиентом, бэкенд-шлюзом и моделью фиксируются в структурированных логах: `[TURN_COMMIT] -> [TOOL_START] -> [TOOL_DONE] -> [FIRST_PCM] -> [PLAYOUT_DRAINED]`.
4. **Контекстная изоляция промптов**:
   Запрещен любой хардкод предметных областей в универсальных компонентах. Тема, роль наставника и правила компаса определяются исключительно из контекста активной задачи (`track`, `category`).
