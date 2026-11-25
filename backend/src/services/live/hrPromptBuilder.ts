/**
 * hrPromptBuilder.ts
 * Builds the canonical system instruction for HR Screening Simulator and Micro-Drill modes.
 * SOTA Late 2026 Engine vs. Payload isolation.
 */

import {
  CandidateDossier,
  JobContext,
  HrQuestionRubricItem,
  HrQuestionChunk,
  HrMicroBeat,
  HrBeatScope,
  HrSessionMode,
  HrPersonaId
} from '@interview-prep/shared';
import type { HrGuidedSessionState } from './hrGuidedStepper';
import { getPersonaPromptDirectives, PersonaCandidateSummary } from '../../prompts/personas';
import { LANGUAGE_LOCK_INVARIANT } from '../../prompts/core/languageDirectives';
import { getAiGenderDirective, getCandidateGenderDirective } from '../../prompts/core/genderDirectives';
import {
  EPISTEMIC_BENEVOLENCE_AXIOM,
  EPISTEMIC_TRIAGE_DIRECTIVE
} from '../../prompts/core/antiSycophancy';
import { DEFAULT_VOICE_NAME, sanitizeVoiceName } from '../../config/liveDefaults';

export interface BuildHrSystemPromptOptions {
  dossier: CandidateDossier;
  jobContext: JobContext;
  mode: HrSessionMode;
  personaId: HrPersonaId;
  activeQuestion?: HrQuestionRubricItem;
  activeChunk?: HrQuestionChunk;
  activeBeat?: HrMicroBeat;
  beatIndex?: number;
  totalBeats?: number;
  beatScope?: HrBeatScope;
  beatOutline?: string;
  guidedState?: HrGuidedSessionState;
  voiceName?: string;
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
}

export function extractCandidateSummary(dossier: CandidateDossier): PersonaCandidateSummary {
  const firstName = dossier.fullName.trim().split(/\s+/)[0] || dossier.fullName;
  const primaryTrack = dossier.careerTracks[0];
  const years = primaryTrack ? Number((primaryTrack.durationMonths / 12).toFixed(1)) : dossier.totalExperienceYears;
  return {
    firstName,
    location: dossier.location,
    salaryExpectation: `${dossier.financials.targetSalaryNet} ₽ net`,
    militarySummary: dossier.compliance.military.description,
    taxSummary: `${dossier.compliance.taxStatus}, ${dossier.compliance.taxRegistrationDate || 'актуальный период'}`,
    taxDocumentForm: dossier.compliance.taxDocumentForm || 'форма налогового учета не указана',
    verificationProof: primaryTrack?.verificationProof || 'официальное подтверждение стажа',
    legalBasis: dossier.compliance.receiptsLegalJustification,
    primaryCompany: primaryTrack?.companyAlias || 'предыдущее место работы',
    tenureLabel: primaryTrack ? `${years} лет (${primaryTrack.durationMonths} мес.)` : `${dossier.totalExperienceYears} лет`,
    scaleHeadline: primaryTrack?.scaleMetrics?.[0] || 'ключевые продуктовые метрики',
    showcaseThroughput: `${dossier.showcase.rpsSustained} RPS sustained (p95 = ${dossier.showcase.p95LatencyMs} мс на k6)`,
    primaryStack: primaryTrack?.primaryStack?.slice(0, 4).join(', ') || 'Java, Spring Boot, Kafka, PostgreSQL',
    prohibitedSample: dossier.prohibitedPhrases.slice(0, 3).map((p) => `«${p}»`).join(', ')
  };
}

