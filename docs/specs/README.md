# Матрица возможностей и архитектурного аудита разделов (SOTA Сентябрь 2026)

Настоящая спецификация и матрица аудита являются **единственным источником правды (Single Source of Truth)** для всех 9 разделов и арен платформы InterviewPrep AI.

---

## 1. Сводная матрица возможностей (Capabilities Matrix)

| № | Раздел / Арена | Доменная роль ИИ | Активный Компас | Инструменты модели (Tools) | Формат Доски (Whiteboard) | Роут и транспорт |
|---|---|---|---|---|---|---|
| **01** | **[Mock Interview](01_mock_interview_spec.md)** | FAANG Interviewer (L4–L6) | *Не применяется* | `update_whiteboard`, `submit_interview_evaluation` | Боковая панель (Docked Stage) | `/ws/live` + `/api/interview` |
| **02** | **[Practice: Testing](02_practice_testing_spec.md)** | Pair-Tester & Mutant Hunter | `TestingCompassSheet` | `update_whiteboard` | Вкладка над кодом `[ Доска ИИ ]` (Alt+W) | `/ws/live` + `/api/practice-tutor` |
| **03** | **[Practice: LLD](03_practice_lld_machine_coding_spec.md)** | Principal LLD Architect | `LLDCompassSheet` | `update_whiteboard`, AST-правила | Вкладка над кодом `[ Доска ИИ ]` (Alt+W) | `/ws/live` + `/api/practice-tutor` |
| **04** | **[Transaction Lab](04_transaction_lab_spec.md)** | DB & Transaction Specialist | `TransactionCompassSheet` | `update_whiteboard`, симулятор аномалий | Вкладка над кодом `[ Доска ИИ ]` (Alt+W) | `/ws/live` + `/api/practice-tutor` |
| **05** | **[System Design](05_system_design_spec.md)** | Bar-Raiser & Principal Architect | `SystemDesignCompassSheet` | `record_candidate_observation`, `inject_chaos_failure`, `submit_hiring_committee_verdict` | Интерактивный 2D холст (Cytoscape Canvas) | `/ws/live` + `/api/system-design` |
| **06** | **[Incident Triage](06_incident_triage_spec.md)** | SRE Incident Commander | `TriageCompassSheet` | Инспектор дампов, гипотезы | Интерактивные дампы и логи потоков | `/ws/live` + `/api/triage` |
| **07** | **[Bug Hunt Arena](07_bug_hunt_spec.md)** | Socratic Production Tech-Lead | Радар дефектов | Selection Focus Injection, AST-валидатор | Интегрированный редактор с кодом задачи | `/ws/live` + `/api/bughunt` |
| **08** | **[Academy & Roadmaps](08_academy_roadmaps_spec.md)** | Career Mentor & Skill Tracker | Карьерный радар | Рекомендация Next Best Action | Модалка шага + карточка следующего шага | `/api/roadmaps` |
| **09** | **[Knowledge & SRS Quiz](09_knowledge_srs_quiz_spec.md)** | Memory Coach & Exam Examiner | *Шпаргалка* | Алгоритм Лейтнера (Boxes 1..5), TTS Подкаст | Карточки Active Recall + плеер подкаста | `/api/topics` + `/api/podcast` |

---

## 2. Глобальная Матрица Аудита Разделов (Audit Matrix 2026)

Оценка соответствия стандарту SOTA Сентябрь 2026 по 6 критическим инженерным осям:

| Раздел | 1. Голосовой движок & FSM | 2. Эргономика Доски (Non-Modal) | 3. Доменный Компас | 4. AST & Детерминизм кода | 5. Устойчивость (Zero-Phantom) | Итоговый статус |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **01. Mock Interview** | 🟢 SOTA (Dual-Handshake, Turn 0 Lock) | 🟡 Docked Panel (в модалке) | ⚪ N/A (FAANG Rubric) | 🟢 Выразительный скоркарт | 🟢 LiteLLM Proxy + Circuit Breaker | **95% READY** |
| **02. Practice: Testing** | 🟢 SOTA (`isThinking` FSM, No-Flicker) | 🟢 Вкладка `Alt+W` над кодом | 🟢 `TestingCompassSheet` | 🟢 In-Memory Pitest (<80ms) | 🟢 TaskRecoveryCard + Backoff | **100% SOTA** |
| **03. Practice: LLD** | 🟢 SOTA (LLD Persona, No-Mutant noise)| 🟢 Вкладка `Alt+W` над кодом | 🟢 `LLDCompassSheet` (5 правил) | 🟢 `Clock`, `BigDecimal`, Ordered Lock | 🟢 TaskRecoveryCard + Backoff | **100% SOTA** |
| **04. Transaction Lab** | 🟢 SOTA (Tx Specialist Persona) | 🟢 Вкладка `Alt+W` над кодом | 🟢 `TransactionCompassSheet` | 🟢 Симулятор HikariCP + Flamechart | 🟢 Zero-Phantom Fallback | **100% SOTA** |
| **05. System Design** | 🟢 SOTA (Bar-Raiser, Anti-Sycophancy) | 🟢 2D Canvas (Cytoscape) | 🟢 `SystemDesignCompassSheet` | 🟢 Capacity Math Coach | 🟢 Chaos Injection + Hiring Committee | **98% SOTA** |
| **06. Incident Triage** | 🟡 Текстовый SSE + WS в роадмапе | 🟢 Интерактивный Profiler Dump | 🟢 `TriageCompassSheet` | 🟢 Валидатор Root Cause гипотез | 🟢 Zero-Phantom Fallback | **92% READY** |
| **07. Bug Hunt Arena** | 🟢 SOTA (Voice HUD + Selection Focus)| 🟢 Интегрированный редактор | 🟡 Радар дефектов | 🟢 AST Tree-Edit Distance Guard | 🟢 TaskRecoveryCard + Presets | **95% READY** |
| **08. Academy Roadmaps**| ⚪ N/A (Управляющий хаб) | 🟢 Breadcrumbs в Арены | 🟢 Академический радар | 🟢 Серверный трекинг прогресса | 🟢 Graceful Cache Offline | **100% SOTA** |
| **09. Knowledge & Quiz**| 🟢 SOTA (Gemini TTS Подкасты) | 🟢 100dvh Active Recall Flip | ⚪ Шпаргалка + JLS 21 ссылки | 🟢 Таймер сертификационного квиза | 🟢 Debounced Batch Sync | **100% SOTA** |

---

## 3. Архитектурные требования SOTA Сентябрь 2026

1. **Non-Modal Workspace Standard**:
   Запрещены перекрывающие рабочее пространство оверлеи (`z-50`). Код, схемы и диффы открываются исключительно во вкладках редактора (`Alt + W`) или в закрепленных сплит-панелях.
2. **Dual-Sided Handshake & First-Turn Lockdown**:
   Микрофон кандидата разблокируется строго последним из двух событий: физический дренаж аудио в наушниках (`playout.onPlaybackFinished`) ИЛИ флаг `turnComplete: true`. Оценочные инструменты запрещены на ходе 0 (приветствие).
3. **Turn FSM Stability**:
   При отправке реплики кнопка немедленно переходит в статус `isThinking`, блокируя повторные клики и предотвращая ложный мьют микрофона.
4. **Контекстная изоляция персон**:
   Голосовой напарник обязан здороваться и вести диалог строго в предметной области задачи (LLD vs Transactions vs Testing), исключая мусорные артефакты чужих доменов.
5. **Детерминизм Machine Coding (Java 21)**:
   Обязательная инжекция `java.time.Clock` (запрет `System.currentTimeMillis()`), банковское округление `BigDecimal HALF_EVEN` (запрет `double`/`float` в деньгах) и упорядоченный захват блокировок `lock(min, max)`.
