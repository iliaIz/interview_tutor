# Архитектура асинхронного вызова инструментов и синхронизации интерактивной доски в Gemini 3.8 Live
Двунаправленный потоковый протокол Google Gemini Live API (`generativelanguage.googleapis.com`, метод `BidiGenerateContent`) предоставляет инфраструктуру для организации мультимодального взаимодействия между речевым каналом пользователя и генеративным ядром в режиме реального времени. При построении совместных интерактивных сред — таких как виртуальные доски для проектирования архитектуры, редакторы кода с динамической подсветкой синтаксиса и графические холсты для технических интервью — центральным инженерным вызовом становится устранение конфликта между непрерывным голосовым потоком и запаздывающим исполнением внешних манипуляций. Модели `gemini-3.8-live` и `gemini-3.8-live-extended-thinking` разрешают данное противоречие посредством перехода к полностью асинхронной неблокирующей парадигме вызова инструментов (`behavior: NON_BLOCKING`), поддерживаемой специализированными протокольными структурами диспетчеризации и отслеживания состояния сессии.

## Спецификация неблокирующего вызова функций (behavior: NON_BLOCKING)
Исторический подход к вызову функций в больших языковых моделях строился вокруг блокирующей синхронной семантики `BLOCKING`, при которой генерация контента моделью полностью останавливалась в точке формирования вызова инструмента. В диалоговых аудиосистемах предыдущего поколения это приводило к возникновению акустических пауз длительностью от 800 до 3500 миллисекунд, пока удаленная система исполняла запрос и возвращала результат. Для пользователя подобные задержки воспринимались как разрыв связи или неестественное зависание диалога.
В спецификации `FunctionDeclaration` для протокола `BidiGenerateContent` представлено поле `behavior`, управляемое перечислением `FunctionDeclaration_Behavior`: `UNSPECIFIED` (значение 0), `BLOCKING` (значение 1) и `NON_BLOCKING` (значение 2). В моделях семейства Gemini 3.8 Live режим `BLOCKING` объявлен устаревшим, а модель `gemini-3.8-live-extended-thinking` нормативно требует установки значения `behavior: "NON_BLOCKING"`, возвращая ошибку валидации схемы при попытке зарегистрировать блокирующий инструмент.
Семантика `NON_BLOCKING` разделяет вычислительный поток генерации медиаданных и контур выполнения внешних инструкций. Когда внутренний механизм внимания модели формирует решение о вызове инструмента, сервер сериализует и отправляет клиенту фрейм `toolCall`, содержащий уникальный идентификатор `id`, наименование функции и аргументы. При этом звуковой синтезатор не прекращает генерацию ни на один квант времени. Модель генерирует нативный аудиопоток с частотой дискретизации $f_s = 24\text{ кГц}$, параллельно произнося связующие речевые обороты, деиктические пояснения или заполняющие маркеры («Давайте взглянем на сорок вторую строку, где создается экземпляр пула соединений...»), в то время как графический интерфейс параллельно выполняет отрисовку.
Для достижения аудиовизуального симбиоза в системных инструкциях задается директива естественного речевого сопровождения визуальных манипуляций. Модель инструктируется комментировать суть выполняемого действия в момент его инициации, а не дожидаться отчета об отрисовке. Поскольку звуковой поток декодируется и передается независимо от ожидания кадра `toolResponse`, в аудиотракте отсутствуют артефакты опустошения буфера (underrun), дрожание пакетов (jitter) или заикания. Визуальное выделение на интерактивной доске и звуковой фокус на соответствующей сущности синхронизируются во времени с точностью до $50\text{ мс}$.

## Протокольный цикл и диспетчеризация неблокирующего взаимодействия
Сетевой обмен в рамках сессии `BidiGenerateContent` опирается на полнодуплексное мультиплексирование входящих и исходящих сообщений через единое соединение WebSocket. Клиент и сервер непрерывно обмениваются строго типизированными фреймами, где полезная нагрузка разделена на потоковое аудио, управляющие метаданные и структуры функциональных вызовов.
Для иллюстрации взаимодействия компонентов при параллельном речевом синтезе и манипуляции элементами доски ниже приведен сквозной протокольный цикл обработки события.

