/**
 * useEditorInput.ts
 *
 * Encapsulates all editor input/formatting logic:
 *   - formatState (bold, italic, alignment, lists…)
 *   - wordCount
 *   - fontSize / fontFamily / textColor toolbar state
 *   - find & replace state + handler
 *   - saveSelection / restoreSelection
 *   - exec (execCommand wrapper)
 *   - applyHeading / applyAlignment helpers
 *   - handleKeyDown (Tab navigation + mark-escape)
 */

import { useState, useCallback, useRef } from 'react';
import { wordCountOf } from './helpers';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
  justifyFull: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
}

interface UseEditorInputOptions {
  editorRef: React.RefObject<HTMLDivElement>;
  savedSelectionRef: React.MutableRefObject<Range | null>;
  readOnly: boolean;
  /** Called after every content mutation to push content to collaborators. */
  broadcastContent: () => void;
  handleTypingStart: () => void;
  scheduleEditBurst: () => void;
  /** Used by Tab-key handler to append a row when tabbing past the last cell. */
  tableAddRow: (below: boolean) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useEditorInput({
  editorRef,
  savedSelectionRef,
  readOnly,
  broadcastContent,
  handleTypingStart,
  scheduleEditBurst,
  tableAddRow,
}: UseEditorInputOptions) {

  // ── Format state ──────────────────────────────────────────────────────────
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false, italic: false, underline: false, strikeThrough: false,
    justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertUnorderedList: false, insertOrderedList: false,
  });

  // ── Toolbar dropdowns ─────────────────────────────────────────────────────
  const [fontSize, setFontSize] = useState('');
  const [fontFamily, setFontFamily] = useState('');
  const [textColor, setTextColor] = useState('#000000');

  // ── Word count ────────────────────────────────────────────────────────────
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });

  // ── Find & Replace ────────────────────────────────────────────────────────
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showFindReplace, setShowFindReplace] = useState(false);

  // ── initialHtmlRef forwarded from parent (keep in sync on mutations) ──────
  // We store a local ref to the parent's initialHtmlRef so we can update it.
  // The parent passes editorRef directly; we can write to the ref it holds.
  const initialHtmlSyncRef = useRef<{ current: string } | null>(null);

  // ── refreshFormatState ────────────────────────────────────────────────────
  const refreshFormatState = useCallback(() => {
    setFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      justifyFull: document.queryCommandState('justifyFull'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
    const currentFont = document.queryCommandValue('fontName').replace(/['"]/g, '').trim();
    const currentSize = document.queryCommandValue('fontSize').trim();
    if (currentFont) setFontFamily(currentFont);
    if (currentSize) setFontSize(currentSize);
  }, []);

  // ── updateWordCount ───────────────────────────────────────────────────────
  const updateWordCount = useCallback((initialHtmlRef?: { current: string }) => {
    const text = editorRef.current?.innerText ?? '';
    const words = wordCountOf(text);
    setWordCount({ words, chars: text.length });
    if (editorRef.current && initialHtmlRef) {
      initialHtmlRef.current = editorRef.current.innerHTML;
    }
    refreshFormatState();
    broadcastContent();
    handleTypingStart();
    scheduleEditBurst();
  }, [editorRef, refreshFormatState, broadcastContent, handleTypingStart, scheduleEditBurst]);

  // ── Selection save / restore ──────────────────────────────────────────────
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, [savedSelectionRef]);

  const restoreSelection = useCallback(() => {
    const range = savedSelectionRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [savedSelectionRef]);

  // ── execCommand wrapper ───────────────────────────────────────────────────
  const exec = useCallback((command: string, value?: string, initialHtmlRef?: { current: string }) => {
    if (readOnly) return;
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateWordCount(initialHtmlRef);
    refreshFormatState();
  }, [readOnly, restoreSelection, editorRef, updateWordCount, refreshFormatState]);

  // ── applyHeading / applyAlignment ─────────────────────────────────────────
  const applyHeading = useCallback((tag: string, initialHtmlRef?: { current: string }) => {
    exec('formatBlock', tag, initialHtmlRef);
  }, [exec]);

  const applyAlignment = useCallback((align: string, initialHtmlRef?: { current: string }) => {
    const cmd: Record<string, string> = {
      left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull',
    };
    exec(cmd[align], undefined, initialHtmlRef);
  }, [exec]);

  // ── Find & Replace handler ────────────────────────────────────────────────
  const handleFindReplace = useCallback((initialHtmlRef?: { current: string }) => {
    const body = editorRef.current;
    if (!body || !findText) return;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body.innerHTML = body.innerHTML.replace(
      new RegExp(escaped, 'gi'),
      `<mark style="background:#fff176">${replaceText}</mark>`,
    );
    updateWordCount(initialHtmlRef);
  }, [editorRef, findText, replaceText, updateWordCount]);

  // ── Helpers: first/last text node inside an element ──────────────────────
  function firstTextNode(el: Node): Text | null {
    if (el.nodeType === Node.TEXT_NODE) return el as Text;
    for (const child of Array.from(el.childNodes)) {
      const found = firstTextNode(child);
      if (found) return found;
    }
    return null;
  }

  function lastTextNode(el: Node): Text | null {
    if (el.nodeType === Node.TEXT_NODE) return el as Text;
    for (const child of Array.from(el.childNodes).reverse()) {
      const found = lastTextNode(child);
      if (found) return found;
    }
    return null;
  }

  // ── handleKeyDown ─────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, initialHtmlRef?: { current: string }) => {
    // Escape the <mark> highlight boundary when typing at/past its edge
    if (
      !e.ctrlKey && !e.metaKey && !e.altKey &&
      e.key.length === 1
    ) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const offset = range.startOffset;
        const markEl =
          (container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container as HTMLElement
          )?.closest('mark[data-comment-id]') as HTMLElement | null;

        if (markEl) {
          const atEnd =
            container.nodeType === Node.TEXT_NODE
              ? offset === container.textContent!.length && container === lastTextNode(markEl)
              : offset === markEl.childNodes.length;

          const atStart =
            container.nodeType === Node.TEXT_NODE
              ? offset === 0 && container === firstTextNode(markEl)
              : offset === 0;

          if (atEnd || atStart) {
            e.preventDefault();
            const char = e.key;
            if (atEnd) {
              markEl.insertAdjacentText('afterend', char);
              const next = markEl.nextSibling!;
              const newRange = document.createRange();
              newRange.setStart(next, char.length);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
            } else {
              markEl.insertAdjacentText('beforebegin', char);
              const prev = markEl.previousSibling!;
              const newRange = document.createRange();
              const len = prev.textContent!.length;
              newRange.setStart(prev, len);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
            }
            updateWordCount(initialHtmlRef);
            return;
          }
        }
      }
    }

    // Tab: navigate between table cells
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.getRangeAt(0).startContainer;
      const el = node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : (node.parentElement as HTMLElement | null);
      const cell = el?.closest('td, th') as HTMLTableCellElement | null;
      if (cell) {
        e.preventDefault();
        const table = cell.closest('table') as HTMLTableElement;
        const allCells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
        const idx = allCells.indexOf(cell);
        const next = e.shiftKey ? allCells[idx - 1] : allCells[idx + 1];
        if (next) {
          next.focus();
          const range = document.createRange();
          range.selectNodeContents(next);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } else if (!e.shiftKey) {
          tableAddRow(true);
        }
      }
    }
  // tableAddRow is stable (created by createTableActions); no need to list it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateWordCount]);

  return {
    // State
    formatState,
    wordCount,
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    textColor, setTextColor,
    findText, setFindText,
    replaceText, setReplaceText,
    showFindReplace, setShowFindReplace,
    // Actions
    refreshFormatState,
    updateWordCount,
    saveSelection,
    restoreSelection,
    exec,
    applyHeading,
    applyAlignment,
    handleFindReplace,
    handleKeyDown,
  };
}
