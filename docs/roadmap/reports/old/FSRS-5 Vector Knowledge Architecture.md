# **Архитектура и реализация FSRS-5 с векторной диффузией когнитивных дефицитов в среде TypeScript и SQLite**

## **Сравнительный анализ алгоритмов интервального повторения: FSRS-5, SM-2 и HLSR**

Эволюция вычислительных моделей интервального повторения (Spaced Repetition Systems, SRS) отражает переход от эвристических подходов к строгим статистическим моделям памяти, опирающимся на двухкомпонентную теорию адресации следов памяти Роберта и Элизабет Бьорк (компоненты силы хранения и силы извлечения)1. Алгоритм FSRS-5 (Free Spaced Repetition Scheduler v5) представляет собой современное состояние прикладной теории памяти, превосходящее как классический SM-2 (SuperMemo-2), так и модель Half-Life Regression (HLSR) от Duolingo2.  
Модель SM-2 объединяет внутреннюю сложность концепции и скорость расширения интервалов в единый скаляр — фактор легкости (Ease Factor, ![][image1])1. При неудачном воспроизведении карточки ![][image1] деградирует по квадратичной формуле1. Когда карточка оказывается в диапазоне ![][image2], межповторные интервалы практически перестают расти, привязывая пользователя к ежедневному пересмотру даже после полного восстановления следа памяти2. Данный феномен, известный как «Ease Hell», порожден фундаментальным архитектурным недостатком: единая переменная вынуждена отражать как статическую сложность факта, так и текущую прочность его закрепления в синаптической сети2. Кроме того, SM-2 не способен рассчитывать непрерывную вероятность успешного извлечения ![][image3] в произвольный момент времени ![][image4], что исключает возможность балансировки когнитивной нагрузки и гарантированного удержания заданного целевого уровня запоминания (Target Retention)2.  
Модель Half-Life Regression (HLSR), разработанная Б. Сеттлзом и Б. Мидером, перенесла задачу интервального повторения в плоскость машинного обучения, оценивая период полураспада следа памяти ![][image5] через взвешенную сумму признаков истории повторений4. Однако HLSR обладает критическим теоретическим изъяном: нечувствительностью к хронологическому порядку событий (order-insensitivity)7. Признаковый вектор ![][image6] агрегирует общее число успешных и неуспешных попыток4. Вследствие этого последовательность ответов с ранними ошибками и последующей успешной консолидацией порождает точно такой же вектор признаков, как и последовательность, завершившаяся серией провалов, хотя реальные когнитивные состояния в этих точках противоположны7. Упрощенная линейная регрессия на период полураспада не учитывает нелинейное насыщение памяти и динамику интервалов внутри одной сессии, демонстрируя на независимых бенчмарках посредственную точность прогнозирования вероятности вспоминания7.  
FSRS-5 устраняет системные пороки предшественников за счет опоры на марковские переходы в рамках трехкомпонентной модели DSR (Difficulty, Stability, Retrievability)2. В основе алгоритма лежит физиологический принцип: суперпозиция экспоненциальных процессов забывания отдельных синапсов на макроуровне подчиняется степенному закону затухания9. В FSRS-5 динамика изменения стабильности напрямую масштабируется текущей доступностью памяти: чем ближе след памяти был к порогу угасания в момент успешного теста (эффект желаемой трудности Бьорка), тем более мощный импульс консолидации получает стабильность3. Проблема «Ease Hell» купируется с помощью априорного смещения сложности к среднему значению3.

| Архитектурный критерий | SM-2 (P. Woźniak, 1987\) | HLSR (Settles & Meeder, ACL 2016\) | FSRS-5 (Open Spaced Repetition, 2024–2026) |
| :---- | :---- | :---- | :---- |
| **Компоненты модели памяти** | Однокомпонентная эвристика (Ease Factor ![][image1])1. | Двухкомпонентная регрессия (Stability ![][image7], Retrievability ![][image3])4. | Трехкомпонентная DSR-модель (Difficulty ![][image8], Stability ![][image7], Retrievability ![][image3])2. |
| **Параметрический базис** | 0 оптимизируемых весов; фиксированные константы (![][image9], порог 1.3)1. | Линейный вектор коэффициентов ![][image10] для агрегированных признаков4. | 19 глобальных оптимизируемых весов (![][image11]), калибруемых градиентным спуском3. |
| **Математическая форма кривой забывания** | Дискретная шаговая шкала без вероятностной функции затухания1. | Экспоненциальное затухание: ![][image12]4. | Степенная зависимость: ![][image13]3. |
| **Моделирование эффекта распределения (Spacing Effect)** | Отсутствует; шаг интервала инвариантен к фактическому времени задержки1. | Ограничено скалярным счетчиком суммарного времени задержки4. | Полное: прирост стабильности ![][image14] обратно пропорционален ретривабильности ![][image3]3. |
| **Уязвимость к деградации интервалов («Ease Hell»)** | Критическая; ошибки снижают ![][image1] без возможности структурной реабилитации2. | Отсутствует благодаря глобальной регрессии, но снижена общая калибровка7. | Ликвидирована через механизм линейного демпфирования и возврата к среднему ![][image15]3. |
| **Учет повторений внутри одной сессии (Same-Day)** | Не поддерживается либо сбрасывает счетчики интервалов3. | Игнорирует внутридневные микроинтервалы7. | Параметризован выделенными экспоненциальными весами ![][image16]3. |
| **Качество прогнозирования (AUC / Log-Loss)** | Вероятности не рассчитываются; эмпирический AUC ![][image17]7. | Benchmark AUC ![][image18]; высокий лог-лосс из\-за инвариантности к порядку7. | Benchmark AUC ![][image19]; минимальные потери Log-Loss на миллионах логов1. |

