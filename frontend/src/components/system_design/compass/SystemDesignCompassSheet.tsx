import React, { useState, useEffect } from 'react';
import {
  Compass,
  X,
  HardDrive,
  Database,
  Cpu,
  Clock,
  CheckCircle2,
  HelpCircle,
  Flame,
  Zap,
  Globe,
  Network,
  Server
} from 'lucide-react';
import { CodeViewer } from '../../CodeViewer';

interface SystemDesignCompassSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAskTutorAboutRule?: (ruleTitle: string, ruleSummary: string) => void;
}

interface CompassSection {
  id: string;
  number: string;
  title: string;
  badge: string;
  badgeColor: string;
  summary: string;
  detailsTable?: Array<{ metric: string; value: string; note: string }>;
  formulaOrCode?: string;
  checklist: string[];
}

const SYSTEM_DESIGN_RULES: CompassSection[] = [
  {
    id: 'latency-numbers',
    number: '01',
    title: 'Числа задержек, которые должен знать каждый архитектор (2026)',
    badge: 'Hardware Latencies',
    badgeColor: 'text-violet-700 bg-violet-100 border-violet-200',
    summary:
      'Ориентиры задержек аппаратного обеспечения для обоснования архитектурных компромиссов на собеседовании. Разница между RAM и SSD составляет 100-кратный порядок, а сетевой RTT в другой датацентр превышает такт CPU в миллионы раз.',
    detailsTable: [
      { metric: 'L1 Cache reference', value: '0.5 ns', note: 'Кэш первого уровня процессора' },
      { metric: 'Branch mispredict', value: '5 ns', note: 'Промах предсказателя ветвлений' },
      { metric: 'RAM access (DDR5)', value: '100 ns', note: 'Чтение из оперативной памяти' },
      { metric: 'NVMe SSD random read (4KB)', value: '15 µs', note: 'Случайное чтение блока с быстрого SSD' },
      { metric: 'Datacenter RTT (same DC)', value: '0.5 ms', note: 'Сетевой пинг внутри одного датацентра' },
      { metric: 'Sequential read 1MB (RAM)', value: '250 µs', note: 'Последовательное чтение 1MB из памяти' },
      { metric: 'Sequential read 1MB (NVMe)', value: '1 ms', note: 'Последовательное чтение 1MB с SSD' },
      { metric: 'Cross-continental RTT (EU-US)', value: '75–150 ms', note: 'Сетевой RTT через трансатлантический кабель' }
    ],
    checklist: [
      'Учитывается ли задержка сети при синхронных межсервисных вызовах (0.5-2 ms на хоп)?',
      'Обосновано ли применение Redis: кэширование в RAM (100 ns) против чтения с диска (15 µs - 1 ms)?',
      'Защищены ли критические пути от межконтинентальных синхронных вызовов (RTT 150 ms)?'
    ]
  },
  {
    id: 'cap-pacelc',
    number: '02',
    title: 'Теоремы CAP и PACELC: строгие компромиссы распределенных систем',
    badge: 'Consistency & Availability',
    badgeColor: 'text-blue-700 bg-blue-100 border-blue-200',
    summary:
      'CAP применим только при разделении сети (Partition). Теорема PACELC дополняет CAP: ЕСЛИ есть разделение (P) — выбор между Доступностью (A) и Согласованностью (C); ИНАЧЕ (E) — выбор между Задержкой (L) и Согласованностью (C).',
    formulaOrCode:
      'PACELC: If Partition -> choose (A vs C); Else -> choose (Latency vs Consistency)\nCassandra/DynamoDB: PA/EL | PostgreSQL/Spanner: PC/EC | MongoDB: PC/EC',
    checklist: [
      'Определен ли режим работы при обрыве сети: отказ в обслуживании (CP) или обслуживание устаревшими данными (AP)?',
      'Для финансовых систем и балансов выбран ли строгий PC/EC?',
      'Для лент соцсетей и лайков выбран ли низколатентный PA/EL (Eventually Consistent)?'
    ]
  },
  {
    id: 'storage-decision-tree',
    number: '03',
    title: 'Дерево выбора хранилищ данных (Data Store Decision Tree)',
    badge: 'Storage Engines',
    badgeColor: 'text-emerald-700 bg-emerald-100 border-emerald-200',
    summary:
      'Выбор СУБД должен строго следовать модели доступа (Access Patterns): транзакционная целостность, потоковые события, временные ряды или аналитические агрегаты.',
    detailsTable: [
      { metric: 'Relational (PostgreSQL, Cockroach)', value: 'ACID, Joins, Ledgers', note: 'Финансовые проводки, строгая консистентность' },
      { metric: 'Key-Value (Redis, Dragonfly)', value: 'Sub-ms, RAM, TTL', note: 'Кэширование, сессии, скользящие счетчики' },
      { metric: 'Append-Only Log (Apache Kafka)', value: 'Event Streaming, 1M+ RPS', note: 'Декуплинг, асинхронный буфер, Event Sourcing' },
      { metric: 'Wide-Column (ScyllaDB, Cassandra)', value: 'High Write Throughput, Time-Series', note: 'Геолокация, история чатов, метрики' },
      { metric: 'Columnar OLAP (ClickHouse)', value: 'Vectorized Aggregations', note: 'Аналитика, дашборды, аудит-логи' }
    ],
    checklist: [
      'Обосновано ли разделение на Read Path (чтение из кэша/реплик) и Write Path (запись в Master/Kafka)?',
      'Исключен ли антипаттерн использования РСУБД в качестве очереди сообщений под высокой нагрузкой?',
      'Предусмотрен ли паттерн Transactional Outbox + Debezium CDC при связке БД и Kafka?'
    ]
  },
  {
    id: 'sharding-hashing',
    number: '04',
    title: 'Шардирование и Consistent Hashing Ring',
    badge: 'Horizontal Scaling',
    badgeColor: 'text-amber-700 bg-amber-100 border-amber-200',
    summary:
      'Consistent Hashing с виртуальными нодами минимизирует перемещение ключей при добавлении или падении серверов (перемещается лишь k/N ключей). Выбор ключа шардирования определяет защиту от Hot Spots.',
    formulaOrCode:
      'Ключ шардирования (Partition Key):\n- Range-based: хорош для дат/диапазонов, но страдает от горячих точек (Hot-spotting на свежих данных)\n- Hash-based (MurmurHash3): равномерное распределение, но диапазонные запросы требуют Scatter-Gather',
    checklist: [
      'Используются ли виртуальные ноды (Virtual Nodes, 100–250 на сервер) для исключения неравномерности кольца?',
      'Защищен ли ключ шардирования от "эффекта знаменитости" (Celebrity / Hot Partition problem)?',
      'Продумана ли схема перешардирования и слияния сегментов?'
    ]
  },
  {
    id: 'caching-stampede',
    number: '05',
    title: 'Кэширование и предотвращение Cache Stampede (Dogpiling)',
    badge: 'Caching Hygiene',
    badgeColor: 'text-rose-700 bg-rose-100 border-rose-200',
    summary:
      'При инвалидации горячего ключа кэша тысячи параллельных запросов одновременно пробивают кэш и обрушивают базу данных. Решения: распределенный мьютекс (SingleFlight) или вероятностное раннее обновление (XFetch).',
    formulaOrCode:
      'Алгоритм XFetch (Probabilistic Early Expiration):\nΔ - время расчета, β > 0, r = random(0, 1)\nОбновить в фоне если: currentTime - (Δ * β * ln(r)) >= expirationTime',
    checklist: [
      'Применяется ли Cache-Aside с рандомизацией TTL (TTL Jitter ±15%) для предотвращения одновременного истечения?',
      'Используется ли паттерн SingleFlight / Mutex для пропуска к БД только одного потока?',
      'Рассмотрен ли алгоритм XFetch для обновления кэша в фоне до фактического истечения?'
    ]
  }
];

