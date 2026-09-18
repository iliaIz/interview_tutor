# Wave 08: Acoustic Simulation & Multi-Engine Auto-VAD Test Harness (ASSTH)

> **Статус программы:** 🟡 В РАБОТЕ  
> **Ветка:** `feature/wave-08-acoustic-vad-harness`  
> **Дата старта:** Сентябрь 2026  
> **Целевой стандарт:** SOTA September 2026 Multimodal Voice & Reasoning Harness (Zero-Drift Acoustic Pacing, Extended Thinking Isolation, Multi-Engine Matrix)

---

## 1. Миссия и цели Wave 08

В ходе непрерывного развития платформы голосовой диалог (в особенности режим **Авто-VAD**) периодически подвергается регрессиям из-за скрытых гонок состояний (race conditions), рассинхронизации клиентских и серверных таймеров тишины и специфики разных версий движков (`v2`, `v3`, `thinking-v3`).

**Главная цель Wave 08:**  
Создать полностью детерминированный, автоматизированный тестовый контур акустической симуляции диалога (**Acoustic Simulation & Synthetic Turn Harness — ASSTH**), который:
1. Синтезирует эталонные фразы кандидата через `gemini-tts-v3` (через LiteLLM Proxy) в канонический формат микрофона (PCM 16 kHz Mono 16-bit LE) с SHA-256 кэшированием на диске (0 повторных расходов токенов).
2. Стримит аудио в WebSocket `/ws/live` чанками с реальной физической скоростью речи (эмулятор микрофона с компенсацией дрифта времени).
3. Проверяет поведение Авто-VAD во всех 3 движках: `gemini-live-v2`, `gemini-live-v3`, `gemini-live-thinking-v3`.
4. Реализует **специализированный тестовый люкс для `thinking`-моделей**: защиту от утечки мыслей в звук (Acoustic CoT Shield), прерывание на фазе размышлений (Pre-Vocal Barge-In), программный аудит протокола CoVe в мыслях и лимиты задержки ($T_{\text{thought}} \le 2200$ мс).

---

## 2. Архитектурные инварианты Wave 08

1. **Инвариант 1: LiteLLM Proxy Invariant (AGENTS.md #1)**  
   Все обращения к TTS (`gemini-tts-v3`) и WebSocket `/ws/live` маршрутизируются строго через LiteLLM Proxy с авторизацией по виртуальному ключу `LITELLM_API_KEY`. Прямые запросы к Google API запрещены.
2. **Инвариант 2: Канонический формат акустических фикстур**  
   Все аудиофикстуры нормализуются строго в **16 000 Гц, 16 бит, 1 канал (моно), Little-Endian линейный PCM**. Любые WAV-заголовки отсекаются.
3. **Инвариант 3: Компенсация дрифта времени (1.0x Real-Time Pacing)**  
   Аудиочанки по 20–50 мс (640–1600 байт) отправляются в сокет строго по физическому таймеру с компенсацией задержек Node.js event-loop. Запрещено выгружать аудиофайлы залпом.
4. **Инвариант 4: Изоляция мыслей от звука (Acoustic CoT Shield)**  
   Ни один токен из блока размышлений (`thought`) модели `gemini-live-thinking-v3` не должен попадать в аудиопоток или пользовательский текст.
5. **Инвариант 5: Детерминизм и кэширование фикстур**  
   Аудиофайлы синтезируются однократно и кэшируются по ключу `SHA-256(text + voice)` в `backend/tests/fixtures/audio/*.pcm`. Повторные прогоны тестов происходят за 0 мс без расхода токенов.

---

## 3. Матрица этапов и статус выполнения

| Этап | Документ спецификации | Область ответственности | Статус |
|---|---|---|---|
| **Этап 1** | [STAGE_01_ACOUSTIC_FIXTURES_AND_TTS.md](STAGE_01_ACOUSTIC_FIXTURES_AND_TTS.md) | Конвейер фикстур: `acousticFixtureManager.ts`, генератор тишины, нормализация PCM | ✅ ВЫПОЛНЕНО |
| **Этап 2** | [STAGE_02_REALTIME_PACER_AND_WS_HARNESS.md](STAGE_02_REALTIME_PACER_AND_WS_HARNESS.md) | Эмулятор микрофона: `realtimeAudioPacer.ts`, клиент `simulatedLiveClient.ts` | ✅ ВЫПОЛНЕНО |
| **Этап 3** | [STAGE_03_AUTO_VAD_COMMON_SCENARIOS.md](STAGE_03_AUTO_VAD_COMMON_SCENARIOS.md) | Базовые сценарии: Standard Turn, Mid-Sentence Pause (800ms), Barge-In, Noise | ✅ ВЫПОЛНЕНО |
| **Этап 4** | [STAGE_04_EXTENDED_THINKING_REASONING_SUITE.md](STAGE_04_EXTENDED_THINKING_REASONING_SUITE.md) | Спецтесты thinking: CoT Shield, Pre-Vocal Barge-In, CoVe Audit, Latency Cap | ✅ ВЫПОЛНЕНО |
| **Этап 5** | [STAGE_05_CLI_RUNNER_AND_CI_INTEGRATION.md](STAGE_05_CLI_RUNNER_AND_CI_INTEGRATION.md) | CLI: `npm run test:vad:quick`, `npm run test:vad:matrix`, таблица метрик | ✅ ВЫПОЛНЕНО |

---

## 4. Журнал коммитов и прогресса

- `1890224` — feat(wave-07): implement epistemic vigilance, anti-sycophancy and 3-tier calibration spectrum (базовый коммит main).
- *Этап 1: Создание `acousticFixtureManager.ts`, генератора тишины `silenceGenerator.ts` и золотого каталога фикстур.*
- *Этап 2: Создание `realtimeAudioPacer.ts` с drift-компенсацией и headless-клиента `simulatedLiveClient.ts`.*
- *Этап 3: Создание типовых VAD сценариев (Standard, Hesitation 800ms, Barge-In, Noise Rejection).*
- *Этап 4: Разработка расширенного reasoning-тест люкса `thinkingSpecializedSuite.ts` (CoT Shield, Pre-Vocal Barge-In, CoVe Audit).*
- *Этап 5: Создание CLI диспетчера `runAcousticVadMatrix.ts` и интеграция npm-скриптов.*
