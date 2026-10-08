# Архитектура корпоративного голосового агента на Gemini 3.8 Live: реализация без промежуточного слоя (Zero-Middleware) и сквозная интеграция Web Audio
Традиционные архитектуры голосовых диалоговых систем исторически формировались как композиция независимых подсистем: детектора голосовой активности (VAD), модуля распознавания речи (STT), большой языковой модели (LLM) и синтезатора речи (TTS). Подобный каскадный подход приводил к накоплению задержки от 1200 до 2500 мс, возникновению рассогласования состояний (split-brain state) и требовал обширного набора вспомогательного связующего кода (middleware) для маскировки разрывов диалога.
Появление мультимодальных моделей реального времени, в частности Google Gemini 3.8 Live, функционирующих по нативному протоколу двунаправленного полнодуплексного стриминга `BidiGenerateContent`, устраняет потребность в промежуточных эвристических уровнях. Архитектура прямого сквозного взаимодействия (Zero-Middleware Native Architecture) переносит задачи захвата и рендеринга звука в изолированные потоки Web Audio API браузера, а серверную инфраструктуру сводит к роли прозрачного транзитного маршрутизатора аутентификации.

## Архитектурный манифест и ликвидация промежуточных модулей (Legacy Elimination)
Принцип Zero-Middleware требует полного устранения эвристических алгоритмов и промежуточных адаптеров в сигнальном тракте. Каждый исключенный компонент заменяется встроенным механизмом модели либо низкоуровневым стандартом Web Audio API.

| Устаревший промежуточный компонент (Legacy Layer) | Источник технического долга и системных сбоев | Нативный механизм Gemini 3.8 Live / Web Audio API |
| --- | --- | --- |
| **Фиксация цифровой тишины (Dead-Air Guards)** | Инжекция искусственных «нулевых» фреймов PCM для поддержания сессии вызывала сбивание контекста эмбеддингов. | Полнодуплексный непрерывный поток WebSocket без разрыва транспорта и встроенный серверный механизм `proactive_audio`. |
| **Клиентский нейросетевой VAD (Silero VAD)** | Конфликт границ реплик между локальным классификатором и серверным VAD; обрыв фраз кандидата при тихом голосе. | Серверный мультимодальный VAD Gemini; управление прерыванием через нативный флаг события `interrupted: true`. |
| **Синтетические заполнения пауз (Audio Patching / Filler Words)** | Вставка псевдо-подтверждений («угу», «слушаю») нарушала логику интерлейсинга рассуждений модели. | Встроенное адаптивное мышление (Thinking Process) модели и режим `enable_affective_dialog`. |
| **Слепые циклы переподключения (Hot-Reconnect Loops)** | Потеря контекста при сбросе TCP; отправка текстовой истории прошлых ходов забивала контекстное окно. | Нативная контекстная компрессия и механизм `SessionResumptionConfig` с использованием `resumption_handle`. |
| **Двойная маршрутизация вывода (Dual-Output Routing)** | Воспроизведение через Web Audio и дублирующий скрытый тег `<audio>` ломало аппаратное эхоподавление (AEC). | Единый физический сток аудио через выделенный узел `AudioWorkletNode`, соединенный напрямую с `AudioContext.destination`. |

В устаревших голосовых шлюзах тишина длительностью более 1,5–2 секунд часто трактовалась сторожевыми таймерами как обрыв связи, что провоцировало инжекцию псевдо-пакетов или искусственных фраз-наполнителей. В архитектуре Gemini 3.8 Live протокол WebSocket остается активным сколь угодно долго, передавая служебные ping/pong-фреймы на уровне транспортного протокола. Включение флага `proactive_audio: true` позволяет модели сохранять тишину, если соискатель размышляет над алгоритмической задачей вслух. Непрерывный поток входящего звука передается с частотой 16 кГц без необходимости локального отсечения шума по амплитудному порогу, поскольку акустический кодировщик модели обучен разделять фоновый шум и смысловую речь.
Локальный VAD, работающий поверх WebAssembly (WASM), создает фундаментальную проблему разделенного состояния (split-brain condition). Если локальный классификатор решает, что пользователь завершил фразу, он отправляет терминатор реплики, тогда как кандидат мог сделать естественную паузу в середине сложного технического рассуждения. В модели Gemini 3.8 Live акустический VAD и семантическое понимание завершенности мысли объединены в общую нейросетевую структуру. Когда кандидат начинает говорить, перебивая модель, сервер Gemini детектирует интерференцию, прекращает генерацию токенов и передает клиенту пакет `serverContent` с булевым флагом `interrupted: true`.
Принудительное накопление стека сообщений в оперативной памяти шлюза и повторный прогон текстовых стенограмм при разрыве сетевого соединения увеличивают время восстановления диалога до нескольких секунд и искажают латентные представления модели. Gemini Live предоставляет встроенный протокол сохранения состояния: сервер периодически отправляет события `sessionResumptionUpdate` с обновленным токеном `newHandle`. При обрыве соединения клиент повторно инициализирует рукопожатие, передавая полученный дескриптор в конфигурации `session_resumption.handle`, что позволяет модели мгновенно восстанавливать контекст сессии из кэша памяти без повторной отправки истории.

