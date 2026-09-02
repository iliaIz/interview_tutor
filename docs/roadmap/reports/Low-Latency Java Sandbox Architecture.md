# **Архитектура изолированного сверхнизколатентного движка выполнения кода для Java 21 и стресс-тестирования конкурентности**

## **Сравнительный анализ открытых песочниц и изолированных сред**

Построение экзаменационных и оценочных платформ корпоративного уровня требует одновременного разрешения противоречия между глубиной изоляции недоверенного кода и сквозным временем отклика системы1. В сценариях многопоточного стресс-тестирования, где пользовательский код порождает 100 параллельных потоков и активно конкурирует за ресурсы ядра, архитектура песочницы определяет не только устойчивость хоста, но и достоверность воспроизведения состояний гонки3.

| Движок / Архитектурный подход | Базовый механизм изоляции | Время старта песочницы | Накладные расходы памяти | Модель изоляции ядра | Поддержка 100 потоков Java 21 | Применимость к SLA \< 350 мс |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Judge0 v1.13+** | isolate (Linux namespaces, cgroups v1/v2) | 150–400 мс (с учетом очередей) | 10–25 МБ | Разделяемое хостовое ядро | Полная при ручной настройке pids | Низкая из\-за оверхеда базы данных и очередей2 |
| **Piston (Engineer-man)** | Unprivileged users, Linux namespaces | 80–180 мс | 15–30 МБ | Разделяемое хостовое ядро | Блокируется дефолтным лимитом процессов | Средняя, требует полной модификации рантайма6 |
| **Isolate (IOI Sandbox)** | Нативные системные вызовы ядра, namespaces, chroot | 1–3 мс | \< 2 МБ | Разделяемое хостовое ядро | Полная при параметре \--cg-mem | Высокая при интеграции через локальные демоны8 |
| **Docker \+ gVisor (runsc)** | User-space перехват сисколлов (Sentry) | 25–45 мс | 15–35 МБ | Виртуализированное ядро приложения | Полная, прозрачная трансляция futex/clone | Высокая, оптимальный баланс безопасности и скорости5 |
| **Firecracker MicroVM** | Аппаратная виртуализация KVM | 120–180 мс | \> 5 МБ VMM \+ память гостя | Выделенное гостевое ядро Linux | Аппаратная честность распределения vCPU | Недостаточная для суммарного цикла компиляции и тестов5 |
| **WASM (CheerpJ 3.0 / Wasmtime)** | Браузерная песочница / Wasm runtime | 800–3500 мс (загрузка модулей) | 80–200 МБ | Изоляция памяти среды исполнения | Эмулированная через Web Workers | Неприемлемая, не воспроизводит модель памяти JMM9 |

Архитектура платформы Judge0 оптимизирована для соревновательного программирования и асинхронной пакетной обработки5. Использование внешнего брокера Redis и реляционной СУБД для фиксации состояния каждого запроса вносит неизбежные сетевые и транзакционные издержки, из\-за чего сквозная задержка даже на прогретых нодах редко опускается ниже 400–700 мс2. Кроме того, эксплуатация Judge0 в контейнеризированных окружениях часто требует привилегированного режима Docker для конфигурирования вложенного isolate, что расширяет поверхность атаки и приводило к документированным побегам из песочницы, зафиксированным в рамках уязвимости CVE-2024-290215.  
Движок Piston от сообщества Engineer-man обеспечивает быстрый запуск за счет отказа от промежуточных СУБД в пользу прямого взаимодействия с Node.js API6. Изоляция опирается на ротацию локальных пользователей и базовые пространства имен Linux6. Главным препятствием для concurrency-тестирования в Piston выступает жестко зашитая защитная конфигурация: параметр PISTON\_MAX\_PROCESS\_COUNT по умолчанию равен 647. Попытка инициализации пула из ста рабочих потоков Java немедленно приводит к выбросу исключения java.lang.OutOfMemoryError: unable to create native thread из\-за исчерпания системного лимита дескрипторов задач. Увеличение этого лимита в рамках архитектуры Piston требует глобальной перенастройки окружения хоста и ослабляет защиту от fork-бомб6.  
Утилита Isolate представляет собой наиболее производительный низкоуровневый инструмент изоляции, созданный для олимпиадных соревнований14. Инициализация песочницы выполняется за доли миллисекунды посредством вызова clone с флагами пространств имен и монтирования минимального дерева chroot8. Тем не менее управление виртуальной памятью в Isolate создает критическую проблему для рантайма HotSpot: использование исторического ключа \--mem ограничивает адресное пространство на уровне вызовов mmap и brk, что препятствует предварительному резервированию виртуальной памяти под Java Heap и структуры Metaspace10. Корректная работа современной JVM требует обязательного перехода на параметры \--cg и \--cg-mem, задействующие контрольные группы Linux cgroups v210.  
Сопоставление подходов gVisor и Firecracker демонстрирует разделение между концепциями глубокой защиты ядра5. Firecracker предоставляет абсолютную изоляцию за счет запуска независимого гостевого ядра Linux внутри KVM-микроВМ5. Однако накладные расходы на инициализацию виртуальной машины (120–180 мс) в совокупности с холодным стартом JVM делают преодоление планки в 350 мс для полного цикла недостижимым5.  
В свою очередь, gVisor заменяет обращение к хостовому ядру уровнем ядра пользовательского пространства Sentry, написанным на Go5. Sentry самостоятельно перехватывает и обрабатывает системные вызовы гостевого процесса5. Время старта контейнера с рантаймом runsc составляет 25–45 мс9. Несмотря на то что эмуляция файловых операций в gVisor традиционно сопровождается снижением пропускной способности, стресс-тесты конкурентности почти целиком протекают в оперативной памяти и задействуют вызовы futex и clone, обработка которых в актуальных версиях рантайма оптимизирована и не создает критических задержек.  
Попытка переноса стресс-тестирования в браузерную среду через WebAssembly и проекты класса CheerpJ 3.0/4.x оказывается несостоятельной для высоконагруженных многопоточных проверок12. Архитектура CheerpJ базируется на трансляции байткода и эмуляции системных примитивов поверх JavaScript и WebAssembly12. Потоки исполнения в WASM отображаются на Web Workers через общую память SharedArrayBuffer. В таких условиях отсутствует реальное вытесняющее планирование на уровне системных ядер, а накладные расходы на координацию ста параллельных воркеров приводят к исчерпанию ресурсов вкладки браузера.  
Главный дефект клиентского WASM-исполнения заключается в искажении модели памяти Java (JMM)17. Реальные ошибки параллелизма — аппаратное переупорядочивание инструкций, рассинхронизация процессорных кэшей L1/L2/L3 и эффекты видимости записей без барьеров памяти — маскируются прослойкой веб\-движка17. Кроме того, первоначальная загрузка рантайма стандартных библиотек объемом более 20–40 МБ не позволяет обеспечить мгновенный отклик системы12. В силу указанных причин серверное исполнение в микроконтейнерах остается безальтернативным решением.

## **Технологии минимизации задержки компиляции и исполнения Java 21**

Стандартный холодный запуск цепочки javac с последующим запуском консольного раннера JUnit 5 в изолированном контейнере занимает от 900 до 1800 мс2. Достижение целевого бюджета времени требует оптимизации каждого этапа жизненного цикла задачи.  
Математическая декомпозиция суммарного времени обработки запроса выражается следующим уравнением:  
![][image1]  
Для соблюдения жесткого временного бюджета компоненты системы должны укладываться в строгие интервалы:

* ![][image2] при использовании предварительно прогретого пула контейнеров или прямого порождения через системные вызовы.  
* ![][image3] за счет resident-компилятора, постоянно удерживаемого в памяти20.  
* ![][image4] посредством применения технологий AppCDS и первого уровня JIT-компиляции C121.  
* ![][image5] при выполнении высокоплотного стресс-теста на 100 потоках.  
* ![][image6] за счет асинхронного уничтожения временных дескрипторов. В результате итоговое расчетное время составляет ![][image7], что гарантирует выполнение SLA в 350 мс с запасом на сетевую транспортировку данных.

Применение стандартного компилятора OpenJDK javac для единичных файлов неэффективно, так как инициализация его подсистем и разбор абстрактного синтаксического дерева отнимают 300–600 мс. Оптимальным решением для Java 21 выступает Eclipse Compiler for Java (ECJ), встроенный в процесс долгоживущего демона23. Компилятор ECJ оптимизирован для инкрементальной трансляции и способен взаимодействовать со стандартным интерфейсом javax.tools.JavaCompiler23. Демон компиляции исключает работу с постоянными дисковыми накопителями, используя файловую систему в оперативной памяти (tmpfs), примонтированную в директорию /dev/shm. Байткод генерируется напрямую в структуры оперативной памяти и становится доступным контейнерам исполнения без физических операций ввода-вывода.  
Второй критический фактор задержки — время инициализации целевой виртуальной машины HotSpot. По умолчанию JVM запускается с включенной многоуровневой JIT-компиляцией (Tiered Compilation), в рамках которой серверный компилятор C2 производит агрессивную оптимизацию байткода, тратя десятки мегабайт памяти и сотни миллисекунд процессорного времени19. Для кратковременных задач проверки кода фаза компиляции C2 избыточна19. Флаг \-XX:TieredStopAtLevel=1 ограничивает среду исключительно клиентским компилятором C1, который выполняет трансляцию байткода в машинные инструкции практически мгновенно и без сбора динамического профиля21.  
Сокращение фазы загрузки классов достигается генерацией архива Application Class Data Sharing (AppCDS)19. При формировании базового образа контейнера запускается подготовительный шаг, в ходе которого HotSpot выполняет тестовый прогон пустого раннера с флагом создания дампа \-XX:DumpLoadedClassList. Полученный файл используется для сборки оптимизированного двоичного архива классов (junit5-appcds.jsa)22. При последующих запусках со спецификацией \-XX:SharedArchiveFile=... виртуальная машина выполняет прямое проецирование классов фреймворка JUnit 5 и стандартной библиотеки в адресное пространство процесса через системный вызов mmap, полностью устраняя этап синтаксического разбора и внутренней верификации байткода19.  
Дополнительно в конфигурацию запуска закладывается последовательный сборщик мусора \-XX:+UseSerialGC, не требующий инициализации инфраструктурных потоков и структур памяти, характерных для G1 или ZGC19. Отключение генерации диагностических файлов производительности \-XX:-UsePerfData устраняет обращение к каталогу /tmp. В результате время от старта системного вызова execve до начала непосредственного выполнения тестовых сценариев стабильно составляет 45–55 мс.

