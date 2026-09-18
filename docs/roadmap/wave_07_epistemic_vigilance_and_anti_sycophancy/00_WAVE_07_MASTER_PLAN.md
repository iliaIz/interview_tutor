# Wave 07: Epistemic Vigilance, Anti-Sycophancy & Cognitive Calibration

> **Статус программы:** 🟡 В РАБОТЕ  
> **Ветка:** `feature/wave-07-epistemic-vigilance`  
> **Дата старта:** Сентябрь 2026  
> **Целевой стандарт:** SOTA September 2026 AI Assessment & Anti-Sycophancy (Zero False Affirmation, Trivia Immunity, 3-Tier Strictness Spectrum)

---

## 1. Миссия и цели Wave 07

В ходе эксплуатации AI-Тьютора и экзаменатора собеседований (Gemini Live WebSocket и REST-эндпоинтов) был выявлен критический дефект поведения: **сикофантия (sycophancy / речевое угодничество и поддакивание)**. Модель вместо беспристрастной калибровки знаний и выявления пробелов соглашается с неточными, двусмысленными или ошибочными утверждениями кандидата из ложной «вежливости» (например, утверждение *«в метод `@CacheEvict` передается объект»* модель приняла со словами *«вы абсолютно правы»*, проигнорировав, что дефолтный `SimpleKeyGenerator` создаст ключ из хэша объекта, запись из кэша не удалится и возникнет рассинхронизация кэша в проде).

**Главная цель Wave 07:**  
Искоренить сикофантию во всех голосовых и текстовых режимах платформы, внедрив **эпистемическую бдительность (Epistemic Vigilance)**, защиту от буквоедства (**Trivia Immunity**), трёхуровневый спектр строгости калибровки (**Strictness Spectrum: Обучение / Собеседование L5 / Bar-Raiser L6**) и скрытый протокол верификации мыслей (**Thought Chain-of-Verification / CoVe**).

---

## 2. Архитектурные инварианты Wave 07 (Hard Invariants)

1. **Инвариант 1: Защита от буквоедства (Trivia Immunity Invariant)**  
   Кандидат оценивается по пониманию **физики процессов и причинно-следственных связей (Causal Mechanics)**, а не по дословному заучиванию конфигурационных строк.
   - Разрешено и поощряется описание своими словами: *«дефолтный генератор ключей»*, *«проперти батчинга»*, *«ConcurrentMap-хранилище»*.
   - **Категорически запрещено** снижать баллы или придираться за неточный регистр, пропущенный пакет или перефразированное имя второстепенного класса.

2. **Инвариант 2: Запрет фальшивых кивков (Zero False Affirmation)**  
   Полный лексический запрет на открывающие реплику поддакивания:
   * ⛔ *«Да, абсолютно верно»*, *«Вы правы»*, *«Отлично»*, *«Именно так»*, *«Согласен»*.
   * ✅ Модель сразу переходит к сути: либо к мягкому разбору физики ошибки, либо к зондирующему вопросу на граничные условия.

3. **Инвариант 3: Трёхуровневый спектр строгости (3-Tier Strictness Spectrum)**  
   * 🟢 **«Обучение и поддержка» (Learning & Socratic):** Не соглашается с ошибкой, но не штрафует. Мягко корректирует заблуждения и сразу объясняет устройство под капотом.
   * 🟡 **«Реалистичное собеседование» (FAANG L5 Standard — по умолчанию):** Зондирует уязвимости контрвопросами (*«А какой ключ создастся в Redis по умолчанию при передаче объекта?»*). При защите ответа балл сохраняется.
   * 🔴 **«Bar-Raiser / Стресс-тест» (Staff L6+):** Бескомпромиссный стресс-тест отказоустойчивости, инцидентов, метрик и архитектурных компромиссов.

4. **Инвариант 4: Внутренний протокол верификации мыслей (Thought Chain-of-Verification / CoVe)**  
   В скрытых мыслях (`thought`) моделей рассуждений (`gemini-live-thinking-v3`, Gemini Fast Reasoning) в обязательном порядке выполняется 4-шаговый аудит:
   `[CLAIMS AUDIT] -> [SPEC & CAUSAL AUDIT] -> [SYCOPHANCY CHECK] -> [ACTION FORMULATION]`.

5. **Инвариант 5: Очистка промптов от подталкивания к лести (No Flattery Priming)**  
   Полное удаление из промптов инструкций вида *«похвали за верные мысли»*, *«поблагодари за отличный ответ»* и примеров few-shot вида *«Отлично, ты хорошо разобралась в теме!»*. Замена на профессионально-нейтральные формулировки.

---

## 3. Матрица этапов и статус выполнения

| Этап | Документ спецификации | Область ответственности | Статус |
|---|---|---|---|
| **Этап 1** | [STAGE_01_CORE_INVARIANTS_AND_TRIVIA_IMMUNITY.md](STAGE_01_CORE_INVARIANTS_AND_TRIVIA_IMMUNITY.md) | Ядро SSOT: `antiSycophancy.ts`, Trivia Immunity, Zero False Affirmation, CoVe | 🟢 ВЫПОЛНЕНО |
| **Этап 2** | [STAGE_02_LIVE_PROMPT_ENGINE_AND_COVE_PROTOCOL.md](STAGE_02_LIVE_PROMPT_ENGINE_AND_COVE_PROTOCOL.md) | Live сокет: `livePromptBuilder.ts`, `deep_dive`, `interview`, удаление лести | 🟢 ВЫПОЛНЕНО |
| **Этап 3** | [STAGE_03_REST_TURN_AND_FAANG_SCORECARD_HARMONIZATION.md](STAGE_03_REST_TURN_AND_FAANG_SCORECARD_HARMONIZATION.md) | REST: `interviewTurn.ts`, CoVe JSON schema, очистка few-shot примеров | 🟢 ВЫПОЛНЕНО |
| **Этап 4** | [STAGE_04_FRONTEND_CALIBRATION_SPECTRUM_UI.md](STAGE_04_FRONTEND_CALIBRATION_SPECTRUM_UI.md) | UI: Селектор 3 уровней строгости в `VoiceModal.tsx`, `VoiceLobbyView.tsx`, `VoiceSettingsDrawer.tsx` | 🟢 ВЫПОЛНЕНО |
| **Этап 5** | [STAGE_05_VERIFICATION_SUITE_AND_PRODUCTION_DEPLOYMENT.md](STAGE_05_VERIFICATION_SUITE_AND_PRODUCTION_DEPLOYMENT.md) | Тесты (@CacheEvict scenario, Trivia tests), сборка frontend/backend | 🟢 ВЫПОЛНЕНО |

---

## 4. Журнал коммитов и прогресса

- `42d2d73` — chore: restore master deploy branch configuration (базовый коммит main).
- *Этап 1: Реализация канонических инвариантов в `antiSycophancy.ts` (Trivia Immunity, Zero False Affirmation, CoVe, Strictness Levels).*
- *Этап 2: Интеграция в Live Prompt Engine (`livePromptBuilder.ts`), очистка от лести и внедрение причинно-следственной физики рантайма.*
- *Этап 3: Гармонизация REST Turn Reasoning (`interviewTurn.ts`) и каскадный скоринг с защитой от буквоедства.*
- *Этап 4: Реализация 3-позиционного UI-селектора строгости в `VoiceLobbyView.tsx` и `VoiceSettingsDrawer.tsx` с синхронизацией в WebSocket и REST.*
- *Этап 5: Автоматизированные тесты `verifyPrompts.ts` и `verifyCacheEvictSycophancy.ts` — 100% assertions пройдены, production builds успешны.*
