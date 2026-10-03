import React, { useEffect } from 'react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import {
  X,
  Compass,
  Scissors,
  ShieldCheck,
  GitBranch,
  Layers,
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

const REFACTORING_RULE_CARDS: Array<Omit<RuleCardProps, 'onApply'>> = [
  {
    id: 'FEATHERS_SEAMS',
    name: '1. «Швы» по Физерсу (Legacy Seams)',
    badge: 'Working with Legacy',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <Scissors className="w-5 h-5 text-emerald-600" />,
    shortFormula: 'Найдите место изменения поведения без редактирования самого класса (Object/Link Seams).',
    fullPrinciple: 'Шов (Seam) — это место в программе, где можно изменить поведение системы без правки исходного текста. Создание шва позволяет подставить тестовый дублер (Test Double) вместо прямого обращения к глобальному состоянию, синглтону или статической фабрике.',
    checklist: [
      'Выявлен ли шов для изоляции внешней зависимости?',
      'Возможно ли подставить тестовый дублер без переписывания класса?',
      'Сохранен ли исходный публичный контракт системы?'
    ]
  },
  {
    id: 'CHARACTERIZATION_TESTS',
    name: '2. Фиксирующие Тесты (Golden Master)',
    badge: 'Слепок поведения',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
    shortFormula: 'Зафиксируйте реальное поведение системы тестами ДО начала любого рефакторинга.',
    fullPrinciple: 'При работе с чужим или устаревшим кодом спецификации часто устарели. Characterization Tests фиксируют фактическое поведение системы («что она делает сейчас, включая странности»), создавая защитную сеть против скрытых регрессий.',
    checklist: [
      'Покрыт ли изменяемый метод тестами с широким набором входных данных?',
      'Зафиксированы ли результаты Golden Master до изменения логики?',
      'Проходят ли все фиксирующие тесты на 100% перед первым шагом рефакторинга?'
    ]
  },
  {
    id: 'SUBCLASS_AND_OVERRIDE',
    name: '3. Техника Subclass and Override Method',
    badge: 'Изоляция без DI',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <GitBranch className="w-5 h-5 text-amber-600" />,
    shortFormula: 'Выделите проблемный вызов (БД, время, сеть) в protected метод и переопределите в тесте.',
    fullPrinciple: 'Если легаси-класс не использует инжекцию зависимостей (DI) и вызывает new Service() или static-методы внутри, выделите этот вызов в protected метод. В тестовом пакете создайте тестового потомка (Testing Subclass) и переопределите метод, вернув заглушку.',
    checklist: [
      'Выделен ли неудобный вызов в protected-метод?',
      'Создан ли тестовый наследник для изоляции тяжелой инфраструктуры?',
      'Устранена ли необходимость поднимать внешние БД или сеть в юнит-тесте?'
    ]
  },
  {
    id: 'REPLACE_CONDITIONAL_POLYMORPHISM',
    name: '4. Замена Ветвлений на Полиморфизм',
    badge: 'Чистая архитектура',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <Layers className="w-5 h-5 text-indigo-600" />,
    shortFormula: 'Заменяйте раздутые if-else и switch на паттерн Стратегия или Java 21 Pattern Matching.',
    fullPrinciple: 'Длинные каскады условий с одинаковыми проверками типа нарушают принцип Open-Closed (OCP). Каждая ветка выделяется в отдельную стратегию, либо декомпозируется через исчерпывающий switch по sealed-иерархии типов.',
    checklist: [
      'Выделен ли общий интерфейс для вариативных алгоритмов?',
      'Устранены ли вложенные if-else глубиной более 2 уровней?',
      'Используется ли Pattern Matching с исчерпывающей проверкой?'
    ]
  },
  {
    id: 'SMELL_REMEDIATION_DEMETER',
    name: '5. Ликвидация Запахов Кода и Закон Деметры',
    badge: 'Code Smells',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <Sparkles className="w-5 h-5 text-rose-600" />,
    shortFormula: 'Декомпозируйте God Objects, устраняйте Feature Envy и цепочки вызовов a.getB().getC().',
    fullPrinciple: 'Класс, знающий структуру внутренних объектов своих соседей, создает хрупкую архитектуру. Применяйте принцип Tell, Don’t Ask: делегируйте операцию владельцу данных вместо вытаскивания кишок через геттеры.',
    checklist: [
      'Устранены ли длинные цепочки геттеров (нарушение закона Деметры)?',
      'Разбит ли класс на сфокусированные компоненты по Single Responsibility?',
      'Устранена ли зависть к чужим данным (Feature Envy)?'
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
            Чек-лист рефакторинга:
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
        className="w-full mt-2 py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
      >
        <span>Обсудить с AI-напарником</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const RefactoringCompassSheet: React.FC = () => {
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
      kataId: activePracticeChallenge?.id || 'refactoring',
      kataTitle: activePracticeChallenge?.title || 'Refactoring Kata',
      kataCategory: 'Refactoring Katas',
      kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
      activeFilePath: currentFile?.path || 'src/main/java/LegacyService.java',
      activeFileContent: currentFile?.content || '',
      activeCompassRuleId: ruleId
    };

    groundRule(ruleId, context);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[90dvh] bg-pastel-bg border border-emerald-200 shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-pastel-border bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Refactoring Компас: 5 Золотых Заповедей Легаси
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Michael Feathers
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Швы (Seams), Golden Master тесты, безопасная изоляция зависимостей и ликвидация запахов кода
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
          {REFACTORING_RULE_CARDS.map((rule) => (
            <RuleCard
              key={rule.id}
              {...rule}
              onApply={() => handleApplyRule(rule.id)}
            />
          ))}

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-emerald-500/30 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                Legacy Guardian
              </span>
              <h4 className="font-bold text-xs text-white mt-2 mb-1.5">Парный Рефакторинг-коуч</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Напарник контролирует сохранение внешнего поведения системы, помогает найти швы (Seams)
                и предостерегает от преждевременного переписывания без тестов.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-emerald-200">
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
