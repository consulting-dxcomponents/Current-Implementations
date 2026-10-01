/**
 * useEditorMouseUp.ts
 *
 * Returns a stable `handleMouseUp` callback for the contentEditable editor div.
 * Responsibilities:
 *   - Image click → position the "Add comment" bubble at the click point
 *   - Comment mark / badge click → reveal comment in the side panel
 *   - Text selection → position the floating "Add comment" bubble
 *   - Table cell click → track active cell for the Table context toolbar
 *   - No selection / outside editor → clear transient UI state
 */
import { useCallback } from 'react';
import type { Comment } from './types';

interface UseEditorMouseUpOptions {
  editorRef:        React.RefObject<HTMLDivElement>;
  editorWrapperRef: React.RefObject<HTMLDivElement>;
  savedSelectionRef: React.MutableRefObject<Range | null>;
  commentsRef:      React.MutableRefObject<Comment[]>;
  readOnly:         boolean;

  saveSelection:        () => void;
  refreshFormatState:   () => void;
  scrollCardIntoPanel:  (id: string) => void;

  setActiveTableCell:   (cell: HTMLTableCellElement | null) => void;
  setActiveCommentId:   (id: string | null) => void;
  setShowComments:      (v: boolean) => void;
  setShowCommentInput:  (v: boolean) => void;
  setSelectionPos:      (pos: { top: number; left: number } | null) => void;
  setPendingSelText:    (t: string) => void;
  setPendingImageEl:    (el: HTMLImageElement | null) => void;
  setPendingImageXY:    (xy: { x: number; y: number } | null) => void;
}

export function useEditorMouseUp({
  editorRef, editorWrapperRef, savedSelectionRef, commentsRef, readOnly,
  saveSelection, refreshFormatState, scrollCardIntoPanel,
  setActiveTableCell, setActiveCommentId, setShowComments,
  setShowCommentInput, setSelectionPos, setPendingSelText,
  setPendingImageEl, setPendingImageXY,
}: UseEditorMouseUpOptions) {

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    saveSelection();
    refreshFormatState();

    // ── Image click: offer to add a comment at the exact click position ──
    const clickedImg = (e.target as HTMLElement).tagName === 'IMG'
      ? (e.target as HTMLImageElement)
      : null;

    if (clickedImg && !readOnly) {
      const imgRect  = clickedImg.getBoundingClientRect();
      const wrapRect = editorWrapperRef.current?.getBoundingClientRect();

      const pctX = Math.round(((e.clientX - imgRect.left) / imgRect.width)  * 100);
      const pctY = Math.round(((e.clientY - imgRect.top)  / imgRect.height) * 100);

      const imgId = clickedImg.dataset.imgId;
      const existingImgComments = imgId
        ? commentsRef.current.filter(c => c.imgId === imgId)
        : [];
      if (existingImgComments.length > 0) {
        setShowComments(true);
        setActiveCommentId(existingImgComments[existingImgComments.length - 1].id);
      }

      if (wrapRect) {
        setPendingImageEl(clickedImg);
        setPendingImageXY({ x: pctX, y: pctY });
        setPendingSelText('');
        savedSelectionRef.current = null;
        setSelectionPos({
          top:  e.clientY - wrapRect.top + 10,
          left: Math.max(4, Math.min(e.clientX - wrapRect.left - 60, wrapRect.width - 270)),
        });
        setShowCommentInput(false);
      }
      return;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node  = range.startContainer;
      const el    = node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : (node.parentElement as HTMLElement | null);

      setActiveTableCell(el?.closest('td, th') as HTMLTableCellElement | null);

      // Click on a comment mark or badge → reveal in panel
      const clickedMark = (
        el?.closest('mark[data-comment-id]') ??
        el?.closest('sup[data-comment-badge]')?.parentElement
      ) as HTMLElement | null;
      const cid =
        clickedMark?.getAttribute('data-comment-id') ??
        el?.closest('sup[data-comment-badge]')?.getAttribute('data-comment-badge');

      if (cid) {
        setActiveCommentId(cid);
        setShowComments(true);
        setShowCommentInput(false);
        setSelectionPos(null);
        setPendingImageEl(null);
        setTimeout(() => scrollCardIntoPanel(cid), 50);
        return;
      }

      // Text selected → show floating "Add comment" bubble
      const selText = sel.toString().trim();
      if (selText && !readOnly && editorRef.current?.contains(range.commonAncestorContainer)) {
        const rect     = range.getBoundingClientRect();
        const wrapRect = editorWrapperRef.current?.getBoundingClientRect();
        if (wrapRect) {
          setPendingSelText(selText);
          setPendingImageEl(null);
          setSelectionPos({
            top:  rect.bottom - wrapRect.top + 6,
            left: Math.max(4, Math.min(rect.left - wrapRect.left + rect.width / 2 - 60, wrapRect.width - 270)),
          });
          setShowCommentInput(false);
        }
      } else {
        setSelectionPos(null);
        setPendingImageEl(null);
        setShowCommentInput(false);
      }
    } else {
      setActiveTableCell(null);
      setSelectionPos(null);
      setPendingImageEl(null);
      setShowCommentInput(false);
    }
  }, [
    readOnly, editorRef, editorWrapperRef, savedSelectionRef, commentsRef,
    saveSelection, refreshFormatState, scrollCardIntoPanel,
    setActiveTableCell, setActiveCommentId, setShowComments,
    setShowCommentInput, setSelectionPos, setPendingSelText,
    setPendingImageEl, setPendingImageXY,
  ]);

  return handleMouseUp;
}