| Шаг | Вектор передачи | Тип фрейма протокола | Структура полезной нагрузки | Реакция подсистем клиента и UI |
| --- | --- | --- | --- | --- |
| 1 | Клиент $\rightarrow$ Сервер | `realtimeInput` | Аудиочанк PCM $16\text{ кГц}$ («Выделите шину очередей и проверьте обработчик») | Непрерывный захват микрофона, потоковая отправка аудиоданных |
| 2 | Сервер $\rightarrow$ Клиент | `serverContent` | Аудиочанки PCM $24\text{ кГц}$ («Обратите внимание на распределитель сообщений...») | Фоновая буферизация и воспроизведение через Web Audio API |
| 3 | Сервер $\rightarrow$ Клиент | `toolCall` | `functionCalls: [{ id: "call_a91", name: "update_whiteboard", args: {...} }]`[cite: 9, 10] | Парсинг аргументов, передача задачи в поток рендеринга доски |
| 4 | Сервер $\rightarrow$ Клиент | `serverContent` | Аудиочанки PCM $24\text{ кГц}$ («...он агрегирует входящие пакеты перед записью») | Непрерывное воспроизведение речи без пауз и щелчков |
| 5 | Клиент | Локальное событие | Рендеринг канваса: перемещение камеры, наложение шейдера подсветки | Асинхронное обновление графа объектов визуализации |
| 6 | Клиент $\rightarrow$ Сервер | `toolResponse` | `functionResponses: [{ id: "call_a91", response: { ok: true }, scheduling: "SILENT" }]`[cite: 9, 10] | Возврат подтверждения завершения операции без речевого эха |
| 7 | Сервер $\rightarrow$ Клиент | `serverContent` | Завершение реплики: маркеры `turnComplete: true`, `interactionStatus: "IDLE"`[cite: 1, 5] | Фиксация завершения мысли модели, готовность к ответу человека |

Потоки данных распределяются по независимым функциональным контурам. Канал пользовательского ввода поставляет квантованные фрагменты речи на сервер. Внутренний механизм рассуждений модели обрабатывает контекст, параллельно транслируя синтезированную речь клиенту. Как только формируется предикат модификации интерфейса, сервер генерирует фрейм `toolCall`. Графический движок интерактивной доски применяет изменения асинхронно, не блокируя поток воспроизведения звука. Возвращаемый кадр `toolResponse` фиксирует состояние холста во внутреннем графе контекста модели, не вызывая повторных речевых реакций за счет специального режима планирования.

## Жизненный цикл сессии и клиентский автомат состояний interactionStatus
В базовых сценариях взаимодействия с API генеративного контента флаг `turnComplete: true` традиционно сигнализировал о том, что модель закончила формирование ответа и ожидает следующей реплики пользователя. Однако в среде `gemini-3.8-live` и особенно `gemini-3.8-live-extended-thinking` с включенными неблокирующими инструментами опора исключительно на данный флаг приводит к критическим сбоям координации.
Модели с расширенным рассуждением используют концепцию фрагментированного речевого взаимодействия. Они способны сгенерировать короткое вводное высказывание («Секунду, сверяю граф зависимостей...») и сопроводить его флагом `turnComplete: true` для текущего звукового фрагмента, продолжая при этом удерживать активные фоновые процессы логического вывода и ожидать ответа от запущенного инструмента. Если клиент сочтет такой флаг окончанием обработки реплики и откроет микрофон на прием нового контекста, последующие звуковые пакеты модели или запоздалые запросы `toolCall` столкнутся с пользовательской речью, спровоцировав непреднамеренное взаимное прерывание.
Для управления жизненным циклом протокол внедряет статус взаимодействия `interactionStatus` (в схеме protobuf — `BidiGenerateContentServerContent.interaction_status`), передаваемый совместно с флагом `turnComplete`.

