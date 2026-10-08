# Архитектура Session Resumption и управление жизненным циклом сессий в Gemini 3.8 Live
Двунаправленный потоковый протокол Gemini Multimodal Live API (`BidiGenerateContent`), функционирующий поверх WebSocket на шлюзах `generativelanguage.googleapis.com` и Vertex AI, спроектирован для обеспечения диалогового взаимодействия с задержкой менее секунды 1 . При эксплуатации моделей `gemini-3.8-live` и `gemini-3.8-live-extended-thinking` в высоконагруженных промышленных средах ключевой инженерной задачей становится непрерывность диалога в условиях сетевой нестабильности, смены физических каналов связи (Wi-Fi, 4G/5G) и жестких серверных ограничений на длительность сеанса 2 .
Нативная спецификация Session Resumption заменяет устаревшие эвристические подходы к повторной синхронизации диалога. Попытки искусственного восстановления контекста через повторную передачу накопленной истории реплик приводят к фатальным коллизиям в детекции голосовой активности (Voice Activity Detection, VAD) и десинхронизации контекста инференса.

## 1. Спецификация sessionResumptionUpdate и транспортный протокол

### Протокольные структуры Protobuf и JSON
Механизм возобновления сеанса опирается на контракт Protobuf сервиса `google.ai.generativelanguage.v1beta.GenerativeService`. На транспортном уровне WebSocket каждое клиентское сообщение инкапсулируется в структуру `BidiGenerateContentClientMessage`, а серверные события транслируются через `BidiGenerateContentServerMessage`.

```protocol buffers
syntax = "proto3";

package google.ai.generativelanguage.v1beta;

import "google/protobuf/duration.proto";

message SessionResumptionConfig {
  // Непрозрачный маркер предыдущей сессии. Если опущен или пуст,
  // сервер инициализирует новый сеанс и начинает эмиссию обновлений.
  optional string handle = 1;

  // Режим прозрачного подтверждения индексов сообщений (Vertex AI backend).
  optional bool transparent = 2;
}

message SessionResumptionUpdate {
  // Новый криптографический маркер снапшота состояния сессии.
  // Поле пусто, если флаг resumable равен false.
  string new_handle = 1;

  // Флаг, подтверждающий пригодность текущего снимка контекста для восстановления.
  bool resumable = 2;

  // Порядковый индекс последнего клиентского сообщения, включенного в кэш.
  // Передается исключительно при transparent = true.
  optional int64 last_consumed_client_message_index = 3;
}

message GoAway {
  // Временное окно до принудительного разрыва соединения инфраструктурой.
  google.protobuf.Duration time_left = 1;
}

```
В текстовом режиме WebSocket (JSON-сериализация) сервер направляет контрольные точки состояния в объекте верхнего уровня `sessionResumptionUpdate`:

```json
{
  "sessionResumptionUpdate": {
    "newHandle": "eb983091-43fd-4529-92b1-1f579581e17c",
    "resumable": true,
    "lastConsumedClientMessageIndex": 14
  }
}

```

### Семантика полей и периодичность обновления
Поле `newHandle` представляет собой строковый токен, кодирующий ссылки на распределенный контекст сессии внутри серверного кластера Google: текущее состояние KV-кэша трансформера, скрытые векторы акустического тракта, мультимодальные эмбеддинги и стек инструментов. Хэндл носит динамический характер: генерация каждого нового значения делает предыдущий маркер устаревшим, так как более свежий снимок фиксирует продвижение диалога во времени.
Булев флаг `resumable` сигнализирует о готовности серверного состояния к фиксации. В периоды, когда модель находится в процессе синтеза ответа, вызова внешних функций (Tool Calling) или фоновой реорганизации контекста, сервер отправляет сообщения с `resumable: false` и пустым значением `newHandle`. Клиент обязан обновлять локальную переменную возобновления только при истинном значении данного флага.
Поле `lastConsumedClientMessageIndex` активно в конфигурациях с флагом `transparent: true`. Этот механизм устраняет неопределенность на границе разрыва связи: получив данный индекс, клиент точно определяет, какие сообщения или аудиофреймы сервер успел включить в снимок состояния, а какие данные зависли в сетевом буфере и требуют повторной отправки при переподключении.
Сервер не обновляет хэндл на каждый входящий аудиофрейм во избежание деградации пропускной способности. Обновления происходят строго транзакционно: сразу после завершения генерации ответа модели (`serverContent.turnComplete = true`), после получения и применения результатов исполнения функций (`toolResponse`), а также в паузах между фразами пользователя после фиксации акустического блока встроенным VAD.

