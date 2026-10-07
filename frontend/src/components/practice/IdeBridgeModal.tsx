import React from 'react';
import { X, Download, Terminal, CheckCircle2, AlertCircle, Laptop, FolderCode, Sparkles, Loader2 } from 'lucide-react';
import { IdeBridgeStatus } from './useIdeBridge';

interface IdeBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: IdeBridgeStatus;
  workspaceDir: string | null;
  lastSyncTime: string | null;
  isDownloading: boolean;
  onDownloadZip: () => void;
  challengeTitle?: string;
}

export const IdeBridgeModal: React.FC<IdeBridgeModalProps> = ({
  isOpen,
  onClose,
  status,
  workspaceDir,
  lastSyncTime,
  isDownloading,
  onDownloadZip,
  challengeTitle
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pastel-accentRose/10 text-pastel-accentRose border border-pastel-accentRose/20">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">
                Решение задачи в IntelliJ IDEA
              </h3>
              <p className="text-xs text-slate-400">
                {challengeTitle || 'Интеграция с локальной IDE'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm">
          {/* Download Button Section */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-200 flex items-center gap-1.5">
                <FolderCode className="w-4 h-4 text-pastel-accentRose" />
                Готовый проект задачи (.zip)
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Maven, Java 21, JUnit 5, AssertJ и скрипт моста
              </div>
            </div>
            <button
              type="button"
              disabled={isDownloading}
              onClick={onDownloadZip}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-pastel-accentRose hover:bg-pastel-accentRose/90 text-white font-medium text-xs shadow-md transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Скачивание...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Скачать проект (.zip)</span>
                </>
              )}
            </button>
          </div>

          {/* 3 Simple Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Инструкция по запуску (3 шага)
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex gap-3 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-pastel-accentRose font-bold shrink-0">1</span>
                <div>
                  <span className="text-slate-200 font-medium">Распакуйте архив</span>
                  <p className="text-slate-400 mt-0.5">В любую папку на вашем компьютере (например, в <code className="text-slate-300">~/IdeaProjects/task/</code>).</p>
                </div>
              </div>

              <div className="flex gap-3 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-pastel-accentRose font-bold shrink-0">2</span>
                <div>
                  <span className="text-slate-200 font-medium">Откройте папку в IntelliJ IDEA</span>
                  <p className="text-slate-400 mt-0.5">Меню <strong>File → Open</strong>. IDE сразу распознает стандартный Maven проект с Java 21.</p>
                </div>
              </div>

              <div className="flex gap-3 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-pastel-accentRose font-bold shrink-0">3</span>
                <div>
                  <span className="text-slate-200 font-medium">Запустите синхронизацию (в 1 клик)</span>
                  <p className="text-slate-400 mt-0.5">
                    <strong>Git Bash / Linux / Mac:</strong> запустите <code className="text-slate-300">./run-bridge.sh</code> (или <code className="text-slate-300">node bridge.mjs</code>)<br />
                    <strong>Windows:</strong> дважды кликните <code className="text-slate-300">run-bridge.cmd</code> в Проводнике
                  </p>
                  <p className="text-slate-500 mt-0.5 text-[11px]">(Работает на встроенном Node.js, без выкачивания node_modules)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Status Live Card */}
          <div className="pt-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Статус соединения с мостом
            </h4>
            {status === 'connected' || status === 'syncing' ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-emerald-200">
                    IntelliJ IDEA успешно подключена!
                  </div>
                  <div className="text-emerald-300/80">
                    Редактируйте код в IDE и сохраняйте (Ctrl+S). Все правки синхронизируются с веб-интерфейсом и ИИ-напарником.
                  </div>
                  {lastSyncTime && (
                    <div className="text-[11px] text-emerald-400/90 font-mono">
                      Последняя синхронизация: {lastSyncTime}
                    </div>
                  )}
                  {workspaceDir && (
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                      Папка: {workspaceDir}
                    </div>
                  )}
                </div>
              </div>
            ) : status === 'connecting' ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2.5 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                <div>Подключение к локальному мосту (ws://127.0.0.1:41789)...</div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-200">Ожидание запуска моста...</div>
                  <div className="text-slate-400 mt-0.5">
                    Запустите скрипт <code className="text-slate-300">run-bridge</code> на вашем компьютере. Статус обновится автоматически в течение пары секунд.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span>Локальные тесты запускаются в IDE, проверка инвариантов — в браузере.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
