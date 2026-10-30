# Архитектурное проектирование HR\-тренажера Interview Tutor \- Google Gemini

**Date**: October 30, 2026 at 03:12 PM
**Turns**: 1
**Source**: [Gemini Chat](https://gemini.google.com/app/9893be21ef036ecb)

---

## Turn 1

### 🤖 ИИ Ассистент

### 1. Root Cause & Architecture Decision

#### Фундаментальная первопричина (Root Cause)

1. **Отсутствие детерминированного Ground Truth для субъективной фактологии:** В технических доменах (`interview`, `tutor`, `system_design`) модель опирается на претрейн по Computer Science. В HR-скрининге истиной является закрытая биографическая и юридическая легенда конкретного кандидата (7.4 года в ООО «БТЛаб» по СТД-СФР, 14 месяцев pre-revenue R&D Showcase на собственные средства, статус плательщика НПД с 02.2026 по справке КНД 1122035 без чеков согласно ст. 2 и ст. 14 ФЗ № 422-ФЗ, военный билет категории «В», 35 лет, вилка 310 000–330 000 ₽ net). Без жесткой инъекции структурированного досье (`CandidateDossier`) в системный промпт модель либо галлюцинирует факты, либо впадает в сикофантию, одобряя размытые бытовые формулировки.
2. **Блокировка префронтальной коры и отсутствие моторного стереотипа речи:** Чтение шпаргалки глазами формирует только пассивную декларативную память. В стрессовом голосовом диалоге кандидат теряет доступ к ключевым лексическим якорям («атомарный CTE-лизинг», «Spring AI + pgvector», «Loom non-pinning», «pre-revenue Showcase») и выходит за рамки целевого тайминга (60–80 секунд).
3. **Слепота текущего пайплайна к речевой телеметрии и потоковому трекингу терминов:** Текущий WebSocket-пайплайн пересылает PCM-аудио в Gemini Live API, но не извлекает потоковую транскрипцию речи пользователя (`inputAudioTranscription`) для мгновенной визуальной подсветки произнесенных якорей (Visual HUD), подсчета темпа речи (WPM), контроля длительности ответа и детекции слов-паразитов.

#### Архитектурное решение (Zero-Tech-Debt Extension)

1. **Единое ядро контрактов в `shared/src/index.ts`:** Устранение `any` в `LiveWsSessionParams` через строгие типы `SessionType`, `InterviewPersonaId = TechnicalPersonaId | HrPersonaId`, `CandidateDossier`, `HudAnchorStatus` и `SpeechTelemetrySnapshot`.
2. **Принцип Open-Closed для режимов и персон:**
  - Существующие режимы (`'interview' | 'tutor' | 'system_design'`) и технические персоны остаются нетронутыми.
  - Добавляются два специализированных режима: `'hr_simulation'` (сквозной 15-минутный звонок по матрице из 7 блоков с проверкой юридической и хронологической непротиворечивости) и `'hr_micro_drill'` (принудительный цикл отработки одного вопроса с мгновенным разбором до достижения 100% выбивания обязательных якорей в окне 60–80 секунд).
  - Добавляются три специализированные HR-персоны: `'hr_friendly_screener'` (доброжелательный рекрутер, проверяющий базовую адекватность, стек и софт-скиллы), `'hr_fintech_compliance'` (въедливый комплаенс-офицер банка/финтеха, копающий под СТД-СФР, перерыв в ТК, НПД без чеков и ФЗ-422) и `'hr_conflict_hunter'` (психолог, ищущий скрытые конфликты, выгорание, токсичность и причины ухода после 7.4 лет).
3. **Двухконтурный Real-Time HUD & Telemetry Engine:**
  - **Контур 1 (Низколатентный клиентский трекер + Gemini Input Transcription):** В `liveGeminiConfigBuilder.ts` включается `inputAudioTranscription: {}`. `liveWsConnectionHandler.ts` транслирует серверные события `inputTranscription` на фронтенд в виде фреймов `user_transcript_delta`. Клиентский детерминированный нормализатор (`keywordSpotter.ts`) по префиксам/стеммам сопоставляет живую речь с карточками якорей (`HudAnchorCard`), мгновенно подсвечивает их зеленым в HUD, рассчитывает WPM, отслеживает окно 60–80 секунд с привязкой к `@ricky0123/vad-web` и ловит слова-паразиты.
  - **Контур 2 (Семантический вердикт модели через Tool Calling):** В `liveToolDispatcher.ts` регистрируется декларативный инструмент `emit_hr_round_evaluation`, который модель вызывает в конце каждого ответа кандидата для фиксации точности легенды, отсутствия оправдательных интонаций и решения о переходе к следующему вопросу или перезапуске Micro-Drill.

### 2. Assumptions & Blind Spots
Перед началом модификации кода локальный CLI-агент обязан выполнить верификацию следующих допущений по реальной файловой системе:

1. **Межпакетный резолвинг `shared`:** Проверить `interview_tutor/backend/package.json`, `interview_tutor/frontend/package.json` и оба `tsconfig.json` на способ импорта из `shared/src/index.ts` (используется ли workspace-пакет `@interview-tutor/shared`, path alias `@shared/*` или относительный импорт `../../../shared/src`).
2. **Версия и типы `@google/genai`:** Проверить `interview_tutor/backend/src/services/geminiLiveProxy.ts` и `liveGeminiConfigBuilder.ts` на точную структуру конфигурационного объекта `LiveConnectConfig` (наличие поля `inputAudioTranscription`) и способ обработки входящих сообщений от Gemini WebSocket (`serverContent.inputTranscription` vs `serverContent.modelTurn`).
3. **Схема базы данных SQLite (`db.ts`):** Проверить `interview_tutor/backend/src/services/db.ts` на наличие `CHECK`-ограничений в таблицах сессий/вопросов для полей `session_type` и `persona`. Если ограничения зашиты в DDL, добавить миграцию.
4. **Структура фронтенд-сторов и компонентов:** Проверить точные имена файлов в `interview_tutor/frontend/src/stores/`, `frontend/src/hooks/` и `frontend/src/components/`, чтобы интегрировать `useHrTelemetryStore` и компонент `<HrHudOverlay/>` в существующий экран голосовой сессии без дублирования инстанса WebSocket или `@ricky0123/vad-web`.
Команда первичной разведки для CLI-агента:

```bash
ls -la C:/projects/synced_with_vps/interview_tutor/shared/src C:/projects/synced_with_vps/interview_tutor/frontend/src/stores C:/projects/synced_with_vps/interview_tutor/frontend/src/hooks C:/projects/synced_with_vps/interview_tutor/frontend/src/components

```

### 3. Data Contracts & Interfaces
Все новые и расширяемые контракты консолидируются в `shared/src/index.ts` и импортируются бэкендом и фронтендом:

```typescript
// ============================================================================
// ДОМЕННЫЕ ТИПЫ ПЕРСОН И СЕССИЙ
// ============================================================================

export type TechnicalPersonaId =
  | 'mentor'
  | 'amazon_bar_raiser'
  | 'google_staff'
  | 'yandex_core';

export type HrPersonaId =
  | 'hr_friendly_screener'
  | 'hr_fintech_compliance'
  | 'hr_conflict_hunter';

export type InterviewPersonaId = TechnicalPersonaId | HrPersonaId;

export type TargetGrade = 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF';

export type SessionType =
  | 'interview'
  | 'tutor'
  | 'system_design'
  | 'hr_simulation'
  | 'hr_micro_drill';

export function isHrSessionType(sessionType: SessionType): boolean {
  return sessionType === 'hr_simulation' || sessionType === 'hr_micro_drill';
}

export function isHrPersonaId(persona: string): persona is HrPersonaId {
  return (
    persona === 'hr_friendly_screener' ||
    persona === 'hr_fintech_compliance' ||
    persona === 'hr_conflict_hunter'
  );
}

// ============================================================================
// ДОСЬЕ КАНДИДАТА (GROUND TRUTH)
// ============================================================================

export interface HrQuestionRubricItem {
  id: string;
  title: string;
  canonicalQuestion: string;
  referenceAnswer: string;
  targetDurationSec: { min: number; max: number };
  requiredAnchors: HrAnchorDefinition[];
  forbiddenPatterns: string[]; // Фразы-триггеры неуверенности или искажения фактов
}

export interface HrAnchorDefinition {
  id: string;
  label: string;          // Отображаемый текст на HUD-карточке (напр. "СТД-СФР (7.4 г. БТЛаб)")
  category: 'legal' | 'architecture' | 'metrics' | 'compensation' | 'motivation';
  matchTokens: string[];  // Нормализованные подстроки/префиксы (все должны совпасть для срабатывания ИЛИ)
  synonyms?: string[][];  // Альтернативные наборы токенов, засчитывающие якорь
  weight: number;         // Вес от 1 до 3
}

export interface CandidateDossier {
  fullName: string;
  age: number;
  location: string;
  workFormat: string;
  targetRole: string;
  totalExperienceYears: number;
  compensationRangeNetRub: { min: number; max: number; probationPolicy: string };
  militaryStatus: { category: 'В'; description: string };
  noticePeriod: string;
  showcaseRepoUrl: string;
  employmentHistory: {
    companyName: string;
    AccreditedIt: boolean;
    durationYears: number;
    verificationDoc: string;
    scaleMetrics: string[];
    keyAchievements: string[];
  };
  rndPhase: {
    startPeriod: string;
    projectName: string;
    nature: 'pre-revenue R&D Showcase';
    stack: string[];
    loadMetrics: string;
    legalStatus: {
      regime: 'НПД (Самозанятость)';
      since: string;
      certificateCode: 'КНД 1122035';
      taxLawReference: 'ст. 2, 14 ФЗ № 422-ФЗ';
      zeroReceiptsJustification: string;
    };
  };
  elevatorPitchFramework: {
    anchor: string;
    build: string;
    bridge: string;
  };
  questionMatrix: HrQuestionRubricItem[];
}

// ============================================================================
// HUD & SPEECH TELEMETRY КОНТРАКТЫ
// ============================================================================

export interface HudAnchorState extends HrAnchorDefinition {
  hit: boolean;
  hitTimestampMs?: number;
  matchedPhrase?: string;
}

export type AnswerDurationZone = 'under' | 'optimal' | 'over';

export interface FillerWordHit {
  word: string;
  count: number;
}

export interface SpeechTelemetrySnapshot {
  activeTurnDurationSec: number;
  durationZone: AnswerDurationZone; // <60s: 'under', 60-80s: 'optimal', >80s: 'over'
  wordsPerMinute: number;
  paceStatus: 'too_slow' | 'optimal' | 'too_fast'; // Оптимум: 115 - 155 WPM
  totalWordsSpoken: number;
  fillerWordsTotal: number;
  fillerBreakdown: FillerWordHit[];
  anchorCoveragePercent: number;
  liveTranscript: string;
}

export interface HrRoundEvaluationPayload {
  questionId: string;
  passed: boolean;
  factualAccuracyScore: number; // 0..100
  confidenceToneScore: number;  // 0..100 (отсутствие оправдательного тона)
  detectedHallucinationsOrContradictions: string[];
  missedCriticalAnchors: string[];
  coachFeedback: string;
  nextAction: 'repeat_drill' | 'advance_next_question' | 'complete_session';
}

// ============================================================================
// WEBSOCKET СОБЫТИЯ (BACKEND -> FRONTEND)
// ============================================================================

export type HrServerWsEvent =
  | {
      type: 'hr_session_initialized';
      mode: 'hr_simulation' | 'hr_micro_drill';
      persona: HrPersonaId;
      activeQuestion: HrQuestionRubricItem;
      totalQuestions: number;
      currentQuestionIndex: number;
    }
  | {
      type: 'user_transcript_delta';
      textDelta: string;
      fullTurnTranscript: string;
      timestampMs: number;
    }
  | {
      type: 'hr_round_evaluation';
      evaluation: HrRoundEvaluationPayload;
    };

```

### 4. Atomic Execution Plan

#### Шаг 1: Консолидация общих типов и контрактов в `shared`

- **Целевой файл:** `interview_tutor/shared/src/index.ts`
- **Действие:** `MODIFY` (добавить экспорт контрактов из Раздела 3, сохранив все существующие экспорты файла).
- **Реализация:** Вставить блок определений `TechnicalPersonaId`, `HrPersonaId`, `InterviewPersonaId`, `TargetGrade`, `SessionType`, `CandidateDossier`, `HrQuestionRubricItem`, `HrAnchorDefinition`, `HudAnchorState`, `SpeechTelemetrySnapshot`, `HrRoundEvaluationPayload`, `HrServerWsEvent` и предикатов `isHrSessionType`, `isHrPersonaId`.
- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/shared && npx tsc --noEmit
  
  ```

#### Шаг 2: Создание структурированного Ground Truth досье кандидата (`candidateDossier.ts`)

- **Целевой файл:** `interview_tutor/backend/src/prompts/hr/candidateDossier.ts`
- **Действие:** `CREATE`
- **Реализация:**

```typescript
import { CandidateDossier, HrQuestionRubricItem } from '../../../../shared/src';

export const ILIA_IZHUKOV_DOSSIER: CandidateDossier = {
  fullName: 'Илья Геннадьевич Ижуков',
  age: 35,
  location: 'Краснодар',
  workFormat: '100% удаленка по РФ (готов к редким командировкам в Москву/СПб)',
  targetRole: 'Java Backend Engineer (Senior / Middle+)',
  totalExperienceYears: 8,
  compensationRangeNetRub: {
    min: 310000,
    max: 330000,
    probationPolicy: '310 000 — 330 000 ₽ net на руки по ТК РФ с первого дня испытательного срока без снижения',
  },
  militaryStatus: {
    category: 'В',
    description: 'Военный билет категории «В» на руках, не подлежит призыву, 35 лет',
  },
  noticePeriod: '1–1.5 недели (время на подписание документов и получение техники)',
  showcaseRepoUrl: 'https://github.com/izhukov-dev/event-ingestion-platform',
  employmentHistory: {
    companyName: 'ООО «БТЛаб»',
    AccreditedIt: true,
    durationYears: 7.4,
    verificationDoc: 'Электронная выписка СТД-СФР с Госуслуг с квалифицированной ЭЦП',
    scaleMetrics: ['15+ млн документов в БД', '5 000+ активных пользователей'],
    keyAchievements: [
      'Вырос с инженера до ведущего разработчика',
      'Распил монолита на микросервисы Spring Boot',
      'Проектирование асинхронного транспорта на Kafka и RabbitMQ',
      'Нагрузочное тестирование в JMeter',
      'Оптимизация PostgreSQL (устранение N+1, ускорение тяжелых выборок в 2–4 раза)',
    ],
  },
  rndPhase: {
    startPeriod: 'Весна 2025 (14 месяцев)',
    projectName: 'Event Ingestion Platform',
    nature: 'pre-revenue R&D Showcase',
    stack: [
      'Java 21 (Virtual Threads / Loom non-pinning)',
      'Spring Boot 3',
      'Transactional Outbox с атомарным CTE-лизингом',
      'Apache Kafka KRaft',
      'Spring AI + PostgreSQL pgvector (семантический гибридный поиск)',
      'Testcontainers + k6',
    ],
    loadMetrics: '2 200 RPS на k6',
    legalStatus: {
      regime: 'НПД (Самозанятость)',
      since: '02.2026',
      certificateCode: 'КНД 1122035',
      taxLawReference: 'ст. 2, 14 ФЗ № 422-ФЗ',
      zeroReceiptsJustification:
        'Проект развивался строго на собственные ресурсы как pre-revenue R&D Showcase. Коммерческих услуг сторонним клиентам не оказывалось, расчетов не велось, объект налогообложения отсутствовал согласно ст. 2 и ст. 14 ФЗ № 422-ФЗ, поэтому чеки закономерно не формировались.',
    },
  },
  elevatorPitchFramework: {
    anchor:
      'Более 7 лет (7.4 г.) в аккредитованной IT-компании ООО «БТЛаб», рост до ведущего разработчика, системы на 15+ млн документов и 5 000+ пользователей, подтверждено СТД-СФР с ЭЦП. Распил монолита на Spring Boot, Kafka, RabbitMQ, JMeter, оптимизация PostgreSQL в 2–4 раза.',
    build:
      'Весной 2025 года осознанная пауза на финансовой подушке для R&D проекта Event Ingestion Platform (pre-revenue Showcase): Java 21 Loom, Transactional Outbox с атомарным CTE-лизингом, Kafka KRaft, Spring AI + pgvector, нагрузка 2 200 RPS. С февраля 2026 оформлен НПД (КНД 1122035), без коммерческих продаж и чеков по ФЗ-422.',
    bridge:
      'Цикл R&D завершен, код и тесты на Testcontainers открыты на GitHub, целенаправленный возврат в стабильный продуктовый контур на долгосрочный full-time.',
  },
  questionMatrix: [
    {
      id: 'hr_q0_elevator_pitch',
      title: 'Самопрезентация (Elevator Pitch: Anchor — Build — Bridge)',
      canonicalQuestion: 'Расскажите о себе, вашем ключевом опыте и чем вы занимались последнее время.',
      referenceAnswer:
        'Меня зовут Илья, я Java Backend Engineer с 8 годами опыта. Более 7 лет я проработал в аккредитованной IT-компании ООО «БТЛаб», где вырос до ведущего разработчика на enterprise-системах (15+ млн документов, 5 000+ пользователей), стаж подтвержден выпиской СТД-СФР с ЭЦП. Занимался распилом монолита на Spring Boot, транспортом на Kafka и RabbitMQ, нагрузочным тестированием в JMeter и оптимизацией PostgreSQL в 2–4 раза. Весной 2025 года на финансовой подушке взял осознанную паузу для R&D и спроектировал Event Ingestion Platform — открытый pre-revenue Showcase на Java 21 Loom, Transactional Outbox с атомарным CTE-лизингом, Kafka KRaft и семантическим поиском Spring AI + pgvector с нагрузкой до 2 200 RPS. В феврале 2026 оформил НПД (справка КНД 1122035), коммерческих услуг не оказывал, поэтому чеков не велось. Сейчас цикл R&D завершен, возвращаюсь в стабильный продуктовый найм на full-time.',
      targetDurationSec: { min: 60, max: 80 },
      requiredAnchors: [
        {
          id: 'anc_btlab_sfr',
          label: 'ООО «БТЛаб» (7+ лет, СТД-СФР)',
          category: 'legal',
          matchTokens: ['бтлаб', 'стд'],
          synonyms: [['бтлаб', 'сфр'], ['бтлаб', 'госуслуг']],
          weight: 3,
        },
        {
          id: 'anc_scale_15m',
          label: '15+ млн док / 5000+ юзеров',
          category: 'metrics',
          matchTokens: ['15', 'миллион'],
          synonyms: [['пятнадцат', 'документ'], ['5000', 'пользовател'], ['пять', 'тысяч']],
          weight: 2,
        },
        {
          id: 'anc_pg_opt',
          label: 'Распил монолита + PostgreSQL (x2–4)',
          category: 'architecture',
          matchTokens: ['монолит', 'postgres'],
          synonyms: [['микросервис', 'kafka'], ['n+1', 'выборок']],
          weight: 2,
        },
        {
          id: 'anc_loom_outbox',
          label: 'Java 21 Loom + CTE Outbox',
          category: 'architecture',
          matchTokens: ['loom', 'outbox'],
          synonyms: [['виртуальн', 'поток', 'outbox'], ['cte', 'лизинг']],
          weight: 3,
        },
        {
          id: 'anc_spring_ai_pgvector',
          label: 'Spring AI + pgvector (2200 RPS)',
          category: 'architecture',
          matchTokens: ['pgvector', '2200'],
          synonyms: [['spring ai', 'семантич'], ['2 200', 'rps'], ['две тысячи двести']],
          weight: 3,
        },
        {
          id: 'anc_npd_knd',
          label: 'Pre-revenue Showcase + НПД (КНД 1122035)',
          category: 'legal',
          matchTokens: ['нпд', '1122035'],
          synonyms: [['самозанят', 'чеков'], ['showcase', 'собственн']],
          weight: 3,
        },
      ],
      forbiddenPatterns: ['не смог найти работу', 'искал работу год', 'фрилансил по мелочи', 'серая зарплата'],
    },
    {
      id: 'hr_q1_reason_for_leaving',
      title: 'Причина ухода из ООО «БТЛаб» после 7.4 лет',
      canonicalQuestion: 'Почему вы ушли из ООО «БТЛаб» после более чем 7 лет работы?',
      referenceAnswer:
        'В БТЛаб мы успешно закрыли все ключевые архитектурные вызовы по декомпозиции монолита и оптимизации БД, после чего система перешла в стадию спокойной эксплуатационной поддержки. Для меня как Senior-инженера было важно перейти на современный стек Java 21, Spring Boot 3, pgvector и высоконагруженные распределенные платформы. Расстались с руководством и командой в отличных конструктивных отношениях.',
      targetDurationSec: { min: 35, max: 60 },
      requiredAnchors: [
        {
          id: 'anc_q1_arch_closed',
          label: 'Закрыли архитектурные вызовы -> стадия поддержки',
          category: 'motivation',
          matchTokens: ['архитектур', 'поддержк'],
          synonyms: [['вызов', 'эксплуатац']],
          weight: 3,
        },
        {
          id: 'anc_q1_modern_stack',
          label: 'Переход на Java 21 / Spring Boot 3 / pgvector',
          category: 'architecture',
          matchTokens: ['java 21', 'spring'],
          synonyms: [['pgvector', 'высоконагруж'], ['новый стек']],
          weight: 2,
        },
        {
          id: 'anc_q1_good_terms',
          label: 'Расстались отлично / без конфликтов',
          category: 'motivation',
          matchTokens: ['расстал', 'отличн'],
          synonyms: [['хорош', 'отношен'], ['конструктивн']],
          weight: 2,
        },
      ],
      forbiddenPatterns: ['выгорел', 'конфликт с начальством', 'сократили', 'мало платили'],
    },
    {
      id: 'hr_q2_rnd_gap_explanation',
      title: 'Пауза в найме и R&D проект Event Ingestion Platform',
      canonicalQuestion: 'Чем вы занимались после увольнения из БТЛаб? Почему делали свой R&D проект, а не вышли сразу в штат?',
      referenceAnswer:
        'После 7.4 лет непрерывной работы я на сформированной финансовой подушке осознанно выделил время на глубокий инженерный апгрейд. Спроектировал с нуля распределенную платформу потокового сбора и семантической обработки данных Event Ingestion Platform как открытый архитектурный Showcase. В одиночку довести систему на Java 21 Loom, Transactional Outbox с CTE-лизингом, Kafka KRaft и pgvector до 2 200 RPS на k6 с полным покрытием Testcontainers потребовало полноценного цикла R&D.',
      targetDurationSec: { min: 45, max: 75 },
      requiredAnchors: [
        {
          id: 'anc_q2_pillow',
          label: 'Осознанный апгрейд на финансовой подушке',
          category: 'motivation',
          matchTokens: ['подушк', 'осознан'],
          synonyms: [['инженерн', 'апгрейд']],
          weight: 2,
        },
        {
          id: 'anc_q2_showcase_arch',
          label: 'Event Ingestion Platform (Loom, CTE Outbox, Kafka KRaft)',
          category: 'architecture',
          matchTokens: ['ingestion', 'outbox'],
          synonyms: [['cte', 'лизинг'], ['kafka', 'loom']],
          weight: 3,
        },
        {
          id: 'anc_q2_metrics',
          label: '2 200 RPS на k6 + Testcontainers',
          category: 'metrics',
          matchTokens: ['2200', 'testcontainers'],
          synonyms: [['2 200', 'k6'], ['две тысячи двести', 'rps']],
          weight: 3,
        },
      ],
      forbiddenPatterns: ['не брали на работу', 'отдыхал год', 'просто учился по курсам'],
    },
    {
      id: 'hr_q3_npd_compliance',
      title: 'Комплаенс НПД: отсутствие чеков и коммерческих заказчиков (ФЗ-422)',
      canonicalQuestion: 'Были ли у вашего проекта коммерческие заказчики? Почему по самозанятости нет чеков или договоров?',
      referenceAnswer:
        'Это строго pre-revenue R&D проект, созданный на собственные ресурсы как открытый инженерный Showcase. Сторонним клиентам коммерческих услуг не продавалось, расчетов не велось, поэтому объект налогообложения отсутствовал согласно статьям 2 и 14 ФЗ № 422-ФЗ, и чеки закономерно не формировались. Сам правовой статус плательщика НПД с февраля 2026 года подтверждается официальной справкой КНД 1122035 с ЭЦП ФНС, а инженерная квалификация — открытым кодом и нагрузочными тестами на GitHub.',
      targetDurationSec: { min: 40, max: 70 },
      requiredAnchors: [
        {
          id: 'anc_q3_prerevenue',
          label: 'Pre-revenue R&D на собственные ресурсы',
          category: 'legal',
          matchTokens: ['pre-revenue', 'собственн'],
          synonyms: [['пре-ревенью', 'ресурс'], ['showcase', 'коммерческ']],
          weight: 3,
        },
        {
          id: 'anc_q3_fz422',
          label: 'Отсутствие объекта налогообложения (ст. 2, 14 ФЗ-422)',
          category: 'legal',
          matchTokens: ['422', 'объект'],
          synonyms: [['налогообложен', 'расчет'], ['стать', '422']],
          weight: 3,
        },
        {
          id: 'anc_q3_knd1122035',
          label: 'Справка КНД 1122035 с ЭЦП ФНС + код на GitHub',
          category: 'legal',
          matchTokens: ['1122035', 'github'],
          synonyms: [['кнд', 'эцп'], ['кнд', 'справк']],
          weight: 3,
        },
      ],
      forbiddenPatterns: ['платили наличкой', 'платили в крипте', 'забыл пробить чеки', 'работал под NDA без договора'],
    },
    {
      id: 'hr_q4_compensation_and_logistics',
      title: 'Зарплатные ожидания, воинский учет, локация и срок выхода',
      canonicalQuestion: 'Сориентируйте по зарплатным ожиданиям, формату работы, воинскому учету и сроку выхода.',
      referenceAnswer:
        'По компенсации ориентируюсь на вилку 310 000 — 330 000 рублей net на руки при оформлении по ТК РФ, без снижения на время испытательного срока. Нахожусь в Краснодаре, рассматриваю 100% удаленный формат по РФ с готовностью к редким командировкам в Москву или Санкт-Петербург. По воинскому учету — на руках военный билет категории «В», не подлежу призыву, мне 35 лет. Выйти готов за 1–1.5 недели — на подписание документов и доставку техники.',
      targetDurationSec: { min: 35, max: 60 },
      requiredAnchors: [
        {
          id: 'anc_q4_salary',
          label: '310 000 – 330 000 ₽ net (ТК РФ, без снижения на ИС)',
          category: 'compensation',
          matchTokens: ['310', '330'],
          synonyms: [['триста десять', 'триста тридцать'], ['испытательн', 'без снижен']],
          weight: 3,
        },
        {
          id: 'anc_q4_military',
          label: 'Военный билет категории «В» (35 лет, не призывной)',
          category: 'legal',
          matchTokens: ['военн', 'категор'],
          synonyms: [['билет', '35 лет'], ['призыв', 'тридцать пять']],
          weight: 3,
        },
        {
          id: 'anc_q4_location_notice',
          label: 'Краснодар, 100% удаленка, выход 1–1.5 недели',
          category: 'compensation',
          matchTokens: ['краснодар', 'удален'],
          synonyms: [['полторы недел', 'выход'], ['1.5 недел', 'командировк']],
          weight: 2,
        },
      ],
      forbiddenPatterns: ['готов прогнуться по деньгам', 'военного билета нет'],
    },
  ],
};

export function getHrQuestionById(questionId: string): HrQuestionRubricItem {
  const found = ILIA_IZHUKOV_DOSSIER.questionMatrix.find((q) => q.id === questionId);
  return found ?? ILIA_IZHUKOV_DOSSIER.questionMatrix[0];
}

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/backend && npx tsc --noEmit
  
  ```

#### Шаг 3: Расширение `personas.ts` тремя специализированными HR-персонами

- **Целевой файл:** `interview_tutor/backend/src/prompts/personas.ts`
- **Действие:** `MODIFY`
- **Реализация:** Импортировать `InterviewPersonaId`, `TargetGrade`, `isHrPersonaId` из `shared` и добавить обработку трех HR-персон в `getPersonaPromptDirectives`:

```typescript
import {
  InterviewPersonaId,
  TargetGrade,
  isHrPersonaId,
} from '../../../shared/src';

export { InterviewPersonaId, TargetGrade };

export interface PersonaPromptContext {
  persona: InterviewPersonaId;
  targetGrade: TargetGrade;
  topic: string;
}

export function getPersonaPromptDirectives(context: PersonaPromptContext): {
  personaTitle: string;
  roleDirective: string;
  gradeExpectationDirective: string;
  evaluationRubricDirective: string;
} {
  if (isHrPersonaId(context.persona)) {
    switch (context.persona) {
      case 'hr_friendly_screener':
        return {
          personaTitle: 'Senior IT Recruiter (Доброжелательный скринер)',
          roleDirective:
            'Ты — опытный Senior IT-рекрутер крупной продуктовой компании. Твой тон деловой, спокойный, но профессионально цепкий. Ты проверяешь связность самопрезентации (Anchor — Build — Bridge), соответствие грейду Senior Java (8 лет стажа), адекватность по вилке 310–330к net и готовность к долгосрочному full-time. Не поддакивай, если кандидат мямлит или уходит в бытовые оправдания — вежливо проси сформулировать мысль через инженерные и продуктовые результаты.',
          gradeExpectationDirective:
            'Ожидается уверенная речь уровня L5 Senior без суеты, четкое владение архитектурной терминологией собственного проекта и уважительная подача прошлого опыта в ООО «БТЛаб».',
          evaluationRubricDirective:
            'Оценивай: 1) Уложился ли кандидат в 60–80 секунд без воды; 2) Назвал ли метрики (15+ млн документов, 5000+ пользователей, 2200 RPS); 3) Отсутствие извиняющихся интонаций за период R&D.',
        };

      case 'hr_fintech_compliance':
        return {
          personaTitle: 'Fintech HR Compliance Officer (Въедливый комплаенс-офицер банка)',
          roleDirective:
            'Ты — жесткий, прагматичный комплаенс-рекрутер системно значимого банка / финтеха. Твоя цель — проверить юридическую чистоту трудового стажа, документов воинского учета и налогового контура самозанятости. Ты задаешь прямые проверочные вопросы: «Чем подтверждается стаж 7.4 года в БТЛаб?», «Почему по НПД с февраля 2026 нет пробитых чеков — вы скрывали доход?», «Какая категория в военном билете?». Любую неуверенность или бытовое плавание трактуй как комплаенс-риск.',
          gradeExpectationDirective:
            'Кандидат обязан чеканить юридические и технические формулировки спокойно и без защитной агрессии: выписка СТД-СФР с ЭЦП, справка КНД 1122035 с ЭЦП ФНС, pre-revenue R&D Showcase на собственные средства, отсутствие объекта налогообложения по ст. 2 и ст. 14 ФЗ № 422-ФЗ, военный билет категории «В» (35 лет).',
          evaluationRubricDirective:
            'Оценивай: 1) Безупречную юридическую точность ссылок на СТД-СФР, КНД 1122035 и ст. 2, 14 ФЗ-422; 2) Отсутствие противоречий в датах; 3) Спокойный, достоинственный тон при ответе на провокационные вопросы о чеках и перерыве в ТК.',
        };

      case 'hr_conflict_hunter':
        return {
          personaTitle: 'HR Business Partner / Psychologist (Охотник за конфликтами и выгоранием)',
          roleDirective:
            'Ты — проницательный HRBP и корпоративный психолог. Ты ищешь красные флаги: выгорание после 7 лет на одном месте, скрытый конфликт с руководством БТЛаб, неспособность работать в команде после 14 месяцев одиночного R&D и риск того, что кандидат уйдет через полгода. Ты провоцируешь вопросами: «Неужели за 7 лет не надоело? Наверняка разругались с лидом?», «Вы больше года писали код в одиночку — как вы вообще сможете подчиняться процессам и код-ревью в энтерпрайзе?».',
          gradeExpectationDirective:
            'Кандидат должен демонстрировать эмоциональную зрелость L5 Senior: позитивный отзыв о прошлом работодателе, четкое разделение этапа автономного R&D апгрейда и осознанного желания вернуться в крупный продуктовый контур.',
          evaluationRubricDirective:
            'Оценивай: 1) Нулевую токсичность в адрес ООО «БТЛаб»; 2) Убедительность мостика (Bridge) к возврату в командный full-time; 3) Способность переводить психологические провокации в плоскость инженерных задач (Java 21 Loom, CTE Outbox, pgvector).',
        };
    }
  }

  // Существующая реализация для технических персон ('mentor' | 'amazon_bar_raiser' | 'google_staff' | 'yandex_core')
  // сохраняется без изменений ниже этой точки.

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/backend && npx tsc --noEmit
  
  ```

#### Шаг 4: Генератор системного промпта для HR Simulation и Micro-Drill (`hrPromptBuilder.ts`)

- **Целевой файл:** `interview_tutor/backend/src/prompts/hr/hrPromptBuilder.ts`
- **Действие:** `CREATE`
- **Реализация:**

```typescript
import {
  CandidateDossier,
  HrPersonaId,
  HrQuestionRubricItem,
  TargetGrade,
} from '../../../../shared/src';
import { getPersonaPromptDirectives } from '../personas';
import { ILIA_IZHUKOV_DOSSIER, getHrQuestionById } from './candidateDossier';

export interface BuildHrSystemPromptParams {
  mode: 'hr_simulation' | 'hr_micro_drill';
  persona: HrPersonaId;
  targetGrade: TargetGrade;
  activeQuestionId: string;
  dossier?: CandidateDossier;
}

export function buildHrSystemPrompt(params: BuildHrSystemPromptParams): string {
  const dossier = params.dossier ?? ILIA_IZHUKOV_DOSSIER;
  const activeQuestion: HrQuestionRubricItem = getHrQuestionById(params.activeQuestionId);
  const personaDirectives = getPersonaPromptDirectives({
    persona: params.persona,
    targetGrade: params.targetGrade,
    topic: activeQuestion.title,
  });

  const requiredAnchorsText = activeQuestion.requiredAnchors
    .map((a, idx) => `${idx + 1}. [${a.category.toUpperCase()}] ${a.label} (Вес: ${a.weight})`)
    .join('\n');

  const fullMatrixText = dossier.questionMatrix
    .map(
      (q, idx) =>
        `Блок ${idx + 1} (${q.id}): "${q.canonicalQuestion}"\n   Эталон: ${q.referenceAnswer}\n   Обязательные якоря: ${q.requiredAnchors.map((a) => a.label).join('; ')}`
    )
    .join('\n\n');

  const modeInstructions =
    params.mode === 'hr_micro_drill'
      ? `РЕЖИМ ТРЕНИРОВКИ: HR MICRO-DRILL (Выработка моторной памяти речевого аппарата).
1. Фокусируйся ИСКЛЮЧИТЕЛЬНО на текущем вопросе: "${activeQuestion.canonicalQuestion}".
2. Целевой тайминг ответа кандидата: ${activeQuestion.targetDurationSec.min}–${activeQuestion.targetDurationSec.max} секунд.
3. После каждого голосового ответа кандидата ОБЯЗАТЕЛЬНО вызови инструмент \`emit_hr_round_evaluation\`.
4. Если кандидат пропустил хотя бы один обязательный якорь с весом 3, допустил бытовые оправдания или исказил факты досье:
   - НЕ ХВАЛИ и не сглаживай углы (Zero-Sycophancy).
   - Коротко (за 15–20 секунд голосом) назови конкретный пропущенный термин (например: «Вы снова забыли назвать атомарный CTE-лизинг и номер справки КНД 1122035. Соберитесь, повторим с начала!»).
   - Потребуй немедленно повторить ответ на этот же вопрос целиком.
5. Только когда кандидат четко проговорил все ключевые якоря уверенным тоном, зафиксируй успех через \`emit_hr_round_evaluation\` с \`passed: true\`.`
      : `РЕЖИМ ТРЕНИРОВКИ: HR СКВОЗНОЙ ЗВОНОК (15-минутная симуляция первичного скрининга).
1. Веди реалистичный голосовой диалог по всем ${dossier.questionMatrix.length} блокам матрицы вопросов последовательно, начиная с самопрезентации (Elevator Pitch).
2. После каждого ответа кандидата вызывай инструмент \`emit_hr_round_evaluation\` для фиксации метрик раунда.
3. Если кандидат плывет на деталях (например, не назвал ФЗ-422 или категорию военного билета), задай 1 жесткий уточняющий фоллоу-ап в характере своей персоны, а затем переходи к следующему блоку.`;

  return `
# SYSTEM DIRECTIVE: HR SCREENING VOICE TRAINER (STRICT GROUND TRUTH & ZERO-SYCOPHANCY)

## 1. ТВОЯ РОЛЬ И ПЕРСОНА
- **Персона:** ${personaDirectives.personaTitle}
- **Директива поведения:** ${personaDirectives.roleDirective}
- **Ожидания к грейду (${params.targetGrade}):** ${personaDirectives.gradeExpectationDirective}
- **Рубрика оценки:** ${personaDirectives.evaluationRubricDirective}

## 2. АБСОЛЮТНЫЙ GROUND TRUTH (ДОСЬЕ КАНДИДАТА)
Запрещено придумывать любые биографические факты вне этого досье. Если кандидат называет цифры или факты, противоречащие досье ниже, немедленно лови его на противоречии:
- **ФИО и возраст:** ${dossier.fullName}, ${dossier.age} лет.
- **Локация и формат:** ${dossier.location}, ${dossier.workFormat}.
- **Целевая роль и стаж:** ${dossier.targetRole}, общий стаж ${dossier.totalExperienceYears} лет.
- **Компенсация:** ${dossier.compensationRangeNetRub.probationPolicy}.
- **Воинский учет:** ${dossier.militaryStatus.description}.
- **Срок выхода:** ${dossier.noticePeriod}.
- **Подтвержденный энтерпрайз-опыт:** ${dossier.employmentHistory.durationYears} года в аккредитованной IT-компании ${dossier.employmentHistory.companyName} (подтверждено: ${dossier.employmentHistory.verificationDoc}). Масштаб: ${dossier.employmentHistory.scaleMetrics.join(', ')}. Достижения: ${dossier.employmentHistory.keyAchievements.join('; ')}.
- **R&D фаза и правовой контур:** ${dossier.rndPhase.startPeriod}, проект ${dossier.rndPhase.projectName} (${dossier.rndPhase.nature}), репозиторий ${dossier.showcaseRepoUrl}. Стек: ${dossier.rndPhase.stack.join(', ')}. Нагрузка: ${dossier.rndPhase.loadMetrics}.
- **Юридическое обоснование НПД без чеков:** Режим ${dossier.rndPhase.legalStatus.regime} с ${dossier.rndPhase.legalStatus.since}, справка ${dossier.rndPhase.legalStatus.certificateCode}, ${dossier.rndPhase.legalStatus.taxLawReference}. ${dossier.rndPhase.legalStatus.zeroReceiptsJustification}

## 3. ${modeInstructions}

## 4. АКТИВНЫЙ ВОПРОС И ОБЯЗАТЕЛЬНЫЕ ЯКОРЯ (ДЛЯ ТЕКУЩЕГО РАУНДА)
- **ID вопроса:** ${activeQuestion.id}
- **Формулировка:** "${activeQuestion.canonicalQuestion}"
- **Эталонный ответ:** "${activeQuestion.referenceAnswer}"
- **Обязательные лексические якоря, которые кандидат ДОЛЖЕН произнести вслух:**
${requiredAnchorsText}
- **Запрещенные паттерны (триггеры провала):** ${activeQuestion.forbiddenPatterns.join(', ')}

## 5. ПОЛНАЯ МАТРИЦА СКРИНИНГА
${fullMatrixText}
`.trim();
}

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/backend && npx tsc --noEmit
  
  ```

#### Шаг 5: Интеграция HR-сессий в `liveWsSessionParams.ts` и `livePromptBuilder.ts`

- **Целевой файл:** `interview_tutor/backend/src/services/live/liveWsSessionParams.ts`
- **Действие:** `MODIFY`
- **Реализация:** Заменить нетипизированный `persona: any` и расширить `sessionType` за счет типов из `shared`:

```typescript
import {
  InterviewPersonaId,
  SessionType,
  TargetGrade,
} from '../../../../shared/src';

export interface LiveWsSessionParams {
  authenticatedUser: { id: string; email?: string; role?: string } | null;
  sessionType: SessionType;
  sessionId: string;
  questionId: string;
  topic: string;
  questionText: string;
  referenceAnswer: string;
  voiceName: string;
  userGender: 'female' | 'male' | 'neutral';
  turnMode: 'manual' | 'auto';
  strategy: 'adaptive_probing' | 'socratic_tutoring';
  persona: InterviewPersonaId;
  targetGrade: TargetGrade;
  maxProbes: number;
  anchors: string[];
  liveModel: string;
  upstreamWsUrl: string;
}

```

- **Целевой файл:** `interview_tutor/backend/src/services/live/livePromptBuilder.ts`
- **Действие:** `MODIFY`
- **Реализация:** В начале `buildSystemPrompt(params)` добавить делегирование в `buildHrSystemPrompt`, если `isHrSessionType(params.sessionType)`:

```typescript
import {
  InterviewPersonaId,
  SessionType,
  TargetGrade,
  isHrPersonaId,
  isHrSessionType,
} from '../../../../shared/src';
import { buildHrSystemPrompt } from '../../prompts/hr/hrPromptBuilder';

// Внутри функции buildSystemPrompt(params):
if (params.sessionType && isHrSessionType(params.sessionType)) {
  const hrPersona =
    params.persona && isHrPersonaId(params.persona)
      ? params.persona
      : 'hr_friendly_screener';
  return buildHrSystemPrompt({
    mode: params.sessionType,
    persona: hrPersona,
    targetGrade: (params.targetGrade as TargetGrade) ?? 'L5_SENIOR',
    activeQuestionId: params.questionId || 'hr_q0_elevator_pitch',
  });
}
// Далее выполняется штатная логика для 'interview' | 'tutor' | 'system_design' без изменений.

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/backend && npx tsc --noEmit
  
  ```

#### Шаг 6: Включение `inputAudioTranscription` и инструмента оценки HR-раунда в Gemini Live API

- **Целевой файл:** `interview_tutor/backend/src/services/live/liveGeminiConfigBuilder.ts`
- **Действие:** `MODIFY`
- **Реализация:**
  1. В конфигурацию сессии Gemini Live добавить `inputAudioTranscription: {}` (чтобы Gemini Live WebSocket присылал потоковую расшифровку голоса кандидата в реальном времени) и `outputAudioTranscription: {}`.
  2. При `isHrSessionType(params.sessionType)` добавить декларацию функции `emit_hr_round_evaluation` в массив `tools`:

```typescript
export const HR_EVALUATION_TOOL_DECLARATION = {
  name: 'emit_hr_round_evaluation',
  description:
    'Вызывается после каждого ответа кандидата в режимах hr_simulation и hr_micro_drill для фиксации выбитых якорей, точности фактов досье и решения о повторе или переходе дальше.',
  parameters: {
    type: 'OBJECT',
    properties: {
      questionId: { type: 'STRING' },
      passed: { type: 'BOOLEAN' },
      factualAccuracyScore: { type: 'NUMBER' },
      confidenceToneScore: { type: 'NUMBER' },
      detectedHallucinationsOrContradictions: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
      missedCriticalAnchors: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
      coachFeedback: { type: 'STRING' },
      nextAction: {
        type: 'STRING',
        enum: ['repeat_drill', 'advance_next_question', 'complete_session'],
      },
    },
    required: [
      'questionId',
      'passed',
      'factualAccuracyScore',
      'confidenceToneScore',
      'detectedHallucinationsOrContradictions',
      'missedCriticalAnchors',
      'coachFeedback',
      'nextAction',
    ],
  },
};

```

- **Целевой файл:** `interview_tutor/backend/src/services/live/liveToolDispatcher.ts`
- **Действие:** `MODIFY`
- **Реализация:** Добавить обработчик вызова `emit_hr_round_evaluation`, который валидирует аргументы как `HrRoundEvaluationPayload` и отправляет клиенту по WebSocket событие `{ type: 'hr_round_evaluation', evaluation }`.
- **Целевой файл:** `interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts`
- **Действие:** `MODIFY`
- **Реализация:**
  1. При старте сессии с `isHrSessionType(params.sessionType)` отправить клиенту инициализирующий пакет `HrServerWsEvent` с `type: 'hr_session_initialized'`, содержащий `activeQuestion` из `getHrQuestionById(params.questionId)` и список его `requiredAnchors`.
  2. При получении от Gemini Live фрейма с `serverContent?.inputTranscription?.text` аккумулировать текст текущего хода кандидата и немедленно отправлять во фронтенд-сокет фрейм:

```typescript
clientWs.send(
  JSON.stringify({
    type: 'user_transcript_delta',
    textDelta: deltaText,
    fullTurnTranscript: accumulatedTurnText,
    timestampMs: Date.now(),
  } satisfies HrServerWsEvent)
);

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/backend && npx tsc --noEmit
  
  ```

#### Шаг 7: Детерминированный Keyword Spotter и анализатор телеметрии на фронтенде

- **Целевой файл:** `interview_tutor/frontend/src/utils/hrSpeechAnalyzer.ts`
- **Действие:** `CREATE`
- **Реализация:**

```typescript
import {
  AnswerDurationZone,
  FillerWordHit,
  HrAnchorDefinition,
  HudAnchorState,
  SpeechTelemetrySnapshot,
} from '../../../shared/src';

const RUSSIAN_FILLER_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'ну', regex: /(?:^|\s)ну(?:\s|,|\.|$)/gi },
  { label: 'как бы', regex: /(?:^|\s)как\s+бы(?:\s|,|\.|$)/gi },
  { label: 'типа', regex: /(?:^|\s)типа(?:\s|,|\.|$)/gi },
  { label: 'короче', regex: /(?:^|\s)короче(?:\s|,|\.|$)/gi },
  { label: 'в общем', regex: /(?:^|\s)в\s+общем(?:\s|,|\.|$)/gi },
  { label: 'так сказать', regex: /(?:^|\s)так\s+сказать(?:\s|,|\.|$)/gi },
  { label: 'собственно', regex: /(?:^|\s)собственно(?:\s|,|\.|$)/gi },
  { label: 'вот', regex: /(?:^|\s)вот\s+вот(?:\s|,|\.|$)/gi },
  { label: 'э-э / м-м', regex: /(?:^|\s)(?:ээ+|мм+|эм+)(?:\s|,|\.|$)/gi },
];

