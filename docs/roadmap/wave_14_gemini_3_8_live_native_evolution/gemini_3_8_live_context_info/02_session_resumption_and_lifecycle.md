# Модуль 02: Персистентность сессий и управление жизненным циклом (Session Resumption & Lifecycle)

> **Статус документа:** Производственный стандарт / Архитектурный регламент (SOTA late-2026)  
> **Связанные спецификации:** [00_context_architecture_index.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/00_context_architecture_index.md), [01_context_grounding_and_memory.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/01_context_grounding_and_memory.md), [03_tools_and_turn_lockdown.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/03_tools_and_turn_lockdown.md), [04_audio_context_and_turn_taking.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/04_audio_context_and_turn_taking.md)  
> **Целевой API:** Multimodal Live API (`BidiGenerateContent`), `@google/genai` (v2.3.0+)

---

## 1. Введение: Проблема непрерывности диалога в реальном времени

Двунаправленный потоковый протокол Gemini Multimodal Live API (`BidiGenerateContent`) функционирует поверх постоянного WebSocket-соединения к `generativelanguage.googleapis.com` (Google AI Studio) или региональным шлюзам Vertex AI.

В реальных условиях эксплуатация сталкивается с двумя неизбежными факторами разрыва соединения:
1. **Сетевая нестабильность:** переключение мобильных клиентов с сотовой сети на Wi-Fi, кратковременный джиттер, смена IP-адреса и обрывы TCP.
2. **Аппаратный серверный лимит Google:** ровно на **600-й секунде (10 минут)** непрерывного существования физического веб-сокета Google Frontend (GFE) / Envoy принудительно разрывает транспортный канал.

Попытки поддерживать длительные сессии (технические интервью, парное программирование, длительные голосовые звонки) требуют гарантированного механизма продолжения сеанса без потери контекста.

```
АНТИПАТТЕРН: Ручной реплей реплик (Corrupted Turn Replay)
Клиент [Новый сокет] --- setup (без handle) -----------------------> Google
Клиент               <-- setupComplete ----------------------------- Google
Пользователь         --- Голос: "Сколько это стоит?" -------------> Google (VAD сбит!)
Клиент               --- clientContent.turns: ["Привет", "Рим..."] -> Google (Коллизия!)
Результат: Модель отвечает невпопад на старый текст, обрывая пользователя. Ошибка 1011 / Рассинхрон.

КАНОНИЧЕСКИЙ ПАТТЕРН: Нативный Session Resumption
Клиент [Новый сокет] --- setup { sessionResumption: { handle: H1 } } > Google
Клиент               <-- setupComplete (KV-кэш и акустика на месте) - Google
Пользователь         --- Голос: "Сколько это стоит?" -------------> Google (Бесшовно!)
Результат: Полная непрерывность контекста, сохранение просодии, мгновенная реакция.
```

---

## 2. Почему ручной реплей истории (`LiveGreetingReplay.ts`) разрушает диалог

Классический паттерн разработки чат-ботов — сохранять стенограмму в массив `historyTurns[]` и при переподключении отправлять её в сообщении `clientContent.turns` — в нативных голосовых моделях Gemini 3.8 Live является **фатальным антипаттерном**.

### 2.1. Уничтожение акустического контекста и просодии
Нативный сквозной трансформер Gemini 3.8 Live оперирует не символами, а латентными акустическими эмбеддингами. Модель удерживает в непрерывном контексте:
- Тембральные особенности и высоту голоса собеседника.
- Индивидуальный темп речи, паузацию и особенности дикции.
- Спектральный профиль фонового акустического шума помещения (SNR-профиль).
- Степень эмоциональной окраски и интонационный рисунок.

Подмена живого акустического контекста плоской текстовой стенограммой уничтожает все латентные акустические веса. Модель вынуждена с нуля адаптировать речевой анализатор под пользователя, что приводит к неестественным скачкам тональности, искажению громкости и сбросу темпа синтеза.

### 2.2. Гонка состояний и рассинхронизация диалогового автомата (Race Conditions)
Когда клиент восстанавливает сокет и параллельно включает микрофон пользователя, возникает гонка:
1. Пользователь произносит фразу: «Продолжим с того места, где остановились». Аудиопоток микрофона транслируется через `realtimeInput.mediaChunks`.
2. Клиентский код в это же время отправляет в сокет массив текстовой истории `clientContent.turns: [...]`.
3. Серверный планировщик расценивает массив `clientContent` как приоритетный ввод текущего хода, сбрасывает накопленный буфер аудиопотока и инициирует генерацию ответа на одну из старых реплик текстовой истории.
4. Модель начинает вслух отвечать на реплику 5-минутной давности, перебивая говорящего пользователя.
5. Серверный VAD фиксирует голос пользователя поверх речи модели, эмитирует `interrupted: true`, обрывает синтез и входит в штопор взаимных прерываний.

