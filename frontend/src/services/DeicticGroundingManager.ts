import { SelectionFocus, useSelectionFocusStore } from '../store/useSelectionFocusStore';

/**
 * Fast O(1) deterministic string hash code for instant code change detection.
 * Samples large files (>2000 chars) to maintain microsecond execution time.
 */
export function fastHashCode(str: string): string {
  if (!str || str.length === 0) return '0_0';
  const len = str.length;
  let hash = 0;
  const step = len > 2000 ? Math.floor(len / 400) : 1;
  for (let i = 0; i < len; i += step) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${len}_${hash}`;
}

/**
 * Creates formatted deictic text prompt from candidate's active focus
 */
export function createDeicticFocusPrompt(focus: SelectionFocus): string {
  if (focus.zone === 'code') {
    const lineRange = focus.startLine
      ? focus.endLine && focus.endLine !== focus.startLine
        ? `строки ${focus.startLine}-${focus.endLine}`
        : `строка ${focus.startLine}`
      : '';
    const fileLabel = focus.fileName ? ` в файле «${focus.fileName}»` : '';
    const revLabel = focus.revisionTitle ? ` (версия: ${focus.revisionTitle})` : '';
    return `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: фрагмент кода${fileLabel}${revLabel}${lineRange ? ` (${lineRange})` : ''}]:\n\`\`\`${focus.language || 'java'}\n${focus.text}\n\`\`\`\n(Системная директива: кандидат голосом обращается именно к этому фрагменту кода. Учитывай это при ответе).`;
  }

  if (focus.zone === 'term') {
    return `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: термин «${focus.text}» в эталонном ответе]:\n(Системная директива: кандидат голосом задает вопрос или просит пояснить именно этот термин).`;
  }

  if (focus.zone === 'incident') {
    return `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: фрагмент инцидента/алерта]:\n«${focus.text}»\n(Системная директива: кандидат голосом обращается к этому симптому или строке стек-трейса инцидента).`;
  }

  if (focus.zone === 'hint') {
    return `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: фрагмент открытой подсказки]:\n«${focus.text}»\n(Системная директива: кандидат голосом просит пояснить эту часть подсказки).`;
  }

  if (focus.zone === 'terminal') {
    return `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: фрагмент вывода тестов/терминала]:\n\`\`\`\n${focus.text}\n\`\`\`\n(Системная директива: кандидат голосом обращается к этой ошибке или выводу тестов).`;
  }

  if (focus.zone === 'question') {
    return `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: выделен фрагмент формулировки вопроса]:\n«${focus.text}»\n(Системная директива: кандидат голосом обращается к этой части вопроса).`;
  }

  return `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: выделен фрагмент]:\n«${focus.text}»\n(Системная директива: кандидат голосом обращается к этому фрагменту на экране).`;
}

/**
 * Creates structured deictic code frame payload for Gemini Live WebSocket
 */
export function createCodeFrame(
  code: string,
  fileName?: string,
  language?: string,
  isHandoverFlush?: boolean
): any {
  const header = isHandoverFlush
    ? `📝 [АКТУАЛЬНЫЙ КОД КАНДИДАТА НА МОМЕНТ ЗАВЕРШЕНИЯ РЕЧИ${fileName ? ` (${fileName})` : ''}]`
    : `📝 [АКТУАЛЬНЫЙ КОД В РЕДАКТОРЕ${fileName ? ` (${fileName})` : ''}]`;

  return {
    type: 'screen_context_sync',
    deictic: true,
    clientContent: {
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: `${header}:\n\`\`\`${language || 'java'}\n${code}\n\`\`\`\n(Системная директива: кандидат сейчас работает именно с этой версией кода. Учитывай эти актуальные строки при ответе).`
            }
          ]
        }
      ],
      turnComplete: false
    }
  };
}

/**
 * Global mouseup listener for text selection across any [data-selection-zone]
 */
export function setupGlobalSelectionListener(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) return;

    const anchorElem = selection.anchorNode?.parentElement;
    const zoneElem = anchorElem?.closest('[data-selection-zone]') as HTMLElement | null;
    if (!zoneElem) return;

    const rawZone = zoneElem.getAttribute('data-selection-zone') || '';
    const fileName = zoneElem.getAttribute('data-file-name') || undefined;
    const language = zoneElem.getAttribute('data-language') || undefined;

    const startLineElem = selection.anchorNode?.parentElement?.closest('[data-line-number]');
    const endLineElem = selection.focusNode?.parentElement?.closest('[data-line-number]');
    const startLine = startLineElem ? parseInt(startLineElem.getAttribute('data-line-number') || '1', 10) : undefined;
    const endLine = endLineElem ? parseInt(endLineElem.getAttribute('data-line-number') || '1', 10) : undefined;

    const revIdxStr = zoneElem.getAttribute('data-revision-index');
    const revisionIndex = revIdxStr ? parseInt(revIdxStr, 10) : undefined;
    const revisionTitle = zoneElem.getAttribute('data-revision-title') || undefined;

    let zone: SelectionFocus['zone'] = 'reference_answer';
    if (rawZone === 'question') zone = 'question';
    else if (rawZone === 'code') zone = 'code';
    else if (rawZone === 'term') zone = 'term';
    else if (rawZone === 'incident') zone = 'incident';
    else if (rawZone === 'hint') zone = 'hint';
    else if (rawZone === 'terminal') zone = 'terminal';

    useSelectionFocusStore.getState().setFocus({
      zone,
      text: selectedText,
      fileName,
      language,
      startLine: startLine && endLine ? Math.min(startLine, endLine) : startLine,
      endLine: startLine && endLine ? Math.max(startLine, endLine) : endLine,
      revisionIndex,
      revisionTitle,
      timestamp: Date.now()
    });
  };

  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mouseup', handleMouseUp);
  };
}