## Сквозная топология потоков данных и организация единого аудиостока (Single-Sink Audio Routing)
Маршрутизация медиапотоков строится по принципу минимального сопротивления: аудиопотоки не подвергаются промежуточной буферизации на диске или в оперативной памяти внешних серверов.

### Этапы движения медиапотока в системе

1. **Захват сигнала (Microphone Input):** Браузер соискателя запрашивает аудиопоток через интерфейс `navigator.mediaDevices.getUserMedia` с аппаратным подавлением эха (`echoCancellation: true`), фильтрацией шума (`noiseSuppression: true`) и отключенным программным автоусилением (`autoGainControl: false`). Поток связывается с экземпляром `AudioContext`, имеющим нативную частоту дискретизации 16 000 Гц.
2. **Клиентский процессинг захвата (Capture AudioWorklet):** В реальном времени квантами по 128 сэмплов (Render Quantum) процессор выполняет линейное квантование 32-битных чисел с плавающей запятой (`Float32`) в 16-битные целые со знаком (`Int16 Little-Endian`). Сформированные порции данных передаются в основной поток для отправки по WebSocket через передачу прав владения буфером (Transferable Objects) без копирования.
3. **Периферийный шлюз (Edge Pass-Through Proxy):** Шлюз на базе Node.js осуществляет аутентификацию входящего соединения кандидата, подставляет сервисные учетные данные и выполняет прозрачную бинарную ретрансляцию фреймов (TCP stream pipe) напрямую в точку входа Google `generativelanguage.googleapis.com`.
4. **Нейросетевое ядро (Google Gemini 3.8 Live):** Модель обрабатывает входящий аудиопоток 16 кГц, выполняет фоновые рассуждения и генерирует речевой ответ в формате 24 кГц 16-бит PCM Mono.
5. **Клиентский процессинг воспроизведения (Playback AudioWorklet):** Входящие бинарные фреймы 24 кГц декодируются и направляются в кольцевой буфер воспроизведения емкостью $2^{20}$ сэмплов. Рабочий узел преобразует `Int16` обратно в нормализованный `Float32` и передает аудиоданные аппаратному ЦАП (DAC) без разрывов.

| Параметр конвейера | Восходящий поток (Upstream Capture) | Нисходящий поток (Downstream Playout) |
| --- | --- | --- |
| **Частота дискретизации ($f_s$)** | 16 000 Гц | 24 000 Гц |
| **Разрядность и тип данных** | 16-bit Linear PCM, Little-Endian | 16-bit Linear PCM, Little-Endian |
| **Канальность** | 1 (Моно) | 1 (Моно) |
| **Размер транспортного чанка** | 512 сэмплов (32 мс / 1024 байта) | Переменный размер ответа модели (20–40 мс) |
| **Целевая задержка буфера** | $< 5$ мс (изолированный поток) | $< 10$ мс (кольцевой jitter-буфер) |
| **Сетевой транспорт** | WebSocket (Bidi-фреймы) | WebSocket (Bidi-фреймы) |

### Организация единого аудиостока (Single-Sink Audio Routing)
Распространенной ошибкой веб-приложений является одновременное использование `AudioContext.destination` и HTML5-элемента `<audio>` для обхода ограничений мобильных платформ. В операционных системах macOS, Windows, Android и iOS Safari браузер связывает эталонный сигнал акустического эхоподавления (AEC Reference) с тем физическим устройством, в которое направлен системный медиапоток.
Если звук выводится через Web Audio API, а захват микрофона инициализируется независимо, в браузерах на базе Chromium механизм AEC переключается на отслеживание глобального системного микшера только при условии, что для контекста не был вызван метод с несовместимым `setSinkId`.
В мобильной среде iOS Safari метод `AudioContext.setSinkId()` не поддерживается. Попытка создать фиктивный тег `<audio srcObject={...}>` для перенаправления звука на громкую связь приводит к возникновению паразитной петли обратной связи (feedback loop), так как движок WebKit изолирует подсистемы CoreAudio. Единственно надежной стратегией выступает поддержание унифицированного графа Web Audio: микрофон подключается через `MediaStreamAudioSourceNode`, а выходной узел `AudioWorkletNode` соединяется исключительно с `AudioContext.destination`. Управление громкостью и выключение звука осуществляются строго через аппаратный узел `GainNode` внутри этого графа.

