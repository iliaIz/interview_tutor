import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Award,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Clock
} from 'lucide-react';

interface StarCase {
  id: number;
  title: string;
  tagline: string;
  badge: string;
  interviewQuestion: string;
  situation: string;
  task: string;
  action: string[];
  result: string;
  strongHireTakeaway: string;
  redFlagToAvoid: string;
}

const STAR_CASES: StarCase[] = [
  {
    id: 1,
    title: 'Преодоление барьеров комплаенса и безопасности',
    tagline: 'Согласование внешнего канала уведомлений без утечки банковской тайны',
    badge: '🔒 Безопасность & 395-1 ФЗ',
    interviewQuestion: '«В банке действует консервативный риск-аппетит. Опишите ситуацию, когда ваше техническое предложение было отклонено ИБ или комплаенс. Как вы итерировали решение, чтобы снять риски и доставить ценность?»',
    situation: 'Разрабатывали сервис мгновенных уведомлений о статусе переводов через стороннего мессенджер-бота для юридических лиц.',
    task: 'Служба информационной безопасности заблокировала передачу прямых данных о платеже (ФИО, номер счета, точная сумма) во внешний канал из-за риска утечки банковской тайны (ст. 26 395-1 ФЗ).',
    action: [
      'Вместо бесплодных споров с безопасниками предложил архитектурный компромисс через токенизацию.',
      'Во внешний канал отправляется обезличенный push с криптографическим одноразовым токеном (TTL 5 минут).',
      'При клике клиент бесшовно переходит в защищенный веб-контур банка с авторизацией по mTLS / OAuth2, где данные подтягиваются из защищенного периметра.',
      'Лично подготовил карточку рисков и защитил матрицу доступов на совместном комитете.'
    ],
    result: 'Решение согласовано ИБ за 3 рабочих дня без срыва релиза. Клиенты получили быстрые уведомления, а банк не нарушил регуляторные нормы.',
    strongHireTakeaway: 'Демонстрирует партнерский подход к ИБ: вместо позиции «безопасники мешают работать» инженер предлагает безопасную архитектурную альтернативу.',
    redFlagToAvoid: '«Безопасники у нас душные, пришлось пойти к директору, чтобы он продавил их». (Отказ за незрелость и конфликтность).'
  },
  {
    id: 2,
    title: 'Работа со сложным легаси и миграция монолита',
    tagline: 'Безопасный распил финансовой отчетности через Strangler Fig и Shadow Traffic',
    badge: '🏛️ Strangler Fig & Zero-Diff',
    interviewQuestion: '«Расскажите о случае, когда вам пришлось модернизировать неподдерживаемый легаси-код. Каков был ваш подход и итог?»',
    situation: 'Участвовал в распиле монолитной системы финансовой отчетности (Java 8 + IBM DB2) с хранимыми процедурами на 2 000 строк с неявной логикой расчета регуляторных рисков.',
    task: 'Перевести расчет рисков на современный микросервисный стек (Java 21, Spring Boot 3, PostgreSQL, Kafka) с абсолютным нулевым расхождением в расчетах.',
    action: [
      'Применил паттерн Strangler Fig (Душитель): отказался от рискованной попытки переписать всё с нуля.',
      'Написал набор Golden Master / Characterization тестов, зафиксировавших историческое поведение монолита на тысячах срезов данных.',
      'Развернул теневой режим (Shadow Traffic): монолит и новый микросервис параллельно считали риски, а компонент-компаратор алертил о любом расхождении в копейках.',
      'После 2 недель 100% совпадения результатов плавно переключил основной трафик через фича-флаг.'
    ],
    result: 'Время ночного расчета регуляторных рисков сократилось с 4.5 часов до 22 минут. Легаси-монолит успешно выведен из эксплуатации без единого сбоя.',
    strongHireTakeaway: 'Показывает инженерную зрелость: управление рисками через Characterization-тесты и Shadow Traffic вместо наивной слепой переписки.',
    redFlagToAvoid: '«Мы просто выкинули старый код и переписали за спринт, потом месяц ловили баги в проде». (Отказ за безответственность).'
  },
  {
    id: 3,
    title: 'Разбор собственной ошибки в проде (Blameless Post-Mortem)',
    tagline: 'Локализация аварии за 12 минут, анализ «5 Почему» и добавление регрессионных тестов',
    badge: '🚨 Blameless & 5 Whys',
    interviewQuestion: '«Опишите ситуацию, когда вы совершили ошибку. Что расстроило вас больше всего и как вы поступили бы сейчас?»',
    situation: 'При оптимизации запроса выгрузки истории транзакций добавил составной индекс и изменил порядок фильтрации в SQL.',
    task: 'Ускорить отклик сервиса истории операций в утренние часы пиковой клиентской активности.',
    action: [
      'В тестовой среде с малым объемом данных запрос работал мгновенно. Однако в проде из-за неравномерного распределения планировщик PostgreSQL выбрал Seq Scan.',
      'Это привело к 100% утилизации CPU на мастере БД и росту латентности смежных микросервисов.',
      'Немедленно откатил изменение по заранее заготовленному плану Rollback (git revert + передеплой). Инцидент купирован за 12 минут.',
      'Инициировал Blameless Post-Mortem по методу «5 Почему» и внедрил в CI/CD автоматическую проверку планов запросов (EXPLAIN ANALYZE) на тестовой базе с репрезентативным объемом данных.'
    ],
    result: 'Культура команды укрепилась, выработан системный guardrail в пайплайне, исключивший повторение подобных просадок производительности СУБД.',
    strongHireTakeaway: 'Способность открыто признавать ошибки, действовать хладнокровно по протоколу отката и устранять системную причину, а не искать виноватых.',
    redFlagToAvoid: '«Я никогда не ошибался в проде, у меня всегда идеальный код». Либо перекладывание вины на релиз-инженера или тестировщика.'
  },
  {
    id: 4,
    title: 'Отлов ошибок и галлюцинаций ИИ-агента',
    tagline: 'Выявление двойного списания при retry и потери точности в BigDecimal(double)',
    badge: '🤖 AI Safeguards & Invariants',
    interviewQuestion: '«Приведите пример, когда кодинг-агент ошибся в логике или архитектуре, и как именно вы это поймали. Что вы изменили в тестах и правилах?»',
    situation: 'При генерации сервиса интеграции с платежным шлюзом ИИ-агент сгенерировал клиент на WebClient с механизмом повторных попыток.',
    task: 'Обеспечить отказоустойчивое взаимодействие со сторонним финансовым шлюзом при нестабильной сети.',
    action: [
      'На Code Review заметил, что агент повесил безусловный @Retryable на ReadTimeoutException без передачи Idempotency-Key в запрос.',
      'При обрыве ответа после успешного списания повторный запрос привел бы к катастрофическому двойному списанию денег у клиента.',
      'Также агент использовал new BigDecimal(double) в конвертере валют, создавая незаметную потерю точности IEEE 754.',
      'Написал компонентный тест с WireMock, эмулирующий тайм-аут, который наглядно воспроизвел дублирование списания.',
      'Зафиксировал жесткие архитектурные инварианты в промпт-системе и настроил AST-правило линтера.'
    ],
    result: 'Потенциальный финансовый инцидент остановлен до попадания в ветку. В проекте появилось автоматизированное правило контроля финансовых вызовов.',
    strongHireTakeaway: 'Показывает глубокое понимание рисков AI-кодинга в 2026 году: фокус на инвариантах, идемпотентности и доказательном тестировании.',
    redFlagToAvoid: '«Я полностью доверяю ИИ, он пишет лучше людей, код даже не смотрю». (Мгновенный No Hire в Райффайзенбанке).'
  }
];

