import { isHrSessionType } from '@interview-prep/shared';

export function getHrToolDeclarations(sessionType: string, hrMode?: string): any[] {
  const hrTools: any[] = [];

  if (isHrSessionType(sessionType) && sessionType !== 'hr_tutor') {
    hrTools.push({
      name: 'advance_hr_phase',
      description: 'Вызывается ИИ-рекрутером для перехода к следующей смысловой фазе скрининга (например от small talk к самопрезентации или к комплаенсу)',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          fromPhase: { type: 'STRING', description: 'Текущая фаза (например phase1_small_talk, phase2_elevator_pitch)' },
          toPhase: { type: 'STRING', description: 'Целевая фаза для перехода' },
          phaseSummary: { type: 'STRING', description: 'Краткое резюме того, что было сказано в завершенной фазе' }
        },
        required: ['fromPhase', 'toPhase']
      }
    });

    hrTools.push({
      name: 'emit_hr_round_evaluation',
      description: 'Вызывается в режиме Micro-Drill в конце ответа кандидата на конкретный вопрос для выставления баллов и выдачи моментального фидбека',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          questionId: { type: 'STRING', description: 'Идентификатор вопроса (например hr_q0_elevator_pitch)' },
          overallScore: { type: 'NUMBER', description: 'Итоговый балл от 0 до 100' },
          passed: { type: 'BOOLEAN', description: 'true если балл >= 85' },
          substanceMatch: { type: 'NUMBER', description: 'Соответствие фактам досье (0-100)' },
          lexicalDensity: { type: 'NUMBER', description: 'Сеньорный тезаурус vs разговорные эвфемизмы (0-100)' },
          pacingScore: { type: 'NUMBER', description: 'Укладывание в окно 60-80 сек (0-100)' },
          deliveryConfidence: { type: 'NUMBER', description: 'Уверенность речи без заискивания (0-100)' },
          missedAnchors: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Список пропущенных смысловых якорей' },
          actionableCritique: { type: 'STRING', description: 'Четкий разбор: что конкретно исправить в следующем дубле' },
          nextAction: { type: 'STRING', enum: ['repeat_drill', 'advance_next_question'], description: 'Повторить дубль или перейти дальше' }
        },
        required: ['overallScore', 'passed', 'actionableCritique']
      }
    });

    hrTools.push({
      name: 'submit_hr_evaluation',
      description: 'Зафиксировать финальную оценку, 4-осевой скоринг и вердикт по итогам полного скрининга кандидата',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          overallScore: { type: 'NUMBER', description: 'Итоговый балл от 0 до 100' },
          substanceMatch: { type: 'NUMBER', description: 'Балл за точность фактов досье (0-100)' },
          lexicalDensity: { type: 'NUMBER', description: 'Балл за профессиональную терминологию (0-100)' },
          pacingScore: { type: 'NUMBER', description: 'Балл за тайминг и структуру (0-100)' },
          deliveryConfidence: { type: 'NUMBER', description: 'Балл за уверенность речи (0-100)' },
          spokenFeedback: { type: 'STRING', description: 'Краткое текстовое резюме для озвучивания и карточки отчета' },
          strengths: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Сильные стороны кандидата' },
          redFlags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Выявленные риски или красные флаги' }
        },
        required: ['overallScore', 'spokenFeedback']
      }
    });
  }

  if (sessionType === 'hr_tutor' && hrMode === 'guided_zero_start') {
    hrTools.push({
      name: 'advance_hr_learning_step',
      description:
        'Переключает ступень (Эхо -> Перефраз -> Без подсказки -> Сборка), вариант формулировки или микро-блок в режиме обучения «С нуля» по голосовой просьбе кандидата или после успешного повтора.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: {
            type: 'STRING',
            enum: ['next_rung', 'next_beat', 'prev_beat', 'next_variant', 'repeat_beat', 'select_beat', 'toggle_cue'],
            description: 'next_rung: следующая ступень/переход дальше; next_variant: озвучить иначе; repeat_beat: повторить блок; next_beat/prev_beat: следующий/предыдущий блок; select_beat: переход к конкретному блоку по beatIndex; toggle_cue: показать/скрыть подсказку'
          },
          beatIndex: {
            type: 'INTEGER',
            description: '0-based индекс целевого блока (0 = Блок 1, 1 = Блок 2 и т.д.) для action="select_beat"'
          },
          masteredCurrentBeat: {
            type: 'BOOLEAN',
            description: 'true если кандидат уверенно произнес ключевые факты текущего блока'
          },
          reason: {
            type: 'STRING',
            description: 'Краткая причина перехода (например: "кандидат попросил дальше" или "уверенный перефраз")'
          }
        },
        required: ['action']
      }
    });
  }

  return hrTools;
}
