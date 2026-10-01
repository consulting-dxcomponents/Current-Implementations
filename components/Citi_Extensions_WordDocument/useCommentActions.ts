/**
 * useCommentActions.ts
 * Hooks for add/reply/delete comment operations and marker-position tracking.
 */
import { useCallback } from 'react';
import type { Comment, CollabMessage } from './types';
import { BADGE_CSS } from './helpers';

// ─── Add comment ─────────────────────────────────────────────────────────────

interface AddCommentOptions {
  newComment: string;
  pendingSelText: string;
  pendingImageEl: HTMLImageElement | null;
  pendingImageXY: { x: number; y: number } | null;
  savedSelectionRef: React.MutableRefObject<Range | null>;
  editorRef: React.RefObject<HTMLDivElement>;
  myName: string;
  broadcast: (msg: CollabMessage) => void;
  persistComments: (c: Comment[]) => void;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  setNewComment: (v: string) => void;
  setShowCommentInput: (v: boolean) => void;
  setSelectionPos: (v: null) => void;
  setPendingSelText: (v: string) => void;
  setPendingImageEl: (v: null) => void;
  setPendingImageXY: (v: null) => void;
  setShowComments: (v: boolean) => void;
  setActiveCommentId: (v: string) => void;
  updateWordCount: () => void;
  recomputeMarkers: () => void;
}

export function makeAddComment(opts: AddCommentOptions) {
  const {
    newComment, pendingSelText, pendingImageEl, pendingImageXY,
    savedSelectionRef, editorRef, myName,
    broadcast, persistComments, setComments,
    setNewComment, setShowCommentInput, setSelectionPos,
    setPendingSelText, setPendingImageEl, setPendingImageXY,
    setShowComments, setActiveCommentId, updateWordCount, recomputeMarkers,
  } = opts;

  if (!newComment.trim()) return;
  const commentId = Date.now().toString();
  const savedRange = savedSelectionRef.current;

  if (pendingImageEl && editorRef.current?.contains(pendingImageEl)) {
    if (!pendingImageEl.dataset.imgId)
      pendingImageEl.dataset.imgId = Date.now().toString() + Math.random().toString(36).slice(2);
    const imgId = pendingImageEl.dataset.imgId;
    pendingImageEl.classList.add('has-img-comment');

    setComments(prev => {
      const next: Comment[] = [...prev, {
        id: commentId, author: myName, text: newComment,
        selection: '🖼 Image', ts: new Date().toLocaleTimeString(), replies: [],
        imgId, imgX: pendingImageXY?.x ?? 50, imgY: pendingImageXY?.y ?? 50,
      }];
      broadcast({ type: 'comment', comments: next });
      persistComments(next);
      return next;
    });
    window.getSelection()?.removeAllRanges();
    savedSelectionRef.current = null;
    setPendingImageEl(null);
    setPendingImageXY(null);

  } else if (savedRange && pendingSelText && editorRef.current?.contains(savedRange.commonAncestorContainer)) {
    const range = savedRange.cloneRange();
    const mark = document.createElement('mark');
    mark.style.cssText = 'background:rgba(255,200,0,0.45);border-bottom:2px solid #e6a800;cursor:pointer;border-radius:2px;padding:0 1px;position:relative;';
    mark.setAttribute('data-comment-id', commentId);
    mark.title = `Comment by ${myName}: ${newComment}`;
    const badge = document.createElement('sup');
    badge.setAttribute('data-comment-badge', commentId);
    badge.contentEditable = 'false';
    badge.style.cssText = BADGE_CSS;
    badge.textContent = '💬';
    try { range.surroundContents(mark); } catch {
      const frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
    }
    mark.appendChild(badge);
    window.getSelection()?.removeAllRanges();
    savedSelectionRef.current = null;

    setComments(prev => {
      const next: Comment[] = [...prev, {
        id: commentId, author: myName, text: newComment,
        selection: pendingSelText, ts: new Date().toLocaleTimeString(), replies: [],
      }];
      broadcast({ type: 'comment', comments: next });
      persistComments(next);
      return next;
    });
  } else return;

  setNewComment('');
  setShowCommentInput(false);
  setSelectionPos(null);
  setPendingSelText('');
  setPendingImageEl(null);
  setPendingImageXY(null);
  setShowComments(true);
  setActiveCommentId(commentId);
  updateWordCount();
  setTimeout(recomputeMarkers, 50);
}

// ─── Reply ────────────────────────────────────────────────────────────────────

export function useHandleReply(
  replyText: string,
  myName: string,
  editorRef: React.RefObject<HTMLDivElement>,
  broadcast: (msg: CollabMessage) => void,
  persistComments: (c: Comment[]) => void,
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>,
  setReplyText: (v: string) => void,
  setReplyingTo: (v: null) => void,
) {
  return useCallback((commentId: string) => {
    if (!replyText.trim()) return;
    setComments(prev => {
      const next = prev.map(c => c.id !== commentId ? c : {
        ...c,
        replies: [...c.replies, {
          id: Date.now().toString(), author: myName,
          text: replyText, ts: new Date().toLocaleTimeString(),
        }],
      });
      const badge = editorRef.current?.querySelector(`sup[data-comment-badge="${commentId}"]`) as HTMLElement | null;
      if (badge) badge.textContent = String((next.find(c => c.id === commentId)?.replies.length ?? 0) + 1);
      broadcast({ type: 'comment', comments: next });
      persistComments(next);
      return next;
    });
    setReplyText('');
    setReplyingTo(null);
  }, [replyText, myName, editorRef, broadcast, persistComments, setComments, setReplyText, setReplyingTo]);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useHandleDeleteComment(
  activeCommentId: string | null,
  editorRef: React.RefObject<HTMLDivElement>,
  broadcast: (msg: CollabMessage) => void,
  persistComments: (c: Comment[]) => void,
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>,
  setActiveCommentId: (v: string | null) => void,
  recomputeMarkers: () => void,
) {
  return useCallback((commentId: string) => {
    if (editorRef.current) {
      const mark = editorRef.current.querySelector(`mark[data-comment-id="${commentId}"]`);
      if (mark) {
        mark.querySelector(`sup[data-comment-badge="${commentId}"]`)?.remove();
        const parent = mark.parentNode;
        while (mark.firstChild) parent?.insertBefore(mark.firstChild, mark);
        parent?.removeChild(mark);
      }
    }
    setComments(prev => {
      const next = prev.filter(c => c.id !== commentId);
      const deleted = prev.find(c => c.id === commentId);
      if (deleted?.imgId && !next.some(c => c.imgId === deleted.imgId) && editorRef.current) {
        (editorRef.current.querySelector(`img[data-img-id="${deleted.imgId}"]`) as HTMLImageElement | null)
          ?.classList.remove('has-img-comment');
      }
      broadcast({ type: 'comment', comments: next });
      persistComments(next);
      return next;
    });
    if (activeCommentId === commentId) setActiveCommentId(null);
    setTimeout(recomputeMarkers, 50);
  }, [activeCommentId, editorRef, broadcast, persistComments, setComments, setActiveCommentId, recomputeMarkers]);
}
