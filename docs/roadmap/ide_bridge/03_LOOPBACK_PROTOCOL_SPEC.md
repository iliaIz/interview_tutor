# Спецификация сетевого протокола Loopback WebSocket & EchoGuard

> **Документ**: `03_LOOPBACK_PROTOCOL_SPEC.md`  
> **Статус**: Стандарт локального сетевого взаимодействия (SOTA Late 2026)  
> **Эндпоинт**: `ws://127.0.0.1:41789`

---

## 1. Модель безопасности локального сокета

1. **Strict Loopback Binding**:
   - Сервер `bridge.mjs` открывает сокет исключительно на интерфейсе `127.0.0.1` (IPv4 loopback).
   - Привязка к `0.0.0.0` строго запрещена, что предотвращает доступ к мосту из локальной сети или извне.
2. **Origin Verification**:
   - При входящем HTTP Upgrade проверяется заголовок `Origin`.
   - Разрешены только:
     - `http://localhost:*`
     - `http://127.0.0.1:*`
     - Production-домен платформы (`https://*.domain.tld`).
   - Все запросы с чужих сайтов немедленно сбрасываются с HTTP 403 Forbidden.

---

## 2. Типизированные контракты сообщений

Все сообщения передаются в виде валидных UTF-8 JSON-объектов.

### 2.1. Рукопожатие (Handshake)

#### От браузера к мосту:
```json
{
  "type": "HANDSHAKE_INIT",
  "clientVersion": "1.0.0",
  "challengeId": "mc_rate_limiter_token_bucket",
  "timestamp": 1728302000000
}
```

#### Ответ моста браузеру:
```json
{
  "type": "HANDSHAKE_ACK",
  "serverVersion": "1.0.0",
  "workspaceDir": "/home/djelu/tutor-workspace/rate-limiter",
  "activeChallengeId": "mc_rate_limiter_token_bucket",
  "fileCount": 5,
  "timestamp": 1728302000010
}
```

---

### 2.2. Синхронизация файлов (File Sync)

#### Событие: Сохранение файла в IntelliJ IDEA (IDE $\rightarrow$ Web UI):
```json
{
  "type": "FILE_UPDATED",
  "origin": "ide",
  "challengeId": "mc_rate_limiter_token_bucket",
  "path": "src/main/java/com/assessment/ratelimiter/service/TokenBucketStrategy.java",
  "content": "package com.assessment.ratelimiter.service; ...",
  "contentHash": "5a4f78b12c8e",
  "timestamp": 1728302005120
}
```

#### Событие: Обновление из веба (Web UI $\rightarrow$ IDE):
*(Срабатывает при сбросе задачи в шаблоны или подсказке ИИ, применившей фикс)*
```json
{
  "type": "FILE_UPDATED",
  "origin": "web",
  "challengeId": "mc_rate_limiter_token_bucket",
  "path": "src/main/java/com/assessment/ratelimiter/service/TokenBucketStrategy.java",
  "content": "package com.assessment.ratelimiter.service; ...",
  "contentHash": "9b12c8e5a4f7",
  "timestamp": 1728302010400
}
```

---

### 2.3. Запрос на прогон тестов платформы (Platform Verify Trigger)

#### От моста к браузеру (например, по нажатию `Ctrl+Enter` в терминале моста):
```json
{
  "type": "TRIGGER_PLATFORM_VERIFY",
  "challengeId": "mc_rate_limiter_token_bucket",
  "timestamp": 1728302015000
}
```

---

### 2.4. Сердцебиение (Heartbeat)

Каждые 15 секунд браузер отправляет:
```json
{ "type": "PING", "timestamp": 1728302020000 }
```
Мост отвечает:
```json
{ "type": "PONG", "timestamp": 1728302020002 }
```

---

## 3. Алгоритм предотвращения циклов (EchoGuard & Hash Fence)

Чтобы исключить эффект пинг-понга (когда изменение в IDE шлётся в веб, веб обновляет стейт, шлёт обратно в мост, мост пишет на диск и снова шлёт в веб), реализуется двухуровневая защита:

```
[Изменение файла]
       │
       ▼
 [Вычисление хэша H]
       │
       ├─► Если H == currentInMemoryHash ──► [ОТБРОСИТЬ (No-Op)]
       │
       ├─► Если H присутствует в inFlightWrites (TTL 800ms) ──► [ОТБРОСИТЬ (EchoGuard)]
       │
       ▼
 [Регистрация H в кэше]
       │
       ▼
 [Эмиссия события дальше]
```

### 3.1. Дебаунсинг файлового вотчера
При рефакторинге в IntelliJ IDEA (например, `Rename` класса) IDE может перезаписать 5 файлов за 15 мс. 
* Вотчер в `bridge.mjs` накапливает изменения в течение **120 мс (trailing debounce)**.
* После истечения таймаута пачка изменённых файлов отправляется одним компактным массивом или последовательностью единичных событий без спама сокета.

---

## 4. Обработка обрыва связи и переподключения

1. Фронтенд использует автоматический экспоненциальный retry:
   $T_{\text{retry}} = \min(5000, 1000 \times 1.5^{\text{attempt}})$.
2. Если `bridge.mjs` перезапущен пользователем, переподключение происходит автоматически в течение 1 секунды.
3. При восстановлении связи выполняется повторное рукопожатие `HANDSHAKE_INIT`, и более свежая версия кода (по `timestamp` и `contentHash`) становится актуальной.