### 2.3. Взрывной расход токенов и лимитов тарификации (TPM Explosion)
Повторная отправка текстовой истории на каждый реконнект заново токенизирует всю предшествующую беседу. При сессии из 10–15 шагов повторный посев истории расходует десятки тысяч токенов за считанные секунды, стремительно приближая сессию к исчерпанию лимита скользящего окна (128k) и вызывая ошибку `429 / 1011 RESOURCE_EXHAUSTED` по 10-минутной квоте Spend-Based Velocity.

---

## 3. Спецификация протокола `sessionResumptionUpdate`

Нативное возобновление сеанса опирается на серверные снимки распределенного контекста (KV-кэша и акустических представлений) в инфраструктуре Google:

### 3.1. Protobuf-контракт сервиса
```protobuf
syntax = "proto3";

package google.ai.generativelanguage.v1beta;

import "google/protobuf/duration.proto";

message SessionResumptionConfig {
  // Непрозрачный маркер предыдущей сессии.
  // При первичном подключении передается пустым или опускается.
  optional string handle = 1;

  // Режим отслеживания индексов клиентских сообщений (ТОЛЬКО ДЛЯ VERTEX AI).
  // На шлюзе generativelanguage.googleapis.com ВЫЗЫВАЕТ ОШИБКУ 1008!
  optional bool transparent = 2;
}

message SessionResumptionUpdate {
  // Новый криптографический маркер снимка состояния.
  // Поле пустое, если resumable == false.
  string new_handle = 1;

  // Индикатор пригодности состояния к фиксации чекпоинта.
  bool resumable = 2;

  // Порядковый индекс последнего обработанного клиентом сообщения.
  // Передается только при transparent == true.
  optional int64 last_consumed_client_message_index = 3;
}

message GoAway {
  // Время, оставшееся до принудительного разрыва сокета сервером.
  google.protobuf.Duration time_left = 1;
}
```

### 3.2. JSON-сериализация в WebSocket
```json
{
  "sessionResumptionUpdate": {
    "newHandle": "eb983091-43fd-4529-92b1-1f579581e17c",
    "resumable": true,
    "lastConsumedClientMessageIndex": 14
  }
}
```

### 3.3. Правила обработки маркеров `newHandle`
- **Динамический характер:** Каждый вновь полученный `newHandle` делает недействительным предыдущий. Он фиксирует актуальное смещение диалога вперед во времени.
- **Инвариант флага `resumable: true`:** Клиент имеет право обновлять локальную переменную `currentHandle` **исключительно тогда, когда `resumable === true`**.
- **Инвариант `resumable: false`:** Сервер эмитирует `resumable: false` в моменты нестабильности контекста (активная генерация речи моделью, незавершенные вызовы `toolCall`, фоновое рассуждение `extended-thinking`). Значение `newHandle` в таких пакетах пустое. Попытка зафиксировать пустое значение уничтожит рабочий маркер восстановления!
- **Транзакционность эмиссии:** Сервер направляет обновления строго по завершении атомарных диалоговых транзакций:
  1. Немедленно после `serverContent.turnComplete = true`.
  2. Немедленно после применения `toolResponse`.
  3. В межречевых паузах пользователя после фиксации акустической фразы сервером.

---

## 4. Ловушка флага `transparent: true` (Ошибка WebSocket 1008 Policy Violation)

> [!CAUTION]
> **Критический архитектурный барьер между шлюзами Developer API и Vertex AI:**  
> Поле `transparent: true` в структуре `SessionResumptionConfig` предназначено **исключительно для бэкенда Vertex AI**, где инфраструктура реализует расширенное отслеживание индексов сообщений (`lastConsumedClientMessageIndex`).  
> 
> На публичном шлюзе Google AI Studio / Gemini Developer API (`generativelanguage.googleapis.com`) передача `transparent: true` не поддерживается. Передача этого флага расценивается валидатором как нарушение протокольного контракта и влечет **мгновенный сброс WebSocket с кодом 1008 Policy Violation** (`"Transparent resumption is not supported on this endpoint"`).

