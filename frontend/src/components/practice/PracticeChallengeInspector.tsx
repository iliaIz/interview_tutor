import React from 'react';
import { CodingChallenge } from '../../types/practice';
import { getDifficultyColor } from './PracticeCatalogConstants';
import {
  Clock,
  CheckCircle2,
  Bug,
  Shield,
  FileCode,
  Loader2,
  RotateCcw,
  Play,
  ShieldAlert,
  Sparkles,
  Building2
} from 'lucide-react';

interface Props {
  activeChallenge: CodingChallenge;
  openingId: string | null;
  resettingId: string | null;
  onStartChallenge: (challengeId: string) => void;
  onResetDraft: (challengeId: string) => void;
}

export const PracticeChallengeInspector: React.FC<Props> = ({
  activeChallenge,
  openingId,
  resettingId,
  onStartChallenge,
  onResetDraft
}) => {
  const isRefactoring = activeChallenge.category === 'refactoring_kata' || Boolean(activeChallenge.smellsChecklist?.length);
  const isTesting = activeChallenge.track === 'testing_mutation' || activeChallenge.category === 'testing_mutation';

  return (
    <div className="lg:col-span-7 bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 sticky top-20 self-start">
      {/* Header with Task Code, Title & Metadata */}
      <div className="space-y-2 pb-4 border-b border-pastel-border/60">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-emerald-400 border border-slate-800 shadow-2xs">
              {activeChallenge.taskCode || activeChallenge.id}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
              {activeChallenge.badge}
            </span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getDifficultyColor(activeChallenge.difficulty)}`}>
              {activeChallenge.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-bold text-pastel-muted">
            <Clock className="w-3.5 h-3.5 text-pastel-accentViolet" />
            <span>Лимит времени: {activeChallenge.timeLimitMinutes} минут</span>
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-pastel-text tracking-tight">
          {activeChallenge.title}
        </h2>

        <p className="text-xs sm:text-sm text-pastel-muted leading-relaxed">
          {activeChallenge.shortDescription}
        </p>
      </div>

      {/* Dynamic Status Callout Banner */}
      {activeChallenge.status === 'COMPLETED' ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <span className="font-bold text-emerald-900 block text-xs">
                Задача успешно решена на {activeChallenge.lastScore || 100} баллов
              </span>
              <span className="text-[11px] text-emerald-700 leading-snug block">
                Решение прошло все верификации, тесты и архитектурные инварианты.
              </span>
            </div>
          </div>
        </div>
      ) : activeChallenge.status === 'IN_PROGRESS' || activeChallenge.status === 'FAILED' ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-200/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-amber-900 block text-xs truncate">
                Воркспейс в процессе решения (черновик сохранен)
              </span>
              <span className="text-[11px] text-amber-700 leading-snug block">
                Вы можете продолжить разработку или сбросить воркспейс до исходных файлов.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onResetDraft(activeChallenge.id)}
            disabled={resettingId === activeChallenge.id}
            className="px-3 py-1.5 rounded-xl bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
          >
            {resettingId === activeChallenge.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>Сбросить</span>
          </button>
        </div>
      ) : null}

      {/* Domain-Specific Invariants Callout Box */}
      {isRefactoring ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/80 via-rose-50/40 to-white border border-amber-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>Формат Code Review & Refactoring Arena (SOTA 2026)</span>
            </h4>
            {activeChallenge.companyTags && activeChallenge.companyTags.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                🏢 {activeChallenge.companyTags.join(', ')}
              </span>
            )}
          </div>
          <ul className="space-y-1 text-slate-700 font-sans list-disc pl-4 leading-relaxed text-[11px]">
            <li><strong>Устный аудит запахов:</strong> Называйте найденные дефекты и риски голосом — ИИ-собеседующий автоматически фиксирует их в скоркарде.</li>
            <li><strong>3-Gate In-Memory верификатор:</strong> Проверяет сохранение контрактов, запрещает Carrier Pinning под Loom, блокирует float/double в деньгах и требует инжекцию Clock.</li>
            <li><strong>Bar-Raiser Round:</strong> После прохождения тестов ответьте на устные архитектурные вопросы по компромиссам решения.</li>
          </ul>
        </div>
      ) : isTesting ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50/70 to-pink-50/40 border border-rose-200/80 space-y-2 text-xs">
          <h4 className="font-bold text-rose-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Bug className="w-3.5 h-3.5 text-rose-700" />
            <span>Инварианты мутационного тестирования (PITest SOTA)</span>
          </h4>
          <ul className="space-y-1 text-slate-700 font-sans list-disc pl-4 leading-relaxed text-[11px]">
            <li><strong>PITest Gregor Mutators:</strong> В исходный код инжектируются 5 мутантов (границы условий, пропуск вызовов, инверсия логики).</li>
            <li><strong>Killer Assertions:</strong> Ваш тест-сьют должен обнаружить и уничтожить 100% мутантов без ложных срабатываний.</li>
            <li><strong>Суб-150мс JVM Sandbox:</strong> Чистые Java 21 тесты без медленных внешних контейнеров с мгновенной обратной связью.</li>
          </ul>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/60 to-pastel-bg border border-purple-200/80 space-y-2 text-xs">
          <h4 className="font-bold text-purple-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Shield className="w-3.5 h-3.5 text-purple-700" />
            <span>Архитектурные требования (Hard Invariants)</span>
          </h4>
          <ul className="space-y-1 text-slate-700 font-sans list-disc pl-4 leading-relaxed text-[11px]">
            <li><strong>Временная виртуализация:</strong> Использовать только инжектированный <code className="text-purple-800 bg-purple-100/80 px-1 py-0.2 rounded font-mono">java.time.Clock</code> (запрет <code className="font-mono text-rose-700">System.currentTimeMillis()</code>).</li>
            <li><strong>Потокобезопасность:</strong> Поддержка параллельных запросов без гонок данных и блокировок несущих потоков (Virtual Threads Loom).</li>
            <li><strong>Чистота архитектуры:</strong> SOLID, нулевые утечки памяти, детерминированные тесты.</li>
          </ul>
        </div>
      )}

      {/* Target Tech Stack & Format */}
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <div className="bg-pastel-bg p-3 rounded-xl border border-pastel-border">
          <span className="text-pastel-muted block text-[10px] uppercase font-bold">Стек & Примитивы</span>
          <span className="font-bold text-pastel-text text-[11px] truncate block mt-0.5">
            {activeChallenge.targetStack}
          </span>
        </div>

        <div className="bg-pastel-bg p-3 rounded-xl border border-pastel-border">
          <span className="text-pastel-muted block text-[10px] uppercase font-bold">Формат сессии</span>
          <span className="font-bold text-pastel-accentRose text-[11px] block mt-0.5">
            {isRefactoring ? 'Voice-First Code Review' : activeChallenge.category === 'machine_coding' ? 'Phase 1 + Phase 2 (Burst)' : 'Single Session Kata'}
          </span>
        </div>
      </div>

      {/* Starter Files Preview */}
      <div className="space-y-1.5 text-xs">
        <span className="font-bold text-pastel-text block text-[11px] uppercase tracking-wider">
          📁 Стартовые файлы воркспейса:
        </span>
        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
          {activeChallenge.workspaceFiles && activeChallenge.workspaceFiles.length > 0 ? (
            activeChallenge.workspaceFiles.map((f, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-950 text-emerald-400 border border-slate-800 flex items-center gap-1">
                <FileCode className="w-3 h-3" /> {f.path.split('/').pop()}
              </span>
            ))
          ) : (
            <>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-emerald-400 border border-slate-800 flex items-center gap-1">
                <FileCode className="w-3 h-3" /> Solution.java
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-purple-300 border border-slate-800 flex items-center gap-1">
                <FileCode className="w-3 h-3" /> SolutionTest.java
              </span>
            </>
          )}
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-2">
        <button
          onClick={() => onStartChallenge(activeChallenge.id)}
          disabled={openingId === activeChallenge.id}
          className={`w-full py-3 px-5 rounded-2xl font-bold text-xs text-white transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation disabled:opacity-75 ${
            activeChallenge.status === 'COMPLETED'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
              : activeChallenge.status === 'IN_PROGRESS' || activeChallenge.status === 'FAILED'
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:opacity-95'
              : isRefactoring
              ? 'bg-gradient-to-r from-amber-600 via-rose-500 to-purple-600 hover:opacity-95 shadow-md'
              : 'bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95'
          }`}
        >
          {openingId === activeChallenge.id ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Инициализация воркспейса...</span>
            </>
          ) : activeChallenge.status === 'COMPLETED' ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Решить снова ({activeChallenge.lastScore || 100} баллов)</span>
            </>
          ) : activeChallenge.status === 'IN_PROGRESS' || activeChallenge.status === 'FAILED' ? (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Продолжить воркспейс в Арене (Enter)</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>{isRefactoring ? 'Открыть Refactoring Arena (Enter)' : 'Открыть воркспейс в Арене (Enter)'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
