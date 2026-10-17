import React, { useState, useRef, useEffect } from 'react';
import { Settings2, Check, ChevronDown, Sparkles } from 'lucide-react';
import {
  TransactionAnnotationConfig,
  PropagationType,
  IsolationLevel
} from '../../types/transactionLab';

interface TransactionAnnotationChipProps {
  config: TransactionAnnotationConfig;
  onChange: (newConfig: TransactionAnnotationConfig) => void;
  methodName: string;
}

const PROPAGATIONS: { type: PropagationType; label: string; desc: string }[] = [
  { type: 'REQUIRED', label: 'REQUIRED', desc: 'Присоединяется к существующей или создает новую' },
  { type: 'REQUIRES_NEW', label: 'REQUIRES_NEW', desc: 'Приостанавливает текущую и открывает независимую новую' },
  { type: 'NESTED', label: 'NESTED', desc: 'Создает JDBC Savepoint в рамках того же соединения' },
  { type: 'SUPPORTS', label: 'SUPPORTS', desc: 'Выполняется в транзакции, если есть, иначе без нее' },
  { type: 'MANDATORY', label: 'MANDATORY', desc: 'Требует активной транзакции, иначе бросает ошибку' },
  { type: 'NOT_SUPPORTED', label: 'NOT_SUPPORTED', desc: 'Приостанавливает транзакцию и работает без нее' },
  { type: 'NEVER', label: 'NEVER', desc: 'Бросает ошибку, если обнаружена активная транзакция' },
  { type: 'NONE', label: 'Без @Transactional', desc: 'Обычный метод без Spring AOP транзакций' }
];

const ISOLATIONS: { level: IsolationLevel; label: string }[] = [
  { level: 'DEFAULT', label: 'DEFAULT (СУБД)' },
  { level: 'READ_COMMITTED', label: 'READ_COMMITTED' },
  { level: 'REPEATABLE_READ', label: 'REPEATABLE_READ' },
  { level: 'SERIALIZABLE', label: 'SERIALIZABLE (SSI)' }
];

export const TransactionAnnotationChip: React.FC<TransactionAnnotationChipProps> = ({
  config,
  onChange,
  methodName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const formatAnnotationPreview = () => {
    if (config.propagation === 'NONE') {
      return '// Без @Transactional';
    }
    const params: string[] = [];
    if (config.propagation !== 'REQUIRED') {
      params.push(`propagation = Propagation.${config.propagation}`);
    }
    if (config.readOnly) {
      params.push('readOnly = true');
    }
    if (config.rollbackFor && config.rollbackFor.length > 0) {
      params.push(`rollbackFor = ${config.rollbackFor.join(', ')}`);
    }
    if (config.isolation && config.isolation !== 'DEFAULT') {
      params.push(`isolation = Isolation.${config.isolation}`);
    }
    if (config.timeout) {
      params.push(`timeout = ${config.timeout}`);
    }

    return params.length > 0 ? `@Transactional(${params.join(', ')})` : '@Transactional';
  };

  const isNone = config.propagation === 'NONE';

  return (
    <div className="relative inline-block my-1.5" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
          isNone
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300'
            : 'bg-gradient-to-r from-violet-50 to-rose-50 hover:from-violet-100 hover:to-rose-100 text-violet-800 border border-violet-300/80 shadow-xs'
        }`}
        title={`Настроить параметры @Transactional для метода ${methodName}()`}
      >
        <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
        <span className="truncate max-w-md">{formatAnnotationPreview()}</span>
        <ChevronDown className="w-3.5 h-3.5 text-violet-400 shrink-0" />
      </button>

      {/* Popover Settings Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] max-w-sm sm:max-w-md sm:w-96 p-4 rounded-2xl bg-white/98 backdrop-blur-xl border border-violet-200/90 shadow-2xl space-y-3.5 animate-fadeIn text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-violet-600" />
              Параметры @Transactional: {methodName}()
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded-lg hover:bg-slate-100"
            >
              Закрыть
            </button>
          </div>

          {/* Propagation Type */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Распространение (Propagation):
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROPAGATIONS.map((prop) => {
                const isSelected = config.propagation === prop.type;
                return (
                  <button
                    key={prop.type}
                    type="button"
                    onClick={() => onChange({ ...config, propagation: prop.type })}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-left transition flex items-center justify-between cursor-pointer border ${
                      isSelected
                        ? 'bg-violet-600 text-white border-violet-700 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title={prop.desc}
                  >
                    <span>{prop.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {!isNone && (
            <>
              {/* Isolation Level */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Уровень изоляции (Isolation):
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ISOLATIONS.map((iso) => {
                    const isSelected = (config.isolation || 'DEFAULT') === iso.level;
                    return (
                      <button
                        key={iso.level}
                        type="button"
                        onClick={() => onChange({ ...config, isolation: iso.level })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium text-left transition flex items-center justify-between cursor-pointer border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>{iso.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles: readOnly, rollbackFor */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.readOnly || false}
                    onChange={(e) => onChange({ ...config, readOnly: e.target.checked })}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                  />
                  <span className="font-semibold text-slate-700 text-[11px]">
                    readOnly = true (No Dirty Checking)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      config.rollbackFor?.includes('Exception.class') || false
                    }
                    onChange={(e) => {
                      const rollbackFor = e.target.checked ? ['Exception.class'] : [];
                      onChange({ ...config, rollbackFor });
                    }}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-slate-700 text-[11px]">
                    rollbackFor = Exception.class
                  </span>
                </label>
              </div>

              {/* Timeout */}
              <div className="pt-1 flex items-center gap-2">
                <span className="font-bold text-slate-700 text-[11px]">Timeout:</span>
                {[0, 3, 5, 10, 30].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ ...config, timeout: t > 0 ? t : undefined })}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold cursor-pointer border ${
                      (config.timeout || 0) === t
                        ? 'bg-violet-700 text-white border-violet-800'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {t === 0 ? 'Без лимита' : `${t}s`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