| Значение `interactionStatus` | Внутреннее состояние сервера Gemini Live | Динамика речевого потока | Обязанности клиентского автомата состояний |
| --- | --- | --- | --- |
| `IN_PROGRESS` | Сервер выполняет рассуждения, синтезирует речевые связки или ожидает завершения асинхронных вызовов. | Модель может временно молчать или генерировать вводные речевые маркеры. | Клиент сохраняет активные слушатели, блокирует визуальный переход в режим готовности, не инициирует искусственных прерываний. |
| `IDLE` | Все фоновые цепочки рассуждений завершены, очередь инструментов обработана, генерация окончена. | Полная тишина, синтез речи завершен. | Клиент переводит микрофон и UI в статус полной готовности к реплике пользователя (User Turn). |
| `INTERACTION_STATUS_UNSPECIFIED` | Начальное или неинициализированное состояние сессии. | Не определено. | Сохранение предыдущего стабильного состояния. |

Для обеспечения детерминированного поведения клиентское приложение должно реализовывать формальный конечный автомат (FSM), вычисляющий композитное состояние на основе трех параметров: статуса локального аудиобуфера $\text{AudioBuffer}$, счетчика незавершенных асинхронных операций $N_{\text{pending\_tools}}$ и последнего серверного значения $\text{interactionStatus}$.
Переход клиентского приложения в терминальное состояние готовности к приему реплики пользователя ($S_{\text{client}} = \text{IDLE}$) строго определяется предикатом:

$$
S_{\text{client}} = \text{IDLE} \iff (\text{AudioBuffer} = \emptyset) \land (N_{\text{pending\_tools}} = 0) \land (\text{interactionStatus} = \text{IDLE})
$$
Любое промежуточное состояние, при котором $\text{interactionStatus} = \text{IN\_PROGRESS}$, трактуется клиентской системой как активная фаза генерации, даже если звуковой поток временно приостановлен, а флаг `turnComplete` текущего пакета равен `true`.

## Режимы планирования выполнения инструментов и сценарии прерывания (Barge-In)
При формировании кадра `toolResponse` клиент обязан определить политику диспетчеризации возвращаемых данных в контексте текущей речи модели. Для неблокирующих вызовов в структуре `FunctionResponse` предусмотрено поле `scheduling` (перечисление `Scheduling`), регламентирующее поведение модели при получении данных.

| Режим `scheduling` | Семантика протокола | Поведение модели при активной генерации речи | Целевой сценарий использования |
| --- | --- | --- | --- |
| `SILENT` | Результат функции добавляется в контекст сессии без инициации генерации речи и без прерывания текущего аудио. | Модель продолжает говорить текущую фразу, не комментируя факт завершения функции. | Отрисовка элементов доски, подсветка синтаксиса, фоновая аналитика, подтверждение установки курсора. |
| `WHEN_IDLE` *(Default)* | Результат помещается в контекст; генерация ответа планируется строго после того, как текущий речевой фрагмент завершится. | Модель договаривает текущее предложение до естественной паузы, после чего начинает новую реплику на базе данных инструмента. | Запросы к базе данных, получение справочных данных, чтение определений функций в кодовой базе. |
| `INTERRUPT` | Результат немедленно обрывает текущую генерацию модели и форсирует экстренную перегенерацию с новыми данными. | Текущий аудиопоток мгновенно отсекается сервером; синтезируется срочное оповещение. | Критические сбои компиляции, алерты системы безопасности, аппаратные ошибки выполнения кода. |

