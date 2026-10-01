/**
 * useMarkers.ts
 * Manages right-gutter comment marker positions and panel scroll-into-view.
 */
import { useCallback, useEffect } from 'react';
import type { Comment } from './types';

interface UseMarkersOptions {
  editorRef: React.RefObject<HTMLDivElement>;
  editorWrapperRef: React.RefObject<HTMLDivElement>;
  commentPanelRef: React.RefObject<HTMLDivElement>;
  commentsRef: React.MutableRefObject<Comment[]>;
  comments: Comment[];
  setMarkerPositions: React.Dispatch<React.SetStateAction<Array<{ id: string; top: number }>>>;
}

export function useMarkers({
  editorRef, editorWrapperRef, commentPanelRef,
  commentsRef, comments, setMarkerPositions,
}: UseMarkersOptions) {

  const recomputeMarkers = useCallback(() => {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    if (!editor || !wrapper) return;

    function offsetTopRelativeTo(el: HTMLElement, ancestor: HTMLElement): number {
      let top = 0;
      let cur: HTMLElement | null = el;
      while (cur && cur !== ancestor) {
        top += cur.offsetTop;
        cur = cur.offsetParent as HTMLElement | null;
      }
      return top;
    }

    const positions: Array<{ id: string; top: number }> = [];
    const seenIds = new Set<string>();

    // Text comment marks
    (Array.from(editor.querySelectorAll('mark[data-comment-id]')) as HTMLElement[]).forEach(m => {
      const id = m.getAttribute('data-comment-id') ?? '';
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      positions.push({ id, top: offsetTopRelativeTo(m, wrapper) });
    });

    // Image comments — staggered per image
    commentsRef.current.filter(c => c.imgId).forEach(c => {
      if (!c.imgId || seenIds.has(c.id)) return;
      seenIds.add(c.id);
      const img = editor.querySelector(`img[data-img-id="${c.imgId}"]`) as HTMLElement | null;
      if (!img) return;
      const top = offsetTopRelativeTo(img, wrapper);
      const imgComments = commentsRef.current.filter(x => x.imgId === c.imgId);
      const idx = imgComments.findIndex(x => x.id === c.id);
      positions.push({ id: c.id, top: top + idx * 28 });
    });

    setMarkerPositions(positions);
  }, [editorRef, editorWrapperRef, commentsRef, setMarkerPositions]);

  // Re-run whenever the comments list changes
  useEffect(() => { recomputeMarkers(); }, [comments, recomputeMarkers]);

  // Re-run on window scroll / resize
  useEffect(() => {
    const onScroll = () => recomputeMarkers();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [recomputeMarkers]);

  const scrollCardIntoPanel = useCallback((commentId: string) => {
    const panel = commentPanelRef.current;
    if (!panel) return;
    const card = panel.querySelector(`[data-comment-card="${commentId}"]`) as HTMLElement | null;
    if (!card) return;
    const panelTop = panel.scrollTop;
    const panelBottom = panelTop + panel.clientHeight;
    const cardTop = card.offsetTop;
    const cardBottom = cardTop + card.offsetHeight;
    if (cardTop < panelTop) {
      panel.scrollTo({ top: cardTop - 8, behavior: 'smooth' });
    } else if (cardBottom > panelBottom) {
      panel.scrollTo({ top: cardBottom - panel.clientHeight + 8, behavior: 'smooth' });
    }
  }, [commentPanelRef]);

  return { recomputeMarkers, scrollCardIntoPanel };
}