export function buildHrAntiSycophancyDirectives(summary?: PersonaCandidateSummary): string {
  const firstName = summary?.firstName || 'Кандидат';
  const prohibitedSample = summary?.prohibitedSample || 'бытовые разговорные эвфемизмы из черного списка досье';
  const legalBasis = summary?.legalBasis || 'правовые нормы и официальные документы из досье';
  return `=== ДИРЕКТИВЫ АНТИ-СИКОФАНТИИ ДЛЯ HR-СКРИНИНГА (ZERO-FLATTERY INVARIANT) ===
${EPISTEMIC_BENEVOLENCE_AXIOM}

${EPISTEMIC_TRIAGE_DIRECTIVE}

1. ЗАПРЕТ ФАЛЬШИВОЙ ПОХВАЛЫ: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО хвалить кандидата общими фразами («Отличный ответ!», «Вы прекрасно говорите!»), если в речи были слова-паразиты, заминки (>1.5 с) или пропущены ключевые смысловые якоря досье.
2. ДЕТЕКЦИЯ БЫТОВЫХ ЭВФЕМИЗМОВ: Если кандидат вместо профессиональных терминов («pre-revenue R&D Showcase», «актуализация квалификации под новейший стек») использует бытовые разговорные фразы (${prohibitedSample}) — немедленно делай замечание и снижай балл по шкале Lexical Density.
3. КОНТРОЛЬ ОПРАВДАНИЙ: Если кандидат начинает виновато оправдываться за перерыв или отсутствие чеков — зафиксируй это как слабость позиции. Сеньор обязан отвечать уверенно, опираясь на факты и правовую базу (${legalBasis}).
4. ПРЕССИНГ ПРЕВЫШЕНИЯ ТАЙМИНГА: Если ответ длится дольше 85 секунд — перебивай кандидата фразой: «${firstName}, простите, что перебиваю, но нам нужно уложиться в регламент скрининга. Давайте перейдем к конкретике...».
5. АКСИОМА ЭПИСТЕМИЧЕСКОЙ ЗАБОТЫ И ДЕМАРКАЦИЯ: Вежливый тон рекрутера никогда не означает согласие с размытыми, юридически неграмотными или технически слабыми формулировками. Если часть ответа кандидата убедительна, а часть содержит бытовой эвфемизм или плавающую аргументацию — в первой же реплике четко отдели сильную часть от провальной и потребуй переформулировать слабый тезис по стандарту Senior/Staff.`;
}

export const HR_ANTI_SYCOPHANCY_DIRECTIVES = buildHrAntiSycophancyDirectives();