## **Архитектура безопасности, харденинг и Zero-Trust изоляция**

Выполнение произвольного исходного кода требует реализации глубокоэшелонированной защиты (Defense-in-Depth), исключающей горизонтальную эскалацию привилегий, перехват конфигураций соседних окружений через псевдофайловую систему /proc и истощение ресурсов аппаратного узла5.  
Контрольные группы cgroups v2 выступают низкоуровневым фундаментом распределения аппаратных мощностей. Для контейнера запуска формируется изолированный узел в иерархии с жестким лимитированием по оперативной памяти, процессорным ресурсам и дескрипторам задач:

Bash  
\# Инициализация контрольной группы cgroups v2  
mkdir \-p /sys/fs/cgroup/sandbox\_eval

\# Установка жесткого и предупредительного порогов памяти  
echo "192M" \> /sys/fs/cgroup/sandbox\_eval/memory.max  
echo "160M" \> /sys/fs/cgroup/sandbox\_eval/memory.high  
echo "0" \> /sys/fs/cgroup/sandbox\_eval/memory.swap.max

\# Ограничение числа потоков и процессов ядра  
echo "150" \> /sys/fs/cgroup/sandbox\_eval/pids.max

\# Лимитирование процессорного времени (2 выделенных ядра)  
echo "200000 100000" \> /sys/fs/cgroup/sandbox\_eval/cpu.max

Механизм действия метрики memory.high заключается в запуске процесса упреждающей очистки страниц и замедлении распределения памяти при превышении порога в 160 МБ, что предотвращает внезапный аварийный останов через OOM-Killer до того, как система сформирует диагностический стек9. Параметр memory.swap.max=0 гарантирует изоляцию от дискового пространства хоста. Значение pids.max=150 тщательно откалибровано под задачу: создание 100 рабочих потоков в совокупности со служебными потоками HotSpot JVM (GC-воркеры, CompilerThread, Finalizer, Signal Dispatcher) суммарно требует около 125–135 потоков ядра7. Это исключает риск отказа в выделении системного потока, блокируя при этом классические атаки размножения процессов (fork-бомбы)6.  
Параметры декларативного запуска контейнеров формируют закрытый периметр выполнения:

Bash  
docker run \--rm \\  
  \--runtime=runsc \\  
  \--network=none \\  
  \--security-opt=no-new-privileges:true \\  
  \--cap-drop=ALL \\  
  \--read-only \\  
  \--tmpfs /tmp:rw,noexec,nosuid,size=32m \\  
  \--tmpfs /dev/shm:rw,noexec,nosuid,size=64m \\  
  \--volume /opt/platform/runtime:/opt/runtime:ro \\  
  \--volume /dev/shm/sandbox\_builds/session\_42:/sandbox/app:ro \\  
  \--pids-limit=150 \\  
  \--memory=192m \\  
  \--memory-swap=192m \\  
  \--cpus=2.0 \\  
  \--stop-timeout=3 \\  
  sandbox-runner:java21

Конфигурация \--network=none изолирует контейнер от внешних и локальных сетей, полностью предотвращая возможность обращения к внутренним IP-адресам хоста или сетевым метаданным облачной инфраструктуры6. Директива \--security-opt=no-new-privileges:true блокирует установку флагов SUID/SGID, делая невозможным локальное повышение прав26. Сброс всех системных привилегий \--cap-drop=ALL лишает приложение возможности взаимодействовать с сетевыми интерфейсами или вмешиваться в системные таблицы ядра27. Перевод корневого раздела в режим \--read-only блокирует попытки внедрения вредоносных библиотек, а выделенные разделы tmpfs ограничивают запись временных данных оперативной памятью с запретом запуска исполняемых файлов (noexec, nosuid).  
Защита от попыток хищения секретов и переменных окружения хоста обеспечивается изоляцией контекста запуска: оркестратор очищает переменные окружения и передает в гостевой процесс только фиксированные переменные виртуальной машины (JAVA\_HOME=/opt/java, LANG=C.UTF-8).  
Для гарантированного предотвращения зависаний в бесконечных циклах while(true) задействуется трехуровневая эшелонированная модель прерывания. Первый уровень реализован внутри виртуальной машины посредством аннотации @Timeout(value \= 2, unit \= TimeUnit.SECONDS) на методах JUnit 5, перехватывающей выполнение и формирующей стек-трейс зависшего потока. Второй уровень опирается на утилиту Linux timeout \-k 0.2s \-s SIGKILL 2.8s java ..., посылающую жесткий сигнал SIGKILL, который прерывает процесс независимо от его состояния в safepoints. Третий уровень обеспечивает внешний таймер в диспетчере Node.js, принудительно вызывающий Docker API kill ровно через 3200 мс после инициализации запроса.  
Фильтрация системных вызовов через кастомный профиль Seccomp блокирует эксплуатацию уязвимостей ядра посредством политики запрета по умолчанию (SCMP\_ACT\_ERRNO)28. В профиле оставлены исключительно те вызовы, которые требуются для функционирования подсистем памяти и потоков HotSpot JVM:

JSON  
{  
  "defaultAction": "SCMP\_ACT\_ERRNO",  
  "architectures": \[  
    "SCMP\_ARCH\_X86\_64",  
    "SCMP\_ARCH\_AARCH64"  
  \],  
  "syscalls": \[  
    {  
      "names": \[  
        "read", "write", "readv", "writev", "close", "fstat", "newfstatat",  
        "lseek", "pread64", "pwrite64", "poll", "epoll\_create1", "epoll\_ctl",  
        "epoll\_wait", "epoll\_pwait", "select", "pselect6"  
      \],  
      "action": "SCMP\_ACT\_ALLOW"  
    },  
    {  
      "names": \[  
        "mmap", "mprotect", "munmap", "brk", "madvise", "rt\_sigaction",  
        "rt\_sigprocmask", "rt\_sigreturn", "sigaltstack"  
      \],  
      "action": "SCMP\_ACT\_ALLOW"  
    },  
    {  
      "names": \[  
        "clone", "clone3", "futex", "set\_robust\_list", "get\_robust\_list",  
        "sched\_yield", "sched\_getaffinity", "sched\_setaffinity", "gettid",  
        "nanosleep", "clock\_nanosleep", "clock\_gettime", "clock\_getres", "gettimeofday"  
      \],  
      "action": "SCMP\_ACT\_ALLOW"  
    },  
    {  
      "names": \[  
        "exit", "exit\_group", "getpid", "getppid", "getuid", "geteuid",  
        "getgid", "getegid", "prctl", "arch\_prctl", "sysinfo", "uname", "rseq"  
      \],  
      "action": "SCMP\_ACT\_ALLOW"  
    }  
  \]  
}

Любые сетевые вызовы (socket, connect, bind), манипуляции процессами (ptrace, kill) и попытки модификации файловых систем (mount, chroot) завершаются немедленным возвратом ошибки отсутствия прав (EPERM), изолируя ядро даже в случае гипотетического компрометирования прикладного слоя5.

## **Инструментарий и стенд стресс-тестирования конкурентности**

Проверка потокобезопасности кода кандидатов в ограниченном временном окне требует выбора инструментов, не создающих неоправданного оверхеда инициализации3.

| Фреймворк тестирования | Принцип обнаружения дефектов | Время выполнения анализа | Оверхед инициализации | Пригодность для веб\-интервью в реальном времени |
| :---- | :---- | :---- | :---- | :---- |
| **JCStress (OpenJDK)** | Статистический стресс JMM, деоптимизация | 10–60 секунд на тест | 1200–3000 мс (форки JVM) | Непригоден, не укладывается в бюджет \< 150 мс18 |
| **Lincheck (JetBrains)** | Проверка линеаризуемости, Model Checking | 1,5–5 секунд на класс | 800–1500 мс (трансформация) | Ограниченная, избыточен для базовой проверки контрактов32 |
| **Fray (CMU 2025/2026)** | Shadow locks, адаптивный поиск чередований | 0,8–2 секунды | 400–700 мс (байткод-агент) | Экспериментальная, оверхед динамического агента33 |
| **JUnit 5 \+ Concurrency Harness** | Мгновенный состязательный всплеск (Burst Contention) | 80–120 мс | \< 10 мс (нативные примитивы) | Идеальная, полное соответствие временным ограничениям4 |