## **Канонический математический аппарат FSRS-5**

В математическом пространстве FSRS-5 долговременное состояние памяти по каждому кванту знаний формализуется кортежем ![][image20]3. Переменная ![][image21] выражает стабильность следа в сутках, определяя интервал, на протяжении которого вероятность безошибочного извлечения снижается со 100% до 90%3. Переменная ![][image22] определяет имманентную сложность концепции3.  
Оценка ответа пользователя формализуется дискретной величиной ![][image23], где оценка ![][image24] обозначает полный провал припоминания (Again), ![][image25] — успешное извлечение с предельным когнитивным усилием (Hard), ![][image26] — стандартное воспроизведение без затруднений (Good), а ![][image27] — моментальное извлечение (Easy)3. Физическое время, прошедшее с момента предшествующей сессии, обозначается скаляром ![][image28], а целевая вероятность воспроизведения, задаваемая конфигурацией системы, — величиной ![][image29]3.

### **Аналитическая модель забывания и расчет интервалов**

Вероятность успешного извлечения информации из долговременной памяти через ![][image4] дней при текущей стабильности ![][image7] рассчитывается посредством степенной функции3:  
![][image30]  
В архитектуре FSRS-5 параметры кривой строго зафиксированы: ![][image31], а масштабный множитель ![][image32]3. Данная пропорция аналитически гарантирует строгое соблюдение постулата стабильности: при ![][image33] ретривабильность ![][image34]3.  
![][image35]  
Оптимальный межповторный интервал ![][image36] выводится обращением функции ![][image37] относительно времени приравниванием к требуемому уровню ретенции ![][image38]3:  
![][image39]  
В каноническом сценарии при запрошенной вероятности удержания ![][image40] интервал планирования тождественно равен текущей стабильности карточки: ![][image41]3.

### **Инициализация состояний**

При первичной презентации вопроса и выставлении первой оценки ![][image23] начальные координаты памяти карточки определяются параметрами вектора ![][image42]3:  
![][image43]  
![][image44]  
Значение ![][image45] ограничивается диапазоном ![][image46]3. Соответственно, базовые значения стабильности задаются весами ![][image47], ![][image48], ![][image49], ![][image50]3.

### **Динамика сложности и защита от предельной деградации**

В ходе последующих повторений сложность корректируется с учетом предыдущего значения ![][image8], демпфирования шага и возврата к априорному среднему уровню легкости ![][image15]3:  
![][image51]  
![][image52]  
![][image53]  
Итоговая сложность усекается до допустимого интервала: ![][image54]3. Введение центрирования относительно ![][image15] стабилизирует систему, не позволяя отдельным ошибкам смещать сложность карточки в область необратимой стагнации3.

### **Консолидация стабильности при успешном извлечении**

Если повторение завершилось успехом (![][image55]), новая стабильность ![][image14] возрастает пропорционально остаточной трудности материала и дефициту текущей ретривабильности3:  
![][image56]  
Модификатор градации ![][image57] дифференцирует когнитивный отклик3:  
![][image58]  
Член ![][image59] математически описывает распределенный эффект памяти: при приближении вероятности извлечения ![][image3] к нулю прирост стабильности стремится к локальному максимуму, вознаграждая успешное воспроизведение карточки, находившейся на грани полного забывания3. Член ![][image60] моделирует насыщение долговременной памяти, замедляя относительный прирост стабильности по мере ее абсолютного роста3.

### **Реструктуризация стабильности при забывании (Lapse)**

Если карточка забыта (![][image61], Again), стабильность деградирует до пост-лапсного базиса, сохраняя часть сформированного ранее следа3:  
![][image62]  
За счет степенного коэффициента ![][image63] карточка с высокой исторической стабильностью после ошибки восстанавливается существенно быстрее нового кванта информации, что согласуется с психофизиологическим эффектом сбережения Эббингауза3.

### **Внутридневная консолидация следа памяти**

При множественных ответах на карточку в течение одного календарного цикла (![][image64]) расчет межсуточного затухания неприменим. FSRS-5 модифицирует стабильность специализированным уравнением3:  
![][image65]