Для координации интерактивной доски фундаментальное значение имеет режим `SILENT`. Если функция подсветки строки кода вернет статус исполнения со стандартным значением `WHEN_IDLE`, модель после окончания фразы начнет генерировать избыточное подтверждение («Я выделила сорок вторую строку на экране»), что разрушает естественность диалога и создает паразитные речевые петли. Режим `SILENT` внедряет подтверждение рендеринга в контекст без вокализации, позволяя модели опираться на обновленное состояние канваса в последующих репликах.
Протокол также поддерживает потоковые генераторные функции посредством флага `willContinue: boolean` в структуре `FunctionResponse`. В случаях пошаговой отрисовой сложной топологии или прогрессивного статического анализа клиент передает серию промежуточных кадров с `willContinue: true`. Завершение генератора оформляется пустым кадром с флагом `willContinue: false` и параметром `scheduling: "SILENT"`, что гарантирует чистоту речевого канала при окончании потока данных.
Механика прерывания речи пользователем (barge-in) вносит специфические требования в обработку параллельно исполняемых инструментов. Серверный модуль Voice Activity Detection (VAD) Gemini Live фиксирует начало речи пользователя с латентностью $40\text{--}150\text{ мс}$ и транслирует клиенту следующие управляющие сигналы:
Сервер высылает сообщение `serverContent` с флагом `interrupted: true` и статусом `speechState: "ACTIVITY_START"`. Клиентское приложение обязано немедленно сбросить аппаратные аудиобуферы вывода звука, останавливая воспроизведение текущего фрагмента.
Если в момент прерывания на стороне клиента выполнялся асинхронный инструмент, сервер формирует кадр `toolCallCancellation`, содержащий массив идентификаторов `ids: string[]`, подлежащих аннулированию. Согласно спецификации, клиент должен отменить локальное исполнение и не отправлять ответ по указанным идентификаторам.
Практические исследования сетевого взаимодействия показывают, что в ряде граничных состояний при асинхронных вызовах `NON_BLOCKING` сервер может не прислать явный фрейм `toolCallCancellation`, а интерпретировать реплику перебивания как смену темы в новом витке диалога. В связи с этим архитектура клиентского приложения должна связывать каждый активный вызов `call.id` с экземпляром `AbortController` и при получении флага `interrupted: true` прерывать локальные мутации интерфейса доски, предотвращая применение визуальных изменений к устаревшему контексту.

## Строгость валидации схем, таймауты и динамика инструментов в рамках сессии
Валидатор схем в протоколе `BidiGenerateContent` опирается на строгую типизацию Protobuf, не допускающую отклонений от формата метаданных. Любое синтаксическое несоответствие или нарушение регистра символов в перечислениях типов приводит к немедленному отклонению сессии с ошибкой `400 INVALID_ARGUMENT`.
Спецификация типов данных требует использования исключительно заглавных идентификаторов перечисления `Type`: `OBJECT`, `ARRAY`, `STRING`, `INTEGER`, `NUMBER` и `BOOLEAN`. Применение стандартных строчных литералов формата JSON Schema (`"object"`, `"string"`, `"number"`) отвергается валидатором на этапе десериализации. Кроме того, протокол запрещает объявление открытых нетипизированных объектов без описания полей (open-ended objects вида `{"type": "OBJECT"}` без вложенного словаря `properties`): такие структуры обязаны либо иметь строго типизированную иерархию, либо сериализоваться в строковый параметр `STRING` с документированным форматом.
В таблице систематизированы критические правила валидации и динамические ограничения сессии Gemini Live.

| Параметр спецификации | Допустимый формат / Значение | Запрещенный формат / Ошибка | Архитектурные последствия нарушения |
| --- | --- | --- | --- |
| Регистр типов (`Type`) | `"OBJECT"`, `"STRING"`, `"INTEGER"`, `"NUMBER"`, `"BOOLEAN"`, `"ARRAY"`[cite: 21, 22] | `"object"`, `"string"`, `"int"`, `"float"`, `"number"`, `"boolean"`, `"array"`[cite: 21] | Немедленный разрыв соединения с ошибкой `400 INVALID_ARGUMENT` на фазе рукопожатия. |
| Декларация объектов | Обязательное наличие типизированного словаря `properties`[cite: 5] | Пустой объект `{"type": "OBJECT"}` без `properties`[cite: 5] | Ошибка валидации структуры метаданных API при парсинге схемы. |
| Регистрация инструментов | Строго в первом сообщении `setup` (`first and only in the first message`) | Отправка повторного сообщения `setup` в активный WebSocket-канал | Принудительное закрытие сессии сервером вследствие нарушения контракта протокола. |
| Миграция набора инструментов | Использование механизма `SessionResumptionConfig` с дескриптором `newHandle`[cite: 13, 24] | Попытка динамической мутации реестра инструментов внутри одного сокета | Рассинхронизация контекста; необходимость полного перезапуска сессии с потерей истории. |
| SLA времени отклика | Возврат `toolResponse` в течение интервала $t_{\text{response}} \le 3000\text{ мс}$[cite: 6] | Блокировка ответа на время, превышающее лимит ожидания | Накопление расхождений между состоянием холста и генерацией ответов моделью. |