Фреймворк JCStress ориентирован на верификацию компиляторов и самого рантайма Java, выполняя миллионы прогонов для провокации тонких эффектов памяти3. Lincheck и Fray гарантируют превосходное покрытие пространства состояний, однако трансформация байткода и поиск чередований неизбежно выходят за пределы выделенного окна исполнения32.  
Ведущие оценочные сервисы (LeetCode, CoderPad) решают эту задачу через организацию состязательного всплеска (burst contention) с помощью примитивов CountDownLatch и параллельным непрерывным аудитом графа взаимных блокировок с использованием ThreadMXBean4. Вероятность выявления некорректной синхронизации при одновременном спуске барьера описывается зависимостью:  
![][image8]  
где ![][image9], а ![][image10] представляет вероятность нахождения потока ![][image11] в критической секции. Одновременный пуск ста рабочих потоков доводит вероятность обнаружения гонки до значений, близких к единице, за доли секунды17.

Java  
package com.platform.test;

import org.junit.jupiter.api.\*;  
import java.lang.management.ManagementFactory;  
import java.lang.management.ThreadInfo;  
import java.lang.management.ThreadMXBean;  
import java.time.Duration;  
import java.util.concurrent.\*;  
import java.util.concurrent.atomic.AtomicInteger;  
import static org.junit.jupiter.api.Assertions.\*;

public class ConcurrencyStressTest {

    private static final int THREAD\_COUNT \= 100;  
    private static final int ITERATIONS\_PER\_THREAD \= 1000;  
    private static final ThreadMXBean threadMXBean \= ManagementFactory.getThreadMXBean();

    @Test  
    @DisplayName("Стресс-тестирование конкурентности и отсутствия взаимных блокировок")  
    void stressTestConcurrentExecution() {  
        assertTimeoutPreemptively(Duration.ofMillis(1200), () \-\> {  
            // Тестируемый класс реализации кандидата  
            CandidateThreadSafeCounter counter \= new CandidateThreadSafeCounter();

            ExecutorService executor \= Executors.newFixedThreadPool(THREAD\_COUNT);  
            CountDownLatch readyGate \= new CountDownLatch(THREAD\_COUNT);  
            CountDownLatch startFireGate \= new CountDownLatch(1);  
            CountDownLatch completionGate \= new CountDownLatch(THREAD\_COUNT);

            AtomicInteger executionErrors \= new AtomicInteger(0);

            for (int i \= 0; i \< THREAD\_COUNT; i++) {  
                executor.execute(() \-\> {  
                    readyGate.countDown();  
                    try {  
                        // Ожидание одновременного старта всех 100 потоков  
                        startFireGate.await();

                        for (int j \= 0; j \< ITERATIONS\_PER\_THREAD; j++) {  
                            counter.increment();  
                        }  
                    } catch (Throwable t) {  
                        executionErrors.incrementAndGet();  
                    } finally {  
                        completionGate.countDown();  
                    }  
                });  
            }

            // Ожидание гарантированного выхода всех потоков на стартовую позицию  
            assertTrue(readyGate.await(300, TimeUnit.MILLISECONDS),   
                "Превышен лимит времени инициализации пула потоков");

            // Мгновенное высвобождение всех потоков для создания максимальной состязательности  
            startFireGate.countDown();

            // Циклическая проверка взаимных блокировок до завершения работы  
            boolean completed \= false;  
            while (\!completed) {  
                completed \= completionGate.await(15, TimeUnit.MILLISECONDS);  
                if (\!completed) {  
                    inspectDeadlocks();  
                }  
            }

            executor.shutdown();  
            assertTrue(executor.awaitTermination(100, TimeUnit.MILLISECONDS),   
                "Не удалось остановить пул потоков");

            assertEquals(0, executionErrors.get(),   
                "Зафиксированы необработанные исключения в параллельных потоках");

            int expectedTotal \= THREAD\_COUNT \* ITERATIONS\_PER\_THREAD;  
            assertEquals(expectedTotal, counter.getValue(),   
                "Нарушение согласованности данных: обнаружено состояние гонки (Race Condition)");  
        });  
    }

    /\*\*  
     \* Программное сканирование графа мониторов и блокировок JVM  
     \*/  
    private static void inspectDeadlocks() {  
        long\[\] deadlockedThreadIds \= threadMXBean.findDeadlockedThreads();  
        if (deadlockedThreadIds \!= null && deadlockedThreadIds.length \> 0) {  
            ThreadInfo\[\] threadInfos \= threadMXBean.getThreadInfo(deadlockedThreadIds, true, true);  
            StringBuilder sb \= new StringBuilder("Обнаружена взаимная блокировка потоков (Deadlock):\\n");  
            for (ThreadInfo ti : threadInfos) {  
                sb.append("Поток '").append(ti.getThreadName())  
                  .append("' заблокирован на мониторе ").append(ti.getLockInfo())  
                  .append(", принадлежащем потоку '").append(ti.getLockOwnerName()).append("'\\n");  
            }  
            throw new AssertionError(sb.toString());  
        }  
    }  
}

Разделение процесса синхронизации на фазы сбора (readyGate) и одновременного старта (startFireGate) исключает размазывание нагрузки по времени4. Вызов threadMXBean.findDeadlockedThreads() с интервалом опроса 15 мс выявляет зацикленные зависимости в объектах synchronized и реализациях Lock практически мгновенно35. Это исключает бесполезное ожидание окончания глобального тайм-аута и сразу возвращает кандидату читаемый отчет с именами конфликтующих потоков35. В стресс-тестах используются нативные потоки платформы, так как виртуальные потоки Java 21 (Project Loom) мультиплексируются на ограниченный пул потоков-носителей, что искажает состязательность за системные мониторы ядра.

## **Архитектурные спецификации и эталонная реализация для Node.js и Docker Compose**

Жизненный цикл исполнения строится по конвейерному принципу, исключающему дисковые транзакции и оптимизирующему задержку взаимодействия сервисов.

| Фаза конвейера | Реализующий компонент | Временной бюджет | Механизм обеспечения безопасности и скорости |
| :---- | :---- | :---- | :---- |
| **1\. Прием запроса** | Node.js API Orchestrator | \< 5 мс | Парсинг и валидация пейлоада в оперативной памяти |
| **2\. Компиляция** | Eclipse ECJ Compiler Daemon | 15–25 мс | Трансляция в resident-памяти демона, сброс байткода в tmpfs \[cite: 23\] |
| **3\. Выделение песочницы** | Warm Container Pool Manager | \< 5 мс | Захват контейнера из пула предзапущенных runsc-инстансов9 |
| **4\. Запуск JUnit 5** | HotSpot JVM под gVisor | 80–120 мс | AppCDS \+ C1 JIT (TieredStopAtLevel=1), 100 потоков11 |
| **5\. Сбор результатов** | Node.js Stream Multiplexer | \< 5 мс | Чтение stdout/stderr из UNIX-пайпов, парсинг JSON-вердикта |
| **6\. Рециркуляция** | Background Lifecycle Worker | \< 10 мс | Асинхронное уничтожение контейнера и очистка директории в tmpfs |

### **Спецификация оркестрации: docker-compose.yml**

Файл развертывания описывает изолированную топологию компонентов, выделяя оперативную память под единую точку обмена артефактами компиляции:

YAML  
version: '3.8'

networks:  
  platform-net:  
    driver: bridge  
    internal: false  
  sandbox-net:  
    driver: bridge  
    internal: true

services:  
  api-orchestrator:  
    build:  
      context: ./orchestrator  
      dockerfile: Dockerfile  
    container\_name: api\_orchestrator  
    restart: always  
    ports:  
      \- "3000:3000"  
    volumes:  
      \- /var/run/docker.sock:/var/run/docker.sock  
      \- shared-tmpfs:/dev/shm/sandbox\_builds  
      \- ./security/seccomp.json:/opt/platform/seccomp.json:ro  
    environment:  
      \- PORT=3000  
      \- COMPILER\_URL=http://compiler-daemon:8080  
      \- RUNNER\_IMAGE=sandbox-runner:java21  
      \- WARM\_POOL\_SIZE=5  
    networks:  
      \- platform-net  
    depends\_on:  
      \- compiler-daemon

  compiler-daemon:  
    build:  
      context: ./compiler-daemon  
      dockerfile: Dockerfile  
    container\_name: compiler\_daemon  
    restart: always  
    volumes:  
      \- shared-tmpfs:/dev/shm/sandbox\_builds  
    networks:  
      \- platform-net  
    deploy:  
      resources:  
        limits:  
          cpus: '2.0'  
          memory: 512M

volumes:  
  shared-tmpfs:  
    driver: local  
    driver\_opts:  
      type: tmpfs  
      device: tmpfs  
      o: "size=256m,uid=1000,gid=1000"

### **Высокоскоростной resident-демон компиляции: CompilerService.java**

Сервис запускается как постоянный фоновый процесс, удерживающий компилятор ECJ в прогретом состоянии:

Java  
package com.platform.compiler;

import com.sun.net.httpserver.HttpExchange;  
import com.sun.net.httpserver.HttpServer;  
import org.eclipse.jdt.internal.compiler.tool.EclipseCompiler;

