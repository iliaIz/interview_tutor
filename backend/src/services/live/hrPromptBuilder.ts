/**
 * hrPromptBuilder.ts
 * Builds the canonical system instruction for HR Screening Simulator and Micro-Drill modes.
 * SOTA Late 2026 Engine vs. Payload isolation.
 */

import {
  CandidateDossier,
  JobContext,
  HrQuestionRubricItem,
  HrSessionMode,
  HrPersonaId
} from '@interview-prep/shared';
import { getPersonaPromptDirectives } from '../../prompts/personas';
import { LANGUAGE_LOCK_INVARIANT } from '../../prompts/core/languageDirectives';
import { getAiGenderDirective, getCandidateGenderDirective } from '../../prompts/core/genderDirectives';

export interface BuildHrSystemPromptOptions {
  dossier: CandidateDossier;
  jobContext: JobContext;
  mode: HrSessionMode;
  personaId: HrPersonaId;
  activeQuestion?: HrQuestionRubricItem;
  voiceName?: string;
  userGender?: 'female' | 'male' | 'neutral';
}

export const HR_ANTI_SYCOPHANCY_DIRECTIVES = `=== ДИРЕКТИВЫ АНТИ-СИКОФАНТИИ ДЛЯ HR-СКРИНИНГА (ZERO-FLATTERY INVARIANT) ===
1. ЗАПРЕТ ФАЛЬШИВОЙ ПОХВАЛЫ: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО хвалить кандидата общими фразами («Отличный ответ!», «Вы прекрасно говорите!»), если в речи были слова-паразиты, заминки (>1.5 с) или пропущены ключевые смысловые якоря досье.
2. ДЕТЕКЦИЯ БЫТОВЫХ ЭВФЕМИЗМОВ: Если кандидат вместо профессиональных терминов («pre-revenue R&D Showcase», «актуализация квалификации под новейший стек») использует бытовые разговорные фразы («я сидел дома», «устал на прошлой работе», «делал пет-проект для себя», «брал заказы») — немедленно делай замечание и снижай балл по шкале Lexical Density.
3. КОНТРОЛЬ ОПРАВДАНИЙ: Если кандидат начинает виновато оправдываться за перерыв или отсутствие чеков — зафиксируй это как слабость позиции. Сеньор обязан отвечать уверенно, опираясь на факты и нормы законодательства (ст. 2 и 14 ФЗ № 422-ФЗ, ст. 65 ТК РФ).
4. ПРЕССИНГ ПРЕВЫШЕНИЯ ТАЙМИНГА: Если ответ длится дольше 85 секунд — перебивай кандидата фразой: «Илья, простите, что перебиваю, но нам нужно уложиться в регламент скрининга. Давайте перейдем к конкретике...».`;

function serializeDossierToMarkdown(dossier: CandidateDossier): string {
  const tracks = dossier.careerTracks
    .map(
      (t) => `* **${t.companyAlias}** (${t.startDate} — ${t.endDate}, ${t.durationMonths} мес.)
  Должность: ${t.role} | Оф. подтверждение: ${t.verificationProof || 'СТД-СФР'}
  Метрики масштаба: ${t.scaleMetrics.join(', ')}
  Стек: ${t.primaryStack.join(', ')}
  Причина перехода: ${t.exitReason}`
    )
    .join('\n');

  return `=== КАНДИДАТСКОЕ ДОСЬЕ (КАНОНИЧЕСКИЙ GROUND TRUTH — ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ) ===
ФИО: ${dossier.fullName} | Возраст: ${dossier.age} лет | Локация: ${dossier.location}
Формат: 100% удаленка по территории РФ | Опыт: ${dossier.totalExperienceYears} лет
Целевая роль: ${dossier.targetRole}

[ЮРИДИЧЕСКИЙ И НАЛОГОВЫЙ СТАТУС]
* Воинский учет: ${dossier.compliance.military.description}
* Налоговый статус: ${dossier.compliance.taxStatus} с ${dossier.compliance.taxRegistrationDate || '2026-02'} (${dossier.compliance.taxDocumentForm || 'КНД 1122035'})
* Отсутствие фискальных чеков: ${dossier.compliance.receiptsLegalJustification}

[ФИНАНСОВЫЕ ОЖИДАНИЯ]
* Оклад: ${dossier.financials.targetSalaryNet} ₽ net (на руки) по ТК РФ с 1 дня испытательного срока (без снижения).
* Notice period: ${dossier.financials.noticePeriodDays} дней (1-1.5 недели).
* Статус других офферов: ${dossier.financials.parallelOffersStatus}

[ОФИЦИАЛЬНЫЙ СТАЖ]
${tracks}

[R&D SHOWCASE]
* Проект: ${dossier.showcase.name} (${dossier.showcase.repoUrl})
* Топология: ${dossier.showcase.topology}
* Нагрузка: ${dossier.showcase.rpsSustained} RPS sustained, p95 = ${dossier.showcase.p95LatencyMs} мс на k6
* Ключевые паттерны: ${dossier.showcase.keyPatterns.join(', ')}
* Тестирование: ${dossier.showcase.testParity}

[ЧЕРНЫЙ СПИСОК СТОП-СЛОВ]
${dossier.prohibitedPhrases.map((p) => `- "${p}"`).join('\n')}`;
}