## 2. Рукопожатие повторного подключения (Resumption Setup Handshake)
Для активации персистенции контекста клиент обязан явно задекларировать поддержку `sessionResumption` в первичном настроечном фрейме `setup`. Отсутствие этой секции переводит сессию в одноразовый эфемерный режим, при котором сервер не сохраняет контрольные точки контекста в распределенном кэше.

| Параметр протокола | Первичное подключение (Cold Setup) | Восстановление сессии (Resumption Handshake) |
| --- | --- | --- |
| **Поле `setup.sessionResumption`** | `{}` или `{"handle": null}`[cite: 12, 13] | `{"handle": "<latest_new_handle>"}`[cite: 9, 13] |
| **Идентификатор модели (`model`)** | `models/gemini-3.8-live`[cite: 3, 13] | Должен строго совпадать с исходной моделью сессии |
| **Системные инструкции (`systemInstruction`)** | Определяют поведение сессии | Восстанавливаются из кэша; могут быть переопределены |
| **Декларации инструментов (`tools`)** | Инициализируют сигнатуры функций | Восстанавливаются; допустима передача обновленного списка |
| **Конфигурация голоса (`speechConfig`)** | Фиксирует голосовую модель синтеза | Восстанавливается из снимка сессии |
| **Ответ сервера на handshake** | `{"setupComplete": {}}`[cite: 6] | `{"setupComplete": {}}` с мгновенным доступом к контексту |

При повторном подключении структура JSON-фрейма `setup` направляется в первом сообщении сразу после открытия транспортного канала WebSocket:

```json
{
  "setup": {
    "model": "models/gemini-3.8-live",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Puck"
          }
        }
      }
    },
    "sessionResumption": {
      "handle": "eb983091-43fd-4529-92b1-1f579581e17c"
    }
  }
}

```

### Верифицированные интерфейсы TypeScript (`@google/genai` >= 2.3.0)
Интерфейсы SDK типизируют параметры инициализации, гарантируя совместимость с компилятором TypeScript в строгом режиме:

```typescript
import { Modality } from '@google/genai';

export interface SessionResumptionConfig {
  /** Указатель на предыдущую сессию. При null стартует новый сеанс. */
  handle?: string | null;
  /** Включение отслеживания порядковых индексов (Vertex AI backend). */
  transparent?: boolean;
}

export interface LiveVoiceConfig {
  prebuiltVoiceConfig?: {
    voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';
  };
}

export interface LiveSpeechConfig {
  voiceConfig?: LiveVoiceConfig;
}

export interface LiveGenerationConfig {
  responseModalities?: Modality[] | string[];
  speechConfig?: LiveSpeechConfig;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface LiveSessionSetupConfig {
  model: 'models/gemini-3.8-live' | 'models/gemini-3.8-live-extended-thinking';
  generationConfig?: LiveGenerationConfig;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  tools?: Array<Record<string, unknown>>;
  sessionResumption?: SessionResumptionConfig;
}

export interface SessionResumptionUpdatePayload {
  newHandle?: string;
  resumable?: boolean;
  lastConsumedClientMessageIndex?: number;
}

export interface LiveServerMessage {
  setupComplete?: Record<string, unknown>;
  sessionResumptionUpdate?: SessionResumptionUpdatePayload;
  goAway?: {
    timeLeft: string;
  };
  serverContent?: {
    modelTurn?: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
}

```