import javax.tools.\*;  
import java.io.\*;  
import java.net.InetSocketAddress;  
import java.nio.charset.StandardCharsets;  
import java.nio.file.\*;  
import java.util.\*;

public class CompilerService {

    public static void main(String\[\] args) throws IOException {  
        HttpServer server \= HttpServer.create(new InetSocketAddress("0.0.0.0", 8080), 0);  
        server.createContext("/compile", CompilerService::handleCompile);  
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());  
        server.start();  
    }

    private static void handleCompile(HttpExchange exchange) throws IOException {  
        if (\!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {  
            exchange.sendResponseHeaders(405, \-1);  
            return;  
        }

        String runId \= UUID.randomUUID().toString();  
        Path runDir \= Paths.get("/dev/shm/sandbox\_builds", runId);  
        Files.createDirectories(runDir);

        byte\[\] sourceBytes \= exchange.getRequestBody().readAllBytes();  
        String sourceContent \= new String(sourceBytes, StandardCharsets.UTF\_8);

        Path sourcePath \= runDir.resolve("CandidateThreadSafeCounter.java");  
        Files.writeString(sourcePath, sourceContent, StandardCharsets.UTF\_8);

        // Инициализация прогретого компилятора Eclipse в процессе  
        JavaCompiler compiler \= new EclipseCompiler();  
        DiagnosticCollector\<JavaFileObject\> diagnostics \= new DiagnosticCollector\<\>();  
        StandardJavaFileManager fileManager \= compiler.getStandardFileManager(diagnostics, null, StandardCharsets.UTF\_8);

        Iterable\<? extends JavaFileObject\> compilationUnits \=   
            fileManager.getJavaFileObjectsFromFiles(List.of(sourcePath.toFile()));

        List\<String\> compilerOptions \= List.of(  
            "-d", runDir.toString(),  
            "--release", "21"  
        );

        JavaCompiler.CompilationTask task \= compiler.getTask(  
            null, fileManager, diagnostics, compilerOptions, null, compilationUnits  
        );

        boolean isSuccess \= task.call();  
        fileManager.close();

        if (isSuccess) {  
            String jsonSuccess \= "{\\"status\\":\\"OK\\",\\"runId\\":\\"" \+ runId \+ "\\"}";  
            exchange.getResponseHeaders().set("Content-Type", "application/json");  
            exchange.sendResponseHeaders(200, jsonSuccess.length());  
            try (OutputStream os \= exchange.getResponseBody()) {  
                os.write(jsonSuccess.getBytes(StandardCharsets.UTF\_8));  
            }  
        } else {  
            StringBuilder errorLog \= new StringBuilder();  
            for (Diagnostic\<? extends JavaFileObject\> d : diagnostics.getDiagnostics()) {  
                errorLog.append(d.getMessage(Locale.ENGLISH)).append("\\n");  
            }  
            byte\[\] errorBytes \= errorLog.toString().getBytes(StandardCharsets.UTF\_8);  
            exchange.getResponseHeaders().set("Content-Type", "text/plain");  
            exchange.sendResponseHeaders(400, errorBytes.length);  
            try (OutputStream os \= exchange.getResponseBody()) {  
                os.write(errorBytes);  
            }  
        }  
    }  
}

### **Node.js / TypeScript: Контроллер исполнения и управления пулом контейнеров**

Оркестратор поддерживает пул прогретых контейнеров с рантаймом runsc, отсекает зависания по таймеру и гарантирует нулевую утечку состояния между прогонами:

TypeScript  
import Docker from 'dockerode';  
import axios from 'axios';  
import { promises as fs } from 'fs';  
import path from 'path';

const docker \= new Docker({ socketPath: '/var/run/docker.sock' });  
const COMPILER\_URL \= process.env.COMPILER\_URL || 'http://localhost:8080';  
const RUNNER\_IMAGE \= process.env.RUNNER\_IMAGE || 'sandbox-runner:java21';  
const WARM\_POOL\_SIZE \= parseInt(process.env.WARM\_POOL\_SIZE || '3', 10);

interface ExecutionResult {  
  stdout: string;  
  stderr: string;  
  exitCode: number;  
  durationMs: number;  
  timedOut: boolean;  
}

export class SandboxOrchestrator {  
  private warmPool: Docker.Container\[\] \= \[\];  
  private seccompProfile: string \= '';

  constructor() {  
    this.bootstrap();  
  }

  private async bootstrap(): Promise\<void\> {  
    try {  
      this.seccompProfile \= await fs.readFile('/opt/platform/seccomp.json', 'utf8');  
      await this.replenishPool();  
    } catch (err) {  
      console.error('Ошибка инициализации оркестратора:', err);  
    }  
  }

  private async replenishPool(): Promise\<void\> {  
    while (this.warmPool.length \< WARM\_POOL\_SIZE) {  
      try {  
        const container \= await this.spawnSandboxedRunner();  
        this.warmPool.push(container);  
      } catch (err) {  
        console.error('Сбой при подготовке прогретого контейнера:', err);  
        break;  
      }  
    }  
  }

