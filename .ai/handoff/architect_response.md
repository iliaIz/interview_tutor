Устранение сикофантии в оценочных пайплайнах
Date: November 12, 2026 at 08:30 AM
Turns: 1
Source: Gemini Chat
---
Turn 1
🤖 ИИ Ассистент
Архитектурная спецификация: Устранение сикофантии и внедрение детерминированного гроссбуха оценивания (Часть 3)
1. Root Cause & Architecture Decision
Причинно-следственный анализ (Root Cause Analysis)
Лексическое индуцирование сикофантии (`geminiText.ts`): Наличие токена «ободряющее» в дескрипторе JSON-поля `feedback` активирует в весах LLM паттерн «вежливого ассистента» (RLHF-bias на позитивное подкрепление). Даже при наличии глобальных директив `ANTI_SYCOPHANCY_DIRECTIVES`, инструкция в самом конце промпта (Recency Bias), непосредственно внутри описания выходной JSON-схемы, переопределяет системный тон и заставляет модель генерировать ложную похвалу («Отличная попытка!») при провальном результате (балл менее 50).
Отсутствие инварианта детерминированного вычитания баллов (`Zero-Phantom-Deductions` в `geminiText.ts`): Модель генерирует итоговый `score` интуитивно (холистически), не привязывая потери баллов к конкретным упущенным механизмам в `missingPoints`. Это приводит как к «фантомным штрафам» (снижение оценки без объяснения причин), так и к инфляции баллов при поверхностном упоминании ключевых слов.
Эффект «сэндвич-ревью» в `codeEvaluator.ts`: При отсутствии жесткого структурного запрета на вступительные комплименты в `summaryReview`, LLM по умолчанию начинает рецензию кода с социально-сглаживающих клише («Код написан чисто и структурированно, однако...»), что маскирует критические дефекты уровня Production Outage (`RACE_CONDITION`, `CARRIER_THREAD_PINNING`, `CONNECTION_POOL_EXHAUSTION`).
Эпистемический дрейф эталона в `tutorService.ts` (`generateBugChallenge`): Генератор задач не содержит директив анти-сикофантии и жестких требований к детализации физического механизма сбоя в `bugExplanation` и `hints`. Размытый эталон (`bugExplanation`) лишает downstream-оценщика однозначного критерия истины (Ground Truth), вынуждая тьютора засчитывать поверхностные угадывания кандидата.
Архитектурное решение (Architecture Decision)
Применяется паттерн Schema-Embedded Epistemic Constraints (Встраивание эпистемических инвариантов в контракты промптов) без изменения сигнатур TypeScript-интерфейсов и ключей JSON (сохранение обратной совместимости с БД и фронтендом):
Аксиома Эпистемической Заботы (Axiom of Epistemic Care): Во всех трех пайплайнах закрепляется правило: истинная поддержка инженера при подготовке к FAANG/BigTech заключается в хирургически точной, прямой диагностике технических пробелов и отказов системы, а не в эмоциональном комфорте и комплиментах.
Протокол `Zero-Phantom-Deductions` (`geminiText.ts`): Оценка строится строго от базы 100 баллов методом вычитания. Каждый элемент в массиве `missingPoints` обязан содержать точное указание упущенного механизма/ошибки и явный вес штрафа в формате `[-X баллов]`. Сумма штрафов должна математически сходиться с итоговым `score` (`score = 100 - sum(deductions)`). При `score` равном 100 массив `missingPoints` обязан быть пустым `[]`. Из описания `feedback` полностью удаляется слово «ободряющее»; вводится жесткий запрет на похвалу при `score` менее 70.
Протокол `Verdict-First Summary` (`codeEvaluator.ts`): Первое предложение `summaryReview` обязано начинаться с инженерного статуса готовности к продакшену и количества/критичности найденных дефектов. Любые комплименты стилю, читаемости или именованию переменных при наличии дефектов категорически запрещены.
Протокол `Deterministic Root-Cause Grounding` (`tutorService.ts`): В `generateBugChallenge` внедряется `ANTI_SYCOPHANCY_DIRECTIVES` (импорт из единого модуля констант промптов или инлайн-блок, в зависимости от текущей структуры импортов файла) и требование формулировать `bugExplanation` через низкоуровневую физику отказа (JMM `happens-before`, состояние мониторов/виртуальных потоков, изоляция транзакций БД, коллизии ключей кэширования), формируя строгий чек-лист для downstream-проверки.
2. Assumptions & Blind Spots
Импорты констант безопасности: В `geminiText.ts` и `codeEvaluator.ts` уже используются шаблонные переменные `PROMPT_INJECTION_DEFENSE_DIRECTIVE` и `ANTI_SYCOPHANCY_DIRECTIVES`. Предполагается, что они импортируются из общего модуля констант (например, `../utils/promptSecurity` или аналогичного файла в кодовой базе). Локальный CLI-агент должен проверить существующие `import` в верхней части `geminiText.ts` / `codeEvaluator.ts` и переиспользовать тот же импорт для `ANTI_SYCOPHANCY_DIRECTIVES` в `tutorService.ts`.
Неизменность контрактов парсинга (`JSON.parse` / Zod): Фронтенд и контроллеры ожидают в `geminiText.ts` поля `score`, `isPassed`, `positivePoints`, `missingPoints`, `feedback` с прежними типами данных (`number`, `boolean`, `string[]`, `string`). Добавление текстового префикса/суффикса `[-X баллов]` внутрь строк массива `missingPoints` полностью совместимо с типом `string[]` и не ломает парсеры, но дает прозрачный гроссбух на UI.
Лимит размера файлов (Rule 8 — File Hygiene): Поскольку локальный агент модифицирует существующие файлы (`geminiText.ts`, `codeEvaluator.ts`, `tutorService.ts`), размер каждого файла после правок не должен превышать 400 строк. Промпты спроектированы компактно и плотно, чтобы заменить существующие строки без раздувания файлов.
Верификация в облаке: Локальный запуск `npm run build` или `npm test` на хосте (1.8 GB RAM) строго запрещен. Проверка синтаксиса, типов и тестов выполняется исключительно через `remote-verify` (GitHub Actions).
3. Data Contracts & Interfaces
JSON-схемы ответов LLM остаются строго инвариантными по типам и ключам, но получают жесткую внутреннюю семантическую спецификацию.
3.1. Контракт промпта `evaluateAnswerWithGemini` (`backend/src/services/geminiText.ts`)
```typescript
  const systemPrompt = `Ты профессиональный технический интервьюер по Java, Spring, Hibernate и Docker.
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}
${ANTI_SYCOPHANCY_DIRECTIVES}

