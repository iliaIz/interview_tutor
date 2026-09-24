import React, { useEffect } from 'react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import { TestingCompassRadar } from './TestingCompassRadar';
import {
  X,
  Compass,
  CheckCircle2,
  Crosshair,
  Layers,
  ShieldAlert,
  Clock,
  Sparkles,
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

const RULE_CARDS: Array<Omit<RuleCardProps, 'onApply'>> = [
  {
    id: 'AAA_PATTERN',
    name: '1. Паттерн AAA (Arrange — Act — Assert)',
    badge: 'Организация',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    shortFormula: 'Один тест — одно действие. Четкое разделение подготовки, вызова и проверки.',
    fullPrinciple: 'Тест должен визуально читаться как сценарий: Arrange готовит стабы и параметры, Act делает ровно один вызов, Assert верифицирует контракт через выразительный assertThat().',
    checklist: [
      'Тест разделен пустыми строками на 3 блока?',
      'В блоке Act ровно один вызов метода?',
      'Использован ли выразительный AssertJ?'
    ]
  },
  {
    id: 'MUTANT_ADVERSARY',
    name: '2. Тест как охотник на мутантов (Adversary)',
    badge: 'Охота на баги',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <Crosshair className="w-5 h-5 text-rose-600" />,
    shortFormula: 'Не просто "покрыть строчку", а доказать: если код сломается — тест упадет.',
    fullPrinciple: '100% Line Coverage ничего не гарантирует без проверки границ. Замена > на >= или удаление побочного эффекта обязано приводить к падению теста.',
    checklist: [
      'Проверена ли строгая граница (ниже, ровно, выше)?',
      'Проверены ли null, пустые строки и исключения?',
      'Упадет ли тест при комментировании строки логики?'
    ]
  },
  {
    id: 'STATE_VS_INTERACTION',
    name: '3. Состояние против Взаимодействия',
    badge: 'Архитектура проверок',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: <Layers className="w-5 h-5 text-sky-600" />,
    shortFormula: 'Предпочитайте проверку состояния (State) избыточному мокированию (verify).',
    fullPrinciple: 'Избыточный verify() связывает тест с реализацией и ломается при любом рефакторинге. Если метод возвращает значение — проверяйте результат, а verify() оставьте для void-команд.',
    checklist: [
      'Не проверяются ли через verify() приватные вызовы?',
      'Для void-методов проверено ли число вызовов (times(1), never())?',
      'Для сложных DTO использован ли ArgumentCaptor?'
    ]
  },
  {
    id: 'FOWLER_MOCKS_LAW',
    name: '4. Закон Моков Фаулера (Fowler’s Law)',
    badge: 'Границы изоляции',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <ShieldAlert className="w-5 h-5 text-amber-600" />,
    shortFormula: 'Мокайте только внешние границы (I/O, внешние API, Clock). Не мокайте домен.',
    fullPrinciple: 'Value Objects, Record, сущности и алгоритмы бизнес-логики обязаны создаваться настоящими (new). Моки нужны только для внешних границ и недетерминированного окружения.',
    checklist: [
      'Все DTO и Record создаются через new?',
      'Мокается только внешний порт/клиент?',
      'Тест не превратился в самоповтор (мок возвращает то же, что проверяется)?'
    ]
  },
  {
    id: 'DETERMINISM_AND_CLOCK',
    name: '5. Детерминизм и Виртуальное Время',
    badge: 'Детерминизм',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <Clock className="w-5 h-5 text-indigo-600" />,
    shortFormula: 'Никакого Thread.sleep(). Время инжектируется через java.time.Clock.',
    fullPrinciple: 'Тесты с Thread.sleep() нестабильны и медленны. Передавайте java.time.Clock в конструктор и используйте Clock.fixed() в тестах (выполнение за 0 мс). Для асинхронности — Awaitility.',
    checklist: [
      'В коде нет вызовов System.currentTimeMillis()?',
      'Используется Clock.fixed() для мгновенного сдвига времени?',
      'Асинхронные проверки используют Awaitility.untilAsserted()?'
    ]
  }
];

export const TestingCompassSheet: React.FC = () => {
  const { isCompassOpen, toggleCompass, groundRule } = usePracticeTutorStore();
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex
  } = useAppStore();

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCompassOpen) {
        toggleCompass(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompassOpen, toggleCompass]);

  if (!isCompassOpen) return null;

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  const handleApplyRule = (ruleId: string) => {
    groundRule(ruleId, {
      kataId: activePracticeChallenge?.id || 'kata',
      kataTitle: activePracticeChallenge?.title || 'Testing Kata',
      kataCategory: activePracticeChallenge?.category || 'Testing & Mutation',
      kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
      activeFilePath: currentFile?.path || 'src/test/java/Test.java',
      activeFileContent: currentFile?.content || '',
      survivingMutants: activePracticeChallenge?.mutants
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white/95 backdrop-blur-2xl rounded-3xl border border-pastel-accentRose/30 shadow-2xl overflow-hidden flex flex-col my-auto transition-all">
        {/* Header Bar */}
        <div className="px-5 sm:px-8 py-4 border-b border-pastel-border/60 bg-gradient-to-r from-[#FFF0F5] via-white to-pastel-lavender/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pastel-accentRose/10 border border-pastel-accentRose/30 flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5 text-pastel-accentRose" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                  Testing Compass: 5 Золотых Заповедей Инженера
                </h2>
                <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30">
                  Ctrl + /
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Квинтэссенция надежности тестов SOTA 2026. Нажмите «Применить к моему коду» для мгновенной проверки напарником.
              </p>
            </div>
          </div>

          <button
            onClick={() => toggleCompass(false)}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive 4-Axis Testing Radar */}
        <div className="px-4 sm:px-6 pt-4">
          <TestingCompassRadar />
        </div>

        {/* 5 Rules Cards Grid */}
        <div className="p-4 sm:p-6 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[58vh] overflow-y-auto">
          {RULE_CARDS.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col justify-between p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-pastel-accentRose/40 hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {rule.icon}
                    <span className="font-bold text-xs text-slate-800">{rule.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rule.badgeColor}`}>
                    {rule.badge}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-700 mb-2.5 leading-snug">
                  {rule.shortFormula}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  {rule.fullPrinciple}
                </p>

                <div className="space-y-1 mb-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Чек-лист:</div>
                  {rule.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                      <span className="text-pastel-accentRose font-bold mt-0.5">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleApplyRule(rule.id)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-pastel-rose hover:bg-pastel-accentRose text-pastel-accentRoseText hover:text-white text-xs font-bold border border-pastel-accentRose/30 transition shadow-2xs group-hover:shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Применить к моему коду</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          ))}

          {/* Quick Recap Card */}
          <div className="flex flex-col justify-between p-4 rounded-2xl bg-gradient-to-br from-pastel-lavender/30 via-pastel-rose/20 to-white border border-pastel-accentRose/20">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Compass className="w-5 h-5 text-pastel-accentRose" />
                <span className="font-bold text-xs text-slate-800">Как тренироваться?</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                1. Сначала напишите простой happy-path тест.<br />
                2. Запустите мутационный тест (Песочница JVM).<br />
                3. Если мутанты выжили — откройте этот компас (`Ctrl + /`) и проверьте граничные условия и assertions.<br />
                4. Используйте AI-напарника справа для вопросов и подсказок.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 italic text-center">
              «Хороший тест не просто проверяет код. Он защищает от глупых регрессий».
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-400">
          <span>Подсказка: нажимайте <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">Ctrl + /</kbd> в любой момент в редакторе</span>
          <button
            onClick={() => toggleCompass(false)}
            className="text-xs font-semibold text-pastel-accentRose hover:underline cursor-pointer"
          >
            Вернуться в редактор
          </button>
        </div>
      </div>
    </div>
  );
};