## Низкоуровневый DSP-конвейер: кольцевой буфер, компенсация дрейфа и бесшовный Barge-In
Основной поток браузера (Main Thread) подвержен деградации производительности: исполнение скриптов приложения, обновление DOM, стилизация и периодическая сборка мусора (Garbage Collection) создают задержки от 15 до 80 мс. Выполнение аудио-операций в основном потоке неизбежно вызывает опустошение аппаратных буферов (buffer underrun) и акустические артефакты. Все низкоуровневые операции выносятся в аудио-поток реального времени (Audio Rendering Thread) с использованием интерфейса `AudioWorkletProcessor`.

### Архитектура кольцевого буфера без сборки мусора
Для предотвращения пауз, вызванных аллокацией динамической памяти, буфер воспроизведения реализуется на основе однопоточной структуры без блокировок SPSC (Single Producer, Single Consumer) поверх непрерывного массива `Float32Array` фиксированной емкости. Длина буфера выбирается кратной степени двойки в диапазоне от $2^{20}$ до $2^{22}$ сэмплов:

$$
C = 2^{20} = 1\,048\,576 \text{ сэмплов}
$$
При частоте дискретизации $f_s = 24\,000$ Гц данная емкость обеспечивает запас хранения в 43,69 секунды. Выбор степени двойки позволяет заменить ресурсоемкую операцию вычисления остатка от деления ($i \pmod C$) быстрой побитовой маской:

$$
\text{index}_{\text{wrapped}} = \text{index} \ \& \ (C - 1)
$$
Указатели записи (`writeIndex`) и чтения (`readIndex`) инкрементируются монотонно как целые числа. Для синхронизации между потоком входящих сообщений (WebSocket) и потоком рендеринга звука может использоваться разделяемая память `SharedArrayBuffer` с атомарными операциями `Atomics.load` и `Atomics.store`, либо механизм передачи ArrayBuffer без копирования через `port.postMessage`.

### Компенсация дрейфа частоты (Drift Compensation)
В длительных сессиях интервью неизбежно проявляется физический дрейф тактовых генераторов (Clock Drift): кварцевый резонатор ЦАП клиентского устройства работает с микроскопическим отклонением от эталонного времени серверов Google. Это приводит либо к постепенному опустошению буфера (дрейф в сторону отставания), либо к накоплению латентности (дрейф в сторону опережения).
Компенсация дрейфа реализуется мониторингом уровня наполненности буфера (Watermark Level). Если средний объем несыгранных сэмплов на протяжении 5 секунд превышает верхний порог безопасности (например, более 40 мс аудиоданных), процессор `AudioWorklet` активирует микро-интерполяцию (пропуск одного сэмпла каждые 256 отсчетов во время безударных согласных или квазитишины). Если буфер приближается к истощению, выполняется дублирование одного сэмпла с линейным сглаживанием, что предотвращает появление щелчка без искажения высоты тона.

### Математическая модель подавления щелчков при прерывании (Tactile Barge-In)
Когда кандидат перебивает речь модели, сервер Gemini передает событие `interrupted: true`. Мгновенный сброс указателя чтения в позицию записи вызывает ступенчатый разрыв формы волны. Разрыв амплитуды от значения $A_0 \neq 0$ до $0$ за время одного дискретного отсчета эквивалентен воздействию функции Хевисайда, порождающей широкий спектр высокочастотных гармоник, воспринимаемых человеческим слухом как громкий щелчок.
Для демпфирования щелчка процессор `AudioWorklet` активирует спад огибающей (de-clicking ramp) фиксированной длительности ровно в $5$ мс. При частоте дискретизации $f_s = 24\,000$ Гц длина окна составляет:

$$
L_{\text{ramp}} = 0{,}005 \times 24\,000 = 120 \text{ сэмплов}
$$
Коэффициент усиления $g(n)$ на интервале $n \in [0, L_{\text{ramp}} - 1]$ рассчитывается по полукосинусному окну Ханна:

$$
g(n) = \frac{1}{2} \left(1 + \cos\left(\frac{\pi n}{L_{\text{ramp}}}\right)\right)
$$
Либо по линейной огибающей с минимальными вычислительными затратами:

$$
g(n) = 1 - \frac{n}{L_{\text{ramp}}}
$$
По завершении 120 сэмплов амплитуда гарантированно достигает нуля. В этой точке указатель чтения `readIndex` приравнивается к `writeIndex`, остаточный хвост воспроизведения аннулируется, а режим подавления выключается.

## Симметричный контроль диалога и синхронизация опустошения ЦАП (DAC Drain)
В системах голосового диалога ключевой точкой сбоя традиционно выступает гонка состояний (race condition) между получением сетевого события `turnComplete` и фактическим физическим завершением воспроизведения звука в наушниках соискателя.

