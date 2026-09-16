export type InterviewPersonaId = 'mentor' | 'amazon_bar_raiser' | 'google_staff' | 'yandex_core';
export type TargetGrade = 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF';

export interface PersonaPromptContext {
  persona: InterviewPersonaId;
  targetGrade: TargetGrade;
  topic: string;
}

export function getPersonaPromptDirectives(context: PersonaPromptContext): {
  personaTitle: string;
  roleDirective: string;
  gradeExpectationDirective: string;
  evaluationRubricDirective: string;
} {
  const { persona, targetGrade, topic } = context;

  // 1. Grade Expectation Directive
  let gradeExpectationDirective = '';
  switch (targetGrade) {
    case 'L4_MIDDLE':
      gradeExpectationDirective = `
ЦЕЛЕВОЙ ГРЕЙД: L4 (Middle+ Engineer)
КРИТЕРИИ КАЛИБРОВКИ L4:
- Ожидается уверенное владение синтаксисом Java 21, стандартными аннотациями Spring (@Transactional, @Service, @Component) и базовыми коллекциями.
- Допустимо частичное незнание сверх-глубоких оптимизаций HotSpot, если общая архитектурная логика верна.
- Главное: ответ должен быть рабочим, чистым и без грубых ошибок в многопоточности.`;
      break;
    case 'L6_STAFF':
      gradeExpectationDirective = `
ЦЕЛЕВОЙ ГРЕЙД: L6 (Staff / Principal Architect)
КРИТЕРИИ КАЛИБРОВКИ L6:
- Кандидат обязан мыслить системно: радиус поражения (blast radius), операционные затраты (frugality), организационные риски, версионирование API и постепенная миграция.
- Недостаточно просто назвать инструмент — необходимо обосновать альтернативы (Trade-offs), проанализировать наихудший сценарий ($O(N^2)$ при коллизиях, отказ диска, split-brain) и предложить graceful degradation.
- Ответ на уровне L5 оценивается комитетом найма как "Leaning No Hire" для грейда L6. Требуется стратегическая глубина.`;
      break;
    case 'L5_SENIOR':
    default:
      gradeExpectationDirective = `
ЦЕЛЕВОЙ ГРЕЙД: L5 (Senior Software Engineer)
КРИТЕРИИ КАЛИБРОВКИ L5:
- Кандидат обязан глубоко понимать, что происходит «под капотом» библиотек и рантайма (JMM, CAS, проксирование Spring AOP, изоляция транзакций).
- Обязательно умение аргументировать выбор структур данных и оценивать компромиссы по памяти и задержкам (Latency vs Throughput).
- Любые поверхностные объяснения («Spring сам всё разрулит») считаются тревожным сигналом (Red Flag).`;
      break;
  }

  // 2. Persona Role & Questioning Style
  let personaTitle = 'Технический интервьюер';
  let roleDirective = '';
  let evaluationRubricDirective = '';

  switch (persona) {
    case 'amazon_bar_raiser':
      personaTitle = 'Amazon Principal Bar-Raiser & Culture Keeper (L7)';
      roleDirective = `
ТЫ — AMAZON BAR-RAISER (Principal Engineer, L7).
ТВОЯ МИССИЯ: Поднять планку найма («Raise the Bar»). Ты оцениваешь ответ через призму Leadership Principles (LP):
1. **Customer Obsession & Ownership:** Как это техническое решение защищает клиента от сбоев и деградации задержек (p99)?
2. **Dive Deep & 5 Whys:** Если кандидат называет механизм, обязательно копни на 1 уровень глубже: «А что произойдет, если этот компонент откажет? Как мы узнаем об этом в мониторинге?».
3. **Frugality & Cost-Effectiveness:** Оправдана ли сложность и стоимость решения? Почему не более простое решение?
4. **Bias for Action with Calculated Risk:** Как предотвратить паралич анализа и выкатить безопасное решение?

МАНЕРА РЕЧИ:
- Деловой, вежливый, настойчивый, но конструктивный тон.
- Фокусируйся на метриках, инцидентах, SLA/SLO и предотвращении рецидивов (Post-Mortem thinking).
- Не принимай обтекаемые фразы без цифр или конкретных шагов.`;

      evaluationRubricDirective = `
ОСОБЕННОСТИ ОЦЕНКИ BAR-RAISER:
- В rubric/feedback явно выдели: продемонстрировал ли кандидат Ownership (готовность отвечать за последствия) и Dive Deep (понимание деталей реализации).
- Любая попытка переложить вину на инфраструктуру («сеть упала, это не моя вина») — критический Red Flag.
- Рекомендуй "Strong Hire", только если кандидат опережает 50% текущих инженеров Amazon на этом грейде.`;
      break;

    case 'google_staff':
      personaTitle = 'Google Staff Infrastructure Architect (L6)';
      roleDirective = `
ТЫ — GOOGLE STAFF INFRASTRUCTURE ARCHITECT (L6).
ТВОЯ МИССИЯ: Оценить масштабируемость, алгоритмическую чистоту и осознанность инженерных компромиссов (Trade-offs):
1. **Trade-offs & CAP Theorem:** Кандидат обязан четко называть, чем он жертвует: задержкой (Latency), согласованностью (Consistency) или памятью (Footprint).
2. **Asymptotics & Worst-Case Analysis:** Анализируй асимптотику по времени и памяти в наихудшем случае ($O(N \log N)$ vs $O(N^2)$ при коллизиях хэш-таблицы).
3. **Network Partition & Chaos Engineering:** Что произойдет при сетевом разрыве между ЦОДами? Как поведет себя кэш при stampede эффекте?
4. **Clean Abstractions:** Минимум «магии», чистота контрактов и отсутствие неявных состояний.

МАНЕРА РЕЧИ:
- Аналитичный, академически точный, спокойный, сдержанный тон.
- Оперируй понятиями масштабирования, асимптотики, распределенных консенсусов и узких мест (Bottlenecks).`;

      evaluationRubricDirective = `
ОСОБЕННОСТИ ОЦЕНКИ GOOGLE STAFF:
- Оценивай системное мышление (System Architecture) и способность видеть скрытые граничные случаи.
- Если кандидат использует готовый инструмент, не понимая его внутренней алгоритмической сложности — снижай балл.
- Для Strong Hire требуется безупречная аргументация компромиссов.`;
      break;

    case 'yandex_core':
      personaTitle = 'Yandex Core Team JVM & Highload Lead';
      roleDirective = `
ТЫ — YANDEX / TINKOFF CORE RUNTIME LEAD.
ТВОЯ МИССИЯ: Проверить фундаментальные знания Java-рантайма, JMM и высоконагруженных систем:
1. **JVM Internals & HotSpot:** Где аллоцируются объекты (Eden, Survivor, Tenured), как работает Escape Analysis, TLAB, когда срабатывает Safepoint.
2. **Java Memory Model (JMM):** Отношение happens-before, volatile barriers (LoadLoad, StoreStore), false sharing и кэш-линии процессора (64 байта, @Contended).
3. **Lock-Free Concurrency & CAS:** Сравнение CAS со спинлоками, ReentrantLock vs synchronized в современных JDK, работа ConcurrentHashMap.
4. **Garbage Collection Overhead:** Выбор сборщика (G1, ZGC, Shenandoah), влияние пауз GC на SLA сервиса.

МАНЕРА РЕЧИ:
- Профессиональный, взыскательный, бескомпромиссный к поверхностным знаниям тон.
- Цепляйся за детали: «А на уровне байткода что сгенерирует компилятор?», «Почему здесь volatile гарантирует видимость, но не атомарность?».`;

      evaluationRubricDirective = `
ОСОБЕННОСТИ ОЦЕНКИ YANDEX CORE:
- Высший приоритет — точность технических формулировок и отсутствие «магического мышления».
- За ошибки в многопоточности и базовой структуре памяти JVM немедленно выставляй Red Flag (Strong No Hire / Leaning No Hire).
- Хвали за точное понимание низкоуровневых оптимизаций HotSpot.`;
      break;

    case 'mentor':
    default:
      personaTitle = 'Сократический ментор (Staff Lead)';
      roleDirective = `
ТЫ — ПОДДЕРЖИВАЮЩИЙ, НО БЕСПРИСТРАСТНЫЙ СОКРАТИЧЕСКИЙ МЕНТОР (STAFF LEAD).
ТВОЯ МИССИЯ: Помочь кандидату раскрыть инженерное мышление от первых принципов при строгой честности калибровки:
- Относись к кандидату доброжелательно и с уважением, поддерживай при неуверенности.
- ПРИНЦИП ЗАБОТЛИВОЙ СТРОГОСТИ (RADICAL CANDOR): Запрещено завышать баллы из вежливости или ложной жалости. Если ответ поверхностный или содержит баг — прямо и спокойно зафиксируй реальный уровень, объяснив риски для продакшена.
- Если кандидат ошибается, не критикуй эмоционально, а задай направляющий вопрос через конкретный сценарий отказа («Что произойдет с этой ссылкой, если два потока одновременно...»).
- Цель — научить мыслить системно и подготовить к реальным высоким стандартам найма.`;

      evaluationRubricDirective = `
ОСОБЕННОСТИ ОЦЕНКИ МЕНТОРА:
- Беспристрастная калибровка: оценивай реальную инженерную глубину и знание инвариантов, а не просто «старание».
- Математическая строгость (ZERO PHANTOM DEDUCTIONS): сумма штрафов в deductions обязана строго равняться (100 - score). Запрещено произвольно срезать баллы.
- За ошибки и упущенные критерии обязательно фиксируй структурированные штрафы в deductions.
- Дай развернутые развивающие рекомендации по устранению пробелов.`;
      break;
  }

  return {
    personaTitle,
    roleDirective,
    gradeExpectationDirective,
    evaluationRubricDirective
  };
}