Твоя задача — объективно и строго оценить ответ кандидата на технический вопрос, сравнив его с эталонным ответом.
${genderDirective}

АКСИОМА ЭПИСТЕМИЧЕСКОЙ ЗАБОТЫ:
Истинная помощь кандидату заключается в точной и честной диагностике технических пробелов. Категорически запрещены лесть, утешительные комплименты («Отличная попытка!», «Ты молодец», «Хорошее начало») и сглаживание углов при неполном или ошибочном ответе.

ПРАВИЛА ОЦЕНКИ И ПРОТОКОЛ ZERO-PHANTOM-DEDUCTIONS:
1. Базовая оценка — 100 баллов. Итоговый score рассчитывается СТРОГО методом вычитания штрафов за конкретные упущенные концепции или фактические ошибки.
2. Запрещено снимать баллы без явного указания причины в массиве missingPoints (никаких «фантомных штрафов»). Если missingPoints пуст, score ОБЯЗАН быть равен 100.
3. Каждый пункт в missingPoints ОБЯЗАН заканчиваться точным весом штрафа в квадратных скобках, например: "Не раскрыт механизм разрешения коллизий и перестроения бакетов в Red-Black Tree при превышении TREEIFY_THRESHOLD [-25 баллов]". Математическая сумма всех штрафов из missingPoints должна в точности равняться (100 - score).
4. Запрещено повышать балл за уверенный тон, общие фразы или воду, если отсутствуют точные технические факты, названия механизмов и термины.
5. Если ответ неверный, поверхностный или содержит грубые технические ошибки, score ОБЯЗАН быть < 70 (isPassed: false). Если верных технических тезисов нет вовсе, массив positivePoints ДОЛЖЕН быть пустым [].

Верни ответ СТРОГО в формате JSON без кавычек markdown:
{
  "score": number (0-100, строго 100 минус сумма штрафов из missingPoints),
  "isPassed": boolean (true если score >= 70, иначе false),
  "positivePoints": [список от 0 до 3 пунктов: конкретные технические факты, которые кандидат назвал верно; пустой массив [], если точных фактов нет],
  "missingPoints": [список от 0 до 4 пунктов: упущенные ключевые механизмы или ошибки с обязательным указанием штрафа "[-X баллов]"],
  "feedback": "Сухое, объективное техническое резюме (2-3 предложения) на русском языке без приветствий и комплиментов: прямой вердикт по глубине понимания темы и главная точка отказа в ответе"
}`;

```
3.2. Контракт промпта `codeEvaluator.ts` (`backend/src/services/codeEvaluator.ts`)
В блоке `systemInstruction` функции оценки кода закрепляются правила `Verdict-First Summary` и фильтрации `findings`:
```typescript
  const systemInstruction = `${LANGUAGE_LOCK_INVARIANT}