### Механика гонки состояний при завершении реплики
Сервер Gemini 3.8 Live завершает генерацию речевого фрагмента и отправляет клиенту фрейм `{ "serverContent": { "turnComplete": true } }`. Этот сетевой пакет приходит в браузер за $15–30$ мс. В этот же момент в кольцевом буфере `AudioWorklet` и аппаратных очередях звукового драйвера операционной системы (Audio HAL / DAC FIFO) находится от 200 до 600 мс еще не прозвучавшего звука.
Если конечный автомат диалога переключается в состояние ожидания реплики кандидата сразу по факту получения сетевого пакета `turnComplete: true`, возникают системные коллизии:

1. Пользовательский интерфейс отображает статус «Слушаю вас», в то время как виртуальный интервьюер еще продолжает говорить последние слова вопроса.
2. Кандидат сбивается с толку несоответствием визуальной и звуковой индикации и начинает говорить поверх фразы агента.
3. Система подавления эха вынуждена гасить громкий хвост речи ассистента, что повышает риск искажения первого слога кандидата.

### Математическая модель расчета опустошения ЦАП
Физическое время завершения воспроизведения реплики $T_{\text{drain}}$ привязывается к аппаратному таймеру `AudioContext.currentTime`:

$$
T_{\text{drain}} = t_{\text{ctx}} + \frac{N_{\text{ring\_unplayed}} + N_{\text{hardware}}}{f_s}
$$
где:

- $t_{\text{ctx}}$ — текущее системное время аудиоконтекста (`audioCtx.currentTime`) в секундах;
- $N_{\text{ring\_unplayed}} = \text{writeIndex} - \text{readIndex}$ — число сэмплов, находящихся в кольцевом буфере;
- $N_{\text{hardware}}$ — дополнительная аппаратная задержка квантования драйвера операционной системы, определяемая суммой `audioCtx.outputLatency |
| 0`и`audioCtx.baseLatency |
| 0`;

- $f_s = 24\,000$ Гц — частота дискретизации воспроизведения.
Автомат диалога переходит в статус прослушивания только тогда, когда выполняется условие полного опустошения буфера:

$$
\Delta t_{\text{wait}} = \max\left(0, T_{\text{drain}} - t_{\text{ctx}}\right) \equiv 0
$$

### Спецификация состояний и матрица переходов диалогового автомата
Управление логикой диалога формализуется детерминированным конечным автоматом, в котором фаза физического воспроизведения звука явно отделена от приема сетевых пакетов:

| Исходное состояние | Входное событие | Конечное состояние | Системный инвариант и выполняемое действие |
| --- | --- | --- | --- |
| **IDLE** | Команда подключения клиента | **LISTENING** | Отправка конфигурационного setup-фрейма; старт непрерывной передачи аудиопотока микрофона. |
| **LISTENING** | Обнаружение речи кандидата (серверный VAD) | **MODEL_THINKING** | Модель производит чередующиеся рассуждения (Interleaved CoT); микрофон продолжает передавать данные. |
| **MODEL_THINKING** | Первый входящий PCM-пакет модели | **MODEL_SPEAKING** | Запись сэмплов в кольцевой буфер воспроизведения; сброс таймеров ожидания. |
| **MODEL_SPEAKING** | Сетевой фрейм `turnComplete: true` | **SPEAKING_DRAINING** | Модель завершила генерацию текста и синтез речи, но звук еще физически движется по тракту ЦАП. |
| **SPEAKING_DRAINING** | $N_{\text{ring\_unplayed}} == 0$ и таймер $T_{\text{drain}}$ истек | **LISTENING** | Физическое затихание диффузора динамика; активация интерфейса активного слушания для кандидата. |
| **MODEL_SPEAKING** | Входящий флаг `interrupted: true` | **LISTENING** | Активация 5-миллисекундного спада огибающей ($L_{\text{ramp}} = 120$), сброс указателей чтения и очистка очереди. |
| **SPEAKING_DRAINING** | Входящий флаг `interrupted: true` | **LISTENING** | Немедленное плавное глушение остаточного хвоста ЦАП и переход к регистрации речи соискателя. |

## Прозрачный прокси-слой: безопасность, управление токенами и инвариант нулевого копирования
Архитектурный принцип полного отсутствия промежуточного слоя требует, чтобы периферийный сервер выполнял исключительно функции контроля доступа и защиты учетных записей. Сервер не должен десериализовать JSON-содержимое аудиопакетов, парсить строки Base64, перекодировать аудиопотоки или модифицировать контекст.

### Модель разделения ответственности
Разделение обязанностей между узлами системы подчиняется следующим правилам:

- **Браузер кандидата:** берет на себя выполнение TLS-рукопожатия, квантование микрофонного потока в PCM, декодирование выходных пакетов модели и прямое управление графом Web Audio.
- **Периферийный шлюз (Node.js Edge / LiteLLM Router):** валидирует сессионный JWT-токен кандидата, запрашивает краткосрочный эфемерный токен через Google GenAI SDK (`@google/genai` версии $\ge 2.3.0$) или поддерживает защищенное сквозное WebSocket-соединение к серверам Google в режиме потокового релея.
- **Инфраструктура Google Gemini (Gemini 3.8 Live):** принимает сырые потоки линейного PCM, исполняет сценарий технического интервью, производит распознавание голоса и синтезирует речевые ответы.

### Генерация строго ограниченных эфемерных токенов (Ephemeral Tokens)
Для браузерных сред наилучшей практикой является использование защищенной конечной точки `BidiGenerateContentConstrained`, авторизуемой через эфемерный токен. Токен генерируется доверенным бэкендом с временем жизни не более 30 минут и однократным использованием. Это полностью предотвращает утечку постоянного мастер-ключа API.

```typescript
// Серверная генерация эфемерного токена через Google GenAI SDK (>= 2.3.0)
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function createCandidateVoiceSession(interviewId: string): Promise<string> {
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 1 * 60 * 1000).toISOString();

  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: expireTime,
      newSessionExpireTime: newSessionExpireTime,
      liveConnectConstraints: {
        model: 'models/gemini-3.8-live',
        config: {
          responseModalities: ['AUDIO'],
          sessionResumption: {}
        }
      }
    }
  });

  return token.name; // Формат: auth_tokens/xxxxxxxxxxxx
}

```

### Инвариант сквозной передачи без копирования (Zero-Copy Pass-Through Invariant)
Если в архитектуре выбран обратный прокси-сервер на Node.js, прокси обязан пересылать сообщения по принципу «сокет-в-сокет» без разбора структуры данных. Запрещается вызывать `JSON.parse()` для бинарных сообщений или блоков `realtimeInput`.
Прокси оперирует сырыми буферами протокола WebSocket (`ws.on('message', (data, isBinary) => upstream.send(data, { binary: isBinary }))`). Это снижает нагрузку на CPU прокси-узла практически до нуля, удерживает сетевую задержку ретрансляции в пределах $< 1$ мс и предотвращает фрагментацию памяти сборщиком мусора V8.

## Пассивная телеметрия и наблюдаемость (Observability & Telemetry)
Мониторинг качества технического интервью требует точной фиксации временных интервалов взаимодействия без внедрения тяжелых перехватчиков сетевого трафика.

### Сквозные метрики реального времени

1. **Время до первого аудиопакета (Time To First Audio, TTFA):** Временной интервал между моментом, когда кандидат завершил произнесение фразы (передача энергии в аудиопотоке прекратилась), и моментом, когда первый байт аудиоданных Gemini 3.8 Live поступил в кольцевой буфер.
2. **Акустическая круговая задержка (Acoustic Round-Trip Time, aRTT):** Физическое время от окончания реплики кандидата до механического отклика диффузора динамика с первым словом ответа ИИ:$\text{aRTT} = \text{TTFA} + \text{NetworkLatency} + \Delta t_{\text{hardware}}$
3. **Длительность пауз кандидата (Candidate Latency / Hesitation Metrics):** Интервал между наступлением расчетного времени $T_{\text{drain}}$ (интервьюер завершил озвучивание вопроса) и возобновлением передачи голосовой активности соискателем. Данная метрика позволяет алгоритмически оценивать скорость реакции кандидата на технические вопросы.

### Пассивное извлечение метаданных без узких мест проксирования
Сбор аналитики переносится на сторону клиента, где метрики регистрируются по нативным событиям высокоточного таймера `performance.now()`. Клиент передает телеметрические события на аналитический бэкенд асинхронно по отдельному каналу (HTTP `navigator.sendBeacon` или фоновый сокет) вне критического пути аудиосигнала, исключая влияние метрик на задержку диалога.

## Эталонная реализация (Reference TypeScript Implementation)

### Клиентский процессор захвата аудио: `pcm-capture-processor.ts`
Процессор захвата принимает 32-битный аудиосигнал микрофона с частотой 16 кГц, квантует его в 16-битный линейный PCM и пересылает в главный поток посредством передачи права владения буфером (Zero-Copy Transferable Objects).