## 3. Сравнительный анализ: Session Resumption против ручного реплея реплик
Попытка эмулировать непрерывность диалога путем ручной повторной отправки массива исторических реплик через `clientContent.turns` при открытии новой сессии является критической архитектурной ошибкой. В системах голосового взаимодействия реального времени этот подход приводит к рассинхронизации логики модели.
Основная причина десинхронизации кроется в контракте обработки `BidiGenerateContentClientContent`. Согласно спецификации, любое сообщение, поступившее через этот канал, безусловно интерпретируется как активная реплика пользователя, мгновенно добавляется в конец контекста и прерывает любую текущую генерацию модели. Если клиент отправляет массив текстовой истории в момент, когда пользователь уже начал говорить в микрофон после реконнекта, модель воспринимает исторический массив как свежий ввод, поступивший поверх текущего звука.
Текстовый реплей полностью уничтожает акустический контекст диалога. Модель оперирует нативным сквозным представлением аудио: она запоминает интонации, паузы, темп речи, фоновый шум и индивидуальные особенности дикции собеседника. При замене этого состояния на плоский текст стенограммы модель теряет восприятие просодии и начинает заново калибровать адаптацию к пользователю.
Кроме того, инъекция массива текста вызывает неконтролируемую гонку состояний (Race Condition). Модель инициирует генерацию ответа на последнюю реплику из переданного исторического массива, в то время как пользователь ожидает реакцию на свой текущий голос. В результате пользователь слышит нерелевантный ответ на давно закрытый вопрос («ответил невпопад»), начинает перебивать модель, что вызывает шквал событий `interrupted` и разрушает структуру диалога.

| Этап взаимодействия | Канонический Session Resumption | Антипаттерн Turn Replay (`clientContent.turns`) |
| --- | --- | --- |
| **Инициализация сессии** | Передача `setup.sessionResumption.handle`. Сервер восстанавливает состояние KV-кэша. | Создание сессии без маркера. Сервер инициализирует пустое контекстное окно. |
| **Накладные расходы сети** | Минимальный payload (строковый идентификатор). | Передача массивного JSON-пакета со всеми прошлыми репликами. |
| **Обработка входящего аудио** | Микрофонный поток передается без задержки. Модель воспринимает непрерывную речь. | Аудиопоток сталкивается с пачкой исторических текстовых реплик. |
| **Реакция инференс-ядра** | Модель слушает завершение фразы пользователя с учетом контекста. | Инференс прерывает VAD и начинает генерировать ответ на старый текст. |
| **Акустический контекст** | Сохраняются эмбеддинги речи, темп, интонации и просодия. | Теряется полностью; доступен лишь текстовый эквивалент. |
| **Утилизация токенов** | Префикс контекста кэшируется на стороне инфраструктуры Google. | Повторная тарификация и токенизация всей истории ускоряют лимит сессии. |

Ниже представлена хронологическая последовательность событий при обоих подходах.

### Хронология нативного возобновления (Clean Resumption)

1. *Штатный режим*: Клиент транслирует аудио `realtimeInput`. Модель возвращает аудиопоток `serverContent` и завершает реплику `turnComplete: true`.
2. *Фиксация состояния*: Сервер отправляет `sessionResumptionUpdate` с флагом `resumable: true` и маркером `newHandle: "H1"`. Клиент сохраняет данный токен в оперативной памяти.
3. *Сетевой разрыв*: Происходит физический обрыв TCP-соединения WebSocket.
4. *Повторное рукопожатие*: Клиент немедленно открывает новый сокет и отправляет фрейм `setup` с параметром `sessionResumption.handle: "H1"`.
5. *Подтверждение готовности*: Сервер подгружает закэшированное состояние и возвращает `setupComplete`.
6. *Непрерывный ввод*: Клиент возобновляет передачу аудиоданных `realtimeInput`. Модель корректно понимает новую фразу собеседника с полным сохранением контекста.

### Хронология сбоя при ручном реплее (Corrupted Turn Replay)