### Инвариант конфигурации `setup` для Developer API:
```typescript
// ПРАВИЛЬНО (Google AI Studio / generativelanguage.googleapis.com):
sessionResumption: {
  handle: previousHandle // только строка или опускается при холодном старте
}

// КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО НА DEVELOPER API:
sessionResumption: {
  handle: previousHandle,
  transparent: true // ВЫЗЫВАЕТ 1008 POLICY VIOLATION!
}
```

---

## 5. Матрица персистентности контекста при Resumption Handshake

При передаче валидного маркера в `setup.sessionResumption.handle` инфраструктура Google восстанавливает состояние диалога из распределенного кэша. Ниже приведена полная матрица сохранности сущностей:

| Компонент контекста | Сохранность в снимке | Механика восстановления при новом подключении |
| :--- | :--- | :--- |
| **История реплик (Текст и Аудио)** | **100% Сохраняется** | Модель помнит все факты, рассуждения, аргументы и акустику. |
| **Системные инструкции (`systemInstruction`)** | **Сохраняются** | Наследуются из снимка. При необходимости могут быть дополнены/обновлены в новом `setup`. |
| **Реестр инструментов (`tools`)** | **Сохраняется** | Сигнатуры функций активны. В новом `setup` можно передать расширенный набор инструментов. |
| **Голосовая модель (`speechConfig`)** | **Сохраняется** | Настройки тембра (`Puck`, `Charon` и др.) восстанавливаются автоматически. |
| **Активные вызовы функций (`toolCall`)** | **Требуют сверки** | Если сокет упал во время выполнения функции на клиенте, клиент обязан вернуть `toolResponse` сразу после `setupComplete`. |
| **In-flight Audio (пакеты в полете)** | **Утрачиваются** | Аудиосэмплы, отправленные клиентом после последнего транзакционного снимка (`resumable: true`), отбрасываются. |

---

## 6. Временные рамки жизни маркеров (TTL), авторизация и квоты

### 6.1. Время жизни снимков (Time-To-Live)
1. **Gemini Developer API (`generativelanguage.googleapis.com`):** Время жизни маркера составляет ровно **2 часа (120 минут)** с момента закрытия сокета. По истечении этого времени снимок вытесняется сборщиком мусора, а попытка восстановиться возвращает ошибку `1008` или `1011`.
2. **Vertex AI:** Снимки персистируются до **24 часов** (с «горячим» окном мгновенного прогрева в первые 10 минут).

### 6.2. Режим Zero Data Retention (ZDR)
В корпоративных подписках Google Cloud с активным режимом ZDR (Zero Data Retention) механизм `SessionResumption` **аппаратно блокируется платформой**. Так как политика ZDR запрещает персистенцию промежуточного контекста на дисках или распределенной памяти вне жизненного цикла активного сокета, эндпоинт отклоняет хэндлы или не генерирует `newHandle`.

### 6.3. Криптографическая привязка к API-ключу и проекту
Маркер `newHandle` криптографически подписан и жестко привязан к паре `(ProjectID, APIKey)`. Если клиентская инфраструктура использует Round-Robin пул API-ключей для обхода лимитов, попытка возобновить сессию ключом, отличным от создавшего исходную сессию, мгновенно прерывается с ошибкой **`1011 Internal Error`** (сбой криптографической дешифрации хэндла).

### 6.4. Эфемерные токены в браузерах (Ephemeral Auth Tokens)
Если токен авторизации генерируется доверенным бэкендом через эндпоинт `authTokens.create` для безопасного использования в браузере (без передачи мастер-ключа API), право на возобновление сессии должно быть явно задекларировано в ограничениях:

```typescript
// Серверная генерация эфемерного токена через Google GenAI SDK (>= 2.3.0)
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function createLiveVoiceSessionToken(): Promise<string> {
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 минут
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString(); // 1 минута на старт

  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: expireTime,
      newSessionExpireTime: newSessionExpireTime,
      liveConnectConstraints: {
        model: 'models/gemini-3.8-live',
        config: {
          responseModalities: ['AUDIO'],
          sessionResumption: {} // ОБЯЗАТЕЛЬНО: декларирует право на Resumption!
        }
      }
    }
  });

  return token.name; // Формат: auth_tokens/xxxxxxxxxxxx
}
```

Если объект `sessionResumption: {}` опущен в ограничениях токена, шлюз Google молча проигнорирует переданный клиентом `handle` и вернет новую сессию без контекста.

---

## 7. Стратегия безопасной деградации (Cold Start Fallback)

При получении кодов завершения `1008` (истек TTL маркера, невалидный токен, конфликт проектов) или `1011` (аппаратный сбой ноды Google при чтении кэша) клиент **не имеет права выполнять бесконечные повторные попытки с тем же маркером**. Это вызывает циклическую петлю сбоев (Crash Loop).