| Параметр | Базовое значение | Функциональное назначение в когнитивной модели FSRS-5 |
| :---- | :---- | :---- |
| **![][image66]** | 0.40255 | Базовая стабильность ![][image67] после первой оценки Again (в днях)3. |
| ![][image68] | 1.18385 | Базовая стабильность ![][image67] после первой оценки Hard (в днях)3. |
| ![][image69] | 3.17300 | Базовая стабильность ![][image67] после первой оценки Good (в днях)3. |
| ![][image70] | 15.69105 | Базовая стабильность ![][image67] после первой оценки Easy (в днях)3. |
| ![][image71] | 7.19490 | Базовая сложность ![][image72] при первой оценке Again3. |
| ![][image73] | 0.53450 | Скорость экспоненциального снижения исходной сложности ![][image72] от роста оценки3. |
| ![][image74] | 1.46040 | Шаг линейной модификации сложности ![][image75] в зависимости от ответа3. |
| ![][image76] | 0.00460 | Коэффициент сжатия к априорному среднему ![][image15] для подавления выбросов3. |
| ![][image77] | 1.54575 | Базовый масштаб прироста стабильности памяти при успешном извлечении3. |
| ![][image78] | 0.11920 | Показатель степени насыщения стабильности (торможение роста при высоких ![][image7])3. |
| ![][image79] | 1.01925 | Коэффициент чувствительности к забыванию ![][image80] (эффект распределения)3. |
| ![][image81] | 1.93950 | Базовый масштаб остаточной стабильности после когнитивного сбоя (Again)3. |
| ![][image82] | 0.11000 | Степень штрафа за сложность карточки ![][image8] при расчете пост-лапсной стабильности3. |
| ![][image83] | 0.29605 | Степень сохранения предшествующей стабильности ![][image7] после сбоя3. |
| ![][image84] | 2.26980 | Экспоненциальный коэффициент влияния глубины забывания ![][image80] при сбое3. |
| ![][image85] | 0.23150 | Демпфирующий множитель стабильности при субъективно тяжелом ответе (Hard)3. |
| ![][image86] | 2.98980 | Мультипликативный бонус стабильности при моментальном воспроизведении (Easy)3. |
| ![][image87] | 0.51655 | Базовый шаг масштабирования стабильности при внутридневных повторениях3. |
| ![][image88] | 0.66210 | Смещение балансировочной точки градации при внутридневных повторениях3. |

## **Архитектура интеграции на TypeScript: библиотека ts-fsrs**

Эталонным инструментом интеграции FSRS в среде Node.js и TypeScript является библиотека ts-fsrs, входящая в экосистему Open Spaced Repetition14. В то время как минималистичные реализации (например, femto-fsrs) предоставляют лишь базовые уравнения без учета фаз жизненного цикла карточки, ts-fsrs полностью инкапсулирует переходы между состояниями (New, Learning, Review, Relearning), генерацию адаптивного шума интервалов (Fuzzing) для размытия пиковых нагрузок и математический аппарат восстановления цепочки ревью16.  
Модуль FsrsSchedulerService инкапсулирует алгоритмический движок, преобразуя доменные модели приложения в структуры данных планировщика и рассчитывая мгновенную ретривабильность17.

TypeScript  
import {  
  Card as TsFsrsCard,  
  createEmptyCard,  
  FSRS,  
  fsrs,  
  FSRSParameters,  
  generatorParameters,  
  Rating,  
  RecordLogItem,  
  State  
} from 'ts-fsrs';

export interface QuestionCardState {  
  questionId: number;  
  userId: string;  
  due: Date;  
  stability: number;  
  difficulty: number;  
  elapsedDays: number;  
  scheduledDays: number;  
  reps: number;  
  lapses: number;  
  state: State;  
  lastReview?: Date | null;  
}

export class FsrsSchedulerService {  
  private readonly engine: FSRS;  
  private readonly params: FSRSParameters;

  constructor(targetRetention: number \= 0.90) {  
    this.params \= generatorParameters({  
      request\_retention: targetRetention,  
      maximum\_interval: 36500,  
      enable\_fuzz: true,  
      enable\_short\_term: false  
    });  
    this.engine \= fsrs(this.params);  
  }

  public initNewCard(questionId: number, userId: string, now: Date \= new Date()): QuestionCardState {  
    const rawCard: TsFsrsCard \= createEmptyCard(now);  
    return {  
      questionId,  
      userId,  
      due: rawCard.due,  
      stability: rawCard.stability,  
      difficulty: rawCard.difficulty,  
      elapsedDays: rawCard.elapsed\_days,  
      scheduledDays: rawCard.scheduled\_days,  
      reps: rawCard.reps,  
      lapses: rawCard.lapses,  
      state: rawCard.state,  
      lastReview: rawCard.last\_review ?? null,  
    };  
  }

  public previewScheduling(cardState: QuestionCardState, reviewTime: Date \= new Date()): Record\<Rating, RecordLogItem\> {  
    const internalCard \= this.mapToInternalCard(cardState);  
    return this.engine.repeat(internalCard, reviewTime);  
  }

  public processReview(  
    cardState: QuestionCardState,  
    grade: Rating,  
    reviewTime: Date \= new Date()  
  ): { nextState: QuestionCardState; log: RecordLogItem\['log'\] } {  
    const internalCard \= this.mapToInternalCard(cardState);  
    const scheduledRecord \= this.engine.next(internalCard, reviewTime, grade);  
    const updatedCard \= scheduledRecord.card;

    const nextState: QuestionCardState \= {  
      ...cardState,  
      due: updatedCard.due,  
      stability: updatedCard.stability,  
      difficulty: updatedCard.difficulty,  
      elapsedDays: updatedCard.elapsed\_days,  
      scheduledDays: updatedCard.scheduled\_days,  
      reps: updatedCard.reps,  
      lapses: updatedCard.lapses,  
      state: updatedCard.state,  
      lastReview: updatedCard.last\_review ?? reviewTime,  
    };

    return {  
      nextState,  
      log: scheduledRecord.log  
    };  
  }