Архитектурный инвариант протокола гласит: динамическое включение или отключение инструментов посреди сессии через активный WebSocket невозможно. Если бизнес-логика требует изменения доступного инструментария (например, переход от фазы обсуждения архитектуры к фазе запуска тестов), приложение должно использовать протокол возобновления сессии. Клиент сохраняет последний полученный дескриптор из кадра `sessionResumptionUpdate.newHandle`, корректно закрывает текущее соединение, открывает новый сокет и передает в стартовом сообщении `setup` обновленный массив `tools` совместно с сохраненным `handle`, что обеспечивает непрерывность диалогового контекста.

## Защита от галлюцинаций вызова инструментов на нулевом шаге (Turn 0 Lockdown)
В голосовых сценариях со сложной бизнес-логикой (проведение технических интервью, аттестация, сдача нормативов) распространен критический дефект: модель преждевременно инициирует терминальные инструменты (например, `submit_interview_evaluation` или `finalize_assessment`) уже на нулевом шаге (Turn 0), реагируя на простое приветствие пользователя.
Причина кроется в оптимизации глобальной цели: видя в системной инструкции критерии выставления оценки и имея в реестре соответствующий инструмент, модель при малейшей паузе или короткой реплике («Здравствуйте, я готов начать») ошибочно пытается закрыть сценарий вызовом итоговой функции. Поскольку протокол `BidiGenerateContent` запрещает скрывать или добавлять инструменты динамически в рамках одного сокета, предотвращение преждевременных вызовов требует комплексной трехуровневой архитектурной защиты.

### 1. Архитектурный шлюз исполнения с защитой от отказов (Fail-Closed Execution Gate)
Клиентский диспетчер инструментов изолирует бизнес-логику от прямого исполнения вызовов модели. Диспетчер связывается с локальным конечным автоматом этапов сессии (`GREETING`, `SYSTEM_DESIGN`, `CODING`, `WRAP_UP`). Если от модели поступает вызов терминального инструмента на этапе `GREETING`, локальный обработчик перехватывает его, блокирует обращение к базе данных или сервису аттестации и возвращает валидный фрейм `toolResponse`, содержащий семантическое описание ошибки выполнения:

```json
{
  "functionResponses": [
    {
      "id": "call_eval_001",
      "name": "submit_interview_evaluation",
      "response": {
        "error": "PRECONDITION_FAILED",
        "message": "Evaluation cannot be submitted during greeting phase. The technical assessment is currently in progress."
      },
      "scheduling": "SILENT"
    }
  ]
}

```
Использование режима `scheduling: "SILENT"` предотвращает вокализацию ошибки моделью, позволяя ей незаметно скорректировать внутренний контекст и продолжить диалог без сбоя соединения.

### 2. Защита схемы через сессионные токены этапов (Phase-Gated Schemas)
В параметры терминальных инструментов добавляется обязательное строковое поле токена фазы (`phase_unlock_token`), без которого валидация параметров на стороне клиента не может быть пройдена:

```json
{
  "name": "submit_interview_evaluation",
  "behavior": "NON_BLOCKING",
  "parameters": {
    "type": "OBJECT",
    "properties": {
      "phase_unlock_token": {
        "type": "STRING",
        "description": "Cryptographic stage token provided exclusively when all technical questions are answered."
      },
      "verdict": {
        "type": "STRING",
        "enum": ["PASS", "FAIL"]
      }
    },
    "required": ["phase_unlock_token", "verdict"]
  }
}

```
Клиент генерирует данный токен и передает его в контекст через `clientContent` строго после наступления финального этапа диалога. На нулевом шаге модель не обладает данным токеном и не может сформировать валидный вызов.

### 3. Отрицательные директивы в системных инструкциях
В системную инструкцию (`systemInstruction`) закладываются декларативные запреты, прямо связывающие доступность инструментов с количеством совершенных реплик и текущим состоянием диалога:
CRITICAL LIFECYCLE DIRECTIVES:

1. PHASE 0 (Greeting Turn): You are strictly forbidden from calling 'submit_interview_evaluation'.
2. The greeting turn must be entirely conversational: introduce yourself, state the agenda, and ask the candidate to confirm their readiness.
3. Terminal evaluation tools become permissible only after at least 15 conversation turns and explicit verbal wrap-up.
Комбинация указанных трех рубежей обеспечивает полную защиту от преждевременного завершения сценария при сохранении неизменности конфигурации сессии.

## Производственные схемы инструментов для интерактивной доски и анализа кода
Ниже представлены эталонные декларации инструментов для манипуляции интерактивной доской и семантической инспекции кода, полностью совместимые с требованиями строгой типизации Protobuf и режимом `NON_BLOCKING` для модели `gemini-3.8-live`.

### Схема инструмента модификации доски (update_whiteboard)

```json
{
  "name": "update_whiteboard",
  "description": "Manipulates the interactive collaborative whiteboard canvas. Allows drawing architecture blocks, highlighting specific code lines, and rendering visual hints without interrupting speech.",
  "behavior": "NON_BLOCKING",
  "parameters": {
    "type": "OBJECT",
    "properties": {
      "operation": {
        "type": "STRING",
        "description": "Visual operation type to execute on the canvas.",
        "enum": ["HIGHLIGHT_SYNTAX", "DRAW_ARCHITECTURE_NODE", "CLEAR_LAYER", "PIN_NOTE"]
      },
      "target_file": {
        "type": "STRING",
        "description": "Active file URI or identifier open in the editor."
      },
      "line_range": {
        "type": "OBJECT",
        "description": "Code line boundaries to apply highlighting or visual annotations.",
        "properties": {
          "start_line": {
            "type": "INTEGER",
            "description": "Starting line number (1-indexed)."
          },
          "end_line": {
            "type": "INTEGER",
            "description": "Ending line number of the code span."
          }
        },
        "required": ["start_line", "end_line"]
      },
      "visual_metadata": {
        "type": "OBJECT",
        "description": "Styling parameters for whiteboard rendering.",
        "properties": {
          "color_hex": {
            "type": "STRING",
            "description": "Hexadecimal color code for the highlight (e.g. #FF5733)."
          },
          "label": {
            "type": "STRING",
            "description": "Annotation text to anchor next to the visual node."
          }
        },
        "required": ["color_hex"]
      }
    },
    "required": ["operation", "target_file"]
  }
}

```

### Схема инструмента инспекции исходного кода (inspect_code_snippet)

```json
{
  "name": "inspect_code_snippet",
  "description": "Asynchronously queries AST structures, complexity metrics, and execution diagnostics for a specific section of code on the whiteboard.",
  "behavior": "NON_BLOCKING",
  "parameters": {
    "type": "OBJECT",
    "properties": {
      "symbol_name": {
        "type": "STRING",
        "description": "Identifier name of the function, class, or variable to inspect."
      },
      "scope_depth": {
        "type": "INTEGER",
        "description": "Depth of call hierarchy or AST recursion."
      },
      "include_diagnostics": {
        "type": "BOOLEAN",
        "description": "Flag indicating whether compiler warnings and linter errors should be retrieved."
      }
    },
    "required": ["symbol_name"]
  }
}

```

## Референсная архитектура на TypeScript (@google/genai >= 2.3.0)
Представленная реализация клиентской подсистемы базируется на официальном пакете `@google/genai` версии 2.3.0 и выше. В ней реализованы:

- Инициализация полнодуплексной сессии `BidiGenerateContent` с аудиомодальностью.
- Регистрация неблокирующего инструмента с поведением `behavior: "NON_BLOCKING"`.
- Асинхронное исполнение команд графического движка параллельно с непрерывным воспроизведением входящего звука.
- Передача подтверждений выполнения через фрейм `toolResponse` с режимом планирования `scheduling: "SILENT"`.
- Отслеживание жизненного цикла на базе композитного состояния и маркера `interactionStatus`.
- Перехват прерываний пользователя (barge-in) с очисткой аудиобуферов и отменой активных операций через `AbortController`.

