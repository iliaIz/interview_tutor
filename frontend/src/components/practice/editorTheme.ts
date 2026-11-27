import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';

/**
 * Bespoke Luxury Pastel Dark Theme for Java 21 CodeMirror 6.
 * Single responsibility: color palette and syntax highlighting tokens.
 */
export const luxuryPastelTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#121622', // Soft Velvet Dark (not harsh #020617)
    backgroundImage: '',
    foreground: '#e2e8f0', // Slate-200
    caret: '#f472b6', // Pastel Rose
    selection: '#26334d', // Soft Slate selection
    selectionMatch: '#1a233a',
    lineHighlight: 'rgba(244, 114, 182, 0.05)',
    gutterBackground: '#121622',
    gutterForeground: '#8A99B0',
    gutterBorder: '#1e2638'
  },
  styles: [
    { tag: t.comment, color: '#8A99B0', fontStyle: 'italic' },
    { tag: [t.keyword, t.modifier], color: '#f472b6', fontWeight: 'bold' }, // Rose keywords (class, record, public, volatile)
    { tag: [t.typeName, t.className, t.definition(t.typeName)], color: '#38bdf8' }, // Sky-blue types (String, TokenBucket, Map)
    { tag: [t.string, t.special(t.string)], color: '#34d399' }, // Emerald strings & text blocks
    { tag: [t.number, t.bool, t.null], color: '#c084fc' }, // Violet literals (100, true, false, null)
    { tag: [t.variableName, t.propertyName], color: '#e2e8f0' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#67e8f9' }, // Cyan function names (tryAcquire, create)
    { tag: [t.annotation, t.meta], color: '#fb923c', fontStyle: 'italic' }, // Orange annotations (@Override, @Transactional)
    { tag: [t.operator, t.punctuation], color: '#94a3b8' }
  ]
});