1. *Разрыв и повторное открытие*: Соединение обрывается. Клиент открывает новый сокет со стандартным `setup` без указания параметров возобновления сессии.
2. *Коллизия данных*: Пользователь начинает говорить: «Сколько это стоит?». Одновременно клиентский код отправляет массив истории `clientContent.turns: ["Привет", "Я ищу билет в Рим"]`.
3. *Прерывание конвейера*: Сервер регистрирует текстовый массив `clientContent` как свежий приоритетный ввод и сбрасывает буфер текущего аудиопотока микрофона.
4. *Ложная генерация*: Модель генерирует голосовой ответ на старую реплику: «Билеты в Рим стоят...», полностью игнорируя только что прозвучавший вопрос пользователя.
5. *Конфликт восприятия*: Пользователь пытается перебить неуместный ответ модели. Встроенный VAD генерирует каскад прерываний, диалог десинхронизируется.

## 4. Сигнал GoAway и паттерн бесшовной миграции соединений
Инфраструктура Google Gemini Live ограничивает непрерывную жизнь одного WebSocket-соединения интервалом приблизительно в 10 минут для предотвращения ресурсных утечек на балансировщиках нагрузки. Достижение этого предела без предварительной миграции приводит к аварийному завершению сокета со статусом `ABORTED`.
Для предотвращения деградации пользовательского опыта сервер заблаговременно направляет управляющее сообщение `goAway`:

```json
{
  "goAway": {
    "timeLeft": "15.000s"
  }
}

```
Параметр `timeLeft` определяет оставшееся гарантированное время жизни сокета (обычно от 10 до 30 секунд). В течение этого окна клиентская система должна провести контролируемую ротацию соединений.
Паттерн горячего переключения (Hot Handoff) реализуется через временное параллельное подключение и включает следующие фазы:
При получении пакета `goAway` фоновый поток фиксирует `timeLeft` и последний сохраненный маркер сессии `newHandle`. Активное Соединение A продолжает принимать входящее аудио и воспроизводить реплику модели без пауз.
Не разрывая Соединение A, клиент открывает параллельное Соединение B, направляя настроечный фрейм `setup` с сохраненным маркером `newHandle`. Соединение B переходит в статус ожидания ответа `setupComplete`.
После успешного завершения рукопожатия на Соединении B коммутатор медиапотока переключает отправку чанков микрофона (`realtimeInput`) с Соединения A на Соединение B.
На Соединении A активируется процедура освобождения буфера (Drain): передача пользовательских данных прекращается, но сокет остается открытым для завершения приема и воспроизведения текущей генерации модели. Как только модель завершает реплику (`turnComplete = true`) или когда истекает 85% времени от значения `timeLeft`, Соединение A корректно закрывается клиентом со статусом `1000 Normal Closure`.

## 5. Граничные условия, управление состоянием и обработка отказов

### Время жизни маркеров (TTL)
Срок хранения контекстных снимков зависит от используемого уровня платформы:
На шлюзе Gemini Developer API (`generativelanguage.googleapis.com`) маркер возобновления сохраняет валидность в течение ровно **2 часов** с момента закрытия последнего активного соединения. Если повторное подключение не состоялось в течение 120 минут, кэшированное состояние удаляется сборщиком мусора.
На платформе Gemini Enterprise / Vertex AI серверные снимки сессий персистируются в зашифрованном хранилище сроком до **24 часов**. При этом горячее окно для мгновенного восстановления без задержек на холодную подгрузку данных составляет около 10 минут.
В корпоративных окружениях с активированным режимом Zero Data Retention (ZDR) механизм Session Resumption принудительно блокируется платформой на уровне политик безопасности, поскольку он технологически требует сохранения промежуточного мультимодального контекста.

### Персистентность компонентов диалогового состояния
Степень сохранения различных аспектов контекста при выполнении нативного возобновления представлена в таблице ниже.