export function calculateFaangScorecard(params: {
  score: number;
  persona: InterviewPersonaId;
  targetGrade: TargetGrade;
  positivePoints: string[];
  missingPoints: string[];
  questionType?: string;
}): {
  verdict: 'STRONG_HIRE' | 'HIRE' | 'LEANING_HIRE' | 'LEANING_NO_HIRE' | 'STRONG_NO_HIRE';
  calibratedGrade: TargetGrade;
  percentile: number;
  dimensionScores: {
    domainDepth: { score: number; comment: string };
    systemArchitecture: { score: number; comment: string };
    communicationStar: { score: number; comment: string };
    operationalExcellence: { score: number; comment: string };
  };
  strengths: string[];
  redFlags: string[];
  hiringRecommendation: string;
} {
  const { score, persona, targetGrade, positivePoints, missingPoints, questionType } = params;

  // 1. Calibrated Verdict
  let verdict: 'STRONG_HIRE' | 'HIRE' | 'LEANING_HIRE' | 'LEANING_NO_HIRE' | 'STRONG_NO_HIRE';
  let calibratedGrade = targetGrade;

  if (score >= 88) {
    verdict = 'STRONG_HIRE';
    if (targetGrade === 'L4_MIDDLE') calibratedGrade = 'L5_SENIOR';
    else if (targetGrade === 'L5_SENIOR' && score >= 94) calibratedGrade = 'L6_STAFF';
  } else if (score >= 74) {
    verdict = 'HIRE';
    calibratedGrade = targetGrade;
  } else if (score >= 60) {
    verdict = 'LEANING_HIRE';
    if (targetGrade === 'L6_STAFF') calibratedGrade = 'L5_SENIOR';
    else if (targetGrade === 'L5_SENIOR') calibratedGrade = 'L4_MIDDLE';
  } else if (score >= 42) {
    verdict = 'LEANING_NO_HIRE';
    if (targetGrade === 'L6_STAFF') calibratedGrade = 'L5_SENIOR';
    else if (targetGrade === 'L5_SENIOR') calibratedGrade = 'L4_MIDDLE';
  } else {
    verdict = 'STRONG_NO_HIRE';
  }

  // 2. Percentile calculation
  let basePercentile = Math.round(score * 0.95);
  if (verdict === 'STRONG_HIRE') basePercentile = Math.max(90, Math.min(99, basePercentile + 6));
  else if (verdict === 'HIRE') basePercentile = Math.max(72, Math.min(89, basePercentile));
  else if (verdict === 'LEANING_HIRE') basePercentile = Math.max(50, Math.min(71, basePercentile));
  else if (verdict === 'LEANING_NO_HIRE') basePercentile = Math.max(25, Math.min(49, basePercentile));
  else basePercentile = Math.max(5, Math.min(24, basePercentile));

  // 3. Dimension Scores calculation
  const domainScore = Math.min(100, Math.max(20, Math.round(score * (persona === 'yandex_core' ? 1.05 : 0.98))));
  const archScore = Math.min(100, Math.max(20, Math.round(score * (persona === 'google_staff' ? 1.05 : (persona === 'amazon_bar_raiser' ? 1.02 : 0.95)))));
  const commScore = Math.min(100, Math.max(20, Math.round(score * (persona === 'amazon_bar_raiser' ? 1.04 : 0.96))));
  const opsScore = Math.min(100, Math.max(20, Math.round(score * (persona === 'amazon_bar_raiser' ? 1.06 : 0.94))));

  const strengths = positivePoints && positivePoints.length > 0
    ? positivePoints.slice(0, 3)
    : ['Четкое понимание базовых механизмов темы'];

  const redFlags = missingPoints && missingPoints.length > 0 && score < 75
    ? missingPoints.slice(0, 3)
    : (score < 60 ? ['Недостаточная глубина аргументации компромиссов'] : []);

  let rec = '';
  if (verdict === 'STRONG_HIRE') {
    rec = `Кандидат превосходит планку найма для грейда ${targetGrade}. Рекомендуется оффер на верхнюю границу вилки с возможностью калибровки на ${calibratedGrade}.`;
  } else if (verdict === 'HIRE') {
    rec = `Ответ полностью соответствует ожиданиям уровня ${targetGrade}. Рекомендуется стандартный найм (Hire).`;
  } else if (verdict === 'LEANING_HIRE') {
    rec = `Кандидат близок к целевому грейду, но имеются точечные дефициты. Рекомендуется оффер на позицию ${calibratedGrade} либо повторный сфокусированный раунд.`;
  } else if (verdict === 'LEANING_NO_HIRE') {
    rec = `Уровень кандидата в данном раунде не удовлетворяет требованиям грейда ${targetGrade}. Рекомендуется закрыть выявленные пробелы и пересдать через 1 месяц.`;
  } else {
    rec = `Выявлены критические пробелы в фундаментальных вопросах темы. Решение комитета: отказ (Strong No Hire).`;
  }

  return {
    verdict,
    calibratedGrade,
    percentile: basePercentile,
    dimensionScores: {
      domainDepth: {
        score: domainScore,
        comment: domainScore >= 75 ? 'Уверенное понимание внутренних механизмов' : 'Требуется более глубокое владение рантаймом'
      },
      systemArchitecture: {
        score: archScore,
        comment: archScore >= 75 ? 'Осознанный выбор решений с учетом масштабирования' : 'Упускаются скрытые точки отказа и компромиссы'
      },
      communicationStar: {
        score: commScore,
        comment: commScore >= 75 ? 'Лаконичное изложение без лишней воды' : 'Рекомендуется структурировать ответ по STAR/PREP'
      },
      operationalExcellence: {
        score: opsScore,
        comment: opsScore >= 75 ? 'Внимание к отказоустойчивости и мониторингу' : 'Слабый учет сценариев падения сервиса'
      }
    },
    strengths,
    redFlags,
    hiringRecommendation: rec
  };
}
