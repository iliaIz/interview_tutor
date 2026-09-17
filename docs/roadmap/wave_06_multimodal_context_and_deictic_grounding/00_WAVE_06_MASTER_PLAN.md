# Wave 06: Symmetrical Multimodal Grounding, Epistemic Context & Deictic Invariants

> **Статус программы:** 🟡 В РАБОТЕ (Инициализация и спецификация)  
> **Ветка:** `feat/wave-06-multimodal-context-and-deictic-grounding`  
> **Дата старта:** Сентябрь 2026  
> **Целевой стандарт:** SOTA September 2026 Multimodal Live Grounding (<400ms Voice Latency, Zero Referential Blindness)

---

## 1. Миссия и цели Wave 06

В ходе эксплуатации голосового AI-Тьютора и симулятора собеседований (Gemini Live WebSocket) был выявлен фундаментальный класс дефектов: **Referential Hallucination & Context Blindness (ссылочная слепота и рассинхронизация контекста)**.
Когда кандидат говорит дейктически (*«Вот в этой строчке...»*, *«Посмотри на алерт инцидента...»*, *«Я открыл первую подсказку...»*, *«Почему в диффе эта строка удалена?»*, *«У меня на холсте падает эта база данных»*), ИИ в большинстве практических аренах слеп к тому, что происходит на экране пользователя, либо оперирует устаревшим снимком кода на момент старта сокета.

**Главная цель Wave 06:**  
Обеспечить абсолютную эпистемическую симметрию (**Symmetrical Epistemic Grounding / Shared Workspace**) между пользователем и Gemini Live во всех разделах платформы (Теория, Bug Hunt Arena, Machine Coding Katas, Transaction Lab, System Design Arena, Capacity Math Coach) с нулевым оверхедом по задержке (<400 мс) и без использования блокирующих Tool-Call раундтрипов.

---

## 2. Архитектурные инварианты Wave 06 (Hard Invariants)

1. **Инвариант 1: Эпистемическая симметрия (Symmetrical Epistemic Grounding)**  
   Всё, что видит кандидат на экране (код, вкладка файла, открытая подсказка, алерт инцидента, эталонный диф, ошибка компилятора, нарушение AST-правил, топология холста, выделенный текст), должно быть представлено в рабочей памяти Gemini Live. Модель ни при каких условиях не должна переспрашивать: *«О каком коде/строке/алерте вы говорите?»*.
2. **Инвариант 2: Детерминированный Client-Side Handover Flush (0 мс задержки)**  
   Синхронизация отредактированного кода происходит на клиенте строго в момент закрытия хода кандидата (`triggerEndTurn`), непосредственно перед отправкой `turnComplete: true`. Запрещено возлагать чтение редактора на вызовы тулов со стороны нейросети (что порождает 2–3 секунды неловкой тишины и фантомные сбои).
3. **Инвариант 3: Мостовая память при навигации (Episodic Bridge Navigation)**  
   При переключении между задачами (вперед/назад/вариация) контекст предыдущей задачи мягко сохраняется по `sessionId = session_${challengeId}`. При возврате назад модель не сбрасывается в амнезию, а произносит короткую мостовую фразу (*«Мы вернулись к кейсу с ConcurrentHashMap, где остановились на 14 строке...»*).
4. **Инвариант 4: Двухуровневый семантический фильтр телеметрии (Semantic Anomaly Digest)**  
   В System Design запрещено спамить сырыми JSON-метриками. Передаются только: 1) фоновый 1-строчный статус-пульс (раз в 15-20 сек) и 2) мгновенные алерты аномалий при превышении критических порогов (дроп > 5%, насыщение > 85%, SPOF).
5. **Инвариант 5: Единое ядро дейктики (No Split-Brain Hooks)**  
   Логика выделения текста мышью, строковых диапазонов и передачи экранных дельт централизуется в едином модуле `useDeicticGrounding` / `useLiveAudioSession`. Никаких расхождений между `VoiceModal` и практическими аренами.

---

## 3. Матрица этапов и статус выполнения

| Этап | Документ спецификации | Область ответственности | Статус |
|---|---|---|---|
| **Этап 1** | [STAGE_01_UNIFIED_DEICTIC_GROUNDING_ENGINE.md](STAGE_01_UNIFIED_DEICTIC_GROUNDING_ENGINE.md) | Ядро дейктики, Pre-Speech & Handover Flush, Monaco/DOM listeners, хэширование | 🟡 В РАБОТЕ |
| **Этап 2** | [STAGE_02_BUG_HUNT_AND_INCIDENT_TRIAGE_GROUNDING.md](STAGE_02_BUG_HUNT_AND_INCIDENT_TRIAGE_GROUNDING.md) | Bug Hunt: алерты инцидентов, подсказки, diff, unit-тесты, вариации, мостовая память | ⬜ ЗАПЛАНИРОВАНО |
| **Этап 3** | [STAGE_03_MACHINE_CODING_AND_MUTATION_KATA_ARENA.md](STAGE_03_MACHINE_CODING_AND_MUTATION_KATA_ARENA.md) | Workspace: файлы, Monaco live handover, AST-инварианты, PITest, ТЗ без обрезания | ⬜ ЗАПЛАНИРОВАНО |
| **Этап 4** | [STAGE_04_SYSTEM_DESIGN_AND_CAPACITY_MATH_GROUNDING.md](STAGE_04_SYSTEM_DESIGN_AND_CAPACITY_MATH_GROUNDING.md) | System Design & Math: старт холста, Mermaid, заметки, аномалии телеметрии, live math | ⬜ ЗАПЛАНИРОВАНО |
| **Этап 5** | [STAGE_05_VERIFICATION_BENCHMARKS_AND_DEPLOYMENT.md](STAGE_05_VERIFICATION_BENCHMARKS_AND_DEPLOYMENT.md) | Тесты, замеры задержки (<400мс), сквозное ревью, деплой на VPS | ⬜ ЗАПЛАНИРОВАНО |

---

## 4. Журнал коммитов и прогресса

- `19921bb` — fix(live-thinking): eliminate phantom tool delegation and harden mic audio gating (Wave 05 closeout, merged to main).
- *Следующие коммиты фиксируются по завершении каждого этапа Wave 06.*
