import {
  TransactionScenario,
  TransactionAnnotationConfig,
  ScenarioEvaluationResult,
  MethodEvaluationResult
} from '../types/transactionLab';

export class TransactionValidator {
  /**
   * Deterministic AST / Architecture evaluation (< 50ms)
   */
  public static evaluateScenario(
    scenario: TransactionScenario,
    userConfigs: Record<string, TransactionAnnotationConfig>,
    currentThreads: number
  ): ScenarioEvaluationResult {
    const methodResults: Record<string, MethodEvaluationResult> = {};
    let totalScore = 0;
    let methodCount = 0;
    let hasDeadlockHazard = false;
    let hasSelfInvocationHazard = false;

    // 1. Evaluate individual methods
    for (const service of scenario.services) {
      for (const method of service.methods) {
        methodCount++;
        const config = userConfigs[method.id] || { propagation: 'NONE' };
        const correct = method.correctConfig;
        const violations: string[] = [];
        const tips: string[] = [];
        let score = 100;

        // Check propagation match
        if (config.propagation !== correct.propagation) {
          score -= 45;
          violations.push(
            `Ожидалось распространение ${correct.propagation}, выбрано: ${config.propagation}`
          );
          tips.push(method.explanation);
        }

        // Check readOnly match if specified
        if (correct.readOnly !== undefined && config.readOnly !== correct.readOnly) {
          score -= 20;
          violations.push(
            correct.readOnly
              ? 'Рекомендуется включить readOnly = true для отключения dirty checking и роутинга на реплику'
              : 'Метод выполняет запись, readOnly = true приведет к ReadOnlyException'
          );
        }

        // Check rollbackFor on checked exceptions
        if (correct.rollbackFor && correct.rollbackFor.length > 0) {
          const hasRollback =
            config.rollbackFor &&
            config.rollbackFor.some((e) => correct.rollbackFor!.includes(e));
          if (!hasRollback) {
            score -= 30;
            violations.push(
              'Не настроен откат на проверяемые исключения (rollbackFor = Exception.class). Spring по умолчанию зафиксирует транзакцию!'
            );
          }
        }

        // Check isolation level if required
        if (correct.isolation && config.isolation !== correct.isolation) {
          score -= 25;
          violations.push(
            `Требуется уровень изоляции ${correct.isolation}, выбран: ${config.isolation || 'DEFAULT'}`
          );
        }

        // Self-invocation hazard detection
        if (method.traps.includes('self_invocation_bypass')) {
          if (config.propagation === 'REQUIRES_NEW') {
            hasSelfInvocationHazard = true;
            violations.push(
              '⚠️ Ловушка CGLIB-прокси: вызов метода через this внутри того же бина проигнорирует REQUIRES_NEW!'
            );
          }
        }

        // External I/O trap
        if (method.traps.includes('blocking_io_in_transaction')) {
          if (config.propagation !== 'NONE') {
            score -= 35;
            violations.push(
              '⚠️ Антипаттерн Idle in Transaction: внешний сетевой запрос внутри транзакции надолго блокирует JDBC-соединение'
            );
          }
        }

        // After commit trap
        if (method.traps.includes('after_commit_closed_connection')) {
          if (config.propagation !== 'REQUIRES_NEW') {
            score -= 40;
            violations.push(
              '⚠️ Фаза AFTER_COMMIT: физическое соединение уже закрыто. Без REQUIRES_NEW изменения в БД молча потеряются'
            );
          }
        }

        // Private method trap
        if (method.traps.includes('private_method_trap')) {
          if (config.propagation !== 'NONE') {
            score -= 40;
            violations.push(
              '⚠️ CGLIB No-Op: аннотация @Transactional на private/protected методах тихо игнорируется Spring AOP! Настройте транзакцию на публичном методе.'
            );
          }
        }

        // Unexpected rollback trap
        if (method.traps.includes('unexpected_rollback_trap')) {
          if (config.propagation === 'REQUIRED') {
            score -= 35;
            violations.push(
              '⚠️ Сбой дочернего метода с REQUIRED выставит setRollbackOnly(), вызвав UnexpectedRollbackException при коммите родителя! Используйте REQUIRES_NEW или NESTED.'
            );
          }
        }

        // Async context loss trap
        if (method.traps.includes('async_context_loss')) {
          if (config.propagation !== 'REQUIRES_NEW') {
            score -= 40;
            violations.push(
              '⚠️ Потеря контекста в @Async: TransactionSynchronizationManager не передает ThreadLocal в новый поток. Требуется открыть собственную транзакцию (REQUIRES_NEW).'
            );
          }
        }

        // Write skew anomaly trap
        if (method.traps.includes('write_skew_anomaly')) {
          if (config.isolation !== 'SERIALIZABLE') {
            score -= 35;
            violations.push(
              '⚠️ Аномалия Write Skew: параллельные транзакции видят один снимок и модифицируют разные строки. Требуется уровень изоляции SERIALIZABLE.'
            );
          }
        }

        // Retryable order collision trap
        if (method.traps.includes('retryable_order_collision')) {
          if (config.propagation !== 'REQUIRES_NEW') {
            score -= 30;
            violations.push(
              '⚠️ Коллизия порядков AOP: при повторной попытке @Retryable переиспользуется испорченная транзакция. Требуется REQUIRES_NEW.'
            );
          }
        }

        // Dirty checking memory bloat trap
        if (method.traps.includes('dirty_checking_memory_bloat')) {
          if (!config.readOnly) {
            score -= 25;
            violations.push(
              '⚠️ Раздувание памяти: без readOnly = true Hibernate сохранит снапшоты всех 10 000 сущностей в LoadedState для dirty-checking.'
            );
          }
        }

        // Nested savepoint tip
        if (method.traps.includes('nested_savepoint_trap')) {
          if (config.propagation === 'REQUIRES_NEW') {
            tips.push(
              '💡 Совет: REQUIRES_NEW занимает 2-е физическое соединение из пула HikariCP. Для частичного отката без риска дедлока лучше использовать NESTED (Savepoints).'
            );
          }
        }

        const clampedScore = Math.max(0, Math.min(100, score));
        totalScore += clampedScore;

        methodResults[method.id] = {
          methodId: method.id,
          isCorrect: clampedScore >= 80,
          score: clampedScore,
          violations,
          tips
        };
      }
    }

    // 2. Evaluate HikariCP Pool Starvation Deadlock (Brett Wooldridge's Theorem)
    // Formula: P <= T * (D - 1)
    const P = scenario.simulatedLoad.poolCapacity;
    const T = currentThreads;
    // Check if any method requires nested connection from pool (REQUIRES_NEW in called methods)
    let maxDepth = 1;
    for (const service of scenario.services) {
      for (const method of service.methods) {
        const config = userConfigs[method.id];
        if (config?.propagation === 'REQUIRES_NEW' && scenario.services.length > 1) {
          maxDepth = 2;
        }
      }
    }

    if (maxDepth > 1) {
      const isDeadlocked = P <= T * (maxDepth - 1);
      if (isDeadlocked) {
        hasDeadlockHazard = true;
      }
    }

    const overallScore = methodCount > 0 ? Math.round(totalScore / methodCount) : 0;
    const isPassed = overallScore >= 75 && !hasDeadlockHazard && !hasSelfInvocationHazard;

    let summary = '';
    if (isPassed) {
      summary = 'Архитектура транзакций полностью согласована и безопасна под нагрузкой.';
    } else if (hasDeadlockHazard) {
      summary = `Внимание! Риск дедлока HikariCP по теореме Вулдриджа: P=${P} <= T=${T}*(D-1=${maxDepth - 1}). Все соединения будут заблокированы в ожидании дочерних транзакций!`;
    } else if (hasSelfInvocationHazard) {
      summary = 'Обнаружен обход CGLIB-прокси: аннотации на локальных методах не сработают.';
    } else {
      summary = 'Найдены архитектурные нарушения в распространении транзакций или правилах отката.';
    }

    return {
      scenarioId: scenario.id,
      overallScore,
      isPassed,
      hasDeadlockHazard,
      hasSelfInvocationHazard,
      methodResults,
      summary
    };
  }
}
