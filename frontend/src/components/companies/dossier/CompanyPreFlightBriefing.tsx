/**
 * CompanyPreFlightBriefing.tsx
 * Structured pre-flight dossier & crib-sheet for Stage 1 (Product Engineer Fit & STAR).
 * Cognitive bounding limit: <= 250 lines (Rule 8).
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Sparkles, Shield, BarChart3, Star, CheckCircle2 } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export const CompanyPreFlightBriefing: React.FC<Props> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(compact ? true : false);

  return (
    <div className="mt-3 rounded-2xl border border-amber-200/90 bg-amber-50/50 overflow-hidden font-sans text-slate-800 transition-all">
      {!compact && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-amber-100/60 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-bold text-amber-950">
              📋 Предстартовый бриф: Product Engineer DNA, STAR и финтех-инварианты
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
              Шпаргалка к этапу
            </span>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-amber-800" /> : <ChevronDown className="w-4 h-4 text-amber-800" />}
        </button>
      )}

      {isOpen && (
        <div className="p-4 space-y-4 border-t border-amber-200/60 bg-white/70">
          <p className="text-xs text-slate-600 leading-relaxed">
            Собеседующий ИИ (Product Engineer Lead) оценивает ваше инженерное мышление от формулирования гипотез до продакшен-мониторинга. Ниже ключевые тезисы, на которые можно опираться при ответе:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Card 1: 5-Step Conversion Drop Root Cause */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Кейс: Просела конверсия на 12%</span>
              </div>
              <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside leading-snug">
                <li><strong>Проверить сбор данных:</strong> не сломался ли трекинг событий Kafka/ClickHouse после релиза.</li>
                <li><strong>Разложить воронку по шагам:</strong> найти конкретный экран, где возник отток клиентов.</li>
                <li><strong>Сегментировать аудиторию:</strong> iOS vs Android, новый vs действующий клиент, регион.</li>
                <li><strong>Сопоставить с релизами:</strong> деплои бэкенда, сбои внешних партнеров (СБП, Dadata).</li>
                <li><strong>План действий:</strong> локализовать баг, раскатать фикс или включить fallback под фича-флагом.</li>
              </ol>
            </div>

            {/* Card 2: Core Metrics */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Продуктовые метрики инженера</span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1 leading-snug">
                <li><strong>TTM (Time to Market):</strong> ускорение поставки фичи через Shift-Left тесты на Testcontainers.</li>
                <li><strong>Customer Pain Index:</strong> синтетический индекс боли (ошибки, откаты, жалобы); балансир техдолга.</li>
                <li><strong>SRM (Sample Ratio Mismatch):</strong> расхождение долей в A/B (50/50); сигнал сломанного сплиттера.</li>
                <li><strong>Conversion Lift%:</strong> процент относительного прироста целевого действия воронки.</li>
              </ul>
            </div>

            {/* Card 3: STAR Framework */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Star className="w-3.5 h-3.5 text-rose-600" />
                <span>STAR-фреймворк рассказа</span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1 leading-snug">
                <li><strong>Situation (20%):</strong> Контекст проекта, масштаб и бизнес-проблема.</li>
                <li><strong>Task (10%):</strong> Цель, сроки и требования регулятора/комплаенс.</li>
                <li><strong>Action (50%):</strong> Ваши личные действия («спроектировал Outbox», «детерминировал блокировки»).</li>
                <li><strong>Result (20%):</strong> Оцифрованный результат («TTM -35%», «0 дедлоков», «CR +1.8%»).</li>
              </ul>
            </div>

            {/* Card 4: FinTech Invariants */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Инварианты надежности Райффайзена</span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1 leading-snug">
                <li><strong>Zero Floating-Point:</strong> строгий запрет double/float в деньгах — только BigDecimal + HALF_EVEN.</li>
                <li><strong>Deadlock-Free Locks:</strong> сортировка PK min(id) -&gt; max(id) перед SELECT FOR UPDATE.</li>
                <li><strong>Сквозная идемпотентность:</strong> обязательный idempotencyKey в платежных мутациях.</li>
                <li><strong>Transactional Outbox:</strong> атомарная фиксация состояния БД и исходящих событий для Debezium CDC.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