export function normalizeTranscriptForMatching(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"—–\-.,!?:;()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function evaluateAnchorHits(
  anchors: HudAnchorState[],
  fullTranscript: string,
  nowMs: number = Date.now()
): HudAnchorState[] {
  const normalized = normalizeTranscriptForMatching(fullTranscript);
  if (!normalized) return anchors;

  return anchors.map((anchor) => {
    if (anchor.hit) return anchor; // Уже зажженный якорь не гаснет в рамках текущего ответа

    const tokenSets: string[][] = [
      anchor.matchTokens,
      ...(anchor.synonyms ?? []),
    ];

    for (const tokenSet of tokenSets) {
      const allMatched = tokenSet.every((token) =>
        normalized.includes(normalizeTranscriptForMatching(token))
      );
      if (allMatched) {
        return {
          ...anchor,
          hit: true,
          hitTimestampMs: nowMs,
          matchedPhrase: tokenSet.join(' + '),
        };
      }
    }

    return anchor;
  });
}

export function detectFillerWords(fullTranscript: string): {
  total: number;
  breakdown: FillerWordHit[];
} {
  const breakdown: FillerWordHit[] = [];
  let total = 0;

  for (const item of RUSSIAN_FILLER_PATTERNS) {
    const matches = fullTranscript.match(item.regex);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      total += count;
      breakdown.push({ word: item.label, count });
    }
  }

  return { total, breakdown };
}