export const SystemDesignCompassSheet: React.FC<SystemDesignCompassSheetProps> = ({
  isOpen,
  onClose,
  onAskTutorAboutRule
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(SYSTEM_DESIGN_RULES[0].id);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeRule = SYSTEM_DESIGN_RULES.find((r) => r.id === activeTabId) || SYSTEM_DESIGN_RULES[0];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white/98 backdrop-blur-2xl rounded-3xl border border-violet-200/80 shadow-2xl overflow-hidden flex flex-col my-auto transition-all">
        {/* Header Bar */}
        <div className="px-5 sm:px-8 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-rose-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-200">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  System Design Compass
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                  5 Золотых Заповедей Архитектора
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Задержки оборудования 2026, теоремы CAP/PACELC, выбор хранилищ и защита от Cache Stampede
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
          {/* Rules Selector Sidebar (5 cols) */}
          <div className="md:col-span-5 p-4 border-r border-slate-100 bg-slate-50/60 space-y-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-2">
              Архитектурные разделы
            </span>
            <div className="space-y-1.5">
              {SYSTEM_DESIGN_RULES.map((rule) => {
                const isActive = rule.id === activeTabId;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setActiveTabId(rule.id)}
                    className={`w-full p-3 rounded-2xl text-left transition flex items-start gap-3 cursor-pointer border ${
                      isActive
                        ? 'bg-white text-slate-900 border-violet-300 shadow-sm ring-1 ring-violet-200'
                        : 'bg-transparent hover:bg-white/80 text-slate-600 border-transparent hover:border-slate-200 text-xs'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        isActive ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rule.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-snug">{rule.title}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{rule.badge}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Rule Workspace (7 cols) */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-5 bg-white">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${activeRule.badgeColor}`}>
                  {activeRule.badge}
                </span>
                <span className="text-xs text-slate-400 font-mono font-bold">
                  Заповедь {activeRule.number} / 05
                </span>
              </div>

              <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                {activeRule.title}
              </h3>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                {activeRule.summary}
              </p>

              {/* Details Table if present */}
              {activeRule.detailsTable && (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2 pl-3">Операция / Тип</th>
                        <th className="p-2">Задержка</th>
                        <th className="p-2 pr-3">Комментарий</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {activeRule.detailsTable.map((row, i) => (
                        <tr key={i} className="hover:bg-violet-50/40">
                          <td className="p-2 pl-3 font-semibold text-slate-800 font-sans">{row.metric}</td>
                          <td className="p-2 font-bold text-violet-700">{row.value}</td>
                          <td className="p-2 pr-3 text-slate-500 font-sans">{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Code / Formula box if present */}
              {activeRule.formulaOrCode && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                    Ключевой паттерн / Теорема:
                  </span>
                  <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xs">
                    <CodeViewer
                      code={activeRule.formulaOrCode}
                      language="java"
                      showLineNumbers={false}
                    />
                  </div>
                </div>
              )}

              {/* Checklist */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Контрольный список для собеседования:
                </span>
                <div className="space-y-1.5">
                  {activeRule.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-xs text-emerald-950 flex items-start gap-2"
                    >
                      <span className="font-bold font-mono text-emerald-700 shrink-0">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Горячая клавиша: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600 font-mono">Ctrl + /</kbd>
              </div>

              {onAskTutorAboutRule && (
                <button
                  type="button"
                  onClick={() => onAskTutorAboutRule(activeRule.title, activeRule.summary)}
                  className="py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Спросить Staff AI об этом принципе</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
