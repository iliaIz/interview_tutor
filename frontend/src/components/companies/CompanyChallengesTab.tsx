import React, { useState } from 'react';
import { Bug, Code2, ArrowRight, Bot, Clock, ShieldAlert, Sparkles, Filter } from 'lucide-react';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';

interface ChallengeCardInfo {
  id: string;
  title: string;
  category: 'code_review' | 'live_coding';
  difficulty: 'Middle' | 'Senior';
  estimatedMinutes: number;
  summary: string;
  keyPoints: string[];
}

const ALFA_CHALLENGES: ChallengeCardInfo[] = [
  // 6 Code Review Katas
  {
    id: 'cr-alfa-01',
    title: 'PaymentController: 8+ скрытых дефектов в REST-контроллере',
    category: 'code_review',
    difficulty: 'Senior',
    estimatedMinutes: 20,
    summary: 'Классический собеседовательный контроллер с критическими финтех-уязвимостями.',
    keyPoints: ['Static HashMap утечка памяти', 'Потеря точности double в деньгах', 'Внешний HTTP внутри @Transactional (утечка HikariCP)', 'Отправка в Kafka до фиксации транзакции']
  },
  {
    id: 'cr-alfa-02',
    title: 'CalculationService: Ретраи внутри @Transactional и зависание HikariCP',
    category: 'code_review',
    difficulty: 'Middle',
    estimatedMinutes: 15,
    summary: 'Антипаттерн @Retryable внутри транзакции, вызывающий голодание пула БД.',
    keyPoints: ['Зависание соединений в пуле', 'Ретраи транзакций на уровне бизнес-логики', 'Преждевременный push событий']
  },
  {
    id: 'cr-alfa-03',
    title: 'OrderProcessingService: Нарушение атомарности Dual Write',
    category: 'code_review',
    difficulty: 'Middle',
    estimatedMinutes: 20,
    summary: 'Распределенная несогласованность при совмещении записи в БД и HTTP RPC.',
    keyPoints: ['Атомарность распределенных операций', 'Паттерн Transactional Outbox', 'Идемпотентные потребители событий']
  },
  {
    id: 'cr-alfa-04',
    title: 'AccountLocker: Синхронизация на String.intern() и Deadlock',
    category: 'code_review',
    difficulty: 'Middle',
    estimatedMinutes: 15,
    summary: 'Смертельная ловушка синхронизации на строковом пуле JVM.',
    keyPoints: ['Deadlock в String Pool', 'Опасность интернированных объектов', 'Альтернатива: полосковые Striped Locks']
  },
  {
    id: 'cr-alfa-05',
    title: 'CustomerOrderRepository: Hibernate N+1 и антипаттерн EAGER',
    category: 'code_review',
    difficulty: 'Middle',
    estimatedMinutes: 15,
    summary: 'Падение производительности СУБД из-за взрывного роста числа SQL-запросов.',
    keyPoints: ['N+1 проблема Hibernate', 'Опасность FetchType.EAGER', 'Решение через @EntityGraph и JOIN FETCH']
  },
  {
    id: 'cr-alfa-06',
    title: 'ExceptionProcessor: Поведение try-catch-finally в байткоде JVM',
    category: 'code_review',
    difficulty: 'Middle',
    estimatedMinutes: 10,
    summary: 'Нюансы таблицы исключений JVM ExceptionTable и перетирание return-значений.',
    keyPoints: ['Перетирание return в блоке finally', 'Проглатывание unchecked исключений', 'Поведение JVM стэка операндов']
  },

  // 5 Live Coding Challenges
  {
    id: 'lc-alfa-01',
    title: 'SegmentedConcurrentHashMap: Полосковые блокировки (Striped Locking)',
    category: 'live_coding',
    difficulty: 'Senior',
    estimatedMinutes: 40,
    summary: 'Реализация масштабируемой потокобезопасной таблицы на массиве ReentrantLock.',
    keyPoints: ['Полосковая синхронизация по хешу', 'Volatile видимость чтения без блокировок', 'Устранение bottleneck synchronizedMap']
  },
  {
    id: 'lc-alfa-02',
    title: 'BankingStreamProcessor: Агрегация транзакций на Stream API & BigDecimal',
    category: 'live_coding',
    difficulty: 'Middle',
    estimatedMinutes: 30,
    summary: 'Высокоточная обработка финансовых проводок без потери копеек.',
    keyPoints: ['Исключение float/double в деньгах', 'GroupingBy и кастомные Collectors', 'Потокобезопасность в parallelStream']
  },
  {
    id: 'lld-key-value-cache-ttl',
    title: 'In-Memory Key-Value Cache с TTL и защитой от Cache Stampede',
    category: 'live_coding',
    difficulty: 'Senior',
    estimatedMinutes: 45,
    summary: 'Высоконагруженный локальный кэш с инвалидацией и параллельным доступом.',
    keyPoints: ['Атомарный computeIfAbsent', 'Защита от эффекта собачьего набега (Stampede)', 'Очистка устаревших записей по таймеру']
  },
  {
    id: 'lc-alfa-04',
    title: 'ImmutableAccount: Защитное копирование и контракт equals/hashCode',
    category: 'live_coding',
    difficulty: 'Middle',
    estimatedMinutes: 25,
    summary: 'Проектирование 100% иммутабельной сущности счета с коллекциями и датами.',
    keyPoints: ['Глубокое защитное копирование (defensive copying)', 'Корректный хешкод при коллизиях', 'Защита от мутаций через геттеры']
  },
  {
    id: 'lc-alfa-05',
    title: 'PaymentRestController: Jakarta Bean Validation & Mockito ArgumentCaptor',
    category: 'live_coding',
    difficulty: 'Middle',
    estimatedMinutes: 30,
    summary: 'Написание чистого Spring REST-контроллера с валидацией и юнит-тестами.',
    keyPoints: ['Аннотации @Valid, @Pattern, @Positive', 'Перехват DTO через ArgumentCaptor', 'Тестирование негативных сценариев с MockMvc']
  }
];