```typescript
import { GoogleGenAI } from '@google/genai';

export type InteractionStatus = 'INTERACTION_STATUS_UNSPECIFIED' | 'IN_PROGRESS' | 'IDLE';
export type ToolScheduling = 'SILENT' | 'WHEN_IDLE' | 'INTERRUPT';

interface FunctionCallPayload {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface WhiteboardCommand {
  operation: 'HIGHLIGHT_SYNTAX' | 'DRAW_ARCHITECTURE_NODE' | 'CLEAR_LAYER' | 'PIN_NOTE';
  target_file: string;
  line_range?: { start_line: number; end_line: number };
  visual_metadata?: { color_hex: string; label?: string };
}

export class WhiteboardEngine {
  public async executeCommand(
    cmd: WhiteboardCommand,
    abortSignal: AbortSignal
  ): Promise<{ applied: boolean; renderTimeMs: number }> {
    const startTime = performance.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (abortSignal.aborted) {
          reject(new DOMException('Whiteboard rendering aborted by user barge-in', 'AbortError'));
          return;
        }
        resolve({ applied: true, renderTimeMs: performance.now() - startTime });
      }, 50);

      abortSignal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }
}

export class AudioPlaybackDriver {
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;

  public enqueueChunk(pcm24kChunk: ArrayBuffer): void {
    this.audioQueue.push(pcm24kChunk);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  public clearPlaybackQueue(): void {
    this.audioQueue = [];
    this.isPlaying = false;
  }

  public get hasBufferedAudio(): boolean {
    return this.audioQueue.length > 0 || this.isPlaying;
  }

  private playNext(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;
    const chunk = this.audioQueue.shift();
    if (chunk) {
      setTimeout(() => this.playNext(), 20);
    }
  }
}

export class GeminiWhiteboardSessionCoordinator {
  private ai: GoogleGenAI;
  private whiteboard: WhiteboardEngine;
  private audioDriver: AudioPlaybackDriver;
  private activeToolAbortControllers: Map<string, AbortController> = new Map();
  private pendingToolsCount = 0;
  private currentInteractionStatus: InteractionStatus = 'IDLE';

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.whiteboard = new WhiteboardEngine();
    this.audioDriver = new AudioPlaybackDriver();
  }

  public async startSession(): Promise<void> {
    const session = await (this.ai as any).live.connect({
      model: 'models/gemini-3.8-live-extended-thinking',
      config: {
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: 'You are an expert technical interviewer and systems architect. ' +
                    'Explain technical concepts verbally while simultaneously highlighting code ' +
                    'and diagrams on the collaborative whiteboard. Speak continuously while manipulating the canvas.',
            },
          ],
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'update_whiteboard',
                description: 'Manipulates the interactive collaborative whiteboard canvas while speaking.',
                behavior: 'NON_BLOCKING',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    operation: {
                      type: 'STRING',
                      enum: ['HIGHLIGHT_SYNTAX', 'DRAW_ARCHITECTURE_NODE', 'CLEAR_LAYER', 'PIN_NOTE'],
                    },
                    target_file: { type: 'STRING' },
                    line_range: {
                      type: 'OBJECT',
                      properties: {
                        start_line: { type: 'INTEGER' },
                        end_line: { type: 'INTEGER' },
                      },
                      required: ['start_line', 'end_line'],
                    },
                    visual_metadata: {
                      type: 'OBJECT',
                      properties: {
                        color_hex: { type: 'STRING' },
                        label: { type: 'STRING' },
                      },
                      required: ['color_hex'],
                    },
                  },
                  required: ['operation', 'target_file'],
                },
              },
            ],
          },
        ],
      },
    });

    this.listenServerEvents(session);
  }

  private async listenServerEvents(session: any): Promise<void> {
    for await (const message of session.receive()) {
      if (message.serverContent?.interrupted) {
        this.handleUserInterruption();
      }

      if (message.toolCallCancellation?.ids) {
        for (const cancelledId of message.toolCallCancellation.ids) {
          const controller = this.activeToolAbortControllers.get(cancelledId);
          if (controller) {
            controller.abort();
            this.activeToolAbortControllers.delete(cancelledId);
          }
        }
      }

      const parts = message.serverContent?.modelTurn?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/pcm')) {
            const buffer = Buffer.from(part.inlineData.data, 'base64').buffer;
            this.audioDriver.enqueueChunk(buffer);
          }
        }
      }

      if (message.toolCall?.functionCalls) {
        for (const call of message.toolCall.functionCalls) {
          this.dispatchNonBlockingTool(session, call);
        }
      }

      if (message.serverContent?.interactionStatus) {
        this.currentInteractionStatus = message.serverContent.interactionStatus as InteractionStatus;
        this.evaluateClientReadinessState();
      }
    }
  }

  private async dispatchNonBlockingTool(session: any, call: FunctionCallPayload): Promise<void> {
    this.pendingToolsCount++;
    const abortController = new AbortController();
    this.activeToolAbortControllers.set(call.id, abortController);

    try {
      if (call.name === 'update_whiteboard') {
        const cmd = call.args as unknown as WhiteboardCommand;
        const result = await this.whiteboard.executeCommand(cmd, abortController.signal);

        await session.sendToolResponse({
          functionResponses: [
            {
              id: call.id,
              name: call.name,
              response: { status: 'SUCCESS', renderStats: result },
              scheduling: 'SILENT' as ToolScheduling,
            },
          ],
        });
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        await session.sendToolResponse({
          functionResponses: [
            {
              id: call.id,
              name: call.name,
              response: { status: 'ERROR', message: (err as Error).message },
              scheduling: 'SILENT' as ToolScheduling,
            },
          ],
        });
      }
    } finally {
      this.activeToolAbortControllers.delete(call.id);
      this.pendingToolsCount--;
      this.evaluateClientReadinessState();
    }
  }

  private handleUserInterruption(): void {
    this.audioDriver.clearPlaybackQueue();

    for (const [id, controller] of this.activeToolAbortControllers.entries()) {
      controller.abort();
      this.activeToolAbortControllers.delete(id);
    }
  }

  private evaluateClientReadinessState(): void {
    const isServerIdle = this.currentInteractionStatus === 'IDLE';
    const noPendingTools = this.pendingToolsCount === 0;
    const noAudioPlaying = !this.audioDriver.hasBufferedAudio;

    if (isServerIdle && noPendingTools && noAudioPlaying) {
      this.notifyUIReadyForUserInput();
    }
  }

  private notifyUIReadyForUserInput(): void {
    // Переключение пользовательского интерфейса в режим ожидания реплики
  }
}

```

