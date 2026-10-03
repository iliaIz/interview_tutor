import React, { useEffect } from 'react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import {
  X,
  Compass,
  Zap,
  ShieldCheck,
  Lock,
  Cpu,
  RefreshCw,
  ChevronRight
} from 'lucide-react';

interface RuleCardProps {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  shortFormula: string;
  fullPrinciple: string;
  checklist: string[];
  onApply: () => void;
}

const CONCURRENCY_RULE_CARDS: Array<Omit<RuleCardProps, 'onApply'>> = [
  {
    id: 'LOOM_CARRIER_PINNING',
    name: '1. Loom: Защита от Carrier Pinning',
    badge: 'Virtual Threads LTS',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Cpu className="w-5 h-5 text-purple-600" />,
    shortFormula: 'Используйте ReentrantLock вместо synchronized для исключения пиннинга несущего OS-потока.',
    fullPrinciple: 'Блок synchronized или нативный вызов внутри виртуального потока Loom привязывает (pins) его к несущему пулу ForkJoinPool. Замена на ReentrantLock позволяет виртуальному потоку корректно освобождать carrier-поток во время блокирующих операций ввода-вывода.',
    checklist: [
      'Заменены ли блоки synchronized на ReentrantLock в критических секциях?',
      'Отсутствует ли пиннинг при вызове блокирующего I/O?',
      'Проверена ли работа сервиса флагом -Djdk.tracePinnedThreads=full?'
    ]
  },
  {
    id: 'JMM_HAPPENS_BEFORE',
    name: '2. Видимость Памяти и JMM (Happens-Before)',
    badge: 'Java Memory Model',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <Zap className="w-5 h-5 text-indigo-600" />,
    shortFormula: 'Разделяемые флаги объявляйте volatile или финализируйте поля для безопасной публикации.',
    fullPrinciple: 'Компилятор JIT и процессор имеют право переупорядочивать инструкции. Чтение и запись обычных полей не гарантируют видимость между ядрами CPU. Используйте volatile для флагов завершения, final для неизменяемых структур или AtomicReference.',
    checklist: [
      'Объявлены ли разделяемые флаги состояния как volatile?',
      'Гарантирована ли безопасная публикация (final поля в рекордах)?',
      'Отсутствует ли проверка double-checked locking без volatile?'
    ]
  },
  {
    id: 'ATOMIC_CAS_LOOPS',
    name: '3. Атомарное Изменение Стейта (CAS & ConcurrentHashMap)',
    badge: 'Race-Free State',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
    shortFormula: 'Применяйте ConcurrentHashMap.compute(), LongAdder и compareAndSet вместо грубых замков.',
    fullPrinciple: 'Шаблон "check-then-act" (if (!map.containsKey(k)) map.put(k, v)) приводит к классической гонке данных. Используйте атомарные методы ConcurrentHashMap: computeIfAbsent, compute, merge, либо атомики AtomicLong/LongAdder для высоконагруженных счетчиков.',
    checklist: [
      'Используется ли computeIfAbsent() вместо containsKey() + put()?',
      'Заменены ли примитивные инкременты (i++) на AtomicLong или LongAdder?',
      'Работает ли цикл CAS с обработкой неудачных попыток compareAndSet?'
    ]
  },
  {
    id: 'DEADLOCK_FREE_HIERARCHY',
    name: '4. Иерархия Захвата Замков (No Deadlocks)',
    badge: 'Защита от дедлоков',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <Lock className="w-5 h-5 text-rose-600" />,
    shortFormula: 'Захватывайте замки строго в порядке возрастания ID: min(id1, id2) -> max(id1, id2).',
    fullPrinciple: 'При параллельной обработке двух ресурсов встречные потоки неизбежно вызывают циклический дедлок. Сортировка ID перед захватом гарантирует ацикличность графа ожидания ресурсов. Всегда оборачивайте unlock() в блок finally.',
    checklist: [
      'Сортируются ли ключи ресурсов перед захватом блокировок?',
      'Гарантирован ли вызов unlock() в блоке finally?',
      'Используется ли tryLock(timeout) в сценариях с риском зависания?'
    ]
  },
  {
    id: 'LOCK_FREE_DISRUPTOR',
    name: '5. Неблокирующие Очереди и Память CPU',
    badge: 'High-Load & Cache Lines',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <RefreshCw className="w-5 h-5 text-amber-600" />,
    shortFormula: 'LMAX Disruptor Ring Buffer, защита от False Sharing и пакетная обработка.',
    fullPrinciple: 'Блокирующие очереди (ArrayBlockingQueue) вызывают contention на замках и инвалидацию кэш-линий процессора (False Sharing). В сверхнагруженных пайплайнах применяйте кольцевой буфер Disruptor с последовательным курсором и padding.',
    checklist: [
      'Исключена ли блокировка потока-писателя в очереди сообщений?',
      'Защищены ли горячие указатели от False Sharing?',
      'Применяется ли пакетное чтение (batch draining) для утилизации CPU?'
    ]
  }
];