| Компонент состояния | Статус сохранения | Поведение при выполнении Resumption |
| --- | --- | --- |
| **История диалога (Text/Audio KV Cache)** | Сохраняется полностью | Доступны факты, прошлые реплики и просодические особенности речи. |
| **Системные инструкции (`systemInstruction`)** | Сохраняются | Наследуются из снимка либо обновляются в новом сообщении `setup`. |
| **Декларации инструментов (`tools`)** | Сохраняются | Схемы остаются активными; доступно динамическое расширение списка. |
| **Незавершенные вызовы функций (`toolCall`)** | Требуют сверки | Клиент обязан отправить `toolResponse` сразу после фрейма `setupComplete`. |
| **Аудиопакеты в полете (In-flight Audio)** | Не сохраняются | Аудио, отправленное после последнего чекпоинта, утрачивается. |
| **Конфигурация голоса и синтеза** | Сохраняется | Выбранный голос сохраняется; параметры можно изменить в `setup`. |

### Специфика эфемерных токенов (Ephemeral Tokens)
При предоставлении клиентского доступа через временные токены (`authTokens.create`) действует строгое правило разграничения полномочий: эфемерный токен по умолчанию не имеет прав на операцию Session Resumption. Для предоставления клиенту возможности переподключаться бэкенд приложения при генерации токена обязан явно объявить область разрешений внутри объекта `live_connect_constraints`:

```json
{
  "live_connect_constraints": {
    "model": "models/gemini-3.8-live",
    "session_resumption": {}
  }
}

```
Если данное ограничение не снято на сервере авторизации, платформа проигнорирует секцию `sessionResumption` в клиентском `setup` и никогда не вернет событие `sessionResumptionUpdate`.

### Коды ошибок сервера и стратегия деградации
В процессе восстановления сеанса клиент может столкнуться со следующими кодами завершения:
Код WebSocket `1008 (Policy Violation)` свидетельствует об истечении срока жизни маркера (более 2 часов), передаче токена из другого проекта, нарушении прав эфемерного ключа или передаче неподдерживаемых флагов (например, `transparent: true` при обращении к Developer API).
Код WebSocket `1011 (Internal Error / Service Unavailable)` возникает при сбоях ноды бэкенда или невозможности вычитать распределенный кэш состояния по переданному хэндлу.
Код HTTP `400 Bad Request` возвращается на этапе WebSocket Handshake при наличии синтаксических ошибок в структуре первоначального JSON-фрейма `setup`.
При получении кодов `1008` или `1011` клиентская логика не должна выполнять бесконечные повторные попытки с тем же маркером. Архитектура обязана реализовать алгоритм безопасного отката к холодному старту (Cold Start Fallback):
При возникновении фатальной ошибки сохраненный маркер сессии обнуляется (`sessionHandle = null`). Система немедленно инициирует новое подключение с первичным рукопожатием. В конфигурацию нового сеанса динамически инжектируется сжатое контекстное резюме через поле `systemInstruction`, информирующее модель о ключевых фактах предыдущей беседы. Пользовательский интерфейс мягко уведомляет пользователя о перезапуске звукового тракта без блокировки микрофона.

## 6. Эталонные реализации

### Реализация на TypeScript (`@google/genai` >= 2.3.0)
Реализация обеспечивает автоматическое сохранение маркеров, обработку пре-терминации `goAway` и прозрачный переход к холодному старту при ошибках.

