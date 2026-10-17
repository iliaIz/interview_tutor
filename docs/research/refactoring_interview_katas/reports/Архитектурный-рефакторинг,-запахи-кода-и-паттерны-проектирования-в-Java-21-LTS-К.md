# Архитектурный рефакторинг, запахи кода и паттерны проектирования в Java 21 LTS: Канонические задачи технических собеседований (L0–L1)

## Теоретический фундамент и методология оценки на технических скринингах
Современное техническое интервьюирование разработчиков уровней Junior Foundation (L0) и Middle Specialist (L1) в высоконагруженных экосистемах сместилось от тривиальной проверки алгоритмических циклов к оценке способности инженера распознавать деградацию архитектуры и безопасно трансформировать унаследованный код. Как отмечал Роберт Мартин, даже плохо структурированный программный код способен функционировать, однако накопление технического долга и пренебрежение чистотой дизайна неизбежно парализуют скорость доставки функциональности всей инженерной организацией. В рамках секции рефакторинга (Code Review & Live Refactoring) кандидату предоставляется синтаксически корректный, компилирующийся класс объемом от 80 до 180 строк, содержащий концентрированный набор архитектурных и тактических анти-паттернов. Задача инженера — не просто переписать логику «с нуля», а продемонстрировать владение дисциплиной управляемой эволюции кода.
Фундаментальное различие между интуитивным переписыванием и профессиональным рефакторингом опирается на строгий понятийный аппарат, проверяемый интервьюерами на всех этапах скрининга. Запах кода (Code Smell) представляет собой поверхностный структурный симптом — такой как дублирование логики, чрезмерно длинный метод, одержимость примитивами или каскадная условная вложенность, — который сигнализирует о глубинной проблеме дизайна и побуждает к детальному анализу, но сам по себе не является доказательством функционального дефекта. Сам процесс рефакторинга (Refactoring) определяется как реструктуризация внутреннего устройства программного обеспечения серией малых детерминированных шагов, не изменяющих его внешне наблюдаемого поведения и непрерывно защищенных автоматизированными тестами, запускаемыми после каждой итерации. Накопленный технический долг (Technical Debt) выражается в будущей стоимости компромиссов проектирования: это дополнительная когнитивная и временная нагрузка при каждом последующем изменении системы в совокупности с прямыми трудозатратами на само погашение этого долга.
На технических собеседованиях уровня L0–L1 наиболее частой причиной дисквалификации кандидата выступает смешивание рефакторинга с изменением бизнес-поведения в рамках одного коммита или шага. Когда разработчик одновременно меняет структуру классов и корректирует алгоритмические правила, падение модульного теста перестает давать однозначный ответ о природе регрессии. Вторая критическая ошибка связана с нарушением «Дилеммы унаследованного кода» (Legacy Code Dilemma), сформулированной Майклом Фезерсом: унаследованный код — это попросту код без тестов. Чтобы безопасно рефакторить такой код, необходима страховочная сетка автоматизированных тестов; однако для написания изолированных модульных тестов зачастую требуется предварительно изменить сам код, разорвав жестко зашитые внешние зависимости.
Для разрешения этого парадокса на собеседовании от кандидата ожидается строгое следование пятишаговому алгоритму изменения унаследованного кода (Legacy Code Change Algorithm). На первом этапе выполняется идентификация точек изменения (Identify change points), то есть локализация узлов бизнес-логики, нарушающих принципы SOLID и препятствующих расширению системы. На втором этапе осуществляется поиск точек тестирования и швов (Find test points and seams) — обнаружение мест, где можно переключить поведение программы (например, перехватить вызов внешней библиотеки, базы данных или системных часов) без прямого редактирования целевого метода. Третий шаг заключается в консервативном разрыве зависимостей (Break dependencies): инженер вносит минимальные структурные правки, вводя объектный шов через перегрузку конструктора или защищенный метод для переопределения в тестовом подклассе, что переводит класс в тестируемое состояние. На этом этапе допустимо временное ухудшение эстетики кода («шрам», который заживляется позже) ради обретения контроля над зависимостями. Четвертым шагом становится написание характеризующих тестов (Write characterization or pin-down tests), фиксирующих фактическое, в том числе граничное и неочевидного поведение существующей реализации с помощью JUnit 5, AssertJ и Mockito 5. Лишь на пятом этапе выполняются целевые изменения и глубокий рефакторинг (Make changes and refactor) с переходом к идиоматичным конструкциям Java 21 LTS — записям `record`, запечатанным иерархиям `sealed interface`, сопоставлению с образцом в `switch` с охранными условиями `when` и внедрению зависимостей через конструктор — под защитой зеленого тестового контура.
Эволюция платформы Java к релизу Java 21 LTS и фреймворка Spring Boot к ветке 3.4+ фундаментально изменила эталонные решения классических ката рефакторинга. Там, где в эпоху Java 8–11 от кандидата требовалось создание разветвленной иерархии классов с абстрактными методами или реализация громоздкого паттерна «Посетитель» (Visitor), в Java 21 применяется парадигма информационно-ориентированного программирования (Data-Oriented Programming, DOP). Комбинация запечатанных интерфейсов (`sealed interface`), неизменяемых записей (`record`) и сопоставления с образцом для `switch` (Pattern Matching for `switch`) превращает компилятор в активного ассистента рефакторинга. Если доменная область образует закрытое множество состояний или операций, `sealed interface` позволяет отказаться от ветки `default` в `switch`-выражении: при добавлении нового подтипа компилятор гарантированно укажет на все места в кодовой базе, где нарушена исчерпываемость обработки.
Аналогичный сдвиг произошел в инструментарии тестирования Spring Boot 3.4+: классические аннотации `@MockBean` и `@SpyBean` из пакета `org.springframework.boot.test.mock.mockito` объявлены устаревшими (deprecated) с последующим удалением в Spring Boot 4.0, уступив место нативным механизмам Spring Framework — `@MockitoBean` и `@MockitoSpyBean`. Более того, `@MockitoSpyBean` в Spring Boot 3.4 устраняет давнюю архитектурную двусмысленность: для создания шпиона теперь требуется обязательное присутствие реального бина в контексте приложения (например, через явный `@Import` в срезовых тестах `@WebMvcTest`), тогда как прежний `@SpyBean` мог неявно инстанциировать отсутствующий компонент, маскируя ошибки конфигурации зависимостей.

| Параметр оценки | Уровень Junior Foundation (L0) | Уровень Middle Specialist (L1) |
| --- | --- | --- |
| **Диагностика запахов кода** | Выявление локальных синтаксических и структурных проблем: магические числа, дублирование кода (DRY), длинные методы, нарушение именования, отсутствие `try-with-resources`. | Системная диагностика архитектурных патологий: нарушение OCP и SRP, скрытая связность (tight coupling), нарушение контракта иммутабельности (shallow immutability), недетерминированность тестов. |
| **Работа с тестами (Pin-Down Suite)** | Написание базовых позитивных и негативных модульных тестов на JUnit 5 и AssertJ; умение изолировать простой интерфейс через `Mockito.mock()`. | Построение исчерпывающих параметризованных характеризующих тестов (`@ParameterizedTest`), вскрытие объектных швов по Фезерсу, корректное применение `@MockitoBean` / `@MockitoSpyBean` в Spring Boot 3.4. |
| **Идиоматика Java 21 LTS** | Применение `record` для DTO и простых Value Objects, использование компактных конструкторов для валидации, замена каскадов `if-else` на `switch`-выражения. | Проектирование алгебраических типов данных (`sealed interface` + `record`), вложенная деконструкция записей, охранные предикаты `when`, сочетание DOP и полиморфных стратегий Spring DI. |
| **Управление состоянием и ресурсами** | Понимание контрактов `equals()` / `hashCode()`, использование `StringBuilder` или `Collectors.joining()` вместо конкатенации в циклах, закрытие потоков ввода-вывода. | Защитное копирование (`List.copyOf`, `Map.copyOf`), финансовая точность (`BigDecimal` с явным `RoundingMode`), инъекция `java.time.Clock` для детерминированного тестирования времени. |

## Архетип 1.1: Цикломатическая сложность и глубокая вложенность условий — Полиморфизм, Стратегия и Pattern Matching
Глубоко вложенные условные конструкции (`if-else` / `switch` на 5–6 уровней вглубь) являются главным источником высокой когнитивной и цикломатической сложности ($CC > 10$) в коммерческих системах расчета тарифов, скидок, налоговых ставок и игровых правил. Когда один метод одновременно проверяет тип клиента, категорию товара, географическую зону, сезонные флаги и промокоды, любое изменение бизнес-правил приводит к «хирургии дробью» (Shotgun Surgery) и прямому нарушению принципа открытости/закрытости (Open-Closed Principle, OCP).
В рамках данного архетипа интервьюер проверяет, способен ли кандидат уровня L0 устранить стреловидный анти-паттерн (Arrow Anti-Pattern) с помощью сторожевых условий (Guard Clauses), строгой типизации `enum` и исчерпывающих `switch`-выражений, и понимает ли специалист уровня L1, как сочетать запечатанные иерархии (`sealed interface`) с паттерном «Стратегия» (Strategy) под управлением контейнера инверсии управления Spring.

### [L0-REF-01] Multi-Tier Shipping Rate & Surcharge Calculator (Guard Clauses & Java 21 Exhaustive Switch)

#### 1. Title & Grade
Задача **[L0-REF-01] Multi-Tier Shipping Rate & Surcharge Calculator (Guard Clauses & Java 21 Exhaustive Switch)** калибрована для уровня **Junior Foundation (L0)**.

#### 2. Company Context
Данное испытание представляет собой каноническую задачу первичного технического скрининга в логистических и e-commerce подразделениях крупных технологических компаний, таких как Ozon Express, Яндекс Доставка и Amazon Logistics. Собеседующий проверяет способность младшего разработчика читать запутанную процедурную логику тарификации, выявлять ошибки работы с числами с плавающей точкой (`double`), устранять глубокую вложенность `if-else` и применять современные `switch`-выражения Java 21 с проверкой исчерпываемости.

#### 3. The "Dirty" Code (80–180 lines)
Ниже представлен исходный класс `ShippingRateService`, который передается кандидату на ревью.

```java
package com.interview.refactoring.l0.shipping;

public class ShippingRateService {

    /**
     * Calculates total shipping cost based on zone, weight, dimensions,
     * delivery speed, fragile flag, and customer membership tier.
     */
    public double calc(String z, double w, double l, double width, double h,
                       int spd, boolean frg, String mem) {
        double cost = 0.0;

        if (z != null && !z.trim().isEmpty()) {
            if (w > 0 && l > 0 && width > 0 && h > 0) {
                double volWeight = (l * width * h) / 5000.0;
                double billableWeight = w;
                if (volWeight > w) {
                    billableWeight = volWeight;
                }

                if (z.equalsIgnoreCase("LOCAL")) {
                    if (billableWeight <= 2.0) {
                        cost = 5.0;
                    } else if (billableWeight <= 10.0) {
                        cost = 5.0 + (billableWeight - 2.0) * 1.25;
                    } else {
                        cost = 15.0 + (billableWeight - 10.0) * 0.95;
                    }
                } else if (z.equalsIgnoreCase("REGIONAL")) {
                    if (billableWeight <= 2.0) {
                        cost = 9.5;
                    } else if (billableWeight <= 10.0) {
                        cost = 9.5 + (billableWeight - 2.0) * 2.10;
                    } else {
                        cost = 26.3 + (billableWeight - 10.0) * 1.65;
                    }
                } else if (z.equalsIgnoreCase("INTERNATIONAL")) {
                    if (billableWeight <= 2.0) {
                        cost = 25.0;
                    } else if (billableWeight <= 10.0) {
                        cost = 25.0 + (billableWeight - 2.0) * 6.50;
                    } else {
                        cost = 77.0 + (billableWeight - 10.0) * 5.20;
                    }
                } else {
                    throw new IllegalArgumentException("Unknown zone: " + z);
                }

                // Delivery speed: 1 = STANDARD, 2 = EXPRESS, 3 = SAME_DAY
                if (spd == 1) {
                    cost = cost * 1.0;
                } else if (spd == 2) {
                    if (z.equalsIgnoreCase("INTERNATIONAL")) {
                        cost = cost * 1.75 + 12.0;
                    } else {
                        cost = cost * 1.50;
                    }
                } else if (spd == 3) {
                    if (z.equalsIgnoreCase("INTERNATIONAL")) {
                        throw new IllegalStateException("Same-day not available for INTERNATIONAL");
                    } else if (z.equalsIgnoreCase("REGIONAL")) {
                        if (billableWeight > 15.0) {
                            throw new IllegalStateException("Regional same-day max weight is 15kg");
                        } else {
                            cost = cost * 2.20 + 15.0;
                        }
                    } else {
                        cost = cost * 1.90 + 8.0;
                    }
                } else {
                    throw new IllegalArgumentException("Invalid speed code: " + spd);
                }

                if (frg == true) {
                    if (billableWeight > 20.0) {
                        cost = cost + 18.50;
                    } else {
                        cost = cost + 7.50;
                    }
                }

                if (mem != null) {
                    if (mem.equals("SILVER")) {
                        cost = cost * 0.95;
                    } else if (mem.equals("GOLD")) {
                        cost = cost * 0.85;
                    } else if (mem.equals("PLATINUM")) {
                        if (spd == 1 || spd == 2) {
                            cost = cost * 0.70;
                        } else {
                            cost = cost * 0.80;
                        }
                    }
                }

                return Math.round(cost * 100.0) / 100.0;
            } else {
                throw new IllegalArgumentException("Weight and dimensions must be positive");
            }
        } else {
            throw new IllegalArgumentException("Zone cannot be null or empty");
        }
    }
}

```