const RuleCard: React.FC<RuleCardProps> = ({
  name,
  badge,
  badgeColor,
  icon,
  shortFormula,
  fullPrinciple,
  checklist,
  onApply
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white border border-pastel-border shadow-xs hover:shadow-md transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">{icon}</div>
            <h4 className="font-bold text-xs text-slate-800 leading-tight">{name}</h4>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeColor}`}>
            {badge}
          </span>
        </div>

        <p className="text-xs font-semibold text-slate-700 mb-2 bg-slate-50/80 p-2 rounded-xl border border-slate-100/80">
          💡 {shortFormula}
        </p>

        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">{fullPrinciple}</p>

        <div className="space-y-1 mb-3 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Чек-лист инвариантов:
          </span>
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
              <span className="text-emerald-500 font-bold shrink-0">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onApply}
        type="button"
        className="w-full mt-2 py-1.5 px-3 rounded-xl bg-pastel-lavender/30 hover:bg-pastel-lavender/60 text-purple-900 border border-purple-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
      >
        <span>Обсудить с AI-напарником</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ConcurrencyCompassSheet: React.FC = () => {
  const { isCompassOpen, toggleCompass, groundRule, toggleOpen } = usePracticeTutorStore();
  const { activePracticeChallenge, practiceWorkspaceFiles, activeWorkspaceFileIndex } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleCompass();
      } else if (e.key === 'Escape' && isCompassOpen) {
        toggleCompass(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompassOpen, toggleCompass]);

  if (!isCompassOpen) return null;

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  const handleApplyRule = (ruleId: string) => {
    toggleCompass(false);
    toggleOpen(true);

    const context = {
      kataId: activePracticeChallenge?.id || 'concurrency',
      kataTitle: activePracticeChallenge?.title || 'Concurrency & Loom Challenge',
      kataCategory: 'Concurrency Lab',
      kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
      activeFilePath: currentFile?.path || 'src/main/java/ConcurrentService.java',
      activeFileContent: currentFile?.content || '',
      activeCompassRuleId: ruleId
    };

    groundRule(ruleId, context);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[90dvh] bg-pastel-bg border border-purple-200 shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-pastel-border bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Concurrency Компас: 5 Заповедей Многопоточности
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  Project Loom LTS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Виртуальные потоки, отсутствие пиннинга, Happens-Before, CAS-циклы и защита от дедлоков
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-500">
              Esc для закрытия
            </kbd>
            <button
              onClick={() => toggleCompass(false)}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONCURRENCY_RULE_CARDS.map((rule) => (
            <RuleCard
              key={rule.id}
              {...rule}
              onApply={() => handleApplyRule(rule.id)}
            />
          ))}

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 text-white border border-purple-500/30 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                High-Load Инспектор
              </span>
              <h4 className="font-bold text-xs text-white mt-2 mb-1.5">Парный Loom-эксперт</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Напарник анализирует точки синхронизации, выявляет Carrier Pinning и предупреждает о
                состояниях гонки данных и дедлоках до запуска тестов под нагрузкой.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-purple-200">
              <span>Горячая клавиша:</span>
              <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs font-bold">
                Ctrl + /
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