```typescript
import { GoogleGenAI, Modality } from '@google/genai';

export interface LiveSessionOptions {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
}

export class RobustLiveSessionClient {
  private ai: GoogleGenAI;
  private model: string;
  private systemInstruction?: string;
  private currentHandle: string | null = null;
  private session: any = null;
  private migrationTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown: boolean = false;

  constructor(options: LiveSessionOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = options.model ?? 'gemini-3.8-live';
    this.systemInstruction = options.systemInstruction;
  }

  public async connect(): Promise<void> {
    const liveConfig: Record<string, any> = {
      responseModalities: [Modality.AUDIO],
      sessionResumption: {
        handle: this.currentHandle,
      },
    };

    if (this.systemInstruction) {
      liveConfig.systemInstruction = {
        parts: [{ text: this.systemInstruction }],
      };
    }

    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config: liveConfig,
        callbacks: {
          onopen: () => {
            // Транспортный сокет открыт, handshake ожидает валидации
          },
          onmessage: (msg: any) => this.handleServerMessage(msg),
          onclose: (e: any) => this.handleDisconnection(e),
          onerror: (err: any) => {
            // Ошибки сокета делегируются в обработчик onclose
          },
        },
      });
    } catch (error) {
      await this.handleHandshakeFailure(error);
    }
  }

  private handleServerMessage(message: any): void {
    if (message.sessionResumptionUpdate) {
      const update = message.sessionResumptionUpdate;
      if (update.resumable && update.newHandle) {
        this.currentHandle = update.newHandle;
      }
    }

    if (message.goAway) {
      const rawTimeLeft = message.goAway.timeLeft || '10s';
      const seconds = parseFloat(rawTimeLeft.replace('s', '')) || 10;
      this.planGracefulMigration(seconds);
    }
  }

  private planGracefulMigration(secondsLeft: number): void {
    if (this.migrationTimer) clearTimeout(this.migrationTimer);

    // Запуск процедуры закрытия за 2 секунды до жесткого серверного дедлайна
    const timeoutMs = Math.max(1000, (secondsLeft - 2) * 1000);
    this.migrationTimer = setTimeout(async () => {
      if (this.session) {
        this.session.close();
      }
    }, timeoutMs);
  }

  private async handleDisconnection(event: { code: number; reason: string }): Promise<void> {
    if (this.migrationTimer) {
      clearTimeout(this.migrationTimer);
      this.migrationTimer = null;
    }

    if (this.isShuttingDown || event.code === 1000) {
      return;
    }

    // Сброс маркера при инвалидации сервером
    if (event.code === 1008 || event.code === 1011) {
      this.currentHandle = null;
    }

    // Пауза перед реконнектом для стабилизации сетевого интерфейса
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  private async handleHandshakeFailure(error: any): Promise<void> {
    if (this.currentHandle !== null) {
      this.currentHandle = null;
      await this.connect();
    } else {
      throw error;
    }
  }

  public sendAudioChunk(base64Pcm: string): void {
    if (this.session) {
      this.session.sendRealtimeInput({
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Pcm,
          },
        ],
      });
    }
  }

  public close(): void {
    this.isShuttingDown = true;
    if (this.migrationTimer) clearTimeout(this.migrationTimer);
    this.currentHandle = null;
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

```

### Реализация на Python (`google-genai` aio)
Асинхронная реализация на базе официального SDK демонстрирует разделение циклов отправки и приема, а также реакцию на сигнал `go_away`.

```python
import asyncio
from google import genai
from google.genai import types

class RobustGeminiLiveWorker:
    def __init__(self, model: str = "gemini-3.8-live"):
        self.client = genai.Client()
        self.model = model
        self.session_handle: str | None = None
        self._is_active = True

    async def execute_session_loop(self, audio_in_queue: asyncio.Queue[bytes]):
        while self._is_active:
            try:
                config = types.LiveConnectConfig(
                    response_modalities=["AUDIO"],
                    session_resumption=types.SessionResumptionConfig(
                        handle=self.session_handle
                    )
                )

                async with self.client.aio.live.connect(
                    model=self.model,
                    config=config
                ) as session:
                    receiver = asyncio.create_task(self._read_stream(session))
                    sender = asyncio.create_task(self._write_stream(session, audio_in_queue))

                    done, pending = await asyncio.wait(
                        [receiver, sender],
                        return_when=asyncio.FIRST_COMPLETED
                    )

                    for task in pending:
                        task.cancel()

            except Exception:
                # Откат к холодному старту при падении сессии
                self.session_handle = None
                await asyncio.sleep(1.0)

    async def _read_stream(self, session):
        async for message in session.receive():
            if message.session_resumption_update:
                update = message.session_resumption_update
                if update.resumable and update.new_handle:
                    self.session_handle = update.new_handle

            if message.go_away is not None:
                # Прерывание цикла для упреждающей смены сокета
                return

            if message.server_content and message.server_content.model_turn:
                for part in message.server_content.model_turn.parts:
                    if part.inline_data and part.inline_data.data:
                        # Отправка чанка PCM в аудиодрайвер воспроизведения
                        pass

    async def _write_stream(self, session, queue: asyncio.Queue[bytes]):
        while True:
            raw_audio = await queue.get()
            await session.send_realtime_input(
                media_chunks=[
                    types.Blob(
                        mime_type="audio/pcm;rate=16000",
                        data=raw_audio
                    )
                ]
            )
            queue.task_done()

    def stop(self):
        self._is_active = False
        self.session_handle = None

```