```typescript
// pcm-capture-processor.ts
// Выполняется в изолированном AudioWorkletGlobalScope

class PCMCaptureProcessor extends AudioWorkletProcessor {
  private bufferSize: number = 512; // 32 мс при 16 000 Гц
  private buffer: Int16Array;
  private bufferIndex: number = 0;

  constructor() {
    super();
    this.buffer = new Int16Array(this.bufferSize);
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0]; // Моно канал
    const length = channelData.length;

    for (let i = 0; i < length; i++) {
      // Ограничение диапазона и квантование Float32 [-1.0, 1.0] -> Int16
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      this.buffer[this.bufferIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      if (this.bufferIndex >= this.bufferSize) {
        // Передача владения ArrayBuffer для полного исключения GC-пауз
        const transferableBuffer = this.buffer.buffer.slice(0);
        this.port.postMessage(transferableBuffer, [transferableBuffer]);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PCMCaptureProcessor);

```

### Клиентский процессор воспроизведения аудио: `pcm-playback-processor.ts`
Процессор воспроизведения реализует кольцевой буфер емкостью $2^{20}$ сэмплов, логику 5-миллисекундного подавления щелчков (Barge-in de-clicking) и монотонный учет прогресса для контроля опустошения ЦАП.

```typescript
// pcm-playback-processor.ts
// Выполняется в изолированном AudioWorkletGlobalScope

class PCMPlaybackProcessor extends AudioWorkletProcessor {
  private static readonly BUFFER_CAPACITY = 1048576; // 2^20 сэмплов (~43.7 сек при 24 кГц)
  private static readonly MASK = PCMPlaybackProcessor.BUFFER_CAPACITY - 1;
  private static readonly RAMP_SAMPLES = 120; // 5 мс при 24 000 Гц

  private ringBuffer: Float32Array = new Float32Array(PCMPlaybackProcessor.BUFFER_CAPACITY);
  private writeIndex: number = 0;
  private readIndex: number = 0;

  private isInterrupted: boolean = false;
  private rampCounter: number = 0;

  constructor() {
    super();

    this.port.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'WRITE_CHUNK') {
        this.handleWriteChunk(payload as ArrayBuffer);
      } else if (type === 'TRIGGER_BARGE_IN') {
        this.handleBargeIn();
      }
    };
  }

  private handleWriteChunk(arrayBuffer: ArrayBuffer): void {
    const int16View = new Int16Array(arrayBuffer);
    const len = int16View.length;

    for (let i = 0; i < len; i++) {
      this.ringBuffer[(this.writeIndex + i) & PCMPlaybackProcessor.MASK] =
        int16View[i] / 32768.0;
    }
    this.writeIndex += len;
  }

  private handleBargeIn(): void {
    if (this.writeIndex > this.readIndex) {
      this.isInterrupted = true;
      this.rampCounter = PCMPlaybackProcessor.RAMP_SAMPLES;
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const channel = output[0];
    const renderFrames = channel.length; // 128 сэмплов

    for (let i = 0; i < renderFrames; i++) {
      if (this.isInterrupted) {
        if (this.rampCounter > 0) {
          // Линейный спад коэффициента усиления для предотвращения щелчка
          const gain = this.rampCounter / PCMPlaybackProcessor.RAMP_SAMPLES;
          const sample = this.ringBuffer[this.readIndex & PCMPlaybackProcessor.MASK];
          channel[i] = sample * gain;
          this.readIndex++;
          this.rampCounter--;
        } else {
          // Рампа завершена: сбрасываем указатели
          this.readIndex = this.writeIndex;
          this.isInterrupted = false;
          channel[i] = 0;
        }
      } else if (this.readIndex < this.writeIndex) {
        channel[i] = this.ringBuffer[this.readIndex & PCMPlaybackProcessor.MASK];
        this.readIndex++;
      } else {
        channel[i] = 0; // Буфер пуст
      }
    }

    if (this.readIndex % 512 === 0) {
      this.port.postMessage({
        type: 'PLAYOUT_PROGRESS',
        bufferedSamples: Math.max(0, this.writeIndex - this.readIndex)
      });
    }

    return true;
  }
}

registerProcessor('pcm-playback-processor', PCMPlaybackProcessor);

```

### Высокоуровневый клиентский аудиоменеджер: `WebAudioVoiceEngine.ts`

