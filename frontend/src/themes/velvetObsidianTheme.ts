/**
 * velvetObsidianTheme.ts
 * Velvet Obsidian Luxury Dark Theme Token Mappings for Prism React Renderer.
 * SLA: <= 100 lines (Rule 8 compliant).
 */

import { type PrismTheme } from 'prism-react-renderer';

export const velvetObsidianTheme: PrismTheme = {
  plain: {
    color: '#E0E6ED',
    backgroundColor: '#0B0C10',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#637777',
        fontStyle: 'italic',
      },
    },
    {
      types: ['annotation', 'decorator', 'attr-name'],
      style: {
        color: '#C792EA',
        fontWeight: '600',
      },
    },
    {
      types: ['keyword', 'tag', 'operator'],
      style: {
        color: '#7FDBCA',
      },
    },
    {
      types: ['class-name', 'type-annotation', 'builtin'],
      style: {
        color: '#82AAFF',
      },
    },
    {
      types: ['string', 'char'],
      style: {
        color: '#ECC48D',
      },
    },
    {
      types: ['function', 'function-variable'],
      style: {
        color: '#80CBC4',
      },
    },
    {
      types: ['number', 'boolean'],
      style: {
        color: '#FF5370',
      },
    },
    {
      types: ['punctuation'],
      style: {
        color: '#89DDFF',
      },
    },
    {
      types: ['deleted', 'important'],
      style: {
        color: '#FF6B6B',
        fontWeight: 'bold',
      },
    },
    {
      types: ['inserted'],
      style: {
        color: '#49D69E',
        fontWeight: 'bold',
      },
    },
  ],
};
