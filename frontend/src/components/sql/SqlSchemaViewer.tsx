import React, { useState } from 'react';
import { Database, Copy, Check, TableProperties } from 'lucide-react';

interface SqlSchemaViewerProps {
  schemaSql: string;
  seedSql: string;
}

export const SqlSchemaViewer: React.FC<SqlSchemaViewerProps> = ({ schemaSql, seedSql }) => {
  const [copiedType, setCopiedType] = useState<'ddl' | 'seed' | null>(null);

  const handleCopy = (text: string, type: 'ddl' | 'seed') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Schema DDL Section */}
      <div className="rounded-2xl border border-pastel-border/80 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-pastel-border/60">
          <span className="font-bold text-slate-800 flex items-center gap-1.5 font-mono text-xs">
            <TableProperties className="w-4 h-4 text-pastel-accentIndigo" />
            DDL Структура Таблиц (PostgreSQL 16)
          </span>
          <button
            onClick={() => handleCopy(schemaSql, 'ddl')}
            className="flex items-center gap-1 text-[11px] text-pastel-muted hover:text-pastel-text transition-colors"
          >
            {copiedType === 'ddl' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Копировать DDL</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 font-mono text-[11px] text-slate-800 bg-slate-900/5 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
          {schemaSql}
        </pre>
      </div>

      {/* Seed Fixtures Section */}
      <div className="rounded-2xl border border-pastel-border/80 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-pastel-border/60">
          <span className="font-bold text-slate-800 flex items-center gap-1.5 font-mono text-xs">
            <Database className="w-4 h-4 text-emerald-600" />
            Тестовые Фикстуры & Данные с NULL
          </span>
          <button
            onClick={() => handleCopy(seedSql, 'seed')}
            className="flex items-center gap-1 text-[11px] text-pastel-muted hover:text-pastel-text transition-colors"
          >
            {copiedType === 'seed' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Копировать Seed</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 font-mono text-[11px] text-slate-800 bg-slate-900/5 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
          {seedSql}
        </pre>
      </div>
    </div>
  );
};