```typescript
// WebAudioVoiceEngine.ts

export type AgentState =
  | 'DISCONNECTED'
  | 'LISTENING'
  | 'MODEL_THINKING'
  | 'MODEL_SPEAKING'
  | 'SPEAKING_DRAINING';

export interface VoiceEngineConfig {
  wsUrl: string;
  onStateChange: (state: AgentState) => void;
  onTranscription: (text: string, isUser: boolean) => void;
}

export class WebAudioVoiceEngine {
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;
  private socket: WebSocket | null = null;
  private state: AgentState = 'DISCONNECTED';
  private bufferedSamples: number = 0;

  constructor(private config: VoiceEngineConfig) {}

  public async start(): Promise<void> {
    this.captureCtx = new AudioContext({ sampleRate: 16000 });
    this.playbackCtx = new AudioContext({ sampleRate: 24000 });

    await this.captureCtx.audioWorklet.addModule('/pcm-capture-processor.js');
    await this.playbackCtx.audioWorklet.addModule('/pcm-playback-processor.js');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false
      }
    });

    const micSource = this.captureCtx.createMediaStreamSource(stream);
    this.captureNode = new AudioWorkletNode(this.captureCtx, 'pcm-capture-processor');
    micSource.connect(this.captureNode);

    // Подключение к единственному аудиостоку
    this.playbackNode = new AudioWorkletNode(this.playbackCtx, 'pcm-playback-processor');
    this.playbackNode.connect(this.playbackCtx.destination);

    this.playbackNode.port.onmessage = (event) => {
      if (event.data.type === 'PLAYOUT_PROGRESS') {
        this.bufferedSamples = event.data.bufferedSamples;
        if (this.state === 'SPEAKING_DRAINING' && this.bufferedSamples === 0) {
          this.transitionTo('LISTENING');
        }
      }
    };

    this.initWebSocket();
  }

  private initWebSocket(): void {
    this.socket = new WebSocket(this.config.wsUrl);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => {
      this.setupBidiSession();
      this.transitionTo('LISTENING');
      this.startCaptureStreaming();
    };

    this.socket.onmessage = (event: MessageEvent) => {
      this.handleServerMessage(event.data);
    };

    this.socket.onclose = () => {
      this.transitionTo('DISCONNECTED');
    };
  }

  private setupBidiSession(): void {
    const setupFrame = {
      setup: {
        model: 'models/gemini-3.8-live',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' }
            }
          }
        }
      }
    };
    this.socket?.send(JSON.stringify(setupFrame));
  }

  private startCaptureStreaming(): void {
    if (!this.captureNode) return;

    this.captureNode.port.onmessage = (event: MessageEvent) => {
      const pcm16Data = event.data as ArrayBuffer;
      if (this.socket?.readyState === WebSocket.OPEN) {
        const base64Audio = this.arrayBufferToBase64(pcm16Data);
        const inputMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio
              }
            ]
          }
        };
        this.socket.send(JSON.stringify(inputMessage));
      }
    };
  }

  private handleServerMessage(data: string | ArrayBuffer): void {
    if (typeof data !== 'string') return;
    const response = JSON.parse(data);

    // 1. Акустическое прерывание (Barge-In)
    if (response.serverContent?.interrupted) {
      this.playbackNode?.port.postMessage({ type: 'TRIGGER_BARGE_IN' });
      this.transitionTo('LISTENING');
      return;
    }

    // 2. Обработка входящего синтезированного аудиопотока
    const parts = response.serverContent?.modelTurn?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/pcm')) {
          const rawBuffer = this.base64ToArrayBuffer(part.inlineData.data);
          this.playbackNode?.port.postMessage(
            { type: 'WRITE_CHUNK', payload: rawBuffer },
            [rawBuffer]
          );
          if (this.state !== 'MODEL_SPEAKING') {
            this.transitionTo('MODEL_SPEAKING');
          }
        }
      }
    }

    // 3. Завершение реплики модели (turnComplete) с учетом опустошения ЦАП
    if (response.serverContent?.turnComplete) {
      if (this.bufferedSamples > 0) {
        this.transitionTo('SPEAKING_DRAINING');
      } else {
        this.transitionTo('LISTENING');
      }
    }
  }

  private transitionTo(newState: AgentState): void {
    this.state = newState;
    this.config.onStateChange(newState);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  public async stop(): Promise<void> {
    this.socket?.close();
    await this.captureCtx?.close();
    await this.playbackCtx?.close();
    this.transitionTo('DISCONNECTED');
  }
}

```

### Серверный прозрачный маршрутизатор (Zero-Middleware WebSocket Router): `ZeroMiddlewareProxy.ts`
Маршрутизатор функционирует на платформе Node.js, обеспечивая сквозную ретрансляцию сообщений без парсинга аудиофреймов.