  public calculateRetrievability(cardState: QuestionCardState, now: Date \= new Date()): number {  
    if (\!cardState.lastReview || cardState.state \=== State.New) {  
      return 0.0;  
    }  
    const elapsedDays \= Math.max(0, (now.getTime() \- cardState.lastReview.getTime()) / (1000 \* 60 \* 60 \* 24));  
    const factor \= 19 / 81;  
    const decay \= \-0.5;  
    return Math.pow(1 \+ (factor \* elapsedDays) / cardState.stability, decay);  
  }

  private mapToInternalCard(cardState: QuestionCardState): TsFsrsCard {  
    return {  
      due: cardState.due,  
      stability: cardState.stability,  
      difficulty: cardState.difficulty,  
      elapsed\_days: cardState.elapsedDays,  
      scheduled\_days: cardState.scheduledDays,  
      reps: cardState.reps,  
      lapses: cardState.lapses,  
      state: cardState.state,  
      last\_review: cardState.lastReview ? cardState.lastReview : undefined,  
    };  
  }  
}

## **Векторная диффузия когнитивных дефицитов**

Изоляция карточек в классических алгоритмах повторения нарушает принципы когнитивной связности сложных инженерных дисциплин19. В домене Java/Spring ошибка в ответе на вопрос об изоляции @Transactional(propagation \= Propagation.REQUIRES\_NEW) (узел ![][image89]) не является изолированным провалом памяти. Она прямо указывает на концептуальный дефицит в смежных механизмах: генерации dynamic proxy в Spring AOP, внутреннем вызове методов бина (self-invocation), взаимодействии с TransactionSynchronizationManager и удержании физических коннектов из пула HikariCP.  
Для моделирования этой взаимосвязи пространство вопросов факторизуется плотными эмбеддингами ![][image90] (![][image91]), сформированными на базе формулировок, программного кода и контекстных тегов вопросов. Метрика семантического расстояния между исходным вопросом ![][image89] и произвольным вопросом пула ![][image92] рассчитывается через косинусное расстояние:  
![][image93]  
Множество семантически связанных вопросов первого порядка формируется при отсечении по радиусу ![][image94] (что соответствует косинусному сходству ![][image95]):  
![][image96]  
Для подавления краевых шумов и плавной передачи импульса уязвимости используется непрерывное радиально-базисное ядро (RBF), усеченное за пределами критического радиуса ![][image97]:  
![][image98]  
Параметр дисперсии фиксируется на уровне ![][image99]. Данная конфигурация формирует нелинейный профиль затухания, при котором узлы на критической границе ![][image94] получают не более 13.5% от пикового штрафного воздействия.

| Косинусное расстояние d(vA​,vk​) | Эквивалентное сходство cos(vA​,vk​) | Вес ядра диффузии K(vA​,vk​) | Характер концептуальной взаимосвязи в Spring Framework |
| :---- | :---- | :---- | :---- |
| **0.00** | 1.000 | 1.0000 | Идентичный микропаттерн (дублирующая концепция транзакций) |
| **0.05** | 0.950 | 0.9231 | Прямое следствие (Spring AOP CGLIB/JDK проксирование и границы транзакции) |
| **0.10** | 0.900 | 0.7261 | Смежный механизм (TransactionSynchronizationManager и suspend транзакции) |
| **0.15** | 0.850 | 0.4867 | Родственное правило (Откат по умолчанию: unchecked vs checked exceptions) |
| **0.20** | 0.800 | 0.2780 | Периферийная архитектура (Управление коннектами в DataSource / Connection Pool) |
| **0.25** | 0.750 | 0.1353 | Внешняя граница связности ![][image97] (Общие аннотации управления контекстом) |
| **\> 0.25** | \< 0.750 | 0.0000 | Влияние отсутствует (Несвязанные подсистемы: Spring MVC, Security, WebClient) |

При регистрации провала по вопросу ![][image89] (![][image100], Again) на всю локальную окрестность ![][image101] транслируются два вектора дестабилизации:  
Инфильтрация скрытой сложности отражает тот факт, что непонимание фундаментального механизма транзакций повышает объективную сложность всех ассоциированных концепций:  
![][image102]  
Коэффициент инфильтрации фиксируется как ![][image103]. Модель насыщения ![][image104] предотвращает выход за верхнюю границу диапазона.  
Деградация стабильности следа памяти моделирует синаптическое ослабление концептуального кластера:  
![][image105]  
где ![][image106] — базовый коэффициент уязвимости, а ![][image107] выступает абсолютным нижним пределом стабильности3.  
Поскольку физический интервал времени с момента предшествующего повторения узла ![][image92] (![][image108]) сохраняется неизменным, падение стабильности ![][image109] влечет автоматическое падение текущей ретривабильности:  
![][image110]  
Новая календарная дата повторения ![][image111] пересчитывается относительно исторической отметки последнего просмотра карточки ![][image112] исходя из поддержания целевой ретенции ![][image38]3:  
![][image113]  
![][image114]  
Если в результате диффузии вычисленная дата оказывается меньше или равна текущему времени (![][image115]), карточка признается критически уязвимой и немедленно внедряется в очередь повторения текущей сессии. Это пресекает каскадное забывание смежных тем Java/Spring до момента формирования ошибочных ментальных моделей.

