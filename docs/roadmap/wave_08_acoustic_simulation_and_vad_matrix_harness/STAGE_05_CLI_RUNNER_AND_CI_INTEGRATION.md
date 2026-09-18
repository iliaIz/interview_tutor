# Stage 05: CLI Runner, Telemetry Reporting & CI Integration

> **Статус:** ⚪ К ВЫПОЛНЕНИЮ  
> **Область:** `backend/src/scripts/` и `backend/package.json`  
> **Целевой стандарт:** SOTA Developer Experience & Multi-Engine Latency Reporting

---

## 1. Архитектурная цель

Предоставить удобный интерфейс командной строки для запуска сценариев Авто-VAD, как в быстром дымовом режиме (15 секунд), так и в полном матричном прогоне по всем моделям с красивой таблицей метрик задержки (Latency SLA).

---

## 2. Реализуемые команды и CLI

### 2.1. `runAcousticVadMatrix.ts`
- Флаги:
  - `--engine=gemini-live-v3|gemini-live-thinking-v3|gemini-live-v2|all`
  - `--scenario=standard|hesitation|bargein|noise|thinking|all`
  - `--fixtures`: только синтез/проверка фикстур.
  - `--strictness=learning|standard|hardcore`
- Скрипты в `backend/package.json`:
  ```json
  "test:vad:fixtures": "ts-node src/scripts/runAcousticVadMatrix.ts --fixtures",
  "test:vad:quick": "ts-node src/scripts/runAcousticVadMatrix.ts --engine=gemini-live-v3 --scenario=standard",
  "test:vad:thinking": "ts-node src/scripts/runAcousticVadMatrix.ts --engine=gemini-live-thinking-v3 --scenario=thinking",
  "test:vad:matrix": "ts-node src/scripts/runAcousticVadMatrix.ts --engine=all --scenario=all"
  ```

### 2.2. Формат терминального отчета (Telemetry Summary Table)
```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                      ACOUSTIC AUTO-VAD MATRIX REPORT                              ║
╠═══════════════════════════════╦═══════════════╦═════════╦══════════╦══════════════╣
║ Scenario                      ║ Engine        ║ Status  ║ TTFA     ║ Barge-In     ║
╠═══════════════════════════════╬═══════════════╬═════════╬══════════╬══════════════╣
║ Standard Turn                 ║ live-v3       ║ ✅ PASS ║ 620 ms   ║ -            ║
║ Hesitation (800ms)            ║ live-v3       ║ ✅ PASS ║ 680 ms   ║ -            ║
║ Acoustic Barge-In             ║ live-v3       ║ ✅ PASS ║ -        ║ 180 ms       ║
║ Noise Rejection (150ms)       ║ live-v3       ║ ✅ PASS ║ -        ║ -            ║
║ Thinking CoT Shield           ║ thinking-v3   ║ ✅ PASS ║ 1420 ms  ║ -            ║
║ Pre-Vocal Barge-In            ║ thinking-v3   ║ ✅ PASS ║ -        ║ 140 ms       ║
║ CoVe Epistemic Audit          ║ thinking-v3   ║ ✅ PASS ║ 1350 ms  ║ -            ║
╚═══════════════════════════════╩═══════════════╩═════════╩══════════╩══════════════╝
```

---

## 3. Критерии приемки (DoD)
- Скрипты запускаются без дополнительных ручных манипуляций.
- Команда завершается с ненулевым кодом при падении любого из тестов.
- Время выполнения `test:vad:quick` не превышает 30 секунд.