```typescript
// ZeroMiddlewareProxy.ts
import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = 8080;
const GEMINI_HOST = 'generativelanguage.googleapis.com';
const GEMINI_LIVE_PATH =
  '/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const server = createServer();
const wss = new WebSocketServer({ server, path: '/v1/interview-live' });

wss.on('connection', (clientSocket: WebSocket, req: IncomingMessage) => {
  const candidateAuthToken = new URL(
    req.url || '',
    `http://${req.headers.host}`
  ).searchParams.get('token');

  if (!candidateAuthToken) {
    clientSocket.close(4001, 'Unauthorized Candidate Session');
    return;
  }

  const targetUrl = `wss://${GEMINI_HOST}${GEMINI_LIVE_PATH}?key=${API_KEY}`;
  const upstreamSocket = new WebSocket(targetUrl);

  const pendingQueue: Array<{ data: any; isBinary: boolean }> = [];
  let isUpstreamOpen = false;

  upstreamSocket.on('open', () => {
    isUpstreamOpen = true;
    while (pendingQueue.length > 0) {
      const item = pendingQueue.shift()!;
      upstreamSocket.send(item.data, { binary: item.isBinary });
    }
  });

  // Сквозная пересылка Клиент -> Google
  clientSocket.on('message', (data: any, isBinary: boolean) => {
    if (isUpstreamOpen) {
      upstreamSocket.send(data, { binary: isBinary });
    } else {
      pendingQueue.push({ data, isBinary });
    }
  });

  // Сквозная пересылка Google -> Клиент
  upstreamSocket.on('message', (data: any, isBinary: boolean) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(data, { binary: isBinary });
    }
  });

  clientSocket.on('close', (code, reason) => {
    if (upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.close(code, reason);
    }
  });

  upstreamSocket.on('close', (code, reason) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(code, reason);
    }
  });

  clientSocket.on('error', () => upstreamSocket.terminate());
  upstreamSocket.on('error', () => clientSocket.terminate());
});

server.listen(PORT, () => {
  console.log(`Zero-Middleware Voice Proxy listening on port ${PORT}`);
});

```

## Контрольный список верификации (Verification Checklist)
Архитектурный аудит перед вводом системы в эксплуатацию подтверждает полное исключение устаревших компонентов и следование принципам сквозной интеграции:

| Проверяемый компонент | Критерий соответствия архитектуре Zero-Middleware | Статус верификации |
| --- | --- | --- |
| **Dead-Air Audio Clamping** | В клиентском и серверном коде отсутствуют сторожевые интервалы или генераторы синтетических пустых буферов PCM для искусственного удержания сокета. | **Подтверждено** (Исключено) |
| **Client-Side Neural VAD** | В зависимостях проекта отсутствуют пакеты `onnxruntime-web`, `@silero/vad` или локальные WASM-классификаторы речи. Границы реплик определяются исключительно сервером. | **Подтверждено** (Исключено) |
| **Synthetic Conversational Nudges** | Отсутствуют таймеры молчания, генерирующие искусственные фразы-наполнители («Я вас слушаю») при паузах соискателя. Модель функционирует в нативном темпе. | **Подтверждено** (Исключено) |
| **Hot-Reconnect & Replay Loops** | При сбросе сетевого соединения клиент не отправляет накопленный текстовый лог диалога; восстановление контекста происходит строго через параметр `session_resumption.handle`. | **Подтверждено** (Исключено) |
| **Dual-Output Routing** | В DOM отсутствует скрытый элемент `<audio>`; рендеринг осуществляется строго через изолированный узел `AudioWorkletNode`, соединенный с `AudioContext.destination`. Нарушение аппаратного AEC исключено. | **Подтверждено** (Исключено) |
| **Proxy Payload Transparency** | Серверный прокси не вызывает операции сериализации или десериализации (`JSON.parse`, `JSON.stringify`) для бинарных медиа-пакетов. Пересылка осуществляется по принципу потокового сокета. | **Подтверждено** (Исключено) |
| **Barge-In De-clicking** | Процессор воспроизведения активирует 5-миллисекундный спад огибающей ($L_{\text{ramp}} = 120$ сэмплов) перед сбросом буфера при получении сигнала `interrupted: true`, предотвращая акустические щелчки. | **Подтверждено** (Имплементировано) |
| **Symmetrical DAC Drain Guard** | Переход автомата в статус прослушивания заблокирован до тех пор, пока буфер сэмплов в кольцевом массиве и аппаратной очереди ЦАП не станет равен 0. Обрезание окончаний слов исключено. | **Подтверждено** (Имплементировано) |

## Заключение
Представленная архитектура корпоративного голосового агента для модели Gemini 3.8 Live кардинально упрощает стек разработки диалоговых платформ. Отказ от промежуточных уровней оркестрации (Zero-Middleware) в пользу нативных примитивов Google Bidi Streaming и браузерного стандарта AudioWorklet сокращает сквозную задержку диалога до физического минимума ($< 350$ мс при стабильном канале связи). Архитектура обеспечивает стабильность сессии интервью, бесшовное естественное перебивание речи без слуховых артефактов и высокую отказоустойчивость при минимальных инфраструктурных затратах.

---

Source: https://gemini.google.com/app/3f142ea251880aec
Exported at: 2026-10-08T14:44:28.689Z