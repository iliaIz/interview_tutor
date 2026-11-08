import React, { useState } from 'react';
import {
  Code2,
  Users,
  Lightbulb,
  Layers,
  BarChart3,
  Server,
  ShieldCheck,
  FileText,
  Bot,
  ChevronDown,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface CompetencyItem {
  id: number;
  title: string;
  category: 'engineering' | 'product' | 'quality_ai';
  categoryLabel: string;
  icon: React.ElementType;
  techStack: string;
  description: string;
  interviewQuestion: string;
  barRaiserExpectation: string;
}

const COMPETENCIES: CompetencyItem[] = [
  {
    id: 1,
    title: 'Разработка бэкенда',
    category: 'engineering',
    categoryLabel: 'Инженерия',
    icon: Code2,
    techStack: 'Java 21, Kotlin, Spring Boot 3, PostgreSQL, Apache Kafka, Redis',
    description: 'Глубокое понимание физики платформы: Virtual Threads, AOP-прокси, блокировки на уровне СУБД, стриминг и CDC.',
    interviewQuestion: '«Почему synchronized на методе перевода в кластере — это фикция и как обеспечить детерминированную блокировку строк?»',
    barRaiserExpectation: 'Умеет сортировать ID счетов (min -> max) для предотвращения дедлоков; знает про запрет double в деньгах и транзакционные гарантии Outbox.'
  },
  {
    id: 2,
    title: 'Discovery и работа с пользователями',
    category: 'product',
    categoryLabel: 'Продукт & Бизнес',
    icon: Users,
    techStack: 'Event Storming, CustDev, User Journey Map, Domain-Driven Design',
    description: 'Самостоятельное погружение в предметную область без аналитика-посредника. Общение со стейкхолдерами и выявление скрытых ограничений.',
    interviewQuestion: '«Вам принесли запрос от бизнеса: "сделайте экспорт отчетов в Excel". Ваши первые действия?»',
    barRaiserExpectation: 'Не начинает кодить сразу: выясняет конечную цель пользователя (X-Y Problem), альтернативы (дашборд, вебхук) и объем данных.'
  },
  {
    id: 3,
    title: 'Продуктовые решения',
    category: 'product',
    categoryLabel: 'Продукт & Бизнес',
    icon: Lightbulb,
    techStack: 'MVP, Cost-of-Delay, декомпозиция гипотез, Feature Flags',
    description: 'Умение балансировать между идеальной архитектурой и быстрой валидацией ценности на реальных пользователях.',
    interviewQuestion: '«Как проверить гипотезу о новом типе накопительного счета за 2 дня без доработки ядра АБС?»',
    barRaiserExpectation: 'Предлагает фасадное решение (Wizard/Landing) с ручной обработкой первых заявок для замера конверсии до капиталоемкой разработки.'
  },
  {
    id: 4,
    title: 'UX и прототипирование',
    category: 'product',
    categoryLabel: 'Продукт & Бизнес',
    icon: Layers,
    techStack: 'API-First, OpenAPI/Swagger, ViennaUI design tokens, Microfrontends',
    description: 'Сквозное проектирование пользовательского опыта: консистентные ошибки API, оптимистичный UI и бесшовные флоу.',
    interviewQuestion: '«Как оформить ошибку валидации поля суммы, чтобы мобильный клиент показал понятное сообщение без повторного запроса?»',
    barRaiserExpectation: 'Использует RFC 7807 (Problem Details), передает локализованные ключи ошибок и machine-readable payload с лимитами.'
  },
  {
    id: 5,
    title: 'Измерения и продуктовая аналитика',
    category: 'product',
    categoryLabel: 'Продукт & Бизнес',
    icon: BarChart3,
    techStack: 'DORA метрики, Prometheus, Grafana, A/B платформы, ClickHouse',
    description: 'Управление фичей через цифры: TTM, Pain Index, воронка конверсии, частота откатов и latency 99-го перцентиля.',
    interviewQuestion: '«Как вы докажете, что ваш рефакторинг сервиса авторизации принес пользу бизнесу, а не только разработчикам?»',
    barRaiserExpectation: 'Оперирует метриками конверсии входа, снижением количества звонков в поддержку (Pain Index) и ростом DORA Throughput.'
  },
  {
    id: 6,
    title: 'Эксплуатация и наблюдаемость',
    category: 'engineering',
    categoryLabel: 'Инженерия',
    icon: Server,
    techStack: 'Kubernetes, Helm, GitLab CI, Grafana, OpenTelemetry, PagerDuty/On-call',
    description: 'You build it, you run it. Полное владение жизненным циклом в рантайме: деплой, трассировка спанов, алерты и дежурства.',
    interviewQuestion: '«В 3 часа ночи сработал алерт p99 latency > 2s на сервисе платежей. Каков ваш алгоритм траблшутинга?»',
    barRaiserExpectation: 'Смотрит метрики насыщения ресурсов (USE/RED), трассы в Jaeger, пул коннектов HikariCP и статус очередей Kafka до перезагрузки подов.'
  },
  {
    id: 7,
    title: 'Тестирование и инварианты',
    category: 'quality_ai',
    categoryLabel: 'Качество & Надежность',
    icon: ShieldCheck,
    techStack: 'Testcontainers, Spring Boot Test, WireMock, Gatling, Contract Testing',
    description: 'QA как отдельная роль упразднена! Разработчик сам проектирует пирамиду тестирования с упором на компонентные тесты с реальной БД.',
    interviewQuestion: '«Почему юнит-тесты со 100% покрытием моками опасны в финансовом микросервисе?»',
    barRaiserExpectation: 'Объясняет, что моки скрывают дефекты транзакций, синтаксис SQL, дедлоки и поведение триггеров; поднимает реальный PostgreSQL в контейнере.'
  },
  {
    id: 8,
    title: 'Документация и архитектура',
    category: 'engineering',
    categoryLabel: 'Инженерия',
    icon: FileText,
    techStack: 'Architecture Decision Records (ADR), C4 Model, Spec Review, OpenAPI',
    description: 'Фиксация архитектурных развилок, границ сервисов и защита технического дизайна перед комитетом до написания кода.',
    interviewQuestion: '«Зачем писать ADR, если код сам по себе является самодокументируемым?»',
    barRaiserExpectation: 'ADR фиксирует контекст, отвергнутые альтернативы и компромиссы; предотвращает повторное наступление на старые грабли через полгода.'
  },
  {
    id: 9,
    title: 'Агентная разработка и контроль ИИ',
    category: 'quality_ai',
    categoryLabel: 'Качество & Надежность',
    icon: Bot,
    techStack: 'AI Coding Agents, LLM Orchestration, Prompt Boundary Invariants, Static Analysis',
    description: 'Осознанное использование ИИ-ассистентов: проверка на утечки ресурсов, гонки данных, галлюцинации и сохранение чистоты архитектуры.',
    interviewQuestion: '«С какими опасными ошибками кодинг-агентов вы сталкивались лично и как предотвращаете их попадание в прод?»',
    barRaiserExpectation: 'Называет слепые ретраи без Idempotency-Key, вызовы double в BigDecimal, утерю @Transactional и ставит жесткие тесты инвариантов.'
  }
];

export const CompanyCompetenciesRadar: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'engineering' | 'product' | 'quality_ai'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const filteredCompetencies = selectedFilter === 'all'
    ? COMPETENCIES
    : COMPETENCIES.filter((c) => c.category === selectedFilter);

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 text-white">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
              Методология Self-Driving Bank
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
            9 функциональных блоков компетенций Product Engineer
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            В Райффайзенбанке оценивают готовность отвечать за весь жизненный цикл фичи. Нажмите на блок, чтобы увидеть каверзный вопрос интервьюера.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/90 border border-slate-700/60 self-start sm:self-center shrink-0">
          {(
            [
              { id: 'all', label: 'Все (9)' },
              { id: 'engineering', label: 'Инженерия' },
              { id: 'product', label: 'Продукт' },
              { id: 'quality_ai', label: 'Качество & AI' }
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedFilter(btn.id)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                selectedFilter === btn.id
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of 9 Competencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCompetencies.map((comp) => {
          const Icon = comp.icon;
          const isExpanded = expandedId === comp.id;

          return (
            <div
              key={comp.id}
              onClick={() => setExpandedId(isExpanded ? null : comp.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-amber-50/40 border-amber-300/80 shadow-md ring-1 ring-amber-300/60'
                  : 'bg-white border-slate-200/80 hover:border-amber-300/60 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isExpanded
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold font-mono text-slate-700 uppercase">
                      #{comp.id} • {comp.categoryLabel}
                    </span>
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {comp.title}
                    </h5>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-700 transition-transform ${
                    isExpanded ? 'rotate-180 text-amber-800' : ''
                  }`}
                />
              </div>

              <p className="text-xs text-slate-700 mt-2 line-clamp-2 leading-relaxed">
                {comp.description}
              </p>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-700 font-mono">
                <span className="truncate max-w-[200px]">{comp.techStack}</span>
                <span className="text-amber-800 font-bold shrink-0">
                  {isExpanded ? 'Свернуть' : 'Подробнее'}
                </span>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2.5 text-xs animate-in fade-in duration-150">
                  <div className="p-2.5 rounded-xl bg-amber-100/60 border border-amber-200/80">
                    <span className="font-bold text-amber-900 block mb-1">
                      Каверзный вопрос на собеседовании:
                    </span>
                    <p className="italic text-slate-800">{comp.interviewQuestion}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Что ожидает услышать Bar-Raiser:
                    </span>
                    <p className="text-slate-800">{comp.barRaiserExpectation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