interface CompanyChallengesTabProps {
  companyName: string;
  onNavigateToTask: (taskId: string, targetArena?: any) => void;
}

export const CompanyChallengesTab: React.FC<CompanyChallengesTabProps> = ({
  companyName,
  onNavigateToTask
}) => {
  const [filter, setFilter] = useState<'all' | 'code_review' | 'live_coding'>('all');

  const filteredChallenges = ALFA_CHALLENGES.filter((c) => {
    if (filter === 'all') return true;
    return c.category === filter;
  });

  const handleAskAiForChallenge = (c: ChallengeCardInfo) => {
    const store = usePracticeTutorStore.getState();
    store.toggleOpen(true);
    void store.sendMessage(
      `Я готовлюсь к собеседованию в ${companyName}. Разбираю задачу «${c.title}» (${c.id}).\n\n` +
      `Краткая суть: ${c.summary}\n` +
      `Ключевые аспекты: ${c.keyPoints.join(', ')}.\n\n` +
      `Дай мне сеньорные рекомендации: на что обратить внимание при решении в IDE и какие ловушки чаще всего упускают кандидаты?`
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-600" /> Практический полигон в IDE
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Всего: 11 задач (6 Code Review + 5 Live Coding)
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Практика & Code Review: {companyName}
          </h3>
          <p className="text-xs text-slate-600">
            Все задачи запускаются напрямую в полноэкранной веб-IDE с автоматическим прогоном тестов JUnit 5, компилятором Java 21 и AI-ревью.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold shrink-0 self-start md:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Все (11)
          </button>
          <button
            onClick={() => setFilter('code_review')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'code_review' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bug className="w-3.5 h-3.5" /> Code Review (6)
          </button>
          <button
            onClick={() => setFilter('live_coding')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'live_coding' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Live Coding (5)
          </button>
        </div>
      </div>

      {/* Grid of Challenges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredChallenges.map((c) => {
          const isCr = c.category === 'code_review';
          return (
            <div
              key={c.id}
              className={`p-5 rounded-3xl border transition-all shadow-xs flex flex-col justify-between space-y-4 ${
                isCr
                  ? 'bg-amber-50/20 hover:bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                  : 'bg-indigo-50/20 hover:bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-300'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono border ${
                        isCr
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      }`}
                    >
                      {c.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        c.difficulty === 'Senior'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {c.difficulty}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> ~{c.estimatedMinutes} мин
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 leading-snug">{c.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{c.summary}</p>

                {/* Bullets */}
                <div className="p-3 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 font-mono">
                    {isCr ? 'Ключевые дефекты в коде:' : 'Требования & Спецификация:'}
                  </span>
                  <ul className="space-y-0.5 text-[11px] text-slate-700 list-disc list-inside">
                    {c.keyPoints.map((kp, idx) => (
                      <li key={idx} className="leading-tight">{kp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                <button
                  onClick={() => handleAskAiForChallenge(c)}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Спросить подсказку у AI"
                >
                  <Bot className="w-3.5 h-3.5 text-amber-600" />
                  <span>AI Совет</span>
                </button>

                <button
                  onClick={() => onNavigateToTask(c.id, 'practice')}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 ${
                    isCr
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <span>{isCr ? 'Провести ревью в IDE' : 'Решать задачу в IDE'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
