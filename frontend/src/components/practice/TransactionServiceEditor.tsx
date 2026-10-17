import React from 'react';
import { Flame } from 'lucide-react';
import {
  TransactionScenario,
  TransactionAnnotationConfig
} from '../../types/transactionLab';
import { TransactionAnnotationChip } from './TransactionAnnotationChip';

interface TransactionServiceEditorProps {
  services: TransactionScenario['services'];
  userConfigs: Record<string, TransactionAnnotationConfig>;
  selectedMethodId?: string;
  onSelectMethod: (methodId: string) => void;
  onMethodConfigChange: (methodId: string, cfg: TransactionAnnotationConfig) => void;
}

/**
 * TransactionServiceEditor.tsx (SOTA Late 2026).
 * Single responsibility: render service definitions, transactional method chips, and code snippets.
 * Cognitive bounding limit: <= 350 lines.
 */
export const TransactionServiceEditor: React.FC<TransactionServiceEditorProps> = ({
  services,
  userConfigs,
  selectedMethodId,
  onSelectMethod,
  onMethodConfigChange
}) => {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-500" />
          <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
            Архитектурный редактор сервисов Spring Boot
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 hidden sm:inline">
          Кликайте на плашку <span className="font-mono text-violet-600 font-bold">@Transactional</span> для настройки параметров
        </span>
      </div>

      <div className="space-y-4">
        {services.map((svc) => (
          <div key={svc.className} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="font-mono text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="text-violet-600">@Service</span>
              <span>public class {svc.className} {'{'}</span>
            </div>

            {svc.methods.map((method) => {
              const currentConfig = userConfigs[method.id] || { propagation: 'NONE' };
              const isSelected = selectedMethodId === method.id;

              return (
                <div
                  key={method.id}
                  onClick={() => onSelectMethod(method.id)}
                  className={`ml-4 sm:ml-6 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-violet-400 shadow-xs ring-2 ring-violet-200/60'
                      : 'bg-white/80 hover:bg-white border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                    <span className="font-bold text-slate-700">Контракт: </span>
                    {method.businessContract}
                  </div>

                  <div className="mb-1.5">
                    <TransactionAnnotationChip
                      config={currentConfig}
                      onChange={(cfg) => onMethodConfigChange(method.id, cfg)}
                      methodName={method.name}
                    />
                  </div>

                  <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                    <code>{method.codeSnippet}</code>
                  </pre>
                </div>
              );
            })}

            <div className="font-mono text-xs font-bold text-slate-800">{'}'}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