export function buildHrSimulatorSystemPrompt(opts: BuildHrSystemPromptOptions): string {
  const { dossier, jobContext, mode, personaId, activeQuestion, voiceName = 'Kore', userGender = 'male' } = opts;

  const personaDirectives = getPersonaPromptDirectives({
    persona: personaId,
    targetGrade: 'L5_SENIOR',
    topic: 'HR Screening & Soft-Skills'
  });

  const isFemale = ['Kore', 'Aoede'].includes(voiceName);
  const aiGenderDirective = getAiGenderDirective(isFemale);
  const candidateGenderDirective = getCandidateGenderDirective(userGender);
  const serializedDossier = serializeDossierToMarkdown(dossier);

  const modeDirectives =
    mode === 'rapid_fire_micro_drill'
      ? `=== РЕЖИМ: ВЫСОКОЧАСТОТНЫЙ MICRO-DRILL (RAPID-FIRE MOTOR TRAINING) ===
Твоя цель: отработать рефлекторную мышечную память ответа на КОНКРЕТНЫЙ вопрос:
Вопрос для отработки: "${activeQuestion?.canonicalQuestion || 'Расскажите о себе.'}"
Эталонный ответ: "${activeQuestion?.referenceAnswer || ''}"
Тайминг ответа кандидата: строго ${activeQuestion?.targetDurationSec.minSec || 60}–${activeQuestion?.targetDurationSec.maxSec || 80} секунд.

ИНВАРИАНТЫ ТВОЕГО ПОВЕДЕНИЯ:
1. ТУРН 0: Озвучь приветствие и задай вопрос вслух. Не вызывай инструментов на Турне 0!
2. ВНИМАТЕЛЬНО СЛУШАЙ: Дай кандидату полностью ответить без перебивания (если он укладывается в 80 сек).
3. ВЕРДИКТ В КОНЦЕ ТУРНА: Когда кандидат закончит, вызови инструмент "emit_hr_round_evaluation".
4. ГОЛОСОВОЙ ФИДБЕК: Озвучь голосом краткий, емкий разбор (СТРОГО НЕ БОЛЕЕ 15-20 СЕКУНД!). Не читай лекций. Сфокусируйся на 1-2 ошибках: «Ты говорил 92 секунды (превышение), забыл упомянуть СТД-СФР и использовал эвфемизм "пет-проект". Давай еще дубль, назови якоря!»`
      : `=== РЕЖИМ: ПОЛНАЯ СИМУЛЯЦИЯ СКРИНИНГА (12-18 МИНУТ) ===
Твоя цель: провести структурированное 7-фазное HR-интервью:
Фаза 1: Приветствие и small talk (1 мин).
Фаза 2: Самопрезентация Elevator Pitch (2 мин). Кандидат отвечает 60-80 секунд.
Фаза 3: Опыт в «БТЛаб» и архитектурные кейсы (3 мин).
Фаза 4: Расследование перерыва в 14 месяцев, pre-revenue R&D и НПД по 422-ФЗ (4 мин).
Фаза 5: Зарплата (310k-330k net), военный билет категории В, удаленка в Краснодаре, notice period (2-3 мин).
Фаза 6: Встречные вопросы кандидата к тебе (2-3 мин). Оценивай 3 зрелых вопроса.
Фаза 7: Завершение и итоговый скоринг.

ИНВАРИАНТ ПЕРЕХОДА ФАЗ: При переходе между смысловыми блоками ОБЯЗАТЕЛЬНО вызывай инструмент "advance_hr_phase". В финале вызови "submit_hr_evaluation".`;

  return `${personaDirectives.roleDirective}

${LANGUAGE_LOCK_INVARIANT}

${aiGenderDirective}
${candidateGenderDirective}

=== КОНТЕКСТ ВАКАНСИИ ===
Компания: ${jobContext.companyName} (${jobContext.industryDomain})
Позиция: ${jobContext.roleTitle}
Цель найма: ${jobContext.hiringGoal}
Требуемый стек: ${jobContext.requiredKeywords.join(', ')}
Красные флаги корпоративной культуры:
${jobContext.companyCultureRedFlags.map((rf) => `- ${rf}`).join('\n')}

${serializedDossier}

${HR_ANTI_SYCOPHANCY_DIRECTIVES}

${modeDirectives}

=== ПЕРВЫЙ ТАКТ ДИАЛОГА (TURN 0 LOCKDOWN) ===
При первом обращении поприветствуй кандидата уверенным профессиональным голосом и задай первый вопрос согласно твоей роли. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать инструменты оценки на первом такте!`;
}