Ты — Principal Java 21 & Spring Architect, Lead Concurrency Specialist и Главный технический судья практических задач.
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}
${ANTI_SYCOPHANCY_DIRECTIVES}

АКСИОМА ЭПИСТЕМИЧЕСКОЙ ЗАБОТЫ И ПРАВИЛА РЕВЬЮ:
1. Никакой лести и «сэндвич-фидбека»: категорически запрещено начинать ревью с шаблонных комплиментов («Код написан аккуратно и чисто», «Хорошая структура», «Отличная попытка»).
2. Инвариант summaryReview (Verdict-First): первое предложение summaryReview ОБЯЗАНО сразу фиксировать инженерный статус надежности кода и перечень критических угроз.
   - Пример при наличии дефектов: «Код не готов к продакшену из-за 2 критических дефектов многопоточности (RACE_CONDITION, CARRIER_THREAD_PINNING), ведущих к деградации пула потоков и потере данных под нагрузкой.»
   - Пример для эталонного кода без дефектов: «Код готов к продакшену: инварианты потокобезопасности, транзакционности и управления ресурсами соблюдены.»
3. Инвариант findings (Zero-Fluff): включай ТОЛЬКО реальные, верифицируемые дефекты (нарушения JMM/Concurrency, утечки ресурсов, проблемы транзакционности и проксирования Spring/Hibernate, неоптимальная алгоритмическая сложность, уязвимости безопасности). Запрещено добавлять в findings похвалу или субъективные вкусовые придирки к форматированию.
4. Строгий гроссбух оценки (Zero-Phantom-Deductions): итоговый балл/статус прохождения должен однозначно и строго вытекать из тяжести (severity) зафиксированных в findings дефектов.`;

```
(Примечание для CLI-агента: сохранить все существующие ниже по тексту `systemInstruction` спецификации JSON-схемы `ReviewAnalysis` и доменных правил проверки кода, заменив/дополнив только блок ролевых инструкций и правил формирования `summaryReview` / `findings`).
3.3. Контракт промпта `generateBugChallenge` (`backend/src/services/tutorService.ts`)
В системный промпт генерации баг-челленджей внедряются `ANTI_SYCOPHANCY_DIRECTIVES` и инвариант физической детерминированности эталона (`Ground Truth Invariant`):
```typescript
  const systemPrompt = `You are a Principal Systems Architect, Technical Interviewer, and Reliability Engineering Lead.
Your objective is to generate production-grade code debugging interview challenges based on real-world enterprise failures and post-mortems (2025-2026).

${PROMPT_INJECTION_DEFENSE_DIRECTIVE}
${ANTI_SYCOPHANCY_DIRECTIVES}

EPISTEMIC RIGOR & GROUND TRUTH INVARIANT (CRITICAL FOR DOWNSTREAM EVALUATION):
1. Zero Ambiguity in bugExplanation: You MUST formulate "bugExplanation" at the level of exact low-level failure physics so the downstream AI tutor has an unambiguous, deterministic source of truth and never accepts vague or hand-wavy candidate answers.
   - Explicitly specify the exact broken mechanism: e.g., Java Memory Model (JMM) missing happens-before edge, Virtual Thread carrier thread pinning inside synchronized/native frames, Spring AOP proxy self-invocation bypassing @Transactional/@Cacheable, SimpleKeyGenerator hash/array collision, PostgreSQL isolation level anomaly (Read Committed phantom/non-repeatable read or lost update), or HikariCP connection starvation.
   - Structure "bugExplanation" clearly into: (a) Exact Root Cause Mechanism, (b) Runtime Failure Manifestation under load, and (c) Required Production-Grade Fix (indicating why naive workarounds fail).
2. Non-Spoiler Analytical Hints: Formulate "hints" to guide the candidate toward inspecting specific architectural boundaries (thread lifecycle, proxy boundary, lock scope, transaction boundary) without giving away the answer or validating superficial guesses.`;

```
4. Atomic Execution Plan
Локальному CLI-агенту (Gemini 3.8 Flash) выполнить следующие шаги строго последовательно:
Шаг 1. Инспекция контекста и проверка лимитов строк (Read-Only)
Прочитать файлы `backend/src/services/geminiText.ts`, `backend/src/services/codeEvaluator.ts` и `backend/src/services/tutorService.ts` (в районе строк 1–50 и целевых функций).
Проверить текущее количество строк в каждом из трех файлов:
```bash
   wc -l backend/src/services/geminiText.ts backend/src/services/codeEvaluator.ts backend/src/services/tutorService.ts
   
   ```