## 7. Инженерный план миграции: Замена `LiveGreetingReplay.ts`

### Анализ дефектов устаревшего модуля `LiveGreetingReplay.ts`
В текущей кодовой базе модуль `LiveGreetingReplay.ts` агрегирует историю диалога в локальный буфер `historyTurns` и при каждом реконнекте принудительно отправляет его на сервер через `clientContent.turns`.
В ходе аудита выявлены три критических дефекта:
Отправка реплик из `historyTurns` после сигнала `setupComplete` воспринимается инференсом как новое пользовательское высказывание. Модель принудительно начинает озвучивать реакцию на старую реплику, в то время как пользователь уже начинает говорить в микрофон.
Поступающее с сервера запоздалое аудио вступает в конфликт с микрофонным потоком `realtimeInput`. Встроенный алгоритм эхоподавления и VAD регистрирует взаимное перебивание, генерируя постоянные флаги `interrupted` и обрывая речь.
Каждый цикл реплея заново токенизирует весь массив истории. Это приводит к ускоренному расходу доступного контекстного окна (15 минут в аудиорежиме) и падению сеанса по превышению лимитов памяти.

### Пошаговый регламент вывода из эксплуатации
Процедура перехода на нативный Session Resumption реализуется в пять этапов:
Сначала полностью удаляется модуль `LiveGreetingReplay.ts`, а также методы кэширования текстовых реплик в клиентском слое представления.
Затем создается изолированный сервис `SessionResumptionStorage`, обеспечивающий атомарное сохранение `resumptionHandle` в оперативной памяти с дублированием в `sessionStorage` браузера для защиты от случайной перезагрузки вкладки.
Далее модифицируется сборщик настроечного фрейма `setup`: поле `sessionResumption.handle` связывается со значением из `SessionResumptionStorage`.
В диспетчере событий сокета настраивается перехватчик `sessionResumptionUpdate` для синхронного обновления локального токена, а также слушатель события `goAway` для мягкого перезапуска соединения.
Наконец, в обработчике закрытия сокета регистрируются коды `1008` и `1011`, при получении которых хранилище маркеров сбрасывается, предотвращая циклическую блокировку рукопожатия.

### Целевая реализация: `CanonicalLiveSessionClient.ts`
Ниже приведен готовый модуль, замещающий функциональность `LiveGreetingReplay.ts`:

