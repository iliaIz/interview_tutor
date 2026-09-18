# Stage 02: Real-Time Audio Pacer & Simulated WebSocket Client

> **Статус:** ⚪ К ВЫПОЛНЕНИЮ  
> **Область:** `backend/src/testing/acoustic/`  
> **Целевой стандарт:** SOTA Zero-Drift Real-Time Streamer & Telemetry Harness

---

## 1. Архитектурная цель

Эмулировать физический микрофон браузера с точностью до миллисекунды, нарезая PCM на чанки и отправляя их в `/ws/live` строго со скоростью реального времени. Перехватывать все входящие фреймы от Gemini Live и собирать тайминги.

---

## 2. Реализуемые компоненты

### 2.1. `realtimeAudioPacer.ts`
- Чанкование: 40 мс аудио = $16000 \times 2 \times 0.040 = 1280$ байт на чанк.
- Механизм тайминга: `process.hrtime.bigint()` с вычислением погрешности `targetTime - actualTime` и самокоррекцией следующего сна.
- Методы:
  - `streamPcmChunks(ws, pcmBuffer, chunkMs = 40)`: отправка речи.
  - `streamSilence(ws, durationMs, chunkMs = 40)`: отправка тишины (нули).
  - `streamDialogueTurn(ws, speechPcm, silenceAfterMs)`: связка речи и тишины.

### 2.2. `simulatedLiveClient.ts`
- Подключение: `ws://localhost:8091/ws/live?...`
- Параметры сессии:
  - `sessionId`: `test_session_${Date.now()}`
  - `turnMode`: `auto`
  - `strategy`: `adaptive_probing`
  - `strictness`: `standard` | `learning` | `hardcore`
  - `liveModel`: `gemini-live-v3` | `gemini-live-thinking-v3` | `gemini-live-v2`
- Сбор телеметрии в `LiveSessionTelemetry`:
  - `aiGreetingDurationMs`: длительность приветствия ИИ.
  - `ttftMs`: Time To First Thought (для thinking).
  - `ttfaMs`: Time To First Audio.
  - `interruptionLatencyMs`: время до `interrupted: true` при barge-in.
  - `isTurnComplete`: флаг фиксации ответа.
  - `finalReplyText`: собранный текст ответа ИИ.
  - `thoughtTokens`: массив строк скрытых мыслей.

---

## 3. Критерии приемки (DoD)
- Дрейф времени при стриминге 5 секунд звука $\le 25$ мс.
- Клиент парсит как текстовые, так и бинарные фреймы WebSocket от backend proxy.
- Своевременное закрытие соединений при завершении сценария.