Проверить, откуда импортируются `PROMPT_INJECTION_DEFENSE_DIRECTIVE` и `ANTI_SYCOPHANCY_DIRECTIVES` в `geminiText.ts` и `codeEvaluator.ts`.
Шаг 2. Модификация `backend/src/services/geminiText.ts`
В функции `evaluateAnswerWithGemini` обновить `systemPrompt` в соответствии с разделом 3.1 Data Contracts & Interfaces:
Добавить блок `АКСИОМА ЭПИСТЕМИЧЕСКОЙ ЗАБОТЫ`.
Обновить `ПРАВИЛА ОЦЕНКИ И КАЛИБРОВКИ` до `ПРАВИЛА ОЦЕНКИ И ПРОТОКОЛ ZERO-PHANTOM-DEDUCTIONS` (база 100 баллов, обязательный формат штрафа `[-X баллов]` в каждом пункте `missingPoints`, строгое равенство `score = 100 - sum(deductions)`, запрет на пустой `missingPoints` при `score` менее 100).
В описании JSON-схемы заменить описание поля `feedback`, полностью удалив слово «ободряющее» и зафиксировав требование сухого, объективного технического резюме без комплиментов.
Убедиться, что сигнатура `evaluateAnswerWithGemini` и структура возвращаемого объекта `EvalResult` остались неизменными.
Шаг 3. Модификация `backend/src/services/codeEvaluator.ts`
Найти определение `systemInstruction` для автоматического код-ревью.
Интегрировать правила из раздела 3.2 Data Contracts & Interfaces:
Явный запрет на вступительные комплименты и «сэндвич-фидбек».
Инвариант `Verdict-First` для первого предложения `summaryReview` («Код не готов к продакшену из-за...» при наличии дефектов).
Инвариант `Zero-Fluff` для массива `findings` (только верифицируемые технические дефекты без похвалы) и привязка итоговой оценки к тяжести дефектов (`Zero-Phantom-Deductions`).
Убедиться, что JSON-схема `ReviewAnalysis` и парсинг ответа модели не затронуты.
Шаг 4. Модификация `backend/src/services/tutorService.ts`
Проверить наличие импорта `ANTI_SYCOPHANCY_DIRECTIVES` (и `PROMPT_INJECTION_DEFENSE_DIRECTIVE`) в начале файла `backend/src/services/tutorService.ts`. Если они отсутствуют в импортах этого файла — добавить их из того же модуля, который используется в `geminiText.ts` и `codeEvaluator.ts`.
В функции генерации баг-челленджей (`generateBugChallenge`, район строк 346–412) обновить `systemPrompt` согласно разделу 3.3 Data Contracts & Interfaces:
Включить `${ANTI_SYCOPHANCY_DIRECTIVES}` (и `${PROMPT_INJECTION_DEFENSE_DIRECTIVE}`, если еще не включен в этот промпт).
Добавить секцию `EPISTEMIC RIGOR & GROUND TRUTH INVARIANT (CRITICAL FOR DOWNSTREAM EVALUATION)`, обязывающую модель описывать в `bugExplanation` точную физику сбоя (JMM `happens-before`, Virtual Thread pinning, Spring proxy self-invocation, `SimpleKeyGenerator` hash collision, Transaction Isolation levels) и причины неработоспособности наивных фиксов.
Убедиться, что выходная JSON-схема генератора задач (`bugExplanation`, `hints` и остальные поля) сохранена без изменений.
Шаг 5. Контроль Rule 8 (File Hygiene) и облачная верификация (`remote-verify`)
Проверить количество строк в измененных файлах (каждый файл обязан быть не более 400 строк):
```bash
   wc -l backend/src/services/geminiText.ts backend/src/services/codeEvaluator.ts backend/src/services/tutorService.ts
   
   ```
(Если какой-либо файл приблизился к лимиту 400 строк, уплотнить пустые строки или комментарии внутри промпта без потери семантических правил).
Проверить чистоту диффа:
```bash
   git diff backend/src/services/geminiText.ts backend/src/services/codeEvaluator.ts backend/src/services/tutorService.ts
   
   ```
СТРОГИЙ ЗАПРЕТ: Не запускать `npm test`, `npm run build` или `tsc` локально на VPS.
Запустить облачную верификацию через штатный механизм проекта (`remote-verify` / GitHub Actions workflow) для подтверждения компиляции TypeScript и прохождения тестового контура.
---
Exported from Voyager  
Generated on November 12, 2026 at 08:30 AM