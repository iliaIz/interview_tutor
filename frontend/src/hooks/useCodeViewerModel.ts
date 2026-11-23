/**
 * useCodeViewerModel.ts
 * Headless hook managing diff normalization, search match indexing, and deictic grounding selection.
 * SLA: <= 140 lines (Rule 8 compliant).
 */

import { useMemo, useCallback } from 'react';
import { useSelectionFocusStore } from '../store/useSelectionFocusStore';

export type DiffKind = 'added' | 'removed' | 'neutral';

export interface LineMetadata {
  diffKind: DiffKind;
  cleanText: string;
  isMatch?: boolean;
}

export interface CodeViewerModelProps {
  code: string;
  language?: string;
  isDiff?: boolean;
  searchQuery?: string;
  title?: string;
  revisionIndex?: number;
  revisionTitle?: string;
  revisionId?: string;
}

export function useCodeViewerModel(props: CodeViewerModelProps) {
  const {
    code,
    language = 'java',
    isDiff = false,
    searchQuery = '',
    title,
    revisionIndex,
    revisionTitle,
    revisionId
  } = props;

  const { activeFocus, setFocus, clearFocus } = useSelectionFocusStore();
  const rawCodeLines = useMemo(() => (code || '').trimEnd().split('\n'), [code]);

  // SOTA 2026 Deictic Grounding: Check if line is within active user focus
  const isLineInFocus = useCallback((lineNum: number) => {
    if (!activeFocus || activeFocus.zone !== 'code') return false;
    if (activeFocus.revisionIndex !== undefined && revisionIndex !== undefined && activeFocus.revisionIndex !== revisionIndex) {
      return false;
    }
    const start = activeFocus.startLine ?? 0;
    const end = activeFocus.endLine ?? 0;
    return lineNum >= start && lineNum <= end;
  }, [activeFocus, revisionIndex]);

  const handleGutterClick = useCallback((lineNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLineInFocus(lineNum) && activeFocus?.startLine === activeFocus?.endLine) {
      clearFocus();
      return;
    }

    let start = lineNum;
    let end = lineNum;

    if (e.shiftKey && activeFocus && activeFocus.zone === 'code' && activeFocus.startLine) {
      start = Math.min(activeFocus.startLine, lineNum);
      end = Math.max(activeFocus.startLine, lineNum);
    }

    const selectedLinesText = rawCodeLines.slice(start - 1, end).join('\n');

    setFocus({
      zone: 'code',
      text: selectedLinesText,
      startLine: start,
      endLine: end,
      revisionIndex,
      revisionTitle: title || revisionTitle || (revisionIndex ? `v${revisionIndex}` : undefined),
      revisionId,
      language,
      timestamp: Date.now()
    });
  }, [isLineInFocus, activeFocus, rawCodeLines, clearFocus, setFocus, revisionIndex, title, revisionTitle, revisionId, language]);

  // Normalize code and extract unified diff & search match metadata
  const { normalizedCode, linesMeta, totalMatches } = useMemo(() => {
    const rawLines = (code || '').trimEnd().split('\n');
    const cleanSearch = searchQuery.trim().toLowerCase();

    if (!isDiff) {
      let matchesCount = 0;
      const metadata: LineMetadata[] = rawLines.map((line) => {
        const isMatch = cleanSearch.length > 0 && line.toLowerCase().includes(cleanSearch);
        if (isMatch) matchesCount++;
        return { diffKind: 'neutral', cleanText: line, isMatch };
      });

      return {
        normalizedCode: rawLines.join('\n'),
        linesMeta: metadata,
        totalMatches: matchesCount,
      };
    }

    const metadata: LineMetadata[] = [];
    const sanitizedCodeLines: string[] = [];
    let matchesCount = 0;

    for (const rawLine of rawLines) {
      let diffKind: DiffKind = 'neutral';
      let cleanText = rawLine;

      if (rawLine.startsWith('+')) {
        diffKind = 'added';
        cleanText = ' ' + rawLine.slice(1);
      } else if (rawLine.startsWith('-')) {
        diffKind = 'removed';
        cleanText = ' ' + rawLine.slice(1);
      }

      const isMatch = cleanSearch.length > 0 && cleanText.toLowerCase().includes(cleanSearch);
      if (isMatch) matchesCount++;

      metadata.push({ diffKind, cleanText, isMatch });
      sanitizedCodeLines.push(cleanText);
    }

    return {
      normalizedCode: sanitizedCodeLines.join('\n'),
      linesMeta: metadata,
      totalMatches: matchesCount,
    };
  }, [code, isDiff, searchQuery]);

  return {
    rawCodeLines,
    normalizedCode,
    linesMeta,
    totalMatches,
    isLineInFocus,
    handleGutterClick
  };
}