export const CompanyStarScenarios: React.FC = () => {
  const [activeCaseId, setActiveCaseId] = useState<number>(1);
  const activeCase = STAR_CASES.find((c) => c.id === activeCaseId) || STAR_CASES[0];

  return (
    <div className="space-y-4">
      {/* Selector Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {STAR_CASES.map((c) => {
          const isSelected = activeCaseId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCaseId(c.id)}
              className={`p-3 rounded-2xl text-left border transition-all ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-500 shadow-sm ring-1 ring-amber-400'
                  : 'bg-white text-slate-700 border-slate-200/90 hover:border-amber-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-wider opacity-80 mb-1">
                <span>Кейс {c.id}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-slate-700'}`} />
              </div>
              <div className="text-xs font-extrabold line-clamp-1 leading-snug">
                {c.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Case Card */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold font-mono text-amber-800 uppercase px-2.5 py-0.5 rounded-full bg-amber-100/70">
              {activeCase.badge}
            </span>
            <h4 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
              {activeCase.title}
            </h4>
            <p className="text-xs text-slate-700 mt-0.5">
              {activeCase.tagline}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-700 shrink-0 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-700" />
            <span>Хронометраж: 3–4 минуты</span>
          </div>
        </div>

        {/* The Exact Question */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold font-mono">
            <HelpCircle className="w-4 h-4 text-amber-700" />
            Формулировка вопроса на реальном собеседовании:
          </div>
          <p className="text-xs sm:text-sm text-slate-800 italic leading-relaxed">
            {activeCase.interviewQuestion}
          </p>
        </div>

        {/* STAR Framework Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Situation */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-indigo-700 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/60">
              S — Situation (Контекст)
            </span>
            <p className="text-xs text-slate-800 leading-relaxed pt-1">
              {activeCase.situation}
            </p>
          </div>

          {/* Task */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-purple-700 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200/60">
              T — Task (Сложность & Вызов)
            </span>
            <p className="text-xs text-slate-800 leading-relaxed pt-1">
              {activeCase.task}
            </p>
          </div>

          {/* Action */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5 md:col-span-2">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-amber-800 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60">
              A — Action (Конкретные действия от первого лица «Я», а не «Мы»)
            </span>
            <ul className="space-y-1.5 pt-1">
              {activeCase.action.map((step, idx) => (
                <li key={idx} className="text-xs text-slate-800 flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Result */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-1 md:col-span-2">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-emerald-800 px-2 py-0.5 rounded-md bg-emerald-100/70 border border-emerald-200/80">
              R — Result (Оцифрованный бизнес-итог)
            </span>
            <p className="text-xs text-slate-900 font-medium leading-relaxed pt-1">
              {activeCase.result}
            </p>
          </div>
        </div>

        {/* Footer: Strong Hire vs Red Flag */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1 text-xs">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Почему это дает Strong Hire:
            </span>
            <p className="text-slate-800 leading-relaxed">{activeCase.strongHireTakeaway}</p>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/70 space-y-1 text-xs">
            <span className="font-bold text-rose-900 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              Чего говорить категорически нельзя (Red Flag):
            </span>
            <p className="text-slate-800 leading-relaxed">{activeCase.redFlagToAvoid}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