#### 4. Code Smells Checklist
На этапе устного архитектурного ревью от кандидата ожидается системная диагностика пяти взаимосвязанных дефектов проектирования. Прежде всего в глаза бросается стреловидный код и запредельная цикломатическая сложность (Arrow Anti-Pattern & High Cyclomatic Complexity): метод `calc` имеет пять уровней вложенности условий, а базовая валидация входных аргументов обернута вокруг всего тела метода вместо использования сторожевых условий (Guard Clauses) с ранним выходом, что заставляет читателя удерживать контекст условий до последних строк файла. Вторая проблема заключается в криптографическом именовании и длинном списке параметров (Cryptic Naming & Long Parameter List): однобуквенные и сокращенные идентификаторы `calc`, `z`, `w`, `l`, `h`, `spd`, `frg`, `mem` нарушают базовые конвенции читаемости и провоцируют перепутывание аргументов типа `double` при вызове.
Третий структурный запах — использование магических чисел и нетипобезопасных кодов состояний (Magic Numbers & Type-Unsafe Codes), где скорость доставки передается через `int spd` (`1`, `2`, `3`), тарифные зоны — через `String z`, а уровни лояльности — через `String mem`, что полностью лишает систему проверки типов на этапе компиляции. Четвертая патология выражена в прямом нарушении принципа DRY (Don't Repeat Yourself): трехступенчатая прогрессивная шкала расчета стоимости по весовым порогам (`<= 2.0`, `<= 10.0`, `> 10.0`) скопирована трижды с разными числовыми литералами для каждой зоны. Наконец, пятый дефект связан с применением бинарного типа `double` и конструкции `Math.round(cost * 100.0) / 100.0` для финансовых расчетов: арифметика IEEE 754 порождает ошибки представления дробных чисел, поэтому внутри доменного ядра округление должно выполняться через `BigDecimal` с явным режимом `RoundingMode.HALF_UP`.

#### 5. Pin-Down Test Suite
Перед внесением любых изменений в `ShippingRateService` создается набор характеризующих тестов на JUnit 5 и AssertJ, фиксирующий все ветви выполнения, включая расчет объемного веса, надбавки за хрупкость, скидки лояльности и выбрасываемые исключения.

```java
package com.interview.refactoring.l0.shipping;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ShippingRateServiceTest {

    private ShippingRateService service;

    @BeforeEach
    void setUp() {
        service = new ShippingRateService();
    }

    @ParameterizedTest(name = "Zone={0}, Weight={1}kg, Speed={5}, Fragile={6}, Tier={7} -> Expected={8}")
    @CsvSource({
        // Base tiers across zones (actual weight > volumetric weight)
        "LOCAL,         1.5, 10, 10, 10, 1, false, NONE,      5.00",
        "LOCAL,         6.0, 10, 10, 10, 1, false, NONE,     10.00",
        "LOCAL,        12.0, 10, 10, 10, 1, false, NONE,     16.90",
        "REGIONAL,      1.5, 10, 10, 10, 1, false, NONE,      9.50",
        "REGIONAL,      5.0, 10, 10, 10, 1, false, NONE,     15.80",
        "REGIONAL,     14.0, 10, 10, 10, 1, false, NONE,     32.90",
        "INTERNATIONAL, 2.0, 10, 10, 10, 1, false, NONE,     25.00",
        "INTERNATIONAL, 4.0, 10, 10, 10, 1, false, NONE,     38.00",
        "INTERNATIONAL,15.0, 10, 10, 10, 1, false, NONE,    103.00",
        // Volumetric weight override: (50 * 40 * 30) / 5000 = 12.0 kg > 3.0 kg actual
        "LOCAL,         3.0, 50, 40, 30, 1, false, NONE,     16.90",
        // Express & Same-Day multipliers + fragile + membership discounts
        "LOCAL,         2.0, 10, 10, 10, 2, true,  SILVER,   14.25",
        "INTERNATIONAL, 2.0, 10, 10, 10, 2, false, GOLD,     47.39",
        "LOCAL,         2.0, 10, 10, 10, 3, false, PLATINUM, 14.00",
        "REGIONAL,     12.0, 10, 10, 10, 3, true,  PLATINUM, 65.58",
        "LOCAL,        25.0, 10, 10, 10, 2, true,  PLATINUM, 44.01"
    })
    void shouldCalculateExactShippingRatesAcrossAllBranches(
            String zone, double weight, double length, double width, double height,
            int speed, boolean fragile, String membership, double expectedCost) {

        double actual = service.calc(zone, weight, length, width, height, speed, fragile, membership);
        assertThat(actual).isEqualTo(expectedCost);
    }

    @Test
    @DisplayName("Should handle null membership without discount")
    void shouldHandleNullMembership() {
        double actual = service.calc("local", 2.0, 10, 10, 10, 1, false, null);
        assertThat(actual).isEqualTo(5.00);
    }

    @Test
    @DisplayName("Should reject invalid zones, dimensions, speeds, and restricted same-day routes")
    void shouldEnforceAllValidationAndBusinessConstraints() {
        assertThatThrownBy(() -> service.calc(null, 1, 1, 1, 1, 1, false, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Zone cannot be null or empty");

        assertThatThrownBy(() -> service.calc("   ", 1, 1, 1, 1, 1, false, null))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> service.calc("LOCAL", 0, 10, 10, 10, 1, false, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Weight and dimensions must be positive");

        assertThatThrownBy(() -> service.calc("MARS", 1, 10, 10, 10, 1, false, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown zone: MARS");

        assertThatThrownBy(() -> service.calc("LOCAL", 1, 10, 10, 10, 99, false, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid speed code: 99");

        assertThatThrownBy(() -> service.calc("INTERNATIONAL", 1, 10, 10, 10, 3, false, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Same-day not available for INTERNATIONAL");

        assertThatThrownBy(() -> service.calc("REGIONAL", 16.0, 10, 10, 10, 3, false, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Regional same-day max weight is 15kg");
    }
}

```

#### 6. Refactored Clean Code
В эталонном решении на Java 21 LTS параметры инкапсулированы в иммутабельные `enum` и `record`, тарифная сетка зон вынесена в параметры перечисления `ShippingZone`, а комбинаторная логика скорости доставки реализована через сопоставление с образцом в `switch` с охранными условиями `when`. Публичный метод `calc` сохранен как адаптер обратной совместимости, делегирующий работу чистому доменному методу `calculateRate(ShippingRequest)`.

```java
package com.interview.refactoring.l0.shipping;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

public class ShippingRateService {

    private static final double VOLUMETRIC_DIVISOR = 5000.0;
    private static final double TIER_1_MAX_WEIGHT = 2.0;
    private static final double TIER_2_MAX_WEIGHT = 10.0;
    private static final double REGIONAL_SAME_DAY_MAX_WEIGHT = 15.0;
    private static final double HEAVY_FRAGILE_THRESHOLD = 20.0;
    private static final double HEAVY_FRAGILE_FEE = 18.50;
    private static final double STANDARD_FRAGILE_FEE = 7.50;

    public enum ShippingZone {
        LOCAL(5.0, 1.25, 15.0, 0.95),
        REGIONAL(9.5, 2.10, 26.3, 1.65),
        INTERNATIONAL(25.0, 6.50, 77.0, 5.20);

        private final double baseUpTo2Kg;
        private final double rateUpTo10Kg;
        private final double baseAbove10Kg;
        private final double rateAbove10Kg;

        ShippingZone(double baseUpTo2Kg, double rateUpTo10Kg, double baseAbove10Kg, double rateAbove10Kg) {
            this.baseUpTo2Kg = baseUpTo2Kg;
            this.rateUpTo10Kg = rateUpTo10Kg;
            this.baseAbove10Kg = baseAbove10Kg;
            this.rateAbove10Kg = rateAbove10Kg;
        }

        public double baseCostForWeight(double billableWeight) {
            if (billableWeight <= TIER_1_MAX_WEIGHT) {
                return baseUpTo2Kg;
            }
            if (billableWeight <= TIER_2_MAX_WEIGHT) {
                return baseUpTo2Kg + (billableWeight - TIER_1_MAX_WEIGHT) * rateUpTo10Kg;
            }
            return baseAbove10Kg + (billableWeight - TIER_2_MAX_WEIGHT) * rateAbove10Kg;
        }

        public static ShippingZone fromString(String rawZone) {
            if (rawZone == null || rawZone.isBlank()) {
                throw new IllegalArgumentException("Zone cannot be null or empty");
            }
            try {
                return ShippingZone.valueOf(rawZone.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Unknown zone: " + rawZone, ex);
            }
        }
    }

    public enum DeliverySpeed {
        STANDARD, EXPRESS, SAME_DAY;

        public static DeliverySpeed fromCode(int code) {
            return switch (code) {
                case 1 -> STANDARD;
                case 2 -> EXPRESS;
                case 3 -> SAME_DAY;
                default -> throw new IllegalArgumentException("Invalid speed code: " + code);
            };
        }
    }

    public enum MembershipTier {
        NONE, SILVER, GOLD, PLATINUM;

        public static MembershipTier fromNullableString(String rawTier) {
            if (rawTier == null) {
                return NONE;
            }
            return switch (rawTier) {
                case "SILVER" -> SILVER;
                case "GOLD" -> GOLD;
                case "PLATINUM" -> PLATINUM;
                default -> NONE;
            };
        }

        public double discountMultiplier(DeliverySpeed speed) {
            return switch (this) {
                case NONE -> 1.00;
                case SILVER -> 0.95;
                case GOLD -> 0.85;
                case PLATINUM -> (speed == DeliverySpeed.SAME_DAY) ? 0.80 : 0.70;
            };
        }
    }

    public record Dimensions(double weightKg, double lengthCm, double widthCm, double heightCm) {
        public Dimensions {
            if (weightKg <= 0 || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
                throw new IllegalArgumentException("Weight and dimensions must be positive");
            }
        }

        public double billableWeightKg() {
            double volumetricWeight = (lengthCm * widthCm * heightCm) / VOLUMETRIC_DIVISOR;
            return Math.max(weightKg, volumetricWeight);
        }
    }

    public record ShippingRequest(
            ShippingZone zone,
            Dimensions dimensions,
            DeliverySpeed speed,
            boolean fragile,
            MembershipTier membershipTier
    ) {}

    public double calc(String zone, double weight, double length, double width, double height,
                       int speedCode, boolean fragile, String membership) {
        ShippingZone parsedZone = ShippingZone.fromString(zone);
        Dimensions dimensions = new Dimensions(weight, length, width, height);
        DeliverySpeed speed = DeliverySpeed.fromCode(speedCode);
        MembershipTier tier = MembershipTier.fromNullableString(membership);

        return calculateRate(new ShippingRequest(parsedZone, dimensions, speed, fragile, tier));
    }

    public double calculateRate(ShippingRequest request) {
        double billableWeight = request.dimensions().billableWeightKg();
        double baseCost = request.zone().baseCostForWeight(billableWeight);
        double speedAdjustedCost = applySpeedMultiplier(baseCost, request, billableWeight);
        double withFragileFee = speedAdjustedCost + calculateFragileFee(request.fragile(), billableWeight);
        double discountedCost = withFragileFee * request.membershipTier().discountMultiplier(request.speed());

        return BigDecimal.valueOf(discountedCost)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private double applySpeedMultiplier(double baseCost, ShippingRequest request, double billableWeight) {
        return switch (request) {
            case ShippingRequest r when r.speed() == DeliverySpeed.STANDARD -> baseCost;
            case ShippingRequest r when r.speed() == DeliverySpeed.EXPRESS
                    && r.zone() == ShippingZone.INTERNATIONAL -> baseCost * 1.75 + 12.0;
            case ShippingRequest r when r.speed() == DeliverySpeed.EXPRESS -> baseCost * 1.50;
            case ShippingRequest r when r.speed() == DeliverySpeed.SAME_DAY
                    && r.zone() == ShippingZone.INTERNATIONAL ->
                    throw new IllegalStateException("Same-day not available for INTERNATIONAL");
            case ShippingRequest r when r.speed() == DeliverySpeed.SAME_DAY
                    && r.zone() == ShippingZone.REGIONAL
                    && billableWeight > REGIONAL_SAME_DAY_MAX_WEIGHT ->
                    throw new IllegalStateException("Regional same-day max weight is 15kg");
            case ShippingRequest r when r.speed() == DeliverySpeed.SAME_DAY
                    && r.zone() == ShippingZone.REGIONAL -> baseCost * 2.20 + 15.0;
            case ShippingRequest _ -> baseCost * 1.90 + 8.0;
        };
    }

    private double calculateFragileFee(boolean fragile, double billableWeight) {
        if (!fragile) {
            return 0.0;
        }
        return billableWeight > HEAVY_FRAGILE_THRESHOLD ? HEAVY_FRAGILE_FEE : STANDARD_FRAGILE_FEE;
    }
}

```

#### 7. Interview Follow-Up Questions
Первый углубляющий вопрос интервьюера касается порядка вычисления сторожевых условий (Guard Clauses & Validation Order): что произошло бы с существующими тестами, если бы при рефакторинге объект `Dimensions` инстанциировался до вызова `ShippingZone.fromString(zone)`? Сильный кандидат должен указать, что в оригинальном коде проверка `z != null` предшествовала проверке `w > 0`, но проверка неизвестного названия зоны (`Unknown zone: MARS`) выполнялась только внутри блока положительных габаритов. Если поменять порядок парсинга, то при одновременной передаче некорректной зоны и нулевого веса изменится сообщение выбрасываемого исключения, что нарушит наблюдаемый контракт для внешних клиентов.
Второй вопрос проверяет понимание исчерпываемости `switch` в Java 21: почему в методе `MembershipTier.discountMultiplier` не требуется ветка `default`, и какую гарантию это дает при добавлении нового уровня `DIAMOND`? Поскольку `switch` используется как выражение над перечислением `enum`, компилятор верифицирует покрытие всех констант на этапе компиляции; отсутствие `default` гарантирует, что при добавлении `DIAMOND` сборка завершится ошибкой компиляции во всех местах, где новый уровень не обработан явно.
Третий вопрос исследует нюансы IEEE 754 и `BigDecimal`: в чем разница между `new BigDecimal(0.1)` и `BigDecimal.valueOf(0.1)`, и почему `Math.round(cost * 100.0) / 100.0` опасен в финансовых сервисах? Конструктор `new BigDecimal(double)` фиксирует неточное двоичное представление числа с плавающей точкой (`0.10000000000000000555...`), тогда как `BigDecimal.valueOf(double)` опирается на каноническое строковое представление `Double.toString(double)`. В свою очередь, умножение на `100.0` в `double` может породить артефакт вида `4738.499999999999`, который `Math.round` округлит вниз вместо корректного арифметического округления `RoundingMode.HALF_UP`.

### [L1-REF-02] E-Commerce Dynamic Discount & Promo Engine (Strategy Pattern, Sealed Hierarchies & OCP)

#### 1. Title & Grade
Задача **[L1-REF-02] E-Commerce Dynamic Discount & Promo Engine (Strategy Pattern, Sealed Hierarchies & OCP)** ориентирована на грейд **Middle Specialist (L1)**.

#### 2. Company Context
Эта задача архитектурного рефакторинга регулярно используется на собеседованиях разработчиков уровня Middle в крупных маркетплейсах, включая Яндекс Маркет, Amazon Retail, Авито и Lamoda. Она оценивает способность инженера декомпозировать монолитный калькулятор промо-акций и правил корзины в расширяемую конвейерную систему правил, сочетающую алгебраические типы данных Java 21 (`sealed interface` и деконструкцию `record`) с компонуемыми стратегиями (Composable Strategy) при строгом соблюдении принципа Open-Closed (OCP).

#### 3. The "Dirty" Code (80–180 lines)
Исходный класс `PricingDiscountCalculator` содержит жестко зашитую последовательность расчета базовых категориальных скидок, клиентских уровней, купонов и сезонных кэпов.

```java
package com.interview.refactoring.l1.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public class PricingDiscountCalculator {

    public static class CartItem {
        public String sku;
        public String category; // ELECTRONICS, APPAREL, GROCERY, BOOKS
        public BigDecimal unitPrice;
        public int quantity;
        public boolean clearance;

        public CartItem(String sku, String category, BigDecimal unitPrice, int quantity, boolean clearance) {
            this.sku = sku;
            this.category = category;
            this.unitPrice = unitPrice;
            this.quantity = quantity;
            this.clearance = clearance;
        }
    }

    public BigDecimal calculateFinalTotal(
            List<CartItem> items,
            String customerType,      // REGULAR, VIP, EMPLOYEE
            int loyaltyYears,
            String promoType,         // NONE, PERCENT, FIXED, BOGO_BOOKS
            BigDecimal promoValue,
            boolean blackFriday) {

        if (items == null || items.isEmpty()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal categoryDiscount = BigDecimal.ZERO;

        for (CartItem item : items) {
            if (item.unitPrice.compareTo(BigDecimal.ZERO) < 0 || item.quantity <= 0) {
                throw new IllegalArgumentException("Invalid item price or quantity for SKU: " + item.sku);
            }
            BigDecimal lineTotal = item.unitPrice.multiply(BigDecimal.valueOf(item.quantity));
            subtotal = subtotal.add(lineTotal);

            // Clearance items never get category discounts
            if (!item.clearance) {
                if ("ELECTRONICS".equals(item.category)) {
                    if (blackFriday && item.quantity >= 2) {
                        categoryDiscount = categoryDiscount.add(lineTotal.multiply(new BigDecimal("0.15")));
                    } else if (lineTotal.compareTo(new BigDecimal("1000.00")) > 0) {
                        categoryDiscount = categoryDiscount.add(lineTotal.multiply(new BigDecimal("0.07")));
                    }
                } else if ("APPAREL".equals(item.category)) {
                    if (blackFriday) {
                        categoryDiscount = categoryDiscount.add(lineTotal.multiply(new BigDecimal("0.25")));
                    } else if (item.quantity >= 3) {
                        categoryDiscount = categoryDiscount.add(lineTotal.multiply(new BigDecimal("0.10")));
                    }
                } else if ("BOOKS".equals(item.category)) {
                    if ("BOGO_BOOKS".equals(promoType) && item.quantity >= 2) {
                        int freeBooks = item.quantity / 2;
                        categoryDiscount = categoryDiscount.add(item.unitPrice.multiply(BigDecimal.valueOf(freeBooks)));
                    }
                }
            }
        }

        BigDecimal runningTotal = subtotal.subtract(categoryDiscount);

        // Customer tier discount
        BigDecimal customerDiscount = BigDecimal.ZERO;
        if ("EMPLOYEE".equals(customerType)) {
            customerDiscount = runningTotal.multiply(new BigDecimal("0.20"));
        } else if ("VIP".equals(customerType)) {
            if (loyaltyYears >= 5) {
                customerDiscount = runningTotal.multiply(new BigDecimal("0.12"));
            } else {
                customerDiscount = runningTotal.multiply(new BigDecimal("0.08"));
            }
        } else if ("REGULAR".equals(customerType)) {
            if (loyaltyYears >= 3) {
                customerDiscount = runningTotal.multiply(new BigDecimal("0.03"));
            }
        } else {
            throw new IllegalArgumentException("Unknown customer type: " + customerType);
        }

        runningTotal = runningTotal.subtract(customerDiscount);

        // Promo code discount (cannot combine PERCENT/FIXED with EMPLOYEE tier)
        BigDecimal promoDiscount = BigDecimal.ZERO;
        if (!"EMPLOYEE".equals(customerType)) {
            if ("PERCENT".equals(promoType)) {
                if (promoValue == null || promoValue.compareTo(BigDecimal.ZERO) <= 0
                        || promoValue.compareTo(new BigDecimal("50")) > 0) {
                    throw new IllegalArgumentException("Invalid percent promo value");
                }
                promoDiscount = runningTotal.multiply(promoValue).divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            } else if ("FIXED".equals(promoType)) {
                if (promoValue == null || promoValue.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Invalid fixed promo value");
                }
                if (subtotal.compareTo(new BigDecimal("100.00")) >= 0) {
                    promoDiscount = promoValue;
                }
            }
        }

        runningTotal = runningTotal.subtract(promoDiscount);

        // Global cap: total discount cannot exceed 45% of original subtotal (unless EMPLOYEE)
        BigDecimal maxDiscountAllowed = "EMPLOYEE".equals(customerType)
                ? subtotal.multiply(new BigDecimal("0.60"))
                : subtotal.multiply(new BigDecimal("0.45"));
        BigDecimal minPayable = subtotal.subtract(maxDiscountAllowed);

        if (runningTotal.compareTo(minPayable) < 0) {
            runningTotal = minPayable;
        }

        return runningTotal.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}

```

#### 4. Code Smells Checklist
На ревью этого класса кандидат уровня L1 должен выделить четыре фундаментальных архитектурных анти-паттерна. Главная проблема заключается в жестком нарушении принципа открытости/закрытости (Open-Closed Principle, OCP) и смешении уровней абстракции: добавление любой новой механики промокодов или новой товарной категории требует модификации единого цикла и разветвленных каскадов `if-else` внутри `calculateFinalTotal`. Вторая проблема связана с публичными мутабельными полями в классе `CartItem` (Anemic & Mutable Data Structure): поля `sku`, `category`, `unitPrice`, `quantity` объявлены как `public` без модификатора `final` и не защищены инвариантами в конструкторе, что позволяет внешнему коду мутировать элементы корзины прямо во время вычислений.
Третий запах представляет собой неявную связность параметров промо-акции и ग्राहकского профиля (Data Clump & Unmodeled Algebraic Sum Type): параметры `String promoType` и `BigDecimal promoValue` образуют неформализованное размеченное объединение (discriminated union), где для `NONE` и `BOGO_BOOKS` параметр `promoValue` бессмысленен и передается как `null`, а для `PERCENT` и `FIXED` он строго обязателен; аналогично `loyaltyYears` не используется для `EMPLOYEE`. Четвертая проблема кроется в перекрестной связности этапов конвейера (Temporal & Stage Coupling): правило акции `BOGO_BOOKS` зашито внутрь цикла категориальных скидок отдельных товарных позиций, в то время как купоны `PERCENT` и `FIXED` вычисляются в нижней части метода после применения скидки лояльности.

#### 5. Pin-Down Test Suite
Комплексный набор тестов JUnit 5 фиксирует все комбинации категорий, флага распродажи `clearance`, уровней лояльности, ограничений `EMPLOYEE` и глобального потолка максимальной скидки (45% и 60%).

```java
package com.interview.refactoring.l1.pricing;

import com.interview.refactoring.l1.pricing.PricingDiscountCalculator.CartItem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PricingDiscountCalculatorTest {

    private PricingDiscountCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new PricingDiscountCalculator();
    }

    @Test
    @DisplayName("Should return 0.00 for null or empty cart")
    void shouldHandleEmptyOrNullCart() {
        assertThat(calculator.calculateFinalTotal(null, "REGULAR", 0, "NONE", null, false))
                .isEqualByComparingTo("0.00");
        assertThat(calculator.calculateFinalTotal(List.of(), "REGULAR", 0, "NONE", null, false))
                .isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Should apply Electronics Black Friday 15% and VIP 5+ years 12% plus 10% Promo")
    void shouldCalculateElectronicsBlackFridayVipWithPercentPromo() {
        List<CartItem> items = List.of(
                new CartItem("LAPTOP-1", "ELECTRONICS", new BigDecimal("600.00"), 2, false)
        );
        // Subtotal = 1200.00; Cat discount (15%) = 180.00 -> running = 1020.00
        // VIP (5 yrs = 12%) = 122.40 -> running = 897.60
        // Promo 10% = 89.76 -> running = 807.84 (Above 55% minPayable of 660.00)
        BigDecimal total = calculator.calculateFinalTotal(
                items, "VIP", 5, "PERCENT", new BigDecimal("10"), true);
        assertThat(total).isEqualByComparingTo("807.84");
    }

    @Test
    @DisplayName("Should ignore category discount on clearance items and apply BOGO on non-clearance books")
    void shouldRespectClearanceFlagAndBogoBooks() {
        List<CartItem> items = List.of(
                new CartItem("TV-CLR", "ELECTRONICS", new BigDecimal("1500.00"), 1, true),
                new CartItem("BOOK-JAVA", "BOOKS", new BigDecimal("40.00"), 3, false)
        );
        // Subtotal = 1500 + 120 = 1620.00
        // TV is clearance -> 0 discount. Books BOGO (3 books -> 1 free) = 40.00 -> running = 1580.00
        // REGULAR with 4 loyalty years -> 3% of 1580.00 = 47.40 -> running = 1532.60
        BigDecimal total = calculator.calculateFinalTotal(
                items, "REGULAR", 4, "BOGO_BOOKS", null, false);
        assertThat(total).isEqualByComparingTo("1532.60");
    }

    @Test
    @DisplayName("Should enforce 45% global discount cap for non-employee customers")
    void shouldEnforceGlobalDiscountCapForRegularAndVipCustomers() {
        List<CartItem> items = List.of(
                new CartItem("SHIRT", "APPAREL", new BigDecimal("100.00"), 3, false)
        );
        // Subtotal = 300.00. Black Friday Apparel = 25% (-75.00) -> 225.00
        // VIP 6 yrs = 12% (-27.00) -> 198.00
        // Promo FIXED 80.00 -> 118.00.
        // Min payable (55% of 300.00) = 165.00 -> capped at 165.00!
        BigDecimal total = calculator.calculateFinalTotal(
                items, "VIP", 6, "FIXED", new BigDecimal("80.00"), true);
        assertThat(total).isEqualByComparingTo("165.00");
    }

    @Test
    @DisplayName("Should apply 20% employee discount and block external promo codes")
    void shouldHandleEmployeeRulesAndIgnorePromoCodes() {
        List<CartItem> items = List.of(
                new CartItem("DESK", "ELECTRONICS", new BigDecimal("1200.00"), 1, false)
        );
        // Subtotal = 1200.00. Electronics > 1000 (-7% = 84.00) -> 1116.00
        // Employee (-20% = 223.20) -> 892.80. Promo FIXED 200 is ignored for EMPLOYEE.
        BigDecimal total = calculator.calculateFinalTotal(
                items, "EMPLOYEE", 1, "FIXED", new BigDecimal("200.00"), false);
        assertThat(total).isEqualByComparingTo("892.80");
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException on invalid inputs")
    void shouldValidateInputs() {
        List<CartItem> validItems = List.of(
                new CartItem("ITEM-1", "GROCERY", new BigDecimal("50.00"), 1, false)
        );
        assertThatThrownBy(() -> calculator.calculateFinalTotal(
                validItems, "ALIEN", 1, "NONE", null, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown customer type");

        assertThatThrownBy(() -> calculator.calculateFinalTotal(
                validItems, "REGULAR", 1, "PERCENT", new BigDecimal("75"), false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid percent promo value");
    }
}

```

#### 6. Refactored Clean Code
В рефакторинге на Java 21 LTS профили клиентов (`CustomerProfile`) и промо-офферы (`PromoOffer`) смоделированы как запечатанные алгебраические типы данных (`sealed interface` + `record` с валидацией в компактных конструкторах), а конвейер ценообразования разделен на независимые полиморфные стратегии (`PricingStepStrategy`).

```java
package com.interview.refactoring.l1.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public class PricingDiscountCalculator {

    public enum ProductCategory {
        ELECTRONICS, APPAREL, GROCERY, BOOKS;

        public static ProductCategory fromString(String raw) {
            return raw == null ? GROCERY : ProductCategory.valueOf(raw);
        }
    }

    public static class CartItem {
        public final String sku;
        public final String category;
        public final BigDecimal unitPrice;
        public final int quantity;
        public final boolean clearance;

        public CartItem(String sku, String category, BigDecimal unitPrice, int quantity, boolean clearance) {
            if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) < 0 || quantity <= 0) {
                throw new IllegalArgumentException("Invalid item price or quantity for SKU: " + sku);
            }
            this.sku = sku;
            this.category = category;
            this.unitPrice = unitPrice;
            this.quantity = quantity;
            this.clearance = clearance;
        }

        public BigDecimal lineTotal() {
            return unitPrice.multiply(BigDecimal.valueOf(quantity));
        }

        public ProductCategory parsedCategory() {
            return ProductCategory.fromString(category);
        }
    }

    public sealed interface CustomerProfile permits CustomerProfile.Regular, CustomerProfile.Vip, CustomerProfile.Employee {
        record Regular(int loyaltyYears) implements CustomerProfile {}
        record Vip(int loyaltyYears) implements CustomerProfile {}
        record Employee() implements CustomerProfile {}

        static CustomerProfile of(String type, int loyaltyYears) {
            return switch (type) {
                case "REGULAR" -> new Regular(loyaltyYears);
                case "VIP" -> new Vip(loyaltyYears);
                case "EMPLOYEE" -> new Employee();
                case null, default -> throw new IllegalArgumentException("Unknown customer type: " + type);
            };
        }

        default BigDecimal maxDiscountRatio() {
            return switch (this) {
                case Employee _ -> new BigDecimal("0.60");
                case Regular _, Vip _ -> new BigDecimal("0.45");
            };
        }
    }

    public sealed interface PromoOffer permits PromoOffer.None, PromoOffer.PercentOff, PromoOffer.FixedAmountOff, PromoOffer.BogoBooks {
        record None() implements PromoOffer {}

        record PercentOff(BigDecimal percent) implements PromoOffer {
            public PercentOff {
                if (percent == null || percent.compareTo(BigDecimal.ZERO) <= 0
                        || percent.compareTo(new BigDecimal("50")) > 0) {
                    throw new IllegalArgumentException("Invalid percent promo value");
                }
            }
        }

        record FixedAmountOff(BigDecimal amount) implements PromoOffer {
            public FixedAmountOff {
                if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Invalid fixed promo value");
                }
            }
        }

        record BogoBooks() implements PromoOffer {}

        static PromoOffer of(String promoType, BigDecimal promoValue, CustomerProfile customer) {
            if (customer instanceof CustomerProfile.Employee && ("PERCENT".equals(promoType) || "FIXED".equals(promoType))) {
                return new None();
            }
            return switch (promoType) {
                case "PERCENT" -> new PercentOff(promoValue);
                case "FIXED" -> new FixedAmountOff(promoValue);
                case "BOGO_BOOKS" -> new BogoBooks();
                case null, default -> new None();
            };
        }
    }

    public record PricingContext(
            List<CartItem> items,
            BigDecimal subtotal,
            CustomerProfile customer,
            PromoOffer promo,
            boolean blackFriday
    ) {}

    @FunctionalInterface
    public interface PricingStepStrategy {
        BigDecimal apply(BigDecimal currentTotal, PricingContext context);
    }

    private final List<PricingStepStrategy> pipeline = List.of(
            this::applyCategoryAndLineDiscounts,
            this::applyCustomerTierDiscount,
            this::applyCartLevelPromo,
            this::applyGlobalDiscountCap
    );

    public BigDecimal calculateFinalTotal(
            List<CartItem> items,
            String customerType,
            int loyaltyYears,
            String promoType,
            BigDecimal promoValue,
            boolean blackFriday) {

        if (items == null || items.isEmpty()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal subtotal = items.stream()
                .map(CartItem::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        CustomerProfile customer = CustomerProfile.of(customerType, loyaltyYears);
        PromoOffer promo = PromoOffer.of(promoType, promoValue, customer);
        PricingContext context = new PricingContext(List.copyOf(items), subtotal, customer, promo, blackFriday);

        BigDecimal runningTotal = subtotal;
        for (PricingStepStrategy step : pipeline) {
            runningTotal = step.apply(runningTotal, context);
        }

        return runningTotal.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal applyCategoryAndLineDiscounts(BigDecimal currentTotal, PricingContext ctx) {
        BigDecimal discount = ctx.items().stream()
                .filter(item -> !item.clearance)
                .map(item -> calculateItemCategoryDiscount(item, ctx))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return currentTotal.subtract(discount);
    }

    private BigDecimal calculateItemCategoryDiscount(CartItem item, PricingContext ctx) {
        BigDecimal lineTotal = item.lineTotal();
        return switch (item.parsedCategory()) {
            case ELECTRONICS when ctx.blackFriday() && item.quantity >= 2 ->
                    lineTotal.multiply(new BigDecimal("0.15"));
            case ELECTRONICS when lineTotal.compareTo(new BigDecimal("1000.00")) > 0 ->
                    lineTotal.multiply(new BigDecimal("0.07"));
            case APPAREL when ctx.blackFriday() ->
                    lineTotal.multiply(new BigDecimal("0.25"));
            case APPAREL when item.quantity >= 3 ->
                    lineTotal.multiply(new BigDecimal("0.10"));
            case BOOKS when ctx.promo() instanceof PromoOffer.BogoBooks && item.quantity >= 2 ->
                    item.unitPrice.multiply(BigDecimal.valueOf(item.quantity / 2));
            default -> BigDecimal.ZERO;
        };
    }

    private BigDecimal applyCustomerTierDiscount(BigDecimal currentTotal, PricingContext ctx) {
        BigDecimal rate = switch (ctx.customer()) {
            case CustomerProfile.Employee _ -> new BigDecimal("0.20");
            case CustomerProfile.Vip(int years) when years >= 5 -> new BigDecimal("0.12");
            case CustomerProfile.Vip _ -> new BigDecimal("0.08");
            case CustomerProfile.Regular(int years) when years >= 3 -> new BigDecimal("0.03");
            case CustomerProfile.Regular _ -> BigDecimal.ZERO;
        };
        return currentTotal.subtract(currentTotal.multiply(rate));
    }

    private BigDecimal applyCartLevelPromo(BigDecimal currentTotal, PricingContext ctx) {
        BigDecimal promoDiscount = switch (ctx.promo()) {
            case PromoOffer.PercentOff(BigDecimal pct) ->
                    currentTotal.multiply(pct).divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            case PromoOffer.FixedAmountOff(BigDecimal amt)
                    when ctx.subtotal().compareTo(new BigDecimal("100.00")) >= 0 -> amt;
            case PromoOffer.FixedAmountOff _, PromoOffer.BogoBooks _, PromoOffer.None _ -> BigDecimal.ZERO;
        };
        return currentTotal.subtract(promoDiscount);
    }

    private BigDecimal applyGlobalDiscountCap(BigDecimal currentTotal, PricingContext ctx) {
        BigDecimal maxDiscount = ctx.subtotal().multiply(ctx.customer().maxDiscountRatio());
        BigDecimal minPayable = ctx.subtotal().subtract(maxDiscount);
        return currentTotal.max(minPayable);
    }
}

```

#### 7. Interview Follow-Up Questions
Первый вопрос проверяет глубину понимания деконструкции записей (Record Patterns в Java 21): как именно работает синтаксис `case CustomerProfile.Vip(int years) when years >= 5` в методе `applyCustomerTierDiscount` и почему после него все равно необходима ветка `case CustomerProfile.Vip _`? Кандидат должен объяснить, что паттерн `Vip(int years)` выполняет деконструкцию компонента `record` напрямую в локальную переменную `years`, а охранный предикат `when years >= 5` фильтрует значения. Поскольку булев предикат `when` не покрывает все множество значений типа `int`, компилятор требует вторую безусловную ветку `case CustomerProfile.Vip _` (с безымянным паттерном `_`) для доказательства исчерпываемости типа `Vip`.
Второй вопрос затрагивает интеграцию со Spring Boot 3.4 DI: если бы реализации `PricingStepStrategy` инжектировались из контекста Spring как `List<PricingStepStrategy>`, как гарантировать строгий порядок выполнения шагов (сначала категория, затем клиентский уровень, затем промокод, затем глобальный лимит)? Поскольку последовательное применение процентных и фиксированных скидок математически некоммутативно ($100 - 10\% - 20 \neq (100 - 20) - 10\%$), в Spring необходимо аннотировать каждый бин стратегии с помощью `@Order(1..4)` или реализовать интерфейс `Ordered`, а также верифицировать неизменность порядка в модульном и интеграционном тестах.
Третий вопрос исследует архитектурную границу между паттерном Visitor/Strategy и запечатанными интерфейсами: в каких случаях классический паттерн Strategy с открытым интерфейсом предпочтительнее запечатанного интерфейса `sealed interface PromoOffer`? Запечатанная иерархия (`sealed interface`) оптимальна, когда все варианты доменного типа известны внутри одного модуля и разработчики часто добавляют новые операции обработки, делая классический паттерн Visitor устаревшим. Если же новые типы промо-акций поставляются внешними плагинами или отдельными командами без перекомпиляции центрального модуля, необходим открытый полиморфный интерфейс `PromoStrategy`.

## Архетип 1.2: Одержимость примитивами и скопления данных — Объекты-значения (Value Objects) и Java 21 Records
Одержимость примитивами (Primitive Obsession) и скопления данных (Data Clumps) — одни из наиболее распространенных архитектурных запахов в микросервисах обработки платежей, биллинга и регистрации пользователей. Когда доменные понятия — денежная сумма с валютой, банковский счет, адрес электронной почты, телефонный номер или налоговый идентификатор — передаются через сырые `String` и `double`, логика нормализации и проверки инвариантов размазывается по десяткам сервисов, порождая уязвимости безопасности и состояния гонки при мутации данных.
В Java 21 LTS основным инструментом устранения этого запаха выступают доменные объекты-значения (Domain-Driven Value Objects), реализованные через `record` с компактными конструкторами (Compact Constructors). Компактный конструктор выполняется до инициализации финальных полей записи, что позволяет валидировать и нормализовать входные параметры (например, приводить email к нижнему регистру и выполнять защитное копирование коллекций через `List.copyOf`) в единой точке создания объекта.

### [L0-REF-03] FinTech User Onboarding & KYC Validator (Java 21 Records, Compact Constructors & Value Objects)

#### 1. Title & Grade
Задача **[L0-REF-03] FinTech User Onboarding & KYC Validator (Java 21 Records, Compact Constructors & Value Objects)** предназначена для оценки уровня **Junior Foundation (L0)**.

#### 2. Company Context
Это типовая задача собеседования в финтех-компаниях и необанках (Revolut, Т-Банк, Точка, Stripe). Она оценивает умение кандидата уровня L0 распознать проблему передачи восьми сырых строк и примитивов в метод регистрации, устранить утечки чувствительных платежных данных (PAN карты в `toString()` и логах), защитить внутренние коллекции от мутации и заменить разрозненные регулярные выражения на самовалидирующиеся объекты-значения (`EmailAddress`, `PhoneNumber`, `CardPan`, `DepositAmount`) на базе Java 21 Records.

#### 3. The "Dirty" Code (80–180 lines)
Исходный класс `UserRegistrationProcessor` принимает неструктурированный набор примитивов и возвращает мутабельный объект профиля.

```java
package com.interview.refactoring.l0.onboarding;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class UserRegistrationProcessor {

    public static class RegisteredUser {
        public String email;
        public String phone;
        public String countryIso;
        public int age;
        public String cardPan;
        public String currency;
        public double initialDeposit;
        public String kycStatus; // PENDING_REVIEW, VERIFIED, HIGH_RISK
        public List<String> tags;

        @Override
        public String toString() {
            // Security flaw: prints raw PAN in plain text!
            return "RegisteredUser[email=" + email + ", phone=" + phone
                    + ", cardPan=" + cardPan + ", status=" + kycStatus + "]";
        }
    }

    public RegisteredUser registerNewUser(
            String rawEmail,
            String rawPhone,
            String countryIso,
            int age,
            String cardPan,
            String currency,
            double initialDeposit,
            List<String> initialTags) {

        if (rawEmail == null || !rawEmail.trim().contains("@") || rawEmail.trim().startsWith("@")
                || rawEmail.trim().endsWith("@")) {
            throw new IllegalArgumentException("Invalid email format");
        }
        String normalizedEmail = rawEmail.trim().toLowerCase();

        if (rawPhone == null) {
            throw new IllegalArgumentException("Phone cannot be null");
        }
        String cleanedPhone = rawPhone.replaceAll("[\\s\\-()]", "");
        if (!Pattern.matches("^\\+[1-9]\\d{9,14}$", cleanedPhone)) {
            throw new IllegalArgumentException("Phone must be in E.164 format");
        }

        if (countryIso == null || countryIso.trim().length() != 2) {
            throw new IllegalArgumentException("Country ISO must be 2 letters");
        }
        String normCountry = countryIso.trim().toUpperCase();

        if (age < 18 || age > 120) {
            throw new IllegalArgumentException("User must be between 18 and 120 years old");
        }

        if (cardPan == null) {
            throw new IllegalArgumentException("Card PAN cannot be null");
        }
        String digitsOnlyPan = cardPan.replaceAll("\\s+", "");
        if (!Pattern.matches("^\\d{16}$", digitsOnlyPan)) {
            throw new IllegalArgumentException("Card PAN must be 16 digits");
        }

        if (currency == null || (!currency.equals("EUR") && !currency.equals("USD") && !currency.equals("GBP"))) {
            throw new IllegalArgumentException("Unsupported currency: " + currency);
        }

        if (initialDeposit < 10.0) {
            throw new IllegalArgumentException("Minimum initial deposit is 10.0");
        }

        String status;
        if (initialDeposit >= 10000.0 || normCountry.equals("CY") || normCountry.equals("MT")) {
            status = "HIGH_RISK";
        } else if (initialDeposit >= 1000.0) {
            status = "PENDING_REVIEW";
        } else {
            status = "VERIFIED";
        }

        RegisteredUser user = new RegisteredUser();
        user.email = normalizedEmail;
        user.phone = cleanedPhone;
        user.countryIso = normCountry;
        user.age = age;
        user.cardPan = digitsOnlyPan;
        user.currency = currency;
        user.initialDeposit = initialDeposit;
        user.kycStatus = status;
        user.tags = initialTags != null ? initialTags : new ArrayList<>();

        return user;
    }
}

```

#### 4. Code Smells Checklist
В ходе ревью кандидат должен идентифицировать пять ключевых архитектурных и эксплуатационных дефектов. Первый дефект — классическая одержимость примитивами и скопление параметров (Primitive Obsession & Data Clump): метод `registerNewUser` принимает восемь примитивных и строковых аргументов, при этом `currency` и `initialDeposit` оторваны друг от друга, хотя семантически образуют единый объект-значение `DepositAmount`. Второй критический запах — утечка мутабельного состояния (Mutable Aliasing Bug): выражение `user.tags = initialTags != null ? initialTags : new ArrayList<>()` сохраняет прямую ссылку на переданный извне список, поэтому последующая модификация `initialTags` на стороне клиента скрыто изменит состояние уже зарегистрированного пользователя.
Третья проблема представляет собой прямое нарушение стандартов безопасности PCI-DSS в методе `toString()`: полный 16-значный номер банковской карты (`cardPan`) сериализуется в открытом текстовом виде, что приведет к утечке секретов в систему сбора логов. Четвертый дефект касается деградации производительности из-за повторной компиляции регулярных выражений: вызовы `Pattern.matches(...)` и `String.replaceAll(...)` компилируют конечный автомат регулярного выражения при каждой регистрации вместо использования предкомпилированных констант `static final Pattern`. Пятый запах — кодирование конечных множеств валют и KYC-статусов сырыми строками вместо типобезопасных перечислений `enum`.

#### 5. Pin-Down Test Suite
Характеризующий тестовый набор проверяет правила нормализации email и телефона, граничные значения возраста и депозита, определение риск-статуса KYC и безопасность представления данных.

```java
package com.interview.refactoring.l0.onboarding;

import com.interview.refactoring.l0.onboarding.UserRegistrationProcessor.RegisteredUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserRegistrationProcessorTest {

    private UserRegistrationProcessor processor;

    @BeforeEach
    void setUp() {
        processor = new UserRegistrationProcessor();
    }

    @Test
    @DisplayName("Should normalize inputs and assign VERIFIED status for standard low-risk deposit")
    void shouldRegisterStandardVerifiedUser() {
        List<String> mutableTags = new ArrayList<>(List.of("retail", "eu"));

        RegisteredUser user = processor.registerNewUser(
                "  Alice.Smith@Example.COM ",
                "+49 (151) 234-56789",
                " de ",
                28,
                "4111 2222 3333 4444",
                "EUR",
                250.0,
                mutableTags
        );

        assertThat(user.email).isEqualTo("alice.smith@example.com");
        assertThat(user.phone).isEqualTo("+4915123456789");
        assertThat(user.countryIso).isEqualTo("DE");
        assertThat(user.age).isEqualTo(28);
        assertThat(user.cardPan).isEqualTo("4111222233334444");
        assertThat(user.currency).isEqualTo("EUR");
        assertThat(user.initialDeposit).isEqualTo(250.0);
        assertThat(user.kycStatus).isEqualTo("VERIFIED");
        assertThat(user.tags).containsExactly("retail", "eu");
    }

    @Test
    @DisplayName("Should classify HIGH_RISK and PENDING_REVIEW thresholds accurately")
    void shouldClassifyKycRiskTiers() {
        RegisteredUser pendingUser = processor.registerNewUser(
                "bob@test.io", "+447911123456", "GB", 35,
                "5500111122223333", "GBP", 1500.0, null);
        assertThat(pendingUser.kycStatus).isEqualTo("PENDING_REVIEW");

        RegisteredUser highDepositUser = processor.registerNewUser(
                "whale@test.io", "+447911123456", "GB", 45,
                "5500111122223333", "USD", 10000.0, List.of());
        assertThat(highDepositUser.kycStatus).isEqualTo("HIGH_RISK");

        RegisteredUser highRiskCountryUser = processor.registerNewUser(
                "cyprus@test.io", "+35799123456", "cy", 30,
                "5500111122223333", "EUR", 50.0, List.of());
        assertThat(highRiskCountryUser.kycStatus).isEqualTo("HIGH_RISK");
    }

    @Test
    @DisplayName("Should reject invalid email, phone, age, PAN, currency, or deposit")
    void shouldRejectInvalidOnboardingInputs() {
        assertThatThrownBy(() -> processor.registerNewUser(
                "invalid-email@", "+4915123456789", "DE", 25, "4111222233334444", "EUR", 100.0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid email format");

        assertThatThrownBy(() -> processor.registerNewUser(
                "a@b.com", "015123456789", "DE", 25, "4111222233334444", "EUR", 100.0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E.164");

        assertThatThrownBy(() -> processor.registerNewUser(
                "a@b.com", "+4915123456789", "DEU", 25, "4111222233334444", "EUR", 100.0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Country ISO");

        assertThatThrownBy(() -> processor.registerNewUser(
                "a@b.com", "+4915123456789", "DE", 17, "4111222233334444", "EUR", 100.0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 18 and 120");

        assertThatThrownBy(() -> processor.registerNewUser(
                "a@b.com", "+4915123456789", "DE", 25, "12345", "EUR", 100.0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("16 digits");

        assertThatThrownBy(() -> processor.registerNewUser(
                "a@b.com", "+4915123456789", "DE", 25, "4111222233334444", "CHF", 100.0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported currency");

        assertThatThrownBy(() -> processor.registerNewUser(
                "a@b.com", "+4915123456789", "DE", 25, "4111222233334444", "EUR", 9.99, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Minimum initial deposit");
    }
}

```

#### 6. Refactored Clean Code
Эталонное решение на Java 21 LTS вводит строгие объекты-значения (`EmailAddress`, `PhoneNumber`, `CountryIso`, `CardPan`, `DepositAmount`) с использованием компактных конструкторов для валидации и нормализации до присвоения полей, защитным копированием коллекций (`List.copyOf`) и маскированием PAN карты в `toString()`.

```java
package com.interview.refactoring.l0.onboarding;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public class UserRegistrationProcessor {

    private static final Pattern E164_PHONE_PATTERN = Pattern.compile("^\\+[1-9]\\d{9,14}$");
    private static final Pattern CARD_PAN_PATTERN = Pattern.compile("^\\d{16}$");
    private static final Pattern WHITESPACE_AND_PUNCT = Pattern.compile("[\\s\\-()]");
    private static final Pattern WHITESPACE_ONLY = Pattern.compile("\\s+");
    private static final Set<String> HIGH_RISK_COUNTRIES = Set.of("CY", "MT");

    public enum SupportedCurrency {
        EUR, USD, GBP;

        public static SupportedCurrency fromCode(String raw) {
            if (raw == null) {
                throw new IllegalArgumentException("Unsupported currency: null");
            }
            try {
                return SupportedCurrency.valueOf(raw);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Unsupported currency: " + raw, ex);
            }
        }
    }

    public enum KycStatus {
        VERIFIED, PENDING_REVIEW, HIGH_RISK;

        public static KycStatus evaluate(DepositAmount deposit, CountryIso country) {
            if (deposit.amount().compareTo(new BigDecimal("10000.0")) >= 0
                    || HIGH_RISK_COUNTRIES.contains(country.code())) {
                return HIGH_RISK;
            }
            if (deposit.amount().compareTo(new BigDecimal("1000.0")) >= 0) {
                return PENDING_REVIEW;
            }
            return VERIFIED;
        }
    }

    public record EmailAddress(String value) {
        public EmailAddress {
            if (value == null) {
                throw new IllegalArgumentException("Invalid email format");
            }
            String trimmed = value.trim();
            if (!trimmed.contains("@") || trimmed.startsWith("@") || trimmed.endsWith("@")) {
                throw new IllegalArgumentException("Invalid email format");
            }
            value = trimmed.toLowerCase(Locale.ROOT);
        }
    }

    public record PhoneNumber(String e164Value) {
        public PhoneNumber {
            if (e164Value == null) {
                throw new IllegalArgumentException("Phone cannot be null");
            }
            String cleaned = WHITESPACE_AND_PUNCT.matcher(e164Value).replaceAll("");
            if (!E164_PHONE_PATTERN.matcher(cleaned).matches()) {
                throw new IllegalArgumentException("Phone must be in E.164 format");
            }
            e164Value = cleaned;
        }
    }

    public record CountryIso(String code) {
        public CountryIso {
            if (code == null || code.trim().length() != 2) {
                throw new IllegalArgumentException("Country ISO must be 2 letters");
            }
            code = code.trim().toUpperCase(Locale.ROOT);
        }
    }

    public record AdultAge(int years) {
        public AdultAge {
            if (years < 18 || years > 120) {
                throw new IllegalArgumentException("User must be between 18 and 120 years old");
            }
        }
    }

    public record CardPan(String digits) {
        public CardPan {
            if (digits == null) {
                throw new IllegalArgumentException("Card PAN cannot be null");
            }
            String cleaned = WHITESPACE_ONLY.matcher(digits).replaceAll("");
            if (!CARD_PAN_PATTERN.matcher(cleaned).matches()) {
                throw new IllegalArgumentException("Card PAN must be 16 digits");
            }
            digits = cleaned;
        }

        public String masked() {
            return digits.substring(0, 4) + "********" + digits.substring(12);
        }

        @Override
        public String toString() {
            return masked();
        }
    }

    public record DepositAmount(BigDecimal amount, SupportedCurrency currency) {
        private static final BigDecimal MIN_DEPOSIT = new BigDecimal("10.0");

        public DepositAmount {
            if (amount == null || amount.compareTo(MIN_DEPOSIT) < 0) {
                throw new IllegalArgumentException("Minimum initial deposit is 10.0");
            }
            if (currency == null) {
                throw new IllegalArgumentException("Currency cannot be null");
            }
        }
    }

    public record OnboardingCommand(
            EmailAddress email,
            PhoneNumber phone,
            CountryIso country,
            AdultAge age,
            CardPan cardPan,
            DepositAmount initialDeposit,
            List<String> tags
    ) {
        public OnboardingCommand {
            tags = (tags == null) ? List.of() : List.copyOf(tags);
        }
    }

    public static final class RegisteredUser {
        public final String email;
        public final String phone;
        public final String countryIso;
        public final int age;
        public final String cardPan;
        public final String currency;
        public final double initialDeposit;
        public final String kycStatus;
        public final List<String> tags;
        private final String maskedPan;

        private RegisteredUser(OnboardingCommand cmd, KycStatus status) {
            this.email = cmd.email().value();
            this.phone = cmd.phone().e164Value();
            this.countryIso = cmd.country().code();
            this.age = cmd.age().years();
            this.cardPan = cmd.cardPan().digits();
            this.maskedPan = cmd.cardPan().masked();
            this.currency = cmd.initialDeposit().currency().name();
            this.initialDeposit = cmd.initialDeposit().amount().doubleValue();
            this.kycStatus = status.name();
            this.tags = cmd.tags();
        }

        @Override
        public String toString() {
            return "RegisteredUser[email=" + email + ", phone=" + phone
                    + ", cardPan=" + maskedPan + ", status=" + kycStatus + "]";
        }
    }

    public RegisteredUser registerNewUser(
            String rawEmail,
            String rawPhone,
            String countryIso,
            int age,
            String cardPan,
            String currency,
            double initialDeposit,
            List<String> initialTags) {

        OnboardingCommand command = new OnboardingCommand(
                new EmailAddress(rawEmail),
                new PhoneNumber(rawPhone),
                new CountryIso(countryIso),
                new AdultAge(age),
                new CardPan(cardPan),
                new DepositAmount(BigDecimal.valueOf(initialDeposit), SupportedCurrency.fromCode(currency)),
                initialTags
        );

        return register(command);
    }

    public RegisteredUser register(OnboardingCommand command) {
        KycStatus status = KycStatus.evaluate(command.initialDeposit(), command.country());
        return new RegisteredUser(command, status);
    }
}

```

#### 7. Interview Follow-Up Questions
Первый вопрос проверяет знание байт-кода компактных конструкторов (Java Records): как именно работает инструкция `value = trimmed.toLowerCase(Locale.ROOT);` внутри компактного конструктора `EmailAddress`, если в теле конструктора запрещено писать `this.value = ...`? Кандидат должен объяснить, что в компактном конструкторе разработчик модифицирует локальные параметры конструктора до момента фиксации состояния, а компилятор `javac` автоматически вставляет инструкции инициализации финальных полей (`this.value = value;`) в самый конец сгенерированного канонического конструктора.
Второй вопрос посвящен проблеме поверхностной иммутабельности (`Shallow Immutability`): является ли `record OnboardingCommand(..., List<String> tags)` глубоко иммутабельным по умолчанию без явного вызова `List.copyOf(tags)` в компактном конструкторе? Записи в Java гарантируют только поверхностную неизменяемость ссылок (`private final`), но не замораживают внутреннее состояние вложенных контейнеров. Без защитного копирования переданный извне `ArrayList` можно мутировать после создания `OnboardingCommand`, что также разрушит инвариант `hashCode()` при использовании записи в качестве ключа `HashMap`.
Третий вопрос касается границ применимости `record` в слое персистентности: почему записи Java 21 нельзя напрямую аннотировать как `@Entity` в JPA / Hibernate? Спецификация Jakarta Persistence требует от сущностей наличия конструктора без аргументов, нефинальных полей и возможности создания runtime-прокси для ленивой загрузки и отслеживания изменений (dirty checking), чему противоречит финальная природа `record`. При этом записи идеально подходят для DTO, доменных Value Objects, проекций Spring Data JPA и `@Embeddable`-компонентов в современных версиях Hibernate.

### [L1-REF-04] Cross-Border Invoice Billing & Settlement Processor (Money Value Object, Defensive Copies & Domain Invariants)

#### 1. Title & Grade
Задача **[L1-REF-04] Cross-Border Invoice Billing & Settlement Processor (Money Value Object, Defensive Copies & Domain Invariants)** спроектирована для грейда **Middle Specialist (L1)**.

#### 2. Company Context
Данный кейс применяется на технических интервью уровня Middle в платежных системах и B2B-финтехе (Revolut Business, Adyen, Яндекс Пэй, FinTech Core). Он проверяет способность инженера выявлять риски мультивалютной арифметики (потенциальное сложение сумм в разных валютах), устранять анти-паттерн параллельных коллекций (Parallel Collections / Data Clump) и проектировать богатую доменную модель вокруг объекта-значения `Money(BigDecimal, CurrencyUnit)` с контролем масштаба округления.

#### 3. The "Dirty" Code (80–180 lines)
Исходный класс `InvoiceBillingDataClump` оперирует параллельными списками сырых примитивов для позиций инвойса, налогов и валютных курсов.

```java
package com.interview.refactoring.l1.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class InvoiceBillingDataClump {

    public static class InvoiceSummary {
        public String invoiceId;
        public String settlementCurrency;
        public BigDecimal netAmount;
        public BigDecimal taxAmount;
        public BigDecimal crossBorderFee;
        public BigDecimal grossTotal;
        public List<String> auditBreakdown = new ArrayList<>();
    }

    /**
     * Processes multi-currency invoice lines and settles into target currency.
     * Parallel lists represent line item descriptions, amounts, currencies, and tax rates.
     */
    public InvoiceSummary settleInvoice(
            String invoiceId,
            String merchantCountry,
            String buyerCountry,
            String settlementCurrency,
            List<String> lineDescriptions,
            List<BigDecimal> lineAmounts,
            List<String> lineCurrencies,
            List<BigDecimal> lineTaxPercents,
            Map<String, BigDecimal> fxRatesToSettlement,
            boolean taxExemptBuyer) {

        if (invoiceId == null || invoiceId.isBlank()) {
            throw new IllegalArgumentException("Invoice ID is required");
        }
        if (settlementCurrency == null || settlementCurrency.length() != 3) {
            throw new IllegalArgumentException("Invalid settlement currency");
        }
        if (lineDescriptions == null || lineAmounts == null || lineCurrencies == null || lineTaxPercents == null) {
            throw new IllegalArgumentException("Line item lists cannot be null");
        }
        if (lineDescriptions.size() != lineAmounts.size()
                || lineAmounts.size() != lineCurrencies.size()
                || lineCurrencies.size() != lineTaxPercents.size()) {
            throw new IllegalArgumentException("Parallel line lists must have identical size");
        }
        if (lineDescriptions.isEmpty()) {
            throw new IllegalArgumentException("Invoice must contain at least one line item");
        }

        BigDecimal totalNetInSettlement = BigDecimal.ZERO;
        BigDecimal totalTaxInSettlement = BigDecimal.ZERO;
        List<String> breakdown = new ArrayList<>();

        for (int i = 0; i < lineDescriptions.size(); i++) {
            String desc = lineDescriptions.get(i);
            BigDecimal amt = lineAmounts.get(i);
            String curr = lineCurrencies.get(i);
            BigDecimal taxPct = lineTaxPercents.get(i);

            if (amt == null || amt.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Line amount must be positive at index " + i);
            }
            if (taxPct == null || taxPct.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Tax percent cannot be negative at index " + i);
            }

            BigDecimal convertedNet;
            if (curr.equals(settlementCurrency)) {
                convertedNet = amt.setScale(2, RoundingMode.HALF_UP);
            } else {
                if (fxRatesToSettlement == null || !fxRatesToSettlement.containsKey(curr)) {
                    throw new IllegalArgumentException("Missing FX rate for currency: " + curr);
                }
                BigDecimal rate = fxRatesToSettlement.get(curr);
                if (rate == null || rate.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Invalid FX rate for currency: " + curr);
                }
                convertedNet = amt.multiply(rate).setScale(2, RoundingMode.HALF_UP);
            }

            BigDecimal lineTax = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            if (!taxExemptBuyer) {
                // Reverse-charge rule: cross-border B2B has 0% VAT unless domestic
                if (merchantCountry != null && merchantCountry.equalsIgnoreCase(buyerCountry)) {
                    lineTax = convertedNet.multiply(taxPct)
                            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
                }
            }

            totalNetInSettlement = totalNetInSettlement.add(convertedNet);
            totalTaxInSettlement = totalTaxInSettlement.add(lineTax);
            breakdown.add(desc + ": net=" + convertedNet + " " + settlementCurrency
                    + ", tax=" + lineTax + " " + settlementCurrency);
        }

        BigDecimal fee = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (merchantCountry != null && buyerCountry != null
                && !merchantCountry.equalsIgnoreCase(buyerCountry)) {
            fee = totalNetInSettlement.multiply(new BigDecimal("0.015"))
                    .setScale(2, RoundingMode.HALF_UP);
            if (fee.compareTo(new BigDecimal("2.50")) < 0) {
                fee = new BigDecimal("2.50");
            }
        }

        InvoiceSummary summary = new InvoiceSummary();
        summary.invoiceId = invoiceId;
        summary.settlementCurrency = settlementCurrency;
        summary.netAmount = totalNetInSettlement.setScale(2, RoundingMode.HALF_UP);
        summary.taxAmount = totalTaxInSettlement.setScale(2, RoundingMode.HALF_UP);
        summary.crossBorderFee = fee;
        summary.grossTotal = summary.netAmount.add(summary.taxAmount).add(summary.crossBorderFee);
        summary.auditBreakdown = breakdown;
        return summary;
    }
}

```

#### 4. Code Smells Checklist
На этапе анализа кода кандидат должен сформулировать четыре ключевых архитектурных замечания. Первым выступает анти-паттерн параллельных коллекций (Parallel Collections / Data Clump): четыре списка (`lineDescriptions`, `lineAmounts`, `lineCurrencies`, `lineTaxPercents`) связаны исключительно позиционным индексом `i`, что вынуждает писать громоздкие проверки совпадения размерностей и провоцирует ошибки индексации при модификации. Второй запах — отсутствие доменного типа `Money` (Primitive Obsession): код валюты (`String curr`) отделен от величины суммы (`BigDecimal amt`), поэтому компилятор никак не защищает разработчика от случайного сложения долларов и евро без предварительной конвертации.
Третья проблема заключается в анемичной и открытой для мутации структуре результата `InvoiceSummary`: нефинальные публичные поля и изменяемый список `auditBreakdown` позволяют любому потребителю нарушить целостность рассчитанного баланса (`grossTotal != net + tax + fee`) после возврата из метода. Четвертый запах выражен в смешении доменных правил валютной конвертации, налогового законодательства (Reverse-Charge VAT для трансграничных операций) и расчета минимальной комиссии в едином процедурном цикле.

#### 5. Pin-Down Test Suite
Набор модульных тестов JUnit 5 фиксирует расчет внутренних и трансграничных инвойсов, применение минимальной комиссии `2.50`, правило Reverse-Charge для нерезидентов и все проверки валидации параллельных списков.

```java
package com.interview.refactoring.l1.billing;

import com.interview.refactoring.l1.billing.InvoiceBillingDataClump.InvoiceSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvoiceBillingDataClumpTest {

    private InvoiceBillingDataClump processor;

    @BeforeEach
    void setUp() {
        processor = new InvoiceBillingDataClump();
    }

    @Test
    @DisplayName("Should settle domestic multi-currency invoice with VAT and zero cross-border fee")
    void shouldSettleDomesticInvoiceWithVat() {
        InvoiceSummary summary = processor.settleInvoice(
                "INV-2026-001",
                "DE",
                "DE",
                "EUR",
                List.of("Cloud Hosting", "Support License"),
                List.of(new BigDecimal("100.00"), new BigDecimal("200.00")),
                List.of("EUR", "USD"),
                List.of(new BigDecimal("19"), new BigDecimal("19")),
                Map.of("USD", new BigDecimal("0.92")),
                false
        );

        // Line 1: 100.00 EUR, tax 19.00 EUR
        // Line 2: 200.00 USD * 0.92 = 184.00 EUR, tax 184 * 0.19 = 34.96 EUR
        // Net = 284.00, Tax = 53.96, Fee = 0.00, Gross = 337.96
        assertThat(summary.invoiceId).isEqualTo("INV-2026-001");
        assertThat(summary.settlementCurrency).isEqualTo("EUR");
        assertThat(summary.netAmount).isEqualByComparingTo("284.00");
        assertThat(summary.taxAmount).isEqualByComparingTo("53.96");
        assertThat(summary.crossBorderFee).isEqualByComparingTo("0.00");
        assertThat(summary.grossTotal).isEqualByComparingTo("337.96");
        assertThat(summary.auditBreakdown).containsExactly(
                "Cloud Hosting: net=100.00 EUR, tax=19.00 EUR",
                "Support License: net=184.00 EUR, tax=34.96 EUR"
        );
    }

    @Test
    @DisplayName("Should apply reverse-charge 0% VAT and minimum 2.50 cross-border fee for small international invoice")
    void shouldApplyReverseChargeAndMinimumCrossBorderFee() {
        InvoiceSummary summary = processor.settleInvoice(
                "INV-2026-002",
                "DE",
                "FR",
                "EUR",
                List.of("API Calls"),
                List.of(new BigDecimal("50.00")),
                List.of("EUR"),
                List.of(new BigDecimal("19")),
                Map.of(),
                false
        );

        // Cross-border DE != FR: 0% tax, 1.5% of 50.00 = 0.75 < 2.50 min fee -> 2.50 EUR
        assertThat(summary.netAmount).isEqualByComparingTo("50.00");
        assertThat(summary.taxAmount).isEqualByComparingTo("0.00");
        assertThat(summary.crossBorderFee).isEqualByComparingTo("2.50");
        assertThat(summary.grossTotal).isEqualByComparingTo("52.50");
    }

    @Test
    @DisplayName("Should apply proportional 1.5% cross-border fee for large international invoice")
    void shouldApplyProportionalCrossBorderFee() {
        InvoiceSummary summary = processor.settleInvoice(
                "INV-2026-003",
                "DE",
                "US",
                "EUR",
                List.of("Enterprise Retainer"),
                List.of(new BigDecimal("1000.00")),
                List.of("EUR"),
                List.of(new BigDecimal("19")),
                Map.of(),
                false
        );

        assertThat(summary.crossBorderFee).isEqualByComparingTo("15.00");
        assertThat(summary.grossTotal).isEqualByComparingTo("1015.00");
    }

    @Test
    @DisplayName("Should reject mismatched parallel lists and missing FX rates")
    void shouldRejectInvalidParallelListsAndMissingFx() {
        assertThatThrownBy(() -> processor.settleInvoice(
                "INV-ERR", "DE", "DE", "EUR",
                List.of("Item 1", "Item 2"),
                List.of(new BigDecimal("10.00")),
                List.of("EUR"),
                List.of(new BigDecimal("19")),
                Map.of(), false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("identical size");

        assertThatThrownBy(() -> processor.settleInvoice(
                "INV-ERR", "DE", "DE", "EUR",
                List.of("Item 1"),
                List.of(new BigDecimal("10.00")),
                List.of("GBP"),
                List.of(new BigDecimal("19")),
                Map.of(), false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Missing FX rate for currency: GBP");
    }
}

```

#### 6. Refactored Clean Code
В рефакторинге на Java 21 LTS введен типобезопасный объект-значение `Money(BigDecimal amount, CurrencyUnit currency)`, контролирующий совпадение валют при арифметических операциях, а параллельные списки преобразованы в иммутабельные записи `InvoiceLineItem` и `ExchangeRateTable`.

```java
package com.interview.refactoring.l1.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class InvoiceBillingDataClump {

    public record CurrencyUnit(String isoCode) {
        public CurrencyUnit {
            if (isoCode == null || isoCode.length() != 3) {
                throw new IllegalArgumentException("Invalid settlement currency");
            }
        }
    }

    public record Money(BigDecimal amount, CurrencyUnit currency) {
        public Money {
            if (amount == null || currency == null) {
                throw new IllegalArgumentException("Money amount and currency are required");
            }
            amount = amount.setScale(2, RoundingMode.HALF_UP);
        }

        public static Money zero(CurrencyUnit currency) {
            return new Money(BigDecimal.ZERO, currency);
        }

        public Money add(Money other) {
            requireSameCurrency(other);
            return new Money(this.amount.add(other.amount), this.currency);
        }

        public Money multiplyPercent(BigDecimal percent) {
            BigDecimal result = this.amount.multiply(percent)
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
            return new Money(result, this.currency);
        }

        public Money multiplyRate(BigDecimal rate) {
            return new Money(this.amount.multiply(rate), this.currency);
        }

        public Money max(Money floor) {
            requireSameCurrency(floor);
            return this.amount.compareTo(floor.amount) >= 0 ? this : floor;
        }

        private void requireSameCurrency(Money other) {
            if (!this.currency.equals(other.currency)) {
                throw new IllegalArgumentException(
                        "Currency mismatch: " + this.currency.isoCode() + " vs " + other.currency.isoCode());
            }
        }

        public String formatted() {
            return amount + " " + currency.isoCode();
        }
    }

    public record InvoiceLineItem(String description, Money unitAmount, BigDecimal taxPercent) {
        public InvoiceLineItem {
            if (unitAmount == null || unitAmount.amount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Line amount must be positive");
            }
            if (taxPercent == null || taxPercent.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Tax percent cannot be negative");
            }
        }
    }

    public record ExchangeRateTable(CurrencyUnit targetCurrency, Map<String, BigDecimal> rates) {
        public ExchangeRateTable {
            rates = (rates == null) ? Map.of() : Map.copyOf(rates);
        }

        public Money convert(Money source) {
            if (source.currency().equals(targetCurrency)) {
                return source;
            }
            String sourceCode = source.currency().isoCode();
            BigDecimal rate = rates.get(sourceCode);
            if (rate == null) {
                throw new IllegalArgumentException("Missing FX rate for currency: " + sourceCode);
            }
            if (rate.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Invalid FX rate for currency: " + sourceCode);
            }
            return new Money(source.amount().multiply(rate), targetCurrency);
        }
    }

    public record CounterpartyJurisdiction(String merchantCountry, String buyerCountry, boolean taxExemptBuyer) {
        public boolean isDomesticTaxable() {
            return !taxExemptBuyer
                    && merchantCountry != null
                    && merchantCountry.equalsIgnoreCase(buyerCountry);
        }

        public boolean isCrossBorder() {
            return merchantCountry != null
                    && buyerCountry != null
                    && !merchantCountry.equalsIgnoreCase(buyerCountry);
        }
    }

    public static final class InvoiceSummary {
        public final String invoiceId;
        public final String settlementCurrency;
        public final BigDecimal netAmount;
        public final BigDecimal taxAmount;
        public final BigDecimal crossBorderFee;
        public final BigDecimal grossTotal;
        public final List<String> auditBreakdown;

        public InvoiceSummary(String invoiceId, Money net, Money tax, Money fee, List<String> breakdown) {
            this.invoiceId = invoiceId;
            this.settlementCurrency = net.currency().isoCode();
            this.netAmount = net.amount();
            this.taxAmount = tax.amount();
            this.crossBorderFee = fee.amount();
            this.grossTotal = net.add(tax).add(fee).amount();
            this.auditBreakdown = List.copyOf(breakdown);
        }
    }

    public InvoiceSummary settleInvoice(
            String invoiceId,
            String merchantCountry,
            String buyerCountry,
            String settlementCurrency,
            List<String> lineDescriptions,
            List<BigDecimal> lineAmounts,
            List<String> lineCurrencies,
            List<BigDecimal> lineTaxPercents,
            Map<String, BigDecimal> fxRatesToSettlement,
            boolean taxExemptBuyer) {

        if (invoiceId == null || invoiceId.isBlank()) {
            throw new IllegalArgumentException("Invoice ID is required");
        }
        CurrencyUnit targetCurrency = new CurrencyUnit(settlementCurrency);
        List<InvoiceLineItem> items = zipParallelLines(lineDescriptions, lineAmounts, lineCurrencies, lineTaxPercents);
        ExchangeRateTable fxTable = new ExchangeRateTable(targetCurrency, fxRatesToSettlement);
        CounterpartyJurisdiction jurisdiction = new CounterpartyJurisdiction(merchantCountry, buyerCountry, taxExemptBuyer);

        return settleDomainInvoice(invoiceId, items, fxTable, jurisdiction);
    }

    public InvoiceSummary settleDomainInvoice(
            String invoiceId,
            List<InvoiceLineItem> items,
            ExchangeRateTable fxTable,
            CounterpartyJurisdiction jurisdiction) {

        CurrencyUnit targetCurrency = fxTable.targetCurrency();
        Money totalNet = Money.zero(targetCurrency);
        Money totalTax = Money.zero(targetCurrency);
        List<String> breakdown = new ArrayList<>(items.size());

        for (InvoiceLineItem item : items) {
            Money convertedNet = fxTable.convert(item.unitAmount());
            Money lineTax = jurisdiction.isDomesticTaxable()
                    ? convertedNet.multiplyPercent(item.taxPercent())
                    : Money.zero(targetCurrency);

            totalNet = totalNet.add(convertedNet);
            totalTax = totalTax.add(lineTax);
            breakdown.add(item.description() + ": net=" + convertedNet.formatted() + ", tax=" + lineTax.formatted());
        }

        Money crossBorderFee = calculateCrossBorderFee(totalNet, jurisdiction);
        return new InvoiceSummary(invoiceId, totalNet, totalTax, crossBorderFee, breakdown);
    }

    private Money calculateCrossBorderFee(Money totalNet, CounterpartyJurisdiction jurisdiction) {
        if (!jurisdiction.isCrossBorder()) {
            return Money.zero(totalNet.currency());
        }
        Money proportionalFee = totalNet.multiplyRate(new BigDecimal("0.015"));
        Money minimumFee = new Money(new BigDecimal("2.50"), totalNet.currency());
        return proportionalFee.max(minimumFee);
    }

    private List<InvoiceLineItem> zipParallelLines(
            List<String> descriptions,
            List<BigDecimal> amounts,
            List<String> currencies,
            List<BigDecimal> taxPercents) {

        if (descriptions == null || amounts == null || currencies == null || taxPercents == null) {
            throw new IllegalArgumentException("Line item lists cannot be null");
        }
        if (descriptions.size() != amounts.size()
                || amounts.size() != currencies.size()
                || currencies.size() != taxPercents.size()) {
            throw new IllegalArgumentException("Parallel line lists must have identical size");
        }
        if (descriptions.isEmpty()) {
            throw new IllegalArgumentException("Invoice must contain at least one line item");
        }

        List<InvoiceLineItem> items = new ArrayList<>(descriptions.size());
        for (int i = 0; i < descriptions.size(); i++) {
            BigDecimal amt = amounts.get(i);
            BigDecimal tax = taxPercents.get(i);
            if (amt == null || amt.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Line amount must be positive at index " + i);
            }
            if (tax == null || tax.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Tax percent cannot be negative at index " + i);
            }
            items.add(new InvoiceLineItem(
                    descriptions.get(i),
                    new Money(amt, new CurrencyUnit(currencies.get(i))),
                    tax
            ));
        }
        return items;
    }
}

```

#### 7. Interview Follow-Up Questions
Первый вопрос проверяет тонкости контракта `equals()` и `hashCode()` для `BigDecimal` внутри `record Money`: поскольку компилятор автоматически генерирует `equals()`, вызывающий `amount.equals(other.amount)`, почему `new BigDecimal("10.0").equals(new BigDecimal("10.00"))` возвращает `false`, и как наш компактный конструктор предотвращает эту ловушку? В отличие от `compareTo()`, метод `BigDecimal.equals()` учитывает как мантиссу (`unscaledValue`), так и масштаб (`scale`). Благодаря тому, что компактный конструктор `Money` принудительно нормализует масштаб всех входных значений через `amount = amount.setScale(2, RoundingMode.HALF_UP)`, любые два экземпляра `Money` с одинаковой валютой имеют идентичный `scale = 2`, что делает автоматически сгенерированные `equals()` и `hashCode()` математически корректными.
Второй вопрос исследует поведение `Map.copyOf` при наличии `null`-значений: в оригинальном коде присутствовала проверка `if (rate == null |
| rate.compareTo(BigDecimal.ZERO) <= 0)`. Что произойдет, если вызывающий код передаст` HashMap`, содержащую ключ с` null`-значением, в конструктор` ExchangeRateTable`, использующий` Map.copyOf(rates)`[cite: 25]? Метод`Map.copyOf()`немедленно выбрасывает`NullPointerException`при обнаружении любого`null`-ключа или` null`-значения. Если внешний контракт требует выбрасывания именно` IllegalArgumentException("Invalid FX rate...")`в момент обращения к валюте, следует либо валидировать значения карты до вызова`Map.copyOf`, либо оборачивать копию через` Collections.unmodifiableMap(new HashMap<>(rates))`.
Третий вопрос касается стратегии округления в расчетных системах: в нашей реализации округление до двух знаков выполняется на уровне каждой позиции инвойса (`setScale(2, RoundingMode.HALF_UP)`). В каких финансовых сценариях такое построчное округление недопустимо? В системах микротранзакций и тарификации облачных ресурсов (например, биллинг по `$0.0015` за вызов API) округление каждой отдельной строки до центов приведет к обнулению начислений или накоплению систематической погрешности (rounding drift). В подобных доменах вводят два различных типа: `UnitPrice` с масштабом 6–8 знаков для промежуточной агрегации и `SettlementMoney` с масштабом 2 знака исключительно на этапе формирования итогового платежного требования.

## Архетип 1.3: Божественный класс и спагетти-оркестратор — Принцип единственной ответственности (SRP) и инверсия зависимостей
Божественный объект (God Object / Spaghetti Orchestrator) возникает, когда единый сервисный класс совмещает валидацию входных данных, прямое управление соединениями с базой данных или кэшем, генерацию шаблонов HTML-писем, отправку SMS-уведомлений и запись аудиторских логов. Такой класс нарушает Принцип единственной ответственности (Single Responsibility Principle, SRP — у класса должна быть только одна причина для изменения) и Принцип инверсии зависимостей (Dependency Inversion Principle, DIP). Как следствие, его невозможно протестировать в быстрых модульных тестах без поднятия реальной инфраструктуры, а любая правка верстки письма рискует сломать транзакционную логику сохранения заказа.
На уровне L0 от кандидата требуется аккуратно выделить ролевые интерфейсы коллабораторов и перейти к внедрению зависимостей через конструктор (Constructor Dependency Injection). На уровне L1 ожидается понимание транзакционных границ, идемпотентности внешних вызовов и владение современным тестовым стеком Spring Boot 3.4+ (`@MockitoBean` и `@MockitoSpyBean` вместо устаревших `@MockBean` / `@SpyBean`).

### [L0-REF-05] User Account Lifecycle & Notification Manager (SRP Decomposition & Constructor DI)

#### 1. Title & Grade
Задача **[L0-REF-05] User Account Lifecycle & Notification Manager (SRP Decomposition & Constructor DI)** предназначена для уровня **Junior Foundation (L0)**.

#### 2. Company Context
Это классическая задача для оценки разработчиков уровня Junior/Junior+ в экосистемных продуктах (Яндекс ID, Ozon, Avito, СберТех). Она проверяет понимание принципа единственной ответственности (SRP), умение выделять чистые доменные интерфейсы (`PasswordHasher`, `AccountRepository`, `AccountNotificationService`, `SecurityAuditLogger`), избавляться от квадратичной конкатенации строк в циклах и внедрять зависимости через конструктор без поломки существующего публичного конструктора.

#### 3. The "Dirty" Code (80–180 lines)
Класс `UserAccountLifecycleManager` совмещает хэширование паролей, хранение состояния в памяти, форматирование HTML-уведомлений и аудит.

```java
package com.interview.refactoring.l0.account;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class UserAccountLifecycleManager {

    public static class AccountRecord {
        public String username;
        public String email;
        public String passwordHash;
        public boolean active;
        public List<String> roles;
    }

    private final Map<String, AccountRecord> database = new HashMap<>();
    private final List<String> sentEmailsLog = new ArrayList<>();
    private final List<String> auditLog = new ArrayList<>();

    public String createAndActivateAccount(String username, String email, String rawPassword, List<String> roles) {
        // 1. Input validation
        if (username == null || username.trim().length() < 3) {
            throw new IllegalArgumentException("Username must be at least 3 characters");
        }
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email address");
        }
        if (rawPassword == null || rawPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        String normUser = username.trim().toLowerCase();
        if (database.containsKey(normUser)) {
            throw new IllegalStateException("Account already exists: " + normUser);
        }

        // 2. Cryptographic hashing directly inside service method
        String passwordHash;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(("STATIC_SALT_" + rawPassword).getBytes(StandardCharsets.UTF_8));
            String hex = "";
            for (byte b : digest) {
                hex += String.format("%02x", b); // O(n^2) string concatenation in loop!
            }
            passwordHash = hex;
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Hashing error", e);
        }

        // 3. Persistence logic
        AccountRecord record = new AccountRecord();
        record.username = normUser;
        record.email = email.trim().toLowerCase();
        record.passwordHash = passwordHash;
        record.active = true;
        record.roles = (roles == null || roles.isEmpty()) ? List.of("USER") : new ArrayList<>(roles);
        database.put(normUser, record);

        // 4. HTML Email formatting & sending
        String roleListHtml = "";
        for (int i = 0; i < record.roles.size(); i++) {
            roleListHtml += "<li>" + record.roles.get(i) + "</li>";
        }
        String htmlBody = "<html><body><h1>Welcome, " + normUser + "!</h1>"
                + "<p>Your assigned roles:</p><ul>" + roleListHtml + "</ul></body></html>";
        sentEmailsLog.add("TO:" + record.email + "|BODY:" + htmlBody);

        // 5. Security Audit Logging
        auditLog.add("AUDIT: Created active account for user=" + normUser + " with roles=" + record.roles.size());

        return passwordHash;
    }

    public void deactivateAccount(String username, String reason) {
        if (username == null) {
            throw new IllegalArgumentException("Username required");
        }
        String normUser = username.trim().toLowerCase();
        AccountRecord record = database.get(normUser);
        if (record == null) {
            throw new IllegalArgumentException("Account not found: " + normUser);
        }
        record.active = false;

        String htmlBody = "<html><body><h1>Account Deactivated</h1><p>Reason: " + reason + "</p></body></html>";
        sentEmailsLog.add("TO:" + record.email + "|BODY:" + htmlBody);
        auditLog.add("AUDIT: Deactivated account for user=" + normUser + " reason=" + reason);
    }

    public AccountRecord findAccount(String username) {
        return database.get(username.trim().toLowerCase());
    }

    public List<String> getSentEmailsLog() {
        return sentEmailsLog;
    }

    public List<String> getAuditLog() {
        return auditLog;
    }
}

```

#### 4. Code Smells Checklist
На этапе диагностики кода кандидат должен указать четыре фундаментальных нарушения принципов чистого кода и SOLID. Главное нарушение — игнорирование Принципа единственной ответственности (SRP Violation): класс `UserAccountLifecycleManager` совмещает как минимум четыре ортогональных актора и причины для модификации — правила валидации учетных записей, криптографический алгоритм хэширования паролей (`SHA-256` со статической солью), внутреннюю структуру хранения данных (`Map<String, AccountRecord>`) и верстку HTML-шаблонов писем. Вторая проблема — квадратичная сложность конкатенации строк в циклах (`+=` inside loop): побайтовое формирование шестнадцатеричной строки `hex += String.format("%02x", b)` и списка ролей `roleListHtml += ...` порождает аллокацию временных строк со сложностью $O(n^2)$ вместо использования нативного `HexFormat.of().formatHex(digest)` и `Collectors.joining()`.
Третий дефект выражен в нарушении Принципа инверсии зависимостей (DIP Violation): высокоуровневый сервис управления жизненным циклом аккаунта жестко привязан к низкоуровневым `HashMap` и `ArrayList`, что не позволяет внедрить моки в изолированных модульных тестах или подключить реляционную БД без переписывания бизнес-методов. Четвертый запах — возврат прямых ссылок на внутренние изменяемые списки в геттерах `getSentEmailsLog()` и `getAuditLog()`, что позволяет внешнему коду очистить журнал аудита.

#### 5. Pin-Down Test Suite
Характеризующий тестовый набор проверяет создание, активацию и деактивацию аккаунта, детерминированный SHA-256 хэш, формат сгенерированного HTML-письма и записи в журнале аудита.

```java
package com.interview.refactoring.l0.account;

import com.interview.refactoring.l0.account.UserAccountLifecycleManager.AccountRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserAccountLifecycleManagerTest {

    private UserAccountLifecycleManager manager;

    @BeforeEach
    void setUp() {
        manager = new UserAccountLifecycleManager();
    }

    @Test
    @DisplayName("Should create account, compute SHA-256 hash, send welcome HTML email, and write audit log")
    void shouldCreateAndActivateAccountSuccessfully() {
        String hash = manager.createAndActivateAccount(
                "  JohnDoe ",
                " John.Doe@Example.com ",
                "SecretPass123!",
                List.of("ADMIN", "EDITOR")
        );

        assertThat(hash).hasSize(64).matches("^[0-9a-f]{64}$");

        AccountRecord saved = manager.findAccount("johndoe");
        assertThat(saved).isNotNull();
        assertThat(saved.username).isEqualTo("johndoe");
        assertThat(saved.email).isEqualTo("john.doe@example.com");
        assertThat(saved.active).isTrue();
        assertThat(saved.roles).containsExactly("ADMIN", "EDITOR");

        assertThat(manager.getSentEmailsLog()).containsExactly(
                "TO:john.doe@example.com|BODY:<html><body><h1>Welcome, johndoe!</h1>"
                        + "<p>Your assigned roles:</p><ul><li>ADMIN</li><li>EDITOR</li></ul></body></html>"
        );
        assertThat(manager.getAuditLog()).containsExactly(
                "AUDIT: Created active account for user=johndoe with roles=2"
        );
    }

    @Test
    @DisplayName("Should assign default USER role when roles list is null or empty")
    void shouldAssignDefaultRoleWhenRolesEmpty() {
        manager.createAndActivateAccount("alice", "alice@test.io", "ValidPass99", null);
        AccountRecord saved = manager.findAccount("alice");
        assertThat(saved.roles).containsExactly("USER");
    }

    @Test
    @DisplayName("Should deactivate existing account and record notification and audit entry")
    void shouldDeactivateExistingAccount() {
        manager.createAndActivateAccount("bob", "bob@test.io", "ValidPass99", List.of("USER"));
        manager.deactivateAccount(" BOB ", "Policy violation");

        AccountRecord saved = manager.findAccount("bob");
        assertThat(saved.active).isFalse();
        assertThat(manager.getSentEmailsLog()).hasSize(2)
                .last().asString()
                .isEqualTo("TO:bob@test.io|BODY:<html><body><h1>Account Deactivated</h1><p>Reason: Policy violation</p></body></html>");
        assertThat(manager.getAuditLog()).hasSize(2)
                .last().asString()
                .isEqualTo("AUDIT: Deactivated account for user=bob reason=Policy violation");
    }

    @Test
    @DisplayName("Should enforce validation constraints and duplicate username check")
    void shouldEnforceValidationAndUniqueness() {
        assertThatThrownBy(() -> manager.createAndActivateAccount("ab", "a@b.c", "12345678", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 3 characters");

        assertThatThrownBy(() -> manager.createAndActivateAccount("valid", "invalid", "12345678", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid email");

        assertThatThrownBy(() -> manager.createAndActivateAccount("valid", "a@b.c", "short", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 8 characters");

        manager.createAndActivateAccount("uniqueUser", "u@b.c", "12345678", null);
        assertThatThrownBy(() -> manager.createAndActivateAccount("UNIQUEUSER", "u2@b.c", "12345678", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Account already exists: uniqueuser");

        assertThatThrownBy(() -> manager.deactivateAccount("ghost", "N/A"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Account not found: ghost");
    }
}

```

#### 6. Refactored Clean Code
В рефакторинге на Java 21 LTS обязанности разделены между сфокусированными интерфейсами (`PasswordHasher`, `AccountRepository`, `AccountNotificationService`, `SecurityAuditLogger`), внедряемыми через конструктор. Конструктор по умолчанию сохраняет обратную совместимость с существующими тестами, а конкатенация в циклах заменена на `HexFormat.of().formatHex(...)` и `Collectors.joining()`.

```java
package com.interview.refactoring.l0.account;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class UserAccountLifecycleManager {

    public static class AccountRecord {
        public String username;
        public String email;
        public String passwordHash;
        public boolean active;
        public List<String> roles;

        public AccountRecord(String username, String email, String passwordHash, boolean active, List<String> roles) {
            this.username = username;
            this.email = email;
            this.passwordHash = passwordHash;
            this.active = active;
            this.roles = List.copyOf(roles);
        }
    }

    public interface PasswordHasher {
        String hash(String rawPassword);
    }

    public interface AccountRepository {
        boolean existsByUsername(String username);
        void save(AccountRecord account);
        Optional<AccountRecord> findByUsername(String username);
    }

    public interface AccountNotificationService {
        void sendWelcomeEmail(AccountRecord account);
        void sendDeactivationEmail(AccountRecord account, String reason);
        List<String> getSentEmailsLog();
    }

    public interface SecurityAuditLogger {
        void logAccountCreated(String username, int roleCount);
        void logAccountDeactivated(String username, String reason);
        List<String> getAuditLog();
    }

    public static final class Sha256SaltedPasswordHasher implements PasswordHasher {
        private static final String STATIC_SALT = "STATIC_SALT_";
        private static final HexFormat HEX_FORMAT = HexFormat.of();

        @Override
        public String hash(String rawPassword) {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] digest = md.digest((STATIC_SALT + rawPassword).getBytes(StandardCharsets.UTF_8));
                return HEX_FORMAT.formatHex(digest);
            } catch (NoSuchAlgorithmException e) {
                throw new IllegalStateException("Hashing error", e);
            }
        }
    }

    public static final class InMemoryAccountRepository implements AccountRepository {
        private final Map<String, AccountRecord> storage = new HashMap<>();

        @Override
        public boolean existsByUsername(String username) {
            return storage.containsKey(username);
        }

        @Override
        public void save(AccountRecord account) {
            storage.put(account.username, account);
        }

        @Override
        public Optional<AccountRecord> findByUsername(String username) {
            return Optional.ofNullable(storage.get(username));
        }
    }

    public static final class HtmlEmailNotificationService implements AccountNotificationService {
        private final List<String> sentEmails = new ArrayList<>();

        @Override
        public void sendWelcomeEmail(AccountRecord account) {
            String roleItems = account.roles.stream()
                    .map(role -> "<li>" + role + "</li>")
                    .collect(Collectors.joining());
            String html = "<html><body><h1>Welcome, " + account.username + "!</h1>"
                    + "<p>Your assigned roles:</p><ul>" + roleItems + "</ul></body></html>";
            sentEmails.add("TO:" + account.email + "|BODY:" + html);
        }

        @Override
        public void sendDeactivationEmail(AccountRecord account, String reason) {
            String html = "<html><body><h1>Account Deactivated</h1><p>Reason: " + reason + "</p></body></html>";
            sentEmails.add("TO:" + account.email + "|BODY:" + html);
        }

        @Override
        public List<String> getSentEmailsLog() {
            return List.copyOf(sentEmails);
        }
    }

    public static final class InMemorySecurityAuditLogger implements SecurityAuditLogger {
        private final List<String> entries = new ArrayList<>();

        @Override
        public void logAccountCreated(String username, int roleCount) {
            entries.add("AUDIT: Created active account for user=" + username + " with roles=" + roleCount);
        }

        @Override
        public void logAccountDeactivated(String username, String reason) {
            entries.add("AUDIT: Deactivated account for user=" + username + " reason=" + reason);
        }

        @Override
        public List<String> getAuditLog() {
            return List.copyOf(entries);
        }
    }

    private final PasswordHasher passwordHasher;
    private final AccountRepository accountRepository;
    private final AccountNotificationService notificationService;
    private final SecurityAuditLogger auditLogger;

    public UserAccountLifecycleManager() {
        this(
                new Sha256SaltedPasswordHasher(),
                new InMemoryAccountRepository(),
                new HtmlEmailNotificationService(),
                new InMemorySecurityAuditLogger()
        );
    }

    public UserAccountLifecycleManager(
            PasswordHasher passwordHasher,
            AccountRepository accountRepository,
            AccountNotificationService notificationService,
            SecurityAuditLogger auditLogger) {
        this.passwordHasher = passwordHasher;
        this.accountRepository = accountRepository;
        this.notificationService = notificationService;
        this.auditLogger = auditLogger;
    }

    public String createAndActivateAccount(String username, String email, String rawPassword, List<String> roles) {
        String normalizedUser = validateAndNormalizeUsername(username);
        String normalizedEmail = validateAndNormalizeEmail(email);
        validatePassword(rawPassword);

        if (accountRepository.existsByUsername(normalizedUser)) {
            throw new IllegalStateException("Account already exists: " + normalizedUser);
        }

        String passwordHash = passwordHasher.hash(rawPassword);
        List<String> resolvedRoles = (roles == null || roles.isEmpty()) ? List.of("USER") : List.copyOf(roles);

        AccountRecord record = new AccountRecord(normalizedUser, normalizedEmail, passwordHash, true, resolvedRoles);
        accountRepository.save(record);
        notificationService.sendWelcomeEmail(record);
        auditLogger.logAccountCreated(normalizedUser, resolvedRoles.size());

        return passwordHash;
    }

    public void deactivateAccount(String username, String reason) {
        if (username == null) {
            throw new IllegalArgumentException("Username required");
        }
        String normalizedUser = username.trim().toLowerCase(Locale.ROOT);
        AccountRecord existing = accountRepository.findByUsername(normalizedUser)
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + normalizedUser));

        existing.active = false;
        accountRepository.save(existing);
        notificationService.sendDeactivationEmail(existing, reason);
        auditLogger.logAccountDeactivated(normalizedUser, reason);
    }

    public AccountRecord findAccount(String username) {
        return accountRepository.findByUsername(username.trim().toLowerCase(Locale.ROOT)).orElse(null);
    }

    public List<String> getSentEmailsLog() {
        return notificationService.getSentEmailsLog();
    }

    public List<String> getAuditLog() {
        return auditLogger.getAuditLog();
    }

    private String validateAndNormalizeUsername(String username) {
        if (username == null || username.trim().length() < 3) {
            throw new IllegalArgumentException("Username must be at least 3 characters");
        }
        return username.trim().toLowerCase(Locale.ROOT);
    }

    private String validateAndNormalizeEmail(String email) {
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email address");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
    }
}

```

#### 7. Interview Follow-Up Questions
Первый вопрос проверяет понимание работы компилятора со строками (JEP 280 vs Loops): правда ли, что в современных версиях Java оператор `+` компилируется в `invokedynamic` (`StringConcatFactory`), и поэтому `hex += String.format(...)` внутри цикла больше не несет накладных расходов? Одиночное выражение конкатенации действительно транслируется в `invokedynamic` (JEP 280) без явного создания `StringBuilder`, однако внутри цикла оператор `+=` на каждой итерации аллоцирует новый объект `String` и копирует весь ранее накопленный массив байтов, сохраняя квадратичную сложность $O(n^2)$. Поэтому в циклах обязательно применение `StringBuilder`, `Collectors.joining()` или специализированного `HexFormat`.
Второй вопрос оценивает понимание потокобезопасности стандартных классов: если зарегистрировать `UserAccountLifecycleManager` как синглтон-бин в Spring, какие проблемы конкурентного доступа возникнут в `InMemoryAccountRepository` и можно ли сделать экземпляр `MessageDigest` общим `static final` полем? Коллекции `HashMap` и `ArrayList` не являются потокобезопасными (при одновременной проверке `existsByUsername` и записи `save` возникнет состояние гонки Check-Then-Act и повреждение корзины хэш-таблицы, поэтому необходим `ConcurrentHashMap` с атомарным `putIfAbsent` или `compute`). Класс `MessageDigest` также хранит мутабельное внутреннее состояние расчета дайджеста и **не потокобезопасен**, поэтому его нельзя разделять между потоками без `ThreadLocal` или инстанциирования на каждый вызов.
Третий вопрос касается криптографической стойкости: почему даже после выделения интерфейса `PasswordHasher` реализация `Sha256SaltedPasswordHasher` со статической солью уязвима в продакшене? Быстрый алгоритм `SHA-256` в сочетании с единой статической солью позволяет злоумышленнику при утечке БД перебирать пароли со скоростью миллиардов хэшей в секунду на GPU и атаковать сразу всю базу пользователей; в промышленной разработке интерфейс `PasswordHasher` должен скрывать адаптивный алгоритм с индивидуальной случайной солью (`Argon2id` или `BCrypt`).

### [L1-REF-06] E-Commerce Order Fulfillment Orchestrator (Hexagonal Port Extraction, Transaction Boundaries & Spring Boot 3.4 `@MockitoBean`)

#### 1. Title & Grade
Задача **[L1-REF-06] E-Commerce Order Fulfillment Orchestrator (Hexagonal Port Extraction, Transaction Boundaries & Spring Boot 3.4 `@MockitoBean`)** калибрована на уровень **Middle Specialist (L1)**.

#### 2. Company Context
Это продвинутая задача рефакторинга для уровня Middle в высоконагруженном ритейле и фулфилменте (Ozon Core, Яндекс Лавка, Amazon Fulfillment, Купер). Она проверяет способность кандидата декомпозировать спагетти-оркестратор оформления заказа (резервирование стока, списание средств, генерация трек-номера, компенсация при сбое), моделировать результат операции через запечатанный тип `FulfillmentOutcome` (`sealed interface`) и тестировать сервис в контексте Spring Boot 3.4+ с использованием новой аннотации `@MockitoBean`.

#### 3. The "Dirty" Code (80–180 lines)
Класс `OrderFulfillmentSpaghetti` смешивает работу с внешними подсистемами, компенсационную логику отката резерва, форматирование чеков и обработку кодов ошибок в одном методе.

```java
package com.interview.refactoring.l1.fulfillment;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class OrderFulfillmentSpaghetti {

    public static class OrderItemRequest {
        public String sku;
        public int qty;
        public BigDecimal price;

        public OrderItemRequest(String sku, int qty, BigDecimal price) {
            this.sku = sku;
            this.qty = qty;
            this.price = price;
        }
    }

    // Simulated external state directly embedded inside the orchestrator
    private final Map<String, Integer> warehouseStock = new HashMap<>();
    private final Map<String, String> paymentTokens = new HashMap<>();
    private final List<String> dispatchedShipments = new ArrayList<>();
    private final List<String> compensationLog = new ArrayList<>();

    public OrderFulfillmentSpaghetti() {
        warehouseStock.put("SKU-IPHONE", 5);
        warehouseStock.put("SKU-CASE", 20);
        warehouseStock.put("SKU-CABLE", 0);
        paymentTokens.put("TOK-VALID", "APPROVED");
        paymentTokens.put("TOK-DECLINED", "INSUFFICIENT_FUNDS");
        paymentTokens.put("TOK-TIMEOUT", "GATEWAY_TIMEOUT");
    }

    /**
     * Returns string-encoded status:
     * "SUCCESS:<orderId>:<trackingNumber>:<totalPaid>"
     * or "FAILED:<reasonCode>:<detail>"
     */
    public String fulfillOrder(
            String orderId,
            String customerId,
            String paymentToken,
            String shippingAddress,
            List<OrderItemRequest> items) {

        if (orderId == null || orderId.isBlank() || customerId == null || customerId.isBlank()) {
            return "FAILED:VALIDATION_ERROR:Missing orderId or customerId";
        }
        if (shippingAddress == null || shippingAddress.trim().length() < 5) {
            return "FAILED:VALIDATION_ERROR:Invalid shipping address";
        }
        if (items == null || items.isEmpty()) {
            return "FAILED:VALIDATION_ERROR:Order items cannot be empty";
        }

        // Step 1: Check and deduct stock in warehouse
        List<OrderItemRequest> reservedItems = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (OrderItemRequest item : items) {
            if (item.qty <= 0 || item.price == null || item.price.compareTo(BigDecimal.ZERO) <= 0) {
                // Rollback already reserved items!
                for (OrderItemRequest reserved : reservedItems) {
                    warehouseStock.put(reserved.sku, warehouseStock.get(reserved.sku) + reserved.qty);
                }
                return "FAILED:VALIDATION_ERROR:Invalid quantity or price for " + item.sku;
            }
            Integer available = warehouseStock.getOrDefault(item.sku, 0);
            if (available < item.qty) {
                for (OrderItemRequest reserved : reservedItems) {
                    warehouseStock.put(reserved.sku, warehouseStock.get(reserved.sku) + reserved.qty);
                }
                return "FAILED:OUT_OF_STOCK:" + item.sku;
            }
            warehouseStock.put(item.sku, available - item.qty);
            reservedItems.add(item);
            totalAmount = totalAmount.add(item.price.multiply(BigDecimal.valueOf(item.qty)));
        }

        // Step 2: Charge payment gateway
        String paymentResult = paymentTokens.getOrDefault(paymentToken, "UNKNOWN_TOKEN");
        if (!"APPROVED".equals(paymentResult)) {
            // Compensate inventory reservation
            for (OrderItemRequest reserved : reservedItems) {
                warehouseStock.put(reserved.sku, warehouseStock.get(reserved.sku) + reserved.qty);
            }
            compensationLog.add("COMPENSATED_STOCK:" + orderId + ":REASON=" + paymentResult);
            return "FAILED:PAYMENT_REJECTED:" + paymentResult;
        }

        // Step 3: Register shipment dispatch
        if (shippingAddress.contains("RESTRICTED_ZONE")) {
            // Compensate both payment and inventory!
            for (OrderItemRequest reserved : reservedItems) {
                warehouseStock.put(reserved.sku, warehouseStock.get(reserved.sku) + reserved.qty);
            }
            compensationLog.add("REFUNDED_PAYMENT:" + orderId + ":AMOUNT=" + totalAmount);
            compensationLog.add("COMPENSATED_STOCK:" + orderId + ":REASON=SHIPPING_RESTRICTED");
            return "FAILED:SHIPPING_REJECTED:RESTRICTED_ZONE";
        }

        String trackingNumber = "TRK-" + orderId.toUpperCase() + "-" + reservedItems.size();
        dispatchedShipments.add(trackingNumber + "->" + shippingAddress.trim());

        return "SUCCESS:" + orderId + ":" + trackingNumber + ":" + totalAmount;
    }

    public int getAvailableStock(String sku) {
        return warehouseStock.getOrDefault(sku, 0);
    }

    public List<String> getDispatchedShipments() {
        return dispatchedShipments;
    }

    public List<String> getCompensationLog() {
        return compensationLog;
    }
}

```

#### 4. Code Smells Checklist
На этапе ревью этого класса от специалиста уровня L1 ожидается выявление четырех глубоких архитектурных проблем. Первая проблема — спагетти-оркестрация и четырехкратное дублирование компенсирующего цикла возврата товаров на склад (Saga Rollback Duplication): ручной цикл `for (OrderItemRequest reserved : reservedItems)` повторяется при ошибке валидации строки, при нехватке товара, при отказе платежного шлюза и при запрете зоны доставки. Вторая проблема заключается в смешении чистой валидации входных данных с мутацией состояния (Interleaved Validation and State Mutation): проверка `item.qty <= 0` выполняется прямо внутри цикла списания остатков `warehouseStock`, из-за чего ошибка во второй позиции корзины требует отката уже измененного состояния первой позиции.
Третий запах — строковое кодирование протокола ответа (`"SUCCESS:..."` и `"FAILED:..."`) вместо использования запечатанного алгебраического типа результата (`sealed interface FulfillmentOutcome`), что вынуждает клиентов парсить строки по разделителю `:` и лишает систему компиляторной проверки полноты обработки ошибок. Четвертая проблема состоит в отсутствии выделенных портов инфраструктурных подсистем (`InventoryPort`, `PaymentPort`, `ShippingPort`), что препятствует тестированию сценариев отказа с помощью `@MockitoBean` в Spring Boot 3.4.

#### 5. Pin-Down Test Suite
Приведенный ниже тестовый набор верифицирует существующий контракт `fulfillOrder` (включая откат остатков на складе и возврат платежа при отказе доставки), создавая надежную базу перед выделением гексагональных портов.

```java
package com.interview.refactoring.l1.fulfillment;

import com.interview.refactoring.l1.fulfillment.OrderFulfillmentSpaghetti.OrderItemRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OrderFulfillmentSpaghettiTest {

    private OrderFulfillmentSpaghetti orchestrator;

    @BeforeEach
    void setUp() {
        orchestrator = new OrderFulfillmentSpaghetti();
    }

    @Test
    @DisplayName("Should deduct stock, approve payment, and generate tracking number on happy path")
    void shouldFulfillOrderSuccessfully() {
        List<OrderItemRequest> items = List.of(
                new OrderItemRequest("SKU-IPHONE", 2, new BigDecimal("999.00")),
                new OrderItemRequest("SKU-CASE", 1, new BigDecimal("49.00"))
        );

        String response = orchestrator.fulfillOrder(
                "ord-101", "cust-1", "TOK-VALID", "Berlin, Alexanderplatz 1", items);

        assertThat(response).isEqualTo("SUCCESS:ord-101:TRK-ORD-101-2:2047.00");
        assertThat(orchestrator.getAvailableStock("SKU-IPHONE")).isEqualTo(3);
        assertThat(orchestrator.getAvailableStock("SKU-CASE")).isEqualTo(19);
        assertThat(orchestrator.getDispatchedShipments())
                .containsExactly("TRK-ORD-101-2->Berlin, Alexanderplatz 1");
        assertThat(orchestrator.getCompensationLog()).isEmpty();
    }

    @Test
    @DisplayName("Should rollback first item stock when second item is out of stock")
    void shouldRollbackPreviouslyReservedStockWhenSubsequentItemOutOfStock() {
        List<OrderItemRequest> items = List.of(
                new OrderItemRequest("SKU-IPHONE", 2, new BigDecimal("999.00")),
                new OrderItemRequest("SKU-CABLE", 1, new BigDecimal("19.00"))
        );

        String response = orchestrator.fulfillOrder(
                "ord-102", "cust-1", "TOK-VALID", "Berlin, Main St 10", items);

        assertThat(response).isEqualTo("FAILED:OUT_OF_STOCK:SKU-CABLE");
        assertThat(orchestrator.getAvailableStock("SKU-IPHONE")).isEqualTo(5);
    }

    @Test
    @DisplayName("Should compensate reserved stock when payment gateway rejects token")
    void shouldCompensateStockWhenPaymentDeclined() {
        List<OrderItemRequest> items = List.of(
                new OrderItemRequest("SKU-IPHONE", 1, new BigDecimal("999.00"))
        );

        String response = orchestrator.fulfillOrder(
                "ord-103", "cust-1", "TOK-DECLINED", "Munich, Marienplatz 2", items);

        assertThat(response).isEqualTo("FAILED:PAYMENT_REJECTED:INSUFFICIENT_FUNDS");
        assertThat(orchestrator.getAvailableStock("SKU-IPHONE")).isEqualTo(5);
        assertThat(orchestrator.getCompensationLog())
                .containsExactly("COMPENSATED_STOCK:ord-103:REASON=INSUFFICIENT_FUNDS");
    }

    @Test
    @DisplayName("Should refund payment and restore stock when shipping address is in restricted zone")
    void shouldCompensatePaymentAndStockOnShippingRejection() {
        List<OrderItemRequest> items = List.of(
                new OrderItemRequest("SKU-CASE", 2, new BigDecimal("25.00"))
        );

        String response = orchestrator.fulfillOrder(
                "ord-104", "cust-1", "TOK-VALID", "RESTRICTED_ZONE Sector 9", items);

        assertThat(response).isEqualTo("FAILED:SHIPPING_REJECTED:RESTRICTED_ZONE");
        assertThat(orchestrator.getAvailableStock("SKU-CASE")).isEqualTo(20);
        assertThat(orchestrator.getCompensationLog()).containsExactly(
                "REFUNDED_PAYMENT:ord-104:AMOUNT=50.00",
                "COMPENSATED_STOCK:ord-104:REASON=SHIPPING_RESTRICTED"
        );
    }
}

```

#### 6. Refactored Clean Code
В рефакторинге на Java 21 LTS и Spring Boot 3.4 выделены гексагональные порты (`InventoryPort`, `PaymentPort`, `ShippingPort`), предварительная чистая валидация отделена от фазы мутации состояния, а результат моделируется через запечатанный интерфейс `FulfillmentOutcome` (`sealed interface` + `record` деконструкция).

```java
package com.interview.refactoring.l1.fulfillment;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class OrderFulfillmentSpaghetti {

    public static class OrderItemRequest {
        public final String sku;
        public final int qty;
        public final BigDecimal price;

        public OrderItemRequest(String sku, int qty, BigDecimal price) {
            this.sku = sku;
            this.qty = qty;
            this.price = price;
        }

        public BigDecimal lineTotal() {
            return price.multiply(BigDecimal.valueOf(qty));
        }
    }

    public sealed interface FulfillmentOutcome
            permits FulfillmentOutcome.Success, FulfillmentOutcome.Failure {

        record Success(String orderId, String trackingNumber, BigDecimal totalPaid) implements FulfillmentOutcome {}
        record Failure(String errorCode, String detail) implements FulfillmentOutcome {}

        default String toLegacyWireFormat() {
            return switch (this) {
                case Success(String id, String trk, BigDecimal total) ->
                        "SUCCESS:" + id + ":" + trk + ":" + total;
                case Failure(String code, String detail) ->
                        "FAILED:" + code + ":" + detail;
            };
        }
    }

    public sealed interface ReservationResult permits ReservationResult.Reserved, ReservationResult.OutOfStock {
        record Reserved(List<OrderItemRequest> items, BigDecimal totalAmount) implements ReservationResult {}
        record OutOfStock(String missingSku) implements ReservationResult {}
    }

    public sealed interface PaymentResult permits PaymentResult.Approved, PaymentResult.Rejected {
        record Approved() implements PaymentResult {}
        record Rejected(String reason) implements PaymentResult {}
    }

    public sealed interface ShippingResult permits ShippingResult.Dispatched, ShippingResult.Rejected {
        record Dispatched(String trackingNumber) implements ShippingResult {}
        record Rejected(String reason) implements ShippingResult {}
    }

    public interface InventoryPort {
        ReservationResult reserveAllOrNone(List<OrderItemRequest> items);
        void releaseReservation(String orderId, List<OrderItemRequest> items, String reason);
        int getAvailableStock(String sku);
    }

    public interface PaymentPort {
        PaymentResult charge(String orderId, String paymentToken, BigDecimal amount);
        void refund(String orderId, BigDecimal amount);
    }

    public interface ShippingPort {
        ShippingResult dispatch(String orderId, String address, int itemCount);
        List<String> getDispatchedShipments();
    }

    public static final class InMemoryFulfillmentAdapters
            implements InventoryPort, PaymentPort, ShippingPort {

        private final Map<String, Integer> warehouseStock = new HashMap<>();
        private final Map<String, String> paymentTokens = new HashMap<>();
        private final List<String> dispatchedShipments = new ArrayList<>();
        private final List<String> compensationLog = new ArrayList<>();

        public InMemoryFulfillmentAdapters() {
            warehouseStock.put("SKU-IPHONE", 5);
            warehouseStock.put("SKU-CASE", 20);
            warehouseStock.put("SKU-CABLE", 0);
            paymentTokens.put("TOK-VALID", "APPROVED");
            paymentTokens.put("TOK-DECLINED", "INSUFFICIENT_FUNDS");
            paymentTokens.put("TOK-TIMEOUT", "GATEWAY_TIMEOUT");
        }

        @Override
        public ReservationResult reserveAllOrNone(List<OrderItemRequest> items) {
            for (OrderItemRequest item : items) {
                if (warehouseStock.getOrDefault(item.sku, 0) < item.qty) {
                    return new ReservationResult.OutOfStock(item.sku);
                }
            }
            BigDecimal total = BigDecimal.ZERO;
            for (OrderItemRequest item : items) {
                warehouseStock.put(item.sku, warehouseStock.get(item.sku) - item.qty);
                total = total.add(item.lineTotal());
            }
            return new ReservationResult.Reserved(List.copyOf(items), total);
        }

        @Override
        public void releaseReservation(String orderId, List<OrderItemRequest> items, String reason) {
            for (OrderItemRequest item : items) {
                warehouseStock.put(item.sku, warehouseStock.getOrDefault(item.sku, 0) + item.qty);
            }
            compensationLog.add("COMPENSATED_STOCK:" + orderId + ":REASON=" + reason);
        }

        @Override
        public int getAvailableStock(String sku) {
            return warehouseStock.getOrDefault(sku, 0);
        }

        @Override
        public PaymentResult charge(String orderId, String paymentToken, BigDecimal amount) {
            String status = paymentTokens.getOrDefault(paymentToken, "UNKNOWN_TOKEN");
            return "APPROVED".equals(status)
                    ? new PaymentResult.Approved()
                    : new PaymentResult.Rejected(status);
        }

        @Override
        public void refund(String orderId, BigDecimal amount) {
            compensationLog.add("REFUNDED_PAYMENT:" + orderId + ":AMOUNT=" + amount);
        }

        @Override
        public ShippingResult dispatch(String orderId, String address, int itemCount) {
            if (address.contains("RESTRICTED_ZONE")) {
                return new ShippingResult.Rejected("RESTRICTED_ZONE");
            }
            String tracking = "TRK-" + orderId.toUpperCase(Locale.ROOT) + "-" + itemCount;
            dispatchedShipments.add(tracking + "->" + address.trim());
            return new ShippingResult.Dispatched(tracking);
        }

        @Override
        public List<String> getDispatchedShipments() {
            return List.copyOf(dispatchedShipments);
        }

        public List<String> getCompensationLog() {
            return List.copyOf(compensationLog);
        }
    }

    private final InventoryPort inventoryPort;
    private final PaymentPort paymentPort;
    private final ShippingPort shippingPort;
    private final InMemoryFulfillmentAdapters defaultAdapters;

    public OrderFulfillmentSpaghetti() {
        this.defaultAdapters = new InMemoryFulfillmentAdapters();
        this.inventoryPort = defaultAdapters;
        this.paymentPort = defaultAdapters;
        this.shippingPort = defaultAdapters;
    }

    public OrderFulfillmentSpaghetti(InventoryPort inventoryPort, PaymentPort paymentPort, ShippingPort shippingPort) {
        this.defaultAdapters = null;
        this.inventoryPort = inventoryPort;
        this.paymentPort = paymentPort;
        this.shippingPort = shippingPort;
    }

    public String fulfillOrder(
            String orderId,
            String customerId,
            String paymentToken,
            String shippingAddress,
            List<OrderItemRequest> items) {
        return executeFulfillment(orderId, customerId, paymentToken, shippingAddress, items)
                .toLegacyWireFormat();
    }

    public FulfillmentOutcome executeFulfillment(
            String orderId,
            String customerId,
            String paymentToken,
            String shippingAddress,
            List<OrderItemRequest> items) {

        FulfillmentOutcome.Failure validationFailure = validateRequest(orderId, customerId, shippingAddress, items);
        if (validationFailure != null) {
            return validationFailure;
        }

        return switch (inventoryPort.reserveAllOrNone(items)) {
            case ReservationResult.OutOfStock(String sku) ->
                    new FulfillmentOutcome.Failure("OUT_OF_STOCK", sku);
            case ReservationResult.Reserved(List<OrderItemRequest> reserved, BigDecimal total) ->
                    processPaymentAndShipping(orderId, paymentToken, shippingAddress, reserved, total);
        };
    }

    private FulfillmentOutcome processPaymentAndShipping(
            String orderId,
            String paymentToken,
            String shippingAddress,
            List<OrderItemRequest> reserved,
            BigDecimal total) {

        return switch (paymentPort.charge(orderId, paymentToken, total)) {
            case PaymentResult.Rejected(String reason) -> {
                inventoryPort.releaseReservation(orderId, reserved, reason);
                yield new FulfillmentOutcome.Failure("PAYMENT_REJECTED", reason);
            }
            case PaymentResult.Approved _ -> switch (shippingPort.dispatch(orderId, shippingAddress, reserved.size())) {
                case ShippingResult.Rejected(String reason) -> {
                    paymentPort.refund(orderId, total);
                    inventoryPort.releaseReservation(orderId, reserved, "SHIPPING_RESTRICTED");
                    yield new FulfillmentOutcome.Failure("SHIPPING_REJECTED", reason);
                }
                case ShippingResult.Dispatched(String tracking) ->
                        new FulfillmentOutcome.Success(orderId, tracking, total);
            };
        };
    }

    private FulfillmentOutcome.Failure validateRequest(
            String orderId, String customerId, String shippingAddress, List<OrderItemRequest> items) {
        if (orderId == null || orderId.isBlank() || customerId == null || customerId.isBlank()) {
            return new FulfillmentOutcome.Failure("VALIDATION_ERROR", "Missing orderId or customerId");
        }
        if (shippingAddress == null || shippingAddress.trim().length() < 5) {
            return new FulfillmentOutcome.Failure("VALIDATION_ERROR", "Invalid shipping address");
        }
        if (items == null || items.isEmpty()) {
            return new FulfillmentOutcome.Failure("VALIDATION_ERROR", "Order items cannot be empty");
        }
        for (OrderItemRequest item : items) {
            if (item.qty <= 0 || item.price == null || item.price.compareTo(BigDecimal.ZERO) <= 0) {
                return new FulfillmentOutcome.Failure("VALIDATION_ERROR", "Invalid quantity or price for " + item.sku);
            }
        }
        return null;
    }

    public int getAvailableStock(String sku) {
        return inventoryPort.getAvailableStock(sku);
    }

    public List<String> getDispatchedShipments() {
        return shippingPort.getDispatchedShipments();
    }

    public List<String> getCompensationLog() {
        return defaultAdapters != null ? defaultAdapters.getCompensationLog() : List.of();
    }
}

```

#### 7. Interview Follow-Up Questions
Первый вопрос проверяет знание актуальных изменений в тестировании Spring Boot 3.4 (`@MockitoBean` и `@MockitoSpyBean`): почему при миграции на Spring Boot 3.4+ аннотации `@MockBean` и `@SpyBean` объявлены устаревшими, чем они заменяются и с каким нюансом сталкиваются инженеры при использовании `@MockitoSpyBean` в срезовых тестах `@WebMvcTest`? В Spring Boot 3.4 аннотации из пакета `org.springframework.boot.test.mock.mockito` депрекейтированы (и полностью удалены в Spring Boot 4.0), а вместо них введены стандартные аннотации Spring Framework `@MockitoBean` и `@MockitoSpyBean`. При этом `@MockitoSpyBean` требует, чтобы целевой бин уже существовал в тестовом `ApplicationContext` (поэтому в `@WebMvcTest` его нужно явно импортировать через `@Import(MyBeanClass.class)`), тогда как старый `@SpyBean` автоматически создавал бин при его отсутствии.
Второй вопрос проверяет понимание границ транзакций БД и сетевого взаимодействия (`@Transactional` Trap): почему недопустимо вешать аннотацию `@Transactional` на весь метод `executeFulfillment`, если `paymentPort.charge(...)` и `shippingPort.dispatch(...)` выполняют синхронные HTTP-вызовы во внешние микросервисы? Удержание открытой транзакции базы данных на время внешнего сетевого запроса захватывает JDBC-соединение из пула `HikariCP` на десятки миллисекунд или секунд (вплоть до таймаута сокета), что при деградации платежного шлюза мгновенно приводит к исчерпанию пула соединений всего сервиса; кроме того, локальный откат транзакции БД не способен отменить уже совершенную внешнюю HTTP-операцию, поэтому требуется паттерн Saga с явными компенсирующими шагами (`paymentPort.refund`, `inventoryPort.releaseReservation`).
Третий вопрос исследует паттерн функциональной обработки ошибок через запечатанные типы (`Sealed Result` vs `Exceptions`): в чем преимущество возврата `sealed interface FulfillmentOutcome` перед выбрасыванием проверенных или непроверенных исключений для бизнес-отказов вроде `OUT_OF_STOCK`? Отказ из-за отсутствия товара или отклонения карты — это штатный, ожидаемый бизнес-сценарий, а не аварийный сбой среды выполнения; моделирование его через `sealed interface` устраняет затраты JVM на сбор стека вызовов (`Throwable.fillInStackTrace()`) и переносит проверку обработки всех ошибочных ветвей с уровня выполнения на этап компиляции.

## Архетип 1.4: Нетестируемый унаследованный код с жесткими зависимостями — Швы Майкла Фезерса (Seams) и инъекция времени
Унаследованный код наиболее сложен для тестирования тогда, когда бизнес-методы напрямую обращаются к глобальным статическим синглтонам (`UserSession.getInstance()`), вызывают статические методы DAO, инстанциируют тяжелые клиенты через оператор `new` внутри метода или используют системные часы (`System.currentTimeMillis()`, `LocalDateTime.now()`). В таких условиях любая попытка запустить модульный тест приводит к выбросу исключения (`CollaboratorCallException`), попытке реального сетевого соединения или флапающим (недетерминированным) тестам, зависящим от времени суток.
Согласно теории Майкла Фезерса, ключ к укрощению такого кода лежит в модели Шва (The Seam Model): шов — это место в программе, где можно изменить поведение без прямого редактирования исходного текста в этой точке. Каждый шов имеет точку активации (Seam Enabling Point), где принимается решение о том, какое именно поведение использовать — продакшен-зависимость или тестовый дублер. На собеседованиях уровней L0–L1 проверяются два фундаментальных объектных шва (Object Seams). Первый прием — выделение защищенного метода и переопределение в тестовом подклассе (Extract and Override Call / Subclass and Override Method), который применяется, когда необходимо покрыть класс характеризующими тестами с минимальным вмешательством до масштабного рефакторинга. Второй прием — шов через перегруженный конструктор (Overloaded Constructor Seam) в сочетании с инъекцией `java.time.Clock`, который сохраняет публичный конструктор по умолчанию для старых клиентов, но открывает типизированный конструктор для внедрения зависимостей и виртуальных часов (`Clock.fixed(...)`) в модульных тестах.

### [L0-REF-07] Social Travel Network Trip Service (Michael Feathers' Subclass-and-Override Seam & Singleton Decoupling)

#### 1. Title & Grade
Задача **[L0-REF-07] Social Travel Network Trip Service (Michael Feathers' Subclass-and-Override Seam & Singleton Decoupling)** ориентирована на уровень **Junior Foundation (L0)**.

#### 2. Company Context
Это всемирно известная каноническая ката рефакторинга (популяризированная Сандро Манкузо на основе работ Майкла Фезерса), активно применяемая на технических собеседованиях в Booking.com, Яндекс Путешествиях, Ostrovok и Aviasales. Она проверяет, знает ли кандидат, как покрыть модульными тестами класс, содержащий жесткие статические вызовы `UserSession.getInstance().getLoggedUser()` и `TripDAO.findTripsByUser(user)`, которые намеренно выбрасывают исключения при запуске вне продакшен-окружения.

#### 3. The "Dirty" Code (80–180 lines)
Ниже представлен полный код каты `TripServiceKata`, где `UserSession` и `TripDAO` блокируют прямое выполнение тестов, а сам метод `getTripsByUser` содержит глубокую вложенность и смешение обязанностей.

```java
package com.interview.refactoring.l0.trip;

import java.util.ArrayList;
import java.util.List;

public class TripServiceKata {

    public static class UserNotLoggedInException extends RuntimeException {
        public UserNotLoggedInException() {
            super("User is not logged in");
        }
    }

    public static class CollaboratorCallException extends RuntimeException {
        public CollaboratorCallException(String message) {
            super(message);
        }
    }

    public static class Trip {
        private final String destination;

        public Trip(String destination) {
            this.destination = destination;
        }

        public String getDestination() {
            return destination;
        }
    }

    public static class User {
        private final List<Trip> trips = new ArrayList<>();
        private final List<User> friends = new ArrayList<>();

        public List<User> getFriends() {
            return friends;
        }

        public void addFriend(User user) {
            friends.add(user);
        }

        public void addTrip(Trip trip) {
            trips.add(trip);
        }

        public List<Trip> trips() {
            return trips;
        }
    }

    public static class UserSession {
        private static final UserSession INSTANCE = new UserSession();

        private UserSession() {}

        public static UserSession getInstance() {
            return INSTANCE;
        }

        public User getLoggedUser() {
            throw new CollaboratorCallException(
                    "UserSession.getLoggedUser() should not be called in an unit test");
        }
    }

    public static class TripDAO {
        public static List<Trip> findTripsByUser(User user) {
            throw new CollaboratorCallException(
                    "TripDAO should not be invoked on an unit test.");
        }
    }

    public List<Trip> getTripsByUser(User user) throws UserNotLoggedInException {
        List<Trip> tripList = new ArrayList<Trip>();
        User loggedUser = UserSession.getInstance().getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) {
                    isFriend = true;
                    break;
                }
            }
            if (isFriend) {
                tripList = TripDAO.findTripsByUser(user);
            }
            return tripList;
        } else {
            throw new UserNotLoggedInException();
        }
    }
}

```

#### 4. Code Smells Checklist
При анализе `TripServiceKata` кандидат должен выделить четыре классических запаха унаследованного кода. Первым и главным препятствием выступает жесткая привязка к глобальному синглтону и статическому методу DAO («Once Dilemma» & Hardcoded Static Calls): вызовы `UserSession.getInstance().getLoggedUser()` и `TripDAO.findTripsByUser(user)` зашиты прямо в тело метода `getTripsByUser`, делая класс абсолютно нетестируемым без предварительного создания объектного шва (Object Seam). Второй запах — зависть к чужим данным (Feature Envy): цикл `for (User friend : user.getFriends())` внутри сервисного класса вручную итерирует внутреннюю коллекцию объекта `User`, вместо того чтобы делегировать проверку дружбы самому доменному объекту через `user.isFriendsWith(loggedUser)`.
Третья проблема связана с преждевременным выделением памяти и лишним мутабельным состоянием: пустой список `List<Trip> tripList = new ArrayList<Trip>()` создается в самой первой строке метода еще до проверки авторизации, хотя при `loggedUser == null` метод аварийно завершается исключением, а при отсутствии дружбы достаточно вернуть неизменяемый `List.of()`. Четвертый запах — перевернутое условие авторизации без сторожевого условия (Missing Guard Clause), где проверка `if (loggedUser != null)` оборачивает всю бизнес-логику метода, а `throw new UserNotLoggedInException()` скрыт в нижней ветке `else`.

#### 5. Pin-Down Test Suite
Для того чтобы разорвать зависимость на третьем шаге алгоритма Фезерса (Break dependencies), статические вызовы выносятся в защищенные методы `fetchLoggedUser()` и `findTripsFor(user)`, которые переопределяются в тестовом подклассе (`SeamTestableTripService`). После этого тесты также проверяют финальный рефакторинг с инъекцией зависимостей через конструктор и Mockito 5.

```java
package com.interview.refactoring.l0.trip;

import com.interview.refactoring.l0.trip.TripServiceKata.Trip;
import com.interview.refactoring.l0.trip.TripServiceKata.TripRepository;
import com.interview.refactoring.l0.trip.TripServiceKata.User;
import com.interview.refactoring.l0.trip.TripServiceKata.UserNotLoggedInException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripServiceKataTest {

    private static final User GUEST = null;
    private static final User LOGGED_IN_USER = new User();
    private static final User STRANGER = new User();
    private static final Trip TOKYO = new Trip("Tokyo");
    private static final Trip LISBON = new Trip("Lisbon");

    @Mock
    private TripRepository tripRepository;

    /**
     * Step 1 Seam Verification: Subclass and Override Method (Michael Feathers)
     */
    static class SeamTestableTripService extends TripServiceKata {
        private final User simulatedLoggedUser;

        SeamTestableTripService(User simulatedLoggedUser) {
            this.simulatedLoggedUser = simulatedLoggedUser;
        }

        @Override
        protected User fetchLoggedUser() {
            return simulatedLoggedUser;
        }

        @Override
        protected List<Trip> findTripsFor(User user) {
            return user.trips();
        }
    }

    @Test
    @DisplayName("Seam Test: Should throw UserNotLoggedInException when no user is logged in")
    void shouldThrowExceptionWhenUserIsNotLoggedInViaSeam() {
        TripServiceKata service = new SeamTestableTripService(GUEST);
        User targetUser = new User();

        assertThatThrownBy(() -> service.getTripsByUser(targetUser))
                .isInstanceOf(UserNotLoggedInException.class);
    }

    @Test
    @DisplayName("Seam Test: Should return empty list when logged user is not a friend")
    void shouldReturnNoTripsWhenUsersAreNotFriendsViaSeam() {
        TripServiceKata service = new SeamTestableTripService(LOGGED_IN_USER);
        User targetUser = new User();
        targetUser.addFriend(STRANGER);
        targetUser.addTrip(TOKYO);

        List<Trip> trips = service.getTripsByUser(targetUser);
        assertThat(trips).isEmpty();
    }

    @Test
    @DisplayName("Seam Test: Should return user trips when logged user is a friend")
    void shouldReturnFriendTripsWhenUsersAreFriendsViaSeam() {
        TripServiceKata service = new SeamTestableTripService(LOGGED_IN_USER);
        User targetUser = new User();
        targetUser.addFriend(STRANGER);
        targetUser.addFriend(LOGGED_IN_USER);
        targetUser.addTrip(TOKYO);
        targetUser.addTrip(LISBON);

        List<Trip> trips = service.getTripsByUser(targetUser);
        assertThat(trips).containsExactly(TOKYO, LISBON);
    }

    @Test
    @DisplayName("Refactored DI Test: Should query TripRepository only when target user is a friend")
    void shouldDelegateToTripRepositoryWhenUsersAreFriends() {
        TripServiceKata service = new TripServiceKata(tripRepository);
        User targetUser = new User();
        targetUser.addFriend(LOGGED_IN_USER);
        when(tripRepository.findTripsByUser(targetUser)).thenReturn(List.of(TOKYO));

        List<Trip> trips = service.getTripsByUser(targetUser, LOGGED_IN_USER);

        assertThat(trips).containsExactly(TOKYO);
        verify(tripRepository).findTripsByUser(targetUser);
    }

    @Test
    @DisplayName("Refactored DI Test: Should never touch TripRepository when users are not friends")
    void shouldNotCallRepositoryWhenNotFriends() {
        TripServiceKata service = new TripServiceKata(tripRepository);
        User targetUser = new User();

        List<Trip> trips = service.getTripsByUser(targetUser, LOGGED_IN_USER);

        assertThat(trips).isEmpty();
        verify(tripRepository, never()).findTripsByUser(targetUser);
    }
}

```

#### 6. Refactored Clean Code
Эталонное решение демонстрирует оба уровня эволюции по Фезерсу: сохранение защищенных методов-швов (`fetchLoggedUser`, `findTripsFor`) для обратной совместимости со старыми вызовами `getTripsByUser(User)`, перенос логики проверки дружбы в доменный метод `User.isFriendsWith(User)` и введение чистого конструктора с `TripRepository`.

```java
package com.interview.refactoring.l0.trip;

import java.util.ArrayList;
import java.util.List;

public class TripServiceKata {

    public static class UserNotLoggedInException extends RuntimeException {
        public UserNotLoggedInException() {
            super("User is not logged in");
        }
    }

    public static class CollaboratorCallException extends RuntimeException {
        public CollaboratorCallException(String message) {
            super(message);
        }
    }

    public static class Trip {
        private final String destination;

        public Trip(String destination) {
            this.destination = destination;
        }

        public String getDestination() {
            return destination;
        }
    }

    public static class User {
        private final List<Trip> trips = new ArrayList<>();
        private final List<User> friends = new ArrayList<>();

        public List<User> getFriends() {
            return List.copyOf(friends);
        }

        public void addFriend(User user) {
            friends.add(user);
        }

        public void addTrip(Trip trip) {
            trips.add(trip);
        }

        public List<Trip> trips() {
            return List.copyOf(trips);
        }

        public boolean isFriendsWith(User anotherUser) {
            return anotherUser != null && friends.contains(anotherUser);
        }
    }

    public static class UserSession {
        private static final UserSession INSTANCE = new UserSession();

        private UserSession() {}

        public static UserSession getInstance() {
            return INSTANCE;
        }

        public User getLoggedUser() {
            throw new CollaboratorCallException(
                    "UserSession.getLoggedUser() should not be called in an unit test");
        }
    }

    public static class TripDAO {
        public static List<Trip> findTripsByUser(User user) {
            throw new CollaboratorCallException(
                    "TripDAO should not be invoked on an unit test.");
        }
    }

    @FunctionalInterface
    public interface TripRepository {
        List<Trip> findTripsByUser(User user);
    }

    private final TripRepository tripRepository;

    public TripServiceKata() {
        this.tripRepository = this::findTripsFor;
    }

    public TripServiceKata(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    public List<Trip> getTripsByUser(User user) throws UserNotLoggedInException {
        return getTripsByUser(user, fetchLoggedUser());
    }

    public List<Trip> getTripsByUser(User user, User loggedUser) throws UserNotLoggedInException {
        if (loggedUser == null) {
            throw new UserNotLoggedInException();
        }
        return user.isFriendsWith(loggedUser)
                ? tripRepository.findTripsByUser(user)
                : List.of();
    }

    protected User fetchLoggedUser() {
        return UserSession.getInstance().getLoggedUser();
    }

    protected List<Trip> findTripsFor(User user) {
        return TripDAO.findTripsByUser(user);
    }
}

```

#### 7. Interview Follow-Up Questions
Первый вопрос проверяет знание дилеммы «Restricted Override» Майкла Фезерса: как поступить, если в унаследованном коде целевой класс `TripServiceKata` объявлен как `final` или вызываемый метод является `static`, что блокирует применение паттерна Subclass and Override Method? Если класс принадлежит нашей кодовой базе, снятие ключевого слова `final` и выделение однострочного `protected` метода является безопасной консервативной операцией перед написанием тестов. Если же `final`-класс находится в закрытой сторонней библиотеке, вокруг него создается тонкая адаптерная обертка (Wrapper / Facade) и внедряется через перегруженный конструктор (Overloaded Constructor Seam).
Второй вопрос исследует разницу жизненного цикла зависимостей: почему в рефакторинге `TripRepository` передается через конструктор `TripServiceKata(TripRepository)`, а `loggedUser` вынесен в аргумент метода `getTripsByUser(User user, User loggedUser)`? `TripRepository` является инфраструктурным компонентом со временем жизни синглтона приложения (Singleton Scope), тогда как `loggedUser` представляет контекст конкретного пользовательского запроса (Request Scope). Передача текущего пользователя явно в аргументе метода освобождает бизнес-логику от скрытой связности с `ThreadLocal` или статическим `UserSession`.
Третий вопрос проверяет инженерную зрелость при работе с инструментами мокирования: в Mockito 5 существует `Mockito.mockStatic(TripDAO.class)`. Почему на интервью по рефакторингу использование `mockStatic` вместо выделения `TripRepository` расценивается как анти-паттерн? Применение `mockStatic` лишь подменяет байт-код во время теста, оставляя продакшен-код жестко связанным со статическими вызовами и нарушающим принцип инверсии зависимостей (DIP); цель же рефакторинга — оздоровить саму архитектуру класса, сделав его коллабораторов явными.

### [L1-REF-08] Legacy Compliance Audit & PDF Report Generator (Overloaded Constructor Seam, `java.time.Clock` Injection & Resource Leak Remediation)

#### 1. Title & Grade
Задача **[L1-REF-08] Legacy Compliance Audit & PDF Report Generator (Overloaded Constructor Seam, `java.time.Clock` Injection & Resource Leak Remediation)** калибрована на грейд **Middle Specialist (L1)**.

#### 2. Company Context
Эта задача технического интервью используется для проверки разработчиков уровня Middle в банковском секторе и финтехе (Deutsche Bank, Revolut, Т-Банк Инвестиции, Яндекс Финтех). Она оценивает способность инженера находить и устранять четыре критические проблемы legacy-сервисов отчетности: недетерминированное системное время (`System.currentTimeMillis()`), прямое создание внешних сетевых клиентов (`new ComplianceBlacklistClient()`) внутри бизнес-метода, утечку файловых дескрипторов при отсутствии `try-with-resources` и потерю исключений закрытия потока в ручном блоке `finally`.

#### 3. The "Dirty" Code (80–180 lines)
Ниже представлен класс `LegacyPdfReportGenerator`, генерирующий регуляторный отчет по транзакциям и сохраняющий его во временный файл.

```java
package com.interview.refactoring.l1.report;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public class LegacyPdfReportGenerator {

    public static class TransactionEntry {
        public final String txId;
        public final BigDecimal amountEur;
        public final long timestampEpochMillis;

        public TransactionEntry(String txId, BigDecimal amountEur, long timestampEpochMillis) {
            this.txId = txId;
            this.amountEur = amountEur;
            this.timestampEpochMillis = timestampEpochMillis;
        }
    }

    /**
     * Simulates an external network client that fails if invoked without real network config.
     */
    public static class ComplianceBlacklistClient {
        public boolean isSanctionedTx(String txId) {
            if (System.getProperty("compliance.live.network") == null) {
                throw new IllegalStateException("Network call blocked: ComplianceBlacklistClient requires live connection");
            }
            return txId.startsWith("SANCTION-");
        }
    }

    /**
     * Generates a regulatory report file for transactions within the last 24 hours.
     * Applies weekend surcharge flag if generated on Saturday or Sunday UTC.
     */
    public String generateDailyComplianceReport(
            String accountId,
            List<TransactionEntry> transactions,
            File outputFile) {

        if (accountId == null || accountId.isBlank()) {
            throw new IllegalArgumentException("AccountId is required");
        }
        if (transactions == null) {
            throw new IllegalArgumentException("Transactions list cannot be null");
        }
        if (outputFile == null) {
            throw new IllegalArgumentException("Output file cannot be null");
        }

        // Smell 1: Hardcoded system clock makes 24h window and weekend check non-deterministic!
        long nowMillis = System.currentTimeMillis();
        long cutoffMillis = nowMillis - (24L * 60 * 60 * 1000);
        ZonedDateTime nowUtc = Instant.ofEpochMilli(nowMillis).atZone(ZoneId.of("UTC"));
        int dayOfWeek = nowUtc.getDayOfWeek().getValue(); // 6 = Saturday, 7 = Sunday
        boolean isWeekendWindow = (dayOfWeek == 6 || dayOfWeek == 7);

        // Smell 2: Hardcoded 'new' external network collaborator inside method!
        ComplianceBlacklistClient blacklistClient = new ComplianceBlacklistClient();

        BigDecimal totalReportable = BigDecimal.ZERO;
        int flaggedCount = 0;
        StringBuilder lines = new StringBuilder();

        for (TransactionEntry tx : transactions) {
            if (tx.timestampEpochMillis >= cutoffMillis && tx.timestampEpochMillis <= nowMillis) {
                boolean sanctioned = blacklistClient.isSanctionedTx(tx.txId);
                boolean highValue = tx.amountEur.compareTo(new BigDecimal("10000.00")) >= 0;
                String status = sanctioned ? "BLOCKED_SANCTION" : (highValue ? "AML_REVIEW" : "CLEAR");
                if (sanctioned || highValue) {
                    flaggedCount++;
                }
                totalReportable = totalReportable.add(tx.amountEur);
                lines.append(tx.txId).append("|").append(tx.amountEur).append("|").append(status).append("\n");
            }
        }

        String header = "REPORT_ACCOUNT:" + accountId
                + "|GENERATED_AT:" + DateTimeFormatter.ISO_INSTANT.format(nowUtc)
                + "|WEEKEND_MODE:" + isWeekendWindow
                + "|TOTAL_EUR:" + totalReportable
                + "|FLAGGED:" + flaggedCount + "\n";
        String fullContent = header + lines;

        // Smell 3: Legacy manual resource handling without try-with-resources!
        BufferedWriter writer = null;
        try {
            writer = new BufferedWriter(new FileWriter(outputFile));
            writer.write(fullContent);
            writer.flush();
            return fullContent;
        } catch (IOException e) {
            throw new RuntimeException("Failed to write compliance report", e);
        } finally {
            if (writer != null) {
                try {
                    writer.close();
                } catch (IOException ignored) {
                    // Swallows close failure silently!
                }
            }
        }
    }
}

```

#### 4. Code Smells Checklist
На этапе ревью этого класса от кандидата уровня L1 ожидается точная идентификация четырех архитектурных и системных запахов. Первая проблема — недетерминированная зависимость от физических системных часов (`System.currentTimeMillis()`): расчет скользящего 24-часового окна, форматирование метки `GENERATED_AT` и определение флага выходного дня (`dayOfWeek == 6 |
| dayOfWeek == 7`) зависят от момента запуска теста, что делает невозможным стабильное воспроизведение граничных и субботних сценариев без инъекции` java.time.Clock`. Вторая проблема — жесткое инстанциирование внешнего сетевого клиента (`new ComplianceBlacklistClient()`) непосредственно внутри метода, что блокирует выполнение модульных тестов и требует введения шва через перегруженный конструктор (Overloaded Constructor Seam) и функционального интерфейса` BlacklistChecker`.
Третий дефект связан с устаревшим управлением ресурсами ввода-вывода (`BufferedWriter` / `FileWriter` в ручном `try-finally` без `try-with-resources`): конструктор `new FileWriter(outputFile)` без указания кодировки опирается на платформозависимый charset, а ручной блок `finally` молча проглатывает `IOException` при закрытии дескриптора вместо использования механизма подавленных исключений (Suppressed Exceptions). Четвертый запах — смешение бизнес-правил AML-классификации транзакций, сериализации текстового отчета и дискового ввода-вывода в одном методе.

#### 5. Pin-Down Test Suite
С помощью шва перегруженного конструктора (`LegacyPdfReportGenerator(Clock, BlacklistChecker)`), фиксированных часов `Clock.fixed(...)` и аннотации JUnit 5 `@TempDir` создается полностью детерминированный набор тестов, проверяющий как будний, так и субботний режим генерации, фильтрацию 24-часового окна и запись на диск.

```java
package com.interview.refactoring.l1.report;

import com.interview.refactoring.l1.report.LegacyPdfReportGenerator.TransactionEntry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LegacyPdfReportGeneratorTest {

    @TempDir
    Path tempDir;

    @Test
    @DisplayName("Should filter 24h window deterministically on Saturday UTC and persist UTF-8 report file")
    void shouldGenerateDeterministicWeekendReport(@TempDir Path dir) throws IOException {
        // Saturday, 2026-10-17T12:00:00Z
        Instant fixedInstant = Instant.parse("2026-10-17T12:00:00Z");
        Clock fixedClock = Clock.fixed(fixedInstant, ZoneOffset.UTC);
        long nowMillis = fixedInstant.toEpochMilli();
        long twoHoursAgo = nowMillis - (2L * 3600 * 1000);
        long exactly24HoursAgo = nowMillis - (24L * 3600 * 1000);
        long twentyFiveHoursAgo = nowMillis - (25L * 3600 * 1000);

        LegacyPdfReportGenerator generator = new LegacyPdfReportGenerator(
                fixedClock,
                txId -> txId.startsWith("SANCTION-")
        );

        List<TransactionEntry> transactions = List.of(
                new TransactionEntry("TX-OLD", new BigDecimal("500.00"), twentyFiveHoursAgo),
                new TransactionEntry("TX-BOUNDARY", new BigDecimal("200.00"), exactly24HoursAgo),
                new TransactionEntry("TX-AML", new BigDecimal("15000.00"), twoHoursAgo),
                new TransactionEntry("SANCTION-99", new BigDecimal("50.00"), twoHoursAgo)
        );

        File reportFile = dir.resolve("compliance_report.txt").toFile();
        String content = generator.generateDailyComplianceReport("ACC-777", transactions, reportFile);

        String expected = """
                REPORT_ACCOUNT:ACC-777|GENERATED_AT:2026-10-17T12:00:00Z|WEEKEND_MODE:true|TOTAL_EUR:15250.00|FLAGGED:2
                TX-BOUNDARY|200.00|CLEAR
                TX-AML|15000.00|AML_REVIEW
                SANCTION-99|50.00|BLOCKED_SANCTION
                """;

        assertThat(content).isEqualTo(expected);
        assertThat(Files.readString(reportFile.toPath(), StandardCharsets.UTF_8)).isEqualTo(expected);
    }

    @Test
    @DisplayName("Should detect weekday mode on Wednesday UTC and handle empty matching window")
    void shouldGenerateWeekdayReportWithZeroMatchingTransactions() {
        // Wednesday, 2026-10-14T09:30:00Z
        Clock weekdayClock = Clock.fixed(Instant.parse("2026-10-14T09:30:00Z"), ZoneOffset.UTC);
        LegacyPdfReportGenerator generator = new LegacyPdfReportGenerator(weekdayClock, _ -> false);
        File reportFile = tempDir.resolve("empty_report.txt").toFile();

        String content = generator.generateDailyComplianceReport("ACC-001", List.of(), reportFile);

        assertThat(content).isEqualTo(
                "REPORT_ACCOUNT:ACC-001|GENERATED_AT:2026-10-14T09:30:00Z|WEEKEND_MODE:false|TOTAL_EUR:0|FLAGGED:0\n"
        );
    }

    @Test
    @DisplayName("Should validate mandatory inputs before touching clock or file system")
    void shouldValidateInputs() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-14T09:30:00Z"), ZoneOffset.UTC);
        LegacyPdfReportGenerator generator = new LegacyPdfReportGenerator(clock, _ -> false);
        File validFile = tempDir.resolve("test.txt").toFile();

        assertThatThrownBy(() -> generator.generateDailyComplianceReport("  ", List.of(), validFile))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("AccountId is required");

        assertThatThrownBy(() -> generator.generateDailyComplianceReport("ACC-1", null, validFile))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Transactions list cannot be null");

        assertThatThrownBy(() -> generator.generateDailyComplianceReport("ACC-1", List.of(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Output file cannot be null");
    }
}

```

#### 6. Refactored Clean Code
Эталонное решение на Java 21 LTS применяет шов перегруженного конструктора (Overloaded Constructor Seam), инъекцию `java.time.Clock`, функциональный порт `BlacklistChecker`, классификацию статуса через `enum ComplianceStatus` и безопасную запись файла через `Files.newBufferedWriter(outputFile.toPath(), StandardCharsets.UTF_8)` внутри `try-with-resources`.

```java
package com.interview.refactoring.l1.report;

import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

public class LegacyPdfReportGenerator {

    private static final Duration REPORT_WINDOW = Duration.ofHours(24);
    private static final BigDecimal AML_HIGH_VALUE_THRESHOLD = new BigDecimal("10000.00");
    private static final Set<DayOfWeek> WEEKEND_DAYS = EnumSet.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY);

    public static class TransactionEntry {
        public final String txId;
        public final BigDecimal amountEur;
        public final long timestampEpochMillis;

        public TransactionEntry(String txId, BigDecimal amountEur, long timestampEpochMillis) {
            this.txId = txId;
            this.amountEur = amountEur;
            this.timestampEpochMillis = timestampEpochMillis;
        }
    }

    public static class ComplianceBlacklistClient {
        public boolean isSanctionedTx(String txId) {
            if (System.getProperty("compliance.live.network") == null) {
                throw new IllegalStateException("Network call blocked: ComplianceBlacklistClient requires live connection");
            }
            return txId.startsWith("SANCTION-");
        }
    }

    @FunctionalInterface
    public interface BlacklistChecker {
        boolean isSanctioned(String txId);
    }

    public enum ComplianceStatus {
        CLEAR(false),
        AML_REVIEW(true),
        BLOCKED_SANCTION(true);

        private final boolean flagged;

        ComplianceStatus(boolean flagged) {
            this.flagged = flagged;
        }

        public boolean isFlagged() {
            return flagged;
        }

        public static ComplianceStatus classify(TransactionEntry tx, BlacklistChecker checker) {
            if (checker.isSanctioned(tx.txId)) {
                return BLOCKED_SANCTION;
            }
            if (tx.amountEur.compareTo(AML_HIGH_VALUE_THRESHOLD) >= 0) {
                return AML_REVIEW;
            }
            return CLEAR;
        }
    }

    private final Clock clock;
    private final BlacklistChecker blacklistChecker;

    /**
     * Default production constructor preserved for backward compatibility.
     */
    public LegacyPdfReportGenerator() {
        this(Clock.systemUTC(), new ComplianceBlacklistClient()::isSanctionedTx);
    }

    /**
     * Overloaded Constructor Seam enabling deterministic unit testing.
     */
    public LegacyPdfReportGenerator(Clock clock, BlacklistChecker blacklistChecker) {
        this.clock = clock;
        this.blacklistChecker = blacklistChecker;
    }

    public String generateDailyComplianceReport(
            String accountId,
            List<TransactionEntry> transactions,
            File outputFile) {

        validateInputs(accountId, transactions, outputFile);

        Instant now = clock.instant();
        long nowMillis = now.toEpochMilli();
        long cutoffMillis = now.minus(REPORT_WINDOW).toEpochMilli();
        ZonedDateTime nowUtc = now.atZone(ZoneOffset.UTC);
        boolean isWeekendWindow = WEEKEND_DAYS.contains(nowUtc.getDayOfWeek());

        String reportContent = buildReportContent(accountId, transactions, cutoffMillis, nowMillis, nowUtc, isWeekendWindow);
        writeReportToFile(outputFile, reportContent);
        return reportContent;
    }

    private String buildReportContent(
            String accountId,
            List<TransactionEntry> transactions,
            long cutoffMillis,
            long nowMillis,
            ZonedDateTime nowUtc,
            boolean isWeekendWindow) {

        BigDecimal totalReportable = BigDecimal.ZERO;
        int flaggedCount = 0;
        StringBuilder bodyLines = new StringBuilder();

        for (TransactionEntry tx : transactions) {
            if (tx.timestampEpochMillis >= cutoffMillis && tx.timestampEpochMillis <= nowMillis) {
                ComplianceStatus status = ComplianceStatus.classify(tx, blacklistChecker);
                if (status.isFlagged()) {
                    flaggedCount++;
                }
                totalReportable = totalReportable.add(tx.amountEur);
                bodyLines.append(tx.txId)
                        .append('|')
                        .append(tx.amountEur)
                        .append('|')
                        .append(status.name())
                        .append('\n');
            }
        }

        String header = "REPORT_ACCOUNT:" + accountId
                + "|GENERATED_AT:" + DateTimeFormatter.ISO_INSTANT.format(nowUtc)
                + "|WEEKEND_MODE:" + isWeekendWindow
                + "|TOTAL_EUR:" + totalReportable
                + "|FLAGGED:" + flaggedCount + "\n";

        return header + bodyLines;
    }

    private void writeReportToFile(File outputFile, String content) {
        try (BufferedWriter writer = Files.newBufferedWriter(outputFile.toPath(), StandardCharsets.UTF_8)) {
            writer.write(content);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to write compliance report", e);
        }
    }

    private void validateInputs(String accountId, List<TransactionEntry> transactions, File outputFile) {
        if (accountId == null || accountId.isBlank()) {
            throw new IllegalArgumentException("AccountId is required");
        }
        if (transactions == null) {
            throw new IllegalArgumentException("Transactions list cannot be null");
        }
        if (outputFile == null) {
            throw new IllegalArgumentException("Output file cannot be null");
        }
    }
}

```

#### 7. Interview Follow-Up Questions
Первый вопрос проверяет знание внутренней механики `try-with-resources` и подавленных исключений (Suppressed Exceptions): что именно происходит в JVM, если исключение выбрасывается одновременно и внутри блока `try` (при вызове `writer.write(content)`), и при автоматическом закрытии ресурса в `writer.close()`, и чем это отличается от ручного блока `try-finally`? В классическом `try-finally` необработанное исключение из `finally` полностью затирает первичное исключение из блока `try` (либо, как в исходном грязном коде, ошибка сброса буфера при `close()` бесследно проглатывается пустым блоком `catch`). В конструкции `try-with-resources` первичное исключение из тела `try` сохраняется как главное, а сбой метода `close()` автоматически прикрепляется к нему через `primaryException.addSuppressed(closeException)` и выводится в полном стектрейсе.
Второй вопрос оценивает знание специализированных коллекций для перечислений: почему для константы `WEEKEND_DAYS` мы выбрали `EnumSet.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY)` вместо стандартного `Set.of(...)` или `HashSet`? Реализация `EnumSet` (`RegularEnumSet` для перечислений до 64 элементов) хранит множество как один 64-битный примитив `long` (битовый вектор), благодаря чему операция `contains()` выполняется за одну процессорную инструкцию побитового И (`(elements & (1L << e.ordinal())) != 0`) без вычисления хэш-кодов и переходов по указателям в памяти.
Третий вопрос касается работы с часовыми поясами и переходом на летнее время (DST) при использовании `java.time.Clock`: если бы бизнес-требование изменилось с «последних 24 астрономических часов» (`Duration.ofHours(24)`) на «предыдущие календарные сутки в часовом поясе `Europe/Berlin`», почему вычитание `24 * 60 * 60 * 1000` миллисекунд давало бы ошибку дважды в год? В дни весеннего и осеннего перевода стрелок (DST) локальные сутки в `Europe/Berlin` длятся 23 или 25 часов, поэтому для календарных интервалов необходимо оперировать `ZonedDateTime.now(clock).minusDays(1)` или `Period.ofDays(1)`, а не фиксированным `Duration.ofHours(24)`.

## Синтез критериев калибровки и матрица принятия наймовых решений
Анализ прохождения кандидатами восьми канонических задач рефакторинга выявляет четкую границу между механическим знанием синтаксиса Java 21 и инженерной зрелостью. Кандидат уровня Junior Foundation (L0), успешно проходящий технический скрининг, демонстрирует дисциплину «правила бойскаута» (Boy Scout Rule): он не пытается внедрить сложные паттерны там, где достаточно сторожевых условий (Guard Clauses), замены магических констант на `enum` и выделения иммутабельных `record`-объектов с компактными конструкторами. Напротив, от специалиста уровня Middle (L1) требуется системное мышление: способность сначала построить герметичную страховочную сетку характеризующих тестов через швы Майкла Фезерса, а затем спроектировать решение, в котором некорректные доменные состояния непредставимы на уровне компилятора за счет запечатанных иерархий (`sealed interface`) и деконструкции записей.

| Фаза интервью | Маркеры отказа (No-Hire / Red Flags) | Калибровка на Junior Foundation (L0 Hire) | Калибровка на Middle Specialist (L1 Strong Hire) |
| --- | --- | --- | --- |
| **Фаза 1: Архитектурное ревью и диагностика** | Фокусируется исключительно на форматировании отступов и переименовании переменных; не замечает утечек ресурсов, `double` в деньгах или жестких синглтонов. | Четко называет базовые запахи: глубокую вложенность `if-else`, дублирование (DRY), длинный список примитивных параметров, конкатенацию строк в цикле. | Связывает тактические симптомы с принципами SOLID (OCP, SRP, DIP), указывает на проблему поверхностной иммутабельности (`shallow immutability`), недетерминированность времени и нарушение PCI-DSS / транзакционных границ. |
| **Фаза 2: Стратегия тестирования (Pin-Down Tests)** | Начинает переписывать продакшен-код без единого теста; смешивает рефакторинг с изменением бизнес-логики в одном шаге. | Пишет базовые позитивные и негативные тесты на JUnit 5 и AssertJ; при наличии интерфейса применяет `@Mock` в Mockito. | Разрешает «Дилемму унаследованного кода» через минимальные швы (Subclass and Override / Overloaded Constructor Seam), пишет `@ParameterizedTest` для полного покрытия ветвей, применяет `@MockitoBean` / `@MockitoSpyBean` (Spring Boot 3.4) и `Clock.fixed`. |
| **Фаза 3: Выполнение рефакторинга в Java 21 LTS** | Ломает публичный контракт класса; создает избыточные абстрактные фабрики; оставляет сырые `String` и `double` для валютных расчетов. | Применяет Guard Clauses, `enum`, `record` с валидацией в компактном конструкторе, `try-with-resources` и `BigDecimal` с `RoundingMode.HALF_UP`. | Моделирует закрытые доменные состояния через `sealed interface` + `record`, использует сопоставление с образцом в `switch` с предикатами `when` без ветки `default`, выделяет порты и компонуемые стратегии с защитным копированием `List.copyOf`. |
| **Фаза 4: Защита архитектурных компромиссов** | Не может объяснить причины выбора паттерна или условия, при которых от него следует отказаться. | Объясняет контракты `equals()` / `hashCode()`, преимущества `Records` и работу `AutoCloseable`. | Аргументирует выбор между закрытой иерархией DOP (`sealed interface`) и открытым полиморфизмом (`Strategy`), объясняет механику подавленных исключений, `EnumSet` и ограничения `@Transactional` при сетевых вызовах. |

---

Source: https://gemini.google.com/app/fec9a6ae77562978
Exported at: 2026-10-17T10:20:16.980Z