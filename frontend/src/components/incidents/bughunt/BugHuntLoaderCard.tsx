import React, { useState, useEffect } from 'react';
import { Bug } from 'lucide-react';

const LOADER_STEPS = [
  'Анализ AST-дерева и выявление дефектов...',
  'Синтез антипаттерна в бизнес-логике...',
  'Генерация селектора сложности и подсказок...',
  'Подготовка контекста для AI-Техлида...'
];

const EDUCATIONAL_TRIVIA = [
  'Virtual Threads не ускоряют CPU-bound вычисления, но устраняют блокировку OS Threads при I/O.',
  'Вызов @Transactional метода из того же класса обходит CGLIB/JDK динамический прокси.',
  'Мутация полей объекта после добавления в HashSet ломает контракт hashCode() и приводит к утечкам памяти.',
  'ConcurrentHashMap.computeIfAbsent атомарен per-key, но не должен вызывать тяжелые блокирующие операции внутри лямбды.'
];

export const BugHuntLoaderCard: React.FC = () => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loaderStepIndex, setLoaderStepIndex] = useState(0);
  const [triviaIndex, setTriviaIndex] = useState(0);

  useEffect(() => {
    const secTimer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    const stepTimer = setInterval(() => setLoaderStepIndex((p) => (p + 1) % LOADER_STEPS.length), 3200);
    const triviaTimer = setInterval(() => setTriviaIndex((p) => (p + 1) % EDUCATIONAL_TRIVIA.length), 4500);

    return () => {
      clearInterval(secTimer);
      clearInterval(stepTimer);
      clearInterval(triviaTimer);
    };
  }, []);

  return (
    <div className="min-h-[420px] flex flex-col items-center justify-center p-6 bg-white/90 border border-pastel-border/80 rounded-3xl shadow-sm text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white shadow-md animate-pulse">
        <Bug className="w-6 h-6 animate-bounce" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-pastel-text">{LOADER_STEPS[loaderStepIndex]}</h3>
        <p className="text-xs text-pastel-muted font-mono">Генерация аутентичного кейса ({elapsedSeconds}с)</p>
      </div>
      <div className="w-full max-w-md p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border text-left">
        <span className="text-[10px] font-bold text-pastel-accentRose uppercase tracking-wider block mb-1">
          💡 Инсайт по теме
        </span>
        <p className="text-xs text-pastel-text leading-snug">{EDUCATIONAL_TRIVIA[triviaIndex]}</p>
      </div>
    </div>
  );
};
