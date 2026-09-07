# Master-План Архитектурной Унификации и Рефакторинга

> **Проект:** InterviewPrep AI / Spring Tutor  
> **Версия архитектуры:** 2026.3 Unified  
> **Цель:** Полная ликвидация дублирования кода, перевод всех аудио-сессий на Единый Источник Правды (Single Source of Truth), декомпозиция всех Год-компонентов (> 500 строк) до идеального размера (150–350 строк) под работу с ИИ-ассистентами.

---

## 1. Концепция и руководящие принципы SOTA 2026

1. **Принцип «Единого шлюза» (Single Source of Truth):**
   - Ровно **один** хук для взаимодействия с живым звуком Gemini Live: `useLiveAudioSession.ts`.
   - Никаких дублирующих inline-реализаций Web Audio API или WebSocket внутри модальных окон.
   - Все экраны (`VoiceModal`, `PracticeArena`, `SystemDesignArena`, `BugHuntArena`) используют строго один и тот же интерфейс.

2. **Принцип «Code as an API for AI» (Модульность под контекст ИИ):**
   - Целевой размер компонентов и хуков: **150–350 строк**.
   - Жёсткий потолок: **500 строк**.
   - Четкие интерфейсы (`types/voice.ts`, `types/*.ts`) без смешивания типов с версткой.
   - Минимизация внимания: ИИ должен иметь возможность модифицировать любую часть приложения, читая только целевой файл и файл его типов.

3. **Инварианты безопасности (Hard Invariants — Запрещено нарушать):**
   - **LiteLLM Proxy Invariant:** Никаких прямых ключей Google API в клиенте. Весь звук и вызовы идут через Caddy на порт 443 (`wss://java.djelu.site/ws/live`), далее в backend и LiteLLM Gateway (`litellm-gateway:4000`).
   - **First-Turn Tool Lockdown:** Запрет вызова функции оценивания на нулевой реплике приветствия.
   - **Dual-Sided Handshake:** Микрофон кандидата разблокируется только тогда, когда закончился и сетевой ответ модели, и физическое воспроизведение звука в динамиках.
   - **Zero Grading Invariant в режиме Тьютора:** Никаких оценок и вердиктов в обучающих диалогах.
   - **Zero Phantom Fallbacks:** Сумма всех штрафных пунктов рубрики обязана математически равняться $100 - \text{Score}$.

---

## 2. Архитектура: До и После

### До рефакторинга (Split-Brain & God-Files):
```
[VoiceModal.tsx (3770 строк)]  --->  Собственный inline-WebSocket (/ws/live)  ---> Backend
[useLegacyLiveAudioSession.ts]  --->  Второй inline-WebSocket (/ws/live)      ---> Backend
[useLiveKitAudioSession.ts]    --->  WebRTC (ws://...:7880 - падал по таймауту)
[useAppStore.ts (1036 строк)]  --->  Монолитное глобальное состояние
```

### После рефакторинга (Clean Slices & Unified Gateway):
```
                                ┌──> VoiceModal.tsx (~240 строк, чистый UI-оркестратор)
                                ├──> PracticeVoiceHUD.tsx (Парный напарник)
useLiveAudioSession.ts (~380) ──┼──> SystemDesignArena.tsx (Архитектор)
(Единый шлюз /ws/live на 443)  └──> BugHuntArena.tsx (Дебаг-сессия)
         │
         ▼
Caddy (Port 443 WSS/TLS) -> Backend /ws/live -> LiteLLM Proxy -> Gemini Live
```

---

## 3. Реестр фаз и детальные документы

Каждый этап задокументирован в отдельном файле с пошаговым планом, крайними случаями (edge cases) и чек-листом проверки:

| № | Название этапа | Документ с детальной спецификацией | Ожидаемый результат |
| :--- | :--- | :--- | :--- |
| **0** | **Аудит файлов неидеального размера** | [01_large_files_audit.md](./01_large_files_audit.md) | Полная карта файлов > 500 строк с планом декомпозиции. |
| **1** | **Унификация аудио-ядра `useLiveAudioSession`** | [phase1_audio_engine_unification.md](./phase1_audio_engine_unification.md) | Единый хук для всех 4 аренах. Полная ликвидация дублирования транспорта. |
| **2** | **Декомпозиция `VoiceModal.tsx` (3770 $\rightarrow$ 250 строк)** | [phase2_voice_modal_decomposition.md](./phase2_voice_modal_decomposition.md) | Модал разбит на 5 изолированных модулей (Active, Transition, Telemetry, Batch, Shell). |
| **3** | **Модуляризация состояния `useAppStore.ts`** | [phase3_store_and_state_modularization.md](./phase3_store_and_state_modularization.md) | Разделение хранилища на 5 независимых слайсов по доменам. |
| **4** | **Рефакторинг бэкенда и вынос сид-каталогов** | [phase4_backend_and_catalogs_refactoring.md](./phase4_backend_and_catalogs_refactoring.md) | Модуляризация `geminiLiveProxy.ts` (998) и `db.ts` (880), вынос тяжелых каталогов в JSON. |
| **5** | **Чистка мертвого кода и E2E-верификация** | [phase5_verification_and_dead_code_purge.md](./phase5_verification_and_dead_code_purge.md) | Удаление `useLegacy*`, `useLiveKit*`, верификация CI/CD, прогон E2E-тестов. |

---

## 4. Порядок безопасного выполнения (Safety Rules)

1. **Изоляция изменений:** Никаких одновременных изменений аудио-ядра и переписывания верстки. Сначала стабилизируем транспортный хук, затем переключаем потребителей по одному.
2. **Нулевая регрессия:** Каждый этап завершается локальной сборкой `npm run build` (TypeScript check) и верификацией на живом окружении.
3. **Фиксация в Git:** Каждый этап коммитится отдельно с описанием архитектурных изменений.
