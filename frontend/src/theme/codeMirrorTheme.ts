import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';

/**
 * Design Tokens for Unified SOTA 2026 Code Presentation
 * Soft Luxury Pastel Palette conforming to InterviewPrep AI Brand Guidelines
 */
export const CODE_THEME_TOKENS = {
  background: '#121622', // Soft Velvet Dark
  foreground: '#e2e8f0', // Slate-200
  caret: '#f472b6',      // Pastel Rose
  selection: '#26334d',  // Soft Slate selection
  selectionMatch: '#1a233a',
  lineHighlight: 'rgba(244, 114, 182, 0.05)',
  gutterBackground: '#121622',
  gutterForeground: '#64748b',
  gutterBorder: '#1e2638',
  syntax: {
    keyword: '#f472b6',    // Rose (class, record, public, volatile)
    type: '#38bdf8',       // Sky Blue (String, TokenBucket, Map)
    string: '#34d399',     // Emerald ("...", text blocks)
    literal: '#c084fc',    // Violet (100, true, false, null)
    function: '#67e8f9',   // Cyan (tryAcquire, create)
    annotation: '#fb923c', // Orange (@Override, @Transactional)
    comment: '#64748b',    // Slate Muted (// ...)
    punctuation: '#94a3b8' // Slate Punctuation
  }
} as const;

/**
 * Bespoke Luxury Pastel Dark Theme for Java 21 CodeMirror 6
 * Shared across WorkspaceEditor, CodeViewer (Whiteboard, Chat), and MicroKatas.
 */
export const luxuryPastelTheme = createTheme({
  theme: 'dark',
  settings: {
    background: CODE_THEME_TOKENS.background,
    backgroundImage: '',
    foreground: CODE_THEME_TOKENS.foreground,
    caret: CODE_THEME_TOKENS.caret,
    selection: CODE_THEME_TOKENS.selection,
    selectionMatch: CODE_THEME_TOKENS.selectionMatch,
    lineHighlight: CODE_THEME_TOKENS.lineHighlight,
    gutterBackground: CODE_THEME_TOKENS.gutterBackground,
    gutterForeground: CODE_THEME_TOKENS.gutterForeground,
    gutterBorder: CODE_THEME_TOKENS.gutterBorder
  },
  styles: [
    { tag: t.comment, color: CODE_THEME_TOKENS.syntax.comment, fontStyle: 'italic' },
    { tag: [t.keyword, t.modifier], color: CODE_THEME_TOKENS.syntax.keyword, fontWeight: 'bold' },
    { tag: [t.typeName, t.className, t.definition(t.typeName)], color: CODE_THEME_TOKENS.syntax.type },
    { tag: [t.string, t.special(t.string)], color: CODE_THEME_TOKENS.syntax.string },
    { tag: [t.number, t.bool, t.null], color: CODE_THEME_TOKENS.syntax.literal },
    { tag: [t.variableName, t.propertyName], color: CODE_THEME_TOKENS.foreground },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: CODE_THEME_TOKENS.syntax.function },
    { tag: [t.annotation, t.meta], color: CODE_THEME_TOKENS.syntax.annotation, fontStyle: 'italic' },
    { tag: [t.operator, t.punctuation], color: CODE_THEME_TOKENS.syntax.punctuation }
  ]
});