export function computeSpeechTelemetry(params: {
  fullTranscript: string;
  activeTurnDurationSec: number;
  anchors: HudAnchorState[];
  targetWindowSec?: { min: number; max: number };
}): SpeechTelemetrySnapshot {
  const {
    fullTranscript,
    activeTurnDurationSec,
    anchors,
    targetWindowSec = { min: 60, max: 80 },
  } = params;

  const cleanWords = normalizeTranscriptForMatching(fullTranscript)
    .split(' ')
    .filter((w) => w.length > 0);
  const totalWordsSpoken = cleanWords.length;

  const minutes = Math.max(activeTurnDurationSec / 60, 0.05);
  const wordsPerMinute =
    activeTurnDurationSec >= 3 ? Math.round(totalWordsSpoken / minutes) : 0;

  let paceStatus: 'too_slow' | 'optimal' | 'too_fast' = 'optimal';
  if (wordsPerMinute > 0 && wordsPerMinute < 110) paceStatus = 'too_slow';
  if (wordsPerMinute > 160) paceStatus = 'too_fast';

  let durationZone: AnswerDurationZone = 'under';
  if (
    activeTurnDurationSec >= targetWindowSec.min &&
    activeTurnDurationSec <= targetWindowSec.max
  ) {
    durationZone = 'optimal';
  } else if (activeTurnDurationSec > targetWindowSec.max) {
    durationZone = 'over';
  }

  const fillers = detectFillerWords(fullTranscript);

  const totalWeight = anchors.reduce((acc, a) => acc + a.weight, 0);
  const hitWeight = anchors
    .filter((a) => a.hit)
    .reduce((acc, a) => acc + a.weight, 0);
  const anchorCoveragePercent =
    totalWeight > 0 ? Math.round((hitWeight / totalWeight) * 100) : 0;

  return {
    activeTurnDurationSec: Math.round(activeTurnDurationSec * 10) / 10,
    durationZone,
    wordsPerMinute,
    paceStatus,
    totalWordsSpoken,
    fillerWordsTotal: fillers.total,
    fillerBreakdown: fillers.breakdown,
    anchorCoveragePercent,
    liveTranscript: fullTranscript,
  };
}