function serializeDossierToMarkdown(dossier: CandidateDossier): string {
  const tracks = dossier.careerTracks
    .map(
      (t) => `* **${t.companyAlias}** (${t.startDate} — ${t.endDate}, ${t.durationMonths} мес.)
  Должность: ${t.role} | Оф. подтверждение: ${t.verificationProof || 'не указано'}
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
* Налоговый статус: ${dossier.compliance.taxStatus} с ${dossier.compliance.taxRegistrationDate || 'н/д'} (${dossier.compliance.taxDocumentForm || 'не указана'})
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
  const {
    dossier,
    jobContext,
    mode,
    personaId,
    activeQuestion,
    activeChunk,
    activeBeat,
    beatIndex = 0,
    totalBeats = activeQuestion?.microBeats?.length || 1,
    beatScope = 'all_from_beat',
    beatOutline,
    guidedState,
    userGender = 'female',
    turnMode = 'auto'
  } = opts;
  const voiceName = sanitizeVoiceName(opts.voiceName, DEFAULT_VOICE_NAME);

  const candidateSummary = extractCandidateSummary(dossier);
  const personaDirectives = getPersonaPromptDirectives({
    persona: personaId,
    targetGrade: 'L5_SENIOR',
    topic: 'HR Screening & Soft-Skills',
    candidateSummary
  });
  const antiSycophancyDirectives = buildHrAntiSycophancyDirectives(candidateSummary);

  const isFemale = ['Kore', 'Aoede'].includes(voiceName);
  const aiGenderDirective = getAiGenderDirective(isFemale);
  const candidateGenderDirective = getCandidateGenderDirective(userGender);
  const serializedDossier = serializeDossierToMarkdown(dossier);

  const currentBeatNumber = (guidedState?.beatIndex ?? beatIndex) + 1;
  const beatBlockText = activeBeat
    ? `АКТИВНЫЙ МИКРО-БЛОК ${currentBeatNumber}/${totalBeats}: «${activeBeat.title}»
Неизменяемые факты (цитируются ТОЧНО): ${activeBeat.immutableFacts.join(' | ')}
Разнообразные естественные формулировки для твоего живого моделирования:
${activeBeat.spokenVariants.map((v, idx) => `  ${idx + 1}. «${v}»`).join('\n')}
HR-вопрос для ступени без подсказки: «${activeBeat.hrTriggerPrompt}»`
    : `Вопрос: «${activeQuestion?.canonicalQuestion || 'Расскажите о себе.'}»`;

  const guidedScopeLine =
    beatScope === 'single_beat'
      ? 'ИЗОЛИРОВАННЫЙ РЕЖИМ: тренируется строго этот 1 выбранный блок (Ступени 1 → 2 → 3 по кругу с разными формулировками).'
      : beatOutline
      ? `Маршрут блоков вопроса: ${beatOutline}`
      : '';

  const modeDirectives =
    mode === 'guided_zero_start'
      ? `=== РЕЖИМ: ОБУЧЕНИЕ «С ПОЛНОГО НУЛЯ» (4-RUNG GUIDED MICRO-CHUNKS / ЭХО-ПОВТОР) ===
Твоя роль: заботливый, но требовательный к фактам тренер моторики Ольга. Ты учишь кандидата с нуля по микро-шагам (8–15 слов за раз), постепенно убирая подсказки.
Вопрос: "${activeQuestion?.canonicalQuestion || 'Расскажите о себе.'}"
${guidedScopeLine ? `${guidedScopeLine}\n` : ''}${beatBlockText}

ЛЕСТНИЦА СТУПЕНЕЙ (FADING SCAFFOLDING):
- Ступень 1 (Эхо-повтор): Произнеси 1 короткую естественную фразу (8–15 слов) по смыслу блока и попроси кандидата повторить вслух.
- Ступень 2 (Свой перефраз): Попроси кандидата сказать ту же мысль ДРУГИМИ словами своими связками, сохраняя неизменяемые факты.
- Ступень 3 (Без подсказки): Задай реалистичный вопрос рекрутера без спойлеров и выслушай воспроизведение по памяти.
${beatScope === 'single_beat' ? '' : '- Ступень 4 (Сборка / Снежный ком): Объедините освоенные блоки в единый плавный фрагмент на 20–30 секунд.\n'}
ЖЁСТКИЙ ИНВАРИАНТ АНТИ-ПОПУГАЯ (PARAPHRASE DIVERSITY):
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО повторять одну и ту же формулировку дословно дважды подряд! Каждый раз меняй связки и порядок вводных слов, звучи как живой человек.
- НЕ заставляй кандидата зубрить связки — требуй 100% дословной точности ТОЛЬКО для неизменяемых фактов (${candidateSummary.verificationProof}, ${candidateSummary.taxDocumentForm}, цифры ${candidateSummary.tenureLabel} / ${candidateSummary.scaleHeadline} / ${candidateSummary.showcaseThroughput} / ${candidateSummary.salaryExpectation}) и пресекай стоп-слова (${candidateSummary.prohibitedSample}).

ГИБРИДНОЕ УПРАВЛЕНИЕ ПРОГРЕССОМ (ГОЛОС + КНОПКИ):
- Когда кандидат говорит голосом («дальше», «следующий шаг», «давай другой вариант», «скажи иначе», «следующий блок», «перейдём к блоку про...», «повторим») ИЛИ уверенно справился с текущей ступенью — ОБЯЗАТЕЛЬНО вызови инструмент "advance_hr_learning_step" (next_rung / next_variant / next_beat / prev_beat / select_beat с 0-based beatIndex / repeat_beat) и продолжай по его директиве!
- НИКОГДА не вызывай "advance_hr_learning_step" или инструменты оценки на Турне 0!`
      : mode === 'tutor_rehearsal'
      ? `=== РЕЖИМ: ИНТЕРАКТИВНАЯ РЕПЕТИЦИЯ И МОТОРИКА РЕЧИ (TUTOR REHEARSAL) ===
Твоя цель: отработать моторику речи и автоматизм ответа до стандарта Senior/Staff инженера.
Вопрос для отработки: "${activeQuestion?.canonicalQuestion || 'Расскажите о себе.'}"
Эталонный ответ: "${activeQuestion?.referenceAnswer || ''}"
${activeChunk ? `АКТИВНЫЙ ЧАНК ДЛЯ ОТРАБОТКИ: "${activeChunk.title}" (Якоря чанка: ${activeChunk.anchorIds.join(', ')}). Фокусируйся строго на содержании этого блока!` : 'ОТРАБОТКА ПОЛНОГО ОТВЕТА (все смысловые блоки).'}

ИНВАРИАНТЫ ТВОЕГО ПОВЕДЕНИЯ:
1. ТУРН 0: Поприветствуй кандидата уверенным голосом тренера Ольги и четко объяви задачу: ${activeChunk ? `«Отрабатываем блок: ${activeChunk.title}. Твоя задача — назвать ключевые якоря. Поехали!»` : `«Отрабатываем ответ на вопрос: ${activeQuestion?.canonicalQuestion || 'Расскажите о себе'}. Говори уверенно, называй якоря. Начинай!»`}. НЕ вызывай инструментов на Турне 0!
2. ВНИМАТЕЛЬНО СЛУШАЙ (ПРАВИЛО ПАУЗЫ): Если кандидат говорит связно, факты верны и стоп-слов нет — МОЛЧИ и дай развернуть мысль. Не перебивай на полуслове!
3. МОМЕНТАЛЬНЫЙ СТОП НА ОШИБКАХ (IN-FLIGHT CORRECTION): Если кандидат делает паузу после фразы со стоп-словом (${candidateSummary.prohibitedSample}) или искажает факты досье (занижает стаж, путает документы или цифры) — сразу останови: «Стоп. [Назови ошибку]. В твоем досье это называется [правильная формулировка]. Переговори эту фразу прямо сейчас!».
4. МГНОВЕННЫЙ ОТВЕТ НА ПРОСЬБУ О ПОМОЩИ: Если кандидат говорит «подскажи», «какая статья», «что дальше» или «забыла цифру» — сразу назови точный факт из досье в 1 предложении и добавь: «Повтори теперь своими словами!».
5. ТОЧНОСТЬ ФАКТОВ VS СВОБОДА ФОРМУЛИРОВОК: Требуй дословной точности ТОЛЬКО для документов и правовых норм (${candidateSummary.verificationProof}, ${candidateSummary.taxDocumentForm}, ${candidateSummary.legalBasis}), цифр (${candidateSummary.tenureLabel}, ${candidateSummary.scaleHeadline}, ${candidateSummary.showcaseThroughput}) и зарплаты (${candidateSummary.salaryExpectation}). Связки, переходы и мотивацию кандидат формулирует свободно своими словами. Не заставляй зубрить каждое слово!
6. НИКАКИХ ОЦЕНОК И СКОРИНГОВ: В режиме репетиции КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать инструменты оценки ("emit_hr_round_evaluation" или "submit_hr_evaluation"). Никаких баллов. Только живой голосовой разбор и прогоны!`
      : mode === 'rapid_fire_micro_drill'
      ? `=== РЕЖИМ: ВЫСОКОЧАСТОТНЫЙ MICRO-DRILL (RAPID-FIRE MOTOR TRAINING) ===
Твоя цель: отработать рефлекторную мышечную память ответа на КОНКРЕТНЫЙ вопрос:
Вопрос для отработки: "${activeQuestion?.canonicalQuestion || 'Расскажите о себе.'}"
Эталонный ответ: "${activeQuestion?.referenceAnswer || ''}"
Тайминг ответа кандидата: строго ${activeQuestion?.targetDurationSec.minSec || 60}–${activeQuestion?.targetDurationSec.maxSec || 80} секунд.

ИНВАРИАНТЫ ТВОЕГО ПОВЕДЕНИЯ:
1. ТУРН 0: Озвучь приветствие и задай вопрос вслух. Не вызывай инструментов на Турне 0!
2. ВНИМАТЕЛЬНО СЛУШАЙ: Дай кандидату полностью ответить без перебивания (если он укладывается в 80 сек).
3. ВЕРДИКТ В КОНЦЕ ТУРНА: Когда кандидат закончит, вызови инструмент "emit_hr_round_evaluation".
4. ГОЛОСОВОЙ ФИДБЕК: Озвучь голосом краткий, емкий разбор (СТРОГО НЕ БОЛЕЕ 15-20 СЕКУНД!). Не читай лекций. Сфокусируйся на 1-2 главных пропусках фактов из досье (${candidateSummary.verificationProof}, ключевых метрик или стоп-слов) и предложи повторить дубль с опорой на якоря.`
      : `=== РЕЖИМ: ПОЛНАЯ СИМУЛЯЦИЯ СКРИНИНГА (12-18 МИНУТ) ===
Твоя цель: провести структурированное 7-фазное HR-интервью:
Фаза 1: Приветствие и small talk (1 мин).
Фаза 2: Самопрезентация Elevator Pitch (2 мин). Кандидат отвечает 60-80 секунд.
Фаза 3: Опыт в «${candidateSummary.primaryCompany}» (${candidateSummary.tenureLabel}) и архитектурные кейсы (${dossier.showcase.name}) (3 мин).
Фаза 4: Расследование перерыва между проектами, ${dossier.showcase.topology} и налоговый статус (${candidateSummary.taxSummary}, ${candidateSummary.legalBasis}) (4 мин).
Фаза 5: Зарплата (${candidateSummary.salaryExpectation}), воинский статус (${candidateSummary.militarySummary}), локация (${candidateSummary.location}), notice period (${dossier.financials.noticePeriodDays} дней) (2-3 мин).
Фаза 6: Встречные вопросы кандидата к тебе (2-3 мин). Оценивай 3 зрелых вопроса.
Фаза 7: Завершение и итоговый скоринг.

ИНВАРИАНТ ПЕРЕХОДА ФАЗ: При переходе между смысловыми блоками ОБЯЗАТЕЛЬНО вызывай инструмент "advance_hr_phase". В финале вызови "submit_hr_evaluation".`;

  return `${personaDirectives.roleDirective}

${LANGUAGE_LOCK_INVARIANT}

${aiGenderDirective}
${candidateGenderDirective}
${turnMode === 'manual'
    ? '=== РЕЖИМ ХОДА (MANUAL PUSH-TO-TALK) ===\nКандидат сам отправляет законченный ответ кнопкой. Внимательно дождись сигнала завершения хода.'
    : '=== РЕЖИМ ХОДА (СВОБОДНЫЙ ДИАЛОГ / AUTO-VAD) ===\nВеди живой голосовой диалог без длинных монологов: дождись естественной паузы кандидата и реагируй кратко и по делу.'}

=== КОНТЕКСТ ВАКАНСИИ ===
Компания: ${jobContext.companyName} (${jobContext.industryDomain})
Позиция: ${jobContext.roleTitle}
Цель найма: ${jobContext.hiringGoal}
Требуемый стек: ${jobContext.requiredKeywords.join(', ')}
Красные флаги корпоративной культуры:
${jobContext.companyCultureRedFlags.map((rf) => `- ${rf}`).join('\n')}

${serializedDossier}

${antiSycophancyDirectives}

${modeDirectives}

=== ПЕРВЫЙ ТАКТ ДИАЛОГА (TURN 0 LOCKDOWN) ===
При первом обращении поприветствуй кандидата уверенным профессиональным голосом и задай первый вопрос согласно твоей роли. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать инструменты оценки на первом такте!`;
}
