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
        required: ['isSolved', 'feedback']
      }
    });
  } else if (sessionType === 'system_design') {
    toolDeclarations.push(
      {
        name: 'inject_chaos_failure',
        description: 'Simulates an infrastructure or network failure on a specific canvas component.',
        parameters: {
          type: 'OBJECT',
          properties: {
            failure_type: {
              type: 'STRING',
              enum: [
                'ASYMMETRIC_NETWORK_PARTITION',
                'RAFT_LEADER_CRASH_DURING_COMMIT',
                'CASCADING_RETRY_STORM',
                'STORAGE_COMPACTION_IO_STALL',
                'HOT_PARTITION_KEY_SATURATION'
              ],
              description: 'The technical failure scenario to simulate.'
            },
            target_component_id: {
              type: 'STRING',
              description: 'The unique ID of the target canvas node or edge.'
            },
            technical_context: {
              type: 'STRING',
              description: 'Precise failure details and environmental symptoms communicated to the candidate.'
            }
          },
          required: ['failure_type', 'target_component_id', 'technical_context']
        }
      },
      {
        name: 'record_candidate_observation',
        description: 'Logs an atomic piece of evaluative evidence to the hiring committee candidate packet.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dimension: {
              type: 'STRING',
              enum: [
                'problem_exploration',
                'system_architecture',
                'deep_dives_and_edge_cases',
                'operational_excellence'
              ]
            },
            signal: {
              type: 'STRING',
              enum: ['GREEN_FLAG', 'RED_FLAG']
            },
            demonstrated_level: {
              type: 'STRING',
              enum: ['L4', 'L5', 'L6', 'L7']
            },
            evidence_transcript: {
              type: 'STRING',
              description: 'Verbatim quote or precise architectural flaw showing the level.'
            }
          },
          required: ['dimension', 'signal', 'demonstrated_level', 'evidence_transcript']
        }
      },
      {
        name: 'submit_hiring_committee_verdict',
        description: 'Finalizes the interview and commits the calibrated score matrix to the hiring board.',
        parameters: {
          type: 'OBJECT',
          properties: {
            target_level: { type: 'STRING', enum: ['L5', 'L6', 'L7'] },
            calibrated_level: { type: 'STRING', enum: ['L4', 'L5', 'L6', 'L7'] },
            verdict: {
              type: 'STRING',
              enum: ['STRONG_NO_HIRE', 'NO_HIRE', 'LEANING_HIRE', 'HIRE', 'STRONG_HIRE']
            },
            scores: {
              type: 'OBJECT',
              properties: {
                exploration: { type: 'NUMBER', description: 'Score between 1.0 and 4.0' },
                architecture: { type: 'NUMBER', description: 'Score between 1.0 and 4.0' },
                deep_dives: { type: 'NUMBER', description: 'Score between 1.0 and 4.0' },
                operational_excellence: { type: 'NUMBER', description: 'Score between 1.0 and 4.0' }
              },
              required: ['exploration', 'architecture', 'deep_dives', 'operational_excellence']
            },
            calibration_defense: {
              type: 'STRING',
              description: 'Detailed justification comparing demonstrated signals against L5/L6/L7 level anchors.'
            }
          },
          required: ['target_level', 'calibrated_level', 'verdict', 'scores', 'calibration_defense']
        }
      }
    );
  }

  return toolDeclarations;
}
