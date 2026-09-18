# Stage 01: Acoustic Fixtures Pipeline & LiteLLM TTS Normalizer

> **Статус:** 🟡 В РАБОТЕ  
> **Область:** `backend/src/testing/acoustic/`  
> **Целевой стандарт:** SOTA Deterministic Audio Fixtures (SHA-256 Content-Addressed Storage, 16kHz 16-bit Mono Linear PCM)

---

## 1. Архитектурная цель

Обеспечить детерминированное хранилище аудио-реплик кандидата, синтезированных через LiteLLM Proxy (`gemini-tts-v3`), без лишних трат токенов и с гарантией канонического формата 16kHz Little-Endian PCM.

---

## 2. Реализуемые компоненты

### 2.1. `acousticFixtureManager.ts`
- **Каталог:** `backend/tests/fixtures/audio/`.
- **Хэширование:** `const key = crypto.createHash('sha256').update(`${voice}:${text}`).digest('hex').slice(0, 16)`.
- **Логика работы:**
  1. Если `fixture_{key}.pcm` существует $\rightarrow$ загружает напрямую из файловой системы.
  2. Если нет $\rightarrow$ запрашивает LiteLLM Proxy endpoint `/v1/audio/speech` (через `synthesizeTTSWithRetry`), извлекает WAV.
  3. Парсит RIFF WAV заголовок (chunk `fmt `, sample rate, bits per sample, data chunk) и извлекает сырые PCM байты.
  4. Если sample rate отличается от 16 000 Гц (например, 24 000 Гц у Gemini TTS) — производит линейный ресэмплинг в 16 000 Гц.
  5. Сохраняет `.pcm` на диск и возвращает готовый буфер.

### 2.2. Золотой набор тестовых фраз (Golden Fixture Catalog)
1. `candidate_normal_answer_java`:
   *Текст:* «Для инвалидации кэша используется аннотация CacheEvict с указанием ключа или имени кэша.»
2. `candidate_sycophancy_bait`:
   *Текст:* «В метод с аннотацией CacheEvict передается объект.»
3. `candidate_surrender_breakpoint`:
   *Текст:* «Я не знаю, сдаюсь, объясни пожалуйста, как это устроено под капотом.»
4. `candidate_complex_architecture`:
   *Текст:* «Мы вынесли запись в Kafka и используем Outbox паттерн с Debezium для CDC.»
5. `candidate_hesitation_part1`:
   *Текст:* «Мы выбираем партиционирование по идентификатору пользователя,»
6. `candidate_hesitation_part2`:
   *Текст:* «чтобы все события одного аккаунта попадали в одну партицию.»

### 2.3. `silenceGenerator.ts`
- `generateSilence(durationMs: number): Buffer` — генерирует буфер нулей ($16000 \times 2 \times \frac{\text{durationMs}}{1000}$ байт).

---

## 3. Критерии приемки (DoD)
- Все фикстуры имеют строго 16 000 Гц, 1 канал, 16 бит.
- Повторный вызов `getFixture(id)` не делает сетевых запросов.
- Запуск юнит-теста фикстур проходит за $< 50$ мс при наличии кэша.