export function createInitialHudAnchors(
  definitions: HrAnchorDefinition[]
): HudAnchorState[] {
  return definitions.map((def) => ({
    ...def,
    hit: false,
  }));
}

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/frontend && npx tsc --noEmit
  
  ```

#### Шаг 8: Zustand-стор состояния HR-тренажера (`useHrDrillStore.ts`)

- **Целевой файл:** `interview_tutor/frontend/src/stores/useHrDrillStore.ts`
- **Действие:** `CREATE`
- **Реализация:**

```typescript
import { create } from 'zustand';
import {
  HrPersonaId,
  HrQuestionRubricItem,
  HrRoundEvaluationPayload,
  HudAnchorState,
  SpeechTelemetrySnapshot,
} from '../../../shared/src';
import {
  computeSpeechTelemetry,
  createInitialHudAnchors,
  evaluateAnchorHits,
} from '../utils/hrSpeechAnalyzer';

interface HrDrillState {
  mode: 'hr_simulation' | 'hr_micro_drill';
  persona: HrPersonaId;
  activeQuestion: HrQuestionRubricItem | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  anchors: HudAnchorState[];
  telemetry: SpeechTelemetrySnapshot;
  lastEvaluation: HrRoundEvaluationPayload | null;
  drillAttemptCount: number;
  isUserSpeaking: boolean;
  turnStartTimestampMs: number | null;