## Выводы и архитектурные рекомендации
Интеграция асинхронного вызова инструментов в потоковом протоколе Gemini 3.8 Live позволяет устранить компромисс между естественностью диалога и интерактивностью визуального интерфейса. Для построения устойчивых производственных систем рекомендуется следовать ключевым правилам:
Перевод всех интерактивных инструментов визуализации на режим `behavior: "NON_BLOCKING"` исключает возникновение пауз в аудиовыводе и обеспечивает синхронность визуального и речевого фокуса. Клиентский конечный автомат обязан отслеживать статус `interactionStatus: "IDLE"` в сочетании со сбросом внутренних очередей рендеринга и воспроизведения звука, полностью отказавшись от трактовки изолированного флага `turnComplete: true` как сигнала окончания обработки хода.
Для подтверждения успешных визуальных операций доски необходимо использовать режим `scheduling: "SILENT"`, что изолирует контекст от возникновения паразитных повторных фраз и заиканий модели. Защита от преждевременного вызова терминальных инструментов на нулевом шаге должна обеспечиваться комбинацией клиентского шлюза исполнения с политикой отказа по умолчанию, внедрением сессионных токенов фаз и жесткими системными директивами, не нарушая неизменяемости первичного фрейма `setup`. Наконец, строгая типизация параметров схемы исключительно прописными идентификаторами Protobuf (`OBJECT`, `STRING`, `INTEGER`) предотвращает фатальные сбои десериализации на сетевом уровне API.

---

Source: https://gemini.google.com/app/43de85fae01bb2fa?hl=ru
Exported at: 2026-10-08T14:44:03.484Z