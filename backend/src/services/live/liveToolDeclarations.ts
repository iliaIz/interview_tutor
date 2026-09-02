export function getLiveToolDeclarations(sessionType: string = 'interview', tutorMode?: string): any[] {
  const toolDeclarations: any[] = [];

  // Universal AI Whiteboard Tool (available in all interview & tutor sessions)
  toolDeclarations.push({
    name: 'update_whiteboard',
    description: 'Отобразить, обновить, выделить или стереть пример кода или архитектурную схему на интерактивной доске кандидата',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['write', 'patch', 'highlight', 'clear'],
          description: 'write: создать/заменить код; patch: показать diff правок; highlight: подсветить строки; clear: очистить доску'
        },
        title: { type: 'STRING', description: 'Краткий понятный заголовок (например, "Пример Singleton с volatile")' },
        language: { type: 'STRING', description: 'Язык программирования (java, sql, yaml, json)' },
        code: { type: 'STRING', description: 'Исходный код для показа на доске' },
        highlightLines: {
          type: 'ARRAY',
          items: { type: 'INTEGER' },
          description: 'Номера строк для визуального акцента'
        },
        explanation: { type: 'STRING', description: 'Краткое пояснение' }
      },
      required: ['action']
    }
  });

  if (sessionType === 'interview') {
    toolDeclarations.push({
      name: 'submit_interview_evaluation',
      description: 'Сохранить итоговую оценку, баллы и рекомендации по устному ответу кандидата',
      parameters: {
        type: 'OBJECT',
        properties: {
          score: { type: 'NUMBER', description: 'Балл от 0 до 100' },
          isPassed: { type: 'BOOLEAN', description: 'true если score >= 70, иначе false' },
          positivePoints: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Список того, что кандидат ответил точно и правильно'
          },
          missingPoints: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Список важных терминов или концепций, которые кандидат упустил'
          },
          spokenFeedback: {
            type: 'STRING',
            description: 'Краткое текстовое резюме для озвучивания и карточки отчета'
          },
          questionType: {
            type: 'STRING',
            enum: ['definitional', 'tradeoff', 'behavioral'],
            description: 'Классификация вопроса: definitional (теория), tradeoff (выбор), behavioral (опыт/аварии)'
          },
          speechCoaching: {
            type: 'OBJECT',
            properties: {
              structureType: {
                type: 'STRING',
                enum: ['STAR', 'PREP', 'RULE_OF_3', 'UNSTRUCTURED'],
                description: 'Фактическая структура ответа'
              },
              rephrasedExample: {
                type: 'STRING',
                description: 'Педагогический пример перефразирования опыта кандидата по STAR или PREP'
              }
            }
          },
          faangScorecard: {
            type: 'OBJECT',
            description: 'Официальный калибровочный пакет комитета найма BigTech',
            properties: {
              verdict: {
                type: 'STRING',
                enum: ['STRONG_HIRE', 'HIRE', 'LEANING_HIRE', 'LEANING_NO_HIRE', 'STRONG_NO_HIRE'],
                description: 'Итоговый вердикт Hiring Committee'
              },
              calibratedGrade: {
                type: 'STRING',
                enum: ['L4_MIDDLE', 'L5_SENIOR', 'L6_STAFF'],
                description: 'Фактически подтвержденный грейд кандидата'
              },
              percentile: {
                type: 'NUMBER',
                description: 'Рыночный персентиль кандидата (0-100)'
              },
              dimensionScores: {
                type: 'OBJECT',
                properties: {
                  domainDepth: { type: 'NUMBER' },
                  systemArchitecture: { type: 'NUMBER' },
                  communicationStar: { type: 'NUMBER' },
                  operationalExcellence: { type: 'NUMBER' }
                }
              },
              strengths: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Ключевые сильные стороны ответа с цитатами'
              },
              redFlags: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Критические недочеты или упущенные компромиссы'
              },
              hiringRecommendation: {
                type: 'STRING',
                description: 'Рекомендация для комитета найма'
              }
            }
          }
        },
        required: ['score', 'isPassed', 'positivePoints', 'missingPoints', 'spokenFeedback']
      }
    });
  } else if (sessionType === 'tutor' && tutorMode === 'bug_hunt') {
    toolDeclarations.push({
      name: 'mark_bug_solved',
      description: 'Зафиксировать успешное нахождение и объяснение бага кандидатом',
      parameters: {
        type: 'OBJECT',
        properties: {
          isSolved: { type: 'BOOLEAN', description: 'true если баг найден и объяснен' },
          feedback: { type: 'STRING', description: 'Краткая похвала и подтверждение' },
          keyInsight: { type: 'STRING', description: 'Ключевая мысль фикса' }
        },
        required: ['isSolved', 'feedback', 'keyInsight']
      }
    });
  }

  return toolDeclarations;
}