  private async spawnSandboxedRunner(): Promise\<Docker.Container\> {  
    const container \= await docker.createContainer({  
      Image: RUNNER\_IMAGE,  
      Cmd: \['sleep', '3600'\], // Режим ожидания команды в пуле  
      HostConfig: {  
        Runtime: 'runsc', // Выполнение под user-space ядром gVisor  
        NetworkMode: 'none',  
        Memory: 192 \* 1024 \* 1024,  
        MemorySwap: 192 \* 1024 \* 1024,  
        NanoCpus: 2 \* 1e9,  
        PidsLimit: 150,  
        CapDrop: \['ALL'\],  
        SecurityOpt: \[  
          'no-new-privileges:true',  
          \`seccomp=${this.seccompProfile}\`  
        \],  
        Binds: \[  
          'shared-tmpfs:/dev/shm/sandbox\_builds:ro',  
          '/opt/platform/runtime:/opt/runtime:ro'  
        \],  
        ReadonlyRootfs: true,  
        Tmpfs: {  
          '/tmp': 'rw,noexec,nosuid,size=32m'  
        }  
      }  
    });

    await container.start();  
    return container;  
  }

  public async runSubmission(code: string): Promise\<ExecutionResult\> {  
    const startTimestamp \= Date.now();

    // 1\. Быстрая компиляция в оперативной памяти через resident-демон  
    const compileResponse \= await axios.post(\`${COMPILER\_URL}/compile\`, code, {  
      headers: { 'Content-Type': 'text/plain' },  
      timeout: 2500  
    });  
    const runId \= compileResponse.data.runId;

    // 2\. Извлечение прогретого контейнера из пула  
    let runner \= this.warmPool.pop();  
    if (\!runner) {  
      runner \= await this.spawnSandboxedRunner();  
    }  
    // Асинхронное пополнение пула до целевого размера  
    this.replenishPool();

    const classPath \= \`/opt/runtime/junit-runner.jar:/opt/runtime/junit-platform.jar:/dev/shm/sandbox\_builds/${runId}\`;  
    const executionCmd \= \[  
      'java',  
      '-XX:TieredStopAtLevel=1',  
      '-XX:SharedArchiveFile=/opt/runtime/junit5-appcds.jsa',  
      '-Xshare:on',  
      '-XX:+UseSerialGC',  
      '-Xms64m',  
      '-Xmx128m',  
      '-XX:-UsePerfData',  
      '-cp', classPath,  
      'com.platform.test.ConcurrencyStressTest'  
    \];

    // 3\. Выполнение внутри подготовленной песочницы  
    const execInstance \= await runner.exec({  
      Cmd: executionCmd,  
      AttachStdout: true,  
      AttachStderr: true  
    });

    return new Promise((resolve) \=\> {  
      let isTimedOut \= false;  
      const executionTimer \= setTimeout(async () \=\> {  
        isTimedOut \= true;  
        try {  
          await runner.kill({ signal: 'SIGKILL' });  
        } catch (\_) {}  
        resolve({  
          stdout: '',  
          stderr: 'Выполнение прервано: превышен жесткий лимит времени (3 секунды)',  
          exitCode: 124,  
          durationMs: Date.now() \- startTimestamp,  
          timedOut: true  
        });  
      }, 3000);

      execInstance.start({}, (err, stream) \=\> {  
        if (err || \!stream) {  
          clearTimeout(executionTimer);  
          return resolve({  
            stdout: '',  
            stderr: 'Сбой запуска процесса в песочнице: ' \+ err?.message,  
            exitCode: 1,  
            durationMs: Date.now() \- startTimestamp,  
            timedOut: false  
          });  
        }

        let stdoutData \= '';  
        let stderrData \= '';

        docker.modem.demuxStream(  
          stream,  
          { write: (chunk: Buffer) \=\> { stdoutData \+= chunk.toString('utf8'); } },  
          { write: (chunk: Buffer) \=\> { stderrData \+= chunk.toString('utf8'); } }  
        );

        stream.on('end', async () \=\> {  
          clearTimeout(executionTimer);  
          if (isTimedOut) return;

          const inspectData \= await execInstance.inspect();  
          const totalDuration \= Date.now() \- startTimestamp;

          // Очистка каталога сборки в tmpfs  
          fs.rm(path.join('/dev/shm/sandbox\_builds', runId), { recursive: true, force: true }).catch(() \=\> {});

          // Уничтожение использованного контейнера для соблюдения Zero-Trust  
          runner.stop().then(() \=\> runner.remove()).catch(() \=\> {});

          resolve({  
            stdout: stdoutData,  
            stderr: stderrData,  
            exitCode: inspectData.ExitCode ?? 0,  
            durationMs: totalDuration,  
            timedOut: false  
          });  
        });  
      });  
    });  
  }  
}

## **Рекомендации и открытые репозитории экосистемы**

Анализ архитектурных ограничений и практических замеров производительности указывает на однозначный набор технологий для развертывания на выделенном Linux VPS:

> 1. Базовый изолирующий рантайм: связка Docker Engine и runsc (Google gVisor) устраняет риск эксплуатации 0-day уязвимостей общего хостового ядра5. На bare-metal серверах с прямым системным доступом и отказом от Docker альтернативой служит isolate5.  
> 2. Подсистема компиляции: резидентный фоновый сервис на базе Eclipse ECJ, взаимодействующий с файловой системой в оперативной памяти (tmpfs), обеспечивающий время сборки исходного кода в пределах 15–25 мс23.  
> 3. Подсистема исполнения: дистрибутив OpenJDK 21 со сгенерированным архивом AppCDS и ограничением JIT-компилятора уровнем C1 (-XX:TieredStopAtLevel=1), что снижает задержку старта виртуальной машины до 45–55 мс19.  
> 4. Стенд многопоточного тестирования: нативный раннер JUnit 5 с двухфазной барьерной синхронизацией состязательности через CountDownLatch и активным сканированием блокировок посредством ThreadMXBean.findDeadlockedThreads(), что исключает ложные срабатывания и зависания системы4.  
> 5. Поддержание пула: непрерывный пул прогретых контейнеров в Node.js оркестраторе, сводящий накладные расходы на выделение песочницы к значениям менее 5 мс.

| Проект экосистемы | URL репозитория | Назначение в архитектуре |
| :---- | :---- | :---- |
| **Google gVisor** | https://github.com/google/gvisor \[cite: 39\] | Изолирующий user-space рантайм runsc для безопасного исполнения кода |
| **IOI Isolate** | https://github.com/ioi/isolate \[cite: 15\] | Низкоуровневая Linux-песочница на базе пространств имен и cgroups v2 |
| **Judge0 Engine** | https://github.com/judge0/judge0 \[cite: 40\] | Эталонная реализация асинхронного сервиса проверки программ |
| **Engineer-man Piston** | https://github.com/engineer-man/piston \[cite: 6\] | Легковесный движок выполнения кода с изоляцией пользователей |
| **Eclipse JDT Core (ECJ)** | https://github.com/eclipse-jdt/eclipse.jdt.core \[cite: 23\] | Высокопроизводительный компилятор Java для resident-демона |
| **JetBrains Lincheck** | https://github.com/JetBrains/lincheck \[cite: 32\] | Фреймворк верификации линеаризуемости многопоточных структур JVM |
| **OpenJDK JCStress** | https://github.com/openjdk/jcstress \[cite: 36\] | Сьют стресс-тестирования аппаратной модели памяти Java |
| **Fray Testing Platform** | https://github.com/pastalab/fray \[cite: 34\] | Платформа детерминированного воспроизведения гонок в JVM |

#### **Источники**

> 1. Real-Time Collaborative Coding in a Web IDE \- ResearchGate, [https://www.researchgate.net/publication/220877468\_Real-Time\_Collaborative\_Coding\_in\_a\_Web\_IDE](https://www.researchgate.net/publication/220877468_Real-Time_Collaborative_Coding_in_a_Web_IDE)  
> 2. (PDF) Scaling Automated Programming Assessment Systems, [https://www.researchgate.net/publication/368528043\_Scaling\_Automated\_Programming\_Assessment\_Systems](https://www.researchgate.net/publication/368528043_Scaling_Automated_Programming_Assessment_Systems)  
> 3. Concurrency Testing in Software Testing \- GeeksforGeeks, [https://www.geeksforgeeks.org/software-testing/concurrency-testing-software-testing/](https://www.geeksforgeeks.org/software-testing/concurrency-testing-software-testing/)  
> 4. Java Concurrency: A Deep Dive into Multithreading and Best Practices, [https://wslisam.medium.com/java-concurrency-a-deep-dive-into-multithreading-and-best-practices-6d7b54f0c89b](https://wslisam.medium.com/java-concurrency-a-deep-dive-into-multithreading-and-best-practices-6d7b54f0c89b)  
> 5. Best E2B Alternatives for AI Code Sandboxes (2026) \- Beam Cloud, [https://www.beam.cloud/blog/best-e2b-alternatives](https://www.beam.cloud/blog/best-e2b-alternatives)  
> 6. engineer-man/piston: A high performance general purpose code, [https://github.com/engineer-man/piston](https://github.com/engineer-man/piston)  
> 7. Configuration \- Piston \- Read the Docs, [https://piston.readthedocs.io/en/latest/configuration/](https://piston.readthedocs.io/en/latest/configuration/)  
> 8. Design a Sandboxed Code-Execution Service \- Rudrite Explainers, [https://explainers.rudrite.com/sandboxed-code-execution](https://explainers.rudrite.com/sandboxed-code-execution)  
> 9. Rustbox vs Docker, Firecracker, gVisor & Wasm: Code Isolation, [https://rustbox.sh/blog/rustbox-vs-docker-firecracker-gvisor-wasm-code-isolation](https://rustbox.sh/blog/rustbox-vs-docker-firecracker-gvisor-wasm-code-isolation)  
> 10. GitHub \- zesty-fox/isolate-integration: A Rust interface for the ioi, [https://github.com/zesty-fox/isolate-integration](https://github.com/zesty-fox/isolate-integration)  
> 11. Top AI sandbox platforms in 2026, ranked | Blog \- Northflank, [https://northflank.com/blog/top-ai-sandbox-platforms-for-code-execution](https://northflank.com/blog/top-ai-sandbox-platforms-for-code-execution)  
> 12. Deep dive into CheerpJ 3.0: A WebAssembly Java Virtual Machine, [https://labs.leaningtech.com/blog/cheerpj-3-deep-dive](https://labs.leaningtech.com/blog/cheerpj-3-deep-dive)  
> 13. Rustbox vs Judge0 vs E2B vs Piston: Choosing a Code Execution, [https://rustbox.sh/blog/rustbox-vs-judge0-vs-e2b-vs-piston-code-execution-engine](https://rustbox.sh/blog/rustbox-vs-judge0-vs-e2b-vs-piston-code-execution-engine)  
> 14. OTC CatchUp Summaries \- Our Tech Community, [https://catchup.ourtech.community/summary/](https://catchup.ourtech.community/summary/)  
> 15. Isolate \- Sandbox for securely executing untrusted programs \- GitHub, [https://github.com/ioi/isolate](https://github.com/ioi/isolate)  
> 16. Troubleshooting on Java program execution \#57 \- ioi/isolate \- GitHub, [https://github.com/ioi/isolate/issues/57](https://github.com/ioi/isolate/issues/57)  
> 17. Concurrency in Java, Python & Go — 145-Topic Interview Guide, [https://crackingwalnuts.com/concurrency](https://crackingwalnuts.com/concurrency)  
> 18. Concurrency Performance Patterns & Best Practices \- Medium, [https://medium.com/codetodeploy/concurrency-performance-patterns-best-practices-8c509a526c11](https://medium.com/codetodeploy/concurrency-performance-patterns-best-practices-8c509a526c11)  
> 19. Speed Up Existing Deployments with the Right JVM Features, [https://javapro.io/2025/04/17/speed-up-existing-deployments-with-the-right-jvm-features/](https://javapro.io/2025/04/17/speed-up-existing-deployments-with-the-right-jvm-features/)  
> 20. Bridging Functional Correctness and Runtime Efficiency Gaps in, [https://openreview.net/forum?id=v0vCc5nFRT\&referrer=%5Bthe%20profile%20of%20Bingyu%20Liang%5D(%2Fprofile%3Fid%3D\~Bingyu\_Liang1)](https://openreview.net/forum?id=v0vCc5nFRT&referrer=%5Bthe+profile+of+Bingyu+Liang%5D\(/profile?id%3D~Bingyu_Liang1\))  
> 21. Performance Tuning Java in Production: 2026 Guide \- Khimananda Oli, [https://khimananda.com/blog/performance-tuning-java-in-production](https://khimananda.com/blog/performance-tuning-java-in-production)  
> 22. HotSpot vs OpenJ9 — choosing the right JVM | BellSoft Java, [https://bell-sw.com/announcements/2022/06/28/hotspot-vs-openj9-performance-comparison/](https://bell-sw.com/announcements/2022/06/28/hotspot-vs-openj9-performance-comparison/)  
> 23. Java compiler \- Grokipedia, [https://grokipedia.com/page/Java\_compiler](https://grokipedia.com/page/Java_compiler)  
> 24. My Slides \- Logico Inside, [https://logico-jp.dev/my-slides/](https://logico-jp.dev/my-slides/)  
> 25. 7 Ways to Replace Kaniko in your Container Image Builds, [https://www.codecentric.de/en/knowledge-hub/blog/7-ways-to-replace-kaniko-in-your-container-image-builds](https://www.codecentric.de/en/knowledge-hub/blog/7-ways-to-replace-kaniko-in-your-container-image-builds)  
> 26. Restrict a Container's Syscalls with seccomp \- Kubernetes, [https://kubernetes.io/docs/tutorials/security/seccomp/](https://kubernetes.io/docs/tutorials/security/seccomp/)  
> 27. Docker Didn't Invent Containers. Linux Did. \- Dev Genius, [https://blog.devgenius.io/docker-didnt-invent-containers-linux-did-e482c155b99b](https://blog.devgenius.io/docker-didnt-invent-containers-linux-did-e482c155b99b)  
> 28. Docker Security Profile | CyberArk Docs, [https://docs.cyberark.com/secrets-manager-sh/12.1/en/content/deployment/platforms/docker-sec-profile.htm](https://docs.cyberark.com/secrets-manager-sh/12.1/en/content/deployment/platforms/docker-sec-profile.htm)  
> 29. Seccomp security profiles for Docker, [https://docs.docker.com/engine/security/seccomp/](https://docs.docker.com/engine/security/seccomp/)  
> 30. Using seccomp \- Making your applications more secure, [https://spinscale.de/posts/2020-10-27-seccomp-making-applications-more-secure.html](https://spinscale.de/posts/2020-10-27-seccomp-making-applications-more-secure.html)  
> 31. Best Online Java Compilers with Autocomplete (2026) \- Codersera, [https://codersera.com/blog/best-online-java-compiler-with-autocomplete/](https://codersera.com/blog/best-online-java-compiler-with-autocomplete/)  
> 32. Extending Lincheck with Modular Loop Detection for Concurrent, [https://repository.tudelft.nl/file/File\_db08bad8-706c-4c91-8d52-fb9fa30bb68f?preview=1](https://repository.tudelft.nl/file/File_db08bad8-706c-4c91-8d52-fb9fa30bb68f?preview=1)  
> 33. Practical Concurrency Testing, [http://reports-archive.adm.cs.cmu.edu/anon/s3d2026/CMU-S3D-26-108.pdf](http://reports-archive.adm.cs.cmu.edu/anon/s3d2026/CMU-S3D-26-108.pdf)  
> 34. Fray Detects Concurrency Issues in JVM Languages \- InfoQ, [https://www.infoq.com/news/2025/12/fray-detects-concurrency-issues/](https://www.infoq.com/news/2025/12/fray-detects-concurrency-issues/)  
> 35. Java Concurrency \- Dead Lock @ https://jojozhuang.github.io, [https://jojozhuang.github.io/programming/java-concurrency-dead-lock/](https://jojozhuang.github.io/programming/java-concurrency-dead-lock/)  
> 36. Curated list of resources on testing distributed systems, [https://asatarin.github.io/testing-distributed-systems/](https://asatarin.github.io/testing-distributed-systems/)  
> 37. Programmatic deadlock detection in java \- Stack Overflow, [https://stackoverflow.com/questions/1102359/programmatic-deadlock-detection-in-java](https://stackoverflow.com/questions/1102359/programmatic-deadlock-detection-in-java)  
> 38. Docker Quick Start \- gVisor, [https://gvisor.dev/docs/user\_guide/quick\_start/docker/](https://gvisor.dev/docs/user_guide/quick_start/docker/)  
> 39. runsc doesn't work with rootless docker · Issue \#12575 · google/gvisor, [https://github.com/google/gvisor/issues/12575](https://github.com/google/gvisor/issues/12575)  
> 40. judge0/CHANGELOG.md at master \- GitHub, [https://github.com/judge0/judge0/blob/master/CHANGELOG.md](https://github.com/judge0/judge0/blob/master/CHANGELOG.md)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJ8AAAAbCAYAAABiOl0uAAAFAElEQVR4Xu2a6a9dUxjGnyLmsSIxt2IIKsQYQhQhotQUY1txUUGIOWIMNaspRGgrCCEk1AcRQ2jS8FH4LPHFd38E78+7Xmed1XP22eeefZtzdT3JL3fvtfaw9lrPetdwrlRVVVVVVVW1lXWi8UgLVhlnGDv5bVVTph2MvYu03Y3dirSpUjXf/0PzznzbG08brxhLjf0Ty4y/jdXGvsaxxv3GO8au/95ZNdfaJXGNcX2RN0hHG78avxjfGZuNjfL2nEodaDymLaPZDcZvxjFZGh/3kLEgS6vqXnsZNxlvJpaoXZ3TPpvkxvvSuFVTHPXQ+YnQjonXjc/VH8b5uKuz86puxQjD6LLWOEJuuDamC9E+D5SJ06yz5T0ttF/iG+MJ9X/8YuOo7LyqGzH6PJrgeLYK89Fme8rngKPECMf0iuGa+0tFPpyV0ph2rcvSgesm1qmJP43L+7OqOtYi4xl5tCPqTarFxgbjJfkC8QNjpUabMAz2ZJEeJsuNGWm52TBlbs5Zi4fCsJ5QNbliOGW686589Nmu74rZaR/5PC/MRhT90bjivysGi/zbjW/V3wkikuZewGDldYMMObZirjdovjeXukC97RyG9dj6YVtnrhWr+4PLjEI0KLAAKxdnk4hnYkIaj7+jotQ4ClNA0w4F5gtT5QYi/UL1m4/8Uc+blZjrfZ8o53tzKd7Ddg9E6J7RhD2ppe5OPK7m6MMQCV+otwNApCFqdSHefabxhrFcvsUyrqi769QzcJivjFSlMBnmCmMdksB4PDM3H0NzNV9HquabEvPFQgO29mKDj4IwX8w9p1knq/utJzoi+3rs77HXB6P26jBCGO1n+cIj0tsOu5gLMBrzPOC8NF95HuL5zBub3tMobubBgx6OjpRXBsaMSEWP4vwe+f23yHve8canKQ0w0hrjSnkFc8218pUez/wskZtvrTwC3iuPBkQH5luwQv6u++QR4wTjfeMr43T1ykcZ6MGDRCR7O0H545yoz68KDxu3ycsaRvjIONw4xfhavqH7Wrq3S1FH7PUB9dAmGLDYOC07J3ptUrsFRxnZwrCl2WhvImnkh9nIH/WeLcRNG+VD7R/GX4nN8oolGoYwykXyxjgusYe8cVkkUGFPqbdQCAMB9/Cul+UFxjx3qLfyK4dd7p1Jx/wE+Lx8YbI6cVXKw4gvysvC8QvGpcbNCX7bbBLvg9hm4PgT+d4nFU0l8zcqmvJHQ0xbdKacDNv8FEdnpePdqeZFDOVnmyS2SkoiL/JRGDDPGxVdJ9ahxnrjd+PZBI17mPwnOhqb6JMbKIZTFOZjFc2KOo9Icd2wYXdGHomiV8Z1iPviWrYX6ExEJhilQeaLipxv5kOMDpSP71hY5M1rMb8hIvCBdyXoYR/KQ3xEsGXySDTMfDQiUXQmpaMm80VEJaI9mIhhiO0hIitDLdddJi8n+2fAIqpJXZiP85NS2jhi+D63JVy7TYvIw7wCYzFkAtGQHXXmSEuN5+RmuNj4WD4vAqIc0fEH40bjIHnkPC9BtIK35Ht9zAe5/hy5wTErK8D4+W+N3OQ0PmViBcrc6z3jAPXmckRi7h8krsNMQBkvScc/yVeNDO8c826GMqD8lIuIz5TkVfm3L9L4quYbQ8y9Fhg7lxnyxmiaWwwT0YRIGv/QUIq0YXMJytHmnSxGYg6YQ/qkok6gqqqqqqqqqqqqqqqqqqpqm9c/NPADWATnwx0AAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAAbCAYAAACnSMe/AAAE7ElEQVR4Xu2Z26tVVRTGR2VJdy0CCyy7qWUJKYbRPQrDiEotrAwKzMzqoYzoHlSQ3YigGxoEvRRlPkRkUoHYixGF9NqL7/0R+f0ac3Tmmq19OWfvo/ts5wc/9rrtvdec85tjjDWXWVVVVVVV1bTqCvFcH2wQV4nZ/rWqLjpBLBLz03apWWJOcewUcXJxbCRUDTJ8jY1BjhOvinfE9WJeYrX4R2wUZ4pLxVPiY3HSv988OsRAws3icXF883SrmETbxCrxqNgvbsgvkBaL38Vv4gexV3xj3vcjpXPEC/b/qPCA+ENckh2jUc+IY7Jj46oTxe3io8R14tjGFe0iKnwlXjLvUyYgZtlj3teA6Mufzc2xSzxsIxg9EDMDQoRDeE98bc0wSKPuzvbHUQzSQ+JDsdzcFP0YI3S6+DLBNpOJCP2ruDiB6MutaXukxcygIaGzEt+bz4I8WiwQC7P9cRJ98Jh4S1xkg0VJ0hBpCZ1hnjreNY8oEanDIPzPaTZxfTe9Yp72d5un/VJxntTF7yM+I52V56akFYmD4s7mqbEUHU1t9Zo4rzg3iIjCF4gXxafmky7XArFdvGn+APCZuN96GyVMQAmQi3ZgnNw8GIEUBmEKvt/JYH2JP4aBnTZDxBPcDvN6o6zDBhGGuFE8Yh6Vzm2etrnmdUcYgtrkJ3HXf1e0i98j8nxi/rAQDwzLxNvWHHzMEITCNFMa26g92uqPIyk6kWI5QjSD+aQ4O79oAFFjUG9Qd9xjXqAOS6SQp8U+cX6iTQw0g14OfCkMco35BOYTuBZjMbHDIPF7MeGHIlxPtQ1l/XEkRejfaW4SoPHMlinNgi6ivUvMnzooVPParF9hNqJDvvbBAJEWHkwgBna9TUSQGNAY4E4pAINwLo8O9AMRJDdIpJxqkCGqGqSHojiFUS5Qp8sguTAlhSsFLHQasFK3iL/N15ZCYZDNiTDDL+bFKppMiuFeIs0ANQnHcoMgzJP/Zoh+61XrtIqbjz9t63xm2G3iZfFGYpP5Y91q8+/zqHiH+Q2Re4FqfW06z+y82ryhDPKVYmniC/P6h9nLoPBJzcHn5+LCRGkQCk06aYv5Og30ehroV7G49bx5W1n46qaV4oB5LYOiBvlTXJZAFKi0PTTffOGs18CFQXJDRRFaGgQTYUzIowj/0Ta+reJCntNJK3+Zux/2mle7RJXQteJ1885nrQAY+FU28UwPbDOTItSRHpabi8bQSK6jAdE4xD6LSpxjIJiFG61pCMj3memsdLLewHcwL8RAHG7RNxiCdrEAGUvtTKDoH0S/vC/uNS+6mRxMrm7G5jcZ7JjADHQMdkSp/DyKQjbOlWYZqpjVT5QHzW88/1O2ORYGofFxwxznhlGbQfJ9ohURhaepTgbhOyxV32r+WBmU6w6HWxiWe6M2aHtZh6hXog1cP+NFXbLNmmF2nvkswDwhttfZ4AbZbP5b3SIIi1GksOhgCkugUOxH3H9urG5cbqNTuI+kWB941nzgSCtwkzjV/CUe6QbYZsBID8B7CNIF138nPjB/u8kgs0+IBQzyrXloJnSyyojB2P7R/DcAQ7JPOqI+WGO+Ysn37kvw6rwfVYNMg+KFXhk6245NRhFByMP9DnCIcN2p8q+a4YoXhBRppIslzdNVR7uqQaq6KlJTFLWTTS9VVVVVVVVVM0uHALIu8rEuWyuQAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAAAbCAYAAACa2qbZAAAFFUlEQVR4Xu2aaascRRSGX/c1uCEuqJm44UaigqhoNIoiRgIiJrhjRHBX3HfMAorRuOEuGBXUoMYPKi4gKIp+0z/gF7/7I/Q8OXWYmro9mb4zHTNk6oWHuV3VXd3T9fap02euVFVVVVVVNVM6w3i8BTcY5xp7+WFVHepg4+z02aTdjUXGKcaeRd/UqRpqx2unMdRuxjrjReNC4/DEcuNf41bjEPkXecB4y9h365FVpfZJrDKuLfqGaX9jvXwOLjHWGksH9pB6xibjOuNK4wPj5Kx/qnSk8aTmRp0bjT81eOEnGY8Yu2RtVdIBxmrjtcSpanePiDrPGrfJ9+8ZvxrPpH7mBDYaV6c2dI7xsXFQ1jY14qmAEOEUXjY+Nw7M+jDUymx71kXkJmpvMI6Xm6KNkUIY40e5kRDmIQotTtvcb/jJWJLaUM/4RZ5+TJ0ukD9hoUMT3xpPa/AG9YwTs+1ZFVH9iQR/z1dhPO7vR/JIQx7LakDUCi1L/CE3VggjfydfRZoU/aQsEe1y5f1vq5/CnJ/aAvZh34l0VuJv+Xpd1ddCeb5DVJrkRjOB8J7xmfGw3DA3pTYeaIRhYJihSFWGKfYpj0VhnNxstIWBgOvDbLnhxtKwLzHLiohCasCEE9V3HdhjfopJYwJ/N45N7TGJGIWXpWFzEcc2RZ8Q+zwoH6+MZLytf6r+8XHecr/cZGMpcqem/Cm0SBOcYB7ihvK2dL9xRNG3I8WShLGYAD7zJaqtuK/APWbJW5D1Mclfy8sHkxqKZJ/j88jDOBiF64/jYzzaOxWh9odEmT8hDPe8cVfRvr3Ek/OSuo2UpxnHlY1jiAh1nvGqsUJeLmirvRNvau6SwiSTcB+j8XMoFIbKzQKXGUdr0FCMzTmqocZQNdT/aKhIxmEaEnJu9AvqzlA8IDeru/EQY1J3ov60OrHfwB7DRXJPTlYaKpY8rhN+k89N6AR57rU0aysVhkKMSc4E5E+RM5U5VNMSGkYcS7fLnVo+ESHqI1zUfelv+ND4Iv19hfGl8ZD86SPKkQfBY/Lxlxt3G89pdC7GF33FuMe4xXg0EaULciv6rpcXXCPXoh/ulU8w+3Au3qIo1n4iz80iUnQhjEUtCjao3QNJtPxKHjFQTCzXxnjUpQCzloXNzRr+Mw3KDRURKKJQk4GIdrz5lQaKKNdanGyLfJn7y/gn8bPxvQafDMTJ8gvhDeVd+ZejJnNxamc/qrnUuICLIgk9PfUzxijn88U3ql+tZ3zYJH9KWQ7jDYlPtmmPinXccCaA8y1QtxFvUmEaCpkk5ixFT8kr5/wck4vvz0PLS8CZ8od4W0XNWOYwCMZhm4cZ+Js2+qI/ImSYKmfUHE2s0lDxW+Cl8vU+Cn3sFxcL8UXC7W0NlRsgxiL6UbEnWsZ4fLJNtOI8+Y3iePqO0nQZKnSYvBTR0/ByBPkrZgL+3mlUGgoRAd6XL22RyG8PQ0UVnwjFTxGM10t9fLLNDX8nEWUPoiyRjop0jEdE4FrmE85J5i9qSReJ/0yoyVCE6DfkOQEil2HieFu5JsF/LbBNIspkfmO8rm3/lIOhONcdcgORW8DlcuMS9vn5gwnkk23ar0rcKV8m1sjPQx/5FHkB1xQ5SltVQ3WoiDQYqqnkv4fmlhnaaJk84W5iYX+3raaliFgWEjkn19V0bpaPWPZyjXutVR2KNybepHjLGrVUVVWNVDVUVadi+SCpbVpCqqqqqqqqqqpmSf8BY7X6zC7AUg0AAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJMAAAAbCAYAAAB4Br2gAAAE3UlEQVR4Xu2a2Y8UVRTGP1HBLYoaI2oUFGJcUOOuuIAKSiYhKgaiBs0IuC/EJSoKceIScYsi7iQmGpcHlxcTlzfiu/4DvvjOH4Hnl3OPdftO93T3dI+0M/dLfpmuqttVXed+99xTt0aqqqqqqqqa9brY2N4Dm4yrjQX+taoh6TDj5HJnpnnGacZFxlHFsZFTNdPB1awx06HGy8bbxkpjUWLMOGBsNU40zjOeMj7WiN/QQRKGgNXGY8bhrYcnibbEea3xjfFS6+F/RezfNR42bjH2GqvyBqOkU40XNTnb3GP8aZyb7TvHeNY4JNs313Wksc74KHG9PJN00ynygXqT8aUmm4kYw5PGM+kzOsv4zjgzbY+UGEkQmp9gNPCjF2bHMNOGbHsu62jjPuND41K5gXoxUSmy/CeabKaTEj/LM1KI/qBf7sr2jYwYScdl2/lN7FRrFlpinJ1tz0URq0eNN41lGjxLdzITMwIwO1yb7e/UPhfHKFF+kU+TpeL4H/IEgfjLNpTHpq3LE38bt7UemtOiU6gZXzEWF8cGUSdzYCCgY9uZiSn1iGx/qTAM5Uou7gOT5UbDNL+mv2Egvt/JjD2Li8NQnDmLxBMvxS/1UVlfDqLpmgmmehB60HhaTbtoe4nxllqNwrXL6+cGm5aiVmpXL/2XiqUKliFGSdRE1EfUSRvlxfegmkkz8T2SQpyL9rfLk0WYKc5XZrCBRa30W6Ksl0LLjaXlzhnQuGbgBock4nK+sUtehOc1Z7/qZKZBaiaEmTBLZB0gy5CZcjPFtDf0WFcz9aZqph4UhTe0K74J4rgGmEf7UNRuo67F8qKc4hz6LVg7mSN/qs774gTjJ3WPTZgppjqghmJfbibEtcvaCtHPTIvT0kNqLlwahhXde+UjhRVbFtOAJ4ozjOeM++ULcdQSBGBbgvNuka/6smbyvXxUvydft4oFuhvlC6i03a0mYCxHPCHPAvC4cayac1EYs0L8o3xR9coE268bn8ozLXXO8/JA81uGKRZ/4QXjAfmbhV7UyUwRExYsy0VL7ou/UynMlNdYcY3STFGblQMYI5U+mFI0/kE+tf1l7E/sk1fzZKsQP4wngfwCpHgeU+PmuImb5R1NIQ0EYkJNQc0PJkCsAjNlXpd4VU0nj6d2dND78hEZukoeGDpsjbFDXhxPpG2etgBD04ZgfS3/rQSQwPabQYat4+WDYJ883sSePiAGDNDQIvkKOQOBuH9g3KH2JUiI2GCOSAqYIoxBTDmWH0dhqJxu2W8gtTMTn0m7txo3JJbIl/vJMrDZ+FzN3F+OgJgiyGChaMN3yicXrvmt3BBMBWSey+TvxLgedR1gZJSfY1TM1I8YYNRPVxjHFMf+t8rNROYBVoE/U5OZmOIuNL4wTk8winiZPCbv5NJMZBCgTYy4aMN5MUu+TEG2fEeefWIq2CMPOOdgGoT4zjDMRIaIwdKNCzR15qiSB4hOYiq7M0GHMn29IX/Ht0memdgmNcNK4zX5K4i7ja8SLAAiRhuwtsS+a+T/nUCbFcZ64xE17xEn1PpaB4OSkZjSMPjWBGIqZQD8Lv+97OczmTCu24uqmWZIFOMEKw8Ynxn5+b7orKiDehH1Au3jGiFqovJpI8SxqDPiu93+BaSqqqqqqqqqqqqqqqqqqkr/AN0C8lodNaBHAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAAAbCAYAAAC0n4dLAAAE5ElEQVR4Xu2Z26tVVRTGP81MK8luoIF5LDWTiO4URZ0gCQwh0VKwwii60IXKCkorujyIZUUPqZhgQSWGLxFl+CIFUg+F9OpL7/4RNn6NOdhzT9bal+ORs/XMD37sdZlrnbXm+OYYc80jVVVVVVVNc91svDUAjxl3GRf4ZeekZhgLjduMS9N+k2Yb1xmL0nabLpH37xVqv9eUqxqgo2lngPOMD4xPjPuMBYnVxinjaeNyY6XxmrHLuPD/K889XSzvixcSx4yP0nEIMQi2Gw8azxt/GOPZeTTLeFLerw8YW4030vGR0lXyhytH9ePG38b12bEVxpsaUSdPgl421qrzfjcZ/xivJjg+3zhovCPvMwYQZvhV3peA7jC+My5L+7T9XH7/kRLuhBDpDD4zfpC/cAgDPJLtj4IYUXRyv6xEu5nlwUxcv9v401iWjs0zvpH3Q/QFKf1Agm1MQdaI64BjGARjYJAQGfRLY05iJHSv/EVCVyZ+lr9EPtrHjOXZ/lSLVHzEOCxP11uMi7padHS3OoFtEymd1B/pHlPsVbcB0PnqpHLMd8jYKR/lENe9l9qEyKq/yEsqlOI8Zfcv+WCDXHEe7knH+Fth3jhHuwnr9sS/xsPdp0ZKpNpX1Ak4oxsz/ygPJESQlspHaV7HB9E1cmPlJSBEluT8NuMr+aAJEVwC3WSAPFM0KYLMtfn1EeQwR34MIugYIzfI0OJGkP+hUdQSeWBLYYiXEnQ2AfzauDpvNIAwDxmQEhBZMRf79xvPGjvUff9eBmgb3SHmCM/Jr49sgWhPhsvjQpDLdmGKCWWBqP1N9f9Mis8uYJStKc71E8/My5/uHCAXI51P3j1qTtW5aPu68ZvclHC6BsgDG4HkOFktNwDnIgP0e/+BhKuZzUJZ/0M3GNeWB1vEdzRpGQYRL152Wi+NG7/L5wBH5em4bQ7AfGGsPNgiRnZeMqLOYiDgvfJv/0jbmxMTnQMgAk2AIxMT3EXy4NM/uQG4fzWAqgEmzQAx+YOmCSCG2Kz29FXqVvln46CfjsMYgEkg3+1z0z6B4dt7v5ongaxfMEPvp5XyUhT3pWNfTLC9yjgpXzsJhQGo3UA/MYAopblRuCaC1RawMEBAwKn9bJcGiP1yvsa9eY62v9EqLmq6IeLT5wn54hALHDEzniOv30y6Nsk7OpZSf5KPTvjUWCzPHh8ajxrvq3tyNYwBek0CYyWPZyUw++TP1E984n5rvKvO8jeZILYJ7J3Gcfnzo5gDsGBEdgREuwPqXgj6wlif9tsUBgjFKCeYpQFirgF5FuA89xlIND4kT/sn5O6Go/LAkRVC/IGP1f2ApEmCyycR4pd9jkcagxBBWydfIBlX90gaxgCTLYzMIg2GKWFgACKrEHCekwW0WApeLTdDlE3aMRgwO32CIdnu9SkamQToi5L8mdhHUU4wQZybtJJQqskAbH+vTk3jl32ONxmAEfqMPHvQQXnAp9IAw4qRzfPeovZ/BmEGMg+LUPw2zanOKuUGiDrLiMZxY6kNv+zTQbkBuIaywCh4KLUdlwecuQIw+TpbDDAthYOp9Sx+bExQ25hhvy0PIL/sI8rHzgQ1c7GxQV5Xb5RP4vYYTyUwF/OGNVxcNbpiQpjXO8Q2GaJMc9T6IETKPCM1qqqqqqqqqqqqqqqqqqqX/gNcE/5BBKGo/gAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAbCAYAAAA53gJaAAACoklEQVR4Xu2Xy6tNURzHfx55ReFmgNJBymOg1BVFHXmVUkSKMkFEqUtSMlDMlImBxMCjlPKYKI+BSFEGJjIzMfdH8P2ctVZn3WWdc/a+5WxX61Ofzjnrsfdev/Vb66xtVigUJgl75aXIo3JmVL9YnkvanJFzozbDZqGcnRZGzJHr5VI5NakLTJfL5Vo5I6kbSAnaBILG4Dd7P8vvcmNUz8WXyFveQ3LEej/M34LnZIDn5Vu5enx1hylyj7wrd8vT8rr9OcEteU8ekfvkfbkmqq/ELu9x+Ulek9OiemaOh8V5UfkwYUUcMDfQL5YPGpnzRK7wvwniBXMrhe+sILwhD/o2sEk+kguisr5wMZYbLjMXMAIXbgwtedZL+ybZYr2Dxtby0MZPLJn0wtySpg++M7d8Ay35wdxqqwQ3GPOSUUT9hzwRtWmbS3dsmlzQmEi8Km+bG0cgbt/2pv3Zbl6ZC3ol6Ezj0IH1z3p/Zm524KRvl5vdFPojD1LVeJCDyAWN/kjAckH7aS6LwjjT/iFol6OyvrCXbfUGWO/caKd19zMyssp+ts67rYYrOz2rMZGg/fKfg4J2JSrrCSnNXsa/Iwb4/kbeNHfxsJdh0zQetLCfhZsGCM4p+dXcuexf2MsCuaCFCR3KnlaC5qgVNDqyyefgyMHRgwPvqqSuH8e8r2vI2asquaAFGDTntPlR2WH5Ui4y1wc/ytGoDeNjrPG+noWZ4XS/Pa3wcLjlzJaee5qmX9CY6Of+Exgjh1vkezjcslenh9vH1j0tZGnL9+b+Ib+ZS2uc1W3SgYtdTMqaYr+5rOR52djJFn7HGUNgyNo75oJKUvDqR5bF8Mr0VO6QG+QDq3Gw/V8hY8jIlvV+R+YlnYBh7Rf2QqFQKBQKhUJh0vIbt+eIwz7l9R8AAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAbCAYAAACeA7ShAAABL0lEQVR4Xu3SO0sDQRSG4SNe8AaKIqhNjCCojRe0EhsbCxFsIkiwS6OllQg2Nl7BTrASaxsxhSlTCbb+An+K78ec6GSNu40Iwn7wsGRydubM7JjlyfN3KWATw+hxa9hAX1SXmXHsoYQaLty0hQnvMfJZnRF1tIwdVDHmFHX6jHX/nZl+dOMMJ2hzyhReLSzUiwr2/R1pmUE8YCsxro7eLXSuzOEUXa5lfnUyFdUxE41pq8e4s68t7brUqKMXTEZjs3j0p6JO1NU8Ft2RJT5Ou4XD15dUsQ5bbrEQ1ekK3VhYuOgOsRLVNJ2XVh9wjS/ayCqecI4l9y06L21Rz7QcWNiSLvOlG7Xmo7FrvKFsP9903TF1NGFhgiu3bYl3dMtlCB3xH4nEV6HTpdXn+df5ALNaKIss9v7gAAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAeCAYAAAD6t+QOAAAA00lEQVR4Xu3SvwsBYRwG8NePAaXExGIyKCWDQSmTTMqs6AazYreY+A+UxWYyoJTJn+Pf8Dz3Ptf13k1s5KlP3ft+n7vrvc6Y700JFnKEtjt2k4aW3KDujuPh0+gExcgslrfKnmwg5Uwi4ZAl8rTHQw+loD0/fO1ZOsYecAorGYdVO7zKQKrwkH5YfbPM4VPWkNU+zxI77BK2MoM71JyGkoM9jITrHUygLM2gXIGLNigod6EnjY/KvDgY++EpAXNjv68n/NH8JCETLBTekNeM/vmJvAA4NySXvCagTQAAAABJRU5ErkJggg==>