# Модуль 03: Асинхронные инструменты, диспетчеризация контекста и Turn 0 Lockdown

> **Статус документа:** Производственный стандарт / Архитектурный регламент (SOTA late-2026)  
> **Связанные спецификации:** [00_context_architecture_index.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/00_context_architecture_index.md), [01_context_grounding_and_memory.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/01_context_grounding_and_memory.md), [02_session_resumption_and_lifecycle.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/02_session_resumption_and_lifecycle.md), [04_audio_context_and_turn_taking.md](file:///d:/projects/одноразовые%20задачи/работа%20с%20контекстом%20gemini%203.8%20live/04_audio_context_and_turn_taking.md)  
> **Целевой API:** Multimodal Live API (`BidiGenerateContent`), `@google/genai` (v2.3.0+)

---

## 1. Введение: Смена парадигмы Function Calling в Gemini 3.8 Live

В классических диалоговых системах вызов функций (`Tool Calling`) функционировал синхронно и блокирующе (`BLOCKING`):
1. Модель формировала запрос на вызов функции.
2. Процесс генерации речи и токенов полностью замораживался.
3. В эфире возникала «мертвая пауза» длительностью **800–3500 мс**, пока внешняя система выполняла запрос.
4. Пользователь воспринимал эту паузу как зависание интерфейса или обрыв связи.

В моделях **Gemini 3.8 Live** и **Gemini 3.8 Live Extended Thinking** парадигма кардинально изменена:
- Режим `BLOCKING` объявлен устаревшим (deprecated).
- Для модели `gemini-3.8-live-extended-thinking` неблокирующий режим **`behavior: "NON_BLOCKING"`** является **нормативно обязательным** (попытка передать синхронный блокирующий инструмент отвергается валидатором).
- Модель разделяет контур речевого синтеза и контур исполнения внешних манипуляций. При отправке события `toolCall` модель параллельно синтезирует нативный аудиопоток (PCM 24 кГц), произнося естественные деиктические пояснения («Сейчас открою сервис авторизации и выделю логику токенов...»), в то время как клиентский интерфейс в фоне выполняет манипуляции.

---

## 2. Сквозной протокольный цикл неблокирующего взаимодействия

Обмен данными в сессии `BidiGenerateContent` мультиплексируется через единый сокет WebSocket:

| Шаг | Направление | Тип фрейма | Полезная нагрузка | Поведение подсистем клиента и UI |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Клиент $\to$ Сервер | `realtimeInput` | Аудио PCM 16 кГц («Подсвети вызов JWT и проверь валидатор») | Захват микрофона, непрерывный стриминг. |
| **2** | Сервер $\to$ Клиент | `serverContent` | Аудио PCM 24 кГц («Обратите внимание на конструктор...») | Буферизация и воспроизведение через Web Audio API. |
| **3** | Сервер $\to$ Клиент | `toolCall` | `functionCalls: [{ id: "call_01", name: "highlight_code", args: {...} }]` | Парсинг аргументов, запуск фоновой задачи в UI. |
| **4** | Сервер $\to$ Клиент | `serverContent` | Аудио PCM 24 кГц («...здесь накладывается ограничение по сроку») | Непрерывный синтез речи без заиканий и пауз. |
| **5** | Клиент (Local) | Локальное событие | UI-манипуляция: подсветка строк, скролл, рендер канваса | Асинхронное исполнение задачи в GUI/IDE. |
| **6** | Клиент $\to$ Сервер | `toolResponse` | `functionResponses: [{ id: "call_01", response: { ok: true }, scheduling: "SILENT" }]` | Возврат результата **без речевого эха**. |
| **7** | Сервер $\to$ Клиент | `serverContent` | Маркеры завершения: `turnComplete: true`, `interactionStatus: "IDLE"` | Фиксация завершения мысли; готовность к ответу человека. |

---

## 3. Диспетчеризация возврата данных в контекст: Режимы `scheduling`

Когда клиент возвращает результат исполнения функции через сообщение `toolResponse` (`functionResponses`), он обязан передать атрибут `scheduling`, управляющий тем, как результат отразится на речевом потоке модели:

| Режим `scheduling` | Влияние на контекст модели | Поведение речевого потока модели | Целевой сценарий |
| :--- | :--- | :--- | :--- |
| **`SILENT`** | Результат фиксируется в контексте **без генерации речи**. | Модель продолжает говорить текущую мысль, не комментируя факт завершения операции. | Мутации UI, подсветка синтаксиса, канвас/доска, логи, метрики, аналитика. |
| **`WHEN_IDLE`** *(По умолчанию)* | Данные попадают в контекст; ответ планируется на потом. | Модель договаривает текущее предложение, делает паузу и начинает новый ответ на основе данных. | Чтение файлов (`read_file`), запросы к БД, математические расчеты. |
| **`INTERRUPT`** | Данные попадают в контекст с **немедленным прерыванием**. | Текущий аудиопоток модели мгновенно отсекается; синтезируется срочное оповещение. | Ошибки компиляции, критические алерты безопасности, аварийные сбои. |

> [!CAUTION]
> **Паразитные речевые петли (Chatter Anti-Pattern):**  
> Если функция визуального обновления интерактивной доски или подсветки кода вернет результат со значением по умолчанию `WHEN_IDLE`, модель после завершения фразы начнет генерировать избыточное голосовое эхо («Я подсветила строку 42 на экране!»). Это разрушает профессиональный UX диалога. Для любых фоновых мутаций интерфейса обязателен режим **`scheduling: "SILENT"`**.

---

## 4. Потоковые генераторные функции (`willContinue`)

В сценариях пошаговой визуализации сложных графов или прогрессивного статического анализа кодовой базы протокол поддерживает частичную отдачу результатов:
- Клиент передает серию промежуточных кадров с флагом `willContinue: true`.
- Модель обновляет контекст инкрементально.
- Финал генератора оформляется завершающим кадром с флагом `willContinue: false` и параметром `scheduling: "SILENT"`, что гарантирует чистоту речевого канала:

```json
{
  "toolResponse": {
    "functionResponses": [
      {
        "id": "call_stream_42",
        "name": "analyze_project_structure",
        "response": { "phase": "complete", "totalModules": 12 },
        "willContinue": false,
        "scheduling": "SILENT"
      }
    ]
  }
}
```

---

## 5. Прерывание речи (Barge-In) и отмена инструментов (`toolCallCancellation`)

В полнодуплексном режиме пользователь может перебить ассистента в тот самый момент, когда на клиенте выполняется асинхронный инструмент.

### 5.1. Протокольный контракт отмены
1. Серверный VAD фиксирует начало речи пользователя и отправляет сообщение `serverContent` с флагом `interrupted: true`.
2. Сервер отправляет кадр `toolCallCancellation`, содержащий массив идентификаторов:
   ```json
   {
     "toolCallCancellation": {
       "ids": ["call_01", "call_02"]
     }
   }
   ```
3. Согласно спецификации протокола, клиент обязан немедленно остановить локальное выполнение и **категорически НЕ отправлять `toolResponse` по аннулированным идентификаторам**.

### 5.2. Асинхронная гонка и инвариант `AbortController`
Из-за сетевой латентности серверный фрейм `toolCallCancellation` может прийти с задержкой в 50–200 мс либо быть пропущен при быстрой смене диалогового контекста.

> [!IMPORTANT]
> **Архитектурный инвариант отмены:**  
> Клиентский диспетчер обязан ассоциировать каждый активный `call.id` с отдельным экземпляром `AbortController`.  
> При поступлении любого события `serverContent.interrupted === true` диспетчер обязан немедленно вызвать `abort()` для всех активных задач, предотвращая применение запоздалых визуальных мутаций и отправку устаревших `toolResponse`.

---

## 6. Строгость схем инструментов (Schema Strictness) и лимиты SLA

Валидатор схем в протоколе `BidiGenerateContent` опирается на строгую типизацию Protobuf. Любое несоответствие приводит к сбросу соединения.

### 6.1. Свод правил валидации инструментов

| Параметр спецификации | Допустимый формат (SOTA) | Запрещенный формат | Последствия нарушения |
| :--- | :--- | :--- | :--- |
| **Регистр типов (`Type`)** | Строго ВЕРХНИЙ регистр: `"OBJECT"`, `"ARRAY"`, `"STRING"`, `"INTEGER"`, `"NUMBER"`, `"BOOLEAN"` | Строчные литералы: `"string"`, `"object"`, `"number"`, `"int"`, `"boolean"` | Ошибка **`400 INVALID_ARGUMENT`** на этапе рукопожатия `setup`. |
| **Декларация объектов** | Обязательный типизированный словарь `properties: {...}` | Пустой объект `{"type": "OBJECT"}` без вложенных полей | Ошибка парсинга схемы инфраструктурой Google. |
| **Точка регистрации инструментов** | **Исключительно в первом фрейме `setup`** | Отправка повторного сообщения `setup` в активный сокет | Немедленное закрытие WebSocket сервером (`1008`). |
| **Динамическая смена набора функций** | Через закрытие сокета и **`SessionResumption`** с новым списком `tools` | Попытка изменить набор инструментов внутри открытого сокета | Не поддерживается платформой; ведет к рассинхрону. |
| **SLA времени отклика** | $t_{\text{response}} \le 3000\text{ мс}$ | Задержка ответа клиентом свыше 3000 мс | Модель галлюцинирует, забывает контекст вызова, теряет нить диалога. |

---

## 7. Конечный автомат `interactionStatus` и ловушка `turnComplete`

В классических диалоговых системах флаг `turnComplete: true` означал завершение реплики модели. В Gemini 3.8 Live (особенно `extended-thinking`) опираться только на `turnComplete: true` **категорически запрещено**.

### 7.1. Анатомия ловушки
Модель с глубокими рассуждениями генерирует короткую вводную фразу («Одну секунду, сверяю конфигурацию базы...») и выставляет для этого аудиопакета флаг `turnComplete: true`. При этом сервер:
- Продолжает удерживать фоновые цепочки рассуждений (Interleaved Chain-of-Thought).
- Ожидает исполнения запущенного неблокирующего инструмента.
- Готовит основной развернутый ответ.

Если клиент воспримет этот ранний `turnComplete: true` как окончание хода и откроет микрофон на прием речи, последующие аудиопакеты модели столкнутся с голосом пользователя, спровоцировав ложное самопрерывание.

### 7.2. Канонический предикат готовности клиента ($S_{\text{client}} = \text{IDLE}$)
Протокол передает метаполе `interactionStatus` (`IN_PROGRESS` либо `IDLE`). Клиент имеет право перевести UI и звуковой тракт в статус ожидания ответа пользователя **только при одновременном соблюдении трех условий**:

$$S_{\text{client}} = \text{IDLE} \iff (\text{AudioBuffer} = \emptyset) \land (N_{\text{pending\_tools}} = 0) \land (\text{interactionStatus} = \text{IDLE})$$

```typescript
const isClientReadyForUserTurn = 
  audioPlaybackQueue.length === 0 &&
  pendingToolCallsMap.size === 0 &&
  serverInteractionStatus === 'IDLE';
```

---

## 8. Защита от контекстных галлюцинаций нулевого хода (Turn 0 Lockdown)

В сложных голосовых сценариях (технические собеседования, экзамены, оформление платежей) модель видит в системной инструкции терминальный инструмент (например, `submit_final_score` или `terminate_call`) и на первом же приветствии пользователя («Здравствуйте!») пытается вызвать его, преждевременно завершая процесс.

Поскольку протокол запрещает динамически удалять или добавлять инструменты в рамках открытого WebSocket-сокета, защита строится на базе **трехуровневого шлюза**:

```
+---------------------------------------------------------------------------------+
|                        ТРЕХУРОВНЕВЫЙ ШЛЮЗ TURN 0 LOCKDOWN                       |
+---------------------------------------------------------------------------------+
| Уровень 1: Fail-Closed Execution Gate (Клиентский автомат)                      |
|   • Диспетчер перехватывает вызов терминальной функции до нужной фазы.          |
|   • Возвращает toolResponse { error: "PRECONDITION_FAILED" } со scheduling: SILENT|
|   • Модель корректирует контекст без сбоя и без озвучивания ошибки.             |
+---------------------------------------------------------------------------------+
| Уровень 2: Phase-Gated Schemas (Криптографический / Фазовый токен)              |
|   • В параметры терминальной функции добавляется обязательное поле token.        |
|   • Токен физически отсутствует в контексте модели до наступления финала.       |
+---------------------------------------------------------------------------------+
| Уровень 3: Негативные директивы в systemInstruction                             |
|   • Явный системный запрет вызова итоговых функций до явного указания юзера.    |
+---------------------------------------------------------------------------------+
```

### 8.1. Реализация Уровня 1: Fail-Closed Gate
Если модель вызывает терминальную функцию на этапе `PHASE_GREETING`, диспетчер возвращает ответ:
```json
{
  "toolResponse": {
    "functionResponses": [
      {
        "id": "call_eval_01",
        "name": "submit_interview_evaluation",
        "response": {
          "error": "PRECONDITION_FAILED",
          "message": "Evaluation cannot be submitted during greeting phase. Assessment in progress."
        },
        "scheduling": "SILENT"
      }
    ]
  }
}
```
Благодаря `scheduling: "SILENT"` модель не озвучивает ошибку, а молча корректирует цепочку рассуждений и продолжает диалог.

---

## 9. Эталонная реализация диспетчера инструментов на TypeScript

```typescript
import { GoogleGenAI } from '@google/genai';

export interface ToolCallPayload {
  id: string;
  name: string;
  args: Record<string, any>;
}

export type ToolHandler = (
  args: Record<string, any>,
  signal: AbortSignal
) => Promise<Record<string, any>>;

export class AsyncToolDispatcher {
  private handlers = new Map<string, ToolHandler>();
  private activeTasks = new Map<string, AbortController>();
  private currentPhase: 'GREETING' | 'IN_PROGRESS' | 'COMPLETED' = 'GREETING';

  constructor(private sendToolResponse: (responsePayload: any) => void) {}

  public registerHandler(name: string, handler: ToolHandler): void {
    this.handlers.set(name, handler);
  }

  public setPhase(phase: 'GREETING' | 'IN_PROGRESS' | 'COMPLETED'): void {
    this.currentPhase = phase;
  }

  public get pendingCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Обработка входящего вызова toolCall от сервера
   */
  public async handleToolCall(call: ToolCallPayload): Promise<void> {
    // Turn 0 Lockdown: перехват терминальных функций на ранних этапах
    if (call.name === 'submit_final_evaluation' && this.currentPhase !== 'COMPLETED') {
      console.warn(`[ToolDispatcher] Blocked premature call: ${call.name} in phase ${this.currentPhase}`);
      this.sendToolResponse({
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: {
              error: 'PRECONDITION_FAILED',
              message: 'Cannot finalize before interview completion.'
            },
            scheduling: 'SILENT' // Не вокализировать ошибку!
          }
        ]
      });
      return;
    }

    const handler = this.handlers.get(call.name);
    if (!handler) {
      console.error(`[ToolDispatcher] Unknown tool called: ${call.name}`);
      this.sendToolResponse({
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: { error: 'FUNCTION_NOT_FOUND' },
            scheduling: 'SILENT'
          }
        ]
      });
      return;
    }

    const abortController = new AbortController();
    this.activeTasks.set(call.id, abortController);

    // Контроль жесткого SLA в 3000 мс
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error('SLA_TIMEOUT_EXCEEDED'));
    }, 3000);

    try {
      const result = await handler(call.args, abortController.signal);
      clearTimeout(timeoutId);

      // Проверяем, не была ли задача отменена во время исполнения
      if (!abortController.signal.aborted) {
        this.sendToolResponse({
          functionResponses: [
            {
              id: call.id,
              name: call.name,
              response: result,
              scheduling: 'SILENT' // Или WHEN_IDLE в зависимости от бизнес-логики
            }
          ]
        });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (abortController.signal.aborted) {
        console.debug(`[ToolDispatcher] Tool ${call.id} was aborted, response suppressed.`);
        return; // По спецификации, отмененные тулы НЕ возвращают response
      }

      this.sendToolResponse({
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: { error: err.message || 'EXECUTION_FAILED' },
            scheduling: 'SILENT'
          }
        ]
      });
    } finally {
      this.activeTasks.delete(call.id);
    }
  }

  /**
   * Обработка события прерывания речи (Barge-In)
   */
  public handleInterruption(): void {
    console.debug('[ToolDispatcher] Interruption detected. Aborting all active tools.');
    for (const [id, controller] of this.activeTasks.entries()) {
      controller.abort(new Error('USER_BARGE_IN'));
    }
    this.activeTasks.clear();
  }

  /**
   * Обработка адресного события toolCallCancellation от сервера
   */
  public handleCancellation(cancelledIds: string[]): void {
    for (const id of cancelledIds) {
      const controller = this.activeTasks.get(id);
      if (controller) {
        console.debug(`[ToolDispatcher] Cancelling tool ${id} per server request.`);
        controller.abort(new Error('SERVER_TOOL_CANCELLATION'));
        this.activeTasks.delete(id);
      }
    }
  }
}
```

---

## 10. Регламент валидации и приемочные критерии
1. **Регистр типов в схеме:** все декларации параметров используют строгий верхний регистр (`Type.OBJECT`, `Type.STRING` и т.д.).
2. **Тишина фоновых операций:** вызовы функций синхронизации доски и IDE возвращают `scheduling: "SILENT"`, модель не комментирует технические действия вслух.
3. **Отмена по Barge-In:** при перебивании модели во время долгого асинхронного вызова срабатывает `AbortController`, а в консоли отсутствуют запоздалые `toolResponse`.
4. **Защита Turn 0:** при первичном запуске сессии с приветствием пользователя попытка вызова терминального инструмента блокируется шлюзом с кодом `PRECONDITION_FAILED`, а диалог продолжается штатно.
5. **Композитный FSM:** микрофон и индикатор готовности UI переходят в статус `IDLE` только при одновременном выполнении условий: пустой аудиобуфер, 0 активных инструментов и `interactionStatus === "IDLE"`.
