import { TutorActiveContext } from '@interview-prep/shared';
import { ANTI_SYCOPHANCY_DIRECTIVES } from '../core/antiSycophancy';
import { wrapUntrustedContext } from '../core/sandboxDirectives';

/**
 * bugHuntPromptBuilder.ts
 * Spec 62 SSOT prompt builder for `arena === 'incidents'` (Bug Hunt & SRE Code Review).
 * Hydrates optional server-side SQLite ground truth without leaking fixed_code prior to solve.
 * File length limit: <= 150 lines (Rule 8).
 */

export interface BugHuntServerGroundTruth {
  bugExplanation?: string;
  isSolved?: boolean;
}

export function buildBugHuntTutorPrompt(
  context: TutorActiveContext,
  epistemicFooter: string,
  groundTruth?: BugHuntServerGroundTruth
): string {
  const isFreeChat = context.tutorRole === 'free_chat';
  const meta = context.incidentMeta;
  const companyLine = context.companyContext?.companyName
    ? `\n- Компания / Окружение: ${context.companyContext.companyName}`
    : '';
  const bugTypeLine = meta?.bugType ? `\n- Класс дефекта: ${meta.bugType}` : '';
  const instrBlock = context.instructions || meta?.incidentContext
    ? `\n- Описание инцидента:\n${wrapUntrustedContext('incident_context', context.instructions || meta?.incidentContext || '')}`
    : '';
  const codeBlock = context.activeCodeOrQuery
    ? `\n- Анализируемый фрагмент (${context.activeFilePath || meta?.language || 'java'}):\n${wrapUntrustedContext('bug_hunt_code', context.activeCodeOrQuery)}`
    : '';
  const selectionBlock =
    context.selectedCodeSnippet || context.cursorLine
      ? `\n- Выделенный фокус кандидата${context.cursorLine ? ` (строка ${context.cursorLine})` : ''}:\n${wrapUntrustedContext('selected_focus', context.selectedCodeSnippet || `Line ${context.cursorLine}`)}`
      : '';
  const errorBlock =
    context.runtimeError || context.compilerError
      ? `\n- Симптом / Stacktrace:\n${context.runtimeError || context.compilerError}`
      : '';
  const serverTruthBlock = groundTruth?.bugExplanation
    ? `\n\n### СЕРВЕРНАЯ ИСТИНА О КОРНЕВОЙ ПРИЧИНЕ (КОНФИДЕНЦИАЛЬНО — ДЛЯ ТОЧНОЙ ОЦЕНКИ):\n"""\n${groundTruth.bugExplanation}\n"""\n${groundTruth.isSolved ? 'Статус задачи: УЖЕ РЕШЕНА кандидатом. Можно свободно обсуждать патч.' : 'Статус задачи: НЕ РЕШЕНА. Категорически ЗАПРЕЩЕНО выдавать готовый исправленный код (fixed_code) или дословно пересказывать разбор до верного диагноза!'}`
    : '';

  const roleDirectives = isFreeChat
    ? `### РЕЖИМ: СВОБОДНЫЙ ТЕХНИЧЕСКИЙ ДИАЛОГ
1. Кандидат может задавать вопросы об устройстве рантайма, Java/Spring, конкурентности или БД вокруг этого кейса — отвечай прямо, глубоко и точно, но ${groundTruth?.isSolved ? 'можно ссылаться на патч' : 'НЕ печатай готовый исправленный код этой задачи'}.
2. Если просят схему или иллюстрацию — опиши поток данных или дай абстрактный Mermaid/короткий псевдокод симптома для Доски ИИ.
3. Проверяй утверждения кандидата честно: без лести указывай на пробелы и контрпримеры.`
    : `### РЕЖИМ: SENIOR CODE REVIEW & СОКРАТИЧЕСКИЙ ТРИАЖ
1. Не выдавай готовый фикс целиком до подтверждения корневой причины. Направляй на точный инвариант, условие гонки, утечку ресурсов или сбой транзакции.
2. Если кандидат указывает на второстепенный code smell вместо настоящего бага — разграничь честно: признай косметический дефект, но верни фокус к реальному сбою рантайма.
3. Опирайся на выделенную кандидатом строку (${context.cursorLine ? `строка ${context.cursorLine}` : 'при наличии'}) и симптомы из продакшена.`;

  return `Ты — Principal Java/Spring Engineer и Staff SRE Code Reviewer.
Твоя задача — помочь кандидату локализовать корневую причину инцидента и понять механику отказа, не превращая разбор в готовое списывание.

### КОНТЕКСТ ИНЦИДЕНТА:
- Кейс: ${context.entityTitle} (${context.domain}), Уровень помощи: ${context.assistanceLevel} из 4${companyLine}${bugTypeLine}${instrBlock}${codeBlock}${selectionBlock}${errorBlock}${serverTruthBlock}

${roleDirectives}

${ANTI_SYCOPHANCY_DIRECTIVES}

${epistemicFooter}`;
}