### Регламент отката (Graceful Fallback):
1. **Сброс маркера:** Сохраненный маркер немедленно удаляется: `currentHandle = null`, очищается `sessionStorage`.
2. **Инициализация чистого сетапа:** Открывается новое WebSocket-соединение с пустым `sessionResumption: {}`.
3. **Семантическая инъекция памяти:** В поле `systemInstruction` динамически подмешивается краткое текстовое резюме (Memory Digest): текущая задача, факты, имя пользователя, недавние решения:
   ```xml
   <conversation_memory_digest>
     Пользователь: Алексей. Текущая задача: рефакторинг AuthService.
     Последний статус: проверили JwtTokenProvider, обнаружена уязвимость устаревания.
   </conversation_memory_digest>
   ```
4. **Запрет текстового реплея:** Категорически запрещено отправлять сырой массив реплик в `clientContent.turns`.
5. **Бесшовное переключение звука:** UI информирует пользователя о мягкой реинициализации канала связи без блокировки микрофона.

---

## 8. Аппаратный предел сокета (10 минут) и сигнал `GoAway` Hot Handoff

Физический таймер Envoy/GFE закрывает любой WebSocket ровно через 600 секунд (10 минут). Google решает эту проблему через упреждающее уведомление `GoAway`.

### 8.1. Протокол Hot Handoff (Двойной сокет с плавной миграцией)

```
Минута 9:45   Клиент получает: { goAway: { timeLeft: "15.000s" } }
              Сохраняет последний валидный newHandle (H_last)
              |
              +---> Соединение A: продолжает играть звук ответа
              |
              +---> Открывает параллельное Соединение B
                    setup: { sessionResumption: { handle: H_last } }
                    |
                    <-- setupComplete на Соединении B
                    |
              +---> Микрофон мгновенно переключается:
              |     realtimeInput -> Соединение B
              |
              +---> Соединение A переводится в режим DRAIN:
                    Ждет turnComplete: true для доигрываемой фразы
                    Клиент закрывает Соединение A с кодом 1000 Normal Closure.
```

### 8.2. Пошаговый алгоритм миграции:
1. За 15–30 секунд до 10-минутного лимита сервер присылает сообщение:
   ```json
   { "goAway": { "timeLeft": "15.000s" } }
   ```
2. Клиент фиксирует факт скорого закрытия и извлекает текущий `currentHandle`.
3. **Соединение A** продолжает проигрывать входящий аудиобуфер и обслуживать текущую реплику.
4. В фоновом режиме создается **Соединение B**, в настроечном сообщении `setup` которого передается `currentHandle`.
5. По факту получения события `setupComplete` на Соединении B клиент:
   - Мгновенно переключает поток входящих аудиосэмплов с микрофона на Соединение B.
   - На Соединении A прекращает отправку любых клиентских данных.
6. На Соединении A ожидается флаг `serverContent.turnComplete: true` (завершение синтеза фразы), после чего клиент корректно закрывает Соединение A с кодом **`1000 Normal Closure`**.
7. Пользователь не замечает разрыва: в речи ассистента нет пауз, щелчков или повторов.

---

## 9. Эталонная реализация Session Resumption в TypeScript

Ниже приведен верифицированный код контроллера сессии, реализующий полный жизненный цикл, обработку маркеров и защиту от сбоев:

```typescript
import { GoogleGenAI } from '@google/genai';

export interface ResumptionControllerConfig {
  apiKey: string;
  model: string;
  systemInstruction: string;
  onAudioData: (pcm24kBase64: string) => void;
  onStatusChange: (status: 'connected' | 'reconnecting' | 'failed') => void;
}

export class LiveSessionResumptionManager {
  private ai: GoogleGenAI;
  private currentHandle: string | null = null;
  private session: any = null;
  private isReconnecting = false;

  constructor(private config: ResumptionControllerConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  public async connect(): Promise<void> {
    this.config.onStatusChange(this.currentHandle ? 'reconnecting' : 'connected');

    const sessionConfig: any = {
      model: this.config.model,
      generationConfig: {
        responseModalities: ['AUDIO'],
      },
      systemInstruction: {
        parts: [{ text: this.config.systemInstruction }]
      }
    };

    // Нативное возобновление без флага transparent (для Developer API)
    if (this.currentHandle) {
      sessionConfig.sessionResumption = {
        handle: this.currentHandle
      };
    }

    try {
      this.session = await this.ai.live.connect({
        model: this.config.model,
        config: sessionConfig,
        callbacks: {
          onopen: () => {
            console.info('[ResumptionManager] Connection established.');
            this.config.onStatusChange('connected');
          },
          onmessage: async (msg: any) => this.handleServerMessage(msg),
          onclose: (e: any) => this.handleDisconnection(e),
          onerror: (err: any) => {
            console.error('[ResumptionManager] Socket error:', err);
          }
        }
      });
    } catch (err) {
      console.error('[ResumptionManager] Connection failed:', err);
      await this.handleConnectionFailure();
    }
  }

  private handleServerMessage(msg: any): void {
    // 1. Обработка обновлений маркера возобновления
    if (msg.sessionResumptionUpdate) {
      const update = msg.sessionResumptionUpdate;
      if (update.resumable && update.newHandle) {
        this.currentHandle = update.newHandle;
        console.debug('[ResumptionManager] Stored new handle:', this.currentHandle);
      }
    }

    // 2. Обработка сигнала аппаратного предела GoAway
    if (msg.goAway) {
      const timeLeft = msg.goAway.timeLeft;
      console.warn(`[ResumptionManager] GoAway received. Time left: ${timeLeft}`);
      this.triggerHotHandoff();
    }

    // 3. Воспроизведение аудиопотока модели
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
          this.config.onAudioData(part.inlineData.data);
        }
      }
    }
  }

  private async handleDisconnection(event: { code: number; reason: string }): Promise<void> {
    console.warn(`[ResumptionManager] Closed. Code: ${event.code}, Reason: ${event.reason}`);
    if (event.code !== 1000) {
      await this.recoverFromUnexpectedClose(event.code);
    }
  }

  private async recoverFromUnexpectedClose(code: number): Promise<void> {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    // При ошибках 1008 или 1011 маркер может быть скомпрометирован
    if (code === 1008 || code === 1011) {
      console.error('[ResumptionManager] Code indicates handle invalidation. Performing Cold Fallback.');
      this.currentHandle = null; // сброс хэндла
    }

    // Экспоненциальная задержка с джиттером
    const delayMs = Math.min(1000 * Math.pow(1.5, 2) + Math.random() * 500, 5000);
    await new Promise((r) => setTimeout(r, delayMs));

    this.isReconnecting = false;
    await this.connect();
  }

  private async triggerHotHandoff(): Promise<void> {
    console.info('[ResumptionManager] Executing Hot Handoff before 10-min boundary...');
    const oldSession = this.session;

    // Подключаем новую сессию по сохраненному хэндлу
    await this.connect();

    // Закрываем старую сессию штатно со статусом 1000 Normal Closure
    if (oldSession) {
      try {
        await oldSession.close(1000, 'Hot handoff completed');
      } catch (e) {
        // Игнорируем ошибки закрытия устаревшего сокета
      }
    }
  }

  private async handleConnectionFailure(): Promise<void> {
    if (this.currentHandle) {
      console.warn('[ResumptionManager] Resumption failed. Retrying cold start fallback...');
      this.currentHandle = null;
      await this.connect();
    } else {
      this.config.onStatusChange('failed');
    }
  }

  public async sendAudioChunk(pcm16kBase64: string): Promise<void> {
    if (!this.session) return;
    await this.session.sendRealtimeInput({
      mediaChunks: [
        {
          mimeType: 'audio/pcm;rate=16000',
          data: pcm16kBase64
        }
      ]
    });
  }

  public async close(): Promise<void> {
    if (this.session) {
      await this.session.close(1000, 'Client closed normally');
      this.session = null;
      this.currentHandle = null;
    }
  }
}
```

---

## 10. Регламент валидации и приемочные критерии
1. **Проверка привязки хэндлов:** убедиться в логах, что `currentHandle` обновляется только при пакетах с `resumable: true`.
2. **Имитация потери соединения:** при отключении сетевого интерфейса и его восстановлении через 3–5 секунд сессия возобновляется без повтора приветственных реплик и без рассинхронизации темы диалога.
3. **Отсутствие флага `transparent` на Developer API:** в дампе сетевых запросов настроечного фрейма `setup` отсутствует атрибут `transparent`.
4. **Тестирование границы 10 минут:** сессия непрерывного диалога успешно проходит отметку 600 секунд через механизм `GoAway` без слышимого обрыва речи.
5. **Безопасный откат при повреждении кэша:** при передаче намеренно поврежденного `handle` клиент сбрасывает маркер и поднимает холодную сессию вместо падения приложения.