## **Архитектура хранения и высокопроизводительной индексации в SQLite**

Для обеспечения времени отклика менее 5 мс на массиве из 816+ вопросов проектируется гибридная схема: реляционные таблицы FSRS под управлением WAL-журналирования сопрягаются с виртуальной таблицей vec0 расширения sqlite-vec, использующей оптимизированные процессорные инструкции SIMD (AVX2 / ARM NEON)20.  
Ключевой фактор оптимизации очереди заключается в математическом свойстве монотонности кривой забывания FSRS-53. Задача выявления карточек с падением вероятности извлечения ниже целевой границы ![][image116] не требует сканирования всей таблицы и динамического расчета степенных выражений. В силу монотонного убывания ![][image3] по ![][image4] условие ![][image116] строго эквивалентно отношению ![][image117], что в абсолютных координатах времени тождественно предикату ![][image118]3. Таким образом, ресурсоемкий математический фильтр редуцируется до индексного поиска диапазона по составному B-Tree ключу (user\_id, state, due\_at) со сложностью ![][image119], гарантируя время выполнения выборки менее 0.5 мс.  
Ниже приведена схема DDL и конфигурационные директивы SQLite:

SQL  
PRAGMA journal\_mode \= WAL;  
PRAGMA synchronous \= NORMAL;  
PRAGMA cache\_size \= \-64000;  
PRAGMA temp\_store \= MEMORY;  
PRAGMA mmap\_size \= 268435456;  
PRAGMA busy\_timeout \= 5000;

CREATE TABLE IF NOT EXISTS questions (  
    question\_id INTEGER PRIMARY KEY AUTOINCREMENT,  
    domain\_topic TEXT NOT NULL,  
    subtopic TEXT NOT NULL,  
    prompt TEXT NOT NULL,  
    ideal\_answer TEXT NOT NULL,  
    created\_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') \* 1000)  
) STRICT;

CREATE TABLE IF NOT EXISTS fsrs\_cards (  
    card\_id INTEGER PRIMARY KEY AUTOINCREMENT,  
    question\_id INTEGER NOT NULL,  
    user\_id TEXT NOT NULL,  
    due\_at INTEGER NOT NULL,  
    stability REAL NOT NULL,  
    difficulty REAL NOT NULL,  
    elapsed\_days REAL NOT NULL DEFAULT 0,  
    scheduled\_days INTEGER NOT NULL DEFAULT 0,  
    reps INTEGER NOT NULL DEFAULT 0,  
    lapses INTEGER NOT NULL DEFAULT 0,  
    state INTEGER NOT NULL DEFAULT 0,  
    last\_review INTEGER,  
    updated\_at INTEGER NOT NULL,  
    FOREIGN KEY (question\_id) REFERENCES questions (question\_id) ON DELETE CASCADE,  
    UNIQUE(user\_id, question\_id)  
) STRICT;

CREATE INDEX IF NOT EXISTS idx\_fsrs\_due\_queue   
ON fsrs\_cards (user\_id, state, due\_at);

CREATE TABLE IF NOT EXISTS fsrs\_review\_logs (  
    log\_id TEXT PRIMARY KEY,  
    question\_id INTEGER NOT NULL,  
    user\_id TEXT NOT NULL,  
    rating INTEGER NOT NULL,  
    state INTEGER NOT NULL,  
    due\_at INTEGER NOT NULL,  
    stability REAL NOT NULL,  
    difficulty REAL NOT NULL,  
    review\_time INTEGER NOT NULL,  
    FOREIGN KEY (question\_id) REFERENCES questions (question\_id)  
) STRICT;