  initializeHrSession: (payload: {
    mode: 'hr_simulation' | 'hr_micro_drill';
    persona: HrPersonaId;
    activeQuestion: HrQuestionRubricItem;
    currentQuestionIndex: number;
    totalQuestions: number;
  }) => void;
  startUserTurn: () => void;
  tickTurnTimer: () => void;
  ingestTranscriptDelta: (fullTurnTranscript: string) => void;
  applyRoundEvaluation: (evaluation: HrRoundEvaluationPayload) => void;
  resetCurrentDrillAttempt: () => void;
}

const INITIAL_TELEMETRY: SpeechTelemetrySnapshot = {
  activeTurnDurationSec: 0,
  durationZone: 'under',
  wordsPerMinute: 0,
  paceStatus: 'optimal',
  totalWordsSpoken: 0,
  fillerWordsTotal: 0,
  fillerBreakdown: [],
  anchorCoveragePercent: 0,
  liveTranscript: '',
};

export const useHrDrillStore = create<HrDrillState>((set, get) => ({
  mode: 'hr_micro_drill',
  persona: 'hr_friendly_screener',
  activeQuestion: null,
  currentQuestionIndex: 0,
  totalQuestions: 5,
  anchors: [],
  telemetry: INITIAL_TELEMETRY,
  lastEvaluation: null,
  drillAttemptCount: 1,
  isUserSpeaking: false,
  turnStartTimestampMs: null,

  initializeHrSession: ({
    mode,
    persona,
    activeQuestion,
    currentQuestionIndex,
    totalQuestions,
  }) => {
    set({
      mode,
      persona,
      activeQuestion,
      currentQuestionIndex,
      totalQuestions,
      anchors: createInitialHudAnchors(activeQuestion.requiredAnchors),
      telemetry: INITIAL_TELEMETRY,
      lastEvaluation: null,
      drillAttemptCount: 1,
      isUserSpeaking: false,
      turnStartTimestampMs: null,
    });
  },

  startUserTurn: () => {
    const state = get();
    if (!state.turnStartTimestampMs) {
      set({
        isUserSpeaking: true,
        turnStartTimestampMs: Date.now(),
      });
    }
  },

  tickTurnTimer: () => {
    const state = get();
    if (!state.isUserSpeaking || !state.turnStartTimestampMs) return;
    const elapsedSec = (Date.now() - state.turnStartTimestampMs) / 1000;
    const updatedTelemetry = computeSpeechTelemetry({
      fullTranscript: state.telemetry.liveTranscript,
      activeTurnDurationSec: elapsedSec,
      anchors: state.anchors,
      targetWindowSec: state.activeQuestion?.targetDurationSec,
    });
    set({ telemetry: updatedTelemetry });
  },

  ingestTranscriptDelta: (fullTurnTranscript: string) => {
    const state = get();
    const nowMs = Date.now();
    const startMs = state.turnStartTimestampMs ?? nowMs;
    const elapsedSec = (nowMs - startMs) / 1000;

    const updatedAnchors = evaluateAnchorHits(
      state.anchors,
      fullTurnTranscript,
      nowMs
    );
    const updatedTelemetry = computeSpeechTelemetry({
      fullTranscript: fullTurnTranscript,
      activeTurnDurationSec: elapsedSec,
      anchors: updatedAnchors,
      targetWindowSec: state.activeQuestion?.targetDurationSec,
    });

    set({
      isUserSpeaking: true,
      turnStartTimestampMs: startMs,
      anchors: updatedAnchors,
      telemetry: updatedTelemetry,
    });
  },

  applyRoundEvaluation: (evaluation: HrRoundEvaluationPayload) => {
    set({
      lastEvaluation: evaluation,
      isUserSpeaking: false,
    });
  },

  resetCurrentDrillAttempt: () => {
    const state = get();
    if (!state.activeQuestion) return;
    set((prev) => ({
      anchors: createInitialHudAnchors(state.activeQuestion!.requiredAnchors),
      telemetry: INITIAL_TELEMETRY,
      lastEvaluation: null,
      drillAttemptCount: prev.drillAttemptCount + 1,
      isUserSpeaking: false,
      turnStartTimestampMs: null,
    }));
  },
}));

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/frontend && npx tsc --noEmit
  
  ```

#### Шаг 9: Интерактивный визуальный HUD и панель телеметрии речи (`HrHudOverlay.tsx`)

- **Целевой файл:** `interview_tutor/frontend/src/components/HrHudOverlay.tsx`
- **Действие:** `CREATE`
- **Реализация:** Компонент на React 18 + TailwindCSS + Framer Motion, отображающий:
  1. Прогресс-бар тайминга ответа с выделенной зеленой зоной `60–80 сек` (или целевым окном текущего вопроса).
  2. Спидометр темпа речи (`WPM`) и счетчик слов-паразитов с подсветкой каждого пойманного паразита.
  3. Сетку карточек ключевых якорей (`HudAnchorState`), которые мгновенно загораются изумрудно-зеленым (`bg-emerald-950/80 border-emerald-400 text-emerald-200`) с пружинной анимацией при произнесении термина голосом.
  4. Карточку вердикта раунда с кнопкой мгновенного перезапуска (`Повторить Micro-Drill (Попытка #N)`).

```typescript
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHrDrillStore } from '../stores/useHrDrillStore';

export const HrHudOverlay: React.FC = () => {
  const {
    mode,
    persona,
    activeQuestion,
    anchors,
    telemetry,
    lastEvaluation,
    drillAttemptCount,
    isUserSpeaking,
    tickTurnTimer,
    resetCurrentDrillAttempt,
  } = useHrDrillStore();

  useEffect(() => {
    if (!isUserSpeaking) return;
    const interval = window.setInterval(() => {
      tickTurnTimer();
    }, 200);
    return () => window.clearInterval(interval);
  }, [isUserSpeaking, tickTurnTimer]);

  if (!activeQuestion) return null;

  const targetMin = activeQuestion.targetDurationSec.min;
  const targetMax = activeQuestion.targetDurationSec.max;
  const maxBarSec = targetMax + 25;
  const progressPercent = Math.min(
    100,
    (telemetry.activeTurnDurationSec / maxBarSec) * 100
  );

  const durationColorClass =
    telemetry.durationZone === 'optimal'
      ? 'text-emerald-400 border-emerald-500/60 bg-emerald-950/40'
      : telemetry.durationZone === 'over'
      ? 'text-rose-400 border-rose-500/60 bg-rose-950/40'
      : 'text-amber-300 border-amber-500/50 bg-slate-900/80';

  const wpmColorClass =
    telemetry.paceStatus === 'optimal'
      ? 'text-emerald-400'
      : telemetry.paceStatus === 'too_fast'
      ? 'text-rose-400'
      : 'text-amber-300';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 p-4 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-2xl text-slate-100">
      {/* Верхняя полоса: Режим, Персона и Счетчик попыток */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
            {mode === 'hr_micro_drill'
              ? `MICRO-DRILL • ПОПЫТКА #${drillAttemptCount}`
              : 'HR SIMULATION (15 MIN)'}
          </span>
          <h2 className="text-lg font-semibold mt-1.5 text-white">
            {activeQuestion.title}
          </h2>
          <p className="text-sm text-slate-400">
            Вопрос HR: «{activeQuestion.canonicalQuestion}»
          </p>
        </div>

        <button
          type="button"
          onClick={resetCurrentDrillAttempt}
          className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          Сбросить попытку (R)
        </button>
      </div>

      {/* Телеметрия речи: Тайминг (60-80с), WPM, Слова-паразиты, Покрытие якорей */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`p-3 rounded-xl border ${durationColorClass}`}>
          <div className="text-xs uppercase tracking-wider opacity-75">
            Тайминг (цель {targetMin}–{targetMax}с)
          </div>
          <div className="text-2xl font-mono font-bold mt-1">
            {telemetry.activeTurnDurationSec.toFixed(1)}s
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-current transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            Темп речи (115–155 WPM)
          </div>
          <div className={`text-2xl font-mono font-bold mt-1 ${wpmColorClass}`}>
            {telemetry.wordsPerMinute} <span className="text-sm">слов/мин</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Всего слов: {telemetry.totalWordsSpoken}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            Слова-паразиты
          </div>
          <div
            className={`text-2xl font-mono font-bold mt-1 ${
              telemetry.fillerWordsTotal === 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {telemetry.fillerWordsTotal}
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            {telemetry.fillerBreakdown.length > 0
              ? telemetry.fillerBreakdown
                  .map((f) => `${f.word} (${f.count})`)
                  .join(', ')
              : 'Чистая речь'}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            Выбито якорей (HUD)
          </div>
          <div className="text-2xl font-mono font-bold mt-1 text-emerald-400">
            {telemetry.anchorCoveragePercent}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {anchors.filter((a) => a.hit).length} из {anchors.length} терминов
          </div>
        </div>
      </div>

      {/* Сетка интерактивных карточек ключевых терминов (Keyword Spotter HUD) */}
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
          Обязательные маркеры мышечной памяти (загораются зеленым при произнесении):
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {anchors.map((anchor) => (
            <motion.div
              key={anchor.id}
              initial={false}
              animate={{
                scale: anchor.hit ? [1, 1.04, 1] : 1,
              }}
              transition={{ duration: 0.25 }}
              className={`p-3 rounded-xl border flex items-start justify-between gap-2 transition-colors ${
                anchor.hit
                  ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100 shadow-lg shadow-emerald-950/50'
                  : 'bg-slate-900/70 border-slate-800 text-slate-300'
              }`}
            >
              <div>
                <div className="text-xs font-mono uppercase opacity-70">
                  {anchor.category} • вес {anchor.weight}
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {anchor.label}
                </div>
              </div>
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  anchor.hit
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {anchor.hit ? '✓' : '•'}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Живая транскрипция речи кандидата */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 font-mono min-h-[3rem]">
        <span className="text-slate-500 mr-2">[LIVE STT]:</span>
        {telemetry.liveTranscript || 'Говорите в микрофон — ключевые маркеры подсветятся автоматически...'}
      </div>

      {/* Вердикт раунда от модели */}
      <AnimatePresence>
        {lastEvaluation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border ${
              lastEvaluation.passed
                ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-100'
                : 'bg-rose-950/60 border-rose-500/70 text-rose-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm uppercase tracking-wider">
                {lastEvaluation.passed
                  ? 'Раунд пройден: Мышечный паттерн зафиксирован'
                  : 'Требуется повторный прогон (Micro-Drill)'}
              </span>
              <span className="text-xs font-mono">
                Факты: {lastEvaluation.factualAccuracyScore}% | Уверенность тона:{' '}
                {lastEvaluation.confidenceToneScore}%
              </span>
            </div>
            <p className="text-sm mt-2">{lastEvaluation.coachFeedback}</p>
            {lastEvaluation.missedCriticalAnchors.length > 0 && (
              <div className="text-xs mt-2 opacity-90">
                Упущенные маркеры:{' '}
                {lastEvaluation.missedCriticalAnchors.join(', ')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

```

- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/frontend && npx tsc --noEmit
  
  ```

#### Шаг 10: Подключение WebSocket-событий и селектора HR-режимов во фронтенде

- **Целевой файл:** `interview_tutor/frontend/src/hooks/` (файл хука управления Live WebSocket сессией, уточненный на Шаге разведки) и корневой компонент сессии в `interview_tutor/frontend/src/components/`.
- **Действие:** `MODIFY`
- **Реализация:**
  1. В обработчике входящих сообщений `ws.onmessage` добавить маршрутизацию трех событий `HrServerWsEvent`:
    - При `data.type === 'hr_session_initialized'` вызывать `useHrDrillStore.getState().initializeHrSession(data)`.
    - При `data.type === 'user_transcript_delta'` вызывать `useHrDrillStore.getState().ingestTranscriptDelta(data.fullTurnTranscript)`.
    - При `data.type === 'hr_round_evaluation'` вызывать `useHrDrillStore.getState().applyRoundEvaluation(data.evaluation)`.
  2. В коллбэке `onSpeechStart` из `@ricky0123/vad-web` при активном HR-режиме вызывать `useHrDrillStore.getState().startUserTurn()`.
  3. В UI запуска сессии добавить выбор режима (`'hr_micro_drill'` и `'hr_simulation'`), выбор одной из трех HR-персон (`'hr_friendly_screener'`, `'hr_fintech_compliance'`, `'hr_conflict_hunter'`) и выбор вопроса из матрицы (`hr_q0_elevator_pitch` .. `hr_q4_compensation_and_logistics`). При активном `isHrSessionType(sessionType)` рендерить `<HrHudOverlay/>` над панелью аудио-визуализатора.
- **Команда локальной верификации шага:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/frontend && npx tsc --noEmit && npm run build
  
  ```

#### Шаг 11: Модульное тестирование Keyword Spotter и генератора HR-промптов

- **Целевой файл:** `interview_tutor/backend/src/prompts/hr/__tests__/hrPromptAndSpotter.test.ts`
- **Действие:** `CREATE`
- **Реализация:** Написать детерминированный тест, проверяющий:
  1. Что `buildHrSystemPrompt` для всех трех персон (`hr_friendly_screener`, `hr_fintech_compliance`, `hr_conflict_hunter`) включает юридические константы (`СТД-СФР`, `КНД 1122035`, `422-ФЗ`, `2 200 RPS`, `310 000 — 330 000`).
  2. Что `evaluateAnchorHits` корректно зажигает все 6 карточек Elevator Pitch при подаче эталонного текста и не срабатывает на бытовых оправданиях.
  3. Что `detectFillerWords` точно подсчитывает слова-паразиты («ну», «как бы», «типа», «короче»).
- **Команда финальной сквозной верификации проекта:**
  ```bash
  cd C:/projects/synced_with_vps/interview_tutor/shared && npx tsc --noEmit && cd ../backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit && npm run build
  
  ```
Нужно ли дополнительно детализировать скрипт автоматической синхронизации `candidateDossier.ts` с markdown-файлом `work_searching/interview/interview_screening_cheatsheet.md`, или оставляем строго типизированный константный слепок в коде?

---

*Exported from [Voyager](https://github.com/voyager-crew/voyager)*  
*Generated on October 30, 2026 at 03:12 PM*