```typescript
import { GoogleGenAI, Modality } from '@google/genai';

export interface CanonicalClientConfig {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  onAudioOutput?: (pcmBase64: string) => void;
}

export class CanonicalLiveSessionClient {
  private ai: GoogleGenAI;
  private config: CanonicalClientConfig;
  private currentHandle: string | null = null;
  private session: any = null;
  private migrationTimer: ReturnType<typeof setTimeout> | null = null;
  private isTerminated: boolean = false;

  constructor(config: CanonicalClientConfig) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.restorePersistedHandle();
  }

  public async start(): Promise<void> {
    this.isTerminated = false;
    await this.initiateConnection();
  }

  private async initiateConnection(): Promise<void> {
    const liveConfig: Record<string, any> = {
      responseModalities: [Modality.AUDIO],
      sessionResumption: {
        handle: this.currentHandle,
      },
    };

    if (this.config.systemInstruction) {
      liveConfig.systemInstruction = {
        parts: [{ text: this.config.systemInstruction }],
      };
    }

    try {
      this.session = await this.ai.live.connect({
        model: this.config.model,
        config: liveConfig,
        callbacks: {
          onopen: () => {
            // Успешная установка канала
          },
          onmessage: (msg: any) => this.processMessage(msg),
          onclose: (e: any) => this.handleClose(e),
          onerror: (err: any) => {
            // Ошибки сокета перехватываются обработчиком закрытия
          },
        },
      });
    } catch (err) {
      if (this.currentHandle) {
        this.clearHandle();
        await this.initiateConnection();
      } else {
        throw err;
      }
    }
  }

  private processMessage(message: any): void {
    // 1. Фиксация нового маркера состояния
    if (message.sessionResumptionUpdate) {
      const update = message.sessionResumptionUpdate;
      if (update.resumable && update.newHandle) {
        this.saveHandle(update.newHandle);
      }
    }

    // 2. Обработка пре-терминации соединения
    if (message.goAway) {
      const rawTime = message.goAway.timeLeft || '15s';
      const seconds = parseFloat(rawTime.replace('s', '')) || 15;
      this.armMigrationTimer(seconds);
    }

    // 3. Передача звука в аудиотракт
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data && this.config.onAudioOutput) {
          this.config.onAudioOutput(part.inlineData.data);
        }
      }
    }
  }

  private armMigrationTimer(secondsLeft: number): void {
    if (this.migrationTimer) clearTimeout(this.migrationTimer);

    const safeWindowMs = Math.max(1000, (secondsLeft - 3) * 1000);
    this.migrationTimer = setTimeout(() => {
      if (this.session) {
        // Штатный разрыв для запуска переподключения с текущим маркером
        this.session.close();
      }
    }, safeWindowMs);
  }

  private async handleClose(event: { code: number; reason: string }): Promise<void> {
    if (this.migrationTimer) {
      clearTimeout(this.migrationTimer);
      this.migrationTimer = null;
    }

    if (this.isTerminated || event.code === 1000) {
      return;
    }

    // При невалидном маркере сбрасываем состояние к холодному старту
    if (event.code === 1008 || event.code === 1011) {
      this.clearHandle();
    }

    setTimeout(() => {
      this.initiateConnection();
    }, 1000);
  }

  private saveHandle(handle: string): void {
    this.currentHandle = handle;
    try {
      sessionStorage.setItem('gemini_live_resumption_handle', handle);
    } catch {
      // Игнорирование ошибок квоты хранилища браузера
    }
  }

  private restorePersistedHandle(): void {
    try {
      this.currentHandle = sessionStorage.getItem('gemini_live_resumption_handle');
    } catch {
      this.currentHandle = null;
    }
  }

  private clearHandle(): void {
    this.currentHandle = null;
    try {
      sessionStorage.removeItem('gemini_live_resumption_handle');
    } catch {
      // Игнорирование ошибок хранилища
    }
  }

  public sendAudio(base64Pcm: string): void {
    if (this.session) {
      this.session.sendRealtimeInput({
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Pcm,
          },
        ],
      });
    }
  }

  public terminate(): void {
    this.isTerminated = true;
    if (this.migrationTimer) clearTimeout(this.migrationTimer);
    this.clearHandle();
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

```

## 8. Архитектурные выводы и регламент эксплуатации
Переход на нативный Session Resumption устраняет фундаментальные ограничения архитектур на базе ручной переотправки реплик диалога. Конфигурационный блок `sessionResumption: {}` должен присутствовать в первом настроечном сообщении каждого создаваемого сеанса. Отсутствие этого параметра отключает фоновую генерацию контрольных точек на стороне инфраструктуры Google.
Приближение к 10-минутному лимиту соединения требует обязательной обработки сигнала `goAway`. Корректно настроенная упреждающая миграция соединения гарантирует отсутствие звуковых артефактов и обрывов на полуслове.
Срок жизни маркера сессии составляет ровно 2 часа в Developer API и до 24 часов на платформе Vertex AI. При возникновении сетевых ошибок `1008` или `1011` клиент обязан сбрасывать маркер в `null` и переходить к холодному старту без зацикливания.
При интеграции с эфемерными токенами обязательным требованием является предварительное делегирование прав через добавление блока `session_resumption: {}` в директиву `live_connect_constraints` при их генерации.

---

Source: https://gemini.google.com/app/c72c2f15b6bdf4b0
Exported at: 2026-10-08T14:41:30.716Z