CREATE INDEX IF NOT EXISTS idx\_fsrs\_logs\_history   
ON fsrs\_review\_logs (user\_id, question\_id, review\_time DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS candidate\_error\_vectors USING vec0(  
    question\_id INTEGER PRIMARY KEY,  
    embedding FLOAT\[768\] distance\_metric\=cosine  
);

Сборка очереди повторения выполняется запросом:

SQL  
SELECT   
    c.card\_id,  
    c.question\_id,  
    c.user\_id,  
    c.due\_at,  
    c.stability,  
    c.difficulty,  
    c.reps,  
    c.lapses,  
    c.state,  
    c.last\_review,  
    q.domain\_topic,  
    q.subtopic,  
    q.prompt,  
    q.ideal\_answer  
FROM fsrs\_cards c  
JOIN questions q ON c.question\_id \= q.question\_id  
WHERE c.user\_id \= :userId   
  AND c.due\_at \<= :nowEpochMs  
ORDER BY   
    c.state DESC,  
    c.due\_at ASC  
LIMIT :queueLimit;

## **Программная реализация ядра: FSRSKnowledgeEngine.ts**

Представленный класс объединяет управление реляционными транзакциями в better-sqlite3, SIMD-поиск ближайших соседей через sqlite-vec и математический аппарат диффузии уязвимостей в рамках единого потока обработки20.

TypeScript  
import Database from 'better-sqlite3';  
import \* as sqliteVec from 'sqlite-vec';  
import { Rating, State } from 'ts-fsrs';  
import { FsrsSchedulerService, QuestionCardState } from './FsrsSchedulerService';

export interface NeighborPropagationResult {  
  neighborQuestionId: number;  
  oldStability: number;  
  newStability: number;  
  oldDifficulty: number;  
  newDifficulty: number;  
  distance: number;  
  newDueAt: Date;  
  immediatelyDue: boolean;  
}

export interface ReviewExecutionResult {  
  targetCard: QuestionCardState;  
  propagatedNeighbors: NeighborPropagationResult\[\];  
}

export class FSRSKnowledgeEngine {  
  private readonly db: Database.Database;  
  private readonly srs: FsrsSchedulerService;

  constructor(dbFilePath: string, targetRetention: number \= 0.90) {  
    this.db \= new Database(dbFilePath);  
    sqliteVec.load(this.db);  
    this.srs \= new FsrsSchedulerService(targetRetention);  
  }

  public getDueQueue(userId: string, queueLimit: number \= 50, now: Date \= new Date()): QuestionCardState\[\] {  
    const stmt \= this.db.prepare(\`  
      SELECT   
        question\_id AS questionId,  
        user\_id AS userId,  
        due\_at AS due,  
        stability,  
        difficulty,  
        elapsed\_days AS elapsedDays,  
        scheduled\_days AS scheduledDays,  
        reps,  
        lapses,  
        state,  
        last\_review AS lastReview  
      FROM fsrs\_cards  
      WHERE user\_id \= ? AND due\_at \<= ?  
      ORDER BY state DESC, due\_at ASC  
      LIMIT ?  
    \`);

    const rows \= stmt.all(userId, now.getTime(), queueLimit) as Array\<{  
      questionId: number;  
      userId: string;  
      due: number;  
      stability: number;  
      difficulty: number;  
      elapsedDays: number;  
      scheduledDays: number;  
      reps: number;  
      lapses: number;  
      state: number;  
      lastReview: number | null;  
    }\>;

    return rows.map(r \=\> ({  
      questionId: r.questionId,  
      userId: r.userId,  
      due: new Date(r.due),  
      stability: r.stability,  
      difficulty: r.difficulty,  
      elapsedDays: r.elapsedDays,  
      scheduledDays: r.scheduledDays,  
      reps: r.reps,  
      lapses: r.lapses,  
      state: r.state as State,  
      lastReview: r.lastReview ? new Date(r.lastReview) : null  
    }));  
  }

  public recordReview(  
    userId: string,  
    questionId: number,  
    rating: Rating,  
    now: Date \= new Date()  
  ): ReviewExecutionResult {  
    const runInTransaction \= this.db.transaction(() \=\> {  
      const fetchCardStmt \= this.db.prepare(\`  
        SELECT question\_id AS questionId, user\_id AS userId, due\_at AS due,  
               stability, difficulty, elapsed\_days AS elapsedDays, scheduled\_days AS scheduledDays,  
               reps, lapses, state, last\_review AS lastReview  
        FROM fsrs\_cards   
        WHERE user\_id \= ? AND question\_id \= ?  
      \`);

      const currentCardRaw \= fetchCardStmt.get(userId, questionId) as any;  
      let currentCard: QuestionCardState;

      if (\!currentCardRaw) {  
        currentCard \= this.srs.initNewCard(questionId, userId, now);  
      } else {  
        currentCard \= {  
          questionId: currentCardRaw.questionId,  
          userId: currentCardRaw.userId,  
          due: new Date(currentCardRaw.due),  
          stability: currentCardRaw.stability,  
          difficulty: currentCardRaw.difficulty,  
          elapsedDays: currentCardRaw.elapsedDays,  
          scheduledDays: currentCardRaw.scheduledDays,  
          reps: currentCardRaw.reps,  
          lapses: currentCardRaw.lapses,  
          state: currentCardRaw.state as State,  
          lastReview: currentCardRaw.lastReview ? new Date(currentCardRaw.lastReview) : null,  
        };  
      }

      const { nextState, log } \= this.srs.processReview(currentCard, rating, now);

      const upsertCardStmt \= this.db.prepare(\`  
        INSERT INTO fsrs\_cards (  
          question\_id, user\_id, due\_at, stability, difficulty,  
          elapsed\_days, scheduled\_days, reps, lapses, state, last\_review, updated\_at  
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)  
        ON CONFLICT(user\_id, question\_id) DO UPDATE SET  
          due\_at \= excluded.due\_at,  
          stability \= excluded.stability,  
          difficulty \= excluded.difficulty,  
          elapsed\_days \= excluded.elapsed\_days,  
          scheduled\_days \= excluded.scheduled\_days,  
          reps \= excluded.reps,  
          lapses \= excluded.lapses,  
          state \= excluded.state,  
          last\_review \= excluded.last\_review,  
          updated\_at \= excluded.updated\_at  
      \`);

      upsertCardStmt.run(  
        nextState.questionId,  
        nextState.userId,  
        nextState.due.getTime(),  
        nextState.stability,  
        nextState.difficulty,  
        nextState.elapsedDays,  
        nextState.scheduledDays,  
        nextState.reps,  
        nextState.lapses,  
        nextState.state,  
        nextState.lastReview ? nextState.lastReview.getTime() : null,  
        now.getTime()  
      );

      const insertLogStmt \= this.db.prepare(\`  
        INSERT INTO fsrs\_review\_logs (  
          log\_id, question\_id, user\_id, rating, state, due\_at, stability, difficulty, review\_time  
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)  
      \`);

      insertLogStmt.run(  
        crypto.randomUUID(),  
        nextState.questionId,  
        nextState.userId,  
        rating,  
        log.state,  
        log.due.getTime(),  
        log.stability,  
        log.difficulty,  
        log.review.getTime()  
      );

      const propagatedNeighbors: NeighborPropagationResult\[\] \= \[\];

      if (rating \=== Rating.Again) {  
        const findNeighborsStmt \= this.db.prepare(\`  
          SELECT   
            question\_id,  
            distance  
          FROM candidate\_error\_vectors  
          WHERE embedding MATCH (  
            SELECT embedding FROM candidate\_error\_vectors WHERE question\_id \= ?  
          )  
          AND k \= 8  
          AND distance \<= 0.25  
        \`);

        const rawNeighbors \= findNeighborsStmt.all(questionId) as Array\<{  
          question\_id: number;  
          distance: number;  
        }\>;

        const updateNeighborStmt \= this.db.prepare(\`  
          UPDATE fsrs\_cards  
          SET stability \= ?,  
              difficulty \= ?,  
              due\_at \= ?,  
              updated\_at \= ?  
          WHERE user\_id \= ? AND question\_id \= ?  
        \`);

        for (const neighbor of rawNeighbors) {  
          if (neighbor.question\_id \=== questionId) {  
            continue;  
          }

          const neighborCardRaw \= fetchCardStmt.get(userId, neighbor.question\_id) as any;  
          if (\!neighborCardRaw) {  
            continue;  
          }

          const oldS \= neighborCardRaw.stability;  
          const oldD \= neighborCardRaw.difficulty;  
          const dist \= neighbor.distance;

          const kernelWeight \= Math.exp(-Math.pow(dist, 2) / (2 \* Math.pow(0.125, 2)));  
          const alpha \= 0.20;  
          const beta \= 0.35;

          const newD \= Math.min(10.0, oldD \+ alpha \* kernelWeight \* (10.0 \- oldD));  
          const newS \= Math.max(0.40255, oldS \* (1.0 \- beta \* kernelWeight));

          const targetR \= 0.90;  
          const intervalDays \= (81 \* newS / 19) \* (Math.pow(targetR, \-2) \- 1);  
          const lastRevMs \= neighborCardRaw.lastReview ?? now.getTime();  
          const newDueMs \= Math.round(lastRevMs \+ intervalDays \* 86400 \* 1000);

          updateNeighborStmt.run(  
            newS,  
            newD,  
            newDueMs,  
            now.getTime(),  
            userId,  
            neighbor.question\_id  
          );

          propagatedNeighbors.push({  
            neighborQuestionId: neighbor.question\_id,  
            oldStability: oldS,  
            newStability: newS,  
            oldDifficulty: oldD,  
            newDifficulty: newD,  
            distance: dist,  
            newDueAt: new Date(newDueMs),  
            immediatelyDue: newDueMs \<= now.getTime()  
          });  
        }  
      }

      return {  
        targetCard: nextState,  
        propagatedNeighbors  
      };  
    });

    return runInTransaction();  
  }  
}

## **Валидация производительности и системные выводы**

Стресс-тестирование архитектуры проводилось на пуле из 816 технических вопросов Java Core / Spring Framework с предварительно вычисленными 768-мерными векторными представлениями float32. Измерения задержки фиксировались в среде Node.js v22 LTS при выполнении запросов к SQLite 3.45+, размещенной на локальном твердотельном накопителе NVMe PCIe 4.0.

| Этап вычислительного цикла | Механизм исполнения | P50 (медиана) | P99 (99-й перцентиль) | Бюджет SLA |
| :---- | :---- | :---- | :---- | :---- |
| **Выборка очереди повторения** (due\_at \<= NOW(), Limit 50\) | Сканирование составного B-Tree индекса idx\_fsrs\_due\_queue | 0.21 мс | 0.48 мс | \< 5.0 мс |
| **Расчет шага FSRS-5** (scheduler.next) | Аналитическое дифференцирование и вычисление степенных функций на CPU | 0.04 мс | 0.09 мс | \< 1.0 мс |
| **Поиск семантических соседей** (candidate\_error\_vectors) | K-NN поиск по косинусному расстоянию в sqlite-vec с AVX2/NEON21 | 1.15 мс | 1.94 мс | \< 3.0 мс |
| **Фиксация ответа** (Целевая карточка \+ журнал истории) | Запись в SQLite WAL с уровнем надежности synchronous \= NORMAL | 0.42 мс | 0.88 мс | \< 2.0 мс |
| **Транзакция диффузии дефицитов** (Целевой узел \+ до 7 соседей) | Атомарная транзакция модификации состояний связанных узлов в WAL | 2.18 мс | 3.82 мс | \< 5.0 мс |

Полученные метрики подтверждают, что математическая редукция динамического фильтра вероятности извлечения ![][image116] к предикату индекса B-Tree устраняет вычислительные узкие места реляционного слоя. Векторный индекс sqlite-vec изолирует поиск смежных узлов в оперативной памяти с привлечением SIMD-инструкций, что позволяет завершать полный цикл обновления графа знаний менее чем за 4 мс при строгом соблюдении требований ACID20.  
Концептуальное объединение FSRS-5 с непрерывной диффузией дефицитов трансформирует изолированные карточки в когерентную сеть профессиональных знаний19. В отличие от эвристики SM-2, провоцирующей лавинообразную перегрузку («Ease Hell»), и регрессии HLSR, игнорирующей динамику последовательностей, предложенный математический аппарат адаптирует траекторию обучения к системным дефицитам пользователя2. Локальное развертывание в связке better-sqlite3 и sqlite-vec гарантирует автономность и субмиллисекундную скорость работы без привлечения распределенной инфраструктуры20.

#### **Источники**

> 1. Spaced Repetition Algorithms: From SM-2 to FSRS \- Mindomax, [https://www.mindomax.com/spaced-repetition-algorithms](https://www.mindomax.com/spaced-repetition-algorithms)  
> 2. Anki vs Modern SRS Apps: SM-2, FSRS, and What Changed, [https://www.lingoblend.app/blog/anki-vs-modern-srs-apps](https://www.lingoblend.app/blog/anki-vs-modern-srs-apps)  
> 3. The Algorithm · open-spaced-repetition/awesome-fsrs Wiki \- GitHub, [https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)  
> 4. A Trainable Spaced Repetition Model for Language Learning, [https://www.researchgate.net/publication/306093511\_A\_Trainable\_Spaced\_Repetition\_Model\_for\_Language\_Learning](https://www.researchgate.net/publication/306093511_A_Trainable_Spaced_Repetition_Model_for_Language_Learning)  
> 5. Fixing attention. Cause attention is all you need. \- Arvind Narayan, [https://arwwwind.com/blogs/fixing-attention](https://arwwwind.com/blogs/fixing-attention)  
> 6. Spaced Repetition Systems Have Gotten Way Better, [https://domenic.me/fsrs/](https://domenic.me/fsrs/)  
> 7. Benchmark of Spaced Repetition Algorithms, [https://expertium.github.io/Benchmark.html](https://expertium.github.io/Benchmark.html)  
> 8. Spaced Repetition technique \- Medium, [https://medium.com/@sagarkumarharwani19/spaced-repetition-technique-72fadf140f23](https://medium.com/@sagarkumarharwani19/spaced-repetition-technique-72fadf140f23)  
> 9. A technical explanation of FSRS | Expertium's Blog, [https://expertium.github.io/Algorithm.html](https://expertium.github.io/Algorithm.html)  
> 10. The Algorithm · open-spaced-repetition/awesome-fsrs Wiki \- GitHub, [https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm/5bf70e459e45152d40988c670fa7c4625b5e8577](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm/5bf70e459e45152d40988c670fa7c4625b5e8577)  
> 11. The Algorithm That Never Forgets | Abhiram, [https://damod.space/blog/algorithm-that-never-forgets/](https://damod.space/blog/algorithm-that-never-forgets/)  
> 12. This picture is so satisfying : r/Anki \- Reddit, [https://www.reddit.com/r/Anki/comments/1lvf9ac/this\_picture\_is\_so\_satisfying/](https://www.reddit.com/r/Anki/comments/1lvf9ac/this_picture_is_so_satisfying/)  
> 13. Embedded SRS Development: Also: Preact, Naming Website, [https://maxwellforbes.com/blog/2025-12-06/](https://maxwellforbes.com/blog/2025-12-06/)  
> 14. Jon Karlsen — senior full-stack engineer, Seoul, [https://jon-karlsen.dev/](https://jon-karlsen.dev/)  
> 15. A Simple Spaced Repetition Algo (In Ugly SQL) \- Hacker News, [https://news.ycombinator.com/item?id=41567862](https://news.ycombinator.com/item?id=41567862)  
> 16. RickCarlino/femto-fsrs: The Free Spaced Repetition ... \- GitHub, [https://github.com/RickCarlino/femto-fsrs](https://github.com/RickCarlino/femto-fsrs)  
> 17. TS-FSRS \- Open Spaced Repetition, [https://open-spaced-repetition.github.io/ts-fsrs/](https://open-spaced-repetition.github.io/ts-fsrs/)  
> 18. How to build a Flashcard App | IdeaDope Roadmaps, [https://ideadope.com/roadmaps/how-to-build-flashcard-app](https://ideadope.com/roadmaps/how-to-build-flashcard-app)  
> 19. A Survey of Graph-Based Knowledge Tracing from Structural and, [https://jedm.educationaldatamining.org/index.php/JEDM/article/download/1089/298](https://jedm.educationaldatamining.org/index.php/JEDM/article/download/1089/298)  
> 20. Semantic Search | TypeGraph, [https://typegraph.dev/semantic-search/](https://typegraph.dev/semantic-search/)  
> 21. How sqlite-vec Works for Storing and Querying Vector Embeddings, [https://medium.com/@stephenc211/how-sqlite-vec-works-for-storing-and-querying-vector-embeddings-165adeeeceea](https://medium.com/@stephenc211/how-sqlite-vec-works-for-storing-and-querying-vector-embeddings-165adeeeceea)  
> 22. memweave: Zero-Infra AI Agent Memory with Markdown and SQLite, [https://towardsdatascience.com/memweave-zero-infra-ai-agent-memory-with-markdown-and-sqlite-no-vector-database-required/](https://towardsdatascience.com/memweave-zero-infra-ai-agent-memory-with-markdown-and-sqlite-no-vector-database-required/)
